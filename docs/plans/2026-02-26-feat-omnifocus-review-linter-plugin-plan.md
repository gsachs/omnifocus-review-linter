---
title: "feat: OmniFocus Review Linter Plugin"
type: feat
status: completed
date: 2026-02-26
origin: docs/brainstorms/2026-02-26-review-linter-brainstorm.md
---

# OmniFocus Review Linter Plugin

## Overview

Build a complete OmniFocus plugin bundle (`ReviewLinter.omnifocusjs`) using Omni Automation (OmniJS) that audits active projects and tasks for GTD hygiene issues. The plugin marks problems with a single tag plus structured note stamps, presents summary dialogs, and offers conservative auto-remediation.

Five actions: **Lint Sweep**, **Open Lint Queue**, **Clear Lint Marks**, **Fix Pack**, **Configure Review Linter**. macOS only. Native OmniJS dialogs throughout. (see brainstorm: `docs/brainstorms/2026-02-26-review-linter-brainstorm.md`)

## Problem Statement

OmniFocus users accumulate stale projects (no next action, overdue tasks, empty), aging inbox items, and forgotten deferred/waiting tasks. Manual review catches these inconsistently. An automated linter surfaces hygiene issues so the user can address them in a focused review session.

## Proposed Solution

A self-contained `.omnifocusjs` plugin bundle that:

1. **Scans** projects and tasks against configurable rules (Lint Sweep)
2. **Marks** issues with a tag + note stamps for traceability
3. **Navigates** to marked items (Open Lint Queue)
4. **Cleans up** marks after review (Clear Lint Marks)
5. **Auto-fixes** common issues conservatively (Fix Pack)
6. **Exposes all settings** through a native form (Configure)

## Technical Approach

### Architecture

```
ReviewLinter.omnifocusjs/
├── manifest.json                 # Plugin metadata, action & library declarations
├── Actions/
│   ├── lintSweep.js              # Core scan + mark logic
│   ├── openLintQueue.js          # URL scheme navigation to review tag
│   ├── clearLintMarks.js         # Remove tags + optional stamp cleanup
│   ├── fixPack.js                # Conservative auto-remediation
│   └── configure.js              # Settings form with folder/tag pickers
└── Lib/
    └── lintUtils.js              # Shared: prefs, stamps, dates, scope, tags
```

**Convention:** Action filenames are camelCase matching their `identifier` in `manifest.json` (OmniJS requirement).

### OmniJS API Surface (from research)

| Concept | API | Notes |
|---------|-----|-------|
| All projects | `flattenedProjects` | Global accessor |
| Active filter | `p.status === Project.Status.Active` | Enum: Active, OnHold, Done, Dropped |
| Remaining tasks | `project.flattenedTasks.filter(t => !t.completed && !t.dropped)` | |
| Task availability | `task.taskStatus` | Enum: Available, Blocked, Completed, Dropped, DueSoon, Next, Overdue |
| Tags on project | `project.task.addTag(tag)` / `project.task.removeTag(tag)` | Projects use root task for tags |
| Tags on task | `task.addTag(tag)` / `task.removeTag(tag)` | Direct |
| Find tag | `flattenedTags.byName(name)` or `.find(t => t.name === name)` | |
| Create tag | `new Tag(name)` | Immediate, no save step |
| Notes | `task.note` / `project.note` | Plain text string, read/write |
| Preferences | `this.plugIn.preferences` | Property-style read/write, persists across sessions |
| Forms | `new Form()`, `Form.Field.*`, `form.show(title, label)` → Promise | Cancel rejects the promise |
| Alerts | `new Alert(title, msg)`, `.addOption(label)`, `.show()` → Promise\<Number\> | Button index |
| URL nav | `URL.fromString(str)`, `app.openURL(url)` | |
| Folders | `flattenedFolders` | For picker enumeration |
| Task creation date | `task.addedDate` | OF4; may be undefined in OF3 |
| Library loading | `this.plugIn.library("lintUtils")` | Returns PlugIn.Library instance |

### Preferences Schema

All preferences stored via `this.plugIn.preferences` with these keys and defaults:

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `reviewTagName` | string | `"⚠ Review Lint"` | Tag applied to flagged items |
| `alsoFlag` | boolean | `false` | Also set the OmniFocus flag on marked items |
| `scopeMode` | string | `"ALL_ACTIVE_PROJECTS"` | One of: ALL_ACTIVE_PROJECTS, FOLDER_SCOPE, TAG_SCOPE |
| `scopeFolderId` | string | `null` | primaryKey of scoped folder |
| `scopeTagId` | string | `null` | primaryKey of scoped tag |
| `excludeTagNames` | string | `"Someday/Maybe"` | Comma-separated tag names to exclude |
| `includeOnHoldProjects` | boolean | `false` | Include on-hold projects in scope |
| `lintTasksEnabled` | boolean | `true` | Enable task-level linting |
| `inboxMaxAgeDays` | number | `2` | Inbox age threshold |
| `deferPastGraceDays` | number | `7` | Defer-past grace period |
| `waitingTagName` | string | `"Waiting"` | Tag name for waiting-for items |
| `waitingStaleDays` | number | `21` | Days before waiting becomes stale |
| `enableWaitingSinceStamp` | boolean | `true` | Enable @waitingSince stamp management |
| `triageTagName` | string | `"Needs Triage"` | Tag applied by Fix Pack to old inbox items |

### Note Stamp Format

Three tokens, each on their own line:

```
@lintAt(2026-02-26)
@lint(P_NO_NEXT_ACTION,P_HAS_OVERDUE)
@waitingSince(2026-01-15)
```

**Regex patterns:**

```javascript
const LINT_AT_RE  = /@lintAt\(\d{4}-\d{2}-\d{2}\)/;
const LINT_RE     = /@lint\([A-Z_,]+\)/;
const WAITING_RE  = /@waitingSince\(\d{4}-\d{2}-\d{2}\)/;
```

**Rules:**
- **Upsert:** If regex matches, replace in-place. If not, append to end of note on a new line.
- **Separation:** If note is non-empty and does not end with a newline, add `\n` before the new stamp.
- **Removal:** Replace regex match with empty string, then collapse multiple blank lines.
- **Preservation:** All user content outside stamp tokens is untouched.

### Reason Codes

**Project reasons** (checked during Lint Sweep):

| Code | Condition |
|------|-----------|
| `P_NO_NEXT_ACTION` | No remaining task has `taskStatus` in {Available, Next, DueSoon, Overdue}. Skip if `taskStatus` unavailable on the build. |
| `P_HAS_OVERDUE` | Any remaining task has `effectiveDueDate < now` |
| `P_EMPTY` | Zero remaining tasks |

**Task reasons** (checked when `lintTasksEnabled=true`):

| Code | Condition |
|------|-----------|
| `T_OVERDUE` | `effectiveDueDate < now` |
| `T_DEFER_PAST` | `deferDate` exists and `daysBetween(deferDate, now) > deferPastGraceDays` |
| `T_INBOX_OLD` | `task.inInbox` and `task.addedDate` exists and `daysBetween(addedDate, now) > inboxMaxAgeDays`. Skip items already tagged with `triageTagName`. Skip + count if `addedDate` unavailable. |
| `T_WAITING_TOO_LONG` | Task has `waitingTagName` tag AND has `@waitingSince(date)` stamp AND `daysBetween(date, now) > waitingStaleDays`. If stamp missing, do NOT flag. |

### Implementation Phases

#### Phase 1: Foundation — `manifest.json` + `Lib/lintUtils.js` + `Actions/configure.js`

Build the shared infrastructure that all actions depend on.

**`manifest.json`**

```json
{
    "defaultLocale": "en",
    "identifier": "com.omnifocus.review-linter",
    "version": "1.0",
    "author": "Review Linter Contributors",
    "description": "Audits OmniFocus projects and tasks for GTD hygiene issues.",
    "actions": [
        {
            "identifier": "lintSweep",
            "label": "Lint Sweep",
            "shortLabel": "Lint Sweep",
            "description": "Scan active projects and tasks for lint issues.",
            "image": "checkmark.circle"
        },
        {
            "identifier": "openLintQueue",
            "label": "Open Lint Queue",
            "shortLabel": "Lint Queue",
            "description": "Navigate to the lint review tag.",
            "image": "tag"
        },
        {
            "identifier": "clearLintMarks",
            "label": "Clear Lint Marks",
            "shortLabel": "Clear Marks",
            "description": "Remove lint tags and optional stamps.",
            "image": "xmark.circle"
        },
        {
            "identifier": "fixPack",
            "label": "Fix Pack",
            "shortLabel": "Fix Pack",
            "description": "Auto-remediate common lint issues.",
            "image": "wrench"
        },
        {
            "identifier": "configure",
            "label": "Configure Review Linter",
            "shortLabel": "Configure",
            "description": "Set preferences for the Review Linter plugin.",
            "image": "gear"
        }
    ],
    "libraries": [
        {
            "identifier": "lintUtils"
        }
    ]
}
```

**`Lib/lintUtils.js`** — shared library with these exported functions:

```
Preferences helpers:
  lib.readPref(prefs, key, defaultValue)    — read with fallback to default
  lib.DEFAULTS                               — object of all default preference values

Date helpers:
  lib.formatDate(date)                       — "YYYY-MM-DD"
  lib.parseDate(str)                         — Date from "YYYY-MM-DD"
  lib.daysBetween(dateA, dateB)              — integer days
  lib.startOfToday()                         — Date at midnight

Stamp helpers:
  lib.LINT_AT_RE, lib.LINT_RE, lib.WAITING_RE  — regex patterns
  lib.upsertStamp(note, regex, newStamp)       — replace or append
  lib.removeStamp(note, regex)                 — remove and clean whitespace
  lib.readStamp(note, regex)                   — extract the stamp value or null
  lib.readLintReasons(note)                    — parse @lint() CSV into array
  lib.readWaitingSince(note)                   — parse @waitingSince() into Date

Scope helpers:
  lib.resolveProjects(prefs)                   — return array of in-scope projects
  lib.resolveTasksForLint(prefs, projects)     — return in-scope tasks (project tasks + inbox)
  lib.shouldExclude(item, excludeTagNames)     — check exclude tags
  lib.parseExcludeTags(csv)                    — split comma string into array

Tag helpers:
  lib.findOrCreateTag(name)                    — find by name or create; returns tag or null
  lib.ensureReviewTag(prefs)                   — find/create review tag, return it or null

Reason aggregation:
  lib.computeProjectReasons(project, prefs)    — returns string[] of reason codes
  lib.computeTaskReasons(task, prefs, lib)     — returns string[] of reason codes
  lib.isTaskAvailableIsh(task)                 — check taskStatus enum
```

**`Actions/configure.js`** — Settings form:

- Read current preferences with defaults
- Build a `Form` with all preference fields
- For `scopeMode` = FOLDER_SCOPE: show a second `Form.Field.Option` enumerating `flattenedFolders` by name
- For `scopeMode` = TAG_SCOPE: show a `Form.Field.Option` enumerating `flattenedTags` by name
- Implementation note: OmniJS forms are static once shown — cannot dynamically show/hide fields. Use a two-step approach: first form picks scopeMode + basic settings, if scope requires a picker, show a second form for the specific folder/tag selection.
- Write all values to `this.plugIn.preferences`
- Show confirmation alert

**Acceptance criteria — Phase 1:**
- [x] `manifest.json` is valid and all 5 actions + library are declared
- [x] `lintUtils.js` exports all listed functions
- [x] `configure.js` reads/writes all preferences
- [x] Configure shows folder/tag picker when relevant scope mode selected
- [x] Default preferences are used when no stored value exists
- [x] All stamp regexes match the defined formats and nothing else

#### Phase 2: Core Lint — `Actions/lintSweep.js` + `Actions/openLintQueue.js`

**`Actions/lintSweep.js`** — the main scanning action:

1. Load library and preferences
2. **Scope validation:** Call `lib.resolveProjects(prefs)`. If scope mode is FOLDER_SCOPE or TAG_SCOPE and the target entity is missing, show an alert: "Configured [folder/tag] not found. Please run Configure Review Linter." Abort.
3. **Ensure review tag:** Call `lib.ensureReviewTag(prefs)`. If tag cannot be created, show error alert and abort.
4. **Project scan:** For each in-scope project (excluding by excludeTagNames, respecting includeOnHoldProjects):
   - Call `lib.computeProjectReasons(project, prefs)` → reasons[]
   - If reasons non-empty: add review tag to `project.task`, optionally flag, upsert `@lintAt(today)` and `@lint(reasons.join(","))` in `project.note`
   - If reasons empty and project already has review tag: leave it (previous marks persist until cleared)
5. **Task scan** (if `lintTasksEnabled`):
   - Collect tasks from in-scope projects + inbox tasks
   - For each task (excluding by excludeTagNames):
     - Call `lib.computeTaskReasons(task, prefs, lib)` → reasons[]
     - Track skipped counts (inbox without `addedDate`, etc.)
     - If reasons non-empty: add review tag, optionally flag, upsert stamps in `task.note`
6. **Summary dialog:** Build summary string with counts:
   ```
   Projects flagged: 3
     P_NO_NEXT_ACTION: 2
     P_HAS_OVERDUE: 1
     P_EMPTY: 0

   Tasks flagged: 5
     T_OVERDUE: 2
     T_DEFER_PAST: 1
     T_INBOX_OLD: 1 (1 skipped — no creation date)
     T_WAITING_TOO_LONG: 1
   ```
   If zero issues found: simplified dialog with only "Done" button.
   If issues found: buttons "Open Lint Queue" (0), "Run Fix Pack" (1), "Done" (2).
   On "Open Lint Queue": call Open Lint Queue logic inline (URL scheme).
   On "Run Fix Pack": show alert "Please run Fix Pack from the Automation menu." (cannot invoke another action programmatically in OmniJS).

**`Actions/openLintQueue.js`** — navigation:

1. Read `reviewTagName` from preferences
2. Build URL: `omnifocus:///tag/` + `encodeURIComponent(reviewTagName)`
3. Call `app.openURL(URL.fromString(url))`
4. If URL construction fails, show alert with manual instructions

**Acceptance criteria — Phase 2:**
- [x] Lint Sweep flags projects with correct reason codes
- [x] Lint Sweep flags tasks with correct reason codes
- [x] Stamps are idempotent — running twice produces no duplicates
- [x] Scope modes (ALL, FOLDER, TAG) filter correctly
- [x] Exclude tags are respected
- [x] On-hold projects included only when `includeOnHoldProjects=true`
- [x] P_NO_NEXT_ACTION uses `taskStatus` and skips gracefully if unavailable
- [x] T_INBOX_OLD skips items with `triageTagName` tag and items without `addedDate`
- [x] T_WAITING_TOO_LONG only flags when `@waitingSince` stamp exists and is stale
- [x] Summary dialog shows correct breakdown including skipped counts
- [x] Zero-issue case shows simplified dialog
- [x] Open Lint Queue opens correct tag view via URL scheme
- [x] Unicode emoji in tag name is URL-encoded correctly

#### Phase 3: Cleanup & Remediation — `Actions/clearLintMarks.js` + `Actions/fixPack.js`

**`Actions/clearLintMarks.js`**:

1. Load library and preferences
2. Show form asking scope of clearing:
   - Option A: "Selected items" (uses `selection.tasks` + `selection.projects`)
   - Option B: "All in configured scope" (uses `lib.resolveProjects(prefs)` + associated tasks)
3. Find the review tag. If it doesn't exist, show "No lint tag found" and abort.
4. For each target item:
   - Remove review tag from task/project
   - If `alsoFlag` is true: show checkbox "Also remove flags?" (default off). If checked, set `flagged = false`
   - Show checkbox "Also remove @lint and @lintAt stamps?" (default off). If checked, call `lib.removeStamp` for both
5. Show summary: "Cleared N projects, M tasks."

**`Actions/fixPack.js`**:

1. Load library and preferences
2. Show form with toggle checkboxes (all default off):
   - `[x] Add @waitingSince(today) to waiting tasks that lack it` (if `enableWaitingSinceStamp`)
   - `[x] Reset @waitingSince(today) for tasks flagged T_WAITING_TOO_LONG` (new — resolves SpecFlow gap)
   - `[x] Tag inbox items older than N days with "triageTagName"`
   - `[x] Repair stale defer dates` → sub-option: "Set to today" or "Clear defer date"
3. For each enabled toggle, execute:
   - **Waiting stamp:** Find tasks with `waitingTagName` tag that lack `@waitingSince`. Upsert stamp.
   - **Waiting reset:** Find tasks with `waitingTagName` tag AND `@waitingSince` older than `waitingStaleDays`. Upsert `@waitingSince(today)`.
   - **Inbox triage:** Find inbox tasks where `addedDate` > `inboxMaxAgeDays`. Find or create `triageTagName` tag. If creation fails, show alert with instructions. Add tag to matching tasks.
   - **Defer repair:** Find tasks where `deferDate` is in the past by more than `deferPastGraceDays` and task is not completed/dropped. Apply user's selected policy (set today / clear).
4. Show summary: "Fixed N waiting stamps, M inbox items triaged, K defer dates repaired."
5. Fix Pack does NOT set due dates (spec requirement).

**Acceptance criteria — Phase 3:**
- [x] Clear Lint Marks removes tags from selected items or all in scope
- [x] Optional unflag only offered when `alsoFlag=true`
- [x] Optional stamp removal works correctly (removes without corrupting notes)
- [x] Fix Pack: waiting stamp added only to tasks that lack it
- [x] Fix Pack: waiting reset updates stale stamps
- [x] Fix Pack: triage tag created if missing, error handled if creation fails
- [x] Fix Pack: defer repair applies correct policy (today or clear)
- [x] Fix Pack never sets due dates
- [x] All note manipulations preserve user content

### SpecFlow-Identified Edge Cases (Addressed)

| Gap | Resolution |
|-----|-----------|
| First run before Configure | All actions read preferences with defaults. Lint Sweep auto-creates review tag if missing. |
| Notes are plain text? | OmniJS `note` property is plain text. Regex manipulation is safe. |
| Deleted scope folder/tag | Lint Sweep shows alert + aborts. Prompts user to reconfigure. |
| Fix Pack + T_INBOX_OLD interaction | Lint Sweep skips inbox items already tagged with `triageTagName`. |
| @waitingSince reset for stale items | Fix Pack gains a "reset stale @waitingSince" toggle. |
| Clear Lint Marks scope | Uses same scope as Configure preferences. |
| Stamp insertion position | Appended to end of note on a new line. |
| Zero issues dialog | Simplified with only "Done" button. |
| "Needs Triage" hardcoded | Added `triageTagName` preference (default "Needs Triage"). |
| Progress on large databases | No progress bar in v1. Documented as known limitation. |
| Plugin version tracking | Store `pluginVersion: "1.0"` in preferences on Configure save. |
| URL encoding of emoji tag name | Use `encodeURIComponent()` which handles Unicode correctly. |

### File-by-File Summary

| File | Lines (est.) | Responsibility |
|------|-------------|----------------|
| `manifest.json` | ~50 | Plugin metadata and declarations |
| `Lib/lintUtils.js` | ~200 | All shared logic: prefs, stamps, dates, scope, tags, reasons |
| `Actions/configure.js` | ~120 | Settings form with folder/tag pickers |
| `Actions/lintSweep.js` | ~150 | Project + task scanning, marking, summary dialog |
| `Actions/openLintQueue.js` | ~25 | URL scheme navigation |
| `Actions/clearLintMarks.js` | ~80 | Tag/stamp removal with scope options |
| `Actions/fixPack.js` | ~120 | Auto-remediation with toggle form |

**Total: ~745 lines across 7 files.**

## Acceptance Criteria

### Functional Requirements

- [x] Plugin installs by double-clicking the `.omnifocusjs` bundle on macOS
- [x] All 5 actions appear in the OmniFocus Automation menu
- [x] Configure persists all preferences across OmniFocus restarts
- [x] Lint Sweep correctly identifies all 7 reason codes (3 project, 4 task)
- [x] Lint Sweep marks items with review tag + note stamps
- [x] Open Lint Queue navigates to the review tag in OmniFocus
- [x] Clear Lint Marks removes tags (and optionally flags + stamps) from targets
- [x] Fix Pack applies only user-selected fixes
- [x] All note manipulations are idempotent and preserve user content
- [x] Running Lint Sweep twice with no changes produces identical marks
- [x] Missing tags are created automatically where possible, with clear errors otherwise

### Non-Functional Requirements

- [x] No action modifies data without explicit user trigger
- [x] All forms handle cancellation gracefully (no errors, no partial writes)
- [x] Scope validation prevents silent empty scans
- [x] Plugin works on OmniFocus 3 and 4 for macOS

## Dependencies & Prerequisites

- OmniFocus Pro (required for Omni Automation / plugin support)
- macOS (no iOS support in v1)
- No external dependencies — pure OmniJS

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `task.taskStatus` unavailable in some OF builds | Low | P_NO_NEXT_ACTION skipped | Guard with typeof check; count and report skipped |
| `task.addedDate` unavailable in OF3 | Medium | T_INBOX_OLD skipped for some tasks | Guard with existence check; count and report skipped |
| Large database performance (500+ projects) | Medium | UI freeze during sweep | v1 known limitation. Document in README. Consider batching in v2. |
| Tag name with emoji breaks URL scheme | Low | Open Lint Queue fails | Test `encodeURIComponent` with emoji. Fallback alert with instructions. |
| Preferences API behavior varies between OF versions | Low | Settings not persisted | Use property-style access (safest per research). Test on target version. |

## Sources & References

### Origin

- **Brainstorm document:** [docs/brainstorms/2026-02-26-review-linter-brainstorm.md](docs/brainstorms/2026-02-26-review-linter-brainstorm.md) — Key decisions: macOS only, native dialogs, strict taskStatus for availability, Preferences API, Configure as 5th action, folder/tag picker via enumeration, URL scheme for lint queue.

### External References

- Omni Automation docs: https://omni-automation.com/omnifocus/
- Plugin bundles: https://omni-automation.com/omnifocus/plug-in.html
- Form API: https://omni-automation.com/omnifocus/forms.html
- Task class: https://omni-automation.com/omnifocus/task.html
- OmniGroup Discourse: https://discourse.omnigroup.com/c/omnifocus/automation/
