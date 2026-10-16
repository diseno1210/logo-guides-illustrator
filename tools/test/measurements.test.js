'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {loadCore}=require('./load_core');const {getFixture,geometry,rectangle}=require('./fixtures');
const {LG,plain}=loadCore();const analyze=(g,s={})=>plain(LG.analyze(g,{...s,features:{legend:false,...s.features}}));
const near=(a,b,e=1e-7)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b}`);
test('F3 widths, bbox gaps, automatic a and un-snapped labels match the specification',()=>{
 const r=analyze(getFixture('F3'));assert.equal(r.analysis.baseUnit.source,'auto-stem');near(r.analysis.baseUnit.value,20);
 assert.deepEqual(r.analysis.stems.map(s=>s.measure.display),['a','a','0.96a']);assert.deepEqual(r.analysis.gaps.map(g=>g.measure.display),['a','1.04a']);
 r.analysis.stems.forEach(s=>{assert.equal(s.measure.target,null);assert.equal(s.measure.devAbs,null);assert.equal(s.measure.severity,'none');});
 const labels=r.render.primitives.filter(p=>p.type==='label');assert.equal(labels.length,5);assert.ok(labels.every(p=>p.pos[1]>100));
});
test('F3 step snapping gives 0.95a/+1.05% and 1.05a/-0.95% with bilingual warning details',()=>{
 const r=analyze(getFixture('F3'),{snapMode:'step',snapStep:0.05});const stem=r.analysis.stems[2].measure;const gap=r.analysis.gaps[1].measure;
 near(stem.target,0.95);near(stem.dev,0.010526315789);assert.equal(stem.severity,'warn');near(gap.target,1.05);near(gap.dev,-0.009523809524);assert.equal(gap.severity,'warn');
 const label=r.render.primitives.find(p=>p.type==='label'&&p.featureId==='S3');assert.equal(label.lines[0].text,'0.95a');assert.equal(label.lines[1].text,'实测 0.960a · +0.20pt');
 const en=analyze(getFixture('F3'),{snapMode:'step',uiLanguage:'en'});assert.match(en.render.primitives.find(p=>p.type==='label'&&p.featureId==='G2').lines[1].text,/meas\. 1\.040a · -0\.20pt/);
});
test('F4 merges interrupted diagonal strokes, keeps width20 and locates modules away from crossing',()=>{
 const r=analyze(getFixture('F4'));assert.equal(r.analysis.stems.length,2);
 for(const s of r.analysis.stems){assert.equal(s.kind,'diagonal');near(s.width,20);assert.equal(s.fragments.length,2);assert.ok(Math.hypot(s.mid[0]-50,s.mid[1]-50)>20);near(s.overlapLen,s.fragments.reduce((sum,f)=>sum+f.overlapLen,0));}
 assert.equal(r.render.primitives.filter(p=>p.type==='polygon').length,2);
});
test('F6 stem is20 and F8 rows place labels above the first row and below the last',()=>{
 const d=analyze(getFixture('F6'));assert.equal(d.analysis.stems.length,1);near(d.analysis.stems[0].width,20);
 const r=analyze(getFixture('F8'));const labels=r.render.primitives.filter(p=>p.type==='label');assert.equal(labels.length,16);
 for(const p of labels){const feature=r.analysis.stems.concat(r.analysis.gaps).find(s=>s.id===p.featureId);assert.ok(feature.rowId==='r0'?p.pos[1]>100:p.pos[1]<-150);}
 for(const name of ['F3','F8']){const result=analyze(getFixture(name),{snapMode:'step'});const boxes=result.render.primitives.filter(p=>p.type==='label').map(p=>plain(LG.layout.labelBounds(p,result.render.fontSize)));for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];assert.ok(!(a[0]<b[2]&&a[2]>b[0]&&a[3]<b[1]&&a[1]>b[3]));}}
});
test('feature switches leave a stable, dimension leads work without reference verticals, and labelDedup keeps leads',()=>{
 const g=getFixture('F3');const full=analyze(g);const hidden=analyze(g,{features:{stemWidths:false,gaps:false,verticals:false}});assert.equal(hidden.analysis.baseUnit.value,20);assert.equal(hidden.render.primitives.filter(p=>p.type==='label').length,0);
 const leads=analyze(g,{features:{verticals:false}});assert.ok(leads.render.primitives.some(p=>p.style==='dimension'));assert.ok(leads.render.primitives.some(p=>p.type==='label'));
 const dedup=analyze(g,{labelDedup:true});assert.equal(dedup.render.primitives.filter(p=>p.type==='label').length,3);assert.equal(dedup.render.primitives.filter(p=>p.type==='line').length,full.render.primitives.filter(p=>p.type==='line').length);
});
test('manual a, weighted median ties and height fallback use their contract sources',()=>{
 const manual=analyze(getFixture('F3'),{baseUnit:{mode:'value',value:10}});assert.equal(manual.analysis.baseUnit.source,'manual');assert.equal(manual.analysis.stems[0].measure.display,'2a');
 const fallback=analyze(getFixture('F1'));assert.equal(fallback.analysis.baseUnit.source,'fallback-height');assert.equal(fallback.analysis.baseUnit.value,200);
 const synthetic={config:LG.config.resolve(),S:100,stems:[{kind:'vertical',width:20,overlapLen:10},{kind:'vertical',width:20.2,overlapLen:10}]};near(LG.baseunit.resolve(synthetic).value,20);
});
test('counter strips are inside the outer contour but outside ink; heights do not repeat horizontal stems',()=>{
 const outer=rectangle(0,0,100,100);outer.kind='compound';outer.contours.push(rectangle(20,20,60,60).contours[0]);
 const r=analyze(geometry([outer]),{features:{counters:true,heights:true}});assert.ok(r.analysis.counters.length>=1);assert.ok(r.analysis.counters.every(c=>Math.abs(c.width-60)<1e-7));
 const shape=geometry([rectangle(0,0,100,20),rectangle(200,0,20,100)]);const h=analyze(shape,{features:{heights:true}});assert.ok(h.analysis.stems.some(s=>s.kind==='horizontal'&&Math.abs(s.width-20)<1e-7));assert.ok(!h.analysis.heights.some(s=>Math.abs(s.y1)<1e-7&&Math.abs(s.y2-20)<1e-7));
});
test('special targets, severity boundaries, decimal formatting and independent angular snapping',()=>{
 const cfg=LG.config.resolve({snapMode:'step'});let m=LG.ratios.measure(32.36,20,cfg);assert.equal(m.special,'φ');assert.equal(m.targetDisplay,'1.618a');assert.equal(m.severity,'ok');
 m=LG.ratios.measure(20.1,20,cfg);assert.equal(m.severity,'ok');m=LG.ratios.measure(20.4,20,cfg);assert.equal(m.severity,'warn');m=LG.ratios.measure(20.49,20,cfg);assert.equal(m.severity,'bad');
 assert.equal(LG.ratios.display(2),'2a');assert.equal(LG.ratios.display(1.2),'1.2a');assert.equal(LG.ratios.number(-0.00001,2),'0.00');
 const a=LG.ratios.angle(22.4,LG.config.resolve({angleSnapStep:5}));assert.equal(a.target,20);near(a.dev,2.4);assert.equal(a.ratio,null);assert.equal(a.severity,'bad');
});
test('lane budget overflow warns; module squares orient with strokes and small labels move outside',()=>{
 const r=analyze(getFixture('F3'),{fontSize:36,advanced:{maxLanes:1}});assert.ok(r.analysis.warnings.some(w=>w.code==='LABEL_LANES_FULL'));
 const square=analyze(getFixture('F3'),{stemLabelStyle:'squares'});assert.equal(square.render.primitives.filter(p=>p.type==='polygon').length,3);
 const tiny=analyze(geometry([rectangle(0,0,5,100)]),{stemLabelStyle:'squares'});const stem=tiny.analysis.stems[0];const label=tiny.render.primitives.find(p=>p.type==='label');assert.ok(Math.hypot(stem.mid[0]-label.pos[0],stem.mid[1]-label.pos[1])>0);assert.equal(label.lines[0].sizeFactor,1);
});
test('preAnalyze reuse is limited to identical geometry and resolved numeric parameters; lines/stems recompute',()=>{
 const g=getFixture('F3');const context=LG.preAnalyze(g,{});const before=plain(context);let normalizations=0;let lines=0;let stems=0;
 const normalize=LG.geometry.normalize;const detect=LG.lines.detect;const run=LG.stems.run;
 LG.geometry.normalize=function(...args){normalizations++;return normalize(...args);};LG.lines.detect=function(...args){lines++;return detect(...args);};LG.stems.run=function(...args){stems++;return run(...args);};
 try{const reused=plain(LG.analyze(g,{labelPrecision:0.05},context));assert.equal(normalizations,0);assert.equal(lines,1);assert.equal(stems,1);const fresh=plain(LG.analyze(g,{labelPrecision:0.05}));assert.deepEqual(reused,fresh);LG.analyze(g,{advanced:{clusterTolRel:0.008}},context);assert.equal(normalizations,2);const changed=structuredClone(g);changed.parts[0].contours[0].points[0].a[0]=1;LG.analyze(changed,{},context);assert.equal(normalizations,3);assert.deepEqual(plain(context),before);}finally{LG.geometry.normalize=normalize;LG.lines.detect=detect;LG.stems.run=run;}
});
