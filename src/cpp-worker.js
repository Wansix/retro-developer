import { createToolchain, compilerDiagnostics, CLANG_DRIVER_DEFAULT_ARGS } from "https://esm.sh/@live-codes/clang-wasm@0.3.0/toolchain?bundle";
import { WASI, File, OpenFile, ConsoleStdout } from "https://esm.sh/@bjorn3/browser_wasi_shim@0.4.2?bundle";
import { cppJudgeSource } from "./cpp-judge.js";

const LIMIT = 4000;
const toolchain = await createToolchain({
  baseUrl: "https://cdn.jsdelivr.net/npm/@live-codes/clang-wasm@0.3.0/assets/",
});
postMessage({ type: "ready" });

function compileSource(source) {
  return toolchain.lock(() => toolchain.captureCompilerOutput(() =>
    toolchain.runtime.compileArtifact(source, {
      language: "CPP", fileName: "main.cpp", maxWasmMemoryBytes: 64 * 1024 * 1024,
      compileArgs: [...CLANG_DRIVER_DEFAULT_ARGS, "-std=c++17"],
    })));
}

self.onmessage = async ({ data: { type, code, jobId, check, verify } }) => {
  if (type === "warmup") {
    // The stock example loads the C++ standard library and linker without using player code.
    try { await compileSource('#include <iostream>\nint main() { std::cout << "ready"; }'); }
    catch { /* A player submission can still try the normal compile path. */ }
    postMessage({ type: "warmed" });
    return;
  }
  let stdout = "";
  let stderr = "";
  try {
    const bank = check?.type === "bank-function";
    const source = bank ? cppJudgeSource(code, check, verify) : code;
    const compiled = await compileSource(source);
    if (compiled.error) throw new Error(compilerDiagnostics(compiled.raw).join("\n") || compiled.error.message);
    const module = await WebAssembly.compile(compiled.result.bytes);
    const run = async (args, visible) => {
      const out = new TextDecoder(), err = new TextDecoder();
      const fds = [
        new OpenFile(new File(new Uint8Array())),
        new ConsoleStdout(chunk => {
          if (visible && stdout.length < LIMIT) stdout += out.decode(chunk.subarray(0, LIMIT), { stream: true }).slice(0, LIMIT - stdout.length);
        }),
        new ConsoleStdout(chunk => {
          if (visible && stderr.length < LIMIT) stderr += err.decode(chunk.subarray(0, LIMIT), { stream: true }).slice(0, LIMIT - stderr.length);
        }),
      ];
      const wasi = new WASI(["main", ...args], [], fds);
      const instance = await WebAssembly.instantiate(module, { wasi_snapshot_preview1: wasi.wasiImport });
      return wasi.start(instance);
    };
    if (!bank) {
      if (await run([], true) !== 0) throw new Error(stderr || "C++ 프로그램이 비정상적으로 종료됐어요.");
      postMessage({ type: "result", jobId, ok: true, stdout: stdout || stderr, passed: check ? stdout.trim() === check.expected : undefined });
      return;
    }
    const publicTotal = check.public.length, hiddenTotal = verify ? check.hidden.length : 0;
    let publicPassed = 0, hiddenPassed = 0;
    for (let i = 0; i < publicTotal + hiddenTotal; i++) {
      const visible = i < publicTotal;
      let status;
      try { status = await run([String(i)], visible); } catch { /* A runtime trap fails this case. */ }
      if (status === 73) {
        if (visible) publicPassed++;
        else hiddenPassed++;
      } else if (visible && status !== 74 && stdout.length < LIMIT) {
        stdout += ("공개 " + (i + 1) + " · 실행 오류\n").slice(0, LIMIT - stdout.length);
      }
    }
    postMessage({ type: "result", jobId, ok: true, stdout, publicTotal, hiddenTotal, publicPassed, hiddenPassed,
      passed: publicPassed === publicTotal && hiddenPassed === hiddenTotal });
  } catch (error) {
    postMessage({ type: "result", jobId, ok: false, stdout, error: (stderr || String(error)).slice(0, LIMIT) });
  }
};
