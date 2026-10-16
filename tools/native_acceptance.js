'use strict';

// Generates an opt-in Illustrator-native probe. This is not a UI acceptance substitute.
const fs = require('node:fs');
const path = require('node:path');
const { sourceFiles, bundleFiles, asciiEscape } = require('./build');
const { F9, F10 } = require('./test/fixtures');
const root = path.resolve(__dirname, '..');

function create(output, options = {}) {
  output = path.resolve(output);
  if (fs.existsSync(path.join(output, 'results.json'))) throw new Error('Use a fresh output directory to preserve native evidence');
  fs.mkdirSync(output, { recursive: true });
  const shared = bundleFiles([...sourceFiles(path.join(root, 'src/core')), ...sourceFiles(path.join(root, 'src/host'))]);
  const probe = `
var output=${JSON.stringify(output.replace(/\\/g, '/'))};
var notices=[];var alert=function(message){notices.push(String(message));};
${shared}
var report={version:app.version,os:$.os,started:new Date().toString(),checks:[],notices:notices,limitations:["ScriptUI choices supplied by probe; no dialog visual verification","Anchor edit and duplicate use DOM; not Direct Selection or Alt-drag","Native guide flags checked; snapping not tested","Undo is a separate UI test"]};
var original=app.documents.length?app.activeDocument:null;var docs=[];var settings=LG.config.defaults();settings.showSummary=false;
LG.hostStore.settings=function(){return LG.util.clone(settings);};
LG.hostStore.saveSettings=function(value){settings=LG.config.resolve(value).settings;return settings;};
LG.hostUI.generate=function(){return LG.util.clone(settings);};
function persist(){LG.hostEnv.writeUTF8(new File(output+"/results.json"),LG.json.stringify(report,null,2)+"\\n","w");}
function check(name,fn){try{var detail=fn();report.checks.push({name:name,status:"pass",detail:detail===undefined?null:detail});}catch(e){report.checks.push({name:name,status:"fail",error:String(e),line:e.line});}persist();}
function assert(value,message){if(!value){throw new Error(message);}}
function makeDoc(space,name){var d=app.documents.add(space,650,440);docs.push(d);d.layers[0].name=name;return d;}
function fill(item){item.filled=true;item.stroked=false;var c=new RGBColor();c.red=25;c.green=25;c.blue=25;item.fillColor=c;}
function addGeometry(d,g){var sources=[];var i,j,k,p,c,item,container;
for(i=0;i<g.parts.length;i+=1){p=g.parts[i];container=p.contours.length>1?d.activeLayer.compoundPathItems.add():d.activeLayer;
for(j=0;j<p.contours.length;j+=1){c=p.contours[j];item=container.pathItems.add();item.setEntirePath(LG.util.mapArr(c.points,function(q){return q.a;}));item.closed=c.closed;fill(item);for(k=0;k<c.points.length;k+=1){item.pathPoints[k].leftDirection=c.points[k].l;item.pathPoints[k].rightDirection=c.points[k].r;}}
sources.push(p.contours.length>1?container:item);}return sources;}
function child(root,name){for(var i=0;i<root.layers.length;i+=1){if(root.layers[i].name===name){return root.layers[i];}}return null;}
function snapshot(d,name){app.redraw();var options=new ExportOptionsPNG24();options.artBoardClipping=true;options.transparency=false;options.horizontalScale=125;options.verticalScale=125;d.exportFile(new File(output+"/"+name+".png"),ExportType.PNG24,options);var ai=new IllustratorSaveOptions();ai.pdfCompatible=true;d.saveAs(new File(output+"/"+name+".ai"),ai);}
function caseSpace(space,name){var d=makeDoc(space,name);var originalLayer=d.activeLayer;var sources=addGeometry(d,${JSON.stringify(F9())});
// Translate fixture into the artboard; the compound remains native.
for(var i=0;i<sources.length;i+=1){sources[i].translate(130,190);}
var group=originalLayer.groupItems.add();sources[0].move(group,ElementPlacement.PLACEATEND);sources[0]=group;
var text=originalLayer.textFrames.add();text.contents="验收 LOGO";text.position=[300,240];text.textRange.characterAttributes.size=32;sources.push(text);
var before=originalLayer.pageItems.length;var textContents=text.contents;d.selection=sources;settings=LG.config.defaults();settings.showSummary=false;settings.features.background=true;
var generated;
check(name+" generate native grouped compound live text",function(){generated=LG.hostActions.generate(d);assert(generated,"No result");assert(text.contents===textContents,"Original text changed");assert(originalLayer.pageItems.length===before,"Temporary outlines remain");return {primitives:generated.result.render.primitives.length,a:generated.data.baseUnit};});
if(!generated){return;}
check(name+" layers metadata colors background activeLayer",function(){var r=LG.hostStore.layer(d);assert(r.locked,"Root unlocked");assert(d.activeLayer===originalLayer,"Active layer changed");assert(LG.hostStore.read(d).runId===generated.data.runId,"Metadata mismatch");var foundData=false;for(var k=0;k<r.pathItems.length;k+=1){if(r.pathItems[k].name==="__LG_DATA__"){foundData=r.pathItems[k].hidden;}}assert(foundData,"Data not hidden");var kinds={};for(var j=0;j<d.pathItems.length;j+=1){var p=d.pathItems[j];if(LG.hostRead.inGuides(p)&&p.stroked){kinds[p.strokeColor.typename]=true;}}assert(kinds[name==="CMYK"?"CMYKColor":"RGBColor"],"Wrong native color type");assert(d.layers[d.layers.length-1].name==="Logo Guides BG","Background not at bottom");return {colorTypes:kinds,sublayers:LG.util.mapArr(r.layers,function(l){return l.name;})};});
check(name+" native rendered evidence",function(){snapshot(d,name.toLowerCase());return name.toLowerCase()+".ai/.png";});
var locked=generated.data.baseUnit.value;var oldRun=generated.data.runId;
check(name+" anchor edit partial-selection refresh locked a",function(){var p=group.pathItems[0].pathPoints[0];var a=p.anchor;p.anchor=[a[0]-10,a[1]];p.leftDirection=p.anchor;p.rightDirection=p.anchor;d.selection=[text];var result=LG.hostActions.refresh(d);assert(result.data.baseUnit.value===locked,"Locked a changed");assert(result.data.runId===oldRun,"RunId changed");assert(LG.hostStore.sources(d,oldRun).length===3,"Partial sources used");assert(d.selection.length===3,"Full source selection not restored");return {a:result.data.baseUnit.value,sources:d.selection.length,primitives:result.result.render.primitives.length};});
check(name+" selected anchors manual circle refresh preservation",function(){var cp=sources[1].pathItems[0];d.selection=[cp];for(var j=0;j<cp.pathPoints.length;j+=1){cp.pathPoints[j].selected=PathPointSelection.ANCHORPOINT;}var fitted=LG.hostManual.circle(d,settings);assert(fitted.anchorCount>=3,"Missing selected anchors");var manual=child(LG.hostStore.layer(d),"LG Manual");assert(manual&&manual.pageItems.length>0,"Manual missing");var count=manual.pageItems.length;LG.hostActions.refresh(d);assert(child(LG.hostStore.layer(d),"LG Manual").pageItems.length===count,"Manual lost");return fitted;});
check(name+" DOM duplicate tag behavior (not Alt-drag)",function(){var copy=group.duplicate();copy.translate(20,-130);var count=LG.hostStore.sources(d,oldRun).length;assert(count===4,"Native duplicate did not carry source tag");var refreshed=LG.hostActions.refresh(d);return {sources:count,primitives:refreshed.result.render.primitives.length};});
check(name+" SetBaseUnit native object",function(){d.selection=[group];var options=LG.hostActions.baseOptions(d,settings);assert(options.length===3,"No object measurements");var updated=LG.hostActions.setBaseUnit(d,25);assert(updated.data.baseUnit.locked&&updated.data.baseUnit.value===25,"Manual a not locked");return {a:updated.data.baseUnit};});
check(name+" guides flags and visible labels",function(){settings.output="guides";LG.hostActions.refresh(d);var r=LG.hostStore.layer(d);var guides=child(r,"LG Snap Guides");assert(guides&&guides.pathItems.length>0,"Guides missing");for(var j=0;j<guides.pathItems.length;j+=1){assert(guides.pathItems[j].guides,"Non-guide path in snap layer");}assert(child(r,"LG Labels")||child(r,"LG Legend"),"Visible labels missing");snapshot(d,name.toLowerCase()+"-guides");return {nativeGuides:guides.pathItems.length};});
check(name+" clear auto all data",function(){var r=LG.hostStore.layer(d);var manual=child(r,"LG Manual");assert(manual,"Manual prerequisite missing");var originalItems=originalLayer.pageItems.length;LG.hostActions.clear(d,"auto");r=LG.hostStore.layer(d);assert(r.layers.length===1&&r.layers[0].name==="LG Manual","Auto clear scope wrong");assert(LG.hostStore.read(d)&&LG.hostStore.sources(d,oldRun).length===4,"Auto clear removed data/tags");LG.hostActions.refresh(d);LG.hostActions.clear(d,"all");r=LG.hostStore.layer(d);assert(r.layers.length===0,"All clear left manual/auto");assert(LG.hostStore.read(d)&&LG.hostStore.sources(d,oldRun).length===4,"All clear removed data/tags");LG.hostActions.refresh(d);LG.hostActions.clear(d,"data");assert(!LG.hostStore.layer(d)&&LG.hostStore.sources(d,oldRun).length===0,"Data clear left tags/root");assert(originalLayer.pageItems.length===originalItems&&text.contents===textContents,"Clear changed artwork");return {originalItems:originalItems};});
}
try{caseSpace(DocumentColorSpace.RGB,"RGB");caseSpace(DocumentColorSpace.CMYK,"CMYK");
if(${options.skipPerformance ? 'false' : 'true'}){check("2000 anchors native read analyze draw performance measurement",function(){var d=makeDoc(DocumentColorSpace.RGB,"Performance");d.artboards[0].artboardRect=[-50,70,550,-300];var sources=addGeometry(d,${JSON.stringify(F10())});d.selection=sources;settings=LG.config.defaults();settings.showSummary=false;var result=LG.hostActions.generate(d);var points=0;for(var i=0;i<sources.length;i+=1){points+=sources[i].pathPoints.length;}assert(points===2000,"Wrong fixture size");snapshot(d,"performance");return {anchors:points,elapsedMs:result.elapsedMs,targetMs:15000,targetMet:result.elapsedMs<=15000,primitives:result.result.render.primitives.length};});}
}catch(e){report.fatal={error:String(e),line:e.line};}
finally{report.finished=new Date().toString();persist();for(var i=docs.length-1;i>=0;i-=1){try{docs[i].close(SaveOptions.DONOTSAVECHANGES);}catch(ignored){}}if(original){original.activate();}}
return LG.json.stringify(report);
`;
  const file = path.join(output, 'probe.jsx');
  fs.writeFileSync(file, asciiEscape('#target illustrator\n(function(){\n' + probe + '\n}());\n'));
  return file;
}
if (require.main === module) console.log(create(process.argv[2] || path.join(root, 'dist/native-acceptance', new Date().toISOString().replace(/[:.]/g, '-')), { skipPerformance: process.argv.includes('--skip-performance') }));
module.exports = { create };
