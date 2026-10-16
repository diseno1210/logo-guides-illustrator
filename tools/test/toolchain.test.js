'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { loadCore } = require('./load_core');
const { build, asciiEscape } = require('../build');
const { checkSource } = require('../check_es3');

test('shared core loads with every contract-banned API removed and no host objects', () => {
  const { context, LG, plain } = loadCore();
  assert.equal(LG.version, require('../../package.json').version);
  assert.equal(LG.milestone, 'M6');
  assert.equal(typeof LG.geometry.normalize, 'function');
  assert.equal(typeof LG.json.stringify, 'function');
  const values = vm.runInContext(`
    [typeof [].map, typeof [].indexOf, typeof Object.keys, typeof Array.isArray,
     typeof ''.trim, typeof Function.prototype.bind, typeof JSON, typeof Promise,
     typeof Map, typeof Set, typeof WeakMap, typeof Symbol, typeof Date.now,
     typeof Math.hypot, typeof Number.isFinite, typeof app, typeof File]
  `, context);
  assert.ok(Array.from(values).every(value => value === 'undefined'));
  assert.equal(typeof LG.analyze, 'function');
  assert.equal(typeof LG.preAnalyze, 'function');
  assert.throws(() => vm.runInContext('[1,2].indexOf(2)', context), /not a function/);
  assert.throws(() => vm.runInContext('JSON.parse("{}")', context));
});

test('ASCII escaping preserves literal Unicode including surrogate pairs', () => {
  const source = asciiEscape('var x = "中文 🎨";');
  assert.match(source, /\\u4e2d/);
  assert.ok(!/[^\x00-\x7f]/.test(source));
  assert.equal(vm.runInNewContext(source + 'x;'), '中文 🎨');
});

test('build is deterministic, ES3/ASCII, and Generate guards missing documents', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'logo-guides-build-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const products = build(directory);
  assert.equal(products.length, 6);
  for(const product of products)assert.deepEqual(checkSource(fs.readFileSync(product,'utf8')),[]);
  const generated = products.find(file=>file.endsWith('LogoGuides_Generate.jsx'));
  const source = fs.readFileSync(generated, 'utf8');
  assert.ok(source.startsWith('#target illustrator\n(function () {'));
  assert.ok(!/[^\x00-\x7f]/.test(source));
  assert.deepEqual(checkSource(source), []);
  const messages = [];
  const sandbox = { alert: message => messages.push(message), app: { documents: [] } };
  vm.runInNewContext(source.replace(/^#target illustrator\n/, ''), sandbox, { timeout: 1000 });
  assert.equal(messages.length, 1);
  assert.match(messages[0], /请先打开文档/);
  assert.equal(sandbox.LG, undefined);
  build(directory);
  assert.equal(fs.readFileSync(generated, 'utf8'), source);
});
