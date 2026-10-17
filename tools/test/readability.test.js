'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const {loadCore}=require('./load_core');const {harness}=require('./host_harness');const {F3}=require('./fixtures');const {renderAnalysis}=require('../preview');
const {LG,plain}=loadCore();
function overlaps(r){const labels=r.render.primitives.filter(p=>p.type==='label'&&p.layer==='labels');let n=0;labels.forEach((p,i)=>{const a=plain(LG.layout.labelBounds(p,r.render.fontSize));labels.slice(i+1).forEach(q=>{const b=plain(LG.layout.labelBounds(q,r.render.fontSize));if(a[0]<b[2]&&a[2]>b[0]&&a[3]<b[1]&&a[1]>b[3])n++;});});return n;}
test('appearance config validates values, preserves old defaults and round trips through JSON',()=>{
  const defaults=plain(LG.config.resolve({}).settings);assert.equal(defaults.fontSize,0);assert.equal(defaults.stylePreset,'dark');
  assert.deepEqual(defaults.appearance,{textColor:'',lineColor:'',strokeWidth:0,dashMode:'preset',dashLength:3,dashGap:2});
  const s={fontSize:4.5,appearance:{textColor:'#123abc',lineColor:'#654321',dashMode:'dashed',dashLength:1.5,dashGap:0.75}};
  const resolved=plain(LG.config.resolve(s).settings);assert.deepEqual(plain(LG.config.resolve(JSON.parse(JSON.stringify(resolved))).settings),resolved);
  for(const appearance of [{textColor:'red'},{lineColor:'#123'},{textColor:'url(x)'},{dashMode:'wrong'},{dashLength:0},{dashGap:-1},{dashGap:Infinity},{dashLength:1001}])assert.throws(()=>LG.config.resolve({appearance}));
  assert.throws(()=>LG.config.resolve({fontSize:-1}));assert.throws(()=>LG.config.resolve({avoidLabelOverlap:'true'}));
});
test('appearance uses physical dash lengths in SVG and host drawing, preserving style preset data',()=>{
  const {LG:H,doc}=harness();const s=H.config.resolve({fontSize:4.5,appearance:{textColor:'#123ABC',lineColor:'#654321',strokeWidth:0.4,dashMode:'dashed',dashLength:1.5,dashGap:0.75}}).settings;
  const r=H.analyze(F3(),s);H.hostDraw.generate(doc,r,s,doc.selection);const layer=doc.layers[0].layers.find(l=>l.name==='LG Baselines');const line=layer.pathItems[0];
  assert.deepEqual(Array.from(line.strokeDashes),[1.5,0.75]);assert.equal(line.strokeColor.red,0x65);assert.equal(line.strokeColor.green,0x43);assert.equal(line.strokeColor.blue,0x21);
  assert.equal(line.strokeWidth,0.4);
  const textLayer=doc.layers[0].layers.find(l=>l.name==='LG Labels');const t=textLayer.groupItems[0].textFrames[0];assert.equal(t.textRange.characterAttributes.size,4.5);assert.equal(t.textRange.characterAttributes.fillColor.blue,0xBC);
  const svg=renderAnalysis(F3(),plain(s),plain(r));assert.match(svg,/stroke-dasharray="1.5 0.75"/);assert.match(svg,/fill="#123ABC"/);assert.match(svg,/stroke="#654321"/);
  assert.match(svg,/stroke-width="0.4"/);
  const expected=plain(LG.styles.preset('dark'));expected.target={...expected.baseline};assert.deepEqual(plain(LG.styles.resolve(LG.config.defaults(),0.25)),expected);
  assert.deepEqual(plain(LG.styles.resolve(LG.config.resolve({appearance:{dashMode:'solid'}}).settings,1).baseline.dashes),[]);
});

test('arc extension controls actual and AI circle/ring spans, saturating at a full circle',()=>{
  function render(mode,extension){const r={guideArea:[-100,100,100,-100],primitives:[{type:'circle',c:[0,0],r:10,layer:'circles',featureId:'C1'},{type:'circle',c:[0,0],r:11,layer:'targets',featureId:'C1'},{type:'circle',c:[0,0],r:12,layer:'targets',featureId:'R1'}]};LG.layout.circleDisplay({config:LG.config.resolve({circleDisplay:mode,circleExtendDeg:extension}),circles:[{id:'C1',arcStartDeg:350,arcEndDeg:380}],rings:[{id:'R1',outerId:'C1'}]},r);return plain(r.primitives);}
  for(const extension of [0,30,90])for(const p of render('extended',extension)){assert.equal(p.type,'arc');assert.equal(p.startDeg,350-extension);assert.equal(p.endDeg,380+extension);}
  for(const p of render('extended',180))assert.equal(p.type,'circle');
  assert.deepEqual(render('arc',0),render('arc',90));
  for(const p of render('full',90))assert.equal(p.type,'circle');
  for(const s of [{circleExtendDeg:181},{circleExtendDeg:-1},{measurementLabelMode:'target'},{appearance:{strokeWidth:-1}},{appearance:{strokeWidth:101}},{appearance:{strokeWidth:Infinity}}])assert.throws(()=>LG.config.resolve(s));
});

test('AI target styles inherit guide appearance for both presets and multiple document scales',()=>{
  for(const stylePreset of ['dark','light'])for(const u of [0.25,2]){
    const s=LG.config.resolve({stylePreset,appearance:{textColor:'#123456',lineColor:'#abcdef',strokeWidth:0.35,dashMode:'dashed',dashLength:1,dashGap:0.5}}).settings;
    const styles=plain(LG.styles.resolve(s,u));assert.deepEqual(styles.target,styles.baseline);
    for(const key of ['target','circleFitted','circleVisual','measureBar','angleArc']){assert.equal(styles[key].stroke,'#abcdef');assert.equal(styles[key].width*u,0.35);assert.deepEqual(styles[key].dashes.map(v=>v*u),[1,0.5]);}
    assert.equal(styles.devMarker.fillHex,'#abcdef');for(const key of ['text','textWarn','textBad'])assert.equal(styles[key].fillHex,'#123456');
    const inherited=plain(LG.styles.resolve(LG.config.resolve({stylePreset}).settings,u));assert.deepEqual(inherited.target,inherited.baseline);
  }
});

test('decimal selection defaults to two and formats targets, measured values and deviations without changing numbers',()=>{
  assert.equal(LG.config.defaults().labelDecimals,2);
  const baseline=plain(LG.ratios.measure(12.3456,10,LG.config.resolve({snapMode:'step',snapStep:0.05})));
  for(const labelDecimals of [0,1,2,3,4]){
    const cfg=LG.config.resolve({labelDecimals,snapMode:'step',snapStep:0.05,angleSnapStep:5});
    const m=LG.ratios.measure(12.3456,10,cfg);assert.deepEqual(plain(m),baseline);
    const delta=LG.ratios.number(m.devAbs,labelDecimals);const rows=plain(LG.ratios.labelLines(m,cfg));assert.equal(rows[0].text,(1.25).toFixed(labelDecimals)+'a');assert.equal(rows[1].text,'◇ '+(1.23456).toFixed(labelDecimals)+'a · '+(Number(delta)>=0?'+':'')+delta+'pt');
    const angular=LG.ratios.angle(31.23456,cfg);const angleRows=plain(LG.ratios.labelLines(angular,cfg));assert.equal(angleRows[0].text,(30).toFixed(labelDecimals)+'°');assert.equal(angleRows[1].text,'◇ '+(31.23456).toFixed(labelDecimals)+'° · +'+(1.23456).toFixed(labelDecimals)+'°');
    const measured=LG.config.resolve({...plain(cfg.settings),measurementLabelMode:'measured'});assert.equal(LG.ratios.labelLines(m,measured)[0].text,'◇ '+(1.23456).toFixed(labelDecimals)+'a');
    assert.equal(LG.ratios.valueText(1,false,cfg),'a');assert.equal(LG.ratios.valueText(-0.000001,true,cfg),(0).toFixed(labelDecimals)+'°');
  }
  for(const labelDecimals of [-1,5,1.5,'2',Infinity])assert.throws(()=>LG.config.resolve({labelDecimals}));
});
test('BOATCHIN all-family label avoidance separates deviations and angles without changing analysis or losing values',()=>{
  const g=JSON.parse(fs.readFileSync(path.join(__dirname,'../samples/illustrator-boatchin.geometry.json'),'utf8')),original=JSON.stringify(g);
  const before=plain(LG.analyze(g,{avoidLabelOverlap:false})),after=plain(LG.analyze(g,{}));
  assert.ok(overlaps(before)>0);assert.equal(overlaps(after),0);const numeric=a=>({...a,lines:a.lines.map(({span,...line})=>line),constructionLines:a.constructionLines.map(({p0,p1,...line})=>line)});assert.deepEqual(numeric(after.analysis),numeric(before.analysis));assert.equal(JSON.stringify(g),original);
  const labels=r=>r.render.primitives.filter(p=>p.type==='label').map(p=>({id:p.featureId,lines:p.lines}));assert.deepEqual(labels(after),labels(before));
  const errors=after.render.primitives.filter(p=>p.type==='label'&&p.lines[0].text.includes('pt')&&p.lines[0].style==='textWarn');assert.ok(errors.length>=2);errors.forEach(p=>assert.ok(p.lines[0].text.startsWith(p.featureId+' ')));
  assert.ok(after.render.primitives.length>before.render.primitives.length);
  const repeated=plain(LG.analyze(g,{}));assert.deepEqual(repeated.render,after.render);
});
test('crowded distinct deviation labels retain feature identities and gain leaders',()=>{
  const render={fontSize:6,guideArea:[-100,100,100,-100],primitives:[LG.primitives.label([10,10],0,[{text:'C1 +0.21pt',sizeFactor:0.75,style:'textWarn'}],'C1'),LG.primitives.label([10,10],0,[{text:'C2 +0.22pt',sizeFactor:0.75,style:'textWarn'}],'C2')]};
  const model={config:LG.config.resolve({}),bbox:[-50,50,50,-50],warnings:[]};LG.layout.avoid(model,render);assert.equal(overlaps({render}),0);assert.equal(render.primitives.filter(p=>p.type==='label').length,2);assert.ok(render.primitives.some(p=>p.type==='line'&&p.featureId==='C2'));
});
