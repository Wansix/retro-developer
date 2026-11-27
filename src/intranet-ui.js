import { INTRANET_SITES } from "./intranet-documents.js";
import { internetFeed, internetQuote, INTERNET_TYPES } from "./intranet-feed.js";
import { LANGUAGES } from "./office-languages.js";
import { buildLecture } from "./intranet-lecture.js";

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text != null) element.textContent = text;
  if (className) element.className = className;
  return element;
}

function link(text, action) {
  const button = node("button", text, "internet-link");
  button.type = "button";
  button.onclick = action;
  return button;
}

const costText = minutes => minutes ? `${minutes}분` : "무료";

export function mountIntranet({ getUi, getRun, getMission, spend, onChange, onComment }) {
  const $ = id => document.getElementById(id);
  const coding = $("coding-panel");
  const browser = $("desk-internet");
  const toggle = $("internet-toggle");
  const view = $("internet-view");
  const notice = $("internet-notice");
  const docked = matchMedia("(min-width: 1050px)");
  const codingPanels = [$("mission-panel"), coding.querySelector(".coding-terminal")];
  let visible = false;
  let feed = [];
  let painted;
  let tab;
  let lecture;

  function costs(action, item) {
    return internetQuote(getRun(), getMission(), action, item);
  }

  function pay(action, item) {
    const result = spend(action, item?.id);
    if (!result) {
      notice.textContent = "업무 시간이 부족합니다. 다음 업무 시간이나 야근에 이어서 보세요.";
      return false;
    }
    notice.textContent = result.warning ? "김 과장 · " + result.warning :
      result.minutes ? `업무 시간 −${result.minutes}분` : "";
    return true;
  }

  function sync(codingVisible = visible) {
    visible = codingVisible;
    const ui = getUi();
    const mission = visible ? getMission() : null;
    const paid = mission && costs("open") === 0;
    if (mission && ui.workPage !== mission.id) {
      ui.workPage = mission.id;
      ui.open = false;
    }
    const open = !!(mission && ui.open && paid);
    browser.classList.toggle("hidden", !open);
    coding.classList.toggle("internet-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    if (mission) toggle.textContent = open ? "인터넷 닫기" : "인터넷 검색 · " + costText(costs("open"));
    for (const panel of codingPanels) panel.inert = open && !docked.matches;
    if (!open) {
      stopLecture();
      painted = null;
      return;
    }
    ui.tabs ??= {};
    const nextTab = ui.tabs[mission.id] ??= { pages: ["feed"], clip: {} };
    if (tab !== nextTab) {
      tab = nextTab;
      feed = internetFeed(getRun().seed, mission);
      painted = null;
    }
    paint();
  }

  function stopLecture() {
    if (!lecture) return;
    lecture.stop();
    lecture = null;
  }

  function go(page) {
    if (tab.pages.at(-1) !== page) tab.pages = [...tab.pages, page].slice(-24);
    paint();
    onChange();
    view.focus({ preventScroll: true });
  }

  function openArticle(item) {
    if (item.type !== "lecture" && !pay("read", item)) return;
    go(item.id);
  }

  function results(history) {
    const parent = node("div", null, "internet-results");
    const mission = getMission();
    const read = getRun().web.jobs[mission.id].read;
    const items = history ? feed.filter(item => read[item.id]) : feed;
    parent.append(node("h3", history ? "열어 본 자료" : "이 업무와 관련된 자료"));
    if (history && !items.length) parent.append(node("p", "아직 연 자료가 없습니다."));
    const list = node("ol");
    for (const item of items) {
      const row = node("li");
      const price = costs(item.type === "lecture" ? "play" : "read", item);
      const label = price === 0 ? "다시 보기 · 무료" : (item.type === "lecture" ? "최초 재생 " : "열람 ") + costText(price);
      const control = link(item.title, () => openArticle(item));
      const description = node("p", `${INTERNET_TYPES[item.type]} · ${label}`, "internet-meta");
      description.id = "internet-cost-" + item.id;
      control.setAttribute("aria-describedby", description.id);
      row.append(control, description);
      list.append(row);
    }
    parent.append(list);
    return parent;
  }

  function article(item) {
    const site = INTRANET_SITES[item.site] ?? { name: "모뎀 TV", section: "프로그래밍 강의 자료실" };
    const page = node("article", null, "internet-article");
    page.dataset.site = item.site ?? item.type;
    const header = node("header", null, "internet-site");
    header.append(node("strong", item.site === "manual" ? LANGUAGES[getMission().language ?? "python"].name + " 한글 문서방" : site.name),
      node("p", site.section));
    const body = node("div", null, "internet-entry");
    body.append(node("h3", item.sourceTitle ?? item.title), node("p", item.author + " · " + item.date, "internet-meta"));
    if (item.type === "lecture") {
      tab.clip.cost = costs("play", item);
      lecture = buildLecture(item.lesson, tab.clip, {
        hasPlayed: () => costs("play", item) === 0,
        onPlay() {
          const fresh = costs("play", item) > 0;
          if (!pay("play", item)) return false;
          if (fresh) onComment("lecture");
          onChange();
          return true;
        },
        onWatched() {
          const job = getRun().web?.jobs[getMission()?.id];
          if (!job?.watched && pay("watched", item)) onComment("lecture-done");
          onChange();
        },
        onChange,
        onClose: back,
      });
      body.append(lecture.player);
    } else {
      if (item.question) body.append(node("blockquote", "Q. " + item.question));
      if (item.question && item.useful) body.append(node("p", "✓ 채택 답변", "internet-accepted"));
      for (const paragraph of item.paragraphs) body.append(node("p", paragraph));
      if (item.example) body.append(node("pre", item.example));
      if (item.comments?.length) {
        const comments = node("section", null, "internet-comments");
        comments.append(node("h4", site.replies));
        for (const [author, text] of item.comments) {
          const reply = node("p");
          reply.append(node("strong", author + " "), document.createTextNode(text));
          comments.append(reply);
        }
        body.append(comments);
      }
      if (item.reaction) body.append(node("p", "나 · " + item.reaction, "internet-reaction"));
    }
    page.append(header, body);
    return page;
  }

  function paint() {
    const page = tab.pages.at(-1);
    if (painted === page) return;
    stopLecture();
    painted = page;
    $("internet-back").disabled = tab.pages.length < 2;
    $("internet-home").disabled = page === "feed";
    $("internet-history").disabled = page === "history";
    const item = feed.find(source => source.id === page);
    $("internet-location").textContent = "미래넷 › " + (item?.title ?? (page === "history" ? "열람 기록" : "업무 자료"));
    view.replaceChildren(item ? article(item) : results(page === "history"));
    view.scrollTop = 0;
  }

  function back() {
    if (tab.pages.length > 1) tab.pages.pop();
    else tab.pages = ["feed"];
    notice.textContent = "";
    paint();
    onChange();
    view.focus({ preventScroll: true });
  }

  function setOpen(open) {
    const ui = getUi();
    if (open) {
      const fresh = costs("open") > 0;
      if (!pay("open")) {
        $("internet-open-status").textContent = "자료 목록을 여는 데 필요한 업무 시간이 부족합니다.";
        return false;
      }
      $("internet-open-status").textContent = "";
      ui.open = true;
      if (fresh) onComment("first");
    } else {
      ui.open = false;
      notice.textContent = "";
    }
    sync();
    onChange();
    if (open) view.focus({ preventScroll: true });
    else toggle.focus({ preventScroll: true });
    return true;
  }

  toggle.onclick = () => setOpen(!getUi().open || costs("open") > 0);
  $("internet-close").onclick = () => setOpen(false);
  $("internet-back").onclick = back;
  $("internet-home").onclick = () => { notice.textContent = ""; go("feed"); };
  $("internet-history").onclick = () => { notice.textContent = ""; go("history"); };
  browser.onkeydown = event => {
    if (event.key === "Escape" && !event.defaultPrevented) {
      event.preventDefault();
      setOpen(false);
    }
  };
  document.addEventListener("visibilitychange", () => { if (document.hidden && lecture) lecture.stop(); });
  docked.addEventListener("change", () => sync());
  return { sync, openHome: () => { if (setOpen(true)) go("feed"); } };
}
