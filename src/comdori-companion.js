import { queueCompanionEvent, takeCompanionLine } from "./comdori-commentary.js";
import { COMDORI_STANDBY, TUTORIAL_LINES } from "./comdori-lines.js";
import { dialogueLine } from "./dialogue.js";

const newDelay = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const LESSON_TARGETS = {
  time: "#hud-time-item",
  input: ".editor-shell",
  submit: "#btn-submit",
  score: ".hud-item:has(> #hud-progress), .hud-item:has(> #hud-score)",
  practice: ".editor-shell",
  health: ".hud-item:has(> #hud-hp)",
  stress: "#hud-stress-item",
  trust: "#scrum-trust",
  scope: ".hud-item:has(> #hud-scope)",
  deadline: ".hud-item:has(> #hud-dday), #office-guide-open",
};

export function mountOfficeCompanion({ getState, getShift, survival, paused, onChange, onLessonNext }) {
  const panel = document.getElementById("compdori-panel");
  const corner = panel.parentElement;
  const lesson = document.getElementById("office-lesson");
  const portrait = document.getElementById("compdori-face");
  const text = document.getElementById("compdori-text");
  const next = document.getElementById("lesson-next");
  next.onclick = onLessonNext;
  let mountedState;
  let timer;
  let typing;
  let idleAt;
  let gestureAt;
  let gestureEndsAt = 0;
  let highlighted = [];

  function setEvent(event = "") {
    panel.dataset.event = event;
    next.classList.toggle("hidden", event !== "lesson:time");
  }

  function highlight(topic) {
    for (const target of highlighted) target.classList.remove("lesson-target");
    const selector = LESSON_TARGETS[topic];
    highlighted = selector ? document.querySelectorAll(selector) : [];
    for (const target of highlighted) target.classList.add("lesson-target");
  }

  function place(inLesson) {
    if (inLesson && panel.parentElement !== lesson) lesson.append(panel);
    if (!inLesson && panel.parentElement !== corner) corner.prepend(panel);
    lesson.classList.toggle("hidden", !inLesson);
  }

  function stop() {
    clearInterval(timer);
    timer = null;
    typing?.abort();
    typing = null;
    gestureEndsAt = 0;
    portrait.dataset.action = "idle";
    highlight();
  }

  function sync(visible) {
    const state = getState();
    if (visible && timer && mountedState === state) return;
    stop();
    if (!visible) return;
    mountedState = state;
    text.textContent = state.last?.text ?? COMDORI_STANDBY;
    setEvent(state.last?.event);
    const inLesson = panel.dataset.event.startsWith("lesson:");
    place(inLesson);
    if (inLesson) highlight(panel.dataset.event.slice("lesson:".length));
    idleAt = Date.now() + newDelay(42000, 62000);
    gestureAt = Date.now() + newDelay(18000, 34000);
    timer = setInterval(tick, 600);
  }

  function say(line) {
    const controller = new AbortController();
    typing = controller;
    gestureEndsAt = 0;
    portrait.dataset.action = "talking";
    setEvent(line.event);
    text.replaceChildren();
    text.parentElement.scrollTop = 0;
    dialogueLine(text, line.text, { letterMs: 31, maxMs: 1800, signal: controller.signal }).then(() => {
      if (controller.signal.aborted) return;
      portrait.dataset.action = "idle";
      typing = null;
    });
    onChange();
  }

  function tick() {
    if (!timer || document.hidden || paused() || typing || panel.parentElement === lesson) return;
    const now = Date.now();
    const state = getState();
    if (now >= idleAt) {
      idleAt = now + newDelay(46000, 70000);
      if (!state.pending.length && (!state.last || now - state.last.at >= 30000)) {
        const topic = getShift() >= 7 && Math.random() < .25 ? "foreshadow" : "idle";
        if (!queueCompanionEvent(state, topic, now, getShift()) && topic !== "idle") {
          queueCompanionEvent(state, "idle", now, getShift());
        }
      }
    }
    const line = takeCompanionLine(state, now);
    if (line) {
      say(line);
      return true;
    } else if (gestureEndsAt && now >= gestureEndsAt) {
      portrait.dataset.action = "idle";
      gestureEndsAt = 0;
    } else if (now >= gestureAt) {
      gestureAt = now + newDelay(18000, 34000);
      gestureEndsAt = now + 1440;
      portrait.dataset.action = "working";
    }
  }

  function emit(event) {
    if (!timer || !queueCompanionEvent(getState(), event, Date.now(), getShift())) return false;
    if (!tick()) onChange();
    return true;
  }

  const survivalLessons = {
    time: "위는 남은 근무 시간입니다. 약속 타이머는 코드를 쓰거나 검색할 때 흐르고, 제출하면 업무 시간이 차감돼요.",
    score: "업무가 끝나서 완료 건수와 평판이 올랐어요. 평판이 높으면 일을 더 가져올 수도 있습니다.",
    stress: "스트레스가 60, 75, 90을 넘으면 업무 시간이 더 듭니다. 커피나 지뢰찾기에도 시간이 들어요.",
    deadline: "두 번째 토요일이 최종 납품입니다. 필수 업무와 추가 일감을 끝내고 배포 검수를 통과하세요.",
  };

  function teach(topic) {
    if (!timer) return;
    if (!topic) {
      if (panel.parentElement !== lesson) return;
      typing?.abort();
      typing = null;
      portrait.dataset.action = "idle";
      setEvent();
      text.textContent = COMDORI_STANDBY;
      highlight();
      place(false);
      return;
    }
    const state = getState();
    const id = "lesson:" + topic;
    if (state.seen.includes(id)) return;
    place(true);
    highlight(topic);
    state.seen.push(id);
    state.pending = state.pending.filter(({ event }) => !["coding", "idle", "success"].includes(event));
    state.last = { id, event: id, text: (survival() && survivalLessons[topic]) || TUTORIAL_LINES[topic], at: Date.now() };
    typing?.abort();
    say(state.last);
  }

  return { emit, sync, teach, tick };
}
