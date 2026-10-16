LG.hostUI=(function(){
    function tr(s,zh,en){return LG.i18n.text(s,zh,en);}
    /** Complete v1 generation dialog; candidate values stay fixed while it is open. */
    function generate(initial,context,data){
        var s=LG.util.clone(initial);var dialog=new Window("dialog",tr(s,"Logo辅助线生成器","Logo Guides"));dialog.orientation="column";dialog.alignChildren="fill";
        function panel(title){var p=dialog.add("panel",undefined,title);p.orientation="column";p.alignChildren="fill";return p;}
        function row(parent){var r=parent.add("group");r.orientation="row";return r;}
        function dropdown(parent,title,labels,index){var r=row(parent);r.add("statictext",undefined,title);var c=r.add("dropdownlist",undefined,labels);c.selection=index;return c;}
        var base=panel(tr(s,"基准单位a","Base unit a"));var candidates=context.candidates;var options=[];var values=[null];var automatic=candidates.length?candidates[0]:null;
        options.push(automatic?tr(s,"自动：","Auto: ")+automatic.value.toFixed(2)+" pt ("+tr(s,automatic.kind==="vertical"?"竖笔画":"笔画",automatic.kind=== "vertical"?"vertical stems":"stems")+", "+automatic.count+tr(s,"处)"," occurrences)"):tr(s,"自动：将使用环厚度或字高","Auto: ring thickness or height fallback"));
        LG.util.each(candidates,function(c){options.push(c.value.toFixed(2)+" pt ("+c.count+tr(s,"处)"," occurrences)"));values.push(c.value);});
        var selected=0;if(data&&data.baseUnit&&data.baseUnit.locked&&data.baseUnit.value>0){selected=options.length;options.push(tr(s,"上次的值：","Last value: ")+data.baseUnit.value.toFixed(2)+" pt");values.push(data.baseUnit.value);}
        options.push(tr(s,"自定义…","Custom…"));values.push(null);var choice=dropdown(base,tr(s,"来源","Source"),options,selected);var customRow=row(base);customRow.add("statictext",undefined,"a (pt)");var custom=customRow.add("edittext",undefined,s.baseUnit.value>0?String(s.baseUnit.value):"");custom.characters=12;custom.enabled=false;choice.onChange=function(){custom.enabled=choice.selection.index===options.length-1;};
        var locked=base.add("checkbox",undefined,tr(s,"锁定a（推荐：微调期间保持不变）","Lock a (recommended while adjusting artwork)"));locked.value=s.baseUnit.locked;
        base.add("statictext",undefined,tr(s,"修改容差不会刷新候选；自动模式在生成时重算。","Candidates stay fixed; Auto recalculates with the chosen tolerance."));
        var tolerance=panel(tr(s,"容差","Tolerance"));var radios=[];var presets=["loose","standard","strict"];var toleranceRow=row(tolerance);LG.util.each([tr(s,"宽松","Loose"),tr(s,"标准","Standard"),tr(s,"严格","Strict")],function(name,i){var r=toleranceRow.add("radiobutton",undefined,name);r.value=s.tolerancePreset===presets[i];radios.push(r);});
        var labels=panel(tr(s,"标注","Labels"));var precision=dropdown(labels,tr(s,"精度","Precision"),["0.01","0.05","0.1"],LG.util.indexOf([0.01,0.05,0.1],s.labelPrecision));
        var snapValues=[0,0.05,0.1,0.25,0.5];var snap=dropdown(labels,tr(s,"吸附","Snap"),[tr(s,"关","Off"),"0.05a","0.1a","0.25a","0.5a"],s.snapMode==="off"?0:LG.util.indexOf(snapValues,s.snapStep));
        var special=labels.add("checkbox",undefined,tr(s,"识别特殊比例（φ、√2）","Detect special ratios (φ, √2)"));special.value=s.detectSpecialRatios;
        var angle=dropdown(labels,tr(s,"角度吸附","Angle snap"),[tr(s,"关","Off"),"1°","5°","15°"],LG.util.indexOf([0,1,5,15],s.angleSnapStep));
        var features=panel(tr(s,"生成内容","Features"));var controls={};var grid=row(features);var column=null;
        LG.util.each([["baselines","基准线","Baselines"],["overshoot","视觉超出","Overshoot"],["verticals","竖直参考线","Vertical references"],["stemWidths","笔画宽度","Stem widths"],["gaps","间距","Gaps"],["heights","高度","Heights"],["counters","字怀","Counters"],["circles","辅助圆","Circles"],["ringThickness","环厚度","Ring thickness"],["angles","角度","Angles"],["constructionLines","构造线","Construction lines"],["targetLines","目标线","Target lines"],["deviationMarkers","偏差标记","Deviation markers"],["clearSpace","安全区","Clear space"],["legend","图例","Legend"]],function(f,i){if(i%5===0){column=grid.add("group");column.orientation="column";column.alignChildren="left";}var c=column.add("checkbox",undefined,tr(s,f[1],f[2]));c.value=s.features[f[0]];controls[f[0]]=c;});
        var output=panel(tr(s,"输出","Output"));var style=dropdown(output,tr(s,"样式","Style"),[tr(s,"深色","Dark"),tr(s,"浅色","Light")],s.stylePreset==="dark"?0:1);var mode=dropdown(output,tr(s,"模式","Mode"),[tr(s,"样式化","Styled"),tr(s,"参考线","Guides"),tr(s,"两者","Both")],LG.util.indexOf(["styled","guides","both"],s.output));
        var lockLayer=output.add("checkbox",undefined,tr(s,"锁定辅助图层","Lock guide layers"));lockLayer.value=s.lockLayer;var extend=dropdown(output,tr(s,"延伸","Extend to"),[tr(s,"边距","Margin"),tr(s,"画板","Artboard")],s.extendTo==="margin"?0:1);
        var buttons=row(dialog);var ok=buttons.add("button",undefined,tr(s,"生成","Generate"),{name:"ok"});buttons.add("button",undefined,tr(s,"取消","Cancel"),{name:"cancel"});var result=null;
        ok.onClick=function(){
            var next=LG.util.clone(s);var index=choice.selection.index;var value=values[index];if(index===options.length-1){value=Number(LG.util.trimStr(custom.text));if(!LG.util.finite(value)||value<=0){alert(tr(s,"a必须是正数，请重新输入。","a must be a positive number. Enter it again."));custom.active=true;return;}}
            next.baseUnit={mode:index===0?"auto":"value",value:index===0?null:value,locked:locked.value};LG.util.each(radios,function(r,i){if(r.value){next.tolerancePreset=presets[i];}});next.labelPrecision=[0.01,0.05,0.1][precision.selection.index];next.snapMode=snap.selection.index===0?"off":"step";if(next.snapMode==="step"){next.snapStep=snapValues[snap.selection.index];}next.detectSpecialRatios=special.value;next.angleSnapStep=[0,1,5,15][angle.selection.index];var key;for(key in controls){if(LG.util.has(controls,key)){next.features[key]=controls[key].value;}}next.stylePreset=style.selection.index===0?"dark":"light";next.output=["styled","guides","both"][mode.selection.index];next.lockLayer=lockLayer.value;next.extendTo=extend.selection.index===0?"margin":"artboard";
            try{result=LG.config.resolve(next).settings;dialog.close(1);}catch(error){alert(String(error.message||error));}
        };
        dialog.center();dialog.show();return result;
    }
    /** Four explicit clear choices, with cancellation as a non-mutating result. */
    function clear(settings){var d=new Window("dialog",tr(settings,"清除辅助线","Clear guides"));d.orientation="column";d.alignChildren="fill";var result="cancel";LG.util.each([["auto","仅自动辅助线（含背景）","Automatic guides and background"],["all","全部辅助线（含手动）","All guides including manual"],["data","全部 + 文档数据和来源标签","All guides, document data and source tags"]],function(item){var button=d.add("button",undefined,tr(settings,item[1],item[2]));button.onClick=function(){result=item[0];d.close(1);};});d.add("button",undefined,tr(settings,"取消","Cancel"),{name:"cancel"});d.center();d.show();return result;}
    /** SetBaseUnit measures either two selected anchors or one object's geometric bounds. */
    function baseUnit(settings,options){var d=new Window("dialog",tr(settings,"设置基准单位a","Set base unit a"));d.orientation="column";var choice=d.add("dropdownlist",undefined,LG.util.mapArr(options,function(o){return tr(settings,o.zh,o.en)+": "+o.value.toFixed(3)+" pt";}));choice.selection=0;var buttons=d.add("group");var ok=buttons.add("button",undefined,tr(settings,"设置并锁定","Set and lock"),{name:"ok"});buttons.add("button",undefined,tr(settings,"取消","Cancel"),{name:"cancel"});var value=null;ok.onClick=function(){var n=options[choice.selection.index].value;if(!LG.util.finite(n)||n<=0){alert(tr(settings,"请选择正数尺寸。","Choose a positive measurement."));return;}value=n;d.close(1);};d.center();d.show();return value;}
    return {generate:generate,clear:clear,baseUnit:baseUnit};
}());

LG.hostActions=(function(){
    var U=LG.util;
    /** Analyze before replacing output, then report/debug/log the actual result. */
    function execute(doc,geometry,settings,sources,previous,context,preparationMs){
        var start=new Date().getTime();var result=LG.analyze(geometry,settings,context);var featureCount=U.filterArr(result.render.primitives,function(p){return U.indexOf(["legend","background","clearSpace"],p.featureId)<0;}).length;
        if(!featureCount){U.warn(result.analysis.warnings,"NO_FEATURES","No features detected; try loose tolerance.");}
        if(settings.debug){LG.hostEnv.debugDump(geometry,result.analysis);}
        var data=LG.hostDraw.generate(doc,result,settings,sources,previous);var elapsed=new Date().getTime()-start+(preparationMs||0);
        LG.hostEnv.log(LG.milestone+" "+(previous?"Refresh":"Generate")+" OK; runId="+data.runId+"; ms="+elapsed+"; primitives="+result.render.primitives.length+"; warnings="+result.analysis.warnings.length);
        if(previous?result.analysis.warnings.length>0:settings.showSummary){alert(LG.i18n.summary(result,settings,data,!!previous));}
        return {result:result,data:data,elapsedMs:elapsed};
    }
    function generate(doc){var start=new Date().getTime();var settings=LG.hostStore.settings();var sources=LG.hostRead.sourceObjects(doc);var geometry=LG.hostRead.selection(doc,settings,sources);var context=LG.preAnalyze(geometry,settings);var data=LG.hostStore.read(doc);var preparation=new Date().getTime()-start;var chosen=LG.hostUI.generate(settings,context,data);if(!chosen){return null;}start=new Date().getTime();settings=LG.hostStore.saveSettings(chosen);preparation+=new Date().getTime()-start;return execute(doc,geometry,settings,sources,null,context,preparation);}
    /** Locked document a overrides global settings; current selection is never used as the source. */
    function refresh(doc){var start=new Date().getTime();var data=LG.hostStore.read(doc);if(!data){throw new Error("没有文档数据，请重新运行生成 / No guide data. Run Generate again.");}var sources=LG.hostStore.sources(doc,data.runId);if(!sources.length){throw new Error("找不到来源对象，请重新运行生成 / Source objects missing. Run Generate again.");}var settings=LG.hostStore.settings();if(data.baseUnit&&data.baseUnit.locked){if(!U.finite(data.baseUnit.value)||data.baseUnit.value<=0){throw new Error("Invalid locked base unit; run Generate again.");}settings.baseUnit.mode="value";settings.baseUnit.value=data.baseUnit.value;}var geometry=LG.hostRead.selection(doc,settings,sources);return execute(doc,geometry,settings,sources,data,null,new Date().getTime()-start);}
    /** Keep the hidden metadata for the first two modes, and preserve Manual only in auto mode. */
    function clear(doc,mode){
        if(doc.selection&&doc.selection.typename==="TextRange"){throw new Error("请按Esc退出文字编辑 / Exit text editing first.");}
        var settings=LG.hostStore.settings();if(mode===undefined){mode=LG.hostUI.clear(settings);}if(mode==="cancel"){return false;}if(U.indexOf(["auto","all","data"],mode)<0){throw new Error("Invalid clear mode");}
        var savedLayer=doc.activeLayer;var savedSelection=doc.selection;var root=LG.hostStore.layer(doc);var wasLocked=root?root.locked:false;var removed=false;var i;var locks=LG.hostStore.layerLocks(doc);
        function removedOutput(item){var cursor=item;var branch=null;while(cursor&&cursor.typename!=="Document"){if(cursor.name==="Logo Guides BG"){return true;}if(cursor===root){return mode==="data"||(branch&&branch.typename==="Layer"&&(mode==="all"||branch.name!=="LG Manual"));}branch=cursor;cursor=cursor.parent;}return false;}
        var restoreLayer=removedOutput(savedLayer)?null:savedLayer;
        var restoreSelection=U.filterArr(savedSelection&&savedSelection.length?savedSelection:[],function(item){return !removedOutput(item);});
        try{
            if(root){root.locked=false;if(mode==="data"){root.remove();removed=true;}else{for(i=root.layers.length-1;i>=0;i-=1){if(mode==="all"||root.layers[i].name!=="LG Manual"){root.layers[i].locked=false;root.layers[i].remove();}}}}
            for(i=doc.layers.length-1;i>=0;i-=1){if(doc.layers[i].name==="Logo Guides BG"){doc.layers[i].locked=false;doc.layers[i].remove();}}
            if(mode==="data"){LG.hostStore.tagSources(doc,[],"");}LG.hostEnv.log("Clear OK; mode="+mode);return true;
        }finally{
            try{LG.hostStore.restoreLocks(doc,locks);if(root&&!removed){root.locked=wasLocked;}}finally{
                try{LG.hostStore.restoreActiveLayer(doc,restoreLayer);}finally{doc.selection=restoreSelection;}
            }
        }
    }
    /** Values come from two actual anchor selections, otherwise one selected object's exact bounds. */
    function baseOptions(doc,settings){
        var chosen=LG.hostManual.selected(doc,settings,true);var options=[];if(chosen.anchors.length===2){var p=chosen.anchors[0].p;var q=chosen.anchors[1].p;options=[{zh:"两点距离",en:"Distance",value:LG.vec.distance(p,q)},{zh:"水平距离",en:"Horizontal distance",value:Math.abs(q[0]-p[0])},{zh:"垂直距离",en:"Vertical distance",value:Math.abs(q[1]-p[1])}];}
        else{var sources=LG.hostRead.sourceObjects(doc);if(sources.length!==1){throw new Error("请选择一个对象或两个锚点 / Select one object or two anchors.");}var b=sources[0].geometricBounds;var w=Math.abs(b[2]-b[0]);var h=Math.abs(b[1]-b[3]);options=[{zh:"对象宽度",en:"Object width",value:w},{zh:"对象高度",en:"Object height",value:h},{zh:"宽高中较小值",en:"Smaller dimension",value:Math.min(w,h)}];}return options;
    }
    function setBaseUnit(doc,value){
        var settings=LG.hostStore.settings();if(value===undefined){value=LG.hostUI.baseUnit(settings,baseOptions(doc,settings));}if(value===null){return null;}if(!U.finite(value)||value<=0){throw new Error("a必须是正数 / a must be positive.");}
        var data=LG.hostStore.read(doc)||LG.hostStore.createData({baseUnit:{value:value,source:"manual"}},settings);data.baseUnit={value:value,source:"manual",locked:true};data.updatedAt=LG.hostStore.timestamp();var root=LG.hostStore.layer(doc);var locked=root?root.locked:settings.lockLayer;var savedLayer=doc.activeLayer;var savedSelection=doc.selection;
        if(!root){root=doc.layers.add();root.name="Logo Guides";}try{root.locked=false;LG.hostStore.write(root,data);}finally{try{root.locked=locked;}finally{try{doc.activeLayer=savedLayer;}finally{doc.selection=savedSelection;}}}
        LG.hostEnv.log("SetBaseUnit OK; a="+value);if(LG.hostStore.sources(doc,data.runId).length){return refresh(doc);}return data;
    }
    return {generate:generate,refresh:refresh,clear:clear,baseOptions:baseOptions,setBaseUnit:setBaseUnit,execute:execute};
}());
