LG.angles=(function(){
    var U=LG.util;var V=LG.vec;
    function degrees(v){return (Math.atan2(v[1],v[0])*180/Math.PI+360)%360;}
    function direction(angle){return [Math.cos(angle*Math.PI/180),Math.sin(angle*Math.PI/180)];}
    /** Infinite-line intersection; parallel lines have no unique intersection. */
    function intersect(a,b,eps){var d=V.sub(a.p1,a.p0);var e=V.sub(b.p1,b.p0);var det=V.cross(d,e);if(Math.abs(det)<=eps*V.length(d)*V.length(e)){return null;}return V.add(a.p0,V.scale(d,V.cross(V.sub(b.p0,a.p0),e)/det));}
    /** Liang-Barsky interval clipping of an infinite line in y-up bounds. */
    function clip(p,d,box,eps){var lo=-Infinity;var hi=Infinity;var valid=true;U.each([[p[0],d[0],box[0],box[2]],[p[1],d[1],box[3],box[1]]],function(a){if(Math.abs(a[1])<=eps){if(a[0]<a[2]||a[0]>a[3]){valid=false;}return;}var x=(a[2]-a[0])/a[1];var y=(a[3]-a[0])/a[1];lo=Math.max(lo,Math.min(x,y));hi=Math.min(hi,Math.max(x,y));});return valid&&hi-lo>eps?[V.add(p,V.scale(d,lo)),V.add(p,V.scale(d,hi))]:null;}
    /** Direction clusters supply axis references, empty pair sectors and collinear construction lines. */
    function run(model){
        var cfg=model.config;var s=cfg.settings;var edges=U.filterArr(model.edges,function(e){return e.orient==="d"&&e.length>=model.derived.minDiagLen;});var clusters=LG.cluster.circular(U.mapArr(edges,function(e){return e.angleDeg;}),U.mapArr(edges,function(e){return e.length;}),cfg.parallelAngleTol);var axes=[];var pairs={};var construction=[];var inkAt=LG.ink.create(model);var ra=model.derived.ra;
        U.each(clusters,function(c,index){
            c.edges=U.mapArr(c.members,function(i){return edges[i];});c.edges.sort(function(a,b){return b.length-a.length;});var e=c.edges[0];var alpha=e.angleDeg;var vertical=Math.abs(alpha-90)<=45;var value=vertical?Math.abs(alpha-90):Math.min(alpha,180-alpha);
            if(value>cfg.axisAngleTol){var P;var Q;if(vertical){Q=e.p0[1]>e.p1[1]?e.p0:e.p1;P=Q===e.p0?e.p1:e.p0;}else{Q=e.p0[0]<e.p1[0]?e.p0:e.p1;P=Q===e.p0?e.p1:e.p0;}var ray1=vertical?90:180;var ray2=degrees(V.sub(Q,P));var delta=(ray2-ray1+540)%360-180;var sign=vertical?(Q[0]>=P[0]?1:-1):(P[1]>=Q[1]?1:-1);axes.push({kind:"axis",center:Q.slice(0),ray1Deg:ray1,ray2Deg:ray2,value:s.signedAxisAngles?sign*value:value,edgeLength:e.length,reference:vertical?"vertical":"horizontal",turnSign:delta>=0?1:-1,clusterIndex:index});}
            var groups=[];
            U.each(c.edges,function(edge){var found=null;U.each(groups,function(g){if(!found&&V.project(edge.p0,g.edge.p0,g.edge.p1).distance<=model.derived.tolPos&&V.project(edge.p1,g.edge.p0,g.edge.p1).distance<=model.derived.tolPos){found=g;}});if(found){found.edgeCount+=1;found.totalLength+=edge.length;}else{groups.push({edge:edge,edgeCount:1,totalLength:edge.length});}});
            construction=construction.concat(groups);
        });
        var i;var j;
        if(s.features.angles){for(i=0;i<clusters.length;i+=1){for(j=i+1;j<clusters.length;j+=1){var diff=Math.abs(clusters[i].pos-clusters[j].pos);if(diff<cfg.pairAngleMinDeg||diff>180-cfg.pairAngleMinDeg){continue;}
            (function(ci,cj,i,j){U.each(ci.edges,function(a){U.each(cj.edges,function(b){if(a.partId!==b.partId){return;}var point=intersect(a,b,cfg.EPS);if(!point){return;}var part=null;U.each(model.parts,function(p){if(p.id===a.partId){part=p;}});var box=part.bbox;var ex=(box[2]-box[0])*cfg.pairIntersectExpand;var ey=(box[1]-box[3])*cfg.pairIntersectExpand;if(!U.contains([box[0]-ex,box[1]+ey,box[2]+ex,box[3]-ey],point[0],point[1])){return;}
                var rays=[a.angleDeg,b.angleDeg,a.angleDeg+180,b.angleDeg+180].sort(function(x,y){return x-y;});var k;
                for(k=0;k<4;k+=1){var start=rays[k];var end=k===3?rays[0]+360:rays[k+1];var up=90<start?450:90;var down=270<start?630:270;if(!(up>=start&&up<=end)&&!(down>=start&&down<=end)){continue;}var bisector=(start+end)/2;var empty=true;U.each([0.5,1],function(t){var p=V.add(point,V.scale(direction(bisector),t*ra));if(inkAt(p[0],p[1])){empty=false;}});if(!empty){continue;}var angle=end-start;var key="$"+i+":"+j+":"+Math.round(angle/s.angleLabelPrecision);var score=a.length+b.length;if(!U.has(pairs,key)||pairs[key].edgeLength<score){pairs[key]={kind:"pair",center:point,ray1Deg:start,ray2Deg:end,value:angle,edgeLength:score};}}
            });});}(clusters[i],clusters[j],i,j));
        }}}
        var pairList=[];var key;for(key in pairs){if(U.has(pairs,key)){pairList.push(pairs[key]);}}function longest(a,b){return b.edgeLength-a.edgeLength;}pairList.sort(longest);axes.sort(longest);model.angles=s.features.angles?pairList.concat(axes).slice(0,s.maxAngles):[];U.each(model.angles,function(a,index){a.id="A"+(index+1);});
        construction.sort(function(a,b){return b.totalLength-a.totalLength;});model.constructionLines=s.features.constructionLines?U.mapArr(construction.slice(0,s.maxConstructionLines),function(g,index){return {id:"K"+(index+1),p0:g.edge.p0.slice(0),p1:g.edge.p1.slice(0),edgeCount:g.edgeCount};}):[];
        return model;
    }
    return {run:run,clip:clip,direction:direction};
}());
