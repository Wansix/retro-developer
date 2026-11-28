import { officeCopy } from "./office-copy.js";

export function playIntro() {
  const transcript = document.getElementById("intro-transcript");
  const status = document.getElementById("intro-status");
  const login = document.getElementById("intro-preview-login");
  const error = document.getElementById("intro-preview-error");
  const startWork = document.getElementById("btn-gotowork");

  function append(who, id) {
    const row = document.createElement("div");
    row.className = "intro-row " + (who === "나" ? "intro-prompt" : "intro-reply");
    const speaker = document.createElement("span");
    speaker.className = "intro-speaker";
    speaker.textContent = who;
    const text = document.createElement("p");
    text.textContent = officeCopy(id);
    row.append(speaker, text);
    transcript.append(row);
  }

  transcript.replaceChildren();
  startWork.classList.add("hidden");
  error.textContent = "";
  login.disabled = false;
  status.textContent = "미리보기에서 로그인 확인";
  append("나", "openingRequest");
  append("컴돌이", "openingClaim");
  login.focus({ preventScroll: true });

  login.onclick = () => {
    login.disabled = true;
    error.textContent = "로그인 화면으로 돌아왔어요. 다시 로그인해 주세요.";
    append("나", "openingFailure");
    append("컴돌이", "openingDefense");
    append("나", "openingTakeover");
    append("컴돌이", "openingTravel");
    status.textContent = "2006년 · 미래소프트 개발 3팀";
    transcript.scrollTop = transcript.scrollHeight;
    startWork.classList.remove("hidden");
    startWork.focus({ preventScroll: true });
  };
}
