LG.edges = (function () {
    var U = LG.util; var V = LG.vec;
    /** Unoriented angle in degrees. */
    function angle(p0, p1) { var d = V.sub(p1, p0); return (Math.atan2(d[1], d[0]) * 180 / Math.PI + 180) % 180; }
    /** True for connected, forward, nearly parallel edge fragments. */
    function joins(a, b, cfg) {
        var x = V.unit(V.sub(a.p1, a.p0)); var y = V.unit(V.sub(b.p1, b.p0));
        return V.distance(a.p1, b.p0) <= cfg.EPS && V.dot(x, y) > 0 && Math.acos(U.clamp(V.dot(x, y), -1, 1)) * 180 / Math.PI <= cfg.parallelAngleTol;
    }
    /** Extract merged straight edges and analytic, silhouette-tested curve extrema. */
    function run(model) {
        var cfg = model.config; var d = model.derived; var inkAt = LG.ink.create(model); var edges = []; var extrema = [];
        U.each(model.parts, function (part) { U.each(part.contours, function (contour) {
            var local = []; var previous = null; var first; var last;
            U.each(contour.segments, function (s) {
                var edge;
                if (s.type !== "line") { previous = null; return; }
                edge = { p0: s.p[0].slice(0), p1: s.p[3].slice(0), partId: part.id, contourId: contour.id, rowId: part.rowId, segmentIds: [s.id] };
                if (previous && joins(previous, edge, cfg)) { previous.p1 = edge.p1; previous.segmentIds.push(s.id); }
                else { local.push(edge); previous = edge; }
            });
            if (contour.closed && local.length > 1 && contour.segments[0].type === "line" && contour.segments[contour.segments.length - 1].type === "line") {
                first = local[0]; last = local[local.length - 1];
                if (joins(last, first, cfg)) { first.p0 = last.p0; first.segmentIds = last.segmentIds.concat(first.segmentIds); local.pop(); }
            }
            U.each(local, function (edge) {
                edge.id = "E" + (edges.length + 1); edge.length = V.distance(edge.p0, edge.p1); edge.angleDeg = angle(edge.p0, edge.p1);
                edge.orient = Math.min(edge.angleDeg, 180 - edge.angleDeg) <= cfg.axisAngleTol ? "h" : (Math.abs(edge.angleDeg - 90) <= cfg.axisAngleTol ? "v" : "d");
                edge["short"] = edge.length < d.minEdgeLen; edges.push(edge);
            });
            U.each(contour.segments, function (s) {
                var candidates;
                if (s.type !== "cubic") { return; }
                candidates = LG.bezier.extrema(s.p, cfg.EPS);
                U.each([0, 1], function (t) {
                    var f = LG.bezier.frame(s.p, t, cfg.EPS); var a = angle([0, 0], f.T);
                    if (Math.min(a, 180 - a) <= cfg.axisAngleTol) { candidates.push({ axis: 1, t: t, p: LG.bezier.at(s.p, t) }); }
                    if (Math.abs(a - 90) <= cfg.axisAngleTol) { candidates.push({ axis: 0, t: t, p: LG.bezier.at(s.p, t) }); }
                });
                U.each(candidates, function (e) {
                    var f = LG.bezier.frame(s.p, e.t, cfg.EPS); var kappa = f.kappa; var second = LG.bezier.second(s.p, e.t)[e.axis];
                    var type; var normal; var outside; var inside; var i; var duplicate = false;
                    if ((e.t === 0 || e.t === 1) && s.samples.length) { kappa = s.samples[e.t === 0 ? 0 : s.samples.length - 1].kappa; }
                    if (Math.abs(kappa) < d.kappaMin || Math.abs(second) <= cfg.EPS) { return; }
                    type = e.axis === 1 ? (second < 0 ? "top" : "bottom") : (second < 0 ? "right" : "left");
                    normal = e.axis === 1 ? [0, second < 0 ? 1 : -1] : [second < 0 ? 1 : -1, 0];
                    outside = V.add(e.p, V.scale(normal, d.epsilon)); inside = V.sub(e.p, V.scale(normal, d.epsilon));
                    for (i = 0; i < extrema.length; i += 1) {
                        if (extrema[i].contourId === contour.id && extrema[i].type === type && V.distance(extrema[i].p, e.p) <= d.tolPos / 2) { duplicate = true; break; }
                    }
                    if (!duplicate && U.finite(e.p[0]) && U.finite(e.p[1])) {
                        extrema.push({ p: e.p, type: type, partId: part.id, contourId: contour.id, rowId: part.rowId, segmentId: s.id, t: e.t, kappa: kappa, silhouette: !inkAt(outside[0], outside[1]) && inkAt(inside[0], inside[1]) });
                    }
                });
            });
        }); });
        model.edges = edges; model.extrema = extrema; return model;
    }
    return { run: run, angle: angle };
}());
