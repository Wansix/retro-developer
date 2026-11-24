// 미션 데이터. Phase 1은 미션 1만 사용한다. (기획서 §3)
const MISSIONS = [
  {
    id: "hello-world",
    title: "업무 1. Hello, World!",
    boss: "신입, 첫 업무다. 화면에 Hello, World! 한 줄 찍어봐. 뭐 어렵다고 이걸 시키냐 싶겠지만, 다들 그렇게 시작하는 거야.",
    brief: "보이는 한 줄을 그대로 따라 치면 됩니다.",
    requirement: 'print("Hello, World!") 를 입력하고 [실행]으로 확인한 뒤 [제출]하세요.',
    starter: "# 아래에 코드를 한 글자씩 직접 입력하세요\n",
    expected: "Hello, World!",
    successBoss: "오! 벌써 끝났어? 그럼 이것도 해줘. ...라고 하고 싶지만, 다음 업무는 아직 준비 중이야. (Phase 2에서 열립니다)",
  },
];

const PASTE_LINES = [
  "신입, 한 글자도 안 치고 코드를 완성했다고?",
  "자네 Ctrl+V 말고 다른 키는 없나?",
  "혹시 미래에서 왔어?",
];

// 프롤로그 2026년: who 'me'는 플레이어가 직접 누르는 대사 버튼, 'ai'는 자동 진행.
const PROLOGUE_2026 = [
  { who: "me", text: "야, 로그인 버그 좀 고쳐." },
  { who: "ai", text: "수정 완료했습니다. 테스트 12개를 통과했습니다." },
  { who: "me", text: "아니, 누가 이 파일까지 건드리래? 원복해!" },
  { who: "ai", text: "죄송합니다. 변경 사항을 되돌렸습니다." },
  { who: "me", text: "아니!! 그건 왜 되돌려! 제대로 좀 안 해?" },
  { who: "ai", text: "죄송합니다. 다시 수정하겠습니다." },
  { who: "ai", text: "수정 완료했습니다. 참고로 기존 기능 3개가 작동하지 않습니다." },
  { who: "me", text: "아 진짜 씨X! 그냥 내가 하는 게 빠르겠다!" },
  { who: "ai", text: "직접 개발하시는 편이 더 효율적이라고 생각하시나요?" },
  { who: "me", text: "당연하지! 옛날 개발자들은 너 같은 거 없이도 다 만들었어!" },
  { who: "ai", text: "그렇다면 직접 경험해 보시겠습니까?" },
  { who: "me", text: "그래! 차라리 그때가 낫겠다!" },
  { who: "ai", text: "알겠습니다. 요청하신 개발 환경을 준비하겠습니다." },
  { who: "me", text: "뭐?" },
];

const TRAVEL_LINES = [
  "Initializing development environment...",
  "AI Assistant: DISABLED",
  "Target Year: 2006",
  "Time Travel: COMPLETE",
];

// 2006년 첫 출근: boss = 김 과장, ai = 모니터에 뜬 미래의 AI 메시지.
const SCENE_2006 = [
  { who: "boss", text: "신입! 첫날부터 졸고 있어?" },
  { who: "me", text: "……누구세요?" },
  { who: "boss", text: "오늘부터 쇼핑몰 프로젝트 들어갈 거야." },
  { who: "me", text: "요구사항은요?" },
  { who: "boss", text: "그냥 깔끔하고 세련되게. 알아서 잘 만들어 봐." },
  { who: "me", text: "……." },
  { who: "ai", text: "요청하신 대로 AI 코딩 에이전트가 없던 시대로 이동하셨습니다." },
  { who: "ai", text: "10일 안에 프로젝트를 완성하시면 원래 시대로 돌아갈 수 있습니다." },
  { who: "ai", text: "코딩 지원은 제공되지 않습니다." },
  { who: "ai", text: "행운을 빕니다. 인간 개발자님." },
  { who: "me", text: "아니 잠깐만!!!" },
];
