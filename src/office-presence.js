const BOSS_LINES = {
  mobile: "신입, 휴대폰으로 코딩해? …잘 되면 나한테도 한번 보여줘.",
  mobileWork: "업무 시간에 누가 폰 보래? 아, 검수 중이라고? 화면이 너무 작아서 몰랐네.",
  tab: "자네, 아까 다른 창으로 갔던데. 찾아보던 건 해결됐어?",
  window: "볼일은 다 봤나? 이쪽은 아까 화면 그대로야.",
  pointer: "신입, 어디 가나? 작업 창은 열어 둬.",
  idle: "신입, 자나? 아니면 또 어디서부터 설명할지 생각 중이야?",
  weekend: "주말에 자발적으로 출근했네. 여기 달력에는 평일이긴 한데.",
};

// Signals are processed locally. The run only stores which lines have already played.
export function mountOfficePresence({ active, available, read, save, boss, companion }) {
  const mobile = matchMedia("(hover: none) and (pointer: coarse)");
  let lastInput = Date.now();
  let lastLine = 0;
  let away = null;
  let returned = null;
  let pointerTimer;
  let clockPending = true;

  function say(kind) {
    if (!active() || !available() || document.hidden || Date.now() - lastLine < 65000 || read().includes(kind)) return false;
    const said = BOSS_LINES[kind] ? (boss(BOSS_LINES[kind]), true) : companion(kind);
    if (!said) return false;
    lastLine = Date.now();
    save(kind);
    return true;
  }

  function input() {
    if (active()) lastInput = Date.now();
    clearTimeout(pointerTimer);
  }

  function leave(tab) {
    clearTimeout(pointerTimer);
    if (!active()) return;
    away ??= { at: Date.now(), tab: false };
    if (tab) away.tab = true;
  }

  function returnToWork() {
    if (document.hidden || !document.hasFocus() || !away) return;
    const absence = away;
    away = null;
    input();
    if (Date.now() - absence.at >= 5000) {
      const kind = absence.tab ? "tab" : "window";
      if (!say(kind)) returned = { kind, expires: Date.now() + 10000 };
    }
  }

  document.addEventListener("visibilitychange", () => document.hidden ? leave(true) : returnToWork());
  window.addEventListener("blur", () => leave(false));
  window.addEventListener("focus", returnToWork);
  document.addEventListener("pointerdown", input, { passive: true });
  document.addEventListener("pointermove", input, { passive: true });
  document.addEventListener("wheel", input, { passive: true });
  document.addEventListener("keydown", input);
  document.documentElement.addEventListener("pointerenter", input, { passive: true });
  document.documentElement.addEventListener("pointerleave", event => {
    if (event.pointerType !== "mouse" || !active()) return;
    clearTimeout(pointerTimer);
    pointerTimer = setTimeout(() => {
      if (document.hasFocus() && Math.random() < 0.2) say("pointer");
    }, 1800);
  });

  setInterval(() => {
    if (!active() || away || document.hidden || !document.hasFocus()) return;
    if (returned) {
      if (Date.now() > returned.expires || read().includes(returned.kind)) returned = null;
      else if (say(returned.kind)) { returned = null; return; }
    }
    if (clockPending && available() && Date.now() - lastInput >= 2500) {
      const now = new Date();
      const kind = now.getHours() < 5 ? "lateLocal" : [0, 6].includes(now.getDay()) ? "weekend" : mobile.matches ? "mobile" : null;
      clockPending = !!kind && !read().includes(kind) && !say(kind);
      if (kind) return;
    }
    const idle = Date.now() - lastInput;
    if (idle >= 100000 && say("longIdle")) return;
    if (idle >= 30000) say("idle");
  }, 2000);

  return {
    reset() {
      away = null;
      returned = null;
      input();
      lastLine = 0;
      clockPending = true;
    },
    work() {
      input();
      if (mobile.matches) say("mobileWork");
    },
  };
}
