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

const INTRO_STEPS = [
  { text: "파일을 수정하려고 합니다. 승인하시겠습니까?", button: "승인" },
  { text: "테스트를 실행하려고 합니다. 승인하시겠습니까?", button: "승인" },
  { text: "브라우저에서 확인하려고 합니다. 승인하시겠습니까?", button: "승인" },
  { text: "다음 작업으로 넘어가려고 합니다. 승인하시겠습니까?", button: "아니 그냥 내가 하는 게 빠르겠다!" },
];
