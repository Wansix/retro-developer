import { problemDeck } from "./code-problem-bank.js";
import { seededShuffle } from "./seeded.js";

export const OPENING_WORK = "story:opening";
export const DEPLOYMENT_WORK = "story:deployment";
export const PROJECT_GOAL = { work: 16, score: 270, deploymentDay: 8 };

export function projectWorkDeck(seed) {
  const [beginner, intermediate, advanced] = problemDeck(seed);
  const [first, second] = seededShuffle(["quiz", "review"], seed, 746);
  const [third, fourth] = seededShuffle(["sudoku", "memory"], seed, 747);
  const [fifth, sixth, seventh] = seededShuffle(["lights", "qa", "design"], seed, 748);
  return [
    [1, [beginner[0], first]],
    [2, [beginner[1], second]],
    [3, beginner.slice(2)],
    [4, [intermediate[0], third, intermediate[1]]],
    [5, [fourth, intermediate[2]]],
    [6, intermediate.slice(3)],
    [7, [advanced[0], fifth]],
    [8, [advanced[1], sixth]],
    [9, [advanced[2], seventh, advanced[3]]],
    [10, [advanced[4]]],
  ].reverse().flatMap(([day, jobs]) => jobs.map(key => ({ day, key })));
}

export function nextProjectWork(state) {
  if (!state.deliverySubmitted && state.shift >= PROJECT_GOAL.deploymentDay && state.progress >= PROJECT_GOAL.work - 1) {
    return DEPLOYMENT_WORK;
  }
  return state.workOrder.find(({ day, key }) => day <= state.shift && !state.finishedWork.includes(key))?.key ?? null;
}

export function projectReady(state, score = state.score) {
  return state.deliverySubmitted && state.progress >= PROJECT_GOAL.work && score >= PROJECT_GOAL.score && state.scope === 0;
}
