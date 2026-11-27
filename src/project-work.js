import { hasSurvival, SURVIVAL } from "./survival.js";
import { problemDeck, problemKeys } from "./code-problem-bank.js";
import { FUNDAMENTAL_DAYS } from "./code-fundamentals.js";
import { seedValue, seededShuffle } from "./seeded.js";

export const OPENING_WORK = "story:opening";
export const DEPLOYMENT_WORK = "story:deployment";
export const PROJECT_GOAL = { work: 16, score: 270, deploymentDay: 8 };

const WORK_POOLS = {
  knowledge: ["quiz", "review"],
  legacy: ["sudoku", "memory"],
  operations: ["lights", "qa", "design"],
};
const fundamentalsForDay = (day, index) => FUNDAMENTAL_DAYS[day - 1][index].map(problem => "code:" + problem.id);

export const SURVIVAL_WORK_SLOTS = [
  { day: 1, pool: "knowledge", index: 0, afterLunch: true },
  { day: 2, pool: "fundamentals", index: 0 },
  { day: 2, pool: "fundamentals", index: 1 },
  { day: 3, pool: "fundamentals", index: 0 },
  { day: 3, pool: "fundamentals", index: 1 },
  { day: 4, pool: "intermediate", index: 0 },
  { day: 4, pool: "legacy", index: 0 },
  { day: 5, pool: "legacy", index: 1 },
  { day: 6, pool: "knowledge", index: 1 },
  { day: 7, pool: "intermediate", index: 1 },
  { day: 8, pool: "operations", index: 0 },
  { day: 9, pool: "advanced", index: 0 },
  { day: 10, pool: "operations", index: 1 },
  { day: 11, pool: "advanced", index: 1 },
];

export function survivalSlotCandidates({ day, pool, index }) {
  if (pool === "fundamentals") return fundamentalsForDay(day, index);
  return WORK_POOLS[pool] ?? problemKeys(pool);
}

export function projectWorkDeck(seed, fundamentals = false, fullFirstDay = false, survival = false) {
  const [beginner, intermediate, advanced] = problemDeck(seed);
  const [first, second] = seededShuffle(WORK_POOLS.knowledge, seed, 746);
  const [third, fourth] = seededShuffle(WORK_POOLS.legacy, seed, 747);
  const [fifth, sixth, seventh] = seededShuffle(WORK_POOLS.operations, seed, 748);
  if (survival) {
    const selections = { knowledge: [first, second], legacy: [third, fourth], operations: [fifth, sixth, seventh], intermediate, advanced };
    return SURVIVAL_WORK_SLOTS.map(({ day, pool, index, afterLunch }) => {
      const choices = pool === "fundamentals" ? fundamentalsForDay(day, index) : selections[pool];
      const key = pool === "fundamentals" ? choices[seedValue(seed, 874 + (day - 1) * 3 + index) % choices.length] : choices[index];
      return { day, key, ...(afterLunch ? { afterLunch: true } : {}) };
    });
  }
  const early = fundamentals
    ? FUNDAMENTAL_DAYS.map((slots, day) => [day + 1, slots.map((pool, slot) =>
      "code:" + pool[seedValue(seed, 874 + day * 3 + slot) % pool.length].id)])
    : [[1, [beginner[0], first]], [2, [beginner[1], second]], [3, beginner.slice(2)]];
  if (fundamentals) (fullFirstDay ? early[0] : early[2])[1].push(first);
  const fourthDay = fundamentals ? [beginner[0], intermediate[0], third, beginner[1], intermediate[1]] :
    [intermediate[0], third, intermediate[1]];
  return [
    ...early,
    [4, fourthDay],
    [5, [fourth, intermediate[2], ...(fundamentals ? beginner.slice(2, 4) : [])]],
    [6, [...intermediate.slice(3), ...(fundamentals ? [second, beginner[4]] : [])]],
    [7, [advanced[0], fifth]],
    [8, [advanced[1], sixth]],
    [9, [advanced[2], seventh, advanced[3]]],
    [10, [advanced[4]]],
  ].reverse().flatMap(([day, jobs]) => jobs.map(key => ({
    day, key, ...(fullFirstDay && key === first ? { afterLunch: true } : {}),
  })));
}

export function nextProjectWork(state) {
  if (hasSurvival(state)) {
    if (state.progress >= PROJECT_GOAL.work - 1) {
      return !state.deliverySubmitted && state.shift === SURVIVAL.deliveryShift && !state.scope ? DEPLOYMENT_WORK : null;
    }
  } else if (!state.deliverySubmitted && state.shift >= PROJECT_GOAL.deploymentDay && state.progress >= PROJECT_GOAL.work - 1) {
    return DEPLOYMENT_WORK;
  }
  return state.workOrder.find(({ day, key, afterLunch }) => day <= state.shift && !state.finishedWork.includes(key) &&
    (!afterLunch || day < state.shift || ["afternoon", "report", "leave", "overtime"].includes(state.phase)))?.key ?? null;
}

export function projectReady(state, score = state.score) {
  return state.deliverySubmitted && state.progress >= PROJECT_GOAL.work && (hasSurvival(state) ? state.hp > 0 : score >= PROJECT_GOAL.score) && state.scope === 0;
}
