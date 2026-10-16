LG.vec = (function () {
    /** Vector addition. */
    function add(a, b) { return [a[0] + b[0], a[1] + b[1]]; }
    /** Vector subtraction. */
    function sub(a, b) { return [a[0] - b[0], a[1] - b[1]]; }
    /** Vector scaling. */
    function scale(a, k) { return [a[0] * k, a[1] * k]; }
    /** Dot product. */
    function dot(a, b) { return a[0] * b[0] + a[1] * b[1]; }
    /** Signed 2D cross product. */
    function cross(a, b) { return a[0] * b[1] - a[1] * b[0]; }
    /** Vector length. */
    function length(a) { return LG.util.hypot(a[0], a[1]); }
    /** Point distance. */
    function distance(a, b) { return length(sub(a, b)); }
    /** Unit vector, or [0,0] when zero. */
    function unit(a) { var n = length(a); return n ? scale(a, 1 / n) : [0, 0]; }
    /** Linear interpolation. */
    function lerp(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
    /** Infinite-line projection and distance, or null for a zero chord. */
    function project(p, a, b) { var d = sub(b, a); var n = length(d); var q; if (!n) { return null; } q = sub(p, a); return { t: dot(q, scale(d, 1 / n)) / n, distance: Math.abs(cross(q, scale(d, 1 / n))) }; }
    return { add: add, sub: sub, scale: scale, dot: dot, cross: cross, length: length, distance: distance, unit: unit, lerp: lerp, project: project };
}());
