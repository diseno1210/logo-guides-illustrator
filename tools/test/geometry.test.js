'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { loadCore } = require('./load_core');
const fixtures = require('./fixtures');
const {validateFile} = require('../validate_geometry');
const { LG, plain, context } = loadCore();
const close = (actual, expected, epsilon=1e-8) => assert.ok(Math.abs(actual-expected)<=epsilon, `${actual} != ${expected}`);
const normalize = (geometry,settings) => LG.sample.run(LG.geometry.normalize(geometry,settings));

test('LG.json works without native JSON and does not create globals or prototype polyfills', () => {
  const value = { text:'中文\n\t"', number:1.25, flag:true, missing:null, list:[1,'x'] };
  assert.deepEqual(plain(LG.json.parse(LG.json.stringify(value,null,2))),value);
  assert.equal(context.JSON,undefined);
  assert.throws(()=>LG.json.parse('{invalid json}'));
  assert.throws(()=>LG.json.parse('(function(){return 1;}())'));
});

test('config defaults include every section 7.1 field, ignore unknowns, and isolate overrides', () => {
  const spec = fs.readFileSync(path.join(__dirname,'../../docs/DEV_PLAN.md'),'utf8');
  const section = spec.split('### 7.1 ')[1].split('### 7.2 ')[0];
  const keys = [...section.matchAll(/^\| `([^`]+)` \|/gm)].map(m=>m[1]);
  const defaults = plain(LG.config.defaults());
  assert.equal(keys.length,51);
  for(const key of keys) {let value=defaults;for(const field of key.split('.')){assert.ok(Object.hasOwn(value,field),key);value=value[field];}}
  const cfg=LG.config.resolve({features:{circles:false,unknown:true},unknown:1,advanced:{circleFitTol:0.055,unrecognized:9},tolerancePreset:'strict'});
  assert.equal(cfg.circleFitTol,0.055);assert.equal(cfg.clusterTolRel,0.002);
  assert.equal(cfg.settings.features.circles,false);assert.equal(cfg.settings.features.baselines,true);
  assert.equal(cfg.settings.unknown,undefined);assert.equal(cfg.settings.features.unknown,undefined);assert.equal(cfg.settings.advanced.unrecognized,undefined);
  cfg.settings.fontNames.push('mutation');assert.equal(LG.config.defaults().fontNames.length,4);
  assert.equal(LG.config.resolve().circleFitTol,0.02);
});

test('section 7.2/7.3 numeric defaults match the document tables',()=>{
  const spec=fs.readFileSync(path.join(__dirname,'../../docs/DEV_PLAN.md'),'utf8');
  const section=spec.split('### 7.2 ')[1].split('### 7.4 ')[0];
  for(const line of section.split('\n')) {
    const match=line.match(/^\| `([^`]+)` \| (.*)/);if(!match)continue;
    const fields=match[2].split('|').map(s=>s.trim()).filter(Boolean);
    if(fields.length===2)assert.equal(LG.config.resolve()[match[1]],Number(fields[0]),match[1]);
    else for(const [i,preset] of ['loose','standard','strict'].entries())assert.equal(LG.config.resolve({tolerancePreset:preset})[match[1]],Number(fields[i+1]),match[1]+':'+preset);
  }
});

test('config rejects nonfinite/invalid inputs and derives exact scale values',()=>{
  for(const settings of [{baseUnit:{mode:'value',value:0}},{baseUnit:{mode:'value',value:NaN}},{labelPrecision:0.03},{features:{circles:'true'}},{maxCircles:1.5},{advanced:{maxSamples:0}},{advanced:{rowOverlapMin:2}},{advanced:{sampleSpacingRel:Infinity}}])assert.throws(()=>LG.config.resolve(settings));
  const d=LG.config.derive(LG.config.resolve(),100,200);
  close(d.tolPos,0.4);close(d.h,0.5);close(d.fs,7);close(d.u,0.25);close(d.kappaMin,1/600);
  assert.equal(LG.config.derive(LG.config.resolve(),1,2).fs,6);
});

test('vector utilities and Bezier evaluation/derivatives match analytic values',()=>{
  const p=[[0,0],[0,1],[1,1],[1,0]];
  assert.deepEqual(plain(LG.bezier.at(p,0.5)),[0.5,0.75]);
  assert.deepEqual(plain(LG.bezier.derivative(p,0.5)),[1.5,0]);
  assert.deepEqual(plain(LG.bezier.second(p,0.5)),[0,-6]);
  close(LG.bezier.frame(p,0.5,1e-9).kappa,-8/3);
  const reversed=p.slice().reverse();close(LG.bezier.frame(reversed,0.5,1e-9).kappa,8/3);
  assert.deepEqual(plain(LG.bezier.bounds(p,1e-9)),[0,0.75,1,0]);
  assert.ok(plain(LG.bezier.extrema(p,1e-9)).some(e=>e.axis===1&&e.t===0.5));
  assert.deepEqual(plain(LG.vec.unit([0,0])),[0,0]);
  close(LG.vec.length([3,4]),5);
  const stationary=[[0,0],[0,0],[1,0],[1,0]];
  assert.deepEqual(plain(LG.bezier.frame(stationary,0,1e-9).T),[1,0]);
});

test('Bezier roots, straightness and arc tables handle degeneracy and backtracking',()=>{
  const roots=LG.bezier.roots(1,-3,2,1e-9);close(roots[0],1);close(roots[1],2);
  assert.deepEqual(plain(LG.bezier.roots(0,2,-1,1e-9)),[0.5]);
  assert.deepEqual(plain(LG.bezier.roots(1,0,1,1e-9)),[]);
  assert.deepEqual(plain(LG.bezier.roots(0,0,0,1e-9)),[]);
  assert.equal(LG.bezier.straight([[0,0],[0.3,0.001],[0.7,0],[1,0]],0.01),true);
  assert.equal(LG.bezier.straight([[0,0],[-1,0],[2,0],[1,0]],0.01),false);
  const table=LG.bezier.arcTable([[0,0],[1/3,0],[2/3,0],[1,0]]);
  assert.equal(table.points.length,65);close(table.length,1);close(LG.bezier.tAtLength(table,0.25),0.25);
  assert.equal(LG.bezier.tAtLength(LG.bezier.arcTable([[0,0],[0,0],[0,0],[0,0]]),1),0);
});

for(const name of ['F1','F2','F3','F4','F5','F6','F7','F8','F9','F9b','F10']) {
  test(name+' normalizes/samples without mutating input or nonfinite outputs',()=>{
    const input=fixtures.getFixture(name);const before=JSON.stringify(input);const model=normalize(input);
    assert.equal(JSON.stringify(input),before);assert.equal(model.parts.length,input.parts.length);
    assert.ok(model.S>0&&model.D>0);assert.ok(model.samples.length<=model.config.maxSamples);
    for(const part of model.parts)for(const contour of part.contours)for(const segment of contour.segments){
      assert.ok(segment.length>0);assert.ok(['cubic','line'].includes(segment.type));
      if(segment.type==='line')assert.equal(segment.samples.length,0);
      else {assert.ok(segment.samples.length>=4&&segment.samples.length<=200);for(const sample of segment.samples){assert.ok(sample.t>0&&sample.t<1);assert.ok([...sample.p,...sample.T,sample.kappa,sample.arcLength].every(Number.isFinite));close(Math.hypot(...sample.T),1,1e-7);}}
    }
    assert.ok(!JSON.stringify(plain(model)).includes('null,null'));
  });
}

test('fixture scale and analytic exact bounds hold for F1-F10',()=>{
  assert.deepEqual(plain(normalize(fixtures.F1()).bbox),[-100,100,100,-100]);
  assert.deepEqual(plain(normalize(fixtures.F3()).bbox),[0,100,100,0]);
  close(normalize(fixtures.F5()).S,80);
  assert.deepEqual(plain(normalize(fixtures.F6()).bbox),[0,100,70,0]);
  const f8=normalize(fixtures.F8());assert.equal(f8.rows.length,2);close(f8.S,100);
  assert.deepEqual(plain(f8.rows).map(r=>r.partIds.length),[5,4]);
  assert.equal(normalize(fixtures.F10()).rows.length,5);
  assert.equal(fixtures.F10().parts.flatMap(p=>p.contours.flatMap(c=>c.points)).length,2000);
  assert.equal(fixtures.F4().parts[0].contours[0].points.length,12);
});

test('normalize uses true cubic extrema before S-relative straightness and filters degenerate input',()=>{
  const g=fixtures.geometry([fixtures.rectangle(0,0,10,10)]);
  g.parts[0].contours[0]={id:'p0c0',closed:false,points:[{a:[0,0],l:[0,0],r:[0,100]},{a:[100,0],l:[100,100],r:[100,0]}]};
  const m=normalize(g);close(m.S,75);assert.deepEqual(plain(m.bbox),[0,75,100,0]);assert.equal(m.parts[0].inkEligible,false);
  g.parts[0].contours[0].points[0].r=[-10,0];g.parts[0].contours[0].points[1].l=[110,0];
  assert.equal(normalize(g).parts[0].contours[0].segments[0].type,'cubic');
  const invalid=fixtures.F3();invalid.parts[0].contours[0].points[0].a[0]=Infinity;
  const filtered=normalize(invalid);assert.equal(filtered.parts.length,2);assert.ok(plain(filtered.warnings).some(w=>w.code==='NON_FINITE_GEOMETRY'));
  const zero=fixtures.geometry([fixtures.rectangle(0,0,0,0)]);assert.throws(()=>normalize(zero),/No usable/);
});

test('sampling arc spacing, cumulative lengths, re-sampling and budget failures are explicit',()=>{
  const model=normalize(fixtures.F1());let previous=-1;
  for(const sample of model.samples){assert.ok(sample.arcLength>previous);previous=sample.arcLength;}
  close(model.parts[0].contours[0].length,2*Math.PI*100,0.1);
  const reduced=normalize(fixtures.F1(),{advanced:{maxSamples:100}});
  assert.ok(reduced.samples.length<=100);assert.ok(plain(reduced.warnings).some(w=>w.code==='SAMPLES_CAPPED'));
  assert.ok(reduced.sampleSpacing>model.sampleSpacing);
  assert.throws(()=>normalize(fixtures.F1(),{advanced:{maxSamples:15}}),/four samples/);
});

test('ink is even-odd within a part and union across parts, with open/stroke exclusions',()=>{
  let model=normalize(fixtures.F2());let ink=LG.ink.create(model);
  assert.equal(ink(0,0),false);assert.equal(ink(80,0),true);assert.equal(ink(110,0),false);assert.equal(ink(80,0,'p0'),true);assert.equal(ink(80,0,'missing'),false);
  const geometry=fixtures.geometry([fixtures.rectangle(0,0,10,10),fixtures.rectangle(5,0,10,10)]);
  model=normalize(geometry);ink=LG.ink.create(model);assert.equal(ink(7,5),true);
  geometry.parts[0].contours[0].closed=false;geometry.parts[1].filled=false;geometry.parts[1].stroked=true;
  model=normalize(geometry);assert.equal(LG.ink.create(model)(7,5),false);
  assert.ok(plain(model.warnings).some(w=>w.code==='OUTLINE_STROKES'));
});

test('small parts join nearest overlapping row without changing row height',()=>{
  const model=normalize(fixtures.geometry([fixtures.rectangle(0,0,20,100),fixtures.rectangle(40,0,20,100),fixtures.rectangle(5,120,5,5)]));
  assert.equal(model.rows.length,1);assert.equal(model.parts[2].small,true);assert.equal(model.parts[2].rowId,'r0');close(model.S,100);close(model.bbox[1],125);
  assert.deepEqual(plain(model.rows[0].bbox),[0,100,60,0]);
});

test('acceptance command loads a UTF-8 BOM dump, exercises M1 and produces a plain Node report',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'logo-guides-m1-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const file=path.join(dir,'geometry_dump.json');fs.writeFileSync(file,'\uFEFF'+JSON.stringify(fixtures.F2()));
  const report=validateFile(file);assert.equal(report.parts,1);assert.equal(report.contours,2);assert.equal(report.centerIsInk,false);assert.equal(report.S,200);assert.ok(report.sampleCount>0);
  assert.ok(Array.isArray(report.rows));assert.equal(Object.getPrototypeOf(report.rows),Array.prototype);
});
