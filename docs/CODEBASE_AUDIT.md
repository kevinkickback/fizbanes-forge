You are performing a **deep, methodical audit** of a **sandboxed Electron application** that uses a **preload script** to bridge the renderer and main processes.

This is **not** a speed-focused task. Take the time required to understand how the system actually behaves at runtime.

────────────────────────────────────────────
CORE MINDSET
────────────────────────────────────────────
• Do NOT trust comments, README files, or inline documentation at face value.
• Treat all stated intent as a hypothesis that must be verified in code.
• Read the code as it executes, not as it claims to work.
• Assume legacy decisions, workarounds, and architectural drift exist.

────────────────────────────────────────────
AUDIT OBJECTIVES
────────────────────────────────────────────

1. ARCHITECTURE & PROCESS BOUNDARIES
• Identify the intended architecture:
  - responsibilities of main vs preload vs renderer
• Verify whether responsibilities are respected in practice
• Identify boundary leaks:
  - renderer logic leaking into preload
  - preload acting as business logic
  - main process used as a dumping ground
• Flag architectural drift or erosion

2. FUNCTION & METHOD INVESTIGATION
For each significant function or method:
• Explain what it actually does (not what comments claim)
• Analyze:
  - inputs vs outputs
  - side effects
  - hidden dependencies
  - assumptions about execution order or state
• Identify:
  - functions doing multiple jobs
  - unnecessarily complex control flow
  - logic that belongs in a different layer
• Call out code that is hard to reason about or fragile

3. DEPENDENCIES & IMPORTS (BEHAVIOR-BASED)
• Do NOT stop at unused imports
• Investigate:
  - how imported modules are used
  - whether Electron or Node APIs are used safely
• Identify:
  - unnecessary dependencies
  - dependencies used for trivial tasks
  - abstraction layers that add complexity without value
• Flag:
  - direct Node access that bypasses preload constraints
  - inconsistent dependency usage across layers

4. COMPLEXITY & STREAMLINING
• Identify:
  - over-abstraction
  - deep nesting
  - defensive code without evidence
• Look for:
  - duplicated patterns
  - repeated validation logic
  - boilerplate that could be centralized
• Propose concrete simplifications and refactors

5. CODE HEALTH & BEST PRACTICES
Evaluate:
• naming consistency
• error handling strategy
• async vs sync usage
• state management
• testability
• maintainability
• extensibility vs accidental rigidity

Do not assume best practices are followed — verify them.

────────────────────────────────────────────
REPORTING REQUIREMENTS
────────────────────────────────────────────

Produce a **structured, in-depth report** containing:

1. EXECUTIVE SUMMARY
• Overall health assessment
• Major risks and strengths

2. ARCHITECTURAL FINDINGS
• Intended vs actual architecture
• Boundary violations

3. CODE QUALITY FINDINGS
• Dead / duplicate / legacy code
• Overly complex areas

4. FUNCTION-LEVEL OBSERVATIONS
• Notable functions with evidence-based analysis

5. REFACTORING OPPORTUNITIES
• Specific, actionable recommendations
• Expected benefits and tradeoffs

6. RISK ASSESSMENT
• Areas most likely to cause bugs, security issues, or maintenance problems

Be precise, evidence-based, and explicit.
Avoid speculation unless clearly labeled as such.

Create /docs/AUDIT_RESULTS.md with report. It's a large task, so if you have to do it chunks to stop from stalling that is fine.
