import { readFileSync, realpathSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { installSkill } from "./install.ts";
import { loadPlanReference, savePlan } from "./plan.ts";
import { buildView, initialize, initialized, paths, recordDecision, updateReport, viewState, type EditableSection } from "./project.ts";
import { buildStartPrompt } from "./workflow.ts";
import { currentSummary, recordStep, workflowStatus } from "./session.ts";

const HELP = `사용법: assistant <명령> [프로젝트 경로] [옵션]

  start [경로] [--task 설명 | --task-file 파일] [-- Codex 옵션...]
      스킬·보고서를 준비하고 기존 Codex 화면에서 시작합니다.
  init [경로]     프로젝트에 assistant 스킬과 보고서를 준비합니다.
  status [경로]   보고서·모델·View·계획 경로를 JSON으로 출력합니다.
  report <절> [경로] --file 파일
      problem/options/design/verification/next 절을 갱신합니다.
  plan [경로] --file 파일      계획을 저장합니다. 승인을 뜻하지 않습니다.
  decision [경로] --file 파일  사용자 응답이 담긴 JSON을 기록합니다.
  view [경로]     LikeC4 검증 후 보고서·아키텍처 View를 생성합니다.
  step [경로] --file 파일      단계 결과·질문·실제 응답을 기록하고 요약을 반환합니다.
  summary [경로]              현재 단계 요약과 보고서 투영을 복구·표시합니다.

--file - 는 표준 입력을 읽습니다. start의 --print-prompt는 Codex 실행 없이
시작 프롬프트를 출력합니다. 모델·인증·권한 설정은 기존 Codex를 따릅니다.`;

function parse(args: string[]) {
  const separator = args.indexOf("--");
  const codexArgs = separator < 0 ? [] : args.slice(separator + 1);
  const local = separator < 0 ? args : args.slice(0, separator);
  const positional: string[] = [];
  const values: Record<string, string> = {};
  let printPrompt = false;
  for (let i = 0; i < local.length; i++) {
    const arg = local[i]!;
    if (arg === "--print-prompt") printPrompt = true;
    else if (["--task", "--task-file", "--file"].includes(arg)) {
      if (values[arg] !== undefined || local[i + 1] === undefined || local[i + 1]!.startsWith("--")) throw new Error(`옵션 값을 확인해 주세요: ${arg}`);
      values[arg] = local[++i]!;
    } else if (arg.startsWith("-")) throw new Error(`알 수 없는 옵션입니다: ${arg}. Codex 옵션 앞에는 -- 를 넣으세요.`);
    else positional.push(arg);
  }
  return { positional, values, printPrompt, codexArgs };
}

function readInput(file: string | undefined) {
  if (!file) throw new Error("--file로 입력 파일을 지정해 주세요. 표준 입력은 --file - 입니다.");
  return readFileSync(file === "-" ? 0 : resolve(file), "utf8");
}

function recordInput(cwd: string, content: string) {
  const input: unknown = JSON.parse(content);
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("결정 입력은 JSON 객체여야 합니다.");
  const data = input as Record<string, unknown>;
  const fields = ["topic", "selected", "rationale", "evidence"] as const;
  if (fields.some((key) => typeof data[key] !== "string" || !(data[key] as string).trim() || (data[key] as string).length > 2000)) throw new Error("topic/selected/rationale/evidence에 실제 사용자 응답과 비교 근거를 넣어 주세요.");
  if (!Array.isArray(data.options) || data.options.length < 2 || data.options.length > 3 || data.options.some((item) => typeof item !== "string" || !item.trim() || item.length > 300) || new Set(data.options).size !== data.options.length) throw new Error("서로 다른 대안 2~3개가 필요합니다.");
  recordDecision(cwd, data.topic as string, data.options as string[], data.selected as string, data.rationale as string, data.evidence as string);
}

async function main(args: string[]) {
  if (args.includes("--help") && !args.includes("--")) { console.log(HELP); return 0; }
  if (args.length === 1 && args[0] === "--version") { console.log("assistant 0.2.0"); return 0; }
  const command = args.shift() ?? "start";
  if (!["start", "init", "status", "report", "plan", "decision", "view", "step", "summary"].includes(command)) throw new Error(`알 수 없는 명령입니다: ${command}`);
  const section = command === "report" ? args.shift() : undefined;
  const options = parse(args);
  if (options.positional.length > 1) throw new Error("프로젝트 경로는 하나만 지정해 주세요.");
  if (options.values["--task"] !== undefined && options.values["--task-file"] !== undefined) throw new Error("--task와 --task-file 중 하나만 사용해 주세요.");
  if (command !== "start" && (options.printPrompt || options.codexArgs.length || options.values["--task"] !== undefined || options.values["--task-file"] !== undefined)) throw new Error("시작 옵션은 start에서만 사용할 수 있습니다.");
  const cwd = realpathSync(resolve(options.positional[0] ?? process.cwd()));
  if (!statSync(cwd).isDirectory()) throw new Error(`프로젝트 폴더가 아닙니다: ${cwd}`);
  if (command === "init" || command === "start") {
    if (options.values["--file"]) throw new Error("start/init에서는 --file을 사용할 수 없습니다.");
    const taskFile = options.values["--task-file"];
    if (taskFile !== undefined && !statSync(resolve(taskFile), { throwIfNoEntry: false })?.isFile()) throw new Error("시험문제 파일을 확인해 주세요.");
    const task = options.values["--task"] ?? (taskFile !== undefined ? `시험문제 파일 ${JSON.stringify(resolve(taskFile))}를 읽고 진행하세요.` : "");
    const codex = command === "start" && !options.printPrompt ? Bun.which("codex") : undefined;
    if (command === "start" && !options.printPrompt && !codex) throw new Error("Codex를 찾을 수 없습니다. 준비된 환경에서 codex가 실행되는지 확인해 주세요.");
    installSkill(cwd);
    initialize(cwd, task);
    if (command === "init") { console.log(`준비됨: ${paths(cwd).report}\nCodex 안에서 $assistant로 시작하세요.`); return 0; }
    const prompt = buildStartPrompt(cwd, task);
    if (options.printPrompt) { console.log(prompt); return 0; }
    const child = Bun.spawn([codex!, "--cd", cwd, ...options.codexArgs, prompt], { stdin: "inherit", stdout: "inherit", stderr: "inherit" });
    const interrupt = () => child.kill("SIGINT");
    const terminate = () => child.kill("SIGTERM");
    process.on("SIGINT", interrupt);
    process.on("SIGTERM", terminate);
    try { return await child.exited; }
    finally { process.off("SIGINT", interrupt); process.off("SIGTERM", terminate); }
  }
  if (command === "status") {
    if (options.values["--file"]) throw new Error("status에서는 --file을 사용할 수 없습니다.");
    console.log(JSON.stringify({ initialized: initialized(cwd), ...paths(cwd), viewState: initialized(cwd) ? viewState(cwd) : "missing", planReference: loadPlanReference(cwd)?.path ?? null, workflow: workflowStatus(cwd) }, null, 2));
    return 0;
  }
  if (!initialized(cwd)) throw new Error("먼저 assistant init으로 프로젝트를 준비해 주세요.");
  if (command === "step") console.log(JSON.stringify(recordStep(cwd, JSON.parse(readInput(options.values["--file"]))), null, 2));
  else if (command === "summary") {
    if (options.values["--file"]) throw new Error("summary에서는 --file을 사용할 수 없습니다.");
    console.log(currentSummary(cwd));
  } else if (command === "view") {
    if (options.values["--file"]) throw new Error("view에서는 --file을 사용할 수 없습니다.");
    console.log(await buildView(cwd));
  } else if (command === "plan") console.log(savePlan(cwd, readInput(options.values["--file"])));
  else if (command === "report") {
    if (!["problem", "options", "design", "verification", "next"].includes(section ?? "")) throw new Error("갱신할 보고서 절을 확인해 주세요. 선택 기록은 decision 명령을 사용합니다.");
    if (["problem", "verification", "next"].includes(section!) && workflowStatus(cwd).revision > 0) throw new Error("진행 중인 단계의 목표·검증·다음 쟁점은 step 명령으로 갱신하세요.");
    updateReport(cwd, section as EditableSection, readInput(options.values["--file"]));
    console.log(paths(cwd).report);
  } else if (command === "decision") {
    recordInput(cwd, readInput(options.values["--file"]));
    console.log(paths(cwd).report);
  }
  return 0;
}

try { process.exitCode = await main(process.argv.slice(2)); }
catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
