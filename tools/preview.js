'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { loadGeometry, validateGeometry } = require('./svg_import');
const ROOT = path.resolve(__dirname, '..');

function pointText(point) { return `${point[0]} ${-point[1]}`; }

function contourPath(contour) {
  const points = contour.points;
  let data = 'M ' + pointText(points[0].a);
  const count = contour.closed ? points.length : points.length - 1;
  for (let i = 0; i < count; i += 1) {
    const from = points[i];
    const to = points[(i + 1) % points.length];
    if (from.a.every((v, j) => v === from.r[j]) && to.a.every((v, j) => v === to.l[j])) data += ' L ' + pointText(to.a);
    else data += ` C ${pointText(from.r)} ${pointText(to.l)} ${pointText(to.a)}`;
  }
  return data + (contour.closed ? ' Z' : '');
}

/** M0 geometry-only preview. Does not call a fake analyze or emit fake features. */
function renderGeometry(geometry) {
  validateGeometry(geometry);
  const [left, top, right, bottom] = geometry.artboard;
  const width = right - left;
  const height = top - bottom;
  const shapes = geometry.parts.map(part =>
    `    <path id="geometry-${part.sourceIndex}" d="${part.contours.map(contourPath).join(' ')}" fill="${part.filled ? '#D9D9D9' : 'none'}" fill-rule="evenodd" stroke="${part.stroked ? '#A0A0A0' : 'none'}" stroke-width="${part.strokeWidth}"/>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${left} ${-top} ${width} ${height}" width="${width}pt" height="${height}pt">
  <title>Logo Guides M0 — geometry-only preview</title>
  <desc>Geometry preview only. Analysis and guide generation are not implemented in M0.</desc>
  <g id="lg-geometry">
${shapes}
  </g>
  <g id="lg-guides"></g>
</svg>
`;
}

function preview(input, output) {
  const svg = renderGeometry(loadGeometry(input));
  const target = output || path.join(ROOT, 'dist', 'previews', path.basename(input, path.extname(input)) + '.svg');
  if (path.resolve(target) === path.resolve(input)) throw new Error('Output must differ from input; use --out to preserve the source');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, svg, 'utf8');
  return target;
}

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    if (!args[0] || (args.length > 1 && (args[1] !== '--out' || args.length !== 3))) throw new Error('Usage: npm run preview -- input.json|input.svg [--out output.svg]');
    console.log('M0 geometry only: ' + preview(args[0], args[2]));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { renderGeometry, contourPath, preview };
