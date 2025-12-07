// FPFoldedPrompts custom widget + controller
// Two modes in one node:
// 1) TEXT mode  : multiline text + "Save as folders"
// 2) TREE mode  : collapsible tree + "Edit" + "Reset"

import { api } from "../../scripts/api.js";
import { app } from "../../../scripts/app.js";

(function () {
    const AREAS = ["ALL", "AR1", "AR2", "AR3", "AR4", "AR5"];

    // Tree UI configuration
    const TREE_FONT_FAMILY = "sans-serif";
    const TREE_FONT_SIZE_FOLDER = 18;
    const TREE_FONT_SIZE_LINE = 16;
    const TREE_CONTROL_SIZE = 18;
    const TREE_LINE_HEIGHT = 26;
    const TREE_PARTIAL_FOLDER_COLOR = "#666666";
    const TREE_INDENT = 24;
    const TREE_CONTROL_OFFSET_Y = -2;


    let PF_CONTEXT_MENU_PATCHED = false;

    function patchFPFoldedPromptsContextMenu() {
        const LGraphCanvas = window.LGraphCanvas;
        if (!LGraphCanvas) return;
        if (PF_CONTEXT_MENU_PATCHED) return;

        const proto = LGraphCanvas.prototype;
        if (!proto) return;

        // Option 1: older versions — processNodeContextMenu exists
        if (typeof proto.processNodeContextMenu === "function") {
            const origProcessNodeContextMenu = proto.processNodeContextMenu;

            proto.processNodeContextMenu = function (node, event) {
                if (node && node.type === "FPFoldedPrompts") {
                    // For FPFoldedPrompts do nothing -> context menu is disabled
                    return;
                }
                return origProcessNodeContextMenu.call(this, node, event);
            };
        }
        // Option 2: newer versions — showMenuNode exists
        else if (typeof proto.showMenuNode === "function") {
            const origShowMenuNode = proto.showMenuNode;

            proto.showMenuNode = function (...args) {
                const node = args[0];
                if (node && node.type === "FPFoldedPrompts") {
                    // Block context menu only for FPFoldedPrompts
                    return;
                }
                return origShowMenuNode.apply(this, args);
            };
        }

        PF_CONTEXT_MENU_PATCHED = true;
    }

    const SAMPLE_TEXT = [
        "[Sample folder 1]",
        "there_goes_your_prompt, a simple string or, booru_tags,  ",
        "you can put many strings in folder, press EDIT to start editing,",
        "[Sample folder 1/Sub folder 1]",
        "this_is_a_subfolder, same rules, as many strings as you want,  ",
        "Ipsum Dolor Sit Amet, Ipsum Dolor Sit Amet, Ipsum Dolor Sit Amet",
        "[Sample folder 1/Sub folder 2]",
        "this_is_a_subfolder, same rules, as many strings as you want,  ",
        "Ipsum Dolor Sit Amet, Ipsum Dolor Sit Amet, Ipsum Dolor Sit Amet",
        "[Sample folder 2]",
        "there_goes_your_prompt, a simple string or, booru_tags,  ",
        "you can put many strings in folder,",
        "[Sample folder 3]",
        "there_goes_your_prompt, a simple string or, booru_tags,  ",
        "you can put many strings in folder,",
    ].join("\n");

    function log(...args) {
        console.log("[FPFoldedPrompts]", ...args);
    }

    // Area symbol mapping: ALL -> ○, AR1..AR5 -> ①..⑤
    function getAreaSymbol(area) {
        switch (area) {
            case "AR1":
                return "①";
            case "AR2":
                return "②";
            case "AR3":
                return "③";
            case "AR4":
                return "④";
            case "AR5":
                return "⑤";
            case "ALL":
            default:
                return "×";
        }
    }

    function clipTextToWidth(ctx, text, maxWidth) {
        if (!text) return "";
        if (ctx.measureText(text).width <= maxWidth) return text;

        const ellipsis = "…";
        const ellipsisWidth = ctx.measureText(ellipsis).width;

        let s = text;
        while (s.length > 0) {
            s = s.slice(0, -1);
            if (ctx.measureText(s).width + ellipsisWidth <= maxWidth) {
                return s + ellipsis;
            }
        }
        return ellipsis;
    }


    // ------------------- TEXT -> TREE -------------------

    function parseFolderTextToTree(rawText) {
        log("parseFolderTextToTree() start");

        const rawLines = (rawText || "").split(/\r?\n/);

        const root = { items: [] };

        function ensureFolder(pathParts) {
            let currentList = root.items;
            let folder = null;
            let idPath = [];

            for (const rawPart of pathParts) {
                const part = rawPart.trim().replace(/\/+$/, "");
                if (!part) continue;
                idPath.push(part);
                folder = currentList.find(
                    (it) => it.type === "folder" && it.title === part
                );
                if (!folder) {
                    folder = {
                        type: "folder",
                        id: "folder-" + idPath.join("_"),
                        title: part,
                        expanded: false,
                        area: "ALL",
                        children: [],
                    };
                    currentList.push(folder);
                    log("Created folder:", folder.id, "title=", folder.title);
                }
                currentList = folder.children;
            }
            return folder;
        }

        // Special ROOT folder; its lines will be shown at the top level in the UI
        const rootFolder = {
            type: "folder",
            id: "folder-ROOT",
            title: "ROOT",
            expanded: true,
            area: "ALL",
            children: [],
            _isRootFolder: true,
        };

        function getTargetListForCurrentFolder(currentFolder) {
            if (currentFolder && currentFolder !== rootFolder) {
                return currentFolder.children;
            }
            // Lines without folders and from [ROOT] go into the ROOT group
            return rootFolder.children;
        }

        let currentFolder = null;
        let lineCounter = 1;

        // State for multiline <ARx>...</> blocks
        let inAreaBlock = false;
        let areaBlockArea = "ALL";
        let areaBlockEnabled = true;
        let areaBlockLines = [];

        function flushAreaBlock() {
            const textCombined = areaBlockLines.join("\n").trim();
            if (!textCombined) {
                inAreaBlock = false;
                areaBlockArea = "ALL";
                areaBlockEnabled = true;
                areaBlockLines = [];
                return;
            }

            const lineItem = {
                type: "line",
                id: "line-" + lineCounter++,
                enabled: areaBlockEnabled,
                area: areaBlockArea,
                text: textCombined,
            };

            const targetList = getTargetListForCurrentFolder(currentFolder);
            targetList.push(lineItem);

            log(
                "Added line (area block):",
                lineItem.id,
                "area=",
                areaBlockArea,
                "enabled=",
                areaBlockEnabled,
                "text=",
                textCombined
            );

            inAreaBlock = false;
            areaBlockArea = "ALL";
            areaBlockEnabled = true;
            areaBlockLines = [];
        }

        for (const rawLine of rawLines) {
            const line = rawLine.trimEnd();

            // ----- MODE INSIDE <ARx>...</> -----
            if (inAreaBlock) {
                const closeIdx = line.indexOf("</>");
                if (closeIdx !== -1) {
                    const before = line.slice(0, closeIdx).trim();
                    if (before.length > 0) {
                        areaBlockLines.push(before);
                    }
                    flushAreaBlock();
                    continue;
                } else {
                    if (line.trim().length > 0) {
                        areaBlockLines.push(line.trim());
                    }
                    continue;
                }
            }

            // ------ Normal mode (not inside <ARx>...</>) ------

            // Empty lines outside of a block are ignored
            if (line.trim().length === 0) {
                continue;
            }

            // Folders [Folder/Sub]
            const folderMatch = line.match(/^\[(.+)\]$/);
            if (folderMatch) {
                const pathStr = folderMatch[1].trim();
                const pathParts = pathStr
                    .split("/")
                    .map((p) => p.trim())
                    .filter(Boolean);

                if (
                    pathParts.length === 1 &&
                    pathParts[0].toLowerCase() === "root"
                ) {
                    // Special folder [ROOT]
                    currentFolder = rootFolder;
                } else {
                    currentFolder = ensureFolder(pathParts);
                }
                continue;
            }

            let enabled = true;
            let text = line;

            // Comments: // ...
            const commentMatch = text.match(/^\/\/\s*(.*)$/);
            if (commentMatch) {
                enabled = false;
                text = commentMatch[1];
            }

            // --- Single-line area tag: <ARx> ... </>
            let area = "ALL";
            const singleAreaMatch = text.match(/^<(AR[1-5])>\s*([\s\S]*?)\s*<\/>\s*$/);
            if (singleAreaMatch) {
                area = singleAreaMatch[1];
                const innerText = singleAreaMatch[2].trim();
                const lineItem = {
                    type: "line",
                    id: "line-" + lineCounter++,
                    enabled,
                    area,
                    text: innerText,
                };

                const targetList = getTargetListForCurrentFolder(currentFolder);
                targetList.push(lineItem);

                log(
                    "Added line (single area):",
                    lineItem.id,
                    "area=",
                    area,
                    "enabled=",
                    enabled,
                    "text=",
                    innerText
                );
                continue;
            }

            // --- Start of multiline block <ARx> ... (without </> on this line)
            const openAreaMatch = text.match(/^<(AR[1-5])>\s*(.*)$/);
            if (openAreaMatch) {
                areaBlockArea = openAreaMatch[1];
                areaBlockEnabled = enabled;
                areaBlockLines = [];

                let after = openAreaMatch[2] || "";
                const closeIdx = after.indexOf("</>");
                if (closeIdx !== -1) {
                    // <AR1>text </> on the same line
                    const before = after.slice(0, closeIdx).trim();
                    if (before.length > 0) {
                        areaBlockLines.push(before);
                    }
                    flushAreaBlock();
                } else {
                    // <AR1> + following lines
                    if (after.trim().length > 0) {
                        areaBlockLines.push(after.trim());
                    }
                    inAreaBlock = true;
                }
                continue;
            }

            // Regular line without areas
            const lineItem = {
                type: "line",
                id: "line-" + lineCounter++,
                enabled,
                area: "ALL",
                text: text,
            };

            const targetList = getTargetListForCurrentFolder(currentFolder);
            targetList.push(lineItem);

            log("Added line:", lineItem.id, "enabled=", enabled, "text=", text);
        }

        // If file ended and area block is not closed — flush anyway
        if (inAreaBlock) {
            flushAreaBlock();
        }

        // If ROOT has any lines — add this folder to the root of the tree
        if (rootFolder.children.length > 0) {
            root.items.push(rootFolder);
        }

        log("parseFolderTextToTree() done, items:", root.items.length);
        return root;
    }

    // ------------------- TREE -> TEXT -------------------

    function treeToText(tree) {
        log("treeToText() start");
        const items = (tree && tree.items) || [];
        const out = [];

        function walk(itemsList, path) {
            for (const item of itemsList) {
                if (item.type === "folder") {
                    const newPath = [...path, item.title];
                    const bracketPath = newPath.join("/") + "/";
                    // always insert an empty line before each folder header
                    if (out.length === 0 || out[out.length - 1] !== "") {
                        out.push("");
                    }
                    out.push("[" + bracketPath.replace(/\/+$/, "/") + "]");
                    log("Export folder:", bracketPath);
                    walk(item.children || [], newPath);
                } else if (item.type === "line") {
                    let lineText = item.text || "";

                    // If the line has area (AR1..AR5) — wrap in tag
                    if (item.area && item.area !== "ALL") {
                        lineText = `<${item.area}>` + lineText + `</>`;
                    }

                    const prefix = item.enabled ? "" : "// ";
                    out.push(prefix + lineText);
                    log(
                        "Export line:",
                        "enabled=",
                        item.enabled,
                        "area=",
                        item.area || "ALL",
                        "text=",
                        item.text || ""
                    );
                }
            }
        }

        walk(items, []);
        const result = out.join("\n");
        log("treeToText() done, length:", result.length);
        return result;
    }
    // ------------------- TREE helpers -------------------

    function rebuildFlat(state) {
        log("rebuildFlat()");
        const flat = [];

        function computeFolderEnabled(item) {
            let hasEnabled = false;
            let hasDisabled = false;

            for (const child of item.children || []) {
                if (child.type === "line") {
                    if (child.enabled) {
                        hasEnabled = true;
                    } else {
                        hasDisabled = true;
                    }
                } else if (child.type === "folder") {
                    const childHasEnabled = computeFolderEnabled(child);
                    if (childHasEnabled) {
                        hasEnabled = true;
                    } else {
                        hasDisabled = true;
                    }
                    if (child._partialSelected) {
                        hasDisabled = true;
                    }
                }
            }

            item._hasAnyEnabled = hasEnabled;
            item._hasAnyDisabled = hasDisabled;
            item._partialSelected = hasEnabled && hasDisabled;
            item._derivedEnabled = hasEnabled;

            return hasEnabled;
        }

        function walk(items, depth, parentFolder, inheritedLock) {
            if (!items) return;

            /*             const folders = items
                            .filter((it) => it.type === "folder")
                            .sort((a, b) => (a.title || "").localeCompare(b.title || ""));
                        const lines = items
                            .filter((it) => it.type === "line")
                            .sort((a, b) => (a.text || "").localeCompare(b.text || ""));
             */
            const folders = items.filter((it) => it.type === "folder");
            const lines = items.filter((it) => it.type === "line");

            const ordered = folders.concat(lines);

            // We will handle ROOT separately at the very end
            let deferredRootFolder = null;

            for (const item of ordered) {
                if (item.type === "folder") {
                    const isRootFolderNode =
                        depth === 0 &&
                        typeof item.title === "string" &&
                        item.title.toLowerCase() === "root";

                    if (isRootFolderNode) {
                        // Remember ROOT, but do not process it now
                        deferredRootFolder = item;
                        continue;
                    }

                    computeFolderEnabled(item);
                    const folderHasOwnArea =
                        item.area && item.area !== "ALL";
                    const folderLock = inheritedLock || folderHasOwnArea;

                    flat.push({
                        type: "folder",
                        item,
                        depth,
                        parentFolder,
                        lockedByArea: inheritedLock,
                    });
                    if (item.expanded) {
                        walk(item.children || [], depth + 1, item, folderLock);
                    }
                } else if (item.type === "line") {
                    flat.push({
                        type: "line",
                        item,
                        depth,
                        parentFolder,
                        lockedByArea: inheritedLock,
                    });
                }
            }

            // And now, after all normal folders and lines, add ROOT children
            if (deferredRootFolder) {
                computeFolderEnabled(deferredRootFolder);
                const folderHasOwnArea =
                    deferredRootFolder.area && deferredRootFolder.area !== "ALL";
                const folderLock = inheritedLock || folderHasOwnArea;

                if (deferredRootFolder.expanded === undefined) {
                    deferredRootFolder.expanded = true;
                }
                if (deferredRootFolder.expanded) {
                    // Children of ROOT go at the same depth to visually stay in the root
                    walk(deferredRootFolder.children || [], depth, deferredRootFolder, folderLock);
                }
            }
        }

        walk(state.tree.items || [], 0, null, false);
        state.flat = flat;
        log("rebuildFlat() done, rows:", flat.length);
    }

    function toggleFolderEnabled(folderItem, newEnabled) {
        log("toggleFolderEnabled() folder:", folderItem.title, "->", newEnabled);
        function walk(items) {
            for (const item of items || []) {
                if (item.type === "line") {
                    item.enabled = newEnabled;
                } else if (item.type === "folder") {
                    walk(item.children || []);
                }
            }
        }
        walk(folderItem.children || []);
    }

    function resetTree(tree) {
        log("resetTree()");
        function walk(items) {
            for (const item of items || []) {
                item.area = "ALL";
                if (item.type === "line") {
                    item.enabled = false;
                } else if (item.type === "folder") {
                    item.expanded = false;
                    walk(item.children || []);
                }
            }
        }
        walk(tree.items || []);
    }
    function applyAreaRecursive(folderItem, newArea) {
        if (!folderItem || folderItem.type !== "folder") return;
        function walk(items) {
            for (const item of items || []) {
                item.area = newArea;
                if (item.type === "folder") {
                    walk(item.children || []);
                }
            }
        }
        walk(folderItem.children || []);
    }


    function nextArea(current) {
        const idx = AREAS.indexOf(current || "ALL");
        if (idx < 0) return "ALL";
        return AREAS[(idx + 1) % AREAS.length];
    }

    // ------------------- MODE / SYNC helpers -------------------

    function syncJsonWidget(node) {
        const s = node._pf;
        if (!s || !s.pfJsonWidget) return;
        if (s.textWidget) {
            s.textWidget.value = treeToText(s.tree);
        }
        try {
            const json = JSON.stringify(s.tree);
            s.pfJsonWidget.value = json;
            log("syncJsonWidget() ok, length:", json.length);
            console.log("[FPFoldedPrompts] syncJsonWidget pf_json:", json); // <<< вот тут
        } catch (e) {
            console.warn("[FPFoldedPrompts] syncJsonWidget() failed:", e);
        }
    }

    function updateModeUI(node) {
        const s = node._pf;
        if (!s) return;

        const textWidget = s.textWidget;
        const treeWidget = s.treeWidget;
        const mainButton = s.mainButton;
        const resetButton = s.resetButton;

        log("updateModeUI()", "mode=", s.mode);

        if (s.mode === "text") {
            // TEXT mode: big multiline text, no tree, no reset
            if (textWidget) {
                textWidget.hidden = false;
                const totalW = node.size ? node.size[0] : 260; // current node width
                const totalH = node.size ? node.size[1] : 260; // current node height
                textWidget.computeSize = function (w) {
                    return [totalW, totalH - 80];
                };
            }
            if (treeWidget) {
                treeWidget.hidden = true;
                treeWidget.computeSize = function (w) {
                    return [w, 0];
                };
            }
            if (resetButton) {
                resetButton.hidden = true;
                resetButton.computeSize = function (w) {
                    return [w, 0];
                };
            }
            if (mainButton) mainButton.label = "Save as folders";
        } else {
            // TREE mode: show tree + reset, hide text
            if (textWidget) {
                textWidget.hidden = true;
                textWidget.computeSize = function (w) {
                    return [w, 0];
                };
            }
            if (treeWidget) {
                treeWidget.hidden = false;
                // dynamic height from flat rows
                treeWidget.computeSize = function (width) {
                    const lineH = TREE_LINE_HEIGHT;
                    const paddingTop = 8;
                    const s2 = node._pf;
                    const count = (s2 && s2.flat && s2.flat.length) || 1;
                    const h = paddingTop + count * lineH + 4;
                    return [width, h];
                };
            }
            if (resetButton) {
                resetButton.hidden = false;
                resetButton.computeSize = function (w) {
                    return [w, 24];
                };
            }
            if (mainButton) mainButton.label = "Edit";
        }

        node.graph?.setDirtyCanvas(true, true);
    }

    function handleMainButton(node) {
        const s = node._pf;
        if (!s) return;
        log("handleMainButton(), current mode:", s.mode);

        const textWidget = s.textWidget;

        if (s.mode === "text") {
            const raw = (textWidget && textWidget.value) || "";
            log("Converting text -> tree, length:", raw.length);
            s.tree = parseFolderTextToTree(raw);
            rebuildFlat(s);
            syncJsonWidget(node);

            savePromptText(node);

            s.mode = "tree";
        } else {
            log("Converting tree -> text (from current tree)");
            const restore = treeToText(s.tree);
            if (textWidget) {
                textWidget.value = restore;
            }
            s.mode = "text";
        }

        if (s.textWidget) {
            s.textWidget.value = treeToText(s.tree);
        }
        updateModeUI(node);
    }
    // ------------------- DRAW TREE WIDGET -------------------

    function drawTreeWidget(ctx, node, widgetWidth, y, height) {
        const s = node._pf;
        if (!s || s.mode !== "tree") return;

        const flat = s.flat || [];
        const lineH = TREE_LINE_HEIGHT;
        const paddingX = 8;

        s._widgetY = y;
        const contentStartY = 4;

        ctx.save();
        // ctx.fillStyle = "#111";
        // ctx.fillRect(0, y, widgetWidth, height);

        // base font for lines
        ctx.font = TREE_FONT_SIZE_LINE + "px " + TREE_FONT_FAMILY;
        ctx.textBaseline = "alphabetic";

        for (let i = 0; i < flat.length; i++) {
            const row = flat[i];
            const item = row.item;
            const depth = row.depth || 0;

            const rowTopLocal = contentStartY + i * lineH;
            const rowCenterLocal = rowTopLocal + lineH / 2;
            const rowCenterCanvas = y + rowCenterLocal;

            const cbSize = TREE_CONTROL_SIZE;
            const cbX = paddingX + depth * TREE_INDENT;
            const cbYLocal = rowCenterLocal - cbSize / 2 + TREE_CONTROL_OFFSET_Y;
            const cbYCanvas = y + cbYLocal;

            let checked = false;
            let partial = false;
            if (row.type === "folder") {
                checked = !!item._derivedEnabled;
                partial = !!item._partialSelected;
            } else {
                checked = !!item.enabled;
            }

            ctx.strokeStyle = "#ccc";
            ctx.strokeRect(cbX, cbYCanvas, cbSize, cbSize);
            if (checked) {
                ctx.fillStyle =
                    partial && TREE_PARTIAL_FOLDER_COLOR
                        ? TREE_PARTIAL_FOLDER_COLOR
                        : "#ccc";
                ctx.fillRect(cbX + 2, cbYCanvas + 2, cbSize - 4, cbSize - 4);
            }

            const areaX = cbX + cbSize + 6;
            const areaW = TREE_CONTROL_SIZE;
            const areaH = TREE_CONTROL_SIZE;

            let areaDisabled = false;
            let areaVal = item.area || "ALL";

            if (row.lockedByArea) {
                areaDisabled = true;
                if (
                    row.parentFolder &&
                    row.parentFolder.area &&
                    row.parentFolder.area !== "ALL"
                ) {
                    areaVal = row.parentFolder.area;
                }
            }

            if (areaDisabled) {
                ctx.strokeStyle = "#555";
                ctx.fillStyle = "#111";
            } else {
                ctx.strokeStyle = "#888";
                ctx.fillStyle = "#222";
            }
            ctx.strokeRect(areaX, cbYCanvas, areaW, areaH);
            ctx.fillRect(areaX, cbYCanvas, areaW, areaH);

            const symbol = getAreaSymbol(areaVal);
            ctx.font = TREE_FONT_SIZE_LINE + "px " + TREE_FONT_FAMILY;
            ctx.textBaseline = "middle";
            if (areaDisabled) {
                ctx.fillStyle = "#777";
            } else if (areaVal === "ALL") {
                ctx.fillStyle = "#999999";
            } else {
                ctx.fillStyle = "#ffff00";
            }

            const textMetrics = ctx.measureText(symbol);
            const textWidth = textMetrics.width;
            const textX = areaX + (areaW - textWidth) / 2;
            const textY = cbYCanvas + areaH / 2 + 1.5;

            ctx.fillText(symbol, textX, textY);

            let labelX = areaX + areaW + 2;

            if (row.type === "folder") {
                const iconWidth = 12;
                const iconX = labelX;
                const iconY = rowCenterCanvas;

                ctx.fillStyle = "#ffc94d";
                ctx.font = TREE_FONT_SIZE_FOLDER + "px " + TREE_FONT_FAMILY;
                ctx.textBaseline = "alphabetic";
                ctx.fillText("📁", iconX, iconY + 3);

                labelX = iconX + iconWidth + 10;
            }

            ctx.font =
                (row.type === "folder"
                    ? TREE_FONT_SIZE_FOLDER
                    : TREE_FONT_SIZE_LINE) +
                "px " +
                TREE_FONT_FAMILY;
            ctx.textBaseline = "alphabetic";
            ctx.fillStyle = row.type === "folder" ? "#fff" : "#ccc";

            const label =
                row.type === "folder" ? item.title || "Folder" : item.text || "";

            // Maximum text width: from labelX to the right edge of the node with a small padding
            const maxTextWidth = widgetWidth - (labelX + 2) - 8; // 8px padding on the right
            const clippedLabel = clipTextToWidth(ctx, label, maxTextWidth);

            ctx.fillText(clippedLabel, labelX + 2, rowCenterCanvas + 4);
        }

        ctx.restore();

        s._layout = {
            lineH,
            paddingX,
            contentStartY,
            rowCount: flat.length,
        };
    }

    // ------------------- MOUSE HANDLING -------------------

    function handleTreeMouse(event, pos, node, widget) {
        const s = node._pf;
        if (!s) return;

        if (s.mode !== "tree") return;
        if (event.type !== "mousedown" && event.type !== "pointerdown") return;

        const flat = s.flat || [];
        const layout = s._layout;
        if (!layout) return;

        const widgetY = s._widgetY || 0;
        const localX = pos[0];
        const localY = pos[1] - widgetY;

        const { lineH, paddingX, contentStartY, rowCount } = layout;

        const relY = localY - contentStartY;
        if (relY < 0) return false;

        const index = Math.floor(relY / lineH);
        if (index < 0 || index >= rowCount || index >= flat.length) return false;

        const row = flat[index];
        const item = row.item;
        const depth = row.depth || 0;

        const cbSize = TREE_CONTROL_SIZE;
        const cbX = paddingX + depth * TREE_INDENT;
        const cbYLocal = contentStartY + index * lineH + (lineH - cbSize) / 2 + TREE_CONTROL_OFFSET_Y;

        const areaX = cbX + cbSize + 6;
        const areaW = cbSize;
        const areaH = cbSize;

        const iconWidth = 12;
        const iconX = areaX + areaW + 8;
        const rowTopLocal = contentStartY + index * lineH;
        const rowBottomLocal = rowTopLocal + lineH;

        const areaDisabled = !!row.lockedByArea;

        // Checkbox
        if (
            localX >= cbX &&
            localX <= cbX + cbSize &&
            localY >= cbYLocal &&
            localY <= cbYLocal + cbSize
        ) {
            if (row.type === "folder") {
                const derived = !!item._derivedEnabled;
                const newEnabled = !derived;
                toggleFolderEnabled(item, newEnabled);
            } else {
                item.enabled = !item.enabled;
            }
            rebuildFlat(s);
            syncJsonWidget(node);
            node.graph?.setDirtyCanvas(true, true);
            return true;
        }

        // Area symbol (cycle)
        // Area symbol (cycle / reset)
        // Area symbol (cycle)
        if (
            !areaDisabled &&
            localX >= areaX &&
            localX <= areaX + areaW &&
            localY >= cbYLocal &&
            localY <= cbYLocal + areaH
        ) {
            const oldArea = item.area || "ALL";
            const newArea = nextArea(oldArea);

            item.area = newArea;
            if (row.type === "folder") {
                applyAreaRecursive(item, newArea);
            }
            rebuildFlat(s);
            syncJsonWidget(node);
            node.graph?.setDirtyCanvas(true, true);
            return true;
        }

        // Folder expand/collapse on icon or label
        if (row.type === "folder") {
            const insideVertically =
                localY >= rowTopLocal && localY <= rowBottomLocal;

            const overIcon =
                localX >= iconX &&
                localX <= iconX + iconWidth &&
                insideVertically;

            const labelX = iconX + iconWidth + 6;
            const overLabel = insideVertically && localX >= labelX;

            if (overIcon || overLabel) {
                item.expanded = !item.expanded;
                rebuildFlat(s);
                syncJsonWidget(node);
                node.graph?.setDirtyCanvas(true, true);
                return true;
            }
        }

        return false;
    }

    async function savePromptText(node) {
        const s = node._pf;
        if (!s) return;

        // Take current tree
        const tree = s.tree || { items: [] };

        // Build JSON string from tree
        const jsonText = JSON.stringify(tree, null, 2);

        // Keep file name format as before
        const nodeId = node.id ?? 0;
        const filename = `prompt_folded_${nodeId}.json`;

        // Create File with JSON contents
        const outputFile = new File(
            [jsonText],
            filename,
            { type: "application/json" }
        );

        // Save to: type = "input", subfolder = "prompts_folded"
        uploadComfyFile(outputFile, "input", "prompts_folded");
    }

    async function uploadComfyFile(file, type = "inut", subfolder) {
        const form = new FormData();
        form.append("image", file);
        form.append("type", type);      // IMPORTANT: type in FORM, not in URL
        if (subfolder)
            form.append("subfolder", subfolder);
        form.append("overwrite", "true"); // to overwrite files with the same name

        try {
            const resp = await api.fetchApi("/upload/image", {
                method: "POST",
                body: form,
            });

            const text = await resp.text();
            let info = null;
            try {
                info = JSON.parse(text);
            } catch {
                info = text;
            }

            if (!resp.ok) {
                console.warn("[RGBYP] uploadComfyFile FAILED", file.name, resp.status, info);
                return null;
            }

            // console.log("[RGBYP] uploadComfyFile OK:", file.name, "->", info);
            // info is usually { name, subfolder, type: 'temp' }
            return info;
        } catch (err) {
            console.error("[RGBYP] uploadComfyFile error:", err);
            return null;
        }
    }


    // ------------------- REGISTER EXTENSION -------------------

    app.registerExtension({
        name: "FPFoldedPromptsExtension",
        beforeRegisterNodeDef(nodeType, nodeData, appInstance) {
            // Patch global node context menu once
            patchFPFoldedPromptsContextMenu();
            if (nodeData.name !== "FPFoldedPrompts") return;

            const origOnNodeCreated = nodeType.prototype.onNodeCreated;
            const origOnConfigure = nodeType.prototype.onConfigure; // keep original onConfigure handler

            nodeType.prototype.onNodeCreated = function () {
                const node = this;
                origOnNodeCreated && origOnNodeCreated.apply(node, arguments);
                node.onMouseDown = function (e, pos, canvas) {
                    console.log("ouch!");
                    e.stopPropagation();
                    return;
                    //  original_onMouseDown?.apply(this, arguments);
                }
                node._pf = node._pf || {};
                const s = node._pf;
                s.mode = "tree";
                s.tree = { items: [] };
                s.flat = [];
                s.originalRawText = "";

                const textWidget = node.widgets?.find((w) => w.name === "text");
                let pfJsonWidget = node.widgets?.find((w) => w.name === "pf_json");
                let pfNodeIdWidget = node.widgets?.find(
                    (w) => w.name === "pf_node_id"
                );

                s.textWidget = textWidget;
                s.pfJsonWidget = pfJsonWidget;
                s.pfNodeIdWidget = pfNodeIdWidget;

                if (pfJsonWidget) {
                    pfJsonWidget.hidden = true;
                    pfJsonWidget.computeSize = function (w) {
                        return [w, 0];
                    };
                }
                if (pfNodeIdWidget) {
                    pfNodeIdWidget.hidden = true;
                    pfNodeIdWidget.value = String(node.id);
                    pfNodeIdWidget.computeSize = function (w) {
                        return [w, 0];
                    };
                }

                if (node.inputs && Array.isArray(node.inputs)) {
                    for (const input of node.inputs) {
                        if (
                            input &&
                            (input.name === "pf_json" || input.name === "pf_node_id")
                        ) {
                            input.hidden = true;
                        }
                        if (input && input.name === "text") {
                            // Do not allow connecting anything to internal text widget
                            if (input.link != null && node.graph && node.graph.links) {
                                const linkId = input.link;
                                if (node.graph.links[linkId]) {
                                    delete node.graph.links[linkId];
                                }
                            }
                            input.link = null;
                            input.hidden = true;
                        }
                    }
                }

                // Custom tree widget
                // Reset button — placed first among our widgets so it appears above the tree
                // Reset button
                // Reset button — standard callback on left mouse button
                const resetButton = node.addWidget(
                    "button",
                    "Reset",
                    "Reset",
                    function () {
                        const st = node._pf;
                        if (!st || !st.tree) return;

                        resetTree(st.tree);
                        rebuildFlat(st);
                        syncJsonWidget(node);
                        node.graph?.setDirtyCanvas(true, true);
                    }
                );
                s.resetButton = resetButton;

                // No resetButton.mouse overrides needed here

                // Custom tree widget
                const treeWidget = node.addWidget(
                    "custom",
                    "FPFoldedPromptsTree",
                    null,
                    null,
                    { serialize: false }
                );
                s.treeWidget = treeWidget;

                treeWidget.computeSize = function (width) {
                    const lineH = TREE_LINE_HEIGHT;
                    const paddingTop = 8;
                    const s2 = node._pf;
                    const count = (s2 && s2.flat && s2.flat.length) || 1;
                    const h = paddingTop + count * lineH + 4;
                    return [width, h];
                };

                treeWidget.draw = function (ctx, n, widgetWidth, y, height) {
                    drawTreeWidget(ctx, n, widgetWidth, y, height);
                };

                treeWidget.mouse = function (event, pos, n) {
                    return handleTreeMouse(event, pos, n, treeWidget);
                };

                // Main button (Edit / Save as folders)
                const mainButton = node.addWidget(
                    "button",
                    "Edit",
                    "Edit",
                    function () {
                        handleMainButton(node);
                    }
                );
                s.mainButton = mainButton;

                // --- init sample text on first creation ---
                if (s.tree && (!s.tree.items || s.tree.items.length === 0)) {
                    const hasJson =
                        pfJsonWidget &&
                        typeof pfJsonWidget.value === "string" &&
                        pfJsonWidget.value.trim() !== "";
                    const hasText =
                        textWidget &&
                        typeof textWidget.value === "string" &&
                        textWidget.value.trim() !== "";

                    if (!hasJson && !hasText) {
                        const raw = SAMPLE_TEXT;
                        if (textWidget) {
                            textWidget.value = raw;
                        }
                        s.tree = parseFolderTextToTree(raw);
                        rebuildFlat(s);
                        syncJsonWidget(node);
                        s.mode = "tree";
                    }
                }
                // --- end init sample text ---


                updateModeUI(node);
            };
            nodeType.prototype.onConfigure = function (info) {
                const node = this;
                origOnConfigure && origOnConfigure.apply(node, arguments);

                const s = node._pf;
                if (!s) return;

                const textWidget =
                    s.textWidget ||
                    (node.widgets && node.widgets.find((w) => w.name === "text"));
                let pfJsonWidget =
                    s.pfJsonWidget ||
                    (node.widgets && node.widgets.find((w) => w.name === "pf_json"));

                if (pfJsonWidget) {
                    s.pfJsonWidget = pfJsonWidget;
                }

                let restoredFromJson = false;

                if (
                    pfJsonWidget &&
                    typeof pfJsonWidget.value === "string" &&
                    pfJsonWidget.value.trim() !== ""
                ) {
                    try {
                        s.tree = JSON.parse(pfJsonWidget.value);
                        rebuildFlat(s);
                        s.mode = "tree";
                        restoredFromJson = true;
                    } catch (e) {
                        console.warn(
                            "[FPFoldedPrompts] Failed to parse existing pf_json:",
                            e
                        );
                    }
                }

                if (!restoredFromJson) {
                    let raw =
                        (textWidget && textWidget.value && textWidget.value.trim()) || "";
                    if (!raw) {
                        raw = SAMPLE_TEXT;
                        if (textWidget) textWidget.value = raw;
                    }
                    s.tree = parseFolderTextToTree(raw);
                    rebuildFlat(s);
                    syncJsonWidget(node);
                    s.mode = "tree";
                } else {
                    // Just in case, align pf_json and textWidget to the tree
                    syncJsonWidget(node);
                }

                updateModeUI(node);
            };

        },
    });
})();