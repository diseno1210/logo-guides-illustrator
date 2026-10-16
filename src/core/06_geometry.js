LG.geometry = (function () {
    /** Validate a finite point. */
    function validPoint(p) { return LG.util.isArray(p) && p.length === 2 && LG.util.finite(p[0]) && LG.util.finite(p[1]); }
    /** Build an immutable working model, preserving source geometry and exact cubic bounds. */
    function normalize(input, settings) {
        var U = LG.util; var V = LG.vec; var cfg = LG.config.resolve(settings);
        var model = { version: 1, parts: [], bbox: null, rows: [], S: 0, D: 0, config: cfg, warnings: [] };
        var ids = []; var i; var j; var k; var source; var contour; var target; var part; var points; var point; var next; var controls; var segment; var count; var rawCount = 0; var invalid;
        if (!input || input.version !== 1 || input.units !== "pt" || !U.isArray(input.parts) || !U.isArray(input.warnings) || (input.colorSpace !== "RGB" && input.colorSpace !== "CMYK")) { throw new Error("Expected Geometry JSON v1 in pt"); }
        if (!U.isArray(input.artboard) || input.artboard.length !== 4 || !U.finite(input.artboard[0]) || !U.finite(input.artboard[1]) || !U.finite(input.artboard[2]) || !U.finite(input.artboard[3]) || input.artboard[0] >= input.artboard[2] || input.artboard[1] <= input.artboard[3]) { throw new Error("Invalid geometry artboard"); }
        model.artboard = input.artboard.slice(0);
        for (i = 0; i < input.warnings.length; i += 1) { if (typeof input.warnings[i].code !== "string" || typeof input.warnings[i].message !== "string") { throw new Error("Invalid geometry warning"); } model.warnings.push(U.clone(input.warnings[i])); }
        for (i = 0; i < input.parts.length; i += 1) {
            source = input.parts[i];
            if (!source || typeof source.id !== "string" || !source.id || U.indexOf(ids, source.id) >= 0 || !U.isArray(source.contours) || U.indexOf(["path", "compound", "textOutline"], source.kind) < 0 || !U.finite(source.sourceIndex) || source.sourceIndex < 0 || source.sourceIndex !== Math.floor(source.sourceIndex) || typeof source.filled !== "boolean" || typeof source.stroked !== "boolean" || !U.finite(source.strokeWidth) || source.strokeWidth < 0) { throw new Error("Invalid geometry part at index " + i); }
            ids.push(source.id);
            part = { id: source.id, sourceIndex: source.sourceIndex, kind: source.kind, filled: source.filled, stroked: source.stroked, strokeWidth: source.strokeWidth, contours: [], bbox: null, inkEligible: source.filled, small: false, rowId: null };
            for (j = 0; j < source.contours.length; j += 1) {
                contour = source.contours[j];
                if (!contour || typeof contour.id !== "string" || !contour.id || U.indexOf(ids, contour.id) >= 0 || typeof contour.closed !== "boolean" || !U.isArray(contour.points)) { throw new Error("Invalid geometry contour"); }
                ids.push(contour.id); rawCount += contour.points.length; points = []; invalid = false;
                for (k = 0; k < contour.points.length; k += 1) { point = contour.points[k]; if (!point || !validPoint(point.a) || !validPoint(point.l) || !validPoint(point.r)) { invalid = true; break; } points.push({a:point.a.slice(0),l:point.l.slice(0),r:point.r.slice(0)}); }
                if (invalid) { U.warn(model.warnings, "NON_FINITE_GEOMETRY", "Skipped non-finite contour: " + contour.id); continue; }
                if (points.length < 2) { U.warn(model.warnings, "DEGENERATE_PATH", "Skipped contour with fewer than two anchors: " + contour.id); continue; }
                target = { id: contour.id, partId: part.id, closed: contour.closed, points: points, segments: [], bbox: null, polygon: [], length: 0 };
                count = contour.closed ? points.length : points.length - 1;
                for (k = 0; k < count; k += 1) {
                    point = points[k]; next = points[(k + 1) % points.length];
                    if (V.distance(point.a, next.a) <= 1e-6) { continue; }
                    controls = [point.a.slice(0), point.r.slice(0), next.l.slice(0), next.a.slice(0)];
                    segment = { id: contour.id + "s" + k, partId: part.id, contourId: contour.id, sourceSegmentIndex: k, type: V.distance(point.a, point.r) <= 1e-6 && V.distance(next.a, next.l) <= 1e-6 ? "line" : "cubic", p: controls, samples: [], bbox: LG.bezier.bounds(controls, cfg.EPS), table: null, length: 0 };
                    if (!U.finite(segment.bbox[0]) || !U.finite(segment.bbox[1]) || !U.finite(segment.bbox[2]) || !U.finite(segment.bbox[3])) { U.warn(model.warnings, "NON_FINITE_GEOMETRY", "Skipped non-finite segment: " + segment.id); continue; }
                    target.segments.push(segment); target.bbox = U.union(target.bbox, segment.bbox);
                }
                if (!target.segments.length) { U.warn(model.warnings, "DEGENERATE_PATH", "Skipped zero-length contour: " + target.id); continue; }
                if (!target.closed) { part.inkEligible = false; }
                part.contours.push(target); part.bbox = U.union(part.bbox, target.bbox);
            }
            if (!part.contours.length) { continue; }
            if ((!part.filled && part.stroked) || !part.inkEligible) { U.warn(model.warnings, "OUTLINE_STROKES", "Open or stroke-only part excluded from ink/stem tests; outline strokes first: " + part.id); }
            model.parts.push(part); model.bbox = U.union(model.bbox, part.bbox);
        }
        if (!model.parts.length) { throw new Error("No usable geometry"); }
        model.anchorCount = rawCount;
        // Exact raw bounds establish S before the S-relative straightness test.
        LG.rows.detect(model); model.derived = LG.config.derive(cfg, model.S, model.D);
        U.each(model.parts, function (p) { U.each(p.contours, function (c) { U.each(c.segments, function (s) {
            if (s.type === "cubic" && LG.bezier.straight(s.p, cfg.lineStraightTol * model.S)) { s.type = "line"; }
            s.table = s.type === "cubic" ? LG.bezier.arcTable(s.p) : null;
            s.length = s.table ? s.table.length : V.distance(s.p[0], s.p[3]); c.length += s.length;
        }); }); });
        if (model.S < 5 || model.S > 5000) { U.warn(model.warnings, "EXTREME_SCALE", "Geometry scale is outside 5..5000 pt."); }
        if (cfg.settings.extendTo === "artboard" && (!U.contains(model.artboard, model.bbox[0], model.bbox[1]) || !U.contains(model.artboard, model.bbox[2], model.bbox[3]))) { U.warn(model.warnings, "OUTSIDE_ARTBOARD", "Geometry extends beyond the selected artboard."); }
        return model;
    }
    return { normalize: normalize };
}());
