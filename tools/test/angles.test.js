'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {loadCore}=require('./load_core');const {getFixture}=require('./fixtures');const {renderAnalysis}=require('../preview');const {importSvg}=require('../svg_import');
const {LG,plain}=loadCore();const analyze=(name,s={})=>plain(LG.analyze(getFixture(name),s));const near=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<t,`${a} vs ${b}`);
test('F4 has exactly two35degree axes and one70degree empty-sector pair, ordered pair first',()=>{
 const r=analyze('F4');const a=r.analysis.angles;assert.equal(a.length,3);assert.equal(a[0].kind,'pair');near(a[0].measure.value,70);assert.deepEqual(a.slice(1).map(a=>a.measure.value),[35,35]);assert.equal(r.render.primitives.filter(p=>p.style==='angleArc').length,3);assert.equal(r.render.primitives.filter(p=>p.style==='angleRef').length,2);
 const m=LG.sample.run(LG.geometry.normalize(getFixture('F4')));const ink=LG.ink.create(m);const pair=a[0];const rad=(pair.ray1Deg+pair.ray2Deg)/2*Math.PI/180;for(const t of [.5,1])assert.equal(ink(pair.center[0]+t*15*Math.cos(rad),pair.center[1]+t*15*Math.sin(rad)),false);
 const one=analyze('F4',{maxAngles:1});assert.equal(one.analysis.angles.length,1);assert.equal(one.analysis.angles[0].kind,'pair');assert.equal(analyze('F4',{maxAngles:0}).analysis.angles.length,0);
});
test('signed axes preserve orientation and angular targets rotate around their original vertex',()=>{
 const r=analyze('F4',{signedAxisAngles:true,angleSnapStep:15});assert.deepEqual(r.analysis.angles.filter(a=>a.kind==='axis').map(a=>a.measure.value).sort((a,b)=>a-b),[-35,35]);const targets=r.render.primitives.filter(p=>p.layer==='targets');assert.equal(targets.length,2);for(const t of targets){const a=r.analysis.angles.find(a=>a.id===t.featureId);assert.deepEqual(t.p0,a.center);near(Math.hypot(t.p1[0]-t.p0[0],t.p1[1]-t.p0[1]),a.edgeLength);const angle=(Math.atan2(t.p1[1]-t.p0[1],t.p1[0]-t.p0[0])*180/Math.PI+360)%360;near(angle,90-a.measure.target);}
});
test('F3 targets keep stem center and left gap edge at the required coordinates',()=>{
 const r=analyze('F3',{snapMode:'step'});const t=r.render.primitives.filter(p=>p.layer==='targets');assert.equal(t.length,3);const stems=t.filter(p=>p.featureId==='S3').map(p=>p.p0[0]).sort((a,b)=>a-b);near(stems[0],80.9);near(stems[1],99.9);const gap=t.find(p=>p.featureId==='G2');near(gap.p0[0],81);assert.deepEqual(gap.p0,[81,0]);assert.deepEqual(gap.p1,[81,100]);assert.equal(analyze('F3').render.primitives.filter(p=>p.layer==='targets').length,0);assert.equal(analyze('F3',{snapMode:'step',features:{targetLines:false}}).render.primitives.filter(p=>p.layer==='targets').length,0);
});
test('construction groups collinear edges and clips to the final legend-expanded area',()=>{
 const r=analyze('F4');assert.ok(r.analysis.constructionLines.some(k=>k.edgeCount>1));for(const k of r.analysis.constructionLines){const b=r.render.guideArea;for(const p of [k.p0,k.p1]){assert.ok(p[0]>=b[0]-1e-8&&p[0]<=b[2]+1e-8&&p[1]>=b[3]-1e-8&&p[1]<=b[1]+1e-8);assert.ok([p[0]-b[0],p[0]-b[2],p[1]-b[1],p[1]-b[3]].some(x=>Math.abs(x)<1e-8));}}
 assert.equal(analyze('F4',{maxConstructionLines:1}).analysis.constructionLines.length,1);assert.equal(analyze('F4',{features:{angles:false}}).analysis.angles.length,0);
 assert.deepEqual(plain(LG.angles.clip([0,0],[1,0],[-2,3,4,-3],1e-9)),[[-2,0],[4,0]]);assert.equal(LG.angles.clip([0,5],[1,0],[-2,3,4,-3],1e-9),null);
});
test('legend lists only actual output categories, supports both languages and disappears when empty',()=>{
 const labels=r=>r.render.primitives.filter(p=>p.layer==='legend'&&p.type==='label').map(p=>p.lines[0].text);
 assert.deepEqual(labels(analyze('F3',{legendLanguage:'en'})),['Baseline']);assert.deepEqual(labels(analyze('F3',{snapMode:'step',legendLanguage:'zh'})),['基准线','目标线']);assert.deepEqual(labels(analyze('F4',{legendLanguage:'both'})),['Baseline 基准线','Construction Line 构造线']);
 const hidden={};for(const key of Object.keys(LG.config.defaults().features))hidden[key]=false;hidden.legend=true;assert.deepEqual(labels(analyze('F4',{features:hidden})),[]);assert.ok(!labels(analyze('F1')).some(t=>/Visual|视觉/.test(t)));assert.ok(labels(analyze('F9')).some(t=>/Visual/.test(t)));
});
test('optional clearspace and background use the final area and SVG reimport still reads only geometry',()=>{
 const s={features:{clearSpace:true,background:true},clearSpaceFactor:2};const r=analyze('F3',s);assert.equal(r.render.primitives.filter(p=>p.style==='clearSquare').length,4);const frame=r.render.primitives.find(p=>p.style==='clearFrame');assert.deepEqual(frame.points[0],[-40,140]);const b=r.render.primitives.find(p=>p.style==='background');assert.deepEqual(b.points[0],[r.render.guideArea[0]-r.render.fontSize,r.render.guideArea[1]+r.render.fontSize]);
 const g=getFixture('F3');const svg=renderAnalysis(g,s,r);assert.match(svg,/<use href="#lg-geometry"/);assert.equal(importSvg(svg).parts.length,3);
});
