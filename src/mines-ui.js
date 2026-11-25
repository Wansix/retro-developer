import { canPlayMines, playMinesAction } from "./office.js";
import { MINE_BREAK_COST, MINE_COUNT, MINE_SIZE, nearbyMines } from "./mines.js";
import { formatMinutes } from "./records-schema.js";

export function mountMinesWindow({ state, active, busy, recordBest, onChange, onWarning }) {
  const $ = id => document.getElementById(id);
  const dialog = $("mines-window");
  const launch = $("mines-launch");
  const cells = Array.from({ length: MINE_SIZE ** 2 }, (_, index) => {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "mine-cell";
    cell.onclick = () => input(flagMode ? "flag" : "reveal", index);
    cell.oncontextmenu = event => {
      event.preventDefault();
      input("flag", index);
    };
    cell.onkeydown = event => {
      if (event.key.toLowerCase() !== "f") return;
      event.preventDefault();
      input("flag", index);
    };
    return cell;
  });
  $("mines-board").append(...cells);
  let clock;
  let lastTick;
  let flagMode = false;

  const open = () => state()?.leisure?.open;
  const running = () => active() && !state()?.ending && (open() || state()?.leisure?.cooldown);

  function sync() {
    const run = state();
    const leisure = run?.leisure;
    const visible = active() && !run?.ending && leisure?.open;
    if (visible && !dialog.open) dialog.showModal();
    if (!visible && dialog.open) dialog.close();
    launch.disabled = !run || !active() || busy() || !canPlayMines(run) || dialog.open;
    launch.title = leisure?.cooldown ? "이 대리: 김 과장이 지나갈 때까지만 기다려." : `한 번 열면 업무 시간 ${MINE_BREAK_COST}분 소모`;
    if (running() && !clock) {
      lastTick = performance.now();
      clock = setInterval(flushTime, 200);
    } else if (!running() && clock) {
      clearInterval(clock);
      clock = null;
    }
    if (dialog.open) paint();
  }

  function text(id, value) {
    const element = $(id);
    if (element.textContent !== value) element.textContent = value;
  }

  function paint() {
    const run = state();
    const { board, warning } = run.leisure;
    const shownMines = board.result === "lost";
    const flags = board.tiles.filter(value => value === 2).length;
    const best = recordBest();
    dialog.dataset.warning = String(Boolean(warning));
    text("mines-count", `⚑ ${MINE_COUNT - flags}`);
    text("mines-seconds", `◷ ${board.seconds}초`);
    text("mines-best", best ? `최고 기록 ${best}초` : "최고 기록 —");
    text("mines-budget", `업무 ${formatMinutes(run.remaining)} · 스트레스 ${run.stress}/100`);
    text("mines-warning", warning ? `이 대리: 발소리야! ${warning}초 안에 창을 숨겨!` : "");
    text("mines-status", { playing: "숫자는 주변의 지뢰 수예요.", won: "지뢰 제거 완료!", lost: "지뢰를 밟았어요." }[board.result]);
    $("mines-flag").setAttribute("aria-pressed", String(flagMode));
    $("mines-reset").disabled = !board.mines && !flags;
    for (const [index, cell] of cells.entries()) {
      const level = board.tiles[index];
      const mine = shownMines && board.mines.includes(index);
      const count = level === 1 && !mine ? nearbyMines(board, index) : null;
      cell.dataset.tile = mine ? "mine" : level === 1 ? "clear" : level === 2 ? "flag" : "covered";
      const value = mine ? "✹" : level === 2 ? "⚑" : count ? String(count) : "";
      if (cell.textContent !== value) cell.textContent = value;
      cell.setAttribute("aria-label", `${Math.floor(index / MINE_SIZE) + 1}행 ${index % MINE_SIZE + 1}열, ${mine ? "지뢰" : level === 2 ? "깃발" : count !== null ? `주변 지뢰 ${count}개` : "닫힌 칸"}`);
      cell.setAttribute("aria-disabled", String(board.result !== "playing" || level === 1));
    }
  }

  function dispatch(action, value) {
    const run = state();
    if (!run?.leisure) return false;
    const warning = run.leisure.warning;
    const wasOpen = run.leisure.open;
    const time = run.remaining;
    const wins = run.stats.minesWins;
    if (!playMinesAction(run, action, value)) return false;
    if (run.stats.minesWins > wins) recordBest(run.leisure.board.seconds);
    if (!warning && run.leisure.warning && run.leisure.open) onWarning();
    sync();
    onChange({
      closed: wasOpen && !run.leisure.open ? run.leisure.reason : null,
      timeChanged: run.remaining !== time,
      opened: !wasOpen && run.leisure.open,
    });
    return true;
  }

  function flushTime() {
    if (!running()) return;
    const now = performance.now();
    const seconds = Math.floor((now - lastTick) / 1000);
    if (!seconds) return;
    const { open: visible, warning, untilAlert } = state().leisure;
    const elapsed = Math.min(seconds, visible && !warning ? untilAlert : 120);
    lastTick = elapsed < seconds ? now : lastTick + elapsed * 1000;
    dispatch("tick", elapsed);
  }

  function input(action, value) {
    flushTime();
    if (!busy()) dispatch(action, value);
  }

  launch.onclick = () => input("open");
  $("mines-minimize").onclick = $("mines-close").onclick = () => input("hide");
  $("mines-flag").onclick = () => { flagMode = !flagMode; paint(); };
  $("mines-reset").onclick = () => { flagMode = false; input("reset"); };
  dialog.oncancel = event => {
    event.preventDefault();
    input("hide");
  };
  return { sync, dialog };
}
