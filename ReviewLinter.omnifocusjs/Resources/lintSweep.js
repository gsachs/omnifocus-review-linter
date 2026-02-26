/*{
    "type": "action",
    "targets": ["omnifocus"],
    "author": "Review Linter Contributors",
    "identifier": "com.gsachs.review-linter.lintSweep",
    "version": "1.0",
    "description": "Scan active projects and tasks for lint issues.",
    "label": "Lint Sweep",
    "shortLabel": "Lint Sweep",
    "paletteLabel": "Lint Sweep",
    "image": "checkmark.circle"
}*/
(() => {
    const action = new PlugIn.Action(async function(selection, sender) {
        try {
            const lib   = this.plugIn.library("lintUtils");
            const prefs = lib.prefs;

            const now    = new Date();
            const today  = lib.formatDate(now);
            const alsoFlag = lib.readPref(prefs, "alsoFlag");
            const excludeTagNames = lib.parseExcludeTags(lib.readPref(prefs, "excludeTagNames"));

            // ── Scope validation ──────────────────────────────────────────────────

            const projects = lib.resolveProjects(prefs);
            if (projects === null) {
                const scopeMode = lib.readPref(prefs, "scopeMode");
                const label = scopeMode === "FOLDER_SCOPE" ? "folder" : "tag";
                await lib.showAlert(
                    "Scope Not Found",
                    `The configured ${label} no longer exists. ` +
                    "Please run Configure Review Linter to update your scope setting."
                );
                return;
            }

            // ── Ensure review tag ─────────────────────────────────────────────────

            const reviewTag = lib.findOrCreateTag(lib.readPref(prefs, "reviewTagName"));
            if (!reviewTag) {
                const tagName = lib.readPref(prefs, "reviewTagName");
                await lib.showAlert(
                    "Cannot Create Review Tag",
                    `The tag "${tagName}" could not be found or created. ` +
                    "Please create it manually in OmniFocus and re-run Lint Sweep."
                );
                return;
            }

            // ── Counters ──────────────────────────────────────────────────────────

            const projectCounts = {
                flagged:             0,
                P_NO_NEXT_ACTION:    0,
                P_HAS_OVERDUE:       0,
                P_EMPTY:             0,
                skippedNoNextAction: 0
            };
            const taskCounts = {
                flagged:          0,
                T_OVERDUE:        0,
                T_DEFER_PAST:     0,
                T_INBOX_OLD:      0,
                T_WAITING_TOO_LONG: 0,
                skippedInboxAge:  0
            };

            // ── Project scan ──────────────────────────────────────────────────────

            for (const project of projects) {
                const { reasons, skipNoNextAction } = lib.computeProjectReasons(project, prefs, now);

                if (skipNoNextAction) projectCounts.skippedNoNextAction++;

                if (reasons.length === 0) continue;

                projectCounts.flagged++;
                reasons.forEach(r => { projectCounts[r] = (projectCounts[r] || 0) + 1; });

                // Add review tag to project's root task
                const alreadyTagged = project.task.tags.some(t => t.name === reviewTag.name);
                if (!alreadyTagged) project.task.addTag(reviewTag);

                if (alsoFlag) project.flagged = true;

                // Upsert stamps in project note
                let note = project.note || "";
                note = lib.upsertStamp(note, lib.LINT_AT_RE,  "@lintAt(" + today + ")");
                note = lib.upsertStamp(note, lib.LINT_RE,     "@lint(" + reasons.join(",") + ")");
                project.note = note;
            }

            // ── Task scan ─────────────────────────────────────────────────────────

            if (lib.readPref(prefs, "lintTasksEnabled")) {
                const tasks = lib.resolveTasksForLint(prefs, projects);

                for (const task of tasks) {
                    if (lib.shouldExclude(task, excludeTagNames)) continue;

                    const { reasons, skippedInboxAge } = lib.computeTaskReasons(task, prefs, now);

                    if (skippedInboxAge) taskCounts.skippedInboxAge++;

                    if (reasons.length === 0) continue;

                    taskCounts.flagged++;
                    reasons.forEach(r => { taskCounts[r] = (taskCounts[r] || 0) + 1; });

                    const alreadyTagged = task.tags.some(t => t.name === reviewTag.name);
                    if (!alreadyTagged) task.addTag(reviewTag);

                    if (alsoFlag) task.flagged = true;

                    let note = task.note || "";
                    note = lib.upsertStamp(note, lib.LINT_AT_RE,  "@lintAt(" + today + ")");
                    note = lib.upsertStamp(note, lib.LINT_RE,     "@lint(" + reasons.join(",") + ")");
                    task.note = note;
                }
            }

            // ── Summary dialog ────────────────────────────────────────────────────

            const totalIssues = projectCounts.flagged + taskCounts.flagged;

            if (totalIssues === 0) {
                await lib.showAlert("Lint Sweep Complete", "No issues found. Your database looks clean!", "Done");
                return;
            }

            // Build breakdown text
            let msg = "";

            msg += "Projects flagged: " + projectCounts.flagged + "\n";
            if (projectCounts.P_NO_NEXT_ACTION)  msg += "  · No Next Action: "      + projectCounts.P_NO_NEXT_ACTION  + "\n";
            if (projectCounts.P_HAS_OVERDUE)     msg += "  · Has Overdue Tasks: "   + projectCounts.P_HAS_OVERDUE     + "\n";
            if (projectCounts.P_EMPTY)           msg += "  · Empty: "               + projectCounts.P_EMPTY           + "\n";
            if (projectCounts.skippedNoNextAction > 0) {
                msg += "  · (P_NO_NEXT_ACTION check skipped for " + projectCounts.skippedNoNextAction + " — taskStatus unavailable)\n";
            }

            if (lib.readPref(prefs, "lintTasksEnabled")) {
                msg += "\nTasks flagged: " + taskCounts.flagged + "\n";
                if (taskCounts.T_OVERDUE)          msg += "  · Overdue: "       + taskCounts.T_OVERDUE         + "\n";
                if (taskCounts.T_DEFER_PAST)       msg += "  · Defer Past: "    + taskCounts.T_DEFER_PAST      + "\n";
                if (taskCounts.T_INBOX_OLD)        msg += "  · Inbox Old: "     + taskCounts.T_INBOX_OLD       + "\n";
                if (taskCounts.T_WAITING_TOO_LONG) msg += "  · Waiting Stale: " + taskCounts.T_WAITING_TOO_LONG + "\n";
                if (taskCounts.skippedInboxAge > 0) {
                    msg += "  · (Inbox age check skipped for " + taskCounts.skippedInboxAge + " — no creation date)\n";
                }
            }

            msg = msg.trimEnd();

            const summary = new Alert("Lint Sweep Complete", msg);
            summary.addOption("Open Lint Queue");  // 0
            summary.addOption("Run Fix Pack");      // 1
            summary.addOption("Done");              // 2

            const choice = await summary.show();

            if (choice === 0) {
                await lib.navigateToTag(lib.readPref(prefs, "reviewTagName"));
            } else if (choice === 1) {
                await lib.showAlert(
                    "Run Fix Pack",
                    'Open the Automation menu and choose "Fix Pack" to auto-remediate common issues.'
                );
            }

        } catch (e) {
            const err = new Alert("Lint Sweep Error", String(e));
            err.addOption("OK");
            await err.show();
        }
    });

    action.validate = function(selection, sender) {
        return true;
    };

    return action;
})();
