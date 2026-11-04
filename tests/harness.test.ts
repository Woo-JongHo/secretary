import { afterEach, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { installSkill, SKILL_SOURCE } from "../src/install.ts";
import { loadPlanReference, savePlan } from "../src/plan.ts";
import { initialize, paths } from "../src/project.ts";
import { buildStartPrompt } from "../src/workflow.ts";

const directories: string[] = [];
const workspace = () => {
  const root = mkdtempSync(join(tmpdir(), "assistant-test-"));
  directories.push(root);
  return root;
};
afterEach(() => directories.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

test("프로젝트에 스킬을 반복 설치해도 사용자 규칙과 기존 보고서를 보존한다", () => {
  const cwd = workspace();
  writeFileSync(join(cwd, "AGENTS.md"), "사용자의 시험 규칙");
  const skill = installSkill(cwd);
  expect(realpathSync(skill)).toBe(SKILL_SOURCE);
  expect(installSkill(cwd)).toBe(skill);
  const p = initialize(cwd, "시험문제");
  const before = readFileSync(p.report, "utf8");
  initialize(cwd, "재시작 시 덮어쓰지 않는다");
  expect(readFileSync(p.report, "utf8")).toBe(before);
  expect(readFileSync(join(cwd, "AGENTS.md"), "utf8")).toBe("사용자의 시험 규칙");
  expect(p.root).toBe(join(cwd, ".assistant"));
});

test("같은 이름의 다른 스킬이나 외부 설치 디렉터리를 덮어쓰지 않는다", () => {
  const cwd = workspace();
  const destination = join(cwd, ".agents/skills/assistant");
  mkdirSync(destination, { recursive: true });
  writeFileSync(join(destination, "SKILL.md"), "다른 스킬");
  expect(() => installSkill(cwd)).toThrow("덮어쓰지");
  expect(readFileSync(join(destination, "SKILL.md"), "utf8")).toBe("다른 스킬");
  const another = workspace();
  symlinkSync(join(cwd, ".agents"), join(another, ".agents"));
  expect(() => installSkill(another)).toThrow("설치 경로");
});

test("기존 .secretary 프로젝트의 보고서와 계획 경로를 이어 쓴다", () => {
  const cwd = workspace();
  mkdirSync(join(cwd, ".secretary"));
  const p = initialize(cwd, "기존 과제");
  expect(p.root).toBe(join(cwd, ".secretary"));
  expect(loadPlanReference(cwd)).toBeUndefined();
  savePlan(cwd, "# 실행 계획\n\n기존 과제를 확인한다.");
  expect(loadPlanReference(cwd)?.content).toContain("기존 과제");
  expect(buildStartPrompt(cwd, "새 요청")).toContain(p.plan);
  expect(existsSync(join(cwd, ".assistant"))).toBe(false);
  expect(() => savePlan(cwd, " ")).toThrow();
  rmSync(p.plan);
  symlinkSync(join(cwd, "외부 계획"), p.plan);
  expect(() => savePlan(cwd, "덮어쓰지 않는다")).toThrow("심볼릭 링크");
});

test("CLI 시작은 경로와 과제를 셸 확장 없이 Codex에 전달한다", async () => {
  const root = workspace();
  const cwd = join(root, "exam space $(touch UNEXPECTED)");
  const bin = join(root, "bin");
  mkdirSync(cwd);
  mkdirSync(bin);
  const fakeCodex = join(bin, "codex");
  writeFileSync(fakeCodex, `#!${process.execPath}\nconsole.log(JSON.stringify(process.argv.slice(2)));\n`, { mode: 0o755 });
  const child = Bun.spawn([process.execPath, resolve("src/cli.ts"), "start", cwd, "--task", "요구사항 $(touch UNEXPECTED)", "--", "--model", "exam-model"], { cwd: root, env: { ...process.env, PATH: `${bin}:${process.env.PATH}` }, stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  expect(stderr).toBe("");
  expect(code).toBe(0);
  const args = JSON.parse(stdout) as string[];
  expect(args.slice(0, 4)).toEqual(["--cd", realpathSync(cwd), "--model", "exam-model"]);
  expect(args[4]).toContain("$assistant");
  expect(args[4]).toContain("요구사항 $(touch UNEXPECTED)");
  expect(existsSync(join(root, "UNEXPECTED"))).toBe(false);
});

test("CLI는 실제 사용자 응답 근거가 없는 결정을 기록하지 않는다", async () => {
  const cwd = workspace();
  const p = initialize(cwd, "선택 검증");
  const before = readFileSync(p.report, "utf8");
  const child = Bun.spawn([process.execPath, resolve("src/cli.ts"), "decision", cwd, "--file", "-"], { stdin: new TextEncoder().encode(JSON.stringify({ topic: "범위", options: ["A", "B"], selected: "A", rationale: "가볍다" })), stdout: "pipe", stderr: "pipe" });
  expect(await child.exited).toBe(1);
  expect(await new Response(child.stderr).text()).toContain("evidence");
  expect(readFileSync(p.report, "utf8")).toBe(before);
});

test("없는 시험문제 파일은 한국어 오류를 내고 프로젝트를 초기화하지 않는다", async () => {
  const cwd = workspace();
  const child = Bun.spawn([process.execPath, resolve("src/cli.ts"), "start", cwd, "--task-file", join(cwd, "missing.md")], { stdout: "pipe", stderr: "pipe" });
  expect(await child.exited).toBe(1);
  expect(await new Response(child.stderr).text()).toContain("시험문제 파일을 확인");
  expect(existsSync(join(cwd, ".assistant"))).toBe(false);
  expect(existsSync(join(cwd, ".agents"))).toBe(false);
});
