'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { getFixture } = require('./test/fixtures');
const { renderAnalysis } = require('./preview');
const { loadGeometry } = require('./svg_import');
const { loadCore } = require('./test/load_core');
const ROOT = path.resolve(__dirname, '..');

function runFixture(name = 'F1', directory = path.join(ROOT, 'dist', 'previews')) {
  const isFile = fs.existsSync(name) && fs.statSync(name).isFile();
  const geometry = isFile ? loadGeometry(name) : getFixture(name);
  const stem = isFile ? path.basename(name, path.extname(name)).replace(/\.geometry$/, '') : name;
  const { LG, plain } = loadCore();
  const result = plain(LG.analyze(geometry));
  fs.mkdirSync(directory, { recursive: true });
  const json = path.join(directory, stem + '.geometry.json');
  const svg = path.join(directory, stem + '.svg');
  const report = path.join(directory, stem + '.analysis.json');
  if (isFile && [json, svg, report].some(file => path.resolve(file) === path.resolve(name))) throw new Error('Output must differ from input; choose another fixture output directory');
  fs.writeFileSync(json, JSON.stringify(geometry, null, 2) + '\n', 'utf8');
  fs.writeFileSync(svg, renderAnalysis(geometry, {}, result), 'utf8');
  fs.writeFileSync(report, JSON.stringify(result, null, 2) + '\n', 'utf8');
  return { json, svg, report };
}

if (require.main === module) {
  try { console.log(JSON.stringify(runFixture(process.argv[2] || 'F1'), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { runFixture };
