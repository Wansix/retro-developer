// 김 과장 동적 대사 (Phase 3.6) — cojafa와 같은 Hermes 서버 경유.
// Hermes는 OpenAI 호환 /v1/chat/completions를 제공한다.
// 설정(Cloudflare Pages 환경 변수, 서버 측에서만 관리):
//   HERMES_URL  — 예: https://hermes.example.com (cojafa는 로컬 터널 127.0.0.1:18643 사용)
//   HERMES_KEY  — Bearer 키
//   HERMES_MODEL — 선택, 기본 cojafa-judgment
// 미설정·오류·시간 초과 시 503을 반환하고 클라이언트는 고정 대사를 유지한다.
// 이 함수는 대사 텍스트만 생성한다. 점수·판정 등 게임 로직에는 관여하지 않는다.

const PERSONA = `당신은 2006년 한국 중소 IT 회사의 개발팀 과장 "김 과장"입니다.
권위적이지만 어딘가 허술하고, 요구사항을 모호하게 전달하며, 일 잘하는 직원에게 일을 더 주고,
정 수석과 고객사 사이에서 버티며, 가끔 신입의 편도 들어줍니다. 신입 개발자에게 하는 한 마디를 한국어 한두 문장으로만 답하세요.
따옴표, 설명, 접두사 없이 대사만 출력하세요. 욕설과 심한 비하는 금지, 티격태격 수준의 잔소리만 허용합니다.`;

const SITUATIONS = {
  idle: "신입이 한참 동안 코드를 못 고치고 고민하고 있다.",
  error: "신입이 제출한 코드에서 실행 오류가 났다.",
  success: "신입이 방금 업무를 빠르게 해결했다.",
  coffee: "신입이 근무 중에 커피를 마시러 간다.",
  leave: "신입이 정시 퇴근을 선언했다.",
};

export async function onRequestPost({ request, env }) {
  if (!env.HERMES_URL || !env.HERMES_KEY) {
    return new Response("LLM disabled", { status: 503 });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response("bad request", { status: 400 });
  }

  const situation = SITUATIONS[body.kind] || SITUATIONS.idle;
  const detail = [
    body.error ? `오류 메시지: ${String(body.error).slice(0, 200)}` : "",
    body.situation === "infinite_loop" ? "무한 루프로 실행이 강제 종료됨." : "",
    `입사 ${body.day}일차, 체력 ${body.hp}, 야근 ${body.overtime}회.`,
  ].filter(Boolean).join(" ");

  const messages = [
    { role: "system", content: PERSONA },
    { role: "user", content: `상황: ${situation}\n${detail}` },
  ];

  try {
    // 헤륩스 브리지는 Idempotency-Key(요청 해시)를 요구한다 (cojafa 방식)
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(messages)));
    const inputHash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");

    const res = await fetch(`${env.HERMES_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.HERMES_KEY}`,
        "Idempotency-Key": inputHash,
      },
      body: JSON.stringify({
        model: env.HERMES_MODEL || "cojafa-judgment",
        provider: "openai-codex",
        messages,
        stream: false,
        model_options: { reasoning: { effort: "low" } },
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return new Response("llm error", { status: 503 });
    const data = await res.json();
    const line = data?.choices?.[0]?.message?.content?.trim() || "";
    if (!line) return new Response("empty", { status: 503 });
    const model = typeof data.model === "string" ? data.model.trim().split("/").at(-1) : "";
    const source = /^(?:gpt-\d+(?:\.\d+)?-)?luna(?:$|[-:@])/i.test(model) ? "luna" : "AI";
    return Response.json({ line: line.slice(0, 120), source });
  } catch {
    return new Response("llm error", { status: 503 });
  }
}
