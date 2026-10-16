'use strict';

const vm = require('node:vm');
const path = require('node:path');
const { sourceFiles, bundleFiles } = require('../build');
const ROOT = path.resolve(__dirname, '..', '..');

const DISABLE_APIS = `
(function () {
  var i;
  var arrays = ['forEach','map','filter','reduce','reduceRight','some','every','indexOf','lastIndexOf','find','findIndex','includes','fill'];
  var objects = ['keys','create','defineProperty','assign','entries','values'];
  var strings = ['trim','startsWith','endsWith','includes','repeat','padStart','padEnd'];
  for (i = 0; i < arrays.length; i += 1) { delete Array.prototype[arrays[i]]; }
  for (i = 0; i < objects.length; i += 1) { delete Object[objects[i]]; }
  for (i = 0; i < strings.length; i += 1) { delete String.prototype[strings[i]]; }
  delete Array.isArray; delete Array.from; delete Function.prototype.bind;
  delete Date.now; delete Math.hypot; delete Math.sign; delete Math.trunc; delete Math.log2;
  delete Number.isFinite; delete Number.isNaN;
  delete this.JSON; delete this.Promise; delete this.Map; delete this.Set; delete this.WeakMap; delete this.Symbol;
}());
`;

function loadCore() {
  const context = vm.createContext({});
  vm.runInContext(DISABLE_APIS, context, { timeout: 1000 });
  vm.runInContext(bundleFiles(sourceFiles(path.join(ROOT, 'src', 'core'))), context, { timeout: 5000 });
  return { context, LG: context.LG, plain: value => JSON.parse(JSON.stringify(value)) };
}
module.exports = { loadCore, DISABLE_APIS };
