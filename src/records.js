import { isPlayMode, playMode } from "./play-mode.js";
import { ENDINGS } from "./office-content.js";
import { CATEGORIES, METRICS, formatDate, formatMetric, internetRecordRows } from "./records-schema.js";
import { workResultRows } from "./work-missions.js";

const $ = (id) => document.getElementById(id);
const LAST_KEY = "retro-office-last-record-v1";
let account;
let active;
let back;
let switchScreen;
let statusChanged;
let page = 0;
let generation = 0;
let rankGeneration = 0;
let busy = false;
let runStorage;
let rankMode = "real_coding";

function localRecord() {
  try { return JSON.parse(localStorage.getItem(LAST_KEY)); } catch { return null; }
}

function keepRecord(record, proof, owner, saved = false) {
  try { localStorage.setItem(LAST_KEY, JSON.stringify({ record, proof, owner, saved })); } catch { /* In-memory play still works. */ }
}

async function api(view, { body, category, history, mode } = {}) {
  const query = new URLSearchParams({ view });
  if (category) query.set("category", category);
  if (mode) query.set("mode", mode);
  if (history) query.set("page", history);
  const res = await fetch(`/api/records?${query}`, {
    ...(body === undefined ? {} : {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    signal: AbortSignal.timeout(12000),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) throw new Error(data?.error || "계정·랭킹 서버에 연결할 수 없습니다.");
  return data;
}

let pendingRecord;

export async function syncRecord(record, proof) {
  pendingRecord = { record, proof };
  keepRecord(record, proof, null);
  let owner;
  try {
    owner = (await api("session")).handle;
    if (!owner) return "계정으로 로그인하면 이번 결산을 저장할 수 있습니다.";
    if (pendingRecord?.record.id === record.id) {
      pendingRecord.owner = owner;
      keepRecord(record, proof, owner);
    }
    await api("save", { body: proof });
    if (pendingRecord?.record.id === record.id) {
      pendingRecord.saved = true;
      keepRecord(record, proof, owner, true);
    }
    return `${owner} 계정에 결산을 저장했습니다.`;
  } catch {
    return owner ? "결산 저장에 실패했습니다. 기록실에서 다시 시도하세요." : "기록실에 연결하지 못했습니다. 이번 결산은 이 브라우저에 보관돼 있습니다.";
  }
}

function renderAccount() {
  const last = pendingRecord?.record.id === active?.id ? pendingRecord : localRecord();
  $("account-form").classList.toggle("hidden", Boolean(account));
  $("logout").classList.toggle("hidden", !account);
  $("save-record").classList.toggle("hidden", !account || !last?.proof || (last.owner && last.owner !== account) || last.saved === true);
  $("history-panel").classList.toggle("hidden", !account);
  $("save-checkpoint").classList.toggle("hidden", !account || !runStorage.get()?.state);
  $("load-checkpoint").classList.toggle("hidden", !account);
}

function button(label, handler) {
  const node = document.createElement("button");
  node.className = "btn";
  node.type = "button";
  node.textContent = label;
  node.addEventListener("click", handler);
  return node;
}

function recordDetails(record) {
  const detail = document.createElement("details");
  const title = document.createElement("summary");
  title.textContent = `${ENDINGS[record.ending].title} · ${record.day}일차 · ${formatMetric(record.mode, "모드")}`;
  const stats = document.createElement("dl");
  for (const [key, name, unit] of METRICS) {
    if (!(key in record)) continue;
    const term = document.createElement("dt");
    const value = document.createElement("dd");
    term.textContent = name;
    value.textContent = key === "completedDay" ? record[key] ? formatDate(record.completedCalendarDay ?? record[key]) : "미완료"
      : formatMetric(record[key], unit);
    stats.append(term, value);
  }
  for (const [name, rate] of [...internetRecordRows(record), ...workResultRows(record)]) {
    const term = document.createElement("dt");
    const value = document.createElement("dd");
    term.textContent = name;
    value.textContent = rate;
    stats.append(term, value);
  }
  detail.append(title, stats);
  if (record.achievements?.length) {
    const awards = document.createElement("p");
    awards.className = "record-awards";
    awards.textContent = `업적 · ${record.achievements.join(" · ")}`;
    detail.append(awards);
  }
  return detail;
}

async function renderHistory() {
  const now = ++generation;
  const list = $("history-list");
  list.textContent = account ? "불러오는 중…" : "";
  if (!account) return;
  try {
    const { records, more } = await api("history", { history: page });
    if (now !== generation) return;
    if (!records.length) list.textContent = "저장된 결산이 없습니다.";
    else list.replaceChildren(...records.map(recordDetails));
    if (page) list.append(button("이전 기록 페이지", () => { page--; renderHistory(); }));
    if (more) list.append(button("다음 기록 페이지", () => { page++; renderHistory(); }));
  } catch (error) {
    if (now === generation) list.textContent = error.message;
  }
}

async function renderRank() {
  const now = ++rankGeneration;
  const list = $("rank-list");
  const category = $("rank-category").value;
  list.textContent = "불러오는 중…";
  try {
    const { entries } = await api("rank", { category, mode: rankMode });
    if (now !== rankGeneration) return;
    if (!entries.length) {
      list.textContent = "아직 등록된 기록이 없습니다.";
      return;
    }
    const scores = document.createElement("ol");
    for (const { handle, value, rank } of entries) {
      const item = document.createElement("li");
      const result = document.createElement("strong");
      item.textContent = `${rank}위 · ${handle}`;
      result.textContent = formatMetric(value, CATEGORIES[category].unit);
      item.append(result);
      scores.append(item);
    }
    list.replaceChildren(scores);
  } catch (error) {
    if (now === rankGeneration) list.textContent = error.message;
  }
}

async function withStatus(operation) {
  if (busy) return;
  busy = true;
  $("account-status").textContent = "처리 중…";
  $("records-back").disabled = true;
  for (const element of document.querySelectorAll("#account-form input, #account-form button, #save-record, #save-checkpoint, #load-checkpoint, #logout")) element.disabled = true;
  try { $("account-status").textContent = await operation(); }
  catch (error) { $("account-status").textContent = error.message; }
  finally {
    renderAccount();
    $("records-back").disabled = false;
    for (const element of document.querySelectorAll("#account-form input, #account-form button, #save-record, #save-checkpoint, #load-checkpoint, #logout")) element.disabled = false;
    busy = false;
  }
}

export function openRecords(record, onBack) {
  active = record ?? localRecord()?.record ?? null;
  rankMode = isPlayMode(record?.mode) ? record.mode : playMode(runStorage.get()?.state);
  updateRankMode();
  back = onBack;
  page = 0;
  switchScreen("screen-records");
  renderRank();
  withStatus(async () => {
    account = (await api("session")).handle;
    renderHistory();
    return account ? `${account}님으로 로그인됨` : "로그인하면 결산을 계정에 저장할 수 있습니다.";
  });
}

function updateRankMode() {
  for (const button of $("rank-modes").querySelectorAll("button")) {
    button.setAttribute("aria-pressed", String(button.dataset.mode === rankMode));
  }
}

export function initRecords(show, onStatus, storage) {
  runStorage = storage;
  switchScreen = show;
  statusChanged = onStatus;
  for (const [id, { label }] of Object.entries(CATEGORIES)) $("rank-category").add(new Option(label, id));
  $("rank-category").onchange = renderRank;
  for (const button of $("rank-modes").querySelectorAll("button")) {
    button.onclick = () => {
      if (rankMode === button.dataset.mode) return;
      rankMode = button.dataset.mode;
      updateRankMode();
      renderRank();
    };
  }
  $("save-checkpoint").onclick = () => withStatus(async () => {
    const checkpoint = runStorage.get();
    if (!checkpoint?.state) return "이 기기에 진행 중인 게임이 없습니다.";
    const stored = await api("checkpoint");
    if (stored.checkpoint && !window.confirm("계정에 저장된 이어하기를 이 기기의 진행 내용으로 바꿀까요?")) return "기존 계정 저장을 유지했습니다.";
    await api("checkpoint", { body: { checkpoint, revision: stored.revision } });
    return "계정에 진행 내용을 저장했습니다. 다른 기기에서 같은 계정으로 불러올 수 있어요.";
  });
  $("load-checkpoint").onclick = () => withStatus(async () => {
    const { checkpoint } = await api("checkpoint");
    if (!checkpoint) return "이 계정에 저장한 진행 내용이 없습니다.";
    if (runStorage.get()?.state && !window.confirm("이 기기의 이어하기를 계정에 저장된 진행 내용으로 바꿀까요?")) return "이 기기의 진행 내용을 유지했습니다.";
    runStorage.resume(checkpoint);
    return "계정에 저장한 진행 내용을 불러왔습니다.";
  });
  $("records-back").onclick = () => back();
  $("account-form").onsubmit = (event) => {
    event.preventDefault();
    const action = event.submitter?.value ?? "login";
    withStatus(async () => {
      const handle = $("handle").value;
      const password = $("password").value;
      const session = await api(action, { body: { handle, password } });
      account = session.handle;
      $("account-form").reset();
      page = 0;
      renderHistory();
      return `${account}님으로 로그인됨`;
    });
  };
  $("logout").onclick = () => withStatus(async () => {
    await api("logout", { body: {} });
    account = null;
    renderHistory();
    return "로그아웃했습니다.";
  });
  $("save-record").onclick = () => withStatus(async () => {
    const last = pendingRecord?.record.id === active?.id ? pendingRecord : localRecord();
    if (!last?.proof || (last.owner && last.owner !== account)) return "저장할 수 있는 결산이 없습니다.";
    await api("save", { body: last.proof });
    Object.assign(last, { owner: account, saved: true });
    keepRecord(last.record, last.proof, account, true);
    page = 0;
    renderHistory();
    renderRank();
    const message = `${account} 계정에 결산을 저장했습니다.`;
    statusChanged(message);
    return message;
  });
}
