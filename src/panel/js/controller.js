/* Panel V8 controller; transport is injectable for parity and failure tests. */
(function (root) {
  'use strict';
  function bridge(cs) {
    const names = ['read','draw','clear','getDocData','setDocData','selectFeature','setFeatureVisible'];
    return function (name, value, documentToken) {
      if (names.indexOf(name) < 0) return Promise.reject(new Error('Unknown host operation'));
      const encoded = ['draw','setDocData','setFeatureVisible'].indexOf(name) >= 0;
      let arg = value === undefined ? '' : JSON.stringify(encoded ? encodeURIComponent(JSON.stringify(value)) : value);
      if (name === 'read' && value && typeof value === 'object') arg = JSON.stringify(value.mode) + ',' + JSON.stringify(encodeURIComponent(JSON.stringify(value)));
      else if (documentToken) arg += ',' + JSON.stringify(documentToken);
      return new Promise(function (resolve, reject) {
        cs.evalScript('LGHost_' + name + '(' + arg + ')', function (raw) {
          try {
            const response = JSON.parse(raw);
            if (!response.ok) throw new Error(response.error || 'Host operation failed');
            resolve(response.data);
          } catch (error) { reject(error); }
        });
      });
    };
  }
  function create(LG, call, changed, clock) {
    clock = clock || function () { return performance.now(); };
    const state = {settings:LG.config.defaults(), documentToken:null, docData:null, features:[], hidden:[], candidates:[], measurements:[], busy:false, curated:false, result:null, geometry:null, status:'就绪'};
    function emit() { if (changed) changed(state); }
    async function task(fn) {
      if (state.busy) throw new Error('正在处理，请稍候');
      state.busy = true; emit();
      try { return await fn(); }
      catch (error) { state.status = error.message || String(error); throw error; }
      finally { state.busy = false; emit(); }
    }
    function resolved(settings, data, mode) {
      const next = LG.config.resolve(settings).settings;
      if (mode === 'sources' && data && data.baseUnit && data.baseUnit.locked) {
        next.baseUnit = {mode:'value', value:data.baseUnit.value, locked:true};
      }
      return LG.config.resolve(next).settings;
    }
    async function init() {
      return task(async function () {
        const data = await call('getDocData');
        if (state.documentToken !== data.documentToken) { state.features=[]; state.hidden=[]; state.candidates=[]; state.measurements=[]; state.result=null; state.geometry=null; }
        state.settings = data.settings; state.docData = data.docData; state.documentToken = data.documentToken;
        if (data.docData && data.docData.baseUnit.locked) state.settings.baseUnit = {mode:'value',value:data.docData.baseUnit.value,locked:true};
        state.status = data.documentName; return data;
      });
    }
    async function runImpl(mode) {
        const start = clock();
        // Validate edits before any host mutation. A read captures native source references.
        LG.config.resolve(state.settings);
        const input = await call('read', {mode:mode,settings:state.settings,documentToken:mode === 'sources'?state.documentToken:null});
        const settings = resolved(state.settings, input.docData, mode);
        const computeStart = clock();
        const context = LG.preAnalyze(input.geometry, settings);
        const result = LG.analyze(input.geometry, settings, context);
        const features = LG.panelModel.catalog(result.analysis);
        const hidden = LG.panelModel.match(mode === 'sources' && input.docData ? input.docData.hiddenFeatures : [], features, settings, result.analysis.S);
        const projected = LG.panelModel.project(result, settings, hidden, state.curated);
        const computeMs = clock() - computeStart;
        const output = await call('draw', {mode:mode,readToken:input.readToken,settings:settings,result:projected.result,hiddenFeatures:hidden});
        state.settings = settings; state.docData = output.docData; state.geometry = input.geometry; state.documentToken = input.documentToken;
        state.result = projected.result; state.features = features.filter(f => projected.allowed['$'+f.id]);
        state.hidden = hidden; state.candidates = context.candidates; state.measurements = input.measurements;
        state.timing = {readMs:input.readMs,readProfile:input.readProfile,computeMs:computeMs,drawMs:output.drawMs,totalMs:clock()-start};
        state.status = '完成 · ' + output.primitives + ' 图元 · a=' + result.analysis.baseUnit.value + ' pt · ' + Math.round(state.timing.totalMs) + ' ms';
        state.warnings = result.analysis.warnings;
        return {result:projected.result, output:output, timing:state.timing};
    }
    async function run(mode) { return task(() => runImpl(mode)); }
    async function measure() {
      return task(async function () {
        const input = await call('read',{mode:'selection',settings:state.settings,measurements:true});
        const context = LG.preAnalyze(input.geometry, state.settings);
        state.candidates = context.candidates; state.measurements = input.measurements;
        state.status = '候选与选中尺寸已更新';
      });
    }
    async function base(value, locked) {
      if (value !== null && !(Number.isFinite(value) && value > 0)) throw new Error('a 必须为正数');
      // Fetch current document data rather than writing a stale panel snapshot.
      return task(async function () {
        const current = await call('getDocData');
        if (state.documentToken && current.documentToken !== state.documentToken) throw new Error('文档已切换，请重新连接此文档');
        const next = {mode:value === null?'auto':'value',value:value,locked:value === null?false:locked};
        if (current.docData) {
          const data = current.docData;
          data.baseUnit = {value:value === null?data.baseUnit.value:value,source:value === null?data.baseUnit.source:'manual',locked:value === null?false:locked};
          state.docData = await call('setDocData', data, state.documentToken);
        } else state.docData = null;
        state.settings.baseUnit = next;
        if (state.docData) return runImpl('sources');
      });
    }
    async function visible(id, value) {
      return task(async function () {
        state.docData = await call('setFeatureVisible', {id:id,visible:value}, state.documentToken);
        state.hidden = state.docData.hiddenFeatures;
      });
    }
    async function select(id) { return task(async () => { const result = await call('selectFeature',id,state.documentToken); state.status = result.selected?'已选中 '+id+' · 临时解锁对应辅助图层，下次面板操作恢复锁定':'此特征已隐藏，无法选中'; return result; }); }
    async function clear(mode) {
      return task(async function () {
        await call('clear',mode,state.documentToken);
        state.features=[]; state.hidden=[]; state.result=null;
        if (mode === 'data') state.docData=null;
        state.status='已清除';
      });
    }
    async function dump() {
      return task(async function () {
        const input = await call('read',{mode:state.docData?'sources':'selection',settings:state.settings,documentToken:state.docData?state.documentToken:null});
        return JSON.stringify(input.geometry,null,2);
      });
    }
    return {state:state,init:init,run:run,measure:measure,base:base,visible:visible,select:select,clear:clear,dump:dump};
  }
  root.LGPanel = {bridge:bridge,create:create};
}(this));
