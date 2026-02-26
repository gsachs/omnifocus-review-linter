---
status: pending
priority: p2
issue_id: "009"
tags: [code-review, quality, yagni]
---

# Remove Dead `action.validate` Blocks from All Action Files

## Problem Statement

All five action files define an `action.validate` function that unconditionally returns `true`. This is the default OmniJS behaviour when no `validate` function is set — meaning these five functions implement exactly what would happen if they didn't exist. They are pure YAGNI: placeholder code for future validation that hasn't materialised.

**Impact:** 15 lines of dead code across 5 files that every reader must parse and conclude "does nothing."

## Findings

Every action file ends with:

```javascript
action.validate = function(selection, sender) {
    return true;
};
```

Files affected:
- `fixPack.js:219-221`
- `configure.js:178-180`
- `lintSweep.js:179-181`
- `clearLintMarks.js:134-136`
- `openLintQueue.js:22-24`

Deleting all five blocks produces zero behaviour change. OmniJS actions with no `validate` function are always enabled, which is identical to returning `true`.

## Proposed Solution

Delete all five `action.validate = function(...) { return true; }` blocks from every action file.

If specific actions later need real validation logic (e.g. Lint Sweep only active when database is open), add `validate` back at that point with actual logic.

**Effort:** Small
**Risk:** None — behaviour identical

## Acceptance Criteria

- [ ] All five files have no `action.validate` assignment
- [ ] All five actions still appear in the OmniFocus Automation menu and execute normally

## Work Log

- 2026-02-27: Identified by code-simplicity-reviewer
