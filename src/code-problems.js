const sample = (args, expected) => ({ args, expected });

// Keep shipped templates stable for seeded saves. New pools can select a newer ruleset.
export const CODE_PROBLEMS = [
  {
    id: "desk-calculator", difficulty: "beginner", tags: ["변수", "사칙연산", "조건문"],
    title: "사내 계산기 연산 연결", signature: "calculate(a, b, op)",
    brief: "총무팀이 전표 검산용 계산기를 만들었는데 연산 버튼이 연결되지 않았어요.",
    contract: "정수 a, b와 +, -, *, /를 받아 계산 결과를 반환하세요. /는 나눗셈이고 0으로 나누면 None을 반환하세요.",
    hint: "op에 따라 if로 분기하세요. b가 0인지 먼저 확인하면 나눗셈 오류를 피할 수 있어요.",
    solution: [
      'if op == "+": return a + b', 'if op == "-": return a - b', 'if op == "*": return a * b',
      "return a / b if b != 0 else None",
    ],
    generate(r) {
      const a = r(10, 99), b = r(2, 9);
      return { public: [sample([a, b, "+"], a + b), sample([a, b, "-"], a - b)],
        hidden: [sample([b, a, "*"], b * a), sample([3 * b, 2, "/"], 3 * b / 2), sample([a, 0, "/"], null), sample([2, 9, "-"], -7)] };
    },
  },
  {
    id: "atm-withdraw", difficulty: "beginner", tags: ["변수", "사칙연산", "조건문"],
    title: "은행 고객사 ATM 출금 검수", signature: "withdraw(balance, amount)",
    brief: "모의 ATM이 잔액보다 큰 금액도 빼 줘요. 출금한 뒤 잔액을 계산하는 부분을 고쳐 주세요.",
    contract: "금액이 양수이고 잔액 이하라면 차감한 정수를, 그 외에는 원래 잔액을 반환하세요.",
    hint: "정확히 잔액만큼 뽑는 요청도 허용돼요. 0과 음수 요청은 거절하세요.",
    solution: ["if 0 < amount <= balance:", "    return balance - amount", "return balance"],
    generate(r) {
      const balance = r(6, 20) * 1000, amount = r(1, 5) * 1000;
      return { public: [sample([balance, amount], balance - amount), sample([balance, balance + 1000], balance)],
        hidden: [sample([balance, balance], 0), sample([balance, 0], balance), sample([balance, -amount], balance), sample([0, 1000], 0)] };
    },
  },
  {
    id: "number-baseball", difficulty: "beginner", tags: ["문자열", "반복문", "조건문"],
    title: "사내 이벤트 숫자 야구 채점", signature: "count_hits(secret, guess)",
    brief: "송년회 게임 결과가 자꾸 틀려요. 콘솔은 만들어져 있으니 판정만 구현해 주세요.",
    contract: "각기 다른 숫자 세 개로 된 문자열을 받습니다. 위치까지 같으면 스트라이크, 포함되지만 위치가 다르면 볼을 세어 [스트라이크, 볼]을 반환하세요.",
    hint: "guess를 한 자리씩 돌며 같은 위치인지 먼저 확인하고, 아니라면 그 숫자가 secret에 포함되는지 보세요.",
    solution: ["strikes = balls = 0", "for index, digit in enumerate(guess):", "    if digit == secret[index]:",
      "        strikes += 1", "    elif digit in secret:", "        balls += 1", "return [strikes, balls]"],
    generate(r) {
      const n = r(0, 5), digits = Array.from({ length: 5 }, (_, i) => String(n + i));
      const [a, b, c, d, e] = digits;
      return { public: [sample([a + b + c, a + c + d], [1, 1]), sample([a + b + c, a + b + c], [3, 0])],
        hidden: [sample([a + b + c, b + c + a], [0, 3]), sample([a + b + c, d + e + a], [0, 1]), sample(["147", "258"], [0, 0])] };
    },
  },
  {
    id: "office-rps", difficulty: "beginner", tags: ["문자열", "조건문", "딕셔너리"],
    title: "사내 게시판 가위바위보 판정", signature: "match_result(player, opponent)",
    brief: "사내 게시판 이벤트에서 무승부도 승리로 집계됩니다. 결과 계산만 고쳐 주세요.",
    contract: "입력은 R(바위), P(보), S(가위)입니다. 플레이어 기준으로 WIN, DRAW, LOSE 중 하나를 반환하세요.",
    hint: "같은 패를 먼저 처리하고, 각 패가 이기는 상대를 사전 한 개로 적어보세요.",
    solution: ['if player == opponent: return "DRAW"', 'beats = {"R": "S", "P": "R", "S": "P"}',
      'return "WIN" if beats[player] == opponent else "LOSE"'],
    generate(r) {
      const hands = ["R", "S", "P"], i = r(0, 2), pick = hands[i], beat = hands[(i + 1) % 3];
      return { public: [sample([pick, beat], "WIN"), sample([beat, beat], "DRAW")],
        hidden: hands.flatMap((hand, j) => [sample([hand, hands[(j + 2) % 3]], "LOSE"), sample([hand, hands[(j + 1) % 3]], "WIN"), sample([hand, hand], "DRAW")]) };
    },
  },
  {
    id: "shipping-boundary", difficulty: "beginner", tags: ["조건문", "사칙연산", "디버깅"],
    title: "무료배송 기준 금액 오류", signature: "delivery_fee(total, threshold, fee)",
    brief: "딱 기준 금액을 채운 고객도 배송비를 냈어요. 비교 연산자를 검수해 주세요.",
    contract: "total이 threshold 이상이면 0을, 미만이면 fee를 반환하세요.",
    starter: ["if total > threshold:", "    return 0", "return fee"],
    hint: "조건에 ‘같아도’가 들어가야 정확히 기준 금액인 주문을 포함할 수 있어요.",
    solution: ["return 0 if total >= threshold else fee"],
    generate(r) {
      const threshold = r(25, 65) * 1000, fee = r(20, 45) * 100;
      return { public: [sample([threshold, threshold, fee], 0), sample([threshold - 1000, threshold, fee], fee)],
        hidden: [sample([threshold + 1, threshold, fee], 0), sample([0, 10, 481], 481), sample([0, 0, 500], 0)] };
    },
  },
  {
    id: "lottery-draw", difficulty: "intermediate", tags: ["배열", "집합", "정렬", "반복문"],
    title: "고객 감사 행사 로또 번호 생성", signature: "lottery(candidates, count)",
    brief: "난수 생성기는 다른 팀에서 만들었어요. 후보 목록에서 유효한 번호를 뽑는 부분만 구현하세요.",
    contract: "입력 순서대로 1~45의 중복 없는 번호를 count개까지 모아 오름차순 목록으로 반환하세요. 부족하면 확보한 번호만 반환하세요.",
    hint: "후보를 순회하면서 이미 담긴 값인지 보고, 충분히 모은 뒤 sorted()를 호출하세요.",
    solution: ["picked = []", "for number in candidates:", "    if len(picked) >= count: break",
      "    if 1 <= number <= 45 and number not in picked:", "        picked.append(number)", "return sorted(picked)"],
    generate(r) {
      const n = r(5, 30);
      return { public: [sample([[0, n + 2, n, n, 46, 1, 45], 3], [1, n, n + 2]), sample([[46, 45, 45], 6], [45])],
        hidden: [sample([[8, 7, 6, 5, 4, 3, 2, 1], 6], [3, 4, 5, 6, 7, 8]), sample([[2, 1], 0], []), sample([[], 3], [])] };
    },
  },
  {
    id: "contacts-search", difficulty: "intermediate", tags: ["문자열", "딕셔너리", "탐색"],
    title: "거래처 주소록 조회", signature: "lookup(contacts, query)",
    brief: "복사한 이름에 공백이 붙으면 거래처 전화번호를 못 찾아요. 검색 기능만 수정해 주세요.",
    contract: "이름과 전화번호의 딕셔너리를 받아 양끝 공백과 대소문자를 무시하고 첫 일치의 전화번호를 반환하세요. 없으면 빈 문자열을 반환하세요.",
    hint: "검색어만 다듬으면 주소록 쪽의 표기 차이는 남아요. 두 문자열 모두 strip().lower()로 비교해 보세요.",
    solution: ["target = query.strip().lower()", "for name, phone in contacts.items():",
      "    if name.strip().lower() == target: return phone", 'return ""'],
    generate(r) {
      const last = r(1000, 9999), book = { " Office ": "02-555-" + last, "QA Lab": "031-600-1000" };
      return { public: [sample([book, " OFFICE "], book[" Office "]), sample([book, "warehouse"], "")],
        hidden: [sample([book, "qa lab"], book["QA Lab"]), sample([{ "장바구니 팀": "02-10" }, " 장바구니 팀 "], "02-10"), sample([{}, "office"], "")] };
    },
  },
  {
    id: "vending-change", difficulty: "intermediate", tags: ["사칙연산", "반복문", "배열"],
    title: "탕비실 자판기 거스름돈", signature: "change_coins(paid, price)",
    brief: "새 자판기 화면에 반환할 동전 개수를 출력해야 해요. 동전 재고는 충분하다고 가정합니다.",
    contract: "거스름돈을 500원, 100원, 50원, 10원 순서로 최대한 큰 동전부터 나누어 각 개수를 배열로 반환하세요. 부족하면 빈 배열입니다. 입력은 10원 단위입니다.",
    hint: "정수 나눗셈 //으로 개수를 구하고, 나머지 %를 다음 동전으로 넘기세요.",
    solution: ["if paid < price: return []", "remaining = paid - price", "coins = []", "for unit in [500, 100, 50, 10]:",
      "    coins.append(remaining // unit)", "    remaining %= unit", "return coins"],
    generate(r) {
      const n = r(1, 4);
      return { public: [sample([3000, 3000 - (500 * n + 160)], [n, 1, 1, 1]), sample([500, 600], [])],
        hidden: [sample([500, 500], [0, 0, 0, 0]), sample([1000, 640], [0, 3, 1, 1]), sample([4200, 1240], [5, 4, 1, 1])] };
    },
  },
  {
    id: "inventory-list", difficulty: "intermediate", tags: ["배열", "반복문", "조건문", "재고 관리"],
    title: "판매 가능 재고만 집계", signature: "inventory_total(stock)",
    brief: "재고표에 매진(0)과 오류값(음수)이 섞여 있어요. 실제 판매 가능한 수량 합계를 구하세요.",
    contract: "정수 배열 stock에서 양수인 수량만 합해서 정수를 반환하세요.",
    hint: "for로 각 수량을 확인하고 0보다 큰 경우에만 합계에 더하세요.",
    solution: ["total = 0", "for quantity in stock:", "    if quantity > 0: total += quantity", "return total"],
    generate(r) {
      const a = r(2, 30), b = r(4, 40);
      return { public: [sample([[a, -2, 0, b]], a + b), sample([[0, -8]], 0)],
        hidden: [sample([[]], 0), sample([[4, 4, 4, -9]], 12), sample([[b, a, -b, 900]], a + b + 900)] };
    },
  },
  {
    id: "order-sort", difficulty: "intermediate", tags: ["정렬", "배열", "함수"],
    title: "창고 주문 피킹 순서 정렬", signature: "pick_order(orders)",
    brief: "창고에서 긴급 주문을 먼저 포장해 달래요. 같은 우선순위에서는 주문 번호가 작은 것부터 처리해요.",
    contract: "[주문 번호, 우선순위] 형태의 주문을 우선순위 내림차순, 같은 값일 때 주문 번호 오름차순으로 정렬한 뒤 주문 번호만 반환하세요.",
    hint: "sorted의 key 옵션에 (-우선순위, 주문 번호) 쌍을 넘기면 두 기준을 함께 적용할 수 있어요.",
    solution: ["ordered = sorted(orders, key=lambda order: (-order[1], order[0]))", "return [order[0] for order in ordered]"],
    generate(r) {
      const n = r(10, 90);
      return { public: [sample([[[n + 2, 3], [n, 2], [n + 1, 3]]], [n + 1, n + 2, n]), sample([[]], [])],
        hidden: [sample([[[8, 2], [7, 2], [6, 2]]], [6, 7, 8]), sample([[[2, 0], [7, 3], [1, -1]]], [7, 2, 1]), sample([[[n, 5]]], [n])] };
    },
  },
  {
    id: "tic-tac-toe", difficulty: "advanced", tags: ["2차원 배열", "조건문", "반복문", "기초 알고리즘"],
    title: "사내 동호회 틱택토 승자 판정", signature: "winner(board)",
    brief: "게시판용 미니게임은 그려져 있어요. 대각선을 놓치는 승자 판정만 작업하세요.",
    contract: "3×3 배열의 가로·세로·대각선에 X 또는 O 세 개가 이어지면 해당 문자를 반환하세요. 승자가 없으면 빈 문자열입니다. 빈 칸은 빈 문자열입니다.",
    hint: "행 세 개와 열 세 개, 대각선 두 개를 목록으로 모으면 같은 조건을 반복 적용할 수 있어요.",
    solution: ["lines = list(board) + list(zip(*board))", "lines += [[board[i][i] for i in range(3)], [board[i][2-i] for i in range(3)]]",
      "for a, b, c in lines:", "    if a and a == b == c: return a", 'return ""'],
    generate(r) {
      const token = r(0, 1) ? "X" : "O", other = token === "X" ? "O" : "X", e = "";
      return { public: [sample([[[token, token, token], [other, e, e], [e, other, e]]], token), sample([[[e, e, e], [e, e, e], [e, e, e]]], "")],
        hidden: [sample([[[token, e, other], [e, other, e], [other, token, e]]], other),
          sample([[[e, token, other], [other, token, e], [e, token, e]]], token),
          sample([[[token, e, e], [other, token, e], [e, other, token]]], token)] };
    },
  },
  {
    id: "cart-coupon", difficulty: "advanced", tags: ["배열", "사칙연산", "함수", "디버깅"],
    title: "장바구니 할인 합계 복구", signature: "cart_total(items, threshold, coupon)",
    brief: "쿠폰 문구는 보이는데 결제 금액이 단가만 합산해요. 수량과 쿠폰을 함께 계산해 주세요.",
    contract: "[단가, 수량] 배열을 합산하고 합계가 threshold 이상이면 coupon을 빼세요. 금액은 0보다 작아질 수 없어요.",
    starter: ["total = sum(price for price, quantity in items)", "return total"],
    hint: "각 항목은 단가×수량이에요. 쿠폰을 뺀 뒤 max(0, …)으로 0원을 하한으로 두세요.",
    solution: ["total = sum(price * quantity for price, quantity in items)",
      "if total >= threshold: total -= coupon", "return max(0, total)"],
    generate(r) {
      const n = r(10, 90) * 100, m = r(1, 5) * 100;
      return { public: [sample([[[n, 2], [m, 1]], 2 * n + m, m], 2 * n), sample([[[n, 2]], 3 * n, m], 2 * n)],
        hidden: [sample([[[500, 1]], 500, 900], 0), sample([[], 0, 300], 0), sample([[[300, 0], [750, 3]], 2000, 300], 1950)] };
    },
  },
  {
    id: "catalog-search", difficulty: "advanced", tags: ["정렬된 배열", "탐색", "이진 탐색"],
    title: "상품 색인에서 첫 행 찾기", signature: "first_index(codes, code)",
    brief: "상품 코드가 중복되면 아무 행이나 열려요. 오름차순 색인의 첫 일치 위치를 돌려 주세요.",
    contract: "정렬된 codes에서 code가 처음 나오는 0부터 시작하는 위치를 반환하세요. 없으면 -1입니다.",
    hint: "중간 값이 찾는 값과 같더라도 왼쪽에 한 번 더 있을 수 있어요. 먼저 왼쪽 끝 경계를 찾아 보세요.",
    solution: ["left, right = 0, len(codes)", "while left < right:", "    mid = (left + right) // 2",
      "    if codes[mid] < code: left = mid + 1", "    else: right = mid", "return left if left < len(codes) and codes[left] == code else -1"],
    generate(r) {
      const n = r(10, 99);
      return { public: [sample([[n - 1, n, n, n + 1], n], 1), sample([[n, n + 2], n + 1], -1)],
        hidden: [sample([[], n], -1), sample([[0, 0, 1, 8], 0], 0), sample([[-5, 2, 6], 6], 2), sample([[n, n, n], n + 1], -1)] };
    },
  },
  {
    id: "inventory-reserve", difficulty: "advanced", tags: ["딕셔너리", "반복문", "자료구조", "재고 관리"],
    preserveArgs: true,
    title: "창고 주문 예약 재고 처리", signature: "reserve(stock, order)",
    brief: "한 상품이 부족하면 주문 전체를 보류하기로 했는데 다른 상품 재고가 먼저 빠져요.",
    contract: "stock과 order는 상품별 수량 사전입니다. 주문 전체를 충족할 때만 차감한 새 사전을 반환하세요. 하나라도 부족하면 None을 반환하세요.",
    hint: "재고에 없는 상품은 0개예요. stock.copy()에 작업하거나, 주문을 전부 확인한 뒤 차감해도 돼요.",
    solution: ["updated = stock.copy()", "for sku, amount in order.items():", "    if updated.get(sku, 0) < amount: return None",
      "    if amount: updated[sku] -= amount", "return updated"],
    generate(r) {
      const n = r(3, 12);
      return { public: [sample([{ mouse: n, cable: 3 }, { mouse: 2, cable: 3 }], { mouse: n - 2, cable: 0 }), sample([{ mouse: n }, { mouse: n + 1 }], null)],
        hidden: [sample([{ mouse: n }, { cable: 1 }], null), sample([{ mouse: 4 }, {}], { mouse: 4 }),
          sample([{ mouse: 4, cable: 9 }, { mouse: 4 }], { mouse: 0, cable: 9 })] };
    },
  },
  {
    id: "duplicate-webhook", difficulty: "advanced", tags: ["집합", "배열", "반복문", "디버깅"],
    title: "중복 발송 로그 제거", signature: "unique_shipments(events)",
    brief: "납품 확인을 다시 보낼 때 같은 주문이 두 번 출고 처리됩니다. 최초 수신 순서를 유지하면서 중복만 없애세요.",
    contract: "주문 번호 배열 events에서 각 번호의 첫 등장만 남긴 배열을 반환하세요.",
    starter: ["return sorted(set(events))"],
    hint: "정렬을 하면 입력 순서를 잃어요. 이미 나온 번호를 집합에 기록하고, 처음 본 번호만 결과 목록에 더하세요.",
    solution: ["seen, result = set(), []", "for number in events:", "    if number not in seen:",
      "        seen.add(number)", "        result.append(number)", "return result"],
    generate(r) {
      const n = r(10, 90);
      return { public: [sample([[n + 2, n, n + 2, n + 1, n]], [n + 2, n, n + 1]), sample([[]], [])],
        hidden: [sample([[5, 5, 5]], [5]), sample([[0, -1, 1, 0, -1]], [0, -1, 1]), sample([[n, n + 1, n + 2]], [n, n + 1, n + 2])] };
    },
  },
];
