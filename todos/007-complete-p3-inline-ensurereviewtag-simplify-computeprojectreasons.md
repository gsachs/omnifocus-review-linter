---
status: complete
priority: p3
issue_id: "007"
tags:
  - code-review
  - omnifocus
  - javascript
  - simplification
created_at: 2026-02-26
updated_at: 2026-02-26
related_files:
  - ReviewLinter.omnifocusjs/Lib/lintUtils.js
  - ReviewLinter.omnifocusjs/Actions/lintSweep.js
blocked_by: []
blocks: []
---

# Inline ensureReviewTag and simplify computeProjectReasons

## Problem Statement

Two minor simplification opportunities in `lintUtils.js`:

1. `ensureReviewTag()` is a trivial 4-line wrapper around `findOrCreateTag()` with exactly one caller.
2. `computeProjectReasons()` allocates an unnecessary intermediate array when checking `P_NO_NEXT_ACTION`.

## Findings

- **Found by:** code-simplicity-reviewer
- **Impact:** Minor code complexity reduction

### ensureReviewTag (lines 229-232)

```javascript
// Current: trivial wrapper, called exactly once (lintSweep line 41)
lib.ensureReviewTag = function(prefs) {
    const name = lib.readPref(prefs, "reviewTagName");
    return lib.findOrCreateTag(name);
};

// Proposed: inline at call site
const reviewTag = lib.findOrCreateTag(lib.readPref(prefs, "reviewTagName"));
```

### computeProjectReasons P_NO_NEXT_ACTION check (lines 278-285)

```javascript
// Current: maps all tasks then checks first element
const availabilities = remainingTasks.map(t => lib.isTaskAvailableIsh(t));
if (availabilities[0] === undefined) {
    skipNoNextAction = true;
} else {
    const hasAvailable = availabilities.some(a => a === true);
    if (!hasAvailable) reasons.push("P_NO_NEXT_ACTION");
}

// Proposed: probe one task, then use some() directly
const probe = lib.isTaskAvailableIsh(remainingTasks[0]);
if (probe === undefined) {
    skipNoNextAction = true;
} else if (!remainingTasks.some(t => lib.isTaskAvailableIsh(t))) {
    reasons.push("P_NO_NEXT_ACTION");
}
```

## Proposed Solutions

### Option A: Apply both simplifications (Recommended)

- **Pros:** Removes trivial wrapper; eliminates unnecessary array allocation
- **Cons:** None
- **Effort:** Trivial
- **Risk:** None

## Recommended Action

(Leave blank -- needs triage)

## Technical Details

- **Affected file:** `ReviewLinter.omnifocusjs/Lib/lintUtils.js`
- **LOC savings:** ~7 lines

## Acceptance Criteria

- [ ] `ensureReviewTag()` removed; call site updated
- [ ] `computeProjectReasons` P_NO_NEXT_ACTION check simplified
- [ ] No behavioral changes

## Work Log

- 2026-02-26: Identified during code review by code-simplicity-reviewer
