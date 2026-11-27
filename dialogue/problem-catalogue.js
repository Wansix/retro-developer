import { FUNDAMENTAL_DAYS } from "../src/code-fundamentals.js";
import { DIFFICULTIES, problemKeys } from "../src/code-problem-bank.js";
import { DEPLOYMENT_WORK, OPENING_WORK, SURVIVAL_WORK_SLOTS, survivalSlotCandidates, PROJECT_GOAL } from "../src/project-work.js";
import { calendarDayForWorkday, formatDate } from "../src/records-schema.js";
import { SURVIVAL } from "../src/survival.js";
import { makeWork } from "../src/work-missions.js";

export const PROBLEM_GROUPS = {
  beginner: DIFFICULTIES.beginner.label,
  intermediate: DIFFICULTIES.intermediate.label,
  advanced: DIFFICULTIES.advanced.label,
  other: "퀴즈·미니게임",
};

const poolNames = { fundamentals: "기초 문법", intermediate: "응용 문제", advanced: "구현·디버깅 문제", knowledge: "개발 퀴즈 또는 코드 리뷰",
  legacy: "데이터 검증 또는 레거시 분석", operations: "서버 복구·화면 비교·UI 위치 수정 중 하나" };
const fixedSlot = (day, key, label) => ({ day, label, keys: [key], fixed: true });
export const WORK_SCHEDULE = [
  fixedSlot(1, OPENING_WORK, "첫인사 출력 · 첫 출근 튜토리얼"),
  ...SURVIVAL_WORK_SLOTS.map(slot => {
    const keys = survivalSlotCandidates(slot);
    return { ...slot, keys, label: poolNames[slot.pool], fixed: keys.length === 1 };
  }),
  fixedSlot(SURVIVAL.deliveryShift, DEPLOYMENT_WORK, `최종 배포 검수 · 선행 업무 ${PROJECT_GOAL.work - 1}건과 추가 일감 정리 후`),
];

export const workdayLabel = day => `${day}일차 · ${formatDate(calendarDayForWorkday(day, 6))}`;

const keys = new Set([
  ...WORK_SCHEDULE.flatMap(slot => slot.keys),
  ...FUNDAMENTAL_DAYS.flat(2).map(({ id }) => "code:" + id),
  ...Object.keys(DIFFICULTIES).flatMap(problemKeys),
]);
export const PROBLEM_CATALOGUE = [...keys].map(key => {
  const work = makeWork(key, 417, "python");
  const slots = WORK_SCHEDULE.filter(slot => slot.keys.includes(key));
  const group = work.difficulty ?? (key === OPENING_WORK ? "beginner" : key === DEPLOYMENT_WORK ? "advanced" : "other");
  return { key, group, work, slots };
});
