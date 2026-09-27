import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import {
  MAX_BLOCKS_PER_SESSION,
  guardConfigPath,
  isGuardEnabled,
  narrateStateDir,
  writeGuardConfig,
} from "../plugin/hooks/narrate-state.mjs";

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const PROMPT_HOOK = path.join(REPO_ROOT, "plugin", "hooks", "narrate-prompt.mjs");
const STOP_HOOK = path.join(REPO_ROOT, "plugin", "hooks", "narrate-stop.mjs");
const OMM_CLI = path.join(REPO_ROOT, "bin", "omm.mjs");

// Temporary HOME roots live inside .scratch/ (never the real ~/.config);
// plugin data dirs live in the system temp dir (like the runtime's own).
const SCRATCH = path.join(REPO_ROOT, ".scratch");
let tmpDirs = [];

function makeBareHome() {
  fs.mkdirSync(SCRATCH, { recursive: true });
  const dir = fs.mkdtempSync(path.join(SCRATCH, "guard-home-"));
  tmpDirs.push(dir);
  return dir;
}

/** HOME with the guardian switched on (it is off by default since 0.2.2). */
function makeHome() {
  const dir = makeBareHome();
  writeGuardConfig(true, dir);
  return dir;
}

function makeDataDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "omm-narrate-data-"));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
  tmpDirs = [];
});

function runHook(hook, { home, dataDir, stdin }) {
  const env = { ...process.env, HOME: home };
  if (dataDir === null) delete env.MUSE_PLUGIN_DATA_DIR;
  else env.MUSE_PLUGIN_DATA_DIR = dataDir;
  return spawnSync(process.execPath, [hook], { input: stdin, encoding: "utf8", env });
}

function promptPayload(sessionId, prompt) {
  return JSON.stringify({
    cwd: "/tmp/proj",
    hook_event_name: "UserPromptSubmit",
    model: "muse-spark-test",
    model_provider: "test",
    permission_mode: "default",
    prompt,
    session_id: sessionId,
    transcript_path: "/tmp/transcript.jsonl",
  });
}

function stopPayload(sessionId, extra = {}) {
  return JSON.stringify({
    cwd: "/tmp/proj",
    hook_event_name: "Stop",
    last_assistant_message: "",
    model: "muse-spark-test",
    model_provider: "test",
    permission_mode: "default",
    session_id: sessionId,
    stop_hook_active: false,
    turn_id: "turn-1",
    ...extra,
  });
}

function stateFile(dataDir, sessionId) {
  return path.join(dataDir, "narrate", `narrate-${sessionId}.json`);
}

function readState(dataDir, sessionId) {
  return JSON.parse(fs.readFileSync(stateFile(dataDir, sessionId), "utf8"));
}

describe("narrate-prompt hook", () => {
  it("activates the session when the prompt contains /omm-<command>", () => {
    const home = makeHome();
    const dataDir = makeDataDir();
    const res = runHook(PROMPT_HOOK, { home, dataDir, stdin: promptPayload("s1", "/omm-team do the thing") });
    assert.equal(res.status, 0);
    assert.equal(res.stdout, "");
    assert.deepEqual(
      { active: readState(dataDir, "s1").active, blocks: readState(dataDir, "s1").blocks },
      { active: true, blocks: 0 },
    );
  });

  it("keeps the session armed on subagent prompts (they share the parent session_id)", () => {
    const home = makeHome();
    const dataDir = makeDataDir();
    runHook(PROMPT_HOOK, { home, dataDir, stdin: promptPayload("s1", "/omm-ralph go") });
    assert.equal(readState(dataDir, "s1").active, true);
    for (const prompt of [
      "Primero llama a read_skill plugin:oh-my-muse:researcher. Inspecciona index.html.",
      "something else",
    ]) {
      const res = runHook(PROMPT_HOOK, { home, dataDir, stdin: promptPayload("s1", prompt) });
      assert.equal(res.status, 0);
      assert.equal(res.stdout, "");
      assert.equal(readState(dataDir, "s1").active, true, prompt);
    }
  });

  it("does nothing by default (no guard.json: guardian off)", () => {
    const home = makeBareHome();
    const dataDir = makeDataDir();
    const res = runHook(PROMPT_HOOK, { home, dataDir, stdin: promptPayload("s1", "/omm-team go") });
    assert.equal(res.status, 0);
    assert.equal(res.stdout, "");
    assert.equal(fs.existsSync(stateFile(dataDir, "s1")), false);
  });

  it("writes no state for a non-omm prompt with no prior state", () => {
    const home = makeHome();
    const dataDir = makeDataDir();
    const res = runHook(PROMPT_HOOK, { home, dataDir, stdin: promptPayload("s1", "hello") });
    assert.equal(res.status, 0);
    assert.equal(fs.existsSync(stateFile(dataDir, "s1")), false);
  });

  it("does nothing when the guard is off", () => {
    const home = makeHome();
    const dataDir = makeDataDir();
    execFileSync(process.execPath, [OMM_CLI, "guard", "off"], { encoding: "utf8", env: { ...process.env, HOME: home } });
    const res = runHook(PROMPT_HOOK, { home, dataDir, stdin: promptPayload("s1", "/omm-team go") });
    assert.equal(res.status, 0);
    assert.equal(res.stdout, "");
    assert.equal(fs.existsSync(stateFile(dataDir, "s1")), false);
  });

  it("exits 0 silently on invalid stdin", () => {
    const res = runHook(PROMPT_HOOK, { home: makeHome(), dataDir: makeDataDir(), stdin: "not json{{{ " });
    assert.equal(res.status, 0);
    assert.equal(res.stdout, "");
  });
});

describe("narrate-stop hook", () => {
  function activate(home, dataDir, sessionId) {
    const res = runHook(PROMPT_HOOK, { home, dataDir, stdin: promptPayload(sessionId, "/omm-team go") });
    assert.equal(res.status, 0);
    return res;
  }

  it("blocks without a card, counting the block", () => {
    const home = makeHome();
    const dataDir = makeDataDir();
    activate(home, dataDir, "s1");
    const res = runHook(STOP_HOOK, {
      home,
      dataDir,
      stdin: stopPayload("s1", { last_assistant_message: "working, no card yet" }),
    });
    assert.equal(res.status, 0);
    const doc = JSON.parse(res.stdout);
    assert.equal(doc.decision, "block");
    assert.ok(String(doc.reason).includes("SOLO texto"), "reason must ask for text only");
    assert.match(String(doc.reason), /omm-narration/);
    assert.equal(readState(dataDir, "s1").blocks, 1);
  });

  it("allows when the message carries a card (🏮, ✔ Oleada, ▶ Oleada)", () => {
    for (const card of [
      "## 🏮 OMM Team · goal",
      "### ✔ Oleada 1/4 completada",
      "### ▶ Oleada 2/4 · build",
    ]) {
      const home = makeHome();
      const dataDir = makeDataDir();
      activate(home, dataDir, "s1");
      const res = runHook(STOP_HOOK, { home, dataDir, stdin: stopPayload("s1", { last_assistant_message: card }) });
      assert.equal(res.status, 0, card);
      assert.equal(res.stdout, "", card);
      assert.equal(readState(dataDir, "s1").blocks, 0, card);
    }
  });

  it("allows when stop_hook_active is true (no block loops)", () => {
    const home = makeHome();
    const dataDir = makeDataDir();
    activate(home, dataDir, "s1");
    const res = runHook(STOP_HOOK, {
      home,
      dataDir,
      stdin: stopPayload("s1", { stop_hook_active: true, last_assistant_message: "no card" }),
    });
    assert.equal(res.status, 0);
    assert.equal(res.stdout, "");
  });

  it("disarms the session on ✅ Hecho and lets the turn end", () => {
    const home = makeHome();
    const dataDir = makeDataDir();
    activate(home, dataDir, "s1");
    const res = runHook(STOP_HOOK, {
      home,
      dataDir,
      stdin: stopPayload("s1", { last_assistant_message: "## ✅ Hecho\nall done" }),
    });
    assert.equal(res.status, 0);
    assert.equal(res.stdout, "");
    assert.equal(readState(dataDir, "s1").active, false);
    // Disarmed: a later card-less turn is no longer blocked.
    const later = runHook(STOP_HOOK, {
      home,
      dataDir,
      stdin: stopPayload("s1", { last_assistant_message: "no card" }),
    });
    assert.equal(later.stdout, "");
  });

  it(`blocks at most ${MAX_BLOCKS_PER_SESSION} times per session`, () => {
    const home = makeHome();
    const dataDir = makeDataDir();
    activate(home, dataDir, "s1");
    const stdin = stopPayload("s1", { last_assistant_message: "never a card" });
    for (let i = 1; i <= MAX_BLOCKS_PER_SESSION; i++) {
      const res = runHook(STOP_HOOK, { home, dataDir, stdin });
      assert.equal(res.status, 0);
      assert.equal(JSON.parse(res.stdout).decision, "block", `block ${i}`);
    }
    assert.equal(readState(dataDir, "s1").blocks, MAX_BLOCKS_PER_SESSION);
    const overflow = runHook(STOP_HOOK, { home, dataDir, stdin });
    assert.equal(overflow.status, 0);
    assert.equal(overflow.stdout, "", "past the cap the turn must end");
  });

  it("allows an inactive session without blocking", () => {
    const home = makeHome();
    const dataDir = makeDataDir();
    const res = runHook(STOP_HOOK, {
      home,
      dataDir,
      stdin: stopPayload("never-seen", { last_assistant_message: "no card" }),
    });
    assert.equal(res.status, 0);
    assert.equal(res.stdout, "");
  });

  it("does nothing when the guard is off, even with active state", () => {
    const home = makeHome();
    const dataDir = makeDataDir();
    activate(home, dataDir, "s1");
    execFileSync(process.execPath, [OMM_CLI, "guard", "off"], { encoding: "utf8", env: { ...process.env, HOME: home } });
    const res = runHook(STOP_HOOK, {
      home,
      dataDir,
      stdin: stopPayload("s1", { last_assistant_message: "no card" }),
    });
    assert.equal(res.status, 0);
    assert.equal(res.stdout, "");
  });

  it("exits 0 silently on invalid stdin", () => {
    const res = runHook(STOP_HOOK, { home: makeHome(), dataDir: makeDataDir(), stdin: "{{{broken" });
    assert.equal(res.status, 0);
    assert.equal(res.stdout, "");
  });
});

describe("guard state plumbing", () => {
  it("falls back to ~/.local/state/oh-my-muse when MUSE_PLUGIN_DATA_DIR is unset", () => {
    const home = makeHome();
    assert.equal(
      narrateStateDir({}, home),
      path.join(home, ".local", "state", "oh-my-muse", "narrate"),
    );
    const res = runHook(PROMPT_HOOK, { home, dataDir: null, stdin: promptPayload("s1", "/omm-team go") });
    assert.equal(res.status, 0);
    const fallback = path.join(home, ".local", "state", "oh-my-muse", "narrate", "narrate-s1.json");
    assert.ok(fs.existsSync(fallback), "state must land in the HOME fallback dir");
    assert.equal(JSON.parse(fs.readFileSync(fallback, "utf8")).active, true);
  });

  it("prunes state files older than 7 days on write", async () => {
    const { writeNarrateState, pruneNarrateStates } = await import("../plugin/hooks/narrate-state.mjs");
    const dataDir = makeDataDir();
    const dir = path.join(dataDir, "narrate");
    fs.mkdirSync(dir, { recursive: true });
    const old = path.join(dir, "narrate-old.json");
    fs.writeFileSync(old, '{"active":true,"blocks":0}');
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    fs.utimesSync(old, eightDaysAgo, eightDaysAgo);
    writeNarrateState("fresh", { active: true, blocks: 0 }, { env: { MUSE_PLUGIN_DATA_DIR: dataDir } });
    assert.equal(fs.existsSync(old), false, "expired state must be pruned");
    assert.equal(fs.existsSync(path.join(dir, "narrate-fresh.json")), true);
    pruneNarrateStates(path.join(dataDir, "does-not-exist")); // must not throw
  });

  it("guard.json defaults to off; only {enabled: true} turns it on", () => {
    const home = makeBareHome();
    assert.equal(guardConfigPath(home), path.join(home, ".config", "oh-my-muse", "guard.json"));
    assert.equal(isGuardEnabled(home), false, "missing file means disabled");
    fs.mkdirSync(path.dirname(guardConfigPath(home)), { recursive: true });
    fs.writeFileSync(guardConfigPath(home), "{broken json");
    assert.equal(isGuardEnabled(home), false, "malformed file means disabled");
    fs.writeFileSync(guardConfigPath(home), '{"enabled": true}');
    assert.equal(isGuardEnabled(home), true);
  });
});

describe("omm guard CLI", () => {
  function runGuard(home, ...args) {
    return execFileSync(process.execPath, [OMM_CLI, "guard", ...args], {
      encoding: "utf8",
      env: { ...process.env, HOME: home },
    });
  }

  it("on/off write guard.json 0600 and status reports the switch", () => {
    const home = makeBareHome();
    assert.match(runGuard(home, "status"), /: off/, "fresh HOME defaults to off");
    assert.match(runGuard(home, "off"), /off/);
    assert.equal(fs.statSync(guardConfigPath(home)).mode & 0o777, 0o600);
    assert.equal(JSON.parse(fs.readFileSync(guardConfigPath(home), "utf8")).enabled, false);
    assert.match(runGuard(home, "status"), /off/);
    assert.match(runGuard(home, "on"), /on/);
    assert.equal(JSON.parse(fs.readFileSync(guardConfigPath(home), "utf8")).enabled, true);
  });

  it("rejects an unknown subcommand with usage", () => {
    assert.throws(
      () => runGuard(makeHome(), "maybe"),
      /omm guard on\|off\|status/,
    );
  });
});

const museAvailable = (() => {
  try {
    execFileSync("muse", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

describe("real hook round-trip", () => {
  it("muse plugins hook test: Stop follows the real guard switch", (t) => {
    if (!museAvailable) {
      t.skip("muse CLI not in PATH");
      return;
    }
    // Real HOME: the default (no guard.json) is off, so no block; with
    // `omm guard on` the card-less Stop must block.
    const expectBlock = isGuardEnabled();
    const runHookTest = (hookId, fixture) => {
      fs.mkdirSync(SCRATCH, { recursive: true });
      const file = path.join(SCRATCH, `hooktest-${hookId}-${process.pid}.json`);
      tmpDirs.push(file);
      fs.writeFileSync(file, JSON.stringify(fixture));
      const res = spawnSync("muse", ["plugins", "hook", "test", `oh-my-muse:${hookId}`, "--fixture", file, "--json"], {
        encoding: "utf8",
      });
      const out = `${res.stdout ?? ""}${res.stderr ?? ""}`;
      if (out.includes("not installed and enabled")) return { notInstalled: true };
      let doc = null;
      try {
        doc = JSON.parse(res.stdout);
      } catch {
        // fall through with doc null
      }
      return { notInstalled: false, doc, out };
    };
    const sessionId = `hooktest-${Date.now()}`;
    // Arm the session through the real prompt hook first: whatever data
    // dir the runtime uses, both hook-test runs share it.
    const arm = runHookTest("omm-narrate-prompt", {
      event: "UserPromptSubmit",
      stdin: {
        cwd: REPO_ROOT,
        hook_event_name: "UserPromptSubmit",
        model: "muse-spark-test",
        model_provider: "test",
        permission_mode: "default",
        prompt: "/omm-team hook round-trip",
        session_id: sessionId,
        transcript_path: path.join(SCRATCH, "transcript.jsonl"),
      },
    });
    if (arm.notInstalled) {
      t.skip("oh-my-muse is not installed in muse (install is out of scope for tests)");
      return;
    }
    if (!arm.doc || arm.doc.error) {
      t.skip(`prompt hook test did not run cleanly: ${(arm.doc?.error?.message ?? arm.out).slice(0, 200)}`);
      return;
    }
    const stop = runHookTest("omm-narrate-stop", {
      event: "Stop",
      stdin: {
        cwd: REPO_ROOT,
        hook_event_name: "Stop",
        last_assistant_message: "working, no card yet",
        model: "muse-spark-test",
        model_provider: "test",
        permission_mode: "default",
        session_id: sessionId,
        stop_hook_active: false,
        turn_id: "turn-1",
      },
    });
    if (stop.notInstalled) {
      t.skip("oh-my-muse is not installed in muse (install is out of scope for tests)");
      return;
    }
    const decision = stop.doc?.decision ?? {};
    assert.equal(decision.should_block, expectBlock, `expected should_block ${expectBlock}, got: ${stop.out.slice(0, 500)}`);
    if (expectBlock) assert.match(String(decision.block_reason), /omm-narration/);
  });
});
