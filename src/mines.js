import { hasSurvival, lowHealthStress, SURVIVAL } from "./survival.js";
import { seededShuffle, seedValue } from "./seeded.js";

export const MINE_SIZE = 5;
export const MINE_COUNT = 4;
export const MINE_BREAK_COST = 5;
export const MINE_INTERVAL = 10;
export const MINE_WARNING_SECONDS = 4;
const TILE_COUNT = MINE_SIZE ** 2;
const CELLS = Array.from({ length: TILE_COUNT }, (_, index) => index);
const HIDDEN = 0;
const REVEALED = 1;
const FLAGGED = 2;

export function newMineBoard(round = 0) {
  return { round, tiles: Array(TILE_COUNT).fill(HIDDEN), mines: null, result: "playing", seconds: 0 };
}

export function mineNeighbors(cell) {
  const row = Math.floor(cell / MINE_SIZE);
  const col = cell % MINE_SIZE;
  return CELLS.filter(index => index !== cell &&
    Math.abs(Math.floor(index / MINE_SIZE) - row) <= 1 && Math.abs(index % MINE_SIZE - col) <= 1);
}

export function nearbyMines(board, cell) {
  return mineNeighbors(cell).filter(index => board.mines?.includes(index)).length;
}

function reveal(board, cell, seed) {
  if (board.tiles[cell] !== HIDDEN) return false;
  if (!board.mines) {
    const safe = new Set([cell, ...mineNeighbors(cell)]);
    board.mines = seededShuffle(CELLS.filter(index => !safe.has(index)), seed, 100 + 37 * board.round).slice(0, MINE_COUNT);
  }
  if (board.mines.includes(cell)) {
    board.tiles[cell] = REVEALED;
    board.result = "lost";
    return true;
  }
  const queue = [cell];
  for (let i = 0; i < queue.length; i++) {
    const index = queue[i];
    if (board.tiles[index] !== HIDDEN) continue;
    board.tiles[index] = REVEALED;
    if (nearbyMines(board, index) === 0) queue.push(...mineNeighbors(index));
  }
  if (board.tiles.filter(tile => tile === REVEALED).length === TILE_COUNT - MINE_COUNT) {
    board.result = "won";
    board.seconds = Math.max(board.seconds, 1);
  }
  return true;
}

export function initLeisure(state) {
  state.leisure = { board: newMineBoard(), open: false, untilAlert: 0, warning: 0, cooldown: 0, visit: 0, session: 0, reason: "" };
  Object.assign(state.stats, { minesSeconds: 0, minesMinutes: 0, minesCaught: 0, minesHidden: 0, minesWins: 0 });
}

export function award(state, name) {
  if (!state.achievements.includes(name)) state.achievements.push(name);
}

function closeLeisure(leisure, reason) {
  leisure.open = false;
  leisure.reason = reason;
}

function spendBreak(state) {
  const spent = Math.min(state.remaining, MINE_BREAK_COST);
  state.remaining -= spent;
  state.stats.minesMinutes += spent;
  state.stress = Math.max(0, state.stress - spent);
}

function caught(state) {
  const leisure = state.leisure;
  const count = ++state.stats.minesCaught;
  const trustLoss = Math.min(14, 5 + 3 * count);
  state.stats.reportTrust = Math.max(0, state.stats.reportTrust - trustLoss);
  state.score -= count === 1 ? 5 : 8;
  state.stress = Math.min(100, state.stress + (hasSurvival(state) ? lowHealthStress(state, 12) : 12));
  if (count > 1) state.scope++;
  if (count >= 3) award(state, "현행범");
  leisure.visit++;
  closeLeisure(leisure, "caught");
  state.effects = [`지뢰찾기 발각 · 보고 신뢰도 −${trustLoss} · ${hasSurvival(state) ? "평판" : "인사평가"} −${count === 1 ? 5 : 8}${count > 1 ? " · 추가 일감 +1건" : ""}`];
}

export function canOpenLeisure(state) {
  return state.leisure && !state.leisure.open && !state.leisure.cooldown && state.remaining >= MINE_BREAK_COST;
}

function tick(state, seconds) {
  const leisure = state.leisure;
  let elapsed = 0;
  while (elapsed < seconds && (leisure.open || leisure.cooldown)) {
    elapsed++;
    if (!leisure.open) {
      leisure.cooldown--;
      continue;
    }
    leisure.session++;
    state.stats.minesSeconds++;
    if (leisure.board.mines && leisure.board.result === "playing") leisure.board.seconds++;
    if (state.stats.minesSeconds >= 60) award(state, "월급 루팡");
    if (leisure.warning) {
      if (--leisure.warning === 0) {
        caught(state);
        continue;
      }
    } else if (--leisure.untilAlert === 0) {
      leisure.warning = MINE_WARNING_SECONDS + (hasSurvival(state) && state.stats.reportTrust >= SURVIVAL.meetingTrust.high ? 2 : 0);
    }
    if (leisure.session % MINE_INTERVAL === 0) {
      spendBreak(state);
      if (state.remaining === 0) {
        if (leisure.warning) leisure.visit++;
        leisure.warning = leisure.untilAlert = 0;
        closeLeisure(leisure, "expired");
      }
    }
  }
  return elapsed;
}

export function applyLeisure(state, action, value, mayOpen) {
  const leisure = state.leisure;
  if (!leisure || state.ending) return false;
  switch (action) {
    case "open":
      if (!mayOpen || !canOpenLeisure(state)) return false;
      leisure.open = true;
      leisure.reason = "";
      leisure.session = 0;
      const trusted = hasSurvival(state) && state.stats.reportTrust >= SURVIVAL.meetingTrust.high;
      leisure.untilAlert ||= 8 + seedValue(state.seed, 300 + leisure.visit) % 13 + (trusted ? 4 : 0);
      spendBreak(state);
      return true;
    case "hide":
      if (!leisure.open) return false;
      if (leisure.warning) {
        leisure.cooldown = leisure.warning;
        leisure.warning = 0;
        leisure.untilAlert = 0;
        leisure.visit++;
        if (++state.stats.minesHidden >= 3) award(state, "완벽한 위장");
      }
      closeLeisure(leisure, "hidden");
      return true;
    case "tick":
      return Number.isInteger(value) && value > 0 && value <= 120 ? tick(state, value) : false;
    case "reset":
      if (!leisure.open || (!leisure.board.mines && !leisure.board.tiles.includes(FLAGGED))) return false;
      leisure.board = newMineBoard(leisure.board.round + 1);
      return true;
    case "flag":
    case "reveal": {
      const board = leisure.board;
      if (!leisure.open || board.result !== "playing" || !Number.isInteger(value) || value < 0 || value >= TILE_COUNT) return false;
      if (action === "flag") {
        if (board.tiles[value] === REVEALED) return false;
        if (board.tiles[value] === HIDDEN && board.tiles.filter(tile => tile === FLAGGED).length >= MINE_COUNT) return false;
        board.tiles[value] = board.tiles[value] === FLAGGED ? HIDDEN : FLAGGED;
        return true;
      }
      if (!reveal(board, value, state.seed)) return false;
      if (board.result === "won") state.stats.minesWins++;
      return true;
    }
    default: return false;
  }
}
