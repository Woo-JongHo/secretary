import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { readFileSync } from "node:fs";
import { buildView, initialize, initialized, paths, recordDecision, renderReport, updateReport } from "./project.ts";
import { WORKFLOW } from "./workflow.ts";

export default function secretary(pi: ExtensionAPI) {
  const z = pi.zod;
  const reportSchema = z.object({ section: z.enum(["problem", "options", "design", "verification", "next"]), content: z.string().min(1).max(6000) });
  const decisionSchema = z.object({ topic: z.string().min(1).max(300), options: z.array(z.string().min(1).max(300)).min(2).max(3), rationale: z.string().min(1).max(2000) });
  const text = (value: string) => ({ content: [{ type: "text" as const, text: value }], details: {} });
  const requireProject = (cwd: string) => {
    if (!initialized(cwd)) throw new Error("먼저 /secretary로 프로젝트를 준비해 주세요.");
  };

  pi.registerCommand("secretary", {
    description: "프로젝트 보고서와 아키텍처 초안을 준비합니다. /secretary <문제 설명>",
    handler: async (args, ctx) => {
      const p = initialize(ctx.cwd, args);
      ctx.ui.notify(`Secretary 준비됨: ${p.report}`, "info");
      if (args.trim()) pi.sendUserMessage(`Secretary 흐름으로 이 프로젝트를 시작합시다. 먼저 문제와 성공 기준을 정리해 주세요.\n${args}`);
    },
  });

  pi.registerCommand("secretary-view", {
    description: "현재 아키텍처를 검증하고 보고서·노드 View를 생성합니다.",
    handler: async (_args, ctx) => {
      requireProject(ctx.cwd);
      ctx.ui.notify(`View 생성됨: ${await buildView(ctx.cwd)}`, "info");
    },
  });

  pi.on("before_agent_start", (event, ctx) => {
    if (!initialized(ctx.cwd)) return;
    const report = readFileSync(paths(ctx.cwd).report, "utf8");
    return { systemPrompt: [...event.systemPrompt, WORKFLOW, `현재 프로젝트 보고서:\n${report}`] };
  });

  pi.registerTool({
    name: "secretary_report",
    label: "프로젝트 보고서 갱신",
    description: "PM 보고서의 한 절을 갱신합니다. 사용자 확정 결정 기록은 이 도구로 바꿀 수 없습니다.",
    parameters: reportSchema,
    approval: "write",
    async execute(_id, input, _signal, _update, ctx) {
      requireProject(ctx.cwd);
      const params = reportSchema.parse(input);
      updateReport(ctx.cwd, params.section, params.content);
      return text(`보고서와 읽기 페이지를 갱신했습니다: ${paths(ctx.cwd).report}`);
    },
  });

  pi.registerTool({
    name: "secretary_decide",
    label: "사용자에게 결정 요청",
    description: "하나의 쟁점에 대안 2~3개와 비교 근거를 제시합니다. 실제 사용자 선택을 보고서에 기록합니다.",
    parameters: decisionSchema,
    approval: "write",
    async execute(_id, input, _signal, _update, ctx) {
      requireProject(ctx.cwd);
      const params = decisionSchema.parse(input);
      if (!ctx.hasUI) return text("사용자 선택 UI가 없습니다. 아직 결정하지 않았습니다. 대안과 비교 근거를 사용자에게 제시해 주세요.");
      if (new Set(params.options).size !== params.options.length) throw new Error("대안은 서로 달라야 합니다.");
      const selected = await ctx.ui.select(`${params.topic}\n\n${params.rationale}`, params.options);
      if (!selected) return text("사용자가 선택을 취소했습니다. 확정 결정은 기록하지 않았습니다.");
      recordDecision(ctx.cwd, params.topic, params.options, selected, params.rationale);
      return text(`사용자 확정 선택: ${selected}`);
    },
  });

  pi.registerTool({
    name: "secretary_view",
    label: "아키텍처 View 생성",
    description: "현재 LikeC4 모델을 검증한 후 아키텍처 View와 PM 보고서 페이지를 생성합니다.",
    parameters: z.object({}),
    approval: "exec",
    async execute(_id, _params, signal, _update, ctx) {
      requireProject(ctx.cwd);
      return text(`View 생성됨: ${await buildView(ctx.cwd, signal)}`);
    },
  });

  pi.on("agent_end", (_event, ctx) => {
    if (initialized(ctx.cwd)) renderReport(ctx.cwd);
  });
}
