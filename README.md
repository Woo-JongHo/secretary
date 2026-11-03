# Secretary

프로젝트를 대화로 풀면서 결정 이유와 진행 상황을 같은 보고서로 남기는 얇은 하네스입니다.
실행 기반은 **[Oh My Pi](https://github.com/can1357/oh-my-pi)**입니다. 모델 인증·대화·세션·도구는 OMP를 사용하고,
Secretary는 공통 질문 흐름·PM 보고서·사용자 결정 기록·View 연결을 추가합니다.

공통 흐름: **문제·목표 → 대안·추천 → 사용자 결정 → 설계·View → 확인 결과·다음 쟁점**.

## 시작

Bun 1.4.4 이상, Node.js 22.22.3 이상이 필요합니다.

```sh
bun install
./secretary /path/to/project
```

OMP에서 사용할 모델을 `/model`로 선택합니다. 인증이 필요하면 OMP의 `/login`을 사용합니다.
Secretary는 자격 증명을 저장하거나 다른 도구에서 복사하지 않습니다.

```text
/secretary 임직원 1500명의 통근버스 위치와 탑승 노선을 확인하는 서비스를 기획한다
```

선택이 필요할 때 대안과 추천 이유가 표시됩니다. 실제 사용자 선택만 확정으로 기록합니다.
보고서는 `.secretary/report.md`, 아키텍처 모델은 `.secretary/architecture/model.c4`에 남습니다.

```text
/secretary-view
```

`.secretary/view/index.html`을 열면 보고서와 아키텍처 노드 링크를 볼 수 있습니다.
구조 변경 후 생성하지 않았거나 빌드가 실패하면 View를 오래됨으로 표시합니다.
초기 모델에는 프로젝트 노드만 있으며, 앱·서버·DB 등은 대화에서 정한 뒤 추가합니다.
화면 미리보기는 과제에서 만들어진 실제 링크를 보고서 설계 절에 연결합니다.

OMP가 이미 설치되어 있다면 확장 패키지로 직접 사용할 수도 있습니다.

```sh
omp --extension /path/to/secretary
```

확장은 OMP의 [공식 확장 계약](https://omp.sh/docs/extension-authoring)을 사용합니다.

## 경계

- 모델과 실행 엔진: Oh My Pi
- 질문·보고서·선택 기록: Secretary
- 아키텍처 모델 → 노드 View: LikeC4
- 공통 사고 방식: BMAD의 질문 방식, OpenSpec의 문서 역할, WES의 결정·근거 연결을 참고

OpenSpec·BMAD·별도 DB를 설치하지 않습니다. 생성된 `.secretary/` 자료는 대상 프로젝트가
소유합니다. Git에 기록할 범위는 해당 프로젝트에서 정합니다.

## 검증

```sh
bun run check
bun test
bun run smoke
```

`smoke`는 실제 OMP 세션에 확장을 로드해 명령·도구 등록과 `/secretary` 수용을 확인하고,
LikeC4 모델 검증·정적 View 생성을 확인합니다. 모델 인증을 요구하는 실제 대화와
TUI 선택창의 종단 검증은 별도입니다.

현재 구현 구조는 `examples/secretary/model.c4`에 있습니다. 이를 대상 프로젝트의
`.secretary/architecture/model.c4`에 넣고 `/secretary-view`를 실행하면 구조를 탐색할 수 있습니다.
