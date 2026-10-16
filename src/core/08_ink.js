LG.ink = (function () {
    /** Even-odd polygon inclusion. Boundary points count as inside. */
    function inPolygon(polygon, x, y, epsilon) {
        var inside = false; var i; var j; var a; var b; var dx;var dy;var length;var ux;var uy;var along;
        for (i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
            a = polygon[j]; b = polygon[i];dx=b[0]-a[0];dy=b[1]-a[1];length=LG.util.hypot(dx,dy);
            if(length){ux=dx/length;uy=dy/length;along=(x-a[0])*ux+(y-a[1])*uy;if(along>=0&&along<=length&&Math.abs((x-a[0])*uy-(y-a[1])*ux)<=epsilon){return true;}}
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
