# scrub

Comprehensive branch scrubbing tool that safely removes merged and orphaned branches while preserving uncommitted work.

## Purpose
Clean up local and remote branches that have been fully merged, while protecting branches with unmerged commits. Provides detailed reporting of all cleanup actions.

**Note:** This command is automatically run with `--quiet` flag after successful `/ship` operations. You can also run it manually at any time for comprehensive branch cleanup.

## Usage
```bash
# Manual cleanup - prompts for questionable branches (recommended for periodic maintenance)
/scrub

# Force scrub - deletes even with potential data loss (use with caution!)
/scrub --force

# Quiet mode - no prompts, only safe deletions (used automatically by /ship)
/scrub --quiet

# Preview what would be deleted without making changes
/scrub --dry-run

# Combine flags for different behaviors
/scrub --quiet --dry-run  # Preview what quiet mode would delete
```

## Options
- `--force`: Delete branches even if they have unmerged commits (dangerous!)
- `--quiet`: Skip all prompts, only delete obviously safe branches (automatically used by `/ship`)
- `--dry-run`: Show what would be deleted without actually deleting

## When to Use Manually
- **Periodic maintenance**: Run `/scrub` weekly or monthly to keep your repository clean
- **After collaborative work**: Clean up feature branches from merged PRs
- **Before starting new work**: Ensure a clean workspace
- **After manual PR merges**: If you merged PRs outside of `/ship`
- **After squash-merges**: Automatically detects and cleans squash-merged branches

## What it does
1. **Fetches and prunes** remote references
2. **Identifies orphaned remote branches** with merged PRs
3. **Detects squash-merged branches** using multiple methods:
   - Checks if commits are cherry-pick equivalent
   - Compares cumulative patches for identical changes
   - Searches for PR merge commits referencing the branch
4. **Prompts for confirmation** on questionable branches (unless --force or --quiet)
5. **Cleans local branches** that are fully merged or squash-merged
6. **Provides detailed summary** of all actions taken

## Safety Features
- Never deletes branches with open PRs
- Shows commit preview before asking for deletion
- Default answer is "No" for all prompts
- Preserves branches with unmerged work by default
- Reports all preserved branches for manual review

## Example Output

### Standard Mode
```
🔍 Analyzing branches...
✓ Found 5 remote branches to check
✓ Found 3 local branches to check

⚠️ Branch feat/experimental has 3 unmerged commit(s)
Recent commits:
  abc123 fix: typo
  def456 test: add test
Delete this branch? (y/N): n
⏭️ Preserved feat/experimental

🗑️ Deleted orphaned remote: feat/old-feature (PR #5 merged)
🧹 Deleted local branch: fix/typo

📊 Cleanup Summary:
  • Deleted 2 remote branch(es)
  • Deleted 1 local branch(es)
  • Preserved 1 branch(es) with unmerged commits
    - feat/experimental (3 commits)
```

### Example with Squash-Merged Branches
```
🔍 Analyzing branches...
✓ Found 5 remote branches to check
✓ Found 3 local branches to check

🗑️ Deleted squash-merged remote: feat/new-feature (PR #10)
🧹 Deleted squash-merged local: feat/new-feature
🧹 Deleted squash-merged local: fix/bug-123
🧹 Deleted local branch: chore/cleanup

📊 Cleanup Summary:
  • Deleted 1 remote branch(es)
  • Deleted 3 local branch(es)
  • All squash-merged branches detected and cleaned
```

## Invocation rule
Always delegate to a general-purpose agent for execution.

## Instructions
Execute the branch cleanup workflow with these steps:

1. Parse command flags (--force, --quiet, --dry-run)
2. Fetch latest remote state and prune deleted references
3. Analyze all remote branches (except main/master)
4. For each remote branch:
   - Skip if has open PR
   - Check if PR was merged
   - Count unmerged commits
   - Prompt user if questionable (unless --force or --quiet)
   - Delete if safe or confirmed
5. Analyze all local branches
6. For each local branch:
   - Check if fully merged
   - Check for remote tracking
   - Count unmerged commits
   - Prompt if has local-only commits (unless --force or --quiet)
   - Delete if safe or confirmed
7. Generate comprehensive report

## Implementation script
```bash
#!/usr/bin/env bash
set -euo pipefail

# Parse arguments
FORCE=false
QUIET=false
DRY_RUN=false

for arg in "$@"; do
  case $arg in
    --force) FORCE=true ;;
    --quiet) QUIET=true ;;
    --dry-run) DRY_RUN=true ;;
  esac
done

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Get default branch
DEFAULT=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo 'main')

# Function to check if a branch has been squash-merged
is_squash_merged() {
  local BRANCH=$1
  local BASE=${2:-$DEFAULT}
  
  # Method 1: Check if all commits are cherry-picked/equivalent
  # git cherry returns '-' for commits that are equivalent in upstream
  local UNMERGED_COUNT=$(git cherry "$BASE" "$BRANCH" 2>/dev/null | grep '^+' | wc -l | xargs || echo 0)
  if [ "$UNMERGED_COUNT" -eq 0 ]; then
    return 0  # All commits are equivalent, branch is merged
  fi
  
  # Method 2: Check if the patch is empty when applied to base
  # This catches squash merges where the changes are already in base
  local PATCH_EMPTY=false
  local MERGE_BASE=$(git merge-base "$BASE" "$BRANCH" 2>/dev/null || true)
  if [ -n "$MERGE_BASE" ]; then
    # Get the cumulative diff and check if it's already applied
    local DIFF=$(git diff "$BASE"..."$BRANCH" 2>/dev/null | wc -l)
    if [ "$DIFF" -eq 0 ]; then
      PATCH_EMPTY=true
    fi
  fi
  
  if [ "$PATCH_EMPTY" = true ]; then
    return 0  # Changes are already in base
  fi
  
  # Method 3: Look for PR merge commits that reference this branch
  # Search for squash merge commits in the base branch
  local BRANCH_SHORT=${BRANCH#origin/}
  local SQUASH_COMMIT=$(git log "$BASE" --grep="$BRANCH_SHORT" --grep="(#[0-9]*)" --pretty=format:"%H" -n 1 2>/dev/null || true)
  if [ -n "$SQUASH_COMMIT" ]; then
    return 0  # Found a merge commit referencing this branch
  fi
  
  return 1  # Branch is not merged
}

echo -e "${GREEN}🔍 Analyzing branches...${NC}"

# Fetch and prune
git fetch --all --prune >/dev/null 2>&1
echo "✓ Fetched latest remote state"

# Track cleanup stats
REMOTE_DELETED=0
LOCAL_DELETED=0
PRESERVED=0
PRESERVED_BRANCHES=()

# Clean up remote branches
REMOTE_COUNT=$(git branch -r | grep -v HEAD | grep -v main | grep -v master | wc -l)
echo "✓ Found $REMOTE_COUNT remote branches to check"

for branch in $(git branch -r | grep -v HEAD | grep -v main | grep -v master); do
  BRANCH_NAME="${branch#origin/}"
  
  # Check PR status
  MERGED_PR="$(gh pr list --head "$BRANCH_NAME" --state merged --json number --jq '.[0].number' 2>/dev/null || true)"
  OPEN_PR="$(gh pr list --head "$BRANCH_NAME" --state open --json number --jq '.[0].number' 2>/dev/null || true)"
  
  # Skip if open PR
  if [ -n "$OPEN_PR" ]; then
    echo -e "${BLUE}⏭️ Skipping $BRANCH_NAME (open PR #$OPEN_PR)${NC}"
    continue
  fi
  
  if [ -n "$MERGED_PR" ]; then
    # Check for unmerged commits
    UNMERGED=$(git rev-list --count origin/$BRANCH_NAME ^$DEFAULT 2>/dev/null || echo 0)
    
    # Check for squash merge even if commits appear unmerged
    if [ "$UNMERGED" -gt 0 ]; then
      if is_squash_merged "origin/$BRANCH_NAME" "$DEFAULT"; then
        # Branch is squash-merged, treat as safe to delete
        if [ "$DRY_RUN" = true ]; then
          echo -e "${GREEN}[DRY RUN] Would delete: $BRANCH_NAME (PR #$MERGED_PR squash-merged)${NC}"
        else
          git push origin --delete "$BRANCH_NAME" >/dev/null 2>&1 && {
            echo -e "${GREEN}🗑️ Deleted squash-merged remote: $BRANCH_NAME (PR #$MERGED_PR)${NC}"
            ((REMOTE_DELETED++))
          }
        fi
        continue
      fi
    fi
    
    if [ "$UNMERGED" -gt 0 ]; then
      if [ "$FORCE" = true ]; then
        # Force delete
        if [ "$DRY_RUN" = true ]; then
          echo -e "${RED}[DRY RUN] Would force delete: $BRANCH_NAME (PR #$MERGED_PR, $UNMERGED commits)${NC}"
        else
          git push origin --delete "$BRANCH_NAME" >/dev/null 2>&1 && {
            echo -e "${RED}🗑️ Force deleted: $BRANCH_NAME (PR #$MERGED_PR, $UNMERGED commits lost!)${NC}"
            ((REMOTE_DELETED++))
          }
        fi
      elif [ "$QUIET" = true ]; then
        # Skip in quiet mode
        PRESERVED_BRANCHES+=("$BRANCH_NAME ($UNMERGED commits)")
        ((PRESERVED++))
      else
        # Ask user
        echo -e "\n${YELLOW}⚠️ Branch $BRANCH_NAME has $UNMERGED unmerged commit(s) but PR #$MERGED_PR was merged${NC}"
        echo -e "${BLUE}Recent commits:${NC}"
        git log --oneline -5 origin/$BRANCH_NAME ^$DEFAULT 2>/dev/null || true
        
        echo -ne "${YELLOW}Delete this branch? (y/N): ${NC}"
        read -r CONFIRM
        if [[ "$CONFIRM" =~ ^[Yy]$ ]]; then
          if [ "$DRY_RUN" = true ]; then
            echo -e "${YELLOW}[DRY RUN] Would delete: $BRANCH_NAME${NC}"
          else
            git push origin --delete "$BRANCH_NAME" >/dev/null 2>&1 && {
              echo -e "${GREEN}🗑️ Deleted: $BRANCH_NAME${NC}"
              ((REMOTE_DELETED++))
            }
          fi
        else
          echo -e "${BLUE}⏭️ Preserved $BRANCH_NAME${NC}"
          PRESERVED_BRANCHES+=("$BRANCH_NAME ($UNMERGED commits)")
          ((PRESERVED++))
        fi
      fi
    else
      # Safe to delete
      if [ "$DRY_RUN" = true ]; then
        echo -e "${GREEN}[DRY RUN] Would delete: $BRANCH_NAME (PR #$MERGED_PR merged, no unmerged commits)${NC}"
      else
        git push origin --delete "$BRANCH_NAME" >/dev/null 2>&1 && {
          echo -e "${GREEN}🗑️ Deleted orphaned remote: $BRANCH_NAME (PR #$MERGED_PR)${NC}"
          ((REMOTE_DELETED++))
        }
      fi
    fi
  fi
done

# Clean up local branches
LOCAL_COUNT=$(git branch | grep -v "^\*" | grep -v "$DEFAULT" | grep -v master | wc -l)
echo "✓ Found $LOCAL_COUNT local branches to check"

for branch in $(git branch | grep -v "^\*" | grep -v "$DEFAULT" | grep -v master); do
  BRANCH_NAME="$(echo "$branch" | xargs)"
  
  # Check if fully merged
  if git branch --merged "$DEFAULT" | grep -qx "  $BRANCH_NAME"; then
    # Safe to delete
    if [ "$DRY_RUN" = true ]; then
      echo -e "${GREEN}[DRY RUN] Would delete local: $BRANCH_NAME (fully merged)${NC}"
    else
      git branch -d "$BRANCH_NAME" >/dev/null 2>&1 && {
        echo -e "${GREEN}🧹 Deleted local branch: $BRANCH_NAME${NC}"
        ((LOCAL_DELETED++))
      }
    fi
  else
    # Has unmerged commits
    UNMERGED=$(git rev-list --count $BRANCH_NAME ^$DEFAULT 2>/dev/null || echo 0)
    REMOTE_EXISTS=$(git ls-remote --heads origin "$BRANCH_NAME" 2>/dev/null || true)
    
    # Check for squash merge even if commits appear unmerged
    if [ "$UNMERGED" -gt 0 ]; then
      if is_squash_merged "$BRANCH_NAME" "$DEFAULT"; then
        # Branch is squash-merged, treat as safe to delete
        if [ "$DRY_RUN" = true ]; then
          echo -e "${GREEN}[DRY RUN] Would delete local: $BRANCH_NAME (squash-merged)${NC}"
        else
          git branch -D "$BRANCH_NAME" >/dev/null 2>&1 && {
            echo -e "${GREEN}🧹 Deleted squash-merged local: $BRANCH_NAME${NC}"
            ((LOCAL_DELETED++))
          }
        fi
        continue
      fi
    fi
    
    if [ "$UNMERGED" -gt 0 ] && [ -z "$REMOTE_EXISTS" ]; then
      # Local-only with unmerged commits
      if [ "$FORCE" = true ]; then
        if [ "$DRY_RUN" = true ]; then
          echo -e "${RED}[DRY RUN] Would force delete local: $BRANCH_NAME ($UNMERGED commits)${NC}"
        else
          git branch -D "$BRANCH_NAME" >/dev/null 2>&1 && {
            echo -e "${RED}🗑️ Force deleted local: $BRANCH_NAME ($UNMERGED commits lost!)${NC}"
            ((LOCAL_DELETED++))
          }
        fi
      elif [ "$QUIET" = false ]; then
        echo -e "\n${YELLOW}⚠️ Local branch $BRANCH_NAME has $UNMERGED unmerged commit(s) and no remote${NC}"
        echo -e "${BLUE}Recent commits:${NC}"
        git log --oneline -5 $BRANCH_NAME ^$DEFAULT 2>/dev/null || true
        
        echo -ne "${YELLOW}Delete this local branch? (y/N): ${NC}"
        read -r CONFIRM
        if [[ "$CONFIRM" =~ ^[Yy]$ ]]; then
          if [ "$DRY_RUN" = true ]; then
            echo -e "${YELLOW}[DRY RUN] Would delete local: $BRANCH_NAME${NC}"
          else
            git branch -D "$BRANCH_NAME" >/dev/null 2>&1 && {
              echo -e "${GREEN}🗑️ Deleted local: $BRANCH_NAME${NC}"
              ((LOCAL_DELETED++))
            }
          fi
        else
          echo -e "${BLUE}⏭️ Preserved $BRANCH_NAME${NC}"
          PRESERVED_BRANCHES+=("$BRANCH_NAME (local, $UNMERGED commits)")
          ((PRESERVED++))
        fi
      else
        PRESERVED_BRANCHES+=("$BRANCH_NAME (local, $UNMERGED commits)")
        ((PRESERVED++))
      fi
    fi
  fi
done

# Report summary
echo -e "\n${GREEN}📊 Cleanup Summary:${NC}"

if [ "$DRY_RUN" = true ]; then
  echo -e "${YELLOW}[DRY RUN MODE - No actual deletions]${NC}"
fi

if [ $REMOTE_DELETED -gt 0 ]; then
  echo -e "  ${GREEN}• Deleted $REMOTE_DELETED remote branch(es)${NC}"
fi

if [ $LOCAL_DELETED -gt 0 ]; then
  echo -e "  ${GREEN}• Deleted $LOCAL_DELETED local branch(es)${NC}"
fi

if [ $PRESERVED -gt 0 ]; then
  echo -e "  ${YELLOW}• Preserved $PRESERVED branch(es) with unmerged commits${NC}"
  for branch in "${PRESERVED_BRANCHES[@]}"; do
    echo -e "    ${YELLOW}- $branch${NC}"
  done
fi

if [ $REMOTE_DELETED -eq 0 ] && [ $LOCAL_DELETED -eq 0 ] && [ $PRESERVED -eq 0 ]; then
  echo -e "  ${GREEN}✨ No branches to clean up${NC}"
fi

# Return appropriate exit code
if [ "$FORCE" = true ] && [ $PRESERVED -gt 0 ]; then
  exit 1  # Force mode but still had preserved branches
else
  exit 0
fi
```

## Allowed tools
- Bash
- Glob
- Grep
- Read