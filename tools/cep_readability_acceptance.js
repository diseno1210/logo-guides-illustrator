'use strict';
const fs=require('node:fs');const path=require('node:path');const {connect}=require('./cep_client');

async function run(folder){
  folder=path.resolve(folder);fs.mkdirSync(folder,{recursive:true});
  if(fs.existsSync(path.join(folder,'results.json')))throw Error('Use a fresh evidence folder');
  const client=await connect();const report={date:new Date().toISOString(),checks:[]};
  const host=code=>client.evaluate('new Promise(resolve=>new CSInterface().evalScript('+JSON.stringify(code)+',resolve))');
  const panel=code=>client.evaluate('(async()=>{'+code+'})()');
  const settle='await new Promise(r=>setTimeout(r,500));while(logoGuidesPanel.state.busy){await new Promise(r=>setTimeout(r,50));}if(document.getElementById("status").classList.contains("error"))throw Error(document.getElementById("status").textContent);';
  async function check(name,fn){try{const detail=await fn();report.checks.push({name,status:'pass',detail});}catch(e){report.checks.push({name,status:'fail',error:e.message});throw e;}}
  const settingsFile=await client.evaluate('require("path").join(new CSInterface().getSystemPath(SystemPath.USER_DATA),"LogoGuides","settings.json")');
  const previous=fs.existsSync(settingsFile)?fs.readFileSync(settingsFile):null;
  const g=JSON.parse(fs.readFileSync(path.join(__dirname,'samples/illustrator-boatchin.geometry.json'),'utf8'));
  try{
    await check('isolated native BOATCHIN setup',async()=>{
      const result=await host('var LG_READ_TEST=(function(){var original=app.documents.length?app.activeDocument:null;var d=app.documents.add(DocumentColorSpace.RGB,700,500);var g='+JSON.stringify(g)+';d.artboards[0].artboardRect=g.artboard;var sources=[],i,j,k,p,c,item,parent;for(i=0;i<g.parts.length;i++){p=g.parts[i];parent=p.contours.length>1?d.activeLayer.compoundPathItems.add():d.activeLayer;for(j=0;j<p.contours.length;j++){c=p.contours[j];item=parent.pathItems.add();var anchors=[];for(k=0;k<c.points.length;k++){anchors.push(c.points[k].a);}item.setEntirePath(anchors);item.closed=c.closed;item.filled=true;item.stroked=false;var color=new RGBColor();color.red=52;color.green=73;color.blue=215;item.fillColor=color;for(k=0;k<c.points.length;k++){item.pathPoints[k].leftDirection=c.points[k].l;item.pathPoints[k].rightDirection=c.points[k].r;}}sources.push(p.contours.length>1?parent:item);}d.selection=sources;return {doc:d,original:original};}());"ready";');
      if(result!=='ready')throw Error(result);return result;
    });
    await check('CEP generate and all-family avoidance',async()=>panel('const c=logoGuidesPanel;await c.init();c.state.settings=LG.config.defaults();await c.run("selection");window.LG_READ_GEOMETRY=JSON.stringify(c.state.geometry);const r=c.state.result;const labels=r.render.primitives.filter(p=>p.type==="label"&&p.layer==="labels");let collisions=0;for(let i=0;i<labels.length;i++){const a=LG.layout.labelBounds(labels[i],r.render.fontSize);for(let j=i+1;j<labels.length;j++){const b=LG.layout.labelBounds(labels[j],r.render.fontSize);if(a[0]<b[2]&&a[2]>b[0]&&a[3]<b[1]&&a[1]>b[3])collisions++;}}if(collisions)throw Error("Label boxes overlap: "+collisions);return {labels:labels.length,collisions,base:c.state.docData.baseUnit};'));
    await check('actual appearance UI events and persisted settings',async()=>panel('function change(id,value){const e=document.getElementById(id);e.value=value;e.dispatchEvent(new Event("change"));}change("labelFontSize","4.5");change("textColor","#112233");change("lineColor","#445566");change("dashLength","1.5");change("dashGap","0.75");change("dashMode","dashed");'+settle+'const c=logoGuidesPanel;if(c.state.settings.fontSize!==4.5)throw Error("Font not applied");if(c.state.settings.appearance.textColor!=="#112233")throw Error("Color not applied");const data=await c.init();if(data.settings.appearance.dashLength!==1.5)throw Error("Appearance not persisted");return {font:c.state.settings.fontSize,appearance:c.state.settings.appearance};'));
    await check('native text metrics, colors and physical stroke dashes',async()=>{
      const data=JSON.parse(await host('(function(){var LG={};'+fs.readFileSync(path.join(__dirname,'../src/core/01_json2.js'),'utf8')+';var d=LG_READ_TEST.doc;var textLayer=null,lineLayer=null;var i,j;for(i=0;i<d.layers.length;i++){if(d.layers[i].name==="Logo Guides"){for(j=0;j<d.layers[i].layers.length;j++){var l=d.layers[i].layers[j];if(l.name==="LG Labels"){textLayer=l;}if(l.name==="LG Baselines"){lineLayer=l;}}}}var t=textLayer.groupItems[0].textFrames[0];var line=lineLayer.pathItems[0];var bounds=[];for(i=0;i<textLayer.groupItems.length;i++){var b=textLayer.groupItems[i].geometricBounds;bounds.push([b[0],b[1],b[2],b[3]]);}return LG.json.stringify({font:t.textRange.characterAttributes.size,text:[t.textRange.characterAttributes.fillColor.red,t.textRange.characterAttributes.fillColor.green,t.textRange.characterAttributes.fillColor.blue],line:[line.strokeColor.red,line.strokeColor.green,line.strokeColor.blue],dashes:line.strokeDashes,bounds:bounds});}())'));
      if(data.font!==4.5||data.text.join(',')!=='17,34,51'||data.line.join(',')!=='68,85,102'||data.dashes[0]!==1.5||data.dashes[1]!==0.75)throw Error('Native appearance mismatch');
      let collisions=0;data.bounds.forEach((a,i)=>data.bounds.slice(i+1).forEach(b=>{if(a[0]<b[2]&&a[2]>b[0]&&a[3]<b[1]&&a[1]>b[3])collisions++;}));
      if(collisions)throw Error('Native label overlap: '+collisions);
      delete data.bounds;return {...data,collisions};
    });
    await check('tidy button is repeatable and retains source geometry and locked base',async()=>panel('const c=logoGuidesPanel;const base=c.state.docData.baseUnit.value;document.getElementById("tidyPresentation").click();'+settle+'const first=c.state.settings.fontSize;document.getElementById("tidyPresentation").click();'+settle+'if(first!==c.state.settings.fontSize)throw Error("Repeated tidy shrinks again");if(!c.state.curated||c.state.settings.circleDisplay!=="extended"||c.state.settings.features.angles||c.state.settings.features.deviationMarkers||c.state.settings.features.constructionLines)throw Error("Tidy flags missing");if(window.LG_READ_GEOMETRY!==JSON.stringify(c.state.geometry)||base!==c.state.docData.baseUnit.value)throw Error("Source or a changed");return {font:first,base,primitives:c.state.result.render.primitives.length};'));
    await check('native tidy artwork export',async()=>{const target=path.join(folder,'artwork.png').replace(/\\/g,'/');const result=await host('var LG_READ_EXPORT=new ExportOptionsPNG24();LG_READ_EXPORT.antiAliasing=true;LG_READ_EXPORT.transparency=false;LG_READ_EXPORT.artBoardClipping=false;LG_READ_EXPORT.horizontalScale=300;LG_READ_EXPORT.verticalScale=300;LG_READ_TEST.doc.exportFile(new File('+JSON.stringify(target)+'),ExportType.PNG24,LG_READ_EXPORT);"exported";');if(result!=='exported')throw Error(result);return 'artwork.png';});
    const metrics=await client.send('Page.getLayoutMetrics');const screenshot=await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width:metrics.contentSize.width,height:metrics.contentSize.height,scale:1}});fs.writeFileSync(path.join(folder,'panel.png'),Buffer.from(screenshot.data,'base64'));
    report.status='pass';
  }catch(e){report.status='fail';report.error=e.message;}
  finally{
    try{await host('if(typeof LG_READ_TEST!=="undefined"&&LG_READ_TEST){LG_READ_TEST.doc.close(SaveOptions.DONOTSAVECHANGES);if(LG_READ_TEST.original){LG_READ_TEST.original.activate();}LG_READ_TEST=null;}"closed";');}catch(e){report.cleanupError=e.message;report.status='fail';}
    if(previous===null){if(fs.existsSync(settingsFile))fs.unlinkSync(settingsFile);}else fs.writeFileSync(settingsFile,previous);
    try{await panel('delete window.LG_READ_GEOMETRY;await logoGuidesPanel.init();');}catch(e){report.restoreError=e.message;report.status='fail';}
    fs.writeFileSync(path.join(folder,'results.json'),JSON.stringify(report,null,2)+'\n');client.close();
  }return report;
}
if(require.main===module)run(process.argv[2]).then(r=>{console.log(JSON.stringify(r,null,2));if(r.status!=='pass')process.exitCode=1;}).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={run};
