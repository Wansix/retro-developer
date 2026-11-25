import assert from "node:assert/strict";
import test from "node:test";
import { newCompanionState, queueCompanionEvent, takeCompanionLine } from "../src/comdori-commentary.js";
import { COMDORI_LINES } from "../src/comdori-lines.js";

test("companion prioritizes important lines, drops stale remarks, and leaves time between utterances", () => {
  const state = newCompanionState();
  assert.ok(queueCompanionEvent(state, "coding", 0, 1));
  assert.equal(takeCompanionLine(state, 0).id, "coding:0");
  assert.equal(queueCompanionEvent(state, "coding", 6000, 1), false);
  assert.ok(queueCompanionEvent(state, "idle", 6000, 1));
  assert.ok(queueCompanionEvent(state, "mines", 6100, 1));
  assert.ok(queueCompanionEvent(state, "scolded", 6200, 1));
  assert.ok(queueCompanionEvent(state, "web-solved", 6300, 1));
  assert.ok(queueCompanionEvent(state, "meeting", 6400, 1));
  assert.equal(takeCompanionLine(state, 6999), null);
  assert.equal(takeCompanionLine(state, 7000).event, "web-solved");
  assert.equal(takeCompanionLine(state, 13999), null);
  assert.equal(takeCompanionLine(state, 14000).event, "scolded");
  assert.equal(takeCompanionLine(state, 45000), null);
  assert.equal(state.pending.length, 0);
});

test("line history is saved, random remarks vary, and foreshadowing stays out of the early game", () => {
  const state = newCompanionState();
  assert.equal(queueCompanionEvent(state, "foreshadow", 0, 6), false);
  assert.ok(queueCompanionEvent(state, "idle", 0, 1));
  const first = takeCompanionLine(state, 0, () => .99);
  assert.equal(first.text, COMDORI_LINES.idle.lines.at(-1));
  const resumed = JSON.parse(JSON.stringify(state));
  assert.ok(queueCompanionEvent(resumed, "idle", 61000, 1));
  assert.notEqual(takeCompanionLine(resumed, 61000, () => .99).text, first.text);
  assert.ok(queueCompanionEvent(resumed, "web-stack", 80000, 1));
  assert.match(takeCompanionLine(resumed, 80000).text, /2008년/);
  assert.equal(queueCompanionEvent(resumed, "web-stack", 150000, 7), false);
  assert.ok(queueCompanionEvent(resumed, "foreshadow", 150000, 7));
  assert.equal(takeCompanionLine(resumed, 150000).event, "foreshadow");
});
