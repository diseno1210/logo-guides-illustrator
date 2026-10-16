LG.hostDraw = (function () {
    var names = { labels: "LG Labels", deviation: "LG Deviation", targets: "LG Targets", angles: "LG Angles", dimensions: "LG Dimensions", circles: "LG Circles", visualLines: "LG Visual Lines", baselines: "LG Baselines", construction: "LG Construction", clearSpace: "LG Clear Space", legend: "LG Legend", snapGuides: "LG Snap Guides", manual: "LG Manual" };
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
    /** Render M2 line/label primitives and metadata; restore source selection/layer even on error. */
    function generate(doc, result, settings, sources) {
        var U = LG.util; var savedLayer = doc.activeLayer; var savedSelection = doc.selection; var root = LG.hostStore.layer(doc); var wasLocked = root ? root.locked : false;
        var completed = false; var layers = {}; var used = {}; var styles = LG.styles.preset(settings.stylePreset); var i; var key; var primitive; var item; var data;
        // Validate supported primitives and existing metadata before deleting old automatic output.
        LG.hostStore.read(doc);
        U.each(result.render.primitives, function (p) { if (U.indexOf(["line","label","polygon","circle","arc"],p.type)<0 || !U.has(names, p.layer)) { throw new Error("Unsupported primitive"); } var guide=p.type==="line"||p.type==="circle"||p.type==="arc";if(!guide||settings.output!=="guides"){used[p.layer] = true;} if (guide && settings.output !== "styled") { used.snapGuides = true; } });
        if (!root) { root = doc.layers.add(); root.name = "Logo Guides"; }
        try {
            root.locked = false; root.visible = true; root.zOrder(ZOrderMethod.BRINGTOFRONT);
            for (i = root.layers.length - 1; i >= 0; i -= 1) { if (root.layers[i].name !== "LG Manual") { root.layers[i].locked = false; root.layers[i].remove(); } }
            for (i = doc.layers.length - 1; i >= 0; i -= 1) { if (doc.layers[i].name === "Logo Guides BG") { doc.layers[i].locked = false; doc.layers[i].remove(); } }
            for (i = order.length - 1; i >= 0; i -= 1) { key = order[i]; if (used[key]) { layers[key] = root.layers.add(); layers[key].name = names[key]; } }
            for (i = 0; i < result.render.primitives.length; i += 1) {
                primitive = result.render.primitives[i];
                if (primitive.type === "label") { label(layers[primitive.layer], primitive, result.render, styles, settings, doc); }
                else if(primitive.type==="polygon"){item=shape(layers[primitive.layer],primitive);item.name=primitive.featureId;style(item,styles[primitive.style],result.render.strokeUnit,doc);}
                else {
                    if (settings.output !== "guides") { item = shape(layers[primitive.layer],primitive); item.name = primitive.featureId; style(item, styles[primitive.style], result.render.strokeUnit, doc); }
                    if (settings.output !== "styled") { item = shape(layers.snapGuides,primitive); item.name = primitive.featureId; item.filled = false; item.stroked = false; item.guides = true; }
                }
            }
            data = LG.hostStore.createData(result.analysis, settings); LG.hostStore.write(root, data); LG.hostStore.tagSources(doc, sources, data.runId); completed = true;
            return data;
        } finally {
            try { root.locked = completed ? settings.lockLayer : wasLocked; }
            finally { try { doc.activeLayer = savedLayer; } finally { doc.selection = completed ? sources : savedSelection; } }
        }
    }
    return { generate: generate, color: color, label: label, style: style, shape:shape };
}());
