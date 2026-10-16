LG.hostStore = (function () {
    /** Find the reserved top-level layer without relying on collection named lookup. */
    function layer(doc) { var i; for (i = 0; i < doc.layers.length; i += 1) { if (doc.layers[i].name === "Logo Guides") { return doc.layers[i]; } } return null; }
    /** Find direct hidden data path. Never search user's artwork. */
    function dataPath(root) { var i; if (!root) { return null; } for (i = 0; i < root.pathItems.length; i += 1) { if (root.pathItems[i].parent === root && root.pathItems[i].name === "__LG_DATA__") { return root.pathItems[i]; } } return null; }
    /** Read document data before making drawing mutations. */
    function read(doc) {
        var item = dataPath(layer(doc)); var value;
        if (!item) { return null; }
        try { value = LG.json.parse(item.note); } catch (error) { throw new Error("Invalid Logo Guides document data: " + String(error)); }
        if (!value || value.schemaVersion !== 1 || typeof value.runId !== "string") { throw new Error("Unsupported Logo Guides document data"); }
        return value;
    }
    /** Local timestamp (ExtendScript ES3 has no toISOString). */
    function timestamp() {
        var d = new Date(); function pad(n) { return n < 10 ? "0" + n : String(n); }
        return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
    }
    /** New generation id; only Generate calls this, future Refresh reuses it. */
    function runId() { return "lg_" + new Date().getTime().toString(36) + "_" + Math.floor(Math.random() * 1679616).toString(36); }
    /** Clear only LG_SOURCE tags, then tag the deduplicated original sources. */
    function tagSources(doc, sources, id) {
        var i; var j; var item; var tag;
        for (i = 0; i < doc.pageItems.length; i += 1) {
            item = doc.pageItems[i];
            for (j = item.tags.length - 1; j >= 0; j -= 1) { if (item.tags[j].name === "LG_SOURCE") { item.tags[j].remove(); } }
        }
        for (i = 0; i < sources.length; i += 1) { tag = sources[i].tags.add(); tag.name = "LG_SOURCE"; tag.value = id; }
    }
    /** Save contract Doc Data in the reserved hidden path. */
    function write(root, data) {
        var item = dataPath(root);
        if (!item) { item = root.pathItems.add(); item.name = "__LG_DATA__"; item.setEntirePath([[0, 0], [0, 0]]); }
        item.filled = false; item.stroked = false; item.note = LG.json.stringify(data); item.hidden = true;
    }
    /** Build document data without inventing an auto base unit before M3. */
    function createData(analysis, settings) {
        var stamp = timestamp(); return { schemaVersion: 1, runId: runId(), baseUnit: { value: analysis.baseUnit.value, source: analysis.baseUnit.source, locked: analysis.baseUnit.value !== null && settings.baseUnit.locked }, hiddenFeatures: [], createdAt: stamp, updatedAt: stamp };
    }
    return { layer: layer, read: read, write: write, tagSources: tagSources, createData: createData };
}());
