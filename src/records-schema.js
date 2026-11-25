export const TOTAL_DAYS = 30;
export const RULESET = 1;

export const METRICS = [
  ["coding", "실제 코딩 시간", "분"],
  ["meetings", "전체 회의 시간", "분"],
  ["overtime", "야근 횟수", "회"],
  ["onTime", "정시 퇴근 횟수", "회"],
  ["planning", "기획자와 싸운 시간", "분"],
  ["design", "디자이너와 싸운 시간", "분"],
  ["paste", "복붙 시도 횟수", "회"],
  ["calledSimple", "간단하다고 들은 업무 수", "건"],
  ["actuallySimple", "실제로 간단했던 업무 수", "건"],
  ["completedDay", "프로젝트 완료 날짜", ""],
  ["hp", "최종 잔여 체력", ""],
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
