const SOUND_KEY = "retro-dialogue-sound";
const AudioEngine = window.AudioContext ?? window.webkitAudioContext;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const WAIT = 52;
const PITCH = { me: 385, ai: 510, boss: 290, terminal: 455 };
const NOTES = [1, 1.11, 1.04, 0.94];

let enabled = true;
let context;
let volume;
let lastTick = -Infinity;

export function initDialogueSound(button) {
  if (!AudioEngine) return;
  try { enabled = localStorage.getItem(SOUND_KEY) !== "off"; } catch { /* Use the default. */ }

  function update() {
    button.textContent = `대사 소리 ${enabled ? "켜짐" : "꺼짐"}`;
    button.setAttribute("aria-pressed", String(enabled));
    if (volume) volume.gain.value = enabled ? 1 : 0;
  }

  button.addEventListener("click", () => {
    enabled = !enabled;
    try { localStorage.setItem(SOUND_KEY, enabled ? "on" : "off"); } catch { /* Keep the setting for this page. */ }
    update();
  });

  // A trusted click also unlocks audio when the user skips the prologue or resumes a save.
  document.addEventListener("click", (event) => {
    if (!event.isTrusted || !enabled || context?.state === "running") return;
    try {
      if (!context) {
        context = new AudioEngine();
        volume = context.createGain();
        volume.connect(context.destination);
      }
      context.resume().catch(() => {});
    } catch { /* Dialogue remains readable without audio. */ }
  });
  button.parentElement.hidden = false;
  update();
}

function blip(voice, index) {
  if (!enabled || context?.state !== "running" || document.hidden) return;
  const now = context.currentTime;
  if (now - lastTick < WAIT / 1000) return;
  lastTick = now;
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  const frequency = PITCH[voice] * NOTES[index % NOTES.length];
  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(frequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(frequency * .82, now + .042);
  envelope.gain.setValueAtTime(.001, now);
  envelope.gain.linearRampToValueAtTime(voice === "terminal" ? .038 : .065, now + .004);
  envelope.gain.exponentialRampToValueAtTime(.001, now + .042);
  oscillator.connect(envelope).connect(volume);
  oscillator.onended = () => envelope.disconnect();
  oscillator.start(now);
  oscillator.stop(now + .045);
}

export function typeDialogue(node, text, { voice, maxMs = 950, letterMs = 24, signal, onFrame }) {
  const letters = Array.from(text);
  const interval = Math.min(letterMs, maxMs / Math.max(letters.length, 1));
  return new Promise((resolve) => {
    let index = 0;
    function tick() {
      if (signal?.aborted) return resolve();
      if (reducedMotion.matches || document.hidden || index >= letters.length) {
        node.appendData(letters.slice(index).join(""));
        onFrame?.();
        resolve();
        return;
      }
      const letter = letters[index];
      node.appendData(letter);
      if (/[\p{L}\p{N}]/u.test(letter)) blip(voice, index);
      index++;
      onFrame?.();
      setTimeout(tick, interval);
    }
    tick();
  });
}
