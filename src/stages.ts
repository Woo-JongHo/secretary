// Gajae-Code v0.15.3's initial-phase and evidence/report contracts, adapted to
// one project lifecycle with revisioned checkpoints. MIT: third_party/gajae-code/.
import { createHash } from "node:crypto";
import { closeSync, existsSync, fsyncSync, linkSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { EntrySchema, STAGES, StateSchema, StepSchema, intentGaps, type StepEntry, type StepInput, type WorkflowState } from "./conversation.ts";

const digest = (text: string | Buffer) => createHash("sha256").update(text).digest("hex");
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}

function emptyState(): WorkflowState {
  return { version: 1, revision: 0, stage: "clarify", status: "active", generation: 0, intent: { request: "", goal: "", userEvidence: "", criteria: [], components: [], constraints: [] }, completedStages: [], history: [] };
}

function safePath(root: string, name: string) {
  const path = join(root, name);
  if (lstatSync(root, { throwIfNoEntry: false })?.isSymbolicLink() || lstatSync(path, { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error(`심볼릭 링크 경로에는 단계 상태를 기록하지 않습니다: ${path}`);
  return path;
}

export function readWorkflow(root: string): WorkflowState {
  const directory = safePath(root, "steps");
  if (!existsSync(directory)) return emptyState();
  const names = readdirSync(directory);
  if (names.some((name) => name.endsWith(".json") && !/^[1-9]\d*\.json$/.test(name))) throw new Error("단계 기록 파일 이름을 확인해 주세요. 원문은 보존합니다.");
  const files = names.filter((name) => /^[1-9]\d*\.json$/.test(name)).sort((a, b) => Number(a.slice(0, -5)) - Number(b.slice(0, -5)));
  let state = emptyState();
  for (const [index, name] of files.entries()) {
    if (Number(name.slice(0, -5)) !== index + 1) throw new Error("단계 이력에 빠진 번호가 있습니다. 원문을 보존하고 확인하세요.");
    const path = safePath(directory, name);
    let entry: StepEntry;
    try { entry = EntrySchema.parse(JSON.parse(readFileSync(path, "utf8"))); }
    catch { throw new Error(`단계 기록을 읽을 수 없습니다. 원문을 보존하세요: ${path}`); }
    if (state.history.some((previous) => previous.input.id === entry.input.id) || entry.inputHash !== digest(canonicalJson(entry.input))) throw new Error("단계 이력의 ID 또는 입력 해시가 일치하지 않습니다.");
    const { receiptHash, ...body } = entry;
    if (receiptHash !== digest(canonicalJson(body))) throw new Error("단계 기록의 영수증 해시가 일치하지 않습니다.");
    const next = transition(state, entry.input, entry.snapshots, entry.createdAt, true);
    if (canonicalJson(next.history.at(-1)) !== canonicalJson(entry)) throw new Error("단계 전환과 저장된 결과가 일치하지 않습니다.");
    state = next;
  }
  return StateSchema.parse(state);
}

function snapshot(root: string, artifact: StepInput["artifacts"][number]) {
  root = realpathSync(root);
  const project = realpathSync(dirname(root));
  const path = resolve(project, artifact.path);
  if (!path.startsWith(`${project}${sep}`) || path.startsWith(`${join(root, "steps")}${sep}`) || path === join(root, "steps")) throw new Error("단계 기록 자체나 프로젝트 밖 경로를 산출물로 등록할 수 없습니다.");
  if (artifact.removed) {
    if (lstatSync(path, { throwIfNoEntry: false })) throw new Error(`삭제됐다고 기록한 산출물이 아직 있습니다: ${path}`);
    return { label: artifact.label, path, mode: "removed" as const, sha256: null };
  }
  const real = realpathSync(path);
  if (!real.startsWith(`${project}${sep}`) || lstatSync(path).isSymbolicLink() || !statSync(real).isFile()) throw new Error(`산출물은 프로젝트 안의 실제 파일이어야 합니다: ${artifact.path}`);
  const projection = path === join(root, "report.md") || path === join(root, "summary.md") || path.startsWith(`${join(root, "view")}${sep}`);
  return { label: artifact.label, path: real, mode: projection ? "projection" as const : "source" as const, sha256: projection ? null : digest(readFileSync(real)) };
}

export function activeEntries(state: WorkflowState): StepEntry[] {
  let active: StepEntry[] = [];
  for (const entry of state.history) {
    if (entry.input.status === "reopen") active = active.filter((previous) => STAGES.indexOf(previous.input.stage) < STAGES.indexOf(entry.input.stage));
    active.push(entry);
  }
  return active;
}

function artifactMap(entries: StepEntry[]) {
  const latest = new Map<string, StepEntry["snapshots"][number]>();
  for (const entry of entries) for (const artifact of entry.snapshots) latest.set(artifact.path, artifact);
  return latest;
}

function verificationBaseline(state: WorkflowState) {
  const active = activeEntries(state);
  const verified = active.filter((entry) => entry.input.stage === "verify" && entry.input.status === "complete").at(-1);
  return verified ? artifactMap(active.filter((entry) => entry.revision <= verified.revision)) : null;
}

function fileDrift(artifacts: ReturnType<typeof artifactMap>): string[] {
  return [...artifacts.values()].filter((artifact) => {
    if (artifact.mode === "projection") return false;
    if (artifact.mode === "removed") return Boolean(lstatSync(artifact.path, { throwIfNoEntry: false }));
    try { return lstatSync(artifact.path).isSymbolicLink() || digest(readFileSync(artifact.path)) !== artifact.sha256; }
    catch { return true; }
  }).map((artifact) => artifact.path);
}

export function changedArtifacts(state: WorkflowState): string[] {
  const latest = artifactMap(activeEntries(state));
  const baseline = verificationBaseline(state);
  const unverified = baseline ? [...latest.values()].filter((item) => item.mode !== "projection" && !baseline.has(item.path)).map((item) => item.path) : [];
  return [...new Set([...fileDrift(latest), ...(baseline ? fileDrift(baseline) : []), ...unverified])];
}

function validateAnswer(state: WorkflowState, step: StepInput) {
  const pending = state.history.at(-1)?.input.next;
  if (state.status === "waiting" && step.status !== "reopen") {
    if (pending?.kind !== "ask" || !step.answer || step.answer.questionId !== pending.question.id) throw new Error("보류 중인 질문의 실제 사용자 응답이 필요합니다. 취소·미응답으로 진행할 수 없습니다.");
    if (pending.question.type === "choice" && !pending.question.options.includes(step.answer.value) && !step.answer.custom) throw new Error("선택지에 없는 응답은 custom: true와 실제 응답 근거가 필요합니다.");
  } else if (step.answer) throw new Error("응답 대기 중인 질문이 없습니다.");
}

function transition(state: WorkflowState, step: StepInput, snapshots: StepEntry["snapshots"], createdAt = new Date().toISOString(), replay = false): WorkflowState {
  if (step.expectedRevision !== state.revision) throw new Error(`단계 상태가 바뀌었습니다. status를 다시 읽으세요. 현재 revision: ${state.revision}`);
  const reopen = step.status === "reopen";
  if (reopen) {
    if (STAGES.indexOf(step.stage) > STAGES.indexOf(state.stage)) throw new Error("다시 열기로 단계를 건너뛸 수 없습니다.");
  } else if (state.status === "finished" || step.stage !== state.stage) throw new Error(`현재 단계는 ${state.stage}입니다. 변경은 이유를 기록하고 reopen하세요.`);
  validateAnswer(state, step);
  if (step.intent && state.stage !== "clarify" && !(reopen && step.stage === "clarify")) throw new Error("목표·성공 기준·범위 변경은 clarify 단계를 다시 열어 기록하세요.");
  const intent = { ...state.intent, ...step.intent };
  if (reopen && step.stage === "clarify" && step.intent && step.intent.criteria === undefined) intent.criteria = [];
  if (step.stage === "clarify" && step.next.kind === "ask") {
    const targets = [!intent.goal.trim() && "goal", !intent.criteria.length && "criteria", !intent.components.length && "scope"].filter(Boolean);
    if (targets.length && !targets.includes(step.next.question.target)) throw new Error("의도·성공 기준·범위의 빈칸부터 확인하세요. 파일 종류나 구현 순서로 먼저 넘어갈 수 없습니다.");
  }
  const completedStages = reopen ? state.completedStages.filter((stage) => STAGES.indexOf(stage) < STAGES.indexOf(step.stage)) : [...state.completedStages];
  if (step.status === "complete") {
    if (step.stage === "clarify" && intentGaps(intent).length) throw new Error(`문제 정리에 필요한 정보: ${intentGaps(intent).join(", ")}`);
    if (step.stage !== "clarify" && !snapshots.length) throw new Error("단계를 완료하려면 실제 산출물 파일이 필요합니다.");
    const checks = new Map(activeEntries(state).flatMap((entry) => entry.input.checks.map((check) => [check.name, check.status] as const)));
    for (const check of step.checks) checks.set(check.name, check.status);
    if ((step.stage === "verify" && !step.checks.length) || ((step.stage === "verify" || step.stage === "close") && [...checks.values()].some((status) => status !== "passed"))) throw new Error("실패·미실행 검사가 있으면 검증을 완료할 수 없습니다.");
    if (!replay && (step.stage === "verify" || step.stage === "close") && changedArtifacts(state).some((path) => step.stage !== "verify" || !snapshots.some((item) => item.path === path && item.mode !== "projection"))) throw new Error("저장 이후 변경된 산출물이 있습니다. 변경을 기록하고 다시 검증하세요.");
    if (step.stage === "close") {
      const verified = verificationBaseline(state);
      if (snapshots.some((item) => item.mode !== "projection" && (verified?.get(item.path)?.mode !== item.mode || verified?.get(item.path)?.sha256 !== item.sha256))) throw new Error("마무리에 등록한 새 산출물도 먼저 검증해야 합니다. verify를 다시 열어 기록하세요.");
    }
    completedStages.push(step.stage);
  }
  const stage = step.status === "complete" && step.stage !== "close" ? STAGES[STAGES.indexOf(step.stage) + 1]! : step.stage;
  const status = step.status === "waiting" ? "waiting" : step.status === "blocked" ? "blocked" : step.stage === "close" && step.status === "complete" ? "finished" : "active";
  const generation = state.generation + (reopen ? 1 : 0);
  const body = { input: step, inputHash: digest(canonicalJson(step)), revision: state.revision + 1, createdAt, snapshots, resultingStage: stage, resultingStatus: status, generation };
  const entry = EntrySchema.parse({ ...body, receiptHash: digest(canonicalJson(body)) });
  return { version: 1, revision: entry.revision, stage, status, generation, intent, completedStages, history: [...state.history, entry] };
}

// Publish a fully-written immutable record with an exclusive hard link. Concurrent
// writers contend for one revision filename; a crashed writer leaves only a temp
// file, so no stale lock can block resume or accidentally erase a live lock.
export function commitStep(root: string, value: unknown): { state: WorkflowState; entry: StepEntry; replayed: boolean } {
  const step = StepSchema.parse(value);
  const state = readWorkflow(root);
  const previous = state.history.find((entry) => entry.input.id === step.id);
  if (previous) {
    if (previous.inputHash !== digest(canonicalJson(step))) throw new Error("같은 단계 ID에 다른 입력을 기록할 수 없습니다.");
    return { state, entry: previous, replayed: true };
  }
  const snapshots = step.artifacts.map((artifact) => snapshot(root, artifact));
  const next = transition(state, step, snapshots);
  const entry = next.history.at(-1)!;
  const directory = safePath(root, "steps");
  mkdirSync(directory, { recursive: true });
  const temporary = join(directory, `.draft-${crypto.randomUUID()}.tmp`);
  const destination = safePath(directory, `${entry.revision}.json`);
  const fd = openSync(temporary, "wx");
  try { writeFileSync(fd, JSON.stringify(entry, null, 2)); fsyncSync(fd); }
  finally { closeSync(fd); }
  try {
    try { linkSync(temporary, destination); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const concurrent = readWorkflow(root);
      const same = concurrent.history.find((item) => item.input.id === step.id);
      if (same?.inputHash === entry.inputHash) return { state: concurrent, entry: same, replayed: true };
      throw new Error(`다른 기록이 먼저 저장됐습니다. status를 다시 읽으세요. 현재 revision: ${concurrent.revision}`);
    }
    return { state: next, entry, replayed: false };
  } finally { rmSync(temporary, { force: true }); }
}
