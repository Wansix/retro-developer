const ints = "vector<int>";
const rows = "vector<vector<int>>";
const names = "vector<vector<string>>";
const contacts = "vector<pair<string, string>>";
const stock = "map<string, int>";

export const CPP_PROBLEMS = {
  "desk-calculator": {
    args: ["int", "int", "string"], result: "optional<double>", headers: ["optional", "string"],
    hint: "결과는 optional<double>입니다. 0으로 나누면 nullopt, 그 외 나눗셈은 double(a) / b를 써 보세요.",
    solution: ['if (op == "+") return a + b;', 'if (op == "-") return a - b;',
      'if (op == "*") return a * b;', "if (b == 0) return nullopt;", "return double(a) / b;"],
  },
  "atm-withdraw": {
    args: ["int", "int"], result: "int",
    solution: ["if (amount > 0 && amount <= balance) return balance - amount;", "return balance;"],
  },
  "number-baseball": {
    args: ["string", "string"], result: ints, headers: ["string", "vector"],
    solution: ["int strikes = 0, balls = 0;", "for (size_t i = 0; i < guess.size(); i++) {",
      "    if (guess[i] == secret[i]) strikes++;", "    else if (secret.find(guess[i]) != string::npos) balls++;",
      "}", "return {strikes, balls};"],
  },
  "office-rps": {
    args: ["string", "string"], result: "string", headers: ["string"],
    hint: "같은 패를 먼저 처리하고 R이 S를, S가 P를, P가 R을 이기는 경우를 묶어 보세요.",
    solution: ['if (player == opponent) return "DRAW";',
      'if ((player == "R" && opponent == "S") || (player == "S" && opponent == "P") ||',
      '    (player == "P" && opponent == "R")) return "WIN";', 'return "LOSE";'],
  },
  "shipping-boundary": {
    args: ["int", "int", "int"], result: "int",
    starter: ["if (total > threshold) return 0;", "return fee;"],
    solution: ["return total >= threshold ? 0 : fee;"],
  },
  "lottery-draw": {
    args: [ints, "int"], result: ints, headers: ["algorithm", "vector"],
    hint: "벡터에 없는 값만 push_back으로 넣고, 마지막에 sort(picked.begin(), picked.end())를 쓰세요.",
    solution: ["vector<int> picked;", "for (int number : candidates) {",
      "    if (int(picked.size()) >= count) break;",
      "    if (number >= 1 && number <= 45 && find(picked.begin(), picked.end(), number) == picked.end())",
      "        picked.push_back(number);", "}", "sort(picked.begin(), picked.end());", "return picked;"],
  },
  "contacts-search": {
    args: [contacts, "string"], result: "string", headers: ["cctype", "string", "utility", "vector"],
    contract: "주소록은 입력 순서를 가진 이름·전화번호(vector<pair<string, string>>) 목록입니다. 양끝 공백과 영어 대소문자를 무시해 첫 전화번호를 반환하세요. 없으면 빈 문자열입니다.",
    hint: "각 항목의 first가 이름, second가 전화번호입니다. find_first_not_of와 find_last_not_of로 공백을 제거하고 영어 문자를 소문자로 바꾸세요.",
    solution: ['auto tidy = [](string text) {', '    size_t start = text.find_first_not_of(" \\t\\n\\r");',
      '    if (start == string::npos) return string();', '    text = text.substr(start, text.find_last_not_of(" \\t\\n\\r") - start + 1);',
      '    for (char &c : text) c = char(tolower(static_cast<unsigned char>(c)));', '    return text;', '};',
      "for (const auto &entry : contacts) if (tidy(entry.first) == tidy(query)) return entry.second;", 'return "";'],
  },
  "vending-change": {
    args: ["int", "int"], result: ints, headers: ["vector"],
    hint: "정수끼리 / 연산을 하면 몫이 나와요. %로 다음 동전에 넘길 나머지를 구하세요.",
    solution: ["if (paid < price) return {};", "int units[] = {500, 100, 50, 10}, left = paid - price;",
      "vector<int> coins;", "for (int unit : units) {", "    coins.push_back(left / unit);", "    left %= unit;", "}", "return coins;"],
  },
  "inventory-list": {
    args: [ints], result: "int", headers: ["vector"],
    solution: ["int total = 0;", "for (int quantity : stock) if (quantity > 0) total += quantity;", "return total;"],
  },
  "order-sort": {
    args: [rows], result: ints, headers: ["algorithm", "vector"],
    hint: "sort의 세 번째 인자로 비교 함수를 넘기세요. 우선순위가 다르면 먼저 큰 값을, 같으면 작은 주문 번호를 고르세요.",
    solution: ["sort(orders.begin(), orders.end(), [](const vector<int>& a, const vector<int>& b) {",
      "    return a[1] == b[1] ? a[0] < b[0] : a[1] > b[1];", "});", "vector<int> ids;",
      "for (const auto &order : orders) ids.push_back(order[0]);", "return ids;"],
  },
  "tic-tac-toe": {
    args: [names], result: "string", headers: ["string", "vector"],
    solution: ["auto lines = board;",
      "for (int i = 0; i < 3; i++) lines.push_back({board[0][i], board[1][i], board[2][i]});",
      "lines.push_back({board[0][0], board[1][1], board[2][2]});",
      "lines.push_back({board[0][2], board[1][1], board[2][0]});",
      "for (const auto &line : lines) if (!line[0].empty() && line[0] == line[1] && line[1] == line[2]) return line[0];", 'return "";'],
  },
  "cart-coupon": {
    args: [rows, "int", "int"], result: "int", headers: ["algorithm", "vector"],
    starter: ["int total = 0;", "for (const auto &item : items) total += item[0];", "return total;"],
    solution: ["int total = 0;", "for (const auto &item : items) total += item[0] * item[1];",
      "if (total >= threshold) total -= coupon;", "return max(0, total);"],
  },
  "catalog-search": {
    args: [ints, "int"], result: "int", headers: ["algorithm", "vector"],
    solution: ["auto pos = lower_bound(codes.begin(), codes.end(), code);",
      "return pos != codes.end() && *pos == code ? int(pos - codes.begin()) : -1;"],
  },
  "inventory-reserve": {
    args: [stock, stock], result: "optional<map<string, int>>", headers: ["map", "optional", "string"],
    hint: "stock이 값으로 전달되므로 복사본을 바꿔도 돼요. 찾는 상품이 없거나 부족하면 nullopt를 반환하세요.",
    solution: ["for (const auto &entry : order) {",
      "    auto found = stock.find(entry.first);",
      "    if (entry.second == 0) continue;",
      "    if (found == stock.end() || found->second < entry.second) return nullopt;",
      "    found->second -= entry.second;", "}", "return stock;"],
  },
  "duplicate-webhook": {
    args: [ints], result: ints, headers: ["algorithm", "set", "vector"],
    starter: ["sort(events.begin(), events.end());", "events.erase(unique(events.begin(), events.end()), events.end());", "return events;"],
    solution: ["set<int> seen;", "vector<int> result;",
      "for (int number : events) if (seen.insert(number).second) result.push_back(number);", "return result;"],
  },
  deployment: {
    args: ["vector<bool>"], result: "string", headers: ["string", "vector"],
    hint: "for로 결과를 훑으면서 하나라도 false라면 HOLD를 즉시 반환하세요.",
    solution: ['for (bool result : results) if (!result) return "HOLD";', 'return "DEPLOY";'],
  },
};

export function cppLiteral(value, type) {
  if (type.startsWith("optional<")) return value === null ? "nullopt" : cppLiteral(value, type.slice(9, -1));
  if (type === contacts || type === stock) {
    return type + "{" + Object.entries(value).map(([key, item]) => "{" + JSON.stringify(key) + ", " + JSON.stringify(item) + "}").join(", ") + "}";
  }
  if (Array.isArray(value)) {
    const elementType = type.slice(7, -1);
    return type + "{" + value.map(item => cppLiteral(item, elementType)).join(", ") + "}";
  }
  return JSON.stringify(value);
}
