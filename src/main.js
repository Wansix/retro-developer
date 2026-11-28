import { assemblyCode, assemblyPlan } from "./code-assembly.js";
import { mountAssembly } from "./code-assembly-ui.js";
import { isPlayMode, PLAY_MODES, playMode } from "./play-mode.js";
import { CLOCK_REPLIES, MINE_REPLIES, officeCopy } from "./office-copy.js";
import { dialoguePool, dialogueText, editedScript, loadDialogueOverrides } from "./dialogue-overrides.js";
import { BOSS_LINES, MISSIONS, PASTE_LINES, SCENE_2006, TRAVEL_LINES, WRONG_RUN_LINES } from "./missions.js";
import { DEPARTMENTS, ENDINGS, EPILOGUE } from "./office-content.js";
import { CAST_NAMES, editedScene, officeScene } from "./office-scenes.js";
import {
  CLEANUP_MINUTES, CODE_DELEGATION, CODE_REVIEW_MINUTES, DEBUG_PASS_MOVE, PHASES, RELATION_NAMES, act, canDelegateCode, canReviewCode,
  canSubmit, codingCost, currentMission, delegateCodeWork, failCodeSubmission, failPracticeRun, firstDayReportSummary, hasDirectAssignments,
  hasChainedWork, hasLanguageAssignment, hasOfficeClock, hasProblemBank, hasSaturdayShift, hasShortProject, hasWorkContent, isCoding, isFriday, isHalfDay, isTutorial, missionCount,
  markMobileFinish, missionNotice, needsAssignment, newRun, nextAssignment, officeTime, options, passWorkForDebug, projectDay, recordFor, recordPaste, requestCodeReview,
  submitSolution, submitSpecialWork, deferWork, enableRelaxed, taskIsOpen, useBurst, useInternet,
} from "./office.js";
import { WORK_TYPES, workResultRows } from "./work-missions.js";
import { buildWorkBoard } from "./work-ui.js";
import { mountMinesWindow } from "./mines-ui.js";
import { mountIntranet } from "./intranet-ui.js";

import { newCompanionState } from "./comdori-commentary.js";
import { mountOfficeCompanion } from "./comdori-companion.js";
import { FIRST_RULESET, METRICS, RULESET, PROJECT_WORKDAYS, TOTAL_DAYS, formatDate, formatMetric, formatMinutes, internetRecordRows } from "./records-schema.js";
import { SCRUM_REPORTS } from "./scrum.js";
import { initRecords, openRecords, syncRecord } from "./records.js";
import { dialogueLine, initDialogueSound, playDeadlineCue, playFootsteps, typeDialogue } from "./dialogue.js";
import { playIntro } from "./intro.js";
import { OPENING_WORK, PROJECT_GOAL } from "./project-work.js";
import { LANGUAGES } from "./office-languages.js";
import { mountOfficePresence } from "./office-presence.js";
import { mountWorkTimer } from "./work-timer-ui.js";
import { hasSurvival, SURVIVAL } from "./survival.js";
import { mountCodeHighlight } from "./code-highlight.js";

const $ = (id) => document.getElementById(id);
const RUN_KEY = "retro-office-run-v1";
const BEST_KEY = "retro-office-best-v1";
const LOCAL_DEBUG = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
const editor = $("editor");
const paintEditor = mountCodeHighlight(editor, $("editor-highlight"));
const coworkerHelp = $("coworker-help");
const mobileInput = matchMedia("(pointer: coarse) and (hover: none)");
let state;
let draft = null;
let assemblyDraft = null;
let activeAssemblyPlan;
let workDraft = null;
let internetState = { open: false, tabs: {} };
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
  taskTimer.sync();
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
  for (const [index, fallback] of lines.entries()) {
    const line = dialogueText("travel." + index, fallback);
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
  runScript(editedScript("wake", SCENE_2006), "chat-log-2006", "buttons-2006", () => {
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
  if (state && !state.ending) saveLocal(RUN_KEY, { state, draft, assemblyDraft, workDraft, internetState, companionState, presenceSeen });
}

const assembly = mountAssembly(order => {
  assemblyDraft = { id: currentMission(state).id, order };
  checkpoint();
  renderCoding();
});

const inOffice = () => $("screen-office").classList.contains("active");
const taskTimer = mountWorkTimer({
  getState: () => state,
  isActive: inOffice,
  isPaused: () => busy || document.hidden || !!state?.leisure?.open || !!officeLines.length ||
    !!$("office-scene").dataset.speaking || !!document.querySelector("dialog[open]") || coworkerHelp.matches(":popover-open"),
  researching: () => $("desk-internet").contains(document.activeElement),
  save: checkpoint,
  onDefer() {
    taskTimer.flush();
    if (busy || !deferWork(state)) return;
    if (state.ending) endRun();
    else renderOffice(true);
  },
  onBurst() {
    taskTimer.flush();
    if (busy || !useBurst(state)) return;
    renderOffice();
    companion.emit("burst");
    bossSay(officeCopy("burst"));
  },
  onBudgetChange() {
    renderChoices();
    renderCoding();
    renderWorkChallenge();
  },
  onTimeout() {
    hud();
    bossSay(officeCopy("timeout"));
  },
});

const companion = mountOfficeCompanion({
  getState: () => companionState,
  getShift: () => state?.shift ?? 0,
  survival: () => !!state && hasSurvival(state),
  paused: () => officeGuide.open || coworkerHelp.matches(":popover-open") || $("challenge-help").open || !!state?.leisure?.warning,
  onChange: checkpoint,
  onLessonNext() {
    companion.teach("input");
    (playMode(state) === "assembly" ? $("assembly-title") : editor).focus({ preventScroll: true });
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
  getUi: () => internetState,
  getRun: () => state,
  getMission: () => state && currentMission(state),
  onChange() { checkpoint(); resetIdle(); },
  spend(action, id) {
    if (busy) return false;
    taskTimer.flush();
    const result = useInternet(state, action, id);
    if (!result) return false;
    if (state.ending) {
      endRun();
      return false;
    }
    if (result.minutes) {
      hud();
      const loss = $("internet-time-loss");
      loss.textContent = `−${result.minutes}분`;
      loss.getAnimations().forEach(animation => animation.cancel());
      loss.animate([{ opacity: 1, transform: "translateY(0)" }, { opacity: 0, transform: officeReducedMotion.matches ? "none" : "translateY(-.45rem)" }],
        { duration: 950, fill: "both" });
      renderChoices();
      renderCoding();
    }
    return result;
  },
  onComment: event => companion.emit(`web-${event}`),
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
    if (state.ending) return endRun();
    if (closed) {
      renderOffice();
      if (closed === "caught") {
        const index = Math.min(3, state.stats.minesCaught) - 1;
        playOfficeScene(editedScene("mines." + index, MINE_REPLIES[index]));
        companion.emit("scolded");
      }
      if (closed === "expired") bossSay(officeCopy("mineExpired"));
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
  ["lunch", "점심시간"], ["negotiate", "코딩·협상"], ["afternoon", "오후 업무"], ["report", "진행 보고"], ["leave", "퇴근"],
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
  const fallback = dialogueText("boss." + kind, BOSS_LINES[kind]);
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

function updateClockReadout() {
  const clock = officeTime(state);
  $("office-clock-time").dateTime = clock;
  $("office-clock-time").textContent = clock;
}

function peekAtClock() {
  clearTimeout(clockPeekTimer);
  clockPeekPhase = clockPhase();
  updateClockReadout();
  clockPeekTimer = setTimeout(hideClockTime, 4000);
}

function hud() {
  if (clockPeekPhase && clockPeekPhase !== clockPhase()) hideClockTime();
  else if (clockPeekPhase) updateClockReadout();
  const mode = playMode(state);
  $("hud-play-mode").textContent = PLAY_MODES[mode];
  $("lesson-next-label").textContent = mode === "assembly" ? "다음 · 코드 조립" : "다음 · 코드 입력";
  $("hud-date").textContent = state.phase === "sunday" ? formatDate(state.day) : `${projectDay(state)}일차 · ${formatDate(state.day)}`;
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
  $("hud-score").textContent = hasChainedWork(state) && !hasSurvival(state) ? `${state.score}/${PROJECT_GOAL.score}` : state.score;
  $("hud-scope").textContent = `${state.scope}건`;
  $("hud-time-item").classList.toggle("hidden", !isCoding(state.phase));
  $("hud-time").textContent = formatMinutes(state.remaining);
  $("hud-stress-item").classList.toggle("hidden", !hasWorkContent(state) || (learning && state.phase !== "overtime" && state.stress < 75));
  $("hud-stress").textContent = state.stress ?? "";
  $("mines-launch").classList.toggle("hidden", !hasWorkContent(state) || !isCoding(state.phase) || (learning && !progress));
  $("scrum-trust").classList.toggle("hidden", !state.scrum || learning);
  $("relation-panel").classList.toggle("hidden", learning);
  $("office-sidebar-toggle").textContent = learning ? "일정" : "일정·관계";
  $("hud-score-label").textContent = hasSurvival(state) ? "사내 평판" : "인사평가";
  if (state.scrum) $("hud-trust").textContent = `${state.stats.reportTrust}/100`;
  $("relations").replaceChildren(...Object.entries(RELATION_NAMES).flatMap(([id, name]) => {
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = name;
    const value = state.relations[id];
    dd.textContent = value > 0 ? `+${value}` : String(value);
    return [dt, dd];
  }));
  const fullDay = hasOfficeClock(state);
  const halfDay = isHalfDay(state);
  const active = state.phase === "overtime" ? "leave" : !fullDay && state.phase === "afternoon" ? "negotiate" : state.phase;
  for (const node of $("schedule").children) {
    const step = node.dataset.step;
    let visible = true;
    if (step === "scrum") visible = !!state.scrum;
    if (step === "morning") node.textContent = fullDay && !learning ? "스크럼 후  오전 업무" : hasWorkContent(state) ? "10:00  업무 미션" : "10:00  코딩 미션";
    if (step === "negotiate") node.textContent = fullDay ? "13:00  부서 협상" : hasWorkContent(state) ? "13:00  업무·협상" : "13:00  코딩·협상";
    if (step === "afternoon") {
      node.textContent = learning ? "13:00  오후 업무" : "협상 후  오후 업무";
      visible = fullDay;
    }
    if (step === "report") node.textContent = officeTime(state, "report") +
      (fullDay && isFriday(state.day) ? "  프로젝트 회의" : fullDay && learning ? "  일과 마감 보고" : "  진행 보고");
    if (step === "leave") node.textContent = officeTime(state, "leave") + "  퇴근";
    if (step === "assign") {
      node.textContent = state.scrum ? "스크럼 후  업무 배분" : "09:30  업무 배분";
      visible = state.scrum?.assignment ?? needsAssignment(state);
    }
    if (learning) visible = (fullDay ? ["arrive", "morning", "lunch", "afternoon", "report", "leave"] :
      ["arrive", "morning", "leave"]).includes(step);
    if (halfDay && ["lunch", "negotiate", "afternoon", "report"].includes(step)) visible = false;
    if (state.phase === "sunday") visible = false;
    node.classList.toggle("hidden", !visible);
    if (step === active) node.setAttribute("aria-current", "step");
    else node.removeAttribute("aria-current");
  }
}

function phaseStory() {
  const phase = state.phase;
  const [clock, title] = PHASES[phase];
  const events = phase === "arrive" ? isTutorial(state) ? "첫 출근" : state.event.title : title;
  const fullDay = hasOfficeClock(state);
  $("shift-clock").classList.toggle("hidden", fullDay);
  $("shift-clock").textContent = phase === "assign" && state.scrum ? "스크럼 직후" : clock;
  const mission = currentMission(state);
  const puzzle = !state.solvedToday && mission?.type && mission.type !== "code";
  $("shift-title").textContent = puzzle && isCoding(phase) ? title.replace("코딩", "업무") : events;
  switch (phase) {
    case "sunday": return "오늘은 출근하지 않는다. 월요일에 다시 출입증을 찍기 전까지 어떻게 쉴까?";
    case "arrive": {
      if (isHalfDay(state)) {
        $("shift-title").textContent = hasSurvival(state) && state.shift === SURVIVAL.deliveryShift ? "마지막 토요일 · 최종 납품" : "토요일 오전 근무";
        return `오늘은 12시 퇴근이다. ${state.event.text}`;
      }
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
          const handoff = isHalfDay(state) ? (hasSurvival(state) ? "정오에 추가 근무를 결정한다." : "월요일에 이어서 배정한다.") :
            phase === "morning" && (fullDay || !isTutorial(state)) ? "점심 이후에 이어서 배정한다." : "배정표에 남겨 뒀다.";
          return `${budget} ‘${offer.notice ?? offer.title}’에 ${formatMinutes(missing)}이 부족하다. ${handoff}`;
        }
        if (fullDay && phase === "morning") {
          if (isHalfDay(state)) return `${budget} 토요일 배정분을 마쳤다. 정오까지 남은 일정을 정리한다.`;
          return `${budget} 오전 배정분을 마쳤다. ${isTutorial(state) ? "점심을 먹고 오후 업무를 받을 수 있다." : "점심시간까지 남은 일정을 정리한다."}`;
        }
        if (fullDay && phase === "afternoon") {
          return `${budget} 오늘 배정분을 마쳤다.${isTutorial(state) ? "" : " 남은 시간을 넘기고 진행 상황을 보고할 수 있다."}`;
        }
        return `${budget} 오늘 배정분을 마쳤다.${state.shift < projectDay(state, state.deadline) ? " 새 업무는 내일 들어온다." : ""}`;
      }
      if (!mission) return `${budget} 필수 기능 검수가 끝났다. 남은 추가 일감을 정리하고 퇴근하면 배포할 수 있다.`;
      if (state.solvedToday && !hasSurvival(state)) return `${budget} 오늘 배정된 업무는 검수를 통과했다.`;
      if ((!hasSurvival(state) || state.task) && isTutorial(state) && (!hasChainedWork(state) || state.activeWork === OPENING_WORK)) {
        return playMode(state) === "assembly" ? "코드 조각을 눌러 첫인사를 출력하세요. 실행으로 확인한 뒤 업무 제출을 누르면 됩니다." :
          "아래에 코드를 한 줄 입력하세요. 실행으로 결과를 확인하고 업무 제출을 누르면 됩니다.";
      }
      if (hasSurvival(state)) {
        if (state.solvedToday) return `${budget} 업무표에 남겨 두었다. 다음 근무일에 초안부터 이어간다.`;
        if (!state.task) {
          $("shift-title").textContent = mission.notice ?? mission.title;
          return `${budget} 예상 ${missionNotice(state).estimate}. 김 과장 ‘신입, 이거 얼마나 걸려?’`;
        }
        return `${budget} 약속 시간을 넘겨도 제출할 수 있다. 남은 업무 시간을 확인하자.`;
      }
      const needed = codingCost(state);
      if (hasChainedWork(state)) {
        const duration = formatMinutes(needed);
        return `${budget} ${mission.estimate === duration ? `제출에 ${duration} 필요.` :
          `예상 ${mission.estimate} → 실제 ${duration}${state.stress >= 75 ? " (스트레스 +10분 포함)" : ""}.`}`;
      }
      return state.remaining >= needed ? `${budget} 배정 업무와 미션 제출에 ${formatMinutes(needed)}이 필요하다.` : budget;
    }
    case "lunch": return fullDay ? "12시부터 13시까지 점심시간이다. 누구와 먹을지 고른다." : "점심을 같이 먹을 사람을 고를 시간이다.";
    case "negotiate": {
      const team = DEPARTMENTS[state.department];
      $("shift-title").textContent = `${team.name} · ${state.request[0]}`;
      return `현재 관계 ${state.relations[state.department]} · 요청 수락 시 오후 ${formatMinutes(state.request[2])} 소요`;
    }
    case "report":
      if (fullDay && isTutorial(state)) {
        $("shift-title").textContent = "첫날 일과 마감 보고";
        return firstDayReportSummary(state) + ".";
      }
      if (isFriday(state.day)) {
        $("shift-title").textContent = "금요일 전체 프로젝트 회의";
        return "기획팀은 기능 추가, 디자인팀은 시안 수정, 영업팀은 납품일 단축을 요구한다. QA팀은 검수 시간이 필요하다.";
      }
      return hasChainedWork(state) ? `오늘 ${state.workDoneToday}건 완료 · ${projectStatus()}` :
        `기능 ${state.progress}/${missionCount(state)} · 추가 일감 ${state.scope}건. 김 과장이 현황을 묻는다.`;
    case "leave": {
      if (isHalfDay(state)) return hasSurvival(state) ?
        state.deliverySubmitted ? "검수 합격. 고객사에 납품 메일을 보냈다." :
          "11시 55분. 김 과장이 점심 얘기를 꺼냈다. 오전에 돌아갈지, 남아서 일을 끝낼지 고른다." :
        "토요일 오전 근무를 마쳤다. 남은 업무는 월요일에 이어서 한다.";
      if (isTutorial(state)) return "정시 퇴근할지, 남아서 야근할지 고른다.";
      return hasChainedWork(state) ? projectStatus() : "김 과장이 벽시계를 한 번 보고 자리에 앉는다.";
    }
  }
}

function firstDayLesson() {
  if (!isTutorial(state)) return null;
  if (hasOfficeClock(state) && state.phase === "lunch") return officeCopy("firstLunch");
  if (hasOfficeClock(state) && (state.phase === "afternoon" || state.phase === "report") &&
      state.workDoneToday > 0 && !state.activeWork && !nextAssignment(state) && !state.scope) {
    return officeCopy(state.phase === "afternoon" ? "firstAfternoonComplete" : "firstReportComplete");
  }
  if (state.phase === "leave") return officeCopy("firstLeave");
  if (state.phase === "overtime" && state.moves.at(-1) === "stay") {
    return officeCopy("firstOvertime");
  }
  if (state.phase !== "morning") return null;
  if (state.solvedToday && (state.workDoneToday ?? 1) === 1) {
    if (state.moves.at(-1) === "code-delegate") return officeCopy("firstDelegated");
    return officeCopy("firstPassed");
  }
  if (state.hint && state.moves.at(-1) === "tutorialHelp") return officeCopy("firstHint");
  if (currentMission(state)?.id === MISSIONS[0].id && !state.solvedToday) {
    return officeCopy("firstTask");
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
      if (mission?.id === MISSIONS[0].id && !state.solvedToday && taskIsOpen(state)) return "time";
      if (mission?.fundamentals && taskIsOpen(state)) return "practice";
    }
  } else if (state.shift === 2) {
    return { scrum: "trust", negotiate: "scope", report: "deadline" }[state.phase];
  }
}

function projectStatus() {
  if (hasSurvival(state)) return `필수 업무 ${state.progress}/${PROJECT_GOAL.work}건 · 추가 일감 ${state.scope}건 · ${state.deliverySubmitted ? "배포 검수 완료" : "두 번째 토요일 최종 검수"}`;
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
  if (!taskIsOpen(state) || !isCoding(state.phase) || !currentMission(state) || state.solvedToday || state.remaining >= codingCost(state)) return;
  const prepare = choices.find(({ id, disabled }) => id === "prepare" && !disabled);
  return state.phase !== "overtime" && prepare ? prepare : choices.find(({ id }) => id === "next");
}

function takeOfficeAction(id) {
  const previousPhase = state.phase;
  const previousMeetings = state.stats.meetings;
  taskTimer.flush();
  if (busy) return;
  if (mobileInput.matches && (id === "leave" || (id === "next" && state.phase === "overtime"))) markMobileFinish(state);
  if (!act(state, id)) return;
  if (state.ending) {
    endRun();
    return;
  }
  if (id.startsWith("stack-")) preloadCpp();
  renderOffice(true, { reaction: id === "coffee" ? "coffee" : null });
  if (id === "tutorialHelp") intranet.openHome();
  if (id === "stay" || id === "saturday-meal") companion.emit("overtime");
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
    `${hasSurvival(state) ? "지금까지 쓴 시간 + " : "업무 시간 최대 "}${formatMinutes(minutes)} · ${hasSurvival(state) ? "평판" : "인사평가"} −${score} · 보고 신뢰도 −${trust} · 이 대리 관계 −${relation}.`;
}

function renderCoding() {
  const mission = currentMission(state);
  const visible = taskIsOpen(state) && isCoding(state.phase) && mission && (!mission.type || mission.type === "code") && !state.solvedToday;
  $("coding-panel").classList.toggle("hidden", !visible);
  intranet.sync(!!visible);
  if ((!visible || shownMission !== mission.id) && coworkerHelp.matches(":popover-open")) coworkerHelp.hidePopover();
  if (!visible) {
    clearTimeout(idle);
    return;
  }
  const assembling = playMode(state) === "assembly";
  $("code-assembly").classList.toggle("hidden", !assembling);
  editor.parentElement.classList.toggle("hidden", assembling);
  $("editor-file").htmlFor = assembling ? "" : "editor";
  if (shownMission !== mission.id) {
    shownMission = mission.id;
    $("mission-title").textContent = mission.title;
    $("mission-req").textContent = assembling && mission.id === MISSIONS[0].id ?
      "Hello, World!가 출력되도록 코드 조각을 골라 배치하세요." : mission.requirement;
    $("mission-expected").textContent = mission.expectedOut;
    const language = state.language ?? "python";
    $("editor-file").textContent = LANGUAGES[language].file;
    $("mission-delegation-options").open = false;
    if (assembling) {
      activeAssemblyPlan = assemblyPlan(mission, language, state.seed);
      assembly.setup(activeAssemblyPlan, assemblyDraft?.id === mission.id ? assemblyDraft.order : []);
    } else {
      editor.value = draft?.id === mission.id ? draft.code : mission.starter;
      editor.scrollTop = 0;
      editor.scrollLeft = 0;
      paintEditor(language);
    }
    $("paste-warning").textContent = "";
    $("internet-open-status").textContent = "";
    output("실행 버튼을 눌러 결과를 확인하세요.");
  }
  renderCodingSupport(mission);
  const cost = codingCost(state);
  $("btn-submit").textContent = `업무 제출 · ${formatMinutes(cost)}`;
  const needsPieces = assembling && !assembly.order().length;
  $("btn-submit").disabled = busy || needsPieces || !canSubmit(state);
  $("code-debug-pass").disabled = busy || !canSubmit(state);
  const missing = cost - state.remaining;
  const next = submissionNextAction(options(state));
  const followup = next?.id === "next" && isTutorial(state) && state.phase === "afternoon" ? next.detail
    : isHalfDay(state) ? (hasSurvival(state) ? "정오 퇴근 준비에서 추가 근무를 고를 수 있어요." : "정오에 퇴근한 뒤 월요일에 이어서 할 수 있어요.")
    : isTutorial(state) && !hasOfficeClock(state) && state.phase === "morning"
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
  $("btn-run").disabled = busy || needsPieces;
  editor.disabled = busy || assembling;
  assembly.setBusy(busy);
  resetIdle();
}

function renderWorkChallenge() {
  const mission = currentMission(state);
  const visible = taskIsOpen(state) && isCoding(state.phase) && mission?.type && mission.type !== "code" && !state.solvedToday;
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
  const next = submissionNextAction(options(state));
  $("challenge-status").textContent = state.remaining < cost ?
    `남은 시간 ${formatMinutes(state.remaining)} · 제출에 ${formatMinutes(cost)} 필요` +
      (next?.id === "next" && isTutorial(state) && state.phase === "afternoon" ? `. ${next.detail}` : "") : "";
  $("challenge-next").classList.toggle("hidden", !next);
  $("challenge-next").textContent = next?.label ?? "";
  $("challenge-next").onclick = next ? () => takeOfficeAction(next.id) : null;
  resetIdle();
}

function submitChallenge(answer) {
  taskTimer.flush();
  if (answer == null) {
    $("challenge-feedback").textContent = "먼저 업무 화면에서 답을 완성해 주세요.";
    return;
  }
  const result = submitSpecialWork(state, answer);
  if (!result) {
    if (!canSubmit(state)) $("challenge-feedback").textContent = "업무 시간이 부족해요. 다음 근무 시간에 이어서 할 수 있어요.";
    return;
  }
  if (result.passed) workDraft = null;
  if (state.ending) return endRun();
  if (result.passed) {
    renderOffice(true);
    if (!isTutorial(state)) bossSay(officeCopy("puzzlePassed"));
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
  taskTimer.sync();
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
    if (!state.playerName || !hasLanguageAssignment(state)) bossSay(officeCopy("name"));
    else if (!state.language) bossSay(officeCopy("languageAsk", { name: state.playerName }));
    else bossSay(state.familiarLanguage === "none"
      ? officeCopy("languageNone", { language: LANGUAGES[state.language].name })
      : officeCopy("languageOther", { language: LANGUAGES[state.language].name }));
  } else if (lesson) {
    bossSay(lesson);
  } else if (state.phase === "sunday") {
    officeSay("me", officeCopy("sunday"));
    companion.emit("sunday");
  } else if (isHalfDay(state) && state.phase === "leave") {
    bossSay(hasSurvival(state) ? (state.deliverySubmitted ? officeCopy("satDelivered") :
      officeCopy("satLunch")) : officeCopy("satLeaveOld"));
  } else if (hasSurvival(state) && !state.task && !state.solvedToday && isCoding(state.phase) && currentMission(state)) {
    bossSay(officeCopy("estimate"));
  } else if (scene) {
    playOfficeScene(scene);
  } else if (state.phase === "arrive") {
    bossSay(state.day === 1
      ? officeCopy("arrivalFirst")
      : officeCopy("arrival"));
  } else if (isCoding(state.phase) && currentMission(state) && !state.solvedToday) {
    const mission = currentMission(state);
    const missionLine = mission.id.startsWith("code:") ? officeCopy("bankMission", { title: mission.title }) :
      mission.type && mission.type !== "code" ? officeCopy("miniMission", { title: mission.notice }) :
        dialogueText("mission." + mission.id, mission.boss);
    bossSay(isTutorial(state) && state.playerName ? `${state.playerName}, ${missionLine.replace(/^신입, /, "")}` : missionLine);
  } else {
    bossSay(({
      scrum: hasDirectAssignments(state) && state.shift === 2
        ? officeCopy("scrumFirst")
        : officeCopy("scrum"),
      assign: hasWorkContent(state) ? officeCopy("assign") : officeCopy("assignOld"),
      report: officeCopy("report"),
      leave: dialogueText("boss.leave", BOSS_LINES.leave),
    })[state.phase] ?? officeCopy("officeFallback"));
  }
}

function showOfficeGuide() {
  $("guide-stress-label").classList.toggle("hidden", !hasWorkContent(state));
  $("guide-stress-copy").classList.toggle("hidden", !hasWorkContent(state));
  const survival = hasSurvival(state);
  $("burst-setting").classList.toggle("hidden", !survival);
  $("guide-score-label").textContent = survival ? "사내 평판" : "인사평가";
  $("guide-score-copy").textContent = survival ? "평판이 높으면 배정 순서와 동료 협조에 유리해요. 에이스에게는 급한 일도 몰려요." : "업무 성과와 선택에 따라 바뀌고, 엔딩에도 영향을 줘요.";
  $("guide-stress-copy").textContent = survival ? "60 이상이면 제출 +5분, 75 이상 +10분, 90 이상 +20분이에요. 휴식도 업무 시간을 써요." :
    "75 이상이면 제출에 10분이 더 걸려요. 지뢰찾기는 업무 시간을 써서 스트레스를 낮춰요.";
  $("guide-deadline-copy").textContent = survival ?
    `3월 6~19일, ${SURVIVAL.calendarDays}일 동안 ${SURVIVAL.workdays}일 근무합니다. 3월 18일 토요일에 업무 ${PROJECT_GOAL.work}건과 추가 일감을 정리하고 최종 배포 검수를 통과하세요. D-2부터 체력을 써서 한 번 초집중할 수 있어요.` : hasChainedWork(state)
    ? `10근무일 안에 업무 ${PROJECT_GOAL.work}건(배포 검수 포함)과 평가 ${PROJECT_GOAL.score}점을 채우고 추가 일감을 0건으로 만드세요.${hasSaturdayShift(state) ? " 토요일 오전도 근무일에 포함돼요." : ""}`
    : hasShortProject(state)
    ? `주말을 빼고 근무일 ${PROJECT_WORKDAYS}일 안에 프로젝트를 끝내세요.`
    : `${TOTAL_DAYS}일 안에 프로젝트를 끝내면 2026년으로 돌아가요.`;
  taskTimer.flush();
  officeGuide.showModal();
  resetIdle();
}

function enterOffice(resume = false, fallbackRun, transferred) {
  const saved = transferred ?? (resume ? loadLocal(RUN_KEY) : null);
  state = saved?.state ?? fallbackRun ?? newRun();
  draft = saved?.draft ?? null;
  assemblyDraft = saved?.assemblyDraft ?? null;
  activeAssemblyPlan = null;
  workDraft = saved?.workDraft ?? null;
  internetState = saved?.internetState ?? { open: false, tabs: {} };
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
  taskTimer.flush();
  if (busy || !taskIsOpen(state) || (submit && !canSubmit(state))) return;
  presence.work();
  busy = true;
  taskTimer.sync();
  minesWindow.sync();
  renderChoices();
  renderCoding();
  $("office-title").disabled = true;
  $("office-guide-open").disabled = true;
  const mission = currentMission(state);
  const language = state.language ?? "python";
  const label = LANGUAGES[language].name;
  output(runner?.ready ? `${label} 실행 중…` : `${label} 실행기를 준비하고 있어요. 첫 실행은 조금 더 걸려요.`);
  const code = playMode(state) === "assembly" ? assemblyCode(activeAssemblyPlan, assembly.order()) : editor.value;
  const result = await runCode(language, code, mission.check, submit).catch(() => ({ unavailable: true }));
  busy = false;
  taskTimer.sync();
  const wrongRun = !submit && result.ok && result.passed === false;
  const failed = !result.unavailable && (!result.ok || result.passed === false);
  const retryMinutes = failed ? (submit ? failCodeSubmission(state) : failPracticeRun(state)) : false;
  $("office-title").disabled = false;
  $("office-guide-open").disabled = false;
  if (state.ending) return endRun();
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
    assemblyDraft = null;
    if (state.ending) return endRun();
    const internetComment = state.web?.jobs[mission.id]?.assisted;
    renderOffice(true, { reaction: state.scope > 0 && state.phase === "morning" ? "success" : null });
    companion.emit(internetComment ? "web-solved" : "success");
  } else {
    renderChoices();
    renderCoding();
    minesWindow.sync();
    if (!submit && result.passed && isTutorial(state) && mission.id === MISSIONS[0].id) companion.teach("submit");
    if (wrongRun) {
      const lines = dialoguePool("boss.wrongRun", WRONG_RUN_LINES);
      bossSay(lines[wrongRunComments++ % lines.length]);
    }
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
  const index = Math.min(count - 1, PASTE_LINES.length - 1);
  const line = dialogueText("paste." + index, PASTE_LINES[index]);
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
  if (state.burst?.remaining && $("burst-effects").checked) playDeadlineCue("typing");
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

function bestKeyFor(mode) {
  return mode === "assembly" ? BEST_KEY + ":assembly" : BEST_KEY;
}

function bestLabel(record) {
  return record.timeMode ? `최단 납품 ${formatMetric(record.deliveryMinute, "시각")}` : `최단 완료 ${record.completedDay}일차`;
}

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
      : formatMetric(record[key], unit),
  ]);
  rows.push([record.workResults ? "완료한 업무 미션" : "완료한 코딩 미션",
    record.scoreGoal ? `${record.progress}건 · 목표 ${record.missionTotal}건` : `${record.progress}/${record.missionTotal ?? MISSIONS.length}`]);
  if (record.language) rows.push(["배정 언어", LANGUAGES[record.language].name]);
  if (record.scoreGoal) rows.push(["최종 인사평가", `${record.score} / ${record.scoreGoal}점`],
    ["배포 검수", record.deliverySubmitted ? "완료" : "미완료"], ["남은 추가 일감", `${record.scope}건`]);
  if ("projectDelivered" in record) rows.push(["배포 검수", record.deliverySubmitted ? "완료" : "미완료"], ["남은 추가 일감", `${record.scope}건`]);
  rows.push(...internetRecordRows(record), ...workResultRows(record));
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
  const best = loadLocal(bestKeyFor(record.mode));
  $("ending-best").textContent = best ? `이 브라우저 · ${PLAY_MODES[record.mode]} ${bestLabel(best)}` : "";
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
    const bestKey = bestKeyFor(record.mode);
    const best = loadLocal(bestKey);
    if (record.timeMode !== "완화" && record.completedDay &&
        (!best || (record.timeMode ? best.deliveryMinute == null || record.deliveryMinute < best.deliveryMinute :
          !best.timeMode && record.completedDay < best.completedDay))) saveLocal(bestKey, record);
    syncRecord(record, { ruleset: state.ruleset, id: state.id, seed: state.seed, moves: state.moves, mode: state.mode }).then((message) => {
      if (version === syncVersion) $("ending-sync").textContent = message;
    });
  }
  if (!ENDINGS[record.ending].cleared) return showResult(record);

  $("chat-log-twist").replaceChildren();
  $("buttons-twist").replaceChildren();
  show("screen-twist");
  runScript(editedScript("epilogue", EPILOGUE), "chat-log-twist", "buttons-twist", () => {
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
  taskTimer.flush();
  clearTimeout(idle);
  stopWorker({ unavailable: true });
  bossVersion++;
  show("screen-title");
  const saved = loadLocal(RUN_KEY);
  $("btn-resume").classList.toggle("hidden", !saved);
  try {
    $("btn-skip-intro").classList.toggle("hidden", !localStorage.getItem("retro-intro-seen"));
  } catch { /* A restricted browser can still play the intro. */ }
  const bests = Object.entries(PLAY_MODES).flatMap(([mode, label]) => {
    const best = loadLocal(bestKeyFor(mode));
    return best ? [`${label} ${bestLabel(best)}`] : [];
  });
  const legacy = loadLocal("retro-best");
  $("title-best").textContent = bests.length ? bests.join(" · ") :
    legacy ? `이전 10일판 최고 기록 · ${legacy.score}점 · ${legacy.ending}` : "";
}

$("btn-start").onclick = async () => {
  const thought = $("intro-thought-line");
  const startAgent = $("intro-start-agent");
  thought.replaceChildren();
  startAgent.classList.add("hidden");
  show("screen-intro-thought");
  $("intro-thought-time").focus({ preventScroll: true });
  await dialogueLine(thought, officeCopy("openingThought"), {
    voice: "me", letterMs: 42, maxMs: 1250,
  });
  startAgent.classList.remove("hidden");
};
$("intro-start-agent").onclick = () => {
  show("screen-intro");
  $("intro-title").focus({ preventScroll: true });
  playIntro(startTravel);
};
let modeSpeech;

function showModePicker() {
  $("mode-form").reset();
  $("mode-confirm").disabled = true;
  for (const field of $("mode-form").elements) if (field.type === "radio") field.disabled = false;
  show("screen-mode");
  $("mode-title").focus({ preventScroll: true });
  $("mode-dialogue").replaceChildren();
  modeSpeech?.abort();
  modeSpeech = new AbortController();
  dialogueLine($("mode-dialogue"), officeCopy("modeAsk"), { voice: "ai", signal: modeSpeech.signal });
}

$("mode-form").onchange = () => { $("mode-confirm").disabled = false; };
$("mode-form").onsubmit = async event => {
  event.preventDefault();
  if ($("mode-confirm").disabled) return;
  const mode = new FormData(event.currentTarget).get("mode");
  if (!isPlayMode(mode)) return;
  $("mode-confirm").disabled = true;
  for (const field of event.currentTarget.elements) if (field.type === "radio") field.disabled = true;
  const run = newRun(undefined, undefined, RULESET, mode);
  if ($("relaxed-timer").checked) enableRelaxed(run);
  saveLocal(RUN_KEY, { state: run });
  modeSpeech?.abort();
  $("mode-dialogue").replaceChildren();
  await dialogueLine($("mode-dialogue"), officeCopy(mode === "assembly" ? "modeAssembly" : "modeReal"), { voice: "ai" });
  if (Math.random() < .3) {
    await pause(350);
    $("mode-dialogue").replaceChildren();
    await dialogueLine($("mode-dialogue"), officeCopy("modeCommon"), { voice: "ai" });
  }
  await pause(500);
  enterOffice(true, run);
};
$("btn-gotowork").onclick = showModePicker;
$("btn-skip-intro").onclick = showModePicker;
$("btn-resume").onclick = () => enterOffice(true);
$("btn-restart").onclick = showModePicker;
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
function clockLine() {
  const lines = dialoguePool("boss.clock", CLOCK_REPLIES);
  return lines[clockChecks++ % lines.length];
}

$("office-clock").onclick = () => {
  peekAtClock();
  if (state.phase === "sunday") return;
  const naming = isTutorial(state) && state.phase === "arrive";
  bossSay(naming ? officeCopy("clockFirst") : clockLine());
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
      taskTimer.flush();
      if (busy || !passWorkForDebug(state)) return;
      draft = null;
      assemblyDraft = null;
      workDraft = null;
      if (state.ending) endRun();
      else renderOffice(true);
    };
  }
}
$("mission-review-code").onclick = () => {
  taskTimer.flush();
  if (busy || !requestCodeReview(state)) return;
  if (state.ending) return endRun();
  hud();
  renderChoices();
  renderCoding();
  checkpoint();
};
$("mission-delegate").onclick = () => {
  taskTimer.flush();
  if (busy || !delegateCodeWork(state)) return;
  if (state.ending) return endRun();
  coworkerHelp.hidePopover();
  draft = null;
  assemblyDraft = null;
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
initRecords(show, (message) => { $("ending-sync").textContent = message; }, {
  get: () => loadLocal(RUN_KEY),
  resume: saved => enterOffice(true, undefined, saved),
});
initDialogueSound();
await loadDialogueOverrides();
title();
