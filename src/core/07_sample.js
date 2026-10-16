LG.sample = (function () {
    /** Sample cubics at mid-bin arc lengths; build path-ordered ink polygons. */
    function run(model) {
        var cfg = model.config; var U = LG.util; var segments = []; var curves = []; var h = model.derived.h; var counts; var total; var attempt; var i; var minimum;
        U.each(model.parts, function (part) { U.each(part.contours, function (contour) { U.each(contour.segments, function (segment) { segments.push(segment); if (segment.type === "cubic") { curves.push(segment); } }); }); });
        minimum = curves.length * 4;
        if (minimum > cfg.maxSamples) { throw new Error("Sample budget cannot preserve four samples per cubic; raise advanced.maxSamples"); }
        for (attempt = 0; attempt < 32; attempt += 1) {
            counts = []; total = 0;
            for (i = 0; i < curves.length; i += 1) { counts[i] = U.clamp(Math.ceil(curves[i].length / h), 4, 200); total += counts[i]; }
            if (total <= cfg.maxSamples) { break; }
            U.warn(model.warnings, "SAMPLES_CAPPED", "Sampling spacing increased to respect maxSamples.");
            h *= Math.max(1.01, total / cfg.maxSamples);
        }
        if (total > cfg.maxSamples) {
            // Ceiling/minimum plateaus can slow proportional resampling near the floor.
            for (i = 0; i < curves.length; i += 1) { h = Math.max(h, curves[i].length / 4); }
            counts = []; total = minimum; for (i = 0; i < curves.length; i += 1) { counts[i] = 4; }
        }
        model.samples = []; model.sampleSpacing = h;
        for (i = 0; i < curves.length; i += 1) { curves[i].sampleCount = counts[i]; }
        U.each(segments, function (segment) { segment.samples = []; });
        U.each(model.parts, function (part) { U.each(part.contours, function (contour) {
            var cumulative = 0; var polygon = [];
            U.each(contour.segments, function (segment) {
                var n; var j; var target; var t; var frame; var sample;
                polygon.push(segment.p[0].slice(0));
                if (segment.type === "cubic") {
                    n = segment.sampleCount;
                    for (j = 0; j < n; j += 1) {
                        target = (j + 0.5) / n * segment.length; t = LG.bezier.tAtLength(segment.table, target); frame = LG.bezier.frame(segment.p, t, cfg.EPS);
                        sample = { p: LG.bezier.at(segment.p, t), T: frame.T, kappa: frame.kappa, partId: part.id, contourId: contour.id, segmentId: segment.id, t: t, arcLength: cumulative + target };
                        if (U.finite(sample.p[0]) && U.finite(sample.p[1]) && U.finite(sample.T[0]) && U.finite(sample.T[1]) && U.finite(sample.kappa) && U.finite(sample.arcLength)) { segment.samples.push(sample); model.samples.push(sample); polygon.push(sample.p); }
                        else { U.warn(model.warnings, "NON_FINITE_SAMPLE", "Dropped a non-finite sample in " + segment.id); }
                    }
                }
                cumulative += segment.length;
            });
            if (!contour.closed && contour.segments.length) { polygon.push(contour.segments[contour.segments.length - 1].p[3].slice(0)); }
            contour.polygon = contour.closed ? polygon : [];
        }); });
        return model;
    }
    return { run: run };
}());
