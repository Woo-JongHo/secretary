import { formatStepSummary, intentGaps, questionForHost } from "./conversation.ts";
import { initialized, paths, syncWorkflowReport } from "./project.ts";
import { changedArtifacts, commitStep, readWorkflow } from "./stages.ts";

export function workflowStatus(cwd: string) {
  const state = readWorkflow(paths(cwd).root);
  const latest = state.history.at(-1);
  const staleArtifacts = changedArtifacts(state);
  return { revision: state.revision, stage: state.stage, status: state.status, freshness: staleArtifacts.length ? "stale" : "current", intent: state.intent, intentGaps: intentGaps(state.intent), completedStages: state.completedStages, staleArtifacts, latestStepId: latest?.input.id ?? null, question: state.status === "waiting" && latest?.input.next.kind === "ask" ? questionForHost(latest.input.next.question) : null };
}

export function recordStep(cwd: string, input: unknown) {
  if (!initialized(cwd)) throw new Error("먼저 assistant init으로 프로젝트를 준비해 주세요.");
  const p = paths(cwd);
  const result = commitStep(p.root, input);
  try { syncWorkflowReport(cwd); }
  catch (error) { throw new Error(`단계 기록 #${result.entry.revision}은 저장됐지만 보고서 갱신이 실패했습니다. 같은 ID와 입력으로 재시도하면 중복 없이 복구합니다. ${error instanceof Error ? error.message : String(error)}`); }
  const state = readWorkflow(p.root);
  const latest = state.history.at(-1)!;
  return { ...workflowStatus(cwd), savedRevision: result.entry.revision, replayed: result.replayed, summary: formatStepSummary(latest, { report: p.report, view: p.reportPage, steps: p.steps }, changedArtifacts(state)), files: { steps: p.steps, summary: p.summary, report: p.report, view: p.reportPage } };
}

export function currentSummary(cwd: string) {
  const p = paths(cwd);
  const state = readWorkflow(p.root);
  const latest = state.history.at(-1);
  if (!latest) return "아직 기록된 단계가 없습니다. 먼저 사용자 의도와 성공 기준을 확인하세요.";
  syncWorkflowReport(cwd);
  return formatStepSummary(latest, { report: p.report, view: p.reportPage, steps: p.steps }, changedArtifacts(state));
}
