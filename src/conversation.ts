// Adapted from Gajae-Code v0.15.3 workflow-intent-report(-schema).ts and
// deep-interview's question/progress contract (MIT). See third_party/gajae-code/.
// Modified: evidence-backed claims, qualitative gaps, one question, project stages.
import { z } from "zod";

export const STAGES = ["clarify", "design", "implement", "verify", "close"] as const;
export const STAGE_LABELS = { clarify: "문제 정리", design: "설계", implement: "구현", verify: "검증", close: "마무리" } as const;
const text = z.string().trim().min(1).max(2000);
const texts = z.array(text).max(30);
export const StageSchema = z.enum(STAGES);
export const IntentSchema = z.object({ request: z.string().max(6000), goal: z.string().max(2000), userEvidence: z.string().max(2000), criteria: texts, components: texts, constraints: texts });
const ClaimSchema = z.object({ statement: text, source: z.enum(["user", "observed"]), evidence: text }).strict();
const TargetSchema = z.enum(["goal", "criteria", "scope", "constraints", "tradeoff", "context"]);
const ChoiceQuestionSchema = z.object({ id: text, type: z.literal("choice"), target: TargetSchema, text, why: text, options: z.array(text).min(2).max(3), recommended: text }).strict().refine((q) => new Set(q.options).size === q.options.length && q.options.includes(q.recommended), "선택지는 서로 달라야 하고 추천은 선택지 중 하나여야 합니다.");
const TextQuestionSchema = z.object({ id: text, type: z.literal("text"), target: TargetSchema, text, why: text }).strict();
export const QuestionSchema = z.union([ChoiceQuestionSchema, TextQuestionSchema]);
const NextSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("act"), text }).strict(),
  z.object({ kind: z.literal("ask"), question: QuestionSchema }).strict(),
  z.object({ kind: z.literal("done"), text }).strict(),
]);
export const StepSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/),
  expectedRevision: z.number().int().nonnegative(),
  stage: StageSchema,
  status: z.enum(["progress", "waiting", "complete", "blocked", "reopen"]),
  summary: text,
  facts: z.array(ClaimSchema).max(30),
  assumptions: texts,
  unknowns: texts,
  blockers: texts,
  artifacts: z.array(z.object({ label: text, path: text, removed: z.boolean().optional() }).strict()).max(30),
  checks: z.array(z.object({ name: text, status: z.enum(["passed", "failed", "not_run"]), evidence: text }).strict()).max(30),
  next: NextSchema,
  intent: IntentSchema.partial().strict().optional(),
  answer: z.object({ questionId: text, value: text, evidence: text, custom: z.boolean().optional() }).strict().optional(),
  reason: text.optional(),
}).strict().superRefine((step, ctx) => {
  const fail = (message: string) => ctx.addIssue({ code: "custom", message });
  if (step.status === "waiting" && step.next.kind !== "ask") fail("응답 대기에는 선택 도구로 전달할 질문 하나가 필요합니다.");
  if (step.status !== "waiting" && step.next.kind === "ask") fail("사용자 응답이 필요하면 상태를 waiting으로 기록하세요.");
  if (step.status === "blocked" && !step.blockers.length) fail("중단 원인을 blockers에 기록하세요.");
  if (step.status === "complete" && step.blockers.length) fail("해결되지 않은 쟁점이 있으면 단계를 완료할 수 없습니다.");
  if (step.status === "reopen" && !step.reason) fail("단계를 다시 열려면 이유가 필요합니다.");
  if (step.next.kind === "done" && !(step.stage === "close" && step.status === "complete")) fail("전체 완료는 마무리 단계가 끝날 때만 기록할 수 있습니다.");
  if (step.stage === "close" && step.status === "complete" && step.next.kind !== "done") fail("마무리 완료에는 done 결과가 필요합니다.");
});
export type Stage = z.infer<typeof StageSchema>;
export type Intent = z.infer<typeof IntentSchema>;
export type StepInput = z.infer<typeof StepSchema>;
export type Question = z.infer<typeof QuestionSchema>;

const SnapshotSchema = z.object({ label: text, path: text, mode: z.enum(["source", "projection", "removed"]), sha256: z.string().regex(/^[a-f0-9]{64}$/).nullable() }).strict().refine((item) => (item.mode === "source") === (item.sha256 !== null), "원본 산출물에만 파일 해시가 필요합니다.");
export const EntrySchema = z.object({
  input: StepSchema, inputHash: z.string().regex(/^[a-f0-9]{64}$/), revision: z.number().int().positive(),
  receiptHash: z.string().regex(/^[a-f0-9]{64}$/),
  createdAt: z.string().datetime(), snapshots: z.array(SnapshotSchema), resultingStage: StageSchema,
  resultingStatus: z.enum(["active", "waiting", "blocked", "finished"]), generation: z.number().int().nonnegative(),
}).strict();
export type StepEntry = z.infer<typeof EntrySchema>;
export const StateSchema = z.object({
  version: z.literal(1), revision: z.number().int().nonnegative(), stage: StageSchema,
  status: z.enum(["active", "waiting", "blocked", "finished"]), generation: z.number().int().nonnegative(),
  intent: IntentSchema, completedStages: z.array(StageSchema), history: z.array(EntrySchema),
}).strict();
export type WorkflowState = z.infer<typeof StateSchema>;

export function intentGaps(intent: Intent): string[] {
  return [!intent.request.trim() && "원래 요청", !intent.goal.trim() && "목표", !intent.userEvidence.trim() && "사용자 의도 근거", !intent.criteria.length && "성공 기준", !intent.components.length && "범위·구성 요소"].filter((item): item is string => Boolean(item));
}

const line = (value: string) => {
  const normalized = value.replace(/[\r\n]+/g, " ").replaceAll("|", "\\|");
  return normalized.length > 500 ? `${normalized.slice(0, 500)}… (전체는 단계 원문)` : normalized;
};
const rows = (values: string[]) => values.length ? [...values.slice(0, 5).map(line), ...(values.length > 5 ? [`외 ${values.length - 5}건 — 단계 원문 참조`] : [])].join(" / ") : "없음";
const STATUS_LABELS = { progress: "진행 중", waiting: "사용자 응답 대기", complete: "단계 완료", blocked: "진행 불가", reopen: "다시 정리" } as const;

export function formatStepSummary(entry: StepEntry, links: { report: string; view: string; steps: string }, stale: string[] = []) {
  const step = entry.input;
  const selected = step.answer ? `\n**사용자 응답:** ${line(step.answer.value)} — 근거: ${line(step.answer.evidence)}\n` : "";
  const next = step.next.kind === "ask" ? step.next.question.why : step.next.text;
  const table = [
    "| 구분 | 이번 단계의 내용 |", "| --- | --- |",
    `| 확인된 것 | ${rows(step.facts.map((fact) => `${fact.statement} (${fact.source === "user" ? "사용자" : "확인"}: ${fact.evidence})`))} |`,
    `| 작업 가정 | ${rows(step.assumptions)} |`,
    `| 미확인·남은 쟁점 | ${rows([...step.unknowns, ...step.blockers])} |`,
    `| 검증 | ${rows(step.checks.map((check) => `${check.name}: ${{ passed: "통과", failed: "실패", not_run: "미실행" }[check.status]} — ${check.evidence}`))} |`,
    `| 산출물 | ${rows(entry.snapshots.map((item) => `${item.label}: ${item.path}`))} |`,
  ].join("\n");
  return [
    `### ${STAGE_LABELS[step.stage]} · ${stale.length ? "재검증 필요" : STATUS_LABELS[step.status]} (#${entry.revision})`,
    line(step.summary), selected, table,
    stale.length ? `\n**재확인 필요:** ${rows(stale)}. 저장 후 변경되어 이전 검증 결과를 그대로 사용할 수 없습니다.` : "",
    `\n**다음:** ${line(next)}`,
    `**현재 상태:** ${STAGE_LABELS[entry.resultingStage]} · ${stale.length ? "산출물 변경 — 재검증 필요" : { active: "진행 가능", waiting: "응답 대기", blocked: "문제 해결 필요", finished: "완료" }[entry.resultingStatus]}`,
    `[프로젝트 보고서](<${links.report}>) · [보고서·View](<${links.view}>)`,
    `[단계 원문](<${links.steps}/${entry.revision}.json>)`,
  ].filter(Boolean).join("\n\n");
}

export function questionForHost(question: Question) {
  return { title: `${question.why}\n\n${question.text}`, ...(question.type === "choice" ? { options: [question.recommended, ...question.options.filter((option) => option !== question.recommended)] } : {}) };
}
