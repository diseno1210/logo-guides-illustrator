LG.rows = (function () {
    /** Positive interval overlap. */
    function overlap(a, b, axis) { return axis === 0 ? Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) : Math.max(0, Math.min(a[1], b[1]) - Math.max(a[3], b[3])); }
    /** Assign parts to deterministic rows; exclude small parts from row height and S. */
    function detect(model) {
        var parts = model.parts; var cfg = model.config; var U = LG.util; var heights = []; var median; var parent = []; var large = []; var groups = []; var i; var j; var h; var root; var row; var best; var bestScore; var score; var sharedX; var hasShared; var dx; var dy; var a; var b;
        function findRoot(index) { var cursor = index; while (parent[cursor] !== cursor) { parent[cursor] = parent[parent[cursor]]; cursor = parent[cursor]; } return cursor; }
        for (i = 0; i < parts.length; i += 1) { heights.push(parts[i].bbox[1] - parts[i].bbox[3]); parent.push(i); }
        median = U.median(heights);
        for (i = 0; i < parts.length; i += 1) { parts[i].small = heights[i] < cfg.smallPartRel * median; if (!parts[i].small) { large.push(i); } }
        for (i = 0; i < large.length; i += 1) { for (j = i + 1; j < large.length; j += 1) {
            a = large[i]; b = large[j]; h = Math.min(heights[a], heights[b]);
            if (h > cfg.EPS && overlap(parts[a].bbox, parts[b].bbox, 1) >= cfg.rowOverlapMin * h) { parent[findRoot(b)] = findRoot(a); }
        } }
        for (i = 0; i < large.length; i += 1) {
            a = large[i]; root = findRoot(a); row = null;
            for (j = 0; j < groups.length; j += 1) { if (groups[j].root === root) { row = groups[j]; break; } }
            if (!row) { row = { root: root, bbox: null, partIds: [], height: 0 }; groups.push(row); }
            row.bbox = U.union(row.bbox, parts[a].bbox); row.partIds.push(parts[a].id);
        }
        groups.sort(function (x, y) { return y.bbox[1] - x.bbox[1] || x.bbox[0] - y.bbox[0] || x.root - y.root; });
        model.S = 0; model.rows = [];
        for (i = 0; i < groups.length; i += 1) { row = groups[i]; row.id = "r" + i; row.height = row.bbox[1] - row.bbox[3]; model.S = Math.max(model.S, row.height); model.rows.push({ id: row.id, bbox: row.bbox, partIds: row.partIds, height: row.height }); }
        for (i = 0; i < parts.length; i += 1) {
            if (!parts[i].small) { for (j = 0; j < model.rows.length; j += 1) { if (U.indexOf(model.rows[j].partIds, parts[i].id) >= 0) { parts[i].rowId = model.rows[j].id; break; } } continue; }
            best = -1; bestScore = Infinity; hasShared = false;
            for (j = 0; j < model.rows.length; j += 1) {
                row = model.rows[j]; sharedX = overlap(parts[i].bbox, row.bbox, 0) > 0;
                if (hasShared && !sharedX) { continue; }
                dx = (parts[i].bbox[0] + parts[i].bbox[2] - row.bbox[0] - row.bbox[2]) / 2;
                dy = (parts[i].bbox[1] + parts[i].bbox[3] - row.bbox[1] - row.bbox[3]) / 2;
                score = sharedX ? Math.max(0, parts[i].bbox[3] - row.bbox[1], row.bbox[3] - parts[i].bbox[1]) : LG.util.hypot(dx, dy);
                if ((sharedX && !hasShared) || score < bestScore) { best = j; bestScore = score; hasShared = sharedX; }
            }
            if (best >= 0) { parts[i].rowId = model.rows[best].id; model.rows[best].partIds.push(parts[i].id); }
        }
        model.D = U.hypot(model.bbox[2] - model.bbox[0], model.bbox[1] - model.bbox[3]);
        if (!(model.S > cfg.EPS)) { model.S = model.D; U.warn(model.warnings, "ZERO_ROW_HEIGHT", "Zero-height geometry uses its diagonal as scale."); }
        return model.rows;
    }
    return { detect: detect, overlap: overlap };
}());
