# 아이디어와 구현 위치

| 출처 | 가져온 내용 | 구현 위치 | 적용 범위 |
| --- | --- | --- | --- |
| Oh My Pi v18.16.0 | 계획 파일 찾기·읽기·인계 지침 | `src/plan.ts`, `skills/assistant/references/planning.md` | 소스·지침 선별 이식. 전체 런타임 사용 아님 |
| Gajae-Code v0.15.3 deep-interview | 의도·성공 기준부터 한 쟁점씩 질문, 진행·빈칸 보고 | `skills/assistant/SKILL.md`, `references/conversation.md`, `src/conversation.ts` | 지침·보고 계약 선별 수정. 모호함 수치·전용 질문 도구 제외 |
| Gajae-Code initial-phase·ralplan | 단계 시작점·지속되는 인계·근거 | `src/stages.ts` | 프로젝트 단계로 재구현. upstream 전체 상태 머신의 복제 아님 |
| Gajae-Code workflow-intent-report/schema | 주장·근거 구분, Zod 검증, 보고 형식 | `src/conversation.ts`, `src/project.ts` | Assistant의 입력 계약·한국어 단계 요약으로 수정 |
| BMAD | 구현 전에 의도·범위를 구체화 | 스킬의 문제 정리 흐름 | 설계 참고. BMAD 코드·에이전트 팩 설치 없음 |
| OpenSpec | 대화와 지속되는 설계·근거 문서 연결 | 보고서·계획·단계 원문의 역할 분리 | 설계 참고. OpenSpec 변경 관리자·CLI 사용 없음 |
| WES | 사용자 실제 선택과 가정 구분, 검증·재개 근거 | 응답 근거·revision·변경 검사 | 사용자 작업 원칙의 적용. WES 정본 수정 없음 |
| LikeC4 | 모델 검증·노드 View | `src/project.ts`, `examples/assistant/model.c4` | 실제 의존성·빌드 실행 |
| Codex | 모델·인증·대화·기본 도구 | `src/cli.ts`, 설치 스킬 | 기존 호스트 사용 |

새로 작성한 `src/session.ts`는 단계 저장·현재 상태·보고서 생성을 연결한다. `steps/N.json`이 원문이며 `report.md`, `summary.md`, HTML은 다시 생성할 수 있다. 저장된 파일 해시로 기록 뒤 변경을 찾고, 낡은 검증을 그대로 완료로 사용하지 않는다. 해시는 위조 방지 서명이나 실제 사용자 응답 인증이 아니다.

이식 출처의 고정 commit과 원본 Git blob은 `third_party/*/upstream.json`에 있다. Gajae-Code의 실험 중이며 미연결인 harness-control-plane이나 모든 자동 리뷰·전용 실행 도구를 이식했다고 주장하지 않는다.
