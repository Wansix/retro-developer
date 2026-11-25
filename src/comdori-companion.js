import { queueCompanionEvent, takeCompanionLine } from "./comdori-commentary.js";
import { COMDORI_STANDBY } from "./comdori-lines.js";
import { dialogueLine } from "./dialogue.js";

const newDelay = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

export function mountOfficeCompanion({ getState, getShift, paused, onChange }) {
  const panel = document.getElementById("compdori-panel");
  const portrait = document.getElementById("compdori-face");
  const text = document.getElementById("compdori-text");
  let mountedState;
  let timer;
  let typing;
  let idleAt;
  let gestureAt;
  let gestureEndsAt = 0;

  function stop() {
    clearInterval(timer);
    timer = null;
    typing?.abort();
    typing = null;
    gestureEndsAt = 0;
    portrait.dataset.action = "idle";
  }

  function sync(visible) {
    const state = getState();
    if (visible && timer && mountedState === state) return;
    stop();
    if (!visible) return;
    mountedState = state;
    text.textContent = state.last?.text ?? COMDORI_STANDBY;
    panel.dataset.event = state.last?.event ?? "";
    idleAt = Date.now() + newDelay(42000, 62000);
    gestureAt = Date.now() + newDelay(18000, 34000);
    timer = setInterval(tick, 600);
  }

  function say(line) {
    const controller = new AbortController();
    typing = controller;
    gestureEndsAt = 0;
    portrait.dataset.action = "talking";
    panel.dataset.event = line.event;
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
    if (!timer || document.hidden || paused() || typing) return;
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
    if (!timer || !queueCompanionEvent(getState(), event, Date.now(), getShift())) return;
    if (!tick()) onChange();
  }

  return { emit, sync, tick };
}
