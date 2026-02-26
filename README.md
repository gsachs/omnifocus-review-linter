# Review Linter for OmniFocus

An OmniFocus plugin that audits your projects and tasks for GTD hygiene issues. It marks problems with a single tag and note stamps, letting you work through them in a focused review session.

## Requirements

- OmniFocus Pro (required for Omni Automation plugin support)
- macOS (OmniFocus 3 or 4)

## Installation

1. Download and unzip `ReviewLinter.omnifocusjs.zip`
2. Double-click `ReviewLinter.omnifocusjs` — OmniFocus will prompt to install it

   **Alternative:** Drag the bundle into:
   `~/Library/Application Scripts/com.omnigroup.OmniFocus3/`

3. Open OmniFocus and look for the five actions in **Automation → Review Linter**

### For Developers: Packaging the Bundle

To create a distributable `.zip` file from the source:

```bash
ditto -c -k --sequesterRsrc ReviewLinter.omnifocusjs ReviewLinter.omnifocusjs.zip
```

This creates a macOS-compatible zip that preserves the bundle structure. The resulting `ReviewLinter.omnifocusjs.zip` can be distributed to users, who can then unzip and double-click to install.

## Actions

### 1. Lint Sweep

Scans your active projects and tasks for hygiene issues and marks them.

**Project checks:**

| Code | Triggered when |
|------|---------------|
| `P_NO_NEXT_ACTION` | No remaining task is available for action |
| `P_HAS_OVERDUE` | Any remaining task is past its due date |
| `P_EMPTY` | Project has no remaining tasks |

**Task checks** (when task linting is enabled):

| Code | Triggered when |
|------|---------------|
| `T_OVERDUE` | Task is past its due date |
| `T_DEFER_PAST` | Defer date is more than N days in the past |
| `T_INBOX_OLD` | Inbox task is older than N days |
| `T_WAITING_TOO_LONG` | Task has the Waiting tag and a `@waitingSince` stamp older than N days |

Marked items receive:
- The review tag (default: `⚠ Review Lint`)
- Note stamps: `@lintAt(YYYY-MM-DD)` and `@lint(REASON_CODE,...)`
- Optionally: an OmniFocus flag (configure with **alsoFlag** setting)

After sweeping, a summary dialog offers:
- **Open Lint Queue** — navigate to the review tag view
- **Run Fix Pack** — reminder to run Fix Pack for auto-remediation
- **Done** — dismiss

### 2. Open Lint Queue

Navigates directly to the review tag view so you can work through flagged items.

### 3. Clear Lint Marks

Removes lint marks after you've reviewed and addressed issues.

**Options:**
- Clear **selected items** or **all items in your configured scope**
- Optionally remove flags (only offered if *Also Flag* is enabled)
- Optionally remove `@lint` and `@lintAt` stamps (default off)

### 4. Fix Pack

Applies conservative auto-fixes. All toggles are **off by default** — you choose what to apply.

**Available fixes:**
- **Add @waitingSince** — stamps Waiting-tagged tasks that are missing the stamp
- **Reset stale @waitingSince** — updates the stamp to today for tasks flagged as T_WAITING_TOO_LONG
- **Triage inbox** — adds the triage tag (default: `Needs Triage`) to old inbox items
- **Repair defer dates** — updates or clears defer dates that are stale by more than the grace period

Fix Pack **never sets due dates**.

### 5. Configure Review Linter

Opens a settings form. All settings persist across OmniFocus sessions.

## Preferences

| Setting | Default | Description |
|---------|---------|-------------|
| Review Tag Name | `⚠ Review Lint` | Tag applied to flagged items |
| Also Flag Items | Off | Set OmniFocus flag on marked items |
| Scope | All Active Projects | Limit scan to a specific folder or tag |
| Exclude Tags | `Someday/Maybe` | Comma-separated list of tags to exclude |
| Include On-Hold Projects | Off | Include on-hold projects in the scan |
| Lint Tasks | On | Enable task-level checks |
| Inbox Max Age (days) | 2 | Threshold for T_INBOX_OLD |
| Defer Past Grace (days) | 7 | Threshold for T_DEFER_PAST |
| Waiting Tag Name | `Waiting` | Tag that identifies waiting-for tasks |
| Waiting Stale (days) | 21 | Threshold for T_WAITING_TOO_LONG |
| Enable @waitingSince Stamps | On | Allow Fix Pack to manage @waitingSince |
| Triage Tag Name | `Needs Triage` | Tag applied by Fix Pack to old inbox items |

## Note Stamps

Review Linter writes structured tokens into item notes. These are always on their own line and never disturb surrounding content:

```
@lintAt(2026-02-26)         — date of last lint scan
@lint(P_NO_NEXT_ACTION)     — reason codes from last scan
@waitingSince(2026-01-15)   — date waiting began (written by Fix Pack)
```

Stamps are updated in-place on each run — they never duplicate.

## Scope Modes

| Mode | Behavior |
|------|----------|
| All Active Projects | Scans every active (and optionally on-hold) project |
| Folder Scope | Limits scan to projects within a selected folder |
| Tag Scope | Limits scan to projects whose root task carries a selected tag |

Inbox tasks are always included in task linting, regardless of scope mode.

## Known Limitations

- **v1 has no progress indicator.** On databases with hundreds of projects and thousands of tasks, Lint Sweep may cause OmniFocus to appear briefly unresponsive. This will be addressed in v2.
- **macOS only.** The plugin uses macOS-only OmniFocus URL schemes and the full Omni Automation API surface.
- **Preferences are per-device.** Settings do not sync across Macs.
- **`P_NO_NEXT_ACTION` requires OmniFocus 3+.** The check relies on `task.taskStatus`. If this property is unavailable on your build, the check is skipped and reported in the sweep summary.
- **T_INBOX_OLD requires OmniFocus 4.** The inbox age check relies on `task.addedDate`, which is only available in OmniFocus 4. On OmniFocus 3, affected tasks are counted as skipped in the summary.

## License

This plugin is released under the **MIT License**. See the LICENSE file for details.

You are free to use, modify, and distribute this plugin under the terms of the MIT License.
