import { app } from "../../scripts/app.js";

const CMD_ID = "keybinding_extra.toggle";
const SETTING_ID = "keybinding_extra.comment_prefix";
const FALLBACK_KEY = "keybinding_extra.comment_prefix";

const ENABLE_ID = "keybinding_extra.enabled";
const ENABLE_FALLBACK_KEY = "keybinding_extra.enabled";

const DELETE_LINE_ENABLED_ID = "keybinding_extra.delete_line_enabled";
const DELETE_LINE_ENABLED_FALLBACK_KEY = "keybinding_extra.delete_line_enabled";

const EXTRACT_WORD_ENABLED_ID = "keybinding_extra.extract_word_enabled";
const EXTRACT_WORD_FALLBACK_KEY = "keybinding_extra.extract_word_enabled";

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


	window.addEventListener("keydown", (e) => {
	        console.log("[Key pressed");
            if (!isToggleEnabled()) return;

            const isMac = navigator.platform.toUpperCase().includes("MAC");
            const mod = isMac ? e.metaKey : e.ctrlKey;
            if (!mod || e.shiftKey) return;  // Not if Shift

            if (e.key === "/" || e.code === "Slash") {
                e.preventDefault();
                e.stopPropagation();
                runToggleOnFocusedEditor();
            }
        }, true);

        console.log("[Keybinding Extra] Loaded.");

	window.addEventListener("keydown", (e) => {
	    const isMac = navigator.platform.toUpperCase().includes("MAC");
	    const mod = isMac ? e.metaKey : e.ctrlKey;

	    if (mod && e.shiftKey && e.code === "KeyL") {
        	if (!isDeleteLineEnabled()) return;
	        console.log("[Keybinding Extra] Ctrl+Shift+L (delete line) triggered");
        	e.preventDefault();
	        e.stopPropagation();
        	deleteCurrentLine();
	    }
	}, true);
        console.log("[Keybinding Extra] Ctrl+Shift+L (Delete Line) loaded.");


	window.addEventListener("keydown", (e) => {
            if (!isExtractWordEnabled()) return;

            const isMac = navigator.platform.toUpperCase().includes("MAC");
            const mod = isMac ? e.metaKey : e.ctrlKey;

            if (mod && e.shiftKey && (e.key === "/" || e.code === "Slash")) {
                e.preventDefault();
                e.stopPropagation();
                extractWordToCommentedLine();
            }
        }, true);

        console.log("[Keybinding Extra] All shortcuts loaded (Ctrl+/, Ctrl+Shift+L, Ctrl+Shift+/).");

    }
});

/* ------------------------------ SETTINGS ------------------------------ */

function registerPrefixSetting() {
    const settingsApi = app.ui?.settings;
    const defaultPrefix = "//";

    if (settingsApi && typeof settingsApi.addSetting === "function") {

        settingsApi.addSetting({
            id: SETTING_ID,
            category: ["Keybinding Extra", "Comment (Ctrl+/)", "B"],
            name: "Line comment prefix:",
            type: "text",
            defaultValue: defaultPrefix,
            placeholder: "// or # or --",
            onChange: (v) => {
                const cleaned = sanitizePrefix(v);
                try { localStorage.setItem(FALLBACK_KEY, cleaned); } catch {}
            }
        });
        settingsApi.addSetting({
            id: ENABLE_ID,
            category: ["Keybinding Extra", "Comment (Ctrl+/)", "A"],
            name: "Enable line comment:",
            type: "boolean",
            defaultValue: true,
            onChange: (value) => {
                setToggleEnabled(value);
            }
        });
	settingsApi.addSetting({
            id: DELETE_LINE_ENABLED_ID,
            category: ["Keybinding Extra", "Delete Line (Ctrl+Shift+L)", "A"],
            name: "Enable delete current line:",
            type: "boolean",
            defaultValue: true,
            onChange: (value) => {
                try { localStorage.setItem(DELETE_LINE_ENABLED_FALLBACK_KEY, value ? "true" : "false"); } catch {}
            }
        });

	settingsApi.addSetting({
            id: EXTRACT_WORD_ENABLED_ID,
            category: ["Keybinding Extra", "Extract & Comment Word (Ctrl+Shift+/)", "A"],
            name: "Enable extract word to commented line:",
            type: "boolean",
            defaultValue: true,
            onChange: (value) => {
                try { localStorage.setItem(EXTRACT_WORD_FALLBACK_KEY, value ? "true" : "false"); } catch {}
            }
        });
    } else {
	if (!localStorage.getItem(FALLBACK_KEY)) localStorage.setItem(FALLBACK_KEY, defaultPrefix);
        if (localStorage.getItem(ENABLE_FALLBACK_KEY) == null) localStorage.setItem(ENABLE_FALLBACK_KEY, "true");
        if (localStorage.getItem(DELETE_LINE_ENABLED_FALLBACK_KEY) == null) localStorage.setItem(DELETE_LINE_ENABLED_FALLBACK_KEY, "true");
	if (localStorage.getItem(EXTRACT_WORD_FALLBACK_KEY) == null) localStorage.setItem(EXTRACT_WORD_FALLBACK_KEY, "true");
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


function setToggleEnabled(v) {
    const str = v ? "true" : "false";
    try { localStorage.setItem(ENABLE_FALLBACK_KEY, str); } catch {}
}


function isToggleEnabled() {
    const settingsApi = app.ui?.settings;

    if (settingsApi && typeof settingsApi.getSettingValue === "function") {
        try {
            const val = settingsApi.getSettingValue(ENABLE_ID);
            if (val !== undefined && val !== null) {
                return !!val;
            }
        } catch (e) {
        }
    }
    try {
        const v = localStorage.getItem(ENABLE_FALLBACK_KEY);
        return String(v) !== "false";
    } catch {
        return true;
    }
}
function isDeleteLineEnabled() {
    const api = app.ui?.settings;
    if (api?.getSettingValue) {
        try {
            const val = api.getSettingValue(DELETE_LINE_ENABLED_ID);
            if (val !== undefined) return !!val;
        } catch {}
    }
    return localStorage.getItem(DELETE_LINE_ENABLED_FALLBACK_KEY) !== "false";
}
function isExtractWordEnabled() {
    const api = app.ui?.settings;
    if (api?.getSettingValue) {
        try {
            const val = api.getSettingValue(EXTRACT_WORD_ENABLED_ID);
            if (val !== undefined) return !!val;
        } catch {}
    }
    return localStorage.getItem(EXTRACT_WORD_FALLBACK_KEY) !== "false";
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


/* -------------------------- DELETE LINE SHORTCUT: Ctrl+Shift+L -------------------------- */

/* Ctrl+Shift+L â€” delete line where cursor is (no selection handling) */

function deleteCurrentLine() {
    const ace = getActiveAceEditor();
    if (ace) { deleteCurrentLineAce(ace); return; }

    const cm = getActiveCodeMirror();
    if (cm) { deleteCurrentLineCodeMirror(cm); return; }

    const ta = getActiveTextarea();
    if (ta) { deleteCurrentLineTextarea(ta); return; }
}

function deleteCurrentLineAce(editor) {
    editor.selection.selectLine();
    editor.removeLines();
}

function deleteCurrentLineCodeMirror(cmRoot) {
    const view = cmRoot.cmView || cmRoot.view || cmRoot;
    if (!view?.state || !view?.dispatch) return;

    const cursor = view.state.selection.main.head;
    const line = view.state.doc.lineAt(cursor);

    view.dispatch({
        changes: { from: line.from, to: line.to + 1 },
        selection: { anchor: line.from },
	userEvent: "delete"
    });
}

function deleteCurrentLineTextarea(ta) {
    const start = ta.selectionStart;
    const value = ta.value;

    let lineStart = value.lastIndexOf("\n", start - 1) + 1;
    let lineEnd = value.indexOf("\n", start);
    if (lineEnd === -1) lineEnd = value.length;
    else lineEnd += 1;

    ta.setSelectionRange(lineStart, lineEnd);
    document.execCommand("delete");  
    ta.dispatchEvent(new Event("input", { bubbles: true }));
}

/* ---------------------- Extract word + comment: Ctrl+Shift+/ ---------------------- */

function extractWordToCommentedLine() {
    const ace = getActiveAceEditor();
    if (ace) { extractWordAce(ace); return; }

    const cm = getActiveCodeMirror();
    if (cm) { extractWordCodeMirror(cm); return; }

    const ta = getActiveTextarea();
    if (ta) { extractWordTextarea(ta); return; }
}

/*  ACE  */
function extractWordAce(editor) {
    const pos = editor.getCursorPosition();
    const session = editor.session;
    const line = session.getLine(pos.row);
    const { prefixSp } = computePrefix();

    const token = session.getTokenAt(pos.row, pos.column) ||
                  session.getTokenAt(pos.row, pos.column - 1);
    if (!token || !token.value.trim()) return;

    const word = token.value.trim();
    const startCol = token.start;
    const endCol   = startCol + token.value.length;

    // trailing comma + spaces after the word
    const after = line.substring(endCol);
    const m = after.match(/^(\s*,\s*)/);
    const trailing = m ? m[0] : "";

    const commented = prefixSp + word + (trailing.includes(",") ? "," : "");

    // remove word + trailing comma
    session.replace({
        start: { row: pos.row, column: startCol },
        end:   { row: pos.row, column: endCol + trailing.length }
    }, "");

    // insert new commented line exactly one line below
    const nextRow = pos.row + 1;
    session.insert({ row: nextRow, column: 0 }, commented + "\n");

    editor.moveCursorTo(nextRow, commented.length);
    editor.clearSelection();
    if (editor.undoManager) editor.undoManager.add();
}

/*  CodeMirror  */
function extractWordCodeMirror(viewRoot) {
    const view = viewRoot.cmView || viewRoot.view || viewRoot;
    if (!view?.state || !view?.dispatch) return;

    const { prefixSp } = computePrefix();
    const head = view.state.selection.main.head;
    const line = view.state.doc.lineAt(head);
    const text = line.text;

    // word boundaries
    let from = head;
    let to   = head;
    while (from > line.from && /[\w\-]/.test(text[from - line.from - 1])) from--;
    while (to   < line.to   && /[\w\-]/.test(text[to   - line.from]))     to++;

    const word = text.slice(from - line.from, to - line.from).trim();
    if (!word) return;

    const after = text.substring(to - line.from);
    const m = after.match(/^(\s*,\s*)/);
    const trailing = m ? m[0] : "";

    const commented = prefixSp + word + (trailing.includes(",") ? "," : "");

    const insertPos = line.to + 1;                 // start of the next line

    const changes = [
        { from, to: to + trailing.length, insert: "" },          // remove word + comma
        { from: insertPos, insert: commented + "\n" }            // new line below
    ];

    view.dispatch({
        changes,
        selection: { anchor: insertPos + commented.length },
	userEvent: "input"
    });
}

/*  Textarea  */
function extractWordTextarea(ta) {
    const { prefixSp } = computePrefix();
    let start = ta.selectionStart;
    let end   = ta.selectionEnd;
    const value = ta.value;

    let wordStart, wordEnd, word, trailing = "";

    // ----- selection exists -----
    if (start !== end) {
        word = value.substring(start, end).trim();
        if (!word) return;
        wordStart = start;
        wordEnd   = end;

        const after = value.substring(end);
        const m = after.match(/^(\s*,\s*)/);
        trailing = m ? m[0] : "";
    } 
    // ----- no selection – find word under cursor -----
    else {
        let left  = start;
        let right = start;
        while (left  > 0 && /[\w\-]/.test(value[left-1]))  left--;
        while (right < value.length && /[\w\-]/.test(value[right])) right++;

        word = value.substring(left, right);
        if (!word.trim()) return;

        wordStart = left;
        wordEnd   = right;

        const after = value.substring(right);
        const m = after.match(/^(\s*,\s*)/);
        trailing = m ? m[0] : "";
    }

    const commented = prefixSp + word + (trailing.includes(",") ? "," : "");

    // build new text: remove word+trailing and insert new line right after current line
    const lineEndPos = value.indexOf("\n", wordStart);
    const nextLineStart = (lineEndPos === -1 ? value.length : lineEndPos);

    const newValue =
        value.slice(0, wordStart) +                          // before word
        value.slice(wordEnd + trailing.length, nextLineStart) + // rest of line (without word & comma)
        "\n" + commented +                                   // new commented line
        value.slice(nextLineStart);                          // everything after


    const finalCursorPos = wordStart + commented.length + 1;

    // Save current cursor (important!)
    const savedStart = ta.selectionStart;
    const savedEnd   = ta.selectionEnd;

    // Replace entire content with undo support
    ta.select();                                      // select all
    document.execCommand("insertText", false, newValue);

    // Force cursor to correct position — even after Ctrl+Z
    setTimeout(() => {
        ta.selectionStart = ta.selectionEnd = finalCursorPos;
    }, 0);
}
