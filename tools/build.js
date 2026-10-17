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

/** CEP uses the exact core; only the host has Illustrator directives and ASCII escaping. */
function buildPanel(output = path.join(ROOT, 'dist', 'panel')) {
  const panel = path.join(ROOT, 'src', 'panel');
  const core = bundleFiles(sourceFiles(path.join(ROOT, 'src', 'core'))) + '\n';
  const api = fs.readFileSync(path.join(panel, 'host_api.js'), 'utf8');
  const split = api.indexOf('function LGHost_read(');
  if (split < 0) throw new Error('Missing panel host exports');
  const host = asciiEscape('#target illustrator\nvar LGHostAPI=(function(){\n' + core + '\n' +
    bundleFiles(sourceFiles(path.join(ROOT, 'src', 'host'))) + '\n' +
    fs.readFileSync(path.join(panel, 'js', 'model.js'), 'utf8') + '\n' + api.slice(0, split) +
    '\nreturn LGHost;\n}());\n' + api.slice(split).replace(/LGHost\./g, 'LGHostAPI.'));
  for (const [name, source] of [['js/core.js', core], ['host/host.jsx', host], ['js/model.js', fs.readFileSync(path.join(panel, 'js/model.js'), 'utf8')]]) {
    const diagnostics = checkSource(source, name);
    if (diagnostics.length) throw new Error(JSON.stringify(diagnostics, null, 2));
  }
  const files = ['index.html', 'css/panel.css', 'js/model.js', 'js/ai.js', 'js/controller.js', 'js/app.js', 'CSXS/manifest.xml', 'vendor/CSInterface.js', 'vendor/Adobe-SDK-License.pdf'];
  for (const name of files) {
    const target = path.join(output, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(panel, name), target);
  }
  fs.mkdirSync(path.join(output, 'host'), { recursive: true });
  fs.writeFileSync(path.join(output, 'js/core.js'), core);
  fs.writeFileSync(path.join(output, 'host/host.jsx'), host);
  return [path.join(output, 'js/core.js'), path.join(output, 'host/host.jsx')];
}

if (require.main === module) {
  try { for (const output of [...build(), ...buildPanel()]) console.log('Built ' + path.relative(ROOT, output)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { build, buildPanel, sourceFiles, bundleFiles, asciiEscape };
