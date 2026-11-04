# Assistant

시험·개발 환경에 준비된 **Codex**에 과제 진행 규칙, 보고서, 사용자 결정 기록, 계획, 아키텍처 View를 더하는 harness입니다.

Oh My Pi v18.16.0에서 계획 파일 읽기·재개 코드와 계획 작성 지침을 선별 이식했습니다. 이 소스는 이 저장소가 직접 소유·수정하며 출처·해시·MIT 고지는 `third_party/oh-my-pi/`에 보존합니다. OMP CLI·확장·에이전트 루프는 설치하지 않습니다.

Gajae-Code v0.15.3의 질문·진행 보고·단계·근거 계약은 Assistant의 단계 기록과 요약으로 선별 이식했습니다. 출처·원본 commit·파일 해시·MIT 고지는 `third_party/gajae-code/`에 있습니다. [아이디어와 구현 위치](docs/source-map.md)에서 실제 이식과 설계 참고를 구분합니다.

## 시험 환경에서 시작

준비물: 실행·인증이 준비된 `codex`, Bun 1.4.4 이상. View 생성에는 Node.js 22.22.3 이상도 필요합니다.

```sh
git clone https://github.com/Woo-JongHo/secretary.git assistant
cd assistant
bun install --frozen-lockfile
./assistant start /path/to/exam-project
```

현재 원격 저장소는 `secretary`라는 이름의 비공개 저장소이므로 다운로드할 계정에 접근 권한이 필요합니다. 과제 폴더는 이미 존재하는 디렉터리를 지정합니다.

`start`는 과제 폴더에 스킬과 보고서를 준비한 뒤 기존 Codex를 열어 `$assistant`로 시작합니다. 시험문제를 붙여넣거나 파일을 지정합니다.

```sh
./assistant start /path/to/exam-project --task-file /path/to/problem.md
```

모델·인증·권한은 기존 Codex 설정을 사용합니다. Codex 옵션은 `--` 뒤로 전달합니다.

```sh
./assistant start /path/to/exam-project -- --model configured-model
```

Codex를 이미 열었다면 터미널에서 아래 준비 명령을 실행하고 대화에 `$assistant`를 입력합니다. 새 스킬이 보이지 않으면 Codex를 다시 시작합니다.

```sh
/path/to/assistant/assistant init /path/to/exam-project
```

## 실행과 산출물

문제·성공 기준 → 대안·추천 → 필요한 사용자 결정 → 설계·구현 → 검증·다음 쟁점 흐름으로 진행합니다. 이미 허가된 작업은 새 선택 없이 계속 수행합니다.

[이 프로젝트의 구조 완성 과제로 본 예상 대화](docs/structure-scenario.md)에는 첫 질문·단계 요약·실패·재개 예시가 있습니다. 예시 선택은 실제 사용자 결정이 아닙니다.

| 담당 | 범위 |
| --- | --- |
| Codex | 모델·인증·대화·세션·기본 실행 도구 |
| Assistant | 시작 명령·스킬 설치·진행 규칙·보고서·결정·계획·View 연결 |
| LikeC4 | 아키텍처 모델 검증·노드 View 생성 |

```text
assistant/                       # 다운로드한 harness, 설치 후에도 보존
exam-project/
├── .agents/skills/assistant      # harness의 스킬 폴더를 가리키는 링크
└── .assistant/
    ├── report.md
    ├── summary.md               # 현재 단계 요약, 원문에서 복구 가능
    ├── steps/1.json             # 단계별 근거·질문·응답·파일 해시 원문
    ├── plan.md                  # 여러 단계 작업에서 필요할 때 생성
    ├── architecture/model.c4
    └── view/index.html
```

기존 `.secretary/` 자료가 있으면 그 경로를 이어 씁니다. 기존 보고서·사용자 코드·`AGENTS.md`를 초기화하거나 덮어쓰지 않습니다. 같은 이름의 다른 스킬과 충돌하면 오류를 반환합니다. 스킬 링크가 원본을 가리키므로 다운로드한 harness 폴더를 이동·삭제하지 마세요.

실제 산출물 경로는 `status`로 확인합니다. Codex 안에서는 설치된 스킬 옆의 `scripts/run`으로 같은 명령을 사용할 수 있습니다.

```sh
./assistant status /path/to/exam-project
./assistant step /path/to/exam-project --file step-result.json
./assistant summary /path/to/exam-project
./assistant report design /path/to/exam-project --file design-summary.md
./assistant plan /path/to/exam-project --file execution-plan.md
./assistant decision /path/to/exam-project --file user-decision.json
./assistant view /path/to/exam-project
```

`--file -`는 표준 입력을 읽습니다. `decision` JSON에는 `topic`, 서로 다른 `options` 2~3개, `selected`, `rationale`, 실제 사용자 응답 근거인 `evidence`가 필요합니다. 코드가 검증하는 것은 형식과 선택지 일치입니다. 실제 응답인지 확인하고 취소·무응답을 기록하지 않는 책임은 스킬 수행 에이전트에 있습니다. 계획 파일의 존재는 승인을 뜻하지 않습니다.

주 진행 경로는 `step`입니다. 문제 정리 → 설계 → 구현 → 검증 → 마무리를 기록하고, 확인된 것·가정·미확인·검증·산출물·다음 행동을 같은 형식으로 반환합니다. 질문 대기에는 실제 응답이 필요합니다. 검증 실패·미실행이나 검증 후 산출물 변경이 있으면 완료할 수 없습니다. 범위 변경은 이유와 함께 이전 단계를 다시 열며 이력은 보존합니다. [단계 JSON 계약과 예시](skills/assistant/references/conversation.md)를 참고하세요.

단계 기록 이후 문제·검증·다음 쟁점 절은 원문에서 생성하며 `report`로 덮어쓰지 않습니다. 기존 `decision`은 별도 결정 기록용이고 대기 질문은 `step.answer`로 해제합니다. 원문 저장 후 보고서 갱신이 실패하면 같은 ID·입력으로 재시도하거나 `summary`로 복구합니다. 이 명령은 제출된 검사 근거의 형식·단계·파일 변경을 확인합니다. 실제 응답과 검사의 진위는 수행 에이전트와 독립 리뷰가 확인해야 합니다. Codex의 모든 자유 발화를 가로채는 훅은 아닙니다.

View는 모델 변경이나 기존 View의 재생성 실패 시 오래됨으로 표시하며, 첫 생성 실패는 생성 실패로 표시합니다. 자체 구조 예제는 `examples/assistant/model.c4`입니다.

## 검증

```sh
bun run check
bun test
bun run smoke
```

`smoke`는 실제 CLI로 준비·보고서·계획·결정·단계·요약·재시작을 검사하고, 실제 LikeC4 validate/build와 실패·삭제 복구를 확인합니다. 설치된 Codex app-server의 `skills/list`로 스킬이 활성 상태로 수용되는지도 확인합니다. Codex가 설치되어 있어야 합니다.

이 검사는 모델 API 대화나 실제 사용자의 선택창 조작을 수행하지 않습니다. 결정 기록 검사는 주입한 입력을 사용합니다. 보고서와 View의 실제 사용성은 사용자 검증으로 확인합니다.
