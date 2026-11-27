import test from "node:test";
import assert from "node:assert/strict";
import { internetFeed, internetQuote, INTERNET_COST } from "../src/intranet-feed.js";
import { act, canSubmit, currentMission, newRun, options, recordFor, recordTaskTime, replayRun, submitSolution, useInternet } from "../src/office.js";
import { LANGUAGES } from "../src/office-languages.js";
import { missionTopics, documentMatchesTopics } from "../src/intranet-search.js";
import { CODE_PROBLEMS } from "../src/code-problems.js";
import { FUNDAMENTAL_DAYS } from "../src/code-fundamentals.js";
import { makeWork } from "../src/work-missions.js";

const languageIds = Object.keys(LANGUAGES);
const begin = (seed = 417) => {
  const run = newRun(seed);
  for (const move of ["stack-none", "arrive", "promise-standard"]) assert.ok(act(run, move));
  return run;
};

test("five era-appropriate seeded results contain useful material for each job and language", () => {
  for (const lang of languageIds) {
    const templates = ["story:opening", "story:deployment",
      ...[...CODE_PROBLEMS, ...FUNDAMENTAL_DAYS.flat(2)].map(work => "code:" + work.id)];
    for (const key of templates) {
      const mission = makeWork(key, 417, lang);
      const feed = internetFeed(417, mission);
      assert.equal(feed.length, 5);
      assert.equal(new Set(feed.map(item => item.id)).size, 5);
      assert.deepEqual(feed, internetFeed(417, JSON.parse(JSON.stringify(mission))));
      assert.ok(feed.filter(item => item.useful).length >= 2, `${key} ${lang}`);
      assert.ok(feed.some(item => !item.useful));
      for (const item of feed.filter(item => item.useful && item.type !== "lecture")) {
        assert.equal(item.language ?? "python", lang);
        assert.ok(documentMatchesTopics(item, missionTopics(mission)));
        assert.ok(item.paragraphs.length && item.example !== mission.starter);
        if (mission.solution) assert.notEqual(item.example?.trim(), mission.solution.trim());
      }
      const { lesson } = feed.find(item => item.type === "lecture");
      assert.equal(lesson.duration, 16);
      assert.match(lesson.title, new RegExp(LANGUAGES[lang].name.replace("C++", "C\\+\\+")));
      assert.ok(lesson.frames[2].code);
      assert.equal(lesson.frames.at(-1).caption, "Very simple, very easy!");
    }
  }
  const mission = makeWork("story:opening", 417);
  const variants = Array.from({ length: 12 }, (_, seed) => JSON.stringify(internetFeed(seed, mission).map(({ id, title }) => [id, title])));
  assert.ok(new Set(variants).size > 6);
});

test("only first access to each work's sources costs time, including lessons only at play", () => {
  const run = begin();
  const task = run.task;
  const mission = currentMission(run);
  const feed = internetFeed(run.seed, mission);
  const video = feed.find(item => item.type === "lecture");
  const blog = feed.find(item => item.type === "blog" && item.useful);
  const budget = run.remaining;
  assert.equal(useInternet(run, "read", blog.id), false);
  assert.equal(internetQuote(run, mission, "open"), 5);
  assert.equal(useInternet(run, "open").minutes, 5);
  assert.equal(useInternet(run, "open").minutes, 0);
  assert.equal(useInternet(run, "read", video.id), false);
  assert.equal(useInternet(run, "watched", video.id), false);
  assert.equal(useInternet(run, "read", blog.id).minutes, INTERNET_COST.blog);
  assert.equal(useInternet(run, "play", video.id).minutes, INTERNET_COST.lecture);
  assert.equal(useInternet(run, "play", video.id).minutes, 0);
  assert.ok(recordTaskTime(run, 16, true));
  assert.equal(useInternet(run, "watched", video.id).minutes, 0);
  assert.equal(task, run.task);
  assert.equal(run.task.elapsed, 16);
  assert.equal(run.stats.actualCodingSeconds, 0);
  assert.equal(run.remaining, budget - 18);

  const restored = JSON.parse(JSON.stringify(run));
  assert.equal(useInternet(restored, "read", blog.id).minutes, 0);
  assert.equal(useInternet(restored, "read", "no-such-document"), false);
  assert.ok(submitSolution(restored));
  assert.equal(restored.stats.webSearches, 1);
  assert.equal(restored.stats.webAssisted, 1);
  assert.equal(recordFor(restored).webSources.length, 2);
  for (const title of ["이름 모를 은인", "Thank you, my friend", "영어는 못 알아들었지만 코드는 알아들었다"]) {
    assert.ok(restored.achievements.includes(title));
  }

  while (!restored.ending) {
    const candidates = options(restored).filter(item => !item.disabled);
    const next = ["leave", "next", "sunday-rest", "rest", "arrive", "scrumQuick", "scrumHonest", "document", "trim", "reportBrief"].find(id => candidates.some(item => item.id === id));
    assert.ok(act(restored, next ?? candidates[0].id));
  }
  assert.deepEqual(replayRun(restored), recordFor(restored));
});

test("search remains optional and insufficient time does not consume minutes or open a source", () => {
  const run = begin();
  run.remaining = 4;
  assert.equal(useInternet(run, "open"), false);
  assert.equal(run.remaining, 4);
  assert.equal(run.stats.webSearches, undefined);
  run.remaining = 5;
  assert.ok(useInternet(run, "open"));
  const source = internetFeed(run.seed, currentMission(run)).find(item => item.type === "board");
  assert.equal(useInternet(run, "read", source.id), false);
  assert.deepEqual(run.web.jobs[currentMission(run).id].read, {});

  const noResearch = begin();
  assert.ok(canSubmit(noResearch));
  assert.ok(submitSolution(noResearch));
});
