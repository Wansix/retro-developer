import { MISSIONS } from "./missions.js";
import { problemOrder, materializeProblem } from "./code-problem-bank.js";
import { seedValue, seededShuffle } from "./seeded.js";

export const WORK_TYPES = {
  code: "Python 코딩", quiz: "개발 퀴즈", review: "코드 리뷰", sudoku: "데이터 검증",
  lights: "서버 복구", memory: "레거시 분석", qa: "화면 비교", design: "UI 위치 수정",
};

const QUIZZES = [
  ["HTTP 상태 코드", "없는 상품 페이지를 요청했을 때 보통 어떤 HTTP 응답이 돌아오나요?",
    ["200 OK", "404 Not Found", "500 Internal Server Error"], 1,
    "주소에 해당하는 페이지를 찾지 못했다는 응답이에요.", "404는 서버가 요청한 리소스를 찾지 못했다는 뜻이에요."],
  ["네트워크 주소록", "브라우저가 example.com에 접속하려고 할 때 이름을 IP 주소로 찾는 데 쓰는 것은?",
    ["FTP", "HTML", "DNS"], 2,
    "전화번호부처럼 이름으로 주소를 찾아 주는 역할이에요.", "DNS는 도메인 이름에 연결된 IP 주소를 조회하는 데 쓰여요."],
  ["상품 테이블 조회", "상품 테이블의 데이터를 읽기만 하려면 어떤 SQL 명령을 쓰나요?",
    ["SELECT", "DELETE", "UPDATE"], 0,
    "조회는 저장된 데이터를 바꾸지 않아요.", "SELECT는 조회, DELETE는 삭제, UPDATE는 변경에 쓰여요."],
  ["고객 문의 순번", "먼저 접수된 문의부터 처리하려면 어떤 자료구조가 어울리나요?",
    ["스택", "큐", "집합"], 1,
    "은행 번호표처럼 먼저 들어온 사람이 먼저 나가요.", "큐는 일반적으로 먼저 넣은 항목을 먼저 꺼내는 FIFO 구조예요."],
  ["할인율 자료형", "파이썬에서 0.15는 어떤 자료형인가요?",
    ["문자열 str", "정수 int", "부동소수점 float"], 2,
    "따옴표로 둘러싸이지 않은 소수예요.", "파이썬에서 소수점을 포함한 이 숫자 리터럴은 float예요."],
];

const NEW_WORK = {
  quiz: ["상점 관리자 매뉴얼 확인", "45분", 45],
  review: ["상품 가격 변경 검수", "50분", 55],
  sudoku: ["상품 분류표 대조", "1시간", 60],
  lights: ["서비스 상태 확인", "1시간", 65],
  memory: ["기존 시스템 인수인계", "1시간", 65],
  qa: ["배포 전 주문 화면 검수", "1시간", 70],
  design: ["장바구니 개선 반영", "1시간", 75],
};

const CODE_NOTICES = [
  "쇼핑몰 첫 화면 문구", "급여 화면 계산식", "출력 양식 개선", "상품 할인 점검", "매출 표 정리", "가입 규칙 반영",
  "버튼 상태 변경", "브라우저 표시 개선", "창고 수량 집계", "배송비 계산 개선", "안내 메일 목록 정리", "납품 전 최종 확인",
];
const CODE_ESTIMATE = ["45분", "50분", "1시간", "1시간 15분"];

export function workOrder(seed) {
  const pick = (start, count, salt) => start + seedValue(seed, salt) % count;
  return [0, "quiz", pick(1, 3, 1), "review", "sudoku", pick(4, 3, 2),
    "lights", "memory", pick(7, 4, 3), "qa", "design", 11];
}

export const shortWorkOrder = () => [0, "quiz", "review", "sudoku", "lights", "memory", "qa", "design", 11];

const STORY_WORK = {
  "story:opening": { index: 0, title: "첫인사 출력" },
  "story:deployment": { index: 11, title: "배포 전 마지막 한 줄" },
};

export function problemBankWorkOrder(seed) {
  const [early, middle, late] = problemOrder(seed);
  const [one, two, three, four] = seededShuffle(Object.keys(NEW_WORK), seed, 208);
  return ["story:opening", early, one, middle, two, three, late, four, "story:deployment"];
}

const SUDOKU_CLUES = [
  1, 0, 0, 4,
  0, 4, 1, 0,
  2, 0, 4, 0,
  0, 3, 0, 1,
];
const QA_FIELDS = [
  ["상호", "밤마켓", "낮마켓"], ["상품", "사무용 마우스", "사무용 키보드"], ["수량", "2개", "3개"],
  ["상품 금액", "18,000원", "19,000원"], ["배송비", "2,500원", "무료"], ["버튼", "결제하기", "취소하기"],
];

export function toggleLights(mask, cell) {
  const x = cell % 3;
  const y = Math.floor(cell / 3);
  for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) {
    if (x + dx >= 0 && x + dx < 3 && y + dy >= 0 && y + dy < 3) {
      mask ^= 1 << (3 * (y + dy) + x + dx);
    }
  }
  return mask;
}

export function lightsAfter(mask, presses) {
  for (let cell = 0; cell < 9; cell++) {
    if (presses & (1 << cell)) mask = toggleLights(mask, cell);
  }
  return mask;
}

export function makeWork(key, seed) {
  if (typeof key === "number") {
    const mission = MISSIONS[key];
    if (!mission) return;
    return { ...mission, type: "code", notice: CODE_NOTICES[key], estimate: CODE_ESTIMATE[Math.floor(key / 3)] };
  }
  if (Object.hasOwn(STORY_WORK, key)) {
    const { index, title } = STORY_WORK[key];
    return { ...makeWork(index, seed), title };
  }
  if (typeof key === "string" && key.startsWith("code:")) return materializeProblem(key, seed);
  const entry = NEW_WORK[key];
  if (!entry) return;
  const [notice, estimate, minutes] = entry;
  const work = {
    id: `work-${key}`, type: key, notice, estimate, minutes,
    boss: `신입, ‘${notice}’ 건 받았지? 기준 보고 한번 검수해 줘.`,
  };
  switch (key) {
    case "quiz": {
      const [title, brief, choices, correct, hint, explanation] = QUIZZES[seedValue(seed, 11) % QUIZZES.length];
      return { ...work, title, brief, choices, correct, hint, explanation };
    }
    case "review":
      return { ...work, title: "할인 계산 코드 리뷰", brief: "모든 상품은 정상가의 10%를 할인해야 해요. 결과를 잘못 계산하는 줄을 고르세요.",
        choices: ["price = 10000", "discount = price * 0.10", "total = price + discount", "print(total)"], correct: 2,
        hint: "정상가 10,000원에 10% 할인을 하면 9,000원이 나와야 해요.",
        explanation: "할인액을 정상가에 더하고 있어요. total = price - discount로 바꾸면 9,000원이 나와요." };
    case "sudoku": {
      const numbers = seededShuffle([1, 2, 3, 4], seed, 20);
      const clues = SUDOKU_CLUES.map(value => value ? numbers[value - 1] : 0);
      return { ...work, title: "상품 분류표 검증", brief: "빈칸을 채워 행, 열, 2×2 묶음마다 1~4가 한 번씩 나오게 하세요.",
        clues, hint: "빈칸이 하나만 남은 행이나 열부터 채우세요. 굵은 선이 2×2 묶음의 경계예요.",
        explanation: "행·열·2×2 묶음에서 분류 번호가 중복되지 않아 검수를 통과했어요." };
    }
    case "lights": {
      const [first, second, third] = seededShuffle([0, 1, 2, 3, 4, 5, 6, 7, 8], seed, 30);
      const mask = lightsAfter(0, (1 << first) | (1 << second) | (1 << third));
      return { ...work, title: "서버 재가동", brief: "칸을 누르면 선택한 서버와 상하좌우 서버의 상태가 바뀌어요. 빨간 장애등을 모두 끄세요.",
        mask: mask || toggleLights(0, first), hint: "같은 칸을 두 번 누르면 원래대로 돌아와요. 빨간 칸만 누를 필요는 없어요.",
        explanation: "장애등이 모두 꺼졌어요. 운영실에 정상 상태로 전달했습니다." };
    }
    case "memory": {
      const deck = seededShuffle(["상품", "고객", "주문", "상품", "고객", "주문"], seed, 45);
      return { ...work, title: "레거시 모듈 짝 맞추기", brief: "인수인계 카드 두 장을 뒤집어 같은 모듈 찾아 묶으세요. 세 쌍을 만들면 검수를 요청할 수 있어요.",
        deck, hint: "잘못 짝지으면 확인 시간 5분이 들어요. 잠깐 보이는 카드의 위치를 기억해 보세요.",
        explanation: "같은 모듈의 소스와 문서가 모두 연결됐어요." };
    }
    case "qa": {
      const differences = seededShuffle([0, 1, 2, 3, 4, 5], seed, 60).slice(0, 2);
      return { ...work, title: "주문 화면 차이 찾기", brief: "기준 화면과 달라진 항목 두 개를 검수 화면에서 표시하세요.",
        fields: QA_FIELDS, differences, hint: "각 줄의 값과 마지막 버튼 문구까지 살펴보세요.",
        explanation: "기준과 다른 항목 두 개를 QA 결과에 기록했어요." };
    }
    case "design":
      return { ...work, title: "결제 버튼 위치 조정", brief: "검수용 시안과 같도록 결제 버튼을 점선 칸으로 옮기세요.",
        target: [6, 7, 9, 10, 11][seedValue(seed, 75) % 5], hint: "방향 버튼으로 한 칸씩 옮기거나 목적지 칸을 직접 누를 수 있어요.",
        explanation: "결제 버튼이 디자인팀 시안의 지정 위치에 맞았어요." };
  }
}

const ALL_VALUES = new Set([1, 2, 3, 4]);
const validGroup = group => new Set(group).size === 4 && group.every(value => ALL_VALUES.has(value));

export function gradeWork(work, answer) {
  switch (work.type) {
    case "quiz":
    case "review":
      return Number.isInteger(answer) && answer >= 0 && answer < work.choices.length ? answer === work.correct : null;
    case "sudoku":
      if (!Array.isArray(answer) || answer.length !== 16 || !answer.every(value => Number.isInteger(value) && value >= 0 && value <= 4)) return null;
      if (!work.clues.every((value, index) => !value || value === answer[index])) return null;
      for (let i = 0; i < 4; i++) {
        const box = 8 * (i >> 1) + 2 * (i % 2);
        if (!validGroup(answer.slice(4 * i, 4 * i + 4)) ||
          !validGroup([answer[i], answer[i + 4], answer[i + 8], answer[i + 12]]) ||
          !validGroup([answer[box], answer[box + 1], answer[box + 4], answer[box + 5]])) return false;
      }
      return true;
    case "lights":
      return Number.isInteger(answer) && answer >= 0 && answer < 512 ? lightsAfter(work.mask, answer) === 0 : null;
    case "memory":
      if (!isSelection(answer, 6) || ![2, 6].includes(answer.length)) return null;
      if (answer.length === 2) return work.deck[answer[0]] !== work.deck[answer[1]] ? false : null;
      return [0, 2, 4].every(i => work.deck[answer[i]] === work.deck[answer[i + 1]]);
    case "qa":
      if (!isSelection(answer, work.fields.length)) return null;
      return answer.length === 2 && work.differences.every(index => answer.includes(index));
    case "design":
      return Number.isInteger(answer) && answer >= 0 && answer < 12 ? answer === work.target : null;
    default: return null;
  }
}

function isSelection(indices, size) {
  return Array.isArray(indices) && indices.length <= size && new Set(indices).size === indices.length &&
    indices.every(index => Number.isInteger(index) && index >= 0 && index < size);
}

export function workResultRows(record) {
  return Object.entries(WORK_TYPES).flatMap(([type, label]) => {
    const result = record.workResults?.[type];
    if (!result) return [];
    const { success, attempts } = result;
    return [[`${label} 성공률`, attempts ? `${Math.round(100 * success / attempts)}% (${success}/${attempts})` : "시도 없음"]];
  });
}
