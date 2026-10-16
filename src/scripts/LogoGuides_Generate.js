/* M2 temporary Generate: references only; full dialog and Refresh arrive in M6. */
try {
    var doc = LG.hostEnv.documentOrThrow();
    var settings = LG.config.defaults();
    var sources = LG.hostRead.sourceObjects(doc);
    var geometry = LG.hostRead.selection(doc, settings);
    var result = LG.analyze(geometry, settings);
    var data = LG.hostDraw.generate(doc, result, settings, sources);
    LG.hostEnv.log("M2 Generate OK; runId=" + data.runId + "; lines=" + result.render.primitives.length);
    alert("Logo Guides M2：已生成参考线 / Reference lines generated: " + result.render.primitives.length + "\n警告 / Warnings: " + result.analysis.warnings.length + "\n当前仅参考线；笔画、倍率、圆与完整交互尚未实现。");
} catch (error) { LG.hostEnv.report(error); }
