---
status: pending
priority: p3
issue_id: "017"
tags: [code-review, security, quality]
---

# lintUtils.js / fixPack.js — Unvalidated Numeric Pref Silently Disables P_DEFER_PAST

## Problem Statement

`deferPastGraceDays` (and other numeric thresholds) are read from the Preferences store and used directly in arithmetic comparisons with no runtime type or range check. If the stored value is non-numeric (hand-edited plist, migrated from an older version), JavaScript's `>` comparison silently evaluates to `false`, effectively disabling the `P_DEFER_PAST` lint check and all defer-date repairs without any error or warning.

## Findings

**lintUtils.js:241** (new in deab421):
```js
const deferPastGrace = lib.readPref(prefs, "deferPastGraceDays");
if (daysOld > deferPastGrace) reasons.push("P_DEFER_PAST");   // silently false if pref is "abc"
```

**fixPack.js:23, 211** (new project loop):
```js
const deferPastGraceDays = lib.readPref(prefs, "deferPastGraceDays");
if (daysOld > deferPastGraceDays) { ... }                      // same silent failure
```

`configure.js` validates on write, but `readPref` has no read-path guard:
```js
lib.readPref = function(prefs, key, defaultValue) {
    const fallback = (defaultValue !== undefined) ? defaultValue : lib.DEFAULTS[key];
    const val = prefs.read(key);
    return (val === null || val === undefined) ? fallback : val;  // no type check
};
```

The same pre-existing pattern exists for `inboxMaxAgeDays`, `waitingStaleDays`, and `deferPastGraceDays` in `computeTaskReasons`. The new code adds two more call sites with the same exposure.

**Impact:** Silent, hard-to-diagnose failure. The plugin appears to run successfully (no error dialog) while producing incorrect lint results — no projects flagged for stale defer dates, no defer repairs applied. Not exploitable; requires a corrupt or hand-edited preferences store.

## Proposed Solution

### Option A — Guard in readPref (Recommended)

Add a numeric coercion and range check in `lib.readPref` for numeric defaults:

```js
lib.readPref = function(prefs, key, defaultValue) {
    const fallback = (defaultValue !== undefined) ? defaultValue : lib.DEFAULTS[key];
    const val = prefs.read(key);
    const result = (val === null || val === undefined) ? fallback : val;
    // Coerce numeric preferences to valid numbers
    if (typeof fallback === "number") {
        const n = Number(result);
        return (Number.isFinite(n) && n >= 0) ? n : fallback;
    }
    return result;
};
```

One change protects all six numeric call sites.
**Effort:** Small | **Risk:** Very low.

### Option B — Guard at each call site

Add `Number.isFinite(deferPastGrace) ? deferPastGrace : lib.DEFAULTS.deferPastGraceDays` at each call site.

**Pros:** Explicit at the point of use.
**Cons:** More changes; does not protect future callers.
**Effort:** Small per site | **Risk:** None.

### Option C — Leave as-is

The configure UI validates on write; the failure mode requires deliberate plist editing. Acceptable risk for a local utility.
**Effort:** None | **Risk:** Silent failures remain possible.

## Acceptance Criteria

- [ ] A non-numeric value in the preferences store for any numeric threshold does not silently suppress lint checks
- [ ] The fallback default is used and the user sees correct behavior
- [ ] Existing tests (if any) still pass; no behavior change for valid pref values

## Work Log

- 2026-02-27: Identified by security-sentinel during review of commit deab421
