import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initialize, paths, recordDecision, updateReport } from "../src/project.ts";

const directories: string[] = [];
const workspace = () => {
  const directory = mkdtempSync(join(tmpdir(), "secretary-test-"));
  directories.push(directory);
  return directory;
};
afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true })));

test("다시 시작해도 기존 문제와 사용자 결정을 보존한다", () => {
  const cwd = workspace();
  const p = initialize(cwd, "통근버스 도착 시점을 확인한다.");
  recordDecision(cwd, "위치 수집", ["기사 앱", "전용 단말"], "기사 앱", "초기 검증 비용이 작다.", "사용자가 기사 앱을 선택했다.");
  const before = readFileSync(p.report, "utf8");
  initialize(cwd, "새 문제로 덮어쓰지 않는다.");
  expect(readFileSync(p.report, "utf8")).toBe(before);
  updateReport(cwd, "verification", "가정: 위치 데이터는 아직 제공받지 않았다.");
  expect(readFileSync(p.report, "utf8")).toContain("상태: 사용자 확정");
});

test("선택하지 않은 값이나 일반 보고서 갱신으로 결정을 만들 수 없다", () => {
  const cwd = workspace();
  const p = initialize(cwd, "의사결정 검증");
  const before = readFileSync(p.report, "utf8");
  expect(() => recordDecision(cwd, "범위", ["A", "B"], "C", "비교", "사용자 응답")).toThrow();
  expect(() => updateReport(cwd, "decisions" as never, "확정이라고 주장")).toThrow();
  expect(readFileSync(p.report, "utf8")).toBe(before);
});

test("수동으로 바뀐 문서 구조는 덮어쓰지 않고 오류를 낸다", () => {
  const cwd = workspace();
  const p = initialize(cwd, "문서 보호");
  const changed = `${readFileSync(p.report, "utf8")}\n## 사용자의 별도 메모\n\n보존해야 한다.\n`;
  writeFileSync(p.report, changed);
  expect(() => updateReport(cwd, "next", "다음 단계")).toThrow("절 구성");
  expect(readFileSync(p.report, "utf8")).toBe(changed);
});

test("기존 영문 View 절 제목을 한국어로 이행해도 결정 내용은 보존한다", () => {
  const cwd = workspace();
  const p = initialize(cwd, "기존 보고서 이행");
  recordDecision(cwd, "표시 언어", ["한국어", "영어"], "한국어", "사용자 요청", "검사에서 주입한 응답");
  const report = readFileSync(p.report, "utf8").replace("## 현재 설계·구조도", "## 현재 설계·View");
  writeFileSync(p.report, report);
  updateReport(cwd, "design", "하위 화면도 한국어로 표시한다.");
  expect(readFileSync(p.report, "utf8")).toContain("## 현재 설계·구조도");
  expect(readFileSync(p.report, "utf8")).toContain("선택: 한국어");
});

test("보고서가 만든 HTML에서는 원문 스크립트를 실행할 수 없다", () => {
  const cwd = workspace();
  const p = initialize(cwd, "화면 검증");
  updateReport(cwd, "design", '<script>alert("실행되면 안 됨")</script>');
  const html = readFileSync(p.reportPage, "utf8");
  expect(html).not.toContain("<script>");
  expect(html).toContain("&lt;script&gt;");
  expect(html).toContain("Content-Security-Policy");
});

test("작업 파일을 가리키는 심볼릭 링크는 따라 쓰지 않는다", () => {
  const cwd = workspace();
  const p = initialize(cwd, "경로 보호");
  const outside = join(cwd, "outside.md");
  writeFileSync(outside, "원본");
  rmSync(p.report);
  symlinkSync(outside, p.report);
  expect(() => paths(cwd)).toThrow("심볼릭 링크");
  expect(readFileSync(outside, "utf8")).toBe("원본");
});

test("대상이 아직 없는 심볼릭 링크도 거부한다", () => {
  const cwd = workspace();
  const p = initialize(cwd, "경로 보호");
  rmSync(p.reportPage);
  symlinkSync(join(cwd, "does-not-exist.html"), p.reportPage);
  expect(() => paths(cwd)).toThrow("심볼릭 링크");
});
