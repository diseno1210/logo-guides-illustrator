/* ExtendScript host boundary; functions defer all host access until called. */
LG.hostEnv = (function () {
    /** Return active document or a localized user-facing error. */
    function documentOrThrow() { if (app.documents.length === 0) { throw new Error("请先打开文档 / Open an Illustrator document first."); } return app.activeDocument; }
    /** Create user-data directory for dumps and logs. */
    function dataFolder() { var folder = new Folder(Folder.userData.fsName + "/LogoGuides"); if (!folder.exists && !folder.create()) { throw new Error("Cannot create LogoGuides data folder: " + folder.fsName); } return folder; }
    /** Write UTF-8 text, always closing an opened file. */
    function writeUTF8(file, contents, mode) { var opened = false; file.encoding = "UTF-8"; file.lineFeed = "Unix"; try { opened = file.open(mode || "w"); if (!opened) { throw new Error("Cannot open file: " + file.fsName + "; " + file.error); } if (!file.write(contents)) { throw new Error("Cannot write file: " + file.fsName + "; " + file.error); } } finally { if (opened) { file.close(); } } }
    /** Append log, rotating at 1MB; logging errors never mask the primary error. */
    function log(message) {
        var folder; var file; var previous; var stamp;
        try { folder = dataFolder(); file = new File(folder.fsName + "/log.txt");
            if (file.exists && file.length > 1024 * 1024) { previous = new File(folder.fsName + "/log.previous.txt"); if (previous.exists) { previous.remove(); } if (!file.rename("log.previous.txt")) { return; } file = new File(folder.fsName + "/log.txt"); }
            stamp = new Date(); writeUTF8(file, stamp.toString() + " " + message + "\n", "a");
        } catch (ignored) { /* Log unavailable; caller still receives the original error. */ }
    }
    /** Save Geometry JSON under the documented filename. */
    function dumpGeometry(geometry) { var folder = dataFolder(); var file = new File(folder.fsName + "/geometry_dump.json"); writeUTF8(file, LG.json.stringify(geometry, null, 2) + "\n", "w"); return file.fsName; }
    /** Show a concise error and write full diagnostics. */
    function report(error) { var detail = String(error.message || error); if (error.line) { detail += " (line " + error.line + ")"; } log(String(error) + "; line=" + error.line + "; stack=" + (error.stack || "")); alert(detail); }
    return { documentOrThrow: documentOrThrow, dataFolder: dataFolder, writeUTF8: writeUTF8, log: log, dumpGeometry: dumpGeometry, report: report };
}());
