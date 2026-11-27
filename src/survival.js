export const SURVIVAL_RULESET = 12;

export const SURVIVAL = {
  calendarDays: 14, workdays: 12, deadline: 13, deliveryShift: 12,
  recovery: { onTime: 20, sundayHp: 40, sundayStress: 30 },
  overtime: { weekday: 180, saturday: 120, clientExtension: 60, hpPerHour: 8 },
  meetingTrust: { low: 45, high: 78 },
  reputation: { low: 25, priority: 75, ace: 220 },
  searchMinutes: 3, scopeMinutes: 45, scopeMeeting: 20,
  burst: { minutes: 120, speed: 2, hpPerHour: 9 },
  timer: {
    secondsPerMinute: 2, relaxedMultiplier: 2, practiceRetry: 3,
    timeoutMinutes: 10, sessionCapSeconds: 7200,
    bounds: { beginner: [20, 180], intermediate: [60, 300], advanced: [90, 360], default: [30, 360] },
  },
};

export const hasSurvival = state => state.ruleset >= SURVIVAL_RULESET;
export const daysUntilDelivery = state => SURVIVAL.deadline - state.day;
export const lowHealthStress = (state, amount) => amount + (amount > 0 && state.hp <= 30 ? Math.ceil(amount / 2) : 0);
export const stressPenalty = stress => stress >= 90 ? 20 : stress >= 75 ? 10 : stress >= 60 ? 5 : 0;

const workMinutes = mission => mission.minutes ?? (mission.id === "hello-world" ? 30 : 65);

export const standardTaskMinutes = mission => Math.max(15, Math.round(workMinutes(mission) / 5) * 5);

export function timePromises(state, mission) {
  const estimate = standardTaskMinutes(mission);
  const buffered = state.stats.reportTrust >= SURVIVAL.meetingTrust.high || state.scope >= 2;
  return [
    { id: "promise-short", minutes: Math.min(45, Math.ceil(estimate * .6 / 5) * 5), reputation: 3 },
    { id: "promise-standard", minutes: estimate, reputation: 0 },
    { id: "promise-long", minutes: Math.max(estimate + 10, Math.ceil(estimate * 1.5 / 5) * 5), reputation: buffered ? 0 : -3 },
    { id: "promise-inspect", minutes: estimate + 5, reputation: 0, inspection: buffered ? 3 : 10 },
  ];
}

export function beginTask(state, mission, promise) {
  const config = SURVIVAL.timer;
  const [min, max] = config.bounds[mission.difficulty] ?? config.bounds.default;
  const limit = Math.max(min, Math.min(max, promise.minutes * config.secondsPerMinute));
  state.task = {
    id: mission.id, elapsed: 0, settled: 0, overhead: 0,
    limit: limit * (state.relaxed ? config.relaxedMultiplier : 1),
    burstBonus: 0,
  };
}

export function taskOverdue(task) {
  return task.elapsed > task.limit + task.burstBonus;
}

export function taskCost(state, mission) {
  const task = state.task;
  const active = !!state.burst?.remaining;
  const factor = active ? SURVIVAL.burst.speed : 1;
  const pending = task ? task.elapsed - task.settled : 0;
  const hurried = task ? task.elapsed <= (task.limit + task.burstBonus) / 2 : true;
  const floor = Math.ceil(workMinutes(mission) * (hurried ? .5 : .75));
  const extra = task && taskOverdue(task) ? SURVIVAL.timer.timeoutMinutes : 0;
  const stress = stressPenalty(state.stress);
  const already = task?.overhead ?? 0;
  const actual = Math.ceil(pending / SURVIVAL.timer.secondsPerMinute);
  const base = Math.max(floor, actual - already) + extra;
  if (!active) return base + stress;
  const focused = Math.min(state.burst.remaining, Math.ceil(base / factor));
  const tail = Math.max(0, base - focused * factor);
  return focused + tail + (tail ? stressPenalty(state.stress) : 0);
}

export const SHIFT_STORIES = {
  2: { title: "시계는 거짓말을 안 한다", text: "김 과장이 업무마다 예상 완료 시간을 적으라고 했다. 어제 받은 일도 업무표에 남아 있다.", effect: {} },
  3: { title: "박 대리가 먼저 본 업무표", text: "박 대리가 가장 빨리 끝나는 일을 먼저 챙겼다. 평판이나 관계가 좋으면 이번엔 순서를 바꿀 수 있다.", effect: {} },
  4: { title: "간단한 변경", text: "기획팀이 오전부터 구두로 기능을 추가했다. 이번엔 회의록에 남길 수 있다.", effect: { stress: 7 } },
  5: { title: "첫 전체 프로젝트 회의", text: "영업팀과 QA가 서로 다른 납품표를 들고 왔다.", effect: {} },
  6: { title: "반나절만", text: "김 과장이 정오에 퇴근하자고 했다. 탕수육 주문표는 벌써 돌아다닌다.", effect: {} },
  7: { title: "지난주의 회의록", text: "잠깐 미뤄 둔 결정들이 월요일 받은 편지함에 쌓여 있다.", effect: {} },
  8: { title: "이 대리의 빈 자리", text: "이 대리가 연속 야근 끝에 병가를 냈다. 검수 목록은 책상 위에 그대로다.", effect: {} },
  9: { title: "코드 동결, 아키텍처 변경", text: "정 부장이 코드를 동결했다. 그리고 아키텍처를 갈아엎으라고 했다.", effect: { meeting: 20, stress: 6 } },
  10: { title: "QA가 전원을 켰다", text: "QA팀이 배포 후보를 검수한다. 지난번에 생략한 테스트가 여기서 돌아온다.", effect: {} },
  11: { title: "회의를 줄이기 위한 회의", text: "김 과장이 모든 회의를 취소하고 마감 대책 회의를 소집했다. 사장님 격려는 안건 1번이다.", effect: { meeting: 20 } },
  12: { title: "최종 납품", text: "고객사에 넘길 배포본을 오늘 확인한다. 기획팀은 마지막 변경이라고 했다.", effect: {} },
};
