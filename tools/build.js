'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { checkSource } = require('./check_es3');
const ROOT = path.resolve(__dirname, '..');

function sourceFiles(directory) {
  return fs.readdirSync(directory).filter(name => name.endsWith('.js')).sort().map(name => path.join(directory, name));
}

/** Join original ES3 files in order; the exact shared core also runs in the vm. */
function bundleFiles(files) {
  return files.map(file => `/* ${path.relative(ROOT, file).replace(/\\/g, '/')} */\n` +
    fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n').trimEnd()).join('\n\n');
}

function asciiEscape(source) {
  return source.replace(/[^\x00-\x7f]/g, char => '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0'));
}

/** Build milestone entrypoints; no CEP products are emitted before M7. */
function build(output = path.join(ROOT, 'dist', 'scripts')) {
  const shared = [...sourceFiles(path.join(ROOT, 'src', 'core')), ...sourceFiles(path.join(ROOT, 'src', 'host'))];
  const entries = sourceFiles(path.join(ROOT, 'src', 'scripts'));
  if (!entries.length) throw new Error('No script entrypoints found');
  const products = entries.map(entry => {
    const name = path.basename(entry, '.js') + '.jsx';
    const source = asciiEscape('#target illustrator\n(function () {\n' + bundleFiles([...shared, entry]) + '\n}());\n');
    const diagnostics = checkSource(source, name);
    if (diagnostics.length) throw new Error(JSON.stringify(diagnostics, null, 2));
    return { name, source };
  });
  // Only replace outputs once all in-memory products pass ES3 validation.
  fs.mkdirSync(output, { recursive: true });
  for (const file of fs.readdirSync(output)) {
    if (/^LogoGuides_.*\.jsx$/.test(file) && !products.some(p => p.name === file)) fs.unlinkSync(path.join(output, file));
  }
  for (const product of products) fs.writeFileSync(path.join(output, product.name), product.source, 'utf8');
  return products.map(product => path.join(output, product.name));
}

if (require.main === module) {
  try { for (const output of build()) console.log('Built ' + path.relative(ROOT, output)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { build, sourceFiles, bundleFiles, asciiEscape };
