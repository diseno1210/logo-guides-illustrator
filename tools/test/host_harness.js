'use strict';
const assert=require('node:assert/strict');const path=require('node:path');const vm=require('node:vm');
const {loadCore}=require('./load_core');const {sourceFiles,bundleFiles}=require('../build');const {rectangle}=require('./fixtures');const ROOT=path.resolve(__dirname,'../..');
const {windowMock}=require('./scriptui_mock');
/** Small Illustrator DOM double. This checks our calls, never Illustrator's actual behavior. */
function harness(){
  const {LG,context,plain}=loadCore();const alerts=[];const fontLookups=[];const files=new Map();
  const doc={typename:'Document',layers:[],pageItems:[],selection:[],documentColorSpace:0};
  const state={failDrawing:false};
  function tags(item){const list=[];list.add=()=>{const tag={name:'',value:'',remove(){list.splice(list.indexOf(tag),1);}};list.push(tag);return tag;};return list;}
  function pathItems(parent){const list=[];list.add=()=>{
    if(state.failDrawing&&parent.name==='LG Baselines')throw new Error('mock drawing failure');
    const item={typename:'PathItem',parent,name:'',hidden:false,tags:tags(),setEntirePath(points){this.points=plain(points);this.pathPoints=this.points.map(p=>({anchor:p,leftDirection:p,rightDirection:p}));},remove(){list.splice(list.indexOf(item),1);doc.pageItems.splice(doc.pageItems.indexOf(item),1);}};
    list.push(item);doc.pageItems.push(item);return item;
  };list.ellipse=(top,left,width,height)=>{const p=list.add();p.ellipse=[top,left,width,height];return p;};return list;}
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
    const layer={typename:'Layer',name:'',parent,locked:false,visible:true,zOrder(method){const index=list.indexOf(layer);list.splice(index,1);if(method===1)list.push(layer);else list.unshift(layer);},remove(){assert.equal(this.locked,false);if(state.failRemoving===layer.name)throw new Error('mock removal failure');list.splice(list.indexOf(layer),1);for(let i=doc.pageItems.length-1;i>=0;i--){let p=doc.pageItems[i].parent;while(p&&p!==layer)p=p.parent;if(p===layer)doc.pageItems.splice(i,1);}}};
    layer.layers=layers(layer);layer.pathItems=pathItems(layer);layer.groupItems=groups();
    list.unshift(layer);doc.activeLayer=layer;return layer;
  };return list;}
  doc.layers=layers(doc);const artwork=doc.layers.add();artwork.name='Artwork';
  for(let i=0;i<3;i++){
    const item=artwork.pathItems.add();Object.assign(item,{filled:true,stroked:false,strokeWidth:0,closed:true,clipping:false,geometricBounds:[i*40,100,i*40+20,0],pathPoints:rectangle(i*40,0,20,100).contours[0].points.map(p=>({anchor:p.a,leftDirection:p.l,rightDirection:p.r}))});
    item.tags.add().name='OTHER_TAG';
  }
  doc.selection=Array.from(artwork.pathItems);doc.activeLayer=artwork;
  doc.artboards=[{artboardRect:[-50,150,200,-50]}];doc.artboards.getActiveArtboardIndex=()=>0;
  function File(name){this.fsName=name;Object.defineProperty(this,'exists',{get:()=>files.has(this.fsName)});Object.defineProperty(this,'length',{get:()=>(files.get(this.fsName)||'').length});this.open=mode=>{if(state.failOpen===this.fsName)return false;if(mode==='w')files.set(this.fsName,'');return true;};this.write=contents=>{files.set(this.fsName,(files.get(this.fsName)||'')+contents);return true;};this.read=()=>files.get(this.fsName)||'';this.close=()=>true;this.remove=()=>files.delete(this.fsName);this.rename=newName=>{const target=this.fsName.replace(/[^/]+$/,newName);files.set(target,files.get(this.fsName));files.delete(this.fsName);this.fsName=target;return true;};}
  function Folder(name){this.fsName=name;this.exists=true;}Folder.userData={fsName:'/mock'};
  Object.assign(context,{File,Folder,app:{documents:[doc],activeDocument:doc,textFonts:{getByName(name){fontLookups.push(name);if(name==='ArialMT'||name==='MicrosoftYaHei')return {name};throw new Error('missing font');}}},alert:m=>alerts.push(m),confirm:()=>true,RGBColor:function(){},CMYKColor:function(){},DocumentColorSpace:{CMYK:1},StrokeCap:{BUTTENDCAP:0},ZOrderMethod:{BRINGTOFRONT:0},Transformation:{CENTER:0}});
  vm.runInContext(bundleFiles(sourceFiles(path.join(ROOT,'src/host'))),context);
  context.PathPointSelection={ANCHORPOINT:1,LEFTDIRECTION:2,RIGHTDIRECTION:3,NOSELECTION:0};context.ZOrderMethod.SENDTOBACK=1;context.Window=windowMock(state);
  return {LG,context,plain,doc,artwork,alerts,fontLookups,state,files};
}


module.exports={harness};
