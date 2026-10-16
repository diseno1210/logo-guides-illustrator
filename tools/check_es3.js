'use strict';

const fs = require('node:fs');
const path = require('node:path');
const acorn = require('acorn');

const ROOT = path.resolve(__dirname, '..');
const MEMBER_BANS = new Set([
  'forEach', 'map', 'filter', 'reduce', 'reduceRight', 'some', 'every',
  'find', 'findIndex', 'includes', 'fill', 'bind', 'trim', 'startsWith',
  'endsWith', 'repeat', 'padStart', 'padEnd'
]);
const STATIC_BANS = new Set([
  'Array.isArray', 'Array.from', 'Object.keys', 'Object.create',
  'Object.defineProperty', 'Object.assign', 'Object.entries', 'Object.values',
  'Date.now', 'Math.hypot', 'Math.sign', 'Math.trunc', 'Math.log2',
  'Number.isFinite', 'Number.isNaN'
]);
const GLOBAL_BANS = new Set(['JSON', 'Promise', 'Map', 'Set', 'WeakMap', 'Symbol']);
const ARRAY_INDEX = new Set(['indexOf', 'lastIndexOf']);

function walk(node, visitor, parent = null, key = '') {
  if (!node || typeof node.type !== 'string') return;
  visitor(node, parent, key);
  for (const name of Object.keys(node)) {
    const value = node[name];
    if (Array.isArray(value)) {
      for (const child of value) walk(child, visitor, node, name);
    } else if (value && typeof value === 'object') {
      walk(value, visitor, node, name);
    }
  }
}

function propertyName(node) {
  if (!node.computed && node.property.type === 'Identifier') return node.property.name;
  if (node.computed && node.property.type === 'Literal') return String(node.property.value);
  return null;
}

function isIdentifierUse(node, parent, key) {
  if (!parent) return true;
  if (parent.type === 'MemberExpression' && key === 'property' && !parent.computed) return false;
  if (parent.type === 'Property' && key === 'key') return false;
  if ((parent.type === 'LabeledStatement' && key === 'label') ||
      ((parent.type === 'BreakStatement' || parent.type === 'ContinueStatement') && key === 'label')) return false;
  // Also reject binding a banned global name: shadowing would bypass the contract.
  return true;
}

/** Return diagnostics for ES3 source, preserving source locations after #target removal. */
function checkSource(source, filename = '<source>') {
  const diagnostics = [];
  const comments = [];
  const lines = source.split(/\r?\n/);
  const prepared = source.replace(/^(?:\uFEFF)?#target[ \t]+illustrator[ \t]*(?=\r?$)/m, line => {
    // Only the actual file header is allowed, not arbitrary preprocessor lines.
    if (!source.startsWith(line)) return line;
    return ' '.repeat(line.length);
  });
  let ast;
  try {
    ast = acorn.parse(prepared, { ecmaVersion: 3, allowReserved: 'never', locations: true, onComment: comments });
  } catch (error) {
    return [{ filename, line: error.loc?.line || 1, column: (error.loc?.column || 0) + 1, rule: 'ES3_SYNTAX', message: error.message }];
  }
  const exempt = new Set(comments.filter(c => !c.type.startsWith('Block') &&
    /^\s*es3-ok\s*$/.test(c.value) &&
    /^\s*$/.test(lines[c.loc.end.line - 1].slice(c.loc.end.column))).map(c => c.loc.start.line));
  function report(node, rule, message) {
    diagnostics.push({ filename, line: node.loc.start.line, column: node.loc.start.column + 1, rule, message });
  }
  walk(ast, (node, parent, key) => {
    if (node.type === 'Identifier' && GLOBAL_BANS.has(node.name) && isIdentifierUse(node, parent, key)) {
      report(node, 'ES3_GLOBAL', 'Forbidden global: ' + node.name);
    }
    if (node.type === 'MemberExpression') {
      const property = propertyName(node);
      const objectName = node.object.type === 'Identifier' ? node.object.name : null;
      const staticName = objectName && objectName + '.' + property;
      if (STATIC_BANS.has(staticName)) report(node, 'ES3_STATIC', 'Forbidden API: ' + staticName);
      else if (MEMBER_BANS.has(property) && !exempt.has(node.loc.end.line)) {
        report(node, 'ES3_MEMBER', 'Forbidden member: ' + property + ' (host exceptions require trailing // es3-ok)');
      } else if (ARRAY_INDEX.has(property) &&
        (node.object.type === 'ArrayExpression' ||
          (node.object.type === 'MemberExpression' && node.object.object.name === 'Array' && propertyName(node.object) === 'prototype'))) {
        report(node, 'ES3_ARRAY_INDEX', 'Array ' + property + ' is unavailable; string use remains allowed');
      }
    }
  });
  // Acorn deliberately accepts ES3 trailing commas in object literals; the project does not.
  walk(ast, node => {
    if (node.type !== 'ObjectExpression' && node.type !== 'ArrayExpression') return;
    const tokens = [...acorn.tokenizer(prepared.slice(node.start, node.end), { ecmaVersion: 3 })];
    if (tokens.length >= 2 && tokens[tokens.length - 2].type.label === ',') {
      report(node, 'ES3_TRAILING_COMMA', 'Trailing commas are forbidden in arrays and objects');
    }
  });
  return diagnostics;
}

function listSources(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(item => {
    const target = path.join(directory, item.name);
    return item.isDirectory() ? listSources(target) : /\.jsx?$/.test(item.name) ? [target] : [];
  }).sort();
}

function main(args) {
  const files = args.length ? args.map(file => path.resolve(file)) : listSources(path.join(ROOT, 'dist', 'scripts'));
  if (!files.length) throw new Error('No build products found. Run npm run build first.');
  let count = 0;
  for (const file of files) {
    const diagnostics = checkSource(fs.readFileSync(file, 'utf8'), path.relative(ROOT, file));
    for (const item of diagnostics) {
      console.error(`${item.filename}:${item.line}:${item.column} ${item.rule}: ${item.message}`);
    }
    count += diagnostics.length;
  }
  if (count) process.exitCode = 1;
  else console.log(`ES3 OK: ${files.length} file(s)`);
}

if (require.main === module) {
  try { main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { checkSource, listSources };
