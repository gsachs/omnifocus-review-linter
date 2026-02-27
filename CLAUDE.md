# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Review Linter is an **OmniFocus Omni Automation plugin** (`.omnifocusjs` bundle) that audits GTD projects and tasks for hygiene issues. It runs entirely inside OmniFocus — there is no build system, no test runner, and no npm/bundler. The "source code" is the bundle itself.

## Bundle Structure

```
ReviewLinter.omnifocusjs/
  manifest.json          — plugin metadata: actions, libraries, identifier
  Resources/
    lintUtils.js         — shared library (loaded at plugin load time)
    lintSweep.js         — action: scan and flag
    openLintQueue.js     — action: navigate to lint tag view
    clearLintMarks.js    — action: remove lint tags/stamps
    fixPack.js           — action: auto-remediate issues
    configure.js         — action: preferences form
```

## Development Workflow

**There is no build step.** Edit JS files directly inside the bundle and reload the plugin in OmniFocus.

### Install for development

```bash
# Symlink the bundle so OmniFocus picks up edits live
ln -s "$(pwd)/ReviewLinter.omnifocusjs" \
  ~/Library/Application\ Scripts/com.omnigroup.OmniFocus3/ReviewLinter.omnifocusjs
```

### Package for distribution

```bash
ditto -c -k --sequesterRsrc ReviewLinter.omnifocusjs ReviewLinter.omnifocusjs.zip
```

### Reload plugin in OmniFocus

OmniFocus doesn't hot-reload. After editing, use **Automation → Reload Plug-Ins** (or restart OmniFocus).

## Architecture

### Shared Library (`lintUtils.js`)

All business logic lives here. It is an IIFE that returns a `PlugIn.Library` object. Action files access it via `this.plugIn.library("lintUtils")`.

Key responsibilities:
- **`DEFAULTS`** — canonical default values for all preferences
- **`readPref(prefs, key)`** — reads a preference with type coercion; numeric prefs are validated as finite, non-negative integers
- **Stamp helpers** — `upsertStamp` / `removeStamp` manage `@lintAt(...)`, `@lint(...)`, `@waitingSince(...)` tokens in item notes (each token lives on its own line, updated in-place)
- **`resolveProjects(prefs)`** — returns in-scope projects (respects `scopeMode`, `scopeFolderId`, `scopeTagId`, `includeOnHoldProjects`, exclude tags); returns `null` if a named scope target is missing
- **`resolveTasksForLint(prefs, projects)`** — returns tasks from in-scope projects + all inbox tasks (deduped via Set)
- **`computeProjectReasons(project, prefs, now)`** — returns `{ reasons, skipNoNextAction }` with applicable `P_*` codes
- **`computeTaskReasons(task, prefs, now)`** — returns `{ reasons, skippedInboxAge }` with applicable `T_*` codes
- **`applyDeferPolicy` / `applyDuePolicy`** — mutate task dates; used by Fix Pack

### Actions

Each action file is an IIFE returning a `PlugIn.Action`. Actions are async and use `Alert` / `Form` for all UI. Key patterns:

- **Scope validation first**: every action that touches data calls `resolveProjects` and alerts + returns if it gets `null`
- **Stamps are upserted, never duplicated**: regex patterns (`LINT_AT_RE`, `LINT_RE`, `WAITING_RE`) ensure idempotent updates
- **Fix Pack separates task loop from project root loop**: project root tasks are excluded from `resolveTasksForLint` (they are the project object itself), so Fix Pack processes them in a dedicated second loop

### Omni Automation API Surface Used

- `flattenedProjects`, `flattenedFolders`, `flattenedTags`, `inbox` — global collections
- `Task.Status.*`, `Project.Status.*`, `Folder.Status.*` — status enums
- `task.effectiveDueDate`, `task.dueDate`, `task.deferDate`, `task.addedDate`, `task.inInbox`
- `task.tags`, `task.addTag()`, `task.removeTag()`
- `task.taskStatus` — only in OmniFocus 3+; absence is handled gracefully (skips `P_NO_NEXT_ACTION`)
- `task.addedDate` — only in OmniFocus 4; absence skips `T_INBOX_OLD`
- `new Preferences()`, `prefs.read()`, `prefs.write()` — per-device storage
- `new Form()`, `Form.Field.*`, `new Alert()`, `URL.fromString().open()`

## Lint Reason Codes

**Project-level:** `P_NO_NEXT_ACTION`, `P_HAS_OVERDUE`, `P_OVERDUE`, `P_DEFER_PAST`, `P_EMPTY`

**Task-level:** `T_OVERDUE`, `T_DEFER_PAST`, `T_INBOX_OLD`, `T_WAITING_TOO_LONG`

## Important Invariants

- `Preferences` must be instantiated at library load time (not inside action handlers) — OmniFocus limitation documented in `docs/solutions/`.
- Zero-valued numeric preferences are valid and must be preserved (e.g., `deferPastGraceDays: 0` means flag immediately).
- `P_NO_NEXT_ACTION` is only emitted when `P_EMPTY` is absent — an empty project trivially has no next action.
- `T_WAITING_TOO_LONG` only fires when both the waiting tag AND a `@waitingSince` stamp are present; a missing stamp is not an error.
- Fix Pack processes **project root tasks in a separate loop** from regular tasks, because project root tasks are excluded from `resolveTasksForLint`.
