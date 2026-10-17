'use strict';
// Run against the real project CEP renderer; use isolated Illustrator documents.
const fs=require('node:fs');
const path=require('node:path');
const {connect}=require('./cep_client');
const fixtures=require('./test/fixtures');
const {bundleFiles,sourceFiles,asciiEscape}=require('./build');
async function run(folder) {
  folder=path.resolve(folder);fs.mkdirSync(folder,{recursive:true});
  if(fs.existsSync(path.join(folder,'results.json')))throw new Error('Use a fresh evidence directory');
  const client=await connect();
  const report={date:new Date().toISOString(),runtime:await client.evaluate('({versions:process.versions,cep:!!window.__adobe_cep__,url:location.href})'),checks:[]};
  async function host(source){return client.evaluate('new Promise(resolve=>new CSInterface().evalScript('+JSON.stringify(source)+',resolve))');}
  async function check(name,fn){try{const detail=await fn();report.checks.push({name,status:'pass',detail});return detail;}catch(error){report.checks.push({name,status:'fail',error:error.message});throw error;}}
  async function panel(code){return client.evaluate('(async()=>{'+code+'})()');}
  const settle='await new Promise(resolve=>setTimeout(resolve,400));while(logoGuidesPanel.state.busy){await new Promise(resolve=>setTimeout(resolve,50));}if(document.getElementById("status").classList.contains("error"))throw Error(document.getElementById("status").textContent);';
  function setup(g){return `var LG_CEP_TEST=(function(){var original=app.documents.length?app.activeDocument:null;var d=app.documents.add(DocumentColorSpace.RGB,700,500);var g=${JSON.stringify(g)};d.layers[0].name="LG CEP isolated test";d.artboards[0].artboardRect=g.artboard;var sources=[],i,j,k,p,c,item,container;for(i=0;i<g.parts.length;i++){p=g.parts[i];container=p.contours.length>1?d.activeLayer.compoundPathItems.add():d.activeLayer;for(j=0;j<p.contours.length;j++){c=p.contours[j];item=container.pathItems.add();var anchors=[];for(k=0;k<c.points.length;k++){anchors.push(c.points[k].a);}item.setEntirePath(anchors);item.closed=c.closed;item.filled=true;item.stroked=false;for(k=0;k<c.points.length;k++){item.pathPoints[k].leftDirection=c.points[k].l;item.pathPoints[k].rightDirection=c.points[k].r;}}sources.push(p.contours.length>1?container:item);}d.selection=sources;return {doc:d,original:original,sources:sources};}());"ready";`;}
  async function cleanup(){const result=await host('if(typeof LG_CEP_TEST!=="undefined"&&LG_CEP_TEST){LG_CEP_TEST.doc.close(SaveOptions.DONOTSAVECHANGES);if(LG_CEP_TEST.original){LG_CEP_TEST.original.activate();}LG_CEP_TEST=null;}"closed";');if(result!=='closed')throw new Error(result);}
  const settingsFile=await client.evaluate('require("path").join(new CSInterface().getSystemPath(SystemPath.USER_DATA),"LogoGuides","settings.json")');
  const previous=fs.existsSync(settingsFile)?fs.readFileSync(settingsFile):null;
  const dumpFile=path.join(path.dirname(settingsFile),'geometry_dump.json');
  const previousDump=fs.existsSync(dumpFile)?fs.readFileSync(dumpFile):null;
  try {
    await check('F9 native fixture setup',async()=>{const r=await host(setup(fixtures.F9()));if(r!=='ready')throw new Error(r);return r;});
    await check('real CEP generate button',async()=>panel('const c=logoGuidesPanel;await c.init();c.state.settings=LG.config.defaults();document.getElementById("generate").click();await new Promise((resolve,reject)=>{const start=Date.now();function poll(){if(!c.state.busy&&c.state.result)return resolve();if(Date.now()-start>15000)return reject(Error(document.getElementById("status").textContent));setTimeout(poll,50);}setTimeout(poll,50);});return {timing:c.state.timing,primitives:c.state.result.render.primitives.length,status:document.getElementById("status").textContent};'));
    await check('real CEP V8 and native ExtendScript primitive parity <=1e-6',async()=>{
      const snapshot=await panel('const c=logoGuidesPanel;return {geometry:c.state.geometry,settings:c.state.settings,render:c.state.result.render};');
      const core=bundleFiles(sourceFiles(path.resolve(__dirname,'../src/core')));
      const native=JSON.parse(await host(asciiEscape('(function(){'+core+'\nreturn LG.json.stringify(LG.analyze('+JSON.stringify(snapshot.geometry)+','+JSON.stringify(snapshot.settings)+').render);}())')));
      let maxError=0;function compare(a,b){if(typeof a!==typeof b)throw Error('Primitive type mismatch');if(typeof a==='number'){maxError=Math.max(maxError,Math.abs(a-b));if(!(Math.abs(a-b)<=1e-6))throw Error('Primitive number mismatch');}else if(a&&typeof a==='object'){if(Object.keys(a).join('|')!==Object.keys(b).join('|'))throw Error('Primitive fields mismatch');for(const key of Object.keys(a))compare(a[key],b[key]);}else if(a!==b)throw Error('Primitive value mismatch');}
      compare(snapshot.render,native);return {primitives:native.primitives.length,maxNumericError:maxError};
    });
    await check('visible feature actual native selection',async()=>panel('const c=logoGuidesPanel;const f=c.state.features.find(f=>f.type==="line");const r=await c.select(f.id);if(!r.selected)throw Error("Native selected count is zero: "+JSON.stringify(r));return r;'));
    await check('hide, refresh geometry match, show',async()=>panel('const c=logoGuidesPanel;const f=c.state.features.find(f=>f.type==="line");await c.visible(f.id,false);await c.run("sources");if(!c.state.hidden.length)throw Error("Hidden match lost");await c.visible(c.state.hidden[0].id,true);return {hidden:c.state.hidden.length};'));
    await check('manual a and automatic a',async()=>panel('const c=logoGuidesPanel;await c.base(10,true);if(c.state.docData.baseUnit.value!==10||!c.state.docData.baseUnit.locked)throw Error("Manual a lost");await c.base(null,false);if(c.state.docData.baseUnit.locked)throw Error("Automatic a locked");return c.state.docData.baseUnit;'));
    await check('style and curated refresh, geometry dump',async()=>panel('const c=logoGuidesPanel;c.state.settings.stylePreset="light";c.state.curated=true;await c.run("sources");const dump=JSON.parse(await c.dump());if(!dump.parts.length||!document.body.classList.contains("light"))throw Error("Style or dump failed");return {parts:dump.parts.length,features:c.state.features.length};'));
    await check('switched native document rejects delayed refresh and clear',async()=>{
      const created=await host('var LG_CEP_OTHER=app.documents.add(DocumentColorSpace.RGB,300,300);"ready";');if(created!=='ready')throw Error(created);
      try{return await panel('const c=logoGuidesPanel;let rejected=0;for(const action of [()=>c.run("sources"),()=>c.clear("data"),()=>c.base(15,true)]){try{await action();}catch(error){if(!/文档已切换/.test(error.message))throw error;rejected++;}}if(rejected!==3)throw Error("Cross-document operation was accepted");return {rejected};');}
      finally{await host('LG_CEP_OTHER.close(SaveOptions.DONOTSAVECHANGES);LG_CEP_OTHER=null;LG_CEP_TEST.doc.activate();"closed";');}
    });
    await check('actual UI measurements, visibility, selection, style, slider and dump buttons',async()=>{
      const result=await panel('document.getElementById("measure").click();'+settle+'const c=logoGuidesPanel;if(!c.state.candidates.length)throw Error("Candidates missing");const checkbox=document.querySelector("#featureList input");checkbox.click();'+settle+'if(!c.state.hidden.length)throw Error("UI hide failed");document.querySelector("#featureList input:not(:checked)").click();'+settle+'document.querySelector("#featureList .feature button").click();'+settle+'const style=document.getElementById("setting-stylePreset");style.value="dark";style.dispatchEvent(new Event("change"));'+settle+'const fit=document.getElementById("circleFit");fit.value="0.025";fit.dispatchEvent(new Event("input"));'+settle+'if(c.state.settings.advanced.circleFitTol!==0.025)throw Error("Slider failed");document.getElementById("curated").click();'+settle+'document.getElementById("dump").click();'+settle+'return {candidates:c.state.candidates.length,status:document.getElementById("status").textContent};');
      const dump=JSON.parse(fs.readFileSync(dumpFile,'utf8'));if(dump.parts.length!==2)throw new Error('UI dump file mismatch');return result;
    });
    await client.evaluate('window.scrollTo(0,0)');const metrics=await client.send('Page.getLayoutMetrics');
    const shot=await client.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width:metrics.contentSize.width,height:metrics.contentSize.height,scale:1}});fs.writeFileSync(path.join(folder,'panel.png'),Buffer.from(shot.data,'base64'));
    for(const mode of ['auto','all','data'])await check('clear UI '+mode,async()=>panel('const c=logoGuidesPanel;document.querySelector("[data-clear='+mode+']").click();'+settle+(mode==='data'?'':'await c.run("sources");')+'return {status:c.state.status,hasData:!!c.state.docData};'));
    await cleanup();
    await check('F10 native fixture setup',async()=>{const r=await host(setup(fixtures.F10()));if(r!=='ready')throw new Error(r);return r;});
    await check('F10 real CEP generation and refresh <=3000ms',async()=>panel('const c=logoGuidesPanel;await c.init();c.state.settings=LG.config.defaults();c.state.curated=false;const generated=await c.run("selection");const refreshed=await c.run("sources");if(refreshed.timing.totalMs>3000)throw Error("F10 refresh exceeded 3000ms: "+JSON.stringify(refreshed.timing));return {generate:generated.timing,refresh:refreshed.timing,primitives:refreshed.result.render.primitives.length};'));
    report.status='pass';
  } catch(error){report.status='fail';report.error=error.message;}
  finally {
    try{await cleanup();}catch(error){report.cleanupError=error.message;report.status='fail';}
    if(previous!==null)fs.writeFileSync(settingsFile,previous);else if(fs.existsSync(settingsFile))fs.unlinkSync(settingsFile);
    if(previousDump!==null)fs.writeFileSync(dumpFile,previousDump);else if(fs.existsSync(dumpFile))fs.unlinkSync(dumpFile);
    fs.writeFileSync(path.join(folder,'results.json'),JSON.stringify(report,null,2)+'\n');client.close();
  }
  return report;
}
if(require.main===module)run(process.argv[2]).then(r=>{console.log(JSON.stringify(r,null,2));if(r.status!=='pass')process.exitCode=1;}).catch(e=>{console.error(e);process.exitCode=1;});
module.exports={run};
