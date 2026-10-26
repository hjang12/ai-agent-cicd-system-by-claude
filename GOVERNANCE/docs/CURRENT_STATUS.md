# Current Status

## Canonical Workspace

- Repository: `hjang12/ai-agent-cicd-system-by-claude`
- Default branch: `main`
- Common Governance rule: `GOVERNANCE/GOVERNANCE.md`
- Canonical Governance version file: `GOVERNANCE/VERSION`
- Governance 1.4.7 is active on `main`. It was copied from `hjang12/ai-agent-cicd-system-by-gpt` on 2026-10-26 with only agent-name and repository-name references changed. The `by-gpt` repository was read-only during this work and is not modified.
- Repository visibility: public (GitHub Actions is free for standard runners on public repositories). GitHub `main` branch protection / Ruleset is not configured.

## Canonical Navigation

- `AGENT_START.md` / `AGENTS.md` — Workspace startup and operating instructions
- `GOVERNANCE/GOVERNANCE.md` — shared rules
- `GOVERNANCE/docs/DEVELOPMENT_TASKS.md` — Task selection and Status
- `GOVERNANCE/docs/ACTIVE_ISSUES.md` — current unresolved Workspace issues
- `GOVERNANCE/docs/checkpoints/` and each Task's listed Checkpoint — recoverable task state
- `projects/<project>/AGENT_START.md`, `AGENTS.md`, and `docs/CURRENT_STATUS.md` — project-specific navigation and current facts 
- `GOVERNANCE/docs/DEVELOPMENT_HISTORY.md`, ADRs and project Evidence — historical decisions and detailed results
- `GOVERNANCE/CHANGELOG.md` — Governance version history (inherited baseline from `by-gpt`)

These files have distinct responsibilities. Do not copy the same current status or executable Next Action into multiple current-facing documents.

## Current Task State

- `TASK-20261026-0001` Workspace bootstrap — COMPLETED.
- `TASK-20261026-0002` soldier-gate-runner-by-claude — **ACTIVE**. Checkpoint: `GOVERNANCE/docs/checkpoints/TASK-20261026-0002.md`.

The Task Registry Status is authoritative for whether a Next Action may run.

## Projects and Verification

- `projects/soldier-gate-runner-by-claude` — 병사 게이트 러너 (정적 사이트, Render Static Site).
- Workspace structural validation: `.github/workflows/workspace-validation.yml` (runs `tools/validate_workspace.py`).
- Project CI: `.github/workflows/soldier-gate-runner-ci.yml` (static tests + Chromium smoke).
- Render: root `render.yaml` declares `soldier-gate-runner-by-claude` (static, `autoDeployTrigger: checksPass`). The live Render service currently has Auto-Deploy off (ISSUE-20261026-0002); deploys are manual after main CI passes.

## Context Recovery

Use the single procedure in §25-A-7 of `GOVERNANCE/GOVERNANCE.md`: identify the Request-matching Task and Status first, then read its designated Context / Checkpoint and verify actual GitHub / CI / Deployment state.
