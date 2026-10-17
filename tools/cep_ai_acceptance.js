'use strict';
// M8 tests use this project's real CEP page and an isolated Illustrator document.
// Default: mock ONLY the remote response. --live: use locally entered config once.
const fs=require('node:fs'),path=require('node:path');
const {connect}=require('./cep_client');
const {F9}=require('./test/fixtures');
function setup(g){return `var LG_M8_TEST=(function(){var original=app.documents.length?app.activeDocument:null;var d=app.documents.add(DocumentColorSpace.RGB,700,500);var g=${JSON.stringify(g)};d.layers[0].name="LG M8 isolated test";d.artboards[0].artboardRect=g.artboard;var sources=[],i,j,k,p,c,item,container;for(i=0;i<g.parts.length;i++){p=g.parts[i];container=p.contours.length>1?d.activeLayer.compoundPathItems.add():d.activeLayer;for(j=0;j<p.contours.length;j++){c=p.contours[j];item=container.pathItems.add();var anchors=[];for(k=0;k<c.points.length;k++){anchors.push(c.points[k].a);}item.setEntirePath(anchors);item.closed=c.closed;item.filled=true;item.stroked=false;for(k=0;k<c.points.length;k++){item.pathPoints[k].leftDirection=c.points[k].l;item.pathPoints[k].rightDirection=c.points[k].r;}}sources.push(p.contours.length>1?container:item);}d.selection=sources;return {doc:d,original:original,sources:sources};}());"ready";`;}
async function run(folder,live=false){
 folder=path.resolve(folder);fs.mkdirSync(folder,{recursive:true});if(fs.existsSync(path.join(folder,'results.json')))throw Error('Use a fresh evidence folder');
 const client=await connect(),report={date:new Date().toISOString(),mode:live?'live':'mock-response-real-CEP',checks:[]};
 const panel=code=>client.evaluate('(async()=>{'+code+'})()');
 const host=source=>client.evaluate('new Promise(resolve=>new CSInterface().evalScript('+JSON.stringify(source)+',resolve))');
 async function check(name,fn){try{const detail=await fn();report.checks.push({name,status:'pass',detail});return detail;}catch(error){report.checks.push({name,status:'fail',error:error.message});throw error;}}
 const settingsFile=await panel('return require("path").join(new CSInterface().getSystemPath(SystemPath.USER_DATA),"LogoGuides","settings.json");');
 const previous=fs.existsSync(settingsFile)?fs.readFileSync(settingsFile):null;
 let originalAI;
 try{
  report.runtime=await panel('return {versions:process.versions,cep:!!window.__adobe_cep__};');
  if(await host(setup(F9()))!=='ready')throw Error('Native fixture failed');
  await panel('const c=logoGuidesPanel;await c.init();c.state.settings=LG.config.defaults();c.state.curated=false;await c.run("selection");window.LG_M8_BEFORE=JSON.stringify(c.state.geometry);window.LG_M8_ORIGINAL_SUGGEST=LGPanelAI.suggest;');originalAI=true;
  if(live){
   // Do not return, print, persist in evidence, or inspect the locally configured key.
   await check('real configured provider request',async()=>{
    await panel('document.getElementById("aiRequest").click();return true;');
    const started=Date.now();let state;
    do{await new Promise(resolve=>setTimeout(resolve,500));state=await panel('return {busy:logoGuidesPanel.state.busy,pending:!!logoGuidesPanel.state.ai.pending,status:logoGuidesPanel.state.status};');}while(state.busy && Date.now()-started<125000);
    if(state.busy || !state.pending)throw Error(state.status);
    return panel('const s=logoGuidesPanel.state.ai.pending;return {show:s.show.length,hide:s.hide.length,targets:s.targets.length,groups:s.groups.length,notesCharacters:s.notes.length};');
   });
  }else{
   await check('real UI requests, retries strict JSON, filters unknown ids and unsafe targets',async()=>panel(`
    const c=logoGuidesPanel;window.LG_M8_CALLS=0;
    LGPanelAI.suggest=(config,input)=>LG_M8_ORIGINAL_SUGGEST({provider:'openai',baseUrl:'https://example.test/v1',model:'mock',apiKey:'test-only'},input,{post:async(url,headers,body)=>{
     LG_M8_CALLS++;if(LG_M8_CALLS===1)return {choices:[{message:{content:'not JSON'}}]};
     const circle=input.features.find(f=>f.type==='circle'),line=input.features.find(f=>f.type==='line');
     return {choices:[{message:{content:JSON.stringify({show:[circle.id,'unknown'],hide:[line.id,'unknown'],targets:[{id:circle.id,target:circle.rRatio*1.04,reason:'半径建议'},{id:'S1',target:999999}],groups:[{title:'圆组',ids:[circle.id,'unknown']}],notes:'<b>仅文本说明</b>'})}}]};
    }});
    document.getElementById('aiRequest').click();await new Promise(resolve=>setTimeout(resolve,50));while(c.state.busy)await new Promise(resolve=>setTimeout(resolve,25));
    if(!c.state.ai.pending || LG_M8_CALLS!==2 || c.state.ai.pending.targets.length!==1 || c.state.ai.pending.show.includes('unknown') || document.querySelector('#aiAdvice b'))throw Error('Invalid UI suggestion');
    return {requests:LG_M8_CALLS,targets:c.state.ai.pending.targets.length,advice:document.getElementById('aiAdvice').textContent};
   `));
  }
  await check('real apply button and native target drawing preserve source geometry',async()=>{
   const result=await panel(`const c=logoGuidesPanel;document.getElementById('aiApply').click();await new Promise(resolve=>setTimeout(resolve,50));while(c.state.busy)await new Promise(resolve=>setTimeout(resolve,25));if(c.state.ai.pending || !/已应用/.test(c.state.status))throw Error(c.state.status);const r=await LGPanel.bridge(new CSInterface())('read',{mode:'sources',settings:c.state.settings,documentToken:c.state.documentToken});if(JSON.stringify(r.geometry)!==LG_M8_BEFORE)throw Error('Native source changed');return {primitives:c.state.result.render.primitives.length,targetPrimitives:c.state.result.render.primitives.filter(p=>p.layer==='targets').length,hidden:c.state.hidden.length,status:c.state.status};`);
   if(!live && !result.targetPrimitives)throw Error('Target circle was not drawn');
   const native=JSON.parse(await host('(function(){var n=0,h=0,d=app.activeDocument;for(var i=0;i<d.pageItems.length;i++){var p=d.pageItems[i];if(p.parent.typename==="Layer"&&p.parent.name==="LG Targets"){n+=1;}if(p.hidden){h+=1;}}return "{\\"targets\\":"+n+",\\"hidden\\":"+h+"}";}())'));
   if(native.targets!==result.targetPrimitives)throw Error('Native target count mismatch');return {...result,native};
  });
  await panel('document.querySelector("[data-tab=ai]").click();document.getElementById("aiSettings").open=false;document.getElementById("aiRequest").scrollIntoView({block:"center"});');
  const shot=await client.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(folder,'panel.png'),Buffer.from(shot.data,'base64'));
  if(!live){
   await check('real refresh removes session target overrides',async()=>panel('const c=logoGuidesPanel;await c.run("sources");if(c.state.result.render.primitives.some(p=>p.layer==="targets") || c.state.ai.notes)throw Error("Old targets retained");return {targets:0};'));
   await check('two invalid JSON replies automatically fall back to curated in real CEP',async()=>panel(`const c=logoGuidesPanel;let calls=0;LGPanelAI.suggest=(config,input)=>LG_M8_ORIGINAL_SUGGEST({provider:'openai',baseUrl:'https://example.test/v1',model:'mock',apiKey:'test-only'},input,{post:async()=>{calls++;return {choices:[{message:{content:'invalid'}}]};}});await c.requestAI({},'presentation');if(!c.state.curated || calls!==2 || c.state.ai.pending)throw Error('Fallback failed');return {calls,status:c.state.status};`));
   await check('source edit between suggestion and apply is rejected before native draw',async()=>{
    await panel('LGPanelAI.suggest=async()=>({show:[],hide:[],targets:[],groups:[],notes:"test"});await logoGuidesPanel.requestAI({},"check");');
    await host('var LG_M8_ANCHOR=LG_M8_TEST.sources[0].pathPoints[0].anchor;LG_M8_TEST.sources[0].pathPoints[0].anchor=[LG_M8_ANCHOR[0]+1,LG_M8_ANCHOR[1]];"moved";');
    return panel('let rejected=false;try{await logoGuidesPanel.applyAI();}catch(error){rejected=/已改变/.test(error.message);}if(!rejected)throw Error("Stale geometry applied");return {rejected};');
   });
   await panel('await logoGuidesPanel.run("sources");LGPanelAI.suggest=()=>new Promise(resolve=>{window.LG_M8_RESOLVE=resolve;});window.LG_M8_PENDING=logoGuidesPanel.requestAI({},"check").then(()=>false,error=>/文档已切换/.test(error.message));');
   await host('var LG_M8_OTHER=app.documents.add(DocumentColorSpace.RGB,200,200);"ready";');
   try{await check('switch native document during network wait rejects delayed suggestion',async()=>panel('LG_M8_RESOLVE({show:[],hide:[],targets:[],groups:[],notes:"late"});const rejected=await LG_M8_PENDING;if(!rejected)throw Error("Cross-document AI response accepted");return {rejected};'));}
   finally{await host('LG_M8_OTHER.close(SaveOptions.DONOTSAVECHANGES);LG_M8_OTHER=null;LG_M8_TEST.doc.activate();"closed";');}
  }
  report.status='pass';
 }catch(error){report.status='fail';report.error=error.message;}
 finally{
  if(originalAI)try{await panel('LGPanelAI.suggest=LG_M8_ORIGINAL_SUGGEST;delete window.LG_M8_BEFORE;delete window.LG_M8_ORIGINAL_SUGGEST;delete window.LG_M8_RESOLVE;delete window.LG_M8_PENDING;delete window.LG_M8_CALLS;');}catch(error){report.restoreError=error.message;}
  try{await host('if(typeof LG_M8_TEST!=="undefined"&&LG_M8_TEST){LG_M8_TEST.doc.close(SaveOptions.DONOTSAVECHANGES);if(LG_M8_TEST.original){LG_M8_TEST.original.activate();}LG_M8_TEST=null;}"closed";');}catch(error){report.cleanupError=error.message;report.status='fail';}
  if(previous!==null)fs.writeFileSync(settingsFile,previous);else if(fs.existsSync(settingsFile))fs.unlinkSync(settingsFile);
  try{await panel('await logoGuidesPanel.init();');}catch(error){report.panelRestoreError=error.message;report.status='fail';}
  fs.writeFileSync(path.join(folder,'results.json'),JSON.stringify(report,null,2)+'\n');client.close();
 }
 return report;
}
if(require.main===module)run(process.argv[2],process.argv.includes('--live')).then(result=>{console.log(JSON.stringify(result,null,2));if(result.status!=='pass')process.exitCode=1;}).catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={run};
