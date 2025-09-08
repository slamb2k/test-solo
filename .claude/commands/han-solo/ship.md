---
description: "Ship code with a governed fast-path tailored for SOLO devs: rebase onto origin/<default>, create/update PR, WAIT for required checks by default, then squash-merge & clean up. Use --nowait for PR-only. Use --force to override failing checks (explicit only)."
argument-hint: "[--nowait] [--force] [--title \"title\"] [--branch-name name] [--body \"description\"] [--draft]"
---

## Purpose
Ship your code changes through a governed fast-path optimized for solo developers. Creates PRs, waits for checks, and merges automatically when green.

## Invocation Rule
**IMPORTANT**: This command MUST delegate the entire workflow to the git-shipper agent.
Do not attempt to implement the shipping logic directly - use the specialist agent.

## Default Behavior
1. **Rebase** current branch onto origin/<default> for clean history
2. **Run checks** using Nx affected (if available) or standard scripts
3. **Create/update PR** with auto-generated title and body from commits
4. **Wait for checks** to pass (default behavior)
5. **Auto-merge** when all required checks are green
6. **Clean up** both local and remote branches
7. **Run /scrub --quiet** automatically after successful merge for comprehensive branch cleanup

## Command Flags
- `--nowait`: Create/update PR only, don't wait for merge
- `--force`: Allow merge even with failing checks (requires explicit intent)
- `--title "<text>"`: Set explicit PR title (overrides auto-generation)
- `--branch-name <n>`: Set explicit branch name when creating from default
- `--body "<text>"`: Set explicit PR body (overrides auto-generation)
- `--draft`: Create PR as draft

## Examples
```bash
# Standard ship (wait for checks, then merge)
/ship

# Quick PR creation without waiting
/ship --nowait

# Override with custom title
/ship --title "Add user authentication system"

# Force merge despite failures (use with caution!)
/ship --force

# Full control over PR
/ship --title "Fix critical bug" --body "Resolves issue #123" --nowait

# Create draft PR for early feedback
/ship --draft --nowait

# Ship from main with specific branch name
/ship --branch-name feat/new-feature
```

## Context (Auto-collected)
- Repository: !`gh repo view --json name,owner --jq '.owner.login + "/" + .name' 2>/dev/null || echo "(not a GitHub repo)"`
- Default branch: !`gh repo view --json defaultBranchRef --jq '.defaultBranchRef.name' 2>/dev/null || git remote show origin 2>/dev/null | sed -n 's/.*HEAD branch: //p' || echo main`
- Current branch: !`git branch --show-current 2>/dev/null || echo "(detached)"`
- Uncommitted changes: !`git status --porcelain=v1 | wc -l | xargs -I {} echo "{} file(s)"`
- Commits ahead: !`git rev-list --count origin/$(git remote show origin | sed -n 's/.*HEAD branch: //p')..HEAD 2>/dev/null || echo "0"`
- Last commit: !`git log -1 --pretty=format:"%h %s" 2>/dev/null || echo "no commits"`

## Pre-flight Checks
Before delegating to git-shipper, verify:
1. ✓ In a git repository (`git rev-parse --git-dir`)
2. ✓ GitHub CLI authenticated (`gh auth status`)
3. ✓ Has commits to ship (`git log -1`)
4. ✓ Remote is accessible (`git fetch --dry-run`)

## Workflow Steps (handled by git-shipper)

### 1. Branch Management
- If on default branch, create feature branch
- If on feature branch, use existing
- Rebase onto origin/<default> for clean history

### 2. Quality Checks
- Install dependencies if needed
- Run Nx affected targets if Nx detected:
  - `nx affected -t lint,typecheck,test,build`
- Otherwise run standard npm scripts:
  - `format:check` or `format`
  - `lint`, `typecheck`, `test`, `build`

### 3. PR Creation
- **Title generation priority**:
  1. Explicit `--title` flag
  2. First conventional commit message
  3. Branch name humanized
  4. Fallback: "Update YYYY-MM-DD"
  
- **Body generation**:
  - Categorizes commits by type (feat, fix, docs, etc.)
  - Highlights breaking changes
  - Provides clean summary with emojis

### 4. Merge Strategy
- **Default**: Wait for checks and merge
- **--nowait**: Stop after PR creation
- **--force**: Merge even with failures
- Uses squash merge for clean history
- Auto-deletes branches after merge

## Instructions for git-shipper
Execute the complete shipping workflow using the **git-shipper** sub-agent:
1. Validate repository state and authentication
2. Sync with remote and rebase if needed
3. Run all configured checks (Nx or standard)
4. Create or update PR with meaningful metadata
5. Handle merge based on flags (wait/nowait/force)
6. Clean up branches after successful merge
7. Provide comprehensive INFO/WARN/ERR report

After git-shipper completes successfully (exit code 0), automatically run `/scrub --quiet` to perform comprehensive branch cleanup of all merged and orphaned branches.

## Success Criteria
- Clean rebase without conflicts
- All checks passing (or explicitly overridden)
- PR created with descriptive title and body
- Successful merge to default branch
- Branches cleaned up locally and remotely
- Automatic /scrub cleanup of all merged branches
- Clear report of all actions taken

## Troubleshooting

### Common Issues
- **Rebase conflicts**: Resolve manually, then re-run `/ship`
- **Check failures**: Review CI logs, fix issues, or use `--force` if certain
- **No commits**: Make at least one commit before shipping
- **Auth issues**: Run `gh auth login` to authenticate

### Recovery Commands
```bash
# Abort a failed rebase
git rebase --abort

# Check PR status
gh pr checks

# View PR in browser
gh pr view --web

# Manual merge if needed
gh pr merge --squash --delete-branch
```

## Related Commands
- `/bootstrap`: Set up repository governance before first ship
- `/bootstrap --team`: Switch to team mode with required reviews
- `/scrub`: Comprehensive branch cleanup (automatically run after successful ship)

## Best Practices
1. **Commit often**: Use conventional commits for better PR descriptions
2. **Ship small**: Smaller PRs are easier to review and less likely to conflict
3. **Don't force**: Only use `--force` when you're certain checks are false positives
4. **Stay current**: Regularly sync with the default branch to avoid conflicts

## Exit Codes
- `0`: Success (PR shipped or created)
- `1`: Error (check report for details)