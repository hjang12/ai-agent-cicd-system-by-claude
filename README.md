# AI Workspace by Claude

이 저장소는 Claude 기반 개발 작업의 단일 Source of Truth입니다. 개발 방식과 Governance는 `ai-agent-cicd-system-by-gpt`를 기준으로 시작했으며, 이후 이 저장소에서 독립적으로 관리합니다.

## 구조

- `GOVERNANCE/` — 공통 운영 규칙, Agent 시작 문서, 설계 기록, 템플릿
- `projects/` — 개별 프로젝트 (아직 없음)
- `.github/workflows/` — 프로젝트별 CI와 Workspace 구조 검증
- `tools/` — Workspace 검증 스크립트
- `render.yaml` — 첫 Render 서비스를 정의할 때 추가

## 작업 순서

1. `GOVERNANCE/GOVERNANCE.md` 확인
2. 작업 대상 프로젝트의 `AGENT_START.md`와 `AGENTS.md` 확인
3. 해당 프로젝트의 `docs/CURRENT_STATUS.md`, 코드, 테스트, CI 상태 확인
4. 최소 변경 → 테스트 → 커밋 → Render 배포 검증

프로젝트 간 경계를 유지하고 다른 프로젝트의 동작을 불필요하게 변경하지 않습니다.
