LG.ratios=(function(){
    var U=LG.util;var specialValues=[0.382,0.618,0.707,1.414,1.618,2.618];var specialNames=["1/φ²","1/φ","1/√2","√2","φ","φ²"];
    /** Decimal formatting without binary tails or negative zero. */
    function number(value,digits){var text=value.toFixed(digits);if(Number(text)===0){text=(0).toFixed(digits);}return text;}
    function compact(value){return number(value,6).replace(/0+$/g,"").replace(/\.$/,"");}
    function display(value){return Math.abs(value-1)<1e-9?"a":compact(value)+"a";}
    function severity(dev,ok,warn){return Math.abs(dev)<=ok+1e-12?"ok":(Math.abs(dev)<=warn+1e-12?"warn":"bad");}
    /** Contract measurement for a positive length. */
    function measure(value,a,cfg){
        var s=cfg.settings;var ratio=value/a;var target=null;var dev=null;var special=null;var targetDisplay=null;var i;var nearest=Infinity;
        if(s.snapMode==="step"){
            target=Math.max(s.snapStep,Math.round(ratio/s.snapStep)*s.snapStep);
            if(s.detectSpecialRatios){for(i=0;i<specialValues.length;i+=1){var error=Math.abs(ratio-specialValues[i])/specialValues[i];if(error<=cfg.specialRatioTol&&error<nearest){target=specialValues[i];special=specialNames[i];nearest=error;}}}
            targetDisplay=special?number(target,3)+"a":display(target);dev=(ratio-target)/target;
        }
        return {value:value,ratio:ratio,display:display(Math.round(ratio/s.labelPrecision)*s.labelPrecision),target:target,targetDisplay:targetDisplay,special:special,dev:dev,devAbs:target===null?null:value-target*a,severity:dev===null?"none":severity(dev,cfg.devOk,cfg.devWarn)};
    }
    /** Label lines for dimensional or angular measurements. */
    function labelLines(m,cfg){var lines=[{text:m.target===null?m.display:m.targetDisplay,sizeFactor:1,style:"text"}];if(m.severity==="warn"||m.severity==="bad"){var angle=m.ratio===null;var raw=angle?number(m.value,1)+"°":number(m.ratio,3)+"a";var delta=angle?number(m.devAbs,1)+"°":number(m.devAbs,2)+"pt";lines.push({text:(cfg.settings.uiLanguage==="en"?"meas. ":"实测 ")+raw+" · "+(m.devAbs>=0?"+":"")+delta,sizeFactor:0.75,style:m.severity==="warn"?"textWarn":"textBad"});}return lines;}
    /** Angular measurement, independent from dimensional snapMode. */
    function angle(value,cfg){var s=cfg.settings;var target=s.angleSnapStep>0?Math.round(value/s.angleSnapStep)*s.angleSnapStep:null;var dev=target===null?null:value-target;return {value:value,ratio:null,display:compact(Math.round(value/s.angleLabelPrecision)*s.angleLabelPrecision)+"°",target:target,targetDisplay:target===null?null:compact(target)+"°",special:null,dev:dev,devAbs:dev,severity:dev===null?"none":severity(dev,cfg.angleDevOk,cfg.angleDevWarn)};}
    /** Assign all currently implemented measurements in place. */
    function run(model,unit){U.each([model.stems,model.gaps,model.heights,model.counters,model.rings||[]],function(list){U.each(list,function(item){item.measure=measure(item.width!==undefined?item.width:(item.thickness!==undefined?item.thickness:item.y2-item.y1),unit.value,model.config);});});U.each(model.circles||[],function(c){c.measureR=measure(c.r,unit.value,model.config);});U.each(model.angles||[],function(a){a.measure=angle(a.value,model.config);});}
    /** Session-only AI targets are revalidated here, before layout, without changing geometry. */
    function overrides(model,unit,targets){
        model.aiTargets={};var known={};U.each([model.stems,model.gaps,model.heights,model.counters,model.rings||[],model.circles||[],model.angles||[]],function(items){U.each(items,function(f){known["$"+f.id]=f;});});
        U.each(targets||[],function(t){if(!t||!U.finite(t.target)||U.has(model.aiTargets,"$"+t.id)){return;}var f=known["$"+t.id];if(!f){return;}var m=f.measureR||f.measure;var angular=m.ratio===null;var actual=angular?m.value:m.ratio;var target=t.target;
            if(angular?Math.abs(target-actual)>5+1e-9:!(target>0&&actual>0&&Math.abs(target-actual)/actual<=0.15+1e-12)){return;}
            m.target=target;m.targetDisplay=angular?compact(target)+"°":display(target);m.special=null;m.dev=angular?actual-target:(actual-target)/target;m.devAbs=angular?m.dev:m.value-target*unit.value;m.severity=angular?severity(m.dev,model.config.angleDevOk,model.config.angleDevWarn):severity(m.dev,model.config.devOk,model.config.devWarn);model.aiTargets["$"+f.id]=true;
        });
    }
    return {measure:measure,angle:angle,labelLines:labelLines,run:run,overrides:overrides,number:number,display:display};
}());
