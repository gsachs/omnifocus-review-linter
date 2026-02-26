/*{
    "type": "action",
    "targets": ["omnifocus"],
    "author": "Review Linter Contributors",
    "identifier": "com.gsachs.review-linter.fixPack",
    "version": "1.0",
    "description": "Auto-remediate common lint issues.",
    "label": "Fix Pack",
    "shortLabel": "Fix Pack",
    "paletteLabel": "Fix Pack",
    "image": "wrench"
}*/
(() => {
    const action = new PlugIn.Action(async function(selection, sender) {
        const lib   = this.plugIn.library("lintUtils");
        const prefs = lib.loadPrefs();

        const enableWaiting      = lib.readPref(prefs, "enableWaitingSinceStamp");
        const waitingTagName     = lib.readPref(prefs, "waitingTagName");
        const waitingStaleDays   = lib.readPref(prefs, "waitingStaleDays");
        const inboxMaxAgeDays    = lib.readPref(prefs, "inboxMaxAgeDays");
        const triageTagName      = lib.readPref(prefs, "triageTagName");
        const deferPastGraceDays = lib.readPref(prefs, "deferPastGraceDays");
        const today              = lib.formatDate(new Date());
        const now                = new Date();

        // ── Toggle form ───────────────────────────────────────────────────────

        const toggleForm = new Form();

        if (enableWaiting) {
            toggleForm.addField(new Form.Field.Checkbox(
                "addWaitingSince",
                'Add @waitingSince(today) to waiting tasks that lack it',
                false
            ));
            toggleForm.addField(new Form.Field.Checkbox(
                "resetWaitingSince",
                'Reset @waitingSince(today) for stale waiting tasks (T_WAITING_TOO_LONG)',
                false
            ));
        }

        toggleForm.addField(new Form.Field.Checkbox(
            "triageInbox",
            'Tag old inbox items with "' + triageTagName + '"',
            false
        ));
        toggleForm.addField(new Form.Field.Checkbox(
            "repairDefer",
            'Repair stale defer dates (past >' + deferPastGraceDays + ' days)',
            false
        ));
        toggleForm.addField(new Form.Field.Option(
            "deferPolicy", "Defer Repair Policy",
            ["today", "clear"],
            ["Set defer date to today", "Clear defer date"],
            "today"
        ));

        let toggleResult;
        try {
            toggleResult = await toggleForm.show("Fix Pack", "Apply");
        } catch (e) {
            return; // cancelled
        }

        const doAddWaiting   = enableWaiting && toggleResult.values["addWaitingSince"];
        const doResetWaiting = enableWaiting && toggleResult.values["resetWaitingSince"];
        const doTriage       = toggleResult.values["triageInbox"];
        const doRepairDefer  = toggleResult.values["repairDefer"];
        const deferPolicy    = toggleResult.values["deferPolicy"];

        if (!doAddWaiting && !doResetWaiting && !doTriage && !doRepairDefer) {
            await lib.showAlert("Fix Pack", "No fixes selected. Nothing to do.");
            return;
        }

        // ── Ensure triage tag if needed ───────────────────────────────────────

        let triageTag = null;
        if (doTriage) {
            triageTag = lib.findOrCreateTag(triageTagName);
            if (!triageTag) {
                await lib.showAlert(
                    "Cannot Create Triage Tag",
                    `The tag "${triageTagName}" could not be found or created. ` +
                    "Please create it manually in OmniFocus and re-run Fix Pack."
                );
                return;
            }
        }

        // ── Scope resolution ──────────────────────────────────────────────────

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

        const allTasks = lib.resolveTasksForLint(prefs, projects);

        // ── Counters ──────────────────────────────────────────────────────────

        let waitingAdded   = 0;
        let waitingReset   = 0;
        let inboxTriaged   = 0;
        let deferRepaired  = 0;

        for (const task of allTasks) {
            // ── Add @waitingSince to waiting tasks that lack it ───────────────
            if (doAddWaiting) {
                const hasWaitingTag = task.tags.some(t => t.name === waitingTagName);
                if (hasWaitingTag) {
                    const existing = lib.readWaitingSince(task.note || "");
                    if (!existing) {
                        let note = task.note || "";
                        note = lib.upsertStamp(note, lib.WAITING_RE, "@waitingSince(" + today + ")");
                        task.note = note;
                        waitingAdded++;
                    }
                }
            }

            // ── Reset stale @waitingSince for T_WAITING_TOO_LONG tasks ────────
            if (doResetWaiting) {
                const hasWaitingTag = task.tags.some(t => t.name === waitingTagName);
                if (hasWaitingTag) {
                    const since = lib.readWaitingSince(task.note || "");
                    if (since) {
                        const daysWaiting = lib.daysBetween(since, now);
                        if (daysWaiting > waitingStaleDays) {
                            let note = task.note || "";
                            note = lib.upsertStamp(note, lib.WAITING_RE, "@waitingSince(" + today + ")");
                            task.note = note;
                            waitingReset++;
                        }
                    }
                }
            }

            // ── Triage old inbox items ────────────────────────────────────────
            if (doTriage && task.inInbox) {
                const alreadyTriaged = task.tags.some(t => t.name === triageTagName);
                if (!alreadyTriaged) {
                    const added = task.addedDate;
                    if (added) {
                        const ageDays = lib.daysBetween(added, now);
                        if (ageDays > inboxMaxAgeDays) {
                            task.addTag(triageTag);
                            inboxTriaged++;
                        }
                    }
                }
            }

            // ── Repair stale defer dates ──────────────────────────────────────
            if (doRepairDefer && task.deferDate) {
                const daysOld = lib.daysBetween(task.deferDate, now);
                if (daysOld > deferPastGraceDays) {
                    if (deferPolicy === "today") {
                        task.deferDate = lib.startOfToday();
                    } else {
                        task.deferDate = null;
                    }
                    deferRepaired++;
                }
            }
        }

        // ── Summary ───────────────────────────────────────────────────────────

        const parts = [];
        if (waitingAdded  > 0) parts.push(waitingAdded  + " @waitingSince stamp" + (waitingAdded  !== 1 ? "s" : "") + " added.");
        if (waitingReset  > 0) parts.push(waitingReset  + " stale @waitingSince stamp" + (waitingReset  !== 1 ? "s" : "") + " reset.");
        if (inboxTriaged  > 0) parts.push(inboxTriaged  + ' inbox item' + (inboxTriaged  !== 1 ? "s" : "") + ' tagged "' + triageTagName + '".');
        if (deferRepaired > 0) parts.push(deferRepaired + " defer date" + (deferRepaired !== 1 ? "s" : "") + " repaired (" + deferPolicy + ").");

        const msg = parts.length > 0 ? parts.join("\n") : "No changes made.";
        await lib.showAlert("Fix Pack Complete", msg, "Done");
    });

    action.validate = function(selection, sender) {
        return true;
    };

    return action;
})();
