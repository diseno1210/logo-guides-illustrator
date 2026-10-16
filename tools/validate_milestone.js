'use strict';
const fs=require('node:fs');const path=require('node:path');
const {loadCore}=require('./test/load_core');const {getFixture}=require('./test/fixtures');const {loadGeometry}=require('./svg_import');const {renderAnalysis}=require('./preview');
/** Generate milestone evidence from the same core used in Illustrator, without synthetic feature data. */
function validateMilestone(stage='M3'){
 const {LG,plain}=loadCore();const directory=path.resolve(__dirname,'../dist/validation',stage.toLowerCase());fs.mkdirSync(directory,{recursive:true});
 const cases=[['F3',{}],['F3-snap',{snapMode:'step'}],['F4',{}],['F6',{}],['F8',{}],['BOATCHIN',{}]];
 if(stage==='M4'||stage==='M5')cases.push(['F1',{}],['F2',{}],['F5',{}],['F7-loose',{tolerancePreset:'loose'}],['F7-strict',{tolerancePreset:'strict'}],['F9',{}],['F9b',{}]);
 const reports=cases.map(([name,settings])=>{
  const g=name==='BOATCHIN'?loadGeometry(path.resolve(__dirname,'samples/illustrator-boatchin.geometry.json')):getFixture(name.split('-')[0]);
  const input={stylePreset:'light',...settings};const start=performance.now();const result=plain(LG.analyze(g,input));const ms=performance.now()-start;
  fs.writeFileSync(path.join(directory,name+'.analysis.json'),JSON.stringify(result,null,2)+'\n');fs.writeFileSync(path.join(directory,name+'.svg'),renderAnalysis(g,input,result));
  return {name,settings:input,ms,baseUnit:result.analysis.baseUnit,stems:result.analysis.stems.length,gaps:result.analysis.gaps.length,circles:result.analysis.circles.length,rings:result.analysis.rings.length,angles:result.analysis.angles.length,primitives:result.render.primitives.length,warnings:result.analysis.warnings};
 });
 const cards=reports.map(r=>`<article><h2>${r.name}</h2><object data="${r.name}.svg" type="image/svg+xml"></object></article>`).join('\n');
 fs.writeFileSync(path.join(directory,'results.json'),JSON.stringify(reports,null,2)+'\n');fs.writeFileSync(path.join(directory,'gallery.html'),`<!doctype html><meta charset="utf-8"><title>${stage} QA</title><style>body{margin:16px;background:white;font:16px Arial;display:grid;grid-template-columns:repeat(3,1fr);gap:16px}article{height:460px;border:1px solid #ddd}h2{margin:10px;font-size:18px}object{width:100%;height:410px}</style>${cards}`);
 return reports;
}
if(require.main===module){try{console.log(JSON.stringify(validateMilestone(process.argv[2]),null,2));}catch(error){console.error(error.stack);process.exitCode=1;}}
module.exports={validateMilestone};
