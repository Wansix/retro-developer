import assert from "node:assert/strict";
import test from "node:test";
import { CODE_PROBLEMS } from "../src/code-problems.js";
import { materializeProblem } from "../src/code-problem-bank.js";
import { INTRANET_DOCUMENTS, INTRANET_SITES } from "../src/intranet-documents.js";
import {
  commentOnInternetSolution, currentInternetPage, goInternetBack, missionTopics, newInternetState,
  readInternetArticle, recommendedIntranetArticles, recordInternetSearch, searchIntranet, visitInternetPage,
} from "../src/intranet-search.js";

test("the work page recommends only articles for the current language and topics", () => {
  for (const language of ["python", "javascript", "cpp"]) {
    const mission = materializeProblem("code:grammar-stock-status", 417, language);
    const articles = recommendedIntranetArticles(mission);
    assert.ok(articles.length > 0 && articles.length <= 3);
    for (const article of articles) {
      assert.equal(article.language ?? "python", language);
      assert.ok(article.tags.some(tag => mission.tags.includes(tag)));
    }
  }
  assert.deepEqual(recommendedIntranetArticles(null), []);
});

test("assigned-language searches cover bank topics and survive history reload", () => {
  for (const language of ["javascript", "cpp"]) {
    for (const { id, tags } of CODE_PROBLEMS) {
      for (const topic of tags) assert.ok(searchIntranet(topic, tags, language).some(doc => doc.language === language), language + " " + id + " " + topic);
    }
    const mission = materializeProblem("code:inventory-list", 417, language);
    const state = newInternetState();
    recordInternetSearch(state, "배열", mission);
    const page = currentInternetPage(JSON.parse(JSON.stringify(state)));
    assert.equal(page.language, language);
    assert.ok(searchIntranet(page.query, page.topics, page.language).every(doc => doc.language === language));
  }
});

test("the fictional library covers the problem tags and searches Korean, English, aliases, and errors", () => {
  assert.equal(INTRANET_DOCUMENTS.length, 18);
  assert.equal(new Set(INTRANET_DOCUMENTS.map(doc => doc.id)).size, INTRANET_DOCUMENTS.length);
  assert.deepEqual(new Set(INTRANET_DOCUMENTS.map(doc => doc.site)), new Set(Object.keys(INTRANET_SITES)));
  const sampleQueries = {
    "조건문": "compare-boundaries",
    "파이썬 리스트": "list-basics",
    "binary search": "search-positions",
    "IndexError: list index out of range": "index-error",
    "TYPEERROR: can only concatenate str": "type-error",
    "expected an indented block": "indentation-error",
    "중복 제거": "set-membership",
    "％": "divide-remainder",
  };
  for (const [query, first] of Object.entries(sampleQueries)) assert.equal(searchIntranet(query)[0]?.id, first, query);
  for (const query of ["오늘 점심 돈가스 맛집", "", "Chat GPT", "스택 오버플로우"]) {
    assert.deepEqual(searchIntranet(query, ["딕셔너리"]), []);
  }
  for (const problem of CODE_PROBLEMS) {
    for (const tag of problem.tags) assert.ok(searchIntranet(tag, problem.tags).length, tag);
    const entry = problem.signature.split("(")[0];
    assert.ok(INTRANET_DOCUMENTS.every(doc => !doc.example?.includes("def " + entry + "(")));
  }
});

test("history and navigation survive serialization, including back from a document", () => {
  const state = newInternetState();
  const mission = { id: "deployment" };
  assert.deepEqual(missionTopics(mission), ["함수", "배열", "조건문"]);
  recordInternetSearch(state, "  print  ", mission);
  assert.equal(readInternetArticle(state, "return-print", mission), true);
  assert.deepEqual(currentInternetPage(state), { view: "article", id: "return-print" });
  const reloaded = JSON.parse(JSON.stringify(state));
  assert.ok(goInternetBack(reloaded));
  assert.equal(currentInternetPage(reloaded).query, "print");
  assert.ok(goInternetBack(reloaded));
  assert.equal(currentInternetPage(reloaded).view, "home");
  assert.equal(goInternetBack(reloaded), false);
  visitInternetPage(reloaded, { view: "history" });
  assert.deepEqual(reloaded.searches, ["print"]);
  assert.equal(recordInternetSearch(reloaded, "PRINT", mission, true), null);
  assert.deepEqual(reloaded.searches, ["print"]);
  assert.equal(readInternetArticle(reloaded, "missing", mission), false);
});

test("commentary prioritizes special queries, counts error searches, and triggers after a related article only once", () => {
  const state = newInternetState();
  const mission = { id: "code:inventory-list", tags: ["배열", "반복문"] };
  assert.equal(recordInternetSearch(state, "Stack Overflow", mission), "stack");
  assert.equal(recordInternetSearch(state, "스택 오버플로우", mission), null);
  assert.equal(recordInternetSearch(state, "Chat GPT", mission), "chatgpt");
  assert.equal(recordInternetSearch(state, "ChatGPT", mission), null);
  assert.equal(recordInternetSearch(state, "IndexError", mission), "first");
  assert.equal(recordInternetSearch(state, "TypeError", mission), null);
  assert.equal(recordInternetSearch(state, "IndexError", mission, true), null);
  assert.equal(recordInternetSearch(state, "IndentationError", mission), "errors");
  assert.equal(recordInternetSearch(state, "NameError", mission), null);
  assert.equal(commentOnInternetSolution(state, mission), null);
  readInternetArticle(state, "ie-width", mission);
  assert.equal(commentOnInternetSolution(state, mission), null);
  readInternetArticle(state, "index-error", mission);
  const restored = JSON.parse(JSON.stringify(state));
  assert.equal(commentOnInternetSolution(restored, mission), "solved");
  assert.equal(commentOnInternetSolution(restored, mission), null);
  assert.deepEqual(restored.searches.filter(entry => entry === "IndexError"), ["IndexError"]);
});
