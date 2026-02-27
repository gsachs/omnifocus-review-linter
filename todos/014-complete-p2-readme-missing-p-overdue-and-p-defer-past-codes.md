---
status: pending
priority: p2
issue_id: "014"
tags: [code-review, documentation]
---

# README — Project Checks Table Missing P_OVERDUE and P_DEFER_PAST

## Problem Statement

Two new project-level lint reason codes (`P_OVERDUE`, `P_DEFER_PAST`) were added in commit `deab421` but are absent from the project checks reference table in `README.md`. Anyone reading the README to understand what the plugin flags will not know these checks exist.

## Findings

**README.md lines 39–44** — the project checks table lists only three codes:

```markdown
| Code | Triggered when |
|------|---------------|
| `P_NO_NEXT_ACTION` | No remaining task is available for action |
| `P_HAS_OVERDUE` | Any remaining task is past its due date |
| `P_EMPTY` | Project has no remaining tasks |
```

`lintUtils.js:255–264` adds two more:

```js
// P_OVERDUE — the project's own due date is past
if (project.task.dueDate && project.task.dueDate < now) {
    reasons.push("P_OVERDUE");
}

// P_DEFER_PAST — the project's own defer date is stale
if (project.task.deferDate) {
    const daysOld = lib.daysBetween(project.task.deferDate, now);
    if (daysOld > deferPastGrace) reasons.push("P_DEFER_PAST");
}
```

The sweep summary dialog can now show "Project Overdue" and "Project Defer Past" counts (lintSweep.js:141–142), but the README gives the reader no way to know what these mean.

## Proposed Solution

Add the two missing rows to the project checks table in README.md:

```markdown
| `P_OVERDUE` | Project's own due date is past |
| `P_DEFER_PAST` | Project's own defer date is more than N days in the past |
```

Place them after `P_HAS_OVERDUE` (the other due-date check) and before `P_EMPTY`, matching the display order in the summary dialog.

**Effort:** Small
**Risk:** None (docs only)

## Acceptance Criteria

- [ ] `P_OVERDUE` row present in the project checks table with an accurate description
- [ ] `P_DEFER_PAST` row present with an accurate description (referencing the N-day grace period)
- [ ] Row order matches the summary dialog display order

## Work Log

- 2026-02-27: Identified during code review of commit deab421
