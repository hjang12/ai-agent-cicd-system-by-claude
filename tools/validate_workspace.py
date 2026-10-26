from __future__ import annotations

from pathlib import Path
import re
import sys


ROOT = Path(__file__).resolve().parents[1]

REQUIRED_PATHS = (
    Path("AGENT_START.md"),
    Path("AGENTS.md"),
    Path("README.md"),
    Path("GOVERNANCE/AGENT_START.md"),
    Path("GOVERNANCE/GOVERNANCE.md"),
    Path("GOVERNANCE/VERSION"),
    Path("GOVERNANCE/CHANGELOG.md"),
    Path("GOVERNANCE/docs/CURRENT_STATUS.md"),
    Path("GOVERNANCE/docs/ACTIVE_ISSUES.md"),
    Path("GOVERNANCE/docs/DEVELOPMENT_TASKS.md"),
    Path("GOVERNANCE/docs/DEVELOPMENT_HISTORY.md"),
    Path("GOVERNANCE/docs/ADR/0002-ai-workspace-monorepo.md"),
    Path(".github/workflows/workspace-validation.yml"),
)

REQUIRED_PROJECT_FILES = (
    Path("AGENT_START.md"),
    Path("AGENTS.md"),
    Path("docs/CURRENT_STATUS.md"),
)


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except OSError as exc:
        raise SystemExit(f"workspace validation: cannot read {path}: {exc}") from exc


def validate_paths() -> list[str]:
    errors = []
    for relative in REQUIRED_PATHS:
        if not (ROOT / relative).exists():
            errors.append(f"missing required path: {relative}")
    return errors


def project_dirs() -> list[Path]:
    projects = ROOT / "projects"
    if not projects.is_dir():
        return []
    return sorted(child for child in projects.iterdir() if child.is_dir())


def validate_projects() -> list[str]:
    """Every project under projects/ needs its own navigation files and no nested Git metadata."""
    errors = []
    for project in project_dirs():
        for relative in REQUIRED_PROJECT_FILES:
            if not (project / relative).exists():
                errors.append(f"missing required path: {project.relative_to(ROOT) / relative}")
        if (project / ".git").exists():
            errors.append(f"nested Git metadata is not allowed: {project / '.git'}")
    return errors


def validate_render_blueprint() -> list[str]:
    """When render.yaml exists, each service must be CI-gated and point at existing paths."""
    blueprint = ROOT / "render.yaml"
    if not blueprint.exists():
        return []
    text = read_text(blueprint)
    errors = []
    blocks = re.split(r"\n  - type:", text)[1:]
    if not blocks:
        errors.append("render.yaml declares no services")
    for block in blocks:
        name_match = re.search(r"^\s+name:\s*(\S+)", block, re.MULTILINE)
        name = name_match.group(1) if name_match else "<unnamed>"
        trigger = re.search(r"^\s+autoDeployTrigger:\s*(\S+)", block, re.MULTILINE)
        if not trigger:
            errors.append(f"render.yaml service {name} missing autoDeployTrigger")
        elif trigger.group(1) not in ("checksPass", "off"):
            errors.append(
                f"render.yaml service {name} autoDeployTrigger must be checksPass or off, got {trigger.group(1)}"
            )
        for key in ("rootDir", "staticPublishPath"):
            path_match = re.search(rf"^\s+{key}:\s*(\S+)", block, re.MULTILINE)
            if path_match and not (ROOT / path_match.group(1)).exists():
                errors.append(f"render.yaml service {name} {key} does not exist: {path_match.group(1)}")
    return errors


def validate_governance_version_values(
    version: str,
    governance_text: str,
    changelog_text: str,
    current_status_text: str,
) -> list[str]:
    """Ensure current-facing Governance version references match the canonical version."""
    errors = []
    version = version.strip()
    if not re.fullmatch(r"\d+\.\d+\.\d+", version):
        return [f"GOVERNANCE/VERSION must contain a semantic version (X.Y.Z), got: {version!r}"]

    header_match = re.search(
        r"^\*\*Governance Version:\s*(\d+\.\d+\.\d+)\*\*\s*$",
        governance_text,
        re.MULTILINE,
    )
    if not header_match:
        errors.append("GOVERNANCE/GOVERNANCE.md is missing its Governance Version header")
    elif header_match.group(1) != version:
        errors.append(
            f"GOVERNANCE/GOVERNANCE.md version {header_match.group(1)} "
            f"does not match GOVERNANCE/VERSION {version}"
        )

    changelog_match = re.search(
        r"^## \[(\d+\.\d+\.\d+)\] - \d{4}-\d{2}-\d{2}\s*$",
        changelog_text,
        re.MULTILINE,
    )
    if not changelog_match:
        errors.append("GOVERNANCE/CHANGELOG.md is missing a dated release header")
    elif changelog_match.group(1) != version:
        errors.append(
            f"GOVERNANCE/CHANGELOG.md latest version {changelog_match.group(1)} "
            f"does not match GOVERNANCE/VERSION {version}"
        )

    status_match = re.search(
        r"^- Governance (\d+\.\d+\.\d+) is active on `main`",
        current_status_text,
        re.MULTILINE,
    )
    if not status_match:
        errors.append(
            "GOVERNANCE/docs/CURRENT_STATUS.md must identify the active Governance version on main"
        )
    elif status_match.group(1) != version:
        errors.append(
            f"GOVERNANCE/docs/CURRENT_STATUS.md active version {status_match.group(1)} "
            f"does not match GOVERNANCE/VERSION {version}"
        )

    return errors


def validate_governance_version() -> list[str]:
    return validate_governance_version_values(
        read_text(ROOT / "GOVERNANCE/VERSION"),
        read_text(ROOT / "GOVERNANCE/GOVERNANCE.md"),
        read_text(ROOT / "GOVERNANCE/CHANGELOG.md"),
        read_text(ROOT / "GOVERNANCE/docs/CURRENT_STATUS.md"),
    )


def main() -> int:
    errors = validate_paths()
    if not errors:
        errors.extend(validate_governance_version())
    errors.extend(validate_projects())
    errors.extend(validate_render_blueprint())

    if errors:
        print("Workspace validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("Workspace validation passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
