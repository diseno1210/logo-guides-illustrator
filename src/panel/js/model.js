/* Pure ES3 panel policy. Geometry and analysis contracts remain unchanged. */
LG.panelModel=(function(){
    var U=LG.util;var V=LG.vec;
    function catalog(analysis){
        var out=[];function add(items,type,key,score){U.each(items||[],function(f){var m=f.measure||f.measureR||null;out.push({id:f.id,type:type,key:key(f),display:m?m.display:(type==="line"?f.orient+" "+LG.ratios.number(f.pos,2):f.id),measure:m,severity:m?m.severity:"none",score:score?score(f):0});});}
        add(analysis.lines,"line",function(f){return {orient:f.orient,pos:f.pos};},function(f){return (f.boundary?100:0)+(f.category==="visual"?50:0)+f.support.partIds.length*10+f.support.flatLen/analysis.S;});
        add(analysis.constructionLines,"construction",function(f){return {p0:f.p0,p1:f.p1};},function(f){return f.edgeCount;});
        add(analysis.circles,"circle",function(f){return {cx:f.cx,cy:f.cy,r:f.r};},function(f){return f.score;});
        add(analysis.stems,"stem",function(f){return {partId:f.partId,mid:f.mid};});
        add(analysis.gaps,"gap",function(f){return {leftPartId:f.leftPartId,rightPartId:f.rightPartId,x:(f.x1+f.x2)/2,rowId:f.rowId};});
        add(analysis.angles,"angle",function(f){return {kind:f.kind,center:f.center,value:f.measure.value};},function(f){return (f.kind==="pair"?100000:0)+f.edgeLength;});
        add(analysis.heights,"height",function(f){return {rowId:f.rowId,y1:f.y1,y2:f.y2};});
        add(analysis.counters,"counter",function(f){return {partId:f.partId,mid:f.mid};});
        add(analysis.rings,"ring",function(f){var c=null;U.each(analysis.circles,function(item){if(item.id===f.outerId){c=item;}});return {cx:c?c.cx:0,cy:c?c.cy:0,thickness:f.thickness};});return out;
    }
    function descriptor(f){return {id:f.id,type:f.type,key:U.clone(f.key)};}
    function distance(old,f,cfg,tol){
        if(!old||old.type!==f.type||!old.key){return Infinity;}var a=old.key;var b=f.key;var d;
        function point(p){return U.isArray(p)&&p.length===2&&U.finite(p[0])&&U.finite(p[1]);}
        if((f.type==="stem"||f.type==="counter")&&!point(a.mid)){return Infinity;}
        if(f.type==="angle"&&!point(a.center)){return Infinity;}
        if(f.type==="construction"&&(!point(a.p0)||!point(a.p1))){return Infinity;}
        if(f.type==="circle"){var t=cfg.circleMergeTol*a.r;d=U.hypot(a.cx-b.cx,a.cy-b.cy);return d<=t&&Math.abs(a.r-b.r)<=t?d+Math.abs(a.r-b.r):Infinity;}
        if(f.type==="line"){return a.orient===b.orient&&Math.abs(a.pos-b.pos)<=tol?Math.abs(a.pos-b.pos):Infinity;}
        if(f.type==="stem"||f.type==="counter"){d=V.distance(a.mid,b.mid);return a.partId===b.partId&&d<=tol?d:Infinity;}
        if(f.type==="gap"){d=Math.abs(a.x-b.x);return a.leftPartId===b.leftPartId&&a.rightPartId===b.rightPartId&&d<=tol?d:Infinity;}
        if(f.type==="angle"){d=V.distance(a.center,b.center);return a.kind===b.kind&&d<=tol&&Math.abs(a.value-b.value)<=1?d+Math.abs(a.value-b.value):Infinity;}
        if(f.type==="height"){d=Math.max(Math.abs(a.y1-b.y1),Math.abs(a.y2-b.y2));return a.rowId===b.rowId&&d<=tol?d:Infinity;}
        if(f.type==="ring"){d=U.hypot(a.cx-b.cx,a.cy-b.cy);return d<=tol&&Math.abs(a.thickness-b.thickness)<=tol?d:Infinity;}
        if(f.type==="construction"){d=Math.min(V.distance(a.p0,b.p0)+V.distance(a.p1,b.p1),V.distance(a.p0,b.p1)+V.distance(a.p1,b.p0));return d<=2*tol?d:Infinity;}return Infinity;
    }
    /** Global nearest pairs, then deterministic one-to-one assignment; IDs are not identities. */
    function match(hidden,features,settings,S){var cfg=LG.config.resolve(settings);var pairs=[];var usedOld={};var usedNew={};var result=[];U.each(hidden||[],function(old,i){U.each(features,function(f,j){var d=distance(old,f,cfg,cfg.clusterTolRel*S);if(U.finite(d)){pairs.push({i:i,j:j,d:d});}});});pairs.sort(function(a,b){return a.d-b.d||a.i-b.i||a.j-b.j;});U.each(pairs,function(p){if(!usedOld["$"+p.i]&&!usedNew["$"+p.j]){usedOld["$"+p.i]=true;usedNew["$"+p.j]=true;result.push(descriptor(features[p.j]));}});return result;}
    function idSet(features){var out={};U.each(features,function(f){out["$"+f.id]=true;});return out;}
    function curated(features,settings){var cfg=LG.config.resolve(settings);var selected=[];function take(types,n){var list=U.filterArr(features,function(f){return U.indexOf(types,f.type)>=0;});list.sort(function(a,b){return b.score-a.score||(a.id<b.id?-1:(a.id>b.id?1:0));});selected=selected.concat(list.slice(0,n));}take(["line","construction"],cfg.curatedMaxLines);take(["circle"],cfg.curatedMaxCircles);take(["angle"],cfg.curatedMaxAngles);selected=selected.concat(U.filterArr(features,function(f){return U.indexOf(["line","construction","circle","angle"],f.type)<0;}));return idSet(selected);}
    /** Keep hidden objects in the native drawing so visibility can be toggled without rebuilding. */
    function project(result,settings,hidden,curate){var copy=U.clone(result);var features=catalog(result.analysis);var allowed=curate?curated(features,settings):idSet(features);var all=idSet(features);var concealed=idSet(hidden||[]);var categories={};copy.render.primitives=U.filterArr(copy.render.primitives,function(p){return !all["$"+p.featureId]||allowed["$"+p.featureId];});U.each(copy.render.primitives,function(p){if(p.layer!=="legend"&&!concealed["$"+p.featureId]){var style=p.style;if(style==="dimension"){style="baseline";}if(style==="circleVisual"){style="visual";}categories[style]=true;}});var keep=false;copy.render.primitives=U.filterArr(copy.render.primitives,function(p){if(p.layer!=="legend"){return true;}if(p.type!=="label"){keep=!!categories[p.style];}return keep;});return {result:copy,features:features,allowed:allowed};}
    function severity(features){var ranks={bad:0,warn:1,ok:2,none:3};return features.slice(0).sort(function(a,b){return ranks[a.severity]-ranks[b.severity]||Math.abs((b.measure&&b.measure.dev)||0)-Math.abs((a.measure&&a.measure.dev)||0)||(a.id<b.id?-1:1);});}
    return {catalog:catalog,descriptor:descriptor,match:match,curated:curated,project:project,severity:severity,idSet:idSet};
}());
