---
description: "Idempotent bootstrap of repo governance optimized for SOLO developers (zero required reviewers by default). Sets branch protection + strict checks, Husky v9+ hooks, and pnpm-cached CI with 🧹/🔎/🧠/🛠️ required contexts. Delegates to bootstrap-guardian agent."
argument-hint: "[--branch main] [--hook both|pre-commit|pre-push] [--team] [--reviews N]"
---

## Purpose
Bootstrap a repository with solo-first governance, strict quality gates, and modern tooling.

## Invocation Rule
**IMPORTANT**: This command MUST delegate the entire workflow to the bootstrap-guardian agent.
Do not attempt to implement the bootstrap logic directly - use the specialist agent.

## Default Behavior (Solo Mode)
- **Zero required reviewers** (PRs still required, checks are the gate)
- **Strict status checks** (base must be up-to-date with target)
- **Required checks**: 🧹 Format, 🔎 Lint, 🧠 Typecheck, 🛠️ Build
- **Auto-merge enabled** (merges when checks pass)
- **Auto-delete branches** (cleans up after merge)
- **Husky hooks**: Both pre-commit and pre-push
- **CI workflow**: GitHub Actions with pnpm caching

## Command Flags
- `--branch <name>`: Branch to protect (default: auto-detected, fallback to main)
- `--hook <both|pre-commit|pre-push>`: Which Husky hooks to install (default: both)
- `--team`: Switch to team mode (requires human reviews)
- `--reviews <N>`: Number of required reviewers in team mode (default: 1 when --team used)

## Examples
```bash
# Solo developer (default - no reviews required)
/bootstrap

# Solo with specific branch
/bootstrap --branch develop

# Team mode with 2 required reviewers
/bootstrap --team --reviews 2

# Only install pre-push hook
/bootstrap --hook pre-push

# Full team setup on staging branch
/bootstrap --branch staging --team --reviews 1 --hook both
```

## Context (Auto-collected)
- Repository: !`gh repo view --json name,owner --jq '.owner.login + "/" + .name' 2>/dev/null || echo "(not a GitHub repo)"`
- Default branch: !`gh repo view --json defaultBranchRef --jq '.defaultBranchRef.name' 2>/dev/null || git remote show origin 2>/dev/null | sed -n 's/.*HEAD branch: //p' || echo main`
- Package manager: !`[ -f pnpm-lock.yaml ] && echo "pnpm ✓" || ([ -f package-lock.json ] && echo "npm ✓" || echo "none")`
- Node.js: !`node -v 2>/dev/null || echo "not installed"`
- Git hooks: !`[ -d .husky ] && echo "Husky present" || echo "No Husky"`
- CI workflow: !`[ -f .github/workflows/ci.yml ] && echo "CI exists" || echo "No CI"`

## Pre-flight Checks
Before delegating to bootstrap-guardian, verify:
1. ✓ GitHub CLI authenticated (`gh auth status`)
2. ✓ In a git repository (`git rev-parse --git-dir`)
3. ✓ Has GitHub remote (`gh repo view`)
4. ✓ User has admin permissions (for branch protection)

## Instructions for bootstrap-guardian
Perform the idempotent bootstrap operation using the **bootstrap-guardian** and the provided flags:
1. Apply branch protection with configured review requirements
2. Set strict required status checks matching CI job names
3. Enable auto-merge and auto-delete branches
4. Install Husky hooks based on --hook flag
5. Create/update CI workflow with emoji job names
6. Commit changes with conventional commit message
7. Print final INFO/WARN/ERR report

## Success Criteria
- Branch protection active with correct settings
- Required checks enforced (🧹/🔎/🧠/🛠️)
- Husky hooks executable and configured
- CI workflow matches required check contexts
- Repository optimized for solo or team workflow as specified

## Troubleshooting
- **Permission denied**: Ensure you have admin access to the repository
- **GitHub CLI error**: Run `gh auth login` to authenticate
- **No package.json**: Husky setup will be skipped (warning issued)
- **Existing protection**: Settings will be updated (idempotent operation)

## Related Commands
- `/ship`: Ship code using the governed fast-path
- `/ship --nowait`: Create PR without waiting for merge
- `/ship --force`: Override failing checks (use with caution)