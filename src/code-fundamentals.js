const sample = (args, expected) => ({ args, expected });

function changeLine(starter, solution, hint) {
  return {
    starter,
    solution,
    hint,
    grammar: "표시된 한 줄만 고치세요. 나머지 코드는 이미 준비돼 있어요.",
  };
}

const cpp = (args, result, starter, solution, hint, headers) => ({
  ...changeLine(starter, solution, hint), args, result, headers,
});

function label(id, title, signature, input) {
  const fixed = ["labels = " + input, "return labels"];
  return {
    id, title, signature, difficulty: "beginner", fundamentals: true, minutes: 25,
    tags: ["변수", "문자열", "함수"],
    brief: "문자열을 라벨 변수에 넣는 한 줄만 고치면 돼요.",
    contract: `라벨에 빈 문자열 대신 입력 변수 ${input}를 저장하세요. 아래 return 줄은 그대로 두세요.`,
    ...changeLine(['labels = ""  # 이 줄만 고치세요.', "return labels"], fixed, `labels에 ${input}를 대입하세요. 변수 이름에 따옴표를 붙이면 이름 자체가 출력돼요.`),
    variants: {
      javascript: changeLine(['var labels = ""; // 이 줄만 고치세요.', "return labels;"],
        ["var " + fixed[0] + ";", "return labels;"], `= 오른쪽에 ${input}를 쓰면 그 변수의 내용이 복사돼요.`),
      cpp: cpp(["string"], "string", ['string labels = ""; // 이 줄만 고치세요.', "return labels;"],
        ["string " + fixed[0] + ";", "return labels;"], `string은 문자열 자료형이에요. = 오른쪽에 ${input}를 쓰세요.`, ["string"]),
    },
    generate(r) {
      const titles = ["밤마켓", "배송팀", "미래소프트", "쇼핑몰"];
      const text = titles[r(0, titles.length - 1)];
      return { public: [sample([text], text), sample(["영업팀"], "영업팀")], hidden: [sample(["QA Lab"], "QA Lab"), sample(["A-21"], "A-21")] };
    },
  };
}

function addition(id, title, signature, left, right) {
  const sum = `total = ${left} + ${right}`;
  return {
    id, title, signature, difficulty: "beginner", fundamentals: true, minutes: 25,
    tags: ["변수", "사칙연산"],
    brief: "장부에 나뉘어 적힌 두 숫자를 더하는 일입니다.",
    contract: `total에 ${left}와 ${right}를 더한 값을 저장하세요. total을 반환하는 줄은 준비돼 있어요.`,
    ...changeLine(["total = 0  # 이 줄만 고치세요.", "return total"], [sum, "return total"], "두 변수 이름을 +로 연결하세요. 숫자를 직접 적으면 다른 입력에서는 결과가 틀려요."),
    variants: {
      javascript: changeLine(["var total = 0; // 이 줄만 고치세요.", "return total;"],
        ["var " + sum + ";", "return total;"], "var total 선언의 오른쪽에 숫자 두 개를 더하는 식을 넣으세요."),
      cpp: cpp(["int", "int"], "int", ["int total = 0; // 이 줄만 고치세요.", "return total;"],
        ["int " + sum + ";", "return total;"], "int total 선언의 오른쪽에 숫자 두 개를 더하는 식을 넣으세요."),
    },
    generate(r) {
      const a = r(2, 18), b = r(3, 32);
      return { public: [sample([a, b], a + b), sample([0, b], b)], hidden: [sample([7, 0], 7), sample([10, 25], 35)] };
    },
  };
}

const threshold = {
  id: "grammar-order-threshold", title: "무료배송 표시 기준", signature: "is_free(total)",
  difficulty: "beginner", fundamentals: true, minutes: 30, tags: ["조건문", "비교"],
  brief: "정확히 30,000원을 주문한 고객도 무료배송 대상입니다.",
  contract: "total이 30000 이상이면 참, 작으면 거짓이 되도록 비교 기호 하나를 고치세요.",
  ...changeLine(["return total > 30000  # 이 줄만 고치세요."], ["return total >= 30000"], ">는 ‘보다 큼’, >=는 ‘같거나 큼’입니다."),
  variants: {
    javascript: changeLine(["return total > 30000; // 이 줄만 고치세요."], ["return total >= 30000;"], "같은 값도 포함하는 비교 기호의 예는 >=입니다."),
    cpp: cpp(["int"], "bool", ["return total > 30000; // 이 줄만 고치세요."], ["return total >= 30000;"], "bool은 참 또는 거짓입니다. >=는 같은 값도 참으로 판단해요."),
  },
  generate(r) {
    return { public: [sample([30000], true), sample([29999], false)], hidden: [sample([r(30001, 70000)], true), sample([r(1, 20000)], false)] };
  },
};

const stockStatus = {
  id: "grammar-stock-status", title: "상품 재고 상태 표시", signature: "status_text(stock)",
  difficulty: "beginner", fundamentals: true, minutes: 30, tags: ["조건문", "문자열"],
  brief: "재고가 있는 상품이 품절로 보입니다. 조건문 안의 표시 문구만 고치세요.",
  contract: 'stock이 0보다 크면 "IN STOCK"을 반환하세요. 나머지는 준비된 "SOLD OUT"을 그대로 쓰세요.',
  ...changeLine(["if stock > 0:", '    return "SOLD OUT"  # 이 줄만 고치세요.', 'return "SOLD OUT"'],
    ["if stock > 0:", '    return "IN STOCK"', 'return "SOLD OUT"'], "if 아래에 들여쓴 줄은 조건이 참일 때만 실행돼요. 그 줄의 따옴표 안을 바꾸세요."),
  variants: {
    javascript: changeLine(["if (stock > 0) {", '    return "SOLD OUT"; // 이 줄만 고치세요.', "}", 'return "SOLD OUT";'],
      ["if (stock > 0) {", '    return "IN STOCK";', "}", 'return "SOLD OUT";'], "중괄호 안은 재고가 있을 때 실행돼요. 안쪽 return의 문자열만 고치세요."),
    cpp: cpp(["int"], "string", ["if (stock > 0) {", '    return "SOLD OUT"; // 이 줄만 고치세요.', "}", 'return "SOLD OUT";'],
      ["if (stock > 0) {", '    return "IN STOCK";', "}", 'return "SOLD OUT";'], "중괄호 안은 재고가 있을 때 실행돼요. 안쪽 return의 문자열만 고치세요.", ["string"]),
  },
  generate(r) {
    return { public: [sample([r(2, 15)], "IN STOCK"), sample([0], "SOLD OUT")], hidden: [sample([1], "IN STOCK"), sample([-1], "SOLD OUT")] };
  },
};

const labels = {
  id: "grammar-label-loop", title: "택배 상자 라벨 수 세기", signature: "sticker_count(boxes)",
  difficulty: "beginner", fundamentals: true, minutes: 35, tags: ["반복문", "변수"],
  brief: "상자 하나마다 라벨이 한 장씩 필요합니다. 반복문은 만들어져 있습니다.",
  contract: "반복할 때마다 total에 1을 더하도록 표시된 줄만 고치세요.",
  ...changeLine(["total = 0", "for index in range(boxes):", "    total += 0  # 이 줄만 고치세요.", "return total"],
    ["total = 0", "for index in range(boxes):", "    total += 1", "return total"], "total += 1은 total = total + 1과 같아요."),
  variants: {
    javascript: changeLine(["var total = 0;", "for (var i = 0; i < boxes; i++) {", "    total += 0; // 이 줄만 고치세요.", "}", "return total;"],
      ["var total = 0;", "for (var i = 0; i < boxes; i++) {", "    total += 1;", "}", "return total;"], "중괄호 안이 상자 수만큼 실행돼요. 한 번 돌 때 total을 1씩 늘리세요."),
    cpp: cpp(["int"], "int", ["int total = 0;", "for (int i = 0; i < boxes; i++) {", "    total += 0; // 이 줄만 고치세요.", "}", "return total;"],
      ["int total = 0;", "for (int i = 0; i < boxes; i++) {", "    total += 1;", "}", "return total;"], "중괄호 안이 상자 수만큼 실행돼요. 한 번 돌 때 total을 1씩 늘리세요."),
  },
  generate(r) {
    const boxes = r(3, 12);
    return { public: [sample([boxes], boxes), sample([0], 0)], hidden: [sample([1], 1), sample([25], 25)] };
  },
};

const totals = {
  id: "grammar-array-total", title: "매대별 재고 합계", signature: "sum_units(stock)",
  difficulty: "beginner", fundamentals: true, minutes: 35, tags: ["배열", "반복문", "변수"],
  brief: "매대별 재고를 한 번씩 확인하는 반복문은 이미 작성되어 있습니다.",
  contract: "반복문 안에서 이번 매대의 수량 units를 total에 더하세요.",
  ...changeLine(["total = 0", "for units in stock:", "    total += 0  # 이 줄만 고치세요.", "return total"],
    ["total = 0", "for units in stock:", "    total += units", "return total"], "units에는 반복할 때마다 이번 매대의 수량이 들어와요. 더하는 값 0을 units로 바꾸세요."),
  variants: {
    javascript: changeLine(["var total = 0;", "for (var i = 0; i < stock.length; i++) {", "    var units = stock[i];", "    total += 0; // 이 줄만 고치세요.", "}", "return total;"],
      ["var total = 0;", "for (var i = 0; i < stock.length; i++) {", "    var units = stock[i];", "    total += units;", "}", "return total;"], "units가 이번 매대 수량입니다. 더하는 값 0을 units로 바꾸세요."),
    cpp: cpp(["vector<int>"], "int", ["int total = 0;", "for (int units : stock) {", "    total += 0; // 이 줄만 고치세요.", "}", "return total;"],
      ["int total = 0;", "for (int units : stock) {", "    total += units;", "}", "return total;"], "units가 이번 매대 수량입니다. 더하는 값 0을 units로 바꾸세요.", ["vector"]),
  },
  generate(r) {
    const units = r(2, 18);
    return { public: [sample([[units, 3, 4]], units + 7), sample([[]], 0)], hidden: [sample([[0, 8]], 8), sample([[2, 2, 2]], 6)] };
  },
};

export const FUNDAMENTAL_DAYS = [
  [
    [label("grammar-slip-name", "배송 라벨 이름 채우기", "slip_name(name)", "name"),
      label("grammar-shift-badge", "안내판 매장 이름 채우기", "badge_text(shop)", "shop")],
    [addition("grammar-stock-add", "두 창고의 재고 더하기", "stock_total(desk, store)", "desk", "store"),
      addition("grammar-restock-add", "입고 뒤 수량 계산", "restock(remaining, arrived)", "remaining", "arrived")],
  ],
  [[threshold], [stockStatus]],
  [[labels], [totals]],
];
