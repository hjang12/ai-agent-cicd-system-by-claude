# ADR 0002 — AI Workspace Monorepo (by-claude)

- Status: Accepted
- Date: 2026-10-26
- Scope: Workspace Repository structure
- Related: `GOVERNANCE/docs/ADR/0001-governance-versioning.md`

## Context

`hjang12/ai-agent-cicd-system-by-gpt`는 공통 Governance와 여러 프로젝트를 하나의 private monorepo로 운영한다. 같은 개발 방식을 Claude 기반 작업에도 적용하되, 두 Workspace의 변경이 서로 영향을 주지 않도록 저장소를 분리한다.

## Decision

`hjang12/ai-agent-cicd-system-by-claude`를 독립 private monorepo로 운영한다.

```text
hjang12/ai-agent-cicd-system-by-claude/
├── GOVERNANCE/
├── projects/
├── .github/workflows/
└── render.yaml        (첫 Render 서비스를 정의할 때 추가)
```

- 공통 Governance는 `by-gpt`의 Governance 1.4.7을 복사해 시작하며, 이후 이 저장소에서 독립적으로 버전 관리한다.
- `by-gpt`는 참고용 읽기 대상이며 이 Workspace의 작업으로 수정하지 않는다.
- 각 프로젝트는 `projects/<project>/` 경계를 유지하고, CI workflow는 root `.github/workflows/`에 둔다.
- Render는 프로젝트별 서비스를 분리하고 각 서비스의 Root Directory를 `projects/<project>`로 지정한다.

## Consequences

- 두 Workspace의 Governance는 복사 시점 이후 독립적으로 달라질 수 있다.
- 새 프로젝트마다 `projects/<project>/`의 `AGENT_START.md`, `AGENTS.md`, `docs/CURRENT_STATUS.md`가 필요하며 `tools/validate_workspace.py`가 이를 검증한다.

## Revisit Condition

- 두 Workspace의 Governance를 다시 하나로 통합해야 하는 경우
- Render 배포 단위 구조를 변경해야 하는 경우
