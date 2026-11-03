import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import MarkdownIt from "markdown-it";

export const SECTIONS = {
  problem: "문제·성공 기준",
  options: "대안·추천 이유",
  decisions: "선택·기각 기록",
  design: "현재 설계·View",
  verification: "확인 결과",
  next: "다음 쟁점",
} as const;
export type Section = keyof typeof SECTIONS;
export type EditableSection = Exclude<Section, "decisions">;
export type ViewState = "missing" | "fresh" | "stale";

const MAX_REPORT = 32_000;
const PACKAGE_ROOT = resolve(import.meta.dir, "..");
const markdown = new MarkdownIt({ html: false });
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const hash = (text: string) => createHash("sha256").update(text).digest("hex");

export function paths(cwd: string) {
  const root = join(resolve(cwd), ".secretary");
  const values = { root, report: join(root, "report.md"), architecture: join(root, "architecture"), model: join(root, "architecture", "model.c4"), view: join(root, "view"), reportPage: join(root, "view", "index.html"), diagram: join(root, "view", "architecture"), receipt: join(root, "view", "receipt.json"), failure: join(root, "view", "build-failed") };
  for (const target of Object.values(values)) {
    if (lstatSync(target, { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error(`심볼릭 링크 경로에는 기록하지 않습니다: ${target}`);
  }
  return values;
}

export function initialized(cwd: string) {
  return existsSync(paths(cwd).report);
}

export function initialize(cwd: string, problem: string) {
  if (problem.length > 6000) throw new Error("초기 문제 설명은 6000자 이내로 정리해 주세요.");
  const p = paths(cwd);
  mkdirSync(p.architecture, { recursive: true });
  if (!existsSync(p.report)) {
    const sections = Object.entries(SECTIONS).map(([key, label]) => `## ${label}\n\n${key === "problem" && problem.trim() ? problem.trim().replace(/^## /gm, "### ") : "아직 정하지 않았습니다."}\n`);
    writeFileSync(p.report, `# 프로젝트 보고서\n\n${sections.join("\n")}`, { flag: "wx" });
  }
  if (!existsSync(p.model)) {
    const title = JSON.stringify(basename(resolve(cwd)));
    writeFileSync(p.model, `specification {\n  element project\n}\nmodel {\n  project = project ${title} {\n    description '초기 초안입니다. 세부 구성 요소는 아직 정하지 않았습니다.'\n  }\n}\nviews {\n  view overview {\n    title '프로젝트 구조 — 초안'\n    include *\n  }\n}\n`, { flag: "wx" });
  }
  renderReport(cwd);
  return p;
}

function readSections(cwd: string): Record<Section, string> {
  const report = readFileSync(paths(cwd).report, "utf8");
  if (report.length > MAX_REPORT) throw new Error("보고서가 너무 깁니다. 현재 보고서와 상세 근거를 나눠 주세요.");
  if (JSON.stringify(report.match(/^## .+$/gm)) !== JSON.stringify(Object.values(SECTIONS).map((label) => `## ${label}`))) throw new Error("보고서 절 구성이 바뀌었습니다. 원문을 보존한 채 공통 양식을 먼저 확인해 주세요.");
  const result = {} as Record<Section, string>;
  for (const [key, label] of Object.entries(SECTIONS)) {
    const marker = `## ${label}\n`;
    const start = report.indexOf(marker);
    if (start < 0 || report.indexOf(marker, start + marker.length) >= 0) throw new Error(`보고서 절을 확인할 수 없습니다: ${label}`);
    const end = report.indexOf("\n## ", start + marker.length);
    result[key as Section] = report.slice(start + marker.length, end < 0 ? undefined : end).trim();
  }
  return result;
}

function saveSections(cwd: string, sections: Record<Section, string>) {
  const report = `# 프로젝트 보고서\n\n${Object.entries(SECTIONS).map(([key, label]) => `## ${label}\n\n${sections[key as Section]}\n`).join("\n")}`;
  if (report.length > MAX_REPORT) throw new Error("보고서가 너무 깁니다. 상세 근거는 별도 문서로 연결해 주세요.");
  const p = paths(cwd);
  const temporary = `${p.report}.${crypto.randomUUID()}.tmp`;
  writeFileSync(temporary, report, { flag: "wx" });
  renameSync(temporary, p.report);
  renderReport(cwd);
}

export function updateReport(cwd: string, section: EditableSection, content: string) {
  if (!(section in SECTIONS) || (section as string) === "decisions") throw new Error("선택 기록은 사용자 결정 도구로만 추가합니다.");
  if (!content.trim() || /^## /m.test(content)) throw new Error("내용이 비어 있거나 보고서의 최상위 절 제목이 포함돼 있습니다.");
  const sections = readSections(cwd);
  sections[section] = content.trim();
  saveSections(cwd, sections);
}

export function recordDecision(cwd: string, topic: string, options: string[], selected: string, rationale: string) {
  if (!options.includes(selected)) throw new Error("실제 선택지에 없는 값은 결정으로 기록하지 않습니다.");
  const sections = readSections(cwd);
  const previous = sections.decisions === "아직 정하지 않았습니다." ? "" : `${sections.decisions}\n\n`;
  const clean = (value: string) => value.replace(/\r?\n/g, " ").trim();
  sections.decisions = `${previous}### ${clean(topic)}\n\n- 상태: 사용자 확정\n- 선택: ${clean(selected)}\n- 다른 대안: ${options.filter((option) => option !== selected).map(clean).join(" / ")}\n- 제안 시 비교 근거: ${clean(rationale)}\n- 기록 시각: ${new Date().toISOString()}`;
  saveSections(cwd, sections);
}

export function viewState(cwd: string): ViewState {
  const p = paths(cwd);
  if (!existsSync(p.receipt) || !existsSync(join(p.view, "architecture", "index.html"))) return "missing";
  try {
    const receipt = JSON.parse(readFileSync(p.receipt, "utf8"));
    return receipt.modelHash === architectureHash(cwd) && !existsSync(p.failure) ? "fresh" : "stale";
  } catch {
    return "stale";
  }
}

function architectureHash(cwd: string) {
  const root = paths(cwd).architecture;
  const collect = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error("아키텍처 입력의 심볼릭 링크는 지원하지 않습니다.");
    return entry.isDirectory() ? collect(path) : [`${path.slice(root.length)}\n${readFileSync(path).toString("base64")}`];
  });
  return hash(collect(root).join("\n"));
}

export function renderReport(cwd: string) {
  const p = paths(cwd);
  mkdirSync(p.view, { recursive: true });
  const state = viewState(cwd);
  const labels = { missing: "아키텍처 View: 아직 생성하지 않음", fresh: "아키텍처 View: 현재 모델과 일치", stale: "아키텍처 View: 오래됨 — 모델 확인 필요" };
  const link = state === "missing" ? "" : '<a href="architecture/index.html">아키텍처 노드 보기</a>';
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:"><title>Secretary — 프로젝트 보고서</title><style>:root{color-scheme:light dark}body{font:16px/1.75 system-ui,sans-serif;max-width:920px;margin:40px auto;padding:0 24px}nav{padding:16px 0;border-bottom:1px solid #8886}nav a{margin-left:20px}h2{margin-top:36px}a{color:light-dark(#245b9e,#9ac8ff)}pre{overflow:auto}table{border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid #8886}</style></head><body><nav><strong>${escapeHtml(labels[state])}</strong>${link}</nav><main>${markdown.render(readFileSync(p.report, "utf8"))}</main></body></html>`;
  writeFileSync(p.reportPage, html);
  return p.reportPage;
}

export async function buildView(cwd: string, signal?: AbortSignal) {
  const p = paths(cwd);
  mkdirSync(p.view, { recursive: true });
  const snapshot = architectureHash(cwd);
  const temporary = join(p.view, `architecture-${crypto.randomUUID()}`);
  const cli = join(PACKAGE_ROOT, "node_modules", ".bin", "likec4");
  const run = async (args: string[]) => {
    const process = Bun.spawn([cli, ...args], { cwd, stdout: "pipe", stderr: "pipe", signal });
    const [stdout, stderr, code] = await Promise.all([new Response(process.stdout).text(), new Response(process.stderr).text(), process.exited]);
    if (code !== 0) {
      let message = (stderr || stdout || `종료 코드 ${code}`).slice(-6000);
      try {
        const diagnostics = JSON.parse(stdout) as { errors?: { file?: string; line?: number; message?: string }[] };
        if (diagnostics.errors?.length) message = diagnostics.errors.slice(0, 3).map((error) => `${error.file ?? "모델"}:${error.line ?? "?"} ${String(error.message).slice(0, 400)}`).join("\n");
      } catch { /* JSON이 아닌 CLI 실패는 원래 진단을 보존합니다. */ }
      throw new Error(message);
    }
  };
  try {
    await run(["validate", p.architecture, "--json"]);
    await run(["build", p.architecture, "--output", temporary, "--output-single-file", "--use-hash-history"]);
    if (architectureHash(cwd) !== snapshot) throw new Error("생성 도중 모델이 변경됐습니다. 다시 생성해 주세요.");
    if (!existsSync(join(temporary, "index.html"))) throw new Error("생성된 아키텍처 페이지가 없습니다.");
    const destination = join(p.view, "architecture");
    rmSync(destination, { recursive: true, force: true });
    renameSync(temporary, destination);
    writeFileSync(p.receipt, JSON.stringify({ modelHash: snapshot, builtAt: new Date().toISOString() }, null, 2));
    rmSync(join(p.view, "build-failed"), { force: true });
  } catch (error) {
    writeFileSync(join(p.view, "build-failed"), String(error));
    throw error;
  } finally {
    rmSync(temporary, { recursive: true, force: true });
    renderReport(cwd);
  }
  return join(p.view, "index.html");
}
