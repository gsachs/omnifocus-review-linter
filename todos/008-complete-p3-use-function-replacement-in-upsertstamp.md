---
status: complete
priority: p3
issue_id: "008"
tags:
  - code-review
  - omnifocus
  - javascript
  - defensive-coding
created_at: 2026-02-26
updated_at: 2026-02-26
related_files:
  - ReviewLinter.omnifocusjs/Lib/lintUtils.js
blocked_by: []
blocks: []
---

# Use function replacement in upsertStamp for $-sequence safety

## Problem Statement

`String.prototype.replace()` interprets `$` sequences in the replacement string (`$1`, `$&`, `$$`, etc.). While the current stamp values (`@lintAt(date)`, `@lint(REASONS)`, `@waitingSince(date)`) never contain `$` characters, using a function replacement is a defense-in-depth measure that prevents future bugs if stamp content ever changes.

## Findings

- **File:** `ReviewLinter.omnifocusjs/Lib/lintUtils.js` line 79
- **Found by:** security-sentinel
- **Impact:** No current vulnerability; future-proofing concern

```javascript
// Current (line 79)
return note.replace(regex, newStamp);

// Proposed
return note.replace(regex, function() { return newStamp; });
```

## Proposed Solutions

### Option A: Use function replacement (Recommended)

Single-line change to use a function callback instead of a string replacement.

- **Pros:** Eliminates $-sequence interpretation risk; zero behavior change for current stamps
- **Cons:** Marginally more verbose
- **Effort:** Trivial
- **Risk:** None

## Recommended Action

(Leave blank -- needs triage)

## Technical Details

- **Affected line:** `ReviewLinter.omnifocusjs/Lib/lintUtils.js` line 79

## Acceptance Criteria

- [ ] `upsertStamp` uses function replacement callback
- [ ] All stamp operations continue to work identically

## Work Log

- 2026-02-26: Identified during code review by security-sentinel
