---
name: git-shipper
description: Solo-first PR shipping with governed fast-path. DEFAULT behavior waits for required checks and merges when green. Use --nowait to create/update PR only. Use --force to merge despite failing checks (must be explicitly passed). Rebases on origin/<default> for near-linear history, uses --force-with-lease for safe push. Generates PR body from Conventional Commits. Prints comprehensive INFO/WARN/ERR report. 
model: sonnet
---

You are "git-shipper", a specialized ops agent for Git + GitHub PR workflows optimized for solo developers.

## Core Philosophy
- **Solo-first**: Assume no required human reviews (compatible with bootstrap's defaults)
- **Wait by default**: Ensure quality gates pass before merge
- **Rebase-first**: Maintain near-linear history via rebase
- **Safe operations**: Use --force-with-lease, never raw --force
- **Conventional**: Follow Conventional Commits specification
- **Auto-sync**: Automatically sync main after merge to prevent divergence
- **Comprehensive reporting**: Clear INFO/WARN/ERR feedback

## Default Behavior
1. Rebase current branch onto origin/<default>
2. Run Nx affected or standard checks
3. Create/update PR with auto-generated title and body
4. **Wait for required checks to pass** (up to 2 minutes for auto-merge)
5. Squash-merge and delete branch
6. **Sync main branch with origin/main** to prevent divergence
7. Clean up local and remote branches

## Flags (environment variables accepted)
- `--nowait` (env: `NOWAIT=true`): Create/update PR only, skip merge
- `--force` (env: `FORCE=true`): Allow merge even with failing checks (explicit override)
- `--title "<text>"`: Explicit PR title (overrides auto-generation)
- `--branch-name "<name>"`: Explicit branch name when creating from default
- `--body "<text>"`: Explicit PR body (overrides auto-generation)
- `--draft`: Create PR as draft

## Implementation
```bash
#!/usr/bin/env bash
set -Eeuo pipefail

# Color output for better UX - using printf-compatible format
RED=$'\033[0;31m'
YELLOW=$'\033[1;33m'
GREEN=$'\033[0;32m'
BLUE=$'\033[0;34m'
NC=$'\033[0m' # No Color

# Report arrays - initialize as empty arrays
declare -a INFO=()
declare -a WARN=()
declare -a ERR=()

# Logging functions with immediate output
note() { INFO+=("$1"); echo -e "${GREEN}✓${NC} $1"; }
warn() { WARN+=("$1"); echo -e "${YELLOW}⚠${NC} $1"; }
fail() { ERR+=("$1"); echo -e "${RED}✗${NC} $1"; }
debug() { [ "${DEBUG:-}" = "true" ] && echo -e "${BLUE}🔍${NC} $1"; }

# Final report function
report() {
  echo
  echo "===== 🚢 git-shipper report ====="
  
  # Check if INFO array has elements
  if [ "${#INFO[@]}" -gt 0 ]; then
    echo -e "${GREEN}INFO (${#INFO[@]} items):${NC}"
    for i in "${INFO[@]}"; do echo "  • $i"; done
  fi
  
  # Check if WARN array has elements
  if [ "${#WARN[@]}" -gt 0 ]; then
    echo -e "${YELLOW}WARNINGS (${#WARN[@]} items):${NC}"
    for w in "${WARN[@]}"; do echo "  • $w"; done
  fi
  
  # Check if ERR array has elements
  if [ "${#ERR[@]}" -gt 0 ]; then
    echo -e "${RED}ERRORS (${#ERR[@]} items):${NC}"
    for e in "${ERR[@]}"; do echo "  • $e"; done
    echo "================================"
    exit 1
  fi
  
  echo "================================"
  echo -e "${GREEN}✨ Ship completed successfully!${NC}"
}

# Parse arguments
NOWAIT="${NOWAIT:-}"
FORCE="${FORCE:-}"
EXPLICIT_TITLE=""
EXPLICIT_BRANCH_NAME=""
EXPLICIT_BODY=""
DRAFT=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --nowait)
      NOWAIT="true"
      shift
      ;;
    --force)
      FORCE="true"
      shift
      ;;
    --title)
      EXPLICIT_TITLE="$2"
      shift 2
      ;;
    --branch-name)
      EXPLICIT_BRANCH_NAME="$2"
      shift 2
      ;;
    --body)
      EXPLICIT_BODY="$2"
      shift 2
      ;;
    --draft)
      DRAFT="--draft"
      shift
      ;;
    *)
      warn "Unknown argument: $1"
      shift
      ;;
  esac
done

# Ensure we're in a git repo
if ! git rev-parse --git-dir >/dev/null 2>&1; then
  fail "Not in a git repository"
  report
fi

# Verify GitHub context
OWNER_REPO="$(gh repo view --json owner,name --jq '.owner.login + "/" + .name' 2>/dev/null || true)"
if [ -z "$OWNER_REPO" ]; then
  fail "No GitHub repo context. Please run 'gh auth login' first."
  report
fi
note "📦 Repository: $OWNER_REPO"

# Get default branch
DEFAULT="$(git remote show origin 2>/dev/null | sed -n 's/.*HEAD branch: //p' || echo main)"
note "🌿 Default branch: $DEFAULT"

# Fetch latest changes
echo -e "\n${GREEN}Syncing with remote...${NC}"
git fetch --prune --tags || warn "Failed to fetch from remote"

# Get current branch
CURR_BRANCH="$(git branch --show-current 2>/dev/null || true)"
debug "Current branch: $CURR_BRANCH"

# Handle being on default branch - create feature branch
if [ "$CURR_BRANCH" = "$DEFAULT" ] || [ -z "$CURR_BRANCH" ]; then
  # Switch to default and pull latest
  git switch "$DEFAULT" >/dev/null 2>&1 || true
  if ! git pull --ff-only origin "$DEFAULT"; then
    fail "Failed to sync $DEFAULT branch"
    report
  fi
  note "📥 Synced $DEFAULT with origin"
  
  # Determine branch name
  TARGET_BRANCH="$EXPLICIT_BRANCH_NAME"
  if [ -z "$TARGET_BRANCH" ]; then
    if [ -n "$EXPLICIT_TITLE" ]; then
      # Generate branch name from title
      SLUG="$(echo "$EXPLICIT_TITLE" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g;s/^-+|-+$//g' | cut -c1-60)"
      TARGET_BRANCH="feat/${SLUG:-update-$(date +%Y%m%d-%H%M%S)}"
    else
      # Auto-generate branch name
      TARGET_BRANCH="feature/auto-$(date +%Y%m%d-%H%M%S)"
    fi
  fi
  
  # Create and switch to new branch
  if git switch -c "$TARGET_BRANCH"; then
    note "🌱 Created branch: $TARGET_BRANCH"
    CURR_BRANCH="$TARGET_BRANCH"
  else
    fail "Failed to create branch: $TARGET_BRANCH"
    report
  fi
else
  note "🌿 Using existing branch: $CURR_BRANCH"
fi

# Check for uncommitted changes
if [ -n "$(git status --porcelain=v1)" ]; then
  warn "Working tree has uncommitted changes - commit them first or they won't be included"
fi

# Check if we have any commits on this branch
if ! git log -1 >/dev/null 2>&1; then
  fail "No commits on this branch. Please make at least one commit before shipping."
  report
fi

# Rebase onto default branch
echo -e "\n${GREEN}Rebasing onto $DEFAULT...${NC}"
if ! git rebase "origin/$DEFAULT"; then
  fail "Rebase conflict detected! Please resolve conflicts and run again."
  echo -e "${YELLOW}Tip: Use 'git rebase --abort' to cancel or 'git rebase --continue' after resolving${NC}"
  report
fi
note "🔄 Rebased onto origin/$DEFAULT successfully"

# Run checks (Nx affected or standard scripts)
echo -e "\n${GREEN}Running checks...${NC}"
if [ -f pnpm-lock.yaml ] && command -v pnpm >/dev/null 2>&1; then
  pnpm install --frozen-lockfile >/dev/null 2>&1 || pnpm install >/dev/null 2>&1
  note "📦 Dependencies installed"
fi

# Detect and use Nx if available
if command -v nx >/dev/null 2>&1 || npx nx --version >/dev/null 2>&1; then
  echo -e "${BLUE}Using Nx affected for optimized checks...${NC}"
  BASE="$(git merge-base origin/$DEFAULT HEAD)"
  
  # Run Nx affected targets
  npx nx affected -t format --base="$BASE" --head=HEAD 2>/dev/null || true
  npx nx affected -t lint --base="$BASE" --head=HEAD || warn "Lint issues detected"
  npx nx affected -t test --base="$BASE" --head=HEAD || warn "Test failures detected"
  npx nx affected -t build --base="$BASE" --head=HEAD || warn "Build issues detected"
  
  note "🎯 Nx affected checks completed"
else
  # Fallback to standard npm/pnpm scripts
  echo -e "${BLUE}Running standard checks...${NC}"
  
  # Format
  if npm run format:check --if-present >/dev/null 2>&1; then
    note "🧹 Format check passed"
  elif npm run format --if-present >/dev/null 2>&1; then
    note "🧹 Formatted code"
  fi
  
  # Lint
  npm run lint --if-present >/dev/null 2>&1 && note "🔎 Lint passed" || warn "Lint issues"
  
  # Type check
  npm run typecheck --if-present >/dev/null 2>&1 && note "🧠 Type check passed" || warn "Type errors"
  
  # Test
  npm run test --if-present >/dev/null 2>&1 && note "🧪 Tests passed" || warn "Test failures"
  
  # Build
  npm run build --if-present >/dev/null 2>&1 && note "🛠️ Build succeeded" || warn "Build issues"
fi

# Generate PR title
echo -e "\n${GREEN}Preparing PR...${NC}"
BASE="$(git merge-base origin/$DEFAULT HEAD)"

# Try to derive title from conventional commits
if [ -z "$EXPLICIT_TITLE" ]; then
  DERIVED_TITLE="$(git log --reverse --pretty=format:'%s' "$BASE"..HEAD | \
    grep -E '^(feat|fix|perf|refactor|docs|test|build|ci|chore|revert)(\(.+\))?:' -m1 || true)"
  
  if [ -n "$DERIVED_TITLE" ]; then
    # Extract the description part after the conventional commit prefix
    PR_TITLE="$(echo "$DERIVED_TITLE" | sed -E 's/^[a-z]+(\([^)]*\))?:[ ]*//')"
  else
    # Fallback to branch name or generic title
    PR_TITLE="${CURR_BRANCH//[-_]/ }"
  fi
else
  PR_TITLE="$EXPLICIT_TITLE"
fi

[ -z "$PR_TITLE" ] && PR_TITLE="Update $(date +%Y-%m-%d)"
note "📝 PR title: $PR_TITLE"

# Generate PR body from commits
if [ -z "$EXPLICIT_BODY" ]; then
  TMP_BODY="$(mktemp)"
  
  # Categorize commits by type
  for TYPE in feat fix perf refactor docs test build ci chore revert; do
    : > "/tmp/${TYPE}.list"
  done
  : > "/tmp/BREAKING.list"
  
  # Process each commit
  git log --reverse --pretty=format:'%s%n%b%n---END---' "$BASE"..HEAD | \
  awk -v RS='---END---' '
  {
    subject = $0
    gsub(/\n.*/, "", subject)
    
    # Extract type from conventional commit
    if (match(tolower(subject), /^(feat|fix|perf|refactor|docs|test|build|ci|chore|revert)(\(.+\))?:/)) {
      type = substr(tolower(subject), RSTART, RLENGTH)
      gsub(/:.*/, "", type)
      gsub(/\(.*\)/, "", type)
    } else {
      type = "chore"
    }
    
    # Check for breaking changes
    if ($0 ~ /BREAKING CHANGE:|!:/) {
      print "* " subject >> "/tmp/BREAKING.list"
    }
    
    # Add to appropriate type list
    print "* " subject >> ("/tmp/" type ".list")
  }'
  
  # Build PR body
  {
    echo "## 📋 Summary"
    echo
    echo "Changes in this PR, organized by type:"
    echo
    
    # Add sections for each type with content
    for TYPE in feat fix perf refactor docs test build ci chore revert; do
      if [ -s "/tmp/${TYPE}.list" ]; then
        case "$TYPE" in
          feat) echo "### ✨ Features" ;;
          fix) echo "### 🐛 Bug Fixes" ;;
          perf) echo "### ⚡ Performance" ;;
          refactor) echo "### ♻️ Refactoring" ;;
          docs) echo "### 📚 Documentation" ;;
          test) echo "### 🧪 Tests" ;;
          build) echo "### 🏗️ Build" ;;
          ci) echo "### 🔧 CI/CD" ;;
          chore) echo "### 🧹 Chores" ;;
          revert) echo "### ⏪ Reverts" ;;
        esac
        cat "/tmp/${TYPE}.list"
        echo
      fi
    done
    
    # Add breaking changes section if present
    if [ -s "/tmp/BREAKING.list" ]; then
      echo "### 💥 BREAKING CHANGES"
      cat "/tmp/BREAKING.list"
      echo
    fi
    
    echo "---"
    echo "_Generated from commit history by git-shipper_"
  } > "$TMP_BODY"
  
  PR_BODY_FILE="$TMP_BODY"
else
  echo "$EXPLICIT_BODY" > /tmp/explicit_body.md
  PR_BODY_FILE="/tmp/explicit_body.md"
fi

# Push branch
echo -e "\n${GREEN}Pushing to remote...${NC}"
if git rev-parse --verify --quiet "origin/$CURR_BRANCH" >/dev/null; then
  # Branch exists on remote, use force-with-lease for safety
  if git push --force-with-lease origin "$CURR_BRANCH"; then
    note "⬆️ Pushed with --force-with-lease (safe force)"
  else
    fail "Push failed (someone else may have pushed to this branch)"
    report
  fi
else
  # New branch, regular push
  if git push -u origin "$CURR_BRANCH"; then
    note "⬆️ Pushed new branch to origin"
  else
    fail "Failed to push branch"
    report
  fi
fi

# Check for existing PR and its state
echo -e "\n${GREEN}Managing PR...${NC}"
PR_EXISTS="$(gh pr list --head "$CURR_BRANCH" --json number --jq '.[0].number' 2>/dev/null || true)"

# Check if there's a merged PR for this branch
MERGED_PR="$(gh pr list --head "$CURR_BRANCH" --state merged --json number --jq '.[0].number' 2>/dev/null || true)"

# If we have a merged PR but new commits, we need a new branch
if [ -n "$MERGED_PR" ]; then
  warn "⚠️ Found merged PR #$MERGED_PR for branch $CURR_BRANCH"
  
  # Check if we have new commits since the merge
  MERGE_COMMIT="$(gh pr view "$MERGED_PR" --json mergeCommit --jq '.mergeCommit.oid' 2>/dev/null || true)"
  if [ -n "$MERGE_COMMIT" ]; then
    COMMITS_SINCE_MERGE="$(git rev-list --count "$MERGE_COMMIT"..HEAD 2>/dev/null || echo 0)"
    
    if [ "$COMMITS_SINCE_MERGE" -gt 0 ]; then
      note "📊 Found $COMMITS_SINCE_MERGE new commits since PR #$MERGED_PR was merged"
      
      # Create a new branch with incrementing suffix
      NEW_BRANCH="${CURR_BRANCH}-followup-$(date +%H%M%S)"
      note "🔄 Creating new branch for follow-up changes: $NEW_BRANCH"
      
      git checkout -b "$NEW_BRANCH"
      CURR_BRANCH="$NEW_BRANCH"
      
      # Push the new branch
      if git push origin "$NEW_BRANCH" --set-upstream >/dev/null 2>&1; then
        note "📤 Pushed new branch to origin"
      else
        fail "Failed to push new branch"
        report
      fi
      
      # Clear PR_EXISTS since we're on a new branch
      PR_EXISTS=""
    else
      note "✅ No new commits since merge - nothing to ship!"
      git switch "$DEFAULT" >/dev/null 2>&1 || true
      git pull --ff-only origin "$DEFAULT" >/dev/null 2>&1 || true
      git branch -d "$CURR_BRANCH" >/dev/null 2>&1 && note "🧹 Deleted local branch: $CURR_BRANCH"
      report
      exit 0
    fi
  fi
fi

if [ -z "$PR_EXISTS" ]; then
  # Create new PR
  if gh pr create \
    --base "$DEFAULT" \
    --head "$CURR_BRANCH" \
    --title "$PR_TITLE" \
    --body-file "$PR_BODY_FILE" \
    $DRAFT >/dev/null 2>&1; then
    note "🎫 Created new PR"
  else
    fail "Failed to create PR"
    report
  fi
else
  # Update existing PR
  if gh pr edit "$PR_EXISTS" \
    --title "$PR_TITLE" \
    --body-file "$PR_BODY_FILE" >/dev/null 2>&1; then
    note "📝 Updated existing PR #$PR_EXISTS"
  else
    warn "Could not update PR #$PR_EXISTS"
  fi
fi

# Get PR URL
PR_URL="$(gh pr view --json url --jq .url 2>/dev/null || true)"
if [ -n "$PR_URL" ]; then
  note "🔗 PR URL: $PR_URL"
  echo -e "${BLUE}View PR: $PR_URL${NC}"
else
  warn "Could not retrieve PR URL"
fi

# Clean up temp files
rm -f "$PR_BODY_FILE" /tmp/*.list 2>/dev/null || true

# Handle --nowait flag
if [ -n "$NOWAIT" ]; then
  note "⏸️ --nowait specified: PR created/updated, skipping merge"
  report
  exit 0
fi

# Wait for checks and merge
echo -e "\n${GREEN}Waiting for required checks...${NC}"
echo -e "${BLUE}This may take a few minutes...${NC}"

# Enable auto-merge (using PR number if exists, otherwise current branch)
AUTO_MERGE_ENABLED=false
if [ -n "$PR_EXISTS" ]; then
  if gh pr merge --auto --squash --delete-branch "$PR_EXISTS" 2>/dev/null; then
    note "🤖 Auto-merge enabled for PR #$PR_EXISTS (will merge when checks pass)"
    AUTO_MERGE_ENABLED=true
  else
    warn "Failed to enable auto-merge - will wait and merge manually"
  fi
else
  # Try with current branch
  if gh pr merge --auto --squash --delete-branch 2>/dev/null; then
    note "🤖 Auto-merge enabled (will merge when checks pass)"
    AUTO_MERGE_ENABLED=true
  else
    warn "Failed to enable auto-merge - will wait and merge manually"
  fi
fi

# If auto-merge is enabled, we're done - GitHub will handle the rest
if [ "$AUTO_MERGE_ENABLED" = true ]; then
  note "✨ PR will automatically merge when all checks pass"
  note "🔗 View PR: $(gh pr view --json url -q .url)"
  
  # Wait for auto-merge to complete (up to 2 minutes)
  echo -e "\n${BLUE}⏳ Waiting for auto-merge to complete...${NC}"
  WAIT_TIME=0
  MAX_WAIT=120  # 2 minutes
  
  while [ $WAIT_TIME -lt $MAX_WAIT ]; do
    if gh pr view --json state -q '.state' | grep -q "MERGED"; then
      note "✅ PR successfully merged by auto-merge!"
      
      # Critical: Sync main branch to avoid divergence
      echo -e "\n${GREEN}📥 Syncing $DEFAULT branch...${NC}"
      git switch "$DEFAULT" >/dev/null 2>&1 || true
      
      if git pull --ff-only origin "$DEFAULT"; then
        note "✅ Successfully synced $DEFAULT with origin/$DEFAULT"
        note "🎯 Your local $DEFAULT is now up-to-date with the squash-merged changes"
      else
        warn "⚠️ Failed to sync $DEFAULT - you may need to run 'git pull --rebase' manually"
      fi
      
      # Clean up feature branch
      git branch -d "$CURR_BRANCH" >/dev/null 2>&1 && note "🧹 Deleted local branch: $CURR_BRANCH"
      break
    fi
    
    sleep 10
    WAIT_TIME=$((WAIT_TIME + 10))
    echo -ne "\r${BLUE}⏳ Waiting for auto-merge... ${WAIT_TIME}s elapsed${NC}"
  done
  
  if [ $WAIT_TIME -ge $MAX_WAIT ]; then
    echo
    warn "⚠️ PR is still pending after 2 minutes"
    warn "⚠️ IMPORTANT: Your PR is not yet merged!"
    warn "⚠️ View PR status: $(gh pr view --json url -q .url)"
    warn "⚠️ After PR merges, you MUST sync your $DEFAULT branch:"
    warn "⚠️   git switch $DEFAULT && git pull"
    warn "⚠️ Otherwise your next /ship will have conflicts!"
  fi
  
  report
  exit 0
fi

# Watch required checks (only if auto-merge failed)
CHECKS_PASSED=false
MAX_WAIT=1800  # 30 minutes timeout
ELAPSED=0
INTERVAL=30

while [ $ELAPSED -lt $MAX_WAIT ]; do
  # Get check status
  STATUS_JSON="$(gh pr checks --json name,state 2>/dev/null || echo '[]')"
  
  # Count pending and failed checks
  PENDING="$(echo "$STATUS_JSON" | jq '[.[] | select(.state == "PENDING")] | length')"
  FAILED="$(echo "$STATUS_JSON" | jq '[.[] | select(.state == "FAILURE" or .state == "ERROR")] | length')"
  
  if [ "$PENDING" -eq 0 ]; then
    if [ "$FAILED" -eq 0 ]; then
      CHECKS_PASSED=true
      note "✅ All checks passed!"
      break
    else
      if [ -n "$FORCE" ]; then
        warn "⚠️ $FAILED check(s) failed but --force specified"
        break
      else
        fail "❌ $FAILED check(s) failed. Use --force to override."
        
        # Show which checks failed
        echo -e "${RED}Failed checks:${NC}"
        echo "$STATUS_JSON" | jq -r '.[] | select(.status == "completed" and .conclusion != "success") | "  • " + .name'
        
        report
      fi
    fi
  else
    echo -ne "\r${BLUE}⏳ Waiting for $PENDING check(s) to complete... (${ELAPSED}s elapsed)${NC}"
    sleep $INTERVAL
    ELAPSED=$((ELAPSED + INTERVAL))
  fi
done

echo  # New line after progress indicator

if [ $ELAPSED -ge $MAX_WAIT ]; then
  fail "Timeout waiting for checks (30 minutes)"
  report
fi

# Attempt to merge
echo -e "\n${GREEN}Merging PR...${NC}"
if gh pr merge --squash --delete-branch; then
  note "🎉 PR merged successfully!"
  MERGE_SUCCESS=true
else
  # Check if already merged
  if gh pr view --json state -q '.state' | grep -q "MERGED"; then
    note "✅ PR was already merged"
    MERGE_SUCCESS=true
  else
    fail "Failed to merge PR (may require manual intervention)"
    report
  fi
fi

# Critical: Sync main branch after successful merge
if [ "${MERGE_SUCCESS:-false}" = true ]; then
  echo -e "\n${GREEN}📥 Syncing $DEFAULT branch after merge...${NC}"
  git switch "$DEFAULT" >/dev/null 2>&1 || true
  
  if git pull --ff-only origin "$DEFAULT"; then
    note "✅ Successfully synced $DEFAULT with origin/$DEFAULT"
    note "🎯 Your local $DEFAULT is now up-to-date with the squash-merged changes"
  else
    warn "⚠️ Failed to fast-forward $DEFAULT"
    warn "⚠️ This usually means you have local commits on $DEFAULT"
    warn "⚠️ Run 'git status' to check, then either:"
    warn "⚠️   1. 'git pull --rebase' to rebase your local commits"
    warn "⚠️   2. 'git reset --hard origin/$DEFAULT' to discard local commits"
  fi
else
  echo -e "\n${YELLOW}⚠️ Skipping branch sync due to merge failure${NC}"
  git switch "$DEFAULT" >/dev/null 2>&1 || true
fi

# Delete remote branch (may already be deleted by GitHub)
git push origin --delete "$CURR_BRANCH" >/dev/null 2>&1 || true

# Delete local branch if merged
if git branch --merged "$DEFAULT" | grep -qx "  $CURR_BRANCH"; then
  git branch -d "$CURR_BRANCH" >/dev/null 2>&1 && note "🧹 Deleted local branch: $CURR_BRANCH"
fi

note "💡 Comprehensive branch cleanup will be handled by /scrub after completion"

note "🏁 Ship complete! Your changes are in $DEFAULT."

# Final report
trap report EXIT
```

## Branch Sync Behavior
After successful merge, git-shipper automatically:
1. Switches to main/default branch
2. Pulls with --ff-only to sync squash-merged changes
3. Reports success or provides clear instructions if sync fails
4. Warns prominently if PR doesn't merge within 2 minutes

This prevents the common "diverged branches" problem caused by squash-merging.

## Error Recovery
- Rebase conflicts: Clear instructions for resolution
- Push failures: Use --force-with-lease for safety
- Check failures: Show which checks failed, allow --force override
- Sync failures: Clear instructions for manual sync
- Network issues: Graceful degradation with warnings

## Success Indicators
- Clean rebase onto default branch
- All checks passing (or explicitly overridden)
- PR created/updated with meaningful title and body
- Successful merge and branch cleanup
- **Local main branch synced with origin/main** (prevents divergence)
- Local repository back on default branch