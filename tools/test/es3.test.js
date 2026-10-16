'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { checkSource } = require('../check_es3');

test('ES3 accepts contract-style code, quoted reserved keys, strings and comments', () => {
  const source = 'var LG = LG || {}; LG.x = (function () { var data = { "default": 1 }; return data["default"]; }());\n' +
    'var text = "JSON Promise x.map()"; /* arr.forEach(); */ var i = text.indexOf("J");';
  assert.deepEqual(checkSource(source), []);
});

for (const source of [
  'let value = 1;', 'const value = 1;', 'var f = () => 1;', 'class A {}',
  'var f = function (x = 1) {};', 'var a = `test`;', 'var a = {...x};',
  'var int = 1;', 'var a = { default: 1 };', 'var x = a.default;',
  'var a = [1,];', 'var a = {value: 1,};'
]) {
  test('rejects unsupported syntax: ' + source, () => assert.ok(checkSource(source).length));
}

for (const source of [
  'var x = a.map(f);', 'var x = a["filter"](f);', 'var x = a.trim();',
  'var x = Array.isArray(a);', 'var x = Object.keys(a);', 'var x = Date.now();',
  'var x = Math.hypot(3,4);', 'var x = Number.isFinite(3);',
  'var x = JSON.parse(s);', 'var x = new Promise(f);', 'var x = new Map();',
  'var x = new Set();', 'var x = new WeakMap();', 'var x = Symbol();',
  'var JSON = {};', 'var x = [1,2].indexOf(2);', 'var x = Array.prototype.lastIndexOf.call(a, 2);'
]) {
  test('rejects forbidden API: ' + source, () => assert.ok(checkSource(source).some(d => d.rule !== 'ES3_SYNTAX')));
}

test('host member exception requires an actual trailing line comment', () => {
  assert.deepEqual(checkSource('box.find("item"); // es3-ok'), []);
  assert.ok(checkSource('box.find("item"); /* es3-ok */').length);
  assert.ok(checkSource('box.find("item"); // text es3-ok').length);
  assert.ok(checkSource('box.find("item"); var text = "// es3-ok";').length);
  assert.ok(checkSource('JSON.parse(x); // es3-ok').length);
  assert.ok(checkSource('Object.keys(x); // es3-ok').length);
});

test('header directive preserves diagnostics and is only allowed at the header', () => {
  const result = checkSource('#target illustrator\nvar value = JSON.parse(x);', 'probe.jsx');
  assert.equal(result[0].line, 2);
  assert.equal(result[0].filename, 'probe.jsx');
  assert.deepEqual(checkSource('#target illustrator\r\nvar x = 1;'), []);
  assert.equal(checkSource('var x = 1;\n#target illustrator')[0].rule, 'ES3_SYNTAX');
});

test('array indexOf remains a runtime responsibility for unknown receiver types', () => {
  assert.deepEqual(checkSource('var x = text.indexOf("x"); var y = text.lastIndexOf("x");'), []);
});

test('trailing-comma check handles comments without banning nested ordinary arrays', () => {
  assert.ok(checkSource('var x = {a: 1, /* trailing */};').length);
  assert.deepEqual(checkSource('var x = {a: [1,2], b: {c: 3}};'), []);
});
