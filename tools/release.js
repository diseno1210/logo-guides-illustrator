'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { build, buildPanel } = require('./build');
const { checkSource } = require('./check_es3');
const { readZxp } = require('./zxp');
const ROOT = path.resolve(__dirname, '..');
const PANEL_FILES = Object.freeze([
  'CSXS/manifest.xml', 'css/panel.css', 'host/host.jsx', 'index.html',
  'js/ai.js', 'js/app.js', 'js/controller.js', 'js/core.js', 'js/model.js',
  'vendor/Adobe-SDK-License.pdf', 'vendor/CSInterface.js'
].sort());
const SCRIPT_FILES = Object.freeze([
  'LogoGuides_CircleFromSelection.jsx', 'LogoGuides_Clear.jsx', 'LogoGuides_DumpGeometry.jsx',
  'LogoGuides_Generate.jsx', 'LogoGuides_Refresh.jsx', 'LogoGuides_SetBaseUnit.jsx'
]);
const SIGNER_SOURCE = 'https://github.com/Adobe-CEP/CEP-Resources/tree/ab5e4e3e53a42fad08e1225a22a991bb1ffe73f6/ZXPSignCMD/4.1.3';
const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');

function filesIn(directory, prefix = '') {
  const result = [];
  for (const name of fs.readdirSync(directory).sort()) {
    const relative = prefix + name, full = path.join(directory, name), stat = fs.lstatSync(full);
    if (stat.isSymbolicLink()) throw new Error('Symbolic links forbidden: ' + relative);
    if (stat.isDirectory()) result.push(...filesIn(full, relative + '/'));
    else if (stat.isFile()) result.push(relative);
    else throw new Error('Non-regular release file: ' + relative);
  }
  return result.sort();
}

function requireFiles(directory, allowed) {
  if (JSON.stringify(filesIn(directory)) !== JSON.stringify([...allowed].sort())) throw new Error('Release file list mismatch');
}

function validatePanel(directory, version) {
  requireFiles(directory, PANEL_FILES);
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Invalid release version');
  const manifest = fs.readFileSync(path.join(directory, 'CSXS/manifest.xml'), 'utf8');
  const bundle = manifest.match(/ExtensionBundleVersion="([^"]+)"/);
  const extension = manifest.match(/<Extension Id="local\.logoguides\.panel" Version="([^"]+)"/);
  const core = fs.readFileSync(path.join(directory, 'js/core.js'), 'utf8');
  const host = fs.readFileSync(path.join(directory, 'host/host.jsx'), 'utf8');
  if (!bundle || !extension || bundle[1] !== version || extension[1] !== version ||
      !core.includes('LG.version = "' + version + '";') || !host.includes('LG.version = "' + version + '";')) throw new Error('Release version mismatch');
  if (!manifest.includes('Name="ILST" Version="[25.0,99.9]"') || !manifest.includes('Name="CSXS" Version="11.0"') ||
      !manifest.includes('<ScriptPath>./host/host.jsx</ScriptPath>')) throw new Error('Unexpected CEP contract');
  const flags = [...manifest.matchAll(/<Parameter>(.*?)<\/Parameter>/g)].map(match => match[1]);
  if (JSON.stringify(flags) !== JSON.stringify(['--enable-nodejs', '--mixed-context'])) throw new Error('Unexpected CEF flags');
  for (const name of ['js/core.js', 'js/model.js', 'host/host.jsx']) {
    const source = fs.readFileSync(path.join(directory, name), 'utf8');
    if (checkSource(source, name).length) throw new Error('Release ES3 check failed: ' + name);
    if (name.endsWith('.jsx') && /[^\x00-\x7f]/.test(source)) throw new Error('Release JSX must be ASCII');
  }
  return PANEL_FILES.map(name => ({ path: name, bytes: fs.statSync(path.join(directory, name)).size, sha256: sha256(fs.readFileSync(path.join(directory, name))) }));
}

function signerRun(executable, args) {
  const env = { ...process.env };
  delete env.LG_CERT_PASSWORD;
  return spawnSync(executable, args, { encoding: 'utf8', windowsHide: true, timeout: 60000, maxBuffer: 1024 * 1024, env });
}

function checkedRun(signer, args, expected, run = signerRun) {
  const result = run(signer, args);
  // Do not forward tool output/errors: a failed tool may echo password arguments.
  if (result.error || result.status !== 0 || !(result.stdout || '').includes(expected)) throw new Error('ZXPSignCmd ' + args[0] + ' failed (tool output withheld)');
  return result.stdout.trim();
}

function verifyPackage(signer, zxp, run = signerRun) {
  checkedRun(signer, ['-verify', zxp], 'Signature verified successfully', run);
  return checkedRun(signer, ['-verify', zxp, '-certInfo', '-skipOnlineRevocationChecks'], 'Signature verified successfully', run);
}

function validateArchive(zxp, panel) {
  const entries = readZxp(fs.readFileSync(zxp));
  const expected = [...PANEL_FILES, 'mimetype', 'META-INF/signatures.xml'].sort();
  if (JSON.stringify([...entries.keys()].sort()) !== JSON.stringify(expected)) throw new Error('Signed archive file list mismatch');
  if (entries.get('mimetype').toString() !== 'application/vnd.adobe.air-ucf-package+zip') throw new Error('Unexpected ZXP mimetype');
  if (!entries.get('META-INF/signatures.xml').length) throw new Error('Missing signature');
  for (const name of PANEL_FILES) {
    if (!entries.get(name).equals(fs.readFileSync(path.join(panel, name)))) throw new Error('Signed archive content mismatch: ' + name);
  }
  return [...entries].map(([name, data]) => ({ path: name, bytes: data.length, sha256: sha256(data) })).sort((a,b) => a.path.localeCompare(b.path));
}

function createCertificate({ signer, certificate, password, run = signerRun }) {
  if (!password || password.length < 16) throw new Error('Certificate password must have at least 16 characters');
  if (fs.existsSync(certificate)) throw new Error('Certificate already exists; refusing overwrite');
  fs.mkdirSync(path.dirname(certificate), { recursive: true });
  try {
    checkedRun(signer, ['-selfSignedCert', 'CN', 'Local', 'Logo Guides', 'Logo Guides Local', password, certificate, '-validityDays', '3650'], 'Self-signed certificate generated successfully', run);
    if (!fs.statSync(certificate).size) throw new Error('Empty certificate');
    if (process.platform !== 'win32') fs.chmodSync(certificate, 0o600);
  } catch (error) { fs.rmSync(certificate, { force: true }); throw error; }
}

function createRelease({ signer, certificate, password, tsa, noTimestamp = false, output, run = signerRun }) {
  if (!password || !fs.statSync(certificate).isFile()) throw new Error('Certificate/password required');
  if (!tsa && !noTimestamp) throw new Error('Specify --tsa HTTPS_URL or explicitly --no-timestamp');
  if (tsa) {
    const url = new URL(tsa);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('Invalid timestamp URL');
  }
  const version = require('../package.json').version;
  const lock = JSON.parse(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8'));
  if (lock.version !== version || lock.packages[''].version !== version) throw new Error('Lockfile version mismatch');
  const destination = path.resolve(output || path.join(ROOT, 'dist/releases', 'logo-guides-' + version + '-' + process.platform));
  if (fs.existsSync(destination)) throw new Error('Release destination exists; use a new --out directory');
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  // All recursive cleanup targets are fixed, newly created temp directories.
  const working = fs.mkdtempSync(path.join(os.tmpdir(), 'logo-guides-sign-'));
  const delivery = fs.mkdtempSync(path.join(path.dirname(destination), '.logo-guides-delivery-'));
  try {
    const panel = path.join(working, 'panel'), scripts = path.join(delivery, 'scripts');
    build(scripts); buildPanel(panel);
    requireFiles(scripts, SCRIPT_FILES);
    const panelFiles = validatePanel(panel, version);
    const name = 'logo-guides-' + version + '-' + process.platform + '.zxp', zxp = path.join(delivery, name);
    const args = ['-sign', panel, zxp, certificate, password];
    if (tsa) args.push('-tsa', tsa);
    checkedRun(signer, args, 'Signed successfully', run);
    const verification = verifyPackage(signer, zxp, run);
    const archiveFiles = validateArchive(zxp, panel);
    for (const file of ['INSTALLATION.md', 'USER_GUIDE.md', 'CHANGELOG.md']) fs.copyFileSync(path.join(ROOT, 'docs', file), path.join(delivery, file));
    const git = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8', windowsHide: true });
    const dirty = spawnSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8', windowsHide: true });
    if (git.status !== 0 || dirty.status !== 0) throw new Error('Cannot record Git provenance');
    const report = {
      version, milestone: 'M9', status: 'pending-clean-machine', platform: process.platform,
      createdAt: new Date().toISOString(), sourceCommit: git.stdout.trim(), sourceDirty: !!dirty.stdout.trim(),
      signer: { source: SIGNER_SOURCE, sha256: sha256(fs.readFileSync(signer)) },
      certificateSha256: sha256(fs.readFileSync(certificate)),
      timestampUrl: tsa || null, verification, revocationChecks: 'skipped for certificate details; not asserted',
      zxp: { path: name, sha256: sha256(fs.readFileSync(zxp)), files: archiveFiles }, panelFiles
    };
    fs.writeFileSync(path.join(delivery, 'release.json'), JSON.stringify(report, null, 2) + '\n');
    const checksums = filesIn(delivery).map(file => sha256(fs.readFileSync(path.join(delivery, file))) + '  ' + file).join('\n') + '\n';
    fs.writeFileSync(path.join(delivery, 'SHA256SUMS'), checksums);
    fs.renameSync(delivery, destination);
    return { directory: destination, ...report };
  } finally {
    fs.rmSync(working, { recursive: true, force: true });
    fs.rmSync(delivery, { recursive: true, force: true });
  }
}

function main(args) {
  const command = args.shift(), options = {};
  while (args.length) {
    const key = args.shift();
    if (key === '--no-timestamp') options.noTimestamp = true;
    else if (['--out', '--tsa'].includes(key) && args.length) options[key === '--out' ? 'output' : 'tsa'] = args.shift();
    else throw new Error('Unknown or missing release option');
  }
  const signer = process.env.LG_ZXP_SIGNER;
  if (!signer || !path.isAbsolute(signer)) throw new Error('Set LG_ZXP_SIGNER to the absolute official ZXPSignCmd path');
  const certificate = process.env.LG_CERT_PATH || path.join(ROOT, '.cache/signing/logo-guides.p12');
  const password = process.env.LG_CERT_PASSWORD;
  if (command === 'cert') { createCertificate({ signer, certificate, password }); console.log('Certificate created locally'); }
  else if (command === 'pack') { const report = createRelease({ signer, certificate, password, ...options }); console.log('Signed and verified: ' + report.directory); }
  else if (command === 'verify' && options.output) {
    verifyPackage(signer, path.resolve(options.output));
    console.log('Signature verified; clean-machine acceptance is separate');
  } else throw new Error('Usage: release.js cert | pack [--tsa URL | --no-timestamp] [--out DIR] | verify --out FILE.zxp');
}

if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { PANEL_FILES, SCRIPT_FILES, SIGNER_SOURCE, sha256, filesIn, requireFiles, validatePanel, checkedRun, verifyPackage, validateArchive, createCertificate, createRelease };
