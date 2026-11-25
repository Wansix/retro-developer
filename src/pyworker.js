importScripts("https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js");

const OUTPUT_LIMIT = 4000;

async function init() {
  const py = await loadPyodide();
  postMessage({ type: "ready" });
  self.onmessage = async ({ data: { code, jobId, check } }) => {
    let stdout = "";
    const append = (line) => {
      if (stdout.length < OUTPUT_LIMIT) stdout += (line + "\n").slice(0, OUTPUT_LIMIT + 1 - stdout.length);
    };
    py.setStdout({ batched: append });
    py.setStderr({ batched: append });
    const namespace = py.toPy(new Map());
    try {
      await py.runPythonAsync(code, { globals: namespace });
      const passed = check ? await grade(py, namespace, code, check, stdout) : undefined;
      postMessage({ type: "result", jobId, ok: true, stdout, passed });
    } catch (error) {
      postMessage({ type: "result", jobId, ok: false, stdout, error: String(error).slice(0, OUTPUT_LIMIT) });
    } finally {
      namespace.destroy();
    }
  };
}

const normalize = (text) => text.replace(/\r\n/g, "\n").trim();

async function grade(py, namespace, code, check, stdout) {
  const out = normalize(stdout);
  if (check.type === "output") return out === check.expected;
  if (check.type === "number") {
    const line = out.split("\n").at(-1);
    return !!line && Number(line) === check.expected;
  }
  if (check.type === "function") {
    for (const [index, args] of check.args.entries()) {
      const json = JSON.stringify(JSON.stringify(args));
      const call = `${check.name}(*__import__("json").loads(${json}))`;
      if (!matches(py, namespace, call, check.expected[index])) return false;
    }
    return true;
  }
  if (!matches(py, namespace, check.name, check.expected)) return false;
  for (const test of check.cases ?? []) {
    const alternate = replaceInput(py, code, test.variable, test.input);
    if (!alternate) return false;
    const isolated = py.toPy(new Map());
    try {
      py.setStdout({ batched: () => {} });
      py.setStderr({ batched: () => {} });
      await py.runPythonAsync(alternate, { globals: isolated });
      if (!matches(py, isolated, check.name, test.expected)) return false;
    } finally {
      isolated.destroy();
    }
  }
  return true;
}

function matches(py, namespace, expression, expected) {
  const actual = py.runPython(expression, { globals: namespace });
  if (actual?.destroy) actual.destroy();
  return actual === expected;
}

function replaceInput(py, code, variable, input) {
  const tools = py.toPy(new Map([["source", code], ["variable", variable], ["raw", JSON.stringify(input)]]));
  try {
    return py.runPython(`
import ast
import json

tree = ast.parse(source)
alternate = ""
for statement in tree.body:
    targets = statement.targets if isinstance(statement, ast.Assign) else []
    if any(isinstance(target, ast.Name) and target.id == variable for target in targets):
        statement.value = ast.parse(repr(json.loads(raw)), mode="eval").body
        alternate = ast.unparse(tree)
        break
alternate
`, { globals: tools });
  } finally {
    tools.destroy();
  }
}

init().catch(() => postMessage({ type: "unavailable" }));
