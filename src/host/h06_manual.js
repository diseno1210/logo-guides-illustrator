LG.hostManual = (function () {
    /** Snapshot selected anchors, and sample only curves with both endpoints selected. */
    function selected(doc, settings) {
        var U=LG.util;var paths=[];var seen=[];var anchors=[];var flags={};var parts=[];
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
        if(!selection||selection.typename==="TextRange"){throw new Error("请用直接选择工具选择锚点 / Select anchors with Direct Selection.");}
        for(i=0;i<selection.length;i+=1){visit(selection[i]);}
        for(i=0;i<paths.length;i+=1){
            var points=[];var selected=[];var path=paths[i];var id="m"+i;
            for(j=0;j<path.pathPoints.length;j+=1){var p=path.pathPoints[j];var a=[Number(p.anchor[0]),Number(p.anchor[1])];points.push({a:a,l:[Number(p.leftDirection[0]),Number(p.leftDirection[1])],r:[Number(p.rightDirection[0]),Number(p.rightDirection[1])]});selected.push(p.selected===PathPointSelection.ANCHORPOINT);if(selected[j]){anchors.push({p:a.slice(0)});}}
            flags[id]=selected;parts.push({id:id,sourceIndex:i,kind:"path",filled:!!path.filled,stroked:!!path.stroked,strokeWidth:Number(path.strokeWidth)||0,contours:[{id:id+"c0",closed:!!path.closed,points:points}]});
        }
        var samples=anchors.slice(0);
        if(anchors.length>=3&&parts.length){
            var board=doc.artboards[doc.artboards.getActiveArtboardIndex()].artboardRect;
            var model=LG.sample.run(LG.geometry.normalize({version:1,units:"pt",colorSpace:"RGB",artboard:[board[0],board[1],board[2],board[3]],parts:parts,warnings:[]},settings));
            U.each(model.parts,function(part){U.each(part.contours,function(c){U.each(c.segments,function(segment){var f=flags[part.id];var n=segment.sourceSegmentIndex;if(f[n]&&f[(n+1)%f.length]){samples=samples.concat(segment.samples);}});});});
        }
        return {anchors:anchors,samples:samples};
    }
    /** Add manual primitives without replacing automatic output or document/source data. */
    function draw(doc, primitives, settings, fs, unit){
        var savedLayer=doc.activeLayer;var savedSelection=doc.selection;var root=LG.hostStore.layer(doc);var locked=root?root.locked:false;var manual=null;var manualLocked=false;var i;
        if(!root){root=doc.layers.add();root.name="Logo Guides";}
        try{
            root.locked=false;
            for(i=0;i<root.layers.length;i+=1){if(root.layers[i].name==="LG Manual"){manual=root.layers[i];break;}}
            if(!manual){manual=root.layers.add();manual.name="LG Manual";}manualLocked=manual.locked;manual.locked=false;
            var styles=LG.styles.preset(settings.stylePreset);
            for(i=0;i<primitives.length;i+=1){var p=primitives[i];if(p.type==="label"){LG.hostDraw.label(manual,p,{fontSize:fs},styles,settings,doc);}else{var item=LG.hostDraw.shape(manual,p);item.name=p.featureId;LG.hostDraw.style(item,styles[p.style],unit,doc);}}
        }finally{try{if(manual){manual.locked=manualLocked;}}finally{try{root.locked=locked;}finally{try{doc.activeLayer=savedLayer;}finally{doc.selection=savedSelection;}}}}
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
