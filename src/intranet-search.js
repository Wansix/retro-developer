import { INTRANET_DOCUMENTS } from "./intranet-documents.js";

const STOP_WORDS = new Set(["python", "파이썬", "in", "a", "the", "of", "to", "is", "방법", "하는", "어떻게", "사용법", "예제", "질문", "검색"]);
const LEGACY_TOPICS = {
  "hello-world": ["출력", "문자열"],
  "salary-raise": ["변수", "사칙연산"],
  "star-print": ["문자열", "반복문", "출력"],
  "discount-bug": ["사칙연산", "변수", "디버깅"],
  "sales-total": ["배열", "반복문", "사칙연산"],
  "signup-check": ["조건문", "디버깅"],
  "button-color": ["조건문", "변수"],
  "ie-fallback": ["함수", "조건문", "Internet Explorer"],
  inventory: ["배열", "반복문", "재고 관리"],
  shipping: ["조건문", "디버깅"],
  "mail-list": ["배열", "반복문", "조건문"],
  deployment: ["함수", "배열", "조건문"],
};

const normalize = text => text.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}%/]+/gu, " ").trim();
const contains = (text, word) => {
  if (/[\p{Script=Hangul}]/u.test(word)) return word.length > 1 ? text.includes(word) : text.split(" ").includes(word);
  return (" " + text + " ").includes(" " + word + " ");
};

const index = INTRANET_DOCUMENTS.map(doc => ({
  doc,
  title: normalize(doc.title),
  keys: [...new Set([...doc.tags, ...doc.terms].map(normalize))].filter(Boolean),
}));
const articles = new Map(INTRANET_DOCUMENTS.map(doc => [doc.id, doc]));

export const documentById = id => articles.get(id);
export const missionTopics = mission => mission?.tags ?? LEGACY_TOPICS[mission?.id] ?? [];
export const documentMatchesTopics = (doc, topics) => {
  const tags = new Set(doc.tags.map(normalize));
  return topics.some(topic => tags.has(normalize(topic)));
};

function eraTopic(query) {
  const compact = normalize(query).replaceAll(" ", "");
  if (/stackoverflow|스택오버플로(?:우)?/.test(compact)) return "stack";
  if (/chatgpt|챗지피티|챗gpt/.test(compact)) return "chatgpt";
}

export function searchIntranet(query, topics = []) {
  const normalized = normalize(query);
  if (!normalized || eraTopic(query)) return [];
  const terms = [...new Set(normalized.split(" ").filter(term => !STOP_WORDS.has(term)))];
  if (!terms.length) return [];
  return index.map(({ doc, title, keys }) => {
    let score = keys.includes(normalized) ? 15 : 0;
    for (const key of keys) {
      if (!STOP_WORDS.has(key) && contains(normalized, key)) score += key.includes(" ") ? 7 : 4;
    }
    for (const term of terms) {
      if (contains(title, term)) score += 2;
      if (keys.some(key => contains(key, term))) score += 2;
    }
    return { doc, score: score && score + (documentMatchesTopics(doc, topics) ? 1 : 0) };
  }).filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score || b.doc.date.localeCompare(a.doc.date) || a.doc.id.localeCompare(b.doc.id))
    .slice(0, 12).map(result => result.doc);
}

const looksLikeError = query => /\b(?:[a-z]+error|traceback|exception|bug|debug)\b|오류|에러|예외|버그|실행\s?안/.test(normalize(query));

export function newInternetState() {
  return { open: false, pages: [{ view: "home" }], searches: [], seen: [], errors: 0, researched: [] };
}

export const currentInternetPage = state => state.pages.at(-1);

export function visitInternetPage(state, page) {
  const current = currentInternetPage(state);
  if (current.view === page.view && current.query === page.query && current.id === page.id) return;
  state.pages = [...state.pages, page].slice(-40);
}

export function goInternetBack(state) {
  if (state.pages.length < 2) return false;
  state.pages.pop();
  return true;
}

function commentOnce(state, event) {
  if (state.seen.includes(event)) return null;
  state.seen.push(event);
  return event;
}

export function recordInternetSearch(state, raw, mission, fromHistory = false) {
  const query = raw.trim().slice(0, 96);
  const key = normalize(query);
  if (!key) return null;
  visitInternetPage(state, { view: "results", query, topics: missionTopics(mission) });
  if (fromHistory) return null;
  state.searches = [query, ...state.searches.filter(prior => normalize(prior) !== key)].slice(0, 20);
  if (looksLikeError(query)) state.errors++;
  const special = eraTopic(query);
  if (special) return commentOnce(state, special);
  if (!state.seen.includes("first")) return commentOnce(state, "first");
  if (state.errors >= 3 && looksLikeError(query)) return commentOnce(state, "errors");
  return null;
}

export function readInternetArticle(state, id, mission) {
  const doc = documentById(id);
  if (!doc) return false;
  visitInternetPage(state, { view: "article", id });
  if (mission && documentMatchesTopics(doc, missionTopics(mission)) && !state.researched.includes(mission.id)) {
    state.researched.push(mission.id);
  }
  return true;
}

export function commentOnInternetSolution(state, mission) {
  return mission && state.researched.includes(mission.id) ? commentOnce(state, "solved") : null;
}
