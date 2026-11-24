// 《옛날 개발자》 — 프롤로그 + 코어 루프 + UI
const RUN_TIMEOUT_MS = 8000;
const MAX_OUTPUT = 4000;
const TOTAL_DAYS = 10;
const IDLE_MS = 45000;

const initialState = () => ({
  day: 1,
  hour: 9,
  hp: 100,
  ap: 3,
  progress: 0,
  score: 0,
  direct: 0,
  choiScore: 0,
  choiDirect: 0,
  overtime: 0,
  pasteCount: 0,
  hintCount: 0,
  delegateCount: 0,
  flatterCount: 0,
  missionIndex: 0,
  over: false,
});
let state = initialState();

// --- 화면 전환 ---
function show(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

// --- 프롤로그: 스크립트 러너 ---
const WHO_LABEL = { me: "나", ai: "AI 에이전트", boss: "김 과장" };

function addChatTo(logId, text, who) {
  const log = document.getElementById(logId);
  const div = document.createElement("div");
  div.className = `bubble ${who === "me" ? "player" : who}`;
  const label = document.createElement("span");
  label.className = "who";
  label.textContent = WHO_LABEL[who] || who;
  div.appendChild(label);
  div.appendChild(document.createTextNode(text));
  log.appendChild(div);
  div.scrollIntoView({ behavior: "smooth", block: "end" });
}

function typeAgentLogs(lines, termId, done) {
  const term = document.getElementById(termId);
  let li = 0, ci = 0;
  term.textContent += "\n";
  function tick() {
    if (li >= lines.length) { done(); return; }
    const line = lines[li];
    if (ci < line.length) {
      term.textContent += line[ci++];
      setTimeout(tick, 14);
    } else {
      term.textContent += "\n";
      li++; ci = 0;
      setTimeout(tick, 180);
    }
    term.scrollTop = term.scrollHeight;
  }
  tick();
}

function runScript(steps, logId, btnsId, onDone, opts = {}) {
  let i = 0;
  let meCount = 0;
  const box = document.getElementById(btnsId);

  function next() {
    if (i >= steps.length) { onDone(); return; }
    const step = steps[i++];
    if (step.who === "me") {
      box.innerHTML = "";
      const b = document.createElement("button");
      b.className = "btn";
      b.textContent = step.text;
      b.onclick = () => {
        box.innerHTML = "";
        addChatTo(logId, step.text, "me");
        meCount++;
        if (opts.onAnger) opts.onAnger(meCount);
        setTimeout(next, 500);
      };
      box.appendChild(b);
    } else if (step.logs && opts.termId) {
      typeAgentLogs(step.logs, opts.termId, () => {
        addChatTo(logId, step.text, step.who);
        setTimeout(next, 400);
      });
    } else {
      setTimeout(() => {
        addChatTo(logId, step.text, step.who);
        next();
      }, 900);
    }
  }
  next();
}

function escalateAnger(meCount) {
  const level = Math.min(3, Math.ceil(meCount / 2));
  const screen = document.getElementById("screen-intro");
  screen.classList.remove("anger-1", "anger-2", "anger-3");
  screen.classList.add(`anger-${level}`);
}

function startTravel() {
  show("screen-travel");
  const log = document.getElementById("travel-log");
  log.textContent = "";
  let i = 0;
  const iv = setInterval(() => {
    if (i >= TRAVEL_LINES.length) {
      clearInterval(iv);
      setTimeout(enter2006, 900);
      return;
    }
    log.textContent += TRAVEL_LINES[i++] + "\n";
  }, 750);
}

function enter2006() {
  show("screen-2006");
  document.getElementById("chat-log-2006").innerHTML = "";
  runScript(SCENE_2006, "chat-log-2006", "buttons-2006", () => {
    setTimeout(() => show("screen-titlecard"), 900);
  });
}

// --- Python 워커 ---
let worker = null;
let jobSeq = 0;
let pending = null;

function createWorker() {
  worker = new Worker("src/pyworker.js");
  worker.onmessage = (e) => {
    const msg = e.data;
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
      worker.terminate();
      worker = null;
      pending = null;
      resolve({ ok: false, timeout: true });
    }, RUN_TIMEOUT_MS);
    pending = { jobId, resolve, timer };
    worker.postMessage({ code, jobId });
  });
}

// --- HUD ---
function flash(id) {
  const el = document.getElementById(id).closest(".hud-item");
  if (!el) return;
  el.classList.remove("flash");
  void el.offsetWidth;
  el.classList.add("flash");
}

function renderStatus() {
  const date = `입사 ${state.day}일차 ${String(state.hour).padStart(2, "0")}:00`;
  document.getElementById("hud-date").textContent = date;
  document.getElementById("hud-dday").textContent = `D-${Math.max(0, TOTAL_DAYS - state.day)}`;
  document.getElementById("bar-hp").style.width = `${state.hp}%`;
  document.getElementById("hud-hp").textContent = state.hp;
  document.getElementById("bar-progress").style.width = `${(state.progress / MISSIONS.length) * 100}%`;
  document.getElementById("hud-progress").textContent = `${state.progress}/${MISSIONS.length}`;
  document.getElementById("hud-level").textContent = state.direct + 1;
  document.getElementById("hud-score").textContent = state.score;
  document.getElementById("hud-ap").textContent = "■".repeat(Math.max(0, state.ap)) || "—";
  updateActionButtons();
}

function tickClock() {
  state.hour = Math.min(23, state.hour + 1);
}

// --- 김 과장 ---
let idleTimer = null;

function bossSay(text) {
  document.getElementById("boss-line").textContent = text;
  const dlg = document.getElementById("boss-dialog");
  dlg.classList.remove("talk");
  void dlg.offsetWidth;
  dlg.classList.add("talk");
}

function resetIdle() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => bossSay(BOSS_LINES.idle), IDLE_MS);
}

// --- 레트로 알림창 ---
function showEvent(title, body, onOk) {
  document.getElementById("event-title").textContent = title;
  document.getElementById("event-body").textContent = body;
  document.getElementById("modal-event").classList.remove("hidden");
  document.getElementById("event-ok").onclick = () => {
    document.getElementById("modal-event").classList.add("hidden");
    if (onOk) onOk();
  };
}

// --- 미션 ---
function loadMission() {
  const m = MISSIONS[state.missionIndex];
  document.getElementById("mission-title").textContent = m.title;
  document.getElementById("mission-brief").textContent = m.brief;
  document.getElementById("mission-grammar").textContent = m.grammar;
  document.getElementById("mission-example").textContent = "예시) " + m.example;
  document.getElementById("mission-req").textContent = m.requirement;
  document.getElementById("mission-expected").textContent = m.expectedOut;
  document.getElementById("hint-box").classList.add("hidden");
  document.getElementById("editor").value = m.starter;
  document.getElementById("editor").disabled = false;
  document.getElementById("btn-run").disabled = false;
  document.getElementById("btn-submit").disabled = false;
  setOutput("실행 버튼을 눌러 결과를 확인하세요.", "");
  bossSay(m.boss);
  resetIdle();
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
  return String(s).replace(/\r\n/g, "\n").trim();
}

function grade(m, stdout) {
  const out = normalize(stdout);
  if (m.check.type === "output") return out === m.check.expected;
  const lastLine = out.split("\n").filter(Boolean).pop() || "";
  if (m.check.type === "number") {
    const v = Number(lastLine);
    return !Number.isNaN(v) && v === m.check.expected;
  }
  return lastLine === m.check.expected;
}

async function handleRun() {
  setBusy(true);
  setOutput("실행 중...", "");
  const res = await runPython(document.getElementById("editor").value);
  setBusy(false);
  if (res.timeout) {
    setOutput("시간 초과: 실행이 너무 오래 걸려 중단했습니다. 무한 루프를 확인하세요.", "error");
    bossSay(BOSS_LINES.error);
  } else if (!res.ok) {
    setOutput(res.stdout + "\n" + lastErrorLine(res.error), "error");
    bossSay(BOSS_LINES.error);
  } else {
    setOutput(res.stdout || "(출력 없음)", "");
  }
  resetIdle();
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
    bossSay(BOSS_LINES.error);
    return;
  }
  if (!res.ok) {
    setOutput(res.stdout + "\n" + lastErrorLine(res.error), "error");
    bossSay(BOSS_LINES.error);
    return;
  }
  if (!grade(m, res.stdout)) {
    setOutput(`결과가 기대와 다릅니다.\n\n[나온 출력]\n${res.stdout || "(출력 없음)"}\n[기대 결과]\n${m.expectedOut}`, "error");
    bossSay(BOSS_LINES.wrong);
    return;
  }
  completeMission("direct", res.stdout);
  resetIdle();
}

// 완료 처리: kind = 'direct' | 'delegate'
function completeMission(kind, stdout) {
  state.ap -= kind === "delegate" ? 2 : 1;
  state.progress += 1;
  if (kind === "direct") {
    state.hp = Math.max(0, state.hp - 5);
    state.score += 35;
    state.direct += 1;
    setOutput(stdout, "ok");
  } else {
    state.score += 20;
    state.delegateCount += 1;
  }
  tickClock();
  ["hud-progress", "hud-score", "hud-hp", "hud-ap"].forEach(flash);
  renderStatus();
  bossSay(BOSS_LINES.success);

  if (checkEnding()) return;

  state.missionIndex += 1;
  setTimeout(loadMission, 800);
}

// --- 행동 버튼 ---
function canAct(cost) {
  return !state.over && state.ap >= cost;
}

function updateActionButtons() {
  const map = {
    "act-hint": 1, "act-coffee": 1, "act-flatter": 1,
    "act-delegate": 2, "act-negotiate": 1, "act-overtime": 0, "act-leave": 0,
  };
  for (const [id, cost] of Object.entries(map)) {
    const btn = document.getElementById(id);
    let disabled = !canAct(cost);
    if (id === "act-overtime" && state.hp <= 25) disabled = true;
    if (id === "act-hint" && document.getElementById("hint-box").classList.contains("hidden") === false) disabled = true;
    btn.disabled = disabled;
  }
}

function doHint() {
  if (!canAct(1)) return;
  state.ap -= 1;
  state.hintCount += 1;
  tickClock();
  const m = MISSIONS[state.missionIndex];
  const hint = document.getElementById("hint-box");
  hint.textContent = m.hint;
  hint.classList.remove("hidden");
  bossSay(BOSS_LINES.hint);
  renderStatus();
  resetIdle();
}

function doCoffee() {
  if (!canAct(1)) return;
  state.ap -= 1;
  state.hp = Math.min(100, state.hp + 15);
  tickClock();
  flash("hud-hp");
  bossSay(BOSS_LINES.coffee);
  renderStatus();
  resetIdle();
}

function doFlatter() {
  if (!canAct(1)) return;
  state.ap -= 1;
  state.score += 45;
  state.flatterCount += 1;
  tickClock();
  flash("hud-score");
  bossSay(BOSS_LINES.flatter);
  renderStatus();
  resetIdle();
}

function doDelegate() {
  if (!canAct(2)) return;
  bossSay(BOSS_LINES.delegate);
  completeMission("delegate");
  resetIdle();
}

function doNegotiate() {
  if (!canAct(1)) return;
  state.ap -= 1;
  tickClock();
  bossSay(BOSS_LINES.negotiate);
  showEvent("일정 협상", "김 과장은 일정 협상을 들어줄 기미가 없다.\n\"일정이 왜 필요하지? 일이나 해.\"");
  renderStatus();
  resetIdle();
}

function doOvertime() {
  if (state.over || state.hp <= 25) return;
  state.ap += 2;
  state.hp = Math.max(0, state.hp - 25);
  state.overtime += 1;
  state.hour = 21;
  flash("hud-hp");
  renderStatus();
  showEvent("야근", "불 꺼진 사무실에서 모니터 불빛만 남았다.\n행동력 +2, 첼력 −25.");
  if (checkEnding()) return;
  resetIdle();
}

function doLeave() {
  if (state.over) return;
  bossSay(BOSS_LINES.leave);
  state.choiScore += 65;
  showCompare();
}

// --- 일일 비교 ---
function showCompare() {
  document.getElementById("cmp-day").textContent = state.day;
  const rows = [
    ["완료 업무", `${state.progress}건`, `${Math.floor(state.day * 0.5)}건`],
    ["직접 해결", `${state.direct}건`, `${state.choiDirect}건`],
    ["야근", `${state.overtime}회`, "0회"],
    ["첼력", state.hp, 100],
    ["인사평가", `${state.score}점`, `${state.choiScore}점`],
    ["월급", "180만 원", "180만 원"],
  ];
  const tbody = document.querySelector("#cmp-table tbody");
  tbody.innerHTML = rows
    .map(([k, a, b]) => `<tr><td>${k}</td><td>${a}</td><td>${b}</td></tr>`)
    .join("");
  document.getElementById("cmp-boss").textContent =
    state.score >= state.choiScore
      ? "김 과장: \"신입, 오늘은 좀 했네. 내일도 그렇게 해.\""
      : "김 과장: \"최 사원은 참 사회생활을 잘해. 자네도 좀 본받아.\"";
  document.getElementById("modal-compare").classList.remove("hidden");
}

document.getElementById("cmp-ok").onclick = () => {
  document.getElementById("modal-compare").classList.add("hidden");
  nextDay();
};

function nextDay() {
  state.day += 1;
  state.hour = 9;
  state.hp = Math.min(100, state.hp + 20);
  state.ap = 3;
  if (checkEnding()) return;
  renderStatus();
  bossSay(BOSS_LINES.morningAfter);
  resetIdle();
}

// --- 엔딩 (기획서 §5 우선순위) ---
function checkEnding() {
  if (state.over) return true;
  if (state.hp <= 0) return endGame("hospital"), true;
  if (state.progress >= MISSIONS.length) {
    if (state.direct === 0) return endGame("manager"), true;
    if (state.score > state.choiScore) return endGame("golden"), true;
    return endGame("normal"), true;
  }
  if (state.day > TOTAL_DAYS) return endGame("intern"), true;
  return false;
}

const ENDINGS = {
  hospital: { title: "병원으로 출근", desc: "첼력이 바닥났다. 프로젝트보다 몸이 먼저 퇴근했다.", award: false },
  intern: { title: "영원한 신입", desc: "납기를 넘겼다. 프로젝트는 끝나지 않고, 신입도 끝나지 않는다.", award: false },
  manager: { title: "차기 김 과장", desc: "코드는 한 줄도 안 썼지만 프로젝트는 끝났다. 회사가 그런 사람을 임원으로 뽑는다.", award: false },
  golden: { title: "골든 키보드 수상", desc: "직접 해결한 실력과 인정받은 평가. 개발자판 발롱도르의 주인공이다.", award: true },
  normal: { title: "평범한 개발자", desc: "프로젝트는 끝냈지만 최 사원의 평가를 넘지 못했다. 월급은 똑같다.", award: false },
};

function endGame(key) {
  state.over = true;
  const e = ENDINGS[key];
  document.getElementById("ending-title").textContent = e.title;
  document.getElementById("ending-desc").textContent = e.desc;
  document.getElementById("ending-award").textContent =
    e.award ? "🏆 골든 키보드상 수여 — 회사 최우수 사원" : "";
  const rows = [
    ["최종 인사평가", `${state.score}점 (최 사원 ${state.choiScore}점)`],
    ["동기와의 순위", state.score > state.choiScore ? "1위" : state.score === state.choiScore ? "동점" : "2위"],
    ["직접 해결", `${state.direct}건`],
    ["완료 업무", `${state.progress}/${MISSIONS.length}건`],
    ["야근", `${state.overtime}회`],
    ["복붙 적발", `${state.pasteCount}회`],
    ["박 대리 찬스", `${state.hintCount}회`],
    ["위임 / 아부", `${state.delegateCount}회 / ${state.flatterCount}회`],
    ["최종 첼력", state.hp],
  ];
  document.querySelector("#ending-table tbody").innerHTML = rows
    .map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`)
    .join("");
  show("screen-ending");
  return true;
}

// --- 복붙 차단 ---
function onPasteAttempt(e) {
  e.preventDefault();
  const line = PASTE_LINES[Math.min(state.pasteCount, PASTE_LINES.length - 1)];
  state.pasteCount += 1;
  const warn = document.getElementById("paste-warning");
  warn.textContent = `김 과장: "${line}"`;
  warn.classList.remove("hidden");
  bossSay(line);
}

// --- 시작 / 배선 ---
function enterOffice() {
  show("screen-office");
  renderStatus();
  loadMission();
}

document.getElementById("btn-start").onclick = () => {
  show("screen-intro");
  document.getElementById("chat-log").innerHTML = "";
  document.getElementById("agent-term").textContent = "";
  document.getElementById("screen-intro").classList.remove("anger-1", "anger-2", "anger-3");
  runScript(PROLOGUE_2026, "chat-log", "intro-buttons", startTravel, {
    onAnger: escalateAnger,
    termId: "agent-term",
  });
};

document.getElementById("btn-gotowork").onclick = enterOffice;

document.getElementById("btn-restart").onclick = () => {
  state = initialState();
  document.getElementById("paste-warning").classList.add("hidden");
  enterOffice();
};

const editor = document.getElementById("editor");
editor.addEventListener("paste", onPasteAttempt);
editor.addEventListener("drop", onPasteAttempt);
editor.addEventListener("input", resetIdle);
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
document.getElementById("act-hint").onclick = doHint;
document.getElementById("act-coffee").onclick = doCoffee;
document.getElementById("act-flatter").onclick = doFlatter;
document.getElementById("act-delegate").onclick = doDelegate;
document.getElementById("act-negotiate").onclick = doNegotiate;
document.getElementById("act-overtime").onclick = doOvertime;
document.getElementById("act-leave").onclick = doLeave;

createWorker(); // 페이지 로드 시 Pyodide 미리 준비
