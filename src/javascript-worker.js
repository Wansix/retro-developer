import { getQuickJS } from "https://esm.sh/quickjs-emscripten@0.32.0?bundle";

const LIMIT = 4000;
const quick = await getQuickJS();
postMessage({ type: "ready" });

self.onmessage = ({ data: { code, jobId, check, verify } }) => {
  let stdout = "";
  const append = line => { stdout += (line + "\n").slice(0, LIMIT - stdout.length); };
  const deadline = Date.now() + 6000;
  const runtime = quick.newRuntime();
  runtime.setMemoryLimit(16 * 1024 * 1024);
  runtime.setMaxStackSize(512 * 1024);
  runtime.setInterruptHandler(() => Date.now() >= deadline);
  try {
    const run = (work, logOutput = true) => {
      const context = runtime.newContext();
      try {
        const console = context.newObject();
        const log = context.newFunction("log", (...args) => {
          if (logOutput && stdout.length < LIMIT) append(args.map(arg => {
            const value = context.dump(arg);
            return typeof value === "string" ? value : JSON.stringify(value) ?? "undefined";
          }).join(" "));
        });
        context.setProp(console, "log", log);
        context.setProp(context.global, "console", console);
        log.dispose();
        console.dispose();
        evalCode(context, code);
        return work?.(context);
      } finally {
        context.dispose();
      }
    };
    if (check?.type !== "bank-function") {
      run();
      const passed = check ? stdout.trim() === check.expected : undefined;
      postMessage({ type: "result", jobId, ok: true, stdout, passed });
      return;
    }
    const count = (cases, show) => cases.reduce((passed, test, index) => {
      let ok = false;
      let actual;
      try {
        ok = run(context => {
          const args = JSON.stringify(test.args);
          const call = "var retroArgs = " + args + "; " + check.name + ".apply(null, retroArgs);";
          actual = evalCode(context, call);
          return same(actual, test.expected) && (!check.preserveArgs || same(evalCode(context, "retroArgs"), test.args));
        }, show);
      } catch (error) {
        if (error.syntax || Date.now() >= deadline) throw error;
      }
      if (show) append("공개 " + (index + 1) + " · 실행값 " + (JSON.stringify(actual) ?? "undefined") + (ok ? " ✓" : " ✗"));
      return passed + Number(ok);
    }, 0);
    const publicTotal = check.public.length;
    const publicPassed = count(check.public, true);
    const hiddenTotal = verify ? check.hidden.length : 0;
    const hiddenPassed = verify ? count(check.hidden, false) : 0;
    postMessage({ type: "result", jobId, ok: true, stdout, publicTotal, publicPassed, hiddenTotal, hiddenPassed,
      passed: publicPassed === publicTotal && hiddenPassed === hiddenTotal });
  } catch (error) {
    if (Date.now() >= deadline) postMessage({ type: "result", jobId, timeout: true });
    else postMessage({ type: "result", jobId, ok: false, stdout, error: String(error).slice(0, LIMIT) });
  } finally {
    runtime.dispose();
  }
};

function evalCode(context, code) {
  const result = context.evalCode(code);
  const handle = result.error ?? result.value;
  try {
    const value = context.dump(handle);
    if (!result.error) return value;
    const error = new Error(value.message ?? String(value));
    error.syntax = value.name === "SyntaxError";
    throw error;
  } finally {
    handle.dispose();
  }
}

function same(actual, expected) {
  if (actual === expected) return true;
  if (!actual || !expected || typeof actual !== "object" || typeof expected !== "object" || Array.isArray(actual) !== Array.isArray(expected)) return false;
  const keys = Object.keys(expected);
  return Object.keys(actual).length === keys.length && keys.every(key => Object.hasOwn(actual, key) && same(actual[key], expected[key]));
}
