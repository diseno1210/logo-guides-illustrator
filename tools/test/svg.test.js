'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { F1, getFixture, KAPPA } = require('./fixtures');
const { importSvg, validateGeometry, loadGeometry } = require('../svg_import');
const { renderGeometry, preview } = require('../preview');
const { runFixture } = require('../run_fixture');

const wrap = body => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">${body}</svg>`;
const anchors = geometry => geometry.parts[0].contours[0].points.map(p => p.a);

test('F1 follows the Geometry contract and the exact four-cubic fixture', () => {
  const geometry = validateGeometry(F1());
  const points = geometry.parts[0].contours[0].points;
  assert.equal(points.length, 4);
  assert.equal(geometry.parts[0].contours[0].closed, true);
  assert.deepEqual(points.map(p => p.a), [[100,0],[0,100],[-100,0],[0,-100]]);
  assert.equal(points[0].r[1], KAPPA * 100);
  assert.throws(() => getFixture('F2'), /only implements fixture F1/);
});

test('geometry preview has exact y flip, two fixed groups, empty guides and no fake analysis', () => {
  const svg = renderGeometry(F1());
  assert.match(svg, /viewBox="-140 -140 280 280"/);
  assert.match(svg, /id="lg-geometry"/);
  assert.match(svg, /<g id="lg-guides"><\/g>/);
  const handle = 100 * KAPPA;
  assert.ok(svg.includes(`C 100 ${-handle} ${handle} -100 0 -100`));
  const imported = importSvg(svg);
  assert.deepEqual(imported.parts, F1().parts);
  assert.deepEqual(imported.artboard, F1().artboard);
});

test('SVG guides subtree is never imported, including invalid guide geometry', () => {
  const result = importSvg(wrap('<g id="lg-guides"><path d="garbage"/><circle r="20"/></g><rect width="10" height="20"/>'));
  assert.equal(result.parts.length, 1);
  assert.equal(result.parts[0].contours[0].points.length, 4);
});

test('supports all required element types, rounded rects and compound paths', () => {
  const result = importSvg(wrap(`
    <path d="M0 0 L10 0 L10 10 Z M2 2 L3 2 L3 3 Z" fill-rule="evenodd"/>
    <rect x="1" y="2" width="10" height="20"/>
    <rect width="20" height="20" rx="3"/>
    <circle cx="50" cy="50" r="10"/>
    <ellipse rx="20" ry="10"/>
    <polygon points="0,0 10,0 10,10"/>
    <polyline points="0,0 10,10" fill="none"/>
    <line x1="1" y1="2" x2="3" y2="4" stroke="black"/>
  `));
  assert.equal(result.parts.length, 8);
  assert.equal(result.parts[0].kind, 'compound');
  assert.equal(result.parts[0].contours.length, 2);
  assert.equal(result.parts[3].contours[0].points.length, 4);
  assert.equal(result.parts[6].contours[0].closed, false);
  assert.equal(result.parts[7].stroked, true);
  assert.equal(result.parts[7].strokeWidth, 1);
  assert.deepEqual(anchors(result).slice(0, 2), [[0,0],[10,0]]);
});

test('relative/smooth/quadratic/arc commands become cubic/line contract points', () => {
  const result = importSvg(wrap('<path d="M0 0 q 3 6 6 0 t 6 0 s 4 4 6 0 a 5 5 0 0 1 10 0"/>'));
  const points = result.parts[0].contours[0].points;
  assert.deepEqual(points[0].r, [2,-4]);
  assert.deepEqual(points[1].l, [4,-4]);
  assert.deepEqual(points[1].a, [6,0]);
  assert.ok(points.length >= 5);
  assert.equal(points[points.length - 1].a[0], 28);
  assert.ok(Math.abs(points[points.length - 1].a[1]) < 1e-12);
});

test('nested transforms preserve order and flip y only once', () => {
  const result = importSvg(wrap('<g transform="translate(10 20)"><g transform="scale(2 3)"><path transform="translate(1 1)" d="M0 0 L1 1"/></g></g>'));
  assert.deepEqual(anchors(result), [[12,-23],[14,-26]]);
  const rotate = importSvg(wrap('<line x1="1" x2="2" transform="rotate(90)"/>'));
  assert.ok(Math.abs(anchors(rotate)[0][0]) < 1e-12);
  assert.equal(anchors(rotate)[0][1], -1);
  const matrix = importSvg(wrap('<line x2="1" transform="matrix(1 0 0 1 5 6)"/>'));
  assert.deepEqual(anchors(matrix), [[5,-6],[6,-6]]);
  const compact = importSvg(wrap('<line x2="1" transform="translate(10-20)"/>'));
  assert.deepEqual(anchors(compact), [[10,20],[11,20]]);
  const skewed = importSvg(wrap('<line y2="1" transform="skewX(45) skewY(0)"/>'));
  assert.ok(Math.abs(anchors(skewed)[1][0] - 1) < 1e-12);
  assert.equal(anchors(skewed)[1][1], -1);
});

test('open/closed subpaths and post-close commands preserve handles and cursor', () => {
  const geometry = importSvg(wrap('<path d="M0 0 C0 5 5 5 0 0 Z M20 20 l5 0 M30 30 l0 5"/>'));
  assert.equal(geometry.parts[0].contours.length, 2);
  assert.ok(geometry.parts[0].contours.every(c => c.closed === false));
  const closed = importSvg(wrap('<path d="M0 0 L10 0 C10 10 0 10 0 0 Z"/>'));
  assert.deepEqual(closed.parts[0].contours[0].points[0].l, [0,-10]);
});

test('inline style, inheritance, hidden elements, unsupported content and physical lengths', () => {
  const result = importSvg(wrap(`<defs><circle r="20"/></defs>
    <g display="none"><rect width="4" height="4" style="display:inline"/></g>
    <g fill="none" stroke="red" stroke-width="2"><line x2="10"/></g>
    <rect width="1in" height="25.4mm" visibility="hidden"/>
    <rect width="1in" height="25.4mm" style="fill:black;stroke:none"/>
    <text>skipped</text><use href="https://example.invalid/image.svg"/>`));
  assert.equal(result.parts.length, 2);
  assert.equal(result.parts[0].filled, false);
  assert.equal(result.parts[0].strokeWidth, 2);
  assert.deepEqual(anchors({ parts: [result.parts[1]] })[2], [72,-72]);
  assert.ok(result.warnings.some(w => w.code === 'SVG_ELEMENT_SKIPPED'));
});

test('invalid XML, DTD, paths, viewports and unsupported lengths fail explicitly', () => {
  for (const source of [
    '<svg><path></svg>', '<!DOCTYPE svg><svg/>', '<html/>',
    wrap('<path d="M0 0 L garbage"/>'), '<svg viewBox="0 0 0 1"/>',
    wrap('<rect width="100%" height="10"/>'), wrap('<circle r="-1"/>'),
    wrap('<polygon points="1 2 3"/>'), wrap('<svg><line x2="3"/></svg>'),
    wrap('<line x2="3" transform="garbage"/>'),
    wrap('<line x2="3" transform="rotate(bad)"/>'),
    wrap('<line x2="3" transform="matrix(1 2)"/>'),
    wrap('<polygon points="1 2 junk 3 4"/>')
  ]) assert.throws(() => importSvg(source), source);
});

test('invalid Geometry JSON cannot produce NaN/Infinity SVG or duplicate ids', () => {
  const invalidPoint = F1(); invalidPoint.parts[0].contours[0].points[0].a[0] = NaN;
  assert.throws(() => renderGeometry(invalidPoint), /Invalid contour/);
  const invalidBounds = F1(); invalidBounds.artboard = [0,0,0,0];
  assert.throws(() => validateGeometry(invalidBounds), /artboard/);
  const duplicate = F1(); duplicate.parts.push(structuredClone(duplicate.parts[0]));
  assert.throws(() => validateGeometry(duplicate), /duplicate part/);
});

test('JSON and SVG fixture input both preview without overwriting source or reimporting guides', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'logo-guides-preview-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const files = runFixture('F1', directory);
  const first = preview(files.json, path.join(directory, 'from-json.svg'));
  const second = preview(files.svg, path.join(directory, 'from-svg.svg'));
  assert.equal(fs.readFileSync(first, 'utf8'), fs.readFileSync(second, 'utf8'));
  assert.deepEqual(loadGeometry(first).parts, F1().parts);
  assert.throws(() => preview(files.svg, files.svg), /must differ/);
});
