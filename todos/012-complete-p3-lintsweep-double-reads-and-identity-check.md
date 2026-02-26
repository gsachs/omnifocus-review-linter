---
status: pending
priority: p3
issue_id: "012"
tags: [code-review, quality, simplicity]
---

# lintSweep.js — Double readPref Calls and Tag Identity Check

## Problem Statement

Two small issues in `lintSweep.js`:

1. `reviewTagName` is read from prefs twice within three lines.
2. `lintTasksEnabled` is read twice — once to gate the task scan, once again in the summary block.
3. `alreadyTagged` checks compare by tag name string when the resolved tag object is available; identity comparison is more robust.

## Findings

**1. Double read of reviewTagName — lintSweep.js:40-43**
```javascript
const reviewTag = lib.findOrCreateTag(lib.readPref(prefs, "reviewTagName"));
if (!reviewTag) {
    const tagName = lib.readPref(prefs, "reviewTagName");  // second read
    await lib.showAlert("Cannot Create Review Tag", `The tag "${tagName}" ...`);
```
Fix: read into `const tagName` first, then pass to `lib.findOrCreateTag(tagName)`.

**2. Double read of lintTasksEnabled — lintSweep.js:96, 143**
```javascript
if (lib.readPref(prefs, "lintTasksEnabled")) {   // line 96 — task scan gate
    ...
}
if (lib.readPref(prefs, "lintTasksEnabled")) {   // line 143 — summary gate
```
Fix: read once at the top alongside `alsoFlag` and `excludeTagNames`.

**3. Name comparison when object is available — lintSweep.js:82-83, 111-112**
```javascript
const alreadyTagged = project.task.tags.some(t => t.name === reviewTag.name);
// and:
const alreadyTagged = task.tags.some(t => t.name === reviewTag.name);
```
Since `reviewTag` is already the resolved object, comparing by identity (`t === reviewTag`) or primary key is more precise:
```javascript
const alreadyTagged = project.task.tags.some(t => t.id.primaryKey === reviewTag.id.primaryKey);
```

## Proposed Solution

- Extract `const tagName = lib.readPref(prefs, "reviewTagName")` at top of action and use in both `findOrCreateTag` and the error alert.
- Extract `const lintTasksEnabled = lib.readPref(prefs, "lintTasksEnabled")` at top alongside other prefs.
- Change `alreadyTagged` comparisons to use `id.primaryKey` instead of `.name`.

**Effort:** Small
**Risk:** None

## Acceptance Criteria

- [ ] `reviewTagName` read exactly once in the action
- [ ] `lintTasksEnabled` read exactly once in the action
- [ ] `alreadyTagged` checks use `id.primaryKey` comparison

## Work Log

- 2026-02-27: Identified by code-simplicity-reviewer
