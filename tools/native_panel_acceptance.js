'use strict';
// Generates an isolated native bridge session. Never opens or saves user originals.
const fs=require('node:fs');
const path=require('node:path');
const {bundleFiles,sourceFiles,asciiEscape}=require('./build');
const {F9,F10}=require('./test/fixtures');
const root=path.resolve(__dirname,'..');
function create(output,large=false){
  output=path.resolve(output);fs.mkdirSync(output,{recursive:true});
  if(fs.existsSync(path.join(output,'setup.jsx')))throw new Error('Use a fresh evidence directory');
  const core=bundleFiles([...sourceFiles(path.join(root,'src/core')),...sourceFiles(path.join(root,'src/host'))]);
  const api=fs.readFileSync(path.join(root,'src/panel/host_api.js'),'utf8');
  const model=fs.readFileSync(path.join(root,'src/panel/js/model.js'),'utf8');
  const geometry=large?F10():F9();
  const resultFile=path.join(output,'results.json').replace(/\\/g,'/');
  const setup=`var LG_M7_Test=(function(){
${core}
${model}
${api}
var original=app.documents.length?app.activeDocument:null;var d=app.documents.add(DocumentColorSpace.RGB,700,500);d.layers[0].name="M7 isolated test";
var settings=LG.config.defaults();settings.showSummary=false;LG.hostStore.settings=function(){return LG.util.clone(settings);};LG.hostStore.saveSettings=function(s){settings=LG.config.resolve(s).settings;return settings;};
var geometry=${JSON.stringify(geometry)};d.artboards[0].artboardRect=geometry.artboard;var sources=[];var i,j,k,p,c,item,container;
for(i=0;i<geometry.parts.length;i+=1){p=geometry.parts[i];container=p.contours.length>1?d.activeLayer.compoundPathItems.add():d.activeLayer;for(j=0;j<p.contours.length;j+=1){c=p.contours[j];item=container.pathItems.add();item.setEntirePath(LG.util.mapArr(c.points,function(q){return q.a;}));item.closed=c.closed;item.filled=true;item.stroked=false;for(k=0;k<c.points.length;k+=1){item.pathPoints[k].leftDirection=c.points[k].l;item.pathPoints[k].rightDirection=c.points[k].r;}}sources.push(p.contours.length>1?container:item);}d.selection=sources;
function out(value){LG.hostEnv.writeUTF8(new File(${JSON.stringify(resultFile)}),LG.json.stringify(value,null,2)+"\\n","w");}function data(raw){var v=LG.json.parse(raw);if(!v.ok)throw new Error(v.error);return v.data;}function check(list,name,fn){try{list.push({name:name,status:"pass",detail:fn()});}catch(e){list.push({name:name,status:"fail",error:String(e),line:e.line});}}function assert(v,m){if(!v)throw new Error(m);}
var report={fixture:${JSON.stringify(large?'F10':'F9')},checks:[],started:new Date().getTime()};
check(report.checks,"read token, panel compute and one draw",function(){var begin=new Date().getTime();var input=data(LGHost_read("selection"));var context=LG.preAnalyze(input.geometry,input.settings);var analyzed=LG.analyze(input.geometry,input.settings,context);var computeMs=new Date().getTime()-begin;var drawn=data(LGHost_draw(encodeURIComponent(LG.json.stringify({mode:"selection",readToken:input.readToken,settings:input.settings,result:analyzed,hiddenFeatures:[]}))));report.timing={readMs:input.readMs,computeMs:computeMs,drawMs:drawn.drawMs,totalMs:new Date().getTime()-begin};report.analysis=analyzed;assert(drawn.docData&&drawn.primitives===analyzed.render.primitives.length,"Bridge draw mismatch");return {timing:report.timing,primitives:drawn.primitives,a:analyzed.analysis.baseUnit.value};});
check(report.checks,"feature visibility and selection",function(){var list=LG.panelModel.catalog(report.analysis.analysis);var feature=list[0];var hidden=data(LGHost_setFeatureVisible(encodeURIComponent(LG.json.stringify({id:feature.id,visible:false}))));assert(hidden.hiddenFeatures.length===1,"Hidden metadata missing");var selected=data(LGHost_selectFeature(feature.id));assert(selected.matched>0,"Feature selection missing");return {id:feature.id,matched:selected.matched};});
check(report.checks,"document state and clear",function(){var docData=data(LGHost_getDocData());assert(docData.docData.hiddenFeatures.length===1,"Hidden state not persisted");data(LGHost_clear("data"));assert(!LG.hostStore.layer(d),"Data clear left layer");return {cleared:true};});out(report);return {LG:LG,api:LGHost,doc:d,original:original,sources:sources,result:report};}());
"ready";`;
  fs.writeFileSync(path.join(output,'setup.jsx'),asciiEscape('#target illustrator\n'+setup));
  fs.writeFileSync(path.join(output,'cleanup.jsx'),'#target illustrator\nLG_M7_Test.doc.close(SaveOptions.DONOTSAVECHANGES);if(LG_M7_Test.original){LG_M7_Test.original.activate();}LG_M7_Test=null;"closed";');
  return output;
}
if(require.main===module)console.log(create(process.argv[2],process.argv.includes('--large')));module.exports={create};
