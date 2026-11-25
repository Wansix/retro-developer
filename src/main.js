import { BOSS_LINES, MISSIONS, PASTE_LINES, PROLOGUE_2026, SCENE_2006, TRAVEL_LINES } from "./missions.js";
import { DEPARTMENTS, ENDINGS, EPILOGUE, LUNCH } from "./office-content.js";
import { PHASES, RELATION_NAMES, act, canSubmit, codingCost, currentMission, isCoding, isFriday, newRun, options, recordFor, recordPaste, submitSolution } from "./office.js";
import { METRICS, RULESET, formatDate } from "./records-schema.js";
import { initRecords, openRecords, syncRecord } from "./records.js";
import { initDialogueSound, typeDialogue } from "./dialogue.js";

const $ = (id) => document.getElementById(id);
const RUN_KEY = "retro-office-run-v1";
const BEST_KEY = "retro-office-best-v1";
const editor = $("editor");
let state;
let draft = null;
let shownMission;
let busy = false;
let idle;
let bossVersion = 0;
let bossTyping;

// --- 화면 전환 ---
function show(id) {
  bossTyping?.abort();
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  window.scrollTo(0, 0);
}

// --- 프롤로그: 스크립트 러너 ---
const WHO_LABEL = { me: "나", ai: "AI 에이전트", boss: "김 과장" };

function dialogueLine(parent, text, options) {
  const spoken = document.createElement("span");
  spoken.className = "visually-hidden";
  spoken.textContent = text;
  const visual = document.createElement("span");
  visual.setAttribute("aria-hidden", "true");
  const letters = document.createTextNode("");
  visual.append(letters);
  parent.append(spoken, visual);
  return typeDialogue(letters, text, options);
}

function addChatTo(logId, text, who) {
  const log = $(logId);
  const firstDay = logId === "chat-log-2006";
  const div = document.createElement("div");
  div.className = `bubble ${who === "me" ? "player" : who}`;
  if (firstDay && who === "boss") {
    const portrait = document.createElement("img");
    portrait.src = "src/assets/kim-manager.svg";
    portrait.alt = "";
    portrait.width = 42;
    portrait.height = 46;
    div.classList.add("with-portrait");
    div.append(portrait);
  }
  const copy = document.createElement("div");
  const label = document.createElement("span");
  label.className = "who";
  label.textContent = WHO_LABEL[who] || who;
  copy.append(label);
  div.append(copy);
  log.appendChild(div);
  if (logId === "chat-log" && who === "me") {
    copy.append(text);
    log.scrollTop = log.scrollHeight;
    return;
  }
  return dialogueLine(copy, text, {
    voice: who,
    ...(firstDay ? { letterMs: 64, maxMs: 2400 } : {}),
    onFrame: () => { log.scrollTop = log.scrollHeight; },
  });
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function typeAgentLogs(lines, termId, linePause) {
  const term = $(termId);
  for (const line of lines) {
    const letters = document.createTextNode("");
    term.append(letters, "\n");
    await typeDialogue(letters, line, {
      voice: "terminal", letterMs: 14, onFrame: () => { term.scrollTop = term.scrollHeight; },
    });
    await pause(linePause);
  }
}

function runScript(steps, logId, btnsId, onDone, opts = {}) {
  let i = 0;
  let meCount = 0;
  const box = document.getElementById(btnsId);

  async function next() {
    if (i >= steps.length) { onDone(); return; }
    const step = steps[i++];
    if (step.who === "me") {
      box.innerHTML = "";
      const b = document.createElement("button");
      b.className = "btn";
      b.textContent = step.text;
      b.onclick = async () => {
        box.innerHTML = "";
        meCount++;
        if (opts.onAnger) opts.onAnger(meCount);
        await addChatTo(logId, step.text, "me");
        setTimeout(next, 140);
      };
      box.appendChild(b);
    } else {
      if (step.logs && opts.termId) {
        $(opts.termId).append("\n");
        await typeAgentLogs(step.logs, opts.termId, 140);
      } else await pause(330);
      await addChatTo(logId, step.text, step.who);
      setTimeout(next, 170);
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

async function startTravel() {
  show("screen-travel");
  $("travel-log").replaceChildren();
  await typeAgentLogs(TRAVEL_LINES, "travel-log", 300);
  setTimeout(enter2006, 500);
}

function markIntroSeen() {
  try { localStorage.setItem("retro-intro-seen", "1"); } catch { /* 무시 */ }
}

function enter2006() {
  show("screen-2006");
  document.getElementById("chat-log-2006").innerHTML = "";
  runScript(SCENE_2006, "chat-log-2006", "buttons-2006", () => {
    markIntroSeen();
    setTimeout(() => show("screen-titlecard"), 900);
  });
}

function loadLocal(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}

function saveLocal(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch { /* A restricted browser can still play in memory. */ }
}

function checkpoint() {
  if (!state.ending) saveLocal(RUN_KEY, { state, draft });
}

const schedule = [
  ["arrive", "출근"], ["assign", "업무 배분"], ["morning", "코딩 미션"],
  ["lunch", "점심시간"], ["negotiate", "코딩·협상"], ["report", "진행 보고"], ["leave", "퇴근"],
];
for (const [key, label] of schedule) {
  const item = document.createElement("li");
  item.dataset.step = key;
  item.textContent = `${PHASES[key][0]}  ${label}`;
  $("schedule").append(item);
}

function replaceList(parent, values) {
  parent.replaceChildren(...values.map((text) => {
    const item = document.createElement("li");
    item.textContent = text;
    return item;
  }));
}

function bossSay(line, generated = false) {
  bossVersion++;
  bossTyping?.abort();
  bossTyping = new AbortController();
  const target = $("boss-line");
  target.replaceChildren();
  dialogueLine(target, line, { voice: "boss", maxMs: 700, signal: bossTyping.signal });
  if (generated) {
    const tag = document.createElement("span");
    tag.className = "ai-tag";
    tag.textContent = "AI";
    target.appendChild(tag);
  }
}

async function react(kind) {
  bossSay(BOSS_LINES[kind]);
  const version = bossVersion;
  try {
    const res = await fetch("/api/boss-line", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, day: state.day, hp: state.hp, overtime: state.stats.overtime }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return;
    const data = await res.json();
    if (version === bossVersion && typeof data.line === "string" && data.line.trim()) bossSay(data.line.trim().slice(0, 120), true);
  } catch { /* The scripted dialogue is already visible. */ }
}

function resetIdle() {
  clearTimeout(idle);
  if (!editor.disabled && !$("coding-panel").classList.contains("hidden")) idle = setTimeout(() => react("idle"), 45000);
}

function hud() {
  $("hud-date").textContent = `${state.day}일차 · ${formatDate(state.day)}`;
  $("hud-dday").textContent = `D-${state.deadline - state.day}`;
  $("hud-hp").textContent = state.hp;
  $("bar-hp").style.width = `${state.hp}%`;
  $("hud-progress").textContent = `${state.progress}/${MISSIONS.length}`;
  $("bar-progress").style.width = `${100 * state.progress / MISSIONS.length}%`;
  $("hud-score").textContent = state.score;
  $("hud-scope").textContent = `${state.scope}건`;
  $("relations").replaceChildren(...Object.entries(RELATION_NAMES).flatMap(([id, name]) => {
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = name;
    const value = state.relations[id];
    dd.textContent = value > 0 ? `+${value}` : String(value);
    return [dt, dd];
  }));
  const active = ({ afternoon: "negotiate", overtime: "leave" })[state.phase] ?? state.phase;
  for (const node of $("schedule").children) {
    if (node.dataset.step === active) node.setAttribute("aria-current", "step");
    else node.removeAttribute("aria-current");
  }
}

function phaseStory() {
  const phase = state.phase;
  const [clock, title] = PHASES[phase];
  const events = phase === "arrive" ? state.event.title : title;
  $("shift-clock").textContent = clock;
  $("shift-title").textContent = events;
  switch (phase) {
    case "arrive": return state.event.text;
    case "assign": return "김 과장이 오늘 업무표를 돌린다. 정 수석이 지켜보고 있고, 박 선임은 이미 볼펜 뚜껑을 열었다.";
    case "morning":
    case "afternoon":
    case "overtime": {
      const budget = `남은 업무 시간 ${state.remaining}분.`;
      if (!currentMission(state)) return `${budget} 필수 기능 검수가 끝났다. 남은 추가 일감을 정리하고 퇴근하면 배포할 수 있다.`;
      if (state.solvedToday) return `${budget} 오늘 배정된 코딩 미션은 검수를 통과했다.`;
      const needed = codingCost(state);
      return state.remaining >= needed ? `${budget} 배정 업무와 미션 제출에 ${needed}분이 필요하다.` : budget;
    }
    case "lunch": {
      const [who, line] = LUNCH[(state.shift - 1) % LUNCH.length];
      return `${who}  ‘${line}’`;
    }
    case "negotiate": {
      const team = DEPARTMENTS[state.department];
      $("shift-title").textContent = `${team.name} · ${state.request[0]}`;
      return `${team.name}  ‘${state.request[1]}’\n현재 관계 ${state.relations[state.department]} · 요청 수락 시 오후 ${state.request[2]}분 소요`;
    }
    case "report":
      if (isFriday(state.day)) {
        $("shift-title").textContent = "금요일 전체 프로젝트 회의";
        return "기획팀  ‘기능 하나만 더 넣겠습니다.’\n디자인팀  ‘최종 시안은 조금 바뀌었어요.’\n영업팀  ‘납품은 하루 앞당기기로 했습니다.’\nQA팀  ‘이 상태면 검수 시간을 더 주세요.’\n김 과장  ‘신입, 가능하지?’";
      }
      return `기능 ${state.progress}/${MISSIONS.length} · 추가 일감 ${state.scope}건. 김 과장이 현황을 묻는다.`;
    case "leave": return "김 과장이 벽시계를 한 번 보고 자리에 앉는다.";
  }
}

function submissionNextAction(choices) {
  if (!isCoding(state.phase) || !currentMission(state) || state.solvedToday || state.remaining >= codingCost(state)) return;
  const prepare = choices.find(({ id, disabled }) => id === "prepare" && !disabled);
  return state.phase !== "overtime" && prepare ? prepare : choices.find(({ id }) => id === "next");
}

function takeOfficeAction(id) {
  if (busy || !act(state, id)) return;
  if (state.ending) {
    endRun();
    return;
  }
  renderOffice(true);
  if (id === "coffee") react("coffee");
}

function renderChoices() {
  const choices = options(state);
  const inline = submissionNextAction(choices);
  $("choices").replaceChildren(...choices.filter(({ id }) => id !== inline?.id).map(({ id, label, detail, disabled }) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "act-btn";
    if (id.startsWith("ticket-")) btn.classList.add("ticket-choice");
    btn.textContent = label;
    btn.disabled = busy || disabled;
    if (detail) {
      const description = document.createElement("span");
      description.className = "cost";
      description.textContent = detail;
      btn.append(description);
    }
    btn.addEventListener("click", () => takeOfficeAction(id));
    return btn;
  }));
}

function renderCoding() {
  const mission = currentMission(state);
  const visible = isCoding(state.phase) && mission && !state.solvedToday;
  $("coding-panel").classList.toggle("hidden", !visible);
  if (!visible) {
    clearTimeout(idle);
    return;
  }
  if (shownMission !== mission.id) {
    shownMission = mission.id;
    $("mission-title").textContent = mission.title;
    $("mission-brief").textContent = mission.brief;
    $("mission-grammar").textContent = mission.grammar;
    $("mission-example").textContent = mission.example;
    $("mission-example-out").textContent = mission.exampleOut ?? "";
    $("mission-example-out").classList.toggle("hidden", !mission.exampleOut);
    $("mission-req").textContent = mission.requirement;
    $("mission-expected").textContent = mission.expectedOut;
    $("hint-box").textContent = mission.hint;
    $("mission-help").open = false;
    editor.value = draft?.id === mission.id ? draft.code : mission.starter;
    $("paste-warning").textContent = "";
    output("실행 버튼을 눌러 결과를 확인하세요.");
  }
  const cost = codingCost(state);
  $("btn-submit").textContent = `업무 제출 · ${cost}분`;
  $("btn-submit").disabled = busy || !canSubmit(state);
  const missing = cost - state.remaining;
  const next = submissionNextAction(options(state));
  const followup = next?.id === "prepare"
    ? state.phase === "morning" ? "지금 조사한 만큼 오후에 필요한 시간이 줄어요." : "지금 조사해 두면 야근에서 이어서 할 수 있어요."
    : { morning: "점심을 넘기고 오후 업무 시간에 다시 제출할 수 있어요.", afternoon: "보고를 마친 뒤 야근을 선택하면 오늘 업무를 이어서 할 수 있어요.", overtime: "오늘 업무가 끝나면 다음 출근 때 다시 도전할 수 있어요." }[state.phase];
  $("submit-help").classList.toggle("hidden", !busy && missing <= 0);
  $("submit-status").textContent = busy
    ? "Python 실행 중이에요. 결과가 나올 때까지 기다려 주세요."
    : missing > 0 ? `시간이 ${missing}분 부족해요. 남은 ${state.remaining}분, 제출에 ${cost}분 필요. ${followup}` : "";
  const nextButton = $("submit-next");
  nextButton.classList.toggle("hidden", !next || busy);
  nextButton.textContent = next?.id === "prepare" ? `사전 조사 · ${Math.min(state.cost, state.remaining)}분` : next?.label ?? "";
  nextButton.onclick = next ? () => takeOfficeAction(next.id) : null;
  $("btn-run").disabled = busy;
  editor.disabled = busy;
  resetIdle();
}

function renderOffice(focus = false) {
  bossVersion++;
  hud();
  $("shift-story").textContent = phaseStory();
  replaceList($("shift-effects"), state.effects);
  renderChoices();
  renderCoding();
  checkpoint();
  if (focus) $("shift-title").focus({ preventScroll: true });
  if (state.phase === "arrive") {
    bossSay(state.day === 1
      ? "정 수석이 기술 방향을 잡고, 나랑 박 선임, 이 선임이 쇼핑몰을 같이 맡는다. 자네는 오늘부터 사원이야."
      : "출근했구나. 오늘 일정부터 보자.");
  } else if (isCoding(state.phase) && currentMission(state) && !state.solvedToday) {
    bossSay(currentMission(state).boss);
  } else {
    bossSay(({
      assign: "인원은 그대로고 할 일은 늘었어. 업무표 보고 이야기하자.",
      lunch: "밥은 같이 먹자. 전화는 이번엔 내가 받을게.",
      negotiate: "합의한 건 메일로 남겨 둬. 내가 고객한테 설명할 때도 필요해.",
      report: "문제가 있으면 지금 말해줘. 그래야 나도 위에 보고할 수 있어.",
      leave: BOSS_LINES.leave,
    })[state.phase] ?? "오늘 처리할 수 있는 일부터 보자.");
  }
}

function enterOffice(resume = false) {
  const saved = resume ? loadLocal(RUN_KEY) : null;
  state = saved?.state ?? newRun();
  draft = saved?.draft ?? null;
  if (saved?.state) {
    // Older saves store the current day's event and its narrative text verbatim.
    const rename = (text) => text.replaceAll("김 책임", "김 과장").replaceAll("책임님, 커피", "과장님, 커피");
    state.event.title = rename(state.event.title);
    state.event.text = rename(state.event.text);
    state.effects = state.effects.map(rename);
  }
  shownMission = null;
  show("screen-office");
  prepareWorker();
  renderOffice(true);
}

function output(text, kind = "") {
  $("output").textContent = text.length > 4000 ? text.slice(0, 4000) + "\n… (출력 잘림)" : text;
  $("output").className = kind;
}

let python;
let pending;
let jobId = 0;

function stopWorker(result) {
  python?.worker.terminate();
  python = null;
  if (pending) completeJob(result);
}

function completeJob(result) {
  const job = pending;
  pending = null;
  clearTimeout(job.timer);
  job.resolve(result);
}

function prepareWorker() {
  if (python) return python;
  const worker = new Worker("src/pyworker.js?v=3");
  python = { worker, ready: false };
  worker.onmessage = ({ data }) => {
    if (python?.worker !== worker) return;
    if (data.type === "ready") {
      python.ready = true;
      if (pending) sendJob();
    } else if (data.type === "unavailable") {
      stopWorker({ unavailable: true });
    } else if (pending && data.jobId === pending.id) completeJob(data);
  };
  worker.onerror = () => {
    if (python?.worker === worker) stopWorker({ unavailable: true });
  };
  return python;
}

function sendJob() {
  clearTimeout(pending.timer);
  pending.timer = setTimeout(() => stopWorker({ timeout: true }), 8000);
  python.worker.postMessage({ code: pending.code, check: pending.check, jobId: pending.id });
}

function runPython(code, check) {
  return new Promise((resolve) => {
    const interpreter = prepareWorker();
    pending = { id: ++jobId, code, check, resolve, timer: setTimeout(() => stopWorker({ unavailable: true }), 25000) };
    if (interpreter.ready) sendJob();
  });
}

async function handlePython(submit) {
  if (busy || (submit && !canSubmit(state))) return;
  busy = true;
  renderChoices();
  renderCoding();
  $("office-title").disabled = true;
  output("Python 실행 중…");
  const result = await runPython(editor.value, submit ? currentMission(state).check : null).catch(() => ({ unavailable: true }));
  busy = false;
  $("office-title").disabled = false;
  if (result.unavailable) output("Python 실행기를 불러오지 못했습니다. 인터넷 연결을 확인하고 다시 실행하세요.", "error");
  else if (result.timeout) output("8초 동안 코드가 끝나지 않아 실행을 멈췄습니다. 반복문의 종료 조건을 확인하세요.", "error");
  else if (!result.ok) output(result.error || "실행 오류가 발생했습니다.", "error");
  else if (submit && !result.passed) output(`${result.stdout.trimEnd()}\n\n검수 실패. 출력과 변수, 그리고 경계값 조건을 다시 확인하세요.`.trimStart(), "error");
  else output(result.stdout || "(출력 없음)", "ok");
  if (submit && result.passed) {
    submitSolution(state);
    draft = null;
    if (state.ending) return endRun();
    renderOffice(true);
    if (state.scope > 0 && state.phase === "morning") react("success");
  } else {
    renderChoices();
    renderCoding();
    if (result.timeout || (!result.ok && !result.unavailable)) react("error");
  }
}

function blockInsertion(event) {
  event.preventDefault();
  const count = recordPaste(state);
  if (!count) return;
  const line = PASTE_LINES[Math.min(count - 1, PASTE_LINES.length - 1)];
  bossSay(line);
  $("paste-warning").textContent = count === 3 ? `김 과장 · ${line}  [업적 달성]` : `김 과장 · ${line}`;
  checkpoint();
}

editor.addEventListener("paste", blockInsertion);
editor.addEventListener("dragover", (event) => event.preventDefault());
editor.addEventListener("drop", blockInsertion);
editor.addEventListener("beforeinput", (event) => {
  if (["insertFromPaste", "insertFromPasteAsQuotation", "insertFromDrop"].includes(event.inputType)) blockInsertion(event);
});
editor.addEventListener("input", () => {
  draft = { id: currentMission(state).id, code: editor.value };
  checkpoint();
  resetIdle();
});
editor.addEventListener("keydown", (e) => {
  if (e.key === "Tab" && !e.shiftKey) {
    e.preventDefault();
    editor.setRangeText("    ", editor.selectionStart, editor.selectionEnd, "end");
    editor.dispatchEvent(new Event("input"));
  }
  if (e.key === "Escape") $("btn-run").focus();
});

let lastRecord;
let syncVersion = 0;

function showResult(record) {
  show("screen-ending");
  const ending = ENDINGS[record.ending];
  $("ending-title").textContent = ending.title;
  $("ending-sub").textContent = "미래소프트™ 개발자 생활 결산표";
  $("ending-desc").textContent = ending.text;
  const rows = METRICS.map(([key, label, unit]) => [
    label,
    key === "completedDay"
      ? record[key] === null ? "미완료" : `입사 ${record[key]}일차 · ${formatDate(record[key])}`
      : `${record[key]}${unit}`,
  ]);
  rows.push(["완료한 코딩 미션", `${record.progress}/${MISSIONS.length}`]);
  document.querySelector("#ending-table tbody").replaceChildren(...rows.map(([label, value]) => {
    const row = document.createElement("tr");
    const header = document.createElement("th");
    const cell = document.createElement("td");
    header.scope = "row";
    header.textContent = label;
    cell.textContent = value;
    row.append(header, cell);
    return row;
  }));
  replaceList($("ending-award"), record.achievements.map((title) => `업적 · ${title}`));
  const best = loadLocal(BEST_KEY);
  $("ending-best").textContent = best ? `이 브라우저 최단 완료 · ${best.completedDay}일차` : "";
}

function endRun() {
  clearTimeout(idle);
  bossVersion++;
  saveLocal(RUN_KEY, null);
  const record = recordFor(state);
  lastRecord = record;
  const best = loadLocal(BEST_KEY);
  if (record.completedDay && (!best || record.completedDay < best.completedDay)) saveLocal(BEST_KEY, record);
  $("ending-sync").textContent = "";
  const version = ++syncVersion;
  syncRecord(record, { ruleset: RULESET, id: state.id, seed: state.seed, moves: state.moves }).then((message) => {
    if (version === syncVersion) $("ending-sync").textContent = message;
  });
  if (!ENDINGS[record.ending].cleared) return showResult(record);

  $("chat-log-twist").replaceChildren();
  $("buttons-twist").replaceChildren();
  show("screen-twist");
  runScript(EPILOGUE, "chat-log-twist", "buttons-twist", () => {
    const end = document.createElement("p");
    end.className = "credits-end";
    end.textContent = "THE END";
    const quote = document.createElement("p");
    quote.className = "line dim";
    quote.textContent = "코딩은 컴퓨터와 하는 일이지만, 개발은 사람과 하는 일이었다.";
    const next = document.createElement("p");
    next.className = "line dim";
    next.textContent = "《최후의 개발자》에서 계속";
    const button = document.createElement("button");
    button.className = "btn primary";
    button.textContent = "결산표 보기";
    button.onclick = () => showResult(record);
    $("buttons-twist").replaceChildren(end, quote, next, button);
  });
}

function title() {
  clearTimeout(idle);
  bossVersion++;
  show("screen-title");
  const saved = loadLocal(RUN_KEY);
  $("btn-resume").classList.toggle("hidden", !saved);
  try {
    $("btn-skip-intro").classList.toggle("hidden", !localStorage.getItem("retro-intro-seen"));
  } catch { /* A restricted browser can still play the intro. */ }
  const best = loadLocal(BEST_KEY);
  const legacy = loadLocal("retro-best");
  $("title-best").textContent = best ? `이 브라우저 최단 완료 · ${best.completedDay}일차`
    : legacy ? `이전 10일판 최고 기록 · ${legacy.score}점 · ${legacy.ending}` : "";
}

$("btn-start").onclick = () => {
  show("screen-intro");
  $("chat-log").replaceChildren();
  $("agent-term").textContent = "";
  $("screen-intro").classList.remove("anger-1", "anger-2", "anger-3");
  runScript(PROLOGUE_2026, "chat-log", "intro-buttons", startTravel, { onAnger: escalateAnger, termId: "agent-term" });
};
$("btn-gotowork").onclick = () => enterOffice();
$("btn-skip-intro").onclick = () => enterOffice();
$("btn-resume").onclick = () => enterOffice(true);
$("btn-restart").onclick = () => enterOffice();
$("office-title").onclick = title;
$("ending-title-link").onclick = title;
$("btn-run").onclick = () => handlePython(false);
$("btn-submit").onclick = () => handlePython(true);

$("title-records").onclick = () => openRecords(lastRecord, title);
$("ending-records").onclick = () => openRecords(lastRecord, () => showResult(lastRecord));
initRecords(show, (message) => { $("ending-sync").textContent = message; });
initDialogueSound($("dialogue-sound"));
title();
