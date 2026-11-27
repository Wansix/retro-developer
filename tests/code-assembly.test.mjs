import assert from "node:assert/strict";
import test from "node:test";
import { assemblyCode, assemblyPlan, validAssemblyOrder } from "../src/code-assembly.js";
import { FUNDAMENTAL_DAYS } from "../src/code-fundamentals.js";
import { CODE_PROBLEMS } from "../src/code-problems.js";
import { MODE_RULESET, playMode } from "../src/play-mode.js";
import { assignedLanguage, LANGUAGES } from "../src/office-languages.js";
import { act, currentMission, newRun, recordPaste, recordTaskTime, replayProgress, submitSolution } from "../src/office.js";
import { normalizeCheckpoint } from "../src/run-checkpoint.js";
import { makeWork } from "../src/work-missions.js";

test("all assembly templates preserve language syntax and give every code fragment a separate ID", () => {
  const keys = ["story:opening", "story:deployment", ...[
    ...CODE_PROBLEMS, ...FUNDAMENTAL_DAYS.flat(2),
  ].map(({ id }) => "code:" + id)];
  for (const language of Object.keys(LANGUAGES)) {
    for (const key of keys) {
      const mission = makeWork(key, 417, language);
      const plan = assemblyPlan(mission, language, 417);
      const code = assemblyCode(plan, plan.solutionIds);
      assert.deepEqual(plan, assemblyPlan(mission, language, 417));
      assert.equal(new Set(plan.pieces.map(piece => piece.id)).size, plan.pieces.length);
      assert.ok(plan.pieces.length >= plan.solutionIds.length + 2, key + " " + language);
      if (mission.solution && !mission.fundamentals) assert.equal(code, mission.solution);
      if (mission.fundamentals) assert.equal(plan.solutionIds.length, 1);
      assert.equal(validAssemblyOrder(plan, [plan.solutionIds[0], plan.solutionIds[0]]), false);
      assert.equal(validAssemblyOrder(plan, ["unregistered-piece"]), false);
    }
  }
});

test("a replayed account checkpoint restores work mode, remaining time, and in-progress pieces", () => {
  const run = newRun(417, undefined, MODE_RULESET, "assembly");
  run.playerName = "테스트";
  for (const option of ["stack-none", "arrive", "promise-standard"]) assert.ok(act(run, option));
  assert.equal(run.language, assignedLanguage(run.seed, "none"));
  assert.ok(recordTaskTime(run, 9));
  assert.equal(recordPaste(run), 0);
  assert.equal(act(run, "real_coding"), false);
  const mission = currentMission(run);
  const draft = { id: mission.id, order: ["piece-0"] };
  const restored = normalizeCheckpoint({ state: run, assemblyDraft: draft });
  assert.deepEqual(restored.state, run);
  assert.deepEqual(restored.assemblyDraft, draft);
  assert.equal(playMode(restored.state), "assembly");
  assert.equal(normalizeCheckpoint({ state: { ...run, mode: "invalid" } }), null);
  assert.equal(submitSolution(restored.state), true);
  assert.equal(restored.state.stats.fastestWorkSeconds, 9);

  const oldRun = newRun(417, undefined, MODE_RULESET - 1);
  assert.equal(oldRun.mode, undefined);
  assert.equal(playMode(replayProgress(oldRun)), "real_coding");
});
