import { ARCHITECTURE, AUTOMATION, CODE_REVIEW, DEPARTMENTS, LUNCH } from "./office-content.js";

export const CAST_NAMES = {
  boss: "김 과장",
  jung: "정 부장",
  park: "박 대리",
  lee: "이 대리",
  me: "나",
  ...Object.fromEntries(Object.entries(DEPARTMENTS).map(([id, department]) => [id, department.name])),
};

const ARRIVAL_SCENES = {
  [ARCHITECTURE.title]: [
    ["jung", "확장성이 부족해. 전체적으로 다시 설계하지."],
    ["boss", "네, 알겠습니다. …신입, 내일까지 수정해."],
    ["me", "일정도 변경되는 건가요?"],
    ["boss", "아니."],
  ],
  [CODE_REVIEW.title]: [
    ["boss", "내가 이렇게 구현하라고 했잖아."],
    ["jung", "누가 이렇게 구현하라고 했어?"],
    ["boss", "…신입이 작성한 코드입니다."],
  ],
  [AUTOMATION.title]: [
    ["lee", "검수표 복사하는 데만 오전이 다 가요. 이거 한꺼번에 옮길 방법 없을까요?"],
  ],
};

const SCRUM_SCENES = {
  short: [
    ["boss", "오늘은 짧게 합시다."],
    ["park", "제 건 사실상 다 끝났습니다. 정리한 표가 여기 세 장인데요."],
    ["lee", "제 쪽은 아직 재현이 안 됩니다. 아, 그 검수도 제가 볼게요."],
  ],
  question: [["boss", "그게 왜 막혔는데? 칠판에 한번 그려봐."]],
  extra: [["park", "어제 막힌 건 따로 얘기하시죠. 회의실은 제가 잡았어요."]],
  director: [["jung", "고객이 먼저 볼 화면이 바뀌었어. 업무표부터 다시 보자."]],
  caught: [
    ["park", "어제 메일 찾았습니다. 여기에도 거의 다 끝났다고 적혀 있네요."],
    ["boss", "그래? 그럼 이번엔 어디까지 됐는지 같이 보자."],
  ],
};

const LUNCH_REPLIES = {
  park: ["park", "회의 끝나고 물어봐. 사람들 앞에서 물으면 갑자기 다들 할 말이 생겨."],
  help: ["lee", "같이 봐줘서 고마워. 퇴근 직전에 알린 건데, 또 제가 한다고 했네요."],
  kim: ["boss", "고객 전화 대신 받아줘서 고마워. 덕분에 오늘은 밥이 식기 전에 먹네."],
};

const FRIDAY_SCENE = [
  ["planning", "기능 하나만 더 넣겠습니다."],
  ["design", "최종 시안은 조금 바뀌었어요."],
  ["sales", "납품은 하루 앞당기기로 했습니다."],
  ["qa", "이 상태면 검수 시간을 더 주세요."],
  ["boss", "신입, 가능하지?"],
];

const DEPARTMENT_REPLIES = {
  accept: {
    planning: "그럼 추가 기능도 이번 버전에 넣는 걸로 적겠습니다.",
    design: "좋아요. 새 시안은 지금 보내드릴게요.",
    sales: "다행이네요. 고객님께 가능하다고 다시 전화할게요.",
    qa: "수정본 올라오면 그 환경에서 다시 돌려볼게요.",
  },
  document: {
    planning: "좋아요. 넣을 항목과 다음으로 미룰 항목을 메일에 정리할게요.",
    design: "IE6 화면 하나를 기준으로 잡죠. 나머지는 차이가 있어도 넘어갈게요.",
    sales: "그럼 시연 때 보여줄 기능부터 따로 정리하겠습니다.",
    qa: "재현 조건부터 맞추죠. 배포를 막는 것만 먼저 올릴게요.",
  },
  push: {
    planning: "지금 일정이 어렵다는 거죠? 요구사항부터 다시 보죠.",
    design: "오늘 반영이 어렵다면 어느 화면까지 된 건지 알려주세요.",
    sales: "그 일정으론 어렵다고요? 고객이랑 다시 얘기해 볼게요.",
    qa: "그럼 이번에 안 고칠 항목은 검수 결과에 남겨둘게요.",
  },
  ally: {
    planning: "급하지 않은 기능은 다음 버전으로 옮겼어요. 변경 이력도 공유했어요.",
    design: "기준 화면은 고객이 확인했어요. 사소한 차이는 이제 검수에서 뺄게요.",
    sales: "고객이 기존 납품일로 동의했어요. 시연 범위도 줄였고요.",
    qa: "비슷한 이슈는 제가 합쳤어요. 재현 로그만 보내둘게요.",
  },
};

const FRIDAY_REPLIES = {
  yes: ["sales", "좋습니다. 고객님한테 오늘 바로 가능하다고 말씀드리죠."],
  no: ["qa", "아직 검수도 못 끝냈어요. 지금 일정으로는 저도 승인 못 합니다."],
  trim: ["planning", "그럼 출시 필수 항목부터 잠그죠. 나머지는 다음 버전으로 뺄게요."],
  joke: ["lee", "…아, 웃으면 안 되는 거였죠?"],
};

export function officeScene(state, friday) {
  const previous = state.moves.at(-1);
  if (previous === "code-delegate") return [["lee", "이 건은 제가 넘겨받아서 끝냈어요. 다음에 막히는 데가 있으면 미리 얘기해 줘요."]];
  switch (state.phase) {
    case "arrive": return ARRIVAL_SCENES[state.event.title];
    case "scrum": return SCRUM_SCENES[state.scrum.event?.id];
    case "lunch": return [LUNCH[(state.shift - 1) % LUNCH.length]];
    case "negotiate": return [LUNCH_REPLIES[previous], [state.department, state.request[1]]].filter(Boolean);
    case "morning": return previous === "tutorialHelp"
      ? [["lee", "예시를 열어 뒀어요. 괄호 안에 문장을 넣고, 따옴표도 꼭 닫아 주세요."]]
      : undefined;
    case "afternoon": {
      const line = DEPARTMENT_REPLIES[previous]?.[state.department];
      return line ? [[state.department, line, true]] : undefined;
    }
    case "report": return friday ? FRIDAY_SCENE : undefined;
    case "leave": return FRIDAY_REPLIES[previous] ? [[...FRIDAY_REPLIES[previous], true]] : undefined;
  }
}
