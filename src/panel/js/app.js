(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const fields = [
    ['tolerancePreset','容差预设',['loose','standard','strict'],['宽松','标准','严格']],
    ['labelPrecision','倍率精度',[0.01,0.05,0.1]],['snapMode','倍率吸附',['off','step'],['关闭','按步长']],
    ['snapStep','吸附步长 / a',[0.05,0.1,0.25,0.5]],['angleSnapStep','角度吸附 / °',[0,1,5,15]],
    ['stylePreset','样式',['dark','light'],['深色','浅色']],['output','输出',['styled','guides','both'],['样式化','参考线','两者']],
    ['extendTo','参考线延伸',['margin','artboard'],['边距','画板']]
  ];
  const checks=[['detectSpecialRatios','识别 φ、√2'],['lockLayer','锁定辅助图层']];
  const features=[['baselines','基准线'],['overshoot','视觉超出'],['verticals','竖直参考线'],['stemWidths','笔画宽度'],['gaps','间距'],['heights','高度'],['counters','字怀'],['circles','辅助圆'],['ringThickness','环厚度'],['angles','角度'],['constructionLines','构造线'],['targetLines','目标线'],['deviationMarkers','偏差标记'],['clearSpace','安全区'],['legend','图例']];
  const types={line:'参考线',construction:'构造线',circle:'辅助圆',stem:'笔画',gap:'间距',angle:'角度',height:'高度',counter:'字怀',ring:'环厚度'};
  let controller; let timer; let baseEditing=false; let aiStore;
  function aiConfig(){return {provider:$('aiProvider').value,baseUrl:$('aiBaseUrl').value,model:$('aiModel').value,apiKey:$('aiKey').value};}
  function report(error) { $('status').textContent=error.message||String(error); $('status').classList.add('error'); }
  function action(fn) { clearTimeout(timer); return Promise.resolve().then(fn).catch(report); }
  function schedule() { clearTimeout(timer); timer=setTimeout(function () { if(controller.state.busy){schedule();return;} if(controller.state.docData)action(()=>controller.run('sources')); },300); }
  function makeCheck(parent, id, text, fn) { const label=document.createElement('label');label.className='check';const input=document.createElement('input');input.type='checkbox';input.id=id;input.addEventListener('change',()=>fn(input.checked));label.append(input,document.createTextNode(text));$(parent).appendChild(label); }
  fields.forEach(function (f) { const label=document.createElement('label');label.textContent=f[1];const select=document.createElement('select');select.id='setting-'+f[0];f[2].forEach((v,i)=>{const option=document.createElement('option');option.value=String(v);option.textContent=(f[3]||f[2])[i];select.appendChild(option);});select.addEventListener('change',function(){controller.state.settings[f[0]]=typeof f[2][0]==='number'?Number(select.value):select.value;if(f[0]==='tolerancePreset'){delete controller.state.settings.advanced.circleFitTol;sync(controller.state);}schedule();});label.appendChild(select);$('parameters').appendChild(label); });
  checks.forEach(f=>makeCheck('checks','setting-'+f[0],f[1],v=>{controller.state.settings[f[0]]=v;schedule();}));
  features.forEach(f=>makeCheck('features','feature-'+f[0],f[1],v=>{controller.state.settings.features[f[0]]=v;schedule();}));
  function button(parent,text,fn) { const b=document.createElement('button');b.textContent=text;b.disabled=controller.state.busy;b.addEventListener('click',()=>action(fn));$(parent).appendChild(b); }
  function sync(s) {
    $('status').textContent=s.status; $('status').classList.remove('error');
    fields.forEach(f=>$('setting-'+f[0]).value=String(s.settings[f[0]]));
    checks.forEach(f=>$('setting-'+f[0]).checked=s.settings[f[0]]);
    features.forEach(f=>$('feature-'+f[0]).checked=s.settings.features[f[0]]);
    if(!baseEditing)$('baseValue').value=s.settings.baseUnit.value||s.docData&&s.docData.baseUnit.value||'';
    $('baseLock').checked=s.settings.baseUnit.locked;
    const cfg=LG.config.resolve(s.settings);$('circleFit').value=cfg.circleFitTol;$('fitValue').textContent=(100*cfg.circleFitTol).toFixed(2)+'%';
    document.body.classList.toggle('light',s.settings.stylePreset==='light');
    document.querySelectorAll('button,input,select').forEach(el=>el.disabled=s.busy);
    $('curated').checked=s.curated;
    $('aiApply').disabled=s.busy || !s.ai.pending;
    $('aiRequest').disabled=s.busy || !s.result;
    const suggestion=s.ai.pending;
    $('aiAdvice').textContent=(suggestion?('显示：'+suggestion.show.join(', ')+'\n隐藏：'+suggestion.hide.join(', ')+'\n'+suggestion.targets.map(t=>t.id+' → '+t.target+' · '+t.reason).join('\n')+'\n'):'')+(s.ai.groups||[]).map(g=>g.title+'：'+g.ids.join(', ')).join('\n')+'\n'+(s.ai.notes || '尚无 AI 建议。');
    $('aiSummary').textContent=JSON.stringify(s.ai.summary || (s.result?LGPanelAI.summary(s.result.analysis,$('aiGoal').value):null),null,2);
    $('candidates').textContent='';s.candidates.forEach(c=>button('candidates',c.value.toFixed(3)+' pt · '+c.count+' 处',()=>controller.base(c.value,$('baseLock').checked)));
    $('measurements').textContent='';s.measurements.filter(m=>m.value>0).forEach(m=>button('measurements',m.zh+' '+m.value.toFixed(3)+' pt',()=>controller.base(m.value,$('baseLock').checked)));
    $('warnings').textContent=(s.warnings||[]).map(w=>w.code+': '+w.message).join('\n');
    renderList(s);
  }
  function renderList(s) {
    const list=$('featureList');list.textContent='';
    const hidden=LG.panelModel.idSet(s.hidden);let last='';
    const sorted=$('view').value==='severity'?LG.panelModel.severity(s.features):s.features.slice().sort((a,b)=>a.type.localeCompare(b.type)||a.id.localeCompare(b.id));
    if(!sorted.length){const p=document.createElement('p');p.className='muted';p.textContent='生成或刷新后显示特征。';list.appendChild(p);}
    sorted.forEach(function(f){const group=$('view').value==='severity'?f.severity:f.type;if(group!==last){const h=document.createElement('div');h.className='feature-group';h.textContent=types[group]||group;list.appendChild(h);last=group;}const row=document.createElement('div');row.className='feature';const check=document.createElement('input');check.type='checkbox';check.checked=!hidden['$'+f.id];check.disabled=s.busy;check.setAttribute('aria-label','显示 '+f.id);check.addEventListener('change',()=>action(async()=>{await controller.visible(f.id,check.checked);await controller.run('sources');}));const b=document.createElement('button');b.disabled=s.busy;b.textContent=f.id+' · '+(f.display||'');b.title='在 Illustrator 中选中';b.addEventListener('click',()=>action(()=>controller.select(f.id)));const dev=document.createElement('span');dev.className='dev '+f.severity;dev.textContent=f.measure&&f.measure.dev!==null?String(f.measure.dev):'—';row.append(check,b,dev);list.appendChild(row);});
  }
  try {
    if(!window.__adobe_cep__)throw new Error('请在 Illustrator 的「窗口 → 扩展」中打开此面板。');
    controller=LGPanel.create(LG,LGPanel.bridge(new CSInterface()),sync,null,LGPanelAI);
    aiStore=LGPanelAI.storage(require('path').join(new CSInterface().getSystemPath(SystemPath.USER_DATA),'LogoGuides'));
    try{const c=aiStore.load();$('aiProvider').value=c.provider;$('aiBaseUrl').value=c.baseUrl;$('aiModel').value=c.model;$('aiKey').value=c.apiKey;}catch(error){$('aiConfigStatus').textContent=error.message;}
    window.logoGuidesPanel=controller;
    $('connect').onclick=()=>action(()=>controller.init());
    $('generate').onclick=()=>action(()=>controller.run('selection'));
    $('refresh').onclick=()=>action(()=>controller.run('sources'));
    $('measure').onclick=()=>action(()=>controller.measure());
    $('baseValue').onfocus=()=>{baseEditing=true;};$('baseValue').onblur=()=>{baseEditing=false;};
    $('setBase').onclick=()=>action(()=>controller.base(Number($('baseValue').value),$('baseLock').checked));
    $('baseLock').onchange=()=>action(()=>controller.base(Number($('baseValue').value)||null,$('baseLock').checked));
    $('autoBase').onclick=()=>action(()=>controller.base(null,$('baseLock').checked));
    $('circleFit').oninput=function(){controller.state.settings.advanced.circleFitTol=Number(this.value);$('fitValue').textContent=(100*Number(this.value)).toFixed(2)+'%';schedule();};
    $('curated').onchange=function(){controller.state.curated=this.checked;schedule();};
    $('view').onchange=()=>renderList(controller.state);
    $('aiGoal').onchange=()=>sync(controller.state);
    $('aiProvider').onchange=()=>{if($('aiProvider').value==='anthropic')$('aiBaseUrl').value='https://api.anthropic.com/v1';};
    $('aiSave').onclick=()=>action(()=>{aiStore.save(aiConfig());$('aiConfigStatus').textContent='已保存本机配置（明文）';});
    $('aiRequest').onclick=()=>action(()=>controller.requestAI(aiConfig(),$('aiGoal').value));
    $('aiApply').onclick=()=>action(()=>controller.applyAI());
    document.querySelectorAll('[data-clear]').forEach(b=>b.onclick=()=>action(()=>controller.clear(b.getAttribute('data-clear'))));
    $('dump').onclick=()=>action(async function(){const json=await controller.dump();const fs=require('fs');const path=require('path');const folder=path.join(new CSInterface().getSystemPath(SystemPath.USER_DATA),'LogoGuides');fs.mkdirSync(folder,{recursive:true});const target=path.join(folder,'geometry_dump.json');fs.writeFileSync(target,json,'utf8');controller.state.status='已导出 '+target;sync(controller.state);});
    action(()=>controller.init());
  } catch(error) { report(error); }
}());
