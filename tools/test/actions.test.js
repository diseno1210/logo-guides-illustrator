'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const {harness}=require('./host_harness');const {build}=require('../build');const {F3}=require('./fixtures');
function generated(){const h=harness();h.LG.hostActions.generate(h.doc);return h;}

test('Generate real dialog builds all implemented controls, validates custom a and writes resolved settings only on confirm',()=>{
 const h=harness();const {LG,doc,state,files,plain,alerts}=h;
 state.onDialog=d=>{const all=d.flatten();assert.equal(all.filter(c=>c.type==='checkbox').length,18);const choices=all.filter(c=>c.type==='dropdownlist');assert.equal(choices.length,7);const source=choices[0];source.selection=source.items.length-1;source.onChange();const input=all.find(c=>c.type==='edittext');assert.equal(input.enabled,true);const ok=all.find(c=>c.type==='button'&&c.properties.name==='ok');input.text='0';ok.onClick();assert.equal(d.closed,false);assert.equal(files.has('/mock/LogoGuides/settings.json'),false);input.text='12.5';ok.onClick();};
 const r=LG.hostActions.generate(doc);assert.equal(r.result.analysis.baseUnit.value,12.5);assert.equal(r.data.baseUnit.source,'manual');assert.ok(alerts.some(a=>/正数/.test(a)));assert.equal(JSON.parse(files.get('/mock/LogoGuides/settings.json')).baseUnit.value,12.5);assert.equal(plain(LG.hostStore.settings()).baseUnit.locked,true);
});
test('cancelled generation preserves document and global settings; previous locked a is selected by default',()=>{
 const h=generated();const {LG,doc,state,files}=h;const before=LG.json.stringify(LG.hostStore.read(doc));const settings=files.get('/mock/LogoGuides/settings.json');const layers=Array.from(doc.layers[0].layers);
 state.onDialog=d=>{const choice=d.flatten().find(c=>c.type==='dropdownlist');assert.match(choice.selection.text,/上次的值/);};assert.equal(LG.hostActions.generate(doc),null);assert.equal(LG.json.stringify(LG.hostStore.read(doc)),before);assert.equal(files.get('/mock/LogoGuides/settings.json'),settings);assert.deepEqual(Array.from(doc.layers[0].layers),layers);
});
test('Refresh ignores partial selection, keeps locked a/source/runId/tags/Manual and rereads changed original geometry',()=>{
 const h=generated();const {LG,doc,artwork,alerts}=h;const first=LG.hostStore.read(doc);const all=Array.from(artwork.pathItems);const tags=all.map(p=>p.tags.find(t=>t.name==='LG_SOURCE'));const root=doc.layers[0];root.locked=false;const manual=root.layers.add();manual.name='LG Manual';root.locked=true;
 LG.hostStore.saveSettings({baseUnit:{mode:'value',value:7},snapMode:'step'});for(const p of all[2].pathPoints){for(const key of ['anchor','leftDirection','rightDirection'])p[key]=[p[key][0]+3,p[key][1]];}doc.selection=[all[2]];doc.activeLayer=artwork;const count=alerts.length;const r=LG.hostActions.refresh(doc);assert.equal(r.data.runId,first.runId);assert.equal(r.data.createdAt,first.createdAt);assert.deepEqual(h.plain(r.data.baseUnit),h.plain(first.baseUnit));assert.equal(r.result.analysis.baseUnit.value,20);assert.equal(r.result.analysis.baseUnit.source,'manual');assert.equal(r.result.analysis.gaps.length,2);assert.equal(r.result.analysis.gaps[1].width,23);assert.ok(root.layers.includes(manual));assert.equal(doc.activeLayer,artwork);assert.deepEqual(Array.from(doc.selection),all);all.forEach((p,i)=>assert.equal(p.tags.find(t=>t.name==='LG_SOURCE'),tags[i]));assert.equal(alerts.length,count);
});
test('unlocked Refresh uses current global a but preserves the unlocked document choice',()=>{
 const h=harness();const {LG,doc}=h;LG.hostStore.saveSettings({baseUnit:{locked:false}});LG.hostActions.generate(doc);LG.hostStore.saveSettings({baseUnit:{mode:'value',value:7,locked:true}});const r=LG.hostActions.refresh(doc);assert.equal(r.data.baseUnit.value,7);assert.equal(r.data.baseUnit.locked,false);assert.equal(r.result.analysis.baseUnit.value,7);
});
test('Refresh rejects missing metadata or missing tags before mutating the existing output',()=>{
 const {LG,doc}=harness();assert.throws(()=>LG.hostActions.refresh(doc),/生成/);LG.hostActions.generate(doc);const layers=Array.from(doc.layers[0].layers);LG.hostStore.tagSources(doc,[],'');doc.selection=[];assert.throws(()=>LG.hostActions.refresh(doc),/来源对象/);assert.deepEqual(Array.from(doc.layers[0].layers),layers);
});
for(const mode of ['auto','all','data'])test('Clear '+mode+' removes only the specified output and retains original artwork',()=>{
 const {LG,doc,artwork}=generated();const root=doc.layers[0];root.locked=false;const manual=root.layers.add();manual.name='LG Manual';root.locked=true;const bg=doc.layers.add();bg.name='Logo Guides BG';bg.locked=true;doc.activeLayer=artwork;const data=LG.json.stringify(LG.hostStore.read(doc));LG.hostActions.clear(doc,mode);assert.equal(doc.activeLayer,artwork);assert.equal(artwork.pathItems.length,3);assert.ok(!doc.layers.some(l=>l.name==='Logo Guides BG'));
 if(mode==='data'){assert.equal(LG.hostStore.layer(doc),null);assert.ok(artwork.pathItems.every(p=>!p.tags.some(t=>t.name==='LG_SOURCE')));}else{assert.equal(root.locked,true);assert.equal(LG.json.stringify(LG.hostStore.read(doc)),data);assert.deepEqual(root.layers.map(l=>l.name),mode==='auto'?['LG Manual']:[]);assert.ok(artwork.pathItems.every(p=>p.tags.some(t=>t.name==='LG_SOURCE')));}
 assert.ok(artwork.pathItems.every(p=>p.tags.some(t=>t.name==='OTHER_TAG')));
});
test('Clear cancellation is inert; removal failure restores remaining locks and original activeLayer',()=>{
 const h=generated();const {LG,doc,state,artwork}=h;const layers=Array.from(doc.layers[0].layers);assert.equal(LG.hostActions.clear(doc,'cancel'),false);assert.deepEqual(Array.from(doc.layers[0].layers),layers);const bg=doc.layers.add();bg.name='Logo Guides BG';bg.locked=true;doc.activeLayer=artwork;state.failRemoving='Logo Guides BG';assert.throws(()=>LG.hostActions.clear(doc,'auto'),/removal failure/);assert.equal(bg.locked,true);assert.equal(doc.layers.find(l=>l.name==='Logo Guides').locked,true);assert.equal(doc.activeLayer,artwork);
});
test('SetBaseUnit obtains object or two-anchor options and automatically refreshes existing tagged sources',()=>{
 const {LG,doc,artwork,plain}=generated();const first=LG.hostStore.read(doc);doc.selection=[artwork.pathItems[0]];assert.deepEqual(plain(LG.hostActions.baseOptions(doc,LG.config.defaults())).map(o=>o.value),[20,100,20]);const p=artwork.pathItems[0];p.pathPoints[0].selected=1;p.pathPoints[2].selected=1;assert.deepEqual(plain(LG.hostActions.baseOptions(doc,LG.config.defaults())).map(o=>o.value),[Math.hypot(20,100),20,100]);const r=LG.hostActions.setBaseUnit(doc,10);assert.equal(r.data.runId,first.runId);assert.deepEqual(plain(r.data.baseUnit),{value:10,source:'manual',locked:true});assert.equal(r.result.analysis.stems[0].measure.display,'2a');assert.throws(()=>LG.hostActions.setBaseUnit(doc,-1),/正数/);
});
test('SetBaseUnit before Generate stores locked a without tagging or touching artwork; its dialog can cancel',()=>{
 const h=harness();const {LG,doc,artwork,state}=h;doc.selection=[artwork.pathItems[0]];state.cancelDialog=true;assert.equal(LG.hostActions.setBaseUnit(doc),null);assert.equal(doc.layers.length,1);const d=LG.hostActions.setBaseUnit(doc,15);assert.equal(d.baseUnit.value,15);assert.equal(LG.hostStore.sources(doc,d.runId).length,0);assert.equal(doc.activeLayer,artwork);assert.equal(doc.layers[0].locked,true);
});
test('debug exports actual Geometry/analysis and warning summary is localized only when required',()=>{
 const {LG,doc,files,alerts}=harness();LG.hostStore.saveSettings({debug:true,showSummary:false,features:{stemWidths:false,gaps:false,baselines:false,verticals:false,overshoot:false,circles:false,ringThickness:false,angles:false,constructionLines:false}});const r=LG.hostActions.generate(doc);assert.equal(alerts.length,0);assert.ok(Array.from(r.result.analysis.warnings).some(w=>w.code==='NO_FEATURES'));assert.equal(JSON.parse(files.get('/mock/LogoGuides/geometry_dump.json')).parts.length,3);assert.deepEqual(JSON.parse(files.get('/mock/LogoGuides/analysis.json')),JSON.parse(LG.json.stringify(r.result.analysis)));LG.hostActions.refresh(doc);assert.equal(alerts.length,1);assert.match(alerts[0],/宽松/);
});
test('global settings merge defaults, ignore unknown keys, and reject malformed files without overwriting',()=>{
 const {LG,files}=harness();files.set('/mock/LogoGuides/settings.json','\ufeff{"uiLanguage":"en","unknown":true}');const s=LG.hostStore.settings();assert.equal(s.uiLanguage,'en');assert.equal(s.unknown,undefined);assert.equal(s.features.legend,true);files.set('/mock/LogoGuides/settings.json','broken');assert.throws(()=>LG.hostStore.settings(),/settings.json/);assert.equal(files.get('/mock/LogoGuides/settings.json'),'broken');
});
test('built Refresh/Clear/SetBaseUnit execute their real entrypoints in the restricted host VM',()=>{
 const h=generated();const {context,doc,artwork,state,LG}=h;const products=build();const run=name=>vm.runInContext(fs.readFileSync(products.find(p=>p.endsWith(name+'.jsx')),'utf8').replace(/^#target illustrator\n/,''),context,{timeout:5000});
 doc.selection=[artwork.pathItems[0]];run('LogoGuides_Refresh');assert.equal(doc.selection.length,3);doc.selection=[artwork.pathItems[0]];run('LogoGuides_SetBaseUnit');assert.equal(LG.hostStore.read(doc).baseUnit.source,'manual');state.onDialog=d=>d.flatten().find(c=>c.type==='button'&&/全部 \+/.test(c.text)).onClick();run('LogoGuides_Clear');assert.equal(LG.hostStore.layer(doc),null);
});

test('English UI and warning fallback, locked summaries and log rotation report actual state',()=>{
 const {LG,files,doc,alerts,state}=harness();LG.hostStore.saveSettings({uiLanguage:'en',snapMode:'step'});LG.hostActions.generate(doc);assert.equal(state.dialogs[0].title,'Logo Guides');assert.match(alerts[0],/Reference lines: 8/);const data=LG.hostStore.read(doc);const r=LG.analyze(F3());assert.match(LG.i18n.summary(r,LG.hostStore.settings(),data,true),/Locked: 20.00 pt \(automatic stem\)/);assert.equal(LG.i18n.warning({code:'FUTURE_CODE',message:'Original message'},LG.config.defaults()),'Original message [FUTURE_CODE]');files.set('/mock/LogoGuides/log.txt','x'.repeat(1024*1024+1));LG.hostEnv.log('rotation check');assert.equal(files.get('/mock/LogoGuides/log.previous.txt').length,1024*1024+1);assert.match(files.get('/mock/LogoGuides/log.txt'),/rotation check/);
});

test('Generate safely restores an artwork layer when the prior active automatic sublayer was replaced',()=>{
 const {LG,doc,artwork}=generated();doc.activeLayer=doc.layers[0].layers.find(l=>l.name==='LG Baselines');LG.hostActions.generate(doc);assert.equal(doc.activeLayer.name,artwork.name);
});
