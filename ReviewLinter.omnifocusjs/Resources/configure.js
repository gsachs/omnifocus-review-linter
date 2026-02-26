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

        // ── Read current preferences ──────────────────────────────────────────

        const reviewTagName      = lib.readPref(prefs, "reviewTagName");
        const alsoFlag           = lib.readPref(prefs, "alsoFlag");
        const scopeMode          = lib.readPref(prefs, "scopeMode");
        const excludeTagNames    = lib.readPref(prefs, "excludeTagNames");
        const includeOnHold      = lib.readPref(prefs, "includeOnHoldProjects");
        const lintTasksEnabled   = lib.readPref(prefs, "lintTasksEnabled");
        const inboxMaxAgeDays    = lib.readPref(prefs, "inboxMaxAgeDays");
        const deferPastGraceDays = lib.readPref(prefs, "deferPastGraceDays");
        const waitingTagName     = lib.readPref(prefs, "waitingTagName");
        const waitingStaleDays   = lib.readPref(prefs, "waitingStaleDays");
        const enableWaiting      = lib.readPref(prefs, "enableWaitingSinceStamp");
        const triageTagName      = lib.readPref(prefs, "triageTagName");
        const savedFolderId      = lib.readPref(prefs, "scopeFolderId");
        const savedTagId         = lib.readPref(prefs, "scopeTagId");

        // ── Pre-enumerate folders and tags for inline pickers ─────────────────

        const allFolders = Array.from(flattenedFolders).filter(
            f => f.status === Folder.Status.Active
        );
        const allTags = Array.from(flattenedTags);

        // ── Build single form ─────────────────────────────────────────────────

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

        if (allFolders.length > 0) {
            const folderIds   = allFolders.map(f => f.id.primaryKey);
            const folderNames = allFolders.map(f => f.name);
            const defaultId   = folderIds.includes(savedFolderId) ? savedFolderId : folderIds[0];
            mainForm.addField(new Form.Field.Option(
                "scopeFolderId", "Scope Folder (if Folder Scope)",
                folderIds, folderNames, defaultId
            ));
        }

        if (allTags.length > 0) {
            const tagIds   = allTags.map(t => t.id.primaryKey);
            const tagNames = allTags.map(t => t.name);
            const defaultId = tagIds.includes(savedTagId) ? savedTagId : tagIds[0];
            mainForm.addField(new Form.Field.Option(
                "scopeTagId", "Scope Tag (if Tag Scope)",
                tagIds, tagNames, defaultId
            ));
        }

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

        let result;
        try {
            result = await mainForm.show("Configure Review Linter", "Save");
        } catch (e) {
            return; // cancelled
        }

        // ── Resolve scope — alert and revert if chosen scope has no targets ───

        let newScopeMode     = result.values["scopeMode"];
        let newScopeFolderId = result.values["scopeFolderId"] || savedFolderId;
        let newScopeTagId    = result.values["scopeTagId"]    || savedTagId;

        if (newScopeMode === "FOLDER_SCOPE" && allFolders.length === 0) {
            await lib.showAlert(
                "No Folders Found",
                "There are no active folders in your database. " +
                "Scope mode reverted to All Active Projects."
            );
            newScopeMode = "ALL_ACTIVE_PROJECTS";
        } else if (newScopeMode === "TAG_SCOPE" && allTags.length === 0) {
            await lib.showAlert(
                "No Tags Found",
                "There are no tags in your database. " +
                "Scope mode reverted to All Active Projects."
            );
            newScopeMode = "ALL_ACTIVE_PROJECTS";
        }

        // ── Save all preferences ──────────────────────────────────────────────

        const parsedInbox = parseInt(result.values["inboxMaxAgeDays"], 10);
        const parsedDefer = parseInt(result.values["deferPastGraceDays"], 10);
        const parsedStale = parseInt(result.values["waitingStaleDays"], 10);

        prefs.write("reviewTagName",           (result.values["reviewTagName"] || "").trim());
        prefs.write("alsoFlag",                result.values["alsoFlag"]);
        prefs.write("scopeMode",               newScopeMode);
        prefs.write("scopeFolderId",           newScopeFolderId);
        prefs.write("scopeTagId",              newScopeTagId);
        prefs.write("excludeTagNames",         (result.values["excludeTagNames"] || "").trim());
        prefs.write("includeOnHoldProjects",   result.values["includeOnHoldProjects"]);
        prefs.write("lintTasksEnabled",        result.values["lintTasksEnabled"]);
        prefs.write("inboxMaxAgeDays",         Number.isNaN(parsedInbox) ? 2 : parsedInbox);
        prefs.write("deferPastGraceDays",      Number.isNaN(parsedDefer) ? 7 : parsedDefer);
        prefs.write("waitingTagName",          (result.values["waitingTagName"] || "").trim());
        prefs.write("waitingStaleDays",        Number.isNaN(parsedStale) ? 21 : parsedStale);
        prefs.write("enableWaitingSinceStamp", result.values["enableWaitingSinceStamp"]);
        prefs.write("triageTagName",           (result.values["triageTagName"] || "").trim());
        prefs.write("pluginVersion",           "1.0");

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
