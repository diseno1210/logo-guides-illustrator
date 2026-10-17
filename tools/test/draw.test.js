'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {loadCore}=require('./load_core');
const {sourceFiles,bundleFiles,build}=require('../build');
const {F3,F1,rectangle}=require('./fixtures');
const ROOT=path.resolve(__dirname,'../..');

const {harness}=require('./host_harness');

test('transient native helper creation removes its partial item and retries only once',()=>{
 const {LG,context,artwork,doc}=harness();let redraws=0;context.app.redraw=()=>{redraws++;};
 const add=artwork.pathItems.add;let attempts=0;artwork.pathItems.add=()=>{const p=add();const set=p.setEntirePath;p.setEntirePath=points=>{attempts++;if(attempts===1)throw Error("1346458189 ('PARM')");set.call(p,points);};return p;};
 const count=artwork.pathItems.length;const shape=LG.hostDraw.shape(artwork,{type:'line',p0:[0,0],p1:[1,1]});assert.equal(attempts,2);assert.equal(redraws,1);assert.equal(artwork.pathItems.length,count+1);assert.ok(doc.pageItems.includes(shape));
 attempts=0;const arc=LG.hostDraw.shape(artwork,{type:'arc',c:[0,0],r:10,startDeg:0,endDeg:180});assert.equal(arc.pathPoints.length,3);assert.equal(redraws,2);
 const groups=artwork.groupItems.add;let textAttempts=0;artwork.groupItems.add=()=>{const g=groups();const create=g.textFrames.add;g.textFrames.add=()=>{textAttempts++;if(textAttempts===1)throw Error('Target layer cannot be modified');return create();};return g;};
 const s=LG.config.defaults();LG.hostDraw.label(artwork,LG.primitives.label([0,0],0,[{text:'◇ 1.23a',style:'text',sizeFactor:1}],'S1'),{fontSize:4},LG.styles.preset('light'),s,doc);assert.equal(textAttempts,2);assert.equal(artwork.groupItems.length,1);assert.equal(redraws,3);
 artwork.pathItems.add=()=>{const p=add();p.setEntirePath=()=>{throw Error("PARM");};return p;};assert.throws(()=>LG.hostDraw.shape(artwork,{type:'line',p0:[0,0],p1:[1,1]}),/PARM/);assert.equal(redraws,4);assert.equal(artwork.pathItems.length,count+2);
 artwork.pathItems.add=add;const ellipse=artwork.pathItems.ellipse;let ellipseAttempts=0;artwork.pathItems.ellipse=(...args)=>{ellipseAttempts++;if(ellipseAttempts===1)throw Error('Target layer cannot be modified');return ellipse(...args);};const circle=LG.hostDraw.shape(artwork,{type:'circle',c:[0,0],r:10});assert.equal(ellipseAttempts,2);assert.equal(circle.locked,false);assert.equal(circle.hidden,false);assert.equal(redraws,5);
});

test('Generate draws references, stores hidden Doc Data, tags sources, locks layer and restores activeLayer/selection',()=>{
  const {LG,plain,doc,artwork}=harness();const sources=doc.selection;const settings=LG.config.defaults();const result=LG.analyze(F3(),{features:{stemWidths:false,gaps:false}});
  const data=plain(LG.hostDraw.generate(doc,result,settings,sources));
  const root=doc.layers[0];assert.equal(root.name,'Logo Guides');assert.equal(root.locked,true);assert.equal(doc.activeLayer,artwork);assert.equal(doc.selection,sources);
  assert.deepEqual(root.layers.map(l=>l.name),['LG Baselines','LG Legend']);
  const drawn=root.layers[0].pathItems;assert.equal(drawn.length,8);
  for(let i=0;i<drawn.length;i++){assert.equal(drawn[i].name,result.render.primitives[i].featureId);assert.equal(drawn[i].strokeWidth,0.25);assert.deepEqual(plain(drawn[i].strokeDashes),[0.75,0.5]);assert.equal(drawn[i].filled,false);}
  const stored=root.pathItems[0];assert.equal(stored.name,'__LG_DATA__');assert.equal(stored.hidden,true);assert.deepEqual(JSON.parse(stored.note),data);
  assert.equal(data.schemaVersion,1);assert.match(data.runId,/^lg_/);assert.equal(data.baseUnit.value,20);assert.equal(data.baseUnit.locked,true);assert.deepEqual(data.hiddenFeatures,[]);
  for(const source of sources){assert.equal(source.tags.find(t=>t.name==='LG_SOURCE').value,data.runId);assert.ok(source.tags.some(t=>t.name==='OTHER_TAG'));}
  assert.deepEqual(plain(LG.hostStore.read(doc)),data);
});

test('repeated Generate replaces automatic sublayers, keeps Manual and data path, clears old source tags only',()=>{
  const {LG,doc}=harness();const settings=LG.config.defaults();const sources=doc.selection;const result=LG.analyze(F3(),{features:{stemWidths:false,gaps:false}});
  const first=LG.hostDraw.generate(doc,result,settings,sources);const root=doc.layers[0];const dataPath=root.pathItems[0];const oldBaselines=root.layers[0];
  root.locked=false;const manual=root.layers.add();manual.name='LG Manual';root.locked=true;const differentSource=[sources[1]];
  const second=LG.hostDraw.generate(doc,result,settings,differentSource);
  assert.notEqual(second.runId,first.runId);assert.equal(root.pathItems[0],dataPath);assert.ok(root.layers.includes(manual));assert.ok(!root.layers.includes(oldBaselines));
  assert.ok(!sources[0].tags.some(t=>t.name==='LG_SOURCE'));assert.equal(sources[1].tags.find(t=>t.name==='LG_SOURCE').value,second.runId);
});

test('drawing failure restores prior root lock, active layer and selected artwork',()=>{
  const {LG,doc,artwork,state}=harness();const sources=doc.selection;const settings=LG.config.defaults();const result=LG.analyze(F3(),{features:{stemWidths:false,gaps:false}});
  LG.hostDraw.generate(doc,result,settings,sources);state.failDrawing=true;
  assert.throws(()=>LG.hostDraw.generate(doc,result,settings,sources),/drawing failure/);
  assert.equal(doc.layers[0].locked,true);assert.equal(doc.activeLayer,artwork);assert.equal(doc.selection,sources);
});

test('invalid document metadata is rejected before deleting prior output',()=>{
  const {LG,doc}=harness();const sources=doc.selection;const settings=LG.config.defaults();const result=LG.analyze(F3(),{features:{stemWidths:false,gaps:false}});
  LG.hostDraw.generate(doc,result,settings,sources);const root=doc.layers[0];const before=Array.from(root.layers);root.pathItems[0].note='invalid';
  assert.throws(()=>LG.hostDraw.generate(doc,result,settings,sources),/document data/);assert.deepEqual(Array.from(root.layers),before);assert.equal(root.locked,true);
});

for(const output of ['guides','both'])test('output '+output+' draws actual guide flag and expected styled count',()=>{
  const {LG,doc}=harness();const settings=LG.config.resolve({output,lockLayer:false}).settings;const result=LG.analyze(F3(),settings);
  LG.hostDraw.generate(doc,result,settings,doc.selection);const root=doc.layers[0];const snap=root.layers.find(l=>l.name==='LG Snap Guides');
  assert.equal(snap.pathItems.length,8);assert.ok(snap.pathItems.every(p=>p.guides===true));assert.equal(root.locked,false);
  assert.equal(root.layers.filter(l=>l.name==='LG Baselines').length,output==='both'?1:0);
});

test('RGB/CMYK conversion includes pure black without division by zero',()=>{
  const {LG,doc}=harness();let c=LG.hostDraw.color('#E5484D',doc);assert.equal(c.red,229);assert.equal(c.green,72);assert.equal(c.blue,77);
  doc.documentColorSpace=1;c=LG.hostDraw.color('#000000',doc);assert.equal(c.black,100);assert.equal(c.cyan,0);assert.equal(c.magenta,0);assert.equal(c.yellow,0);
  c=LG.hostDraw.color('#FFFFFF',doc);assert.equal(c.black,0);assert.equal(c.cyan,0);
  const settings=LG.config.defaults();LG.hostDraw.generate(doc,LG.analyze(F3(),{features:{stemWidths:false,gaps:false}}),settings,doc.selection);
  assert.ok(Number.isFinite(doc.layers[0].layers.find(l=>l.name==='LG Baselines').pathItems[0].strokeColor.black));
});

test('multiline labels use font fallbacks, actual group bounds and -90 rotation about center',()=>{
  const {LG,doc,artwork,fontLookups}=harness();const result=LG.analyze(F3(),{features:{stemWidths:false,gaps:false}});
  const primitive=LG.primitives.label([50,180],-90,[{text:'0.95a',sizeFactor:1,style:'text'},{text:'实测 +0.12pt',sizeFactor:0.75,style:'textWarn'}],'S1');
  const group=LG.hostDraw.label(artwork,primitive,result.render,LG.styles.preset('light'),LG.config.defaults(),doc);
  const b=group.geometricBounds;assert.ok(Math.abs((b[0]+b[2])/2-50)<1e-9);assert.ok(Math.abs((b[1]+b[3])/2-180)<1e-9);
  assert.deepEqual(group.rotation,[-90,true,true,true,true,0]);assert.equal(group.name,'S1:label');
  assert.ok(fontLookups.includes('ArialMT'));assert.ok(fontLookups.includes('MicrosoftYaHei'));assert.equal(group.textFrames[1].textRange.characterAttributes.size,result.render.fontSize*0.75);
  fontLookups.length=0;
  LG.hostDraw.label(artwork,LG.primitives.label([0,0],0,[{text:'φ √2a',sizeFactor:1,style:'text'}],'R1'),result.render,LG.styles.preset('light'),LG.config.defaults(),doc);
  assert.ok(fontLookups.includes('ArialMT'));assert.ok(!fontLookups.includes('MicrosoftYaHei'));
});

test('built Generate executes the actual read/analyze/draw/store flow in the ES3 DOM double',()=>{
  const {context,doc,artwork,alerts,files}=harness();const target=build().find(file=>file.endsWith('LogoGuides_Generate.jsx'));
  vm.runInContext(fs.readFileSync(target,'utf8').replace(/^#target illustrator\n/,''),context,{timeout:5000});
  assert.equal(doc.activeLayer,artwork);assert.equal(doc.layers[0].name,'Logo Guides');assert.equal(doc.layers[0].layers.find(l=>l.name==='LG Baselines').pathItems.length,8);
  assert.ok(alerts.some(m=>/参考线: 8/.test(m)));assert.ok(files.get('/mock/LogoGuides/log.txt').includes(context.LG.milestone+' Generate OK'));assert.ok(files.has('/mock/LogoGuides/settings.json'));
});

test('arc uses <=90degree cubics with outgoing right and incoming left handles; ellipse uses y-up bounds',()=>{
 const {LG,artwork,plain}=harness();const p=LG.hostDraw.shape(artwork,{type:'arc',c:[10,20],r:100,startDeg:0,endDeg:180});assert.equal(p.pathPoints.length,3);const pts=plain(p.pathPoints);assert.deepEqual(pts[0].anchor,[110,20]);assert.ok(pts[0].rightDirection[1]>20);assert.ok(pts[1].leftDirection[0]>10);assert.ok(pts[1].rightDirection[0]<10);assert.deepEqual(pts[0].leftDirection,pts[0].anchor);assert.deepEqual(pts[2].rightDirection,pts[2].anchor);assert.deepEqual(LG.hostDraw.shape(artwork,{type:'circle',c:[10,20],r:30}).ellipse,[50,-20,60,60]);
});

test('manual circle uses actual anchor selection enums, shared cubic samples, pt/a labels and preserves selection/data',()=>{
 const {LG,doc,artwork}=harness();const s=LG.config.defaults();LG.hostDraw.generate(doc,LG.analyze(F3(),s),s,doc.selection);const before=LG.json.stringify(LG.hostStore.read(doc));
 const path=artwork.pathItems.add();const raw=F1().parts[0].contours[0];Object.assign(path,{filled:true,stroked:false,strokeWidth:0,closed:true,pathPoints:raw.points.map(p=>({anchor:p.a,leftDirection:p.l,rightDirection:p.r,selected:1}))});doc.selection=[path];const selection=doc.selection;
 const chosen=LG.hostManual.selected(doc,s);assert.equal(chosen.anchors.length,4);assert.ok(chosen.samples.length>4);const result=LG.hostManual.circle(doc,s);assert.ok(Math.abs(result.circle.r-100)<.1);assert.equal(doc.activeLayer,artwork);assert.equal(doc.selection,selection);assert.equal(LG.json.stringify(LG.hostStore.read(doc)),before);assert.equal(doc.layers[0].locked,true);
 const manual=doc.layers[0].layers.find(l=>l.name==='LG Manual');assert.equal(manual.pathItems.length,1);assert.ok(manual.groupItems[0].textFrames[0].contents.includes('a'));assert.match(manual.groupItems[0].textFrames[1].contents,/选中点最大偏差/);
 path.pathPoints[1].selected=2;path.pathPoints[3].selected=0;assert.equal(LG.hostManual.selected(doc,s).anchors.length,2);assert.throws(()=>LG.hostManual.circle(doc,s),/至少 3/);
 path.pathPoints.forEach(p=>p.selected=1);doc.layers[0].pathItems[0].remove();LG.hostManual.circle(doc,s);assert.match(manual.groupItems[1].textFrames[0].contents,/pt$/);
 LG.hostDraw.generate(doc,LG.analyze(F3(),s),s,[path]);assert.ok(doc.layers[0].layers.includes(manual));
});

test('guides output keeps styled legend samples and background is a locked bottom top-level layer',()=>{
 const {LG,doc,artwork}=harness();const settings=LG.config.resolve({output:'guides',features:{background:true}}).settings;LG.hostDraw.generate(doc,LG.analyze(F3(),settings),settings,doc.selection);const bg=doc.layers.at(-1);assert.equal(bg.name,'Logo Guides BG');assert.equal(bg.locked,true);assert.equal(bg.pathItems.length,1);assert.equal(doc.layers[0].name,'Logo Guides');const legend=doc.layers[0].layers.find(l=>l.name==='LG Legend');assert.ok(legend.pathItems.length>0);assert.ok(legend.pathItems.every(p=>p.guides!==true&&p.stroked));assert.equal(doc.activeLayer,artwork);
});

test('manual fit works across three isolated anchor paths and rejects collinear anchors without creating output',()=>{
 const {LG,doc,artwork}=harness();const points=[[0,0],[100,0],[0,100]];const selected=points.map(a=>{const p=artwork.pathItems.add();Object.assign(p,{filled:false,stroked:false,closed:false,pathPoints:[{anchor:a,leftDirection:a,rightDirection:a,selected:1}]});return p;});doc.selection=selected;const result=LG.hostManual.circle(doc,LG.config.defaults());assert.equal(result.sampleCount,3);assert.ok(Math.abs(result.circle.cx-50)<1e-8);assert.ok(Math.abs(result.circle.cy-50)<1e-8);assert.equal(doc.layers[0].locked,true);const manual=doc.layers[0].layers.find(l=>l.name==='LG Manual');assert.equal(manual.pathItems.length,1);selected[2].pathPoints[0].anchor=[200,0];assert.throws(()=>LG.hostManual.circle(doc,LG.config.defaults()),/共线/);assert.equal(manual.pathItems.length,1);
});
