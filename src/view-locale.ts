import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// LikeC4 1.60에는 화면 언어 설정이 없다. 생성된 프로그램은 보존하고
// 뒤늦게 열리는 상세 창·도움말을 포함한 표시 문구만 한국어로 바꾼다.
export const VIEW_KOREAN_TEXT: Record<string, string> = {
  Actions: "작업", Apply: "적용", "Apply changes": "변경 적용", Auto: "자동",
  Back: "뒤로", "Back to diagram": "구조도로 돌아가기", Background: "배경",
  "Browse relationships": "관계 살펴보기", "By files": "파일별", "By folders": "폴더별",
  Clear: "지우기", Close: "닫기", "Close compare": "비교 닫기", "Color scheme": "화면 색상",
  Compare: "비교", "Compare with current state": "현재 상태와 비교", Context: "맥락",
  Copied: "복사됨", Copy: "복사", "Copy to clipboard": "클립보드에 복사",
  "Copy link to this relationship view": "이 관계 보기 링크 복사", "Copy relationship URL": "관계 주소 복사",
  "Copy failed - Clipboard requires HTTPS or localhost": "복사하려면 보안 연결 또는 로컬 주소가 필요합니다",
  "Current view": "현재 보기", "Current view does not include some relationships": "현재 보기에 포함되지 않은 관계가 있습니다",
  Dark: "어둡게", Deployments: "배포", Description: "설명", Diagram: "구조도", Diagrams: "구조도 목록",
  Edit: "편집", Elements: "구성 요소", "Elements:": "구성 요소:", Embedded: "삽입",
  "Embedded view is an iframe with a static diagram": "구조도를 다른 페이지에 삽입합니다",
  "Empty result": "결과 없음", Error: "오류", Export: "내보내기",
  "Export as .d2": "D2 파일로 내보내기", "Export as .dot": "DOT 파일로 내보내기",
  "Export as .jpg": "JPG 이미지로 내보내기", "Export as .mmd": "머메이드 파일로 내보내기",
  "Export as .png": "PNG 이미지로 내보내기", "Export as .puml": "플랜트UML 파일로 내보내기",
  "Export to Draw.io": "드로우아이오 파일로 내보내기", External: "외부",
  "Failed to export to JPEG, check the console for more details.": "JPG 이미지 내보내기에 실패했습니다. 자세한 내용은 오류 기록을 확인하세요.",
  "Failed to export to PNG, check the console for more details.": "PNG 이미지 내보내기에 실패했습니다. 자세한 내용은 오류 기록을 확인하세요.",
  "Fit View": "화면에 맞추기", "Center camera": "화면 가운데로", Global: "전체",
  "Go to overview": "전체 구조로 이동", Graph: "관계망", Group: "그룹", Id: "식별자",
  "In development": "개발 중인 기능", "Interactive diagram": "대화형 구조도",
  "Latest auto": "최신 자동 배치", Layout: "배치", "Layout options": "배치 설정",
  Light: "밝게", Link: "링크", "Link copied!": "링크를 복사했습니다", Links: "링크", List: "목록",
  "Loading...": "불러오는 중…", "Localhost URL": "로컬 주소", Markdown: "마크다운", Metadata: "추가 정보",
  Next: "다음", "No description": "설명 없음", "No kinds found": "해당 종류가 없습니다",
  "No links": "링크 없음", "No tags": "태그 없음", "No tags found": "해당 태그가 없습니다",
  "No views": "보기 없음", None: "없음", Notation: "범례", Notes: "메모",
  "Nothing found": "검색 결과가 없습니다", "Nothing to see here": "표시할 내용이 없습니다",
  "Oops, something went wrong": "화면을 표시하는 중 오류가 발생했습니다",
  Open: "열기", "Open View Source": "구조도 원본 보기", "Open default view": "기본 보기 열기",
  "Open details": "상세 정보 열기", "Open dynamic view": "흐름도 열기", "Open index": "목록 열기",
  "Open overview": "전체 구조 열기", "Open source": "원본 보기", Ortho: "직각선", Outline: "개요",
  Overview: "전체 구조", Pending: "대기 중", Previous: "이전", Project: "프로젝트", Properties: "속성",
  "Landscape view": "전체 구조",
  Relationships: "관계", "Relationships of": "관계 대상", "Relationships:": "관계:",
  "Render with Kroki": "크로키로 그리기", Reorder: "순서 변경", Repeat: "반복", Reset: "초기화",
  "Reset all control points": "모든 연결점 초기화", "Reset layout": "배치 초기화",
  "Reset manual layout": "수동 배치 초기화", Revert: "되돌리기", "Routing:": "연결선:",
  "Saved manual": "저장된 수동 배치", Scope: "범위", "Scope is set to global": "전체 범위로 설정됨",
  Search: "검색", "Search by title or id": "제목 또는 식별자로 검색",
  "Search by title, description or start with # or kind:": "제목·설명으로 검색하거나 #태그·kind:종류로 검색",
  "See console for more details and report the issue if it persists.": "자세한 내용은 오류 기록을 확인하고 문제가 계속되면 알려 주세요.",
  "Select view": "보기 선택", Sequence: "순서도", Share: "공유", "Show notation": "범례 보기",
  "Spacing:": "간격:", Spline: "곡선", Start: "시작", "Start Dynamic View Walkthrough": "흐름 따라가기 시작",
  Stop: "중지", Structure: "계층 구조", "Switch to Read-only": "읽기 전용으로 전환",
  "Switch to manual layout to apply changes.": "변경하려면 수동 배치로 전환하세요.",
  "Sync with latest": "최신 상태로 맞추기", Tags: "태그", Target: "대상",
  "Take me back to home page": "첫 화면으로 돌아가기", "The diagram": "구조도",
  "This element does not exist in the current view": "현재 보기에 없는 구성 요소입니다",
  "This element does not have any deployments": "이 구성 요소의 배포 정보가 없습니다",
  "This relationship is not included in the current view": "현재 보기에 포함되지 않은 관계입니다",
  "Toggle color scheme": "밝은 화면·어두운 화면 전환", "Toggle navigation": "탐색 메뉴 열기·닫기",
  "Try again": "다시 시도", "Unknown error": "알 수 없는 오류", Untitled: "제목 없음", "Untitled View": "제목 없는 보기",
  "View is out of sync": "구조도가 현재 모델과 다릅니다", "View not found": "보기를 찾을 수 없습니다",
  Views: "보기", "We need your feedback. Share your thoughts and ideas -": "기능에 대한 의견을 들려주세요 —",
  "GitHub discussions": "깃허브 의견 나누기", Webcomponent: "웹 구성 요소",
  "Control Panel": "화면 조작", "React Flow attribution": "리액트 플로 출처",
  "Add this script to your page:": "페이지에 이 스크립트를 넣으세요:", JavaScript: "자바스크립트", HTML: "HTML 코드",
  "This script defines a custom element (webcomponent) that renders your diagrams.": "이 스크립트는 구조도를 표시하는 웹 구성 요소를 만듭니다.",
  "Script must be inserted once in the": "스크립트를 다음 위치에 한 번 넣으세요:",
  "or at the end of the": "또는 다음 태그 끝:", "tag.": "태그.",
  "Insert this code to your page. Page may have multiple": "아래 코드를 페이지에 넣으세요. 여러 번 사용할 수 있습니다:",
  "no description": "설명 없음", "no nested": "하위 구성 없음", "no results": "결과 없음", "no views": "보기 없음",
  "browse relationships": "관계 살펴보기", "open relationship source": "관계 원본 열기",
  "show description": "설명 보기", "out of sync": "현재 모델과 다름", "you are here": "현재 위치",
  "scoped views of the element": "이 구성 요소의 하위 보기", "views including this element": "이 구성 요소를 포함한 보기",
  "can undo": "되돌릴 수 있음", "can redo": "다시 실행할 수 있음", "manual adjustments.": "수동 조정 내용입니다.",
  node: "구성 요소", edge: "관계", source: "출발점", target: "도착점", notes: "메모", links: "링크",
  "You can undo this action.": "이 작업은 되돌릴 수 있습니다.",
  "You need to deploy your project to make it available on the internet": "인터넷에서 공유하려면 프로젝트를 게시해야 합니다",
  "Zoom In": "확대", "Zoom Out": "축소", "Zoom in": "확대", "Zoom out": "축소",
  "DIRECT RELATIONSHIPS": "직접 연결", "RESOLVED FROM NESTED": "하위 구성에서 가져온 연결",
  INCOMING: "들어오는 연결", OUTGOING: "나가는 연결", incoming: "들어오는 연결", outgoing: "나가는 연결",
  kind: "종류", tags: "태그", technology: "사용 기술", metadata: "추가 정보", description: "설명",
  person: "사용자", system: "시스템", component: "구성 요소", artifact: "산출물", project: "프로젝트",
  PERSON: "사용자", SYSTEM: "시스템", COMPONENT: "구성 요소", ARTIFACT: "산출물", PROJECT: "프로젝트",
  "Align bottom": "아래 맞춤", "Align center": "가로 가운데 맞춤", "Align middle": "세로 가운데 맞춤",
  "Align left": "왼쪽 맞춤", "Align right": "오른쪽 맞춤", "Align top": "위 맞춤",
  "Align in columns": "열 맞춤", "Align in rows": "행 맞춤", "Auto layout:": "자동 배치:",
  "Top-Bottom": "위에서 아래로", "Bottom-Top": "아래에서 위로", "Left-Right": "왼쪽에서 오른쪽으로", "Right-Left": "오른쪽에서 왼쪽으로",
  "Manual layouting tools": "수동 배치 도구", "Navigate to view": "보기로 이동",
  "Model has changed since this view was last updated.": "마지막 구조도 생성 이후 모델이 변경됐습니다.",
  "Page you are trying to open does not exist. You may have mistyped the address, or the page has been moved to another URL. If you think this is an error contact support.": "요청한 페이지가 없습니다. 주소를 확인하거나 첫 화면으로 돌아가 주세요.",
  "Press Enter or Space to select this node and reveal its actions.": "엔터 또는 스페이스를 누르면 이 구성 요소의 작업을 볼 수 있습니다.",
  "Press Enter or Space to select this relationship and reveal its actions.": "엔터 또는 스페이스를 누르면 이 관계의 작업을 볼 수 있습니다.",
};

export function translateViewText(value: string, dictionary: Record<string, string>, descriptive = false): string {
  const [, before = "", text = "", after = ""] = value.match(/^(\s*)(.*?)(\s*)$/su) ?? [];
  const normalized = text.replace(/\s+/g, " ");
  const lookup = (key: string) => Object.hasOwn(dictionary, key) && typeof dictionary[key] === "string" ? dictionary[key] : undefined;
  const exact = lookup(normalized);
  if (exact) return before + exact + after;
  let translated = text
    .replace(/^Browse (.+) relationships$/, "$1 관계 살펴보기")
    .replace(/^Relationship from (.+?) to (.+?)\. Label: (.+)\.$/, "$1에서 $2(으)로 연결. 설명: $3.")
    .replace(/^Edge from (.+?) to (.+)$/, "$1에서 $2(으)로 연결")
    .replace(/^(\d+) (elements?|relationships?|views?)$/, (_, count: string, kind: string) => `${count}개 ${lookup(kind.startsWith("element") ? "Elements" : kind.startsWith("relationship") ? "Relationships" : "Views")}`);
  if (descriptive) translated = translated.replace(/^(.+?)\. Node kind: ([\w-]+)\.(?: Description: (.+?))?(?: Opens view ([\w.-]+)\.)?$/s, (_, title: string, kind: string, description?: string, view?: string) => `${title}. 종류: ${lookup(kind) ?? kind}.${description ? ` 설명: ${description}` : ""}${view ? ` ${view} 보기로 이동.` : ""}`);
  if (translated === text) return value;
  return before + translated + after;
}

function installKoreanUi(dictionary: Record<string, string>, translate: typeof translateViewText, modelText: string[]) {
  const protectedText = "script,style,noscript,pre,code,kbd,textarea,input,[contenteditable=true],.react-flow__node,.react-flow__edge,.react-flow__edgelabel-renderer,[data-assistant-locale-ignore]";
  const protectedValues = new Set(modelText.map((value) => value.trim().replace(/\s+/g, " ")));
  const isModelText = (value: string) => protectedValues.has(value.trim().replace(/\s+/g, " "));
  const attributes = ["aria-label", "aria-description", "aria-roledescription", "aria-valuetext", "title", "placeholder", "alt"];
  const updateTitle = () => {
    const title = document.title.replace(/\s[-—]\sdefault$/, " — 기본 프로젝트");
    if (title !== document.title) document.title = title;
  };
  const visit = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.parentElement?.closest(protectedText)) return;
      const value = node.nodeValue ?? "";
      if (isModelText(value)) return;
      const translated = translate(value, dictionary);
      if (translated !== value) node.nodeValue = translated;
      return;
    }
    if (!(node instanceof Element)) return;
    if (node.matches("script,style,noscript,pre,code,[data-assistant-locale-ignore]")) return;
    for (const attribute of attributes) {
      const value = node.getAttribute(attribute);
      if (value && !isModelText(value)) {
        const translated = translate(value, dictionary, attribute.startsWith("aria-"));
        if (translated !== value) node.setAttribute(attribute, translated);
      }
    }
    if (node instanceof HTMLInputElement && node.readOnly && node.getAttribute("role") === "combobox") {
      const translated = translate(node.value, dictionary);
      if (translated !== node.value) node.value = translated;
    }
    for (const child of node.childNodes) visit(child);
  };
  document.documentElement.lang = "ko";
  visit(document.body);
  updateTitle();
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "childList") for (const node of mutation.addedNodes) visit(node);
      else visit(mutation.target);
    }
    updateTitle();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: attributes });
}

export function collectModelText(model: unknown): string[] {
  const values = new Set<string>();
  const fields = new Set(["title", "description", "technology", "metadata", "tags", "label", "notes"]);
  const visit = (value: unknown, collect = false) => {
    if (typeof value === "string") { if (collect) values.add(value); return; }
    if (Array.isArray(value)) { for (const item of value) visit(item, collect); return; }
    if (!value || typeof value !== "object") return;
    const object = value as Record<string, unknown>;
    for (const [key, item] of Object.entries(object)) {
      if (key === "title" && object.id === "index" && !object.sourcePath && item === "Landscape view") continue;
      visit(item, collect || fields.has(key));
    }
  };
  visit(model);
  return [...values];
}

export function localizeViewHtml(html: string, modelText: string[] = []): string {
  if (html.includes('id="assistant-view-korean"')) return html;
  const bodyEnd = html.lastIndexOf("</body>");
  if (bodyEnd < 0 || !/<html\b/i.test(html)) throw new Error("한국어 표시를 적용할 구조도 HTML 형식을 확인해 주세요.");
  const dictionary = JSON.stringify(VIEW_KOREAN_TEXT).replaceAll("<", "\\u003c");
  const protectedValues = JSON.stringify(modelText).replaceAll("<", "\\u003c");
  const script = `<script id="assistant-view-korean">(${installKoreanUi.toString()})(${dictionary},${translateViewText.toString()},${protectedValues});</script>`;
  return (html.slice(0, bodyEnd) + script + html.slice(bodyEnd)).replace(/<html\b[^>]*>/i, (tag) => /\blang\s*=/.test(tag) ? tag.replace(/\blang\s*=\s*(["']).*?\1/i, 'lang="ko"') : tag.replace(/>$/, ' lang="ko">'));
}

export function viewLocaleHash(): string {
  const version = JSON.parse(readFileSync(new URL("../node_modules/likec4/package.json", import.meta.url), "utf8")).version;
  return createHash("sha256").update(readFileSync(new URL(import.meta.url))).update(version).digest("hex");
}
