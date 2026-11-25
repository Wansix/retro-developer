import { COMDORI_LINES } from "./comdori-lines.js";

const MAX_PENDING = 6;
const intervalFor = priority => priority >= 4 ? 7000 : priority === 3 ? 11000 : 18000;
const expiresAfter = priority => priority >= 4 ? 65000 : priority === 1 ? 12000 : 36000;

export function newCompanionState() {
  return { seen: [], byEvent: {}, pending: [], last: null };
}

function remainingLines(state, event) {
  return COMDORI_LINES[event].lines
    .map((text, index) => ({ id: event + ":" + index, text, event }))
    .filter(line => !state.seen.includes(line.id));
}

function priorityFor(state, event) {
  return COMDORI_LINES[event].priority + (state.byEvent[event] == null ? .5 : 0);
}

export function queueCompanionEvent(state, event, now, shift) {
  if (!Object.hasOwn(COMDORI_LINES, event)) return false;
  const group = COMDORI_LINES[event];
  if (shift < (group.minShift ?? 0) || !remainingLines(state, event).length) return false;
  if (state.byEvent[event] != null && now - state.byEvent[event] < (group.cooldown ?? 0)) return false;
  if (state.pending.some(item => item.event === event)) return false;
  if (event === "scolded") state.pending = state.pending.filter(item => item.event !== "mines");
  if (group.priority > 1) state.pending = state.pending.filter(item => COMDORI_LINES[item.event].priority > 1);
  state.pending.push({ event, now });
  state.pending.sort((a, b) => priorityFor(state, b.event) - priorityFor(state, a.event) || a.now - b.now);
  if (state.pending.length > MAX_PENDING) state.pending.length = MAX_PENDING;
  return state.pending.some(item => item.event === event);
}

export function takeCompanionLine(state, now, random = Math.random) {
  state.pending = state.pending.filter(item => now - item.now <= expiresAfter(COMDORI_LINES[item.event].priority));
  const entry = state.pending[0];
  if (!entry) return null;
  const { event } = entry;
  const group = COMDORI_LINES[event];
  if (state.last && now - state.last.at < intervalFor(group.priority)) return null;
  state.pending.shift();
  const pool = remainingLines(state, event);
  if (!pool.length) return null;
  const first = state.byEvent[event] == null && !group.randomFirst;
  const line = first ? pool[0] : pool[Math.floor(random() * pool.length)];
  state.seen.push(line.id);
  state.byEvent[event] = now;
  state.last = { ...line, at: now };
  return line;
}
