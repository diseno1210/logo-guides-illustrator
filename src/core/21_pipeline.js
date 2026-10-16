/** M2 partial pipeline. Empty future feature arrays report no implemented analysis. */
LG.analyze = function (geometry, settings) {
    var model = LG.sample.run(LG.geometry.normalize(geometry, settings)); var analysis; var render; var unit = model.config.settings.baseUnit;
    LG.edges.run(model); LG.lines.detect(model); render = LG.layout.references(model); LG.primitives.references(model, render);
    analysis = { version: 1, S: model.S, D: model.D, bbox: model.bbox, rows: model.rows,
        baseUnit: { value: unit.mode === "value" ? unit.value : null, source: unit.mode === "value" ? "manual" : null, candidates: [] },
        lines: model.referenceLines, stems: [], gaps: [], heights: [], counters: [], circles: [], rings: [], angles: [], constructionLines: [], ratioFindings: [], warnings: model.warnings };
    return { analysis: analysis, render: render };
};
