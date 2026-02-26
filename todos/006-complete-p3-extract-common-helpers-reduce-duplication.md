---
status: complete
priority: p3
issue_id: "006"
tags:
  - code-review
  - omnifocus
  - javascript
  - duplication
created_at: 2026-02-26
updated_at: 2026-02-26
related_files:
  - ReviewLinter.omnifocusjs/Lib/lintUtils.js
  - ReviewLinter.omnifocusjs/Actions/lintSweep.js
  - ReviewLinter.omnifocusjs/Actions/openLintQueue.js
  - ReviewLinter.omnifocusjs/Actions/clearLintMarks.js
  - ReviewLinter.omnifocusjs/Actions/fixPack.js
blocked_by: []
blocks: []
---

# Extract common helpers to reduce code duplication

## Problem Statement

Several patterns are repeated across multiple action files. While individually small, the cumulative duplication is significant (~45+ lines of repeated boilerplate).

## Findings

- **Found by:** pattern-recognition-specialist
- **Impact:** Maintenance burden; risk of inconsistent behavior when patterns are updated in one place but not others

### Duplicated patterns identified:

**1. Alert-OK pattern (15+ occurrences, ~45 lines total)**
```javascript
const alert = new Alert(title, message);
alert.addOption("OK");
await alert.show();
```

**2. Tag name check (10 occurrences)**
```javascript
task.tags.some(t => t.name === someTagName)
// or for projects:
project.task.tags.some(t => t.name === someTagName)
```

**3. URL navigation to tag (2 occurrences in openLintQueue.js and lintSweep.js)**
Full 12-line pattern: encode tag name, build URL, call `URL.fromString`, `app.openURL`, fallback alert.

**4. Scope-not-found alert (2 occurrences in lintSweep.js and clearLintMarks.js)**
Near-identical 10-line alert blocks.

**5. Remaining tasks filter (4 occurrences)**
```javascript
!t.completed && !t.dropped
```

## Proposed Solutions

### Option A: Extract targeted helpers into lintUtils.js (Recommended)

Add these helpers to the shared library:

```javascript
lib.showAlert = async function(title, message) { ... }
lib.hasTagNamed = function(item, tagName) { ... }
lib.navigateToTag = async function(tagName) { ... }
lib.isRemaining = function(task) { return !task.completed && !task.dropped; }
```

- **Pros:** Reduces ~60 lines of duplication; centralizes behavior
- **Cons:** Slightly larger library
- **Effort:** Small
- **Risk:** Low

### Option B: Extract only the highest-impact helpers

Focus on `showAlert` (15 occurrences) and `hasTagNamed` (10 occurrences) only.

- **Pros:** Smaller change; highest ROI
- **Cons:** Leaves smaller duplications in place
- **Effort:** Trivial
- **Risk:** Low

## Recommended Action

(Leave blank -- needs triage)

## Technical Details

- **Primary file:** `ReviewLinter.omnifocusjs/Lib/lintUtils.js`
- **Consumers:** All 5 action files
- **Estimated LOC savings:** 40-60 lines

## Acceptance Criteria

- [ ] Common patterns extracted to named helpers in lintUtils.js
- [ ] All action files use the new helpers instead of inline duplication
- [ ] No behavioral changes to any action

## Work Log

- 2026-02-26: Identified during code review by pattern-recognition-specialist
