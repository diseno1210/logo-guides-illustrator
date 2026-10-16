/* ES3 utilities. Plain data, no host dependencies. */
LG.util = (function () {
    var own = Object.prototype.hasOwnProperty;
    /** Test an own key. */
    function has(obj, key) { return own.call(obj, key); }
    /** Test arrays across realms. */
    function isArray(value) { return Object.prototype.toString.call(value) === "[object Array]"; }
    /** Test finite numbers without coercion. */
    function finite(value) { return typeof value === "number" && isFinite(value); }
    /** Iterate in input order. */
    function each(items, fn) { var i; for (i = 0; i < items.length; i += 1) { fn(items[i], i); } }
    /** Map into a fresh array. */
    function mapArr(items, fn) { var out = []; each(items, function (v, i) { out.push(fn(v, i)); }); return out; }
    /** Filter into a fresh array. */
    function filterArr(items, fn) { var out = []; each(items, function (v, i) { if (fn(v, i)) { out.push(v); } }); return out; }
    /** Return index or -1, with strict equality. */
    function indexOf(items, value) { var i; for (i = 0; i < items.length; i += 1) { if (items[i] === value) { return i; } } return -1; }
    /** Clamp to inclusive range. */
    function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }
    /** Euclidean norm avoiding intermediate square overflow. */
    function hypot(x, y) { var m = Math.max(Math.abs(x), Math.abs(y)); return m === 0 ? 0 : m * Math.sqrt((x / m) * (x / m) + (y / m) * (y / m)); }
    /** ES3 whitespace trimming. */
    function trimStr(value) { return String(value).replace(/^\s+|\s+$/g, ""); }
    /** Clone JSON-like data, excluding prototype keys. */
    function clone(value) { var out; var key; if (!value || typeof value !== "object") { return value; } if (isArray(value)) { return mapArr(value, clone); } out = {}; for (key in value) { if (has(value, key) && key !== "__proto__" && key !== "constructor" && key !== "prototype") { out[key] = clone(value[key]); } } return out; }
    /** Merge known keys only; arrays replace arrays. */
    function deepMerge(base, patch) {
        var out = clone(base); var key;
        if (!patch || typeof patch !== "object" || isArray(patch)) { return out; }
        for (key in base) { if (has(base, key) && has(patch, key)) {
            if (base[key] && typeof base[key] === "object" && !isArray(base[key])) { out[key] = deepMerge(base[key], patch[key]); }
            else { out[key] = clone(patch[key]); }
        } }
        return out;
    }
    /** Median; empty input returns zero. */
    function median(values) { var a = values.slice(0).sort(function (x, y) { return x - y; }); var n = a.length; return n ? (n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2) : 0; }
    /** Union of [left,top,right,bottom] rectangles; null accepted. */
    function union(a, b) { if (!a) { return b ? b.slice(0) : null; } if (!b) { return a.slice(0); } return [Math.min(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2]), Math.min(a[3], b[3])]; }
    /** Inclusive rectangle containment. */
    function contains(box, x, y, epsilon) { var e = epsilon || 0; return !!box && x >= box[0] - e && x <= box[2] + e && y <= box[1] + e && y >= box[3] - e; }
    /** Add a structured warning once per identical code/message. */
    function warn(warnings, code, message) { var i; for (i = 0; i < warnings.length; i += 1) { if (warnings[i].code === code && warnings[i].message === message) { return; } } warnings.push({ code: code, message: message }); }
    return { has: has, isArray: isArray, finite: finite, each: each, mapArr: mapArr, filterArr: filterArr, indexOf: indexOf, clamp: clamp, hypot: hypot, trimStr: trimStr, clone: clone, deepMerge: deepMerge, median: median, union: union, contains: contains, warn: warn };
}());
