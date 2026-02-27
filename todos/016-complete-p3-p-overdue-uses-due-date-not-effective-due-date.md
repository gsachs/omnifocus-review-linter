---
status: pending
priority: p3
issue_id: "016"
tags: [code-review, quality]
---

# lintUtils.js — P_OVERDUE Uses dueDate Not effectiveDueDate

## Problem Statement

`P_OVERDUE` checks `project.task.dueDate` directly, while every other due-date check in the file reads `effectiveDueDate || dueDate`. The inconsistency creates a maintenance trap: future developers will need to know which form to use and may make the wrong choice.

## Findings

**lintUtils.js:256** — new P_OVERDUE check:
```js
if (project.task.dueDate && project.task.dueDate < now) {
    reasons.push("P_OVERDUE");
}
```

**lintUtils.js:249–252** — existing P_HAS_OVERDUE subtask check:
```js
const hasOverdue = remainingTasks.some(t => {
    const due = t.effectiveDueDate || t.dueDate;
    return due && due < now;
});
```

**lintUtils.js:295** — T_OVERDUE task check:
```js
const due = task.effectiveDueDate || task.dueDate;
if (due && due < now) reasons.push("T_OVERDUE");
```

The `effectiveDueDate || dueDate` pattern is used everywhere else due-date overdue-ness is tested. For a project root task, `effectiveDueDate === dueDate` (no ancestor to inherit from), so the current `P_OVERDUE` check is **not wrong**. But it is inconsistent with the surrounding code.

If OmniFocus ever returns `effectiveDueDate` as different from `dueDate` on a project root task (edge case in OF4+ with template projects), `P_OVERDUE` would miss it while `P_HAS_OVERDUE` would catch the equivalent for subtasks.

## Proposed Solution

Align `P_OVERDUE` with the established pattern:

```js
// Before
if (project.task.dueDate && project.task.dueDate < now) {
    reasons.push("P_OVERDUE");
}

// After
const rootDue = project.task.effectiveDueDate || project.task.dueDate;
if (rootDue && rootDue < now) {
    reasons.push("P_OVERDUE");
}
```

**Effort:** Trivial (1-line extract)
**Risk:** None — identical behavior for all known OmniFocus builds.

## Acceptance Criteria

- [ ] `P_OVERDUE` check reads `effectiveDueDate || dueDate` consistently with all other overdue checks
- [ ] No behavior change on any OmniFocus build

## Work Log

- 2026-02-27: Identified by code-simplicity-reviewer during review of commit deab421
