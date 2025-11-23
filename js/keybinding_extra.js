import { app } from "../../scripts/app.js";

const CMD_ID = "keybinding_extra.toggle";
const SETTING_ID = "keybinding_extra.comment_prefix";
const FALLBACK_KEY = "keybinding_extra.comment_prefix";

const ENABLE_ID = "keybinding_extra.enabled";
const ENABLE_FALLBACK_KEY = "keybinding_extra.enabled";

app.registerExtension({
    name: "Keybinding Extra",

    commands: [
        {
            id: CMD_ID,
            label: "Toggle Line Comment",
            function: () => runToggleOnFocusedEditor()
        }
    ],

    setup() {
        registerPrefixSetting();
        installInlineToggleInjector();

        window.addEventListener(
            "keydown",
            (e) => {
                if (!isToggleEnabled()) return;

                const isMac = navigator.platform.toUpperCase().includes("MAC");
                const pressed = isMac ? e.metaKey : e.ctrlKey;
                if (!pressed) return;

                if (e.key !== "/" && e.code !== "Slash") return;

                e.preventDefault();
                e.stopPropagation();

                runToggleOnFocusedEditor();
            },
            true
        );

        console.log("[Keybinding Extra] Loaded.");
    }
});

/* ------------------------------ SETTINGS ------------------------------ */

function registerPrefixSetting() {
    const settingsApi = app.ui?.settings;
    const defaultPrefix = "//";

    if (settingsApi && typeof settingsApi.addSetting === "function") {
        settingsApi.addSetting({
            id: SETTING_ID,
            category: [
                "Keybinding Extra",
                "Keybinding Extra"
            ],
            name: "Line comment prefix:",
            type: "text",
            defaultValue: defaultPrefix,
            placeholder: "// or # or --",
            onChange: (v) => {
                const cleaned = sanitizePrefix(v);
                try { localStorage.setItem(FALLBACK_KEY, cleaned); } catch {}
            }
        });
    } else {
        if (!getCommentPrefix()) {
            try { localStorage.setItem(FALLBACK_KEY, defaultPrefix); } catch {}
        }
    }

    // Ensure enable flag exists (default true)
    if (localStorage.getItem(ENABLE_FALLBACK_KEY) == null) {
        try { localStorage.setItem(ENABLE_FALLBACK_KEY, "true"); } catch {}
    }
}

function sanitizePrefix(v) {
    if (v == null) return "//";
    const s = String(v).trim();
    return s.length ? s : "//";
}

function getCommentPrefix() {
    const settingsApi = app.ui?.settings;
    let v = null;

    if (settingsApi && typeof settingsApi.getSettingValue === "function") {
        try { v = settingsApi.getSettingValue(SETTING_ID); } catch { v = null; }
    }

    if (!v) {
        try { v = localStorage.getItem(FALLBACK_KEY); } catch {}
    }

    return sanitizePrefix(v);
}

function isToggleEnabled() {
    let v = null;
    try { v = localStorage.getItem(ENABLE_FALLBACK_KEY); } catch {}
    return String(v) !== "false";
}

function setToggleEnabled(v) {
    const str = v ? "true" : "false";
    try { localStorage.setItem(ENABLE_FALLBACK_KEY, str); } catch {}
}

/* ------------------ INLINE TOGGLE IN SAME ROW (DOM INJECT) ------------------ */

function installInlineToggleInjector() {
    const observer = new MutationObserver(() => {
        tryInjectInlineToggle();
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

function tryInjectInlineToggle() {
    const labelEls = Array.from(document.querySelectorAll("*"))
        .filter(el => el.textContent && el.textContent.trim() === "Line comment prefix:");

    for (const labelEl of labelEls) {
        const row = findSettingRowContainer(labelEl);
        if (!row) continue;

        if (row.querySelector(".kbe-inline-toggle")) continue;

        const toggle = buildInlineToggle();
        row.prepend(toggle);

        toggle.style.marginRight = "12px";
        row.style.display = row.style.display || "flex";
        row.style.alignItems = row.style.alignItems || "center";
	row.style.width = "100%";

	// Find the text input for prefix and pin it to the right
	const inputEl =
	    row.querySelector('input[type="text"], input[type="search"], textarea') ||
	    row.querySelector(".setting-input input");

	const topRow = inputEl?.closest("div.flex.flex-row.items-center.gap-2") 
            || row.closest("div.flex.flex-row.items-center.gap-2") 
            || row;

	if (topRow) {
	    topRow.style.width = "100%";
	}
	if (inputEl) {
	    inputEl.style.marginLeft = "auto";
	    inputEl.style.width = "60px";
	    inputEl.style.minWidth = "60px";
	    inputEl.style.maxWidth = "60px";
	    inputEl.style.textAlign = "left";
	}
    }
}

function findSettingRowContainer(labelEl) {
    let el = labelEl;
    for (let i = 0; i < 6 && el; i++) {
        if (el.classList) {
            if (
                el.classList.contains("setting") ||
                el.classList.contains("setting-item") ||
                el.classList.contains("settings-item") ||
                el.classList.contains("settings-row")
            ) {
                return el;
            }
        }
        el = el.parentElement;
    }
    return labelEl.parentElement;
}

function buildInlineToggle() {
    const wrap = document.createElement("div");
    wrap.className = "kbe-inline-toggle";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = isToggleEnabled();
    input.className = "comfyui-toggle";

    input.addEventListener("change", () => {
        setToggleEnabled(input.checked);
    });

    wrap.appendChild(input);
    return wrap;
}

/* ------------------------- ACTIVE EDITOR DETECTION ------------------------ */

function runToggleOnFocusedEditor() {
    const ace = getActiveAceEditor();
    if (ace) {
        toggleAceComments(ace);
        return;
    }

    const cm = getActiveCodeMirror();
    if (cm) {
        toggleCodeMirrorComments(cm);
        return;
    }

    const ta = getActiveTextarea();
    if (ta) {
        toggleTextareaComments(ta);
        return;
    }
}

function getActiveAceEditor() {
    const active = document.activeElement;
    let el = active;

    while (el && el !== document.body) {
        if (el.classList && el.classList.contains("ace_editor")) {
            return el.env && el.env.editor ? el.env.editor : null;
        }
        el = el.parentElement;
    }

    const editors = document.querySelectorAll(".ace_editor");
    for (const ed of editors) {
        if (ed.env && ed.env.editor) return ed.env.editor;
    }
    return null;
}

function getActiveCodeMirror() {
    const active = document.activeElement;
    let el = active;

    while (el && el !== document.body) {
        if (el.classList && el.classList.contains("cm-editor")) {
            return el.cmView || el;
        }
        el = el.parentElement;
    }

    const cmEditors = document.querySelectorAll(".cm-editor");
    return cmEditors.length ? (cmEditors[0].cmView || cmEditors[0]) : null;
}

function getActiveTextarea() {
    const active = document.activeElement;
    if (!active) return null;
    if (active.tagName === "TEXTAREA" || active.tagName === "INPUT") return active;
    return null;
}

/* ------------------------------ TOGGLE HELPERS ------------------------------ */

function computePrefix() {
    const prefix = getCommentPrefix();
    const prefixSp = prefix + " ";
    return { prefix, prefixSp };
}

/* ------------------------------ ACE ------------------------------ */

function toggleAceComments(editor) {
    const session = editor.session;
    const range = editor.getSelectionRange();
    const { prefix, prefixSp } = computePrefix();

    let startRow = range.start.row;
    let endRow = range.end.row;

    if (range.end.column === 0 && endRow > startRow) endRow -= 1;

    for (let row = startRow; row <= endRow; row++) {
        const line = session.getLine(row);
        const trimmed = line.trimStart();
        const indent = line.length - trimmed.length;

        if (trimmed.startsWith(prefixSp)) {
            const idx = line.indexOf(prefixSp, indent);
            if (idx !== -1) {
                session.replace(
                    { start: { row, column: idx }, end: { row, column: idx + prefixSp.length } },
                    ""
                );
            }
        } else if (trimmed.startsWith(prefix)) {
            const idx = line.indexOf(prefix, indent);
            if (idx !== -1) {
                session.replace(
                    { start: { row, column: idx }, end: { row, column: idx + prefix.length } },
                    ""
                );
            }
        } else {
            session.insert({ row, column: indent }, prefixSp);
        }
    }
}

/* -------------------------- CODEMIRROR --------------------------- */

function toggleCodeMirrorComments(cmRoot) {
    const view = cmRoot.cmView || cmRoot.view || cmRoot;
    if (!view || !view.state || !view.dispatch) return;

    const { prefix, prefixSp } = computePrefix();

    const state = view.state;
    const sel = state.selection.main;

    const doc = state.doc;
    let fromLine = doc.lineAt(sel.from).number;
    let toLine = doc.lineAt(sel.to).number;

    if (sel.to > sel.from && doc.lineAt(sel.to).from === sel.to) {
        toLine -= 1;
    }

    const changes = [];

    for (let n = fromLine; n <= toLine; n++) {
        const line = doc.line(n);
        const text = line.text;
        const trimmed = text.trimStart();
        const indent = text.length - trimmed.length;

        if (trimmed.startsWith(prefixSp)) {
            const idx = text.indexOf(prefixSp, indent);
            if (idx !== -1) {
                changes.push({
                    from: line.from + idx,
                    to: line.from + idx + prefixSp.length,
                    insert: ""
                });
            }
        } else if (trimmed.startsWith(prefix)) {
            const idx = text.indexOf(prefix, indent);
            if (idx !== -1) {
                changes.push({
                    from: line.from + idx,
                    to: line.from + idx + prefix.length,
                    insert: ""
                });
            }
        } else {
            changes.push({
                from: line.from + indent,
                to: line.from + indent,
                insert: prefixSp
            });
        }
    }

    if (changes.length) view.dispatch({ changes });
}

/* ----------------------------- TEXTAREA ---------------------------- */

function toggleTextareaComments(ta) {
    const { prefix, prefixSp } = computePrefix();

    const value = ta.value;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;

    const lines = value.split("\n");

    let pos = 0;
    let startLine = 0;
    let endLine = lines.length - 1;

    for (let i = 0; i < lines.length; i++) {
        const lineLen = lines[i].length + 1;
        if (start >= pos && start < pos + lineLen) startLine = i;
        if (end >= pos && end < pos + lineLen) { endLine = i; break; }
        pos += lineLen;
    }

    for (let i = startLine; i <= endLine; i++) {
        const line = lines[i];
        const trimmed = line.trimStart();
        const indent = line.length - trimmed.length;

        if (trimmed.startsWith(prefixSp)) {
            const idx = line.indexOf(prefixSp, indent);
            if (idx !== -1) {
                lines[i] = line.slice(0, idx) + line.slice(idx + prefixSp.length);
            }
        } else if (trimmed.startsWith(prefix)) {
            const idx = line.indexOf(prefix, indent);
            if (idx !== -1) {
                lines[i] = line.slice(0, idx) + line.slice(idx + prefix.length);
            }
        } else {
            lines[i] = line.slice(0, indent) + prefixSp + line.slice(indent);
        }
    }

    ta.value = lines.join("\n");
    ta.selectionStart = start;
    ta.selectionEnd = end;
    ta.dispatchEvent(new Event("input", { bubbles: true }));
}
