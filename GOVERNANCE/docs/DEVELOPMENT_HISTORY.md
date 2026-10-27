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

## 2026-10-26 — GitHub Actions 한도 소진과 저장소 public 전환, M0 병합·배포

- Task: `TASK-20261026-0002`
- Requirement / Problem: 비공개 저장소의 Actions 월 사용량 소진으로 PR #1의 두 workflow가 단계 실행 없이 failure였다 (ISSUE-20261026-0001).
- Decision / User direction: 사용자가 저장소를 public으로 전환했다. 전환 전후로 파일과 커밋 이력에서 토큰·비밀 값이 없는지 확인했다.
- Implementation / Changed files: 빈 커밋으로 CI 재실행 → PR #1 squash 병합 → 작업 브랜치 삭제 → Render 정적 사이트 생성과 수동 배포. Render MCP는 `autoDeployTrigger: checksPass`를 지정할 수 없어 Auto-Deploy를 off로 만들었다.
- Verification / Evidence: PR CI와 main CI 모두 success, Render deploy live. 상세는 Checkpoint 참고.
- Outcome / remaining risk: Render Auto-Deploy 설정 불일치(ISSUE-20261026-0002). 공개 URL 응답은 사용자 확인 필요. 초기 커밋 작성자 메타데이터에 회사 이메일이 남아 있어 public 저장소에 노출된다.

## 2026-10-27 — M1·M2 1차 배포와 Render Auto-Deploy 정렬

- Task: `TASK-20261026-0002`
- Requirement / Problem: Render Auto-Deploy가 off라 `render.yaml`의 `checksPass`와 달랐다 (ISSUE-20261026-0002).
- Decision / User direction: 사용자가 Render 대시보드에서 Auto-Deploy를 `After CI Checks Pass`로 변경하고 이후 배포를 자동으로 진행하도록 지시했다.
- Implementation / Changed files: 설정 변경은 대시보드(사용자). 설정 이전에 병합된 M1·M2 1차 변경은 수동 배포로 반영.
- Verification / Evidence: Render service `autoDeployTrigger: checksPass` 확인, deploy `dep-dbg44jhsrm7s73ceufig` live (`27bf7c5`).
- Outcome / remaining risk: 공개 URL 응답은 이 환경에서 확인하지 못해 사용자 확인 필요. 이슈 해결.

