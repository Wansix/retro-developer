import { INTRANET_SITES } from "./intranet-documents.js";
import { LANGUAGES } from "./office-languages.js";
import {
  currentInternetPage, documentById, documentMatchesTopics, goInternetBack,
  missionTopics, readInternetArticle, recordInternetSearch, searchIntranet, visitInternetPage,
} from "./intranet-search.js";

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text != null) element.textContent = text;
  if (className) element.className = className;
  return element;
}

function linkButton(text, action) {
  const button = node("button", text, "internet-link");
  button.type = "button";
  button.onclick = action;
  return button;
}

export function mountIntranet({ getState, getMission, onChange, onComment }) {
  const $ = id => document.getElementById(id);
  const coding = $("coding-panel");
  const browser = $("desk-internet");
  const toggle = $("internet-toggle");
  const query = $("internet-query");
  const view = $("internet-view");
  const docked = matchMedia("(min-width: 1050px)");
  const codingPanels = [$("mission-panel"), coding.querySelector(".coding-terminal")];
  let codingVisible = false;
  let paintedPage;
  let paintedState;
  let paintedMission;

  function sync(visible = codingVisible) {
    codingVisible = visible;
    const state = getState();
    const open = codingVisible && !!state.open;
    browser.classList.toggle("hidden", !open);
    coding.classList.toggle("internet-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.textContent = open ? "인터넷 닫기" : "인터넷 검색";
    for (const panel of codingPanels) panel.inert = open && !docked.matches;
    if (!open) return;
    const page = currentInternetPage(state);
    const mission = getMission();
    if (paintedPage === page && paintedState === state && paintedMission === mission?.id) return;
    paintedPage = page;
    paintedState = state;
    paintedMission = mission?.id;
    paint(page, state, mission);
  }

  function update({ event, focusView = true } = {}) {
    sync();
    onChange();
    if (event) onComment(event);
    if (focusView) view.focus({ preventScroll: true });
  }

  function search(raw, fromHistory = false) {
    const event = recordInternetSearch(getState(), raw, getMission(), fromHistory);
    update({ event: event ?? (fromHistory ? null : "search") });
  }

  function go(page) {
    visitInternetPage(getState(), page);
    update();
  }

  function openArticle(id) {
    if (readInternetArticle(getState(), id, getMission())) update();
  }

  function home(mission) {
    const page = node("div", null, "internet-portal");
    page.append(node("h3", "미래검색"), node("p", LANGUAGES[mission?.language ?? "python"].name + " 개발 자료와 사내 즐겨찾기"));
    const topics = missionTopics(mission).slice(0, 4);
    if (topics.length) {
      page.append(node("h4", "이 업무의 검색어"));
      const links = node("ul");
      for (const topic of topics) {
        const li = node("li");
        li.append(linkButton(topic, () => search(topic)));
        links.append(li);
      }
      page.append(links);
    }
    return page;
  }

  function results(page) {
    const found = searchIntranet(page.query, page.topics, page.language);
    const resultPage = node("div", null, "internet-results");
    resultPage.append(node("h3", "‘" + page.query + "’ 검색 결과 " + found.length + "건"));
    if (!found.length) {
      resultPage.append(node("p", "찾는 문서가 없습니다. 한 단어로 줄이거나 오류 메시지 일부로 검색해 보세요."));
      return resultPage;
    }
    const list = node("ol");
    for (const doc of found) {
      const item = node("li");
      const type = INTRANET_SITES[doc.site].kind;
      const related = documentMatchesTopics(doc, page.topics) ? " · 업무 관련" : "";
      item.append(linkButton(doc.title, () => openArticle(doc.id)),
        node("p", type + " · " + doc.date + related, "internet-meta"),
        node("p", doc.question ?? doc.paragraphs[0]));
      list.append(item);
    }
    resultPage.append(list);
    return resultPage;
  }

  function article(doc) {
    if (!doc) return node("p", "문서를 찾을 수 없습니다.");
    const site = INTRANET_SITES[doc.site];
    const page = node("article", null, "internet-article");
    page.dataset.site = doc.site;
    const header = node("div", null, "internet-site");
    header.append(node("strong", doc.language && doc.site === "manual" ? LANGUAGES[doc.language].name + " 한글 문서방" : site.name), node("p", site.section));
    const body = node("div", null, "internet-entry");
    const meta = node("p", doc.author + " · ", "internet-meta");
    const date = node("time", doc.date);
    date.dateTime = doc.date;
    meta.append(date);
    body.append(node("h3", doc.title), meta);
    if (doc.question) {
      body.append(node("blockquote", "Q. " + doc.question), node("p", "✓ 채택 답변", "internet-accepted"));
    }
    for (const paragraph of doc.paragraphs) body.append(node("p", paragraph));
    if (doc.example) body.append(node("pre", doc.example));
    if (doc.comments?.length) {
      const comments = node("section", null, "internet-comments");
      comments.append(node("h4", site.replies + " " + doc.comments.length));
      for (const [author, text] of doc.comments) {
        const reply = node("p");
        reply.append(node("strong", author + " "), document.createTextNode(text));
        comments.append(reply);
      }
      body.append(comments);
    }
    page.append(header, body);
    return page;
  }

  function history(state) {
    const page = node("div", null, "internet-results");
    page.append(node("h3", "검색 기록"));
    if (!state.searches.length) page.append(node("p", "아직 검색한 내용이 없습니다."));
    const list = node("ol");
    for (const entry of state.searches) {
      const li = node("li");
      li.append(linkButton(entry, () => search(entry, true)));
      list.append(li);
    }
    page.append(list);
    return page;
  }

  function paint(page, state, mission) {
    query.placeholder = mission?.language === "cpp" ? "vector, undeclared identifier…" :
      mission?.language === "javascript" ? "var, ReferenceError…" : "함수, TypeError…";
    $("internet-back").disabled = state.pages.length < 2;
    $("internet-home").disabled = page.view === "home";
    $("internet-history").disabled = page.view === "history";
    const location = { home: "시작 페이지", history: "검색 기록", results: "검색 결과", article: "문서 열람" };
    $("internet-location").textContent = "미래넷 › " + location[page.view];
    let content;
    switch (page.view) {
      case "article": content = article(documentById(page.id)); break;
      case "results": content = results(page); break;
      case "history": content = history(state); break;
      default: content = home(mission);
    }
    view.replaceChildren(content);
    view.scrollTop = 0;
    query.value = page.view === "home" ? "" : state.pages.findLast(item => item.view === "results")?.query ?? "";
  }

  function setOpen(open) {
    getState().open = open;
    update({ focusView: false });
    if (open) (docked.matches ? query : view).focus({ preventScroll: true });
    else toggle.focus({ preventScroll: true });
  }

  toggle.onclick = () => setOpen(!getState().open);
  $("internet-close").onclick = () => setOpen(false);
  $("internet-back").onclick = () => {
    if (goInternetBack(getState())) update();
  };
  $("internet-home").onclick = () => { query.value = ""; go({ view: "home" }); };
  $("internet-history").onclick = () => go({ view: "history" });
  $("internet-search").onsubmit = event => {
    event.preventDefault();
    if (query.value.trim()) search(query.value);
  };
  browser.onkeydown = event => {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    event.preventDefault();
    setOpen(false);
  };
  docked.addEventListener("change", () => sync());
  return { sync };
}
