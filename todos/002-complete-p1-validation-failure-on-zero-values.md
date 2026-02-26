---
status: complete
priority: p1
issue_id: "002"
tags:
  - code-review
  - bug
  - javascript
created_at: 2026-02-26
updated_at: 2026-02-26
blocked_by: []
blocks: []
---

# UI validation allows invalid configuration input

## Problem Statement

While reviewing `configure.js`, the validation function only checks for the `reviewTagName` existence but doesn't validate if numeric inputs are actually valid numbers before attempting to parse them.

## Findings

- **Location**: `configure.js` line 74-76
- **Issue**: `mainForm.validate` only checks `reviewTagName`. Invalid strings like "abc" will be accepted by the form, then fallback to defaults silently at save time.
- **Found by**: code-quality-reviewer

## Proposed Solutions

### Option A: Add explicit validation for numeric fields
Update `mainForm.validate` to ensure `inboxMaxAgeDays`, `deferPastGraceDays`, and `waitingStaleDays` contain valid numeric strings.

- **Pros**: Catches issues before form submission
- **Cons**: More complex validation logic
- **Effort**: Small
- **Risk**: Low

## Technical Details

Add parsing validation logic to the `mainForm.validate` function.

## Acceptance Criteria

- [ ] Form cannot be submitted with non-numeric values in day fields
- [ ] Appropriate validation warnings are shown
