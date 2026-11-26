const notes = {
  javascript: [
    ["basics", "manual", "var와 함수로 화면 값 다루기", ["변수", "사칙연산", "함수", "출력", "문자열"],
      ["JavaScript", "자바스크립트", "var", "return", "console.log", "NaN"],
      "var로 중간값을 만들고 함수에서 return으로 돌려줍니다. 웹 개발에서는 값이 문자열인지 숫자인지 확인하세요. 연습용 실행기에서는 console.log로 확인할 수 있어요.",
      'function area(width, height) {\n    var result = width * height;\n    return result;\n}\nconsole.log(area(3, 7));'],
    ["checks", "qna", "같아야 하는 숫자가 왜 다르죠?", ["조건문", "디버깅", "비교"],
      ["if", "else", "TypeError", "ReferenceError", "SyntaxError", "==="],
      "===는 값과 자료형이 모두 같은지 봅니다. 에러 메시지에 변수가 나오면 먼저 철자를 확인하고, 조건은 기준 바로 아래·같음·바로 위를 각각 시험해 보세요.",
      'var input = "7";\nconsole.log(input === 7); // false\nconsole.log(Number(input) === 7); // true'],
    ["arrays", "cafe", "배열을 한 줄씩 검사하는 방법", ["배열", "반복문", "2차원 배열", "재고 관리"],
      ["for", "while", "loop", "array", "length", "push", "index"],
      "length는 배열의 길이입니다. 첫 위치는 0이라 i < length까지 돌면 마지막 칸을 포함할 수 있습니다. 2차원 배열은 줄 번호와 칸 번호를 따로 두세요.",
      'var sizes = [2, 6, 4];\nfor (var i = 0; i < sizes.length; i++) {\n    console.log(sizes[i]);\n}'],
    ["lookups", "blog", "사내 목록을 찾고 정렬하기", ["정렬", "정렬된 배열", "탐색", "이진 탐색", "딕셔너리", "집합", "자료구조", "기초 알고리즘"],
      ["sort", "search", "object", "indexOf", "dictionary", "binary search"],
      "숫자 배열을 sort할 때는 뺄셈 비교 함수를 넘겨야 합니다. 이름별 값을 저장할 땐 객체가 편합니다. 이미 정렬된 긴 목록에선 중간을 기준으로 범위를 줄일 수 있어요.",
      'var pageSizes = [20, 3, 11];\npageSizes.sort(function (a, b) { return a - b; });\nconsole.log(pageSizes);'],
  ],
  cpp: [
    ["basics", "manual", "int, double과 콘솔 출력", ["변수", "사칙연산", "함수", "출력", "문자열"],
      ["C++", "cpp", "씨플플", "cout", "return", "integer division"],
      "변수와 함수 앞에 자료형을 적습니다. 정수끼리 나누면 소수 부분은 사라집니다. 화면에 값이 필요할 때는 iostream의 std::cout을 사용합니다.",
      '#include <iostream>\nint main() {\n    int width = 7;\n    std::cout << double(width) / 2 << "\\n";\n}'],
    ["checks", "fix", "컴파일러 에러 첫 줄 읽기", ["조건문", "디버깅", "비교"],
      ["if", "else", "expected", "undeclared identifier", "compile error", "segmentation fault", "컴파일"],
      "첫 에러에 나온 줄과 그 윗줄을 확인하세요. 빠진 세미콜론 하나로 다음 줄들이 줄줄이 에러가 날 수 있습니다. 인덱스를 쓰기 전 배열 크기도 확인하세요.",
      'int points = 15;\nif (points >= 10) {\n    points = points - 10;\n}'],
    ["arrays", "cafe", "vector의 크기와 칸 번호", ["배열", "2차원 배열", "반복문", "재고 관리"],
      ["vector", "size", "push_back", "loop", "for", "while", "index", "array"],
      "배열처럼 []로 원소를 읽고 size()로 길이를 구합니다. 첫 칸은 0입니다. 값만 순회하려면 범위 기반 for문으로 간단히 읽을 수 있습니다.",
      '#include <vector>\nstd::vector<int> sizes = {2, 6, 4};\nfor (int value : sizes) {\n    // value를 사용하세요.\n}'],
    ["lookups", "blog", "표준 라이브러리로 목록 정리하기", ["정렬", "정렬된 배열", "탐색", "이진 탐색", "딕셔너리", "집합", "자료구조", "기초 알고리즘"],
      ["sort", "search", "map", "set", "find", "lower_bound", "binary search"],
      "sort는 begin()부터 end() 앞까지 정렬합니다. 키별로 값을 보려면 map, 이미 나온 값만 기록하려면 set이 편합니다.",
      '#include <algorithm>\n#include <vector>\nstd::vector<int> pages = {7, 2, 9};\nstd::sort(pages.begin(), pages.end());'],
  ],
};

export const LANGUAGE_DOCUMENTS = Object.entries(notes).flatMap(([language, entries]) =>
  entries.map(([id, site, title, tags, terms, paragraph, example], index) => ({
    id: language + "-" + id, language, site, title, tags, terms, paragraphs: [paragraph], example,
    author: language === "cpp" ? "컴파일주임" : "문서지기", date: "2006-02-0" + (index + 2), comments: [],
  })));
