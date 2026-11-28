import assert from "node:assert/strict";
import test from "node:test";
import { DEBUG_PASS_MOVE, act, canSubmit, codingCost, currentMission, deferWork, delegateCodeWork, enableRelaxed, failCodeSubmission, isHalfDay, missionCount, missionNotice, newRun, officeTime, options, passWorkForDebug, playMinesAction, projectDay, recordFor, recordPaste, recordTaskTime, replayRun, searchAtWork, requestCodeReview, submitSolution, submitSpecialWork, useBurst } from "../src/office.js";
import { MINE_BREAK_COST, MINE_WARNING_SECONDS, mineNeighbors } from "../src/mines.js";
import { gradeWork, makeWork, WORK_TYPES, workOrder } from "../src/work-missions.js";
import { SATURDAY_SHIFT_RULESET, formatDate, LANGUAGE_ASSIGNMENT_RULESET, OFFICE_CLOCK_RULESET, PROBLEM_BANK_RULESET, SHORT_PROJECT_RULESET, WORK_CONTENT_RULESET } from "../src/records-schema.js";
import { DEPLOYMENT_WORK, PROJECT_GOAL, nextProjectWork, projectReady } from "../src/project-work.js";
import { stressPenalty, SURVIVAL } from "../src/survival.js";
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

function advance(run, solve, until = state => state.ending) {
  for (let i = 0; i < 350 && !run.ending && !until(run); i++) {
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
  assert.ok(until(run));
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
      const run = newRun(seed, undefined, SATURDAY_SHIFT_RULESET);
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
  const run = newRun(512, undefined, SATURDAY_SHIFT_RULESET);
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
    const run = newRun(seed, undefined, SATURDAY_SHIFT_RULESET);
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
  const run = newRun(417, undefined, SATURDAY_SHIFT_RULESET);
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

test("the first shift uses the full schedule and only unlocks the afternoon assignment after lunch", () => {
  const run = newRun(417, undefined, SATURDAY_SHIFT_RULESET);
  assert.equal(officeTime(run), "09:00");
  step(run, "stack-none", "arrive");
  assert.equal(officeTime(run), "10:00");
  assert.equal(run.remaining, 120);
  for (const time of ["10:45", "11:10", "11:35"]) {
    assert.ok(submitSolution(run));
    assert.equal(officeTime(run), time);
    if (time !== "11:35") step(run, "nextWork");
  }
  assert.equal(run.workDoneToday, 3);
  assert.deepEqual(options(run).map(({ id }) => id), ["next"]);
  assert.ok(!act(run, "leave"));
  step(run, "next");
  assert.equal(run.phase, "lunch");
  assert.equal(officeTime(run), "12:00");
  step(run, "rest");
  assert.equal(officeTime(run), "13:00");
  step(run, "nextWork");
  const afternoonJob = currentMission(run);
  assert.ok(["quiz", "review"].includes(afternoonJob.type));
  assert.equal(submitSpecialWork(run, solution(afternoonJob)).passed, true);
  assert.ok(officeTime(run) === "13:45" || officeTime(run) === "13:55");
  step(run, "next");
  assert.equal(officeTime(run), "17:15");
  step(run, "reportBrief");
  assert.equal(officeTime(run), "18:00");
  step(run, "leave");
  assert.equal(officeTime(run), "09:00");
  assert.equal(run.scrum.yesterday.workCount, 4);
});

test("first-day report shows the skipped time and actual assignment status before the leave choice", () => {
  const run = newRun(3);
  step(run, "stack-none", "arrive", "promise-standard");
  assert.ok(submitSolution(run));
  step(run, "next", "rest");

  const reportChoice = (state) => options(state).find(({ id }) => id === "next");
  assert.match(reportChoice(run).detail, /완료 1건 · 미배정 ‘상점 관리자 매뉴얼 확인’.*4시간 15분.*정시 퇴근이나 야근/);
  const unassigned = structuredClone(run);
  step(unassigned, "next");
  assert.equal(officeTime(unassigned), "17:15");
  assert.match(options(unassigned)[0].label, /완료 1건과 남은 업무/);
  step(unassigned, "reportBrief");
  assert.match(unassigned.effects[0], /완료 1건 · 미배정/);
  assert.deepEqual(options(unassigned).map(({ id }) => id), ["leave", "stay"]);

  step(run, "nextWork", "promise-standard");
  assert.equal(currentMission(run).title, "고객 문의 순번");
  assert.match(reportChoice(run).detail, /배정 후 미완료 ‘고객 문의 순번’/);
  const unfinished = structuredClone(run);
  step(unfinished, "next", "reportBrief");
  assert.match(unfinished.effects[0], /완료 1건 · 배정 후 미완료/);

  assert.equal(submitSpecialWork(run, 1).passed, true);
  assert.match(reportChoice(run).detail, /완료 2건 · 남은 업무 없음.*3시간 52분/);
  step(run, "next");
  assert.equal(options(run)[0].label, "완료 2건 보고 후 퇴근 선택");
  step(run, "reportBrief");
  assert.match(run.effects[0], /완료 2건 · 남은 업무 없음/);
  step(run, "leave");
  assert.equal(run.shift, 2);
});

test("unsubmitted work carries over the lunch break and Friday reserves enough time for the project meeting", () => {
  const run = newRun(417, undefined, SATURDAY_SHIFT_RULESET);
  step(run, "stack-none", "arrive");
  const id = currentMission(run).id;
  assert.equal(failCodeSubmission(run), 5);
  assert.equal(officeTime(run), "10:05");
  step(run, "next", "rest");
  assert.equal(currentMission(run).id, id);
  assert.equal(officeTime(run), "13:00");
  const friday = { ...run, day: 5, shift: 5, phase: "report" };
  assert.equal(officeTime(friday), "16:25");
  step(friday, "no");
  assert.equal(officeTime(friday), "18:00");
});

test("new runs count Saturday mornings and skip Sunday while older saves keep their calendar", () => {
  const run = newRun(417, undefined, SATURDAY_SHIFT_RULESET);
  assert.equal(run.deadline, 11);
  assert.equal(projectDay(run, run.deadline), 10);
  assert.equal(formatDate(run.deadline), "3월 16일 목");
  advance(run, false, state => state.shift === 6);
  assert.equal(run.day, 6);
  assert.ok(isHalfDay(run));
  assert.equal(officeTime(run), "09:00");
  const unfinished = currentMission(run).id;
  advance(run, false, state => state.phase === "leave");
  assert.equal(officeTime(run), "12:00");
  assert.deepEqual(options(run).map(({ id }) => id), ["leave"]);
  assert.equal(act(run, "stay"), false);
  step(run, "leave");
  assert.equal(run.day, 8);
  assert.equal(projectDay(run), 7);
  assert.equal(currentMission(run).id, unfinished);
  assert.equal(formatDate(run.day), "3월 13일 월");
  advance(run, false);
  assert.deepEqual(replayRun(run), recordFor(run));

  const previous = newRun(417, undefined, OFFICE_CLOCK_RULESET);
  advance(previous, false, state => state.shift === 6);
  assert.equal(previous.day, 8);
  assert.equal(previous.deadline, 12);
});

function survivalAdvance(run, until, style = "no-overtime") {
  let weekend = false;
  for (let i = 0; i < 450 && !run.ending && !until(run); i++) {
    if (run.phase === "sunday") {
      weekend = true;
      step(run, style === "relationship" ? "sunday-lee" : "sunday-rest");
      continue;
    }
    const available = options(run).filter(item => !item.disabled);
    assert.ok(available.length > 0 && available.length <= 4);
    const has = id => available.some(item => item.id === id);
    if (canSubmit(run)) {
      if (style === "overtime" && run.shift === 6 && run.phase === "morning") {
        step(run, "next");
        continue;
      }
      const mission = currentMission(run);
      const elapsed = style === "paced" ? .82 : .36;
      if (!run.task.elapsed) assert.ok(recordTaskTime(run, Math.round(run.task.limit * elapsed)));
      if (!canSubmit(run)) {
        step(run, "next");
        continue;
      }
      if (mission.type === "code") assert.ok(submitSolution(run));
      else assert.equal(submitSpecialWork(run, solution(mission)).passed, true);
      continue;
    }
    const move = [
      ...(style === "overtime" ? ["saturday-meal"] : []),
      ...(style === "reckless" ? ["accept", "yes", "nextWork", "promise-standard", "next"] : []),
      ...(style === "relationship" ? ["help", "scope-agreement", "ally"] : []),
      "scope-agreement", "cleanup", "nextWork", "promise-standard", "receiveWork",
      "arrive", "scrumQuick", "scrumHonest", "rest", "document", "trim", "reportBrief", "leave", "next",
    ].find(has);
    step(run, move ?? available[0].id);
  }
  assert.ok(until(run));
  return weekend;
}

test("two-week strategies finish the same Saturday with distinct health, meetings, and overtime", () => {
  const endings = {};
  for (const style of ["no-overtime", "overtime", "relationship", "paced"]) {
    for (const seed of [15, 417, 1138, 72531]) {
      const run = newRun(seed);
      assert.equal(run.deadline, 13);
      assert.equal(projectDay(run, run.deadline), 12);
      assert.equal(nextProjectWork({ ...run, progress: 15, shift: 11 }), null);
      assert.equal(survivalAdvance(run, state => state.ending, style), true);
      assert.ok(run.hp > 0);
      assert.equal(run.progress, 16);
      assert.equal(run.scope, 0);
      assert.equal(run.completedDay, 13);
      assert.equal(recordFor(run).completedDay, 12);
      assert.equal(recordFor(run).scoreGoal, undefined);
      assert.deepEqual(replayRun(run), recordFor(run));
      if (style === "overtime") {
        assert.ok(run.stats.overtimeMinutes > 0);
        assert.equal(run.stats.saturdayLeaves, 1);
        assert.ok(run.achievements.includes("반나절의 기적"));
      } else {
        assert.equal(run.stats.overtimeMinutes, 0);
        assert.equal(run.stats.saturdayLeaves, 2);
      }
      if (style === "relationship") assert.ok(run.memory.helpedLee >= 2);
      endings[style] = run.ending;
    }
  }
  assert.ok(Object.values(endings).every(id => id !== "hospital" && id !== "deadline"));
  const reckless = newRun(417);
  survivalAdvance(reckless, state => state.ending, "reckless");
  assert.ok(reckless.stats.fastJobs >= 10);
  assert.ok(reckless.scope > 0);
  assert.equal(reckless.ending, "deadline");
});

test("the timer accounts for elapsed time once, restores from JSON, and permits late delivery and deferral", () => {
  const run = newRun(417);
  step(run, "stack-none", "arrive");
  assert.equal(canSubmit(run), false);
  step(run, "promise-standard");
  assert.equal(recordTaskTime(run, -1), false);
  const budget = run.remaining;
  assert.ok(recordTaskTime(run, run.task.limit));
  assert.ok(searchAtWork(run));
  const trust = run.stats.reportTrust;
  assert.ok(recordTaskTime(run, 1, true));
  assert.ok(recordTaskTime(run, 1));
  assert.equal(run.stats.timeouts, 1);
  assert.equal(run.stats.reportTrust, trust - 5);
  assert.equal(run.stats.actualCodingSeconds, run.task.limit + 1);
  assert.equal(recordPaste(run), 1);
  const restored = JSON.parse(JSON.stringify(run));
  assert.deepEqual(restored.task, run.task);
  assert.equal(restored.remaining, budget - 3);
  assert.ok(canSubmit(restored));
  const retry = failCodeSubmission(restored);
  assert.ok(retry >= 5);
  assert.ok(recordTaskTime(restored, 2));
  const charge = codingCost(restored);
  assert.ok(retry + charge < codingCost(run) + 30);
  assert.ok(submitSolution(restored));
  assert.equal(submitSolution(restored), false);
  assert.equal(restored.remaining, budget - 3 - retry - charge);
  assert.equal(restored.stats.timeouts, 1);
  assert.equal(restored.stats.fastJobs, 0);
  assert.ok(deferWork(run));
  assert.equal(recordTaskTime(run, 10), false);
  assert.equal(currentMission(run).id, currentMission(newRun(417)).id);
  assert.ok(run.solvedToday);

  const relaxed = newRun(417);
  assert.ok(enableRelaxed(relaxed));
  assert.equal(enableRelaxed(relaxed), false);
  step(relaxed, "stack-none", "arrive", "promise-standard");
  assert.equal(relaxed.task.limit, run.stats.actualCodingSeconds * 2 - 2);
  survivalAdvance(relaxed, state => state.ending);
  assert.equal(replayRun(relaxed).timeMode, "완화");
});

test("Sunday recovery, stress thresholds and low reputation are independent of the delivery gate", () => {
  assert.deepEqual([0, 59, 60, 74, 75, 89, 90, 100].map(stressPenalty), [0, 0, 5, 5, 10, 10, 20, 20]);
  const run = newRun(417);
  survivalAdvance(run, state => state.phase === "sunday");
  run.hp = 42;
  run.stress = 80;
  step(run, "sunday-rest");
  assert.equal(run.day, 8);
  assert.equal(run.shift, 7);
  assert.equal(run.hp, 82);
  assert.equal(run.stress, 50);
  survivalAdvance(run, state => state.shift === 12 && canSubmit(state));
  assert.equal(currentMission(run).id, makeWork(DEPLOYMENT_WORK, run.seed, run.language).id);
  run.score = -100;
  assert.ok(submitSolution(run));
  assert.ok(projectReady(run));
  step(run, "next", "leave");
  assert.ok(run.completedDay);
});

test("burst is one use, spans two game hours, and settles once including a successful delivery at zero HP", () => {
  const run = newRun(417);
  assert.equal(useBurst(run), false);
  survivalAdvance(run, state => state.shift === 11 && state.phase === "morning" && !!state.task);
  const baseLimit = run.task.limit;
  const normal = codingCost(run);
  const hp = run.hp;
  assert.ok(useBurst(run));
  assert.equal(useBurst(run), false);
  assert.equal(run.task.limit + run.task.burstBonus, baseLimit * 2);
  assert.equal(codingCost(run), Math.ceil(normal / 2));
  const cost = codingCost(run);
  assert.ok(submitSolution(run));
  const afterWork = run.hp;
  assert.ok(afterWork <= hp);
  assert.equal(run.burst.remaining, SURVIVAL.burst.minutes - cost);
  step(run, "next");
  assert.equal(run.burst.remaining, 0);
  assert.equal(run.hp, afterWork - 36);
  step(run, "rest");
  assert.equal(run.hp, afterWork - 36 + 10);
  survivalAdvance(run, state => state.ending);
  assert.deepEqual(replayRun(run), recordFor(run));

  const last = newRun(417);
  survivalAdvance(last, state => state.shift === 12 && canSubmit(state));
  assert.ok(useBurst(last));
  const finalMission = currentMission(last);
  last.hp = Math.max(0, -(finalMission.reward?.hp ?? -3)) + Math.ceil(codingCost(last) * .3);
  assert.ok(submitSolution(last));
  assert.equal(last.hp, 0);
  assert.equal(last.ending, "burstHospital");
  assert.equal(recordFor(last).projectDelivered, true);
  assert.equal(last.completedDay, null);
  assert.equal(useBurst(last), false);
});

test("decisions carried from first week create handoff costs and a documented customer extension", () => {
  const run = newRun(417);
  survivalAdvance(run, state => state.shift === 4 && state.phase === "negotiate");
  step(run, "accept");
  assert.equal(run.memory.planningAccepted, 1);
  survivalAdvance(run, state => state.shift === 7 && state.phase === "arrive");
  const scope = run.scope;
  step(run, "arrive");
  assert.ok(run.scope > scope);
  assert.match(run.effects.join(" "), /지난주/);

  survivalAdvance(run, state => state.shift === 11 && state.phase === "negotiate");
  run.stats.reportTrust = 90;
  step(run, "push");
  assert.equal(run.memory.clientExtension, true);
  assert.match(run.effects.join(" "), /한 시간/);
  survivalAdvance(run, state => state.shift === 12 && state.phase === "morning" && !!state.task);
  step(run, "next", "stay");
  assert.equal(officeTime(run), "12:00");
  assert.equal(run.remaining, SURVIVAL.overtime.saturday + SURVIVAL.overtime.clientExtension);
  const hp = run.hp;
  step(run, "coffee");
  assert.equal(run.stats.overtimeMinutes, 15);
  assert.ok(run.hp <= hp + 5 - 2);
});
