import { assemblyPlan, validAssemblyOrder } from "./code-assembly.js";
import { currentMission, replayProgress } from "./office.js";
import { FIRST_RULESET, RULESET, WORK_CONTENT_RULESET } from "./records-schema.js";
import { playMode } from "./play-mode.js";

export const RUN_ID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const object = value => value && typeof value === "object" && !Array.isArray(value);
const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;

export function validRunProof(proof, minMoves = 1) {
  return integer(proof?.ruleset, FIRST_RULESET, RULESET) && typeof proof.id === "string" && RUN_ID.test(proof.id) &&
    integer(proof.seed, 0, 0xffffffff) && Array.isArray(proof.moves) &&
    integer(proof.moves.length, minMoves, proof.ruleset >= WORK_CONTENT_RULESET ? 8192 : 500);
}

function internetProgress(value) {
  if (!object(value)) return undefined;
  const tabs = Object.fromEntries(Object.entries(object(value.tabs) ? value.tabs : {}).slice(0, 40).flatMap(([id, entry]) => {
    if (!object(entry) || !Array.isArray(entry.pages)) return [];
    const pages = entry.pages.filter(item => typeof item === "string" && item.length <= 100).slice(-24);
    return [[id, { pages: pages.length ? pages : ["feed"], clip: {
      position: Math.max(0, Math.min(20, Number(entry.clip?.position) || 0)), muted: entry.clip?.muted === true,
    } }]];
  }));
  return { tabs, open: value.open === true, workPage: typeof value.workPage === "string" ? value.workPage.slice(0, 100) : undefined };
}

export function normalizeCheckpoint(body) {
  const proof = body?.state;
  if (!validRunProof(proof, 0)) return null;
  const state = replayProgress({ ...proof, id: proof.id.toLowerCase() });
  if (!state || state.ending) return null;

  if (typeof proof.playerName === "string") state.playerName = proof.playerName.trim().slice(0, 20);
  if (state.task && Number.isFinite(proof.task?.subsecond)) {
    state.task.subsecond = Math.min(999, Math.max(0, proof.task.subsecond));
  }
  const mission = currentMission(state);
  const id = mission?.id;
  const checkpoint = { state, internetState: internetProgress(body.internetState) };
  if (id && playMode(state) === "assembly" && mission.type === "code" && body.assemblyDraft?.id === id) {
    const plan = assemblyPlan(mission, state.language, state.seed);
    if (validAssemblyOrder(plan, body.assemblyDraft.order)) checkpoint.assemblyDraft = { id, order: body.assemblyDraft.order };
  }
  if (id && playMode(state) === "real_coding" && body.draft?.id === id && typeof body.draft.code === "string") {
    checkpoint.draft = { id, code: body.draft.code };
  }
  if (id && body.workDraft?.id === id) {
    const answer = body.workDraft.answer;
    if (integer(answer, 0, 512) || (Array.isArray(answer) && answer.length <= 16 && answer.every(value => integer(value, 0, 24)))) {
      checkpoint.workDraft = { id, answer };
    }
  }
  const companion = body.companionState;
  if (object(companion)) {
    // Keep earned dialogue history. A line queued on a different device can be re-evaluated there.
    checkpoint.companionState = {
      seen: Array.isArray(companion.seen) ? companion.seen.filter(id => typeof id === "string" && id.length <= 64).slice(0, 500) : [],
      byEvent: object(companion.byEvent) ? Object.fromEntries(Object.entries(companion.byEvent).filter(([, time]) => Number.isFinite(time)).slice(0, 100)) : {},
      pending: [], last: null,
    };
  }
  if (Array.isArray(body.presenceSeen)) checkpoint.presenceSeen = body.presenceSeen.filter(kind => typeof kind === "string" && kind.length <= 40).slice(0, 30);
  return checkpoint;
}
