LG.primitives = (function () {
    /** Create a contract line primitive from a registered axis-aligned line. */
    function line(item) {
        return { type: "line", p0: item.orient === "h" ? [item.span[0], item.pos] : [item.pos, item.span[0]], p1: item.orient === "h" ? [item.span[1], item.pos] : [item.pos, item.span[1]], style: item.category, layer: item.category === "visual" ? "visualLines" : (item.category === "baseline" ? "baselines" : "dimensions"), featureId: item.id };
    }
    /** Construct labels using the shared data contract; M3 supplies measurements. */
    function label(pos, rotation, lines, featureId) { return { type: "label", pos: pos.slice(0), rotation: rotation, lines: LG.util.clone(lines), layer: "labels", featureId: featureId }; }
    /** Filter references only at output, then register all visible lines. */
    function references(model, render) {
        var registry = new LG.lines.LineRegistry(model.derived.tolPos);
        LG.util.each(model.referenceLines, function (item) { if (LG.lines.enabled(item, model.config.settings)) { registry.register(item.orient, item.pos, item.span, item.category, item.id); } });
        render.primitives = LG.util.mapArr(registry.lines, line); return render;
    }
    return { line: line, label: label, references: references };
}());
