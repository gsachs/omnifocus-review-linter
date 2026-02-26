---
title: "feat: Fix Pack Due Date Repair and Configure Single-Screen Form"
type: feat
status: active
date: 2026-02-27
---

# Fix Pack Due Date Repair & Configure Single-Screen Form

Two focused UX improvements to the Review Linter plugin.

---

## Feature 1: Fix Pack — Due Date Repair

### Overview

Fix Pack currently repairs stale **defer dates** (when a task becomes available) but ignores stale **due dates** (when a task is actually due). Add a "Fix Due Dates" toggle that lets users push overdue due dates to today or next week, mirroring the existing `repairDefer` pattern exactly.

### Proposed Solution

Add a new checkbox + policy option to the Fix Pack toggle form, and a corresponding loop block that sets `task.dueDate` for overdue tasks.

The `deferDate` repair pattern in `fixPack.js:44-58` is the direct template:

```javascript
// New checkbox
toggleForm.addField(new Form.Field.Checkbox(
    "repairDue",
    'Repair overdue due dates',
    false
));
// New policy picker
toggleForm.addField(new Form.Field.Option(
    "duePolicy", "Due Date Repair Policy",
    ["today", "next_week", "clear"],
    ["Set to today", "Set to next week", "Clear due date"],
    "today"
));
```

Then in the task loop, after the defer repair block:

```javascript
// Repair overdue due dates
if (doRepairDue && task.dueDate) {
    if (task.dueDate < now) {
        if (duePolicy === "today") {
            task.dueDate = lib.startOfToday();
        } else if (duePolicy === "next_week") {
            const d = lib.startOfToday();
            d.setDate(d.getDate() + 7);
            task.dueDate = d;
        } else {
            task.dueDate = null;
        }
        dueRepaired++;
    }
}
```

Note: use `task.dueDate` (not `task.effectiveDueDate`) for writing — `effectiveDueDate` is read-only and reflects inherited/computed dates. Only directly-set `dueDate` values should be mutated.

For the check, use `task.dueDate < now` (no grace period needed — any date in the past is overdue by definition for due dates, unlike defer dates which benefit from a grace window).

### Acceptance Criteria

- [ ] Fix Pack toggle form shows "Repair overdue due dates" checkbox
- [ ] When checked, a "Due Date Repair Policy" option appears below it with: "Set to today", "Set to next week", "Clear due date"
- [ ] Only tasks where `task.dueDate` exists and is strictly in the past are affected
- [ ] "Set to next week" sets the date to exactly 7 days from start-of-today
- [ ] Summary message includes count: e.g., "3 due dates repaired (next_week)."
- [ ] Tasks without a due date are untouched
- [ ] Projects are NOT affected (due date repair is task-only, consistent with defer repair)

### Files to Change

- `ReviewLinter.omnifocusjs/Resources/fixPack.js`
  - Toggle form: add `repairDue` checkbox and `duePolicy` Option field (~lines 44-59)
  - Destructuring: add `doRepairDue` and `duePolicy` variables (~line 68-72)
  - Task loop: add due date repair block after defer repair block (~line 175)
  - Counter: add `dueRepaired = 0` and increment inside the block
  - Summary: add `dueRepaired` line to `parts` array (~line 184)

---

## Feature 2: Configure — Single Screen

### Overview

Configure currently shows two screens: a main settings form followed by a conditional scope picker (only if Folder Scope or Tag Scope is selected). This two-step flow was necessary as a workaround but is awkward — the user has to click "Next" then interact with a second modal before settings are saved.

Since OmniJS Form API does not support conditional field visibility, the single-screen approach includes the folder and tag pickers upfront on the same form, with a note making clear they only apply when the matching scope mode is selected. Validation on save enforces that the right picker is set.

### Proposed Solution

Enumerate all folders and tags before showing the form, add both pickers as Option fields in the main form, and remove the second-screen step entirely. Rename the "Next" button to "Save".

```javascript
// Pre-enumerate folders and tags before building the form
const allFolders = Array.from(flattenedFolders).filter(f => f.status === Folder.Status.Active);
const allTags    = Array.from(flattenedTags);

const currentFolderId = lib.readPref(prefs, "scopeFolderId");
const currentTagId    = lib.readPref(prefs, "scopeTagId");

const mainForm = new Form();
// ... existing fields ...

// Folder picker (always shown; only relevant when scopeMode = FOLDER_SCOPE)
if (allFolders.length > 0) {
    const folderIds   = allFolders.map(f => f.id.primaryKey);
    const folderNames = allFolders.map(f => f.name);
    const defaultFolderId = folderIds.includes(currentFolderId) ? currentFolderId : folderIds[0];
    mainForm.addField(new Form.Field.Option(
        "scopeFolderId", "Scope Folder (if Folder Scope)",
        folderIds, folderNames, defaultFolderId
    ));
}

// Tag picker (always shown; only relevant when scopeMode = TAG_SCOPE)
if (allTags.length > 0) {
    const tagIds   = allTags.map(t => t.id.primaryKey);
    const tagNames = allTags.map(t => t.name);
    const defaultTagId = tagIds.includes(currentTagId) ? currentTagId : tagIds[0];
    mainForm.addField(new Form.Field.Option(
        "scopeTagId", "Scope Tag (if Tag Scope)",
        tagIds, tagNames, defaultTagId
    ));
}

// Show once, save directly
const result = await mainForm.show("Configure Review Linter", "Save");
```

On save, only persist `scopeFolderId` / `scopeTagId` when the corresponding scope mode is active (no change to existing preference semantics — if mode later switches to ALL_ACTIVE_PROJECTS, the stored IDs are simply ignored at runtime).

Edge cases:
- If no active folders exist and user picks FOLDER_SCOPE → show alert and revert to ALL_ACTIVE_PROJECTS (same logic as today, but inline after save rather than before the second screen).
- If no tags exist and user picks TAG_SCOPE → same alert and revert.

### Acceptance Criteria

- [ ] Configure shows a single form with one "Save" button (no "Next" step)
- [ ] Folder picker and tag picker are included in the main form when folders/tags exist in the database
- [ ] Field labels make clear they are conditional: "Scope Folder (if Folder Scope)" and "Scope Tag (if Tag Scope)"
- [ ] Saving persists all 15 preferences in one step with `prefs.write()`
- [ ] If FOLDER_SCOPE selected but no folders exist, alert and save as ALL_ACTIVE_PROJECTS
- [ ] If TAG_SCOPE selected but no tags exist, alert and save as ALL_ACTIVE_PROJECTS
- [ ] Previously-saved scope folder/tag is pre-selected as default when reopening Configure
- [ ] Form with no folders or no tags still works (pickers omitted if empty)

### Files to Change

- `ReviewLinter.omnifocusjs/Resources/configure.js`
  - Remove the two-step logic block (~lines 97-158)
  - Add folder/tag enumeration before `mainForm` construction
  - Add both Option fields to `mainForm` (after scopeMode field)
  - Change button label from `"Next"` to `"Save"`
  - Move validation for no-folders / no-tags edge case to post-save (inline alert + scope revert)
  - Save block remains identical — `prefs.write()` calls already cover all keys

---

## Implementation Order

1. **Feature 1 first** (Fix Pack due date) — smaller, self-contained, no form restructuring risk
2. **Feature 2 second** (Configure single screen) — larger refactor, test edge cases with real folders/tags

## Testing Notes

- **Fix Pack**: Test with tasks that have no due date (untouched), past due date (repaired), and future due date (untouched). Test all three policy values.
- **Configure**: Test with zero folders (picker omitted), one folder, many folders. Test scope switching back and forth. Confirm saved values survive OmniFocus restart via `lib.prefs.read("scopeFolderId")` in the console.

## Sources & References

- `ReviewLinter.omnifocusjs/Resources/fixPack.js` — defer repair pattern to replicate
- `ReviewLinter.omnifocusjs/Resources/configure.js` — two-step form to collapse
- `ReviewLinter.omnifocusjs/Resources/lintUtils.js:59-63` — `startOfToday()` helper for date setting
- `docs/solutions/runtime-errors/omnijs-preferences-invalid-plugin-property.md` — OmniJS Form API patterns and gotchas
