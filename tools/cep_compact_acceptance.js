'use strict';
// Additional native checks for the compact panel; use only an isolated fixture.
const fs=require('node:fs'),path=require('node:path');
const {connect}=require('./cep_client');
const {F9}=require('./test/fixtures');
async function run(folder){
 folder=path.resolve(folder);fs.mkdirSync(folder,{recursive:true});
 if(fs.existsSync(path.join(folder,'results.json')))throw Error('Use a fresh evidence directory');
 const client=await connect();const report={date:new Date().toISOString(),checks:[]};
 const panel=code=>client.evaluate('(async()=>{'+code+'})()');
 const host=code=>client.evaluate('new Promise(resolve=>new CSInterface().evalScript('+JSON.stringify(code)+',resolve))');
 const settle='await new Promise(r=>setTimeout(r,400));while(logoGuidesPanel.state.busy)await new Promise(r=>setTimeout(r,25));if(document.getElementById("status").classList.contains("error"))throw Error(document.getElementById("status").textContent);';
 async function check(name,fn){try{const detail=await fn();report.checks.push({name,status:'pass',detail});}catch(error){report.checks.push({name,status:'fail',error:error.message});throw error;}}
 const settingsFile=await panel('return require("path").join(new CSInterface().getSystemPath(SystemPath.USER_DATA),"LogoGuides","settings.json");');
 const previous=fs.existsSync(settingsFile)?fs.readFileSync(settingsFile):null;
 try{
  const geometry=F9();
  const ready=await host(`var LG_COMPACT_TEST=(function(){var original=app.documents.length?app.activeDocument:null;var d=app.documents.add(DocumentColorSpace.RGB,700,500);d.layers[0].name="LG compact isolated test";var g=${JSON.stringify(geometry)};d.artboards[0].artboardRect=g.artboard;var sources=[];for(var i=0;i<g.parts.length;i++){var p=g.parts[i];var container=p.contours.length>1?d.activeLayer.compoundPathItems.add():d.activeLayer;for(var j=0;j<p.contours.length;j++){var c=p.contours[j];var item=container.pathItems.add();var anchors=[];for(var k=0;k<c.points.length;k++)anchors.push(c.points[k].a);item.setEntirePath(anchors);item.closed=c.closed;item.filled=true;item.stroked=false;for(k=0;k<c.points.length;k++){item.pathPoints[k].leftDirection=c.points[k].l;item.pathPoints[k].rightDirection=c.points[k].r;}}sources.push(p.contours.length>1?container:item);}d.selection=sources;return {doc:d,original:original};}());"ready";`);
  if(ready!=='ready')throw Error(ready);
  await panel('const c=logoGuidesPanel;await c.init();c.state.settings=LG.config.defaults();c.state.curated=false;await c.run("selection");window.LG_COMPACT_GEOMETRY=JSON.stringify(c.state.geometry);window.LG_COMPACT_SUGGEST=LGPanelAI.suggest;');
  await check('eight parameter selects and fifteen generation switches retain their events',async()=>panel(`
   const c=logoGuidesPanel;const fields=[...document.querySelectorAll('#parameters select')];
   for(const input of fields){input.selectedIndex=input.options.length-1;input.dispatchEvent(new Event('change'));}
   ${settle}
   for(const input of fields)if(String(c.state.settings[input.id.slice(8)])!==input.value)throw Error(input.id);
   const checks=[...document.querySelectorAll('#features input')];
   for(const input of checks){input.checked=!input.checked;input.dispatchEvent(new Event('change'));}
   ${settle}
   for(const input of checks)if(c.state.settings.features[input.id.slice(8)]!==input.checked)throw Error(input.id);
   c.state.settings=LG.config.defaults();await c.run('sources');return {fields:fields.length,switches:checks.length};
  `));
  await check('undrawn, hidden and visible feature selection have distinct real host results',async()=>panel(`
   const c=logoGuidesPanel;const input=document.getElementById('feature-stemWidths');input.checked=false;input.dispatchEvent(new Event('change'));${settle}
   let f=c.state.features.find(f=>f.type==='stem');if(!f)throw Error('Missing measured stem');
   const absent=await c.select(f.id);if(absent.matched!==0||!/当前未绘制/.test(c.state.status))throw Error(c.state.status);
   input.checked=true;input.dispatchEvent(new Event('change'));${settle}
   f=c.state.features.find(f=>f.type==='stem');await c.visible(f.id,false);const hidden=await c.select(f.id);if(!hidden.matched||hidden.selected||!/已隐藏/.test(c.state.status))throw Error(c.state.status);
   await c.visible(f.id,true);const visible=await c.select(f.id);if(!visible.selected||!/已选中/.test(c.state.status))throw Error(c.state.status);
   return {absent,hidden,visible};
  `));
  await check('busy AI request disables business controls and leaves accessible tabs usable',async()=>panel(`
   const c=logoGuidesPanel;await c.run('sources');LGPanelAI.suggest=()=>new Promise(resolve=>{window.LG_COMPACT_RELEASE=resolve;});
   const request=c.requestAI({provider:'openai',baseUrl:'https://example.test/v1',model:'test',apiKey:'test-only'},'check');
   while(!window.LG_COMPACT_RELEASE)await new Promise(r=>setTimeout(r,25));
   try{
    if([...document.querySelectorAll('button:not([role=tab]),input,select')].some(e=>!e.disabled))throw Error('Enabled business control');
    if([...document.querySelectorAll('[role=tab]')].some(e=>e.disabled))throw Error('Disabled tab');
    document.getElementById('tab-ai').click();document.getElementById('tab-ai').dispatchEvent(new KeyboardEvent('keydown',{key:'Home',bubbles:true}));
    if(document.activeElement.id!=='tab-parameters'||document.getElementById('page-parameters').hidden)throw Error('Keyboard navigation');
   }finally{LG_COMPACT_RELEASE({show:[],hide:[],targets:[],groups:[],notes:'<b>literal text</b>'});await request;delete window.LG_COMPACT_RELEASE;}
   if(document.querySelector('#aiAdvice b')||document.getElementById('tab-ai').textContent!=='AI •')throw Error('Advice state');
   LGPanelAI.suggest=LG_COMPACT_SUGGEST;await c.run('sources');return {tabs:4,plainText:true};
  `));
  await check('real provider selector restores custom baseUrl without touching saved credentials',async()=>panel(`
   const provider=document.getElementById('aiProvider'),url=document.getElementById('aiBaseUrl');const before={provider:provider.value,url:url.value,readOnly:url.readOnly};
   try{provider.value='openai';provider.dispatchEvent(new Event('change'));url.value='https://example.test/v1';provider.value='anthropic';provider.dispatchEvent(new Event('change'));if(url.value!=='https://api.anthropic.com/v1'||!url.readOnly)throw Error('Anthropic fields');provider.value='openai';provider.dispatchEvent(new Event('change'));if(url.value!=='https://example.test/v1'||url.readOnly)throw Error('Endpoint not restored');return {roundTrip:true};}
   finally{provider.value='openai';provider.dispatchEvent(new Event('change'));url.value=before.provider==='openai'?before.url:'';if(before.provider==='anthropic'){provider.value='anthropic';provider.dispatchEvent(new Event('change'));}}
  `));
  await check('appearance inputs preserve input/change events and tidy remains dark and idempotent',async()=>panel(`
   const c=logoGuidesPanel;
   for(const [id,value] of [['labelFontSize','5'],['labelDecimals','4'],['strokeWidth','0.7'],['dashMode','dashed'],['dashLength','4'],['dashGap','2.5'],['circleDisplay','extended']]){const el=document.getElementById(id);el.value=value;el.dispatchEvent(new Event('change'));}
   const arc=document.getElementById('circleExtend');arc.value='45';arc.dispatchEvent(new Event('input'));${settle}
   if(c.state.settings.circleExtendDeg!==45||c.state.settings.labelDecimals!==4||c.state.settings.appearance.strokeWidth!==0.7)throw Error('Appearance events');
   document.getElementById('tidyPresentation').click();${settle}const size=c.state.settings.fontSize;document.getElementById('tidyPresentation').click();${settle}
   if(c.state.settings.fontSize!==size||c.state.settings.stylePreset!=='light'||document.body.classList.contains('light'))throw Error('Tidy changed theme or size');
   document.getElementById('resetAppearance').click();${settle}
   if(c.state.settings.fontSize!==0||c.state.settings.labelDecimals!==2||c.state.settings.circleExtendDeg!==30)throw Error('Reset failed');
   if(JSON.stringify(c.state.geometry)!==LG_COMPACT_GEOMETRY)throw Error('Source geometry changed');return {tidySize:size,theme:getComputedStyle(document.body).backgroundColor};
  `));
  await check('real CEP geometry and tab screenshots at all required sizes',async()=>{
   const layouts=[];
   for(const [width,height] of [[280,600],[320,420],[400,420],[320,780],[400,780]]){
    await client.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    for(const tab of ['parameters','appearance','features','ai']){
     const detail=await panel(`document.querySelector('[data-tab=${tab}]').click();const p=document.getElementById('page-${tab}');return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,outer:p.scrollHeight-p.clientHeight,list:document.getElementById('featureList').clientHeight,controls:document.querySelector('.fixed-area').clientHeight};`);
     if(detail.width!==detail.scrollWidth||(width>=320&&detail.controls>90)||(height===780&&detail.outer>1)||(height===420&&tab==='parameters'&&detail.outer>120)||(height===420&&tab==='features'&&detail.list<120))throw Error(JSON.stringify({width,height,tab,...detail}));
     if(height===420&&tab==='ai')await panel('const text=document.getElementById("aiSummary"),p=document.getElementById("page-ai");text.parentElement.open=true;try{if(p.scrollHeight>p.clientHeight)throw Error("Summary causes nested outer scrolling");}finally{text.parentElement.open=false;}');
     layouts.push({width,height,tab,...detail});
     const shot=await client.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(folder,width+'x'+height+'-'+tab+'.png'),Buffer.from(shot.data,'base64'));
    }
   }
   return layouts;
  });
  report.status='pass';
 }catch(error){report.status='fail';report.error=error.message;}
 finally{
  try{await client.send('Emulation.clearDeviceMetricsOverride');await panel('if(window.LG_COMPACT_SUGGEST)LGPanelAI.suggest=LG_COMPACT_SUGGEST;delete window.LG_COMPACT_SUGGEST;delete window.LG_COMPACT_GEOMETRY;');}catch(error){report.restoreError=error.message;report.status='fail';}
  try{await host('if(typeof LG_COMPACT_TEST!=="undefined"&&LG_COMPACT_TEST){LG_COMPACT_TEST.doc.close(SaveOptions.DONOTSAVECHANGES);if(LG_COMPACT_TEST.original)LG_COMPACT_TEST.original.activate();LG_COMPACT_TEST=null;}"closed";');}catch(error){report.cleanupError=error.message;report.status='fail';}
  if(previous===null){if(fs.existsSync(settingsFile))fs.unlinkSync(settingsFile);}else fs.writeFileSync(settingsFile,previous);
  try{await panel('await logoGuidesPanel.init();document.getElementById("tab-parameters").click();');}catch(error){report.restorePanelError=error.message;report.status='fail';}
  fs.writeFileSync(path.join(folder,'results.json'),JSON.stringify(report,null,2)+'\n');client.close();
 }
 return report;
}
if(require.main===module)run(process.argv[2]).then(r=>{console.log(JSON.stringify(r,null,2));if(r.status!=='pass')process.exitCode=1;}).catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={run};
