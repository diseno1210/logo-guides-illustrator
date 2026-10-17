'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const {EventEmitter}=require('node:events');
const ai=require('../../src/panel/js/ai');
const {loadCore}=require('./load_core');
const {sourceFiles,bundleFiles}=require('../build');
const fixtures=require('./fixtures');
const root=path.resolve(__dirname,'../..');
const config={provider:'openai',baseUrl:'https://example.test/v1/',model:'test-model',apiKey:'test-only-key'};
const answer=()=>({show:[],hide:[],targets:[],groups:[],notes:'说明'});
const envelope=value=>({choices:[{message:{content:typeof value==='string'?value:JSON.stringify(value)}}]});
function snapshot(){const {LG}=loadCore();return ai.summary(LG.analyze(fixtures.F9(),{}).analysis,'check');}

test('M8 summary uses only whitelisted numeric evidence, no geometry, artwork names or key',()=>{
 const {LG}=loadCore();const analysis=LG.analyze(fixtures.F9(),{}).analysis;
 analysis.secret='never-send';analysis.circles[0].name='never-send';analysis.circles[0].apiKey='never-send';
 const input=ai.summary(analysis,'presentation'),text=JSON.stringify(input);
 assert.deepEqual(Object.keys(input),['a','S','rowCount','goal','features']);assert.doesNotMatch(text,/never-send|bbox|partIds|samples|contours|cx|cy/);
 const circle=input.features.find(f=>f.type==='circle');assert.equal(circle.fitErrPct,100*analysis.circles[0].maxErr/analysis.circles[0].r);
 assert.equal(circle.rRatio,analysis.circles[0].measureR.ratio);assert.throws(()=>ai.summary(analysis,'other'));
});
test('M8 strict schema, unknown ids, duplicates, hide precedence and untrusted text',()=>{
 const input=snapshot(),id=input.features[0].id;const value=answer();
 value.show=[id,id,'unknown',null];value.hide=[id];value.groups=[{title:'<script>unsafe()</script>',ids:[id,'unknown']},null,{title:'empty',ids:['unknown']}];
 const valid=ai.validate(value,input);assert.deepEqual(valid.show,[]);assert.deepEqual(valid.hide,[id]);assert.equal(valid.groups.length,1);assert.equal(valid.groups[0].title,'<script>unsafe()</script>');
 for(const bad of [null,[],{}, {...answer(),show:'all'},{...answer(),notes:42}])assert.throws(()=>ai.validate(bad,input),/结构/);
});
test('M8 target limits use measured ratio (not previous target); angles use absolute degrees',()=>{
 const input={features:[{id:'S1',type:'stem',ratio:2,target:1},{id:'C1',type:'circle',rRatio:2},{id:'A1',type:'angle',deg:70}]};
 function accept(id,target){return ai.validate({...answer(),targets:[{id,target}]},input).targets.length;}
 for(const id of ['S1','C1']){assert.equal(accept(id,2.3),1);assert.equal(accept(id,1.7),1);assert.equal(accept(id,2.3001),0);assert.equal(accept(id,1.6999),0);}
 for(const value of [0,-1,Infinity,NaN,'2'])assert.equal(accept('S1',value),0);
 assert.equal(accept('A1',75),1);assert.equal(accept('A1',65),1);assert.equal(accept('A1',75.0001),0);assert.equal(accept('L1',1),0);
 const duplicate=ai.validate({...answer(),targets:[{id:'S1',target:2.1},{id:'S1',target:2.2}]},input);assert.equal(duplicate.targets[0].target,2.1);
});
test('M8 OpenAI-compatible request uses configured endpoint, model, Bearer and summary only',async()=>{
 const input=snapshot();let calls=0;const result=await ai.suggest(config,input,{post:async(url,headers,body)=>{
  calls++;assert.equal(url,'https://example.test/v1/chat/completions');assert.deepEqual(headers,{Authorization:'Bearer test-only-key'});
  const request=JSON.parse(body);assert.equal(request.model,'test-model');assert.deepEqual(JSON.parse(request.messages[1].content),input);assert.doesNotMatch(body,/test-only-key/);return envelope(answer());
 }});assert.equal(calls,1);assert.equal(result.notes,'说明');
});
test('M8 Anthropic fixed endpoint, version, key header and text blocks',async()=>{
 const result=await ai.suggest({...config,provider:'anthropic',baseUrl:'https://ignored.test'},snapshot(),{post:async(url,headers,body)=>{
  assert.equal(url,'https://api.anthropic.com/v1/messages');assert.deepEqual(headers,{'x-api-key':'test-only-key','anthropic-version':'2023-06-01'});
  const request=JSON.parse(body);assert.equal(request.model,'test-model');assert.equal(request.max_tokens,4096);assert.ok(request.system);return {content:[{type:'text',text:JSON.stringify(answer())}]};
 }});assert.equal(result.notes,'说明');
});
test('M8 non-JSON retries once; twice invalid, invalid schema and network errors fail predictably',async()=>{
 let calls=0;const input=snapshot();
 await ai.suggest(config,input,{post:async()=>{calls++;return calls===1?envelope('```json\n{}\n```'):envelope(answer());}});assert.equal(calls,2);
 calls=0;await assert.rejects(()=>ai.suggest(config,input,{post:async()=>{calls++;return envelope('not json');}}),/两次/);assert.equal(calls,2);
 calls=0;await assert.rejects(()=>ai.suggest(config,input,{post:async()=>{calls++;return envelope({});}}),/结构/);assert.equal(calls,1);
 calls=0;await assert.rejects(()=>ai.suggest(config,input,{post:async()=>{calls++;throw Error('HTTP 429');}}),/429/);assert.equal(calls,1);
});
test('M8 HTTPS absolute timeout, HTTP, oversized and interrupted responses reject without secrets',async()=>{
 function transport(mode){return {request(url,options,callback){const req=new EventEmitter();req.destroy=()=>{req.destroyed=true;};req.end=()=>process.nextTick(()=>{
  if(mode==='timeout')return;
  if(mode==='network'){req.emit('error',Error(config.apiKey));return;}
  const res=new EventEmitter();res.setEncoding=()=>{};res.statusCode=mode==='http'?401:200;callback(res);
  if(mode==='aborted'){res.emit('aborted');return;}
  res.emit('data',mode==='large'?'x'.repeat(1048577):mode==='bad'?'bad':JSON.stringify({ok:true}));res.emit('end');
 });return req;}};}
 for(const [mode,message] of [['timeout',/超时/],['network',/网络/],['http',/401/],['large',/过大/],['bad',/协议/],['aborted',/中断/]])await assert.rejects(()=>ai.post('https://example.test',{},'{}',{https:transport(mode),timeoutMs:10}),e=>{assert.doesNotMatch(e.message,/test-only-key/);assert.match(e.message,message);return true;});
 assert.deepEqual(await ai.post('https://example.test',{},'{}',{https:transport('ok')}),{ok:true});
});
test('M8 local settings are explicit, separate, reproducible; URLs cannot contain credentials or redirect to HTTP',()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'lg-ai-'));try{
  const store=ai.storage(folder);assert.equal(store.load().apiKey,'');store.save(config);assert.deepEqual(store.load(),ai.config(config,true));assert.deepEqual(fs.readdirSync(folder),['ai.json']);
  fs.writeFileSync(path.join(folder,'ai.json'),'broken');assert.throws(()=>store.load(),/配置文件无效/);
  for(const baseUrl of ['http://example.test/v1','https://key@example.test/v1','https://example.test?key=x','https://example.test#fragment'])assert.throws(()=>ai.config({...config,baseUrl},true));
  assert.throws(()=>ai.config({...config,apiKey:''},true));assert.throws(()=>ai.config({...config,model:''},true));
 }finally{fs.rmSync(folder,{recursive:true,force:true});}
});
test('M8 ES3 core target overrides update measurements, labels and real target primitives for all dimensions and angles',()=>{
 const {LG,plain}=loadCore();const seen=new Set();
 const counter=fixtures.rectangle(0,0,100,100);counter.kind='compound';counter.contours.push(fixtures.rectangle(20,20,60,60).contours[0]);
 const samples=['F1','F3','F4','F5','F6','F8'].map(name=>[name,fixtures[name]()]);samples.push(['counter',fixtures.geometry([counter])]);
 for(const [fixture,geometry] of samples){
  const before=JSON.stringify(geometry);
  const settings=LG.config.defaults();Object.assign(settings.features,{heights:true,counters:true,ringThickness:true,targetLines:true});settings.snapMode='off';settings.angleSnapStep=0;settings.labelDedup=false;
  const context=LG.preAnalyze(geometry,settings),base=LG.analyze(geometry,settings,context),input=ai.summary(base.analysis,'check');
  const targets=input.features.filter(f=>Number.isFinite(f.ratio)||Number.isFinite(f.rRatio)||f.type==='angle').map(f=>({id:f.id,target:f.type==='angle'?f.deg+1:(f.ratio||f.rRatio)*1.06}));context.targetOverrides=targets;
  const result=plain(LG.analyze(geometry,settings,context)),after=ai.summary(result.analysis,'check');
  assert.equal(JSON.stringify(geometry),before);assert.deepEqual(plain(result.analysis.bbox),plain(base.analysis.bbox));
  for(const t of targets){const f=after.features.find(f=>f.id===t.id);assert.equal(f.target,t.target);seen.add(f.type);assert.ok(result.render.primitives.some(p=>p.layer==='targets'&&p.featureId===t.id),fixture+' '+f.type+' '+t.id);assert.ok(result.render.primitives.some(p=>p.type==='label'&&p.featureId===t.id),fixture+' label '+t.id);}
  assert.ok(!plain(LG.analyze(geometry,settings)).render.primitives.some(p=>p.layer==='targets'));
 }
 for(const type of ['stem','gap','height','counter','circle','ring','angle'])assert.ok(seen.has(type),type+' not exercised');
});
test('M8 core rejects bypassed bounds and keeps public measure schema unchanged',()=>{
 const {LG,plain}=loadCore();const g=fixtures.F1(),base=LG.analyze(g,{}),context=LG.preAnalyze(g,{});
 context.targetOverrides=[{id:'C1',target:999},{id:'unknown',target:1},{id:'C1',target:Infinity}];assert.deepEqual(plain(LG.analyze(g,{},context)),plain(base));
 context.targetOverrides=[{id:'C1',target:base.analysis.circles[0].measureR.ratio*1.05}];const changed=LG.analyze(g,{},context);assert.deepEqual(Object.keys(changed.analysis.circles[0].measureR),Object.keys(base.analysis.circles[0].measureR));
 const moved=fixtures.F1();moved.parts[0].contours[0].points.forEach(p=>{for(const key of ['a','l','r'])p[key][0]+=1;});assert.deepEqual(plain(LG.analyze(moved,{},context)),plain(LG.analyze(moved,{})));
});
function controller(transport){
 const context=vm.createContext({performance});vm.runInContext(bundleFiles(sourceFiles(path.join(root,'src/core'))),context);
 for(const name of ['model','controller'])vm.runInContext(fs.readFileSync(path.join(root,'src/panel/js',name+'.js'),'utf8'),context);
 let geometry=fixtures.F9(),token='doc-one',data=null,draws=0;const calls=[];
 const c=context.LGPanel.create(context.LG,async(name,value)=>{calls.push(name);
  if(name==='getDocData')return {documentToken:token,docData:data,settings:context.LG.config.defaults()};
  if(name==='read')return {geometry,documentToken:token,readToken:'read',docData:data,measurements:[],readMs:1};
  if(name==='draw'){draws++;data={runId:'run',baseUnit:{value:value.result.analysis.baseUnit.value,locked:true},hiddenFeatures:value.hiddenFeatures};return {docData:data,primitives:value.result.render.primitives.length,drawMs:1};}
 },null,null,{...ai,suggest:transport});
 return {c,calls,setToken(value){token=value;},setGeometry(value){geometry=value;},setBase(value){data.baseUnit.value=value;},get draws(){return draws;}};
}
test('M8 controller stages suggestions then applies targets and visibility using a fresh read/draw',async()=>{
 const h=controller(async(c,input)=>({...answer(),hide:[input.features[0].id],targets:[{id:'C1',target:input.features.find(f=>f.id==='C1').rRatio*1.04}]}));
 await h.c.run('selection');const before=JSON.stringify(h.c.state.geometry),count=h.draws;
 await h.c.requestAI(config,'check');assert.equal(h.draws,count);assert.ok(h.c.state.ai.pending);
 await h.c.applyAI();assert.equal(h.draws,count+1);assert.equal(JSON.stringify(h.c.state.geometry),before);assert.equal(h.c.state.hidden.length,1);assert.ok(h.c.state.result.render.primitives.some(p=>p.layer==='targets'));assert.equal(h.c.state.ai.pending,null);
 await h.c.run('sources');assert.ok(!h.c.state.result.render.primitives.some(p=>p.layer==='targets'));assert.equal(h.c.state.ai.notes,'');
});
test('M8 network/config failures fall back to curated after checking document identity',async()=>{
 const h=controller(async()=>{throw Error('HTTP 503');});await h.c.run('selection');const result=await h.c.requestAI(config,'presentation');assert.equal(result.fallback,true);assert.equal(h.c.state.curated,true);assert.match(h.c.state.status,/回退精选/);assert.equal(h.c.state.busy,false);
});
test('M8 AI show can restore curated omissions while unspecified omitted features remain hidden',async()=>{
 const h=controller(async()=>({...answer(),show:['C1']}));h.c.state.settings.advanced.curatedMaxCircles=0;h.c.state.curated=true;
 await h.c.run('selection');assert.ok(!h.c.state.features.some(f=>f.type==='circle'));await h.c.requestAI(config,'presentation');await h.c.applyAI();
 assert.equal(h.c.state.curated,false);assert.ok(h.c.state.hidden.some(f=>f.id==='C2'));assert.ok(!h.c.state.hidden.some(f=>f.id==='C1'));
});
test('M8 changed geometry, parameters or a prevent stale AI application before draw',async()=>{
 for(const mode of ['geometry','settings','base']){
  const h=controller(async()=>answer());await h.c.run('selection');await h.c.requestAI(config,'check');const draws=h.draws;
  if(mode==='geometry'){const g=fixtures.F9();g.parts[0].contours[0].points[0].a[0]+=1;h.setGeometry(g);}
  if(mode==='settings')h.c.state.settings.snapMode='step';if(mode==='base')h.setBase(123);
  await assert.rejects(()=>h.c.applyAI(),/已改变/);assert.equal(h.draws,draws);assert.equal(h.c.state.busy,false);
 }
});
test('M8 switched document during network wait rejects success/failure without drawing; busy blocks mutation',async()=>{
 for(const failure of [false,true]){
  let finish;const h=controller(()=>new Promise((resolve,reject)=>{finish=failure?()=>reject(Error('network')):()=>resolve(answer());}));await h.c.run('selection');const count=h.draws;
  const pending=h.c.requestAI(config,'check');while(!finish)await new Promise(resolve=>setImmediate(resolve));
  await assert.rejects(()=>h.c.base(20,true),/稍候/);h.setToken('doc-two');finish();await assert.rejects(()=>pending,/文档已切换/);assert.equal(h.draws,count);assert.equal(h.c.state.ai.pending,null);assert.equal(h.c.state.busy,false);
 }
});
