LG.baseunit=(function(){
    var U=LG.util;
    /** Weighted median of cluster members, choosing lower at an exact half-weight tie. */
    function median(items){var ordered=items.slice(0).sort(function(a,b){return a.value-b.value;});var total=0;var sum=0;var i;U.each(ordered,function(v){total+=v.weight;});for(i=0;i<ordered.length;i+=1){sum+=ordered[i].weight;if(sum>=total/2){return ordered[i].value;}}return ordered[0].value;}
    /** Width clusters sorted by total overlap; same routine accepts rings. */
    function groups(items,kind,cfg){var clusters=LG.cluster.cluster1D(U.mapArr(items,function(s){return s.value;}),U.mapArr(items,function(s){return s.weight;}),cfg.widthClusterTol,true);return U.mapArr(clusters,function(c){var members=U.mapArr(c.members,function(i){return items[i];});return {value:median(members),count:members.length,totalLength:c.weight,kind:kind};}).sort(function(a,b){return b.totalLength-a.totalLength||a.value-b.value;});}
    /** Select a from vertical strokes, all strokes, rings, then S; feature switches do not affect a. */
    function resolve(model){
        var cfg=model.config;var setting=cfg.settings.baseUnit;var vertical=[];var other=[];var rings=[];var candidates;var chosen;var source;
        U.each(model.stems,function(s){(s.kind==="vertical"?vertical:other).push({value:s.width,weight:s.overlapLen});});
        U.each(model.rings||[],function(r){rings.push({value:r.thickness,weight:1});});
        var vg=groups(vertical,"vertical",cfg);var og=groups(other,"other",cfg);var rg=groups(rings,"ring",cfg);
        candidates=vg.concat(og);if(!candidates.length){candidates=rg;}candidates=candidates.slice(0,6);
        if(setting.mode==="value"){return {value:setting.value,source:"manual",candidates:candidates};}
        if(vertical.length){chosen=vg;source="auto-stem";}else if(other.length){chosen=groups(other,"other",cfg);source="auto-stem";}else if(rings.length){chosen=rg;source="fallback-ring";}else{return {value:model.S,source:"fallback-height",candidates:candidates};}
        return {value:chosen[0].value,source:source,candidates:candidates};
    }
    return {resolve:resolve};
}());
