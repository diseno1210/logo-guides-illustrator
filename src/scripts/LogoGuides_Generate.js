/* M2 temporary Generate: references only; full dialog and Refresh arrive in M6. */
try {
    var doc = LG.hostEnv.documentOrThrow();
    var settings = LG.config.defaults();
    var sources = LG.hostRead.sourceObjects(doc);
    var geometry = LG.hostRead.selection(doc, settings);
    var result = LG.analyze(geometry, settings);
    var data = LG.hostDraw.generate(doc, result, settings, sources);
    var lineCount=LG.util.filterArr(result.render.primitives,function(p){return p.type==="line";}).length;
    LG.hostEnv.log("M3 Generate OK; runId=" + data.runId + "; lines=" + lineCount);
    alert("Logo Guides M3：参考线 / Reference lines generated: " + lineCount + "\na = " + result.analysis.baseUnit.value.toFixed(3) + " pt (" + result.analysis.baseUnit.source + ")\n警告 / Warnings: " + result.analysis.warnings.length + "\n已含笔画与倍率标注；圆、角度与完整交互尚未实现。");
} catch (error) { LG.hostEnv.report(error); }
