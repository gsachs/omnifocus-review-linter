---
status: pending
priority: p3
issue_id: "013"
tags: [code-review, quality, simplicity]
---

# fixPack.js — Duplicate Date Allocation and Repeated Plural Pattern

## Problem Statement

Two minor duplication issues in `fixPack.js`:

1. `today` and `now` are computed as two separate `new Date()` calls, and `lib.startOfToday()` internally makes a third.
2. The `(count !== 1 ? "s" : "")` pluralisation pattern is duplicated verbatim five times in the summary block.

## Findings

**1. Three Date objects where one suffices — fixPack.js:24-25**
```javascript
const today = lib.formatDate(new Date());
const now   = new Date();
```
Then `lib.startOfToday()` (called in the repair blocks) creates a third `Date`. Fix: compute `now` once, derive `today` from it:
```javascript
const now   = new Date();
const today = lib.formatDate(now);
```
`lib.startOfToday()` can continue to call `new Date()` internally — the main concern is the two allocations at the top of the action when `now` is already available.

**2. Five-way duplicated plural — fixPack.js:209-215**
```javascript
parts.push(waitingAdded  + " @waitingSince stamp" + (waitingAdded  !== 1 ? "s" : "") + " added.");
parts.push(waitingReset  + " stale @waitingSince stamp" + (waitingReset  !== 1 ? "s" : "") + " reset.");
parts.push(inboxTriaged  + ' inbox item'  + (inboxTriaged  !== 1 ? "s" : "") + ' tagged ...');
parts.push(deferRepaired + " defer date"  + (deferRepaired !== 1 ? "s" : "") + " repaired ...");
parts.push(dueRepaired   + " due date"    + (dueRepaired   !== 1 ? "s" : "") + " repaired ...");
```

Extract a local helper:
```javascript
const s = n => n !== 1 ? "s" : "";
```
Then:
```javascript
if (waitingAdded  > 0) parts.push(waitingAdded  + " @waitingSince stamp" + s(waitingAdded)  + " added.");
if (waitingReset  > 0) parts.push(waitingReset  + " stale @waitingSince stamp" + s(waitingReset) + " reset.");
// etc.
```

## Proposed Solution

1. Change `const today = lib.formatDate(new Date())` to `const today = lib.formatDate(now)` (after `const now = new Date()`).
2. Add `const s = n => n !== 1 ? "s" : "";` before the summary block and use it in all five `parts.push` lines.

**Effort:** Small
**Risk:** None

## Acceptance Criteria

- [ ] `now` is computed once; `today` is derived from `now`
- [ ] Pluralisation uses a single shared helper; no duplicated ternary pattern

## Work Log

- 2026-02-27: Identified by code-simplicity-reviewer
