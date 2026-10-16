'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {loadCore}=require('./load_core');const {getFixture,geometry,circlePart}=require('./fixtures');
const {LG,plain}=loadCore();const analyze=(name,s={})=>plain(LG.analyze(typeof name==='string'?getFixture(name):name,s));
const near=(a,b,t=.1)=>assert.ok(Math.abs(a-b)<=t,`${a} vs ${b}`);

test('F1 Kasa/LM fit, geometric errors and near-full coverage satisfy the numeric contract',()=>{
 const r=analyze('F1');assert.equal(r.analysis.circles.length,1);const c=r.analysis.circles[0];near(c.cx,0);near(c.cy,0);near(c.r,100);assert.ok(c.coverageDeg>=350);assert.ok(c.maxErr<=c.tolAbs);near(Math.hypot(c.maxErrPoint[0]-c.cx,c.maxErrPoint[1]-c.cy)-c.r,c.maxErrSigned,1e-10);assert.ok(c.rmsErr<=c.maxErr);assert.equal(c.samples,undefined);
});
test('F2 has two circles, one40pt ink ring and fallback-ring a with radial label a',()=>{
 const r=analyze('F2');assert.equal(r.analysis.circles.length,2);assert.equal(r.analysis.rings.length,1);near(r.analysis.rings[0].thickness,40);near(r.analysis.baseUnit.value,40);assert.equal(r.analysis.baseUnit.source,'fallback-ring');assert.equal(r.analysis.rings[0].measure.display,'a');assert.equal(r.analysis.rings[0].angleDeg,45);assert.ok(r.render.primitives.some(p=>p.featureId==='R1'&&p.type==='label'&&p.lines[0].text==='a'));
});
test('F5 ellipse cannot be represented as a circle with >180degree coverage',()=>{const r=analyze('F5');assert.ok(r.analysis.circles.length>0);assert.ok(r.analysis.circles.every(c=>c.coverageDeg<=180));});
test('F6 fits D semicircles and20pt ring without replacing the20pt stem base unit',()=>{const r=analyze('F6');const radii=r.analysis.circles.map(c=>c.r).sort((a,b)=>a-b);assert.equal(radii.length,2);near(radii[0],30);near(radii[1],50);near(r.analysis.rings[0].thickness,20);assert.equal(r.analysis.baseUnit.source,'auto-stem');assert.equal(r.analysis.rings[0].measure.display,'a');});
test('F7 loose accepts one noisy circle, strict remains finite, and deviations point toward circumference',()=>{
 const loose=analyze('F7',{tolerancePreset:'loose'});assert.equal(loose.analysis.circles.length,1);near(loose.analysis.circles[0].r,100,1);const p=loose.render.primitives.find(p=>p.style==='devMarker');assert.ok(p);const c=loose.analysis.circles[0];const tip=p.points[0];const back=[(p.points[1][0]+p.points[2][0])/2,(p.points[1][1]+p.points[2][1])/2];const direction=[tip[0]-back[0],tip[1]-back[1]];const radial=[tip[0]-c.cx,tip[1]-c.cy];assert.ok((direction[0]*radial[0]+direction[1]*radial[1])*c.maxErrSigned<0);assert.ok(!/NaN|Infinity/.test(JSON.stringify(analyze('F7',{tolerancePreset:'strict'}))));
});
test('F9/F9b visual circle classification retains hidden horizontal-line evidence',()=>{for(const name of ['F9','F9b']){const r=analyze(name,{features:{baselines:false,overshoot:false}});assert.equal(r.analysis.circles.find(c=>c.r>40).category,'visual');assert.equal(r.analysis.circles.find(c=>c.r<40).category,'fitted');near(r.analysis.rings[0].thickness,20);}assert.equal(analyze('F9b',{mixedAsVisual:false}).analysis.circles.find(c=>c.r>40).category,'fitted');});
test('ring ink evidence rejects separate parts and filled nested discs',()=>{
 assert.equal(analyze(geometry([circlePart(0,0,100),circlePart(0,0,60)])).analysis.rings.length,0);
 const g=getFixture('F2');g.parts[0].filled=false;g.parts[0].stroked=true;assert.equal(analyze(g).analysis.rings.length,0);
});
test('circle display modes and switches preserve retained fits for ring measurement and a',()=>{
 const hidden=analyze('F2',{features:{circles:false}});assert.equal(hidden.analysis.circles.length,2);assert.ok(!hidden.render.primitives.some(p=>p.layer==='circles'||p.style==='devMarker'));assert.ok(hidden.render.primitives.some(p=>p.featureId==='R1'));
 const off=analyze('F2',{features:{circles:false,ringThickness:false}});assert.equal(off.analysis.baseUnit.source,'fallback-ring');assert.ok(!off.render.primitives.some(p=>p.featureId==='R1'));
 const arc=analyze('F6',{circleDisplay:'arc'});assert.ok(arc.render.primitives.filter(p=>p.layer==='circles').every(p=>p.type==='arc'&&p.endDeg-p.startDeg<181));
 const extended=analyze('F6',{circleDisplay:'extended'});const a=arc.render.primitives.find(p=>p.layer==='circles');const b=extended.render.primitives.find(p=>p.featureId===a.featureId&&p.layer==='circles');near(b.endDeg-b.startDeg,a.endDeg-a.startDeg+60,1e-8);
});
test('fit rejects collinear/coincident samples and is stable under large translations',()=>{
 assert.equal(LG.circles.fit([{p:[0,0]},{p:[1,1]},{p:[2,2]}]),null);assert.equal(LG.circles.fit([{p:[2,2]},{p:[2,2]},{p:[2,2]}]),null);
 const points=Array.from({length:40},(_,i)=>({p:[1e8+100*Math.cos(i*Math.PI/20),-1e8+100*Math.sin(i*Math.PI/20)]}));const c=LG.circles.fit(points);near(c.cx,1e8,1e-6);near(c.cy,-1e8,1e-6);near(c.r,100,1e-6);
});
test('circle count cap keeps ring and visual fits by score, including zero limit',()=>{const r=analyze('F2',{maxCircles:1});assert.equal(r.analysis.circles.length,1);assert.equal(r.analysis.rings.length,0);assert.equal(analyze('F1',{maxCircles:0}).analysis.circles.length,0);});

test('curve runs split at line/flat/sign/corner boundaries and join a continuous closed seam',()=>{
 const sample=(angle,k=1)=>({p:[Math.cos(angle),Math.sin(angle)],T:[-Math.sin(angle),Math.cos(angle)],kappa:k});
 const seg=(samples,type='cubic')=>{const a=samples[0]||{p:[0,0],T:[1,0]};const b=samples.at(-1)||a;return {type,samples,p:[a.p,[a.p[0]+a.T[0],a.p[1]+a.T[1]],[b.p[0]-b.T[0],b.p[1]-b.T[1]],b.p]};};
 const model=segments=>({parts:[{contours:[{closed:true,segments}]}],derived:{kappaMin:.01},config:{cornerAngleDeg:15}});
 let runs=LG.circles.runs(model([seg([sample(0),sample(.1)]),seg([],'line'),seg([sample(-.2),sample(-.1)])]));assert.equal(runs.length,1);assert.equal(runs[0].length,4);
 runs=LG.circles.runs(model([seg([sample(0),sample(.1),sample(.2,0),sample(.3),sample(.4,-1)])]));assert.equal(runs.length,3);
 runs=LG.circles.runs(model([seg([sample(0),sample(.1)]),seg([sample(1),sample(1.1)])]));assert.equal(runs.length,2);
 const sparse=LG.sample.run(LG.geometry.normalize(getFixture('F1'),{advanced:{sampleSpacingRel:1}}));assert.equal(LG.circles.runs(sparse).length,1);
});

test('F10 full analyze of prebuilt2000-anchor geometry stays below300ms',()=>{
 const {LG}=loadCore();const g=getFixture('F10');const start=performance.now();const r=LG.analyze(g);const ms=performance.now()-start;assert.equal(r.analysis.circles.length,24);assert.ok(ms<300,`F10 analyze ${ms.toFixed(2)}ms`);console.log(`F10 analyze: ${ms.toFixed(2)}ms`);
});
