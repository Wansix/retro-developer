export const TOTAL_DAYS = 30;
export const FIRST_RULESET = 1;
export const SCRUM_RULESET = 2;
export const DIRECT_ASSIGNMENT_RULESET = 3;
export const WORK_CONTENT_RULESET = 4;
export const SHORT_PROJECT_RULESET = 5;
export const PROBLEM_BANK_RULESET = 6;
export const CHAINED_WORK_RULESET = 7;
export const LANGUAGE_ASSIGNMENT_RULESET = 8;
export const FUNDAMENTALS_RULESET = 9;
export const PROJECT_WORKDAYS = 10;
export const RULESET = FUNDAMENTALS_RULESET;

export const calendarDayForWorkday = day => day + 2 * Math.floor((day - 1) / 5);
export const workdayForCalendarDay = day => day - 2 * Math.floor((day - 1) / 7);

export const SCRUM_METRICS = [
  ["scrums", "스크럼 참석", "회"],
  ["scrumMinutes", "스크럼·후속 회의", "분"],
  ["promisesKept", "보고 약속 이행", "회"],
  ["promisesMissed", "보고 약속 미이행", "회"],
  ["reportTrust", "보고 신뢰도", "/100"],
];

export const METRICS = [
  ["coding", "실제 코딩 시간", "분"],
  ["meetings", "전체 회의 시간", "분"],
  ...SCRUM_METRICS,
  ["overtime", "야근 횟수", "회"],
  ["onTime", "정시 퇴근 횟수", "회"],
  ["planning", "기획자와 싸운 시간", "분"],
  ["design", "디자이너와 싸운 시간", "분"],
  ["paste", "복붙 시도 횟수", "회"],
  ["calledSimple", "간단하다고 들은 업무 수", "건"],
  ["actuallySimple", "실제로 간단했던 업무 수", "건"],
  ["workMinutes", "업무 미션 작업 시간", "분"],
  ["codeReviews", "이 대리와 코딩 검토", "회"],
  ["codeDelegations", "이 대리가 대신 마친 코딩 업무", "건"],
  ["minesSeconds", "지뢰찾기 실제 플레이 시간", "초"],
  ["minesMinutes", "지뢰찾기에 쓴 업무 시간", "분"],
  ["minesWins", "지뢰찾기 성공", "회"],
  ["minesHidden", "발각 회피", "회"],
  ["minesCaught", "지뢰찾기 발각", "회"],
  ["completedDay", "프로젝트 완료 날짜", ""],
  ["hp", "최종 잔여 체력", ""],
  ["stress", "최종 스트레스", "/100"],
];

export const CATEGORIES = {
  fastest: { label: "최단 프로젝트 완료", key: "completedDay", order: "ASC", unit: "일차", clears: true },
  leastOvertime: { label: "최소 야근", key: "overtime", order: "ASC", unit: "회", clears: true },
  health: { label: "최고 잔여 체력", key: "hp", order: "DESC", unit: "", clears: true },
  onTime: { label: "최다 정시 퇴근", key: "onTime", order: "DESC", unit: "회" },
  meetings: { label: "최다 회의 시간", key: "meetings", order: "DESC", unit: "분" },
  paste: { label: "최다 복붙 적발", key: "paste", order: "DESC", unit: "회" },
};

export function formatDate(day) {
  const date = new Date(Date.UTC(2006, 2, 5 + day));
  return `${date.getUTCMonth() + 1}월 ${date.getUTCDate()}일 ${"일월화수목금토"[date.getUTCDay()]}`;
}

export function formatMinutes(minutes) {
  if (minutes < 60) return `${minutes}분`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}시간 ${remainder}분` : `${hours}시간`;
}
