# 대화·단계 기록 계약

Gajae-Code v0.15.3의 deep-interview, ralplan, initial-phase, workflow-intent-report/schema에서 질문·진행 보고·단계 인계·근거 구분을 선별하여 다시 구현했다. 출처와 MIT 고지는 harness의 `third_party/gajae-code/`에 있다. 모호함을 임의의 점수로 환산하지 않고 실제 빈칸으로 표시한다.

## 의도부터 작업으로

목표 → 성공 기준 → 범위 중 실제로 비어 있고 작업을 바꾸는 한 가지를 묻는다. 질문에는 왜 지금 필요한지와 대안별 차이를 담는다. 원문에 이미 있는 답을 재확인하지 않는다. 파일명·문서 형식·구현 순서는 목표를 이해한 뒤 에이전트가 정할 수 있으면 정한다. 사용자가 결정할 새 쟁점이 없으면 허가된 작업을 이어간다.

`clarify` 완료에는 원래 요청, 목표, 사용자 의도 근거, 성공 기준, 구성 요소가 필요하다. `design`·`implement` 완료에는 실제 산출물 파일이 필요하고, `verify` 완료에는 전부 통과한 검사가 필요하다. 마무리는 검증한 산출물이 바뀌지 않았을 때 완료한다. 상태 검사는 에이전트가 작성한 성공 기준과 검사 근거를 사용한다. 검사의 의미·충분성을 자동으로 보증하지 않는다.

## 기록 명령

`status`의 `workflow.revision`과 현재 단계를 읽는다. 아래 예시는 **형식 설명용**이며 실제 사용자 결정이 아니다. JSON을 임시 파일로 작성하고 `scripts/run step 프로젝트 --file 파일`을 실행한다. 입력 파일은 `steps/` 밖에 둔다.

```json
{
  "id": "inspect-structure",
  "expectedRevision": 0,
  "stage": "clarify",
  "status": "waiting",
  "summary": "현재 모듈과 실행 경로를 조사했다. 구조 완성의 기준을 확인한다.",
  "facts": [{"statement": "실행 진입점이 존재한다.", "source": "observed", "evidence": "src/cli.ts를 읽은 결과"}],
  "assumptions": [],
  "unknowns": ["사용자가 말한 구조 완성의 기준"],
  "blockers": [],
  "artifacts": [],
  "checks": [],
  "intent": {"request": "이 프로젝트의 구조를 완성해줘"},
  "next": {
    "kind": "ask",
    "question": {
      "id": "completion-goal",
      "type": "choice",
      "target": "goal",
      "text": "구조 완성은 어떤 결과까지를 뜻하나요?",
      "why": "폴더 정리와 실제 동작 연결은 구현·검증 범위가 다릅니다. 다음 과제에 바로 쓸 수 있는 동작 연결을 추천합니다.",
      "options": ["모듈 동작·기록·재개까지 연결 (추천)", "폴더·책임 정리", "시험 시작 자동화"],
      "recommended": "모듈 동작·기록·재개까지 연결 (추천)"
    }
  }
}
```

- `status`: `progress` 진행 기록 / `waiting` 질문 대기 / `complete` 단계 완료 / `blocked` 원인 기록 / `reopen` 이전 단계 다시 열기.
- `facts`: 확인된 주장·출처(`user` 또는 `observed`)·근거. `assumptions`는 작업 가정, `unknowns`는 미확인, `blockers`는 진행을 막는 원인이다. 빈 목록은 `[]`로 쓴다.
- `artifacts`: 실제 프로젝트 안 파일의 `label`, `path`. 삭제는 `removed: true`로 기록한다. 원본 파일은 해시를 저장한다. 자동 생성되는 보고서·요약·View는 투영 파일로 구분하여 자체 갱신을 변경으로 오인하지 않는다.
- `checks`: `name`, `status`(`passed|failed|not_run`), `evidence`. 검사 로그는 가능하면 산출물로도 등록한다.
- `intent`: `request`, `goal`, `userEvidence`, `criteria`, `components`, `constraints`. 부분 갱신 가능하며 목표·기준 변경은 문제 정리에서 한다.
- 실제 응답 후 다음 기록에 `answer: {questionId, value, evidence}`를 넣는다. 선택지 밖 자유 응답은 `custom: true`도 넣는다. 답이 추가 설명이면 같은 단계에서 다시 질문할 수 있다. 응답하지 않은 질문에 추정 답을 넣지 않는다.
- `next`: 실행은 `{kind:"act",text:"다음 행동"}`, 질문은 위 `ask`, 전체 완료는 마무리 완료에서 `{kind:"done",text:"완료 결과"}`다.
- `reopen`: 돌아갈 `stage`와 `reason`을 기록한다. 목표를 다시 여는 경우 `criteria`를 생략하면 기존 성공 기준은 비운다. 새 요청을 근거로 기준을 다시 정한다. 지나간 결정은 이전 범위의 이력으로 남는다.

## 응답과 재개

기록 결과의 `summary`에는 단계·결과, 실제 응답 근거, 확인/가정/미확인/검증/산출물 표, 다음 행동, 보고서·View·원문 링크가 있다. 이 구조와 링크를 유지해 보여준다. 임의로 다시 요약해 산출물·근거·View 링크를 빼지 않는다. `waiting`이면 반환된 `question`으로 선택 도구를 호출한다. 선택 도구가 요구하는 입력 형식에 맞추되 질문 내용을 바꾸지 않는다.

원문은 `steps/1.json`부터 보존된다. `summary`는 원문에서 현재 보고서·요약을 복구한다. 저장 후 보고서 생성이 실패하면 **동일 ID와 동일 입력**으로 재시도한다. revision 충돌은 `status`를 다시 읽고 새 결과를 기록한다. 기록 파일을 편집하거나 번호를 지워 충돌을 우회하지 않는다.

완료 후 파일 변경은 `freshness: stale`로 나타난다. 이전 성공을 그대로 보고하지 말고 해당 단계를 다시 열어 수정·검증한다. LikeC4 모델의 오래됨은 별도로 `viewState`에서 확인하고 `view`로 다시 생성한다.
