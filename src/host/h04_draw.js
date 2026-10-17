LG.hostDraw = (function () {
    var names = { labels: "LG Labels", deviation: "LG Deviation", targets: "LG Targets", angles: "LG Angles", dimensions: "LG Dimensions", circles: "LG Circles", visualLines: "LG Visual Lines", baselines: "LG Baselines", construction: "LG Construction", clearSpace: "LG Clear Space", legend: "LG Legend", snapGuides: "LG Snap Guides", manual: "LG Manual", background:"Logo Guides BG" };
    var order = ["labels", "deviation", "targets", "angles", "dimensions", "circles", "visualLines", "baselines", "construction", "clearSpace", "legend", "snapGuides"];
    /** RGB hex to Illustrator document color; simple formula for CMYK. */
    function color(hex, doc) {
        var r = parseInt(hex.substr(1, 2), 16) / 255; var g = parseInt(hex.substr(3, 2), 16) / 255; var b = parseInt(hex.substr(5, 2), 16) / 255; var k; var value;
        if (doc.documentColorSpace === DocumentColorSpace.CMYK) {
            value = new CMYKColor(); k = 1 - Math.max(r, g, b); value.black = k * 100;
            value.cyan = k >= 1 ? 0 : (1 - r - k) / (1 - k) * 100; value.magenta = k >= 1 ? 0 : (1 - g - k) / (1 - k) * 100; value.yellow = k >= 1 ? 0 : (1 - b - k) / (1 - k) * 100;
        } else { value = new RGBColor(); value.red = r * 255; value.green = g * 255; value.blue = b * 255; }
        return value;
    }
    /** Apply style values in stroke units; labels use fill. */
    function style(item, definition, unit, doc) {
        item.opacity = definition.opacity; item.filled = !!definition.fillHex; item.stroked = !!definition.stroke;
        if (definition.fillHex) { item.fillColor = color(definition.fillHex, doc); }
        if (definition.stroke) {
            item.strokeColor = color(definition.stroke, doc); item.strokeWidth = definition.width * unit;
            item.strokeDashes = LG.util.mapArr(definition.dashes, function (n) { return n * unit; }); item.strokeCap = StrokeCap.BUTTENDCAP;
        }
    }
    /** First available PostScript font, chosen by actual text content. */
    function font(text, settings) {
        var candidates = /[\u2e80-\u9fff\uf900-\ufaff]/.test(text) ? settings.cjkFontNames : settings.fontNames; var i;
        for (i = 0; i < candidates.length; i += 1) { try { return app.textFonts.getByName(candidates[i]); } catch (ignored) { /* Try next font. */ } }
        return null;
    }
    /** Per-line point text grouped, centered using actual bounds, then rotated. */
    function label(layer, primitive, render, styles, settings, doc) {
        var group = layer.groupItems.add(); var cursor = 0; var i; var line; var text; var attributes; var chosen; var bounds;
        group.name = primitive.featureId + ":label";
        for (i = 0; i < primitive.lines.length; i += 1) {
            line = primitive.lines[i]; text = group.textFrames.add(); text.contents = line.text; text.position = [0, cursor];
            attributes = text.textRange.characterAttributes; attributes.size = render.fontSize * line.sizeFactor; attributes.fillColor = color(styles[line.style].fillHex, doc);
            chosen = font(line.text, settings); if (chosen) { attributes.textFont = chosen; }
            text.opacity = styles[line.style].opacity; text.name = primitive.featureId;
            bounds = text.geometricBounds; text.translate(-(bounds[0] + bounds[2]) / 2, 0);
            cursor -= 1.2 * attributes.size;
        }
        bounds = group.geometricBounds; group.translate(primitive.pos[0] - (bounds[0] + bounds[2]) / 2, primitive.pos[1] - (bounds[1] + bounds[3]) / 2);
        if (primitive.rotation) { group.rotate(primitive.rotation, true, true, true, true, Transformation.CENTER); }
        return group;
    }
    /** Create a line/circle/arc/polygon with exact y-up Illustrator coordinates. */
    function shape(layer,p){
        var item;var i;var count;var step;var angle;var next;var handle;var points=[];
        if(p.type==="circle"){return layer.pathItems.ellipse(p.c[1]+p.r,p.c[0]-p.r,2*p.r,2*p.r);}
        item=layer.pathItems.add();
        if(p.type==="line"){item.setEntirePath([p.p0,p.p1]);}
        else if(p.type==="polygon"){item.setEntirePath(p.points);item.closed=p.closed;}
        else if(p.type==="arc"){
            count=Math.max(1,Math.ceil((p.endDeg-p.startDeg)/90));step=(p.endDeg-p.startDeg)/count*Math.PI/180;
            for(i=0;i<=count;i+=1){angle=p.startDeg*Math.PI/180+i*step;points.push([p.c[0]+p.r*Math.cos(angle),p.c[1]+p.r*Math.sin(angle)]);}item.setEntirePath(points);item.closed=false;handle=4/3*Math.tan(step/4)*p.r;
            for(i=0;i<=count;i+=1){angle=p.startDeg*Math.PI/180+i*step;next=item.pathPoints[i];next.anchor=points[i];next.leftDirection=i===0?points[i]:[points[i][0]+handle*Math.sin(angle),points[i][1]-handle*Math.cos(angle)];next.rightDirection=i===count?points[i]:[points[i][0]-handle*Math.sin(angle),points[i][1]+handle*Math.cos(angle)];}
        }else{throw new Error("Unsupported shape");}return item;
    }
    /** Render primitives and metadata; previous data selects Refresh semantics. Restore host state on error. */
    function generate(doc, result, settings, sources, previous) {
        var U = LG.util; var savedLayer = doc.activeLayer; var savedSelection = doc.selection; var root = LG.hostStore.layer(doc); var wasLocked = root ? root.locked : false;
        var completed = false; var layers = {}; var used = {}; var styles = LG.styles.resolve(settings,result.render.strokeUnit); var i; var key; var primitive; var item; var data;var bg=null;var locks=LG.hostStore.layerLocks(doc);
        // Validate supported primitives and existing metadata before deleting old automatic output.
        LG.hostStore.read(doc);
        U.each(result.render.primitives, function (p) { if (U.indexOf(["line","label","polygon","circle","arc"],p.type)<0 || !U.has(names, p.layer)) { throw new Error("Unsupported primitive"); } var guide=p.layer!=="legend"&&(p.type==="line"||p.type==="circle"||p.type==="arc");if(!guide||settings.output!=="guides"){used[p.layer] = true;} if (guide && settings.output !== "styled") { used.snapGuides = true; } });
        if (!root) { root = doc.layers.add(); root.name = "Logo Guides"; }
        try {
            root.locked = false; root.visible = true; root.zOrder(ZOrderMethod.BRINGTOFRONT);
            for (i = root.layers.length - 1; i >= 0; i -= 1) { if (root.layers[i].name !== "LG Manual") { root.layers[i].locked = false; root.layers[i].remove(); } }
            for (i = doc.layers.length - 1; i >= 0; i -= 1) { if (doc.layers[i].name === "Logo Guides BG") { doc.layers[i].locked = false; doc.layers[i].remove(); } }
            if(used.background){bg=doc.layers.add();bg.name="Logo Guides BG";bg.zOrder(ZOrderMethod.SENDTOBACK);layers.background=bg;}
            for (i = order.length - 1; i >= 0; i -= 1) { key = order[i]; if (used[key]) { layers[key] = root.layers.add(); layers[key].name = names[key]; } }
            for (i = 0; i < result.render.primitives.length; i += 1) {
                primitive = result.render.primitives[i];
                if (primitive.type === "label") { label(layers[primitive.layer], primitive, result.render, styles, settings, doc); }
                else if(primitive.type==="polygon"||primitive.layer==="legend"){item=shape(layers[primitive.layer],primitive);item.name=primitive.featureId;style(item,styles[primitive.style],result.render.strokeUnit,doc);}
                else {
                    if (settings.output !== "guides") { item = shape(layers[primitive.layer],primitive); item.name = primitive.featureId; style(item, styles[primitive.style], result.render.strokeUnit, doc); }
                    if (settings.output !== "styled") { item = shape(layers.snapGuides,primitive); item.name = primitive.featureId; item.filled = false; item.stroked = false; item.guides = true; }
                }
            }
            if(previous){data=U.clone(previous);data.updatedAt=LG.hostStore.timestamp();if(!data.baseUnit.locked){data.baseUnit={value:result.analysis.baseUnit.value,source:result.analysis.baseUnit.source,locked:false};}}
            else{data=LG.hostStore.createData(result.analysis,settings);}LG.hostStore.write(root,data);if(!previous){LG.hostStore.tagSources(doc,sources,data.runId);}completed=true;
            return data;
        } finally {
            try { if(!completed){LG.hostStore.restoreLocks(doc,locks);}root.locked = completed ? settings.lockLayer : wasLocked;if(bg){bg.locked=completed?settings.lockLayer:false;} }
            finally { try { LG.hostStore.restoreActiveLayer(doc,savedLayer); } finally { LG.hostStore.restoreSelection(doc,completed ? sources : savedSelection); } }
        }
    }
    return { generate: generate, color: color, label: label, style: style, shape:shape };
}());

LG.hostManual = (function () {
    /** Snapshot selected anchors, and sample only curves with both endpoints selected. */
    function selected(doc, settings, anchorsOnly) {
        var U=LG.util;var paths=[];var seen=[];var anchors=[];var flags={};var parts=[];var hasCurved=false;
        function visit(item){
            var children;var i;
            if(!item||item.hidden||LG.hostRead.inGuides(item)||U.indexOf(seen,item)>=0){return;}seen.push(item);
            if(item.typename==="PathItem"){paths.push(item);}
            else if(item.typename==="CompoundPathItem"||item.typename==="GroupItem"){
                children=item.typename==="CompoundPathItem"?item.pathItems:item.pageItems;
                for(i=0;i<children.length;i+=1){if(children[i].parent===item){visit(children[i]);}}
            }
        }
        var selection=doc.selection;var i;var j;
        if(selection&&selection.typename==="TextRange"){throw new Error("请按Esc退出文字编辑 / Exit text editing first.");}
        if(!selection){throw new Error("请用直接选择工具选择锚点 / Select anchors with Direct Selection.");}
        for(i=0;i<selection.length;i+=1){visit(selection[i]);}
        for(i=0;i<paths.length;i+=1){
            var points=[];var selected=[];var path=paths[i];var id="m"+i;var collection=path.pathPoints;var length=collection.length;
            for(j=0;j<length;j+=1){var p=collection[j];var a=[Number(p.anchor[0]),Number(p.anchor[1])];points.push({a:a,l:[Number(p.leftDirection[0]),Number(p.leftDirection[1])],r:[Number(p.rightDirection[0]),Number(p.rightDirection[1])]});selected.push(p.selected===PathPointSelection.ANCHORPOINT);if(selected[j]){anchors.push({p:a.slice(0)});}}
            for(j=0;j<(path.closed?length:length-1);j+=1){var next=(j+1)%length;if(selected[j]&&selected[next]&&(LG.vec.distance(points[j].a,points[j].r)>1e-6||LG.vec.distance(points[next].a,points[next].l)>1e-6)){hasCurved=true;}}
            flags[id]=selected;parts.push({id:id,sourceIndex:i,kind:"path",filled:!!path.filled,stroked:!!path.stroked,strokeWidth:Number(path.strokeWidth)||0,contours:[{id:id+"c0",closed:!!path.closed,points:points}]});
        }
        var samples=anchors.slice(0);
        if(!anchorsOnly&&anchors.length>=3&&hasCurved){
            var board=doc.artboards[doc.artboards.getActiveArtboardIndex()].artboardRect;
            var model=LG.sample.run(LG.geometry.normalize({version:1,units:"pt",colorSpace:"RGB",artboard:[board[0],board[1],board[2],board[3]],parts:parts,warnings:[]},settings));
            U.each(model.parts,function(part){U.each(part.contours,function(c){U.each(c.segments,function(segment){var f=flags[part.id];var n=segment.sourceSegmentIndex;if(f[n]&&f[(n+1)%f.length]){samples=samples.concat(segment.samples);}});});});
        }
        return {anchors:anchors,samples:samples};
    }
    /** Add manual primitives without replacing automatic output or document/source data. */
    function draw(doc, primitives, settings, fs, unit){
        var savedLayer=doc.activeLayer;var savedSelection=doc.selection;var root=LG.hostStore.layer(doc);var locked=root?root.locked:settings.lockLayer;var manual=null;var manualLocked=false;var i;var pointSelections=[];var seen=[];
        function snapshot(item){if(!item||LG.util.indexOf(seen,item)>=0){return;}seen.push(item);var j;var children;if(item.typename==="PathItem"){var collection=item.pathPoints;var length=collection.length;for(j=0;j<length;j+=1){pointSelections.push({point:collection[j],selected:collection[j].selected});}}else if(item.typename==="GroupItem"||item.typename==="CompoundPathItem"){children=item.typename==="GroupItem"?item.pageItems:item.pathItems;for(j=0;j<children.length;j+=1){snapshot(children[j]);}}}
        for(i=0;savedSelection&&i<savedSelection.length;i+=1){snapshot(savedSelection[i]);}
        if(!root){root=doc.layers.add();root.name="Logo Guides";}
        try{
            root.locked=false;
            for(i=0;i<root.layers.length;i+=1){if(root.layers[i].name==="LG Manual"){manual=root.layers[i];break;}}
            if(!manual){manual=root.layers.add();manual.name="LG Manual";}manualLocked=manual.locked;manual.locked=false;
            var styles=LG.styles.resolve(settings,unit);
            for(i=0;i<primitives.length;i+=1){var p=primitives[i];if(p.type==="label"){LG.hostDraw.label(manual,p,{fontSize:fs},styles,settings,doc);}else{var item=LG.hostDraw.shape(manual,p);item.name=p.featureId;LG.hostDraw.style(item,styles[p.style],unit,doc);}}
        }finally{try{if(manual){manual.locked=manualLocked;}}finally{try{root.locked=locked;}finally{try{doc.activeLayer=savedLayer;}finally{doc.selection=savedSelection;LG.util.each(pointSelections,function(p){if(p.selected!==undefined){p.point.selected=p.selected;}});}}}}
    }
    /** Fit chosen points and their shared curve samples; report anchor-only maximum error. */
    function circle(doc, settings){
        var chosen=selected(doc,settings);if(chosen.anchors.length<3){throw new Error("请选中至少 3 个锚点 / Select at least 3 anchors.");}
        var c=LG.circles.fit(chosen.samples);if(!c){throw new Error("锚点共线，无法拟合圆 / Selected anchors are collinear.");}
        var data=LG.hostStore.read(doc);var a=data&&data.baseUnit&&data.baseUnit.value;var maxErr=0;
        LG.util.each(chosen.anchors,function(p){maxErr=Math.max(maxErr,Math.abs(LG.vec.distance(p.p,[c.cx,c.cy])-c.r));});
        var cfg=LG.config.resolve(settings);var fs=settings.fontSize||LG.util.clamp(cfg.fontSizeRel*2*c.r,6,36);var id="manual_"+LG.hostStore.runId();
        var text="R "+(a>0?LG.ratios.measure(c.r,a,cfg).display:LG.ratios.number(c.r,2)+"pt");
        draw(doc,[{type:"circle",c:[c.cx,c.cy],r:c.r,style:"circleFitted",featureId:id},LG.primitives.label([c.cx+(c.r+fs)/Math.sqrt(2),c.cy+(c.r+fs)/Math.sqrt(2)],0,[{text:text,sizeFactor:1,style:"text"},{text:(settings.uiLanguage==="en"?"Selected anchors max error: ":"选中点最大偏差：")+LG.ratios.number(maxErr,2)+"pt",sizeFactor:0.75,style:"textWarn"}],id)],settings,fs,LG.util.clamp(cfg.strokeUnitRel*2*c.r,0.25,2));
        return {circle:c,maxAnchorError:maxErr,anchorCount:chosen.anchors.length,sampleCount:chosen.samples.length};
    }
    return {selected:selected,draw:draw,circle:circle};
}());
