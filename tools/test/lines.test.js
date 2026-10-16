'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadCore } = require('./load_core');
const { getFixture, geometry, rectangle, circlePart } = require('./fixtures');
const { loadGeometry, importSvg } = require('../svg_import');
const { renderAnalysis } = require('../preview');
const { LG, plain } = loadCore();
const analyze = (g, settings={}) => plain(LG.analyze(g, {...settings,features:{stemWidths:false,gaps:false,...settings.features}}));
const horizontal = r => r.analysis.lines.filter(l => l.orient === 'h');
const classes = r => horizontal(r).map(l => [l.pos, l.category, l.subtype]);

test('cluster compares weighted cluster mean, avoids chain drift, and handles zero relative mean', () => {
  let groups = plain(LG.cluster.cluster1D([1.8, 0, 0.9], [0, 0, 0], 1, false));
  assert.deepEqual(groups.map(g => g.members), [[1, 2], [0]]);
  assert.equal(groups[0].pos, 0.45);
  groups = plain(LG.cluster.cluster1D([10, 10.2, 10.4], [10, 0, 10], 0.3, false));
  assert.equal(groups[0].pos, 10); assert.equal(groups.length, 2);
  assert.equal(LG.cluster.cluster1D([0, 0, 1], null, 0.1, true).length, 2);
  assert.throws(() => LG.cluster.cluster1D([Infinity], null, 1), /evidence/);
  assert.throws(() => LG.cluster.cluster1D([1], [-1], 1), /evidence/);
});

test('unoriented direction clustering joins the 0/180 wrap using weighted mean', () => {
  const groups = plain(LG.cluster.circular([179, 1, 90], [3, 1, 2], 3));
  assert.equal(groups.length, 2); assert.equal(groups[0].pos, 179.5);
  assert.deepEqual(groups[0].members, [0, 1]);
});

test('F3, F6, F8, F9 and F9b have the specified horizontal classifications', () => {
  assert.deepEqual(classes(analyze(getFixture('F3'))), [[0,'baseline','flat'],[100,'baseline','flat']]);
  const d = analyze(getFixture('F6'));
  assert.deepEqual(classes(d), [[0,'baseline','flat'],[100,'baseline','flat']]);
  assert.ok(horizontal(d).every(l => l.support.roundCount === 1));
  assert.deepEqual(classes(analyze(getFixture('F8'))), [[0,'baseline','flat'],[100,'baseline','flat'],[-150,'baseline','flat'],[-50,'baseline','flat']]);
  assert.deepEqual(classes(analyze(getFixture('F9'))), [[-2,'visual','overshoot'],[0,'baseline','flat'],[100,'baseline','flat'],[102,'visual','overshoot']]);
  assert.deepEqual(classes(analyze(getFixture('F9b'))), [[0,'visual','mixed'],[100,'visual','mixed']]);
  assert.deepEqual(classes(analyze(getFixture('F9b'),{mixedAsVisual:false})), [[0,'baseline','mixed'],[100,'baseline','mixed']]);
});

test('reference switches filter rendered output while retaining classification evidence', () => {
  for (const name of ['F9','F9b']) {
    const g = getFixture(name); const original = analyze(g);
    const disabled = analyze(g, {features:{baselines:false,overshoot:false,verticals:false}});
    assert.deepEqual(disabled.analysis.lines, original.analysis.lines);
    assert.equal(disabled.render.primitives.length, 0);
  }
  const overshootOnly = analyze(getFixture('F9'),{features:{baselines:false,verticals:false}});
  assert.equal(overshootOnly.render.primitives.length,2);
  assert.ok(overshootOnly.render.primitives.every(p=>p.style==='visual'));
  const noMixed = analyze(getFixture('F9b'),{features:{baselines:false,verticals:false}});
  assert.equal(noMixed.render.primitives.length,0);
});

test('F1 outer extrema are deduplicated at anchors; hole boundaries are not silhouettes', () => {
  const model = LG.sample.run(LG.geometry.normalize(getFixture('F2'))); LG.edges.run(model);
  const extrema = plain(model.extrema);
  assert.equal(extrema.length, 8); assert.equal(extrema.filter(e=>e.silhouette).length,4);
  assert.deepEqual(classes(analyze(getFixture('F1'))), [[-100,'baseline','round'],[100,'baseline','round']]);
  const overlap = geometry([circlePart(0,0,50),rectangle(-60,40,120,30)]);
  const covered = LG.sample.run(LG.geometry.normalize(overlap)); LG.edges.run(covered);
  assert.equal(plain(covered.extrema).find(e=>e.partId==='p0'&&e.type==='top').silhouette,false);
});

test('interior cubic extrema are found when anchors are away from cardinal directions', () => {
  const g = getFixture('F1'); const a = Math.PI / 4;
  for (const point of g.parts[0].contours[0].points) for (const key of ['a','l','r']) {
    const [x,y]=point[key];point[key]=[x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)];
  }
  const model=LG.sample.run(LG.geometry.normalize(g));LG.edges.run(model);
  assert.equal(model.extrema.length,4);
  for(const e of model.extrema){assert.ok(e.t>0&&e.t<1);assert.equal(e.silhouette,true);}
});

test('connected collinear segments merge through a closed contour seam; short edges are flagged', () => {
  const g = geometry([rectangle(0,0,20,100)]);
  const points = g.parts[0].contours[0].points;
  points.unshift({a:[0,50],l:[0,50],r:[0,50]});
  const model=LG.sample.run(LG.geometry.normalize(g));LG.edges.run(model);
  assert.equal(model.edges.length,4);
  assert.equal(plain(model.edges).find(e=>e.p0[0]===0&&e.p1[0]===0).length,100);
  const short=LG.sample.run(LG.geometry.normalize(geometry([rectangle(0,0,1,100)])));LG.edges.run(short);
  assert.equal(plain(short.edges).filter(e=>e.short).length,2);
});

test('reference classification is invariant under translation and uniform scale', () => {
  const g=getFixture('F9');const initial=analyze(g);
  for(const p of g.parts)for(const c of p.contours)for(const point of c.points)for(const key of ['a','l','r'])point[key]=[point[key][0]*3+1000,point[key][1]*3-400];
  const transformed=analyze(g);
  assert.deepEqual(transformed.analysis.lines.map(l=>[l.orient,l.category,l.subtype]),initial.analysis.lines.map(l=>[l.orient,l.category,l.subtype]));
  for(let i=0;i<initial.analysis.lines.length;i++)assert.ok(Math.abs(transformed.analysis.lines[i].pos-(initial.analysis.lines[i].pos*3+(initial.analysis.lines[i].orient==='h'?-400:1000)))<1e-7);
});

test('line registry unions spans, keeps highest-category feature identity, and rejects invalid numbers', () => {
  const registry=new LG.lines.LineRegistry(0.4);
  registry.register('h',10,[0,20],'dimension','D1');
  registry.register('h',10.1,[-10,5],'baseline','L1');
  registry.register('h',10.15,[15,40],'visual','L2');
  registry.register('v',10,[0,1],'baseline','L3');
  registry.register('h',11,[0,1],'baseline','L4');
  const lines=plain(registry.lines);
  assert.equal(lines.length,3);assert.deepEqual(lines[0],{orient:'h',pos:10.15,span:[-10,40],category:'visual',id:'L2'});
  assert.throws(()=>registry.register('h',NaN,[0,1],'baseline','bad'),/Invalid/);
});

test('layout uses margin/artboard and supporting-row vertical spans before M3 lanes', () => {
  const g=getFixture('F8');const result=analyze(g);const area=result.render.guideArea;const fs=result.render.fontSize;
  for(const l of horizontal(result))assert.deepEqual(l.span,[area[0],area[2]]);
  const verticals=result.analysis.lines.filter(l=>l.orient==='v');
  assert.deepEqual(verticals[0].span,[area[3],area[1]]);
  assert.deepEqual(verticals.find(l=>l.pos===160).span,[-fs,100+fs]);
  assert.deepEqual(analyze(g,{extendTo:'artboard'}).render.guideArea,g.artboard);
  assert.throws(()=>analyze(g,{marginFactor:1e308}),/finite coordinate range/);
  assert.equal(result.analysis.baseUnit.value,20);assert.equal(result.analysis.baseUnit.source,'auto-stem');
  assert.equal(analyze(g,{baseUnit:{mode:'value',value:12}}).analysis.baseUnit.value,12);
});

test('appendix B presets and label primitives preserve exact values without auto-generating labels', () => {
  const dark=plain(LG.styles.preset('dark'));const light=plain(LG.styles.preset('light'));
  assert.deepEqual(dark.baseline,{stroke:'#CCCCCC',width:1,dashes:[3,2],opacity:80});
  assert.equal(dark.visual.stroke,'#E5484D');assert.equal(light.visual.stroke,'#A3745F');assert.equal(light.moduleSquare.opacity,70);
  dark.baseline.width=20;assert.equal(LG.styles.preset('dark').baseline.width,1);
  const label=LG.primitives.label([20,30],-90,[{text:'0.95a',sizeFactor:1,style:'text'}],'S1');
  assert.deepEqual(plain(label).pos,[20,30]);assert.equal(label.featureId,'S1');
  const box=plain(LG.layout.labelBounds(label,10));assert.ok(box[1]>box[3]&&box[2]>box[0]);
  assert.ok(analyze(getFixture('F3')).render.primitives.every(p=>p.type==='line'));
});

test('F11 preview/import analyzes the same F3 geometry without reading its reference graphics', () => {
  const g=getFixture('F3');const initial=plain(LG.analyze(g));const svg=renderAnalysis(g);const imported=importSvg(svg);
  assert.equal(imported.parts.length,3);
  assert.deepEqual(plain(LG.analyze(imported)).analysis,initial.analysis);
  assert.match(svg,/id="lg-geometry"/);assert.match(svg,/id="lg-guides"/);
  const label=plain(LG.primitives.label([20,30],-90,[{text:'<1a & 中文',sizeFactor:1,style:'text'}],'S1'));
  const withLabel=structuredClone(initial);withLabel.render.primitives.push(label);
  const labeled=renderAnalysis(g,{},withLabel);assert.match(labeled,/rotate\(90\)/);assert.match(labeled,/&lt;1a &amp; 中文/);
});

test('real BOATCHIN export passes the shared core without inventing later milestone features', () => {
  const g=loadGeometry(path.resolve(__dirname,'../samples/illustrator-boatchin.geometry.json'));
  const model=LG.geometry.normalize(g);assert.equal(model.anchorCount,205);assert.equal(model.parts.length,9);assert.equal(model.rows.length,2);
  const result=analyze(g);assert.ok(result.analysis.lines.length>0);assert.deepEqual(result.analysis.warnings,[]);
  for(const key of ['circles','rings','angles','ratioFindings'])assert.deepEqual(result.analysis[key],[]);
  assert.ok(!/NaN|Infinity/.test(JSON.stringify(result)));assert.ok(!/NaN|Infinity/.test(renderAnalysis(g)));
  const ids=Array.from(renderAnalysis(g).matchAll(/\bid="([^"]+)"/g),m=>m[1]);assert.equal(new Set(ids).size,ids.length);
});
