/* Panel V8 controller; transport is injectable for parity and failure tests. */
(function (root) {
  'use strict';
  function bridge(cs) {
    const names = ['read','draw','clear','getDocData','setDocData','selectFeature','setFeatureVisible'];
    return function (name, value) {
      if (names.indexOf(name) < 0) return Promise.reject(new Error('Unknown host operation'));
      const encoded = ['draw','setDocData','setFeatureVisible'].indexOf(name) >= 0;
      const arg = value === undefined ? '' : JSON.stringify(encoded ? encodeURIComponent(JSON.stringify(value)) : value);
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
    const state = {settings:LG.config.defaults(), docData:null, features:[], hidden:[], candidates:[], measurements:[], busy:false, curated:false, result:null, geometry:null, status:'就绪'};
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
        state.settings = data.settings; state.docData = data.docData;
        if (data.docData && data.docData.baseUnit.locked) state.settings.baseUnit = {mode:'value',value:data.docData.baseUnit.value,locked:true};
        state.status = data.documentName; return data;
      });
    }
    async function run(mode) {
      return task(async function () {
        const start = clock();
        // Validate edits before any host mutation. A read captures native source references.
        LG.config.resolve(state.settings);
        const input = await call('read', mode);
        const settings = resolved(state.settings, input.docData, mode);
        const computeStart = clock();
        const context = LG.preAnalyze(input.geometry, settings);
        const result = LG.analyze(input.geometry, settings, context);
        const features = LG.panelModel.catalog(result.analysis);
        const hidden = LG.panelModel.match(mode === 'sources' && input.docData ? input.docData.hiddenFeatures : [], features, settings, result.analysis.S);
        const projected = LG.panelModel.project(result, settings, hidden, state.curated);
        const computeMs = clock() - computeStart;
        const output = await call('draw', {mode:mode,readToken:input.readToken,settings:settings,result:projected.result,hiddenFeatures:hidden});
        state.settings = settings; state.docData = output.docData; state.geometry = input.geometry;
        state.result = projected.result; state.features = features.filter(f => projected.allowed['$'+f.id]);
        state.hidden = hidden; state.candidates = context.candidates; state.measurements = input.measurements;
        state.timing = {readMs:input.readMs,computeMs:computeMs,drawMs:output.drawMs,totalMs:clock()-start};
        state.status = '完成 · ' + output.primitives + ' 图元 · a=' + result.analysis.baseUnit.value + ' pt · ' + Math.round(state.timing.totalMs) + ' ms';
        state.warnings = result.analysis.warnings;
        return {result:projected.result, output:output, timing:state.timing};
      });
    }
    async function measure() {
      return task(async function () {
        const input = await call('read','selection');
        const context = LG.preAnalyze(input.geometry, state.settings);
        state.candidates = context.candidates; state.measurements = input.measurements;
        state.status = '候选与选中尺寸已更新';
      });
    }
    async function base(value, locked) {
      if (value !== null && !(Number.isFinite(value) && value > 0)) throw new Error('a 必须为正数');
      state.settings.baseUnit = {mode:value === null?'auto':'value',value:value,locked:locked};
      // Fetch current document data rather than writing a stale panel snapshot.
      await task(async function () {
        const current = await call('getDocData');
        if (current.docData) {
          const data = current.docData;
          data.baseUnit = {value:value === null?data.baseUnit.value:value,source:value === null?data.baseUnit.source:'manual',locked:value === null?false:locked};
          state.docData = await call('setDocData', data);
        } else state.docData = null;
      });
      if (state.docData) return run('sources');
      emit();
    }
    async function visible(id, value) {
      return task(async function () {
        state.docData = await call('setFeatureVisible', {id:id,visible:value});
        state.hidden = state.docData.hiddenFeatures;
      });
    }
    async function select(id) { return task(() => call('selectFeature',id)); }
    async function clear(mode) {
      return task(async function () {
        await call('clear',mode);
        state.features=[]; state.hidden=[]; state.result=null;
        if (mode === 'data') state.docData=null;
        state.status='已清除';
      });
    }
    async function dump() {
      return task(async function () {
        const input = await call('read',state.docData?'sources':'selection');
        return JSON.stringify(input.geometry,null,2);
      });
    }
    return {state:state,init:init,run:run,measure:measure,base:base,visible:visible,select:select,clear:clear,dump:dump};
  }
  root.LGPanel = {bridge:bridge,create:create};
}(this));
