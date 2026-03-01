/*{
    "type": "action",
    "targets": ["omnifocus"],
    "author": "Review Linter Contributors",
    "identifier": "com.gsachs.review-linter.clearLintMarks",
    "version": "1.0",
    "description": "Remove lint tags and optional stamps.",
    "label": "Clear Lint Marks",
    "shortLabel": "Clear Marks",
    "paletteLabel": "Clear Lint Marks",
    "image": "xmark.circle"
}*/
(() => {
    const action = new PlugIn.Action(async function(selection, sender) {
        const lib      = this.plugIn.library("lintUtils");
        const prefs    = lib.prefs;
        const alsoFlag = lib.readPref(prefs, "alsoFlag");

        // ── Find the review tag ───────────────────────────────────────────────

        const tagName   = lib.readPref(prefs, "reviewTagName");
        // byName not findOrCreateTag — must not create the tag when our only goal is to remove it
        const reviewTag = flattenedTags.byName(tagName);
        if (!reviewTag) {
            await lib.showAlert(
                "Tag Not Found",
                'The lint tag "' + tagName + '" does not exist. Nothing to clear.'
            );
            return;
        }

        // ── Choose scope + options ────────────────────────────────────────────

        const scopeForm = new Form();
        scopeForm.addField(new Form.Field.Option(
            "scope", "Clear Which Items",
            ["selection", "all"],
            ["Selected Items Only", "All Items in Configured Scope"],
            "all"
        ));
        scopeForm.addField(new Form.Field.Checkbox(
            "removeStamps", "Also remove @lint and @lintAt stamps", false
        ));
        if (alsoFlag) {
            scopeForm.addField(new Form.Field.Checkbox(
                "removeFlags", "Also remove flags from cleared items", false
            ));
        }

        let formResult;
        try {
            formResult = await scopeForm.show("Clear Lint Marks", "Clear");
        } catch (e) {
            return; // cancelled
        }

        const clearSelection = formResult.values["scope"] === "selection";
        const removeStamps   = formResult.values["removeStamps"];
        const removeFlags    = alsoFlag ? formResult.values["removeFlags"] : false; // the checkbox is only added to the form when alsoFlag is true; absent field returns undefined

        // ── Collect targets ───────────────────────────────────────────────────

        let targetTasks    = [];
        let targetProjects = [];

        if (clearSelection) {
            targetTasks    = Array.from(selection.tasks    || []);
            targetProjects = Array.from(selection.projects || []);
        } else {
            const projects = lib.resolveProjects(prefs);
            if (projects === null) {
                await lib.showAlert(
                    "Scope Not Found",
                    "The configured scope target no longer exists. " +
                    "Please run Configure Review Linter to update your scope setting."
                );
                return;
            }
            targetProjects = projects;
            targetTasks    = lib.resolveTasksForLint(prefs, projects);
        }

        // ── Apply clearing ────────────────────────────────────────────────────

        let clearedProjects = 0;
        let clearedTasks    = 0;

        for (const project of targetProjects) {
            const hasTag = project.task.tags.some(t => t.name === tagName);
            if (!hasTag) continue;

            project.task.removeTag(reviewTag);
            clearedProjects++;

            if (removeFlags) project.flagged = false;

            if (removeStamps) {
                let note = project.note || "";
                note = lib.removeStamp(note, lib.LINT_AT_RE);
                note = lib.removeStamp(note, lib.LINT_RE);
                project.note = note;
            }
        }

        for (const task of targetTasks) {
            const hasTag = task.tags.some(t => t.name === tagName);
            if (!hasTag) continue;

            task.removeTag(reviewTag);
            clearedTasks++;

            if (removeFlags) task.flagged = false;

            if (removeStamps) {
                let note = task.note || "";
                note = lib.removeStamp(note, lib.LINT_AT_RE);
                note = lib.removeStamp(note, lib.LINT_RE);
                task.note = note;
            }
        }

        // ── Summary ───────────────────────────────────────────────────────────

        let msg = "";
        if (clearedProjects > 0) msg += clearedProjects + " project" + (clearedProjects !== 1 ? "s" : "") + " cleared.";
        if (clearedTasks    > 0) {
            if (msg) msg += "\n";
            msg += clearedTasks + " task" + (clearedTasks !== 1 ? "s" : "") + " cleared.";
        }
        if (!msg) msg = "No items with the lint tag were found in the target scope.";

        await lib.showAlert("Clear Lint Marks", msg, "Done");
    });

    return action;
})();
