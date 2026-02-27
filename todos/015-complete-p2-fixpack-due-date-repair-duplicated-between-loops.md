---
status: pending
priority: p2
issue_id: "015"
tags: [code-review, quality, simplicity]
---

# fixPack.js — Due-Date Repair Logic Duplicated Between Task Loop and Project Loop

## Problem Statement

The due-date repair branch (`duePolicy` dispatch) is copied verbatim in two places in `fixPack.js`. The only difference is the assignment target (`task.dueDate` vs `project.task.dueDate`). Any change to repair policy handling (adding a new policy value, changing the `next_week` offset) must be made in two places.

## Findings

**fixPack.js:192–203 (task loop):**
```js
if (doRepairDue && task.dueDate && task.dueDate < now) {
    if (duePolicy === "today") {
        task.dueDate = lib.startOfToday();
    } else if (duePolicy === "next_week") {
        const d = lib.startOfToday();
        d.setDate(d.getDate() + 7);
        task.dueDate = d;
    } else {
        task.dueDate = null;
    }
    dueRepaired++;
}
```

**fixPack.js:217–228 (project loop, added in deab421):**
```js
if (doRepairDue && project.task.dueDate && project.task.dueDate < now) {
    if (duePolicy === "today") {
        project.task.dueDate = lib.startOfToday();
    } else if (duePolicy === "next_week") {
        const d = lib.startOfToday();
        d.setDate(d.getDate() + 7);
        project.task.dueDate = d;
    } else {
        project.task.dueDate = null;
    }
    dueRepaired++;
}
```

The defer repair has a similar but shorter duplication: task loop uses explicit if/else (fixPack.js:182–187), project loop uses inline ternary (fixPack.js:212). Same knowledge, two styles.

## Proposed Solution

### Option A — Extract helpers into lintUtils.js (Recommended)

Add two functions to `lintUtils.js`:

```js
lib.applyDeferPolicy = function(task, policy) {
    task.deferDate = policy === "today" ? lib.startOfToday() : null;
};

lib.applyDuePolicy = function(task, policy) {
    if (policy === "today") {
        task.dueDate = lib.startOfToday();
    } else if (policy === "next_week") {
        const d = lib.startOfToday();
        d.setDate(d.getDate() + 7);
        task.dueDate = d;
    } else {
        task.dueDate = null;
    }
};
```

Both loops in `fixPack.js` then reduce to:

```js
// task loop
if (doRepairDefer && task.deferDate) {
    const daysOld = lib.daysBetween(task.deferDate, now);
    if (daysOld > deferPastGraceDays) {
        lib.applyDeferPolicy(task, deferPolicy);
        deferRepaired++;
    }
}
if (doRepairDue && task.dueDate && task.dueDate < now) {
    lib.applyDuePolicy(task, duePolicy);
    dueRepaired++;
}

// project loop — identical structure, different subject
if (doRepairDefer && project.task.deferDate) {
    const daysOld = lib.daysBetween(project.task.deferDate, now);
    if (daysOld > deferPastGraceDays) {
        lib.applyDeferPolicy(project.task, deferPolicy);
        deferRepaired++;
    }
}
if (doRepairDue && project.task.dueDate && project.task.dueDate < now) {
    lib.applyDuePolicy(project.task, duePolicy);
    dueRepaired++;
}
```

Removes ~14 lines of duplication. Single source of truth for policy dispatch.

**Pros:** Eliminates duplication entirely; policy logic is testable in isolation; future policy additions happen in one place.
**Cons:** Minor added surface in lintUtils.js.
**Effort:** Small | **Risk:** Very low — pure refactor, same behavior.

### Option B — Leave as-is, add a comment

Add a comment above the project loop noting it mirrors the task loop intentionally. Does not eliminate the duplication but signals it is known.

**Pros:** Zero risk.
**Cons:** Doesn't fix the underlying problem; divergence is still possible.
**Effort:** Trivial | **Risk:** None.

## Acceptance Criteria

- [ ] Due-date policy dispatch appears exactly once in the codebase (in a shared helper)
- [ ] Both task loop and project loop call the helper
- [ ] Defer policy dispatch is also unified (ternary vs if/else inconsistency resolved)
- [ ] Behavior is unchanged

## Work Log

- 2026-02-27: Identified by code-simplicity-reviewer during review of commit deab421
