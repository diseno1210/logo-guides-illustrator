try {
    var doc=LG.hostEnv.documentOrThrow();
    var result=LG.hostManual.circle(doc,LG.config.defaults());
    LG.hostEnv.log("M4 Manual circle OK; anchors="+result.anchorCount+"; maxError="+result.maxAnchorError);
} catch(error) { LG.hostEnv.report(error); }
