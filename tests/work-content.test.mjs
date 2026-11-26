import assert from "node:assert/strict";
import test from "node:test";
import { DEBUG_PASS_MOVE, act, canSubmit, codingCost, currentMission, delegateCodeWork, failCodeSubmission, missionCount, missionNotice, newRun, options, passWorkForDebug, playMinesAction, projectDay, recordFor, replayRun, requestCodeReview, submitSolution, submitSpecialWork } from "../src/office.js";
import { MINE_BREAK_COST, MINE_WARNING_SECONDS, mineNeighbors } from "../src/mines.js";
import { gradeWork, makeWork, WORK_TYPES, workOrder } from "../src/work-missions.js";
import { formatDate, LANGUAGE_ASSIGNMENT_RULESET, PROBLEM_BANK_RULESET, SHORT_PROJECT_RULESET, WORK_CONTENT_RULESET } from "../src/records-schema.js";
import { PROJECT_GOAL, projectReady } from "../src/project-work.js";
import { LANGUAGES, assignedLanguage } from "../src/office-languages.js";

function sudokuSolutions(work) {
  const result = [];
  const values = [...work.clues];
  function fill(index) {
    if (index === values.length) {
      if (gradeWork(work, values)) result.push([...values]);
      return;
    }
    if (work.clues[index]) return fill(index + 1);
    const row = Math.floor(index / 4);
    const col = index % 4;
    const box = 8 * (row >> 1) + 2 * (col >> 1);
    const adjacent = new Set([
      ...values.slice(row * 4, row * 4 + 4),
      values[col], values[col + 4], values[col + 8], values[col + 12],
      values[box], values[box + 1], values[box + 4], values[box + 5],
    ]);
    for (const digit of [1, 2, 3, 4]) {
      if (adjacent.has(digit)) continue;
      values[index] = digit;
      fill(index + 1);
    }
    values[index] = 0;
  }
  fill(0);
  return result;
}

function solution(work) {
  switch (work.type) {
    case "quiz":
    case "review": return work.correct;
    case "sudoku": return sudokuSolutions(work)[0];
    case "lights": return Array.from({ length: 512 }, (_, n) => n).find(n => gradeWork(work, n));
    case "memory": return [...new Set(work.deck)].flatMap(label => work.deck.flatMap((value, index) => value === label ? [index] : []));
    case "qa": return work.differences;
    case "design": return work.target;
  }
}

test("each route has every puzzle type and generated puzzles have valid solutions", () => {
  const questions = new Set();
  const coding = new Set();
  const quizAnswers = {
    "HTTP 상태 코드": "404 Not Found", "네트워크 주소록": "DNS", "상품 테이블 조회": "SELECT",
    "고객 문의 순번": "큐", "할인율 자료형": "부동소수점 float",
  };
  for (let seed = 1; seed <= 80; seed++) {
    const order = workOrder(seed);
    assert.equal(order.length, 12);
    assert.equal(new Set(order).size, 12);
    const work = order.map(key => makeWork(key, seed));
    assert.deepEqual(new Set(work.map(item => item.type)), new Set(Object.keys(WORK_TYPES)));
    for (const item of work) {
      if (item.type === "code") {
        coding.add(item.id);
        continue;
      }
      if (item.type === "quiz") {
        questions.add(item.title);
        assert.equal(item.choices[item.correct], quizAnswers[item.title]);
        assert.ok(item.hint && item.explanation);
      }
      if (item.type === "lights") assert.notEqual(item.mask, 0);
      if (item.type === "sudoku") assert.equal(sudokuSolutions(item).length, 1);
      const answer = solution(item);
      assert.notEqual(answer, undefined);
      assert.equal(gradeWork(item, answer), true, item.type);
    }
  }
  assert.equal(questions.size, 5);
  assert.equal(coding.size, 12);
});

function step(run, ...moves) {
  for (const move of moves) assert.ok(act(run, move), `${run.day}일차 ${run.phase}: ${move}`);
}

function advance(run, solve) {
  for (let i = 0; i < 350 && !run.ending; i++) {
    if (solve && canSubmit(run)) {
      const work = currentMission(run);
      if (work.type === "code") assert.ok(submitSolution(run));
      else assert.equal(submitSpecialWork(run, solution(work)).passed, true, work.type);
      continue;
    }
    const available = options(run).filter(choice => !choice.disabled);
    assert.ok(available.length && available.length <= 4);
    const move = ["receiveWork", "nextWork", "arrive", "scrumQuick", "scrumHonest", "next", "rest", "ally", "document", "reportFull", "no", "leave"]
      .find(id => available.some(choice => choice.id === id));
    if (solve && run.scope && available.some(choice => choice.id === "cleanup")) step(run, "cleanup");
    else step(run, move ?? available[0].id);
  }
  assert.ok(run.ending);
}

test("a mixed run applies failures, advances projects, feeds the scrum, and replays the record", () => {
  const run = newRun(417, undefined, WORK_CONTENT_RULESET);
  step(run, "arrive");
  assert.equal(failCodeSubmission(run), 5);
  assert.ok(submitSolution(run));
  step(run, "next", "leave", "arrive", "scrumQuick");
  assert.equal(run.phase, "assign");
  assert.deepEqual(options(run).map(({ id }) => id), ["receiveWork"]);
  assert.deepEqual(missionNotice(run), { title: "상점 관리자 매뉴얼 확인", estimate: "45분" });
  assert.equal(submitSpecialWork(run, 0), null);
  step(run, "receiveWork");
  const quiz = currentMission(run);
  const remaining = run.remaining;
  assert.equal(submitSolution(run), false);
  assert.deepEqual(submitSpecialWork(run, (quiz.correct + 1) % 3), { passed: false, minutes: 5 });
  assert.equal(run.remaining, remaining - 5);
  assert.equal(run.progress, 1);
  assert.equal(submitSpecialWork(run, quiz.correct).passed, true);
  assert.equal(run.scrum.today.workType, "quiz");
  assert.equal(run.scrum.today.workAttempts, 2);
  assert.equal(run.scrum.today.workMinutes, 50);
  step(run, "next", "rest", "document", "cleanup", "next", "reportBrief", "leave");
  assert.equal(run.scrum.yesterday.completed, true);
  assert.equal(run.scrum.yesterday.workType, "quiz");
  assert.equal(run.scrum.yesterday.workAttempts, 2);
  advance(run, true);
  assert.equal(run.progress, 12);
  assert.ok(run.completedDay && run.completedDay <= 30);
  assert.deepEqual(run.stats.workResults.quiz, { attempts: 2, success: 1 });
  assert.deepEqual(replayRun(run), recordFor(run));
});

test("the visit gives a response window, preserves the board, and changes outcomes when hiding or getting caught", () => {
  const run = newRun(1039, undefined, WORK_CONTENT_RULESET);
  step(run, "arrive");
  assert.ok(playMinesAction(run, "open"));
  assert.equal(run.remaining, 180 - MINE_BREAK_COST);
  assert.equal(run.stress, 18 - MINE_BREAK_COST);
  assert.equal(act(run, "next"), false);
  assert.ok(playMinesAction(run, "reveal", 12));
  const board = run.leisure.board;
  assert.equal(board.mines.length, 4);
  assert.ok(board.mines.every(cell => ![12, ...mineNeighbors(12)].includes(cell)));
  assert.ok(playMinesAction(run, "hide"));
  assert.equal(run.stats.minesHidden, 0);
  assert.ok(playMinesAction(run, "open"));
  assert.deepEqual(run.leisure.board, board);
  for (let i = 0; i < 3; i++) {
    assert.ok(playMinesAction(run, "tick", run.leisure.untilAlert));
    assert.equal(run.leisure.warning, MINE_WARNING_SECONDS);
    assert.equal(run.stats.minesCaught, 0);
    assert.ok(playMinesAction(run, "hide"));
    assert.equal(playMinesAction(run, "open"), false);
    assert.ok(playMinesAction(run, "tick", run.leisure.cooldown));
    assert.ok(playMinesAction(run, "open"));
  }
  assert.ok(run.achievements.includes("완벽한 위장"));
  for (let i = 1; i <= 3; i++) {
    assert.ok(playMinesAction(run, "tick", run.leisure.untilAlert));
    const trust = run.stats.reportTrust;
    assert.ok(playMinesAction(run, "tick", MINE_WARNING_SECONDS - 1));
    assert.equal(run.stats.minesCaught, i - 1);
    assert.ok(playMinesAction(run, "tick", 1));
    assert.equal(run.stats.minesCaught, i);
    assert.ok(run.stats.reportTrust < trust);
    if (i < 3) assert.ok(playMinesAction(run, "open"));
  }
  assert.equal(run.scope, 2);
  assert.ok(run.achievements.includes("월급 루팡"));
  assert.ok(run.achievements.includes("현행범"));
  assert.ok(playMinesAction(run, "open"));
  for (let cell = 0; cell < 25; cell++) {
    if (!board.mines.includes(cell) && board.tiles[cell] === 0) playMinesAction(run, "reveal", cell);
  }
  assert.equal(board.result, "won");
  assert.equal(run.stats.minesWins, 1);
  playMinesAction(run, "hide");
  step(run, "next", "leave");
  advance(run, false);
  assert.equal(run.ending, "deadline");
  assert.ok(run.achievements.includes("지뢰 제거 전문가"));
  assert.deepEqual(replayRun(run), recordFor(run));
  assert.equal(replayRun({ ...run, moves: [["mine", "tick", 120], ...run.moves] }), null);
});

test("the short project skips weekends, keeps every work type, and records dates and workdays separately", () => {
  const run = newRun(417, undefined, SHORT_PROJECT_RULESET);
  assert.equal(projectDay(run, run.deadline), 10);
  assert.equal(formatDate(run.deadline), "3월 17일 금");
  assert.equal(missionCount(run), 9);
  assert.deepEqual(new Set(run.workOrder.map(key => makeWork(key, run.seed).type)), new Set(Object.keys(WORK_TYPES)));
  advance(run, true);
  const record = recordFor(run);
  assert.equal(record.progress, 9);
  assert.equal(record.missionTotal, 9);
  assert.ok(record.completedDay >= 9 && record.completedDay <= 10);
  assert.equal(record.completedDay, record.completedCalendarDay - 2);
  assert.deepEqual(replayRun(run), record);

  const delayed = newRun(417, undefined, SHORT_PROJECT_RULESET);
  advance(delayed, false);
  assert.equal(delayed.ending, "deadline");
  assert.equal(delayed.day, delayed.deadline);
  assert.ok(projectDay(delayed) >= 9 && projectDay(delayed) <= 10);
  assert.deepEqual(replayRun(delayed), recordFor(delayed));
});

test("code review and delegation have replayable costs, while the 10-day problem bank can finish", () => {
  const run = newRun(417, undefined, PROBLEM_BANK_RULESET);
  step(run, "arrive");
  assert.ok(submitSolution(run));
  step(run, "next", "leave", "arrive", "scrumQuick", "receiveWork");
  const mission = currentMission(run);
  assert.equal(mission.difficulty, "beginner");
  const resumed = JSON.parse(JSON.stringify(run));
  assert.deepEqual(currentMission(resumed), mission);
  const startTime = run.remaining;
  assert.ok(requestCodeReview(run));
  assert.equal(run.remaining, startTime - 15);
  assert.equal(run.reviewedProblem, mission.id);
  assert.equal(requestCodeReview(run), false);
  const noTime = { ...structuredClone(run), remaining: 0 };
  assert.ok(delegateCodeWork(noTime));
  assert.equal(noTime.remaining, 0);
  const trust = run.stats.reportTrust;
  assert.ok(delegateCodeWork(run));
  assert.equal(run.remaining, startTime - 45);
  assert.equal(run.stats.reportTrust, trust - 8);
  assert.equal(run.relations.lee, -1);
  assert.equal(run.stats.workResults.code.success, 1);
  assert.equal(run.progress, 2);
  assert.equal(delegateCodeWork(run), false);
  step(run, "next", "rest", "document", "next", "reportBrief", "leave");
  assert.equal(run.scrum.yesterday.workDelegated, true);
  advance(run, true);
  const record = recordFor(run);
  assert.ok(record.completedDay >= 9 && record.completedDay <= 10);
  assert.equal(record.progress, 9);
  assert.equal(record.codeReviews, 1);
  assert.equal(record.codeDelegations, 1);
  assert.deepEqual(replayRun(run), record);
});

test("chained assignments use the remaining time and retain unfinished work the next day", () => {
  const run = newRun(417, undefined, LANGUAGE_ASSIGNMENT_RULESET);
  step(run, "stack-none", "arrive");
  assert.ok(submitSolution(run));
  const minutes = run.remaining;
  assert.equal(currentMission(run), undefined);
  assert.ok(!options({ ...run, remaining: 44 }).some(choice => choice.id === "nextWork"));
  step(run, "nextWork");
  assert.equal(run.remaining, minutes);
  const beginner = currentMission(run);
  assert.equal(beginner.difficulty, "beginner");
  assert.deepEqual(currentMission(JSON.parse(JSON.stringify(run))), beginner);
  assert.ok(submitSolution(run));
  assert.equal(run.workDoneToday, 2);
  if (options(run).some(choice => choice.id === "nextWork")) {
    step(run, "nextWork");
    const puzzle = currentMission(run);
    step(run, "next", "leave", "arrive", "scrumQuick");
    assert.deepEqual(currentMission(run), puzzle);
  } else {
    assert.ok(run.remaining < 55);
    step(run, "next", "leave", "arrive", "scrumQuick");
  }
  assert.equal(run.scrum.yesterday.workCount, 2);
});

test("first-day language assignment excludes the chosen language and persists through replay and resume", () => {
  const all = Object.keys(LANGUAGES);
  const unknownRolls = new Set();
  for (let seed = 0; seed < 40; seed++) {
    unknownRolls.add(assignedLanguage(seed, "none"));
    for (const familiar of all) {
      const run = newRun(seed);
      assert.ok(!act(run, "arrive"));
      step(run, "stack-" + familiar);
      assert.equal(run.phase, "arrive");
      assert.notEqual(run.language, familiar);
      assert.equal(run.language, assignedLanguage(seed, familiar));
      assert.ok(!act(run, "stack-none"));
      step(run, "arrive");
      const expected = currentMission(run);
      assert.deepEqual(currentMission(JSON.parse(JSON.stringify(run))), expected);
      assert.equal(expected.language ?? "python", run.language);
    }
  }
  assert.equal(unknownRolls.size, all.length);
  const run = newRun(512);
  step(run, "stack-javascript", "arrive");
  advance(run, true);
  assert.equal(recordFor(run).language, run.language);
  assert.deepEqual(replayRun(run), recordFor(run));
});

test("the 10-day project releases every template without duplicates and requires delivery, scope and score", () => {
  for (const seed of [12, 417, 91231]) {
    const run = newRun(seed, undefined, LANGUAGE_ASSIGNMENT_RULESET);
    assert.equal(new Set(run.workOrder.map(job => job.key)).size, 22);
    for (const { day, key } of run.workOrder) {
      const difficulty = makeWork(key, seed).difficulty;
      if (difficulty) assert.equal(difficulty, day <= 3 ? "beginner" : day <= 6 ? "intermediate" : "advanced");
    }
    advance(run, true);
    const record = recordFor(run);
    assert.ok(record.completedDay >= 8 && record.completedDay <= 10, JSON.stringify(record));
    assert.ok(record.progress >= PROJECT_GOAL.work);
    assert.equal(record.overtime, 0);
    assert.deepEqual(replayRun(run), record);
    assert.equal(projectReady({ ...run, deliverySubmitted: false }), false);
    assert.equal(projectReady({ ...run, scope: 1 }), false);
    assert.equal(projectReady(run, PROJECT_GOAL.score - 1), false);
  }
});

test("the new curriculum uses six one-line grammar exercises through shift three and replays a complete run", () => {
  const choices = new Set();
  for (const seed of [12, 417, 91231, 24, 28, 83]) {
    const run = newRun(seed);
    const firstDays = run.workOrder.filter(({ day }) => day < 4);
    assert.equal(new Set(run.workOrder.map(job => job.key)).size, 28);
    for (const language of Object.keys(LANGUAGES)) {
      const work = firstDays.map(({ key }) => makeWork(key, seed, language)).filter(({ type }) => type === "code");
      assert.equal(work.length, 6);
      for (const mission of work) {
        choices.add(mission.id);
        assert.ok(mission.fundamentals);
        assert.equal(mission.difficultyLabel, "문법 연습");
        assert.equal(mission.starter.match(/이 줄만 고치세요\./g)?.length, 1);
        assert.ok(mission.minutes <= 35);
      }
    }
    assert.ok(run.workOrder.filter(({ day }) => day >= 4).every(({ key }) => !makeWork(key, seed).fundamentals));
    advance(run, true);
    assert.ok(run.completedDay);
    assert.equal(run.stats.overtime, 0);
    assert.deepEqual(replayRun(run), recordFor(run));
  }
  assert.ok(choices.size > 6);
});

test("debug completion consumes the normal time and cannot be replayed for ranking", () => {
  const run = newRun(417);
  assert.equal(passWorkForDebug(run), false);
  step(run, "stack-none", "arrive");
  const expectedTime = run.remaining - codingCost(run);
  assert.equal(passWorkForDebug(run), true);
  assert.equal(run.remaining, expectedTime);
  assert.equal(run.moves.at(-1), DEBUG_PASS_MOVE);
  assert.equal(run.progress, 1);
  assert.equal(passWorkForDebug(run), false);
  advance(run, true);
  assert.ok(run.completedDay);
  assert.equal(replayRun(run), null);
});
