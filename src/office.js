import { ARCHITECTURE, AUTOMATION, CODE_REVIEW, DEPARTMENTS, ENDINGS, EXTRA_TICKETS, LUNCH, OFFICE_EVENTS, TICKETS } from "./office-content.js";
import { MISSIONS } from "./missions.js";
import { CHAINED_WORK_RULESET, DIRECT_ASSIGNMENT_RULESET, FUNDAMENTALS_RULESET, LANGUAGE_ASSIGNMENT_RULESET, OFFICE_CLOCK_RULESET, PROBLEM_BANK_RULESET, PROJECT_WORKDAYS, RULESET, SATURDAY_SHIFT_RULESET, SCRUM_RULESET, SHORT_PROJECT_RULESET, TOTAL_DAYS, WORK_CONTENT_RULESET, calendarDayForWorkday, formatMinutes, workdayForCalendarDay } from "./records-schema.js";
import { SCRUM_REPORTS, beginScrumDay, finishScrumDay, finishScrumRun, handleScrum, initScrum, markMorningDelivery } from "./scrum.js";
import { makeWork, gradeWork, problemBankWorkOrder, shortWorkOrder, workOrder, WORK_TYPES } from "./work-missions.js";
import { applyLeisure, award, canOpenLeisure, initLeisure } from "./mines.js";
import { DEPLOYMENT_WORK, OPENING_WORK, PROJECT_GOAL, nextProjectWork, projectReady, projectWorkDeck } from "./project-work.js";
import { beginTask, daysUntilDelivery, hasSurvival, lowHealthStress, SHIFT_STORIES, SURVIVAL, taskCost, taskOverdue, timePromises } from "./survival.js";
import { INTERNET_ALERTS, internetItem, internetQuote } from "./intranet-feed.js";
import { assignedLanguage, LANGUAGES } from "./office-languages.js";

export const PHASES = {
  arrive: ["09:00", "출근"],
  sunday: ["10:00", "일요일 휴식"],
  scrum: ["09:30", "데일리 스크럼"],
  assign: ["09:30", "업무 배분"],
  morning: ["10:00", "오전 코딩"],
  lunch: ["12:00", "점심시간"],
  negotiate: ["13:00", "부서 협상"],
  afternoon: ["13:00", "오후 코딩"],
  report: ["17:30", "진행 보고"],
  leave: ["18:00", "퇴근"],
  overtime: ["18:00", "야근"],
};
export const RELATION_NAMES = { park: "박 대리", lee: "이 대리", ...Object.fromEntries(Object.entries(DEPARTMENTS).map(([id, d]) => [id, d.name])) };

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const range = (length) => Array.from({ length }, (_, i) => i);

function shuffle(values, random) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export const isFriday = (day) => day % 7 === 5;
export const isCoding = (phase) => ["morning", "afternoon", "overtime"].includes(phase);
export const hasWorkContent = (s) => s.ruleset >= WORK_CONTENT_RULESET;
export const hasShortProject = (s) => s.ruleset >= SHORT_PROJECT_RULESET;
export const hasProblemBank = (s) => s.ruleset >= PROBLEM_BANK_RULESET;
export const hasChainedWork = (s) => s.ruleset >= CHAINED_WORK_RULESET;
export const hasLanguageAssignment = (s) => s.ruleset >= LANGUAGE_ASSIGNMENT_RULESET;
export const hasOfficeClock = (s) => s.ruleset >= OFFICE_CLOCK_RULESET;
export const hasSaturdayShift = (s) => s.ruleset >= SATURDAY_SHIFT_RULESET;
export const isHalfDay = (s) => hasSaturdayShift(s) && s.day % 7 === 6;
const daysPerWeek = s => hasSaturdayShift(s) ? 6 : 5;
const projectCalendarDay = (s, workday) => calendarDayForWorkday(workday, daysPerWeek(s));
const LUNCH_START = 12 * 60;
const LUNCH_END = 13 * 60;
const WORK_END = 18 * 60;
const OVERTIME_MINUTES = 185;
const reportStart = s => WORK_END - (isFriday(s.day) ? 95 : 45);

function officeMinutes(s, phase = s.phase) {
  const times = {
    arrive: 9 * 60, scrum: Math.max(9 * 60 + 30, LUNCH_START - s.remaining),
    assign: LUNCH_START - s.remaining, morning: LUNCH_START - s.remaining,
    lunch: LUNCH_START, negotiate: LUNCH_END, afternoon: reportStart(s) - s.remaining,
    report: reportStart(s), leave: isHalfDay(s) ? LUNCH_START : WORK_END, overtime: shiftEnd(s) + (s.overtimeBudget ?? OVERTIME_MINUTES) - s.remaining,
    sunday: 10 * 60,
  };
  return times[phase];
}

export function officeTime(s, phase = s.phase) {
  if (!hasOfficeClock(s)) return PHASES[phase][0];
  const minutes = officeMinutes(s, phase);
  return String(Math.floor(minutes / 60)).padStart(2, "0") + ":" + String(minutes % 60).padStart(2, "0");
}
export const projectDay = (s, day = s.day) => hasShortProject(s) ? workdayForCalendarDay(day, daysPerWeek(s)) : day;
const projectLimit = s => hasSurvival(s) ? SURVIVAL.deadline : hasShortProject(s) ? projectCalendarDay(s, PROJECT_WORKDAYS) : TOTAL_DAYS;
export const currentMission = (s) => hasWorkContent(s)
  ? makeWork(hasChainedWork(s) ? s.activeWork : s.workOrder[s.progress], s.seed, s.language)
  : MISSIONS[s.progress];
export const missionCount = (s) => hasChainedWork(s) ? PROJECT_GOAL.work : hasWorkContent(s) ? s.workOrder.length : MISSIONS.length;
export const nextAssignment = (s) => hasChainedWork(s) && !s.activeWork ? makeWork(nextProjectWork(s), s.seed, s.language) : null;
export const missionNotice = (s) => {
  const work = currentMission(s) ?? nextAssignment(s);
  if (!work) return null;
  const estimate = hasSurvival(s) ? formatMinutes(timePromises(s, work)[1].minutes) : work.estimate;
  return { title: work.notice ?? work.title, estimate };
};
export const hasDirectAssignments = (s) => s.ruleset >= DIRECT_ASSIGNMENT_RULESET;
export const isTutorial = (s) => hasDirectAssignments(s) && s.shift === 1;
export const canPlayMines = (s) => isCoding(s.phase) && canOpenLeisure(s);
export const RETRY_MINUTES = 5;
export const CODE_REVIEW_MINUTES = 15;
export const CODE_DELEGATION = { minutes: 30, score: 12, trust: 8, relation: 1 };
export const CLEANUP_MINUTES = 90;
export const DEBUG_PASS_MOVE = "debug-pass";

function draw(s) {
  // A serializable RNG keeps reloads and server-side replay on the same sequence.
  s.rng = (Math.imul(s.rng, 1664525) + 1013904223) >>> 0;
  return s.rng / 2 ** 32;
}

export function newRun(seed = crypto.getRandomValues(new Uint32Array(1))[0], id = crypto.randomUUID(), ruleset = RULESET) {
  const run = {
    id, seed, ruleset, rng: seed, moves: [], day: 1, shift: 0, hp: 100, score: 0, scope: 0, progress: 0,
    phase: "arrive", ending: null, completedDay: null, nextMeeting: 0, effects: [],
    relations: Object.fromEntries(Object.keys(RELATION_NAMES).map((key) => [key, 0])),
    stats: { coding: 0, meetings: 0, overtime: 0, onTime: 0, planning: 0, design: 0, paste: 0, calledSimple: 0, actuallySimple: 0 },
    achievements: [],
    requestCount: {},
  };
  run.deadline = projectLimit(run);
  if (ruleset >= SCRUM_RULESET) initScrum(run);
  if (hasWorkContent(run)) {
    run.workOrder = hasChainedWork(run) ? projectWorkDeck(seed, ruleset >= FUNDAMENTALS_RULESET, hasOfficeClock(run), hasSurvival(run)) : hasProblemBank(run) ? problemBankWorkOrder(seed) :
      hasShortProject(run) ? shortWorkOrder() : workOrder(seed);
    run.stress = 18;
    run.stats.workMinutes = 0;
    run.stats.workResults = Object.fromEntries(Object.keys(WORK_TYPES).map(type => [type, { attempts: 0, success: 0 }]));
    initLeisure(run);
  }
  if (hasChainedWork(run)) {
    run.activeWork = OPENING_WORK;
    run.finishedWork = [];
    run.deliverySubmitted = false;
  }
  if (hasProblemBank(run)) {
    run.stats.codeReviews = 0;
    run.stats.codeDelegations = 0;
  }
  if (hasSurvival(run)) {
    run.memory = { helpedLee: 0, planningAccepted: 0, scopeRemoved: 0, unchecked: 0, expertise: {}, guidanceUsed: false };
    run.burst = { used: false, remaining: 0, effort: 0 };
    run.task = null;
    Object.assign(run.stats, { actualCodingSeconds: 0, timeouts: 0, fastJobs: 0, negotiations: 0, saturdayLeaves: 0, overtimeMinutes: 0, burstSaved: 0 });
  }
  const random = () => draw(run);
  run.eventDeck = shuffle(range(OFFICE_EVENTS.length), random);
  run.departmentOrder = shuffle(Object.keys(DEPARTMENTS), random);
  run.requestOrder = Object.fromEntries(Object.entries(DEPARTMENTS).map(([id, d]) => [id, shuffle(range(d.requests.length), random)]));
  startDay(run);
  return run;
}

function startDay(s) {
  s.phase = "arrive";
  s.shift += 1;
  s.saturdayPressure = false;
  s.overtimeBudget = null;
  s.remaining = hasSurvival(s) ? 150 : hasChainedWork(s) ? 140 : 180;
  s.solvedToday = false;
  if (hasChainedWork(s)) s.workDoneToday = 0;
  s.waits = 0;
  s.coffee = false;
  s.hint = false;
  s.assigned = [];
  s.cost = 0;
  s.tickets = TICKETS.map((original, index) => {
    const ticket = s.shift > 1 && draw(s) < 0.45 ? EXTRA_TICKETS[index] : original;
    return { ...ticket, index, minutes: ticket.minutes + 5 * Math.floor(draw(s) * 5) - 10 };
  });
  s.parkPriority = [...s.tickets].sort((a, b) => a.minutes - b.minutes).map((t) => t.index);
  if (draw(s) < 0.2) [s.parkPriority[0], s.parkPriority[1]] = [s.parkPriority[1], s.parkPriority[0]];
  s.available = range(TICKETS.length);
  s.event = ({ 3: ARCHITECTURE, 6: CODE_REVIEW, 9: AUTOMATION })[s.shift] ?? OFFICE_EVENTS[s.eventDeck.pop()];
  if (hasSurvival(s)) {
    const story = SHIFT_STORIES[s.shift];
    if (story) s.event = { ...story, effect: { ...s.event.effect, ...story.effect } };
    s.saturdayPressure = isHalfDay(s) && (s.shift === 6 || s.scope > 0 || s.progress < PROJECT_GOAL.work - 1);
    if (s.shift === SURVIVAL.deliveryShift) {
      s.event.effect = { meeting: 0 };
      s.remaining = 150;
    }
  }
  s.department = s.departmentOrder[(s.shift - 1) % s.departmentOrder.length];
  if (hasSurvival(s)) s.department = ({ 4: "planning", 10: "qa", 11: "sales" })[s.shift] ?? s.department;
  const count = s.requestCount[s.department] ?? 0;
  const order = s.requestOrder[s.department];
  s.request = DEPARTMENTS[s.department].requests[order[count % order.length]];
  if (s.relations[s.department] < 4) s.requestCount[s.department] = count + 1;
  s.effects = [];
  if (s.scrum) beginScrumDay(s, missionNotice(s)?.title ?? null);
}

const shiftEnd = s => isHalfDay(s) ? LUNCH_START : WORK_END;
const changeTrust = (s, points) => { s.stats.reportTrust = clamp(s.stats.reportTrust + points, 0, 100); };

export function burstRecoveryCost(s) {
  if (!s.burst?.remaining) return 0;
  return Math.ceil((s.burst.effort + s.burst.remaining) * SURVIVAL.burst.hpPerHour * 2 / 60);
}

function settleBurst(s) {
  if (!s.burst?.remaining && !s.burst?.effort) return;
  const hp = Math.ceil(s.burst.effort * SURVIVAL.burst.hpPerHour * 2 / 60);
  s.burst.remaining = 0;
  s.burst.effort = 0;
  s.hp = Math.max(0, s.hp - hp);
  s.effects.push(`컴돌이 · 인간은 왜 항상 마지막 순간에 최선을 다하는 것입니까? 초집중 종료 · 체력 −${hp}.`);
  if (s.hp <= 1 && s.deliverySubmitted) award(s, "프로젝트는 살렸습니다");
  if (s.hp === 1 && s.deliverySubmitted) award(s, "체력 1의 기적");
  if (!s.hp) finish(s, projectDelivered(s) ? "burstHospital" : "hospital");
}

function projectDelivered(s) {
  return s.deliverySubmitted && s.progress >= PROJECT_GOAL.work && s.scope === 0;
}

function accountTime(s, spent, overhead = false) {
  if (!hasSurvival(s) || spent <= 0) return;
  if (overhead && s.task) s.task.overhead += spent;
  if (s.phase === "overtime") {
    const previous = Math.ceil(s.stats.overtimeMinutes * SURVIVAL.overtime.hpPerHour / 60);
    s.stats.overtimeMinutes += spent;
    const total = Math.ceil(s.stats.overtimeMinutes * SURVIVAL.overtime.hpPerHour / 60);
    s.hp = Math.max(0, s.hp - (total - previous));
  }
  if (s.burst.remaining) {
    const focused = Math.min(spent, s.burst.remaining);
    s.burst.remaining -= focused;
    s.burst.effort += focused;
  }
}

function spendTime(s, minutes, overhead = false) {
  const spent = Math.min(minutes, s.remaining);
  s.remaining -= spent;
  accountTime(s, spent, overhead);
  return spent;
}

function settleCosts(s) {
  if (s.ending) return;
  if (hasSurvival(s) && !s.burst.remaining && s.burst.effort) settleBurst(s);
  if (!s.ending && s.hp === 0) finish(s, "hospital");
}

export function recordTaskTime(s, seconds, researching = false) {
  if (!hasSurvival(s) || !s.task || !mayWork(s) ||
      !Number.isInteger(seconds) || seconds < 1 || s.task.elapsed + seconds > SURVIVAL.timer.sessionCapSeconds) return false;
  const wasOverdue = taskOverdue(s.task);
  s.task.elapsed += seconds;
  if (!wasOverdue && taskOverdue(s.task) && !s.task.missed) {
    s.task.missed = true;
    s.stats.timeouts++;
    changeTrust(s, -5);
    change(s, { stress: 8 });
    s.memory.unchecked++;
  }
  if (!researching && currentMission(s).type === "code") s.stats.actualCodingSeconds += seconds;
  const previous = s.moves.at(-1);
  if (Array.isArray(previous) && previous[0] === (researching ? "research-elapsed" : "elapsed")) previous[1] += seconds;
  else s.moves.push([researching ? "research-elapsed" : "elapsed", seconds]);
  return true;
}

export function searchAtWork(s) {
  if (!hasSurvival(s) || !s.task || !mayWork(s) || s.remaining < SURVIVAL.searchMinutes) return false;
  spendTime(s, SURVIVAL.searchMinutes, true);
  s.scrum.today.research += SURVIVAL.searchMinutes;
  s.moves.push("work-search");
  settleCosts(s);
  return true;
}

export function useInternet(s, action, id) {
  const mission = currentMission(s);
  if (!taskIsOpen(s) || !mayWork(s) || (mission.type && mission.type !== "code")) return false;
  const entry = s.web?.jobs[mission.id];
  const item = action === "open" ? null : internetItem(mission, s.seed, id);
  if (action !== "open" && (!entry?.opened || !item ||
      ((action === "play" || action === "watched") ? item.type !== "lecture" : action !== "read" || item.type === "lecture"))) return false;
  const minutes = internetQuote(s, mission, action, item);
  if (minutes === null || minutes > s.remaining) return false;
  if (action === "watched" && entry.watched || action !== "watched" && !minutes) return { minutes: 0 };

  s.web ??= { jobs: {}, assistanceTypes: [], sources: {} };
  const job = s.web.jobs[mission.id] ??= { opened: false, read: {}, watched: false };
  if (action === "open") {
    job.opened = true;
    s.stats.webSearches = (s.stats.webSearches ?? 0) + 1;
    if (s.stats.webSearches >= 5) award(s, "구글링 마스터");
  } else if (action === "watched") {
    job.watched = true;
    award(s, "영어는 못 알아들었지만 코드는 알아들었다");
  } else {
    job.read[item.id] = { type: item.type, useful: item.useful };
    const sourceId = item.type === "lecture" ? item.lesson.title : item.id;
    s.web.sources ??= {};
    const source = s.web.sources[sourceId] ??= { title: item.sourceTitle ?? item.title, count: 0 };
    source.count++;
    const key = { blog: "webBlogs", board: "webBoards", manual: "webManuals", lecture: "webLectures" }[item.type];
    s.stats[key] = (s.stats[key] ?? 0) + 1;
    if (item.type === "manual") award(s, "공식 문서 읽는 개발자");
    if (id === "self-fixed") award(s, "자체 해결 싫어요");
  }
  const before = s.stats.webMinutes ?? 0;
  if (minutes) {
    spendTime(s, minutes, true);
    s.stats.webMinutes = before + minutes;
    if (s.scrum) s.scrum.today.research += minutes;
  }
  s.moves.push(id === undefined ? ["web", action] : ["web", action, id]);
  settleCosts(s);
  return {
    minutes,
    warning: INTERNET_ALERTS.find(([threshold]) => before < threshold && before + minutes >= threshold),
  };
}

function creditInternetHelp(s, mission) {
  const job = s.web?.jobs[mission.id];
  if (!job) return;
  const helpful = Object.values(job.read).filter(({ useful }) => useful);
  if (!helpful.length) return;
  job.assisted = true;
  s.stats.webAssisted = (s.stats.webAssisted ?? 0) + 1;
  if (helpful.some(({ type }) => type === "blog")) award(s, "이름 모를 은인");
  if (job.watched) award(s, "Thank you, my friend");
  s.web.assistanceTypes = [...new Set([...s.web.assistanceTypes, ...helpful.map(({ type }) => type)])];
  if (s.stats.webAssisted >= 3 && s.web.assistanceTypes.length >= 3) award(s, "인간 지식의 집합체");
}

function pendingTaskMinutes(s) {
  const { elapsed, settled, overhead } = s.task;
  return Math.max(0, Math.ceil((elapsed - settled) / SURVIVAL.timer.secondsPerMinute) - overhead);
}

function handoffTask(s, deferred = false) {
  if (!hasSurvival(s) || !s.task) return;
  const { elapsed } = s.task;
  const minutes = pendingTaskMinutes(s);
  if (currentMission(s)?.type === "code") chargeCoding(s, minutes);
  else spendTime(s, minutes);
  if (deferred || elapsed) changeTrust(s, -4);
  s.task = null;
}

function change(s, effect) {
  s.hp = clamp(s.hp + (effect.hp ?? 0), 0, 100);
  s.score += effect.score ?? 0;
  s.scope = Math.max(0, s.scope + (effect.scope ?? 0));
  if (effect.deadline && hasShortProject(s) && !hasSurvival(s)) {
    const firstPossible = Math.max(projectDay(s), hasChainedWork(s) ? 9 : missionCount(s));
    const adjusted = clamp(projectDay(s, s.deadline) + effect.deadline, firstPossible, PROJECT_WORKDAYS);
    s.deadline = projectCalendarDay(s, adjusted);
  } else if (!hasShortProject(s)) {
    s.deadline = clamp(s.deadline + (effect.deadline ?? 0), s.day, TOTAL_DAYS);
  }
  if (hasSurvival(s)) {
    s.remaining += Math.max(0, effect.minutes ?? 0);
    spendTime(s, Math.max(0, -(effect.minutes ?? 0)) + (effect.meeting ?? 0));
  } else s.remaining = Math.max(0, s.remaining + (effect.minutes ?? 0) - (effect.meeting ?? 0));
  s.stats.meetings += effect.meeting ?? 0;
  if (hasWorkContent(s)) {
    const delta = (effect.stress ?? 0) + Math.floor((effect.meeting ?? 0) / 20);
    s.stress = clamp(s.stress + (hasSurvival(s) ? lowHealthStress(s, delta) : delta), 0, 100);
  }
  if (effect.achievement) award(s, effect.achievement);
  for (const key of Object.keys(s.relations)) {
    s.relations[key] = clamp(s.relations[key] + (effect[key] ?? 0), -5, 8);
  }
}

function chooseTickets(s, ids, effect, text) {
  s.assigned = ids.map((id) => s.tickets[id]);
  s.cost = s.assigned.reduce((sum, ticket) => sum + ticket.minutes, 0);
  s.stats.calledSimple += s.assigned.filter((t) => t.simple).length;
  s.stats.actuallySimple += s.assigned.filter((t) => t.minutes <= 65).length;
  change(s, effect);
  s.effects = [text, ...s.assigned.map((t) => `${t.name} (${formatMinutes(t.minutes)}) — ${t.reveal}`)];
  s.phase = "morning";
}

function advanceFromCoding(s) {
  s.phase = isHalfDay(s) || (isTutorial(s) && !hasOfficeClock(s)) ? "leave" : s.phase === "morning" ? "lunch" : "report";
  if (hasSurvival(s) && s.burst.remaining) accountTime(s, s.phase === "lunch" ? s.remaining + 60 : s.remaining);
}

export function codingCost(s, mission = currentMission(s)) {
  const progression = hasDirectAssignments(s) ? 15 * Math.floor(s.progress / 3) : 0;
  if (hasSurvival(s) && mission) return taskCost(s, mission);
  if (hasWorkContent(s)) return (mission?.minutes ?? (45 + (hasChainedWork(s) ? 0 : progression))) + (s.stress >= 75 ? 10 : 0);
  return 45 + s.cost + progression;
}

function mayWork(s) {
  return !s.ending && !s.leisure?.open && isCoding(s.phase) && !!currentMission(s) && !s.solvedToday;
}

export function canSubmit(s) {
  return mayWork(s) && (!hasSurvival(s) || !!s.task) && s.remaining >= codingCost(s);
}

function chargeCoding(s, minutes) {
  const spent = spendTime(s, minutes);
  s.stats.coding += spent;
}

export function submitSolution(s) {
  const mission = currentMission(s);
  if (!canSubmit(s) || (mission.type && mission.type !== "code")) return false;
  return completeWork(s, mission, "solve");
}

export function passWorkForDebug(s) {
  return canSubmit(s) && completeWork(s, currentMission(s), DEBUG_PASS_MOVE);
}

export function canReviewCode(s) {
  const mission = currentMission(s);
  return hasProblemBank(s) && mayWork(s) && (!hasSurvival(s) || !!s.task) && mission.fromBank &&
    s.reviewedProblem !== mission.id && s.remaining >= CODE_REVIEW_MINUTES;
}

export function requestCodeReview(s) {
  if (!canReviewCode(s)) return false;
  spendTime(s, CODE_REVIEW_MINUTES);
  s.scrum.today.research += CODE_REVIEW_MINUTES;
  s.reviewedProblem = currentMission(s).id;
  s.stats.codeReviews++;
  s.moves.push("code-review");
  settleCosts(s);
  return true;
}

export function canDelegateCode(s) {
  return hasProblemBank(s) && mayWork(s) && currentMission(s).type === "code" &&
    (!hasSurvival(s) || (s.activeWork !== DEPLOYMENT_WORK && !!s.task && s.remaining >= CODE_DELEGATION.minutes + pendingTaskMinutes(s)));
}

export function delegateCodeWork(s) {
  if (!canDelegateCode(s)) return false;
  const cost = CODE_DELEGATION;
  if (hasSurvival(s)) handoffTask(s);
  spendTime(s, cost.minutes);
  s.stats.reportTrust = Math.max(0, s.stats.reportTrust - cost.trust);
  change(s, { score: -cost.score, lee: -cost.relation });
  s.stats.codeDelegations++;
  s.scrum.today.workType = "code";
  s.scrum.today.workDelegated = true;
  s.moves.push("code-delegate");
  advanceWork(s);
  s.effects = [`이 대리가 업무를 마무리했다. 진행 +1 · ${hasSurvival(s) ? "사내 평판" : "인사평가"} −12 · 보고 신뢰도 −8 · 이 대리 관계 −1.`];
  if (hasSurvival(s)) {
    s.memory.unchecked++;
    settleCosts(s);
  }
  return true;
}

function workAttempt(s, mission, passed, minutes) {
  if (!hasWorkContent(s)) return;
  const stats = s.stats.workResults[mission.type];
  stats.attempts++;
  if (passed) stats.success++;
  s.stats.workMinutes += minutes;
  s.scrum.today.workAttempts++;
  s.scrum.today.workMinutes += minutes;
  s.scrum.today.workType = mission.type;
}

function completeWork(s, mission, move) {
  s.moves.push(move);
  const minutes = codingCost(s);
  const normalMinutes = hasSurvival(s) && s.burst.remaining ? codingCost({ ...s, burst: null }, mission) : minutes;
  if (!mission.type || mission.type === "code") chargeCoding(s, minutes);
  else spendTime(s, minutes);
  const timed = hasSurvival(s);
  const task = s.task;
  const focused = minutes < normalMinutes;
  const speedy = timed && task && !task.missed && task.elapsed <= (task.limit + task.burstBonus) / 2;
  const overdue = timed && task && taskOverdue(task);
  if (timed) {
    if (speedy) s.stats.fastJobs++;
    if (focused && s.stats.burstSaved + normalMinutes - minutes >= 30) award(s, "한계를 돌파한 개발자");
    if (!task?.missed) changeTrust(s, 1);
    if (focused) s.stats.burstSaved += normalMinutes - minutes;
    const specialty = mission.type === "code" ? mission.tags?.[0] ?? "코딩" : WORK_TYPES[mission.type];
    s.memory.expertise[specialty] = (s.memory.expertise[specialty] ?? 0) + 1;
    s.task = null;
  }
  workAttempt(s, mission, true, minutes);
  if (move !== DEBUG_PASS_MOVE) creditInternetHelp(s, mission);
  advanceWork(s);
  const reward = mission.reward ?? { score: 14, hp: -3, stress: -4 };
  change(s, timed ? { ...reward, score: reward.score + (speedy ? 6 : 0), stress: (reward.stress ?? 0) + (overdue ? 5 : 0) } : reward);
  s.effects = [move === DEBUG_PASS_MOVE ? "디버그로 검수 성공을 처리했다." :
    mission.explanation ?? (mission.fromBank ? "공개·숨겨진 테스트를 모두 통과했다." : "기능 검수를 통과했다.")];
  if (hasChainedWork(s)) s.effects[0] += ` 업무 +1건 · ${timed ? "평판" : "평가"} +${reward.score + (speedy ? 6 : 0)} · 시간 −${formatMinutes(minutes)}`;
  if ((!timed || (s.score >= SURVIVAL.reputation.ace && s.shift <= 10 && !s.aceAssigned)) && !isTutorial(s) && s.phase === "morning" && (s.ruleset < FUNDAMENTALS_RULESET || s.shift > 3) &&
      s.remaining >= (hasChainedWork(s) ? 75 : 35) &&
      (!hasChainedWork(s) || s.workDoneToday === 1)) {
    change(s, { scope: 1 });
    if (timed) s.aceAssigned = true;
    s.stats.calledSimple++;
    s.effects.push("김 과장이 ‘벌써 끝났어? 이것도 간단해’라며 일감 1건을 추가했다.");
  }
  if (timed && s.deliverySubmitted) settleBurst(s);
  settleCosts(s);
  return true;
}

function advanceWork(s) {
  s.cost = 0;
  s.solvedToday = true;
  s.progress++;
  if (hasChainedWork(s)) {
    if (s.activeWork === DEPLOYMENT_WORK) {
      s.deliverySubmitted = true;
      if (hasSurvival(s)) s.deliveryMinute = officeMinutes(s);
    }
    s.finishedWork.push(s.activeWork);
    s.activeWork = null;
    s.workDoneToday++;
  }
  if (s.scrum && s.phase === "morning") markMorningDelivery(s);
}

function workFailure(s, mission, move, baseMinutes = RETRY_MINUTES, stress = 6) {
  const task = s.task;
  const elapsed = task ? pendingTaskMinutes(s) : 0;
  const regular = Math.max(baseMinutes, elapsed);
  const focused = s.burst?.remaining ? Math.min(s.burst.remaining, Math.ceil(regular / SURVIVAL.burst.speed)) : 0;
  const minutes = Math.min(s.remaining, focused + Math.max(0, regular - focused * SURVIVAL.burst.speed));
  if (focused) s.stats.burstSaved += Math.max(0, regular - minutes);
  if (task) {
    task.settled = task.elapsed;
    task.overhead = 0;
  }
  if (mission.type === "code") chargeCoding(s, minutes);
  else spendTime(s, minutes);
  workAttempt(s, mission, false, minutes);
  change(s, { stress, hp: task && s.stress >= 75 ? -2 : 0 });
  s.moves.push(move);
  settleCosts(s);
  return minutes;
}

export function failCodeSubmission(s) {
  const mission = currentMission(s);
  if (!hasWorkContent(s) || mission?.type !== "code" || !canSubmit(s)) return false;
  return workFailure(s, mission, "code-retry");
}

export function failPracticeRun(s) {
  const mission = currentMission(s);
  if (!hasSurvival(s) || !s.task || !mayWork(s) || mission.type !== "code" || !s.remaining) return false;
  return workFailure(s, mission, "run-retry", SURVIVAL.timer.practiceRetry, 3);
}

export function submitSpecialWork(s, answer) {
  const mission = currentMission(s);
  if (!hasWorkContent(s) || !mayWork(s) || mission.type === "code" || (hasSurvival(s) && !s.task)) return null;
  const cardCheck = mission.type === "memory" && Array.isArray(answer) && answer.length === 2;
  if (cardCheck ? s.remaining <= 0 : s.remaining < codingCost(s)) return null;
  const passed = gradeWork(mission, answer);
  if (passed === null) return null;
  const move = ["work", Array.isArray(answer) ? [...answer] : answer];
  if (passed) return { passed, minutes: codingCost(s), completed: completeWork(s, mission, move) };
  return { passed, minutes: workFailure(s, mission, move) };
}

export function playMinesAction(s, action, value) {
  const previous = s.remaining;
  const result = applyLeisure(s, action, value, canPlayMines(s));
  if (!result) return false;
  if (action === "tick") {
    const previous = s.moves.at(-1);
    if (Array.isArray(previous) && previous[0] === "mine" && previous[1] === "tick" && previous[2] + result <= 120) {
      previous[2] += result;
    } else {
      s.moves.push(["mine", "tick", result]);
    }
  } else {
    s.moves.push(value === undefined ? ["mine", action] : ["mine", action, value]);
  }
  accountTime(s, previous - s.remaining);
  settleCosts(s);
  return result;
}

export function recordPaste(s, attempts = 1) {
  const mission = currentMission(s);
  if (s.ending || !taskIsOpen(s) || s.leisure?.open || !isCoding(s.phase) || !mission || (mission.type && mission.type !== "code") || s.solvedToday) return 0;
  const previous = s.stats.paste;
  const added = Math.min(1000000 - previous, attempts);
  if (added) {
    const last = s.moves.at(-1);
    if (typeof last === "number") s.moves[s.moves.length - 1] += added;
    else s.moves.push(added);
    s.stats.paste += added;
  }
  if (previous < 3 && s.stats.paste >= 3) change(s, { achievement: "몸은 2006년, 정신은 2026년" });
  return s.stats.paste;
}

function finish(s, id) {
  if (s.scrum) finishScrumRun(s, id === "deadline" && s.day === projectLimit(s));
  if (!ENDINGS[id].cleared && s.stats.minesWins > 0) award(s, "지뢰 제거 전문가");
  s.ending = id;
  s.completedDay = ENDINGS[id].cleared ? s.day : null;
}

function finishShift(s) {
  if (hasSurvival(s)) {
    settleBurst(s);
    if (s.ending) return;
  }
  if (s.hp === 0) return finish(s, "hospital");
  if (hasChainedWork(s) ? projectReady(s) : !currentMission(s) && s.scope === 0) {
    if (hasSurvival(s)) {
      if (s.burst.used && s.stats.burstSaved >= 15) return finish(s, "comeback");
      if (s.stats.minesSeconds >= 90 && s.stats.minesCaught < 2) return finish(s, "leisure");
      if (s.stats.negotiations >= 5 && s.memory.scopeRemoved >= 3 && s.stats.reportTrust >= 70) return finish(s, "politics");
      if (s.memory.helpedLee >= 2 || Object.values(s.relations).filter(n => n >= 4).length >= 3) return finish(s, "teamwork");
      if (s.stats.onTime >= 10 && s.hp >= 65) return finish(s, "balance");
      if (s.score >= SURVIVAL.reputation.ace) return finish(s, "promotion");
      return finish(s, "release");
    }
    if (s.stats.onTime >= 7 && s.stats.overtime <= 2 && s.hp >= 65) return finish(s, "balance");
    if (s.score >= 220 && s.stats.overtime >= 4) return finish(s, "promotion");
    if (Object.values(s.relations).filter((n) => n >= 4).length >= 4) return finish(s, "teamwork");
    return finish(s, "release");
  }
  const next = hasSaturdayShift(s) ? projectCalendarDay(s, projectDay(s) + 1) : isFriday(s.day) ? s.day + 3 : s.day + 1;
  if (next > s.deadline) return finish(s, "deadline");
  if (s.scrum) finishScrumDay(s);
  if (hasSurvival(s) && s.day === 6) {
    s.day++;
    s.phase = "sunday";
    s.effects = [];
    return;
  }
  s.day = next;
  startDay(s);
}

function choice(id, label, detail = "", disabled = false) {
  return { id, label, detail, disabled };
}

export function needsAssignment(s) {
  if (hasChainedWork(s)) return !isTutorial(s) && !s.activeWork && !!nextAssignment(s);
  if (hasWorkContent(s)) return !isTutorial(s) && !!currentMission(s);
  if (hasDirectAssignments(s)) return false;
  return !s.scrum || s.scope >= 3 || s.scrum.event?.id === "director" ||
    (!!currentMission(s) && (s.shift === 1 || s.day % 7 === 1 || isFriday(s.day)));
}

function receiveProjectWork(s) {
  s.activeWork = nextProjectWork(s);
  s.solvedToday = false;
  s.scrum.today.mission ??= missionNotice(s)?.title;
}

function handleAssignment(s, id) {
  if (id.startsWith("ticket-")) return chooseTickets(s, [Number(id.slice(7))], {}, "예상 시간만 적힌 업무표에 이름을 적었다.");
  if (id === "volunteer") return chooseTickets(s, [s.available.at(-1)], { score: 20 }, "정 부장이 신입의 이름을 수첩에 적었다. 평가 +20.");
  if (id === "refuse") {
    const backed = s.relations.lee >= 2 || s.relations.park >= 2;
    return chooseTickets(s, [], { score: backed ? -1 : -6 }, backed ? "대리가 이미 맡은 일을 증언했다." : "김 과장이 기존 업무부터 끝내라고 했다. 평가 −6.");
  }
  if (id === "trade") {
    const ticket = s.parkPriority.find((index) => s.available.includes(index)) ?? s.available[0];
    return chooseTickets(s, [ticket], { park: -1, lee: 1, minutes: 35 }, "박 대리가 유리한 업무를 양보했다. 지난번에 도와준 얘기를 꺼냈다.");
  }
  s.waits++;
  change(s, { meeting: 20 });
  const taken = s.parkPriority.find((i) => s.available.includes(i)) ?? s.available[0];
  s.available = s.available.filter((i) => i !== taken);
  s.effects = [`박 대리가 ${s.tickets[taken].name}에 먼저 이름을 적었다.`];
  if (s.waits === 2) return chooseTickets(s, s.available.slice(-2), { score: -3 }, "회의가 끝나기 직전, 김 과장이 남은 어려운 두 건을 함께 넘겼다.");
}

function handleNegotiation(s, id) {
  const key = s.department;
  const team = DEPARTMENTS[key];
  const [name, , time, scope] = s.request;
  const survival = hasSurvival(s);
  const previousScope = s.scope;
  const trusted = survival && s.stats.reportTrust >= SURVIVAL.meetingTrust.high;
  if (survival) s.remaining = reportStart(s) - LUNCH_END;
  let disruption;
  if (id === "accept") {
    disruption = time;
    if (survival) spendTime(s, time);
    if (hasSurvival(s) && key === "planning") s.memory.planningAccepted++;
    change(s, { scope, stress: hasSurvival(s) ? 6 : 0, score: 6, [key]: 2, deadline: key === "sales" ? -1 : 0 });
    s.stats.calledSimple++;
    if (name === "2픽셀의 차이") {
      s.stats.design += time;
      change(s, { achievement: "2픽셀을 위한 2시간" });
    }
    s.effects = [`요청을 받았다. 오후 시간 −${formatMinutes(time)} · 추가 일감 +${scope}건${key === "sales" ? " · 마감 −1일" : ""}.`];
  } else if (id === "ally") {
    change(s, { scope: -1, score: 4, meeting: 15, [key]: 1, deadline: key === "sales" ? 1 : 0 });
    disruption = 15;
    if (hasSurvival(s)) s.stats.negotiations++;
    s.effects = [team.ally, "이미 올라온 일감도 한 건 정리했다."];
  } else {
    const agreed = s.relations[key] >= 1 || id === "document" || trusted;
    const minutes = trusted ? 20 : id === "document" ? 35 : 45;
    if (hasSurvival(s) && agreed) s.stats.negotiations++;
    if (hasSurvival(s) && !agreed) change(s, { stress: 7 });
    change(s, { meeting: minutes, [key]: id === "document" ? 2 : -1, score: agreed ? 2 : -6 });
    disruption = minutes;
    if (key === "planning" || key === "design") s.stats[key] += minutes;
    s.effects = [agreed ? "담당자가 합의한 범위 안으로 요청을 정리했다." : "요청을 보류했다. 다음 회의 때 책임 소재를 따지겠다는 답장이 왔다."];
  }
  if (survival && s.scope < previousScope) s.memory.scopeRemoved += previousScope - s.scope;
  if (survival && s.shift === 11 && key === "sales" && (id === "ally" || (id === "push" && trusted))) {
    s.memory.clientExtension = true;
    s.effects.push("영업팀이 고객사와 합의했다. 토요일 추가 근무 때 납품 창구가 한 시간 더 열린다.");
  }
  if (s.scrum && key === "planning") s.scrum.today.planning += disruption;
  if (s.scrum && key === "qa") s.scrum.today.bugs += scope;
  if (!survival) s.remaining = (hasOfficeClock(s) ? reportStart(s) - LUNCH_END : hasChainedWork(s) ? 205 : 270) - disruption;
  s.phase = "afternoon";
}

function handleBoss(s, id) {
  const support = Object.keys(DEPARTMENTS).filter((key) => s.relations[key] >= 4).length;
  const outcomes = {
    yes: [{ scope: Math.max(1, 5 - support), hp: -12, score: 16, sales: 1, design: 1, deadline: -1 }, "그날 회의록에는 ‘개발 가능’ 두 글자만 남았다. 납품일도 당겨졌다."],
    no: [{ scope: -1, hp: -4, score: support ? -3 : -12, sales: -2, qa: 1 }, "QA가 검수 시간을 확인해 줬다. 영업팀은 회의 끝나고 다시 보자고 했다."],
    trim: [{ scope: support ? -3 : 1, hp: -5, score: 5, planning: 1, qa: 1 }, support ? "평소 맞춰 일한 부서가 축소안에 서명했다." : "출시 범위를 좁혔다. 끝까지 남은 추가 요청은 한 건이다."],
    joke: [{ scope: 2, hp: -9, score: -16, sales: -3, lee: 1 }, "이 대리만 웃었다. 영업팀이 의자를 돌려 앉았다."],
  };
  const [effect, message] = outcomes[id];
  const previousScope = s.scope;
  if (hasSurvival(s) && id === "trim" && s.stats.reportTrust >= SURVIVAL.meetingTrust.high) effect.scope = -2;
  if (hasSurvival(s) && (id === "no" || id === "trim") && effect.scope < 0) s.stats.negotiations++;
  change(s, { ...effect, meeting: 95 });
  if (hasSurvival(s) && s.scope < previousScope) s.memory.scopeRemoved += previousScope - s.scope;
  s.stats.planning += 20;
  s.stats.design += 20;
  if (id === "yes") s.stats.calledSimple += 3;
  s.effects = [message];
  s.phase = "leave";
}

function internetHelpChoice(s) {
  const cost = internetQuote(s, currentMission(s), "open");
  return choice("tutorialHelp", "이 대리가 골라 준 자료 보기", cost ? `미래넷 최초 열기 ${cost}분` : "무료", s.remaining < cost);
}

export function options(s) {
  if (s.ending || s.leisure?.open) return [];
  switch (s.phase) {
    case "sunday":
      return [
        choice("sunday-rest", "호출기를 끄고 늦잠 잔다", "체력 +40 · 스트레스 −30"),
        choice("sunday-lee", "이 대리에게 안부를 묻는다", "체력 +40 · 스트레스 −25 · 이 대리 관계 +2"),
      ];
    case "arrive":
      if (isTutorial(s) && hasLanguageAssignment(s) && !s.language) {
        return [...Object.entries(LANGUAGES).map(([id, { name }]) => choice("stack-" + id, name + " 할 줄 알아요")),
          choice("stack-none", "한국어요.")];
      }
      if (isTutorial(s)) return [choice("arrive", "첫 업무 시작")];
      if (s.shift === 9 && !hasSurvival(s)) return [
        choice("automate", "검수표를 자동화한다", hasOfficeClock(s) ? "오전 준비 시간 절약 · 추가 일감 +1건" : "오전 업무 시간 +1시간 30분"),
        choice("arrive", "오늘은 수동으로 검수한다"),
      ];
      return [choice("arrive", s.scrum ? "데일리 스크럼 참석" : "업무표 확인")];
    case "scrum":
      if (hasChainedWork(s) && (s.shift === 2 || !s.scrum.event)) {
        return [choice("scrumQuick", needsAssignment(s) ? "짧게 보고하고 업무 받기" :
          s.activeWork ? "짧게 보고하고 업무 이어서 하기" : "짧게 보고하고 자리로 가기", "스크럼 15분")];
      }
      if (hasDirectAssignments(s) && s.shift === 2) {
        return [choice("scrumQuick", hasWorkContent(s) ? "스크럼 마치기" : "오늘 업무 받기", "스크럼 15분")];
      }
      if (!s.scrum.event) return [choice("scrumQuick", "짧게 보고하고 회의를 마친다", "15분")];
      return SCRUM_REPORTS.map(({ id, label, detail }) => choice(id, label, detail, id === "scrumPromise" && !missionNotice(s)));
    case "assign":
      if (hasSurvival(s) && s.shift === 3 && (s.score >= SURVIVAL.reputation.priority || s.relations.park >= 2)) return [
        choice("receiveWork", "업무 받기"),
        choice("priority", "박 대리와 순서를 바꾼다", "박 대리 관계 −1 · 업무 시간 확보"),
      ];
      if (hasWorkContent(s)) return [choice("receiveWork", "업무 받기")];
      return [
        ...s.available.map((i) => choice(`ticket-${i}`, s.tickets[i].name, `예상 ${s.tickets[i].estimate}`)),
        choice("wait", "동료가 고를 때까지 기다린다", s.waits ? "회의가 곧 끝난다 · 20분" : "선택을 본다 · 20분"),
        choice("volunteer", "가장 어려워 보이는 일에 자원한다", "인사평가 +20"),
        choice("refuse", "기존 프로젝트를 이유로 거절한다", "인사평가 하락 · 대리가 증언하면 완화"),
        choice("trade", "박 대리와 업무를 교환한다", "박 대리 관계 +2 이상 필요", s.relations.park < 2),
      ];
    case "morning":
    case "afternoon":
    case "overtime": {
      if (hasSurvival(s)) return survivalWorkOptions(s);
      if (hasChainedWork(s)) {
        const offered = nextAssignment(s);
        return [
          ...(offered && s.remaining >= codingCost(s, offered)
            ? [choice("nextWork", "다음 업무 받기", `${offered.notice ?? offered.title} · 예상 ${offered.estimate}`)] : []),
          ...(s.activeWork === OPENING_WORK && !s.hint ? [internetHelpChoice(s)] : []),
          ...(s.scope && s.phase !== "morning" ? [choice("cleanup", "추가 일감 1건 정리",
            `시간 ${formatMinutes(CLEANUP_MINUTES)} · 인사평가 +4`, s.remaining < CLEANUP_MINUTES)] : []),
          ...(!isTutorial(s) && !s.coffee ? [choice("coffee", "커피 한 잔", "시간 25분 · 체력 +8 · 스트레스 −5", s.remaining < 25)] : []),
          choice("next", s.phase === "overtime" ? "야근을 마치고 퇴근" : isHalfDay(s) ? "정오 퇴근 준비" : isTutorial(s) && !hasOfficeClock(s) ? "퇴근 준비" :
            s.phase === "morning" ? "점심시간으로" : "진행 상황 보고"),
        ];
      }
      if (isTutorial(s)) {
        const next = s.phase === "overtime" ? "야근을 마치고 퇴근"
          : s.solvedToday ? "퇴근 준비" : "업무를 보류하고 퇴근 준비";
        return [
          ...(!s.solvedToday && !s.hint ? [internetHelpChoice(s)] : []),
          choice("next", next),
        ];
      }
      const hasTime = s.remaining >= 90;
      return [
        ...(s.phase === "morning" ? [] : [choice("cleanup", "추가 일감 1건을 정리한다", "업무 시간 1시간 30분", !s.scope || !hasTime)]),
        ...(s.cost > 0 && !s.solvedToday && currentMission(s) ? [choice("prepare", "업무의 사전 조사부터 한다", `배정 업무에 시간 ${formatMinutes(Math.min(s.cost, s.remaining))} 사용`, !s.remaining || canSubmit(s))] : []),
        choice("coffee", "커피 한 잔", "시간 25분 · 체력 +8", s.coffee || s.remaining < 25),
        choice("next", ({ morning: "점심시간으로", afternoon: "진행 상황 보고", overtime: "야근을 마치고 퇴근" })[s.phase]),
      ];
    }
    case "lunch":
      return [
        choice("rest", "혼자 먹고 잠깐 쉰다", hasChainedWork(s) ? "체력 +10 · 스트레스 −10" : "체력 +10"),
        choice("park", "박 대리와 밥을 먹는다", "체력 +5 · 박 대리 관계 +2"),
        choice("help", "이 대리와 먹고 밀린 일을 돕는다", hasChainedWork(s)
          ? `체력 +3 · 이 대리 관계 +2 · 추가 일감 ${s.relations.lee >= 2 ? "−" : "+"}1건`
          : "체력 +3 · 이 대리 관계 +2 · 추가 일감을 맡을 수 있음"),
        choice("kim", "김 과장 대신 전화를 받고 같이 먹는다", `체력 +4 · ${hasSurvival(s) ? "평판" : "인사평가"} +8`),
      ];
    case "negotiate":
      return [
        choice("accept", "요청을 받아들인다", hasChainedWork(s)
          ? `시간 −${formatMinutes(s.request[2])} · ${hasSurvival(s) ? "평판" : "평가"} +6 · 관계 +2 · 추가 일감 +${s.request[3]}건${!hasSurvival(s) && s.department === "sales" && projectDay(s, s.deadline) === 10 ? " · 마감 −1일" : ""}`
          : "관계 +2 · 일정 부담 증가"),
        choice("document", DEPARTMENTS[s.department].fallback, hasSurvival(s) ? "회의 20~35분 · 요청을 서면에 남긴다" : hasChainedWork(s) ? "회의 35분 · 평가 +2 · 관계 +2" : "회의 35분 · 관계 +2"),
        choice("push", "현재 일정으로는 어렵다고 설명한다", hasSurvival(s) ? "회의 20~45분 · 신뢰나 부서 관계가 높으면 합의" : hasChainedWork(s)
          ? `회의 45분 · 평가 ${s.relations[s.department] >= 1 ? "+2" : "−6"} · 관계 −1` : "회의 45분 · 관계 −1"),
        choice("ally", "부서 담당자와 함께 요청을 정리한다", hasChainedWork(s) && s.relations[s.department] >= 4
          ? `회의 15분 · ${hasSurvival(s) ? "평판" : "평가"} +4 · 추가 일감 −1건${!hasSurvival(s) && s.department === "sales" && projectDay(s, s.deadline) < 10 ? " · 마감 +1일" : ""}`
          : "관계 +4 이상 필요 · 회의 15분", s.relations[s.department] < 4),
      ];
    case "report":
      if (hasOfficeClock(s) && isTutorial(s)) return [choice("reportBrief", "첫날 업무를 보고한다", "보고 15분")];
      if (isFriday(s.day)) return [
        choice("yes", "네, 가능합니다."),
        choice("no", "물리적으로 불가능합니다."),
        choice("trim", "기능을 줄이면 가능합니다."),
        choice("joke", "영업팀이 개발하면 될 것 같습니다."),
      ];
      return [
        choice("reportBrief", "막힌 점만 공유한다", hasSurvival(s) && s.stats.reportTrust >= SURVIVAL.meetingTrust.high ? "신뢰로 간단 확인 · 5분" :
          hasSurvival(s) && s.stats.reportTrust <= SURVIVAL.meetingTrust.low ? "추가 확인 · 30분 · 다음 회의 +15분" : "회의 15분"),
        choice("reportFull", "요청한 사람 모두에게 성실하게 보고한다", `회의 45분 · ${hasSurvival(s) ? "평판" : "인사평가"} +7 · 내일 업무 시간 −30분`),
      ];
    case "leave": {
      if (hasSurvival(s)) return survivalLeaveOptions(s);
      if (hasChainedWork(s)) {
        const ready = projectReady(s, s.score - 4);
        const workWaiting = !!(s.scope || currentMission(s) || nextAssignment(s));
        return [
          choice("leave", isHalfDay(s) ? "12시 퇴근" : "정시 퇴근", ready ? "납품 목표 달성 · 오늘 프로젝트 종료" : "체력 +16 · 평가 −4 · 스트레스 −12"),
          ...(!isHalfDay(s) && !ready && (workWaiting || s.score - 4 < PROJECT_GOAL.score)
            ? [choice("stay", workWaiting ? "야근" : "평가를 위해 야근", `체력 −24 · 평가 +16 · 스트레스 +22${workWaiting ? " · 업무 시간 3시간 5분" : ""}${s.stats.overtime && projectDay(s, s.deadline) === 10 && s.shift < 10 ? " · 마감 −1일" : ""}`)]
            : []),
        ];
      }
      return [
        choice("leave", "정시 퇴근", "체력 +16 · 인사평가 −4"),
        choice("stay", "야근", "체력 −24 · 업무 시간 +3시간 5분 · 반복 시 다음 마감 단축"),
      ];
    }
  }
}

export function canBurst(s) {
  return hasSurvival(s) && !s.burst.used && !s.ending && !s.leisure.open &&
    isCoding(s.phase) && s.remaining > 0 && s.hp > 0 && daysUntilDelivery(s) <= 2;
}

export function taskIsOpen(s) {
  return !!s && (!hasSurvival(s) || !!s.task);
}

function survivalWorkOptions(s) {
  const mission = currentMission(s);
  const budget = s.remaining;
  const next = choice("next", s.phase === "overtime" ? "추가 근무를 마치고 퇴근" :
    isHalfDay(s) ? "정오 퇴근 준비" : s.phase === "morning" ? "점심시간으로" : "진행 상황 보고");
  if (mission && !s.solvedToday && !s.task && budget >= codingCost(s)) {
    return timePromises(s, mission).map(({ id, minutes, reputation, inspection }) => choice(id,
      inspection ? "코드를 먼저 확인한다" : `${formatMinutes(minutes)}을 약속한다`,
      inspection ? `사전 조사 ${inspection}분 · 확인 후 ${formatMinutes(minutes)}` :
        reputation ? `평판 ${reputation > 0 ? "+" : "−"}${Math.abs(reputation)}` : "보통 일정", budget < codingCost(s) + (inspection ?? 0)));
  }
  const offered = nextAssignment(s);
  const cleanup = s.scope && !s.task;
  const canNegotiate = s.stats.reportTrust >= SURVIVAL.meetingTrust.high || s.relations.planning >= 2 || s.relations.qa >= 3;
  const actions = [
    ...(offered && budget >= codingCost(s, offered) ? [choice("nextWork", "다음 업무 받기", `${offered.notice ?? offered.title} · 예상 ${missionNotice(s).estimate}`)] : []),
    ...(cleanup ? [choice("cleanup", "추가 일감 1건 정리", `시간 ${SURVIVAL.scopeMinutes}분`, budget < SURVIVAL.scopeMinutes)] : []),
    ...(cleanup && canNegotiate ? [choice("scope-agreement", "추가 일감 1건 범위 제외", "담당자 서명 · 회의 20분", budget < SURVIVAL.scopeMeeting)] : []),
    ...(s.activeWork === OPENING_WORK && !s.hint && s.task ? [internetHelpChoice(s)] : []),
    ...(!isTutorial(s) && !s.coffee && (!cleanup || !canNegotiate || !offered)
      ? [choice("coffee", "커피 한 잔", "시간 15분 · 체력 +5 · 스트레스 −12", budget < 15)] : []),
  ];
  return [...actions.slice(0, 3), next];
}

function overtimeBudget(s) {
  if (!isHalfDay(s)) return SURVIVAL.overtime.weekday;
  const extension = s.shift === SURVIVAL.deliveryShift && s.memory.clientExtension ? SURVIVAL.overtime.clientExtension : 0;
  return SURVIVAL.overtime.saturday + extension;
}

function survivalLeaveOptions(s) {
  const half = isHalfDay(s);
  const supported = s.stats.reportTrust >= SURVIVAL.meetingTrust.high || s.relations.park >= 2 || s.relations.lee >= 3;
  const todo = !projectDelivered(s);
  return [
    choice("leave", half ? "12시 퇴근" : "정시 퇴근", half && s.saturdayPressure && !supported ?
      "회식 거절 · 낮은 신뢰로 평판 −8 · 다음 회의 +15분" : "체력 +20 · 스트레스 −12"),
    ...(half && s.saturdayPressure && todo ?
      [choice("saturday-meal", "회식에 참석하고 오후 장애 대응", `체력 −15 · 13시부터 ${formatMinutes(overtimeBudget(s))} 추가 근무 · 관계·평판 상승`)] : []),
    ...(todo ? [choice("stay", half ? "식사는 건너뛰고 추가 근무" : "야근",
      `추가 업무 ${formatMinutes(overtimeBudget(s))} · 체력 시간당 −8`)] : []),
  ];
}

function rememberArrival(s) {
  if (s.shift === 3 && s.score < SURVIVAL.reputation.low && s.stats.reportTrust < SURVIVAL.meetingTrust.high) {
    change(s, { meeting: 15, stress: 5 });
    s.effects.push("박 대리가 재현 조건부터 받아 갔다. 낮은 평판 때문에 신입은 다시 설명을 들어야 했다.");
  }
  if (s.shift === 7 && s.memory.planningAccepted) {
    change(s, { scope: 1, stress: 5 });
    s.effects.push("기획팀이 지난주 변경을 받아 준 메일을 근거로 일감을 하나 더 올렸다.");
  }
  if (s.shift === 8) {
    const covered = s.memory.helpedLee || s.relations.park >= 3;
    change(s, covered ? { meeting: 10 } : { scope: 1 });
    s.effects.push(covered ? "동료가 이 대리의 검수 목록을 나눠 맡았다." : "이 대리의 검수 목록에서 한 건을 이관받았다.");
  }
  if (s.shift === 10 && s.memory.unchecked) {
    change(s, { scope: Math.min(2, s.memory.unchecked), stress: 8 });
    s.effects.push("QA가 시간이 넘어갔거나 넘겨 준 업무에서 재검수 항목을 찾아냈다.");
  }
  if (s.shift === 11 && s.memory.helpedLee && !s.memory.guidanceUsed) {
    s.memory.guidanceUsed = true;
    if (s.scope) change(s, { scope: -1 });
    else change(s, { minutes: 15, stress: -8 });
    s.effects.push("이 대리가 지난번에 도와준 빚이라며 검수를 대신했다.");
  }
  if (s.shift === 11 && s.stats.reportTrust >= SURVIVAL.meetingTrust.high) {
    change(s, { minutes: 15 });
    s.effects.push("고객사 담당자가 먼저 퇴근했다. 영업팀이 검수 시간을 확보해 오전 보고가 15분 줄었다.");
  }
  if (s.shift === SURVIVAL.deliveryShift && s.memory.planningAccepted >= 2 && !s.deliverySubmitted) {
    change(s, { scope: 1, stress: 6 });
    s.saturdayPressure = true;
    s.effects.push("기획팀이 예전에 승인받은 메일을 첨부했다. 마지막 변경 1건이 납품 범위에 들어왔다.");
  }
  if (s.shift >= 9 && s.score >= SURVIVAL.reputation.ace && !s.memory.expertRequest) {
    const specialty = Object.entries(s.memory.expertise).find(([, count]) => count >= 2)?.[0];
    if (specialty) {
      s.memory.expertRequest = true;
      change(s, { scope: 1 });
      s.effects.push(`김 과장 ‘${specialty}은 신입이 제일 잘하니까 이것도 맡아.’`);
    }
  }
  if (s.hp <= 15 && (s.seed + s.shift) % 2 === 0) {
    change(s, { meeting: 15, stress: 8 });
    s.effects.push("총무가 과로 증상을 확인하느라 15분을 쓰고 야근 신청서를 가져갔다.");
  }
}

export function useBurst(s) {
  if (!canBurst(s)) return false;
  s.moves.push("burst");
  s.burst.used = true;
  s.burst.remaining = SURVIVAL.burst.minutes;
  if (s.task) s.task.burstBonus = s.task.limit;
  award(s, "마감이 최고의 동기부여");
  s.effects = ["컴돌이 · 인간의 마감 직전 연산 능력이 급격히 상승했습니다."];
  return true;
}

export function deferWork(s) {
  if (!hasSurvival(s) || !s.task || !mayWork(s)) return false;
  s.moves.push("defer-work");
  s.effects = ["업무를 이월했다. 초안은 업무표에 남겼다. 보고 신뢰도 −4."];
  handoffTask(s, true);
  s.solvedToday = true;
  settleCosts(s);
  return true;
}

export function act(s, id) {
  const selected = options(s).find((entry) => entry.id === id);
  if (!selected || selected.disabled) return false;
  s.moves.push(id);
  switch (s.phase) {
    case "sunday":
      change(s, { hp: SURVIVAL.recovery.sundayHp, stress: id === "sunday-lee" ? -25 : -SURVIVAL.recovery.sundayStress,
        lee: id === "sunday-lee" ? 2 : 0 });
      s.day++;
      startDay(s);
      s.effects.push(id === "sunday-lee" ? "이 대리가 ‘월요일에 봐요’라고 답장을 보냈다. 3년 만의 일요일 문자였다." :
        "호출기가 울리지 않았다. 개발자는 낮잠에도 성공했다.");
      break;
    case "arrive":
      if (isTutorial(s)) {
        if (hasLanguageAssignment(s) && !s.language) {
          s.familiarLanguage = id.slice("stack-".length);
          s.language = assignedLanguage(s.seed, s.familiarLanguage);
          break;
        }
        s.stats.calledSimple++;
        s.stats.actuallySimple++;
        if (hasOfficeClock(s)) s.remaining = LUNCH_START - 10 * 60;
        s.phase = "morning";
        break;
      }
      if (hasSurvival(s) || s.shift !== 9 || id === "automate") change(s, s.event.effect);
      if (hasSurvival(s)) rememberArrival(s);
      change(s, { meeting: (s.scrum ? 0 : 30) + s.nextMeeting });
      s.nextMeeting = 0;
      if (hasOfficeClock(s)) s.remaining = Math.min(s.remaining, LUNCH_START - (9 * 60 + 30));
      if (id === "automate") {
        s.stats.calledSimple++;
        s.effects = [hasOfficeClock(s)
          ? "검수표 자동화로 오전 준비를 빨리 마쳤다. 김 과장이 곧바로 ‘간단한 것’ 한 건을 추가했다."
          : "검수표를 자동으로 만들었다. 김 과장이 절약된 1시간 30분을 보고 ‘간단한 일’ 1시간 30분을 추가했다."];
      }
      s.phase = s.scrum ? "scrum" : "assign";
      break;
    case "scrum": {
      const report = handleScrum(s, id, missionNotice(s)?.title);
      change(s, report.effect);
      if (hasDirectAssignments(s)) {
        const assignment = hasWorkContent(s) && needsAssignment(s);
        const quickAssignment = hasChainedWork(s) && assignment && id === "scrumQuick" && (!hasSurvival(s) || s.shift !== 3);
        if (quickAssignment) receiveProjectWork(s);
        s.scrum.assignment = assignment && !quickAssignment;
        s.effects = hasSurvival(s) ? [...s.effects, ...report.effects] : report.effects;
        s.phase = s.scrum.assignment ? "assign" : "morning";
        break;
      }
      const assign = needsAssignment(s);
      s.scrum.assignment = assign;
      if (assign) change(s, { meeting: 15 });
      s.effects = [...report.effects, assign ? "이어서 별도 업무 배분 회의 15분." : "오늘은 기존 업무를 이어서 한다."];
      s.phase = assign ? "assign" : "morning";
      break;
    }
    case "assign":
      if (hasWorkContent(s)) {
        if (hasChainedWork(s)) receiveProjectWork(s);
        if (id === "priority") change(s, { park: -1, minutes: Math.min(10, 150 - s.remaining) });
        const mission = currentMission(s);
        s.scrum.today.workType = mission.type;
        s.effects = [];
        s.phase = "morning";
        break;
      }
      handleAssignment(s, id);
      break;
    case "morning":
    case "afternoon":
    case "overtime":
      if (id.startsWith("promise-")) {
        const mission = currentMission(s);
        const promise = timePromises(s, mission).find(option => option.id === id);
        if (promise.inspection) {
          spendTime(s, promise.inspection);
          s.scrum.today.research += promise.inspection;
        }
        change(s, { score: promise.reputation });
        beginTask(s, mission, promise);
        if (s.burst.remaining) s.task.burstBonus = s.task.limit;
        s.effects = [`김 과장과 ${formatMinutes(promise.minutes)} 일정을 잡았다.`];
      } else if (id === "scope-agreement") {
        change(s, { scope: -1, meeting: SURVIVAL.scopeMeeting, stress: -5 });
        s.stats.negotiations++;
        s.memory.scopeRemoved++;
        s.effects = ["담당자와 서명한 변경 요청서를 보관했다. 추가 일감 −1건."];
      } else if (id === "nextWork") {
        receiveProjectWork(s);
        s.effects = [];
      } else if (id === "next") {
        s.effects = [];
        if (s.phase === "overtime") {
          handoffTask(s);
          settleCosts(s);
          if (!s.ending) finishShift(s);
        } else advanceFromCoding(s);
      } else if (id === "tutorialHelp") {
        s.hint = true;
        s.effects = ["이 대리가 첫 업무에 참고할 자료를 알려 줬다."];
      } else if (id === "cleanup") {
        chargeCoding(s, hasSurvival(s) ? SURVIVAL.scopeMinutes : CLEANUP_MINUTES);
        change(s, { scope: -1, score: 4, hp: -2 });
        s.effects = ["밀린 일감 1건을 정리했다."];
      } else if (id === "prepare") {
        const spent = Math.min(s.cost, s.remaining);
        chargeCoding(s, spent);
        s.cost -= spent;
        if (s.scrum) s.scrum.today.research += spent;
        s.effects = [`재현·자료 조사에 ${formatMinutes(spent)}을 썼다. 이 업무에 ${formatMinutes(codingCost(s))}이 더 필요하다.`];
      } else {
        s.coffee = true;
        change(s, hasSurvival(s) ? { minutes: -15, hp: 5, stress: -12 } : { minutes: -25, hp: 8, stress: -5 });
        s.effects = ["김 과장 몫도 함께 타 왔다."];
      }
      break;
    case "lunch":
      if (id === "help") {
        const traded = s.relations.lee >= 2;
        if (hasSurvival(s)) s.memory.helpedLee++;
        change(s, { hp: 3, lee: 2, scope: traded ? -1 : 1, stress: hasSurvival(s) ? -6 : 0 });
        s.effects = [traded ? "이 대리가 이번엔 밀린 검수를 같이 끝냈다." : "이 대리가 부탁한 버그를 맡았다. 다음에 도움이 필요하면 먼저 말하라고 했다."];
      } else if (id === "park") {
        change(s, { hp: 5, park: 2, stress: hasSurvival(s) ? -8 : 0 });
        s.effects = ["박 대리가 내일 회의에서 먼저 말을 걸라고 했다."];
      } else if (id === "kim") {
        change(s, { hp: 4, score: 8 });
        s.effects = ["김 과장  ‘위에는 된다고 해야 하고 아래에는 해달라고 해야 하네. 같이 먹어줘서 고맙다.’"];
      } else {
        change(s, { hp: 10, stress: -10 });
        s.effects = ["호출기 없이 먹는 밥은 오랜만이다."];
      }
      if (hasOfficeClock(s) && isTutorial(s)) {
        s.remaining = reportStart(s) - LUNCH_END;
        s.phase = "afternoon";
      } else s.phase = "negotiate";
      break;
    case "negotiate":
      handleNegotiation(s, id);
      break;
    case "report":
      if (isFriday(s.day)) handleBoss(s, id);
      else {
        const full = id === "reportFull";
        const trusted = hasSurvival(s) && s.stats.reportTrust >= SURVIVAL.meetingTrust.high;
        const watched = hasSurvival(s) && s.stats.reportTrust <= SURVIVAL.meetingTrust.low;
        change(s, { meeting: full ? 45 : trusted ? 5 : watched ? 30 : 15, score: full ? 7 : 0 });
        s.nextMeeting = full ? 30 : watched ? 15 : 0;
        s.effects = [full ? "오늘 보고가 길어져 후속 회의가 내일 업무 시간 30분을 차지한다." : "회의록 한 줄을 남기고 자리에 돌아왔다."];
        s.phase = "leave";
      }
      break;
    case "leave":
      if (hasSurvival(s) && id === "leave") {
        handoffTask(s);
        settleCosts(s);
        settleBurst(s);
        if (s.ending) break;
        if (s.saturdayPressure && s.stats.reportTrust < SURVIVAL.meetingTrust.high && s.relations.park < 2 && s.relations.lee < 3) {
          change(s, { score: -8, stress: 5 });
          s.nextMeeting += 15;
        }
        s.stats.onTime++;
        if (isHalfDay(s)) s.stats.saturdayLeaves++;
        change(s, { hp: SURVIVAL.recovery.onTime, stress: -12 });
        finishShift(s);
      } else if (hasSurvival(s)) {
        s.stats.overtime++;
        const meal = id === "saturday-meal";
        const budget = overtimeBudget(s);
        s.overtimeBudget = budget + (meal ? 60 : 0);
        s.remaining = budget;
        s.phase = "overtime";
        change(s, { hp: meal ? -15 : 0, score: meal ? 10 : 3, stress: 12, park: meal ? 1 : 0, lee: meal ? 1 : 0 });
        if (isHalfDay(s)) award(s, "반나절의 기적");
        s.effects = [meal ? "12:00엔 밥만 먹자고 했다. 13:00에 장애 대응 메일이 왔다." :
          "자리에 남았다. 추가 근무를 쓴 만큼 체력이 줄어든다."];
      } else if (id === "leave") {
        s.stats.onTime++;
        change(s, { hp: 16, score: -4, stress: -12 });
        finishShift(s);
      } else {
        s.stats.overtime++;
        const compressed = s.stats.overtime > 1;
        change(s, { hp: -24, score: 16, stress: 22, deadline: compressed ? -1 : 0 });
        s.remaining = OVERTIME_MINUTES;
        s.phase = "overtime";
        s.effects = [compressed ? "‘지난번에도 되던데?’ 새 마감이 하루 당겨졌다." : "김 과장이 비품 창고에서 컵라면을 하나 꺼냈다."];
      }
      break;
  }
  settleCosts(s);
  return true;
}

export function recordFor(s) {
  const record = { id: s.id, ending: s.ending, day: projectDay(s), progress: s.progress, ...s.stats, hp: s.hp,
    completedDay: s.completedDay === null ? null : projectDay(s, s.completedDay), achievements: [...s.achievements] };
  if (hasWorkContent(s)) record.stress = s.stress;
  if (hasShortProject(s)) {
    record.missionTotal = missionCount(s);
    record.completedCalendarDay = s.completedDay;
  }
  if (hasChainedWork(s)) {
    record.score = s.score;
    if (hasSurvival(s)) {
      record.reputation = s.score;
      record.burstUsed = s.burst.used ? "사용" : "미사용";
      record.timeMode = s.relaxed ? "완화" : "기본";
      record.projectDelivered = projectDelivered(s);
      record.deliveryMinute = s.deliveryMinute ?? null;
    } else record.scoreGoal = PROJECT_GOAL.score;
    record.deliverySubmitted = s.deliverySubmitted;
    record.scope = s.scope;
  }
  if (s.web) record.webSources = Object.values(s.web.sources ?? {});
  if (hasLanguageAssignment(s)) record.language = s.language;
  return record;
}

export function replayRun({ id, seed, moves, ruleset = RULESET }) {
  const run = newRun(seed, id, ruleset);
  for (const move of moves) {
    if (run.ending) return null;
    if (typeof move === "number") {
      if (!Number.isInteger(move) || move < 1 || move > 1000000 - run.stats.paste || !recordPaste(run, move)) return null;
    } else if (Array.isArray(move)) {
      if (!hasWorkContent(run) && move[0] !== "web") return null;
      if (move[0] === "work" && move.length === 2) {
        if (!submitSpecialWork(run, move[1])) return null;
      } else if ((move[0] === "elapsed" || move[0] === "research-elapsed") && move.length === 2) {
        if (!recordTaskTime(run, move[1], move[0] === "research-elapsed")) return null;
      } else if (move[0] === "web") {
        if (move.length !== (move[1] === "open" ? 2 : 3) || (move.length === 3 && typeof move[2] !== "string")) return null;
        const moveCount = run.moves.length;
        if (!useInternet(run, move[1], move[2]) || run.moves.length === moveCount) return null;
      } else if (move[0] === "mine") {
        const [, action, value] = move;
        const expectsValue = ["tick", "flag", "reveal"].includes(action);
        if (move.length !== (expectsValue ? 3 : 2)) return null;
        const result = playMinesAction(run, action, value);
        if (!result || (action === "tick" && result !== value)) return null;
      } else return null;
    } else if (move === "work-search") {
      if (!searchAtWork(run)) return null;
    } else if (move === "burst") {
      if (!useBurst(run)) return null;
    } else if (move === "defer-work") {
      if (!deferWork(run)) return null;
    } else if (move === "relaxed") {
      if (!enableRelaxed(run)) return null;
    } else if (move === "run-retry") {
      if (!failPracticeRun(run)) return null;
    } else if (move === "code-review") {
      if (!requestCodeReview(run)) return null;
    } else if (move === "code-delegate") {
      if (!delegateCodeWork(run)) return null;
    } else if (move === "solve" ? !submitSolution(run) : move === "code-retry" ? !failCodeSubmission(run) : !act(run, move)) return null;
  }
  return run.ending ? recordFor(run) : null;
}

export function enableRelaxed(s) {
  if (!hasSurvival(s) || s.relaxed || s.ending || s.moves.length) return false;
  s.relaxed = true;
  s.moves.push("relaxed");
  return true;
}
