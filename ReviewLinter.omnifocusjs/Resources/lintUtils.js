/*{
    "type": "library",
    "targets": ["omnifocus"],
    "identifier": "com.gsachs.review-linter.lintUtils",
    "version": "1.0"
}*/
(() => {
    const lib = new PlugIn.Library(new Version("1.0"));

    // ─── Defaults ─────────────────────────────────────────────────────────────

    lib.DEFAULTS = {
        reviewTagName:          "⚠ Review Lint",
        alsoFlag:               false,
        scopeMode:              "ALL_ACTIVE_PROJECTS",
        scopeFolderId:          null,
        scopeTagId:             null,
        excludeTagNames:        "Someday/Maybe",
        includeOnHoldProjects:  false,
        lintTasksEnabled:       true,
        inboxMaxAgeDays:        2,
        deferPastGraceDays:     7,
        waitingTagName:         "Waiting",
        waitingStaleDays:       21,
        enableWaitingSinceStamp: true,
        triageTagName:          "Needs Triage"
    };

    // ─── Preferences ─────────────────────────────────────────────────────────
    // Preferences must be constructed at load time, not inside action handlers.

    lib.prefs = new Preferences();

    lib.readPref = function(prefs, key, defaultValue) {
        const fallback = (defaultValue !== undefined) ? defaultValue : lib.DEFAULTS[key];
        const val = prefs.read(key);
        const result = (val === null || val === undefined) ? fallback : val;
        if (typeof fallback === "number") {
            const n = Number(result);
            return (Number.isFinite(n) && n >= 0) ? n : fallback;
        }
        return result;
    };

    // ─── Date helpers ─────────────────────────────────────────────────────────

    lib.formatDate = function(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");
        return y + "-" + m + "-" + d;
    };

    lib.parseDate = function(str) {
        // Expects "YYYY-MM-DD"
        const parts = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!parts) return null;
        return new Date(parseInt(parts[1]), parseInt(parts[2]) - 1, parseInt(parts[3]));
    };

    lib.daysBetween = function(dateA, dateB) {
        const msPerDay = 24 * 60 * 60 * 1000;
        return Math.floor((dateB.getTime() - dateA.getTime()) / msPerDay);
    };

    lib.startOfToday = function() {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    };

    // ─── Stamp patterns ───────────────────────────────────────────────────────

    lib.LINT_AT_RE  = /@lintAt\(\d{4}-\d{2}-\d{2}\)/;
    lib.LINT_RE     = /@lint\([A-Z_,]+\)/;
    lib.WAITING_RE  = /@waitingSince\(\d{4}-\d{2}-\d{2}\)/;

    // ─── Stamp helpers ────────────────────────────────────────────────────────

    /**
     * Replace an existing stamp in-place, or append to end of note.
     */
    lib.upsertStamp = function(note, regex, newStamp) {
        if (regex.test(note)) {
            return note.replace(regex, function() { return newStamp; });
        }
        if (note.length === 0) return newStamp;
        const sep = note.endsWith("\n") ? "" : "\n";
        return note + sep + newStamp;
    };

    /**
     * Remove a stamp and collapse resulting extra blank lines.
     */
    lib.removeStamp = function(note, regex) {
        let result = note.replace(regex, "");
        // Collapse 3+ newlines to 2 (one blank line), trim trailing whitespace
        result = result.replace(/\n{3,}/g, "\n\n");
        result = result.replace(/\n+$/, "");
        return result;
    };

    /**
     * Parse @waitingSince(YYYY-MM-DD) → Date or null.
     */
    lib.readWaitingSince = function(note) {
        const match = note.match(/@waitingSince\((\d{4}-\d{2}-\d{2})\)/);
        if (!match) return null;
        return lib.parseDate(match[1]);
    };

    // ─── Scope helpers ────────────────────────────────────────────────────────

    lib.isRemaining = function(task) {
        return task.taskStatus !== Task.Status.Completed &&
               task.taskStatus !== Task.Status.Dropped;
    };

    lib.parseExcludeTags = function(csv) {
        if (!csv) return [];
        return csv.split(",").map(s => s.trim()).filter(s => s.length > 0);
    };

    lib.shouldExclude = function(item, excludeTagNames) {
        if (!excludeTagNames || excludeTagNames.length === 0) return false;
        // For a Project, tags live on the root task
        const tags = (item instanceof Project) ? item.task.tags : item.tags;
        return tags.some(t => excludeTagNames.includes(t.name));
    };

    /**
     * Returns in-scope active (and optionally on-hold) projects,
     * filtered by scope mode and exclude tags.
     * Returns null if a named scope target (folder/tag) is missing.
     */
    lib.resolveProjects = function(prefs) {
        const scopeMode           = lib.readPref(prefs, "scopeMode");
        const includeOnHold       = lib.readPref(prefs, "includeOnHoldProjects");
        const excludeTagNames     = lib.parseExcludeTags(lib.readPref(prefs, "excludeTagNames"));

        const statusOk = function(p) {
            if (p.status === Project.Status.Active) return true;
            if (includeOnHold && p.status === Project.Status.OnHold) return true;
            return false;
        };

        let candidates;

        if (scopeMode === "FOLDER_SCOPE") {
            const folderId = lib.readPref(prefs, "scopeFolderId");
            if (!folderId) return null;
            const folder = flattenedFolders.find(f => f.id.primaryKey === folderId);
            if (!folder) return null;
            candidates = folder.flattenedProjects.filter(statusOk);

        } else if (scopeMode === "TAG_SCOPE") {
            const tagId = lib.readPref(prefs, "scopeTagId");
            if (!tagId) return null;
            const scopeTag = flattenedTags.find(t => t.id.primaryKey === tagId);
            if (!scopeTag) return null;
            // Projects whose root task carries the scope tag
            candidates = flattenedProjects.filter(p =>
                statusOk(p) && p.task.tags.some(t => t.id.primaryKey === tagId)
            );

        } else {
            candidates = flattenedProjects.filter(statusOk);
        }

        return candidates.filter(p => !lib.shouldExclude(p, excludeTagNames));
    };

    /**
     * Returns in-scope tasks: tasks from the given projects + inbox tasks.
     * Does NOT apply excludeTagNames (caller filters per task individually).
     */
    lib.resolveTasksForLint = function(prefs, projects) {
        const taskSet = new Set();
        const result  = [];

        const add = function(t) {
            if (!taskSet.has(t)) {
                taskSet.add(t);
                result.push(t);
            }
        };

        // Tasks within in-scope projects (remaining only, exclude the project root task)
        for (const proj of projects) {
            proj.flattenedTasks.forEach(t => {
                if (lib.isRemaining(t) && t !== proj.task) add(t);
            });
        }

        // Inbox tasks (always included regardless of scope mode)
        inbox.forEach(t => {
            if (lib.isRemaining(t)) add(t);
        });

        return result;
    };

    // ─── Tag helpers ──────────────────────────────────────────────────────────

    /**
     * Finds a tag by name or creates it. Returns the tag, or null if creation
     * fails (should not happen under normal OmniFocus operation).
     */
    lib.findOrCreateTag = function(name) {
        if (!name) return null;
        const existing = flattenedTags.byName(name);
        if (existing) return existing;
        try {
            return new Tag(name);
        } catch (e) {
            return null;
        }
    };

    // ─── Reason aggregation ───────────────────────────────────────────────────

    /**
     * Returns true when a task counts as "available-ish" for P_NO_NEXT_ACTION.
     * Uses taskStatus if available; returns undefined if the property is absent
     * so the caller can skip the check.
     */
    lib.isTaskAvailableIsh = function(task) {
        if (task.taskStatus === undefined || task.taskStatus === null) return undefined;
        return (
            task.taskStatus === Task.Status.Available ||
            task.taskStatus === Task.Status.Next       ||
            task.taskStatus === Task.Status.DueSoon    ||
            task.taskStatus === Task.Status.Overdue
        );
    };

    /**
     * Compute project-level reason codes.
     * Returns { reasons: string[], skipNoNextAction: boolean }
     */
    lib.computeProjectReasons = function(project, prefs, now) {
        const reasons          = [];
        let skipNoNextAction   = false;

        const remainingTasks   = project.flattenedTasks.filter(t => lib.isRemaining(t) && t !== project.task);
        const deferPastGrace   = lib.readPref(prefs, "deferPastGraceDays");

        // P_EMPTY
        if (remainingTasks.length === 0) {
            reasons.push("P_EMPTY");
        }

        // P_HAS_OVERDUE — a subtask's due date is past
        const hasOverdue = remainingTasks.some(t => {
            const due = t.effectiveDueDate || t.dueDate;
            return due && due < now;
        });
        if (hasOverdue) reasons.push("P_HAS_OVERDUE");

        // P_OVERDUE — the project's own due date is past
        const rootDue = project.task.effectiveDueDate || project.task.dueDate;
        if (rootDue && rootDue < now) {
            reasons.push("P_OVERDUE");
        }

        // P_DEFER_PAST — the project's own defer date is stale
        if (project.task.deferDate) {
            const daysOld = lib.daysBetween(project.task.deferDate, now);
            if (daysOld > deferPastGrace) reasons.push("P_DEFER_PAST");
        }

        // P_NO_NEXT_ACTION — skip if P_EMPTY (empty projects have no tasks to check)
        if (!reasons.includes("P_EMPTY")) {
            const probe = lib.isTaskAvailableIsh(remainingTasks[0]);
            if (probe === undefined) {
                // taskStatus not available on this build — skip silently
                skipNoNextAction = true;
            } else if (!remainingTasks.some(t => lib.isTaskAvailableIsh(t))) {
                reasons.push("P_NO_NEXT_ACTION");
            }
        }

        return { reasons, skipNoNextAction };
    };

    /**
     * Compute task-level reason codes.
     * Returns { reasons: string[], skippedInboxAge: boolean }
     */
    lib.computeTaskReasons = function(task, prefs, now) {
        const reasons         = [];
        let skippedInboxAge   = false;

        const deferPastGrace  = lib.readPref(prefs, "deferPastGraceDays");
        const inboxMaxAge     = lib.readPref(prefs, "inboxMaxAgeDays");
        const waitingTagName  = lib.readPref(prefs, "waitingTagName");
        const waitingStale    = lib.readPref(prefs, "waitingStaleDays");
        const triageTagName   = lib.readPref(prefs, "triageTagName");

        // T_OVERDUE
        const due = task.effectiveDueDate || task.dueDate;
        if (due && due < now) reasons.push("T_OVERDUE");

        // T_DEFER_PAST
        if (task.deferDate) {
            const daysOld = lib.daysBetween(task.deferDate, now);
            if (daysOld > deferPastGrace) reasons.push("T_DEFER_PAST");
        }

        // T_INBOX_OLD
        if (task.inInbox) {
            // Skip if already tagged with triage tag
            const alreadyTriaged = task.tags.some(t => t.name === triageTagName);
            if (!alreadyTriaged) {
                const added = task.addedDate;
                if (added === undefined || added === null) {
                    skippedInboxAge = true;
                } else {
                    const ageDays = lib.daysBetween(added, now);
                    if (ageDays > inboxMaxAge) reasons.push("T_INBOX_OLD");
                }
            }
        }

        // T_WAITING_TOO_LONG — only flag if @waitingSince stamp exists and is stale
        const hasWaitingTag = task.tags.some(t => t.name === waitingTagName);
        if (hasWaitingTag) {
            const waitingSince = lib.readWaitingSince(task.note || "");
            if (waitingSince) {
                const waitDays = lib.daysBetween(waitingSince, now);
                if (waitDays > waitingStale) reasons.push("T_WAITING_TOO_LONG");
            }
            // If stamp missing, do NOT flag (per spec)
        }

        return { reasons, skippedInboxAge };
    };

    // ─── Date repair helpers ──────────────────────────────────────────────────

    /**
     * Apply a defer repair policy to any task or project root task.
     * policy: "today" | "clear"
     */
    lib.applyDeferPolicy = function(task, policy) {
        task.deferDate = policy === "today" ? lib.startOfToday() : null;
    };

    /**
     * Apply a due date repair policy to any task or project root task.
     * policy: "today" | "next_week" | "clear"
     */
    lib.applyDuePolicy = function(task, policy) {
        if (policy === "today") {
            task.dueDate = lib.startOfToday();
        } else if (policy === "next_week") {
            const d = lib.startOfToday();
            d.setDate(d.getDate() + 7);
            task.dueDate = d;
        } else {
            task.dueDate = null;
        }
    };

    // ─── UI helpers ───────────────────────────────────────────────────────────

    lib.showAlert = async function(title, message, buttonLabel) {
        const alert = new Alert(title, message);
        alert.addOption(buttonLabel || "OK");
        await alert.show();
    };

    lib.navigateToTag = async function(tagName) {
        const encodedTag = encodeURIComponent(tagName);
        const url        = URL.fromString("omnifocus:///tag/" + encodedTag);
        if (url) {
            url.open();
        } else {
            await lib.showAlert(
                "Open Lint Queue",
                'Could not build a navigation URL. ' +
                'Please filter by the tag "' + tagName + '" in OmniFocus manually.'
            );
        }
    };

    return lib;
})();
