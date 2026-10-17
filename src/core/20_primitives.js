LG.primitives = (function () {
    /** Create a contract line primitive from a registered axis-aligned line. */
    function line(item) {
        return { type: "line", p0: item.orient === "h" ? [item.span[0], item.pos] : [item.pos, item.span[0]], p1: item.orient === "h" ? [item.span[1], item.pos] : [item.pos, item.span[1]], style: item.category, layer: item.category === "visual" ? "visualLines" : (item.category === "baseline" ? "baselines" : "dimensions"), featureId: item.id };
    }
    /** Construct labels using the shared data contract and measured text lines. */
    function label(pos, rotation, lines, featureId) { return { type: "label", pos: pos.slice(0), rotation: rotation, lines: LG.util.clone(lines), layer: "labels", featureId: featureId }; }
    /** Filter references only at output, then register all visible lines. */
    function references(model, render) {
        var registry = new LG.lines.LineRegistry(model.derived.tolPos);
        LG.util.each(model.referenceLines, function (item) { if (LG.lines.enabled(item, model.config.settings)) { registry.register(item.orient, item.pos, item.span, item.category, item.id); } });
        LG.util.each(render.dimensionLines||[],function(item){registry.register(item.orient,item.pos,item.span,item.category,item.id);});
        LG.util.each(registry.lines,function(item){if(item.orient==="h"&&item.category!=="dimension"){item.span=[Math.min(item.span[0],render.guideArea[0]),Math.max(item.span[1],render.guideArea[2])];}});
        render.primitives = LG.util.mapArr(registry.lines, line).concat(render.primitives); delete render.dimensionLines; return render;
    }
    /** Targets, actual-category legend, final-area clipping and optional clear-space/background. */
    function finish(model,render,unit){
        var U=LG.util;var V=LG.vec;var cfg=model.config;var s=cfg.settings;var fs=render.fontSize;var out=render.primitives;
        function segment(p0,p1,style,layer,id){out.push({type:"line",p0:p0,p1:p1,style:style,layer:layer,featureId:id});}
        function polygon(points,style,layer,id){out.push({type:"polygon",points:points,closed:true,style:style,layer:layer,featureId:id});}
        function rectangle(box,style,layer,id){polygon([[box[0],box[1]],[box[2],box[1]],[box[2],box[3]],[box[0],box[3]]],style,layer,id);}
        function deviated(m){return m.target!==null&&(m.severity==="warn"||m.severity==="bad");}
        if(s.features.targetLines){
            function ai(f){return model.aiTargets&&model.aiTargets["$"+f.id];}
            function widthTarget(stem){if(!ai(stem)&&!deviated(stem.measure)){return;}var T=LG.angles.direction(stem.angleDeg);var N=[-T[1],T[0]];var lo=Infinity;var hi=-Infinity;var offset=V.dot(stem.mid,N);U.each(stem.fragments,function(f){U.each(f.edgeA.concat(f.edgeB),function(p){var t=V.dot(p,T);lo=Math.min(lo,t);hi=Math.max(hi,t);});});if(stem.kind!=="diagonal"){lo-=0.5*fs;hi+=0.5*fs;}U.each([-1,1],function(sign){var n=offset+sign*stem.measure.target*unit.value/2;segment(V.add(V.scale(T,lo),V.scale(N,n)),V.add(V.scale(T,hi),V.scale(N,n)),"target","targets",stem.id);});}
            if(s.features.stemWidths){U.each(model.stems,widthTarget);}
            if(s.features.counters){U.each(model.counters,function(c){if(ai(c)){widthTarget(c);}});}
            if(s.features.gaps){U.each(model.gaps,function(g){if(!ai(g)&&!deviated(g.measure)){return;}var row=null;U.each(model.rows,function(r){if(r.id===g.rowId){row=r;}});var x=g.x1+g.measure.target*unit.value;segment([x,row.bbox[3]],[x,row.bbox[1]],"target","targets",g.id);});}
            U.each(model.angles,function(a){if(!ai(a)&&(a.kind!=="axis"||!deviated(a.measure))){return;}var delta=a.kind==="pair"?a.measure.target:(s.signedAxisAngles?(a.reference==="vertical"?-a.measure.target:a.measure.target):a.turnSign*a.measure.target);segment(a.center.slice(0),V.add(a.center,V.scale(LG.angles.direction(a.ray1Deg+delta),a.edgeLength)),"target","targets",a.id);});
            if(s.features.heights){U.each(model.heights,function(h){if(!ai(h)){return;}var row=null;U.each(model.rows,function(r){if(r.id===h.rowId){row=r;}});var y=h.y1+h.measure.target*unit.value;segment([row.bbox[0],y],[row.bbox[2],y],"target","targets",h.id);});}
            if(s.features.circles){U.each(model.circles,function(c){if(ai(c)){out.push({type:"circle",c:[c.cx,c.cy],r:c.measureR.target*unit.value,style:"target",layer:"targets",featureId:c.id});}});}
            if(s.features.ringThickness){U.each(model.rings,function(r){if(!ai(r)){return;}var inner=null;U.each(model.circles,function(c){if(c.id===r.innerId){inner=c;}});if(inner){out.push({type:"circle",c:[inner.cx,inner.cy],r:inner.r+r.measure.target*unit.value,style:"target",layer:"targets",featureId:r.id});}});}
        }
        if(s.features.clearSpace){var d=s.clearSpaceFactor*unit.value;var b=model.bbox;rectangle([b[0]-d,b[1]+d,b[2]+d,b[3]-d],"clearFrame","clearSpace","clearSpace");U.each([[b[0]-d,b[1]+d],[b[2],b[1]+d],[b[0]-d,b[3]],[b[2],b[3]]],function(p){rectangle([p[0],p[1],p[0]+d,p[1]-d],"clearSquare","clearSpace","clearSpace");var l=label([p[0]+d/2,p[1]-d/2],0,[{text:LG.ratios.display(s.clearSpaceFactor),sizeFactor:1,style:"text"}],"clearSpace");l.layer="clearSpace";out.push(l);});}
        // A0 includes all non-legend labels, including optional corner labels.
        var area=render.guideArea;var labelBoxes=[];U.each(out,function(p){if(p.type==="label"){var box=LG.layout.labelBounds(p,fs);labelBoxes.push(box);area=U.union(area,[box[0]-fs,box[1]+fs,box[2]+fs,box[3]-fs]);}});
        var categories={};U.each(out,function(p){if(p.style==="baseline"||p.style==="dimension"){categories.baseline=true;}if(p.style==="visual"||p.style==="circleVisual"){categories.visual=true;}if(p.style==="target"){categories.target=true;}if(p.style==="devMarker"){categories.devMarker=true;}});if(model.constructionLines.length){categories.construction=true;}
        if(s.features.legend){
            var entries=[];U.each([["baseline","Baseline","基准线"],["visual","Visual Alignment Line","视觉对齐线"],["construction","Construction Line","构造线"],["target","Target","目标线"],["devMarker","Deviation","偏差"]],function(item){if(categories[item[0]]){entries.push({style:item[0],text:s.legendLanguage==="en"?item[1]:(s.legendLanguage==="zh"?item[2]:item[1]+" "+item[2])});}});
            var width=0;U.each(entries,function(e){var box=LG.layout.labelBounds(label([0,0],0,[{text:e.text,sizeFactor:1,style:"text"}],"legend"),fs);e.width=box[2]-box[0];width=Math.max(width,5*fs+e.width);});
            var height=entries.length*1.7*fs;var legendBox=[area[0]+fs,area[3]+fs+height,area[0]+fs+width,area[3]+fs];
            function overlaps(a,b){return a[0]<b[2]&&a[2]>b[0]&&a[3]<b[1]&&a[1]>b[3];}
            var collision=overlaps(legendBox,model.bbox);U.each(labelBoxes,function(box){if(overlaps(legendBox,box)){collision=true;}});if(collision){legendBox=[area[0],area[3]-fs,area[0]+width,area[3]-fs-height];}
            U.each(entries,function(e,index){var y=legendBox[3]+(index+0.5)*1.7*fs;var x=legendBox[0];if(e.style==="devMarker"){polygon([[x+2*fs,y+0.3*fs],[x+1.7*fs,y-0.22*fs],[x+2.3*fs,y-0.22*fs]],"devMarker","legend","legend");}else{segment([x,y],[x+4*fs,y],e.style,"legend","legend");}var p=label([x+5*fs+e.width/2,y],0,[{text:e.text,sizeFactor:1,style:"text"}],"legend");p.layer="legend";out.push(p);});if(entries.length){area=U.union(area,legendBox);}
        }
        render.guideArea=area;
        // Reference lines and construction lines must use the final area including the legend.
        U.each(model.referenceLines,function(l){if(l.orient==="h"){l.span=[area[0],area[2]];}else if(l.boundary){l.span=[area[3],area[1]];}});
        U.each(out,function(p){if(p.type==="line"&&(p.layer==="baselines"||p.layer==="visualLines")){if(Math.abs(p.p0[1]-p.p1[1])<=cfg.EPS){p.p0[0]=area[0];p.p1[0]=area[2];}else if(Math.abs(p.p0[0]-model.bbox[0])<=model.derived.tolPos||Math.abs(p.p0[0]-model.bbox[2])<=model.derived.tolPos){p.p0[1]=area[3];p.p1[1]=area[1];}}});
        model.constructionLines=U.filterArr(model.constructionLines,function(c){var points=LG.angles.clip(c.p0,V.unit(V.sub(c.p1,c.p0)),area,cfg.EPS);if(!points){return false;}c.p0=points[0];c.p1=points[1];segment(c.p0,c.p1,"construction","construction",c.id);return true;});
        if(s.features.background){rectangle([area[0]-fs,area[1]+fs,area[2]+fs,area[3]-fs],"background","background","background");}
    }
    return { line: line, label: label, references: references, finish:finish };
}());
