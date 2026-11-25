import assert from "node:assert/strict";
import test from "node:test";
import { ENDINGS, OFFICE_EVENTS } from "../src/office-content.js";
import { MISSIONS } from "../src/missions.js";
import { act, canSubmit, isFriday, newRun, options, recordFor, recordPaste, replayRun, submitSolution } from "../src/office.js";

function play(style, seed = 417) {
  const run = newRun(seed);
  for (let turn = 0; turn < 400 && !run.ending; turn++) {
    const choices = {
      arrive: run.shift === 9 ? "automate" : "arrive",
      assign: "refuse",
      lunch: { promotion: "kim", teamwork: "help", balance: "park" }[style] ?? "rest",
      negotiate: ["balance", "promotion", "teamwork"].includes(style)
        ? run.relations[run.department] >= 4 ? "ally" : "document"
        : "push",
      report: isFriday(run.day) ? { hospital: "yes", release: "no" }[style] ?? "trim"
        : style === "promotion" ? "reportFull" : "reportBrief",
      leave: "leave",
    };
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
  for (const ending of Object.keys(ENDINGS)) {
    const run = play(ending);
    assert.equal(run.ending, ending);
    assert.deepEqual(replayRun(run), recordFor(run));
    assert.equal(run.completedDay, ENDINGS[ending].cleared ? run.day : null);
    assert.ok(run.day <= 30);
  }
  assert.equal(play("balance").stats.overtime, 0);
  assert.equal(play("deadline").day, 30);
});

test("waiting twice exposes two jobs and relations unlock a trade on later days", () => {
  const run = newRun(2);
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
  const run = newRun(778);
  assert.equal(recordPaste(run), 0);
  assert.equal(replayRun({ ...run, moves: ["solve"] }), null);
  assert.equal(replayRun({ ...run, moves: ["arrive", "trade"] }), null);
  assert.equal(replayRun({ ...run, moves: ["arrive", 3] }), null);

  act(run, "arrive");
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
