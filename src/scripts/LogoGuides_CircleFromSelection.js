try {
    var doc=LG.hostEnv.documentOrThrow();
    var result=LG.hostManual.circle(doc,LG.hostStore.settings());
    LG.hostEnv.log(LG.milestone+" Manual circle OK; anchors="+result.anchorCount+"; maxError="+result.maxAnchorError);
} catch(error) { LG.hostEnv.report(error); }
