# Fizbane's Forge: Refactoring Guide for AI Agents

**Date:** November 22, 2025  
**Target:** AI Agent Autonomous Execution  
**Expected Timeline:** 8-12 weeks (part-time)

---

## Overview

This refactoring guide is split into multiple focused documents to enable AI agents to work on one phase at a time without overwhelming context. Each phase document is self-contained with complete file contents, tests, and validation procedures.

---

## Guide Structure

### Core Documents

1. **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Final target architecture and complete file structure
2. **[CURRENT_STATE.md](./CURRENT_STATE.md)** - Current codebase analysis and issues

### Phase Documents (Execute in Order)

3. **[PHASE_1_FOUNDATION.md](./PHASE_1_FOUNDATION.md)** - Infrastructure (Logger, Result, EventBus)
4. **[PHASE_2_IPC.md](./PHASE_2_IPC.md)** - Main process refactoring and IPC handlers
5. **[PHASE_3_STATE.md](./PHASE_3_STATE.md)** - Central state management (AppState)
6. **[PHASE_4_BUSINESS_LOGIC.md](./PHASE_4_BUSINESS_LOGIC.md)** - Domain and application layer
7. **[PHASE_5_PRESENTATION.md](./PHASE_5_PRESENTATION.md)** - UI layer and routing
8. **[PHASE_6_TESTING.md](./PHASE_6_TESTING.md)** - Comprehensive testing and validation

### Reference Documents

9. **[CODE_STANDARDS.md](./CODE_STANDARDS.md)** - Coding conventions and patterns
10. **[TESTING_GUIDE.md](./TESTING_GUIDE.md)** - Testing strategies and examples

---

## Execution Instructions

### Prerequisites Validation

Before starting ANY phase, run these commands and verify output:

```powershell
# 1. Verify correct directory
Get-Location  # Must output: C:\Users\K\Workbench\Dev\Electron\fizbanes-forge

# 2. Verify correct branch
git branch --show-current  # Must output: refactor

# 3. Verify clean working directory
git status  # Must show "working tree clean" OR only docs/ changes

# 4. Verify Playwright installed
npx playwright --version  # Must show version 1.x.x
```

**If ANY prerequisite fails, STOP. Do not proceed until resolved.**

### Phase Execution Workflow

Execute phases sequentially. Never skip ahead.

**For Each Phase:**

1. **Read Phase Document Completely**
   - Read `ARCHITECTURE.md` for final architecture reference
   - Read specific phase document from start to finish
   - Understand all files to be created/modified

2. **Execute Steps In Order**
   - Follow each numbered step sequentially
   - Create/modify ONE file at a time
   - Run validation after EACH file
   - Run tests after EACH file
   - Never skip validation checkboxes

3. **Validate Continuously**
   - Run all tests specified: `npx playwright test`
   - Check all validation checkboxes
   - Verify app launches: `npm start`
   - Only proceed when ALL checks pass

4. **Git Checkpoints**
   - Create commits at specified checkpoints
   - Use exact commit messages from phase document
   - Push to remote: `git push origin refactor`

5. **Phase Completion**
   - Complete phase completion checklist
   - Verify ALL checkboxes checked
   - Do NOT start next phase until 100% complete

### Error Recovery Protocol

If ANY test fails OR validation does not pass:

```powershell
# 1. Check what changed since last commit
git status
git diff

# 2. Review recent commits
git log --oneline -5

# 3. If needed, revert to last checkpoint
git reset --hard HEAD

# 4. Re-read current step
# 5. Fix the issue
# 6. Re-run tests
# 7. Only proceed when passing
```

**CRITICAL RULES:**
- Never proceed with failing tests
- Never skip validation steps
- Never commit broken code
- Never start next phase with incomplete current phase

---

## Phase Overview

### Phase 1: Foundation (Week 1)
**Files Created:** 3  
**Tests:** 25  
**Focus:** Logger, Result, EventBus - core infrastructure

**Modified Files:**
- None (creates new files only)

### Phase 2: IPC Refactoring (Week 2)
**Files Created:** 8  
**Tests:** 15  
**Focus:** Split main.js, create IPC handlers

**Modified Files:**
- `app/main.js` (reduce from 768 lines to ~200 lines)
- `app/preload.js` (ensure security boundary is correct)

### Phase 3: State Management (Week 3)
**Files Created:** 2  
**Tests:** 12  
**Focus:** AppState, centralized state management

**Modified Files:**
- All files that currently access state directly

### Phase 4: Business Logic (Weeks 4-6)
**Files Created:** 8  
**Tests:** 30+  
**Focus:** Split CharacterLifecycle, Character.js, refactor services

**Modified Files:**
- `app/js/core/CharacterLifecycle.js` (split into 5 files)
- `app/js/core/Character.js` (simplify and extract logic)
- All services to use Result pattern and Logger

### Phase 5: Presentation (Weeks 7-9)
**Files Created:** 10  
**Tests:** 20+  
**Focus:** Router, PageLoader, extract templates

**Modified Files:**
- `app/js/core/Navigation.js` (split into 4 files)
- `app/index.html` (reduce from 1052 lines to ~200 lines)
- Extract templates to separate files

### Phase 6: Testing & Documentation (Weeks 10-12)
**Files Created:** 15+ test files  
**Tests:** 50+  
**Focus:** Comprehensive E2E tests, documentation

**Modified Files:**
- All files (add/update JSDoc comments)
- Add integration tests for all workflows

---

## Success Criteria

### Code Quality Metrics
- ✅ All files under 400 lines
- ✅ Test coverage > 70%
- ✅ Zero console.log statements (use Logger)
- ✅ Consistent error handling (Result pattern)
- ✅ No circular dependencies

### Architecture Metrics
- ✅ Clear separation of concerns (layers)
- ✅ Single source of truth (AppState)
- ✅ Consistent data structures (CharacterSchema)
- ✅ Proper IPC boundary (main/renderer separation)
- ✅ Event-driven communication (EventBus)

### Testing Metrics
- ✅ All unit tests passing
- ✅ All integration tests passing
- ✅ All E2E tests passing
- ✅ Application starts without errors
- ✅ All features work as before refactoring

---

## Current Status

**Branch:** refactor  
**Last Checkpoint:** (none - starting fresh)  
**Current Phase:** Not started  
**Next Action:** Read ARCHITECTURE.md, then start PHASE_1_FOUNDATION.md

---

## Quick Start

```powershell
# 1. Read the architecture document
Get-Content docs/refactoring/ARCHITECTURE.md

# 2. Read the current state analysis
Get-Content docs/refactoring/CURRENT_STATE.md

# 3. Start Phase 1
Get-Content docs/refactoring/PHASE_1_FOUNDATION.md

# 4. Begin execution (follow Phase 1 instructions)
```

---

## Execution Principles

### Context Management
- Each phase document is self-contained
- Load only current phase into context
- Reference ARCHITECTURE.md for final structure
- Reference CODE_STANDARDS.md for patterns

### File Handling
- All paths are absolute from project root
- All code listings are complete (no placeholders)
- All test files are complete and ready to run
- No "...existing code..." comments in code blocks

### Validation
- Every step has clear pass/fail criteria
- Run validation after each file created
- Never proceed with failing validation
- All checkboxes must be checked before proceeding

### Architecture Adherence
- Always reference final architecture in ARCHITECTURE.md
- Maintain layer dependencies (no circular refs)
- Use Logger, Result, EventBus consistently
- Follow CODE_STANDARDS.md patterns

---

## Document Version

**Version:** 3.0  
**Last Updated:** November 23, 2025  
**Changes:** Streamlined for AI execution, removed human-specific guidance
