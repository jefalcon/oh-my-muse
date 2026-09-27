/**
 * omm-narrate-stop (Stop): block the turn end when the wave card is missing.
 *
 * Blocks with {"decision":"block","reason":…} ONLY when every condition
 * holds: the session is guardian-active, stop_hook_active is false, the
 * last assistant message carries no card (🏮, ✔ Oleada, ▶ Oleada), and
 * the 12-blocks-per-session cap is not reached. A message containing
 * ✅ Hecho disarms the session and lets the turn end.
 *
 * Any error, invalid stdin, missing session, or disabled guard is a
 * silent allow (exit 0, no stdout): the guardian never blocks on its
 * own failure.
 */
import path from "node:path";
import {
  CARD_MARKERS,
  DONE_MARKER,
  MAX_BLOCKS_PER_SESSION,
  isGuardEnabled,
  readHookPayload,
  readNarrateState,
  writeNarrateState,
} from "./narrate-state.mjs";

export const BLOCK_REASON =
  "Guardián omm: escribe SOLO texto, sin llamar a ninguna herramienta. " +
  "Si acabas de lanzar la oleada 1, publica 🏮 + ▶ Oleada 1; " +
  "si recibiste resultados y lanzaste la siguiente, publica ✔ Oleada N + ▶ Oleada N+1; " +
  "si terminaste, publica ✅ Hecho. Sigue las plantillas de omm-narration.";

export function decideStop(payload, state) {
  if (!payload || payload.stop_hook_active === true) return { action: "allow" };
  if (!state || state.active !== true) return { action: "allow" };
  const last = typeof payload.last_assistant_message === "string" ? payload.last_assistant_message : "";
  if (last.includes(DONE_MARKER)) return { action: "done" };
  if (CARD_MARKERS.some((marker) => last.includes(marker))) return { action: "allow" };
  if (state.blocks >= MAX_BLOCKS_PER_SESSION) return { action: "allow" };
  return { action: "block", reason: BLOCK_REASON };
}

export function runStopHook() {
  try {
    if (!isGuardEnabled()) return 0;
    const payload = readHookPayload();
    if (!payload) return 0;
    const sessionId = payload.session_id ?? payload.sessionId;
    if (typeof sessionId !== "string" || !sessionId) return 0;
    const state = readNarrateState(sessionId);
    const decision = decideStop(payload, state);
    if (decision.action === "block") {
      writeNarrateState(sessionId, { active: true, blocks: state.blocks + 1 });
      process.stdout.write(JSON.stringify({ decision: "block", reason: decision.reason }));
    } else if (decision.action === "done") {
      writeNarrateState(sessionId, { active: false, blocks: 0 });
    }
  } catch {
    // Never fail the turn on our own failure.
  }
  return 0;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname;

if (isMain) {
  process.exit(runStopHook());
}
