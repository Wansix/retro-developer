export const DIALOGUE_PREVIEW_KEY = "retro-dialogue-preview-v1";
export const DIALOGUE_FILE = "dialogue-custom.json";
let shared = {};
let preview = {};

export function parseDialogueOverrides(value) {
  if (!value || value.version !== 1 || !value.lines || Array.isArray(value.lines) || typeof value.lines !== "object") {
    throw new Error("대사 파일 형식을 확인해 주세요.");
  }
  const pairs = Object.entries(value.lines);
  if (pairs.length > 2000) throw new Error("대사 항목이 너무 많습니다.");
  for (const [id, lines] of pairs) {
    if (!/^[\p{L}\p{N}_.:-]{1,120}$/u.test(id) || !Array.isArray(lines) || !lines.length || lines.length > 30 ||
        lines.some(line => typeof line !== "string" || !line.trim() || line.length > 1500)) {
      throw new Error("대사는 항목당 1~30개, 한 대사당 1~1500자로 입력해 주세요.");
    }
  }
  return Object.fromEntries(pairs);
}

export function readDialoguePreview() {
  try { preview = parseDialogueOverrides(JSON.parse(localStorage.getItem(DIALOGUE_PREVIEW_KEY))); }
  catch { preview = {}; }
  return preview;
}

export async function loadDialogueOverrides() {
  readDialoguePreview();
  try {
    const response = await fetch("/src/" + DIALOGUE_FILE, { cache: "no-cache", signal: AbortSignal.timeout(3000) });
    if (response.ok) shared = parseDialogueOverrides(await response.json());
  } catch { /* Shipped defaults are always available. */ }
  return shared;
}

export function dialoguePool(id, defaults) {
  return (Object.hasOwn(preview, id) ? preview[id] : Object.hasOwn(shared, id) ? shared[id] : defaults);
}

export function dialogueText(id, fallback, vars = {}) {
  const list = dialoguePool(id, [fallback]);
  const text = list.length === 1 ? list[0] : list[Math.floor(Math.random() * list.length)];
  return text.replace(/\{([a-zA-Z]+)\}/g,
    (original, key) => Object.hasOwn(vars, key) ? vars[key] : original);
}

export function editedScript(id, original) {
  return original.map((step, index) => {
    const key = `${id}.${step.id ?? index}`;
    return {
      ...step,
      text: dialogueText(key, step.text),
      ...(step.before ? { before: dialogueText(`${key}.before`, step.before) } : {}),
    };
  });
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", event => {
    if (event.key === DIALOGUE_PREVIEW_KEY || event.key === null) readDialoguePreview();
  });
}
