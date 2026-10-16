LG.lines = (function () {
    var U = LG.util;
    /** Unique support ids in evidence order. */
    function unique(items, key) { var out = []; U.each(items, function (e) { if (U.indexOf(out, e[key]) < 0) { out.push(e[key]); } }); return out; }
    /** Cluster evidence and classify references; feature switches are applied later. */
    function detect(model) {
        var result = []; var cfg = model.config; var tol = model.derived.tolPos;
        function group(orient, row) {
            var evidence = []; var clusters; var flatClusters; var overshootAnchors = [];
            U.each(model.edges, function (e) {
                if (!e["short"] && e.orient === orient && (!row || e.rowId === row.id)) { evidence.push({ pos: orient === "h" ? (e.p0[1] + e.p1[1]) / 2 : (e.p0[0] + e.p1[0]) / 2, weight: e.length, partId: e.partId, contourId: e.contourId, type: "flat" }); }
            });
            U.each(model.extrema, function (e) {
                if (e.silhouette && (!row || e.rowId === row.id) && (orient === "h" ? (e.type === "top" || e.type === "bottom") : (e.type === "left" || e.type === "right"))) { evidence.push({ pos: e.p[orient === "h" ? 1 : 0], weight: 0, partId: e.partId, contourId: e.contourId, type: e.type }); }
            });
            clusters = LG.cluster.cluster1D(U.mapArr(evidence, function (e) { return e.pos; }), U.mapArr(evidence, function (e) { return e.weight; }), tol, false);
            U.each(clusters, function (c) { c.evidence = U.mapArr(c.members, function (i) { return evidence[i]; }); });
            flatClusters = U.filterArr(clusters, function (c) { return c.weight > 0; });
            // F9 requires its narrow I baselines as well as the supported overshoot.
            // Preserve the flat anchor of an otherwise retained overshoot pair (D011).
            if (orient === "h") {
                U.each(clusters, function (c, index) {
                    var nearest = null; var delta = Infinity; var top = 0; var bottom = 0;
                    if (c.weight || !(index === 0 || index === clusters.length - 1 || unique(c.evidence, "partId").length >= 2)) { return; }
                    U.each(flatClusters, function (f) { if (Math.abs(c.pos - f.pos) < delta) { nearest = f; delta = Math.abs(c.pos - f.pos); } });
                    U.each(c.evidence, function (e) { if (e.type === "top") { top += 1; } else { bottom += 1; } });
                    if (nearest && delta > tol && delta <= cfg.overshootMaxRel * row.height && (top >= bottom ? c.pos > nearest.pos : c.pos < nearest.pos)) { overshootAnchors.push(nearest); }
                });
            }
            U.each(clusters, function (c, index) {
                var parts = unique(c.evidence, "partId"); var contours = unique(c.evidence, "contourId");
                var flats = U.filterArr(c.evidence, function (e) { return e.weight > 0; }); var rounds = U.filterArr(c.evidence, function (e) { return !e.weight; });
                var boundary = index === 0 || index === clusters.length - 1; var mixed = false; var category = "baseline"; var subtype = "flat";
                var nearest = null; var delta = Infinity; var top = 0; var bottom = 0; var outward;
                if (!(c.weight >= cfg.lineKeepFlatRel * model.S || parts.length >= 2 || boundary || U.indexOf(overshootAnchors, c) >= 0)) { return; }
                if (flats.length) {
                    U.each(rounds, function (r) { U.each(flats, function (f) { if (r.contourId !== f.contourId) { mixed = true; } }); });
                    if (mixed) { category = cfg.settings.mixedAsVisual ? "visual" : "baseline"; subtype = "mixed"; }
                } else {
                    subtype = "round";
                    if (orient === "h") {
                        U.each(flatClusters, function (f) { if (Math.abs(c.pos - f.pos) < delta) { delta = Math.abs(c.pos - f.pos); nearest = f; } });
                        U.each(rounds, function (r) { if (r.type === "top") { top += 1; } else { bottom += 1; } });
                        outward = nearest && (top >= bottom ? c.pos > nearest.pos : c.pos < nearest.pos);
                        if (delta > tol && delta <= cfg.overshootMaxRel * row.height && outward) { category = "visual"; subtype = "overshoot"; }
                        else if (!(parts.length >= 2 || boundary)) { return; }
                    } else if (!(contours.length >= 2 || boundary)) { return; }
                }
                result.push({ id: "L" + (result.length + 1), orient: orient, pos: c.pos, category: category, subtype: subtype, support: { flatLen: c.weight, roundCount: rounds.length, partIds: parts, contourIds: contours }, span: [0, 0], rowId: row ? row.id : null, boundary: boundary });
            });
        }
        U.each(model.rows, function (row) { group("h", row); }); group("v", null);
        model.referenceLines = result; return result;
    }
    /** Position merge with union spans and highest-category identity. */
    function LineRegistry(tolerance) { this.tolerance = tolerance; this.lines = []; }
    LineRegistry.prototype.register = function (orient, pos, span, category, featureId) {
        var rank = { visual: 3, baseline: 2, dimension: 1 }; var i; var existing;
        if ((orient !== "h" && orient !== "v") || !U.finite(pos) || !U.finite(span[0]) || !U.finite(span[1]) || !U.has(rank, category)) { throw new Error("Invalid registered line"); }
        for (i = 0; i < this.lines.length; i += 1) {
            existing = this.lines[i];
            if (existing.orient === orient && Math.abs(existing.pos - pos) <= this.tolerance / 2) {
                existing.span = [Math.min(existing.span[0], span[0], span[1]), Math.max(existing.span[1], span[0], span[1])];
                if (rank[category] > rank[existing.category]) { existing.category = category; existing.pos = pos; existing.id = featureId; }
                return existing;
            }
        }
        existing = { orient: orient, pos: pos, span: [Math.min(span[0], span[1]), Math.max(span[0], span[1])], category: category, id: featureId };
        this.lines.push(existing); return existing;
    };
    /** Apply only the reference output switches, preserving analysis evidence. */
    function enabled(line, settings) { return line.orient === "v" ? settings.features.verticals : (line.subtype === "overshoot" ? settings.features.overshoot : settings.features.baselines); }
    return { detect: detect, LineRegistry: LineRegistry, enabled: enabled };
}());
