import { expect, test } from "bun:test";
import { Window } from "happy-dom";
import { collectModelText, localizeViewHtml, translateViewText, VIEW_KOREAN_TEXT } from "../src/view-locale.ts";

test("상세 탭·계층 안내·접근성 문구를 한국어로 바꾸고 식별자를 보존한다", () => {
  expect(translateViewText("Structure", VIEW_KOREAN_TEXT)).toBe("계층 구조");
  expect(translateViewText("In development", VIEW_KOREAN_TEXT)).toBe("개발 중인 기능");
  expect(translateViewText("Browse 설치 명령 relationships", VIEW_KOREAN_TEXT)).toBe("설치 명령 관계 살펴보기");
  expect(translateViewText("Edge from assistant.cli to codex.session", VIEW_KOREAN_TEXT)).toBe("assistant.cli에서 codex.session(으)로 연결");
  expect(translateViewText("사용자. Node kind: person. Opens view runtime.", VIEW_KOREAN_TEXT, true)).toBe("사용자. 종류: 사용자. runtime 보기로 이동.");
  expect(translateViewText("  12 relationships  ", VIEW_KOREAN_TEXT)).toBe("  12개 관계  ");
  expect(translateViewText("src/project.ts", VIEW_KOREAN_TEXT)).toBe("src/project.ts");
  expect(translateViewText("과제 진행 비서", VIEW_KOREAN_TEXT)).toBe("과제 진행 비서");
});

test("사전에 없는 프로토타입 이름과 모델 설명은 원문을 보존한다", () => {
  for (const value of ["constructor", "toString", "valueOf", "hasOwnProperty", "__proto__", "Description: 로그인 처리", "Node kind: person."]) {
    expect(translateViewText(value, VIEW_KOREAN_TEXT)).toBe(value);
  }
  expect(translateViewText("소유자. Node kind: constructor.", VIEW_KOREAN_TEXT, true)).toBe("소유자. 종류: constructor.");
});

test("한국어 적용은 기존 프로그램·모델 문자열을 보존하고 한 번만 삽입한다", () => {
  const program = '<script type="module">const model = {title: "Export", code: "</body>"};</script>';
  const html = `<html lang="en"><head>${program}</head><body><div id="root"></div></body></html>`;
  const localized = localizeViewHtml(html);
  expect(localized).toContain('<html lang="ko">');
  expect(localized).toContain(program);
  expect(localized).toContain('id="assistant-view-korean"');
  expect(localized.indexOf('id="assistant-view-korean"')).toBeGreaterThan(localized.indexOf('id="root"'));
  expect(localizeViewHtml(localized)).toBe(localized);
});

test("다른 언어 속성·잘못된 생성 결과를 처리한다", () => {
  expect(localizeViewHtml("<html><body></body></html>")).toContain('lang="ko"');
  expect(localizeViewHtml("<html lang='en'><body></body></html>")).toContain('lang="ko"');
  expect(() => localizeViewHtml("<div>생성 실패</div>")).toThrow("HTML 형식");
});

test("실제 주입 스크립트가 동적 화면을 번역하고 모델·코드·입력값을 보존한다", async () => {
  const window = new Window();
  try {
    const modelText = collectModelText({ elements: { sample: { title: "Project", description: { txt: "Description: 로그인 처리" } } }, views: { index: { id: "index", title: "Landscape view" } } });
    expect(modelText).not.toContain("Landscape view");
    const html = localizeViewHtml('<html><head><title>구조도 - default</title></head><body><h1>Project</h1><p>Description: 로그인 처리</p><button>Share</button><pre><code>Share</code></pre><input value="Share"><div class="react-flow__edgelabel-renderer">Export</div><input readonly role="combobox" value="Auto"></body></html>', modelText);
    window.document.write(html);
    window.eval(window.document.querySelector("#assistant-view-korean")!.textContent!);
    await window.happyDOM.waitUntilComplete();
    expect(window.document.documentElement.lang).toBe("ko");
    expect(window.document.title).toBe("구조도 — 기본 프로젝트");
    expect(window.document.querySelector("h1")!.textContent).toBe("Project");
    expect(window.document.querySelector("p")!.textContent).toBe("Description: 로그인 처리");
    expect(window.document.querySelector("button")!.textContent).toBe("공유");
    expect(window.document.querySelector("code")!.textContent).toBe("Share");
    expect(window.document.querySelector("input")!.value).toBe("Share");
    expect(window.document.querySelector(".react-flow__edgelabel-renderer")!.textContent).toBe("Export");
    expect(window.document.querySelectorAll("input")[1]!.value).toBe("자동");
    const tab = window.document.createElement("button");
    tab.setAttribute("aria-label", "Open details");
    tab.textContent = "Structure";
    window.document.body.append(tab);
    await window.happyDOM.waitUntilComplete();
    expect(tab.textContent).toBe("계층 구조");
    expect(tab.getAttribute("aria-label")).toBe("상세 정보 열기");
    tab.textContent = "Properties";
    await window.happyDOM.waitUntilComplete();
    expect(tab.textContent).toBe("속성");
  } finally { await window.happyDOM.close(); }
});
