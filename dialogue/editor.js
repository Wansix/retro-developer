import { DIALOGUE_CATALOGUE, GROUPS } from "../src/dialogue-catalogue.js";
import { DIALOGUE_FILE, DIALOGUE_PREVIEW_KEY, loadDialogueOverrides, parseDialogueOverrides, readDialoguePreview } from "../src/dialogue-overrides.js";

const $ = id => document.getElementById(id);
const index = new Map(DIALOGUE_CATALOGUE.map(entry => [entry.id, entry]));
const shared = await loadDialogueOverrides();
let draft = { ...shared, ...readDialoguePreview() };
let selected = DIALOGUE_CATALOGUE[0];

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text != null) element.textContent = text;
  if (className) element.className = className;
  return element;
}

function status(message, error = false) {
  $("status").textContent = message;
  $("status").dataset.error = String(error);
}

function values(entry = selected) {
  return draft[entry.id] ?? entry.texts;
}

function matchingEntries() {
  const terms = $("search").value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const group = $("group").value;
  return DIALOGUE_CATALOGUE.filter(item => (!group || item.group === group) &&
    (!$("changed-only").checked || Object.hasOwn(draft, item.id)) &&
    terms.every(term => [item.id, item.context, item.speaker, ...values(item)].join(" ").toLocaleLowerCase().includes(term)));
}

function renderList() {
  const matches = matchingEntries();
  $("count").textContent = `${matches.length}개 상황 · 전체 ${DIALOGUE_CATALOGUE.length}개`;
  $("results").replaceChildren(...matches.map(item => {
    const row = node("li");
    const button = node("button");
    button.type = "button";
    if (item.id === selected.id) button.setAttribute("aria-current", "true");
    button.append(node("strong", `${item.context} · ${item.speaker}`), node("span", values(item)[0], "excerpt"));
    button.onclick = () => {
      selected = item;
      renderList();
      renderEditor();
      $("context").focus({ preventScroll: true });
    };
    row.append(button);
    return row;
  }));
  if (!matches.length) $("results").append(node("li", "일치하는 대사가 없습니다."));
}

function changeTexts(texts) {
  draft[selected.id] = texts;
  status("편집 중 · 저장하면 게임에 적용됩니다.");
}

function renderEditor() {
  $("context").textContent = selected.context;
  $("speaker").textContent = selected.speaker;
  $("details").textContent = selected.note || "추가한 대사는 같은 상황에서 다른 후보로 나옵니다.";
  const texts = values();
  $("lines").replaceChildren(...texts.map((text, i) => {
    const item = node("div");
    const controls = node("div", null, "line-head");
    const field = node("textarea");
    field.id = "line-" + i;
    field.rows = 3;
    field.maxLength = 1500;
    field.value = text;
    const label = node("label", texts.length === 1 ? "대사" : `후보 ${i + 1}`);
    label.htmlFor = field.id;
    const remove = node("button", "삭제");
    remove.setAttribute("aria-label", `후보 ${i + 1} 삭제`);
    remove.disabled = texts.length < 2;
    remove.onclick = () => {
      changeTexts(values().filter((_, index) => index !== i));
      renderEditor();
      renderList();
      $("add").focus();
    };
    field.oninput = () => changeTexts(values().map((value, index) => index === i ? field.value : value));
    controls.append(label, remove);
    item.append(controls, field);
    return item;
  }));
  $("add").disabled = texts.length >= 30;
}

function snapshot() {
  const value = { version: 1, lines: draft };
  parseDialogueOverrides(value);
  return JSON.stringify(value, null, 2) + "\n";
}

function savePreview() {
  try {
    const json = snapshot();
    localStorage.setItem(DIALOGUE_PREVIEW_KEY, json);
    status("이 브라우저에 저장했습니다. 게임에서 해당 상황이 다시 나오면 적용됩니다.");
    renderList();
    return json;
  } catch (error) {
    status(error.message, true);
    return null;
  }
}

async function writeProject() {
  const json = savePreview();
  if (!json) return;
  if (!window.showDirectoryPicker) {
    status("이 브라우저에서는 JSON을 내려받아 src/dialogue-custom.json에 넣어 주세요.", true);
    return;
  }
  try {
    const root = await window.showDirectoryPicker({ id: "retro-dialogue-project", mode: "readwrite" });
    const source = await root.getDirectoryHandle("src");
    const manifest = await source.getFileHandle(DIALOGUE_FILE);
    parseDialogueOverrides(JSON.parse(await (await manifest.getFile()).text()));
    const stream = await manifest.createWritable();
    await stream.write(json);
    await stream.close();
    status("src/dialogue-custom.json에 저장했습니다. 이 파일을 커밋하면 다음 배포에 포함됩니다.");
  } catch (error) {
    if (error.name === "AbortError") return;
    status("《옛날 개발자》 프로젝트 폴더를 선택했는지 확인해 주세요. JSON 내보내기도 사용할 수 있습니다.", true);
  }
}

$("add").onclick = () => {
  changeTexts([...values(), ""]);
  renderEditor();
  const fields = $("lines").querySelectorAll("textarea");
  fields[fields.length - 1].focus();
};
$("restore").onclick = () => {
  if (Object.hasOwn(shared, selected.id)) draft[selected.id] = [...selected.texts];
  else delete draft[selected.id];
  renderEditor();
  renderList();
  status("기본 대사로 복원했습니다. 저장하면 게임에 적용됩니다.");
};
$("preview").onclick = savePreview;
$("project").onclick = writeProject;
$("export").onclick = () => {
  try {
    const url = URL.createObjectURL(new Blob([snapshot()], { type: "application/json" }));
    const download = node("a");
    download.href = url;
    download.download = DIALOGUE_FILE;
    download.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status("프로젝트에 반영하려면 내려받은 파일을 src/dialogue-custom.json에 넣어 주세요.");
  } catch (error) { status(error.message, true); }
};
$("import").onchange = async event => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const copy = parseDialogueOverrides(JSON.parse(await file.text()));
    if (Object.keys(copy).some(id => !index.has(id))) throw new Error("이 버전의 편집실에 없는 대사 항목이 들어 있습니다.");
    draft = { ...shared, ...copy };
    renderEditor();
    renderList();
    status("JSON을 가져왔습니다. 게임에 적용하려면 저장해 주세요.");
  } catch (error) { status(error.message, true); }
  finally { event.target.value = ""; }
};
for (const [id, label] of Object.entries(GROUPS)) $("group").add(new Option(label, id));
for (const id of ["search", "group", "changed-only"]) $(id).addEventListener(id === "search" ? "input" : "change", renderList);
$("context").tabIndex = -1;
renderEditor();
renderList();
