---
status: complete
priority: p2
issue_id: "003"
tags:
  - code-review
  - omnifocus
  - javascript
  - dead-code
created_at: 2026-02-26
updated_at: 2026-02-26
related_files:
  - ReviewLinter.omnifocusjs/Lib/lintUtils.js
blocked_by: []
blocks: []
---

# Remove dead code: readStamp() and readLintReasons()

## Problem Statement

Two functions in `lintUtils.js` are never called by any action in the codebase. They were built speculatively for consumers that do not exist, violating YAGNI. Dead code increases cognitive load and maintenance burden.

## Findings

- **File:** `ReviewLinter.omnifocusjs/Lib/lintUtils.js`
- **Found by:** code-simplicity-reviewer (traced every function across all 5 action files)
- **Impact:** 16 lines of dead code in the shared library

### `readStamp()` (lines 98-103)

```javascript
lib.readStamp = function(note, regex) {
    const match = note.match(regex);
    return match ? match[0] : null;
};
```

Zero callers. Each stamp type that needs reading already has its own dedicated parser (`readWaitingSince` for `@waitingSince`).

### `readLintReasons()` (lines 105-112)

```javascript
lib.readLintReasons = function(note) {
    const match = note.match(/@lint\(([A-Z_,]+)\)/);
    if (!match) return [];
    return match[1].split(",").filter(s => s.length > 0);
};
```

Zero callers. The `@lint()` stamp is written by lintSweep and removed by clearLintMarks; no action ever reads reasons back from a note.

## Proposed Solutions

### Option A: Delete both functions (Recommended)

Remove both functions and their JSDoc comments. VCS preserves the code if ever needed.

- **Pros:** Cleaner library; reduced cognitive load; ~16 lines removed
- **Cons:** None; functions are unused
- **Effort:** Trivial
- **Risk:** None

## Recommended Action

(Leave blank -- needs triage)

## Technical Details

- **Affected file:** `ReviewLinter.omnifocusjs/Lib/lintUtils.js` lines 96-112
- **LOC savings:** ~16 lines

## Acceptance Criteria

- [ ] `readStamp()` is removed from lintUtils.js
- [ ] `readLintReasons()` is removed from lintUtils.js
- [ ] All existing actions continue to function (no regressions)

## Work Log

- 2026-02-26: Identified during code review by code-simplicity-reviewer (full call-site analysis)
