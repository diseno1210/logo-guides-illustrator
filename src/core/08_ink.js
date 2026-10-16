LG.ink = (function () {
    /** Even-odd polygon inclusion. Boundary points count as inside. */
    function inPolygon(polygon, x, y, epsilon) {
        var inside = false; var i; var j; var a; var b; var projection;
        for (i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
            a = polygon[j]; b = polygon[i]; projection = LG.vec.project([x, y], a, b);
            if (projection && projection.t >= 0 && projection.t <= 1 && projection.distance <= epsilon) { return true; }
            if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) { inside = !inside; }
        }
        return inside;
    }
    /** Return inkAt(x,y,optionalPartId), union across filled closed parts. */
    function create(model) {
        if (!model.samples) { throw new Error("Run sampling before ink tests"); }
        return function (x, y, partId) {
            var i; var j; var part; var contour; var inside;
            if (!LG.util.finite(x) || !LG.util.finite(y)) { return false; }
            for (i = 0; i < model.parts.length; i += 1) {
                part = model.parts[i]; if ((partId && part.id !== partId) || !part.inkEligible || !LG.util.contains(part.bbox, x, y, model.config.EPS)) { continue; }
                inside = false;
                for (j = 0; j < part.contours.length; j += 1) { contour = part.contours[j]; if (contour.closed && LG.util.contains(contour.bbox, x, y, model.config.EPS) && inPolygon(contour.polygon, x, y, model.config.EPS)) { inside = !inside; } }
                if (inside) { return true; }
            }
            return false;
        };
    }
    return { create: create, inPolygon: inPolygon };
}());
