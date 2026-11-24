// 《옛날 개발자》 Phase 1 — 인트로 → 사무실 → 미션 1 실행·제출
const RUN_TIMEOUT_MS = 8000;
const MAX_OUTPUT = 4000;

const state = {
  day: 1,
  hp: 100,
  ap: 3,
  progress: 0,
  score: 0,
  pasteCount: 0,
  missionIndex: 0,
};

// --- 화면 전환 ---
function show(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

// --- 인트로 ---
let introStep = 0;
function playIntro() {
  const step = INTRO_STEPS[introStep];
  const text = document.getElementById("intro-text");
  const buttons = document.getElementById("intro-buttons");
  if (!step) {
    text.textContent = "알겠습니다. 대신 볼 일이 생겼습니다.\n2006년 3월, 미래소프트™로 볼내드리겠습니다.";
    buttons.innerHTML = "";
    const b = document.createElement("button");
    b.className = "btn primary";
    b.textContent = "...뭐야?!";
    b.onclick = enterOffice;
    buttons.appendChild(b);
    return;
  }
  text.textContent = step.text;
  buttons.innerHTML = "";
  const b = document.createElement("button");
  b.className = "btn";
  b.textContent = step.button;
  b.onclick = () => { introStep++; playIntro(); };
  buttons.appendChild(b);
}

// --- Python 워커 ---
let worker = null;
let workerReady = false;
let jobSeq = 0;
let pending = null;

function createWorker() {
  workerReady = false;
  worker = new Worker("src/pyworker.js");
  worker.onmessage = (e) => {
    const msg = e.data;
    if (msg.type === "ready") {
      workerReady = true;
      return;
    }
    if (msg.type === "result" && pending && msg.jobId === pending.jobId) {
      clearTimeout(pending.timer);
      const p = pending;
      pending = null;
      p.resolve(msg);
    }
  };
}

function runPython(code) {
  return new Promise((resolve) => {
    if (!worker) createWorker();
    const jobId = ++jobSeq;
    const timer = setTimeout(() => {
      // 시간 초과: 워커 재시작, 에디터 내용은 그대로 둔다
      worker.terminate();
      worker = null;
      pending = null;
      resolve({ ok: false, timeout: true });
    }, RUN_TIMEOUT_MS);
    pending = { jobId, resolve, timer };
    worker.postMessage({ code, jobId });
  });
}

// --- 사무실 ---
function enterOffice() {
  show("screen-office");
  loadMission();
  renderStatus();
}

function loadMission() {
  const m = MISSIONS[state.missionIndex];
  document.getElementById("boss-line").textContent = m.boss;
  document.getElementById("mission-title").textContent = m.title;
  document.getElementById("mission-brief").textContent = m.brief;
  document.getElementById("mission-req").textContent = m.requirement;
  document.getElementById("editor").value = m.starter;
  setOutput("실행 버튼을 눌러 결과를 확인하세요.", "");
}

function renderStatus() {
  document.getElementById("st-day").textContent = `입사 ${state.day}일차`;
  document.getElementById("st-hp").textContent = `첼력 ${state.hp}`;
  document.getElementById("st-ap").textContent = `행동력 ${state.ap}`;
  document.getElementById("st-progress").textContent = `진행 ${state.progress}/6`;
  document.getElementById("st-score").textContent = `인사평가 ${state.score}`;
}

function setOutput(text, cls) {
  const out = document.getElementById("output");
  out.textContent = text.length > MAX_OUTPUT ? text.slice(0, MAX_OUTPUT) + "\n... (출력이 잘렸습니다)" : text;
  out.className = cls;
}

function setBusy(busy) {
  document.getElementById("btn-run").disabled = busy;
  document.getElementById("btn-submit").disabled = busy;
}

function normalize(s) {
  return s.replace(/\r\n/g, "\n").trim();
}

async function handleRun() {
  setBusy(true);
  setOutput("실행 중...", "");
  const res = await runPython(document.getElementById("editor").value);
  setBusy(false);
  if (res.timeout) {
    setOutput("시간 초과: 실행이 너무 오래 걸려 중단했습니다. 무한 루프를 확인하세요.", "error");
  } else if (!res.ok) {
    setOutput(res.stdout + "\n" + lastErrorLine(res.error), "error");
  } else {
    setOutput(res.stdout || "(출력 없음)", "");
  }
}

function lastErrorLine(err) {
  const lines = String(err).trim().split("\n");
  return lines[lines.length - 1];
}

async function handleSubmit() {
  setBusy(true);
  setOutput("검수 중...", "");
  const res = await runPython(document.getElementById("editor").value);
  setBusy(false);
  const m = MISSIONS[state.missionIndex];

  if (res.timeout) {
    setOutput("시간 초과: 실행이 너무 오래 걸려 중단했습니다. 무한 루프를 확인하세요.", "error");
    document.getElementById("boss-line").textContent = "빨간 글씨 뜨는데? 잘되고 있는 거야?";
    return;
  }
  if (!res.ok) {
    setOutput(res.stdout + "\n" + lastErrorLine(res.error), "error");
    document.getElementById("boss-line").textContent = "빨간 글씨 뜨는데? 잘되고 있는 거야?";
    return;
  }
  if (normalize(res.stdout) !== m.expected) {
    setOutput(`결과가 기대와 다릅니다.\n\n[나온 출력]\n${res.stdout || "(출력 없음)"}\n[기대 출력]\n${m.expected}`, "error");
    document.getElementById("boss-line").textContent = "음... 이게 맞아? 다시 확인해 보게.";
    return;
  }

  // 직접 해결 성공 (기획서 §2): 행동력 1, 첼력 −5, 인사평가 +35, 진행 +1
  state.ap -= 1;
  state.hp = Math.max(0, state.hp - 5);
  state.score += 35;
  state.progress += 1;
  renderStatus();
  setOutput(res.stdout, "ok");
  document.getElementById("boss-line").textContent = m.successBoss;
  document.getElementById("btn-run").disabled = true;
  document.getElementById("btn-submit").disabled = true;
  document.getElementById("editor").disabled = true;
}

// --- 복붙 차단 (기획서 §3: 입력 이벤트만 처리, 클립보드는 읽지 않음) ---
function onPasteAttempt(e) {
  e.preventDefault();
  const line = PASTE_LINES[Math.min(state.pasteCount, PASTE_LINES.length - 1)];
  state.pasteCount += 1;
  const warn = document.getElementById("paste-warning");
  warn.textContent = `김 과장: "${line}"`;
  warn.classList.remove("hidden");
}

// --- 시작 ---
document.getElementById("btn-start").onclick = () => {
  show("screen-intro");
  introStep = 0;
  playIntro();
};

const editor = document.getElementById("editor");
editor.addEventListener("paste", onPasteAttempt);
editor.addEventListener("drop", onPasteAttempt);
// Tab 키로 들여쓰기
editor.addEventListener("keydown", (e) => {
  if (e.key === "Tab") {
    e.preventDefault();
    const { selectionStart: s, selectionEnd: t, value } = editor;
    editor.value = value.slice(0, s) + "    " + value.slice(t);
    editor.selectionStart = editor.selectionEnd = s + 4;
  }
});

document.getElementById("btn-run").onclick = handleRun;
document.getElementById("btn-submit").onclick = handleSubmit;

createWorker(); // 페이지 로드 시 Pyodide 미리 준비
