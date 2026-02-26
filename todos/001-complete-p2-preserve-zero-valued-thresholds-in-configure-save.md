---
status: complete
priority: p2
issue_id: "001"
tags:
  - code-review
  - omnifocus
  - javascript
  - configuration
created_at: 2026-02-26
updated_at: 2026-02-26
related_files:
  - ReviewLinter.omnifocusjs/Actions/configure.js
blocked_by: []
blocks: []
---

# Zero-valued thresholds are overwritten by defaults when saving config

## Problem Statement

`configure.js` saves numeric preferences with `parseInt(value) || <default>`. A valid user input of `0` is falsy in JavaScript, so it gets replaced with the default value instead of being persisted. This makes it impossible to configure zero-day thresholds for inbox age, defer grace, or waiting stale behavior even though the UI form accepts `0`.

## Findings

- **File:** `ReviewLinter.omnifocusjs/Actions/configure.js`
- **Found by:** codex code review
- **Impact:** User-visible configuration mismatch; saved settings do not reflect entered values for `0`

## Proposed Solutions

### Option A: Use explicit NaN checks and preserve `0` (Recommended)
Parse each field once and only fall back to defaults when the parsed value is `NaN`, e.g. `Number.isNaN(parsed) ? defaultValue : parsed`.

- **Pros:** Preserves valid zero values; keeps current defaults for invalid input
- **Cons:** Slightly more verbose save logic
- **Effort:** Small
- **Risk:** Low

### Option B: Centralize numeric preference parsing helper
Add a small helper function in `configure.js` (or `lintUtils`) to parse form strings with default fallback and `NaN` handling.

- **Pros:** Avoids repeating the same parsing pattern for multiple fields
- **Cons:** Slightly larger refactor than needed for a single bug fix
- **Effort:** Small
- **Risk:** Low

## Recommended Action

(Leave blank — needs triage)

## Technical Details

- **Affected lines:** `prefs["inboxMaxAgeDays"]`, `prefs["deferPastGraceDays"]`, `prefs["waitingStaleDays"]` assignments in `ReviewLinter.omnifocusjs/Actions/configure.js`

## Acceptance Criteria

- [ ] Entering `0` for Inbox Max Age saves and persists as `0`
- [ ] Entering `0` for Defer Past Grace saves and persists as `0`
- [ ] Entering `0` for Waiting Stale saves and persists as `0`
- [ ] Invalid numeric input still falls back to defaults (or is rejected explicitly)

## Work Log

- 2026-02-26: Identified during Codex review of `ReviewLinter.omnifocusjs`
