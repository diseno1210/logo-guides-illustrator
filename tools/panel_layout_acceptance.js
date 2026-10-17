'use strict';
// Isolated headless browser; never attaches to a personal browser profile.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawn}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const assert=require('node:assert/strict');
const {loadCore}=require('./test/load_core');
const fixtures=require('./test/fixtures');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function run(folder,baseline=false){
 folder=path.resolve(folder);fs.mkdirSync(folder,{recursive:true});
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'lg-layout-'));
 const chrome=process.env.LG_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
 const child=spawn(chrome,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--allow-file-access-from-files','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore',windowsHide:true});
 let socket;const report={baseline,checks:[],layouts:[]};
 try{
  const portFile=path.join(profile,'DevToolsActivePort');let start=Date.now();
  while(!fs.existsSync(portFile)){if(Date.now()-start>15000)throw Error('Headless browser did not start');await delay(100);}
  const port=fs.readFileSync(portFile,'utf8').split('\n')[0];
  const pages=await(await fetch('http://127.0.0.1:'+port+'/json')).json();
  socket=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
  let sequence=0;const pending=new Map();
  socket.onmessage=event=>{const msg=JSON.parse(event.data);if(pending.has(msg.id)){const p=pending.get(msg.id);pending.delete(msg.id);clearTimeout(p.timer);msg.error?p.reject(Error(msg.error.message)):p.resolve(msg.result);}};
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;const timer=setTimeout(()=>{pending.delete(id);reject(Error('Browser timeout: '+method));},15000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
  await send('Page.enable');
  await send('Page.navigate',{url:pathToFileURL(path.resolve(__dirname,'../dist/panel/index.html')).href});
  while(!await evaluate('!!document.getElementById("setting-stylePreset")'))await delay(50);
  const check=(name,value)=>{report.checks.push({name,pass:!!value});assert.ok(value,name);};
  for(const [width,height] of [[280,600],[320,420],[400,420],[320,780],[400,780]]){
   await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
   const tabs=await evaluate('[...document.querySelectorAll("[role=tab]")].map(t=>t.dataset.tab)');
   for(const tab of tabs.length?tabs:['legacy']){
    if(tab!=='legacy')await evaluate('document.querySelector("[data-tab='+tab+']").click()');
    await delay(30);
    const metrics=await evaluate(`(()=>{const panel=document.querySelector('[role=tabpanel]:not([hidden])')||document.body;const fixed=document.querySelector('.fixed-area');const visible=[...document.querySelectorAll('button,input,select,label,p,summary,[role=tab]')].filter(e=>e.getClientRects().length);return {groups:[...panel.children].map(e=>({tag:e.tagName,id:e.id,height:e.getBoundingClientRect().height})),bodyWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,panelHeight:panel.clientHeight,scrollHeight:panel.scrollHeight,overflow:panel.scrollHeight-panel.clientHeight,fixedHeight:fixed?fixed.getBoundingClientRect().height:0,minFont:Math.min(...visible.map(e=>parseFloat(getComputedStyle(e).fontSize))),featureHeight:document.getElementById('featureList').clientHeight,requestTop:document.getElementById('aiRequest').getBoundingClientRect().top-panel.getBoundingClientRect().top,labelTop:document.getElementById('labelFontSize').getBoundingClientRect().top-panel.getBoundingClientRect().top,outside:visible.filter(e=>{const r=e.getBoundingClientRect();return r.right>innerWidth+1||r.left< -1;}).map(e=>e.id||e.tagName)};})()`);
    report.layouts.push({width,height,tab,...metrics});
    const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(folder,width+'x'+height+'-'+tab+'.png'),Buffer.from(shot.data,'base64'));
    if(!baseline){check(width+'x'+height+' '+tab+' width',metrics.scrollWidth===metrics.bodyWidth&&metrics.outside.length===0);check('font >=11',metrics.minFont>=11);if(width>=320)check('fixed <=90',metrics.fixedHeight<=90);if(height===780)check('no outer scroll',metrics.overflow<=1);if(height===420&&tab==='parameters')check('short parameter overflow <=120',metrics.overflow<=120);if(height===420&&tab==='features')check('six feature rows',metrics.featureHeight>=120);if(width===400&&height===780&&tab==='ai')check('AI action near top',metrics.requestTop<=60);if(tab==='appearance')check('font action near top',metrics.labelTop<=40);}
   }
  }
  const {LG,plain}=loadCore();const geometry={};for(const [name,fixture] of Object.entries(fixtures).filter(([n])=>/^F\d+b?$/.test(n)))geometry[name]=plain(LG.analyze(fixture(),{}));
  fs.writeFileSync(path.join(folder,'geometry-render.json'),JSON.stringify(geometry));
  if(!baseline){const before=path.resolve(__dirname,'../dist/dark-compact/baseline/layout/geometry-render.json');assert.deepEqual(geometry,JSON.parse(fs.readFileSync(before,'utf8')));check('F1-F10 geometry and render unchanged',true);}
  report.status='pass';
 }catch(error){report.status='fail';report.error=error.message;}
 finally{if(socket)socket.close();child.kill();fs.writeFileSync(path.join(folder,'results.json'),JSON.stringify(report,null,2)+'\n');}
 return report;
}
if(require.main===module)run(process.argv[2],process.argv.includes('--baseline')).then(r=>{console.log(JSON.stringify(r,null,2));if(r.status!=='pass')process.exitCode=1;});
module.exports={run};
