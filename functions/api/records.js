import { Buffer } from "node:buffer";
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { replayRun } from "../../src/office.js";
import { CATEGORIES, FIRST_RULESET, RULESET, WORK_CONTENT_RULESET } from "../../src/records-schema.js";

const COOKIE = "retro_session";
const SESSION_SECONDS = 60 * 60 * 24 * 14;
const AUTH_WINDOW = 15 * 60;
const HISTORY_PAGE = 20;
const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const hashToken = (token) => createHash("sha256").update(token).digest("hex");
const ts = () => Math.floor(Date.now() / 1000);
const integer = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;

function json(body, status = 200, extra = {}) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...extra } });
}

function problem(error, status) {
  return json({ error }, status);
}

function sessionCookie(request, token, maxAge) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE}=${token}; Path=/api/records; Max-Age=${maxAge}; HttpOnly; SameSite=Strict${secure}`;
}

function tokenFrom(request) {
  const match = request.headers.get("Cookie")?.match(/(?:^|;\s*)retro_session=([a-f0-9]{64})(?:;|$)/);
  return match ? hashToken(match[1]) : null;
}

function passwordHash(password, salt) {
  return new Promise((resolve, reject) => {
    scrypt(password, Buffer.from(salt, "hex"), 32, { N: 32768, r: 8, p: 3, maxmem: 48 * 1024 ** 2 }, (error, value) => {
      if (error) reject(error);
      else resolve(value);
    });
  });
}

async function accountFrom(db, token) {
  if (!token) return null;
  return db.prepare(`SELECT accounts.id, accounts.handle FROM sessions JOIN accounts ON accounts.id = sessions.account_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ?`).bind(token, ts()).first();
}

async function limitAuth({ request, db, waitUntil }, key, action) {
  const ip = request.headers.get("CF-Connecting-IP") ?? "local";
  const window = Math.floor(ts() / AUTH_WINDOW) * AUTH_WINDOW;
  const buckets = action === "register" ? [[`register:${ip}`, 12]] : [[`login:${ip}`, 40], [`handle:${key}`, 12]];
  const increments = buckets.map(([bucket]) => db.prepare(`INSERT INTO auth_limits (bucket, window_start, attempts) VALUES (?, ?, 1)
    ON CONFLICT(bucket, window_start) DO UPDATE SET attempts = attempts + 1 RETURNING attempts`).bind(hashToken(bucket), window));
  const counts = await db.batch(increments);
  waitUntil(db.batch([
    db.prepare("DELETE FROM auth_limits WHERE window_start < ?").bind(window),
    db.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(ts()),
  ]).catch(() => {}));
  return counts.every(({ results }, i) => results[0].attempts <= buckets[i][1]);
}

async function authenticate(context, action, body) {
  const { db, request } = context;
  const handle = typeof body?.handle === "string" ? body.handle.normalize("NFC").trim() : "";
  const password = body?.password;
  if (!/^[a-zA-Z0-9가-힣_]{3,20}$/.test(handle) || typeof password !== "string" || password.length < 12 || password.length > 128) {
    return problem("계정 이름 또는 비밀번호 형식이 맞지 않습니다.", 400);
  }

  const key = handle.toLowerCase();
  if (!(await limitAuth(context, key, action))) return problem("시도 횟수가 많습니다. 잠시 후 다시 시도하세요.", 429);
  let account;
  if (action === "register") {
    const salt = randomBytes(16).toString("hex");
    const hash = await passwordHash(password, salt);
    account = { id: crypto.randomUUID(), handle };
    const result = await db.prepare("INSERT INTO accounts VALUES (?, ?, ?, ?, ?) ON CONFLICT(handle_key) DO NOTHING")
      .bind(account.id, handle, key, salt, hash.toString("hex")).run();
    if (!result.meta.changes) return problem("이미 사용 중인 계정 이름입니다.", 409);
  } else {
    account = await db.prepare("SELECT id, handle, salt, password_hash FROM accounts WHERE handle_key = ?").bind(key).first();
    const candidate = await passwordHash(password, account?.salt ?? "0".repeat(32));
    const matches = timingSafeEqual(candidate, Buffer.from(account?.password_hash ?? "0".repeat(64), "hex"));
    if (!account || !matches) return problem("계정 이름 또는 비밀번호가 올바르지 않습니다.", 401);
  }

  const token = randomBytes(32).toString("hex");
  const statements = [];
  const previous = tokenFrom(request);
  if (previous) statements.push(db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(previous));
  statements.push(db.prepare("INSERT INTO sessions VALUES (?, ?, ?)").bind(hashToken(token), account.id, ts() + SESSION_SECONDS));
  await db.batch(statements);
  return json({ handle: account.handle }, 200, { "Set-Cookie": sessionCookie(request, token, SESSION_SECONDS) });
}

async function saveRun(db, account, body) {
  if (!integer(body?.ruleset, FIRST_RULESET, RULESET) || typeof body.id !== "string" || !UUID.test(body.id) || !integer(body.seed, 0, 0xffffffff) ||
    !Array.isArray(body.moves) || !integer(body.moves.length, 1, body.ruleset >= WORK_CONTENT_RULESET ? 8192 : 500)) return problem("결산 기록이 올바르지 않습니다.", 400);
  const summary = replayRun({ id: body.id.toLowerCase(), seed: body.seed, moves: body.moves, ruleset: body.ruleset });
  if (!summary) return problem("결산 기록이 올바르지 않습니다.", 400);
  const result = await db.prepare("INSERT INTO runs VALUES (?, ?, ?, ?) ON CONFLICT(id) DO NOTHING")
    .bind(summary.id, account.id, JSON.stringify(summary), ts()).run();
  if (result.meta.changes) return json({ saved: true }, 201);
  const existing = await db.prepare("SELECT id FROM runs WHERE id = ? AND account_id = ?").bind(summary.id, account.id).first();
  if (!existing) return problem("이미 다른 계정에 저장된 결산입니다.", 409);
  return json({ saved: true });
}

async function leaderboard(db, category) {
  if (!Object.hasOwn(CATEGORIES, category)) return problem("랭킹 종목이 올바르지 않습니다.", 400);
  const { key, order, clears } = CATEGORIES[category];
  const best = order === "ASC" ? "MIN" : "MAX";
  const { results } = await db.prepare(`WITH best_runs AS (
    SELECT account_id, ${best}(json_extract(summary, '$.${key}')) AS value
    FROM runs ${clears ? "WHERE json_extract(summary, '$.completedDay') IS NOT NULL" : ""}
    GROUP BY account_id
  )
  SELECT accounts.handle, value, DENSE_RANK() OVER (ORDER BY value ${order}) AS rank
  FROM best_runs JOIN accounts ON accounts.id = account_id
  ORDER BY value ${order}, accounts.handle_key LIMIT 25`).all();
  return json({ entries: results });
}

async function readBody(request, maxBytes = 8192) {
  if (request.headers.get("Content-Type")?.split(";")[0] !== "application/json") throw new Error("Expected JSON");
  const reader = request.body?.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let input = "";
  if (reader) {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error("Body too large");
      }
      input += decoder.decode(value, { stream: true });
    }
  }
  return JSON.parse(input + decoder.decode());
}

export async function onRequest({ request, env, waitUntil }) {
  const db = env.RETRO_DB;
  if (!db) return problem("계정·랭킹 저장소가 아직 연결되지 않았습니다.", 503);
  const url = new URL(request.url);
  const action = url.searchParams.get("view") ?? "session";
  try {
    if (request.method === "GET") {
      if (action === "rank") return await leaderboard(db, url.searchParams.get("category"));
      const account = await accountFrom(db, tokenFrom(request));
      if (action === "session") return json({ handle: account?.handle ?? null });
      if (action !== "history") return problem("기록실 메뉴를 찾지 못했습니다.", 404);
      if (!account) return problem("로그인이 필요합니다.", 401);
      const page = Number(url.searchParams.get("page") ?? 0);
      if (!integer(page, 0, 10000)) return problem("페이지 번호가 올바르지 않습니다.", 400);
      const { results } = await db.prepare("SELECT summary FROM runs WHERE account_id = ? ORDER BY saved_at DESC, id DESC LIMIT ? OFFSET ?")
        .bind(account.id, HISTORY_PAGE + 1, page * HISTORY_PAGE).all();
      return json({ records: results.slice(0, HISTORY_PAGE).map((row) => JSON.parse(row.summary)), more: results.length > HISTORY_PAGE });
    }

    if (request.method !== "POST") return problem("지원하지 않는 요청입니다.", 405);
    const origin = request.headers.get("Origin");
    if (origin && origin !== url.origin) return problem("같은 사이트에서만 요청할 수 있습니다.", 403);
    const token = tokenFrom(request);
    if (action === "logout") {
      if (token) await db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(token).run();
      return json({ handle: null }, 200, { "Set-Cookie": sessionCookie(request, "", 0) });
    }
    if (action === "save") {
      const account = await accountFrom(db, token);
      if (!account) return problem("로그인이 필요합니다.", 401);
      let body;
      try { body = await readBody(request, 192 * 1024); } catch { return problem("요청 내용을 읽을 수 없습니다.", 400); }
      return await saveRun(db, account, body);
    }
    let body;
    try { body = await readBody(request); } catch { return problem("요청 내용을 읽을 수 없습니다.", 400); }
    if (action === "login" || action === "register") return await authenticate({ db, request, waitUntil }, action, body);
    return problem("기록실 메뉴를 찾지 못했습니다.", 404);
  } catch (error) {
    console.error("Records service error", error);
    return problem("기록실을 불러오지 못했습니다. 잠시 후 다시 시도하세요.", 503);
  }
}
