function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function drawInstructor(canvas, talking) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, 30, 38);
  const rect = (color, x, y, w, h) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
  rect("#163846", 3, 30, 24, 8);
  rect("#49786b", 5, 28, 20, 10);
  rect("#65a284", 9, 27, 12, 11);
  rect("#53332d", 8, 9, 14, 16);
  rect("#bd835d", 9, 11, 12, 13);
  rect("#d7a478", 10, 12, 9, 10);
  rect("#29242c", 8, 7, 14, 5);
  rect("#29242c", 9, 5, 11, 3);
  rect("#29242c", 7, 9, 3, 7);
  rect("#29242c", 20, 9, 3, 7);
  rect("#373344", 9, 14, 12, 1);
  rect("#373344", 10, 15, 4, 3);
  rect("#373344", 16, 15, 4, 3);
  rect("#efe6cb", 11, 15, 2, 1);
  rect("#efe6cb", 17, 15, 2, 1);
  rect("#553139", 13, 21, 4, talking ? 2 : 1);
  rect("#e4d6a7", 16, 33, 4, 2);
  rect("#bd835d", 25, talking ? 23 : 27, 3, 4);
  rect("#49786b", 24, talking ? 27 : 31, 3, 5);
  rect("#f4ecca", 27, talking ? 22 : 26, 2, 1);
}

export function buildLecture(lesson, clip, { hasPlayed, onPlay, onWatched, onChange, onClose }) {
  const player = element("section", "", "internet-lecture");
  const stage = element("div", "", "lecture-stage");
  const portrait = element("canvas", "", "lecture-avatar");
  portrait.width = 30;
  portrait.height = 38;
  portrait.setAttribute("aria-hidden", "true");
  const chalk = element("div", "", "lecture-chalk");
  const key = element("p");
  const code = element("pre");
  chalk.append(key, code);
  stage.append(portrait, chalk);
  const caption = element("p", "", "lecture-caption");
  const progress = element("progress");
  progress.max = lesson.duration;
  progress.setAttribute("aria-label", "강의 재생 위치");
  const time = element("span", "", "lecture-duration");
  const controls = element("div", "", "lecture-controls");
  const play = element("button");
  const mute = element("button");
  const repeat = element("button", "다시 보기");
  const close = element("button", "닫기");
  controls.append(play, mute, repeat, close);
  player.append(stage, caption, progress, time, controls);
  const speech = window.speechSynthesis;
  const voice = () => speech?.getVoices().find(candidate => candidate.localService && /^en(?:[-_]|$)/i.test(candidate.lang));
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let interval;
  let started;
  let position = clip.position ?? 0;
  let previousFrame;
  let utterance;

  function speak(text) {
    if (clip.muted || !speech || !window.SpeechSynthesisUtterance) return;
    const localVoice = voice();
    if (!localVoice) return;
    utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = localVoice;
    utterance.lang = localVoice.lang;
    utterance.rate = 1.2;
    speech.speak(utterance);
  }

  function paint() {
    const active = !!interval;
    const frame = lesson.frames.findLast(line => line.at <= position) ?? lesson.frames[0];
    if (frame !== previousFrame) {
      key.textContent = frame.board;
      code.textContent = frame.code;
      caption.textContent = frame.caption;
      if (active) speak(frame.caption);
      previousFrame = frame;
    }
    drawInstructor(portrait, active && !reduced.matches && Math.floor(position * 7) % 2 === 0);
    progress.value = position;
    time.textContent = `0:${String(Math.floor(position)).padStart(2, "0")} / 0:${lesson.duration}`;
    play.textContent = active ? "일시 정지" : hasPlayed() ? "▶ 재생 · 무료" : "▶ 최초 재생 · " + clip.cost + "분";
    mute.textContent = clip.muted ? "음소거 해제" : "음소거";
    mute.setAttribute("aria-pressed", String(!!clip.muted));
    repeat.disabled = !hasPlayed();
  }

  function stop() {
    clearInterval(interval);
    interval = null;
    if (utterance) speech.cancel();
    utterance = null;
    clip.position = position;
    onChange();
    paint();
  }

  function tick() {
    position = Math.min(lesson.duration, (performance.now() - started) / 1000);
    clip.position = position;
    if (position === lesson.duration) {
      stop();
      onWatched();
    } else paint();
  }

  function start(restart = false) {
    if (!onPlay()) return;
    if (restart || position >= lesson.duration) position = 0;
    previousFrame = null;
    started = performance.now() - position * 1000;
    interval = setInterval(tick, 100);
    paint();
  }

  play.onclick = () => interval ? stop() : start();
  mute.onclick = () => {
    clip.muted = !clip.muted;
    if (clip.muted && utterance) speech.cancel();
    onChange();
    paint();
  };
  repeat.onclick = () => { stop(); start(true); };
  close.onclick = onClose;
  paint();
  return { player, stop };
}
