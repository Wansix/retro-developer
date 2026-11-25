import { ARCHITECTURE, AUTOMATION, CODE_REVIEW, DEPARTMENTS, ENDINGS, EXTRA_TICKETS, LUNCH, OFFICE_EVENTS, TICKETS } from "./office-content.js";
import { MISSIONS } from "./missions.js";
import { TOTAL_DAYS } from "./records-schema.js";

export const PHASES = {
  arrive: ["09:00", "출근"],
  assign: ["09:30", "업무 배분"],
  morning: ["10:00", "오전 코딩"],
  lunch: ["12:00", "점심시간"],
  negotiate: ["13:00", "부서 협상"],
  afternoon: ["13:00", "오후 코딩"],
  report: ["17:30", "진행 보고"],
  leave: ["18:00", "퇴근"],
  overtime: ["18:00", "야근"],
};
export const RELATION_NAMES = { park: "박 선임", lee: "이 선임", ...Object.fromEntries(Object.entries(DEPARTMENTS).map(([id, d]) => [id, d.name])) };

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
export const currentMission = (s) => MISSIONS[s.progress];

function draw(s) {
  // A serializable RNG keeps reloads and server-side replay on the same sequence.
  s.rng = (Math.imul(s.rng, 1664525) + 1013904223) >>> 0;
  return s.rng / 2 ** 32;
}

export function newRun(seed = crypto.getRandomValues(new Uint32Array(1))[0], id = crypto.randomUUID()) {
  const run = {
    id, seed, rng: seed, moves: [], day: 1, deadline: TOTAL_DAYS, shift: 0, hp: 100, score: 0, scope: 0, progress: 0,
    phase: "arrive", ending: null, completedDay: null, nextMeeting: 0, effects: [],
    relations: Object.fromEntries(Object.keys(RELATION_NAMES).map((key) => [key, 0])),
    stats: { coding: 0, meetings: 0, overtime: 0, onTime: 0, planning: 0, design: 0, paste: 0, calledSimple: 0, actuallySimple: 0 },
    achievements: [],
    requestCount: {},
  };
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
  s.remaining = 180;
  s.solvedToday = false;
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
}

function change(s, effect) {
  s.hp = clamp(s.hp + (effect.hp ?? 0), 0, 100);
  s.score += effect.score ?? 0;
  s.scope = Math.max(0, s.scope + (effect.scope ?? 0));
  s.deadline = clamp(s.deadline + (effect.deadline ?? 0), s.day, TOTAL_DAYS);
  s.remaining = Math.max(0, s.remaining + (effect.minutes ?? 0) - (effect.meeting ?? 0));
  s.stats.meetings += effect.meeting ?? 0;
  if (effect.achievement && !s.achievements.includes(effect.achievement)) s.achievements.push(effect.achievement);
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
  s.effects = [text, ...s.assigned.map((t) => `${t.name} (${t.minutes}분) — ${t.reveal}`)];
  s.phase = "morning";
}

function advanceFromCoding(s) {
  s.phase = s.phase === "morning" ? "lunch" : "report";
}

export function codingCost(s) {
  return 45 + s.cost;
}

export function canSubmit(s) {
  return isCoding(s.phase) && !!currentMission(s) && !s.solvedToday && s.remaining >= codingCost(s);
}

function chargeCoding(s, minutes) {
  const spent = Math.min(minutes, s.remaining);
  s.remaining -= spent;
  s.stats.coding += spent;
}

export function submitSolution(s) {
  if (!canSubmit(s)) return false;
  s.moves.push("solve");
  chargeCoding(s, codingCost(s));
  s.cost = 0;
  s.solvedToday = true;
  s.progress++;
  change(s, { score: 14, hp: -3 });
  s.effects = ["기능 검수를 통과했다."];
  if (s.phase === "morning" && s.remaining >= 35) {
    change(s, { scope: 1 });
    s.stats.calledSimple++;
    s.effects.push("김 책임이 ‘벌써 끝났어? 이것도 간단해’라며 일감 1건을 추가했다.");
  }
  if (s.hp === 0) finish(s, "hospital");
  return true;
}

export function recordPaste(s, attempts = 1) {
  if (s.ending || !isCoding(s.phase) || !currentMission(s) || s.solvedToday) return 0;
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
  s.ending = id;
  s.completedDay = ENDINGS[id].cleared ? s.day : null;
}

function finishShift(s) {
  if (s.hp === 0) return finish(s, "hospital");
  if (!currentMission(s) && s.scope === 0) {
    if (s.stats.onTime >= 7 && s.stats.overtime <= 2 && s.hp >= 65) return finish(s, "balance");
    if (s.score >= 220 && s.stats.overtime >= 4) return finish(s, "promotion");
    if (Object.values(s.relations).filter((n) => n >= 4).length >= 4) return finish(s, "teamwork");
    return finish(s, "release");
  }
  const next = isFriday(s.day) ? s.day + 3 : s.day + 1;
  if (next > s.deadline || next > TOTAL_DAYS) return finish(s, "deadline");
  s.day = next;
  startDay(s);
}

function choice(id, label, detail = "", disabled = false) {
  return { id, label, detail, disabled };
}

function handleAssignment(s, id) {
  if (id.startsWith("ticket-")) return chooseTickets(s, [Number(id.slice(7))], {}, "예상 시간만 적힌 업무표에 이름을 적었다.");
  if (id === "volunteer") return chooseTickets(s, [s.available.at(-1)], { score: 20 }, "정 수석이 신입의 이름을 수첩에 적었다. 평가 +20.");
  if (id === "refuse") {
    const backed = s.relations.lee >= 2 || s.relations.park >= 2;
    return chooseTickets(s, [], { score: backed ? -1 : -6 }, backed ? "선임이 이미 맡은 일을 증언했다." : "김 책임이 기존 업무부터 끝내라고 했다. 평가 −6.");
  }
  if (id === "trade") {
    const ticket = s.parkPriority.find((index) => s.available.includes(index)) ?? s.available[0];
    return chooseTickets(s, [ticket], { park: -1, lee: 1, minutes: 35 }, "박 선임이 유리한 업무를 양보했다. 지난번에 도와준 얘기를 꺼냈다.");
  }
  s.waits++;
  change(s, { meeting: 20 });
  const taken = s.parkPriority.find((i) => s.available.includes(i)) ?? s.available[0];
  s.available = s.available.filter((i) => i !== taken);
  s.effects = [`박 선임이 ${s.tickets[taken].name}에 먼저 이름을 적었다.`];
  if (s.waits === 2) return chooseTickets(s, s.available.slice(-2), { score: -3 }, "회의가 끝나기 직전, 김 책임이 남은 어려운 두 건을 함께 넘겼다.");
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
    s.effects = [`요청을 받았다. 오후 시간 −${time}분 · 추가 일감 +${scope}건${key === "sales" ? " · 마감 −1일" : ""}.`];
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
  s.remaining = 270 - disruption;
  s.phase = "afternoon";
}

function handleBoss(s, id) {
  const support = Object.keys(DEPARTMENTS).filter((key) => s.relations[key] >= 4).length;
  const outcomes = {
    yes: [{ scope: Math.max(1, 5 - support), hp: -12, score: 16, sales: 1, design: 1, deadline: -1 }, "그날 회의록에는 ‘개발 가능’ 두 글자만 남았다. 납품일도 당겨졌다."],
    no: [{ scope: -1, hp: -4, score: support ? -3 : -12, sales: -2, qa: 1 }, "QA가 검수 시간을 확인해 줬다. 영업팀은 회의 끝나고 다시 보자고 했다."],
    trim: [{ scope: support ? -3 : 1, hp: -5, score: 5, planning: 1, qa: 1 }, support ? "평소 맞춰 일한 부서가 축소안에 서명했다." : "출시 범위를 좁혔다. 끝까지 남은 추가 요청은 한 건이다."],
    joke: [{ scope: 2, hp: -9, score: -16, sales: -3, lee: 1 }, "이 선임만 웃었다. 영업팀이 의자를 돌려 앉았다."],
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
  if (s.ending) return [];
  switch (s.phase) {
    case "arrive":
      if (s.shift === 9) return [
        choice("automate", "검수표를 자동화한다", "오전 업무 시간 +90분"),
        choice("arrive", "오늘은 수동으로 검수한다"),
      ];
      return [choice("arrive", "업무표 확인")];
    case "assign":
      return [
        ...s.available.map((i) => choice(`ticket-${i}`, s.tickets[i].name, `예상 ${s.tickets[i].estimate}`)),
        choice("wait", "동료가 고를 때까지 기다린다", s.waits ? "회의가 곧 끝난다 · 20분" : "선택을 본다 · 20분"),
        choice("volunteer", "가장 어려워 보이는 일에 자원한다", "인사평가 +20"),
        choice("refuse", "기존 프로젝트를 이유로 거절한다", "인사평가 하락 · 선임이 증언하면 완화"),
        choice("trade", "박 선임과 업무를 교환한다", "박 선임 관계 +2 이상 필요", s.relations.park < 2),
      ];
    case "morning":
    case "afternoon":
    case "overtime": {
      const hasTime = s.remaining >= 90;
      return [
        ...(s.phase === "morning" ? [] : [choice("cleanup", "추가 일감 1건을 정리한다", "업무 시간 90분", !s.scope || !hasTime)]),
        ...(s.cost > 0 && !s.solvedToday && currentMission(s) ? [choice("prepare", "업무의 사전 조사부터 한다", `배정 업무에 시간 ${Math.min(s.cost, s.remaining)}분 사용`, !s.remaining || canSubmit(s))] : []),
        choice("coffee", "커피 한 잔", "시간 25분 · 체력 +8", s.coffee || s.remaining < 25),
        choice("next", ({ morning: "점심시간으로", afternoon: "진행 상황 보고", overtime: "야근을 마치고 퇴근" })[s.phase]),
      ];
    }
    case "lunch":
      return [
        choice("rest", "혼자 먹고 잠깐 쉰다", "체력 +10"),
        choice("park", "박 선임과 밥을 먹는다", "체력 +5 · 박 선임 관계 +2"),
        choice("help", "이 선임과 먹고 밀린 일을 돕는다", "체력 +3 · 이 선임 관계 +2 · 추가 일감을 맡을 수 있음"),
        choice("kim", "김 책임 대신 전화를 받고 같이 먹는다", "체력 +4 · 인사평가 +8"),
      ];
    case "negotiate":
      return [
        choice("accept", "요청을 받아들인다", "관계 +2 · 일정 부담 증가"),
        choice("document", DEPARTMENTS[s.department].fallback, "회의 35분 · 관계 +2"),
        choice("push", "현재 일정으로는 어렵다고 설명한다", "회의 45분 · 관계 −1"),
        choice("ally", "부서 담당자와 함께 요청을 정리한다", "관계 +4 이상 필요 · 회의 15분", s.relations[s.department] < 4),
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
    case "leave":
      return [
        choice("leave", "정시 퇴근", "체력 +16 · 인사평가 −4"),
        choice("stay", "야근", "체력 −24 · 업무 시간 +185분 · 반복 시 다음 마감 단축"),
      ];
  }
}

export function act(s, id) {
  const selected = options(s).find((entry) => entry.id === id);
  if (!selected || selected.disabled) return false;
  s.moves.push(id);
  switch (s.phase) {
    case "arrive":
      if (s.shift !== 9 || id === "automate") change(s, s.event.effect);
      change(s, { meeting: 30 + s.nextMeeting });
      s.nextMeeting = 0;
      if (id === "automate") {
        s.stats.calledSimple++;
        s.effects = ["검수표를 자동으로 만들었다. 김 책임이 절약된 90분을 보고 ‘간단한 일’ 90분을 추가했다."];
      }
      s.phase = "assign";
      break;
    case "assign":
      handleAssignment(s, id);
      break;
    case "morning":
    case "afternoon":
    case "overtime":
      if (id === "next") {
        s.effects = [];
        if (s.phase === "overtime") finishShift(s);
        else advanceFromCoding(s);
      } else if (id === "cleanup") {
        chargeCoding(s, 90);
        change(s, { scope: -1, score: 4, hp: -2 });
        s.effects = ["밀린 일감 1건을 정리했다."];
      } else if (id === "prepare") {
        const spent = Math.min(s.cost, s.remaining);
        chargeCoding(s, spent);
        s.cost -= spent;
        s.effects = [`재현·자료 조사에 ${spent}분을 썼다. 이 업무에 ${codingCost(s)}분이 더 필요하다.`];
      } else {
        s.coffee = true;
        change(s, { minutes: -25, hp: 8 });
        s.effects = ["김 책임 몫도 함께 타 왔다."];
      }
      break;
    case "lunch":
      if (id === "help") {
        const traded = s.relations.lee >= 2;
        change(s, { hp: 3, lee: 2, scope: traded ? -1 : 1 });
        s.effects = [traded ? "이 선임이 이번엔 밀린 검수를 같이 끝냈다." : "이 선임이 부탁한 버그를 맡았다. 다음에 도움이 필요하면 먼저 말하라고 했다."];
      } else if (id === "park") {
        change(s, { hp: 5, park: 2 });
        s.effects = ["박 선임이 내일 회의에서 먼저 말을 걸라고 했다."];
      } else if (id === "kim") {
        change(s, { hp: 4, score: 8 });
        s.effects = ["김 책임  ‘위에는 된다고 해야 하고 아래에는 해달라고 해야 하네. 같이 먹어줘서 고맙다.’"];
      } else {
        change(s, { hp: 10 });
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
        change(s, { hp: 16, score: -4 });
        finishShift(s);
      } else {
        s.stats.overtime++;
        const compressed = s.stats.overtime > 1;
        change(s, { hp: -24, score: 16, deadline: compressed ? -1 : 0 });
        s.remaining = 185;
        s.phase = "overtime";
        s.effects = [compressed ? "‘지난번에도 되던데?’ 새 마감이 하루 당겨졌다." : "김 책임이 비품 창고에서 컵라면을 하나 꺼냈다."];
      }
      break;
  }
  if (!s.ending && s.hp === 0) finish(s, "hospital");
  return true;
}

export function recordFor(s) {
  return { id: s.id, ending: s.ending, day: s.day, progress: s.progress, ...s.stats, hp: s.hp, completedDay: s.completedDay, achievements: [...s.achievements] };
}

export function replayRun({ id, seed, moves }) {
  const run = newRun(seed, id);
  for (const move of moves) {
    if (run.ending) return null;
    if (typeof move === "number") {
      if (!Number.isInteger(move) || move < 1 || move > 1000000 - run.stats.paste || !recordPaste(run, move)) return null;
    } else if (move === "solve" ? !submitSolution(run) : !act(run, move)) return null;
  }
  return run.ending ? recordFor(run) : null;
}
