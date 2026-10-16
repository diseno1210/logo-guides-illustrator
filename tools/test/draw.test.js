'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {loadCore}=require('./load_core');
const {sourceFiles,bundleFiles,build}=require('../build');
const {F3,rectangle}=require('./fixtures');
const ROOT=path.resolve(__dirname,'../..');

/** Small Illustrator DOM double. This checks our calls, never Illustrator's actual behavior. */
function harness(){
  const {LG,context,plain}=loadCore();const alerts=[];const fontLookups=[];const files=new Map();
  const doc={typename:'Document',layers:[],pageItems:[],selection:[],documentColorSpace:0};
  const state={failDrawing:false};
  function tags(item){const list=[];list.add=()=>{const tag={name:'',value:'',remove(){list.splice(list.indexOf(tag),1);}};list.push(tag);return tag;};return list;}
  function pathItems(parent){const list=[];list.add=()=>{
    if(state.failDrawing&&parent.name==='LG Baselines')throw new Error('mock drawing failure');
    const item={typename:'PathItem',parent,name:'',hidden:false,tags:tags(),setEntirePath(points){this.points=plain(points);},remove(){list.splice(list.indexOf(item),1);doc.pageItems.splice(doc.pageItems.indexOf(item),1);}};
    list.push(item);doc.pageItems.push(item);return item;
  };return list;}
  function textFrames(group){const frames=[];frames.add=()=>{
    const text={contents:'',position:[0,0],textRange:{characterAttributes:{}},translate(x,y){this.position=[this.position[0]+x,this.position[1]+y];}};
    Object.defineProperty(text,'geometricBounds',{get(){const size=text.textRange.characterAttributes.size;const [x,y]=text.position;return [x,y+size*0.8,x+text.contents.length*size*0.63,y-size*0.2];}});
    frames.push(text);return text;
  };return frames;}
  function groups(){const list=[];list.add=()=>{
    const group={name:'',dx:0,dy:0,translate(x,y){this.dx+=x;this.dy+=y;},rotate(...args){this.rotation=args;}};
    group.textFrames=textFrames(group);
    Object.defineProperty(group,'geometricBounds',{get(){const boxes=group.textFrames.map(t=>t.geometricBounds);return [Math.min(...boxes.map(b=>b[0]))+group.dx,Math.max(...boxes.map(b=>b[1]))+group.dy,Math.max(...boxes.map(b=>b[2]))+group.dx,Math.min(...boxes.map(b=>b[3]))+group.dy];}});
    list.push(group);return group;
  };return list;}
  function layers(parent){const list=[];list.add=()=>{
    const layer={typename:'Layer',name:'',parent,locked:false,visible:true,zOrder(){const index=list.indexOf(layer);list.splice(index,1);list.unshift(layer);},remove(){assert.equal(this.locked,false);list.splice(list.indexOf(layer),1);}};
    layer.layers=layers(layer);layer.pathItems=pathItems(layer);layer.groupItems=groups();
    list.unshift(layer);doc.activeLayer=layer;return layer;
  };return list;}
  doc.layers=layers(doc);const artwork=doc.layers.add();artwork.name='Artwork';
  for(let i=0;i<3;i++){
    const item=artwork.pathItems.add();Object.assign(item,{filled:true,stroked:false,strokeWidth:0,closed:true,clipping:false,pathPoints:rectangle(i*40,0,20,100).contours[0].points.map(p=>({anchor:p.a,leftDirection:p.l,rightDirection:p.r}))});
    item.tags.add().name='OTHER_TAG';
  }
  doc.selection=Array.from(artwork.pathItems);doc.activeLayer=artwork;
  doc.artboards=[{artboardRect:[-50,150,200,-50]}];doc.artboards.getActiveArtboardIndex=()=>0;
  function File(name){this.fsName=name;this.exists=files.has(name);this.length=0;this.open=()=>true;this.write=contents=>{files.set(name,(files.get(name)||'')+contents);return true;};this.close=()=>true;}
  function Folder(name){this.fsName=name;this.exists=true;}Folder.userData={fsName:'/mock'};
  Object.assign(context,{File,Folder,app:{documents:[doc],activeDocument:doc,textFonts:{getByName(name){fontLookups.push(name);if(name==='ArialMT'||name==='MicrosoftYaHei')return {name};throw new Error('missing font');}}},alert:m=>alerts.push(m),confirm:()=>true,RGBColor:function(){},CMYKColor:function(){},DocumentColorSpace:{CMYK:1},StrokeCap:{BUTTENDCAP:0},ZOrderMethod:{BRINGTOFRONT:0},Transformation:{CENTER:0}});
  vm.runInContext(bundleFiles(sourceFiles(path.join(ROOT,'src/host'))),context);
  return {LG,context,plain,doc,artwork,alerts,fontLookups,state,files};
}

test('Generate draws references, stores hidden Doc Data, tags sources, locks layer and restores activeLayer/selection',()=>{
  const {LG,plain,doc,artwork}=harness();const sources=doc.selection;const settings=LG.config.defaults();const result=LG.analyze(F3());
  const data=plain(LG.hostDraw.generate(doc,result,settings,sources));
  const root=doc.layers[0];assert.equal(root.name,'Logo Guides');assert.equal(root.locked,true);assert.equal(doc.activeLayer,artwork);assert.equal(doc.selection,sources);
  assert.deepEqual(root.layers.map(l=>l.name),['LG Baselines']);
  const drawn=root.layers[0].pathItems;assert.equal(drawn.length,8);
  for(let i=0;i<drawn.length;i++){assert.equal(drawn[i].name,result.render.primitives[i].featureId);assert.equal(drawn[i].strokeWidth,0.25);assert.deepEqual(plain(drawn[i].strokeDashes),[0.75,0.5]);assert.equal(drawn[i].filled,false);}
  const stored=root.pathItems[0];assert.equal(stored.name,'__LG_DATA__');assert.equal(stored.hidden,true);assert.deepEqual(JSON.parse(stored.note),data);
  assert.equal(data.schemaVersion,1);assert.match(data.runId,/^lg_/);assert.equal(data.baseUnit.value,null);assert.equal(data.baseUnit.locked,false);assert.deepEqual(data.hiddenFeatures,[]);
  for(const source of sources){assert.equal(source.tags.find(t=>t.name==='LG_SOURCE').value,data.runId);assert.ok(source.tags.some(t=>t.name==='OTHER_TAG'));}
  assert.deepEqual(plain(LG.hostStore.read(doc)),data);
});

test('repeated Generate replaces automatic sublayers, keeps Manual and data path, clears old source tags only',()=>{
  const {LG,doc}=harness();const settings=LG.config.defaults();const sources=doc.selection;const result=LG.analyze(F3());
  const first=LG.hostDraw.generate(doc,result,settings,sources);const root=doc.layers[0];const dataPath=root.pathItems[0];const oldBaselines=root.layers[0];
  root.locked=false;const manual=root.layers.add();manual.name='LG Manual';root.locked=true;const differentSource=[sources[1]];
  const second=LG.hostDraw.generate(doc,result,settings,differentSource);
  assert.notEqual(second.runId,first.runId);assert.equal(root.pathItems[0],dataPath);assert.ok(root.layers.includes(manual));assert.ok(!root.layers.includes(oldBaselines));
  assert.ok(!sources[0].tags.some(t=>t.name==='LG_SOURCE'));assert.equal(sources[1].tags.find(t=>t.name==='LG_SOURCE').value,second.runId);
});

test('drawing failure restores prior root lock, active layer and selected artwork',()=>{
  const {LG,doc,artwork,state}=harness();const sources=doc.selection;const settings=LG.config.defaults();const result=LG.analyze(F3());
  LG.hostDraw.generate(doc,result,settings,sources);state.failDrawing=true;
  assert.throws(()=>LG.hostDraw.generate(doc,result,settings,sources),/drawing failure/);
  assert.equal(doc.layers[0].locked,true);assert.equal(doc.activeLayer,artwork);assert.equal(doc.selection,sources);
});

test('invalid document metadata is rejected before deleting prior output',()=>{
  const {LG,doc}=harness();const sources=doc.selection;const settings=LG.config.defaults();const result=LG.analyze(F3());
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
  const settings=LG.config.defaults();LG.hostDraw.generate(doc,LG.analyze(F3()),settings,doc.selection);
  assert.ok(Number.isFinite(doc.layers[0].layers[0].pathItems[0].strokeColor.black));
});

test('multiline labels use font fallbacks, actual group bounds and -90 rotation about center',()=>{
  const {LG,doc,artwork,fontLookups}=harness();const result=LG.analyze(F3());
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
  assert.equal(doc.activeLayer,artwork);assert.equal(doc.layers[0].name,'Logo Guides');assert.equal(doc.layers[0].layers[0].pathItems.length,8);
  assert.ok(alerts.some(m=>/Reference lines generated: 8/.test(m)));assert.ok(files.get('/mock/LogoGuides/log.txt').includes('M2 Generate OK'));
});
