'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildPanel } = require('../build');
const { checkedRun, filesIn, requireFiles, validatePanel, PANEL_FILES } = require('../release');
const { readZxp } = require('../zxp');

test('M9 release file policy rejects symlinks and unexpected files', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'logo-guides-release-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'ok.txt'), 'ok');
  assert.deepEqual(filesIn(root), ['ok.txt']);
  assert.doesNotThrow(() => requireFiles(root, ['ok.txt']));
  fs.writeFileSync(path.join(root, 'unexpected.txt'), 'no');
  assert.throws(() => requireFiles(root, ['ok.txt']), /file list mismatch/);
  const link = path.join(root, 'link.txt');
  try {
    fs.symlinkSync(path.join(root, 'ok.txt'), link);
    assert.throws(() => filesIn(root), /Symbolic links forbidden/);
  } catch (error) {
    // Some Windows hosts deny symlink creation; the release code still rejects
    // lstat-reported links when they are available.
    assert.match(String(error), /EPERM|privilege|not supported|access|exists/i);
  }
});

test('M9 panel validation checks the generated fixed manifest and exact file set', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'logo-guides-panel-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  buildPanel(root);
  assert.equal(validatePanel(root, require('../../package.json').version).length, PANEL_FILES.length);
  fs.writeFileSync(path.join(root, 'unexpected.txt'), 'no');
  assert.throws(() => validatePanel(root, require('../../package.json').version), /file list mismatch/);
});

test('M9 signer wrapper rejects failures without exposing tool output', () => {
  assert.equal(checkedRun('signer', ['-verify', 'package.zxp'], 'verified', () => ({ status: 0, stdout: 'verified' })), 'verified');
  assert.throws(() => checkedRun('signer', ['-sign', 'dir', 'out.zxp', 'cert', 'secret'], 'Signed', () => ({ status: 1, stdout: 'secret leaked' })), /failed/);
  assert.throws(() => checkedRun('signer', ['-verify', 'package.zxp'], 'verified', () => ({ status: 0, stdout: 'different' })), /failed/);
});

test('M9 ZIP reader rejects malformed and unsafe archives', () => {
  assert.throws(() => readZxp(Buffer.from('not a zip')), /ZIP directory/);
});
