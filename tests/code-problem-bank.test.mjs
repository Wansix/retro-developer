import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CODE_PROBLEMS } from "../src/code-problems.js";
import { materializeProblem, problemOrder } from "../src/code-problem-bank.js";
import { makeWork, problemBankWorkOrder } from "../src/work-missions.js";

test("banks draw all tiers without duplicates, preserve the story slots, and vary seeded examples", () => {
  assert.equal(CODE_PROBLEMS.length, 15);
  const seen = new Set();
  const plans = new Set();
  const variants = new Map();
  for (let seed = 0; seed < 128; seed++) {
    const route = problemBankWorkOrder(seed);
    assert.deepEqual(route, problemBankWorkOrder(seed));
    assert.equal(new Set(route).size, 9);
    assert.equal(makeWork(route[0], seed).id, "hello-world");
    assert.equal(makeWork(route.at(-1), seed).id, "deployment");
    const bank = problemOrder(seed).map(id => materializeProblem(id, seed));
    assert.deepEqual(bank.map(mission => mission.difficulty), ["beginner", "intermediate", "advanced"]);
    plans.add(route.join("|"));
    for (const mission of bank) {
      seen.add(mission.id);
      if (!variants.has(mission.id)) variants.set(mission.id, new Set());
      variants.get(mission.id).add(JSON.stringify(mission.check.public));
      assert.deepEqual(mission, materializeProblem(mission.id, seed));
      assert.ok(mission.tags.length && mission.minutes > 0 && mission.reward.score > 0);
    }
  }
  assert.equal(seen.size, CODE_PROBLEMS.length);
  assert.ok(plans.size > 40);
  assert.ok([...variants.values()].every(examples => examples.size > 1));
});

test("the sample solutions pass all public and hidden cases for 24 variants per template", () => {
  const grader = readFileSync(new URL("../src/pyworker.js", import.meta.url), "utf8").match(/const BANK_CHECK = `([\s\S]*?)`;/)?.[1];
  assert.ok(grader);
  const work = CODE_PROBLEMS.flatMap(({ id }) => Array.from({ length: 24 }, (_, seed) => {
    const { check, solution } = materializeProblem("code:" + id, seed);
    return { id, seed, check, solution };
  }));
  const script = `
import json
import sys
data = json.load(sys.stdin)
exec(data["grader"])
for item in data["work"]:
    check = item["check"]
    for case in check["public"] + check["hidden"]:
        module = {}
        exec(item["solution"], module)
        assert check_case(module, check["name"], json.dumps(case["args"]), json.dumps(case["expected"]), check["preserveArgs"]), (item["id"], item["seed"], case)
`;
  const result = spawnSync("python3", ["-c", script], { input: JSON.stringify({ grader, work }), encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
});
