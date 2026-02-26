/*{
    "type": "action",
    "targets": ["omnifocus"],
    "author": "Review Linter Contributors",
    "identifier": "com.omnifocus.review-linter.openLintQueue",
    "version": "1.0",
    "description": "Navigate to the lint review tag.",
    "label": "Open Lint Queue",
    "shortLabel": "Lint Queue",
    "paletteLabel": "Open Lint Queue",
    "image": "tag"
}*/
(() => {
    const action = new PlugIn.Action(async function(selection, sender) {
        const lib     = this.plugIn.library("lintUtils");
        const prefs   = this.plugIn.preferences;
        const tagName = lib.readPref(prefs, "reviewTagName");

        await lib.navigateToTag(tagName);
    });

    action.validate = function(selection, sender) {
        return true;
    };

    return action;
})();
