import assert from "node:assert/strict";
import test from "node:test";
import { ENDINGS, OFFICE_EVENTS } from "../src/office-content.js";
import { MISSIONS } from "../src/missions.js";
import { act, canSubmit, codingCost, currentMission, isFriday, newRun, options, recordFor, recordPaste, replayRun, submitSolution } from "../src/office.js";
import { DIRECT_ASSIGNMENT_RULESET, FIRST_RULESET, SCRUM_RULESET } from "../src/records-schema.js";

function play(style, seed = 417, ruleset = SCRUM_RULESET) {
  const run = newRun(seed, undefined, ruleset);
  for (let turn = 0; turn < 400 && !run.ending; turn++) {
    const choices = {
      arrive: run.shift === 9 ? "automate" : "arrive",
      scrum: run.scrum?.event ? "scrumHonest" : "scrumQuick",
      assign: "refuse",
      lunch: { promotion: "kim", teamwork: "help", balance: "park" }[style] ?? "rest",
      negotiate: ["balance", "promotion", "teamwork"].includes(style)
        ? run.relations[run.department] >= 4 ? "ally" : "document"
        : "push",
      report: isFriday(run.day) ? { hospital: "yes", release: "no" }[style] ?? "trim"
        : style === "promotion" ? "reportFull" : "reportBrief",
      leave: "leave",
    };
    if (ruleset === DIRECT_ASSIGNMENT_RULESET) assert.ok(options(run).length <= 4);
    if ((style === "promotion" && run.shift % 2 === 0 && run.shift <= 8) ||
      (["teamwork", "release"].includes(style) && run.shift % 3 === 0 && run.shift <= 9) ||
      style === "hospital") choices.leave = "stay";

    if (!["hospital", "deadline"].includes(style) && canSubmit(run)) {
      submitSolution(run);
    } else {
      const cleanup = options(run).find((choice) => choice.id === "cleanup" && !choice.disabled);
      const move = choices[run.phase] ?? (cleanup && style !== "deadline" ? "cleanup" : "next");
      assert.ok(act(run, move), `${run.day} ${run.phase} ${move}`);
    }
  }
  return run;
}

test("all six endings are reachable and reproduce the same saved metrics on replay", () => {
  assert.equal(MISSIONS.length, 12);
  assert.ok(OFFICE_EVENTS.length >= 30 && OFFICE_EVENTS.length <= 40);
  for (const ending of ["balance", "promotion", "teamwork", "release", "hospital", "deadline"]) {
    const run = play(ending);
    assert.equal(run.ending, ending);
    assert.deepEqual(replayRun(run), recordFor(run));
    assert.equal(run.completedDay, ENDINGS[ending].cleared ? run.day : null);
    assert.ok(run.day <= 30);
  }
  assert.equal(play("balance").stats.overtime, 0);
  assert.equal(play("deadline").day, 30);
  assert.ok(play("deadline").achievements.includes("스크럼 마스터"));
  const legacy = play("balance", 417, FIRST_RULESET);
  assert.equal(legacy.ending, "balance");
  assert.equal(legacy.stats.scrums, undefined);
  assert.deepEqual(replayRun(legacy), recordFor(legacy));
});

test("waiting twice exposes two jobs and relations unlock a trade on later days", () => {
  const run = newRun(2, undefined, FIRST_RULESET);
  act(run, "arrive");
  assert.equal(act(run, "trade"), false);
  assert.equal(run.available.length, 5);
  act(run, "wait");
  assert.equal(run.phase, "assign");
  assert.equal(run.available.length, 4);
  act(run, "wait");
  assert.equal(run.phase, "morning");
  assert.equal(run.assigned.length, 2);
  assert.equal(canSubmit(run), false);
  assert.ok(act(run, "prepare"));
  act(run, "next");
  act(run, "park");
  act(run, "document");
  act(run, "next");
  act(run, "reportBrief");
  act(run, "leave");
  act(run, "arrive");
  assert.ok(act(run, "trade"));
  assert.equal(run.assigned.length, 1);
});

test("replay rejects incomplete games and impossible actions and reproduces paste streaks", () => {
  const run = newRun(778, undefined, SCRUM_RULESET);
  assert.equal(recordPaste(run), 0);
  assert.equal(replayRun({ ...run, moves: ["solve"] }), null);
  assert.equal(replayRun({ ...run, moves: ["arrive", "trade"] }), null);
  assert.equal(replayRun({ ...run, moves: ["arrive", 3] }), null);

  act(run, "arrive");
  act(run, "scrumHonest");
  act(run, "refuse");
  assert.equal(recordPaste(run), 1);
  assert.equal(recordPaste(run), 2);
  assert.equal(recordPaste(run), 3);
  assert.ok(run.achievements.includes("몸은 2006년, 정신은 2026년"));
  assert.equal(run.moves.at(-1), 3);
  assert.ok(submitSolution(run));
  assert.equal(submitSolution(run), false);
  assert.equal(recordPaste(run), 0);
  assert.equal(replayRun(run), null);
});

function step(run, moves) {
  for (const move of moves) assert.ok(act(run, move), `${run.day} ${run.phase} ${move}`);
}

test("the report and the separate assignment consume the actual morning budget", () => {
  const honest = newRun(417, undefined, SCRUM_RULESET);
  const blame = newRun(417, undefined, SCRUM_RULESET);
  step(honest, ["arrive"]);
  assert.equal(honest.phase, "scrum");
  assert.equal(options(honest).length, 4);
  step(honest, ["scrumHonest"]);
  step(blame, ["arrive"]);
  const before = blame.stats.meetings;
  step(blame, ["scrumRequirements"]);
  assert.equal(blame.phase, "assign");
  assert.equal(blame.stats.scrumMinutes - honest.stats.scrumMinutes, 40);
  assert.equal(blame.stats.meetings - before - blame.stats.scrumMinutes, 15);
  assert.equal(honest.remaining - blame.remaining, 40);
  assert.ok(!act(blame, "scrumRequirements"));
  assert.equal(blame.stats.scrums, 1);
});

test("an actual morning delivery fulfills a promise; an afternoon delivery still misses it", () => {
  for (const morningDelivery of [true, false]) {
    const run = newRun(417, undefined, SCRUM_RULESET);
    step(run, ["arrive", "scrumPromise", "refuse"]);
    if (morningDelivery) assert.ok(submitSolution(run));
    step(run, ["next", "park", "document"]);
    if (!morningDelivery) assert.ok(submitSolution(run));
    step(run, ["next", "reportBrief", "leave", "arrive"]);
    const { yesterday, previousPromise, event } = run.scrum;
    assert.equal(yesterday.mission, MISSIONS[0].title);
    assert.equal(yesterday.completed, true);
    assert.equal(yesterday.coding, 45);
    assert.equal(previousPromise.result, morningDelivery ? "이행" : "미이행");
    assert.equal(run.stats.promisesKept, morningDelivery ? 1 : 0);
    assert.equal(run.stats.promisesMissed, morningDelivery ? 0 : 1);
    assert.equal(run.stats.reportTrust, morningDelivery ? 75 : 61);
    assert.deepEqual(JSON.parse(JSON.stringify(run)).scrum.history, run.scrum.history);
    if (morningDelivery) {
      assert.equal(event, null);
      assert.deepEqual(options(run).map(({ id }) => id), ["scrumQuick"]);
      step(run, ["scrumQuick"]);
      assert.equal(run.phase, "morning");
      assert.equal(run.stats.scrumMinutes, 45);
    } else {
      assert.equal(event.id, "caught");
      step(run, ["scrumPromise"]);
      assert.equal(run.stats.reportTrust, 56);
    }
  }
});

test("the tutorial teaches one mission before the first scrum and later tasks are assigned directly", () => {
  const run = newRun(417, undefined, DIRECT_ASSIGNMENT_RULESET);
  assert.deepEqual(options(run).map(({ id }) => id), ["arrive"]);
  step(run, ["arrive"]);
  assert.equal(run.phase, "morning");
  assert.equal(run.stats.scrums, 0);
  assert.equal(currentMission(run), MISSIONS[0]);
  assert.ok(canSubmit(run));
  step(run, ["tutorialHelp"]);
  assert.equal(run.hint, true);
  assert.equal(act(run, "tutorialHelp"), false);
  assert.ok(submitSolution(run));
  assert.equal(run.scope, 0);
  step(run, ["next"]);
  assert.equal(run.phase, "leave");
  step(run, ["leave", "arrive"]);
  assert.equal(run.scrum.yesterday.mission, MISSIONS[0].title);
  assert.equal(run.scrum.yesterday.completed, true);
  assert.deepEqual(options(run).map(({ id }) => id), ["scrumQuick"]);
  step(run, ["scrumQuick"]);
  assert.equal(run.phase, "morning");
  assert.equal(currentMission(run), MISSIONS[1]);
  assert.equal(codingCost(run), 45);
  for (const ending of ["balance", "deadline"]) {
    const completed = play(ending, 417, DIRECT_ASSIGNMENT_RULESET);
    assert.equal(completed.ending, ending);
    assert.deepEqual(replayRun(completed), recordFor(completed));
  }
});
