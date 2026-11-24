// Python 실행 워커 (기획서 §8: 실행마다 깨끗한 상태, 표준 출력·오류 수집)
importScripts("https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js");

const ready = loadPyodide().then((py) => {
  self.pyodide = py;
  postMessage({ type: "ready" });
});

self.onmessage = async (e) => {
  await ready;
  const { code, jobId } = e.data;
  let stdout = "";
  self.pyodide.setStdout({ batched: (s) => { stdout += s + "\n"; } });
  self.pyodide.setStderr({ batched: (s) => { stdout += s + "\n"; } });
  try {
    await self.pyodide.runPythonAsync(code);
    postMessage({ type: "result", jobId, ok: true, stdout });
  } catch (err) {
    postMessage({ type: "result", jobId, ok: false, stdout, error: String(err) });
  }
};
