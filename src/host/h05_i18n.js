LG.i18n=(function(){
    var warnings={SAMPLES_CAPPED:"采样间距已增大以满足采样数上限。",NON_FINITE_SAMPLE:"已跳过非有限采样点。",NON_FINITE_GEOMETRY:"已跳过含非有限坐标的几何。",DEGENERATE_PATH:"已跳过空路径或零长度路径。",OUTLINE_STROKES:"开放或纯描边路径不参与笔画宽度测量，请先轮廓化描边。",UNSUPPORTED_ITEMS:"已跳过不支持的对象。",EXTREME_SCALE:"图形尺寸超出5–5000pt，字号和线宽已受限。",OUTSIDE_ARTBOARD:"图形位于画板外，画板延伸可能无法覆盖。",LABEL_LANES_FULL:"标注车道已满，最后一条车道可能重叠。"};
    function text(settings,zh,en){return settings.uiLanguage==="en"?en:zh;}
    warnings.NO_FEATURES="没有检测到特征，请尝试宽松容差。";
    function warning(w,settings){return settings.uiLanguage==="zh"&&LG.util.has(warnings,w.code)?warnings[w.code]+(w.code==="UNSUPPORTED_ITEMS"?" "+w.message:"")+" ["+w.code+"]":w.message+" ["+w.code+"]";}
    function source(name,settings){var names={"auto-stem":["自动笔画","automatic stem"],"fallback-ring":["环厚度兜底","ring fallback"],"fallback-height":["字高兜底","height fallback"],manual:["手动","manual"]};return LG.util.has(names,name)?text(settings,names[name][0],names[name][1]):String(name);}
    /** Counts and top five deviations from actual analysis, including structured warning localization. */
    function summary(result,settings,data,refresh){
        var a=result.analysis;var locked=refresh&&data&&data.baseUnit&&data.baseUnit.locked;var unit=locked?data.baseUnit:a.baseUnit;var lines=["Logo Guides "+LG.milestone];lines.push((locked?text(settings,"已锁定：","Locked: "):"a = ")+unit.value.toFixed(2)+" pt ("+source(unit.source,settings)+")");
        LG.util.each([["lines","参考线","Reference lines"],["stems","笔画","Stems"],["gaps","间距","Gaps"],["heights","高度","Heights"],["counters","字怀","Counters"],["circles","圆","Circles"],["rings","环","Rings"],["angles","角度","Angles"],["constructionLines","构造线","Construction lines"]],function(item){lines.push(text(settings,item[1],item[2])+": "+a[item[0]].length);});
        var deviations=[];LG.util.each([a.stems,a.gaps,a.heights,a.counters,a.rings,a.circles,a.angles],function(items){LG.util.each(items,function(item){var m=item.measure||item.measureR;if(m&&m.dev!==null&&m.dev!==undefined){deviations.push({id:item.id,m:m});}});});
        deviations.sort(function(x,y){return Math.abs(y.m.dev)-Math.abs(x.m.dev);});if(deviations.length){lines.push(text(settings,"偏差最大的5项：","Largest deviations (up to5):"));LG.util.each(deviations.slice(0,5),function(d){lines.push(d.id+": "+(d.m.dev>=0?"+":"")+(d.m.ratio===null?d.m.dev.toFixed(2)+"°":(100*d.m.dev).toFixed(2)+"%")+"; "+d.m.severity);});}
        if(a.warnings.length){lines.push(text(settings,"警告：","Warnings:"));LG.util.each(a.warnings,function(w){lines.push(warning(w,settings));});}return lines.join("\n");
    }
    return {text:text,warning:warning,source:source,summary:summary};
}());
