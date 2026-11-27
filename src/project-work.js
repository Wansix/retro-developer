import { hasSurvival, SURVIVAL } from "./survival.js";
import { problemDeck } from "./code-problem-bank.js";
import { FUNDAMENTAL_DAYS } from "./code-fundamentals.js";
import { seedValue, seededShuffle } from "./seeded.js";

export const OPENING_WORK = "story:opening";
export const DEPLOYMENT_WORK = "story:deployment";
export const PROJECT_GOAL = { work: 16, score: 270, deploymentDay: 8 };

export function projectWorkDeck(seed, fundamentals = false, fullFirstDay = false, survival = false) {
  const [beginner, intermediate, advanced] = problemDeck(seed);
  const [first, second] = seededShuffle(["quiz", "review"], seed, 746);
  const [third, fourth] = seededShuffle(["sudoku", "memory"], seed, 747);
  const [fifth, sixth, seventh] = seededShuffle(["lights", "qa", "design"], seed, 748);
  if (survival) {
    const fundamentalsAt = (day, slot) => "code:" + FUNDAMENTAL_DAYS[day][slot][
      seedValue(seed, 874 + day * 3 + slot) % FUNDAMENTAL_DAYS[day][slot].length
    ].id;
    return [
      { day: 1, key: first, afterLunch: true },
      { day: 2, key: fundamentalsAt(1, 0) },
      { day: 2, key: fundamentalsAt(1, 1) },
      { day: 3, key: fundamentalsAt(2, 0) },
      { day: 3, key: fundamentalsAt(2, 1) },
      { day: 4, key: intermediate[0] },
      { day: 4, key: third },
      { day: 5, key: fourth },
      { day: 6, key: second },
      { day: 7, key: intermediate[1] },
      { day: 8, key: fifth },
      { day: 9, key: advanced[0] },
      { day: 10, key: sixth },
      { day: 11, key: advanced[1] },
    ];
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
