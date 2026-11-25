import { CODE_PROBLEMS } from "./code-problems.js";
import { seedValue, seededShuffle } from "./seeded.js";
import { formatMinutes } from "./records-schema.js";

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

export function materializeProblem(id, seed) {
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
  return {
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
}
