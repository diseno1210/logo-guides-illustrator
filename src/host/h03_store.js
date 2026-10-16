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
        if (!value || value.schemaVersion !== 1 || typeof value.runId !== "string"||!value.baseUnit||typeof value.baseUnit.locked!=="boolean"||(value.baseUnit.value!==null&&(!LG.util.finite(value.baseUnit.value)||value.baseUnit.value<=0))||(value.baseUnit.locked&&value.baseUnit.value===null)) { throw new Error("Unsupported Logo Guides document data"); }
        return value;
    }
    /** Local timestamp (ExtendScript ES3 has no toISOString). */
    function timestamp() {
        var d = new Date(); function pad(n) { return n < 10 ? "0" + n : String(n); }
        return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
    }
    /** New document-generation id; Refresh reuses its existing id. */
    function runId() { return "lg_" + new Date().getTime().toString(36) + "_" + Math.floor(Math.random() * 1679616).toString(36); }
    /** Clear only LG_SOURCE tags, then tag the deduplicated original sources. */
    function tagSources(doc, sources, id) {
        var i; var j; var item; var tag;
        for (i = 0; i < doc.pageItems.length; i += 1) {
            item = doc.pageItems[i];
            for (j = item.tags.length - 1; j >= 0; j -= 1) { if (item.tags[j].name === "LG_SOURCE") { (function(target,tag){editable(target,function(){tag.remove();});}(item,item.tags[j])); } }
        }
        for (i = 0; i < sources.length; i += 1) { (function(target){editable(target,function(){tag=target.tags.add();tag.name="LG_SOURCE";tag.value=id;});}(sources[i])); }
    }
    /** Temporarily unlock a source and its ancestors solely while editing its tag. */
    function editable(item,fn){var locks=[];var cursor=item;var i;while(cursor&&cursor.typename!=="Document"){if(cursor.locked){locks.push(cursor);}cursor=cursor.parent;}try{for(i=locks.length-1;i>=0;i-=1){locks[i].locked=false;}return fn();}finally{for(i=0;i<locks.length;i+=1){locks[i].locked=true;}}}
    function layerLocks(doc){var result=[];function walk(parent){var i;for(i=0;i<parent.layers.length;i+=1){result.push({layer:parent.layers[i],locked:parent.layers[i].locked});walk(parent.layers[i]);}}walk(doc);return result;}
    /** Native Illustrator can throw even when comparing a removed Layer reference. */
    function sameLiveLayer(a,b){try{return a===b;}catch(invalidLayer){return false;}}
    function restoreLocks(doc,locks){var current=layerLocks(doc);var i;for(i=locks.length-1;i>=0;i-=1){(function(snapshot){var target;try{target=snapshot.layer;}catch(invalidLayer){return;}LG.util.each(current,function(item){if(sameLiveLayer(item.layer,target)){item.layer.locked=snapshot.locked;}});}(locks[i]));}}
    function restoreActiveLayer(doc,saved){var current=layerLocks(doc);var found=false;LG.util.each(current,function(item){if(sameLiveLayer(item.layer,saved)){found=true;}});if(found){doc.activeLayer=saved;return;}var i;for(i=0;i<doc.layers.length;i+=1){if(!LG.hostRead.inGuides(doc.layers[i])){doc.activeLayer=doc.layers[i];return;}}}
    /** Save contract Doc Data in the reserved hidden path. */
    function write(root, data) {
        var item = dataPath(root);
        if (!item) { item = root.pathItems.add(); item.name = "__LG_DATA__"; item.setEntirePath([[0, 0], [0, 0]]); }
        item.filled = false; item.stroked = false; item.note = LG.json.stringify(data); item.hidden = true;
    }
    /** Build contract Doc Data from the actual analyzed base unit. */
    function createData(analysis, settings) {
        var stamp = timestamp(); return { schemaVersion: 1, runId: runId(), baseUnit: { value: analysis.baseUnit.value, source: analysis.baseUnit.source, locked: analysis.baseUnit.value !== null && settings.baseUnit.locked }, hiddenFeatures: [], createdAt: stamp, updatedAt: stamp };
    }
    /** Load global settings; malformed files are actionable errors, never silently overwritten. */
    function settings(){var file=new File(LG.hostEnv.dataFolder().fsName+"/settings.json");if(!file.exists){return LG.config.defaults();}try{return LG.config.resolve(LG.json.parse(LG.hostEnv.readUTF8(file))).settings;}catch(error){throw new Error("请检查设置文件 / Check settings file: "+file.fsName+"\n"+String(error));}}
    function saveSettings(value){var resolved=LG.config.resolve(value).settings;LG.hostEnv.writeUTF8(new File(LG.hostEnv.dataFolder().fsName+"/settings.json"),LG.json.stringify(resolved,null,2)+"\n","w");return resolved;}
    /** Refresh reads matching tags across the document and ignores the current partial selection. */
    function sources(doc,id){var list=[];var i;var j;var item;for(i=0;i<doc.pageItems.length;i+=1){item=doc.pageItems[i];if(LG.hostRead.inGuides(item)){continue;}for(j=0;j<item.tags.length;j+=1){if(item.tags[j].name==="LG_SOURCE"&&item.tags[j].value===id){list.push(item);break;}}}return LG.util.filterArr(list,function(source){var p=source.parent;while(p&&p.typename!=="Document"){if(LG.util.indexOf(list,p)>=0){return false;}p=p.parent;}return true;});}
    return { layer: layer, read: read, write: write, tagSources: tagSources, createData: createData, runId:runId, timestamp:timestamp, settings:settings, saveSettings:saveSettings, sources:sources, layerLocks:layerLocks,restoreLocks:restoreLocks,restoreActiveLayer:restoreActiveLayer };
}());
