---
status: complete
priority: p2
issue_id: "004"
tags:
  - code-review
  - omnifocus
  - javascript
  - correctness
created_at: 2026-02-26
updated_at: 2026-02-26
related_files:
  - ReviewLinter.omnifocusjs/Lib/lintUtils.js
  - ReviewLinter.omnifocusjs/Actions/lintSweep.js
  - ReviewLinter.omnifocusjs/Actions/fixPack.js
blocked_by: []
blocks: []
---

# Pass consistent timestamp to reason computation functions

## Problem Statement

`computeProjectReasons()` and `computeTaskReasons()` each create their own `new Date()` internally, while calling actions (lintSweep, fixPack) also create separate `new Date()` instances. On large databases, a sweep could run for several minutes, causing the timestamps used for stamp formatting and threshold comparisons to diverge.

## Findings

- **File:** `ReviewLinter.omnifocusjs/Lib/lintUtils.js`
- **Found by:** pattern-recognition-specialist
- **Impact:** On large databases, time drift between stamp dates and threshold computations could cause edge-case inconsistencies

Locations creating independent `new Date()`:
- `lintSweep.js` line 18: `const now = new Date()`
- `lintUtils.js` line 258: `const now = new Date()` (inside `computeProjectReasons`)
- `lintUtils.js` line 298: `const now = new Date()` (inside `computeTaskReasons`)
- `fixPack.js` lines 24-25: Two separate `new Date()` calls

## Proposed Solutions

### Option A: Pass `now` as a parameter to compute functions (Recommended)

Change function signatures to accept a `now` parameter:

```javascript
lib.computeProjectReasons = function(project, prefs, now) { ... }
lib.computeTaskReasons = function(task, prefs, now) { ... }
```

Each action creates `now` once at the top and passes it through.

- **Pros:** Consistent time reference across entire sweep; easier to test
- **Cons:** Signature change on two library functions
- **Effort:** Small
- **Risk:** Low

### Option B: Freeze a `lib.now` property at sweep start

Set `lib.now = new Date()` at the start of each action and reference it inside the library.

- **Pros:** No signature changes
- **Cons:** Shared mutable state on the library; less explicit; test-unfriendly
- **Effort:** Small
- **Risk:** Low-Medium

## Recommended Action

(Leave blank -- needs triage)

## Technical Details

- **Affected functions:** `computeProjectReasons`, `computeTaskReasons`
- **Callers:** lintSweep.js, fixPack.js

## Acceptance Criteria

- [ ] A single `new Date()` is created per action invocation
- [ ] Both `computeProjectReasons` and `computeTaskReasons` use the passed timestamp
- [ ] All timestamp-dependent logic within a single sweep uses the same reference time

## Work Log

- 2026-02-26: Identified during code review by pattern-recognition-specialist
