const AKXZ_DEBUG = false;

const ORIGINAL_LOG = console.log;

const SILENT_FILES = [
    "FPFoldedPrompts.js",
    "keybinding_extra.js"
];

console.log = function (...args) {
    if (!AKXZ_DEBUG) {
        const stack = new Error().stack || "";
        for (const file of SILENT_FILES) {
            if (stack.includes(file)) {
                return;
            }
        }
    }
    ORIGINAL_LOG.apply(console, args);
};
