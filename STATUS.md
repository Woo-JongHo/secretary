# Assistant — 재개 상태

기록: 2026-11-04 KST. 현재 폴더는 `23_assistant`, 브랜치는 `main`이다. GitHub 원격은 `Woo-JongHo/secretary`이고 비공개다. 사용자는 구현을 의미별로 나눠 커밋·푸시하도록 지시했다. 실제 커밋·원격 반영 상태는 `git status --short --branch`와 Git 이력으로 확인한다. 아래 `.runtime/` 검증·리뷰 전문은 이 머신에 보존한 로컬 자료이며 GitHub에는 포함하지 않는다.

## 사용자 지시와 작업 가정

- 시험 환경에서 GitHub 저장소를 내려받아 harness를 준비하고 명령으로 과제를 시작한다.
- 사용자는 OMP 전체 CLI 연결보다 필요한 핵심 소스를 가져와 직접 소유·수정하도록 지시했다.
- 사용자 제공 사실: 시험 환경에는 Codex가 이미 준비되어 바로 실행된다. 별도 API 키 방식은 선택하지 않았다.
- 작업 가정: 추천했던 기존 Codex 화면에서 시작하는 방식으로 진행한다. 시작 화면 선택지에 대한 개별 답변은 없었으며, 사용자의 후속 지시는 “진행하자. GLM으로 독립리뷰진행하고”였다. 이를 별도 선택창 조작 기록으로 바꾸지 않는다.
- 독립 리뷰는 사용자 지시에 따라 GLM을 사용하고 쓰기 도구를 제공하지 않는다.

## 현재 구현

- 실행: `./assistant start /path/to/exam-project`. 기존 Codex의 모델·인증·세션·기본 실행 도구를 사용한다.
- `src/install.ts`: 대상 프로젝트 `.agents/skills/assistant`에 스킬 링크를 설치한다. 사용자 규칙이나 다른 스킬을 덮어쓰지 않는다. harness 원본 폴더는 설치 후에도 보존해야 한다.
- `skills/assistant/`: 질문·기록·계획·검증 흐름. `$assistant`로 시작한다.
- `src/cli.ts`: init/start/status/report/plan/decision/view 명령.
- `src/project.ts`: 보고서·응답 근거·LikeC4 View 생성·오래됨 판정. 새 프로젝트는 `.assistant/`, 기존 자료가 있으면 `.secretary/`를 이어 쓴다.
- `src/plan.ts`: OMP v18.16.0의 계획 파일 읽기·재개 코드를 선별 이식했다. 계획 지침도 선별·번역했다. 출처·원본 commit·파일 해시·MIT 고지는 `third_party/oh-my-pi/`에 있다.
- OMP 실행 패키지·확장 등록·앞서 추출했던 중복 에이전트 루프는 제거했다. 실행 코드와 잠금 파일에 OMP 의존성이 없다.
- 자체 구조 예제는 `examples/assistant/model.c4`다.

## 확인한 것과 한계

- 타입 검사 통과, 단위 테스트 12개 통과.
- 실제 CLI 준비·보고서·계획·결정 기록·재시작 보존 통과.
- 실제 LikeC4 validate/build, 모델 변경·실패 시 오래됨 표시, View 삭제 후 복구 통과.
- 실제 설치된 Codex app-server가 프로젝트 스킬을 활성 상태로 수용하는 것까지 확인했다. 단순히 파일만 생성한 검사가 아니다.
- 결정 기록 검사는 입력 주입이다. 실제 사용자 선택창 조작 검증으로 보고하지 않는다. 결정의 실제 응답 여부를 확인하는 책임은 스킬 수행 에이전트에 있다.
- 실제 `assistant start`로 Codex v0.166.0 TUI가 열리고 과제 프롬프트가 수용되는 것을 확인했다. 모델이 스킬·보고서를 읽고 설치된 `scripts/run status`를 실행한 뒤 응답했으며 정상 종료했다. 검증용 읽기 과제 한 번의 연결 검사이며 실제 시험 과제 완주·사용자 선택창 조작·보고서와 View의 사용성 검증은 아니다.
- 새 디렉터리에서 frozen 설치(의존성 70개)·타입 검사·단위 테스트 12개·실제 호스트 스모크가 통과했다. GLM-5 첫 독립 리뷰는 검증 누락으로 REQUEST_CHANGES였고 LOW 2건도 지적했다. 실제 Codex TUI와 설치된 실행 스크립트를 검증하고, 없는 문제 파일의 한국어 안내 및 최초 View 빌드 실패 표시를 수정했다. 수정 후 검사와 GLM-5 읽기 전용 재검토가 APPROVE로 완료됐다. 검토된 소스 해시와 최종 코드가 일치한다. 전문은 `.runtime/review/codex-harness/review.txt`, `fix-review.txt`, 검증 영수증은 `.runtime/verification-codex/result.json`이다.

## 이전 실사용 과제 — 템플릿 설계 초안

- 사용자가 시나리오를 실제로 진행하자며 과제를 “원했던 템플릿 설계”로 제시했다.
- 실제 선택 도구 응답으로 “프로젝트 전체 진행 틀 — 문제·설계·구현·검증·보고서를 연결”이 범위로 확정됐다.
- 기존 하네스 기록을 보존하고 `.runtime/scenarios/template-design/`에서 별도 과제를 진행한다. `design-proposal.md`에 설계 초안, `.assistant/report.md`에 범위·대안·실제 선택 근거를 기록했고 `.assistant/view/index.html`을 생성했다. LikeC4 검증·생성 통과, View는 fresh다.
- 설계는 초안이며 아직 수락·구현 완료가 아니다. 첫 구현 순서는 질문했으나 답을 받지 않았다. 이후 사용자가 이식 완성과 예상 시나리오 설명으로 작업을 전환했으므로 이 미응답을 승인으로 바꾸거나 계속 독촉하지 않는다.
- 이어갈 때 이 과제의 보고서와 `scenario-status.json`을 먼저 확인한다. 하네스 구현의 기존 GLM 승인과 새 템플릿 설계의 수락을 섞지 않는다.

## 현재 작업 — Gajae-Code 질문·단계 요약 이식

- 사용자 요청: 부족했던 이식을 완성하고 “이 프로젝트의 구조 완성”을 과제로 삼았을 때 예상 대화를 여기서 보여준다. 예시 선택을 실제 사용자 결정으로 기록하지 않는다.
- `src/conversation.ts`: 의도·질문·실제 응답·주장/근거·검사 스키마와 일정한 한국어 요약 형식.
- `src/stages.ts`: 문제 정리→설계→구현→검증→마무리 전환, 변경 불가 단계 원문, revision 충돌·중복·부분 실패 복구, 산출물 해시·검증 기준 보존. 실패 검사 누락과 마무리 해시 재저장으로 검증을 우회하지 못한다.
- `src/session.ts`·`src/project.ts`: 단계 원문에서 요약·보고서·HTML을 생성한다. 기존 결정은 보존하고 다시 연 범위의 결정은 이전 이력으로 구분한다.
- `step`, `summary` 명령과 스킬·시작 프롬프트 연결. 모든 자유 발화를 가로채는 호스트 훅은 아니며 단계 명령 호출 시 검증한다. 응답·검사 근거의 진위와 의미는 에이전트·독립 리뷰 책임이다.
- Gajae-Code v0.15.3 commit `103659a2ebf6e698140c021981d47508389a2897`에서 질문·보고·초기 단계·근거 스키마를 선별 수정했다. 출처·Git blob·MIT 고지는 `third_party/gajae-code/`에 있다. BMAD/OpenSpec는 설계 참고이며 전체 코드 이식으로 주장하지 않는다.
- 아이디어별 모듈은 `docs/source-map.md`, 가상 대화는 `docs/structure-scenario.md`에 있다.
- 타입 검사·테스트 26개·스킬 형식 검사 통과. 새 디렉터리 frozen 설치(70개 의존성) 후 최종 소스로 갱신해 타입 검사·26개 테스트·CLI/호스트/View 스모크까지 통과했다.
- 실제 Codex 모델이 설치 스킬과 `step` 명령을 사용하고 첫 의도 질문을 `clarify/waiting`으로 저장했다. 실제 응답 주입 없이 구현하지 않고 종료했으며, 요약 표 항목·근거·보고서/View 링크 보존을 재확인했다. 전문·원문·결과는 `.runtime/verification-stages/`에 있다. 전체 시험 완주나 실제 사용자 선택창 조작 검증은 아니다.
- 자체 작업도 기존 `.secretary/steps/`에 기록했다. View는 새 모델로 생성했다. GLM-5 첫 실행은 판정 없는 응답으로 종료되어 승인으로 인정하지 않았고 원문을 `.runtime/review/conversation-port/`에 보존했다. 범위를 좁힌 읽기 전용 재검토가 APPROVE로 끝났으며 전문·검토 소스 해시·비차단 지적 분류는 `.runtime/review/conversation-port-bounded/`에 있다. 검토 소스와 최종 소스 해시가 일치한다. 최종 검증 영수증은 `.runtime/verification-stages/final-result.json`이다.

## 다음 시작점

먼저 `pwd`, `git status --short --branch`, 이 문서를 읽는다. 현재 작업은 Gajae-Code 질문·단계 요약 이식과 예상 시나리오 설명이다. 이식·검증·GLM 리뷰를 마쳤고 가상 시나리오는 `docs/structure-scenario.md`에 준비했다. 새 실제 과제를 시작하면 그 사용자 요청과 현재 단계·산출물 변경부터 확인한다. 이전 템플릿 초안의 미응답 구현 순서는 현재 작업을 막는 승인 조건이 아니다. 이전 OMP 확장 기반 재개 기록은 `.runtime/history/status-before-codex.md`에 보존했다.

사용자는 최종 의사결정자다. 실제 응답과 작업 가정을 구분하고, 구현·검증 결과는 보고서와 View에 회수한다. 이 머신의 기본 Bun은 1.4.0이므로 준비된 1.4.4를 선택하는 `./assistant`를 사용한다. 검사할 때는 `.runtime/node_modules/.bin/bun`으로 파일을 직접 실행하면 다른 Bun을 선택하지 않는다.
