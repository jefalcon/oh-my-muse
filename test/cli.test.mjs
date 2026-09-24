import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  repoRootFromHere,
  resolveTargetDir,
  pluginDirFromHere,
  listSkillDirs,
  expandEnvInString,
  expandEnv,
  redactValue,
  redactConfig,
  redactText,
  assertHttps,
  findMuse,
  requireMuse,
  installArgs,
  resolveNotificationFile,
  validateWebhookUrl,
} from "../bin/lib.mjs";

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

let tmpDirs = [];
function makeTmp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "omm-cli-test-"));
  tmpDirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
  tmpDirs = [];
});

describe("path helpers", () => {
  it("repoRootFromHere resolves the repo root absolutely", () => {
    const root = repoRootFromHere(import.meta.url);
    assert.equal(path.isAbsolute(root), true);
    assert.equal(root, REPO_ROOT);
    assert.equal(fs.existsSync(path.join(root, "bin", "lib.mjs")), true);
  });

  it("pluginDirFromHere resolves from import.meta.url, not cwd", () => {
    const dir = pluginDirFromHere(import.meta.url);
    assert.equal(dir, path.join(REPO_ROOT, "plugin"));
    assert.equal(fs.existsSync(path.join(dir, ".muse-plugin", "plugin.json")), true);
  });

  it("resolveTargetDir resolves relative targets against cwd absolutely", () => {
    const cwd = makeTmp();
    assert.equal(resolveTargetDir(cwd, undefined), path.resolve(cwd));
    assert.equal(resolveTargetDir(cwd, "sub"), path.resolve(cwd, "sub"));
    assert.equal(resolveTargetDir(cwd, "/tmp/abs"), path.normalize("/tmp/abs"));
  });

  it("listSkillDirs lists every plugin skill directory", () => {
    const dirs = listSkillDirs(path.join(REPO_ROOT, "plugin"));
    assert.ok(dirs.length >= 18, `expected 18+ skills, got ${dirs.length}`);
    for (const d of dirs) assert.ok(fs.existsSync(path.join(d, "SKILL.md")), d);
  });
});

describe("env expansion", () => {
  it("expandEnvInString supports $VAR, ${VAR} and ${VAR:-default}", () => {
    assert.equal(expandEnvInString("hi $NAME", { NAME: "bob" }), "hi bob");
    assert.equal(expandEnvInString("hi ${NAME}", { NAME: "bob" }), "hi bob");
    assert.equal(expandEnvInString("hi ${MISSING:-fallback}", {}), "hi fallback");
    assert.equal(expandEnvInString("hi $MISSING", {}), "hi $MISSING");
  });

  it("expandEnv recurses through objects and arrays", () => {
    assert.deepEqual(
      expandEnv({ a: "$X", b: ["$X", 1], c: { d: "${X}" } }, { X: "v" }),
      { a: "v", b: ["v", 1], c: { d: "v" } },
    );
  });
});

describe("redaction and URL policy", () => {
  it("redactValue redacts sensitive keys only", () => {
    assert.equal(redactValue("api_key", "abc"), "[redacted]");
    assert.equal(redactValue("botToken", "abc"), "[redacted]");
    assert.equal(redactValue("name", "abc"), "abc");
    assert.equal(redactValue("api_key", ""), "");
  });

  it("redactConfig recurses and redactText scrubs tokens and keys", () => {
    assert.deepEqual(redactConfig({ notify: { url: "https://x", api_key: "s3cr3t" } }), {
      notify: { url: "https://x", api_key: "[redacted]" },
    });
    assert.ok(!redactText("token bot123:ABCDefghij12345 here").includes("ABCDefghij12345"));
    assert.ok(
      !redactText("-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----").includes("abc"),
    );
  });

  it("assertHttps requires https URLs", () => {
    assert.equal(assertHttps("https://example.com/hook"), "https://example.com/hook");
    assert.throws(() => assertHttps("http://example.com/hook"), /must use https/);
    assert.throws(() => assertHttps("not a url"), /not a valid URL/);
  });

  it("redactText scrubs discord and slack webhook URLs", () => {
    const d = "hook https://discord.com/api/webhooks/123/abc-def here";
    assert.ok(!redactText(d).includes("abc-def"), "discord token must not leak");
    const s = "hook https://hooks.slack.com/services/T1/B2/xyz here";
    assert.ok(!redactText(s).includes("xyz"), "slack token must not leak");
  });
});

describe("muse discovery", () => {
  it("findMuse finds an executable on a fake PATH and returns null when absent", () => {
    const dir = makeTmp();
    fs.writeFileSync(path.join(dir, "muse"), "#!/bin/sh\necho hi\n");
    fs.chmodSync(path.join(dir, "muse"), 0o755);
    assert.equal(findMuse({ PATH: `${dir}:/nope` }), path.join(dir, "muse"));
    assert.equal(findMuse({ PATH: "/nope" }), null);
    assert.equal(findMuse({}), null);
  });

  it("requireMuse throws a clear error when muse is missing", () => {
    assert.throws(() => requireMuse({ PATH: "/nope" }), /muse CLI not found in PATH/);
  });

  it("installArgs builds the install argv and validates scope", () => {
    assert.deepEqual(installArgs("/p/plugin", undefined), ["plugins", "install", "/p/plugin"]);
    assert.deepEqual(installArgs("/p/plugin", "user"), ["plugins", "install", "/p/plugin", "--scope", "user"]);
    assert.throws(() => installArgs("/p/plugin", "global"), /--scope must be user\|project/);
  });
});

describe("notification file confinement", () => {
  it("allows files inside the project root", () => {
    const root = makeTmp();
    assert.equal(
      resolveNotificationFile(root, "sub/notify.log"),
      path.join(path.resolve(root), "sub", "notify.log"),
    );
  });

  it("refuses files outside the root unless opted in", () => {
    const root = makeTmp();
    assert.throws(() => resolveNotificationFile(root, "/tmp/elsewhere.log"), /outside project root/);
    assert.throws(() => resolveNotificationFile(root, "../escape.log"), /outside project root/);
    assert.equal(
      resolveNotificationFile(root, "/tmp/elsewhere.log", true),
      path.resolve("/tmp/elsewhere.log"),
    );
  });

  it("refuses lexical-inside paths that escape through a symlinked dir", () => {
    const root = makeTmp();
    const outside = makeTmp();
    fs.symlinkSync(outside, path.join(root, "link"));
    assert.throws(() => resolveNotificationFile(root, "link/notify.log"), /symlink/);
    assert.equal(
      resolveNotificationFile(root, "link/notify.log", true),
      path.join(path.resolve(root), "link", "notify.log"),
    );
  });

  it("sendFile confines hook paths but honors explicit opt-out", async () => {
    const { sendFile } = await import("../plugin/hooks/notify.mjs");
    const root = makeTmp();
    const outside = path.join(makeTmp(), "ext.log");
    await assert.rejects(
      sendFile({ file: outside, text: "hi", root }),
      /outside project root/,
    );
    const res = await sendFile({ file: outside, text: "hi", root, allowExternalFile: true });
    assert.equal(res.ok, true);
    assert.match(fs.readFileSync(outside, "utf8"), /hi/);
    const inside = await sendFile({ file: "n.log", text: "in", root });
    assert.match(fs.readFileSync(inside.file, "utf8"), /in/);
  });
});

describe("webhook URL validation", () => {
  it("validateWebhookUrl pins discord/slack to provider hosts over https", () => {
    validateWebhookUrl("discord", "https://discord.com/api/webhooks/1/tok");
    validateWebhookUrl("slack", "https://hooks.slack.com/services/A/B/C");
    assert.throws(() => validateWebhookUrl("discord", "http://discord.com/api/webhooks/1/tok"), /https/);
    assert.throws(() => validateWebhookUrl("discord", "https://evil.example/api/webhooks/1/tok"), /Discord/);
    assert.throws(() => validateWebhookUrl("slack", "https://evil.example/services/A/B/C"), /slack webhook/);
    assert.throws(() => validateWebhookUrl("discord", "not a url"), /invalid discord/);
  });
});
