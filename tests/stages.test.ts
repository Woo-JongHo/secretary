import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { initialize, paths, recordDecision } from "../src/project.ts";
import { currentSummary, recordStep, workflowStatus } from "../src/session.ts";
import { readWorkflow } from "../src/stages.ts";
import type { StepInput } from "../src/conversation.ts";

const directories: string[] = [];
const workspace = () => {
  const cwd = realpathSync(mkdtempSync(join(tmpdir(), "assistant-stages-")));
  directories.push(cwd);
  initialize(cwd, "검사 입력: 프로젝트 구조 완성");
  writeFileSync(join(cwd, "design.md"), "# 구조 설계\n모듈 책임과 연결을 기록한다.");
  writeFileSync(join(cwd, "app.ts"), "export const ready = true;\n");
  return cwd;
};
afterEach(() => directories.splice(0).forEach((cwd) => rmSync(cwd, { recursive: true, force: true })));
const draft = (cwd: string, patch: Partial<StepInput> = {}): StepInput => {
  const state = readWorkflow(paths(cwd).root);
  return { id: `step-${state.revision + 1}`, expectedRevision: state.revision, stage: state.stage, status: "progress", summary: "검사 입력: 이번 단계의 결과를 기록했다.", facts: [{ statement: "테스트 파일을 준비했다.", source: "observed", evidence: "이 테스트의 실제 임시 파일" }], assumptions: [], unknowns: [], blockers: [], artifacts: [], checks: [], next: { kind: "act", text: "다음 작업을 수행한다." }, ...patch };
};
const clarify = (cwd: string) => recordStep(cwd, draft(cwd, { status: "complete", intent: { request: "구조를 완성해줘", goal: "각 모듈의 책임과 연결을 구현·검증한다.", userEvidence: "검사에서 주입한 사용자 문장", criteria: ["실제 모듈 연결과 검사가 통과한다."], components: ["대화", "단계", "보고서"], constraints: ["기존 데이터 보존"] } }));
const implement = (cwd: string) => {
  clarify(cwd);
  recordStep(cwd, draft(cwd, { status: "complete", artifacts: [{ label: "설계", path: "design.md" }] }));
  return recordStep(cwd, draft(cwd, { status: "complete", artifacts: [{ label: "구현", path: "app.ts" }] }));
};
const passed = [{ name: "연결 검사", status: "passed" as const, evidence: "단위 테스트의 주입된 검사 결과이며 실모델 검증이 아님" }];
const question = { id: "goal-question", type: "choice" as const, target: "goal" as const, text: "완성된 구조의 기준은 무엇인가요?", why: "목표가 정해져야 설계 범위를 잡을 수 있습니다.", options: ["폴더 정리", "실제 동작과 근거 연결 (추천)", "설치 자동화"], recommended: "실제 동작과 근거 연결 (추천)" };

test("대기 요약과 질문을 저장하고 실제 응답 없이는 진행하지 않는다", () => {
  const cwd = workspace();
  const result = recordStep(cwd, draft(cwd, { status: "waiting", next: { kind: "ask", question } }));
  expect(result.status).toBe("waiting");
  expect(result.question?.options?.[0]).toBe(question.recommended);
  expect(result.summary).toContain("사용자 응답 대기");
  expect(readFileSync(paths(cwd).reportPage, "utf8")).toContain("<table>");
  expect(() => recordStep(cwd, draft(cwd))).toThrow("실제 사용자 응답");
  expect(() => recordStep(cwd, draft(cwd, { answer: { questionId: question.id, value: "", evidence: "취소" } }))).toThrow();
  expect(workflowStatus(cwd).revision).toBe(1);
  expect(workflowStatus(cwd).stage).toBe("clarify");
});

test("사용자 응답을 근거와 함께 반영하고 결정 투영을 재시도해도 중복하지 않는다", () => {
  const cwd = workspace();
  recordDecision(cwd, "기존 결정", ["A", "B"], "A", "원래 근거", "테스트 주입 응답");
  recordStep(cwd, draft(cwd, { status: "waiting", next: { kind: "ask", question } }));
  const input = draft(cwd, { answer: { questionId: question.id, value: question.recommended, evidence: "검사에서 주입한 실제 선택 모양의 응답" } });
  const result = recordStep(cwd, input);
  expect(result.summary).toContain(question.recommended);
  const replay = recordStep(cwd, input);
  expect(replay.replayed).toBe(true);
  expect(replay.revision).toBe(2);
  recordDecision(cwd, "추가 별도 결정", ["C", "D"], "D", "추가 근거", "테스트 주입 응답");
  recordStep(cwd, draft(cwd));
  const report = readFileSync(paths(cwd).report, "utf8");
  expect(report).toContain("기존 결정");
  expect(report).toContain("추가 별도 결정");
  expect(report.match(/- 단계 기록 ID: step-2/g)).toHaveLength(1);
  expect(readWorkflow(paths(cwd).root).history[1]!.input.answer?.evidence).toContain("주입");
});

test("의도·성공 기준을 건너뛰거나 파일 선택 질문부터 할 수 없다", () => {
  const cwd = workspace();
  expect(() => recordStep(cwd, draft(cwd, { status: "complete" }))).toThrow("문제 정리에 필요한 정보");
  expect(() => recordStep(cwd, draft(cwd, { status: "waiting", next: { kind: "ask", question: { ...question, target: "tradeoff", text: "어느 파일부터 만들까요?" } } }))).toThrow("빈칸부터");
  expect(() => recordStep(cwd, draft(cwd, { stage: "implement" }))).toThrow("현재 단계");
  expect(workflowStatus(cwd).revision).toBe(0);
});

test("다섯 단계를 실제 산출물과 검사 근거로 진행하고 요약·보고서를 만든다", () => {
  const cwd = workspace();
  implement(cwd);
  recordStep(cwd, draft(cwd, { status: "complete", artifacts: [{ label: "검사 대상", path: "app.ts" }], checks: passed }));
  const result = recordStep(cwd, draft(cwd, { status: "complete", artifacts: [{ label: "보고서", path: ".assistant/report.md" }], next: { kind: "done", text: "검사 시나리오의 구조 연결이 끝났습니다." } }));
  expect(result.status).toBe("finished");
  expect(result.completedStages).toEqual(["clarify", "design", "implement", "verify", "close"]);
  expect(result.summary).toContain("마무리 · 단계 완료");
  expect(readFileSync(paths(cwd).summary, "utf8")).toBe(currentSummary(cwd));
  expect(readFileSync(paths(cwd).reportPage, "utf8")).toContain("현재 단계 요약");
  expect(readWorkflow(paths(cwd).root).history).toHaveLength(5);
});

test("실패·미실행 검사와 남은 블로커를 완료로 바꾸지 않는다", () => {
  const cwd = workspace();
  implement(cwd);
  for (const status of ["failed", "not_run"] as const) {
    expect(() => recordStep(cwd, draft(cwd, { status: "complete", artifacts: [{ label: "구현", path: "app.ts" }], checks: [{ name: "검사", status, evidence: "실패 또는 미실행" }] }))).toThrow("실패·미실행");
  }
  expect(() => recordStep(cwd, draft(cwd, { status: "complete", blockers: ["연결되지 않은 모듈"], artifacts: [{ label: "구현", path: "app.ts" }], checks: passed }))).toThrow();
  expect(workflowStatus(cwd).stage).toBe("verify");
});

test("이전 실패 검사를 누락한 완료와 마무리에서의 새 실패를 거부한다", () => {
  const cwd = workspace();
  implement(cwd);
  recordStep(cwd, draft(cwd, { checks: [{ name: "남은 실패", status: "failed", evidence: "검사에서 주입한 미해결 실패" }] }));
  expect(() => recordStep(cwd, draft(cwd, { status: "complete", artifacts: [{ label: "구현", path: "app.ts" }], checks: passed }))).toThrow("실패·미실행");
  recordStep(cwd, draft(cwd, { status: "complete", artifacts: [{ label: "구현", path: "app.ts" }], checks: [...passed, { name: "남은 실패", status: "passed", evidence: "같은 검사를 재실행한 검사 입력" }] }));
  expect(() => recordStep(cwd, draft(cwd, { status: "complete", artifacts: [{ label: "보고서", path: paths(cwd).report }], checks: [{ name: "새 실패", status: "failed", evidence: "마무리에서 발견" }], next: { kind: "done", text: "잘못된 완료" } }))).toThrow("실패·미실행");
});

test("마무리에서 파일 해시를 새로 기록해도 검증 기준을 갱신하지 않는다", () => {
  const cwd = workspace();
  implement(cwd);
  recordStep(cwd, draft(cwd, { status: "complete", artifacts: [{ label: "구현", path: "app.ts" }], checks: passed }));
  writeFileSync(join(cwd, "app.ts"), "export const unverified = true;\n");
  recordStep(cwd, draft(cwd, { artifacts: [{ label: "새 해시", path: "app.ts" }] }));
  expect(workflowStatus(cwd).freshness).toBe("stale");
  expect(() => recordStep(cwd, draft(cwd, { status: "complete", artifacts: [{ label: "보고서", path: paths(cwd).report }], next: { kind: "done", text: "검증 우회" } }))).toThrow("다시 검증");
});

test("검증 후 처음 등록하는 원본도 마무리 전에 검증해야 한다", () => {
  const cwd = workspace();
  implement(cwd);
  recordStep(cwd, draft(cwd, { status: "complete", artifacts: [{ label: "구현", path: "app.ts" }], checks: passed }));
  writeFileSync(join(cwd, "late.ts"), "export const late = true;\n");
  expect(() => recordStep(cwd, draft(cwd, { status: "complete", artifacts: [{ label: "늦은 원본", path: "late.ts" }], next: { kind: "done", text: "검증하지 않은 새 파일" } }))).toThrow("새 산출물도 먼저 검증");
  recordStep(cwd, draft(cwd, { artifacts: [{ label: "늦은 원본", path: "late.ts" }] }));
  expect(workflowStatus(cwd).freshness).toBe("stale");
});

test("목표 변경은 문제 정리로 돌아가고 이전 완료·성공 기준을 무효화한다", () => {
  const cwd = workspace();
  implement(cwd);
  expect(() => recordStep(cwd, draft(cwd, { intent: { goal: "전혀 다른 목표" } }))).toThrow("clarify");
  const reopened = recordStep(cwd, draft(cwd, { stage: "clarify", status: "reopen", reason: "테스트에 주입한 사용자의 범위 변경", intent: { goal: "다른 구조 목표" } }));
  expect(reopened.completedStages).toEqual([]);
  expect(reopened.intent.criteria).toEqual([]);
  expect(reopened.stage).toBe("clarify");
  expect(readWorkflow(paths(cwd).root).history).toHaveLength(4);
});

test("검증 후 파일이 바뀌면 마무리를 거부하고 재검증 후에만 완료한다", () => {
  const cwd = workspace();
  implement(cwd);
  recordStep(cwd, draft(cwd, { status: "complete", artifacts: [{ label: "구현", path: "app.ts" }], checks: passed }));
  writeFileSync(join(cwd, "app.ts"), "export const ready = 'changed';\n");
  expect(workflowStatus(cwd).freshness).toBe("stale");
  expect(() => recordStep(cwd, draft(cwd, { status: "complete", artifacts: [{ label: "보고서", path: ".assistant/report.md" }], next: { kind: "done", text: "완료 주장" } }))).toThrow("다시 검증");
  recordStep(cwd, draft(cwd, { stage: "verify", status: "reopen", reason: "구현 파일 변경으로 재검증" }));
  recordStep(cwd, draft(cwd, { status: "complete", artifacts: [{ label: "변경된 구현", path: "app.ts" }], checks: passed }));
  expect(recordStep(cwd, draft(cwd, { status: "complete", artifacts: [{ label: "보고서", path: ".assistant/report.md" }], next: { kind: "done", text: "재검증 후 완료" } })).status).toBe("finished");
  writeFileSync(join(cwd, "app.ts"), "export const changedAgain = true;\n");
  expect(currentSummary(cwd)).toContain("재검증 필요");
});

test("동일 ID의 다른 입력·낡은 revision·수정된 영수증은 거부한다", () => {
  const cwd = workspace();
  const input = draft(cwd, { intent: undefined });
  recordStep(cwd, input);
  expect(recordStep(cwd, input).replayed).toBe(true);
  expect(() => recordStep(cwd, { ...input, summary: "다른 내용" })).toThrow("같은 단계 ID");
  expect(() => recordStep(cwd, { ...input, id: "different" })).toThrow("revision");
  const path = join(paths(cwd).steps, "1.json");
  const altered = JSON.parse(readFileSync(path, "utf8"));
  altered.createdAt = "2026-01-01T00:00:00.000Z";
  writeFileSync(path, JSON.stringify(altered));
  expect(() => readWorkflow(paths(cwd).root)).toThrow("영수증 해시");
  expect(readFileSync(path, "utf8")).toContain("2026-01-01");
});

test("보고서 갱신 실패 뒤 동일 입력으로 복구해도 저장된 단계와 결정을 중복하지 않는다", () => {
  const cwd = workspace();
  const p = paths(cwd);
  const original = readFileSync(p.report, "utf8");
  writeFileSync(p.report, `${original}\n## 사용자의 추가 메모\n보존\n`);
  const input = draft(cwd);
  expect(() => recordStep(cwd, input)).toThrow("저장됐지만 보고서");
  expect(readWorkflow(p.root).revision).toBe(1);
  expect(readFileSync(p.report, "utf8")).toContain("사용자의 추가 메모");
  writeFileSync(p.report, original);
  expect(recordStep(cwd, input).replayed).toBe(true);
  expect(readWorkflow(p.root).revision).toBe(1);
  expect(readFileSync(p.reportPage, "utf8")).toContain("현재 단계 요약");
});

test("삭제 산출물을 명시적으로 기록하고 나중에 되살아나면 변경으로 감지한다", () => {
  const cwd = workspace();
  implement(cwd);
  rmSync(join(cwd, "app.ts"));
  recordStep(cwd, draft(cwd, { status: "complete", artifacts: [{ label: "제거한 구현", path: "app.ts", removed: true }], checks: passed }));
  expect(workflowStatus(cwd).staleArtifacts).toEqual([]);
  writeFileSync(join(cwd, "app.ts"), "restored");
  expect(workflowStatus(cwd).staleArtifacts).toContain(join(cwd, "app.ts"));
});

test("동시에 같은 revision을 쓰더라도 하나만 저장하고 임시 파일을 정본으로 읽지 않는다", async () => {
  const cwd = workspace();
  const run = async (id: string) => {
    const child = Bun.spawn([process.execPath, resolve("src/cli.ts"), "step", cwd, "--file", "-"], { stdin: new TextEncoder().encode(JSON.stringify(draft(cwd, { id, expectedRevision: 0 }))), stdout: "pipe", stderr: "pipe" });
    const [code] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
    return code;
  };
  const codes = await Promise.all([run("writer-a"), run("writer-b")]);
  expect(codes.sort()).toEqual([0, 1]);
  writeFileSync(join(paths(cwd).steps, ".draft-crashed.tmp"), "작성 도중 중단된 입력");
  expect(readWorkflow(paths(cwd).root).revision).toBe(1);
});
