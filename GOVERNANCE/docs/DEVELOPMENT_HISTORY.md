# Development History

## 2026-10-26 — Workspace bootstrap from by-gpt Governance

- Task: `TASK-20261026-0001`
- Requirement / Problem: `by-gpt`와 동일한 개발 방식으로 운영하되 GPT 대신 Claude를 사용하는 새 Workspace가 필요했다.
- Decision / User direction: `hjang12/ai-agent-cicd-system-by-claude`를 private 저장소로 만들고 `by-gpt`의 Governance를 복사해 사용한다. `by-gpt`는 참고(읽기)만 하며 절대 수정하지 않는다. Governance §14(Git 변경 및 사용자 승인)는 `by-gpt`와 동일하게 유지한다.
- Implementation / Changed files: `AGENT_START.md`, `AGENTS.md`, `README.md`, `GOVERNANCE/`(GOVERNANCE.md, VERSION, CHANGELOG.md, README.md, AGENT_START.md, templates/, docs/), `tools/validate_workspace.py`, `.github/workflows/workspace-validation.yml`. 원본 대비 변경은 "ChatGPT"→"Claude", "GPT 개발/프로젝트"→"Claude 개발/프로젝트", 저장소 이름 치환과 검증 스크립트 일반화뿐이다. `by-gpt`의 프로젝트, 체크포인트, 개발 이력, MIGRATION 기록은 가져오지 않았다.
- Verification / Evidence: 로컬 `python tools/test_validate_workspace.py`, `python tools/validate_workspace.py` 통과. GitHub Actions 결과는 Checkpoint에 기록한다.
- Outcome / remaining risk: Governance 버전은 1.4.7로 유지된다. Render 서비스와 첫 프로젝트는 아직 없다.

## 2026-10-26 — soldier-gate-runner-by-claude M0 bootstrap

- Task: `TASK-20261026-0002`
- Requirement / Problem: 병사 게이트 러너 기획서 기준 개발의 첫 단계로 배포 경로(CI → Render)를 먼저 확보해야 했다.
- Decision / User direction: Canvas 2D 의사 3D와 스프라이트 캐시, 외부 런타임 라이브러리 없음. 적은 기획서대로 붉은 적 병사. 참고 스크린샷은 사용자가 제공한다.
- Implementation / Changed files: `projects/soldier-gate-runner-by-claude/`(골격 페이지, 문서 3종, 테스트), `.github/workflows/soldier-gate-runner-ci.yml`, `render.yaml`, Task Registry와 Checkpoint 갱신.
- Verification / Evidence: 로컬 unittest 3개, Chromium smoke, `tools/validate_workspace.py` 통과. PR CI와 Render 배포 결과는 Checkpoint에 기록.
- Outcome / remaining risk: 게임 로직은 M1부터 구현한다.

