// 미션 데이터 (기획서 §3). check.type: 'output' = 전체 출력 비교, 'var' = 마지막 출력값 비교.
const MISSIONS = [
  {
    id: "hello-world",
    title: "업무 1. 첫인사 출력",
    boss: "신입, 첫 업무다. 화면에 Hello, World! 한 줄 찍어봐. 다들 그렇게 시작하는 거야.",
    brief: "쇼핑몰 프로젝트의 첫 화면에 띄울 문구다. 보이는 한 줄을 그대로 따라 치면 된다.",
    grammar: "print()는 괄호 안의 내용을 화면에 출력하는 명령이다. 문자는 큰따옴표로 감싼다.",
    example: 'print("안녕하세요")',
    requirement: 'print("Hello, World!") 를 입력하고 [실행]으로 확인한 뒤 [제출]하세요.',
    starter: "# 아래에 코드를 한 글자씩 직접 입력하세요\n",
    expectedOut: "Hello, World!",
    hint: 'print("Hello, World!") 를 그대로 입력하면 됩니다. 대소문자와 느낌표까지 똑같이!',
    check: { type: "output", expected: "Hello, World!" },
  },
  {
    id: "salary-raise",
    title: "업무 2. 사장님 월급 인상",
    boss: "사장님 월급이 10만 원 올랐대. salary에 100000을 더해서 3100000이 나오게 해.",
    brief: "salary 변수에 100000을 더해 3,100,000을 만들어야 한다.",
    grammar: "변수에 값을 더해 다시 저장하려면 salary += 100000 또는 salary = salary + 100000 을 쓴다.",
    example: "money = 5000\nmoney += 500",
    requirement: "salary가 3100000이 되도록 코드를 완성하세요.",
    starter: "salary = 3000000\n# salary에 100000을 더하세요\n\nprint(salary)\n",
    expectedOut: "3100000",
    hint: "salary += 100000 한 줄이면 됩니다.",
    check: { type: "var", name: "salary", expected: "3100000" },
  },
  {
    id: "star-print",
    title: "업무 3. 신입 기본기 — 별 찍기",
    boss: "신입 기본기 테스트다. 별을 1개부터 5개까지 한 줄씩 찍어. 못 하면 야근이야.",
    brief: "주어진 반복문 안에서 별을 1개, 2개, ... 5개씩 출력한다.",
    grammar: '문자열은 곱할 수 있다. "*" * 3 은 "***"가 된다. 반복문 안쪽 코드는 들여쓰기(스페이스 4칸)가 필요하다.',
    example: 'for i in range(1, 4):\n    print("*" * i)',
    requirement: "★ 출력이 기대 결과와 같아지도록 빈칸을 채우세요.",
    starter: 'for i in range(1, 6):\n    # 별을 i개 출력하세요\n    pass\n',
    expectedOut: "*\n**\n***\n****\n*****",
    hint: 'print("*" * i) 를 들여쓰기해서 넣으면 됩니다.',
    check: { type: "output", expected: "*\n**\n***\n****\n*****" },
  },
  {
    id: "discount-bug",
    title: "업무 4. 쇼핑몰 할인 버그",
    boss: "쇼핑몰에서 10% 할인을 했는데 가격이 더 올라갔대. 버그 좀 잡아.",
    brief: "10% 할인이면 10,000원이 9,000원이 되어야 하는데 11,000원이 나오고 있다. 한 줄만 고치면 된다.",
    grammar: "10% 할인은 원래 가격의 90%, 즉 0.9를 곱하는 것이다.",
    example: "price = price * 0.5  # 절반 가격",
    requirement: "버그를 고쳐 9000(또는 9000.0)이 출력되게 하세요.",
    starter: "price = 10000\n# 10% 할인인데 왜 가격이 오르지...?\nprice = price * 1.1\nprint(price)\n",
    expectedOut: "9000",
    hint: "1.1을 0.9로 바꾸면 됩니다.",
    check: { type: "number", expected: 9000 },
  },
  {
    id: "sales-total",
    title: "업무 5. 고객사 매출 합계",
    boss: "고객사에서 이번 달 매출 합계 좀 뽑아달래. 리스트 합계를 total에 담아.",
    brief: "가격 리스트의 합계를 total에 저장한다. 결과는 6,000이다.",
    grammar: "반복문으로 하나씩 더하거나, 내장 함수 sum()을 쓸 수 있다.",
    example: "nums = [1, 2, 3]\nprint(sum(nums))",
    requirement: "total이 6000이 되도록 코드를 완성하세요.",
    starter: "prices = [1000, 2000, 3000]\ntotal = 0\n# prices의 합계를 total에 저장하세요\n\nprint(total)\n",
    expectedOut: "6000",
    hint: "total = sum(prices) 한 줄로 끝납니다.",
    check: { type: "var", name: "total", expected: "6000" },
  },
  {
    id: "signup-check",
    title: "최종 검수 — 회원가입",
    boss: "마지막이다. 회원가입에서 19세 이상만 가입되게 해. 이것만 되면 프로젝트 끝이야.",
    brief: "나이가 19세 이상이면 allowed가 True가 되어야 한다.",
    grammar: "조건이 참인지 비교하려면 >= 를 쓴다. age >= 19 는 19세 이상일 때 True다.",
    example: "is_adult = age >= 20",
    requirement: "allowed가 True가 되도록 코드를 완성하세요.",
    starter: "age = 20\nallowed = False\n# 19세 이상이면 allowed가 True가 되게 하세요\n\nprint(allowed)\n",
    expectedOut: "True",
    hint: "allowed = age >= 19 입니다. 18세면 False, 19세면 True가 되는지도 생각해 보세요.",
    check: { type: "var", name: "allowed", expected: "True" },
  },
];

// 김 과장 상황별 대사 (기획서 §4)
const BOSS_LINES = {
  idle: "신입, 이거 아직도 하고 있어?",
  error: "빨간 글씨 뜨는데? 잘되고 있는 거야?",
  wrong: "음... 이게 맞아? 다시 확인해 보게.",
  success: "오! 벌써 끝났어? 그럼 이것도 해줘.",
  hint: "둘이서 하면 두 배로 빨리 끝나겠네?",
  coffee: "커피 마실 시간은 있나 봐?",
  flatter: "하하, 신입이 눈치는 있네.",
  delegate: "동료랑 나눠 하라고 했지, 통째로 넘기라고 했나?",
  leave: "오늘 집에 무슨 일 있어?",
  morningAfter: "어제 무슨 일 있었어? 왜 그렇게 일찍 갔어?",
  negotiate: "일정이 왜 필요하지? 일이나 해.",
};

const PASTE_LINES = [
  "신입, 한 글자도 안 치고 코드를 완성했다고?",
  "자네 Ctrl+V 말고 다른 키는 없나?",
  "혹시 미래에서 왔어?",
];

// 프롤로그 2026년: who 'me'는 플레이어가 직접 누르는 대사 버튼, 'ai'는 자동 진행.
// logs는 해당 시점에 위쪽 에이전트 터미널에 타이핑되는 작업 로그.
const PROLOGUE_2026 = [
  { who: "me", text: "야, 로그인 버그 좀 고쳐." },
  { who: "ai", text: "수정 완료했습니다. 테스트 12개를 통과했습니다.",
    logs: ["> 로그인 모듈 분석 중...", "> 관련 파일 3개 수정...", "> 테스트 12개 실행... 12 passed ✓"] },
  { who: "me", text: "아니, 누가 이 파일까지 건드리래? 원복해!" },
  { who: "ai", text: "죄송합니다. 변경 사항을 되돌렸습니다.",
    logs: ["> git checkout -- .", "> 변경 사항 전부 되돌리는 중..."] },
  { who: "me", text: "아니!! 그건 왜 되돌려! 제대로 좀 안 해?" },
  { who: "ai", text: "죄송합니다. 다시 수정하겠습니다.",
    logs: ["> 다시 수정하는 중...", "> 일단 뭔가 더 바꾸는 중..."] },
  { who: "ai", text: "수정 완료했습니다. 참고로 기존 기능 3개가 작동하지 않습니다.",
    logs: ["> 테스트 재실행...", "> 경고: 기존 기능 3개 실패 ✗"] },
  { who: "me", text: "아 진짜 씨X! 그냥 내가 하는 게 빠르겠다!" },
  { who: "ai", text: "직접 개발하시는 편이 더 효율적이라고 생각하시나요?",
    logs: ["> 사용자 성향 분석 중..."] },
  { who: "me", text: "당연하지! 옛날 개발자들은 너 같은 거 없이도 다 만들었어!" },
  { who: "ai", text: "그렇다면 직접 경험해 보시겠습니까?",
    logs: ["> 2006년 개발 환경 검색 중..."] },
  { who: "me", text: "그래! 차라리 그때가 낫겠다!" },
  { who: "ai", text: "알겠습니다. 요청하신 개발 환경을 준비하겠습니다.",
    logs: ["> 시간이동 프로토콜 로딩...", "> 준비 완료."] },
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

// 반전 엔딩 (기획서 Phase 3.5) — 고정 대사. stats는 실제 플레이 기록.
const TWIST_BEFORE = [
  { who: "boss", text: "신입, 그동안 고생 많았다." },
  { who: "me", text: "과장님도 건강하세요. 제발 후배들한테 좀 잘해주시고요." },
  { who: "boss", text: "그래. 자네 같은 개발자는 처음이었어." },
];

function twistSystemLog(stats) {
  return [
    "[SIMULATION COMPLETE]",
    "",
    "Agent: KIM_MANAGER",
    "Role: 2006년 중소기업 개발팀 과장",
    "Personality: 권위적, 모호한 업무 지시",
    "Objective: 신입 개발자의 업무 처리량 극대화",
    "",
    `Generated dialogues: ${stats.bossLines}`,
    `Additional tasks assigned: ${stats.tasks}`,
    "",
    "Shutting down agent...",
  ];
}

const TWIST_AFTER = [
  { who: "me", text: "……잠깐. 김 과장도 AI였어?" },
  { who: "ai", text: "네. 당시의 직장 문화를 재현하기 위해 설계된 AI 에이전트입니다." },
  { who: "me", text: "그럼 내가 열흘 동안 AI한테 갈굼당하면서 코딩한 거야?" },
  { who: "ai", text: "정확합니다." },
  { who: "me", text: "야 이 개XX야!!!" },
];

const TWIST_ACHIEVEMENT = "[업적 달성: AI에게서 도망쳐 AI의 부하가 되었습니다.]";

const CREDITS = [
  "김 과장 역: AI",
  "박 대리 역: AI",
  "최 사원 역: AI",
  "고객사 담당자 역: AI",
  "업무 배정 및 일정 관리: AI",
  "실제 코딩 및 야근 담당: 플레이어",
];
