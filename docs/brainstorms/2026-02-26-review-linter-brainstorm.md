---
date: 2026-02-26
topic: review-linter
---

# Review Linter — OmniFocus Plugin

## What We're Building

An OmniFocus plugin bundle (`ReviewLinter.omnifocusjs`) using Omni Automation (OmniJS) that audits active projects and tasks for common GTD hygiene issues. It marks problems with a single tag plus structured note stamps, presents a summary dialog, and offers a Fix Pack to auto-remediate common issues.

The plugin ships with 5 actions: **Lint Sweep**, **Open Lint Queue**, **Clear Lint Marks**, **Fix Pack**, and **Configure Review Linter**.

## Key Decisions

- **macOS only**: Simplifies the implementation — full OmniJS API surface, URL scheme navigation, and native dialogs all work without iOS limitations.

- **Native OmniJS dialogs**: Use `Alert` and `Form` from the Omni Automation API throughout. Simpler, visually consistent with OmniFocus. No HTML/WebView complexity.

- **`task.isAvailable` (strict) for P_NO_NEXT_ACTION**: Rather than a custom heuristic, rely on OmniFocus's own availability computation. This respects sequential project ordering, on-hold tasks, and deferred items correctly. No fallback heuristic — if the API property doesn't exist on a given build, log a warning and skip the check for that project.

- **Preferences via Omni Automation Preferences API**: All user-configurable values (tag names, day thresholds, scope mode, folder/tag IDs, toggles) persist across sessions using `PlugIn.find(...).preferences`. No editing source files.

- **Configure action (5th action)**: A dedicated settings dialog exposes all preferences through a native Form. Users don't need to touch source code. Scope selection (ALL_ACTIVE_PROJECTS / FOLDER_SCOPE / TAG_SCOPE) with corresponding ID fields.

- **Distribution as a .zip release**: The `.omnifocusjs` bundle is zipped for sharing. README includes install instructions (unzip → double-click to install, or drag to Application Scripts folder).

- **Lib/lint-utils.js for shared logic**: All stamp parsing/writing (regex), date helpers, scope resolution, and reason aggregation live here. Actions import from this lib. Keeps actions thin.

- **Note stamp strategy**: Stamps (`@lintAt`, `@lint`, `@waitingSince`) are inserted/updated in-place within existing notes. User content is preserved. Regex replacements are idempotent.

## File Structure

```
ReviewLinter.omnifocusjs/
├── manifest.json
├── Actions/
│   ├── LintSweep.js
│   ├── OpenLintQueue.js
│   ├── ClearLintMarks.js
│   ├── FixPack.js
│   └── Configure.js
└── Lib/
    └── lint-utils.js
```

## Resolved Questions

- **Scope ID selection in Configure**: Use a picker that enumerates all folders/tags in a dropdown. User-friendly — no need to know/paste internal IDs.

- **`task.isAvailable` API availability**: If `isAvailable` is missing, skip P_NO_NEXT_ACTION for that project and report skipped count in the summary dialog.

- **Open Lint Queue navigation**: Use the OmniFocus URL scheme (`omnifocus:///tag?name=<tagName>`) to open the tag view on macOS.

## Next Steps

→ `/workflows:plan` for implementation details
