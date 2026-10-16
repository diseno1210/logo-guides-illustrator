LG.cluster = (function () {
    /** Sorted mean-based clustering. Members are indices into the original input. */
    function cluster1D(values, weights, tolerance, relative) {
        var order = []; var result = []; var i; var current; var value; var weight; var delta;
        for (i = 0; i < values.length; i += 1) {
            if (!LG.util.finite(values[i]) || (weights && (!LG.util.finite(weights[i]) || weights[i] < 0))) { throw new Error("Invalid cluster evidence"); }
            order.push(i);
        }
        order.sort(function (a, b) { return values[a] - values[b] || a - b; });
        for (i = 0; i < order.length; i += 1) {
            value = values[order[i]]; weight = weights ? weights[order[i]] : 0;
            delta = current ? Math.abs(value - current.pos) : Infinity;
            if (relative && current) { delta = Math.abs(current.pos) > 1e-9 ? delta / Math.abs(current.pos) : (delta <= 1e-9 ? 0 : Infinity); }
            if (!current || delta > tolerance) { current = { pos: value, members: [], weight: 0, sum: 0, weightedSum: 0 }; result.push(current); }
            current.members.push(order[i]); current.weight += weight; current.sum += value; current.weightedSum += value * weight;
            current.pos = current.weight > 0 ? current.weightedSum / current.weight : current.sum / current.members.length;
        }
        return result;
    }
    /** Unoriented directions, period 180 degrees, including a wraparound merge. */
    function circular(values, weights, tolerance) {
        var normalized = LG.util.mapArr(values, function (v) { return (v % 180 + 180) % 180; });
        var groups = cluster1D(normalized, weights, tolerance, false); var first; var last; var count; var weight;
        if (groups.length > 1) {
            first = groups[0]; last = groups[groups.length - 1];
            if (first.pos + 180 - last.pos <= tolerance) {
                count = first.members.length + last.members.length; weight = first.weight + last.weight;
                first.pos = weight > 0 ? (first.weightedSum + last.weightedSum - 180 * last.weight) / weight : (first.sum + last.sum - 180 * last.members.length) / count;
                first.pos = (first.pos % 180 + 180) % 180; first.members = last.members.concat(first.members); first.weight = weight;
                first.sum += last.sum; first.weightedSum += last.weightedSum; groups.pop();
            }
        }
        return groups;
    }
    return { cluster1D: cluster1D, circular: circular };
}());
