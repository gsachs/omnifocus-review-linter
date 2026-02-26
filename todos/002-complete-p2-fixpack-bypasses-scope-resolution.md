---
status: complete
priority: p2
issue_id: "002"
tags:
  - code-review
  - omnifocus
  - javascript
  - architecture
created_at: 2026-02-26
updated_at: 2026-02-26
related_files:
  - ReviewLinter.omnifocusjs/Actions/fixPack.js
  - ReviewLinter.omnifocusjs/Lib/lintUtils.js
blocked_by: []
blocks: []
---

# fixPack bypasses configured scope resolution

## Problem Statement

`fixPack.js` operates on the entire OmniFocus database by iterating `flattenedTasks`, while `lintSweep.js` and `clearLintMarks.js` both respect the user's configured scope (folder/tag filtering, exclude tags) via `lib.resolveProjects()` and `lib.resolveTasksForLint()`. This means:

- If a user configures FOLDER_SCOPE, lintSweep only flags tasks in that folder, but fixPack repairs tasks in *all* folders.
- Tasks excluded via exclude tags in lintSweep will still get "fixed" by fixPack.

This is an architectural inconsistency that could surprise users.

## Findings

- **File:** `ReviewLinter.omnifocusjs/Actions/fixPack.js`, lines 105-107
- **Found by:** pattern-recognition-specialist, code-simplicity-reviewer
- **Impact:** fixPack modifies tasks outside the user's configured scan scope, potentially altering items the user intentionally excluded from linting

```javascript
// Current: operates on ALL tasks in the database
const allTasks = Array.from(flattenedTasks).filter(
    t => !t.completed && !t.dropped
);
```

## Proposed Solutions

### Option A: Use scope resolution like other actions (Recommended)

Replace the `flattenedTasks` call with the same scope resolution pattern used by lintSweep and clearLintMarks:

```javascript
const projects = lib.resolveProjects(prefs);
if (projects === null) {
    // show scope-not-found alert and return
}
const scopedTasks = lib.resolveTasksForLint(prefs, projects);
```

Also apply `lib.shouldExclude(task, excludeTagNames)` within the loop.

- **Pros:** Consistent behavior across all actions; respects user configuration
- **Cons:** Slightly reduces fixPack's reach (intentional)
- **Effort:** Small
- **Risk:** Low

### Option B: Document as intentional and add a scope option

Keep the global behavior but make it explicit: add a form field to fixPack asking "Apply to: [Configured scope / Entire database]" with "Configured scope" as default.

- **Pros:** Gives user explicit control; preserves the global option
- **Cons:** Adds UI complexity for a niche use case
- **Effort:** Medium
- **Risk:** Low

## Recommended Action

(Leave blank -- needs triage)

## Technical Details

- **Affected file:** `ReviewLinter.omnifocusjs/Actions/fixPack.js` lines 105-107
- **Related functions:** `lib.resolveProjects()`, `lib.resolveTasksForLint()`, `lib.shouldExclude()`

## Acceptance Criteria

- [ ] fixPack respects the configured scope mode (ALL/FOLDER/TAG)
- [ ] fixPack skips tasks with exclude tags
- [ ] fixPack shows scope-not-found alert when scope target is missing (if applicable)
- [ ] Summary counts reflect only in-scope tasks

## Work Log

- 2026-02-26: Identified during code review by pattern-recognition-specialist and code-simplicity-reviewer
