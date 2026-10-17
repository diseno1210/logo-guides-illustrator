LG.styles = (function () {
    var dark = {
        baseline: { stroke: "#CCCCCC", width: 1, dashes: [3, 2], opacity: 80 },
        dimension: { stroke: "#CCCCCC", width: 1, dashes: [3, 2], opacity: 80 },
        visual: { stroke: "#E5484D", width: 1.2, dashes: [], opacity: 100 },
        construction: { stroke: "#CCCCCC", width: 0.7, dashes: [], opacity: 50 },
        circleFitted: { stroke: "#CCCCCC", width: 1, dashes: [3, 2], opacity: 80 },
        circleVisual: { stroke: "#E5484D", width: 1.2, dashes: [], opacity: 100 },
        angleArc: { stroke: "#CCCCCC", width: 0.8, dashes: [2, 2], opacity: 80 },
        angleRef: { stroke: "#CCCCCC", width: 0.8, dashes: [2, 2], opacity: 60 },
        measureBar: { stroke: "#CCCCCC", width: 1, dashes: [], opacity: 90 },
        target: { stroke: "#FF9F43", width: 1.2, dashes: [4, 2], opacity: 100 },
        devMarker: { fillHex: "#FF9F43", opacity: 100 }, moduleSquare: { fillHex: "#E5484D", opacity: 45 },
        clearFrame: { stroke: "#CCCCCC", width: 1, dashes: [], opacity: 80 }, clearSquare: { fillHex: "#969696", opacity: 60 },
        text: { fillHex: "#E6E6E6", opacity: 100 }, textWarn: { fillHex: "#FF9F43", opacity: 100 }, textBad: { fillHex: "#E5484D", opacity: 100 }, background: { fillHex: "#333333", opacity: 100 }
    };
    /** Return independent style data, exactly following appendix B. */
    function preset(name) {
        var styles = LG.util.clone(dark); var U = LG.util;
        if (name === "light") {
            U.each(["baseline", "dimension", "circleFitted", "angleArc", "angleRef", "measureBar", "clearFrame", "construction"], function (key) { styles[key].stroke = "#8C8C8C"; });
            styles.construction.opacity = 60; styles.visual.stroke = "#A3745F"; styles.circleVisual.stroke = "#A3745F"; styles.target.stroke = "#D9822B";
            styles.devMarker.fillHex = "#D9822B"; styles.moduleSquare.fillHex = "#A3745F"; styles.moduleSquare.opacity = 70;
            styles.clearSquare.fillHex = "#B4ABA4"; styles.clearSquare.opacity = 80; styles.text.fillHex = "#222222";
            styles.textWarn.fillHex = "#D9822B"; styles.textBad.fillHex = "#C0392B"; styles.background.fillHex = "#F0EEEB";
        } else if (name !== "dark") { throw new Error("Unknown style preset"); }
        return styles;
    }
    /** User-requested appearance override; dashes are entered in physical pt. */
    function resolve(settings,unit){
        var styles=preset(settings.stylePreset);var a=settings.appearance;var key;
        if(!a){return styles;}
        for(key in styles){if(LG.util.has(styles,key)){
            var item=styles[key];
            if(item.stroke){if(a.lineColor){item.stroke=a.lineColor;}if(a.dashMode==="solid"){item.dashes=[];}else if(a.dashMode==="dashed"){item.dashes=[a.dashLength/unit,a.dashGap/unit];}}
            if((key==="text"||key==="textWarn"||key==="textBad")&&a.textColor){item.fillHex=a.textColor;}
        }}return styles;
    }
    return { preset: preset, resolve:resolve };
}());
