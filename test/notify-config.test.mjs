import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import {
  applyEnvOverrides,
  isSecureConfigMode,
  notifyConfigPath,
  readNotifyConfigFile,
  readHookPayload,
  writeNotifyConfig,
} from "../plugin/hooks/notify.mjs";

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const HOOK = path.join(REPO_ROOT, "plugin", "hooks", "notify.mjs");
const OMM_CLI = path.join(REPO_ROOT, "bin", "omm.mjs");

// Temporary HOME roots live inside .scratch/ (never the real ~/.config).
const SCRATCH = path.join(REPO_ROOT, ".scratch");
let tmpDirs = [];

function makeHome() {
  fs.mkdirSync(SCRATCH, { recursive: true });
  const dir = fs.mkdtempSync(path.join(SCRATCH, "test-home-"));
  tmpDirs.push(dir);
  return dir;
}

function makeProj() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "omm-notify-test-"));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
  tmpDirs = [];
  if (globalThis.__ommRealFetch !== undefined) {
    globalThis.fetch = globalThis.__ommRealFetch;
    delete globalThis.__ommRealFetch;
  }
});

function mockFetch(capture) {
  if (globalThis.__ommRealFetch === undefined) globalThis.__ommRealFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    capture.push({ url: String(url), opts });
    return { ok: true, status: 200, text: async () => "ok" };
  };
}

/** Run the hook as a child with piped stdin, like the runtime does. */
function runHook({ home, cwd, stdin, extraEnv = {} }) {
  return spawnSync(process.execPath, [HOOK], {
    cwd,
    input: stdin,
    encoding: "utf8",
    env: { ...process.env, HOME: home, ...extraEnv },
  });
}

function hookPayload(proj, extra = {}) {
  return JSON.stringify({
    cwd: proj,
    hook_event_name: "Stop",
    model: "muse-spark-test",
    session_id: "sess-1",
    stop_hook_active: false,
    ...extra,
  });
}

describe("notify config file", () => {
  it("uses $HOME/.config/oh-my-muse/notify.json and ignores XDG_CONFIG_HOME", () => {
    const home = makeHome();
    assert.equal(notifyConfigPath(home), path.join(home, ".config", "oh-my-muse", "notify.json"));
    assert.ok(!notifyConfigPath(home).startsWith(process.env.XDG_CONFIG_HOME ?? "/nonexistent-xdg"));
  });

  it("writeNotifyConfig creates dir 0700 and file 0600", () => {
    const home = makeHome();
    const file = writeNotifyConfig({ channel: "file", file: "n.log" }, home);
    assert.equal(file, notifyConfigPath(home));
    assert.equal(fs.statSync(path.dirname(file)).mode & 0o777, 0o700);
    assert.equal(fs.statSync(file).mode & 0o777, 0o600);
    assert.deepEqual(JSON.parse(fs.readFileSync(file, "utf8")).channel, "file");
  });

  it("isSecureConfigMode rejects group/other-readable modes", () => {
    assert.equal(isSecureConfigMode(0o600), true);
    assert.equal(isSecureConfigMode(0o400), true);
    assert.equal(isSecureConfigMode(0o644), false);
    assert.equal(isSecureConfigMode(0o660), false);
    assert.equal(isSecureConfigMode(0o604), false);
  });

  it("readNotifyConfigFile returns {} for missing or broken files", () => {
    assert.deepEqual(readNotifyConfigFile(path.join(makeHome(), "nope.json")), {});
    const home = makeHome();
    const bad = path.join(home, "bad.json");
    fs.writeFileSync(bad, "{not json");
    assert.deepEqual(readNotifyConfigFile(bad), {});
  });
});

describe("CLI precedence: OMM_* env > file", () => {
  it("applyEnvOverrides prefers env over the file", () => {
    const file = { channel: "file", message: "from-file", file: "a.log" };
    const out = applyEnvOverrides(file, { OMM_NOTIFY_CHANNEL: "off", OMM_NOTIFY_MESSAGE: "from-env" });
    assert.equal(out.channel, "off");
    assert.equal(out.message, "from-env");
    assert.equal(out.file, "a.log");
    assert.deepEqual(applyEnvOverrides(file, {}), file);
  });

  it("omm notify direct send prefers OMM_NOTIFY_MESSAGE over the file", () => {
    const home = makeHome();
    writeNotifyConfig({ channel: "file", file: "cfg.log", message: "from-file" }, home);
    const proj = makeProj();
    execFileSync(process.execPath, [OMM_CLI, "notify", "--channel", "file"], {
      cwd: proj,
      encoding: "utf8",
      env: { ...process.env, HOME: home, OMM_NOTIFY_MESSAGE: "from-env" },
    });
    const body = fs.readFileSync(path.join(proj, "cfg.log"), "utf8");
    assert.match(body, /from-env/);
    assert.doesNotMatch(body, /from-file/);
  });

  it("omm notify setup writes 0600 and never prints secrets", () => {
    const home = makeHome();
    const secret = "s3cr3t-setup-token-xyz";
    const out = execFileSync(process.execPath, [
      OMM_CLI, "notify", "setup", "--channel", "telegram",
      "--botToken", secret, "--chatId", "42",
    ], { encoding: "utf8", env: { ...process.env, HOME: home } });
    assert.ok(!out.includes(secret), "setup output must not leak the token");
    const cfgPath = notifyConfigPath(home);
    assert.equal(fs.statSync(cfgPath).mode & 0o777, 0o600);
    assert.equal(JSON.parse(fs.readFileSync(cfgPath, "utf8")).botToken, secret);
  });

  it("omm notify test sends using the file", () => {
    const home = makeHome();
    writeNotifyConfig({ channel: "file", file: "t.log", message: "test-ping" }, home);
    const proj = makeProj();
    const out = execFileSync(process.execPath, [OMM_CLI, "notify", "test"], {
      cwd: proj,
      encoding: "utf8",
      env: { ...process.env, HOME: home },
    });
    assert.ok(out.includes("Notified via file"), out);
    assert.match(fs.readFileSync(path.join(proj, "t.log"), "utf8"), /test-ping/);
  });
});

describe("Stop hook reads ONLY the file", () => {
  it("ignores OMM_NOTIFY_CHANNEL=off and OMM_NOTIFY_MESSAGE when the file says file", () => {
    const home = makeHome();
    writeNotifyConfig({ channel: "file", file: "n.log", message: "cfg-msg" }, home);
    const proj = makeProj();
    const res = runHook({
      home,
      cwd: proj,
      stdin: hookPayload(proj),
      extraEnv: { OMM_NOTIFY_CHANNEL: "off", OMM_NOTIFY_MESSAGE: "hacked" },
    });
    assert.equal(res.status, 0);
    const body = fs.readFileSync(path.join(proj, "n.log"), "utf8");
    assert.match(body, /cfg-msg/);
    assert.doesNotMatch(body, /hacked/);
  });

  it("stays silent when the file says off even if env requests file", () => {
    const home = makeHome();
    writeNotifyConfig({ channel: "off" }, home);
    const proj = makeProj();
    const res = runHook({
      home,
      cwd: proj,
      stdin: hookPayload(proj),
      extraEnv: { OMM_NOTIFY_CHANNEL: "file", OMM_NOTIFY_FILE: "n.log" },
    });
    assert.equal(res.status, 0);
    assert.equal(fs.existsSync(path.join(proj, "n.log")), false);
  });

  it("refuses to send when the config mode is 0644", () => {
    const home = makeHome();
    const cfgPath = writeNotifyConfig({ channel: "file", file: "n.log", message: "hi" }, home);
    fs.chmodSync(cfgPath, 0o644);
    const proj = makeProj();
    const res = runHook({ home, cwd: proj, stdin: hookPayload(proj) });
    assert.equal(res.status, 0);
    assert.equal(fs.existsSync(path.join(proj, "n.log")), false);
  });

  it("sends nothing and exits 0 when there is no config file", () => {
    const home = makeHome();
    const proj = makeProj();
    const res = runHook({
      home,
      cwd: proj,
      stdin: hookPayload(proj),
      extraEnv: { OMM_NOTIFY_CHANNEL: "file" },
    });
    assert.equal(res.status, 0);
    assert.equal(fs.existsSync(path.join(proj, "n.log")), false);
  });

  it("does nothing when stop_hook_active is true", () => {
    const home = makeHome();
    writeNotifyConfig({ channel: "file", file: "n.log", message: "hi" }, home);
    const proj = makeProj();
    const res = runHook({ home, cwd: proj, stdin: hookPayload(proj, { stop_hook_active: true }) });
    assert.equal(res.status, 0);
    assert.equal(fs.existsSync(path.join(proj, "n.log")), false);
  });

  it("exits 0 without sending on invalid stdin", () => {
    const home = makeHome();
    writeNotifyConfig({ channel: "file", file: "n.log", message: "hi" }, home);
    const proj = makeProj();
    const res = runHook({ home, cwd: proj, stdin: "this is not json{{{", extraEnv: {} });
    assert.equal(res.status, 0);
    assert.equal(fs.existsSync(path.join(proj, "n.log")), false);
    assert.equal(readHookPayload === undefined, false); // helper stays exported
  });

  it("file channel writes inside the payload cwd, not the process cwd", () => {
    const home = makeHome();
    writeNotifyConfig({ channel: "file", file: "n.log", message: "turn in {{projectName}}" }, home);
    const proj = makeProj();
    const elsewhere = makeProj();
    const res = runHook({ home, cwd: elsewhere, stdin: hookPayload(proj) });
    assert.equal(res.status, 0);
    assert.equal(fs.existsSync(path.join(elsewhere, "n.log")), false);
    const body = fs.readFileSync(path.join(proj, "n.log"), "utf8");
    assert.match(body, new RegExp(`turn in ${path.basename(proj)}`));
  });

  it("includes the assistant message only when enabled, truncated and redacted", () => {
    const secret = "bot123456:ABCDEFGHIJ_secret-token-zz";
    const long = `hello ${secret} ` + "x".repeat(600);
    const masked = (body) => !body.includes("ABCDEFGHIJ_secret-token-zz");

    const homeOn = makeHome();
    writeNotifyConfig(
      { channel: "file", file: "n.log", message: "done", includeAssistantMessage: true },
      homeOn,
    );
    const projOn = makeProj();
    const resOn = runHook({
      home: homeOn,
      cwd: projOn,
      stdin: hookPayload(projOn, { last_assistant_message: long }),
    });
    assert.equal(resOn.status, 0);
    const bodyOn = fs.readFileSync(path.join(projOn, "n.log"), "utf8");
    assert.ok(bodyOn.includes("hello"), "assistant text must be included");
    assert.ok(masked(bodyOn), "secrets in the assistant message must be redacted");
    const afterDone = bodyOn.slice(bodyOn.indexOf("done") + 4);
    assert.ok(afterDone.replace(/\s/g, "").length <= 520, "assistant text must be truncated ~500 chars");

    const homeOff = makeHome();
    writeNotifyConfig({ channel: "file", file: "n.log", message: "done" }, homeOff);
    const projOff = makeProj();
    const resOff = runHook({
      home: homeOff,
      cwd: projOff,
      stdin: hookPayload(projOff, { last_assistant_message: long }),
    });
    assert.equal(resOff.status, 0);
    const bodyOff = fs.readFileSync(path.join(projOff, "n.log"), "utf8");
    assert.ok(!bodyOff.includes("hello"), "assistant text must be excluded by default");
    assert.ok(masked(bodyOff));
  });

  it("renders {{model}} and {{sessionId}} template vars", () => {
    const home = makeHome();
    writeNotifyConfig({ channel: "file", file: "n.log", message: "m={{model}} s={{sessionId}}" }, home);
    const proj = makeProj();
    const res = runHook({ home, cwd: proj, stdin: hookPayload(proj) });
    assert.equal(res.status, 0);
    assert.match(fs.readFileSync(path.join(proj, "n.log"), "utf8"), /m=muse-spark-test s=sess-1/);
  });
});

describe("webhook send without real network", () => {
  it("sendNotification posts through fetch (mocked)", async () => {
    const { sendNotification } = await import("../plugin/hooks/notify.mjs");
    const calls = [];
    mockFetch(calls);
    await sendNotification({
      channel: "discord",
      message: "hi {{projectName}}",
      projectName: "p",
      hook: { webhookUrl: "https://discord.com/api/webhooks/1/tok" },
    });
    assert.equal(calls.length, 1);
    assert.ok(calls[0].url.startsWith("https://discord.com/api/webhooks/"), calls[0].url);
  });
});
