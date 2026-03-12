#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const codexDir = path.join(repoRoot, ".codex");
const prdPath = path.join(codexDir, "prd.json");
const memoryPath = path.join(codexDir, "MEMORY.md");
const reportDir = path.join(codexDir, "reports");
const reportPath = path.join(reportDir, "latest-status.md");
const envelopeDir = path.join(codexDir, "artifacts", "envelopes");
const manualInputsSchemaPath = path.join(repoRoot, "deploy", "manual-inputs.schema.json");
const manualInputsExamplePath = path.join(repoRoot, "deploy", "manual-inputs.example.json");
const manualInputsLocalPath = path.join(repoRoot, "deploy", "manual-inputs.local.json");
const worktreesDir = path.join(repoRoot, ".worktrees");
const requiredControlFiles = [
  "AGENTS.md",
  "backend/AGENTS.md",
  "frontend/AGENTS.md",
  ".github/AGENTS.md",
  "deploy/AGENTS.md",
  "tools/uat/AGENTS.md",
  ".codex/CODEX.md",
  ".codex/MEMORY.md",
  ".codex/prd.json",
  ".codex/artifacts/envelope.schema.json",
  ".github/workflows/agent-verify.yml",
  ".github/workflows/upstream-sync.yml",
  "deploy/manual-inputs.schema.json",
  "deploy/manual-inputs.example.json",
  "tools/agent-loop/orchestrate.mjs"
];
const terminalStatuses = new Set(["done", "manual_blocker", "blocked"]);
const retryLimit = 3;

function nowIso() {
  return new Date().toISOString();
}

function parseArgs(argv) {
  const [command = "plan", ...rest] = argv;
  const options = {};
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg === "--until-manual") {
      options.untilManual = true;
    } else if (arg === "--tag") {
      options.tag = rest[i + 1];
      i += 1;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    }
  }
  return { command, options };
}

function printHelp() {
  console.log("Usage: node tools/agent-loop/orchestrate.mjs <plan|run|verify|release|report> [options]");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value);
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    env: {
      ...process.env,
      GH_PAGER: "cat",
      PAGER: "cat",
      ...(options.env ?? {})
    },
    encoding: "utf8",
    timeout: options.timeoutMs ?? 120000
  });
  return {
    status: result.status ?? (result.error ? 124 : 1),
    stdout: result.stdout ?? "",
    stderr: `${result.stderr ?? ""}${result.error ? `\n${result.error.message}` : ""}`
  };
}

function runChecked(command, args, options = {}) {
  const result = runCommand(command, args, options);
  if (result.status !== 0) {
    const rendered = [command, ...args].join(" ");
    throw new Error(`Command failed: ${rendered}\n${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

function relativeToRepo(filePath) {
  return path.relative(repoRoot, filePath).replaceAll(path.sep, "/");
}

function ensureDirectories() {
  [
    codexDir,
    envelopeDir,
    reportDir,
    worktreesDir
  ].forEach((dir) => fs.mkdirSync(dir, { recursive: true }));
}

function listChangedFiles() {
  const tracked = runChecked("git", ["diff", "--name-only", "HEAD", "--"], { cwd: repoRoot })
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const untracked = runChecked("git", ["ls-files", "--others", "--exclude-standard"], { cwd: repoRoot })
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const deleted = new Set(
    runChecked("git", ["diff", "--name-only", "--diff-filter=D", "HEAD", "--"], { cwd: repoRoot })
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
  );
  return { tracked, untracked, deleted };
}

function overlayWorkspaceDelta(worktreePath) {
  const { tracked, untracked, deleted } = listChangedFiles();
  const copyTargets = [...new Set([...tracked, ...untracked])]
    .filter((relativePath) => !relativePath.startsWith(".worktrees/"));
  for (const relativePath of copyTargets) {
    const sourcePath = path.join(repoRoot, relativePath);
    const targetPath = path.join(worktreePath, relativePath);
    if (deleted.has(relativePath) || !fs.existsSync(sourcePath)) {
      fs.rmSync(targetPath, { force: true, recursive: true });
      continue;
    }
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.cpSync(sourcePath, targetPath, { recursive: true });
  }
}

function createRoleWorktree(taskId, role, attempt) {
  const worktreePath = path.join(worktreesDir, `${taskId}-${role}-${attempt}`);
  if (fs.existsSync(worktreePath)) {
    runCommand("git", ["worktree", "remove", "--force", worktreePath], { cwd: repoRoot });
    fs.rmSync(worktreePath, { recursive: true, force: true });
  }
  runChecked("git", ["worktree", "add", "--detach", worktreePath, "HEAD"], { cwd: repoRoot });
  overlayWorkspaceDelta(worktreePath);
  return worktreePath;
}

function writeEnvelope(payload) {
  const fileName = `${new Date().toISOString().replaceAll(":", "").replaceAll(".", "")}-${payload.task_id}-${payload.agent_role}.json`;
  writeJson(path.join(envelopeDir, fileName), payload);
}

function loadPrd() {
  const prd = readJson(prdPath);
  prd.tasks.forEach((task) => {
    task.attempts ??= 0;
    task.history ??= [];
    task.reason ??= "";
    task.notes ??= "";
  });
  return prd;
}

function savePrd(prd) {
  prd.updated_at = nowIso();
  writeJson(prdPath, prd);
}

function ghJson(args) {
  const result = runCommand("gh", args, { cwd: repoRoot });
  if (result.status !== 0) {
    return null;
  }
  const output = result.stdout.trim();
  if (!output) {
    return null;
  }
  return JSON.parse(output);
}

function gatherFacts() {
  const branch = runChecked("git", ["branch", "--show-current"], { cwd: repoRoot });
  const statusOutput = runChecked("git", ["status", "--short"], { cwd: repoRoot });
  const dirty = statusOutput.length > 0;
  const compare = ghJson(["api", "repos/lin-mouren/sub2api/compare/main...mirror/upstream-main"]);
  const prs = ghJson([
    "pr",
    "list",
    "--repo",
    "lin-mouren/sub2api",
    "--state",
    "open",
    "--limit",
    "50",
    "--json",
    "number,title,headRefName,baseRefName,mergeStateStatus,reviewDecision,url"
  ]) ?? [];
  const releases = ghJson(["api", "repos/lin-mouren/sub2api/releases?per_page=20"]) ?? [];
  const deployments = ghJson(["api", "repos/lin-mouren/sub2api/deployments"]) ?? [];
  const syncRuns = ghJson([
    "run",
    "list",
    "--repo",
    "lin-mouren/sub2api",
    "--workflow",
    "upstream-sync.yml",
    "--limit",
    "5",
    "--json",
    "databaseId,status,conclusion,createdAt,url"
  ]) ?? [];
  const uatEvidenceDir = path.join(repoRoot, "docs", "uat-evidence");
  const uatEvidence = fs.existsSync(uatEvidenceDir)
    ? fs.readdirSync(uatEvidenceDir).sort()
    : [];
  const manualInputs = fs.existsSync(manualInputsLocalPath) ? readJson(manualInputsLocalPath) : null;
  return {
    branch,
    dirty,
    compare,
    prs,
    releases,
    deployments,
    syncRuns,
    uatEvidence,
    manualInputs
  };
}

function taskMap(prd) {
  return new Map(prd.tasks.map((task) => [task.id, task]));
}

function computeDependencyStatus(task, tasksById) {
  if (task.id === "REPORT-001") {
    return task.depends_on.every((dependencyId) => terminalStatuses.has(tasksById.get(dependencyId)?.status));
  }
  return task.depends_on.every((dependencyId) => tasksById.get(dependencyId)?.status === "done");
}

function propagateStatuses(prd) {
  const tasksById = taskMap(prd);
  for (const task of prd.tasks) {
    if (task.status === "done") {
      continue;
    }
    const dependencyStatuses = task.depends_on.map((dependencyId) => tasksById.get(dependencyId)?.status);
    if (task.id === "REPORT-001") {
      if (task.depends_on.length > 0 && dependencyStatuses.every((status) => terminalStatuses.has(status))) {
        task.status = "ready";
        task.reason = "";
      }
      continue;
    }
    if (dependencyStatuses.some((status) => status === "manual_blocker")) {
      task.status = "manual_blocker";
      task.reason = `Inherited manual blocker from ${task.depends_on.filter((dependencyId) => tasksById.get(dependencyId)?.status === "manual_blocker").join(", ")}`;
      continue;
    }
    if (dependencyStatuses.some((status) => status === "blocked")) {
      task.status = "blocked";
      task.reason = `Inherited blocked dependency from ${task.depends_on.filter((dependencyId) => tasksById.get(dependencyId)?.status === "blocked").join(", ")}`;
      continue;
    }
    if (computeDependencyStatus(task, tasksById) && task.status === "todo") {
      task.status = "ready";
      task.reason = "";
      continue;
    }
    if (computeDependencyStatus(task, tasksById) && task.status === "manual_blocker") {
      if (task.handler === "check_manual_inputs") {
        const probe = checkManualInputs();
        if (probe.status === "done") {
          task.status = "ready";
          task.reason = "";
        }
      } else if (task.handler === "run_live_uat") {
        const probe = checkManualInputs();
        if (probe.status === "done") {
          task.status = "ready";
          task.reason = "";
        }
      }
    }
  }
}

function appendTaskHistory(task, entry) {
  task.history.push({
    timestamp: nowIso(),
    ...entry
  });
}

function setTaskResult(task, result) {
  const reason = result.reason ?? "";
  const previousBlocked = [...task.history].reverse().find((entry) => entry.status === "blocked");
  const repeatedFailure = Boolean(previousBlocked && previousBlocked.reason === reason && reason);

  if (result.status === "blocked" && task.attempts < retryLimit && !repeatedFailure) {
    task.status = "ready";
    task.reason = `Retry scheduled (${task.attempts}/${retryLimit}): ${reason || "unknown failure"}`;
    task.notes = result.notes ?? "";
    appendTaskHistory(task, {
      status: "blocked",
      reason,
      notes: task.notes
    });
    appendTaskHistory(task, {
      status: "ready",
      reason: task.reason,
      notes: "Automatic retry queued"
    });
    return;
  }

  task.status = result.status;
  task.reason = reason;
  task.notes = result.notes ?? "";
  if (result.status === "blocked" && task.attempts >= retryLimit && task.reason) {
    const memoryText = fs.readFileSync(memoryPath, "utf8");
    if (!memoryText.includes(task.reason)) {
      writeText(
        memoryPath,
        `${memoryText.trim()}\n\n## Escalations\n\n- ${task.id}: ${task.reason}\n`
      );
    }
  }
  appendTaskHistory(task, {
    status: result.status,
    reason: task.reason,
    notes: task.notes
  });
}

function fileExists(relativePath) {
  return fs.existsSync(path.join(repoRoot, relativePath));
}

function healthCheck(baseUrl) {
  const result = runCommand("curl", ["-sS", "-m", "10", "-o", "/dev/null", "-w", "%{http_code}", `${baseUrl.replace(/\/$/, "")}/health`]);
  return result.stdout.trim();
}

function checkControlPlaneFiles() {
  const missing = requiredControlFiles.filter((relativePath) => !fileExists(relativePath));
  if (missing.length > 0) {
    return {
      status: "blocked",
      reason: `Missing control-plane files: ${missing.join(", ")}`,
      evidence: missing
    };
  }
  return {
    status: "done",
    reason: "",
    evidence: requiredControlFiles
  };
}

function verifyOrchestratorScript(worktreePath) {
  const syntax = runCommand("node", ["--check", "tools/agent-loop/orchestrate.mjs"], { cwd: worktreePath });
  if (syntax.status !== 0) {
    return {
      status: "blocked",
      reason: syntax.stderr.trim() || "Node syntax check failed",
      evidence: ["tools/agent-loop/orchestrate.mjs"]
    };
  }
  return {
    status: "done",
    evidence: ["tools/agent-loop/orchestrate.mjs"]
  };
}

function verifyGateWorkflow() {
  const workflowPath = path.join(repoRoot, ".github", "workflows", "agent-verify.yml");
  const content = fs.readFileSync(workflowPath, "utf8");
  if (!content.includes("node tools/agent-loop/orchestrate.mjs verify")) {
    return {
      status: "blocked",
      reason: "agent-verify workflow does not execute Codex verification",
      evidence: [relativeToRepo(workflowPath)]
    };
  }
  return {
    status: "done",
    evidence: [relativeToRepo(workflowPath)]
  };
}

function verifySyncWorkflow(facts) {
  const workflowPath = path.join(repoRoot, ".github", "workflows", "upstream-sync.yml");
  const content = fs.readFileSync(workflowPath, "utf8");
  const checks = [
    content.includes('sync_branch="sync/upstream-main-'),
    content.includes('head="${sync_branch}"'),
    content.includes('close_prs_by_head "mirror/upstream-main"'),
    content.includes('git merge --no-ff --no-edit origin/mirror/upstream-main')
  ];
  if (checks.some((value) => !value)) {
    return {
      status: "blocked",
      reason: "upstream-sync workflow is missing sync-branch automation logic",
      evidence: [relativeToRepo(workflowPath)]
    };
  }
  const staleMirrorPr = facts.prs.find((pr) => pr.headRefName === "mirror/upstream-main" && pr.baseRefName === "main");
  return {
    status: "done",
    notes: staleMirrorPr ? `Existing stale mirror PR still open remotely: #${staleMirrorPr.number}` : "",
    evidence: [relativeToRepo(workflowPath)]
  };
}

function verifyReleaseBaseline(facts) {
  const prerelease = facts.releases.find((release) => release.prerelease === true || release.isPrerelease === true);
  if (!prerelease) {
    return {
      status: "blocked",
      reason: "No prerelease baseline found in repository releases",
      evidence: []
    };
  }
  return {
    status: "done",
    evidence: [prerelease.html_url || prerelease.url]
  };
}

function missingManualFields(input) {
  const missing = [];
  if (!input) {
    return [
      "github.repository",
      "github.staging_environment",
      "github.production_environment",
      "deployment.compose_file",
      "deployment.env_file",
      "deployment.auto_start",
      "staging.base_url"
    ];
  }
  const requiredPaths = [
    "github.repository",
    "github.staging_environment",
    "github.production_environment",
    "deployment.compose_file",
    "deployment.env_file",
    "deployment.auto_start",
    "staging.base_url"
  ];
  for (const requiredPath of requiredPaths) {
    const value = requiredPath.split(".").reduce((acc, segment) => acc?.[segment], input);
    if (value === undefined || value === null || value === "") {
      missing.push(requiredPath);
    }
  }
  return missing;
}

function resolveDeploymentPaths(input) {
  const deployment = input.deployment;
  const composeFile = path.isAbsolute(deployment.compose_file)
    ? deployment.compose_file
    : path.join(repoRoot, deployment.compose_file);
  const envFile = path.isAbsolute(deployment.env_file)
    ? deployment.env_file
    : path.join(repoRoot, deployment.env_file);
  const workingDirectory = deployment.working_directory
    ? (path.isAbsolute(deployment.working_directory)
      ? deployment.working_directory
      : path.join(repoRoot, deployment.working_directory))
    : path.dirname(composeFile);
  return { composeFile, envFile, workingDirectory };
}

function checkManualInputs() {
  if (!fs.existsSync(manualInputsLocalPath)) {
    return {
      status: "manual_blocker",
      reason: `Missing ${relativeToRepo(manualInputsLocalPath)}`,
      evidence: [relativeToRepo(manualInputsExamplePath)]
    };
  }
  const input = readJson(manualInputsLocalPath);
  const missing = missingManualFields(input);
  if (missing.length > 0) {
    return {
      status: "manual_blocker",
      reason: `Missing manual input fields: ${missing.join(", ")}`,
      evidence: [relativeToRepo(manualInputsLocalPath)]
    };
  }
  const { composeFile, envFile } = resolveDeploymentPaths(input);
  const absentFiles = [composeFile, envFile].filter((filePath) => !fs.existsSync(filePath));
  if (absentFiles.length > 0) {
    return {
      status: "manual_blocker",
      reason: `Missing deployment files: ${absentFiles.map(relativeToRepo).join(", ")}`,
      evidence: absentFiles.map(relativeToRepo)
    };
  }
  return {
    status: "done",
    evidence: [relativeToRepo(manualInputsLocalPath), relativeToRepo(composeFile), relativeToRepo(envFile)]
  };
}

function runDockerCompose(input) {
  const { composeFile, envFile, workingDirectory } = resolveDeploymentPaths(input);
  const dockerArgs = [];
  if (input.deployment.docker_context) {
    dockerArgs.push("--context", input.deployment.docker_context);
  }
  dockerArgs.push("compose", "--env-file", envFile, "-f", composeFile, "up", "-d");
  return runCommand("docker", dockerArgs, { cwd: workingDirectory, timeoutMs: 900000 });
}

function runLiveUat(task, facts) {
  if (!facts.manualInputs) {
    return {
      status: "manual_blocker",
      reason: `Missing ${relativeToRepo(manualInputsLocalPath)}`,
      evidence: []
    };
  }
  const manualCheck = checkManualInputs();
  if (manualCheck.status !== "done") {
    return manualCheck;
  }
  const baseUrl = facts.manualInputs.staging.base_url;
  if (facts.manualInputs.deployment.auto_start) {
    const composeResult = runDockerCompose(facts.manualInputs);
    if (composeResult.status !== 0) {
      return {
        status: "manual_blocker",
        reason: composeResult.stderr.trim() || "Docker Compose failed to start the target stack",
        evidence: [relativeToRepo(manualInputsLocalPath)]
      };
    }
  }
  const healthCode = healthCheck(baseUrl);
  if (healthCode !== "200") {
    return {
      status: "manual_blocker",
      reason: `Staging health check returned ${healthCode} at ${baseUrl}/health`,
      evidence: [baseUrl]
    };
  }
  const sharedEnv = {
    BASE_URL: baseUrl,
    COMPOSE_FILE: facts.manualInputs.deployment.compose_file,
    ENV_FILE: facts.manualInputs.deployment.env_file
  };
  if (facts.manualInputs.staging.uat_user_email) {
    sharedEnv.UAT_USER_EMAIL = facts.manualInputs.staging.uat_user_email;
  }
  if (facts.manualInputs.staging.uat_user_password) {
    sharedEnv.UAT_USER_PASSWORD = facts.manualInputs.staging.uat_user_password;
  }
  if (facts.manualInputs.staging.drill_api_key) {
    sharedEnv.DRILL_API_KEY = facts.manualInputs.staging.drill_api_key;
  }
  const functional = runCommand("bash", ["tools/uat/run-live-functional.sh"], {
    cwd: repoRoot,
    env: sharedEnv,
    timeoutMs: 900000
  });
  if (functional.status !== 0) {
    return {
      status: "blocked",
      reason: functional.stderr.trim() || functional.stdout.trim() || "Live functional UAT failed",
      evidence: ["tools/uat/run-live-functional.sh"]
    };
  }
  const failureDrill = runCommand("bash", ["tools/uat/run-live-failure-drill.sh"], {
    cwd: repoRoot,
    env: sharedEnv,
    timeoutMs: 900000
  });
  if (failureDrill.status !== 0) {
    return {
      status: "blocked",
      reason: failureDrill.stderr.trim() || failureDrill.stdout.trim() || "Live failure drill failed",
      evidence: ["tools/uat/run-live-failure-drill.sh"]
    };
  }
  return {
    status: "done",
    evidence: ["tools/uat/run-live-functional.sh", "tools/uat/run-live-failure-drill.sh"]
  };
}

function renderReport(prd, facts) {
  const lines = [
    "# Codex Agent Loop Status",
    "",
    `- Generated at: ${nowIso()}`,
    `- Branch: ${facts.branch}`,
    `- Dirty workspace: ${facts.dirty ? "yes" : "no"}`,
    `- Mirror compare: ${facts.compare ? `${facts.compare.status} (ahead_by=${facts.compare.ahead_by}, behind_by=${facts.compare.behind_by})` : "unavailable"}`,
    `- Open PRs: ${facts.prs.length}`,
    `- Deployments: ${facts.deployments.length}`,
    `- Latest sync runs: ${facts.syncRuns.slice(0, 3).map((run) => `${run.databaseId}:${run.conclusion}`).join(", ") || "none"}`,
    "",
    "## Tasks",
    ""
  ];
  for (const task of prd.tasks) {
    lines.push(`- ${task.id} | ${task.status} | ${task.title}${task.reason ? ` | ${task.reason}` : ""}`);
  }
  const manualBlockers = prd.tasks.filter((task) => task.status === "manual_blocker");
  lines.push("", "## Manual Blockers", "");
  if (manualBlockers.length === 0) {
    lines.push("- none");
  } else {
    for (const task of manualBlockers) {
      lines.push(`- ${task.id}: ${task.reason}`);
    }
  }
  writeText(reportPath, `${lines.join("\n")}\n`);
  return {
    status: "done",
    evidence: [relativeToRepo(reportPath)]
  };
}

function executeHandler(task, worktreePath, facts) {
  switch (task.handler) {
    case "verify_control_plane":
      return checkControlPlaneFiles();
    case "verify_orchestrator":
      return verifyOrchestratorScript(worktreePath);
    case "verify_gate_workflow":
      return verifyGateWorkflow();
    case "verify_sync_workflow":
      return verifySyncWorkflow(facts);
    case "verify_release_baseline":
      return verifyReleaseBaseline(facts);
    case "check_manual_inputs":
      return checkManualInputs();
    case "run_live_uat":
      return runLiveUat(task, facts);
    case "generate_report":
      return renderReport(loadPrd(), facts);
    default:
      return {
        status: "blocked",
        reason: `Unknown handler ${task.handler}`,
        evidence: []
      };
  }
}

function executeRole(task, role, facts) {
  const attempt = task.attempts + 1;
  const worktreePath = createRoleWorktree(task.id, role, attempt);
  const startedAt = nowIso();
  const result = executeHandler(task, worktreePath, facts);
  const endedAt = nowIso();
  writeEnvelope({
    task_id: task.id,
    agent_role: role,
    tool_name: "node",
    args_summary: task.handler,
    worktree: relativeToRepo(worktreePath),
    started_at: startedAt,
    ended_at: endedAt,
    result: result.status === "done" ? "done" : result.status,
    evidence_paths: result.evidence ?? [],
    notes: result.reason ?? result.notes ?? ""
  });
  return result;
}

function runTask(task, facts) {
  task.attempts += 1;
  task.status = "in_progress";
  const specialistResult = executeRole(task, "specialist", facts);
  if (specialistResult.status !== "done") {
    return specialistResult;
  }
  task.status = "review";
  const validatorResult = executeRole(task, "validator", facts);
  if (validatorResult.status !== "done") {
    return validatorResult;
  }
  return {
    status: task.id === "REPORT-001" ? "done" : "done",
    evidence: [...(specialistResult.evidence ?? []), ...(validatorResult.evidence ?? [])]
  };
}

function nextReadyTask(prd) {
  return prd.tasks
    .filter((task) => task.status === "ready")
    .sort((left, right) => left.priority - right.priority)[0] ?? null;
}

function summarize(prd) {
  return prd.tasks.reduce((accumulator, task) => {
    accumulator[task.status] = (accumulator[task.status] ?? 0) + 1;
    return accumulator;
  }, {});
}

function allRemainingAreManual(prd) {
  return prd.tasks.every((task) => task.status === "done" || task.status === "manual_blocker");
}

function hasBlockedTasks(prd) {
  return prd.tasks.some((task) => task.status === "blocked");
}

function verifyControlPlane() {
  const missing = requiredControlFiles.filter((relativePath) => !fileExists(relativePath));
  if (missing.length > 0) {
    throw new Error(`Missing required files: ${missing.join(", ")}`);
  }
  readJson(prdPath);
  readJson(manualInputsSchemaPath);
  readJson(manualInputsExamplePath);
  runChecked("node", ["--check", "tools/agent-loop/orchestrate.mjs"], { cwd: repoRoot });
  return true;
}

function dispatchRelease(tag) {
  if (!tag) {
    throw new Error("release command requires --tag");
  }
  runChecked("gh", ["workflow", "run", "release.yml", "--repo", "lin-mouren/sub2api", "-f", `tag=${tag}`], { cwd: repoRoot });
  return tag;
}

function main() {
  ensureDirectories();
  const { command, options } = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  if (command === "verify") {
    verifyControlPlane();
    console.log("Codex control plane verified.");
    return;
  }
  if (command === "release") {
    const tag = dispatchRelease(options.tag);
    console.log(`Dispatched release workflow for ${tag}.`);
    return;
  }

  const prd = loadPrd();
  const facts = gatherFacts();
  propagateStatuses(prd);

  if (command === "plan") {
    savePrd(prd);
    console.log(JSON.stringify({ summary: summarize(prd), branch: facts.branch }, null, 2));
    return;
  }

  if (command === "report") {
    renderReport(prd, facts);
    console.log(relativeToRepo(reportPath));
    return;
  }

  if (command === "run") {
    while (true) {
      const loopFacts = gatherFacts();
      propagateStatuses(prd);
      const task = nextReadyTask(prd);
      if (!task) {
        break;
      }
      const result = runTask(task, loopFacts);
      setTaskResult(task, result);
      savePrd(prd);
      if (options.untilManual && allRemainingAreManual(prd)) {
        break;
      }
    }
    const finalFacts = gatherFacts();
    propagateStatuses(prd);
    renderReport(prd, finalFacts);
    savePrd(prd);
    if (hasBlockedTasks(prd)) {
      console.error("Agent loop finished with blocked tasks.");
      process.exit(1);
    }
    if (!allRemainingAreManual(prd) && prd.tasks.some((task) => task.status !== "done")) {
      console.error("Agent loop stopped before reaching only-manual blockers.");
      process.exit(1);
    }
    console.log(`Agent loop converged. Report: ${relativeToRepo(reportPath)}`);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main();
