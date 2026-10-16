/* M5 default-settings Generate; full dialog and Refresh arrive in M6. */
try {
    var doc = LG.hostEnv.documentOrThrow();
    var settings = LG.config.defaults();
    var sources = LG.hostRead.sourceObjects(doc);
    var geometry = LG.hostRead.selection(doc, settings);
    var result = LG.analyze(geometry, settings);
    var data = LG.hostDraw.generate(doc, result, settings, sources);
    var lineCount=result.analysis.lines.length;
    LG.hostEnv.log("M5 Generate OK; runId=" + data.runId + "; lines=" + lineCount);
    alert("Logo Guides M5：参考线 / Reference lines generated: " + lineCount + "\na = " + result.analysis.baseUnit.value.toFixed(3) + " pt (" + result.analysis.baseUnit.source + ")\n圆 / Circles: "+result.analysis.circles.length+"\n环 / Rings: "+result.analysis.rings.length+"\n角度 / Angles: "+result.analysis.angles.length+"\n警告 / Warnings: " + result.analysis.warnings.length + "\n完整设置、刷新与清除将在M6完成。");
} catch (error) { LG.hostEnv.report(error); }
