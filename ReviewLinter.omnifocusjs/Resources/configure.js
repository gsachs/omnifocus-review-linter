/*{
    "type": "action",
    "targets": ["omnifocus"],
    "author": "Review Linter Contributors",
    "identifier": "com.gsachs.review-linter.configure",
    "version": "1.0",
    "description": "Set preferences for the Review Linter plugin.",
    "label": "Configure Review Linter",
    "shortLabel": "Configure",
    "paletteLabel": "Configure Review Linter",
    "image": "gear"
}*/
(() => {
    const action = new PlugIn.Action(async function(selection, sender) {
        try {

        const lib   = this.plugIn.library("lintUtils");
        const prefs = lib.prefs;

        // ── Step 1: Main settings form ────────────────────────────────────────

        const reviewTagName       = lib.readPref(prefs, "reviewTagName");
        const alsoFlag            = lib.readPref(prefs, "alsoFlag");
        const scopeMode           = lib.readPref(prefs, "scopeMode");
        const excludeTagNames     = lib.readPref(prefs, "excludeTagNames");
        const includeOnHold       = lib.readPref(prefs, "includeOnHoldProjects");
        const lintTasksEnabled    = lib.readPref(prefs, "lintTasksEnabled");
        const inboxMaxAgeDays     = lib.readPref(prefs, "inboxMaxAgeDays");
        const deferPastGraceDays  = lib.readPref(prefs, "deferPastGraceDays");
        const waitingTagName      = lib.readPref(prefs, "waitingTagName");
        const waitingStaleDays    = lib.readPref(prefs, "waitingStaleDays");
        const enableWaiting       = lib.readPref(prefs, "enableWaitingSinceStamp");
        const triageTagName       = lib.readPref(prefs, "triageTagName");

        const mainForm = new Form();
        mainForm.addField(new Form.Field.String(
            "reviewTagName", "Review Tag Name", reviewTagName, null
        ));
        mainForm.addField(new Form.Field.Checkbox(
            "alsoFlag", "Also flag marked items", alsoFlag
        ));
        mainForm.addField(new Form.Field.Option(
            "scopeMode", "Scope",
            ["ALL_ACTIVE_PROJECTS", "FOLDER_SCOPE", "TAG_SCOPE"],
            ["All Active Projects", "Folder Scope", "Tag Scope"],
            scopeMode
        ));
        mainForm.addField(new Form.Field.String(
            "excludeTagNames", "Exclude Tags (comma-separated)", excludeTagNames, null
        ));
        mainForm.addField(new Form.Field.Checkbox(
            "includeOnHoldProjects", "Include On-Hold Projects", includeOnHold
        ));
        mainForm.addField(new Form.Field.Checkbox(
            "lintTasksEnabled", "Lint Tasks", lintTasksEnabled
        ));
        mainForm.addField(new Form.Field.String(
            "inboxMaxAgeDays", "Inbox Max Age (days)", String(inboxMaxAgeDays), null
        ));
        mainForm.addField(new Form.Field.String(
            "deferPastGraceDays", "Defer Past Grace (days)", String(deferPastGraceDays), null
        ));
        mainForm.addField(new Form.Field.String(
            "waitingTagName", "Waiting Tag Name", waitingTagName, null
        ));
        mainForm.addField(new Form.Field.String(
            "waitingStaleDays", "Waiting Stale (days)", String(waitingStaleDays), null
        ));
        mainForm.addField(new Form.Field.Checkbox(
            "enableWaitingSinceStamp", "Enable @waitingSince Stamps", enableWaiting
        ));
        mainForm.addField(new Form.Field.String(
            "triageTagName", "Triage Tag Name", triageTagName, null
        ));

        mainForm.validate = function(f) {
            if ((f.values["reviewTagName"] || "").trim().length === 0) return false;
            const numFields = ["inboxMaxAgeDays", "deferPastGraceDays", "waitingStaleDays"];
            for (const key of numFields) {
                const val = parseInt(f.values[key], 10);
                if (Number.isNaN(val) || val < 0) return false;
            }
            return true;
        };

        let mainResult;
        try {
            mainResult = await mainForm.show("Configure Review Linter", "Next");
        } catch (e) {
            return; // cancelled
        }

        const newScopeMode = mainResult.values["scopeMode"];

        // ── Step 2: Scope picker (only when folder/tag scope chosen) ──────────

        let newScopeFolderId = lib.readPref(prefs, "scopeFolderId");
        let newScopeTagId    = lib.readPref(prefs, "scopeTagId");

        if (newScopeMode === "FOLDER_SCOPE") {
            const allFolders = Array.from(flattenedFolders).filter(
                f => f.status === Folder.Status.Active
            );
            if (allFolders.length === 0) {
                await lib.showAlert(
                    "No Folders Found",
                    "There are no active folders in your database. " +
                    "Scope mode reverted to All Active Projects."
                );
                mainResult.values["scopeMode"] = "ALL_ACTIVE_PROJECTS";
            } else {
                const folderIds   = allFolders.map(f => f.id.primaryKey);
                const folderNames = allFolders.map(f => f.name);
                const currentIdx  = folderIds.indexOf(newScopeFolderId);
                const defaultId   = currentIdx >= 0 ? newScopeFolderId : folderIds[0];

                const folderForm = new Form();
                folderForm.addField(new Form.Field.Option(
                    "folderId", "Select Folder", folderIds, folderNames, defaultId
                ));
                try {
                    const res = await folderForm.show("Select Scope Folder", "Save");
                    newScopeFolderId = res.values["folderId"];
                } catch (e) {
                    return; // cancelled
                }
            }

        } else if (newScopeMode === "TAG_SCOPE") {
            const allTags = Array.from(flattenedTags);
            if (allTags.length === 0) {
                await lib.showAlert(
                    "No Tags Found",
                    "There are no tags in your database. " +
                    "Scope mode reverted to All Active Projects."
                );
                mainResult.values["scopeMode"] = "ALL_ACTIVE_PROJECTS";
            } else {
                const tagIds   = allTags.map(t => t.id.primaryKey);
                const tagNames = allTags.map(t => t.name);
                const currentIdx = tagIds.indexOf(newScopeTagId);
                const defaultId  = currentIdx >= 0 ? newScopeTagId : tagIds[0];

                const tagForm = new Form();
                tagForm.addField(new Form.Field.Option(
                    "tagId", "Select Tag", tagIds, tagNames, defaultId
                ));
                try {
                    const res = await tagForm.show("Select Scope Tag", "Save");
                    newScopeTagId = res.values["tagId"];
                } catch (e) {
                    return; // cancelled
                }
            }
        }

        // ── Save all preferences ──────────────────────────────────────────────

        const parsedInbox = parseInt(mainResult.values["inboxMaxAgeDays"], 10);
        const parsedDefer = parseInt(mainResult.values["deferPastGraceDays"], 10);
        const parsedStale = parseInt(mainResult.values["waitingStaleDays"], 10);

        prefs.write("reviewTagName",         (mainResult.values["reviewTagName"] || "").trim());
        prefs.write("alsoFlag",              mainResult.values["alsoFlag"]);
        prefs.write("scopeMode",             mainResult.values["scopeMode"]);
        prefs.write("scopeFolderId",         newScopeFolderId);
        prefs.write("scopeTagId",            newScopeTagId);
        prefs.write("excludeTagNames",       (mainResult.values["excludeTagNames"] || "").trim());
        prefs.write("includeOnHoldProjects", mainResult.values["includeOnHoldProjects"]);
        prefs.write("lintTasksEnabled",      mainResult.values["lintTasksEnabled"]);
        prefs.write("inboxMaxAgeDays",       Number.isNaN(parsedInbox) ? 2 : parsedInbox);
        prefs.write("deferPastGraceDays",    Number.isNaN(parsedDefer) ? 7 : parsedDefer);
        prefs.write("waitingTagName",        (mainResult.values["waitingTagName"] || "").trim());
        prefs.write("waitingStaleDays",      Number.isNaN(parsedStale) ? 21 : parsedStale);
        prefs.write("enableWaitingSinceStamp", mainResult.values["enableWaitingSinceStamp"]);
        prefs.write("triageTagName",         (mainResult.values["triageTagName"] || "").trim());
        prefs.write("pluginVersion",         "1.0");

        await lib.showAlert("Preferences Saved", "Review Linter settings updated.");

        } catch (e) {
            const err = new Alert("Configure Error", String(e));
            err.addOption("OK");
            await err.show();
        }
    });

    action.validate = function(selection, sender) {
        return true;
    };

    return action;
})();
