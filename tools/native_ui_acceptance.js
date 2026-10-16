'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { sourceFiles, bundleFiles, asciiEscape } = require('./build');
const root = path.resolve(__dirname, '..');

/** Separate calls keep the Generate undo step distinct from fixture creation. */
function create(output) {
  output = path.resolve(output);
  fs.mkdirSync(output, { recursive: true });
  const shared = bundleFiles([...sourceFiles(path.join(root, 'src/core')), ...sourceFiles(path.join(root, 'src/host'))]);
  const dir = JSON.stringify(output.replace(/\\/g, '/'));
  const write = (name, source) => fs.writeFileSync(path.join(output, name + '.jsx'), asciiEscape('#target illustrator\n(function(){\n' + source + '\n}());\n'));
  write('setup', `var target=new File(${dir}+"/LG_M6_UI.ai");if(target.exists){throw new Error("Use a fresh output directory; test document already exists");}var d=app.documents.add(DocumentColorSpace.RGB,650,440);d.layers[0].name="LG M6 UI source";var p=d.pathItems.rectangle(300,150,20,100);p.filled=true;p.stroked=false;var q=d.pathItems.ellipse(300,220,100,100);q.filled=true;q.stroked=false;d.selection=[p,q];var options=new IllustratorSaveOptions();options.pdfCompatible=true;d.saveAs(target,options);return d.name;`);
  const guard = `var d=app.activeDocument;if(d.name!=="LG_M6_UI.ai"||d.fullName.fsName!==new File(${dir}+"/LG_M6_UI.ai").fsName){throw new Error("Refusing to operate outside the exact test document path");}\n`;
  write('generate', `var notices=[];var alert=function(s){notices.push(String(s));};\n${shared}\n${guard}LG.hostStore.settings=function(){var s=LG.config.defaults();s.showSummary=false;return s;};LG.hostStore.saveSettings=function(s){return LG.config.resolve(s).settings;};var result=LG.hostActions.generate(d);LG.hostEnv.writeUTF8(new File(${dir}+"/ui-result.json"),LG.json.stringify({cancelled:!result,notices:notices,data:result?result.data:null},null,2),"w");return "UI completed";`);
  write('inspect', `${shared}\n${guard}var summary={name:d.name,layers:[],items:d.pageItems.length,sourceTags:0,selected:d.selection.length};for(var i=0;i<d.layers.length;i+=1){summary.layers.push({name:d.layers[i].name,locked:d.layers[i].locked});}for(i=0;i<d.pageItems.length;i+=1){for(var j=0;j<d.pageItems[i].tags.length;j+=1){if(d.pageItems[i].tags[j].name==="LG_SOURCE"){summary.sourceTags+=1;}}}return LG.json.stringify(summary);`);
  write('select-anchor', `${shared}\n${guard}d.selection=null;var p=d.layers.getByName("LG M6 UI source").pathItems[0];p.selected=true;for(var i=0;i<p.pathPoints.length;i+=1){p.pathPoints[i].selected=PathPointSelection.NOSELECTION;}p.pathPoints[0].selected=PathPointSelection.ANCHORPOINT;app.redraw();return LG.json.stringify({anchor:p.pathPoints[0].anchor,a:LG.hostStore.read(d).baseUnit});`);
  write('refresh', `var notices=[];var alert=function(s){notices.push(String(s));};\n${shared}\n${guard}LG.hostStore.settings=function(){var s=LG.config.defaults();s.showSummary=false;return s;};var result=LG.hostActions.refresh(d);return LG.json.stringify({anchor:d.layers.getByName("LG M6 UI source").pathItems[0].pathPoints[0].anchor,data:result.data,notices:notices});`);
  write('prepare-final', `var alert=function(){};\n${shared}\n${guard}LG.hostStore.settings=function(){var s=LG.config.defaults();s.showSummary=false;s.output="guides";s.stylePreset="light";return s;};LG.hostActions.refresh(d);d.selection=null;app.redraw();var options=new IllustratorSaveOptions();options.pdfCompatible=true;d.saveAs(new File(${dir}+"/LG_M6_UI.ai"),options);return "Native guides test document saved; two tagged source objects; a=20";`);
  write('cleanup', `${guard}d.close(SaveOptions.DONOTSAVECHANGES);return "Test document closed";`);
  return output;
}
if (require.main === module) console.log(create(process.argv[2] || path.join(root, 'dist/native-acceptance/ui')));
module.exports = { create };
