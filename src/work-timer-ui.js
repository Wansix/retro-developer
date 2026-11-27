import { burstRecoveryCost, canBurst, canSubmit, codingCost, currentMission, isCoding, recordTaskTime } from "./office.js";
import { formatMinutes, formatSeconds } from "./records-schema.js";
import { daysUntilDelivery, hasSurvival, SURVIVAL } from "./survival.js";
import { playDeadlineCue } from "./dialogue.js";

export function mountWorkTimer({ getState, isActive, isPaused, researching, save, onDefer, onBurst, onTimeout, onBudgetChange }) {
  const $ = id => document.getElementById(id);
  const screen = $("screen-office");
  const clock = $("task-clock");
  const defer = $("task-defer");
  const launch = $("burst-launch");
  const effects = $("burst-effects");
  let cursor = performance.now();
  let tracked;
  let ticking = false;
  let affordable;
  let carry = 0;
  let urgency = "";
  let focused = false;
  let musicTick = 0;
  try { effects.checked = localStorage.getItem("retro-deadline-effects") !== "off"; } catch { /* Use the default. */ }

  function paint(s, active, task, paused) {
    const burst = active && !!s.burst.remaining;
    const urgent = active && daysUntilDelivery(s) <= 1;
    const canLaunch = active && canBurst(s);
    const covered = active && isCoding(s.phase) && !!task;
    $("task-tools").classList.toggle("hidden", !covered && !canLaunch && !burst);
    for (const node of [clock, defer]) node.classList.toggle("hidden", !covered);
    defer.disabled = paused;
    launch.classList.toggle("hidden", !canLaunch);
    launch.disabled = paused;
    $("burst-status").classList.toggle("hidden", !burst);
    if (burst) $("burst-status").textContent = `BURST · ${formatMinutes(s.burst.remaining)} · 종료 시 최대 체력 −${burstRecoveryCost(s)}`;
    screen.classList.toggle("deadline-office", urgent);
    screen.classList.toggle("burst-effects", effects.checked);
    screen.classList.toggle("burst-active", burst);
    if (burst) screen.classList.remove("burst-crash");
    if (focused && !burst && active) screen.classList.add("burst-crash");
    focused = burst;
    if (!covered) return;
    const left = task.limit + task.burstBonus - task.elapsed;
    const nextUrgency = left < 0 ? "exceeded" : left <= 15 ? "soon" : "";
    if (nextUrgency !== urgency && nextUrgency) {
      $("task-alert").textContent = nextUrgency === "exceeded" ? "약속한 시간을 넘겼습니다." : "약속까지 15초 남았습니다.";
      if (effects.checked) playDeadlineCue(nextUrgency);
    }
    urgency = nextUrgency;
    clock.dataset.urgency = urgency;
    $("task-clock-label").textContent = paused ? "일시 정지" : left < 0 ? "초과" : "약속까지";
    $("task-countdown").textContent = formatSeconds(Math.abs(left));
  }

  function step(force = false) {
    const s = getState();
    const active = !!s && hasSurvival(s) && !s.ending && isActive();
    const task = active ? s.task : null;
    const paused = !active || !task || !isCoding(s.phase) || isPaused();
    const now = performance.now();
    if (task !== tracked) {
      tracked = task;
      carry = task?.subsecond ?? 0;
      ticking = false;
      urgency = "";
      affordable = undefined;
    }
    if (ticking && (!paused || force)) carry += Math.max(0, now - cursor);
    ticking = !paused;
    cursor = now;
    if (task && (ticking || force) && carry >= 1000) {
      const seconds = Math.min(SURVIVAL.timer.sessionCapSeconds - task.elapsed, Math.floor(carry / 1000));
      carry %= 1000;
      task.subsecond = carry;
      const previousTimeouts = s.stats.timeouts;
      if (seconds && recordTaskTime(s, seconds, researching())) {
        save();
        const button = $(currentMission(s).type === "code" ? "btn-submit" : "challenge-submit");
        if (!paused) {
          button.textContent = `업무 제출 · ${formatMinutes(codingCost(s))}`;
          const canAfford = canSubmit(s);
          if (affordable !== undefined && canAfford !== affordable) onBudgetChange();
          affordable = canAfford;
        }
        if (s.stats.timeouts > previousTimeouts) onTimeout();
      }
    }
    if (task) {
      task.subsecond = carry;
      if (affordable === undefined) affordable = canSubmit(s);
    }
    paint(s, active, task, isPaused());
    const music = active && effects.checked && (focused || daysUntilDelivery(s) <= 1) && !document.hidden;
    if (music && now >= musicTick) {
      musicTick = now + (focused ? 1150 : 2400);
      playDeadlineCue(focused ? "burst" : "shift");
    }
  }

  defer.onclick = onDefer;
  launch.onclick = onBurst;
  effects.onchange = () => {
    try { localStorage.setItem("retro-deadline-effects", effects.checked ? "on" : "off"); } catch { /* Keep the current selection. */ }
    step();
  };
  document.addEventListener("visibilitychange", () => step(true));
  window.addEventListener("pagehide", () => { step(true); if (getState() && isActive()) save(); });
  setInterval(step, 180);
  return { sync: () => step(), flush: () => step(true) };
}
