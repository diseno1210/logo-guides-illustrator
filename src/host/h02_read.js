LG.hostRead = (function () {
    /** Reserved output layers never become source artwork. */
    function inGuides(item) { var cursor = item; while (cursor) { if (cursor.typename === "Layer" && (cursor.name === "Logo Guides" || cursor.name === "Logo Guides BG")) { return true; } cursor = cursor.parent; } return false; }
    /** Deduplicate top-level sources; promote compound-path children. */
    function sourceObjects(doc) {
        var selected = doc.selection; var sources = []; var roots = []; var i; var candidate; var current; var nested;
        if (selected && selected.typename === "TextRange") { throw new Error("请按 Esc 退出文字编辑后再导出 / Exit text editing first."); }
        if (!selected || !selected.length) { throw new Error("请先选中 logo / Select a logo first."); }
        for (i = 0; i < selected.length; i += 1) {
            candidate = selected[i];
            if (candidate.typename === "TextRange") { throw new Error("请按 Esc 退出文字编辑后再导出 / Exit text editing first."); }
            if (candidate.typename === "PathItem" && candidate.parent && candidate.parent.typename === "CompoundPathItem") { candidate = candidate.parent; }
            if (!inGuides(candidate) && LG.util.indexOf(sources, candidate) < 0) { sources.push(candidate); }
        }
        for (i = 0; i < sources.length; i += 1) { nested = false; current = sources[i].parent; while (current) { if (LG.util.indexOf(sources, current) >= 0) { nested = true; break; } current = current.parent; } if (!nested) { roots.push(sources[i]); } }
        return roots;
    }
    /** Read selected top-level sources into Geometry JSON v1; do not mutate originals. */
    function selection(doc, settings, sources) {
        var U = LG.util; var cfg = LG.config.resolve(settings); var selected = doc.selection; var roots = sources || sourceObjects(doc); var parts = []; var warnings = []; var skipped = {}; var anchorCount = 0; var approvedLarge = false; var savedLayer = doc.activeLayer; var geometryBox = null; var i; var j; var board; var boards; var center; var color;
        /** Count unsupported objects by type. */
        function skip(type) { skipped[type] = (U.has(skipped, type) ? skipped[type] : 0) + 1; }
        /** Snapshot pathPoints once; empty and zero-length paths are omitted. */
        function pathContour(path, partId, index) {
            var collection = path.pathPoints; var length = collection.length; var points = []; var k; var p; var q; var total = 0; var controls; var box = null;
            if (length < 2) { return null; }
            anchorCount += length;
            if (anchorCount > 20000 && !approvedLarge) { if (!confirm("选区超过 20000 个锚点，可能很慢。继续导出？ / More than 20000 anchors. Continue?")) { throw new Error("已取消导出 / Export cancelled."); } approvedLarge = true; }
            for (k = 0; k < length; k += 1) { p = collection[k]; points.push({ a: [Number(p.anchor[0]), Number(p.anchor[1])], l: [Number(p.leftDirection[0]), Number(p.leftDirection[1])], r: [Number(p.rightDirection[0]), Number(p.rightDirection[1])] }); }
            for (k = 0; k < (path.closed ? length : length - 1); k += 1) { p = points[k]; q = points[(k + 1) % length]; controls = [p.a, p.r, q.l, q.a]; total += LG.bezier.arcTable(controls).length; box = U.union(box, LG.bezier.bounds(controls, cfg.EPS)); }
            if (!(total > cfg.EPS)) { return null; }
            geometryBox = U.union(geometryBox, box);
            return { id: partId + "c" + index, closed: !!path.closed, points: points };
        }
        /** Convert a path or compound to one part. */
        function readPart(item, sourceIndex, kind) {
            var id = "p" + parts.length; var contours = []; var paths; var first; var contour; var k;
            paths = item.typename === "CompoundPathItem" ? item.pathItems : [item];
            for (k = 0; k < paths.length; k += 1) { if (!paths[k].hidden) { contour = pathContour(paths[k], id, contours.length); if (contour) { contours.push(contour); if (!first) { first = paths[k]; } } } }
            if (!contours.length) { U.warn(warnings, "DEGENERATE_PATH", "Skipped empty or zero-length path."); return; }
            parts.push({ id: id, sourceIndex: sourceIndex, kind: kind || (item.typename === "CompoundPathItem" ? "compound" : "path"), filled: !!first.filled, stroked: !!first.stroked, strokeWidth: Number(first.strokeWidth) || 0, contours: contours });
            if ((!first.filled && first.stroked) || U.filterArr(contours, function (c) { return !c.closed; }).length) { U.warn(warnings, "OUTLINE_STROKES", "Open or stroke-only geometry: outline strokes before measuring widths."); }
        }
        /** Recursively flatten direct children, cleaning temporary text outlines on all paths. */
        function visit(item, sourceIndex, textOutline) {
            var type; var children; var k; var duplicate = null; var outline = null;
            if (!item || item.hidden || inGuides(item)) { return; }
            type = item.typename;
            if (type === "GroupItem") {
                children = item.pageItems;
                for (k = 0; k < children.length; k += 1) { if (children[k].parent === item && !(item.clipped && children[k].clipping)) { visit(children[k], sourceIndex, textOutline); } }
            } else if (type === "PathItem" || type === "CompoundPathItem") { readPart(item, sourceIndex, textOutline ? "textOutline" : null); }
            else if (type === "TextFrame") {
                if (!cfg.settings.autoOutlineText) { skip("TextFrame"); return; }
                try { duplicate = item.duplicate(); outline = duplicate.createOutline(); duplicate = null; visit(outline, sourceIndex, true); }
                catch (error) { if (!outline && duplicate) { throw new Error("文字临时轮廓化失败，请手动转曲 / Outline text manually. " + String(error)); } throw error; }
                finally { try { if (outline) { outline.remove(); } } finally { if (duplicate) { duplicate.remove(); } } }
            } else { skip(type || "Unknown"); }
        }
        try {
            for (i = 0; i < roots.length; i += 1) { visit(roots[i], i, false); }
            for (j in skipped) { if (U.has(skipped, j)) { U.warn(warnings, "UNSUPPORTED_ITEMS", "Skipped " + j + ": " + skipped[j]); } }
            if (!parts.length) { throw new Error("选区没有可读取路径 / No supported paths. " + U.mapArr(warnings, function (w) { return w.message; }).join("; ")); }
            boards = doc.artboards; board = boards[boards.getActiveArtboardIndex()].artboardRect;
            center = [(geometryBox[0] + geometryBox[2]) / 2, (geometryBox[1] + geometryBox[3]) / 2];
            for (i = 0; i < boards.length; i += 1) { if (U.contains(boards[i].artboardRect, center[0], center[1])) { board = boards[i].artboardRect; break; } }
            color = doc.documentColorSpace === DocumentColorSpace.CMYK ? "CMYK" : "RGB";
            return { version: 1, units: "pt", colorSpace: color, artboard: [Number(board[0]), Number(board[1]), Number(board[2]), Number(board[3])], parts: parts, warnings: warnings };
        } finally { try { doc.activeLayer = savedLayer; } finally { doc.selection = selected; } }
    }
    return { selection: selection, sourceObjects: sourceObjects, inGuides: inGuides };
}());
