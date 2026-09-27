/**
 * oh-my-muse narration guardian: shared state for the two narrate hooks.
 *
 * Why this exists: the model does not narrate between waves even when
 * ordered to. The `workflow` tool runs in the background and every launch
 * ends the parent's turn (a `Stop` right after); the parent wakes up with
 * the results — no `UserPromptSubmit` — and launches the next wave without
 * writing text. So narration is enforced mechanically:
 *
 * - `narrate-prompt.mjs` (UserPromptSubmit) marks the session active when
 *   the user prompt contains an omm command (`/omm-<name>`), inactive
 *   otherwise.
 * - `narrate-stop.mjs` (Stop) blocks the turn end — forcing the model to
 *   write text instead — unless the last assistant message already carries
 *   the omm-narration card for that turn.
 *
 * This module is shared logic and is NEVER referenced by a hook argv (the
 * validator rejects two hooks sharing one argv source): each hook keeps
 * its own entry file and imports this one.
 *
 * State: one JSON file per session_id under MUSE_PLUGIN_DATA_DIR (fallback
 * ~/.local/state/oh-my-muse), written atomically (tmp + rename), pruned
 * past 7 days. Kill switch: ~/.config/oh-my-muse/guard.json
 * ({enabled: false} disables both hooks); missing file means enabled.
 *
 * Budgets: sync node builtins only, no network, no user files, well under
 * 100 ms. Every failure mode (bad stdin, missing session, fs error) is a
 * silent allow — the guardian never blocks on its own failure.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const MAX_BLOCKS_PER_SESSION = 12;
export const STATE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const OMM_COMMAND = /\/omm-[a-z][a-z-]*/;
export const CARD_MARKERS = ["\u{1F3EE}", "\u2714 Oleada", "\u25B6 Oleada"];
export const DONE_MARKER = "\u2705 Hecho";

/** State dir: plugin data dir when the runtime provides it, else ~/.local/state. */
export function narrateStateDir(env = process.env, home = os.homedir()) {
  const dataDir = env?.MUSE_PLUGIN_DATA_DIR;
  if (typeof dataDir === "string" && dataDir) return path.join(dataDir, "narrate");
  return path.join(home, ".local", "state", "oh-my-muse", "narrate");
}

/** Fixed guard-switch location. Uses os.homedir(); XDG_CONFIG_HOME is ignored. */
export function guardConfigPath(home = os.homedir()) {
  return path.join(home, ".config", "oh-my-muse", "guard.json");
}

/** True unless guard.json explicitly says {enabled: false}. Never throws. */
export function isGuardEnabled(home = os.homedir()) {
  try {
    const parsed = JSON.parse(fs.readFileSync(guardConfigPath(home), "utf8"));
    if (parsed && typeof parsed === "object" && parsed.enabled === false) return false;
    return true;
  } catch {
    return true; // missing or malformed file: enabled by default
  }
}

/**
 * Write the guard switch with mode 0600 (dir 0700). Returns the path.
 * `enabled` is coerced: only an explicit false disables the guardian.
 */
export function writeGuardConfig(enabled, home = os.homedir()) {
  const file = guardConfigPath(home);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.chmodSync(path.dirname(file), 0o700);
  fs.writeFileSync(file, `${JSON.stringify({ enabled: enabled !== false }, null, 2)}\n`, { mode: 0o600 });
  fs.chmodSync(file, 0o600);
  return file;
}

function safeSessionFile(dir, sessionId) {
  const safe = String(sessionId ?? "").replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 128) || "unknown";
  return path.join(dir, `narrate-${safe}.json`);
}

/** Read session state. Unknown/missing/corrupt state reads as inactive. Never throws. */
export function readNarrateState(sessionId, { env, home } = {}) {
  try {
    const parsed = JSON.parse(fs.readFileSync(safeSessionFile(narrateStateDir(env, home), sessionId), "utf8"));
    if (!parsed || typeof parsed !== "object") return { active: false, blocks: 0 };
    return {
      active: parsed.active === true,
      blocks: Number.isInteger(parsed.blocks) && parsed.blocks >= 0 ? parsed.blocks : 0,
    };
  } catch {
    return { active: false, blocks: 0 };
  }
}

/** Write session state atomically (tmp + rename), then prune expired files. May throw; callers must not let it fail the hook. */
export function writeNarrateState(sessionId, state, { env, home } = {}) {
  const dir = narrateStateDir(env, home);
  fs.mkdirSync(dir, { recursive: true });
  const file = safeSessionFile(dir, sessionId);
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(
    tmp,
    `${JSON.stringify({ active: state?.active === true, blocks: state?.blocks ?? 0, updatedAt: Date.now() })}\n`,
  );
  fs.renameSync(tmp, file);
  pruneNarrateStates(dir);
}

/** Best-effort deletion of state files older than 7 days. Never throws. */
export function pruneNarrateStates(dir) {
  try {
    const now = Date.now();
    for (const name of fs.readdirSync(dir)) {
      if (!name.startsWith("narrate-") || !name.endsWith(".json")) continue;
      const file = path.join(dir, name);
      let mtime;
      try {
        mtime = fs.statSync(file).mtimeMs;
      } catch {
        continue;
      }
      if (now - mtime > STATE_TTL_MS) {
        try {
          fs.unlinkSync(file);
        } catch {
          // keep pruning the rest
        }
      }
    }
  } catch {
    // missing dir or unreadable: nothing to prune
  }
}

/**
 * Read hook stdin tolerantly: any input that does not parse to a JSON
 * object (empty, non-JSON, or unreadable) yields null. Never throws.
 */
export function readHookPayload() {
  try {
    if (process.stdin.isTTY) return null;
    const raw = fs.readFileSync(0, "utf8");
    if (!raw.trim()) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}
