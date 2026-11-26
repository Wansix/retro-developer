import { cppLiteral } from "./code-cpp.js";

export function cppJudgeSource(code, check, verify) {
  const cases = verify ? [...check.public, ...check.hidden] : check.public;
  const testBlocks = cases.map((test, index) => {
    const inputs = test.args.map((value, i) => cppLiteral(value, check.argTypes[i]));
    const variables = inputs.map((_, i) => "input" + i);
    const declarations = inputs.map((value, i) => check.argTypes[i] + " " + variables[i] + " = " + value + ";");
    const expected = cppLiteral(test.expected, check.resultType);
    const unchanged = check.preserveArgs ? variables.map((name, i) => " && " + name + " == " + inputs[i]).join("") : "";
    return [
      "case " + index + ": {", ...declarations, "auto actual = " + check.name + "(" + variables.join(", ") + ");",
      "bool ok = actual == " + expected + unchanged + ";",
      ...(index < check.public.length ? ['std::cout << "공개 ' + (index + 1) + ' · 실행값 "; retro_grade::show(actual);',
        'std::cout << (ok ? " ✓" : " ✗") << "\\n";'] : []), "return ok ? 73 : 74;", "}",
    ].join("\n");
  }).join("\n");
  return `
#define main retro_preview
${code}
#undef main
#include <iostream>
#include <cstdlib>
#include <string>
#include <vector>
#include <map>
#include <optional>

namespace retro_grade {
template<class T> void show(const T& value) { std::cout << std::boolalpha << value; }
template<class T> void show(const std::optional<T>& value);
template<class T> void show(const std::vector<T>& value);
template<class K, class V> void show(const std::map<K, V>& value);
template<class T> void show(const std::optional<T>& value) {
  if (value) show(*value); else std::cout << "nullopt";
}
template<class T> void show(const std::vector<T>& value) {
  std::cout << '[';
  for (size_t i = 0; i < value.size(); i++) { if (i) std::cout << ", "; show(value[i]); }
  std::cout << ']';
}
template<class K, class V> void show(const std::map<K, V>& value) {
  std::cout << '{';
  bool first = true;
  for (const auto& item : value) {
    if (!first) std::cout << ", ";
    first = false;
    show(item.first); std::cout << ": "; show(item.second);
  }
  std::cout << '}';
}
}

int main(int argc, char** argv) {
  using namespace std;
  if (argc != 2) return 1;
  switch (std::atoi(argv[1])) {
    ${testBlocks}
    default: return 1;
  }
}
`;
}
