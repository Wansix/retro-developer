import { BOSS_LINES, MISSIONS, PASTE_LINES, SCENE_2006, TRAVEL_LINES, WRONG_RUN_LINES } from "./missions.js";
import { DEPARTMENTS, ENDINGS, EPILOGUE } from "./office-content.js";
import { CAST_NAMES, officeScene } from "./office-scenes.js";
import {
  CLEANUP_MINUTES, CODE_DELEGATION, CODE_REVIEW_MINUTES, DEBUG_PASS_MOVE, PHASES, RELATION_NAMES, act, canDelegateCode, canReviewCode,
  canSubmit, codingCost, currentMission, delegateCodeWork, failCodeSubmission, hasDirectAssignments,
  hasChainedWork, hasLanguageAssignment, hasProblemBank, hasShortProject, hasWorkContent, isCoding, isFriday, isTutorial, missionCount,
  missionNotice, needsAssignment, newRun, nextAssignment, options, passWorkForDebug, projectDay, recordFor, recordPaste, requestCodeReview,
  submitSolution, submitSpecialWork,
} from "./office.js";
import { WORK_TYPES, workResultRows } from "./work-missions.js";
import { buildWorkBoard } from "./work-ui.js";
import { mountMinesWindow } from "./mines-ui.js";
import { mountIntranet } from "./intranet-ui.js";
import { commentOnInternetSolution, newInternetState } from "./intranet-search.js";
import { newCompanionState } from "./comdori-commentary.js";
import { mountOfficeCompanion } from "./comdori-companion.js";
import { FIRST_RULESET, METRICS, PROJECT_WORKDAYS, TOTAL_DAYS, formatDate, formatMinutes } from "./records-schema.js";
import { SCRUM_REPORTS } from "./scrum.js";
import { initRecords, openRecords, syncRecord } from "./records.js";
import { dialogueLine, initDialogueSound, playFootsteps, typeDialogue } from "./dialogue.js";
import { playIntro } from "./intro.js";
import { OPENING_WORK, PROJECT_GOAL } from "./project-work.js";
import { LANGUAGES } from "./office-languages.js";
import { mountOfficePresence } from "./office-presence.js";
import { mountCodeHighlight } from "./code-highlight.js";

const $ = (id) => document.getElementById(id);
const RUN_KEY = "retro-office-run-v1";
const BEST_KEY = "retro-office-best-v1";
const LOCAL_DEBUG = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
const editor = $("editor");
const paintEditor = mountCodeHighlight(editor, $("editor-highlight"));
const coworkerHelp = $("coworker-help");
let state;
let draft = null;
let workDraft = null;
let internetState = newInternetState();
let companionState = newCompanionState();
let presenceSeen = [];
let shownMission;
let shownChallenge;
let readChallenge;
let busy = false;
let idle;
let bossVersion = 0;
let bossTyping;
let clockChecks = 0;
let wrongRunComments = 0;
let clockPeekTimer;
let clockPeekPhase;
let officeLines = [];
let officeLineTimer;
const officeGuide = $("office-guide");
const nextOfficeLine = $("office-dialogue-next");
const officeReducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const compactOffice = matchMedia("(max-width: 740px), (max-height: 430px)");
const CLOCK_REPLIES = [
  "시계 봤어? 나도 봤어. 일단 이거 하나만 더 보자.",
  "시계 보고 있으면 시간이 더 안 가. 나도 신입 때 확인해 봤어.",
  "벌써 퇴근 생각이야? …그래, 나도 방금 했어.",
];
const MINE_REPLIES = [
  [["boss", "신입, 지금 뭐 하는 거야?"], ["me", "지뢰 제거하고 있습니다."], ["boss", "우리 프로젝트에 지뢰가 그렇게 많아?"]],
  [["boss", "또 지뢰야? 이번엔 진짜 버그 하나 잡아 와."], ["lee", "지금 들어온 추가 일감은 깃발로 표시해 둘게요."]],
  [["boss", "지뢰찾기는 배포 승인 받고 해. 오늘 결산에는 내가 직접 적을 테니까."]],
];

// --- 화면 전환 ---
function show(id) {
  hideClockTime();
  stopOfficeScene();
  bossTyping?.abort();
  $("boss-face").dataset.action = "still";
  delete $("office-scene").dataset.speaking;
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  window.scrollTo(0, 0);
  companion.sync(id === "screen-office");
  if (id !== "screen-office") intranet.sync(false);
  if (id !== "screen-office" && coworkerHelp.matches(":popover-open")) coworkerHelp.hidePopover();
  minesWindow.sync();
}

// --- 프롤로그: 스크립트 러너 ---
const WHO_LABEL = { me: "나", ai: "컴돌이", boss: "김 과장" };

async function addChatTo(logId, text, who) {
  const log = $(logId);
  const firstDay = logId === "chat-log-2006";
  const div = document.createElement("div");
  div.className = `bubble ${who === "me" ? "player" : who}`;
  let portrait;
  if (who === "ai" || (firstDay && who === "boss")) {
    portrait = document.createElement("span");
    portrait.className = who === "ai" ? "comdori-avatar" : "kim-avatar";
    portrait.dataset.action = "talking";
    portrait.setAttribute("aria-hidden", "true");
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
  if (firstDay && who === "boss" && log.childElementCount === 1 && !officeReducedMotion.matches) {
    log.parentElement.animate([
      { transform: "translate(0, 0)" },
      { transform: "translate(-7px, 3px)" },
      { transform: "translate(6px, -2px)" },
      { transform: "translate(-4px, 1px)" },
      { transform: "translate(2px, 0)" },
      { transform: "translate(0, 0)" },
    ], { duration: 320, easing: "ease-out" });
  }
  if (firstDay && who === "me") {
    copy.append(text);
    log.scrollTop = log.scrollHeight;
    return;
  }
  await dialogueLine(copy, text, {
    voice: who,
    ...(firstDay ? { letterMs: 64, maxMs: 2400 } : {}),
    onFrame: () => { log.scrollTop = log.scrollHeight; },
  });
  if (portrait) portrait.dataset.action = "still";
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

function runScript(steps, logId, btnsId, onDone) {
  let i = 0;
  const box = document.getElementById(btnsId);

  async function next() {
    if (i >= steps.length) { onDone(); return; }
    const step = steps[i++];
    if (step.who === "me") {
      box.innerHTML = "";
      const b = document.createElement("button");
      b.className = "btn";
      if (logId === "chat-log-2006") {
        b.classList.add("scene-reply");
        const reply = document.createElement("span");
        reply.textContent = step.text;
        const action = document.createElement("span");
        action.className = "prologue-cta-action";
        action.textContent = "대답하기";
        const arrow = document.createElement("span");
        arrow.setAttribute("aria-hidden", "true");
        arrow.textContent = " →";
        action.append(arrow);
        b.append(reply, action);
      } else b.textContent = step.text;
      b.onclick = async () => {
        box.innerHTML = "";
        await addChatTo(logId, step.text, "me");
        setTimeout(next, 140);
      };
      box.appendChild(b);
    } else {
      await pause(330);
      await addChatTo(logId, step.text, step.who);
      setTimeout(next, 170);
    }
  }
  next();
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
  if (!state.ending) saveLocal(RUN_KEY, { state, draft, workDraft, internetState, companionState, presenceSeen });
}

const companion = mountOfficeCompanion({
  getState: () => companionState,
  getShift: () => state?.shift ?? 0,
  paused: () => officeGuide.open || coworkerHelp.matches(":popover-open") || $("challenge-help").open || !!state?.leisure?.warning,
  onChange: checkpoint,
  onLessonNext() {
    companion.teach("input");
    editor.focus({ preventScroll: true });
  },
});

const presence = mountOfficePresence({
  editor,
  active: () => !!state && hasLanguageAssignment(state) && $("screen-office").classList.contains("active") && isCoding(state.phase),
  available: () => !busy && !officeLines.length && !document.querySelector("dialog[open]") && !coworkerHelp.matches(":popover-open") &&
    !state.leisure?.open && !$("office-scene").dataset.speaking,
  read: () => presenceSeen,
  save(kind) { presenceSeen.push(kind); checkpoint(); },
  boss: bossSay,
  companion: companion.emit,
});

const intranet = mountIntranet({
  getState: () => internetState,
  getMission: () => state && currentMission(state),
  onChange() { checkpoint(); resetIdle(); },
  onComment: event => companion.emit(event === "search" ? "search" : `web-${event}`),
});

const MINES_BEST_KEY = "retro-mines-best-v1";
const minesWindow = mountMinesWindow({
  state: () => state,
  active: () => $("screen-office").classList.contains("active"),
  busy: () => busy,
  recordBest(seconds) {
    const best = loadLocal(MINES_BEST_KEY);
    if (seconds && (!best || seconds < best)) {
      saveLocal(MINES_BEST_KEY, seconds);
      return seconds;
    }
    return best;
  },
  onWarning: playFootsteps,
  onChange({ closed, timeChanged, opened }) {
    if (closed) {
      renderOffice();
      if (closed === "caught") {
        playOfficeScene(MINE_REPLIES[Math.min(3, state.stats.minesCaught) - 1]);
        companion.emit("scolded");
      }
      if (closed === "expired") bossSay("지금 쓸 수 있는 업무 시간이 다 갔어. 다음 일정으로 넘어가.");
      companion.tick();
    } else {
      if (timeChanged) hud();
      if (opened) {
        resetIdle();
        companion.emit("mines");
      }
      checkpoint();
    }
  },
});

const schedule = [
  ["arrive", "출근"], ["scrum", "데일리 스크럼"], ["assign", "업무 배분"], ["morning", "코딩 미션"],
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

function setOfficePortrait(who, pose) {
  $("office-scene").dataset.speaker = who;
  const manager = $("boss-face");
  const colleague = $("coworker-face");
  manager.classList.toggle("hidden", who !== "boss");
  colleague.classList.toggle("hidden", who === "boss" || who === "me");
  manager.dataset.action = who === "boss" && pose === "talking" ? "talking" : "still";
  if (who === "boss" || who === "me") return;
  const frame = officeReducedMotion.matches ? "portrait" : pose;
  colleague.src = `src/assets/cast/${who}-${frame}.png`;
}

function officeSay(who, line, { source, expression } = {}) {
  bossVersion++;
  bossTyping?.abort();
  bossTyping = new AbortController();
  const { signal } = bossTyping;
  const target = $("boss-line");
  target.replaceChildren();
  $("office-speaker").textContent = CAST_NAMES[who];
  $("office-scene").dataset.speaking = "true";
  setOfficePortrait(who, "talking");
  return dialogueLine(target, line, { voice: who, letterMs: 34, maxMs: 1150, signal }).then(() => {
    if (signal.aborted) return;
    delete $("office-scene").dataset.speaking;
    setOfficePortrait(who, expression ? "expression" : "idle");
    if (!source) return;
    const tag = document.createElement("span");
    tag.className = "ai-tag";
    tag.textContent = source;
    target.appendChild(tag);
  });
}

function stopOfficeScene() {
  clearTimeout(officeLineTimer);
  officeLines = [];
  nextOfficeLine.classList.add("hidden");
}

function advanceOfficeScene() {
  clearTimeout(officeLineTimer);
  if (!officeLines.length) return;
  const [who, line, expression] = officeLines.shift();
  nextOfficeLine.classList.toggle("hidden", officeLines.length === 0);
  const version = bossVersion + 1;
  officeSay(who, line, { expression }).then(() => {
    if (version === bossVersion && officeLines.length) {
      officeLineTimer = setTimeout(advanceOfficeScene, Math.max(1600, line.length * 48));
    }
  });
}

function playOfficeScene(lines) {
  stopOfficeScene();
  officeLines = [...lines];
  advanceOfficeScene();
}

function bossSay(line, source = null) {
  stopOfficeScene();
  return officeSay("boss", line, { source });
}

async function react(kind) {
  const fallback = BOSS_LINES[kind];
  if (Math.random() < .5) return bossSay(fallback);

  stopOfficeScene();
  const version = ++bossVersion;
  let line = fallback;
  let source = null;
  try {
    const res = await fetch("/api/boss-line", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, day: state.day, hp: state.hp, overtime: state.stats.overtime }),
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      if (typeof data?.line === "string" && data.line.trim()) {
        line = data.line.trim().slice(0, 120);
        source = data.source === "luna" ? "luna" : "AI";
      }
    }
  } catch { /* Use the scripted line if generation fails. */ }
  if (version === bossVersion) return bossSay(line, source);
}

function resetIdle() {
  clearTimeout(idle);
  if (!state || hasLanguageAssignment(state)) return;
  if (!officeGuide.open && !coworkerHelp.matches(":popover-open") && !$("challenge-help").open && !state?.leisure?.open && !editor.disabled &&
    !$("coding-panel").classList.contains("internet-open") &&
    (!$("coding-panel").classList.contains("hidden") || !$("work-challenge").classList.contains("hidden"))) {
    idle = setTimeout(() => react("idle"), 45000);
  }
}

function syncOfficeSidebar() {
  const sidebar = $("office-sidebar");
  if (!compactOffice.matches && sidebar.matches(":popover-open")) sidebar.hidePopover();
  sidebar.toggleAttribute("popover", compactOffice.matches);
  $("office-sidebar-toggle").classList.toggle("hidden", !compactOffice.matches);
}

const clockPhase = () => `${state.day}:${state.phase}`;

function hideClockTime() {
  clearTimeout(clockPeekTimer);
  clockPeekPhase = null;
  const readout = $("office-clock-time");
  readout.removeAttribute("datetime");
  readout.textContent = "";
}

function peekAtClock() {
  clearTimeout(clockPeekTimer);
  const clock = PHASES[state.phase][0];
  $("office-clock-time").dateTime = clock;
  $("office-clock-time").textContent = clock;
  clockPeekPhase = clockPhase();
  clockPeekTimer = setTimeout(hideClockTime, 4000);
}

function hud() {
  if (clockPeekPhase && clockPeekPhase !== clockPhase()) hideClockTime();
  $("hud-date").textContent = `${projectDay(state)}일차 · ${formatDate(state.day)}`;
  $("hud-dday").textContent = `D-${projectDay(state, state.deadline) - projectDay(state)}`;
  $("hud-dday").title = hasShortProject(state) ? "남은 근무일 기준" : "남은 날짜 기준";
  $("hud-hp").textContent = state.hp;
  $("bar-hp").style.width = `${state.hp}%`;
  const progress = Math.min(state.progress, missionCount(state));
  const learning = isTutorial(state);
  const leaving = state.phase === "leave" || state.phase === "overtime";
  $("hud-dday").parentElement.classList.toggle("hidden", learning);
  $("hud-hp").parentElement.classList.toggle("hidden", learning && !leaving);
  $("hud-progress").parentElement.classList.toggle("hidden", learning && !progress);
  $("hud-score").parentElement.classList.toggle("hidden", learning && !progress);
  $("hud-scope").parentElement.classList.toggle("hidden", learning && !state.scope);
  $("hud-progress-label").textContent = hasChainedWork(state) ? "완료 업무" : "기능";
  $("hud-progress").textContent = `${progress}/${missionCount(state)}`;
  $("bar-progress").style.width = `${100 * progress / missionCount(state)}%`;
  $("hud-score").textContent = hasChainedWork(state) ? `${state.score}/${PROJECT_GOAL.score}` : state.score;
  $("hud-scope").textContent = `${state.scope}건`;
  $("hud-time-item").classList.toggle("hidden", !isCoding(state.phase));
  $("hud-time").textContent = formatMinutes(state.remaining);
  $("hud-stress-item").classList.toggle("hidden", !hasWorkContent(state) || (learning && state.phase !== "overtime" && state.stress < 75));
  $("hud-stress").textContent = state.stress ?? "";
  $("mines-launch").classList.toggle("hidden", !hasWorkContent(state) || !isCoding(state.phase) || (learning && !progress));
  $("scrum-trust").classList.toggle("hidden", !state.scrum || learning);
  $("relation-panel").classList.toggle("hidden", learning);
  $("office-sidebar-toggle").textContent = learning ? "일정" : "일정·관계";
  if (state.scrum) $("hud-trust").textContent = `${state.stats.reportTrust}/100`;
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
    const step = node.dataset.step;
    let visible = true;
    if (step === "scrum") visible = !!state.scrum;
    if (step === "morning") node.textContent = hasWorkContent(state) ? "10:00  업무 미션" : "10:00  코딩 미션";
    if (step === "negotiate") node.textContent = hasWorkContent(state) ? "13:00  업무·협상" : "13:00  코딩·협상";
    if (step === "assign") {
      node.textContent = state.scrum ? "스크럼 후  업무 배분" : "09:30  업무 배분";
      visible = state.scrum?.assignment ?? needsAssignment(state);
    }
    if (isTutorial(state)) visible = ["arrive", "morning", "leave"].includes(step);
    node.classList.toggle("hidden", !visible);
    if (step === active) node.setAttribute("aria-current", "step");
    else node.removeAttribute("aria-current");
  }
}

function phaseStory() {
  const phase = state.phase;
  const [clock, title] = PHASES[phase];
  const events = phase === "arrive" ? isTutorial(state) ? "첫 출근" : state.event.title : title;
  $("shift-clock").textContent = phase === "assign" && state.scrum ? "스크럼 직후" : clock;
  const mission = currentMission(state);
  const puzzle = !state.solvedToday && mission?.type && mission.type !== "code";
  $("shift-title").textContent = puzzle && isCoding(phase) ? title.replace("코딩", "업무") : events;
  switch (phase) {
    case "arrive": {
      if (!isTutorial(state)) return state.event.text;
      if (hasLanguageAssignment(state) && state.playerName) {
        $("shift-title").textContent = state.language ? `배정 언어 · ${LANGUAGES[state.language].name}` : "신입 기술 스택 조사";
        return state.language ? LANGUAGES[state.language].assignment : "가장 자신 있는 언어를 골라 주세요.";
      }
      return "김 과장이 자리 앞에서 당신을 불러 세웠다.";
    }
    case "scrum": return state.scrum.event?.text ?? "어제 한 일, 오늘 할 일, 막힌 문제만 짧게 공유한다.";
    case "assign": {
      if (!hasWorkContent(state)) return "김 과장이 오늘 업무표를 돌린다. 정 부장이 지켜보고 있고, 박 대리는 이미 볼펜 뚜껑을 열었다.";
      const notice = missionNotice(state);
      $("shift-title").textContent = notice.title;
      return `예상 시간 ${notice.estimate}`;
    }
    case "morning":
    case "afternoon":
    case "overtime": {
      const budget = `남은 업무 시간 ${formatMinutes(state.remaining)}.`;
      if (hasChainedWork(state) && !mission) {
        const offer = nextAssignment(state);
        $("shift-title").textContent = state.workDoneToday ? `오늘 업무 ${state.workDoneToday}건 완료` : "다음 업무";
        if (offer) {
          const missing = codingCost(state, offer) - state.remaining;
          if (missing <= 0) return `${budget} 김 과장이 다음 업무를 가져왔다.`;
          const handoff = phase === "morning" && !isTutorial(state) ? "점심 이후에 이어서 배정한다." : "배정표에 남겨 뒀다.";
          return `${budget} ‘${offer.notice ?? offer.title}’에 ${formatMinutes(missing)}이 부족하다. ${handoff}`;
        }
        return `${budget} 오늘 배정분을 마쳤다.${state.shift < projectDay(state, state.deadline) ? " 새 업무는 내일 들어온다." : ""}`;
      }
      if (!mission) return `${budget} 필수 기능 검수가 끝났다. 남은 추가 일감을 정리하고 퇴근하면 배포할 수 있다.`;
      if (state.solvedToday) return `${budget} 오늘 배정된 업무는 검수를 통과했다.`;
      if (isTutorial(state) && (!hasChainedWork(state) || state.activeWork === OPENING_WORK)) {
        return "아래에 코드를 한 줄 입력하세요. 실행으로 결과를 확인하고 업무 제출을 누르면 됩니다.";
      }
      const needed = codingCost(state);
      if (hasChainedWork(state)) {
        const duration = formatMinutes(needed);
        return `${budget} ${mission.estimate === duration ? `제출에 ${duration} 필요.` :
          `예상 ${mission.estimate} → 실제 ${duration}${state.stress >= 75 ? " (스트레스 +10분 포함)" : ""}.`}`;
      }
      return state.remaining >= needed ? `${budget} 배정 업무와 미션 제출에 ${formatMinutes(needed)}이 필요하다.` : budget;
    }
    case "lunch": return "점심을 같이 먹을 사람을 고를 시간이다.";
    case "negotiate": {
      const team = DEPARTMENTS[state.department];
      $("shift-title").textContent = `${team.name} · ${state.request[0]}`;
      return `현재 관계 ${state.relations[state.department]} · 요청 수락 시 오후 ${formatMinutes(state.request[2])} 소요`;
    }
    case "report":
      if (isFriday(state.day)) {
        $("shift-title").textContent = "금요일 전체 프로젝트 회의";
        return "기획팀은 기능 추가, 디자인팀은 시안 수정, 영업팀은 납품일 단축을 요구한다. QA팀은 검수 시간이 필요하다.";
      }
      return hasChainedWork(state) ? `오늘 ${state.workDoneToday}건 완료 · ${projectStatus()}` :
        `기능 ${state.progress}/${missionCount(state)} · 추가 일감 ${state.scope}건. 김 과장이 현황을 묻는다.`;
    case "leave": {
      if (isTutorial(state)) return "남은 업무는 다음 출근 때 이어서 할 수 있다.";
      return hasChainedWork(state) ? projectStatus() : "김 과장이 벽시계를 한 번 보고 자리에 앉는다.";
    }
  }
}

function firstDayLesson() {
  if (!isTutorial(state)) return null;
  if (state.phase === "leave") return "신입, 남은 건 내일 봐도 돼. 오늘 더 하고 갈 거야?";
  if (state.phase === "overtime" && state.moves.at(-1) === "stay") {
    return "더 한다고? 알았어. 컵라면은 비품 창고에 있어.";
  }
  if (state.phase !== "morning") return null;
  if (state.solvedToday && (state.workDoneToday ?? 1) === 1) {
    if (state.moves.at(-1) === "code-delegate") return "이 대리가 끝냈어. 다음에 비슷한 거 들어오면 같이 봐.";
    return "첫 검수 통과야. 손 좀 풀렸으면 다음 일도 하나 줄게.";
  }
  if (state.hint && state.moves.at(-1) === "tutorialHelp") return "이 대리가 참고할 글 줬지? 예제 한번 보고 와.";
  if (currentMission(state)?.id === MISSIONS[0].id && !state.solvedToday) {
    return "신입, Hello, World! 한 줄 찍어 봐. 나도 첫날엔 이거부터 했어.";
  }
  return null;
}

function currentLesson() {
  if (isTutorial(state)) {
    if (state.phase === "leave") return "health";
    if (state.phase === "overtime") return "stress";
    if (state.phase === "morning") {
      const mission = currentMission(state);
      if (state.solvedToday && (state.workDoneToday ?? 1) === 1) return "score";
      if (mission?.id === MISSIONS[0].id && !state.solvedToday) return "time";
      if (mission?.fundamentals) return "practice";
    }
  } else if (state.shift === 2) {
    return { scrum: "trust", negotiate: "scope", report: "deadline" }[state.phase];
  }
}

function projectStatus() {
  const delivery = state.deliverySubmitted ? "배포 검수 완료" : state.shift < PROJECT_GOAL.deploymentDay ?
    `배포 검수 ${PROJECT_GOAL.deploymentDay}일차부터` :
    state.progress < PROJECT_GOAL.work - 1 ? `업무 ${PROJECT_GOAL.work - 1}건 완료 시 배포 검수` : "배포 검수 대기";
  const backlog = state.scope ? `${state.scope}건 (직접 정리 ${formatMinutes(state.scope * CLEANUP_MINUTES)})` : "0건";
  return `업무 ${Math.min(state.progress, PROJECT_GOAL.work)}/${PROJECT_GOAL.work}건 · 평가 ${state.score}/${PROJECT_GOAL.score} · 추가 일감 ${backlog} · ${delivery}`;
}

function renderScrum() {
  const active = state.phase === "scrum";
  $("scrum-panel").classList.toggle("hidden", !active);
  if (!active) {
    $("scrum-history").open = false;
    return;
  }
  const { yesterday, previousPromise, history } = state.scrum;
  let recap = "오늘이 첫 출근이다.";
  if (yesterday) {
    const outcome = yesterday.workDelegated ? "이 대리가 인수해 완료" : yesterday.completed ? "검수 통과" : "미완료";
    recap = yesterday.mission ? `${yesterday.mission} · ${outcome}` : "필수 기능 검수가 끝난 상태였다.";
    if (hasChainedWork(state)) {
      recap = `업무 ${yesterday.workCount}건 완료 · 검수 ${yesterday.workAttempts}회 · 업무 ${formatMinutes(yesterday.workMinutes)}`;
      if (yesterday.workDelegated) recap += " · 이 대리에게 인계한 건 포함";
    } else if (yesterday.workType) recap += ` · ${WORK_TYPES[yesterday.workType]} ${formatMinutes(yesterday.workMinutes)} (${yesterday.workAttempts}회 시도)`;
  }
  $("scrum-yesterday").textContent = recap;
  const totals = yesterday && !(hasDirectAssignments(state) && state.shift === 2) ? [
    ["코딩", formatMinutes(yesterday.coding)], ["기획 협의", formatMinutes(yesterday.planning)],
    ["자료 조사", formatMinutes(yesterday.research)], ["QA 발견", `${yesterday.bugs}건`],
  ] : [];
  $("scrum-totals").replaceChildren(...totals.map(([label, value]) => {
    const item = document.createElement("div");
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = label;
    dd.textContent = value;
    item.append(dt, dd);
    return item;
  }));
  const prior = history.at(-1);
  const reportLabel = SCRUM_REPORTS.find(({ id }) => id === prior?.kind)?.label ?? "짧게 보고했다";
  $("scrum-previous").textContent = prior ? `어제 보고 · ${reportLabel} · ${formatMinutes(prior.minutes)}` : "";
  const plan = missionNotice(state)?.title ?? "남은 추가 일감과 검수";
  $("scrum-today").textContent = `오늘 할 일 · ${plan}${needsAssignment(state) && !hasChainedWork(state) ? " · 스크럼 뒤 업무 배분" : ""}`;
  const promises = history.flatMap(({ promise }) =>
    promise ? [`${promise.day}일차 · ${promise.mission} 점심 전 배포 · ${promise.result ?? "확인 대기"}`] : []);
  $("scrum-history").classList.toggle("hidden", !promises.length);
  $("scrum-history").open = !!previousPromise;
  replaceList($("scrum-promises"), promises.reverse());
}

function submissionNextAction(choices) {
  if (!isCoding(state.phase) || !currentMission(state) || state.solvedToday || state.remaining >= codingCost(state)) return;
  const prepare = choices.find(({ id, disabled }) => id === "prepare" && !disabled);
  return state.phase !== "overtime" && prepare ? prepare : choices.find(({ id }) => id === "next");
}

function takeOfficeAction(id) {
  const previousPhase = state.phase;
  const previousMeetings = state.stats.meetings;
  if (busy || !act(state, id)) return;
  if (state.ending) {
    endRun();
    return;
  }
  if (id.startsWith("stack-")) preloadCpp();
  renderOffice(true, { reaction: id === "coffee" ? "coffee" : null });
  if (id === "tutorialHelp") intranet.openHome();
  if (id === "stay") companion.emit("overtime");
  if (id === "leave") companion.emit("leave");
  if (state.stats.meetings - previousMeetings >= 40) companion.emit("meetingLong");
  else if (state.phase !== previousPhase && (state.phase === "scrum" || state.phase === "report")) companion.emit("meeting");
  if ((id === "nextWork" || state.phase !== previousPhase) && !state.solvedToday && isCoding(state.phase) && currentMission(state)?.type === "code") {
    companion.emit("coding");
  }
}

function renderChoices() {
  const naming = isTutorial(state) && state.phase === "arrive" && !state.playerName;
  $("name-form").classList.toggle("hidden", !naming);
  $("player-name-submit").textContent = hasLanguageAssignment(state) ? "이름 알려주기" : "첫 업무 시작";
  $("choices").classList.toggle("hidden", naming);
  const choices = options(state);
  const inline = submissionNextAction(choices);
  $("choices").replaceChildren(...choices.filter(({ id }) => id !== inline?.id).map(({ id, label, detail, disabled }) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "act-btn";
    if (id.startsWith("ticket-")) btn.classList.add("ticket-choice");
    if (id === "nextWork") btn.classList.add("next-work-choice");
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

function renderCodingSupport(mission) {
  const fromBank = !!mission.fromBank;
  const reviewed = fromBank && state.reviewedProblem === mission.id;
  $("coworker-help-open").classList.toggle("hidden", !hasProblemBank(state));
  $("coworker-help-open").disabled = busy;
  $("mission-review-code").classList.toggle("hidden", !fromBank || reviewed);
  $("mission-review-code").disabled = busy || !canReviewCode(state);
  $("mission-review-code").textContent = `이 대리에게 검토받기 · ${formatMinutes(CODE_REVIEW_MINUTES)}`;
  $("mission-solution").classList.toggle("hidden", !reviewed);
  $("mission-solution").textContent = reviewed ? mission.solution : "";
  $("mission-delegate").disabled = busy || !canDelegateCode(state);
  const { minutes, score, trust, relation } = CODE_DELEGATION;
  $("mission-delegation-cost").textContent =
    `업무 시간 최대 ${formatMinutes(minutes)} · 인사평가 −${score} · 보고 신뢰도 −${trust} · 이 대리 관계 −${relation}. 프로젝트는 한 단계 진행돼요.`;
}

function renderCoding() {
  const mission = currentMission(state);
  const visible = isCoding(state.phase) && mission && (!mission.type || mission.type === "code") && !state.solvedToday;
  $("coding-panel").classList.toggle("hidden", !visible);
  intranet.sync(!!visible);
  if ((!visible || shownMission !== mission.id) && coworkerHelp.matches(":popover-open")) coworkerHelp.hidePopover();
  if (!visible) {
    clearTimeout(idle);
    return;
  }
  if (shownMission !== mission.id) {
    shownMission = mission.id;
    $("mission-title").textContent = mission.title;
    $("mission-req").textContent = mission.requirement;
    $("mission-expected").textContent = mission.expectedOut;
    const language = state.language ?? "python";
    $("editor-file").textContent = LANGUAGES[language].file;
    $("mission-delegation-options").open = false;
    editor.value = draft?.id === mission.id ? draft.code : mission.starter;
    editor.scrollTop = 0;
    editor.scrollLeft = 0;
    paintEditor(language);
    $("paste-warning").textContent = "";
    output("실행 버튼을 눌러 결과를 확인하세요.");
  }
  renderCodingSupport(mission);
  const cost = codingCost(state);
  $("btn-submit").textContent = `업무 제출 · ${formatMinutes(cost)}`;
  $("btn-submit").disabled = busy || !canSubmit(state);
  $("code-debug-pass").disabled = busy || !canSubmit(state);
  const missing = cost - state.remaining;
  const next = submissionNextAction(options(state));
  const followup = isTutorial(state) && state.phase === "morning"
    ? "퇴근 준비 후 야근을 선택하거나 다음 출근에 이어서 할 수 있어요."
    : next?.id === "prepare"
    ? state.phase === "morning" ? "지금 조사한 만큼 오후에 필요한 시간이 줄어요." : "지금 조사해 두면 야근에서 이어서 할 수 있어요."
    : { morning: "점심을 넘기고 오후 업무 시간에 다시 제출할 수 있어요.", afternoon: "보고를 마친 뒤 야근을 선택하면 오늘 업무를 이어서 할 수 있어요.", overtime: "오늘 업무가 끝나면 다음 출근 때 다시 도전할 수 있어요." }[state.phase];
  $("submit-help").classList.toggle("hidden", !busy && missing <= 0);
  $("submit-status").textContent = busy
    ? `${LANGUAGES[state.language ?? "python"].name} 실행 중이에요. 결과가 나올 때까지 기다려 주세요.`
    : missing > 0 ? `업무 시간이 부족해요. 남은 시간 ${formatMinutes(state.remaining)} · 제출에 ${formatMinutes(cost)} 필요 · ${formatMinutes(missing)} 부족. ${followup}` : "";
  const nextButton = $("submit-next");
  nextButton.classList.toggle("hidden", !next || busy);
  nextButton.textContent = next?.id === "prepare" ? `사전 조사 · ${formatMinutes(Math.min(state.cost, state.remaining))}` : next?.label ?? "";
  nextButton.onclick = next ? () => takeOfficeAction(next.id) : null;
  $("btn-run").disabled = busy;
  editor.disabled = busy;
  resetIdle();
}

function renderWorkChallenge() {
  const mission = currentMission(state);
  const visible = isCoding(state.phase) && mission?.type && mission.type !== "code" && !state.solvedToday;
  $("work-challenge").classList.toggle("hidden", !visible);
  if (!visible) return;
  if (shownChallenge !== mission.id) {
    shownChallenge = mission.id;
    $("challenge-type").textContent = WORK_TYPES[mission.type];
    $("challenge-title").textContent = mission.title;
    $("challenge-brief").textContent = mission.brief;
    $("challenge-hint").textContent = mission.hint;
    $("challenge-feedback").textContent = "";
    readChallenge = buildWorkBoard($("challenge-board"), mission, workDraft, {
      save(value) { workDraft = value; checkpoint(); resetIdle(); },
      mistake: submitChallenge,
    });
  }
  const cost = codingCost(state);
  $("challenge-submit").textContent = `업무 제출 · ${formatMinutes(cost)}`;
  $("challenge-submit").disabled = !canSubmit(state);
  $("challenge-debug-pass").disabled = !canSubmit(state);
  $("challenge-status").textContent = state.remaining < cost ? `남은 시간 ${formatMinutes(state.remaining)} · 제출에 ${formatMinutes(cost)} 필요` : "";
  const next = submissionNextAction(options(state));
  $("challenge-next").classList.toggle("hidden", !next);
  $("challenge-next").textContent = next?.label ?? "";
  $("challenge-next").onclick = next ? () => takeOfficeAction(next.id) : null;
  resetIdle();
}

function submitChallenge(answer) {
  if (answer == null) {
    $("challenge-feedback").textContent = "먼저 업무 화면에서 답을 완성해 주세요.";
    return;
  }
  const result = submitSpecialWork(state, answer);
  if (!result) {
    if (!canSubmit(state)) $("challenge-feedback").textContent = "업무 시간이 부족해요. 다음 근무 시간에 이어서 할 수 있어요.";
    return;
  }
  presence.work();
  if (result.passed) {
    workDraft = null;
    if (state.ending) return endRun();
    renderOffice(true);
    if (!isTutorial(state)) bossSay("검수 통과야. 수고했어, 신입.");
  } else {
    $("challenge-feedback").textContent = `검수 실패 · 업무 시간 ${result.minutes}분 사용. 이 대리의 힌트를 참고해 다시 해 보세요.`;
    hud();
    renderChoices();
    renderWorkChallenge();
    minesWindow.sync();
    checkpoint();
  }
}

function renderOffice(focus = false, { reaction } = {}) {
  bossVersion++;
  hud();
  $("shift-story").textContent = phaseStory();
  replaceList($("shift-effects"), state.effects);
  renderScrum();
  renderChoices();
  renderCoding();
  renderWorkChallenge();
  const activePane = $("coding-panel").classList.contains("hidden")
    ? $("work-challenge").classList.contains("hidden") ? null : "challenge-title"
    : "mission-title";
  $("screen-office").classList.toggle("office-active-work", !!activePane);
  minesWindow.sync();
  companion.teach(currentLesson());
  checkpoint();
  if (focus) {
    let target = $("name-form").classList.contains("hidden") ? activePane ?? "shift-title" : "player-name";
    if (target === "mission-title" && $("mission-panel").inert) target = "internet-view";
    $(target).focus({ preventScroll: true });
  }
  if (reaction) {
    react(reaction);
    return;
  }
  const lesson = firstDayLesson();
  const scene = officeScene(state, isFriday(state.day));
  if (isTutorial(state) && state.phase === "arrive") {
    if (!state.playerName || !hasLanguageAssignment(state)) bossSay("신입, 이름이 뭐야?");
    else if (!state.language) bossSay(`${state.playerName} 씨, 무슨 언어 할 줄 알아?`);
    else bossSay(state.familiarLanguage === "none"
      ? `한국어는 나도 해, 신입. 우리 팀은 ${LANGUAGES[state.language].name} 써. 오늘부터 배워.`
      : `그래? 우리 팀은 ${LANGUAGES[state.language].name} 쓰는데. 처음이면 하면서 배우면 돼. 오늘까지야.`);
  } else if (lesson) {
    bossSay(lesson);
  } else if (scene) {
    playOfficeScene(scene);
  } else if (state.phase === "arrive") {
    bossSay(state.day === 1
      ? "정 부장이 기술 방향을 잡고, 나랑 박 대리, 이 대리가 쇼핑몰을 같이 맡는다. 자네는 오늘부터 사원이야."
      : "출근했구나. 오늘 일정부터 보자.");
  } else if (isCoding(state.phase) && currentMission(state) && !state.solvedToday) {
    const missionLine = currentMission(state).boss;
    bossSay(isTutorial(state) && state.playerName ? `${state.playerName}, ${missionLine.replace(/^신입, /, "")}` : missionLine);
  } else {
    bossSay(({
      scrum: hasDirectAssignments(state) && state.shift === 2
        ? "오늘부터 스크럼이야. 어제 한 일이랑 오늘 할 일, 짧게 말해 봐."
        : "신입, 어제 뭐 했고 오늘 뭐 할 거야? 막힌 게 있으면 같이 말해줘.",
      assign: hasWorkContent(state) ? "신입, 오늘은 이 건 좀 봐줘. 자세한 건 업무 받으면 확인해." : "인원은 그대로고 할 일은 늘었어. 업무표 보고 이야기하자.",
      report: "문제가 있으면 지금 말해줘. 그래야 나도 위에 보고할 수 있어.",
      leave: BOSS_LINES.leave,
    })[state.phase] ?? "오늘 처리할 수 있는 일부터 보자.");
  }
}

function showOfficeGuide() {
  $("guide-stress-label").classList.toggle("hidden", !hasWorkContent(state));
  $("guide-stress-copy").classList.toggle("hidden", !hasWorkContent(state));
  $("guide-deadline-copy").textContent = hasChainedWork(state)
    ? `10근무일 안에 업무 ${PROJECT_GOAL.work}건(배포 검수 포함)과 평가 ${PROJECT_GOAL.score}점을 채우고 추가 일감을 0건으로 만드세요.`
    : hasShortProject(state)
    ? `주말을 빼고 근무일 ${PROJECT_WORKDAYS}일 안에 프로젝트를 끝내세요.`
    : `${TOTAL_DAYS}일 안에 프로젝트를 끝내면 2026년으로 돌아가요.`;
  officeGuide.showModal();
  resetIdle();
}

function enterOffice(resume = false) {
  const saved = resume ? loadLocal(RUN_KEY) : null;
  state = saved?.state ?? newRun();
  draft = saved?.draft ?? null;
  workDraft = saved?.workDraft ?? null;
  internetState = saved?.internetState ?? newInternetState();
  companionState = saved?.companionState ?? newCompanionState();
  presenceSeen = saved?.presenceSeen ?? [];
  presence.reset();
  clockChecks = 0;
  wrongRunComments = 0;
  $("player-name").value = state.playerName ?? "";
  if (saved?.state) {
    state.ruleset ??= FIRST_RULESET;
    // Older saves store the current day's event and its narrative text verbatim.
    const rename = (text) => text.replaceAll("김 책임", "김 과장").replaceAll("책임님, 커피", "과장님, 커피")
      .replaceAll("선임이었다", "대리였다").replaceAll("선임이", "대리가")
      .replaceAll("선임은", "대리는").replaceAll("선임과", "대리와")
      .replaceAll("선임", "대리").replaceAll("수석", "부장");
    state.event.title = rename(state.event.title);
    state.event.text = rename(state.event.text);
    state.effects = state.effects.map(rename);
    for (const ticket of state.tickets) ticket.reveal = rename(ticket.reveal);
  }
  shownMission = null;
  shownChallenge = null;
  show("screen-office");
  stopWorker({ unavailable: true });
  preloadCpp();
  renderOffice(true);
}

function output(text, kind = "") {
  $("output").textContent = text.length > 4000 ? text.slice(0, 4000) + "\n… (출력 잘림)" : text;
  $("output").className = kind;
}

let runner;
let pending;
let jobId = 0;
const RUNNERS = {
  python: ["pyworker.js?v=6", false, 25000, 8000],
  javascript: ["javascript-worker.js", true, 25000, 8000],
  cpp: ["cpp-worker.js?v=2", true, 60000, 12000],
};

function preloadCpp() {
  if (state.language !== "cpp") return;
  try { prepareWorker("cpp", true); }
  catch { /* 실행을 누르면 일반 경로로 다시 시작한다. */ }
}

function stopWorker(result) {
  runner?.worker.terminate();
  runner = null;
  if (pending) completeJob(result);
}

function completeJob(result) {
  const job = pending;
  pending = null;
  clearTimeout(job.timer);
  job.resolve(result);
}

function prepareWorker(language, prewarm = false) {
  if (runner?.language === language) return runner;
  stopWorker({ unavailable: true });
  const [script, module, startupMs, executionMs] = RUNNERS[language];
  const worker = new Worker("src/" + script, module ? { type: "module" } : undefined);
  runner = { worker, language, startupMs, executionMs, ready: false };
  worker.onmessage = ({ data }) => {
    if (runner?.worker !== worker) return;
    if (data.type === "ready" && prewarm && !pending) {
      worker.postMessage({ type: "warmup" });
    } else if (data.type === "ready" || data.type === "warmed") {
      runner.ready = true;
      if (pending) sendJob();
    } else if (data.type === "unavailable") {
      stopWorker({ unavailable: true });
    } else if (pending && data.jobId === pending.id) completeJob(data);
  };
  worker.onerror = () => {
    if (runner?.worker === worker) stopWorker({ unavailable: true });
  };
  return runner;
}

function sendJob() {
  clearTimeout(pending.timer);
  pending.timer = setTimeout(() => stopWorker({ timeout: true }), runner.executionMs);
  runner.worker.postMessage({ code: pending.code, check: pending.check, verify: pending.verify, jobId: pending.id });
}

function runCode(language, code, check, verify) {
  return new Promise((resolve) => {
    const interpreter = prepareWorker(language);
    pending = { id: ++jobId, code, check, verify, resolve, timer: setTimeout(() => stopWorker({ unavailable: true }), interpreter.startupMs) };
    if (interpreter.ready) sendJob();
  });
}

async function handleCode(submit) {
  if (busy || (submit && !canSubmit(state))) return;
  presence.work();
  busy = true;
  minesWindow.sync();
  renderChoices();
  renderCoding();
  $("office-title").disabled = true;
  $("office-guide-open").disabled = true;
  const mission = currentMission(state);
  const language = state.language ?? "python";
  const label = LANGUAGES[language].name;
  output(runner?.ready ? `${label} 실행 중…` : `${label} 실행기를 준비하고 있어요. 첫 실행은 조금 더 걸려요.`);
  const result = await runCode(language, editor.value, mission.check, submit).catch(() => ({ unavailable: true }));
  busy = false;
  const wrongRun = !submit && result.ok && result.passed === false;
  const retryMinutes = submit && !result.unavailable && (!result.ok || !result.passed) ? failCodeSubmission(state) : false;
  $("office-title").disabled = false;
  $("office-guide-open").disabled = false;
  if (result.unavailable) output(`${label} 실행기를 불러오지 못했습니다. 연결을 확인한 뒤 다시 실행하세요.`, "error");
  else if (result.timeout) output("실행 제한 시간에 도달했어요. 반복문의 종료 조건을 확인하세요.", "error");
  else if (!result.ok) output(result.error || "실행 오류가 발생했습니다.", "error");
  else if (mission.fromBank) {
    const lines = [result.stdout.trimEnd(), `공개 테스트 ${result.publicPassed}/${result.publicTotal} 통과`];
    if (submit) lines.push(`숨겨진 테스트 ${result.hiddenPassed}/${result.hiddenTotal} 통과`);
    output(lines.filter(Boolean).join("\n"), result.passed ? "ok" : "error");
  }
  else if (submit && !result.passed) output(`${result.stdout.trimEnd()}\n\n검수 실패. 출력과 변수, 그리고 경계값 조건을 다시 확인하세요.`.trimStart(), "error");
  else output(result.stdout || "(출력 없음)", wrongRun ? "error" : "ok");
  if (retryMinutes) {
    output(`${$("output").textContent}\n재시도 업무 시간 −${retryMinutes}분`, "error");
    hud();
    checkpoint();
  }
  if (submit && result.passed) {
    submitSolution(state);
    draft = null;
    if (state.ending) return endRun();
    const internetComment = commentOnInternetSolution(internetState, mission);
    renderOffice(true, { reaction: state.scope > 0 && state.phase === "morning" ? "success" : null });
    companion.emit(internetComment ? `web-${internetComment}` : "success");
  } else {
    renderChoices();
    renderCoding();
    minesWindow.sync();
    if (!submit && result.passed && isTutorial(state) && mission.id === MISSIONS[0].id) companion.teach("submit");
    if (wrongRun) bossSay(WRONG_RUN_LINES[wrongRunComments++ % WRONG_RUN_LINES.length]);
    else {
      if (result.timeout || (!result.ok && !result.unavailable)) react("error");
      if (!result.unavailable && (result.timeout || !result.ok || result.passed === false)) companion.emit("error");
    }
  }
}

function blockInsertion(event) {
  event.preventDefault();
  const count = recordPaste(state);
  if (!count) return;
  const line = PASTE_LINES[Math.min(count - 1, PASTE_LINES.length - 1)];
  bossSay(line);
  companion.emit("scolded");
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
  const rows = METRICS.filter(([key]) => key in record).map(([key, label, unit]) => [
    label,
    key === "completedDay"
      ? record[key] === null ? "미완료" : `입사 ${record[key]}일차 · ${formatDate(record.completedCalendarDay ?? record[key])}`
      : unit === "분" ? formatMinutes(record[key]) : `${record[key]}${unit}`,
  ]);
  rows.push([record.workResults ? "완료한 업무 미션" : "완료한 코딩 미션",
    record.scoreGoal ? `${record.progress}건 · 목표 ${record.missionTotal}건` : `${record.progress}/${record.missionTotal ?? MISSIONS.length}`]);
  if (record.language) rows.push(["배정 언어", LANGUAGES[record.language].name]);
  if (record.scoreGoal) rows.push(["최종 인사평가", `${record.score} / ${record.scoreGoal}점`],
    ["배포 검수", record.deliverySubmitted ? "완료" : "미완료"], ["남은 추가 일감", `${record.scope}건`]);
  rows.push(...workResultRows(record));
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
  stopWorker({ unavailable: true });
  bossVersion++;
  saveLocal(RUN_KEY, null);
  const record = recordFor(state);
  const debug = state.moves.includes(DEBUG_PASS_MOVE);
  lastRecord = debug ? null : record;
  $("ending-sync").textContent = debug ? "디버그 회차는 기록에 저장되지 않습니다." : "";
  const version = ++syncVersion;
  if (!debug) {
    const best = loadLocal(BEST_KEY);
    if (record.completedDay && (!best || record.completedDay < best.completedDay)) saveLocal(BEST_KEY, record);
    syncRecord(record, { ruleset: state.ruleset, id: state.id, seed: state.seed, moves: state.moves }).then((message) => {
      if (version === syncVersion) $("ending-sync").textContent = message;
    });
  }
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
  stopWorker({ unavailable: true });
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

$("btn-start").onclick = async () => {
  const thought = $("intro-thought-line");
  const startAgent = $("intro-start-agent");
  thought.replaceChildren();
  startAgent.classList.add("hidden");
  show("screen-intro-thought");
  $("intro-thought-time").focus({ preventScroll: true });
  await dialogueLine(thought, "로그인 오류 문구 하나만 고치면 퇴근이다. 컴돌이한테 맡겨 볼까?", {
    voice: "me", letterMs: 42, maxMs: 1250,
  });
  startAgent.classList.remove("hidden");
};
$("intro-start-agent").onclick = () => {
  show("screen-intro");
  $("intro-title").focus({ preventScroll: true });
  playIntro(startTravel);
};
$("btn-gotowork").onclick = () => enterOffice();
$("btn-skip-intro").onclick = () => enterOffice();
$("btn-resume").onclick = () => enterOffice(true);
$("btn-restart").onclick = () => enterOffice();
$("name-form").onsubmit = (event) => {
  event.preventDefault();
  const input = $("player-name");
  const name = input.value.trim();
  if (!name) {
    input.setCustomValidity("이름을 입력해 주세요.");
    input.reportValidity();
    return;
  }
  state.playerName = name;
  if (hasLanguageAssignment(state)) renderOffice(true);
  else takeOfficeAction("arrive");
};
$("player-name").oninput = (event) => event.currentTarget.setCustomValidity("");
nextOfficeLine.onclick = advanceOfficeScene;
$("office-guide-open").onclick = showOfficeGuide;
officeGuide.onclose = () => {
  resetIdle();
  companion.tick();
};
$("office-clock").onclick = () => {
  peekAtClock();
  const naming = isTutorial(state) && state.phase === "arrive";
  bossSay(naming ? "벌써 시계부터 봐? 출근은 했으니까, 신입 이름부터 알려 줘." : CLOCK_REPLIES[clockChecks++ % CLOCK_REPLIES.length]);
  resetIdle();
};
$("office-title").onclick = title;
$("ending-title-link").onclick = title;
$("btn-run").onclick = () => handleCode(false);
$("btn-submit").onclick = () => handleCode(true);
$("challenge-submit").onclick = () => submitChallenge(readChallenge?.());
if (LOCAL_DEBUG) {
  for (const id of ["code-debug-pass", "challenge-debug-pass"]) {
    const button = $(id);
    button.classList.remove("hidden");
    button.onclick = () => {
      if (busy || !passWorkForDebug(state)) return;
      draft = null;
      workDraft = null;
      if (state.ending) endRun();
      else renderOffice(true);
    };
  }
}
$("mission-review-code").onclick = () => {
  if (busy || !requestCodeReview(state)) return;
  hud();
  renderChoices();
  renderCoding();
  checkpoint();
};
$("mission-delegate").onclick = () => {
  if (busy || !delegateCodeWork(state)) return;
  coworkerHelp.hidePopover();
  draft = null;
  renderOffice(true);
};
$("challenge-help-open").onclick = () => {
  $("challenge-help").showModal();
  resetIdle();
};
$("challenge-help").onclose = resetIdle;
coworkerHelp.ontoggle = resetIdle;
compactOffice.addEventListener("change", syncOfficeSidebar);
syncOfficeSidebar();

$("title-records").onclick = () => openRecords(lastRecord, title);
$("ending-records").onclick = () => openRecords(lastRecord, () => showResult(lastRecord));
initRecords(show, (message) => { $("ending-sync").textContent = message; });
initDialogueSound();
title();
