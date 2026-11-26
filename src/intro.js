import { dialogueLine } from "./dialogue.js";
import { PROLOGUE_2026 } from "./missions.js";

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const CART_DISPLAY = {
  baseline: ["장바구니 2개", "쿠폰 5,000원 할인"],
  rollback: ["장바구니 0개", "담긴 상품과 쿠폰이 없어요"],
  regression: ["장바구니 오류", "장바구니를 불러오지 못했어요"],
};

export function playIntro(onDone) {
  const transcript = document.getElementById("intro-transcript");
  const comdori = document.getElementById("intro-comdori");
  const status = document.getElementById("intro-status");
  const speak = document.getElementById("intro-speak");
  const speakLabel = document.getElementById("intro-speak-label");
  const speakText = document.getElementById("intro-speak-text");
  const speakAction = document.getElementById("intro-speak-action");
  const preview = document.getElementById("intro-preview");
  const previewAddress = document.getElementById("intro-preview-address");
  const loginCard = document.getElementById("intro-preview-login-card");
  const accountCard = document.getElementById("intro-preview-account-card");
  const login = document.getElementById("intro-preview-login");
  const account = document.getElementById("intro-preview-account");
  const banner = document.getElementById("intro-preview-banner");
  const error = document.getElementById("intro-preview-error");
  const cart = document.getElementById("intro-preview-cart");
  const cartDetail = document.getElementById("intro-preview-cart-detail");
  const desktop = matchMedia("(pointer: fine)").matches;
  let previewAction;

  function previewFeedback(text, tone) {
    error.textContent = text;
    error.dataset.tone = tone;
    error.hidden = false;
  }

  function showPreview(state) {
    preview.dataset.state = state;
    previewAddress.textContent = "localhost:3000/login";
    loginCard.classList.remove("hidden");
    accountCard.classList.add("hidden");
    login.textContent = state === "wrong" ? "쇼핑 시작하기" : "로그인";
    banner.hidden = state !== "wrong";
    const [title, detail] = CART_DISPLAY[state === "wrong" ? "baseline" : state] ?? CART_DISPLAY.regression;
    cart.textContent = title;
    cartDetail.textContent = detail;
    account.hidden = state !== "falseSuccess" && state !== "repaired";
    error.hidden = true;
    if (state === "falseSuccess") previewFeedback("로그인됐어요.", "pass");
    if (state === "sessionError") previewFeedback("내 계정을 보려면 다시 로그인해 주세요.", "fail");
    if (state === "repaired") previewFeedback("로그인 상태가 유지돼요. 내 계정을 열 수 있어요.", "pass");
  }

  login.onclick = () => {
    if (previewAction?.target === "login") previewAction.proceed();
    else if (preview.dataset.state === "regression") previewFeedback("이메일 또는 비밀번호를 확인해 주세요.", "fail");
    else if (preview.dataset.state === "repaired") previewFeedback("로그인됐어요.", "pass");
  };
  account.onclick = () => {
    if (previewAction?.target === "account") previewAction.proceed();
    else if (preview.dataset.state === "repaired") {
      previewAddress.textContent = "localhost:3000/account";
      loginCard.classList.add("hidden");
      accountCard.classList.remove("hidden");
    }
  };

  function latest() {
    transcript.scrollTop = transcript.scrollHeight;
  }

  function append(marker, kind, text = "") {
    const row = document.createElement("div");
    row.className = `intro-row intro-${kind}`;
    const label = document.createElement("span");
    label.className = kind === "reply" || kind === "prompt" ? "intro-speaker" : "intro-marker";
    label.textContent = marker;
    const content = document.createElement(kind === "output" ? "pre" : "p");
    content.textContent = text;
    row.append(label, content);
    transcript.append(row);
    latest();
    return content;
  }

  function waiting(step) {
    const checking = step.who === "check";
    comdori.dataset.action = "idle";
    status.textContent = "내 차례";
    status.dataset.activity = "waiting";
    speakLabel.textContent = checking ? "미리보기 테스트" : "보낼 지시";
    speakText.textContent = step.text;
    speakAction.textContent = checking ? "확인하기" : "지시 보내기";
    speak.classList.remove("hidden");
    speak.disabled = false;
    if (desktop) speak.focus({ preventScroll: true });
    latest();
    return new Promise((resolve) => {
      const proceed = () => {
        speak.onclick = null;
        previewAction = undefined;
        speak.disabled = true;
        speakLabel.textContent = "에이전트 작업 중";
        speakText.textContent = "";
        if (checking) {
          showPreview(step.preview);
          append("↳", "output", `미리보기 · ${error.textContent}`).dataset.tone = error.dataset.tone;
        } else {
          append("나", "prompt", step.text);
        }
        status.textContent = "작업 중";
        status.dataset.activity = "working";
        comdori.dataset.action = "working";
        resolve();
      };
      speak.onclick = proceed;
      if (checking) previewAction = { target: step.target, proceed };
    });
  }

  async function replyToPlayer(text) {
    comdori.dataset.action = "talking";
    const reply = append("컴돌이", "reply");
    await dialogueLine(reply, text, { voice: "ai", onFrame: latest });
    comdori.dataset.action = "idle";
  }

  async function run() {
    transcript.replaceChildren();
    preview.classList.add("hidden");
    speak.classList.add("hidden");
    showPreview("baseline");
    status.textContent = "연결됨";
    status.dataset.activity = "";
    await replyToPlayer("어떤 작업을 할까요?");
    for (const step of PROLOGUE_2026) {
      if (step.who === "me" || step.who === "check") {
        await waiting(step);
        continue;
      }
      await pause(180);
      if (step.before) await replyToPlayer(step.before);
      if (step.tools?.length) comdori.dataset.action = "working";
      for (const { command, output, tone } of step.tools ?? []) {
        const line = append("$", "tool");
        await dialogueLine(line, command, { voice: "terminal", maxMs: 620, letterMs: 14, onFrame: latest });
        await pause(100);
        const result = append("↳", "output", tone === "diff" ? "" : output);
        if (tone === "diff") {
          for (const text of output.split("\n")) {
            const change = document.createElement("span");
            change.dataset.tone = text.startsWith("+") ? "pass" : "fail";
            change.textContent = text;
            result.append(change);
          }
          latest();
        } else if (tone) result.dataset.tone = tone;
        await pause(80);
      }
      const revealPreview = step.preview && preview.classList.contains("hidden");
      if (step.preview && !revealPreview) showPreview(step.preview);
      if (step.text) await replyToPlayer(step.text);
      if (revealPreview) {
        showPreview(step.preview);
        preview.classList.remove("hidden");
      }
    }
    status.textContent = "연결 종료";
    speakLabel.textContent = "연결 종료";
    await pause(350);
    onDone();
  }

  run();
}
