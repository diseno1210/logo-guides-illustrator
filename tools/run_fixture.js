'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { getFixture } = require('./test/fixtures');
const { renderGeometry } = require('./preview');
const ROOT = path.resolve(__dirname, '..');

function runFixture(name = 'F1', directory = path.join(ROOT, 'dist', 'previews')) {
  const geometry = getFixture(name);
  fs.mkdirSync(directory, { recursive: true });
  const json = path.join(directory, name + '.geometry.json');
  const svg = path.join(directory, name + '.svg');
  fs.writeFileSync(json, JSON.stringify(geometry, null, 2) + '\n', 'utf8');
  fs.writeFileSync(svg, renderGeometry(geometry), 'utf8');
  return { json, svg };
}

if (require.main === module) {
  try { console.log(JSON.stringify(runFixture(process.argv[2] || 'F1'), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { runFixture };
