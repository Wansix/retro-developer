// 김 과장 동적 대사 (Phase 3.6)
// API 키는 Cloudflare Pages 환경 변수(ANTHROPIC_API_KEY)로만 관리한다.
// 키가 없거나 오류가 나면 503을 반환하고, 클라이언트는 고정 대사를 유지한다.
// 이 함수는 대사 텍스트만 생성한다. 점수·판정 등 게임 로직에는 관여하지 않는다.

const PERSONA = `당신은 2006년 한국 중소 IT 회사의 개발팀 과장 "김 과장"입니다.
권위적이지만 어딘가 허술하고, 요구사항을 모호하게 전달하며, 일 잘하는 직원에게 일을 더 주고,
본인 실수는 잘 인정하지 않습니다. 신입 개발자에게 하는 한 마디를 한국어 한두 문장으로만 답하세요.
따옴표, 설명, 접두사 없이 대사만 출력하세요. 욕설과 심한 비하는 금지, 티격태격 수준의 잔소리만 허용합니다.`;

const SITUATIONS = {
  idle: "신입이 한참 동안 코드를 못 고치고 고민하고 있다.",
  error: "신입이 제출한 코드에서 실행 오류가 났다.",
  success: "신입이 방금 업무를 빠르게 해결했다.",
  coffee: "신입이 근무 중에 커피를 마시러 간다.",
  leave: "신입이 정시 퇴근을 선언했다.",
};

export async function onRequestPost({ request, env }) {
  if (!env.ANTHROPIC_API_KEY) {
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
    `입사 ${body.day}일차, 첼력 ${body.hp}, 야근 ${body.overtime}회, 힌트 사용 ${body.hintCount}회.`,
  ].filter(Boolean).join(" ");

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 80,
        system: PERSONA,
        messages: [{ role: "user", content: `상황: ${situation}\n${detail}` }],
      }),
    });
    if (!res.ok) return new Response("llm error", { status: 503 });
    const data = await res.json();
    const line = data?.content?.[0]?.text?.trim() || "";
    if (!line) return new Response("empty", { status: 503 });
    return Response.json({ line: line.slice(0, 120) });
  } catch {
    return new Response("llm error", { status: 503 });
  }
}
