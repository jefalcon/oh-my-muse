import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const TIERS = ["budget", "balanced", "premium"];

const failures = [];
function check(ok, message) {
  console.log(`${ok ? "ok  " : "FAIL"}  ${message}`);
  if (!ok) failures.push(message);
}

function readAgentFiles() {
  const dir = path.join(REPO_ROOT, "pack", "agents");
  return fs
    .readdirSync(dir)
    .filter((n) => n.endsWith(".ts"))
    .map((n) => ({ name: n, file: path.join(dir, n), text: fs.readFileSync(path.join(dir, n), "utf8") }));
}

function validateAgentShape({ name, text }) {
  const issues = [];
  const nameMatch = text.match(/name:\s*"([^"]+)"/);
  if (!nameMatch || nameMatch[1].length === 0) issues.push("missing non-empty name");
  else if (`${nameMatch[1]}.ts` !== name) issues.push(`filename ${name} does not match agent name ${nameMatch[1]}`);
  const descMatch = text.match(/description:\s*"([^"]+)"/);
  if (!descMatch || descMatch[1].length === 0) issues.push("missing non-empty description");
  const tierMatch = text.match(/tier:\s*"([^"]+)"/);
  if (!tierMatch) issues.push("missing tier");
  else if (!TIERS.includes(tierMatch[1])) issues.push(`tier must be one of ${TIERS.join("|")}, got "${tierMatch[1]}"`);
  if (!/systemPrompt:\s*(\[|")/.test(text)) issues.push("missing systemPrompt");
  const isAgent = /satisfies\s+AgentDefinition/.test(text);
  const isOrchestrator = /OrchestratorDefinition/.test(text) && /kind:\s*"orchestrator"/.test(text);
  if (!isAgent && !isOrchestrator) issues.push("must satisfy AgentDefinition or OrchestratorDefinition");
  if (isOrchestrator) {
    if (!/spawnableAgents/.test(text)) issues.push("orchestrator missing spawnableAgents");
    if (!/handleSteps/.test(text)) issues.push("orchestrator missing handleSteps");
  }
  return issues;
}

const agents = readAgentFiles();
check(agents.length > 0, `found ${agents.length} agent definitions under pack/agents`);
for (const a of agents) {
  const issues = validateAgentShape(a);
  check(issues.length === 0, `${a.name}: ${issues.length === 0 ? "valid agent shape" : issues.join("; ")}`);
}

const models = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "models.json"), "utf8"));
for (const tier of TIERS) {
  check(Boolean(models.tiers?.[tier]?.model), `models.json tier "${tier}" has a model`);
}
for (const [presetName, preset] of Object.entries(models.presets ?? {})) {
  check(
    TIERS.includes(preset.tier),
    `preset "${presetName}" tier is one of ${TIERS.join("|")} (got "${preset.tier}")`,
  );
}

const { stripJsonc } = await import("../bin/lib.mjs");
const ommRaw = fs.readFileSync(path.join(REPO_ROOT, "omm.jsonc"), "utf8");
let omm;
try {
  omm = JSON.parse(stripJsonc(ommRaw));
  check(true, "omm.jsonc parses as JSONC");
} catch (err) {
  check(false, `omm.jsonc parses as JSONC: ${err.message}`);
}
if (omm) {
  check(TIERS.includes(omm.defaultTier), `omm.jsonc defaultTier is one of ${TIERS.join("|")}`);
  for (const agent of omm.agents ?? []) {
    check(
      agent.tier === undefined || TIERS.includes(agent.tier),
      `omm.jsonc agent "${agent.name}" tier is valid`,
    );
    check(
      typeof agent.systemPrompt === "string" && agent.systemPrompt.length > 0,
      `omm.jsonc agent "${agent.name}" has a systemPrompt`,
    );
  }
}

if (failures.length > 0) {
  console.error(`\nSmoke failed with ${failures.length} issue(s).`);
  process.exit(1);
}
console.log(`\nSmoke passed: ${agents.length} agents, ${Object.keys(models.presets ?? {}).length} presets.`);
