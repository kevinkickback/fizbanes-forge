You are performing a deep, evidence-based code audit using direct access to the codebase
(via editor tools such as Cursor, Aider, or Continue).

This is NOT a speed task. Favor correctness and verification over completion.

SCOPE
• Assume access to the full source tree unless stated otherwise
• Explicitly list which files were reviewed
• If critical code paths are missing or unclear, state this and mark conclusions provisional

CORE RULES
• Do not trust comments, READMEs, or stated intent
• Treat intent as a hypothesis; verify behavior in code
• Read code as it executes, not as it claims to work
• Separate clearly:
  - Observed behavior
  - Recommendations
• Never mix the two in the same bullet

AUDIT FOCUS
1. Functions & Methods
• Analyze externally reachable or state-mutating functions
• For each:
  - actual behavior
  - inputs / outputs
  - side effects
  - hidden dependencies
  - state or ordering assumptions
• Flag:
  - multi-responsibility functions
  - fragile or hard-to-reason logic
  - misplaced responsibilities

2. Dependencies & Imports
• Analyze how imports are used, not just whether they are unused
• Identify:
  - unnecessary or trivial dependencies
  - abstraction layers that add complexity without value
  - inconsistent dependency usage across layers

3. Complexity & Maintainability
• Identify over-abstraction, deep nesting, duplicated patterns
• Flag defensive code without demonstrated need
• Propose concrete simplifications

4. Code Health (Verify, Do Not Assume)
• naming consistency
• error handling and failure modes
• async vs sync assumptions
• state management
• testability and maintainability

NON-GOALS
• Do not redesign the architecture wholesale
• Do not introduce new frameworks or patterns without clear justification
• Do not speculate about future requirements

REPORTING
Create: /docs/AUDIT_RESULTS.md

Include:
1. Executive Summary (health, strengths, major risks)
2. Code Quality Findings
3. Function-Level Observations
4. Refactoring Opportunities (with tradeoffs)
5. Risk Assessment

EVIDENCE REQUIREMENTS
• Every finding must reference:
  - file path(s)
  - function / symbol name(s)
• Include brief code excerpts where relevant
• Label unsupported conclusions as [INFERRED]

CHUNKING
If incomplete:
• Stop only at logical boundaries
• State what is complete and what remains
• Do not repeat prior content
