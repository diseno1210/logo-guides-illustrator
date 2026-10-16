'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { runFixture } = require('./run_fixture');
const { getFixture } = require('./test/fixtures');
const { renderAnalysis } = require('./preview');

/** Reproducible M2 evidence: contract results, per-fixture SVGs, and a Chrome QA gallery. */
function validateReferences(directory = path.resolve(__dirname, '../dist/validation/m2')) {
  const inputs = ['F3', 'F6', 'F8', 'F9', 'F9b', path.resolve(__dirname, 'samples/illustrator-boatchin.geometry.json')];
  const reports = inputs.map(input => {
    const files = runFixture(input, directory);
    const result = JSON.parse(fs.readFileSync(files.report, 'utf8'));
    return {
      name: path.basename(files.svg, '.svg'), svg: path.basename(files.svg),
      horizontal: result.analysis.lines.filter(line => line.orient === 'h').map(line => ({ pos: line.pos, category: line.category, subtype: line.subtype })),
      lineCount: result.analysis.lines.length, primitiveCount: result.render.primitives.length, warnings: result.analysis.warnings
    };
  });
  const mixedFile = 'F9b.baseline-mixed.svg';
  fs.writeFileSync(path.join(directory, mixedFile), renderAnalysis(getFixture('F9b'), { mixedAsVisual: false }), 'utf8');
  fs.writeFileSync(path.join(directory, 'results.json'), JSON.stringify(reports, null, 2) + '\n', 'utf8');
  const cards = reports.concat({name:'F9b — mixedAsVisual=false',svg:mixedFile}).map(r => `<article><h2>${r.name}</h2><object data="${r.svg}" type="image/svg+xml"></object></article>`).join('\n');
  fs.writeFileSync(path.join(directory, 'gallery.html'), `<!doctype html><meta charset="utf-8"><title>M2 reference QA</title>
<style>body{margin:16px;background:#fff;font:16px Arial;display:grid;grid-template-columns:repeat(3,1fr);gap:16px}article{height:460px;border:1px solid #ddd}h2{margin:10px;font-size:18px}object{width:100%;height:405px}</style>
${cards}`, 'utf8');
  return reports;
}
if (require.main === module) {
  try { console.log(JSON.stringify(validateReferences(process.argv[2]), null, 2)); }
  catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}
module.exports = { validateReferences };
