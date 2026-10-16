LG.bezier = (function () {
    var V = LG.vec;
    /** Evaluate cubic [P0,P1,P2,P3] at t using the Bernstein basis. */
    function at(p, t) { var u=1-t;var a=u*u*u;var b=3*u*u*t;var c=3*u*t*t;var d=t*t*t;return [a*p[0][0]+b*p[1][0]+c*p[2][0]+d*p[3][0],a*p[0][1]+b*p[1][1]+c*p[2][1]+d*p[3][1]]; }
    /** First derivative. */
    function derivative(p, t) {var u=1-t;return [3*(u*u*(p[1][0]-p[0][0])+2*u*t*(p[2][0]-p[1][0])+t*t*(p[3][0]-p[2][0])),3*(u*u*(p[1][1]-p[0][1])+2*u*t*(p[2][1]-p[1][1])+t*t*(p[3][1]-p[2][1]))];}
    /** Second derivative. */
    function second(p, t) {return [6*((1-t)*(p[2][0]-2*p[1][0]+p[0][0])+t*(p[3][0]-2*p[2][0]+p[1][0])),6*((1-t)*(p[2][1]-2*p[1][1]+p[0][1])+t*(p[3][1]-2*p[2][1]+p[1][1]))];}
    /** Unit tangent and signed curvature; stationary fallback to B'' then chord. */
    function frame(p, t, epsilon) { var d = derivative(p, t); var dd = second(p, t); var speed = V.length(d); var tangent = speed > epsilon ? [d[0]/speed,d[1]/speed] : V.unit(V.length(dd) > epsilon ? dd : V.sub(p[3], p[0])); return { T: tangent, kappa: speed > epsilon ? ((d[0]/speed)*(dd[1]/speed)-(d[1]/speed)*(dd[0]/speed)) / speed : 0 }; }
    /** Real quadratic roots with cancellation-resistant formula. */
    function roots(a, b, c, epsilon) { var m = Math.max(Math.abs(a), Math.abs(b), Math.abs(c)); var discriminant; var q; var r; if (!m) { return []; } a /= m; b /= m; c /= m; if (Math.abs(a) <= epsilon) { return Math.abs(b) <= epsilon ? [] : [-c / b]; } discriminant = b * b - 4 * a * c; if (discriminant < -epsilon) { return []; } if (Math.abs(discriminant) <= epsilon) { return [-b / (2 * a)]; } q = -0.5 * (b + (b < 0 ? -1 : 1) * Math.sqrt(discriminant)); r = [q / a, c / q]; return r.sort(function (x, y) { return x - y; }); }
    /** Interior extrema for x and y, as axis/t/p records. */
    function extrema(p, epsilon) { var result = []; var axis; var v; var found; var i; var t; for (axis = 0; axis < 2; axis += 1) { v = [p[0][axis], p[1][axis], p[2][axis], p[3][axis]]; found = roots(3 * (-v[0] + 3 * v[1] - 3 * v[2] + v[3]), 6 * (v[0] - 2 * v[1] + v[2]), 3 * (v[1] - v[0]), epsilon); for (i = 0; i < found.length; i += 1) { t = found[i]; if (t > 0 && t < 1) { result.push({ axis: axis, t: t, p: at(p, t) }); } } } return result; }
    /** Exact bounds from endpoints and analytic extrema. */
    function bounds(p, epsilon) { var box = [Math.min(p[0][0], p[3][0]), Math.max(p[0][1], p[3][1]), Math.max(p[0][0], p[3][0]), Math.min(p[0][1], p[3][1])]; LG.util.each(extrema(p, epsilon), function (e) { box = LG.util.union(box, [e.p[0], e.p[1], e.p[0], e.p[1]]); }); return box; }
    /** Section 8.1 straightness, with backtracking projection guard. */
    function straight(p, tolerance) { var a = V.project(p[1], p[0], p[3]); var b = V.project(p[2], p[0], p[3]); return !!a && !!b && a.distance <= tolerance && b.distance <= tolerance && a.t >= -0.01 && a.t <= 1.01 && b.t >= -0.01 && b.t <= 1.01; }
    /** 64 equal-t intervals with cumulative arc lengths. */
    function arcTable(p) { var table = [{ t: 0, length: 0 }]; var previous = p[0]; var total = 0; var i; var current; for (i = 1; i <= 64; i += 1) { current = at(p, i / 64); total += LG.util.hypot(previous[0]-current[0],previous[1]-current[1]); table.push({ t: i / 64, length: total }); previous = current; } return { points: table, length: total }; }
    /** Interpolate t for a target length; zero-length table returns zero. */
    function tAtLength(table, target) { var entries = table.points; var lo = 0; var hi = entries.length - 1; var mid; var span; if (!table.length) { return 0; } target = LG.util.clamp(target, 0, table.length); while (hi - lo > 1) { mid = Math.floor((lo + hi) / 2); if (entries[mid].length < target) { lo = mid; } else { hi = mid; } } span = entries[hi].length - entries[lo].length; return span ? entries[lo].t + (entries[hi].t - entries[lo].t) * (target - entries[lo].length) / span : entries[lo].t; }
    return { at: at, derivative: derivative, second: second, frame: frame, roots: roots, extrema: extrema, bounds: bounds, straight: straight, arcTable: arcTable, tAtLength: tAtLength };
}());
