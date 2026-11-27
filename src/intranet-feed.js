import { missionTopics, relatedIntranetArticles } from "./intranet-search.js";
import { LANGUAGES } from "./office-languages.js";
import { seededShuffle } from "./seeded.js";

export const INTERNET_COST = { open: 5, blog: 3, board: 3, manual: 5, lecture: 10 };
export const INTERNET_TYPES = { blog: "개인 홈페이지", board: "개발 게시판", manual: "기술 문서", lecture: "동영상 강의" };
export const INTERNET_ALERTS = [
  [20, "신입, 코딩은 안 하고 인터넷만 보고 있네?"],
  [60, "인터넷 검색하는 데 한 시간씩 걸려?"],
];

const TITLES = {
  blog: ["누군가의 10년 된 블로그", "퇴사한 개발자의 개인 홈페이지", "어느 대학생의 과제 정리"],
  board: ["나와 똑같은 문제를 겪은 사람", "지나가던 고수의 댓글", "어느 대학생의 과제 정리"],
  manual: ["아무도 읽지 않는 공식 문서", "공식 문서 부록에만 있는 예제"],
  lecture: ["어느 인도인 개발자의 강의", "어느 인도인 개발자의 강의 (저화질)"],
};

function detours(topic) {
  return [
    { id: "self-fixed", type: "board", site: "qna", title: "결국 자체 해결했다는 사람", author: "급해요", date: "2006-02-25",
      question: `${topic}에서 자꾸 결과가 이상합니다. 오늘 안으로 해결해야 하는데요.`,
      paragraphs: ["아, 해결했습니다. 신경 써 주셔서 감사합니다."],
      comments: [["마지막 접속 2006.02.25", "작성자가 추가 답변을 받지 않습니다."]],
      reaction: "그래서 어떻게 해결했는데?!", useful: false },
    { id: "unanswered", type: "board", site: "cafe", title: "3년째 답변이 없는 질문", author: "새벽세시", date: "2003-02-08",
      question: `${topic} 질문입니다. 실행하면 제 컴퓨터에서만 안 됩니다.`,
      paragraphs: ["첨부파일을 올리려 했는데 용량이 넘었습니다. 필요하시면 쪽지 주세요."],
      comments: [], useful: false },
    { id: "one-line", type: "blog", site: "blog", title: "천재 개발자의 한 줄짜리 코드", author: "한줄주의", date: "2006-03-02",
      paragraphs: ["어제는 한 줄이었습니다. 오늘 출력해 보니 프린터가 여섯 페이지를 토해 냈습니다.",
        "압축하기 전 소스는 집에 있습니다. 다음에 올리겠습니다."],
      comments: [["웹마스터", "가로 스크롤을 끝까지 내리면 주석이 있습니다. ‘TODO: 설명’."]], useful: false },
  ];
}

export function internetFeed(seed, mission) {
  if (!mission || (mission.type && mission.type !== "code")) return [];
  const language = mission.language ?? "python";
  const topic = missionTopics(mission)[0] ?? "코드 첫 실행";
  const salt = Array.from(mission.id).reduce((sum, ch) => (Math.imul(sum, 31) + ch.codePointAt(0)) | 0, 684);
  const pickTitle = (type, offset) => seededShuffle(TITLES[type], seed, salt + offset)[0];
  const related = relatedIntranetArticles(mission);
  const mainDoc = related[0];
  const altDoc = related.find(doc => doc.id !== mainDoc?.id && doc.site !== mainDoc?.site) ?? related[1];
  const source = (doc, type, offset) => ({
    ...doc, id: `note-${doc.id}`, type, sourceTitle: doc.title,
    site: type === "manual" ? "manual" : type === "blog" ? "blog" : doc.site === "qna" ? "qna" : "cafe",
    title: pickTitle(type, offset), useful: true,
  });
  const selected = [];
  if (mainDoc) selected.push(source(mainDoc, "blog", 1));
  if (altDoc) selected.push(source(altDoc, altDoc.site === "manual" || (salt + seed) % 2 === 0 ? "manual" : "board", 2));
  const lesson = lectureFor(language, topic, mainDoc);
  selected.push({
    id: "lecture", type: "lecture", title: pickTitle("lecture", 3), sourceTitle: lesson.title,
    author: "Arun Rao", date: "2006-02-12", useful: true, lesson,
  });
  selected.push(...seededShuffle(detours(topic), seed, salt + 4).slice(0, 5 - selected.length));
  return seededShuffle(selected, seed, salt + 5);
}

const ARRAYS = {
  python: "ports = [80, 110, 143]\nprint(ports[0])  # 80\nprint(len(ports))  # 3",
  javascript: "var ports = [80, 110, 143];\nvar first = ports[0];  // 80\nvar count = ports.length;  // 3",
  cpp: "int ports[] = {80, 110, 143};\nint first = ports[0];  // 80\nint count = sizeof(ports) / sizeof(ports[0]);",
};
const ARRAY_TOPICS = ["배열", "반복문", "2차원 배열", "정렬된 배열"];

function lectureFor(language, topic, doc) {
  const array = ARRAY_TOPICS.includes(topic);
  const chapter = array ? "arrays" : ({
    "변수": "variables", "사칙연산": "arithmetic", "출력": "output", "문자열": "strings",
    "조건문": "conditions", "함수": "functions", "정렬": "sorting", "탐색": "search",
    "딕셔너리": "lookup tables", "집합": "sets", "디버깅": "debugging",
  })[topic] ?? "checking a small example";
  const detail = array ? "첫 칸은 0번입니다. 마지막 칸은 길이보다 하나 작습니다." :
    doc?.paragraphs[0] ?? "작은 입력을 하나 골라 예상 결과와 실제 값을 비교하세요.";
  const example = array ? ARRAYS[language] : doc?.example ?? ARRAYS[language];
  return {
    title: `${LANGUAGES[language].name} · ${topic} 미니 강의`,
    duration: 16,
    frames: [
      { at: 0, caption: `Hello my friends! Today we are going to learn about ${chapter}!`, board: topic, code: "" },
      { at: 4, caption: array ? "Look at the first box. We start counting at zero!" :
        "Look at the board. Start with a small example and check each step.", board: detail, code: example.split("\n").slice(0, 2).join("\n") },
      { at: 9, caption: array ? "The length is three, but the last index is two." :
        "Compare what the program does with the result you expected.", board: detail, code: example },
      { at: 13, caption: "Very simple, very easy!", board: detail, code: example },
    ],
  };
}

export function internetItem(mission, seed, id) {
  return internetFeed(seed, mission).find(item => item.id === id);
}

export function internetQuote(state, mission, action, item) {
  const entry = state.web?.jobs[mission?.id];
  if (action === "open") return entry?.opened ? 0 : INTERNET_COST.open;
  if (!item) return null;
  if (action === "watched") return entry?.read[item.id] ? 0 : null;
  return entry?.read[item.id] ? 0 : INTERNET_COST[item.type];
}
