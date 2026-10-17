LG.layout = (function () {
    /** Guide area and reference spans, including measured lane extents. */
    function references(model, areaOverride, rowExtents) {
        var U = LG.util; var settings = model.config.settings; var fs = model.derived.fs; var m = settings.marginFactor * model.D;
        var b = model.bbox; var area = settings.extendTo === "artboard" ? model.artboard.slice(0) : [b[0] - m, b[1] + m, b[2] + m, b[3] - m];
        if (areaOverride) { area = areaOverride; }
        U.each(area, function (n) { if (!U.finite(n)) { throw new Error("Guide area exceeds finite coordinate range"); } });
        U.each(model.referenceLines, function (line) {
            var top = -Infinity; var bottom = Infinity;
            if (line.orient === "h") { line.span = [area[0], area[2]]; }
            else if (line.boundary) { line.span = [area[3], area[1]]; }
            else {
                U.each(model.rows, function (row) {
                    var supports = false;
                    U.each(line.support.partIds, function (id) { if (U.indexOf(row.partIds, id) >= 0) { supports = true; } });
                    if (supports) { top = Math.max(top, (rowExtents && rowExtents[row.id] ? rowExtents[row.id].top : row.bbox[1]) + fs); bottom = Math.min(bottom, (rowExtents && rowExtents[row.id] ? rowExtents[row.id].bottom : row.bbox[3]) - fs); }
                });
                line.span = U.finite(top) && U.finite(bottom) ? [bottom, top] : [b[3] - fs, b[1] + fs];
            }
        });
        return { fontSize: fs, strokeUnit: model.derived.u, guideArea: area, primitives: [] };
    }
    /** Unrotated label bounds estimate in the core's y-up coordinates. */
    function labelBounds(label, fontSize) {
        var width = 0; var height = 0; var U = LG.util;
        U.each(label.lines, function (line) {
            var size = fontSize * line.sizeFactor; var sum = 0; var i; var c; var code;
            for (i = 0; i < line.text.length; i += 1) {
                c = line.text.charAt(i); code = line.text.charCodeAt(i);
                sum += c >= "0" && c <= "9" ? 0.56 : (c === "." || c === " " ? 0.28 : (c === "a" ? 0.55 : (c === "°" ? 0.40 : (c === "+" || c === "-" ? 0.58 : ((code >= 0x2e80 && code<=0x9fff)||(code>=0xf900&&code<=0xfaff) ? 1 : 0.6)))));
            }
            width = Math.max(width, size * sum); height += 1.2 * size;
        });
        var angle = label.rotation * Math.PI / 180; var w = Math.abs(Math.cos(angle))*width+Math.abs(Math.sin(angle))*height; var h = Math.abs(Math.sin(angle))*width+Math.abs(Math.cos(angle))*height;
        return [label.pos[0]-w/2,label.pos[1]+h/2,label.pos[0]+w/2,label.pos[1]-h/2];
    }
    /** Lay out dimensions with greedy lanes, square modules and registered extension lines. */
    function run(model) {
        var U=LG.util;var V=LG.vec;var cfg=model.config;var s=cfg.settings;var fs=model.derived.fs;var base=references(model);var area=base.guideArea;var groups={};var records=[];var extras=[];var extents={};var guides=[];
        U.each(model.rows,function(row){extents[row.id]={top:row.bbox[1],bottom:row.bbox[3]};});
        function rowFor(id){var found=null;U.each(model.rows,function(row){if(row.id===id){found=row;}});return found;}
        function addLane(feature,rowId,side,x1,x2){
            var label=LG.primitives.label([0,0],0,LG.ratios.labelLines(feature.measure,cfg),feature.id);var box=labelBounds(label,fs);var width=box[2]-box[0];var height=box[1]-box[3];var key=(side==="right"?"all":rowId)+":"+side;
            if(side!=="right"&&width>0.9*Math.abs(x2-x1)){label.rotation=-90;box=labelBounds(label,fs);width=box[2]-box[0];height=box[1]-box[3];}
            var record={label:label,rowId:rowId,side:side,x1:Math.min(x1,x2),x2:Math.max(x1,x2),center:(x1+x2)/2,width:width,height:height,lane:0};
            if(!U.has(groups,key)){groups[key]=[];}groups[key].push(record);records.push(record);
        }
        function square(stem){
            var angle=stem.angleDeg>90?stem.angleDeg-180:stem.angleDeg;var T=[Math.cos(angle*Math.PI/180),Math.sin(angle*Math.PI/180)];var N=[-T[1],T[0]];var half=stem.width/2;
            var points=U.mapArr([[-1,-1],[1,-1],[1,1],[-1,1]],function(sign){return V.add(stem.mid,V.add(V.scale(T,sign[0]*half),V.scale(N,sign[1]*half)));});
            extras.push({type:"polygon",points:points,closed:true,style:"moduleSquare",layer:"dimensions",featureId:stem.id});
            var size=Math.min(fs,0.5*stem.width);var outside=size<4;var label=LG.primitives.label(outside?V.add(stem.mid,V.scale(N,0.8*fs)):stem.mid,angle,LG.ratios.labelLines(stem.measure,cfg),stem.id);
            if(!outside){U.each(label.lines,function(line){line.sizeFactor*=size/fs;});}extras.push(label);
        }
        U.each(model.stems.concat(model.counters),function(stem){
            var counter=stem.kind==="counter";if(counter?!s.features.counters:!s.features.stemWidths){return;}
            var kind=counter?(Math.abs(stem.angleDeg-90)<=cfg.axisAngleTol?"vertical":"horizontal"):stem.kind;var row=rowFor(stem.rowId);
            if(kind==="diagonal"||(!counter&&s.stemLabelStyle==="squares")){square(stem);}
            else if(kind==="vertical"){addLane(stem,stem.rowId,model.rows.length>=2&&row===model.rows[model.rows.length-1]?"bottom":"top",(stem.edgeA[0][0]+stem.edgeA[1][0])/2,(stem.edgeB[0][0]+stem.edgeB[1][0])/2);}
            else{addLane(stem,stem.rowId,"right",(stem.edgeA[0][1]+stem.edgeA[1][1])/2,(stem.edgeB[0][1]+stem.edgeB[1][1])/2);}
        });
        if(s.features.gaps){U.each(model.gaps,function(g){addLane(g,g.rowId,model.rows.length>=2&&g.rowId===model.rows[model.rows.length-1].id?"bottom":"top",g.x1,g.x2);});}
        if(s.features.heights){U.each(model.heights,function(h){addLane(h,h.rowId,"right",h.y1,h.y2);});}
        var key;
        for(key in groups){if(U.has(groups,key)){
            var list=groups[key];var lanes=[];var first=list[0];var row=rowFor(first.rowId);var side=first.side;var seen={};
            list.sort(function(a,b){return side==="right"?b.center-a.center:a.center-b.center;});
            U.each(list,function(r){
                var text=r.rowId+":"+U.mapArr(r.label.lines,function(line){return line.text;}).join("\n");var previous=U.has(seen,"$"+text)?seen["$"+text]:null;
                if(s.labelDedup&&previous){r.alias=previous;return;}seen["$"+text]=r;
                var half=(side==="right"?r.height:r.width)/2;var low=r.center-half;var high=r.center+half;var lane=0;var fits=false;
                for(lane=0;lane<lanes.length;lane+=1){fits=true;U.each(lanes[lane].items,function(other){if(low<other.high+0.3*fs&&high>other.low-0.3*fs){fits=false;}});if(fits){break;}}
                if(lane>=cfg.maxLanes){lane=cfg.maxLanes-1;U.warn(model.warnings,"LABEL_LANES_FULL","Label lane limit reached; last lane may overlap.");}
                if(!lanes[lane]){lanes[lane]={items:[],size:0,offset:0};}r.lane=lane;lanes[lane].items.push({low:low,high:high});lanes[lane].size=Math.max(lanes[lane].size,side==="right"?r.width:r.height);
            });
            var offset=1.5*fs;U.each(lanes,function(lane){lane.offset=offset;offset+=lane.size+0.5*fs;});
            U.each(list,function(r){row=rowFor(r.rowId);var source=r.alias||r;var lane=lanes[source.lane];var outer=lane.offset+lane.size;var center=lane.offset+lane.size/2;r.outer=outer;
                r.label.pos=side==="right"?[model.bbox[2]+center,r.center]:[r.center,side==="top"?row.bbox[1]+center:row.bbox[3]-center];
                if(!r.alias){extras.push(r.label);}if(side==="top"){extents[row.id].top=Math.max(extents[row.id].top,row.bbox[1]+outer);}else if(side==="bottom"){extents[row.id].bottom=Math.min(extents[row.id].bottom,row.bbox[3]-outer);}
                U.each([r.x1,r.x2],function(pos){guides.push({orient:side==="right"?"h":"v",pos:pos,span:side==="right"?[row.bbox[0]-0.5*fs,model.bbox[2]+outer+0.5*fs]:(side==="top"?[row.bbox[3]-0.5*fs,row.bbox[1]+outer+0.5*fs]:[row.bbox[3]-outer-0.5*fs,row.bbox[1]+0.5*fs]),category:"dimension",id:r.label.featureId});});
            });
        }}
        U.each(extras,function(p){if(p.type==="label"){var b=labelBounds(p,fs);area=U.union(area,[b[0]-fs,b[1]+fs,b[2]+fs,b[3]-fs]);}});
        if(s.features.ringThickness){U.each(model.rings||[],function(ring){var outer=null;var inner=null;U.each(model.circles,function(c){if(c.id===ring.outerId){outer=c;}if(c.id===ring.innerId){inner=c;}});if(!outer||!inner){return;}var angle=ring.angleDeg*Math.PI/180;var T=[Math.cos(angle),Math.sin(angle)];extras.push({type:"line",p0:V.add([inner.cx,inner.cy],V.scale(T,inner.r)),p1:V.add([outer.cx,outer.cy],V.scale(T,outer.r)),style:"measureBar",layer:"dimensions",featureId:ring.id});extras.push(LG.primitives.label(V.add([outer.cx,outer.cy],V.scale(T,outer.r+0.8*fs)),0,LG.ratios.labelLines(ring.measure,cfg),ring.id));});}
        if(s.features.circles){U.each(model.circles||[],function(c){
            extras.push({type:"circle",c:[c.cx,c.cy],r:c.r,style:c.category==="visual"?"circleVisual":"circleFitted",layer:"circles",featureId:c.id});
            var aiRadius=model.aiTargets&&model.aiTargets["$"+c.id];if(s.circleLabels||aiRadius){var radiusLines=aiRadius||s.measurementLabelMode==="measured"?LG.ratios.labelLines(c.measureR,cfg):[{text:LG.ratios.valueText(Math.round(c.measureR.ratio/s.labelPrecision)*s.labelPrecision,false,cfg),sizeFactor:1,style:"text"}];radiusLines[0].text="R "+radiusLines[0].text;extras.push(LG.primitives.label([c.cx+(c.r+0.8*fs)/Math.sqrt(2),c.cy+(c.r+0.8*fs)/Math.sqrt(2)],0,radiusLines,c.id));}
            if(s.measurementLabelMode!=="measured"&&s.features.deviationMarkers&&Math.abs(c.maxErrSigned)>Math.max(cfg.devOk*c.r,0.1)){
                var radial=V.unit(V.sub(c.maxErrPoint,[c.cx,c.cy]));var direction=V.scale(radial,c.maxErrSigned>0?-1:1);var N=[-direction[1],direction[0]];var tip=c.maxErrPoint;var back=V.sub(tip,V.scale(direction,0.6*fs*Math.sqrt(3)/2));
                extras.push({type:"polygon",points:[tip,V.add(back,V.scale(N,0.3*fs)),V.sub(back,V.scale(N,0.3*fs))],closed:true,style:"devMarker",layer:"deviation",featureId:c.id});extras.push(LG.primitives.label(V.add(c.maxErrPoint,V.scale(radial,fs)),0,[{text:c.id+" "+(c.maxErrSigned>=0?"+":"")+LG.ratios.number(c.maxErrSigned,s.labelDecimals)+"pt",sizeFactor:0.75,style:"textWarn"}],c.id));
            }
        });}
        U.each(model.angles||[],function(a){
            var delta=(a.ray2Deg-a.ray1Deg+540)%360-180;var start=a.kind==="pair"?a.ray1Deg:Math.min(a.ray1Deg,a.ray1Deg+delta);var end=a.kind==="pair"?a.ray2Deg:Math.max(a.ray1Deg,a.ray1Deg+delta);var ra=model.derived.ra;
            extras.push({type:"arc",c:a.center.slice(0),r:ra,startDeg:start,endDeg:end,style:"angleArc",layer:"angles",featureId:a.id});
            if(a.kind==="axis"){extras.push({type:"line",p0:a.center.slice(0),p1:V.add(a.center,V.scale(LG.angles.direction(a.ray1Deg),2*ra)),style:"angleRef",layer:"angles",featureId:a.id});}
            extras.push(LG.primitives.label(V.add(a.center,V.scale(LG.angles.direction((start+end)/2),ra+0.9*fs)),0,LG.ratios.labelLines(a.measure,cfg),a.id));
        });
        U.each(extras,function(p){if(p.type==="label"){var box=labelBounds(p,fs);area=U.union(area,[box[0]-fs,box[1]+fs,box[2]+fs,box[3]-fs]);}});
        var render=references(model,area,extents);render.primitives=extras;render.dimensionLines=guides;return render;
    }
    /** Resolve full-circle fallback only after every label and the legend set the final area. */
    function circleDisplay(model,render){
        var area=render.guideArea;var width=area[2]-area[0];var height=area[1]-area[3];var s=model.config.settings;var U=LG.util;
        U.each(render.primitives,function(p){
            if((p.layer!=="circles"&&p.layer!=="targets")||p.type!=="circle"){return;}
            var c=null;var id=p.featureId;
            if(p.layer==="targets"){U.each(model.rings||[],function(r){if(r.id===id){id=r.outerId;}});}
            U.each(model.circles,function(item){if(item.id===id){c=item;}});if(!c){return;}
            var mode=s.circleDisplay;
            if(mode==="full"&&(p.c[0]-p.r<area[0]-width/2||p.c[0]+p.r>area[2]+width/2||p.c[1]+p.r>area[1]+height/2||p.c[1]-p.r<area[3]-height/2)){mode="extended";}
            if(mode!=="full"){var start=c.arcStartDeg-(mode==="extended"?s.circleExtendDeg:0);var end=c.arcEndDeg+(mode==="extended"?s.circleExtendDeg:0);if(end-start<360){p.type="arc";p.startDeg=start;p.endDeg=end;}}
        });
    }
    /** Resolve labels from all measurement families together, retaining feature IDs.
     * Bounds deliberately include padding for native font-metric differences. */
    function avoid(model,render){
        if(!model.config.settings.avoidLabelOverlap){return;}
        var U=LG.util;var fs=render.fontSize;var placed=[];var circles=[];var leaders=[];var pad=0.25*fs;
        U.each(render.primitives,function(p){if(p.type==="circle"||p.type==="arc"){circles.push(p);}});
        function intersects(a,b){return a[0]<b[2]+pad&&a[2]>b[0]-pad&&a[3]<b[1]+pad&&a[1]>b[3]-pad;}
        function hits(box){var i;for(i=0;i<placed.length;i+=1){if(intersects(box,placed[i])){return true;}}return false;}
        function curveHits(box){var n=0;var i;var c;var dx;var dy;var farX;var farY;for(i=0;i<circles.length;i+=1){c=circles[i];dx=Math.max(box[0]-c.c[0],0,c.c[0]-box[2]);dy=Math.max(box[3]-c.c[1],0,c.c[1]-box[1]);farX=Math.max(Math.abs(box[0]-c.c[0]),Math.abs(box[2]-c.c[0]));farY=Math.max(Math.abs(box[3]-c.c[1]),Math.abs(box[1]-c.c[1]));if(dx*dx+dy*dy<=(c.r+pad)*(c.r+pad)&&farX*farX+farY*farY>=(c.r-pad)*(c.r-pad)){n+=1;}}return n;}
        U.each(render.primitives,function(p){
            if(p.type!=="label"||p.layer!=="labels"){return;}
            var original=p.pos.slice(0);var box=labelBounds(p,fs);var collision=hits(box);var score=curveHits(box);var best=collision?null:original;var bestScore=collision?Infinity:score;var i;var radius;var angle;var next;var b;
            if(collision||score){
                // Bounded local search avoids nearby circular guides without moving
                // already clear labels or discarding distinct reported deviations.
                for(i=0;i<48;i+=1){radius=(1+Math.floor(i/8))*1.5*fs;angle=(i%8)*Math.PI/4;next=[original[0]+radius*Math.cos(angle),original[1]+radius*Math.sin(angle)];p.pos=next;b=labelBounds(p,fs);if(hits(b)){continue;}var candidate=curveHits(b)+0.02*radius/fs;if(candidate<bestScore){best=next;bestScore=candidate;}if(candidate<1){break;}}
                // If all local lanes are full, put a callout outside the logo.
                // Search is finite and deterministic; do not silently drop a value.
                if(!best){for(i=0;i<=placed.length;i+=1){p.pos=[render.guideArea[2]+4*fs,model.bbox[1]+(i+2)*2*fs];b=labelBounds(p,fs);if(!hits(b)){best=p.pos.slice(0);break;}}}
                p.pos=best||original;
                if(!best){U.warn(model.warnings,"LABEL_AVOIDANCE_LIMIT","Could not find a clear label position; reduce the font size or hide diagnostic features.");}
                if(Math.abs(p.pos[0]-original[0])+Math.abs(p.pos[1]-original[1])>model.config.EPS){
                    b=labelBounds(p,fs);var dx=original[0]-p.pos[0];var dy=original[1]-p.pos[1];var w=(b[2]-b[0])/2+0.1*fs;var h=(b[1]-b[3])/2+0.1*fs;var scale=1/Math.max(Math.abs(dx)/w,Math.abs(dy)/h);
                    leaders.push({type:"line",p0:original,p1:[p.pos[0]+dx*scale,p.pos[1]+dy*scale],style:"measureBar",layer:"dimensions",featureId:p.featureId});
                }
            }
            placed.push(labelBounds(p,fs));
        });
        render.primitives=render.primitives.concat(leaders);
    }
    return { references: references, labelBounds: labelBounds, run:run, circleDisplay:circleDisplay, avoid:avoid };
}());
