import { CHAINED_WORK_RULESET, DIRECT_ASSIGNMENT_RULESET, WORK_CONTENT_RULESET, formatMinutes } from "./records-schema.js";

const EVENTS = [
  { id: "short", text: "김 과장 ‘오늘은 짧게 합시다.’ 박 대리가 실적표 세 장을 꺼내고, 이 대리는 막힌 일을 솔직히 말하다가 검수를 하나 더 맡았다.", minutes: 15 },
  { id: "question", text: "김 과장 ‘그게 왜 막혔는데? 칠판에 한번 그려봐.’", minutes: 40 },
  { id: "extra", text: "어제 막힌 일은 스크럼 뒤에 다시 이야기하자는 말에, 총무가 별도 회의실까지 잡았다.", minutes: 25 },
  { id: "director", text: "예고 없이 참석한 정 부장 ‘고객이 먼저 볼 화면이 바뀌었어. 업무표부터 다시 보자.’", minutes: 20 },
];

const CAUGHT = {
  id: "caught",
  text: "박 대리가 어제 메일을 열었다. 김 과장 ‘어제도 거의 다 끝났다고 했지? 어디까지 된 건지 오늘은 같이 보자.’",
  minutes: 15,
};

export const SCRUM_REPORTS = [
  { id: "scrumHonest", label: "실제 진척과 막힌 점을 그대로 말한다", detail: "보고 신뢰도 상승" },
  { id: "scrumPromise", label: "거의 다 끝났다고 보고한다", detail: "오전 배포 약속 · 다음 출근에 검증" },
  { id: "scrumRequirements", label: "요구사항 변경 때문에 늦었다고 말한다", detail: "기획팀 반론 · 추가 회의 40분" },
  { id: "scrumJargon", label: "기술 용어를 섞어서 설명한다", detail: "추가 질문을 피할 수 있음 · 반복 시 신뢰도 위험" },
];

export function initScrum(s) {
  Object.assign(s.stats, { scrums: 0, scrumMinutes: 0, promisesKept: 0, promisesMissed: 0, reportTrust: 70 });
  s.scrum = { yesterday: null, history: [], jargonUses: 0 };
}

function trust(s, points) {
  s.stats.reportTrust = Math.max(0, Math.min(100, s.stats.reportTrust + points));
}

function resolvePromise(s) {
  const previous = s.scrum.history.at(-1);
  if (!previous?.promise || previous.promise.result) return null;
  const kept = previous.promise.morningProgress >= previous.promise.target;
  previous.promise.result = kept ? "이행" : "미이행";
  if (kept) s.stats.promisesKept++;
  else s.stats.promisesMissed++;
  trust(s, kept ? 5 : -9);
  return previous.promise;
}

function scrumEvent(s) {
  if (s.scrum.previousPromise?.result === "미이행") return CAUGHT;
  if (s.ruleset >= DIRECT_ASSIGNMENT_RULESET && s.shift <= 2) return null;
  if (s.shift === 1) return EVENTS[0];
  // Keep the event rotation independent of the existing office and ticket draws.
  if ((s.shift + (s.seed >>> 16)) % 5 > 1) return null;
  return EVENTS[(Math.floor(s.shift / 2) + (s.seed >>> 8)) % EVENTS.length];
}

export function beginScrumDay(s, missionName) {
  s.scrum.previousPromise = resolvePromise(s);
  s.scrum.event = scrumEvent(s);
  s.scrum.assignment = null;
  s.scrum.today = { mission: missionName, codingAtStart: s.stats.coding, planning: 0, research: 0, bugs: 0 };
  if (s.ruleset >= WORK_CONTENT_RULESET) Object.assign(s.scrum.today, { workAttempts: 0, workMinutes: 0, workType: null });
}

export function finishScrumDay(s) {
  s.scrum.yesterday = {
    mission: s.scrum.today.mission,
    completed: s.solvedToday,
    coding: s.stats.coding - s.scrum.today.codingAtStart,
    planning: s.scrum.today.planning,
    research: s.scrum.today.research,
    bugs: s.scrum.today.bugs,
  };
  if (s.ruleset >= WORK_CONTENT_RULESET) {
    const { workAttempts, workMinutes, workType } = s.scrum.today;
    Object.assign(s.scrum.yesterday, { workAttempts, workMinutes, workType });
    if (s.scrum.today.workDelegated) s.scrum.yesterday.workDelegated = true;
  }
  if (s.ruleset >= CHAINED_WORK_RULESET) {
    s.scrum.yesterday.workCount = s.workDoneToday;
    s.scrum.yesterday.completed = s.workDoneToday > 0;
  }
}

export function markMorningDelivery(s) {
  const report = s.scrum.history.at(-1);
  if (report?.day === s.day && report.promise) report.promise.morningProgress = s.progress;
}

export function handleScrum(s, id, missionName) {
  const event = s.scrum.event;
  const yesterday = s.scrum.yesterday;
  const effect = {};
  const report = { day: s.day, kind: id, minutes: 15 + (event?.minutes ?? 0) };
  const effects = [];
  if (event) effects.push(event.text);
  switch (id) {
    case "scrumQuick":
      trust(s, 1);
      effects.push("이 대리처럼 완료한 일과 막힌 점을 짧게 보고했다.");
      break;
    case "scrumHonest":
      trust(s, 3);
      if (yesterday && !yesterday.completed) effect.score = -2;
      effects.push("김 과장이 진행표에 완료된 일과 막힌 일을 나누어 기록했다.");
      break;
    case "scrumPromise":
      if (missionName) report.promise = { day: s.day, mission: missionName, target: s.progress + 1, morningProgress: s.progress };
      effect.score = 7;
      if (s.scrum.previousPromise?.result === "미이행") trust(s, -5);
      effects.push("김 과장 ‘거의 다 됐으면 점심 전 배포로 적어둘게.’ 약속은 다음 출근에 확인한다.");
      break;
    case "scrumRequirements":
      report.minutes += 40;
      s.stats.planning += 40;
      s.scrum.today.planning += 40;
      effect.planning = -1;
      effects.push("기획팀 ‘그건 변경이 아니라 원래 의도였어요.’ 요구사항 확인 회의가 40분 추가됐다.");
      break;
    case "scrumJargon":
      s.scrum.jargonUses++;
      if (s.scrum.jargonUses > 1) {
        trust(s, -5);
        report.minutes += 10;
        effects.push("김 과장 ‘그 말 지난번에도 들었어.’ 다시 설명하느라 10분이 더 걸렸다.");
      } else {
        report.minutes -= Math.min(event?.minutes ?? 0, 10);
        effects.push("‘AJAX 응답과 IE6 캐시가 엇갈립니다.’ 김 과장이 고개를 끄덕였다. 추가 질문이 짧아졌다.");
      }
      break;
  }
  s.scrum.history.push(report);
  s.stats.scrums++;
  s.stats.scrumMinutes += report.minutes;
  return { effect: { ...effect, meeting: report.minutes }, effects: [`스크럼과 후속 회의 ${formatMinutes(report.minutes)} · 보고 신뢰도 ${s.stats.reportTrust}/100`, ...effects] };
}

export function finishScrumRun(s, calendarLimitReached) {
  resolvePromise(s);
  const scheduledScrums = s.shift - (s.ruleset >= DIRECT_ASSIGNMENT_RULESET ? 1 : 0);
  if (calendarLimitReached && s.stats.scrums === scheduledScrums) {
    s.achievements.push("스크럼 마스터");
  }
}
