import { INTERNET_ALERTS, LECTURE_LINES, SELF_FIXED_REACTION } from "./intranet-feed.js";
import { COMDORI_LINES, COMDORI_STANDBY, SURVIVAL_TUTORIAL_LINES, TUTORIAL_LINES } from "./comdori-lines.js";
import { BOSS_LINES, MISSIONS, PASTE_LINES, PROLOGUE_2026, SCENE_2006, TRAVEL_LINES, WRONG_RUN_LINES } from "./missions.js";
import { DEPARTMENTS, EPILOGUE, LUNCH } from "./office-content.js";
import { CLOCK_REPLIES, MINE_REPLIES, OFFICE_COPY } from "./office-copy.js";
import { PRESENCE_LINES } from "./office-presence.js";
import { ARRIVAL_SCENES, CAST_NAMES, DEPARTMENT_REPLIES, FRIDAY_REPLIES, FRIDAY_SCENE, LUNCH_REPLIES, SCRUM_SCENES, SURVIVAL_SCENES } from "./office-scenes.js";

export const GROUPS = {
  intro: "프롤로그·엔딩",
  office: "사무실·업무",
  meeting: "회의·부서·동료",
  companion: "컴돌이",
  reaction: "행동 감지·반응",
};
const SPEAKERS = { ...CAST_NAMES, ai: "컴돌이", check: "플레이어 확인 버튼", terminal: "터미널" };
const CHOICES = { park: "박 대리와 점심", help: "이 대리 도움", kim: "김 과장과 점심", yes: "수락", no: "불가능", trim: "범위 축소", joke: "영업팀 농담", accept: "요청 수락", document: "서면 정리", push: "거절·일정 협상", ally: "담당자와 공동 대응" };
const TUTORIALS = { time: "업무 시간", input: "첫 코드 입력", submit: "업무 제출", score: "평판 보상", practice: "문법 업무", health: "체력", stress: "스트레스", trust: "보고 신뢰도", scope: "추가 일감", deadline: "마감" };
const COMPANION_EVENTS = {
  burst: "버스트 발동", sunday: "일요일 휴식", lateLocal: "현실에서 새벽에 플레이", longIdle: "작업 중 장시간 무입력",
  coding: "새 코딩 업무 시작", success: "검수 통과", error: "실행·검수 오류", search: "가상 검색 사용",
  meeting: "회의 시작", meetingLong: "긴 회의", overtime: "야근 선택", leave: "정시 퇴근",
  mines: "지뢰찾기 시작", scolded: "복붙·지뢰찾기로 질책", idle: "할 일이 없을 때 혼잣말",
  foreshadow: "후반부 혼잣말·복선", "web-first": "미래넷 처음 열기", "web-lecture": "강의 첫 재생",
  "web-lecture-done": "강의 끝까지 시청", "web-solved": "자료 열람 후 검수 통과",
  "web-stack": "이전 검색창 · 스택 오버플로 검색", "web-chatgpt": "이전 검색창 · ChatGPT 검색",
  "web-errors": "이전 검색창 · 반복 오류 검색",
};
const PRESENCE = {
  mobile: "모바일에서 코딩 화면 대기", mobileWork: "모바일에서 업무 실행", tab: "다른 탭에 5초 이상 다녀옴",
  window: "다른 창에 5초 이상 다녀옴", pointer: "작업 화면 밖에 마우스를 둠", idle: "30초 이상 무입력",
  weekend: "현실의 주말 접속", devtools: "개발자 도구 단축키 누름", editorMenu: "편집기 우클릭",
};
const BOSS_EVENTS = { idle: "오래 작업 중", error: "코드 실행 오류", success: "검수 통과·추가 일감", coffee: "커피를 타 왔을 때", leave: "일반 퇴근 준비" };
const SCRUM_EVENTS = { short: "회의를 짧게 시작", question: "막힌 점에 대한 추가 질문", extra: "후속 회의 소집", director: "정 부장 참석", caught: "어제 한 약속을 지키지 못함" };
const ARRIVAL_EVENTS = { architecture: "아키텍처 재설계", review: "코드 리뷰", automation: "검수표 자동화" };

const entry = (id, group, context, who, texts, note = "") =>
  ({ id, group, context, speaker: SPEAKERS[who] ?? who, texts: Array.isArray(texts) ? texts : [texts], note });
const scene = (id, group, context, lines) => lines.map(([who, text], i) =>
  entry(`${id}.${i}`, group, lines.length > 1 ? `${context} · ${i + 1}번째` : context, who, text));
const script = (id, context, steps) => steps.flatMap(({ who, text, before }, i) => [
  ...(before ? [entry(`${id}.${i}.before`, "intro", `${context} · ${i + 1}번째 작업 전`, who, before)] : []),
  entry(`${id}.${i}`, "intro", `${context} · ${i + 1}번째`, who, text),
]);

export const DIALOGUE_CATALOGUE = [
  ...Object.entries(OFFICE_COPY).map(([id, [context, who, text]]) =>
    entry("office." + id, id.startsWith("opening") ? "intro" : "office", context, who, text,
      text.includes("{") ? "중괄호 속 이름은 플레이할 때 실제 값으로 바뀝니다." : "")),
  ...script("intro", "2026년 · 에이전트와 로그인 작업", PROLOGUE_2026),
  ...script("wake", "2006년 · 김 과장이 깨우는 장면", SCENE_2006),
  ...script("epilogue", "2026년 귀환 · 에필로그", EPILOGUE),
  ...TRAVEL_LINES.map((line, i) => entry("travel." + i, "intro", `시간 이동 · 로그 ${i + 1}`, "terminal", line)),
  ...MISSIONS.map(mission => entry("mission." + mission.id, "office", `업무 배정 · ${mission.title}`, "boss", mission.boss)),
  ...Object.entries(BOSS_LINES).map(([id, text]) => entry("boss." + id, "reaction", BOSS_EVENTS[id], "boss", text,
    id === "leave" ? "" : "상황에 따라 생성 대사가 먼저 쓰일 수 있습니다. 여기는 기본 대사입니다.")),
  entry("boss.clock", "reaction", "사무실 시계 · 이름 입력 이후 반복 클릭", "boss", CLOCK_REPLIES, "클릭할 때마다 순서대로 나옵니다."),
  entry("boss.wrongRun", "reaction", "코드를 실행했지만 기대 결과와 다름", "boss", WRONG_RUN_LINES, "실패할 때마다 순서대로 나옵니다."),
  ...PASTE_LINES.map((line, i) => entry("paste." + i, "reaction", `복붙 시도 ${i + 1}회${i === 2 ? " 이상" : ""}`, "boss", line)),
  ...MINE_REPLIES.flatMap((lines, i) => scene("mines." + i, "reaction", `지뢰찾기 발각 ${i + 1}회${i === 2 ? " 이상" : ""}`, lines)),
  ...INTERNET_ALERTS.map(([minutes, text]) => entry("internet.warning." + minutes, "reaction", `미래넷 열람 총 ${minutes}분 사용`, "boss", text)),
  entry("internet.selfFixed", "reaction", "미래넷 · 자체 해결 게시글 열람", "me", SELF_FIXED_REACTION),
  ...Object.entries(LECTURE_LINES).map(([id, text]) => entry("lecture." + id, "office", "미래넷 영어 강의 · " + ({
    intro: "시작", first: "첫 예제", second: "예상 결과 확인", firstArray: "배열 첫 칸", secondArray: "배열 마지막 칸", closing: "마무리",
  })[id], "Arun Rao", text, id === "intro" ? "{chapter}는 해당 강의의 주제로 바뀝니다." : "")),
  ...Object.entries(PRESENCE_LINES).map(([id, text]) => entry("presence." + id, "reaction", PRESENCE[id], "boss", text, "플레이 중 조건을 충족하면 회차당 한 번 나옵니다.")),
  ...Object.entries(ARRIVAL_SCENES).flatMap(([id, lines]) => scene("arrival.event." + id, "meeting", "출근 이벤트 · " + ARRIVAL_EVENTS[id], lines)),
  ...Object.entries(SURVIVAL_SCENES).flatMap(([day, lines]) => scene("arrival.day." + day, "meeting", `입사 ${day}일차 고정 출근 이벤트`, lines)),
  ...Object.entries(SCRUM_SCENES).flatMap(([id, lines]) => scene("scrum." + id, "meeting", "스크럼 · " + SCRUM_EVENTS[id], lines)),
  ...LUNCH.flatMap((line, i) => scene("lunch." + i, "meeting", `점심시간 · 순환 대사 ${i + 1}`, [line])),
  ...Object.entries(LUNCH_REPLIES).flatMap(([id, line]) => scene("lunch.reply." + id, "meeting", CHOICES[id] + " 이후", [line])),
  ...Object.entries(DEPARTMENTS).flatMap(([id, department]) => department.requests.flatMap(([name, line], i) =>
    scene(`request.${id}.${i}`, "meeting", `${department.name} 요청 · ${name}`, [[id, line]]))),
  ...Object.entries(DEPARTMENT_REPLIES).flatMap(([action, replies]) => Object.entries(replies).flatMap(([id, line]) =>
    scene(`negotiated.${action}.${id}`, "meeting", `${DEPARTMENTS[id].name} · ${CHOICES[action]} 이후`, [[id, line]]))),
  ...scene("friday", "meeting", "금요일 전체 회의", FRIDAY_SCENE),
  ...Object.entries(FRIDAY_REPLIES).flatMap(([id, line]) => scene("friday.reply." + id, "meeting", "금요일 회의 · " + CHOICES[id], [line])),
  entry("companion.standby", "companion", "대기 상태", "ai", COMDORI_STANDBY),
  ...Object.entries(TUTORIAL_LINES).map(([id, text]) => entry("tutorial." + id, "companion", `튜토리얼 · ${TUTORIALS[id]}`, "ai", text,
    Object.hasOwn(SURVIVAL_TUTORIAL_LINES, id) ? "구버전 이어하기에서 사용합니다." : "")),
  ...Object.entries(SURVIVAL_TUTORIAL_LINES).map(([id, text]) => entry("tutorial.current." + id, "companion", `튜토리얼 · ${TUTORIALS[id]} · 2주판`, "ai", text)),
  ...Object.entries(COMDORI_LINES).map(([id, group]) => entry("companion." + id, "companion", COMPANION_EVENTS[id] ?? id, "ai", group.lines,
    [group.minShift ? `${group.minShift}근무일차부터` : "", group.cooldown ? `같은 상황은 최소 ${group.cooldown / 1000}초 간격` : ""].filter(Boolean).join(" · "))),
];
