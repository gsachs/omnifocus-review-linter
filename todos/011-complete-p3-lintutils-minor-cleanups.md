---
status: pending
priority: p3
issue_id: "011"
tags: [code-review, quality, simplicity]
---

# lintUtils.js Minor Cleanups

## Problem Statement

Three small readability issues in `lintUtils.js`:

1. Dead `!prefs` null guard in `readPref` — `lib.prefs` is always set at load time; the guard can never fire.
2. `isRemaining` uses two sequential early-returns where a single boolean expression is clearer.
3. `navigateToTag` fallback alert bypasses `lib.showAlert` and duplicates the Alert construction pattern inline.

## Findings

**1. Dead guard — lintUtils.js:36**
```javascript
if (!prefs) return fallback;  // prefs is always lib.prefs, never null
```
Every caller passes `lib.prefs` which is initialised unconditionally at load time.

**2. isRemaining verbosity — lintUtils.js:110-114**
```javascript
lib.isRemaining = function(task) {
    if (task.taskStatus === Task.Status.Completed) return false;
    if (task.taskStatus === Task.Status.Dropped)   return false;
    return true;
};
```
Can be expressed as:
```javascript
lib.isRemaining = function(task) {
    return task.taskStatus !== Task.Status.Completed &&
           task.taskStatus !== Task.Status.Dropped;
};
```

**3. navigateToTag fallback — lintUtils.js:337-344**
```javascript
const alert = new Alert("Open Lint Queue", "...");
alert.addOption("OK");
await alert.show();
```
Should be `await lib.showAlert("Open Lint Queue", "...", "OK")` — same as every other informational alert.

## Proposed Solution

Apply all three fixes to `lintUtils.js`:
- Remove the `if (!prefs)` line from `readPref`
- Collapse `isRemaining` to a single return expression
- Replace the inline Alert construction in `navigateToTag` with `lib.showAlert`

**Effort:** Small
**Risk:** None

## Acceptance Criteria

- [ ] `readPref` has no `!prefs` guard
- [ ] `isRemaining` returns a boolean expression directly
- [ ] `navigateToTag` uses `lib.showAlert` for its fallback alert

## Work Log

- 2026-02-27: Identified by code-simplicity-reviewer
