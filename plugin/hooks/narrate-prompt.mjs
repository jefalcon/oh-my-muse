/**
 * omm-narrate-prompt (UserPromptSubmit): arm/disarm the narration guardian.
 *
 * - Prompt contains an omm command (`/omm-<name>`) → session active.
 * - Any other prompt → session inactive (the user moved on; mid-run
 *   reactivations carry no UserPromptSubmit, so they never disarm).
 *
 * Silent in every case (exit 0, no stdout): this hook never blocks.
 */
import path from "node:path";
import {
  OMM_COMMAND,
  isGuardEnabled,
  readHookPayload,
  readNarrateState,
  writeNarrateState,
} from "./narrate-state.mjs";

export function shouldActivate(prompt) {
  return OMM_COMMAND.test(String(prompt ?? ""));
}

export function runPromptHook() {
  try {
    if (!isGuardEnabled()) return 0;
    const payload = readHookPayload();
    if (!payload) return 0;
    const sessionId = payload.session_id ?? payload.sessionId;
    if (typeof sessionId !== "string" || !sessionId) return 0;
    if (shouldActivate(payload.prompt)) {
      writeNarrateState(sessionId, { active: true, blocks: 0 });
    } else if (readNarrateState(sessionId).active) {
      writeNarrateState(sessionId, { active: false, blocks: 0 });
    }
  } catch {
    // Never fail the turn on our own failure.
  }
  return 0;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname;

if (isMain) {
  process.exit(runPromptHook());
}
