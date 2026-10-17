/* DEV_PLAN 7.1-7.4 are authoritative. */
LG.config = (function () {
    var defaults = {
        baseUnit: { mode: "auto", value: null, locked: true },
        tolerancePreset: "standard", labelPrecision: 0.01, snapMode: "off", snapStep: 0.05, detectSpecialRatios: true, angleLabelPrecision: 1, angleSnapStep: 0, signedAxisAngles: false, mixedAsVisual: true,
        features: { baselines: true, overshoot: true, verticals: true, stemWidths: true, gaps: true, heights: false, counters: false, circles: true, ringThickness: true, angles: true, constructionLines: true, targetLines: true, deviationMarkers: true, clearSpace: false, legend: true, background: false },
        circleDisplay: "full", circleExtendDeg: 30, circleLabels: false, maxCircles: 24, maxAngles: 12, maxConstructionLines: 40, stemLabelStyle: "lanes", labelDedup: false, output: "styled", lockLayer: true, stylePreset: "dark", extendTo: "margin", marginFactor: 0.2, clearSpaceFactor: 1, legendLanguage: "both", uiLanguage: "zh", fontSize: 0,
        fontNames: ["Roboto-Regular", "ArialMT", "Helvetica", "MyriadPro-Regular"], cjkFontNames: ["SourceHanSansSC-Regular", "AdobeHeitiStd-Regular", "PingFangSC-Regular", "MicrosoftYaHei"], autoOutlineText: true, showSummary: true, debug: false, advanced: {},
        avoidLabelOverlap: true, measurementLabelMode: "compare", labelDecimals: 2, appearance: { textColor: "", lineColor: "", strokeWidth: 0, dashMode: "preset", dashLength: 3, dashGap: 2 }
    };
    var presets = {
        loose: { circleFitTol: 0.04, circleAbsCapRel: 0.02, circleMergeTol: 0.04, clusterTolRel: 0.008, widthClusterTol: 0.05, parallelAngleTol: 1.5, axisAngleTol: 2, lineStraightTol: 0.004 },
        standard: { circleFitTol: 0.02, circleAbsCapRel: 0.01, circleMergeTol: 0.02, clusterTolRel: 0.004, widthClusterTol: 0.03, parallelAngleTol: 0.5, axisAngleTol: 1, lineStraightTol: 0.002 },
        strict: { circleFitTol: 0.01, circleAbsCapRel: 0.005, circleMergeTol: 0.01, clusterTolRel: 0.002, widthClusterTol: 0.015, parallelAngleTol: 0.25, axisAngleTol: 0.5, lineStraightTol: 0.001 }
    };
    var constants = { circleMinArcDeg: 20, circleMinSamples: 6, circleMaxRadiusFactor: 3, minEdgeLenRel: 0.05, minDiagLenRel: 0.1, minStemWidthRel: 0.01, maxStemWidthRel: 0.8, stemOverlapMin: 0.3, sampleSpacingRel: 0.005, maxSamples: 20000, overshootMaxRel: 0.03, smallPartRel: 0.3, rowOverlapMin: 0.5, gapOverlapMin: 0.3, cornerAngleDeg: 15, silhouetteEpsRel: 0.01, lineKeepFlatRel: 0.3, pairAngleMinDeg: 10, pairIntersectExpand: 0.1, specialRatioTol: 0.01, devOk: 0.005, devWarn: 0.02, angleDevOk: 0.1, angleDevWarn: 0.5, maxLanes: 4, fontSizeRel: 0.07, strokeUnitRel: 0.0025, arcRadiusRel: 0.15, curatedMaxLines: 20, curatedMaxCircles: 12, curatedMaxAngles: 6 };
    var enums = { tolerancePreset: ["loose", "standard", "strict"], labelPrecision: [0.01, 0.05, 0.1], snapMode: ["off", "step"], snapStep: [0.05, 0.1, 0.25, 0.5], angleLabelPrecision: [1, 0.5, 0.1], angleSnapStep: [0, 1, 5, 15], circleDisplay: ["full", "extended", "arc"], stemLabelStyle: ["lanes", "squares"], output: ["styled", "guides", "both"], stylePreset: ["dark", "light"], extendTo: ["margin", "artboard"], legendLanguage: ["zh", "en", "both"], uiLanguage: ["zh", "en"] };
    var integers = ["circleMinSamples", "maxSamples", "maxLanes", "curatedMaxLines", "curatedMaxCircles", "curatedMaxAngles"];
    /** Validate known settings against default types. */
    function validateTypes(value, base, prefix) {
        var key; var item; var ref; var name; var i;
        for (key in base) { if (LG.util.has(base, key) && key !== "advanced") {
            item = value[key]; ref = base[key]; name = prefix + key;
            if (ref === null) { if (item !== null && !LG.util.finite(item)) { throw new Error("Invalid setting: " + name); } }
            else if (LG.util.isArray(ref)) { if (!LG.util.isArray(item)) { throw new Error("Invalid setting: " + name); } for (i = 0; i < item.length; i += 1) { if (typeof item[i] !== "string") { throw new Error("Invalid font: " + name); } } }
            else if (typeof ref === "object") { validateTypes(item, ref, name + "."); }
            else if (typeof item !== typeof ref || (typeof item === "number" && !LG.util.finite(item))) { throw new Error("Invalid setting: " + name); }
        } }
    }
    /** Resolve defaults, known settings, then advanced parameter overrides. */
    function resolve(input) {
        var settings = LG.util.deepMerge(defaults, input); var cfg; var key; var val;
        validateTypes(settings, defaults, "");
        var appearance=settings.appearance;
        if(settings.labelDecimals<0||settings.labelDecimals>4||settings.labelDecimals!==Math.floor(settings.labelDecimals)){throw new Error("Invalid label decimal places");}
        if(appearance.strokeWidth<0||appearance.strokeWidth>100||settings.circleExtendDeg>180||LG.util.indexOf(["compare","measured"],settings.measurementLabelMode)<0){throw new Error("Invalid appearance range or measurement label mode");}
        LG.util.each(["textColor","lineColor"],function(name){if(appearance[name]!==""&&!/^#[0-9a-fA-F]{6}$/.test(appearance[name])){throw new Error("Invalid appearance color: "+name);}});
        if(LG.util.indexOf(["preset","solid","dashed"],appearance.dashMode)<0||appearance.dashLength<=0||appearance.dashGap<=0||appearance.dashLength>1000||appearance.dashGap>1000){throw new Error("Invalid appearance dashes");}
        for (key in enums) { if (LG.util.has(enums, key) && LG.util.indexOf(enums[key], settings[key]) < 0) { throw new Error("Invalid setting: " + key); } }
        if (LG.util.indexOf(["auto", "value"], settings.baseUnit.mode) < 0 || (settings.baseUnit.mode === "value" && !(settings.baseUnit.value > 0))) { throw new Error("Base unit must be a positive number"); }
        for (key in defaults) { if (LG.util.has(defaults, key) && typeof defaults[key] === "number") { val = settings[key]; if (val < 0 || ((key === "maxCircles" || key === "maxAngles" || key === "maxConstructionLines") && val !== Math.floor(val))) { throw new Error("Invalid setting: " + key); } } }
        cfg = LG.util.clone(constants);
        for (key in presets[settings.tolerancePreset]) { if (LG.util.has(presets[settings.tolerancePreset], key)) { cfg[key] = presets[settings.tolerancePreset][key]; } }
        if (input && input.advanced && typeof input.advanced === "object") { for (key in cfg) { if (LG.util.has(cfg, key) && LG.util.has(input.advanced, key)) {
            val = input.advanced[key];
            if (!LG.util.finite(val) || val < 0 || ((key === "sampleSpacingRel" || key === "circleMaxRadiusFactor" || key === "maxSamples" || key === "maxLanes" || key === "circleMinSamples") && val <= 0) || (LG.util.indexOf(integers, key) >= 0 && val !== Math.floor(val))) { throw new Error("Invalid advanced parameter: " + key); }
            cfg[key] = val; settings.advanced[key] = val;
        } } }
        if (cfg.stemOverlapMin > 1 || cfg.rowOverlapMin > 1 || cfg.gapOverlapMin > 1 || cfg.smallPartRel > 1 || cfg.minStemWidthRel > cfg.maxStemWidthRel) { throw new Error("Invalid advanced parameter range"); }
        cfg.settings = settings; cfg.EPS = 1e-9; return cfg;
    }
    /** Compute section 7.4 derived values from positive scales. */
    function derive(cfg, S, D) {
        if (!(S > 0) || !(D > 0) || !LG.util.finite(S) || !LG.util.finite(D)) { throw new Error("Geometry has no usable scale"); }
        return { S: S, D: D, tolPos: cfg.clusterTolRel * S, minEdgeLen: cfg.minEdgeLenRel * S, minDiagLen: cfg.minDiagLenRel * S, h: Math.max(0.05, cfg.sampleSpacingRel * S), kappaMin: 1 / (cfg.circleMaxRadiusFactor * D), fs: cfg.settings.fontSize > 0 ? cfg.settings.fontSize : LG.util.clamp(cfg.fontSizeRel * S, 6, 36), u: LG.util.clamp(cfg.strokeUnitRel * S, 0.25, 2), ra: cfg.arcRadiusRel * S, epsilon: cfg.silhouetteEpsRel * S };
    }
    return { resolve: resolve, derive: derive, defaults: function () { return LG.util.clone(defaults); } };
}());
