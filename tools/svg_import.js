'use strict';

const fs = require('node:fs');
const { DOMParser } = require('@xmldom/xmldom');
const svgpath = require('svgpath');
const KAPPA = 0.5522847498;
const NUMBERS = /[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g;
const DRAWABLE = new Set(['path', 'rect', 'circle', 'ellipse', 'polygon', 'polyline', 'line']);

function numberList(value, label = 'coordinate list') {
  const source = String(value);
  const matches = [...source.matchAll(NUMBERS)];
  let offset = 0;
  for (const match of matches) {
    const separator = source.slice(offset, match.index);
    if (!/^[\s,]*$/.test(separator) || /,\s*,/.test(separator) ||
        (offset === 0 && separator.includes(','))) throw new Error('Invalid SVG ' + label);
    offset = match.index + match[0].length;
  }
  if (!/^\s*$/.test(source.slice(offset))) throw new Error('Invalid SVG ' + label);
  const result = matches.map(match => Number(match[0]));
  if (!result.every(Number.isFinite)) throw new Error('Non-finite SVG ' + label);
  return result;
}

function lengthValue(raw, name) {
  const match = raw.trim().match(/^([-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?)(pt|px|mm|cm|in|pc)?$/);
  if (!match) throw new Error('Unsupported SVG length ' + name + '=' + raw);
  const factors = { pt: 1, px: 1, mm: 72 / 25.4, cm: 72 / 2.54, in: 72, pc: 12 };
  const result = Number(match[1]) * (factors[match[2]] || 1);
  if (!Number.isFinite(result)) throw new Error('Non-finite SVG length: ' + name);
  return result;
}

function numeric(node, name, fallback = 0) {
  const raw = node.getAttribute(name);
  return raw === null || raw === '' ? fallback : lengthValue(raw, name);
}

// svgpath intentionally ignores malformed transforms; reject them before applying.
function checkedTransform(value) {
  const counts = { matrix: [6], translate: [1,2], scale: [1,2], rotate: [1,3], skewX: [1], skewY: [1] };
  let remaining = value.trim();
  const normalized = [];
  while (remaining) {
    const operation = remaining.match(/^([A-Za-z]+)\s*\(([^()]*)\)/);
    if (!operation || !Object.hasOwn(counts, operation[1])) throw new Error('Invalid SVG transform: ' + value);
    const parameters = numberList(operation[2], 'transform parameters');
    if (!counts[operation[1]].includes(parameters.length)) throw new Error('Invalid SVG transform parameter count: ' + value);
    normalized.push(operation[1] + '(' + parameters.join(' ') + ')');
    remaining = remaining.slice(operation[0].length).replace(/^\s*,?\s*/, '');
  }
  return normalized.join(' ');
}

function ellipsePath(cx, cy, rx, ry) {
  const kx = rx * KAPPA;
  const ky = ry * KAPPA;
  return `M ${cx + rx} ${cy} C ${cx + rx} ${cy + ky} ${cx + kx} ${cy + ry} ${cx} ${cy + ry}
    C ${cx - kx} ${cy + ry} ${cx - rx} ${cy + ky} ${cx - rx} ${cy}
    C ${cx - rx} ${cy - ky} ${cx - kx} ${cy - ry} ${cx} ${cy - ry}
    C ${cx + kx} ${cy - ry} ${cx + rx} ${cy - ky} ${cx + rx} ${cy} Z`;
}

function elementPath(node, type) {
  if (type === 'path') return node.getAttribute('d') || '';
  if (type === 'circle' || type === 'ellipse') {
    const rx = numeric(node, type === 'circle' ? 'r' : 'rx');
    const ry = type === 'circle' ? rx : numeric(node, 'ry');
    if (rx < 0 || ry < 0) throw new Error('Negative ellipse radius');
    return rx && ry ? ellipsePath(numeric(node, 'cx'), numeric(node, 'cy'), rx, ry) : '';
  }
  if (type === 'line') return `M ${numeric(node, 'x1')} ${numeric(node, 'y1')} L ${numeric(node, 'x2')} ${numeric(node, 'y2')}`;
  if (type === 'polygon' || type === 'polyline') {
    const points = numberList(node.getAttribute('points') || '');
    if (points.length % 2) throw new Error('Odd number of polygon coordinates');
    if (points.length < 4) return '';
    return `M ${points[0]} ${points[1]} ` + points.slice(2).reduce((str, value, i, rest) =>
      str + (i % 2 === 0 ? `L ${value} ${rest[i + 1]} ` : ''), '') + (type === 'polygon' ? 'Z' : '');
  }
  const x = numeric(node, 'x');
  const y = numeric(node, 'y');
  const width = numeric(node, 'width');
  const height = numeric(node, 'height');
  if (width < 0 || height < 0) throw new Error('Negative rectangle size');
  if (!width || !height) return '';
  const hasRx = node.hasAttribute('rx');
  const hasRy = node.hasAttribute('ry');
  const rawRx = numeric(node, 'rx');
  const rawRy = numeric(node, 'ry');
  if (rawRx < 0 || rawRy < 0) throw new Error('Negative rectangle radius');
  const rx = Math.min(width / 2, hasRx ? rawRx : rawRy);
  const ry = Math.min(height / 2, hasRy ? rawRy : rawRx);
  if (!rx || !ry) return `M ${x} ${y} H ${x + width} V ${y + height} H ${x} Z`;
  return `M ${x + rx} ${y} H ${x + width - rx} A ${rx} ${ry} 0 0 1 ${x + width} ${y + ry}
    V ${y + height - ry} A ${rx} ${ry} 0 0 1 ${x + width - rx} ${y + height}
    H ${x + rx} A ${rx} ${ry} 0 0 1 ${x} ${y + height - ry}
    V ${y + ry} A ${rx} ${ry} 0 0 1 ${x + rx} ${y} Z`;
}

function point(a) { return { a: a.slice(), l: a.slice(), r: a.slice() }; }
function same(a, b) { return Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9; }

/** Convert SVG path data to contract contours in y-up pt coordinates. */
function pathContours(data, transform, partId) {
  const parsed = svgpath(data);
  if (parsed.err) throw new Error('Invalid SVG path: ' + parsed.err);
  parsed.abs().unshort().unarc();
  if (transform) parsed.transform(transform);
  parsed.scale(1, -1).abs();
  const contours = [];
  let current = null;
  let cursor = [0, 0];
  function start(a) { current = { closed: false, points: [point(a)] }; cursor = a; }
  function finish() {
    if (!current) return;
    const pts = current.points;
    if (current.closed && pts.length > 1 && same(pts[0].a, pts[pts.length - 1].a)) {
      pts[0].l = pts[pts.length - 1].l;
      pts.pop();
    }
    if (pts.length >= 2) {
      current.id = partId + 'c' + contours.length;
      contours.push(current);
    }
    current = null;
  }
  parsed.iterate(segment => {
    const command = segment[0];
    if (command === 'M') { finish(); start([segment[1], segment[2]]); return; }
    if (!current) start(cursor);
    if (command === 'Z') { current.closed = true; cursor = current.points[0].a.slice(); finish(); return; }
    const previous = current.points[current.points.length - 1];
    let endpoint;
    let incoming;
    if (command === 'L') endpoint = [segment[1], segment[2]];
    else if (command === 'H') endpoint = [segment[1], cursor[1]];
    else if (command === 'V') endpoint = [cursor[0], segment[1]];
    else if (command === 'C') {
      endpoint = [segment[5], segment[6]];
      previous.r = [segment[1], segment[2]];
      incoming = [segment[3], segment[4]];
    } else if (command === 'Q') {
      endpoint = [segment[3], segment[4]];
      const control = [segment[1], segment[2]];
      previous.r = cursor.map((v, i) => v + (2 / 3) * (control[i] - v));
      incoming = endpoint.map((v, i) => v + (2 / 3) * (control[i] - v));
    } else throw new Error('Unsupported normalized path command: ' + command);
    const next = point(endpoint);
    if (incoming) next.l = incoming;
    current.points.push(next);
    cursor = endpoint;
  });
  finish();
  return contours;
}

function attributes(node, inherited) {
  const result = { ...inherited };
  for (const key of ['fill', 'stroke', 'stroke-width', 'display', 'visibility', 'fill-rule']) {
    if (node.hasAttribute(key)) result[key] = node.getAttribute(key);
  }
  for (const declaration of (node.getAttribute('style') || '').split(';')) {
    const colon = declaration.indexOf(':');
    if (colon > 0) result[declaration.slice(0, colon).trim()] = declaration.slice(colon + 1).trim();
  }
  return result;
}

/** Read SVG elements/transforms; external resources, text and clipping are not expanded. */
function importSvg(source) {
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error('SVG DTD/entity declarations are unsupported');
  const errors = [];
  const document = new DOMParser({ onError: (level, message) => errors.push(level + ': ' + message) })
    .parseFromString(source, 'image/svg+xml');
  if (errors.length) throw new Error('Invalid SVG XML: ' + errors.join('; '));
  const root = document.documentElement;
  if (!root || root.localName !== 'svg') throw new Error('Expected SVG root element');
  const parts = [];
  const warnings = [];
  const warn = (code, message) => { if (!warnings.some(w => w.code === code && w.message === message)) warnings.push({ code, message }); };
  function visit(node, transform, style, hidden) {
    if (node.nodeType !== 1) return;
    const type = node.localName;
    if (node.getAttribute('id') === 'lg-guides') return;
    if (['defs', 'clipPath', 'mask', 'metadata', 'title', 'desc', 'style', 'script', 'symbol'].includes(type)) {
      if (type === 'style') warn('SVG_STYLESHEET_SKIPPED', 'Stylesheets are not expanded; use presentation attributes or inline style.');
      return;
    }
    const nextStyle = attributes(node, style);
    const subtreeHidden = hidden || nextStyle.display === 'none';
    if (subtreeHidden) return;
    const ownTransform = checkedTransform(node.getAttribute('transform') || '');
    const nextTransform = [transform, ownTransform].filter(Boolean).join(' ');
    if (node.hasAttribute('clip-path') || node.hasAttribute('mask')) warn('SVG_CLIPPING_IGNORED', 'Clipping and masks are not expanded.');
    if (DRAWABLE.has(type) && !['hidden', 'collapse'].includes(nextStyle.visibility)) {
      const id = 'p' + parts.length;
      const contours = pathContours(elementPath(node, type), nextTransform, id);
      if (contours.length) {
        const strokeText = String(nextStyle['stroke-width'] || '1');
        const strokeWidth = lengthValue(strokeText, 'stroke-width');
        if (!Number.isFinite(strokeWidth) || strokeWidth < 0) throw new Error('Unsupported stroke width: ' + strokeText);
        const stroked = nextStyle.stroke !== 'none' && strokeWidth > 0;
        parts.push({ id, sourceIndex: parts.length, kind: contours.length > 1 ? 'compound' : 'path',
          filled: nextStyle.fill !== 'none', stroked, strokeWidth: stroked ? strokeWidth : 0, contours });
        if (stroked && nextTransform) warn('SVG_STROKE_NOT_EXPANDED', 'Transforms apply to path coordinates; strokes are not outlined.');
        if (contours.length > 1 && nextStyle['fill-rule'] !== 'evenodd') warn('SVG_FILL_RULE_EVENODD', 'Compound contours use the contract even-odd ink rule; source nonzero fill may differ.');
      }
    } else if (!['svg', 'g'].includes(type) && !DRAWABLE.has(type)) {
      warn('SVG_ELEMENT_SKIPPED', 'Unsupported SVG element: ' + type);
      return;
    }
    if (type === 'svg' && node !== root) throw new Error('Nested SVG viewports are unsupported; flatten before import.');
    for (let child = node.firstChild; child; child = child.nextSibling) visit(child, nextTransform, nextStyle, subtreeHidden);
  }
  visit(root, '', { fill: 'black', stroke: 'none', 'stroke-width': '1', display: 'inline', visibility: 'visible', 'fill-rule': 'nonzero' }, false);
  const rawViewBox = root.getAttribute('viewBox');
  const viewBox = numberList(rawViewBox || '');
  let artboard;
  if (rawViewBox) {
    if (viewBox.length !== 4 || !viewBox.every(Number.isFinite) || viewBox[2] <= 0 || viewBox[3] <= 0) throw new Error('Invalid SVG viewBox');
    artboard = [viewBox[0], -viewBox[1], viewBox[0] + viewBox[2], -viewBox[1] - viewBox[3]];
  } else {
    const width = numeric(root, 'width', 0);
    const height = numeric(root, 'height', 0);
    if (width > 0 && height > 0) artboard = [0, 0, width, -height];
    else {
      const coordinates = parts.flatMap(p => p.contours.flatMap(c => c.points.flatMap(p => [p.a, p.l, p.r])));
      if (!coordinates.length) artboard = [0, 0, 1, -1];
      else {
        let left = Infinity; let right = -Infinity; let top = -Infinity; let bottom = Infinity;
        for (const [x, y] of coordinates) {
          left = Math.min(left, x); right = Math.max(right, x);
          top = Math.max(top, y); bottom = Math.min(bottom, y);
        }
        artboard = [left, top, right === left ? right + 1 : right, bottom === top ? bottom - 1 : bottom];
      }
      warn('SVG_ARTBOARD_FALLBACK', 'No viewport size; artboard inferred from control points, not exact curve bounds.');
    }
  }
  return validateGeometry({ version: 1, units: 'pt', colorSpace: 'RGB', artboard, parts, warnings });
}

/** Validate external Geometry JSON without introducing analysis/normalization. */
function validateGeometry(geometry) {
  if (!geometry || geometry.version !== 1 || geometry.units !== 'pt' || !['RGB', 'CMYK'].includes(geometry.colorSpace)) throw new Error('Expected Geometry JSON v1 in pt');
  const vector = value => Array.isArray(value) && value.length === 2 && value.every(Number.isFinite);
  if (!Array.isArray(geometry.artboard) || geometry.artboard.length !== 4 || !geometry.artboard.every(Number.isFinite) ||
      geometry.artboard[0] >= geometry.artboard[2] || geometry.artboard[1] <= geometry.artboard[3]) throw new Error('Invalid [left, top, right, bottom] artboard');
  if (!Array.isArray(geometry.parts) || !Array.isArray(geometry.warnings)) throw new Error('Missing parts/warnings arrays');
  const ids = new Set();
  for (const part of geometry.parts) {
    if (!part || typeof part.id !== 'string' || !part.id || ids.has(part.id)) throw new Error('Invalid/duplicate part id');
    ids.add(part.id);
    if (!Number.isInteger(part.sourceIndex) || part.sourceIndex < 0 || !['path', 'compound', 'textOutline'].includes(part.kind) ||
        typeof part.filled !== 'boolean' || typeof part.stroked !== 'boolean' || !Number.isFinite(part.strokeWidth) || part.strokeWidth < 0 ||
        !Array.isArray(part.contours)) throw new Error('Invalid part fields: ' + part.id);
    for (const contour of part.contours) {
      if (!contour || typeof contour.id !== 'string' || !contour.id || ids.has(contour.id)) throw new Error('Invalid/duplicate contour id');
      ids.add(contour.id);
      if (typeof contour.closed !== 'boolean' || !Array.isArray(contour.points) || contour.points.length < 2 ||
          !contour.points.every(p => p && vector(p.a) && vector(p.l) && vector(p.r))) throw new Error('Invalid contour points: ' + contour.id);
    }
  }
  for (const warning of geometry.warnings) {
    if (!warning || typeof warning.code !== 'string' || typeof warning.message !== 'string') throw new Error('Invalid Geometry warning');
  }
  return geometry;
}

function loadGeometry(filename) {
  const source = fs.readFileSync(filename, 'utf8').replace(/^\uFEFF/, '');
  return /\.svg$/i.test(filename) ? importSvg(source) : validateGeometry(JSON.parse(source));
}

if (require.main === module) {
  try {
    const filename = process.argv[2];
    if (!filename) throw new Error('Usage: node tools/svg_import.js input.svg [output.json]');
    const json = JSON.stringify(loadGeometry(filename), null, 2) + '\n';
    if (process.argv[3]) fs.writeFileSync(process.argv[3], json, 'utf8');
    else process.stdout.write(json);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { importSvg, pathContours, validateGeometry, loadGeometry };
