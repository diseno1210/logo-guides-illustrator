/** M3 pipeline: measurements are computed even when their display switches are off. */
LG.analyze = function (geometry, settings, context) {
    var cfg=LG.config.resolve(settings);var reusable=!!context&&!!context.model&&LG.json.stringify(context.geometry)===LG.json.stringify(geometry);var key;var model;var analysis;var render;var unit;
    if(reusable){for(key in cfg){if(LG.util.has(cfg,key)&&key!=="settings"&&cfg[key]!==context.parameters[key]){reusable=false;break;}}}
    model=reusable?LG.util.clone(context.model):LG.sample.run(LG.geometry.normalize(geometry,settings));model.config=cfg;model.derived=LG.config.derive(cfg,model.S,model.D);
    if(!reusable){LG.edges.run(model);}LG.lines.detect(model); LG.stems.run(model);
    if(cfg.settings.features.circles||cfg.settings.features.ringThickness||(cfg.settings.baseUnit.mode==="auto"&&!model.stems.length)){LG.circles.run(model);}else{model.circles=[];model.rings=[];}
    unit=LG.baseunit.resolve(model); LG.ratios.run(model,unit);render = LG.layout.run(model); LG.layout.circleDisplay(model,render); LG.primitives.references(model, render);
    analysis = { version: 1, S: model.S, D: model.D, bbox: model.bbox, rows: model.rows,
        baseUnit: unit,
        lines: model.referenceLines, stems: model.stems, gaps: model.gaps, heights: model.heights, counters: model.counters, circles: model.circles, rings: model.rings, angles: [], constructionLines: [], ratioFindings: [], warnings: model.warnings };
    return { analysis: analysis, render: render };
};
/** Pre-analysis context for the generation dialog. Only normalize/sample/rows/edges may be reused. */
LG.preAnalyze=function(geometry,settings){var model=LG.sample.run(LG.geometry.normalize(geometry,settings));LG.edges.run(model);LG.lines.detect(model);LG.stems.run(model);return {candidates:LG.baseunit.resolve(model).candidates,geometry:LG.util.clone(geometry),parameters:LG.util.clone(model.config),model:model};};
