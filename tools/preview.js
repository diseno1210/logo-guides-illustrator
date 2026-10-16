'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { loadGeometry, validateGeometry } = require('./svg_import');
const ROOT = path.resolve(__dirname, '..');
const { loadCore } = require('./test/load_core');

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

/** Geometry-only preview until feature analysis lands. Never emits fake features. */
function renderGeometry(geometry) {
  validateGeometry(geometry);
  const [left, top, right, bottom] = geometry.artboard;
  const width = right - left;
  const height = top - bottom;
  const shapes = geometry.parts.map((part, index) =>
    `    <path id="geometry-${index}" d="${part.contours.map(contourPath).join(' ')}" fill="${part.filled ? '#D9D9D9' : 'none'}" fill-rule="evenodd" stroke="${part.stroked ? '#A0A0A0' : 'none'}" stroke-width="${part.strokeWidth}"/>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${left} ${-top} ${width} ${height}" width="${width}pt" height="${height}pt">
  <title>Logo Guides — geometry-only preview</title>
  <desc>Geometry preview only. Feature analysis and guide generation are not implemented yet.</desc>
  <g id="lg-geometry">
${shapes}
  </g>
  <g id="lg-guides"></g>
</svg>
`;
}

function escapeXml(value) { return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

/** Render the real implemented analysis; no substitute circles or measurements. */
function renderAnalysis(geometry, settings = {}, suppliedResult) {
  const { LG, plain } = loadCore();
  const result = suppliedResult || plain(LG.analyze(geometry, settings));
  const resolved = plain(LG.config.resolve(settings).settings);
  const styles = plain(LG.styles.preset(resolved.stylePreset));
  const render = result.render;
  const [left, top, right, bottom] = render.guideArea;
  const styleAttributes = key => {
    const s = styles[key];
    return `fill="${s.fillHex || 'none'}" stroke="${s.stroke || 'none'}" opacity="${s.opacity / 100}"` + (s.stroke ? ` stroke-width="${s.width * render.strokeUnit}" stroke-dasharray="${s.dashes.length ? s.dashes.map(v => v * render.strokeUnit).join(' ') : 'none'}" stroke-linecap="butt"` : '');
  };
  const primitiveSvg = p => {
    if (p.type === 'line') return `    <path data-feature="${escapeXml(p.featureId)}" d="M ${pointText(p.p0)} L ${pointText(p.p1)}" ${styleAttributes(p.style)}/>`;
    if(p.type==='polygon')return `    <path data-feature="${escapeXml(p.featureId)}" d="M ${p.points.map(pointText).join(' L ')}${p.closed?' Z':''}" ${styleAttributes(p.style)}/>`;
    if(p.type==='circle')return `    <circle data-feature="${escapeXml(p.featureId)}" cx="${p.c[0]}" cy="${-p.c[1]}" r="${p.r}" ${styleAttributes(p.style)}/>`;
    if(p.type==='arc'){
      const at=degrees=>[p.c[0]+p.r*Math.cos(degrees*Math.PI/180),p.c[1]+p.r*Math.sin(degrees*Math.PI/180)];
      const parts=Math.max(1,Math.ceil((p.endDeg-p.startDeg)/90));let d='M '+pointText(at(p.startDeg));
      for(let i=1;i<=parts;i++)d+=` A ${p.r} ${p.r} 0 0 0 ${pointText(at(p.startDeg+(p.endDeg-p.startDeg)*i/parts))}`;
      return `    <path data-feature="${escapeXml(p.featureId)}" d="${d}" ${styleAttributes(p.style)}/>`;
    }
    if (p.type === 'label') {
      const total = p.lines.reduce((sum, line) => sum + 1.2 * render.fontSize * line.sizeFactor, 0);
      let cursor = -total / 2;
      const lines = p.lines.map(line => {
        const size = render.fontSize * line.sizeFactor;
        const y = cursor + size * 0.9; cursor += 1.2 * size;
        return `<text x="0" y="${y}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${size}" ${styleAttributes(line.style)}>${escapeXml(line.text)}</text>`;
      }).join('');
      return `    <g data-feature="${escapeXml(p.featureId)}" transform="translate(${pointText(p.pos)}) rotate(${-p.rotation})">${lines}</g>`;
    }
    throw new Error('Unsupported preview primitive: ' + p.type);
  };
  const background=render.primitives.filter(p=>p.layer==='background').map(primitiveSvg).join('\n');
  // Repaint the original group after the background inside the skipped guide subtree.
  const guides=background+(background?'\n<use href="#lg-geometry"/>\n':'')+render.primitives.filter(p=>p.layer!=='background').map(primitiveSvg).join('\n');
  // Margin mode depends on geometry bounds, so guide-area viewports do not drift on reimport.
  const geometryGroup = renderGeometry(geometry).match(/  <g id="lg-geometry">[\s\S]*?  <\/g>/)[0];
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${left} ${-top} ${right-left} ${top-bottom}" width="${right-left}pt" height="${top-bottom}pt">
  <title>Logo Guides — analysis preview</title>
  <desc>Geometry and actual shared-core render primitives, with y-up coordinates converted to SVG.</desc>
${geometryGroup}
  <g id="lg-guides">
${guides}
  </g>
</svg>
`;
}

function preview(input, output) {
  const svg = renderAnalysis(loadGeometry(input));
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
    console.log('Analysis preview: ' + preview(args[0], args[2]));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { renderGeometry, renderAnalysis, contourPath, preview };
