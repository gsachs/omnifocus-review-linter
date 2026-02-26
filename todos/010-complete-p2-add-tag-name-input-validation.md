---
status: pending
priority: p2
issue_id: "010"
tags: [code-review, security, quality]
---

# Add Length and Character Validation for Tag Name Preferences

## Problem Statement

`reviewTagName`, `waitingTagName`, and `triageTagName` are stored as unconstrained free-text strings. The only current validation is that `reviewTagName` must be non-empty. There is no maximum length cap and no rejection of embedded newlines, null bytes, or control characters.

These values are later used to build OmniFocus URL schemes (`omnifocus:///tag/...`) and to match against `flattenedTags.byName()`. A tag name with embedded newlines or extreme length could produce a URL that silently fails to navigate, or cause confusing behaviour in tag matching.

Similarly, numeric day thresholds (`inboxMaxAgeDays`, `deferPastGraceDays`, `waitingStaleDays`) have a lower bound (`>= 0`) but no upper bound. A value of `999999999` would silently disable those lint checks.

## Findings

`configure.js:109` — current validate callback:
```javascript
if ((f.values["reviewTagName"] || "").trim().length === 0) return false;
const numFields = ["inboxMaxAgeDays", "deferPastGraceDays", "waitingStaleDays"];
for (const key of numFields) {
    const val = parseInt(f.values[key], 10);
    if (Number.isNaN(val) || val < 0) return false;
}
```

Missing:
- Max length on tag name fields
- Newline / null byte rejection on tag name fields
- Upper bound on numeric fields

## Proposed Solution

Extend the existing `mainForm.validate` callback in `configure.js`:

```javascript
mainForm.validate = function(f) {
    // Tag name: non-empty, max 255 chars, no newlines or null bytes
    const tagVal = (f.values["reviewTagName"] || "").trim();
    if (tagVal.length === 0 || tagVal.length > 255) return false;
    if (/[\r\n\0]/.test(tagVal)) return false;

    // Numeric fields: valid non-negative integer, max 3650 (10 years)
    const numFields = ["inboxMaxAgeDays", "deferPastGraceDays", "waitingStaleDays"];
    for (const key of numFields) {
        const val = parseInt(f.values[key], 10);
        if (Number.isNaN(val) || val < 0 || val > 3650) return false;
    }
    return true;
};
```

Apply the same length/character check to `waitingTagName` and `triageTagName` in the same validate block.

**Effort:** Small
**Risk:** Low — only affects the Configure save button; valid inputs still pass

## Acceptance Criteria

- [ ] Tag name fields reject values longer than 255 characters
- [ ] Tag name fields reject values containing `\r`, `\n`, or `\0`
- [ ] Numeric fields reject values greater than 3650
- [ ] All currently valid configurations continue to save successfully

## Work Log

- 2026-02-27: Identified by security-sentinel (Findings 3 and 4)
