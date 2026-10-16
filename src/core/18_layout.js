LG.layout = (function () {
    /** Guide area and reference spans; dimension lanes arrive in M3. */
    function references(model) {
        var U = LG.util; var settings = model.config.settings; var fs = model.derived.fs; var m = settings.marginFactor * model.D;
        var b = model.bbox; var area = settings.extendTo === "artboard" ? model.artboard.slice(0) : [b[0] - m, b[1] + m, b[2] + m, b[3] - m];
        U.each(area, function (n) { if (!U.finite(n)) { throw new Error("Guide area exceeds finite coordinate range"); } });
        U.each(model.referenceLines, function (line) {
            var top = -Infinity; var bottom = Infinity;
            if (line.orient === "h") { line.span = [area[0], area[2]]; }
            else if (line.boundary) { line.span = [area[3], area[1]]; }
            else {
                U.each(model.rows, function (row) {
                    var supports = false;
                    U.each(line.support.partIds, function (id) { if (U.indexOf(row.partIds, id) >= 0) { supports = true; } });
                    if (supports) { top = Math.max(top, row.bbox[1] + fs); bottom = Math.min(bottom, row.bbox[3] - fs); }
                });
                line.span = U.finite(top) && U.finite(bottom) ? [bottom, top] : [b[3] - fs, b[1] + fs];
            }
        });
        return { fontSize: fs, strokeUnit: model.derived.u, guideArea: area, primitives: [] };
    }
    /** Unrotated label bounds estimate in the core's y-up coordinates. */
    function labelBounds(label, fontSize) {
        var width = 0; var height = 0; var U = LG.util;
        U.each(label.lines, function (line) {
            var size = fontSize * line.sizeFactor; var sum = 0; var i; var c; var code;
            for (i = 0; i < line.text.length; i += 1) {
                c = line.text.charAt(i); code = line.text.charCodeAt(i);
                sum += c >= "0" && c <= "9" ? 0.56 : (c === "." || c === " " ? 0.28 : (c === "a" ? 0.55 : (c === "°" ? 0.40 : (c === "+" || c === "-" ? 0.58 : (code >= 0x2e80 ? 1 : 0.6)))));
            }
            width = Math.max(width, size * sum); height += 1.2 * size;
        });
        if (label.rotation === -90) { return [label.pos[0] - height / 2, label.pos[1] + width / 2, label.pos[0] + height / 2, label.pos[1] - width / 2]; }
        return [label.pos[0] - width / 2, label.pos[1] + height / 2, label.pos[0] + width / 2, label.pos[1] - height / 2];
    }
    return { references: references, labelBounds: labelBounds };
}());
