'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {loadCore}=require('./load_core');
const {sourceFiles,bundleFiles,build}=require('../build');
const {validateGeometry}=require('../svg_import');
const {rectangle}=require('./fixtures');
const ROOT=path.resolve(__dirname,'../..');

function hostPath(x=0,y=0,width=20,height=100,parent=null){
  const points=rectangle(x,y,width,height).contours[0].points;
  return {typename:'PathItem',parent,hidden:false,clipping:false,closed:true,filled:true,stroked:false,strokeWidth:0,
    pathPoints:points.map(p=>({anchor:p.a,leftDirection:p.l,rightDirection:p.r}))};
}
function document(selected=[]){
  const layer={typename:'Layer',name:'Artwork',parent:null};
  const boards=[{artboardRect:[0,200,200,-200]},{artboardRect:[300,200,600,-200]}];boards.getActiveArtboardIndex=()=>1;
  for(const item of selected)if(!item.parent)item.parent=layer;
  return {selection:selected,activeLayer:layer,artboards:boards,documentColorSpace:0};
}
function harness(doc,confirmResult=true){
  const {LG,context,plain}=loadCore();
  const files=new Map();const alerts=[];const confirms=[];
  function File(name){this.fsName=name;this.exists=files.has(name);this.length=files.get(name)?.length||0;this.error='';}
  File.prototype.open=function(mode){this.mode=mode;return true;};
  File.prototype.write=function(contents){files.set(this.fsName,(this.mode==='a'?(files.get(this.fsName)||''):'')+contents);return true;};
  File.prototype.close=function(){return true;};
  File.prototype.remove=function(){files.delete(this.fsName);return true;};
  File.prototype.rename=function(name){const newName=this.fsName.slice(0,this.fsName.lastIndexOf('/')+1)+name;files.set(newName,files.get(this.fsName));files.delete(this.fsName);this.fsName=newName;return true;};
  function Folder(name){this.fsName=name;this.exists=true;}
  Folder.userData={fsName:'/mock/user-data'};
  context.File=File;context.Folder=Folder;context.app={documents:doc?[doc]:[],activeDocument:doc};context.DocumentColorSpace={CMYK:1};
  context.alert=message=>alerts.push(message);context.confirm=message=>{confirms.push(message);return confirmResult;};
  vm.runInContext(bundleFiles(sourceFiles(path.join(ROOT,'src/host'))),context,{timeout:1000});
  return {LG,context,plain,files,alerts,confirms};
}

test('host guards no document, empty selection and text editing without accessing geometry',()=>{
  assert.throws(()=>harness(null).LG.hostEnv.documentOrThrow(),/打开文档/);
  const doc=document();const {LG}=harness(doc);assert.throws(()=>LG.hostRead.selection(doc,{}),/选中 logo/);
  doc.selection={typename:'TextRange'};assert.throws(()=>LG.hostRead.selection(doc,{}),/Esc/);
  doc.selection=[{typename:'TextRange'}];assert.throws(()=>LG.hostRead.selection(doc,{}),/Esc/);
});

test('compound child selection promotes parent and deduplicates; sourceIndex and RGB/CMYK follow contract',()=>{
  const compound={typename:'CompoundPathItem',pathItems:[],hidden:false,parent:null};
  const a=hostPath(0,0,20,100,compound);const b=hostPath(5,5,10,90,compound);compound.pathItems=[a,b];
  const doc=document([a,b,compound]);const {LG,plain}=harness(doc);doc.documentColorSpace=1;
  const geometry=plain(LG.hostRead.selection(doc,{}));validateGeometry(geometry);
  assert.equal(geometry.parts.length,1);assert.equal(geometry.parts[0].kind,'compound');assert.equal(geometry.parts[0].contours.length,2);assert.equal(geometry.parts[0].sourceIndex,0);
  assert.equal(geometry.colorSpace,'CMYK');assert.deepEqual(geometry.artboard,[0,200,200,-200]);
});

test('nested groups are traversed once, clipping/hidden/guides excluded, unsupported types counted',()=>{
  const group={typename:'GroupItem',pageItems:[],hidden:false,clipped:true,parent:null};
  const pathItem=hostPath(0,0,20,100,group);const hidden=hostPath(40,0,20,100,group);hidden.hidden=true;
  const clip=hostPath(0,0,200,200,group);clip.clipping=true;
  const nested={typename:'GroupItem',pageItems:[],hidden:false,clipped:false,parent:group};const nestedPath=hostPath(40,0,20,100,nested);nested.pageItems=[nestedPath];
  group.pageItems=[pathItem,hidden,clip,nested,nestedPath,{typename:'RasterItem',parent:group},{typename:'RasterItem',parent:group}];
  const guideLayer={typename:'Layer',name:'Logo Guides',parent:null};const childLayer={typename:'Layer',name:'Nested',parent:guideLayer};const guide=hostPath(0,0,5,5,childLayer);
  const doc=document([group,pathItem,guide]);const original=doc.selection;const layer=doc.activeLayer;const {LG,plain}=harness(doc);
  const geometry=plain(LG.hostRead.selection(doc,{}));assert.equal(geometry.parts.length,2);assert.deepEqual(geometry.parts.map(p=>p.sourceIndex),[0,0]);
  assert.ok(geometry.warnings.some(w=>/RasterItem: 2/.test(w.message)));assert.equal(doc.selection,original);assert.equal(doc.activeLayer,layer);
});

function textSource(doc,{outlineFailure=false,readFailure=false}={}){
  const state={duplicates:0,removed:0};
  const text={typename:'TextFrame',hidden:false,parent:doc.activeLayer,duplicate(){
    state.duplicates++;doc.activeLayer={name:'Temporary'};doc.selection=[];
    return {remove(){state.removed++;},createOutline(){
      if(outlineFailure)throw new Error('mock createOutline failed');
      const outline={typename:'GroupItem',hidden:false,pageItems:[],remove(){state.removed++;}};
      const pathItem=hostPath(0,0,20,100,outline);
      if(readFailure)Object.defineProperty(pathItem,'pathPoints',{get(){throw new Error('mock read failure');}});
      outline.pageItems=[pathItem];return outline;
    }};
  }};
  return {text,state};
}

test('text reads a temporary outline, removes it, restores selection/activeLayer, and preserves original source',()=>{
  const doc=document();const {text,state}=textSource(doc);doc.selection=[text];const selection=doc.selection;const layer=doc.activeLayer;const {LG,plain}=harness(doc);
  const geometry=plain(LG.hostRead.selection(doc,{}));assert.equal(geometry.parts[0].kind,'textOutline');assert.equal(state.duplicates,1);assert.equal(state.removed,1);assert.equal(doc.selection,selection);assert.equal(doc.activeLayer,layer);
});

for(const option of ['outlineFailure','readFailure'])test('temporary text cleanup survives '+option,()=>{
  const doc=document();const {text,state}=textSource(doc,{[option]:true});doc.selection=[text];const selection=doc.selection;const layer=doc.activeLayer;const {LG}=harness(doc);
  assert.throws(()=>LG.hostRead.selection(doc,{}));assert.equal(state.removed,1);assert.equal(doc.selection,selection);assert.equal(doc.activeLayer,layer);
});

test('text outlining can be disabled and zero-length or unsupported-only selections produce actionable errors',()=>{
  const doc=document([hostPath()]);const {text,state}=textSource(doc);doc.selection.push(text);const {LG,plain}=harness(doc);
  const result=plain(LG.hostRead.selection(doc,{autoOutlineText:false}));assert.equal(result.parts.length,1);assert.equal(state.duplicates,0);assert.ok(result.warnings.some(w=>/TextFrame/.test(w.message)));
  doc.selection=[{typename:'RasterItem'}];assert.throws(()=>LG.hostRead.selection(doc,{}),/RasterItem: 1/);
  doc.selection=[hostPath(0,0,0,0)];assert.throws(()=>LG.hostRead.selection(doc,{}),/No supported paths/);
});

test('read artboard follows selection center, falling back to active artboard',()=>{
  const doc=document([hostPath(320,0,20,100)]);const {LG,plain}=harness(doc);
  assert.deepEqual(plain(LG.hostRead.selection(doc,{}).artboard),[300,200,600,-200]);
  doc.selection=[hostPath(1000,0,20,100)];assert.deepEqual(plain(LG.hostRead.selection(doc,{}).artboard),[300,200,600,-200]);
});

test('large selections prompt once and cancellation prevents export',()=>{
  const item=hostPath();item.pathPoints=Array.from({length:20001},(_,i)=>({anchor:[i,i%2],leftDirection:[i,i%2],rightDirection:[i,i%2]}));
  const doc=document([item]);const {LG,confirms}=harness(doc,false);assert.throws(()=>LG.hostRead.selection(doc,{}),/取消/);assert.equal(confirms.length,1);
});

test('built DumpGeometry runs end-to-end in a mocked ES3 host and writes Node-readable UTF-8 JSON',()=>{
  const doc=document([hostPath()]);const {context,files,alerts}=harness(doc);
  const target=build().find(file=>file.endsWith('LogoGuides_DumpGeometry.jsx'));
  vm.runInContext(fs.readFileSync(target,'utf8').replace(/^#target illustrator\n/,''),context,{timeout:5000});
  const dumped=files.get('/mock/user-data/LogoGuides/geometry_dump.json');assert.ok(dumped);
  const geometry=validateGeometry(JSON.parse(dumped));assert.equal(geometry.parts.length,1);
  assert.ok(alerts.some(m=>/Geometry exported/.test(m)));assert.ok(files.get('/mock/user-data/LogoGuides/log.txt').includes('DumpGeometry OK'));
});

test('pathPoints collection is read once and pure-stroke/open data stays in the dump with warnings',()=>{
  const item=hostPath();const points=item.pathPoints;let reads=0;
  Object.defineProperty(item,'pathPoints',{get(){reads++;return points;}});
  item.closed=false;item.filled=false;item.stroked=true;item.strokeWidth=2;
  const doc=document([item]);const {LG,plain}=harness(doc);const geometry=plain(LG.hostRead.selection(doc,{}));
  assert.equal(reads,1);assert.equal(geometry.parts[0].contours[0].closed,false);assert.equal(geometry.parts[0].strokeWidth,2);
  assert.ok(geometry.warnings.some(w=>w.code==='OUTLINE_STROKES'));
});

test('file writes close on success/failure and do not write after open failure',()=>{
  const {LG}=harness(document());let closes=0;let writes=0;
  const file={fsName:'/fake/file',open(){return true;},write(){writes++;return false;},close(){closes++;}};
  assert.throws(()=>LG.hostEnv.writeUTF8(file,'x'),/Cannot write/);assert.equal(closes,1);assert.equal(writes,1);
  file.open=()=>false;assert.throws(()=>LG.hostEnv.writeUTF8(file,'x'),/Cannot open/);assert.equal(closes,1);assert.equal(writes,1);
  file.open=()=>true;file.write=()=>true;LG.hostEnv.writeUTF8(file,'x');assert.equal(closes,2);assert.equal(file.encoding,'UTF-8');
});
