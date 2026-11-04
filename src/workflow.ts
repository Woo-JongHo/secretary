import { loadPlanReference } from "./plan.ts";
import { paths } from "./project.ts";
import { workflowStatus } from "./session.ts";

export function buildStartPrompt(cwd: string, task: string) {
  const p = paths(cwd);
  const plan = loadPlanReference(cwd);
  const workflow = workflowStatus(cwd);
  return [
    "$assistant 스킬을 사용해 이 프로젝트를 진행하세요.",
    `먼저 스킬 지시와 현재 보고서 ${JSON.stringify(p.report)}를 읽으세요.`,
    `단계 상태: ${JSON.stringify(workflow)}. 새 요청의 의도와 성공 기준을 먼저 확인하세요. 파일 종류나 구현 순서를 먼저 묻지 마세요.`,
    "의미 있는 단계가 끝나면 step 명령으로 결과를 저장하고 반환된 summary를 사용자에게 보여주세요. waiting이면 반환된 question을 호스트 선택 도구로 전달하고 실제 응답을 기다리세요. 취소·미응답은 답이 아닙니다.",
    "아키텍처 모델의 노드·관계·보기 제목과 설명은 하위 계층까지 한국어로 작성하고 연결선은 routing ortho로 지정하세요. 코드 식별자·경로·키는 영어로 유지하고 view 명령으로 한국어 화면을 생성하세요.",
    plan ? `기존 계획 ${JSON.stringify(plan.path)}를 읽고 현재 요청에 맞는지 확인하세요. 계획 파일의 존재를 사용자 승인으로 해석하지 마세요.` : "먼저 문제·성공 기준·제출조건을 정리하세요.",
    task.trim() ? `이번 사용자 과제:\n${task.trim()}` : "사용자에게 시험문제나 문제 파일 경로를 받아 시작하세요.",
  ].join("\n\n");
}
