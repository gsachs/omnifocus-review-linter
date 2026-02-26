---
title: OmniJS Plugin Preferences Not Persisting — Invalid PlugIn Property and Load-Time Constraint
date: 2026-02-27
category: runtime-errors
tags:
  - omnifocus
  - omni-automation
  - omniJS
  - javascript-automation
  - preferences
  - plugin-development
symptoms:
  - Preferences not persisting across OmniFocus sessions or restarts
  - "'Preferences objects may only be constructed when loading a plug-in' error"
  - this.plugIn.preferences returns undefined
  - Bracket notation assignment on Preferences object silently fails
  - Tag-based preference storage lost on restart
  - app.openURL(url) throws TypeError or does nothing
  - task.dropped property always undefined or false
  - Project root task unexpectedly included in flattenedTasks iteration
components:
  - OmniJS Preferences class
  - PlugIn.Library
  - Action handlers
  - URL API
  - Task.Status enum
  - Project.flattenedTasks
environment: OmniFocus 3/4 on macOS, OmniJS (Omni Automation) plugin runtime
status: solved
---

# OmniJS Plugin Preferences Not Persisting

## Problem Statement

An OmniFocus OmniJS plugin's user settings were not surviving across sessions. Attempts to read preferences always returned defaults, and settings saved in the Configure action disappeared after restarting OmniFocus or re-running the plugin.

The plugin had a shared library (`lintUtils.js`) consumed by five action files. Every action used `this.plugIn.preferences` to access persistent storage, which always returned `undefined`.

---

## Investigation: What Didn't Work

| Approach | Why It Failed |
|---|---|
| `this.plugIn.preferences` | `preferences` is **not a property** on the `PlugIn` class. PlugIn exposes: `actions`, `author`, `description`, `displayName`, `handlers`, `identifier`, `libraries`, `version`, `URL` — no `preferences`. Always `undefined`. |
| Bracket notation `prefs["key"] = value` | `Preferences` objects don't support property assignment. Silently does nothing; data is never persisted. |
| `new PlugIn.Preferences(identifier)` | `PlugIn.Preferences` is not a valid constructor path in the OmniJS API. |
| JSON stored in an OmniFocus tag note | Saved within the current session but was not reliably flushed to the database. Lost on OmniFocus restart. |
| `new Preferences()` inside an action handler | Throws: **"Preferences objects may only be constructed when loading a plug-in"** — the construction window has already closed by the time the user triggers an action. |

---

## Root Cause

The OmniJS runtime enforces a strict **load-time construction constraint** on the `Preferences` class. `new Preferences()` is only permitted during the plugin loading phase — when OmniFocus evaluates the plugin's IIFE files on startup or install. Any attempt to construct `Preferences` inside an action handler callback (which runs later, triggered by user interaction) throws a runtime error.

The load phase is the runtime's opportunity to associate the preferences store with the correct plugin identifier. Once loading completes, the constructor is locked out.

---

## Solution

### 1. Construct `Preferences` in the Library IIFE at Load Time

Create the object once inside the shared library's IIFE, which executes during plugin load:

```javascript
// lintUtils.js
(() => {
    const lib = new PlugIn.Library(new Version("1.0"));

    // Preferences must be constructed at load time, not inside action handlers.
    lib.prefs = new Preferences();

    lib.DEFAULTS = {
        reviewTagName:           "⚠ Review Lint",
        alsoFlag:                false,
        scopeMode:               "ALL_ACTIVE_PROJECTS",
        inboxMaxAgeDays:         2,
        deferPastGraceDays:      7,
        waitingTagName:          "Waiting",
        waitingStaleDays:        21,
        enableWaitingSinceStamp: true,
        triageTagName:           "Needs Triage"
    };

    lib.readPref = function(prefs, key, defaultValue) {
        const fallback = (defaultValue !== undefined) ? defaultValue : lib.DEFAULTS[key];
        if (!prefs) return fallback;
        const val = prefs.read(key);                           // .read(), never bracket notation
        return (val === null || val === undefined) ? fallback : val;
    };

    return lib;
})();
```

### 2. Access the Pre-Built Instance from Action Files

Each action retrieves the library and reads `lib.prefs` — the already-constructed object:

```javascript
// anyAction.js
(() => {
    const action = new PlugIn.Action(async function(selection, sender) {
        const lib   = this.plugIn.library("lintUtils");
        const prefs = lib.prefs;   // reference to the object built at load time

        const tagName = lib.readPref(prefs, "reviewTagName");  // reads with fallback to defaults
    });

    return action;
})();
```

### 3. Use `.read()` and `.write()` — Never Bracket Notation

```javascript
// Reading
const value = prefs.read("myKey");        // returns null if key not yet set

// Writing
prefs.write("reviewTagName", "⚠ Review");
prefs.write("alsoFlag", true);
prefs.write("inboxMaxAgeDays", 7);

// WRONG — silently does nothing
prefs["myKey"] = "value";
const v = prefs["myKey"];   // always undefined
```

---

## Secondary Fixes Found During the Same Investigation

### OmniJS URL Navigation — `url.open()`, Not `app.openURL()`

```javascript
// WRONG — app.openURL is not a function
app.openURL(url);

// CORRECT — URL instances have an open() method
const url = URL.fromString("omnifocus:///tag/" + encodeURIComponent(tagName));
if (url) url.open();
```

### Task Dropped Status — `Task.Status.Dropped`, Not `task.dropped`

```javascript
// WRONG — task.dropped is not a valid property; always undefined
if (task.dropped) { ... }

// CORRECT
if (task.taskStatus === Task.Status.Dropped) { ... }

// Full isRemaining helper
lib.isRemaining = function(task) {
    if (task.completed) return false;
    if (task.taskStatus === Task.Status.Dropped) return false;
    return true;
};
```

### `project.flattenedTasks` Includes the Project Root Task

`project.flattenedTasks` returns every task in the project **including `project.task`** (the root task that represents the project itself). Failing to exclude it causes double-processing or inflated task counts.

```javascript
// CORRECT — exclude the root task explicitly
const childTasks = project.flattenedTasks.filter(t => t !== project.task);

// In resolveTasksForLint:
proj.flattenedTasks.forEach(t => {
    if (lib.isRemaining(t) && t !== proj.task) add(t);
});

// In computeProjectReasons:
const remainingTasks = project.flattenedTasks.filter(
    t => lib.isRemaining(t) && t !== project.task
);
```

---

## Prevention & Best Practices

### Load Time vs Runtime — The Central Rule

OmniJS enforces a hard boundary:

| Phase | When | What's allowed |
|---|---|---|
| **Load time** | Plugin file IIFE executes on startup/install | `new Preferences()`, `new PlugIn.Action()`, module-level variable declarations |
| **Runtime** | User triggers an action | Everything else — DOM queries, OmniFocus data reads/writes, UI, async operations |

**Rule:** If an API says "may only be constructed when loading a plug-in," capture it in a module-level variable during load. Never lazily construct it inside a handler.

### OmniJS Gotchas Checklist

- `this.plugIn.preferences` does not exist. Use `new Preferences()` at load time.
- Bracket notation assignment on `Preferences` is silent and ineffective. Always use `.write(key, value)`.
- `.read(key)` returns `null` (not `undefined`) when a key was never set. Guard with `=== null`.
- `app.openURL(url)` does not exist. Use `url.open()` on a `URL` instance.
- `task.dropped` is not a property. Use `task.taskStatus === Task.Status.Dropped`.
- `project.flattenedTasks` includes `project.task` (the root task). Exclude it explicitly.
- Unhandled promise rejections in action handlers can be swallowed silently — always use `try/catch` with `async/await`.

### Recommended Plugin Architecture

```javascript
// library.js (evaluated first, at load time)
(() => {
    const lib   = new PlugIn.Library(new Version("1.0"));
    lib.prefs   = new Preferences();   // ONLY valid place to construct this

    lib.readPref  = (key, def)    => { const v = lib.prefs.read(key); return v ?? def; };
    lib.writePref = (key, value)  => { lib.prefs.write(key, value); };

    return lib;
})();

// action.js (evaluated at load time, handler runs at user-trigger time)
(() => {
    const action = new PlugIn.Action(async function(selection) {
        const lib = this.plugIn.library("myLibrary");
        // lib.prefs already constructed — safe to read/write
        const setting = lib.readPref("mySetting", "default");
    });
    return action;
})();
```

### Testing Strategies for OmniJS Plugins

- **Extract pure logic** (date formatting, string parsing, filtering) into plain `.js` files testable with Node.js, keeping OmniJS-specific calls in thin adapter wrappers.
- **Use the OmniFocus Automation console** to smoke-test expressions (`Task.Status.Dropped`, `preferences.readString("key")`) before shipping.
- **Add runtime guards** for null assumptions: wrap `PlugIn.find()` results so missing libraries surface immediately with a clear error.
- **Save regression scripts** in a `tests/` folder — minimal console-paste scripts that reproduce fixed bugs for future verification.

---

## References

- [Omni Automation Plug-In Documentation](https://omni-automation.com/omnifocus/plug-in.html)
- [OmniGroup Automation Community Forum](https://discourse.omnigroup.com/c/omnifocus/automation/)
- Related plan: `docs/plans/2026-02-26-feat-omnifocus-review-linter-plugin-plan.md`
- Working implementation: `ReviewLinter.omnifocusjs/Resources/lintUtils.js`
