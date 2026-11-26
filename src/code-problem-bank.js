import { CODE_PROBLEMS } from "./code-problems.js";
import { seedValue, seededShuffle } from "./seeded.js";
import { formatMinutes } from "./records-schema.js";
import { JAVASCRIPT_PROBLEMS } from "./code-javascript.js";
import { CPP_PROBLEMS, cppLiteral } from "./code-cpp.js";

export const DIFFICULTIES = {
  beginner: { label: "기초", minutes: 45, reward: { score: 14, hp: -3, stress: -4 } },
  intermediate: { label: "응용", minutes: 60, reward: { score: 16, hp: -3, stress: -4 } },
  advanced: { label: "구현·디버깅", minutes: 75, reward: { score: 19, hp: -3, stress: -4 } },
};
const problems = new Map(CODE_PROBLEMS.map(problem => ["code:" + problem.id, problem]));

export function problemOrder(seed) {
  return Object.keys(DIFFICULTIES).map((difficulty, index) => {
    const pool = CODE_PROBLEMS.filter(problem => problem.difficulty === difficulty);
    return "code:" + pool[seedValue(seed, 410 + index * 41) % pool.length].id;
  });
}

export function problemDeck(seed) {
  return Object.keys(DIFFICULTIES).map((difficulty, index) =>
    seededShuffle(CODE_PROBLEMS.filter(problem => problem.difficulty === difficulty)
      .map(problem => "code:" + problem.id), seed, 712 + index * 53));
}

function pythonLiteral(value) {
  if (value === null) return "None";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (Array.isArray(value)) return "[" + value.map(pythonLiteral).join(", ") + "]";
  if (typeof value === "object") {
    return "{" + Object.entries(value).map(([key, item]) => pythonLiteral(key) + ": " + pythonLiteral(item)).join(", ") + "}";
  }
  return JSON.stringify(value);
}

export function materializeProblem(id, seed, language = "python") {
  const template = problems.get(id);
  if (!template) return;
  const { difficulty, signature, title, tags, brief, contract, hint } = template;
  const { label, minutes, reward } = DIFFICULTIES[difficulty];
  const entry = signature.split("(")[0];
  let variantSalt = [...id].reduce((hash, char) => Math.imul(hash, 31) + char.charCodeAt(0) | 0, 0);
  const randomInt = (min, max) => min + seedValue(seed, variantSalt++) % (max - min + 1);
  const cases = template.generate(randomInt);
  const call = args => entry + "(" + args.map(pythonLiteral).join(", ") + ")";
  const body = lines => ["def " + signature + ":", ...lines.map(line => "    " + line)].join("\n") + "\n";
  const example = cases.public[0];
  const work = {
    id, type: "code", fromBank: true, title, notice: title,
    boss: "신입, ‘" + title + "’ 건이야. 작업 범위는 편집기 옆에 적어 뒀어.",
    brief, difficulty, difficultyLabel: label, tags, minutes, estimate: formatMinutes(minutes), reward,
    requirement: contract, grammar: "지정된 함수가 값을 반환해야 해요. print()는 결과를 확인할 때 쓰세요.",
    starter: body(template.starter ?? ["# 아래 pass를 지우고 핵심 기능을 구현하세요.", "pass"]) + "\nprint(" + call(example.args) + ")\n",
    hint, example: "print(" + call(example.args) + ")", exampleOut: pythonLiteral(example.expected),
    expectedOut: pythonLiteral(example.expected),
    publicExamples: cases.public.map(test => call(test.args) + " → " + pythonLiteral(test.expected)),
    solution: body(template.solution),
    check: { type: "bank-function", name: entry, public: cases.public, hidden: cases.hidden, preserveArgs: !!template.preserveArgs },
  };
  return language === "python" ? work : localizeCodeWork(work, template, cases, language);
}

function localizeCodeWork(work, template, cases, language) {
  const cpp = language === "cpp";
  const version = cpp ? CPP_PROBLEMS[template.id] : JAVASCRIPT_PROBLEMS[template.id];
  const names = template.signature.split("(")[1].slice(0, -1).split(", ");
  const entry = work.check.name;
  const signature = cpp ? version.result + " " + entry + "(" +
    names.map((name, i) => version.args[i] + " " + name).join(", ") + ")" : "function " + template.signature;
  const header = cpp ? (version.headers ?? []).map(name => "#include <" + name + ">\n").join("") + "using namespace std;\n\n" : "";
  const body = lines => header + signature + " {\n" + lines.map(line => "    " + line).join("\n") + "\n}\n";
  const render = value => cpp ? cppLiteral(value, version.result) : JSON.stringify(value);
  const call = args => entry + "(" + args.map((value, i) => cpp ? cppLiteral(value, version.args[i]) : JSON.stringify(value)).join(", ") + ")";
  return {
    ...work, language,
    requirement: version.contract ?? work.requirement.replaceAll("None", cpp ? "nullopt" : "null")
      .replaceAll(/딕셔너리|사전/g, cpp ? "map" : "객체"),
    grammar: cpp ? "지정된 함수가 값을 반환해야 해요. 실행하면 공개 테스트의 실제 값과 기대 값을 확인할 수 있어요." :
      "var와 일반 함수(function)를 쓰세요. console.log()로 출력을 확인하고, 정답은 return으로 돌려주세요.",
    starter: body(version.starter ?? ["// 여기에 기능을 구현하세요.", cpp ? "return {};" : "return null;"]),
    solution: body(version.solution),
    example: call(cases.public[0].args),
    exampleOut: render(cases.public[0].expected),
    expectedOut: render(cases.public[0].expected),
    publicExamples: cases.public.map(test => call(test.args) + " → " + render(test.expected)),
    hint: version.hint ?? work.hint,
    check: { ...work.check, ...(cpp ? { argTypes: version.args, resultType: version.result } : {}) },
  };
}

export function storyInLanguage(work, language) {
  if (language === "python") return work;
  if (work.id === "deployment") {
    const [one, two, three] = work.check.args.map((args, i) => ({ args, expected: work.check.expected[i] }));
    const cases = { public: [one], hidden: [two, three, { args: [[]], expected: "DEPLOY" }] };
    return localizeCodeWork({
      ...work, fromBank: true, tags: ["함수", "배열", "조건문"],
      check: { type: "bank-function", name: "ready", ...cases },
    }, { id: "deployment", signature: "ready(results)" }, cases, language);
  }
  const cpp = language === "cpp";
  const hello = cpp ? 'std::cout << "Hello, World!" << "\\n";' : 'console.log("Hello, World!");';
  return {
    ...work, language,
    grammar: cpp ? "std::cout 뒤에 <<로 출력할 문구를 연결하고, 문장 끝에 ;를 붙이세요." :
      "console.log()는 괄호 안의 값을 출력해요. 출력할 문자열은 따옴표로 감싸세요.",
    example: hello.replace("Hello, World!", "안녕하세요"),
    requirement: "출력 코드를 입력하고 [실행]으로 확인한 뒤 [업무 제출]을 누르세요.",
    starter: cpp ? "#include <iostream>\n\nint main() {\n    // 이 줄 아래에 출력 코드를 입력하세요.\n    return 0;\n}\n" : "// 아래에 출력 코드를 입력하세요.\n",
    hint: hello + " 를 입력하세요. 대소문자와 느낌표까지 똑같이!",
  };
}
