/* M1 manual acceptance entrypoint: export the original selection as Geometry JSON. */
try {
    var dumpDocument = LG.hostEnv.documentOrThrow();
    var dumpData = LG.hostRead.selection(dumpDocument, {});
    var dumpPath = LG.hostEnv.dumpGeometry(dumpData);
    LG.hostEnv.log("DumpGeometry OK; parts=" + dumpData.parts.length + "; path=" + dumpPath);
    alert("几何数据已导出 / Geometry exported:\n" + dumpPath + "\n部件 / Parts: " + dumpData.parts.length + "\n警告 / Warnings: " + dumpData.warnings.length);
} catch (dumpError) {
    LG.hostEnv.report(dumpError);
}
