# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository contains a specification for an HTML-based Snake game inspired by the Nokia 5110 classic. The project uses the han-solo Git workflow system for repository management.

## Han-Solo Commands

This project uses han-solo, a Git workflow system optimized for solo developers:

### Core Commands

- `/bootstrap` - Initial repository setup with branch protection, CI/CD, and Husky hooks
  - Use `--team` for team mode with required reviews
  - Use `--reviews <N>` to set number of required reviewers

- `/ship` - Ship code from commit to merge
  - Default: Waits for checks and auto-merges when green
  - Use `--nowait` to create PR without waiting
  - Use `--force` to merge despite failures (use carefully)
  - Use `--title "<text>"` for custom PR title

- `/scrub` - Clean up merged and orphaned branches
  - Use `--quiet` for automatic safe cleanup (runs after successful `/ship`)
  - Use `--dry-run` to preview what would be deleted

### Typical Solo Workflow

```bash
# Make changes and commit
git add .
git commit -m "feat: implement snake movement"

# Ship to main branch
/ship
```

## Development Setup

When the Snake game implementation begins, this project will likely use:
- HTML5 Canvas for rendering
- Vanilla JavaScript for game logic
- CSS for Nokia 5110 LCD styling

Expected structure once implemented:
- `index.html` - Main game file
- `style.css` - Nokia 5110 aesthetic
- `game.js` - Core game logic

## Important Notes

- The project is currently in specification phase (see `snake-game-spec.md`)
- When implementing, follow the Nokia 5110 display specifications: 84x48 pixels, monochrome
- Use conventional commits for better PR generation with `/ship`