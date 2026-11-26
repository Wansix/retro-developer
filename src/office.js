import { ARCHITECTURE, AUTOMATION, CODE_REVIEW, DEPARTMENTS, ENDINGS, EXTRA_TICKETS, LUNCH, OFFICE_EVENTS, TICKETS } from "./office-content.js";
import { MISSIONS } from "./missions.js";
import { CHAINED_WORK_RULESET, DIRECT_ASSIGNMENT_RULESET, FUNDAMENTALS_RULESET, LANGUAGE_ASSIGNMENT_RULESET, PROBLEM_BANK_RULESET, PROJECT_WORKDAYS, RULESET, SCRUM_RULESET, SHORT_PROJECT_RULESET, TOTAL_DAYS, WORK_CONTENT_RULESET, calendarDayForWorkday, formatMinutes, workdayForCalendarDay } from "./records-schema.js";
import { SCRUM_REPORTS, beginScrumDay, finishScrumDay, finishScrumRun, handleScrum, initScrum, markMorningDelivery } from "./scrum.js";
import { makeWork, gradeWork, problemBankWorkOrder, shortWorkOrder, workOrder, WORK_TYPES } from "./work-missions.js";
import { applyLeisure, award, canOpenLeisure, initLeisure } from "./mines.js";
import { DEPLOYMENT_WORK, OPENING_WORK, PROJECT_GOAL, nextProjectWork, projectReady, projectWorkDeck } from "./project-work.js";
import { assignedLanguage, LANGUAGES } from "./office-languages.js";

export const PHASES = {
  arrive: ["09:00", "출근"],
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
export const projectDay = (s, day = s.day) => hasShortProject(s) ? workdayForCalendarDay(day) : day;
const projectLimit = s => hasShortProject(s) ? calendarDayForWorkday(PROJECT_WORKDAYS) : TOTAL_DAYS;
export const currentMission = (s) => hasWorkContent(s)
  ? makeWork(hasChainedWork(s) ? s.activeWork : s.workOrder[s.progress], s.seed, s.language)
  : MISSIONS[s.progress];
export const missionCount = (s) => hasChainedWork(s) ? PROJECT_GOAL.work : hasWorkContent(s) ? s.workOrder.length : MISSIONS.length;
export const nextAssignment = (s) => hasChainedWork(s) && !s.activeWork ? makeWork(nextProjectWork(s), s.seed, s.language) : null;
export const missionNotice = (s) => {
  const work = currentMission(s) ?? nextAssignment(s);
  return work ? { title: work.notice ?? work.title, estimate: work.estimate } : null;
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
    run.workOrder = hasChainedWork(run) ? projectWorkDeck(seed, ruleset >= FUNDAMENTALS_RULESET) : hasProblemBank(run) ? problemBankWorkOrder(seed) :
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
  s.remaining = hasChainedWork(s) ? 140 : 180;
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
  s.department = s.departmentOrder[(s.shift - 1) % s.departmentOrder.length];
  const count = s.requestCount[s.department] ?? 0;
  const order = s.requestOrder[s.department];
  s.request = DEPARTMENTS[s.department].requests[order[count % order.length]];
  if (s.relations[s.department] < 4) s.requestCount[s.department] = count + 1;
  s.effects = [];
  if (s.scrum) beginScrumDay(s, missionNotice(s)?.title ?? null);
}

function change(s, effect) {
  s.hp = clamp(s.hp + (effect.hp ?? 0), 0, 100);
  s.score += effect.score ?? 0;
  s.scope = Math.max(0, s.scope + (effect.scope ?? 0));
  if (effect.deadline && hasShortProject(s)) {
    const firstPossible = Math.max(projectDay(s), hasChainedWork(s) ? 9 : missionCount(s));
    const adjusted = clamp(projectDay(s, s.deadline) + effect.deadline, firstPossible, PROJECT_WORKDAYS);
    s.deadline = calendarDayForWorkday(adjusted);
  } else if (!hasShortProject(s)) {
    s.deadline = clamp(s.deadline + (effect.deadline ?? 0), s.day, TOTAL_DAYS);
  }
  s.remaining = Math.max(0, s.remaining + (effect.minutes ?? 0) - (effect.meeting ?? 0));
  s.stats.meetings += effect.meeting ?? 0;
  if (hasWorkContent(s)) s.stress = clamp(s.stress + (effect.stress ?? 0) + Math.floor((effect.meeting ?? 0) / 20), 0, 100);
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
  s.phase = isTutorial(s) ? "leave" : s.phase === "morning" ? "lunch" : "report";
}

export function codingCost(s, mission = currentMission(s)) {
  const progression = hasDirectAssignments(s) ? 15 * Math.floor(s.progress / 3) : 0;
  if (hasWorkContent(s)) return (mission?.minutes ?? (45 + (hasChainedWork(s) ? 0 : progression))) + (s.stress >= 75 ? 10 : 0);
  return 45 + s.cost + progression;
}

function mayWork(s) {
  return !s.ending && !s.leisure?.open && isCoding(s.phase) && !!currentMission(s) && !s.solvedToday;
}

export function canSubmit(s) {
  return mayWork(s) && s.remaining >= codingCost(s);
}

function chargeCoding(s, minutes) {
  const spent = Math.min(minutes, s.remaining);
  s.remaining -= spent;
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
  return hasProblemBank(s) && mayWork(s) && mission.fromBank &&
    s.reviewedProblem !== mission.id && s.remaining >= CODE_REVIEW_MINUTES;
}

export function requestCodeReview(s) {
  if (!canReviewCode(s)) return false;
  s.remaining -= CODE_REVIEW_MINUTES;
  s.scrum.today.research += CODE_REVIEW_MINUTES;
  s.reviewedProblem = currentMission(s).id;
  s.stats.codeReviews++;
  s.moves.push("code-review");
  return true;
}

export function canDelegateCode(s) {
  return hasProblemBank(s) && mayWork(s) && currentMission(s).type === "code";
}

export function delegateCodeWork(s) {
  if (!canDelegateCode(s)) return false;
  const cost = CODE_DELEGATION;
  s.remaining = Math.max(0, s.remaining - cost.minutes);
  s.stats.reportTrust = Math.max(0, s.stats.reportTrust - cost.trust);
  change(s, { score: -cost.score, lee: -cost.relation });
  s.stats.codeDelegations++;
  s.scrum.today.workType = "code";
  s.scrum.today.workDelegated = true;
  s.moves.push("code-delegate");
  advanceWork(s);
  s.effects = ["이 대리가 업무를 마무리했다. 진행 +1 · 인사평가 −12 · 보고 신뢰도 −8 · 이 대리 관계 −1."];
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
  if (!mission.type || mission.type === "code") chargeCoding(s, minutes);
  else s.remaining -= minutes;
  workAttempt(s, mission, true, minutes);
  advanceWork(s);
  const reward = mission.reward ?? { score: 14, hp: -3, stress: -4 };
  change(s, reward);
  s.effects = [move === DEBUG_PASS_MOVE ? "디버그로 검수 성공을 처리했다." :
    mission.explanation ?? (mission.fromBank ? "공개·숨겨진 테스트를 모두 통과했다." : "기능 검수를 통과했다.")];
  if (hasChainedWork(s)) s.effects[0] += ` 업무 +1건 · 평가 +${reward.score} · 시간 −${formatMinutes(minutes)}`;
  if (!isTutorial(s) && s.phase === "morning" && (s.ruleset < FUNDAMENTALS_RULESET || s.shift > 3) &&
      s.remaining >= (hasChainedWork(s) ? 75 : 35) &&
      (!hasChainedWork(s) || s.workDoneToday === 1)) {
    change(s, { scope: 1 });
    s.stats.calledSimple++;
    s.effects.push("김 과장이 ‘벌써 끝났어? 이것도 간단해’라며 일감 1건을 추가했다.");
  }
  if (s.hp === 0) finish(s, "hospital");
  return true;
}

function advanceWork(s) {
  s.cost = 0;
  s.solvedToday = true;
  s.progress++;
  if (hasChainedWork(s)) {
    if (s.activeWork === DEPLOYMENT_WORK) s.deliverySubmitted = true;
    s.finishedWork.push(s.activeWork);
    s.activeWork = null;
    s.workDoneToday++;
  }
  if (s.scrum && s.phase === "morning") markMorningDelivery(s);
}

function workFailure(s, mission, move) {
  const minutes = Math.min(s.remaining, RETRY_MINUTES);
  if (mission.type === "code") chargeCoding(s, minutes);
  else s.remaining -= minutes;
  workAttempt(s, mission, false, minutes);
  change(s, { stress: 6 });
  s.moves.push(move);
  return minutes;
}

export function failCodeSubmission(s) {
  const mission = currentMission(s);
  if (!hasWorkContent(s) || mission?.type !== "code" || !canSubmit(s)) return false;
  return workFailure(s, mission, "code-retry");
}

export function submitSpecialWork(s, answer) {
  const mission = currentMission(s);
  if (!hasWorkContent(s) || !mayWork(s) || mission.type === "code") return null;
  const cardCheck = mission.type === "memory" && Array.isArray(answer) && answer.length === 2;
  if (cardCheck ? s.remaining <= 0 : s.remaining < codingCost(s)) return null;
  const passed = gradeWork(mission, answer);
  if (passed === null) return null;
  const move = ["work", Array.isArray(answer) ? [...answer] : answer];
  if (passed) return { passed, minutes: codingCost(s), completed: completeWork(s, mission, move) };
  return { passed, minutes: workFailure(s, mission, move) };
}

export function playMinesAction(s, action, value) {
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
  return result;
}

export function recordPaste(s, attempts = 1) {
  const mission = currentMission(s);
  if (s.ending || s.leisure?.open || !isCoding(s.phase) || !mission || (mission.type && mission.type !== "code") || s.solvedToday) return 0;
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
  if (s.hp === 0) return finish(s, "hospital");
  if (hasChainedWork(s) ? projectReady(s) : !currentMission(s) && s.scope === 0) {
    if (s.stats.onTime >= 7 && s.stats.overtime <= 2 && s.hp >= 65) return finish(s, "balance");
    if (s.score >= 220 && s.stats.overtime >= 4) return finish(s, "promotion");
    if (Object.values(s.relations).filter((n) => n >= 4).length >= 4) return finish(s, "teamwork");
    return finish(s, "release");
  }
  const next = isFriday(s.day) ? s.day + 3 : s.day + 1;
  if (next > s.deadline) return finish(s, "deadline");
  if (s.scrum) finishScrumDay(s);
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
  let disruption;
  if (id === "accept") {
    disruption = time;
    change(s, { scope, score: 6, [key]: 2, deadline: key === "sales" ? -1 : 0 });
    s.stats.calledSimple++;
    if (name === "2픽셀의 차이") {
      s.stats.design += time;
      change(s, { achievement: "2픽셀을 위한 2시간" });
    }
    s.effects = [`요청을 받았다. 오후 시간 −${formatMinutes(time)} · 추가 일감 +${scope}건${key === "sales" ? " · 마감 −1일" : ""}.`];
  } else if (id === "ally") {
    change(s, { scope: -1, score: 4, meeting: 15, [key]: 1, deadline: key === "sales" ? 1 : 0 });
    disruption = 15;
    s.effects = [team.ally, "이미 올라온 일감도 한 건 정리했다."];
  } else {
    const agreed = s.relations[key] >= 1 || id === "document";
    const minutes = id === "document" ? 35 : 45;
    change(s, { meeting: minutes, [key]: id === "document" ? 2 : -1, score: agreed ? 2 : -6 });
    disruption = minutes;
    if (key === "planning" || key === "design") s.stats[key] += minutes;
    s.effects = [agreed ? "담당자가 합의한 범위 안으로 요청을 정리했다." : "요청을 보류했다. 다음 회의 때 책임 소재를 따지겠다는 답장이 왔다."];
  }
  if (s.scrum && key === "planning") s.scrum.today.planning += disruption;
  if (s.scrum && key === "qa") s.scrum.today.bugs += scope;
  s.remaining = (hasChainedWork(s) ? 205 : 270) - disruption;
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
  change(s, { ...effect, meeting: 95 });
  s.stats.planning += 20;
  s.stats.design += 20;
  if (id === "yes") s.stats.calledSimple += 3;
  s.effects = [message];
  s.phase = "leave";
}

export function options(s) {
  if (s.ending || s.leisure?.open) return [];
  switch (s.phase) {
    case "arrive":
      if (isTutorial(s) && hasLanguageAssignment(s) && !s.language) {
        return [...Object.entries(LANGUAGES).map(([id, { name }]) => choice("stack-" + id, name + " 할 줄 알아요")),
          choice("stack-none", "한국어요.")];
      }
      if (isTutorial(s)) return [choice("arrive", "첫 업무 시작")];
      if (s.shift === 9) return [
        choice("automate", "검수표를 자동화한다", "오전 업무 시간 +1시간 30분"),
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
      if (hasChainedWork(s)) {
        const offered = nextAssignment(s);
        return [
          ...(offered && s.remaining >= codingCost(s, offered)
            ? [choice("nextWork", "다음 업무 받기", `${offered.notice ?? offered.title} · 예상 ${offered.estimate}`)] : []),
          ...(s.activeWork === OPENING_WORK && !s.hint ? [choice("tutorialHelp", "이 대리가 골라 준 글 보기")] : []),
          ...(s.scope && s.phase !== "morning" ? [choice("cleanup", "추가 일감 1건 정리",
            `시간 ${formatMinutes(CLEANUP_MINUTES)} · 인사평가 +4`, s.remaining < CLEANUP_MINUTES)] : []),
          ...(!isTutorial(s) && !s.coffee ? [choice("coffee", "커피 한 잔", "시간 25분 · 체력 +8 · 스트레스 −5", s.remaining < 25)] : []),
          choice("next", s.phase === "overtime" ? "야근을 마치고 퇴근" : isTutorial(s) ? "퇴근 준비" :
            s.phase === "morning" ? "점심시간으로" : "진행 상황 보고"),
        ];
      }
      if (isTutorial(s)) {
        const next = s.phase === "overtime" ? "야근을 마치고 퇴근"
          : s.solvedToday ? "퇴근 준비" : "업무를 보류하고 퇴근 준비";
        return [
          ...(!s.solvedToday && !s.hint ? [choice("tutorialHelp", "이 대리가 골라 준 글 보기")] : []),
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
        choice("kim", "김 과장 대신 전화를 받고 같이 먹는다", "체력 +4 · 인사평가 +8"),
      ];
    case "negotiate":
      return [
        choice("accept", "요청을 받아들인다", hasChainedWork(s)
          ? `시간 −${formatMinutes(s.request[2])} · 평가 +6 · 관계 +2 · 추가 일감 +${s.request[3]}건${s.department === "sales" && projectDay(s, s.deadline) === 10 ? " · 마감 −1일" : ""}`
          : "관계 +2 · 일정 부담 증가"),
        choice("document", DEPARTMENTS[s.department].fallback, hasChainedWork(s) ? "회의 35분 · 평가 +2 · 관계 +2" : "회의 35분 · 관계 +2"),
        choice("push", "현재 일정으로는 어렵다고 설명한다", hasChainedWork(s)
          ? `회의 45분 · 평가 ${s.relations[s.department] >= 1 ? "+2" : "−6"} · 관계 −1` : "회의 45분 · 관계 −1"),
        choice("ally", "부서 담당자와 함께 요청을 정리한다", hasChainedWork(s) && s.relations[s.department] >= 4
          ? `회의 15분 · 평가 +4 · 추가 일감 −1건${s.department === "sales" && projectDay(s, s.deadline) < 10 ? " · 마감 +1일" : ""}`
          : "관계 +4 이상 필요 · 회의 15분", s.relations[s.department] < 4),
      ];
    case "report":
      if (isFriday(s.day)) return [
        choice("yes", "네, 가능합니다."),
        choice("no", "물리적으로 불가능합니다."),
        choice("trim", "기능을 줄이면 가능합니다."),
        choice("joke", "영업팀이 개발하면 될 것 같습니다."),
      ];
      return [
        choice("reportBrief", "막힌 점만 공유한다", "회의 15분"),
        choice("reportFull", "요청한 사람 모두에게 성실하게 보고한다", "회의 45분 · 인사평가 +7 · 내일 업무 시간 −30분"),
      ];
    case "leave": {
      if (hasChainedWork(s)) {
        const ready = projectReady(s, s.score - 4);
        const workWaiting = !!(s.scope || currentMission(s) || nextAssignment(s));
        return [
          choice("leave", "정시 퇴근", ready ? "납품 목표 달성 · 오늘 프로젝트 종료" : "체력 +16 · 평가 −4 · 스트레스 −12"),
          ...(!ready && (workWaiting || s.score - 4 < PROJECT_GOAL.score)
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

export function act(s, id) {
  const selected = options(s).find((entry) => entry.id === id);
  if (!selected || selected.disabled) return false;
  s.moves.push(id);
  switch (s.phase) {
    case "arrive":
      if (isTutorial(s)) {
        if (hasLanguageAssignment(s) && !s.language) {
          s.familiarLanguage = id.slice("stack-".length);
          s.language = assignedLanguage(s.seed, s.familiarLanguage);
          break;
        }
        s.stats.calledSimple++;
        s.stats.actuallySimple++;
        s.phase = "morning";
        break;
      }
      if (s.shift !== 9 || id === "automate") change(s, s.event.effect);
      change(s, { meeting: (s.scrum ? 0 : 30) + s.nextMeeting });
      s.nextMeeting = 0;
      if (id === "automate") {
        s.stats.calledSimple++;
        s.effects = ["검수표를 자동으로 만들었다. 김 과장이 절약된 1시간 30분을 보고 ‘간단한 일’ 1시간 30분을 추가했다."];
      }
      s.phase = s.scrum ? "scrum" : "assign";
      break;
    case "scrum": {
      const report = handleScrum(s, id, missionNotice(s)?.title);
      change(s, report.effect);
      if (hasDirectAssignments(s)) {
        const assignment = hasWorkContent(s) && needsAssignment(s);
        const quickAssignment = hasChainedWork(s) && assignment && id === "scrumQuick";
        if (quickAssignment) receiveProjectWork(s);
        s.scrum.assignment = assignment && !quickAssignment;
        s.effects = report.effects;
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
      if (id === "nextWork") {
        receiveProjectWork(s);
        s.effects = [];
      } else if (id === "next") {
        s.effects = [];
        if (s.phase === "overtime") finishShift(s);
        else advanceFromCoding(s);
      } else if (id === "tutorialHelp") {
        s.hint = true;
        s.effects = ["이 대리가 첫 업무에 참고할 글을 열어 줬다."];
      } else if (id === "cleanup") {
        chargeCoding(s, CLEANUP_MINUTES);
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
        change(s, { minutes: -25, hp: 8, stress: -5 });
        s.effects = ["김 과장 몫도 함께 타 왔다."];
      }
      break;
    case "lunch":
      if (id === "help") {
        const traded = s.relations.lee >= 2;
        change(s, { hp: 3, lee: 2, scope: traded ? -1 : 1 });
        s.effects = [traded ? "이 대리가 이번엔 밀린 검수를 같이 끝냈다." : "이 대리가 부탁한 버그를 맡았다. 다음에 도움이 필요하면 먼저 말하라고 했다."];
      } else if (id === "park") {
        change(s, { hp: 5, park: 2 });
        s.effects = ["박 대리가 내일 회의에서 먼저 말을 걸라고 했다."];
      } else if (id === "kim") {
        change(s, { hp: 4, score: 8 });
        s.effects = ["김 과장  ‘위에는 된다고 해야 하고 아래에는 해달라고 해야 하네. 같이 먹어줘서 고맙다.’"];
      } else {
        change(s, { hp: 10, stress: -10 });
        s.effects = ["호출기 없이 먹는 밥은 오랜만이다."];
      }
      s.phase = "negotiate";
      break;
    case "negotiate":
      handleNegotiation(s, id);
      break;
    case "report":
      if (isFriday(s.day)) handleBoss(s, id);
      else {
        const full = id === "reportFull";
        change(s, { meeting: full ? 45 : 15, score: full ? 7 : 0 });
        s.nextMeeting = full ? 30 : 0;
        s.effects = [full ? "오늘 보고가 길어져 후속 회의가 내일 업무 시간 30분을 차지한다." : "회의록 한 줄을 남기고 자리에 돌아왔다."];
        s.phase = "leave";
      }
      break;
    case "leave":
      if (id === "leave") {
        s.stats.onTime++;
        change(s, { hp: 16, score: -4, stress: -12 });
        finishShift(s);
      } else {
        s.stats.overtime++;
        const compressed = s.stats.overtime > 1;
        change(s, { hp: -24, score: 16, stress: 22, deadline: compressed ? -1 : 0 });
        s.remaining = 185;
        s.phase = "overtime";
        s.effects = [compressed ? "‘지난번에도 되던데?’ 새 마감이 하루 당겨졌다." : "김 과장이 비품 창고에서 컵라면을 하나 꺼냈다."];
      }
      break;
  }
  if (!s.ending && s.hp === 0) finish(s, "hospital");
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
    record.scoreGoal = PROJECT_GOAL.score;
    record.deliverySubmitted = s.deliverySubmitted;
    record.scope = s.scope;
  }
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
      if (!hasWorkContent(run)) return null;
      if (move[0] === "work" && move.length === 2) {
        if (!submitSpecialWork(run, move[1])) return null;
      } else if (move[0] === "mine") {
        const [, action, value] = move;
        const expectsValue = ["tick", "flag", "reveal"].includes(action);
        if (move.length !== (expectsValue ? 3 : 2)) return null;
        const result = playMinesAction(run, action, value);
        if (!result || (action === "tick" && result !== value)) return null;
      } else return null;
    } else if (move === "code-review") {
      if (!requestCodeReview(run)) return null;
    } else if (move === "code-delegate") {
      if (!delegateCodeWork(run)) return null;
    } else if (move === "solve" ? !submitSolution(run) : move === "code-retry" ? !failCodeSubmission(run) : !act(run, move)) return null;
  }
  return run.ending ? recordFor(run) : null;
}
