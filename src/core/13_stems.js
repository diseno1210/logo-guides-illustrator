LG.stems = (function () {
    var U = LG.util; var V = LG.vec;
    /** Evaluate an edge at a coordinate along a unit axis. */
    function onEdge(edge, axis, value, eps) { var delta = V.sub(edge.p1, edge.p0); var denominator = V.dot(delta, axis); return Math.abs(denominator) > eps ? V.add(edge.p0, V.scale(delta, (value - V.dot(edge.p0, axis)) / denominator)) : null; }
    /** Parallel edges with an overlapping, uniformly ink/non-ink middle strip. */
    function pair(a, b, model, inkAt, counter, part) {
        var cfg = model.config; var T = V.unit(V.sub(a.p1, a.p0)); var diff = Math.abs(a.angleDeg - b.angleDeg); var d; var lo; var hi; var mid; var edgeA; var edgeB; var valid = true;
        diff = Math.min(diff, 180 - diff); if (diff > cfg.parallelAngleTol) { return null; }
        d = (V.project(V.lerp(b.p0, b.p1, 0.5), a.p0, a.p1).distance + V.project(V.lerp(a.p0, a.p1, 0.5), b.p0, b.p1).distance) / 2;
        if (d < cfg.minStemWidthRel * model.S || d > cfg.maxStemWidthRel * model.S) { return null; }
        lo = Math.max(Math.min(V.dot(a.p0,T),V.dot(a.p1,T)), Math.min(V.dot(b.p0,T),V.dot(b.p1,T)));
        hi = Math.min(Math.max(V.dot(a.p0,T),V.dot(a.p1,T)), Math.max(V.dot(b.p0,T),V.dot(b.p1,T)));
        if (!(hi - lo > cfg.EPS) || hi - lo < cfg.stemOverlapMin * Math.min(a.length,b.length)) { return null; }
        edgeA = [onEdge(a,T,lo,cfg.EPS),onEdge(a,T,hi,cfg.EPS)]; edgeB = [onEdge(b,T,lo,cfg.EPS),onEdge(b,T,hi,cfg.EPS)];
        if (!edgeA[0] || !edgeA[1] || !edgeB[0] || !edgeB[1]) { return null; }
        U.each([0.25,0.5,0.75], function (t) {
            var p = V.lerp(V.lerp(edgeA[0],edgeA[1],t),V.lerp(edgeB[0],edgeB[1],t),0.5); var outer = false;
            if (counter) { U.each(part.contours,function(c){ if(c.closed && LG.ink.inPolygon(c.polygon,p[0],p[1],cfg.EPS)) { outer = true; } }); }
            if (counter ? (inkAt(p[0],p[1],part.id) || !outer) : !inkAt(p[0],p[1],part.id)) { valid = false; }
        });
        if (!valid || !U.finite(d)) { return null; }
        mid = V.lerp(V.lerp(edgeA[0],edgeA[1],0.5),V.lerp(edgeB[0],edgeB[1],0.5),0.5);
        return { partId:a.partId,rowId:a.rowId,kind:counter?"counter":(a.orient==="v"&&b.orient==="v"?"vertical":(a.orient==="h"&&b.orient==="h"?"horizontal":"diagonal")),width:d,angleDeg:a.angleDeg,edgeA:edgeA,edgeB:edgeB,overlapLen:hi-lo,mid:mid,measure:{},edgeIds:[a.id,b.id],fragments:[{edgeA:edgeA,edgeB:edgeB,overlapLen:hi-lo,mid:mid}] };
    }
    /** Whether both supporting lines are collinear, allowing swapped sides. */
    function aligned(a,b,model) {
        var diff=Math.abs(a.angleDeg-b.angleDeg);var tol=model.derived.tolPos;
        function same(x,y){return V.project(y[0],x[0],x[1]).distance<=tol && V.project(y[1],x[0],x[1]).distance<=tol;}
        return a.partId===b.partId && Math.min(diff,180-diff)<=model.config.parallelAngleTol && ((same(a.edgeA,b.edgeA)&&same(a.edgeB,b.edgeB))||(same(a.edgeA,b.edgeB)&&same(a.edgeB,b.edgeA)));
    }
    /** Extract nearest edge pairs, merge interrupted collinear strokes, and compute bbox gaps/heights. */
    function run(model) {
        var inkAt=LG.ink.create(model);var stems=[];var counters=[];var gaps=[];var heights=[];var cfg=model.config;
        U.each(model.parts,function(part){
            var edges=U.filterArr(model.edges,function(e){return e.partId===part.id&&!e["short"];});
            function detect(counter){
                var candidates=[];var best=[];var chosen=[];var i;var j;var p;
                for(i=0;i<edges.length;i+=1){for(j=i+1;j<edges.length;j+=1){p=pair(edges[i],edges[j],model,inkAt,counter,part);if(p){p.ai=i;p.bi=j;candidates.push(p);if(!best[i]||p.width<best[i].width-cfg.EPS){best[i]=p;}if(!best[j]||p.width<best[j].width-cfg.EPS){best[j]=p;}}}}
                U.each(candidates,function(c){if(best[c.ai]===c&&best[c.bi]===c){chosen.push(c);}});
                var merged=[];
                U.each(chosen,function(c){var target=null;U.each(merged,function(m){if(!target&&aligned(m,c,model)){target=m;}});if(target){target.width=(target.width*target.overlapLen+c.width*c.overlapLen)/(target.overlapLen+c.overlapLen);target.overlapLen+=c.overlapLen;target.fragments=target.fragments.concat(c.fragments);if(c.fragments[0].overlapLen>target.longest){target.mid=c.mid;target.longest=c.overlapLen;}target.edgeIds=target.edgeIds.concat(c.edgeIds);}else{c.longest=c.overlapLen;merged.push(c);}});
                return merged;
            }
            if(part.inkEligible){stems=stems.concat(detect(false));if(cfg.settings.features.counters){counters=counters.concat(detect(true));}}
        });
        U.each(stems,function(s,i){s.id="S"+(i+1);});U.each(counters,function(s,i){s.id="W"+(i+1);});
        U.each(model.rows,function(row){
            var parts=U.filterArr(model.parts,function(p){return !p.small&&p.rowId===row.id;});var i;var a;var b;var overlap;var lines;
            parts.sort(function(a,b){return a.bbox[0]-b.bbox[0]||a.sourceIndex-b.sourceIndex;});
            for(i=0;i<parts.length-1;i+=1){a=parts[i];b=parts[i+1];overlap=LG.rows.overlap(a.bbox,b.bbox,1);if(overlap>=cfg.gapOverlapMin*Math.min(a.bbox[1]-a.bbox[3],b.bbox[1]-b.bbox[3])&&b.bbox[0]-a.bbox[2]>cfg.EPS){gaps.push({id:"G"+(gaps.length+1),rowId:row.id,leftPartId:a.id,rightPartId:b.id,x1:a.bbox[2],x2:b.bbox[0],width:b.bbox[0]-a.bbox[2],measure:{}});}}
            if(cfg.settings.features.heights){
                lines=U.filterArr(model.referenceLines,function(l){return l.orient==="h"&&l.rowId===row.id&&l.pos<=row.bbox[1]+cfg.overshootMaxRel*row.height&&l.pos>=row.bbox[3]-cfg.overshootMaxRel*row.height;});lines.sort(function(a,b){return a.pos-b.pos;});
                for(i=0;i<lines.length-1;i+=1){a=lines[i].pos;b=lines[i+1].pos;var duplicate=false;U.each(stems,function(s){if(s.kind==="horizontal"&&s.rowId===row.id){var y1=(s.edgeA[0][1]+s.edgeA[1][1])/2;var y2=(s.edgeB[0][1]+s.edgeB[1][1])/2;if(Math.abs(Math.min(y1,y2)-a)<=model.derived.tolPos&&Math.abs(Math.max(y1,y2)-b)<=model.derived.tolPos){duplicate=true;}}});if(!duplicate&&b-a>cfg.EPS){heights.push({id:"H"+(heights.length+1),rowId:row.id,y1:a,y2:b,measure:{}});}}
            }
        });
        model.stems=stems;model.counters=counters;model.gaps=gaps;model.heights=heights;return model;
    }
    return {run:run};
}());
