import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createAgentSession, SessionManager, Settings } from "@oh-my-pi/pi-coding-agent";
import { buildView, initialized, paths, renderReport, viewState } from "../src/project.ts";

const cwd = mkdtempSync(join(tmpdir(), "secretary-smoke-"));
const { session } = await createAgentSession({
  cwd,
  agentDir: join(cwd, "omp-agent"),
  settings: Settings.isolated({}),
  sessionManager: SessionManager.inMemory(cwd),
  disableExtensionDiscovery: true,
  additionalExtensionPaths: [resolve(import.meta.dir, "..")],
  enableMCP: false,
  enableLsp: false,
});
try {
  const runner = session.extensionRunner;
  assert(runner, "OMP 확장 실행기가 없습니다.");
  const errors: string[] = [];
  runner.onError((error) => errors.push(error.error));
  assert(runner.getRegisteredCommands().some((command) => command.name === "secretary"));
  const tools = runner.getAllRegisteredTools().map((tool) => tool.definition.name);
  for (const name of ["secretary_report", "secretary_decide", "secretary_view"]) assert(tools.includes(name), `${name}을 OMP가 등록하지 않았습니다.`);
  await session.prompt("/secretary");
  assert.deepEqual(errors, [], `OMP 확장 오류: ${errors.join("; ")}`);
  assert(initialized(cwd), "OMP가 /secretary 명령을 수용하지 않았습니다.");
  const decision = runner.getRegisteredTool("secretary_decide")!.definition;
  const context = runner.createContext();
  const input = { topic: "수집 방식", options: ["기사 앱", "전용 단말"], rationale: "초기 검증 비용을 비교한다." };
  const original = readFileSync(paths(cwd).report, "utf8");
  await decision.execute("no-ui", input, undefined, undefined, context);
  assert.equal(readFileSync(paths(cwd).report, "utf8"), original);
  const uiContext = { ...context, hasUI: true, ui: { ...context.ui, select: async () => undefined } };
  await decision.execute("cancel", input, undefined, undefined, uiContext);
  assert.equal(readFileSync(paths(cwd).report, "utf8"), original);
  await decision.execute("selected", input, undefined, undefined, { ...uiContext, ui: { ...uiContext.ui, select: async () => "기사 앱" } });
  assert(readFileSync(paths(cwd).report, "utf8").includes("선택: 기사 앱"));
  const injected = await runner.emitBeforeAgentStart("다음 쟁점을 정리해 주세요.", undefined, ["기존 시스템 지시"]);
  assert(injected?.systemPrompt?.some((part) => part.includes("현재 프로젝트 보고서")), "OMP가 보고서 맥락을 수용하지 않았습니다.");
  await session.prompt("/secretary-view");
  assert.equal(viewState(cwd), "fresh");
  const p = paths(cwd);
  assert(readFileSync(p.reportPage, "utf8").includes("현재 모델과 일치"));
  writeFileSync(join(p.architecture, "additional.c4"), "model { extra = project '추가 초안' }");
  assert.equal(viewState(cwd), "stale");
  rmSync(join(p.architecture, "additional.c4"));
  rmSync(p.view, { recursive: true, force: true });
  writeFileSync(p.model, "문법이 잘못된 모델");
  await assert.rejects(buildView(cwd));
  assert.equal(viewState(cwd), "missing");
  await session.prompt("/secretary-view");
  assert(errors.length > 0, "실패 명령이 OMP 오류 경로로 전달되지 않았습니다.");
  writeFileSync(p.model, "specification { element project } model { project = project '다시 생성' } views { view overview { include * } }");
  await buildView(cwd);
  assert.equal(viewState(cwd), "fresh");
  writeFileSync(p.model, "다시 잘못된 모델");
  await assert.rejects(buildView(cwd));
  assert.equal(viewState(cwd), "stale");
  renderReport(cwd);
  assert(readFileSync(p.reportPage, "utf8").includes("오래됨"));
  console.log(JSON.stringify({ omp: "18.16.0", extensionAccepted: true, commandsAccepted: ["secretary", "secretary-view"], tools, reportContextAccepted: true, decisionBranches: ["no-ui unchanged", "cancel unchanged", "selected recorded"], architectureBuild: "passed", changedSource: "stale", failedBuild: "stale", deletedViewRecovery: "passed", modelApiCalled: false }, null, 2));
} finally {
  await session.dispose();
  rmSync(cwd, { recursive: true, force: true });
}
