import { seededShuffle } from "./seeded.js";

const OPENING = {
  python: { before: "", after: "", lines: ['print("Hello, World!")'], decoys: ['print("Hello World!")', 'print("Hello, world!")'] },
  javascript: { before: "", after: "", lines: ['console.log("Hello, World!");'],
    decoys: ['console.log("Hello World!");', 'console.log("Hello, world!");'] },
  cpp: { before: "#include <iostream>\n\nint main() {", after: "    return 0;\n}",
    lines: ['    std::cout << "Hello, World!" << "\\n";'],
    decoys: ['    std::cout << "Hello World!" << "\\n";', '    std::cout << "Hello, world!" << "\\n";'] },
};

const PYTHON_DEPLOYMENT = {
  before: "def ready(results):",
  after: "",
  lines: ['    if all(results):\n        return "DEPLOY"', '    return "HOLD"'],
  decoys: ['    if any(results):\n        return "DEPLOY"', '    return "DEPLOY"'],
};

function splitBody(body) {
  const blocks = [];
  for (const line of body) {
    if (/^ {4}\S/.test(line) && !/^ {4}(?:[})\]]|else\b|elif\b|catch\b|finally\b|except\b)/.test(line)) {
      blocks.push(line);
    } else if (blocks.length) blocks[blocks.length - 1] += "\n" + line;
    else blocks.push(line);
  }
  return blocks;
}

function functionPlan(mission, language) {
  const solution = mission.solution.trimEnd().split("\n");
  const fn = solution.findIndex(line => line.includes(mission.check.name + "("));
  const end = language === "python" ? solution.length : solution.length - 1;
  if (mission.fundamentals) {
    const starter = mission.starter.trimEnd().split("\n");
    const changed = starter.findIndex((line, index) => index > fn && index < end && line !== solution[index]);
    if (changed !== -1) return {
      before: starter.slice(0, changed).join("\n"),
      after: starter.slice(changed + 1).join("\n"),
      lines: [solution[changed]],
      decoys: [starter[changed].replace(/\s+(?:#|\/\/) 이 줄만 고치세요\.$/, "")],
    };
  }
  return { before: solution.slice(0, fn + 1).join("\n"),
    after: solution.slice(end).join("\n"), lines: splitBody(solution.slice(fn + 1, end)), decoys: [] };
}

const mutations = [
  [/!==|!=|===|==/, op => ({ "!==": "===", "!=": "==", "===": "!==", "==": "!=" })[op]],
  [/>=|<=|(?<![<>=])>(?![>=])|(?<![<>=])<(?![<=])/, op => ({ ">=": ">", "<=": "<", ">": ">=", "<": "<=" })[op]],
  [/\+=|-=|\s[+-]\s/, op => op.replace(/[+-]/, char => char === "+" ? "-" : "+")],
  [/\b0\b|\b1\b|\b3\b/, value => value === "0" ? "1" : "0"],
  [/\band\b|\bor\b|&&|\|\|/, op => ({ and: "or", or: "and", "&&": "||", "||": "&&" })[op]],
];

function decoyPieces(plan, mission, language) {
  const limit = mission.difficulty === "advanced" ? 4 : mission.difficulty === "intermediate" ? 3 : 2;
  const decoys = new Set(plan.decoys.filter(line => !plan.lines.includes(line)));
  for (const [pattern, replacement] of mutations) {
    for (const line of plan.lines) {
      if (decoys.size >= limit) return [...decoys];
      const changed = line.replace(pattern, replacement);
      if (changed !== line && !plan.lines.includes(changed)) decoys.add(changed);
    }
  }
  const indent = plan.lines[0].match(/^ */)[0];
  const fillers = language === "python" ? ["return None", "return False"] : language === "javascript" ?
    ["return null;", "return false;"] : ["throw 0;", "throw 1;"];
  for (const filler of fillers) if (decoys.size < limit && !plan.lines.includes(indent + filler)) decoys.add(indent + filler);
  return [...decoys];
}

export function assemblyPlan(mission, language, seed) {
  const plan = mission.id === "hello-world" ? OPENING[language] :
    mission.id === "deployment" && language === "python" ? PYTHON_DEPLOYMENT : functionPlan(mission, language);
  const texts = [...plan.lines, ...decoyPieces(plan, mission, language)];
  const salt = Array.from(mission.id + language).reduce((value, char) => (Math.imul(value, 31) + char.codePointAt(0)) | 0, 234);
  const pieces = seededShuffle(texts.map((text, index) => ({
    id: "piece-" + index, text, indent: text.match(/^ */)[0].length,
  })), seed, salt);
  // Avoid showing the correct pieces in their original order on the first render.
  if (plan.lines.length > 1 && pieces.filter(piece => Number(piece.id.slice(6)) < plan.lines.length)
      .every((piece, index) => piece.id === "piece-" + index)) pieces.reverse();
  return { before: plan.before, after: plan.after, pieces, solutionIds: plan.lines.map((_, index) => "piece-" + index) };
}

export function validAssemblyOrder(plan, order) {
  const available = new Set(plan.pieces.map(piece => piece.id));
  return Array.isArray(order) && new Set(order).size === order.length && order.every(id => available.has(id));
}

export function assemblyCode(plan, order) {
  if (!validAssemblyOrder(plan, order)) return "";
  const pieces = new Map(plan.pieces.map(piece => [piece.id, piece.text]));
  return [plan.before, ...order.map(id => pieces.get(id)), plan.after].filter(Boolean).join("\n") + "\n";
}
