---
status: complete
priority: p3
issue_id: "005"
tags:
  - code-review
  - omnifocus
  - javascript
  - defensive-coding
created_at: 2026-02-26
updated_at: 2026-02-26
related_files:
  - ReviewLinter.omnifocusjs/Actions/configure.js
  - ReviewLinter.omnifocusjs/Lib/lintUtils.js
blocked_by: []
blocks: []
---

# Add explicit radix parameter to all parseInt() calls

## Problem Statement

Multiple `parseInt()` calls omit the radix parameter. While modern JavaScript engines default to base 10, omitting the radix is a defensive coding anti-pattern flagged by most linters.

## Findings

- **File:** `ReviewLinter.omnifocusjs/Actions/configure.js` lines 159-162
- **File:** `ReviewLinter.omnifocusjs/Lib/lintUtils.js` line 52
- **Found by:** security-sentinel
- **Impact:** No current bug, but violates best practices

```javascript
// configure.js - missing radix
parseInt(mainResult.values["inboxMaxAgeDays"])

// lintUtils.js - missing radix
return new Date(parseInt(parts[1]), parseInt(parts[2]) - 1, parseInt(parts[3]));
```

## Proposed Solutions

### Option A: Add radix 10 to all parseInt calls (Recommended)

Simple find-and-replace: `parseInt(x)` to `parseInt(x, 10)`.

- **Pros:** Follows best practices; silences lint warnings
- **Cons:** None
- **Effort:** Trivial
- **Risk:** None

## Recommended Action

(Leave blank -- needs triage)

## Technical Details

- **Affected files:** configure.js (3 calls), lintUtils.js (3 calls)

## Acceptance Criteria

- [ ] All `parseInt()` calls include explicit radix parameter `10`

## Work Log

- 2026-02-26: Identified during code review by security-sentinel
