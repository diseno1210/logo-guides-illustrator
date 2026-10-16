'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// Expand file names ourselves: node 20 / Windows shells do not all expand globs.
const directory = path.join(__dirname, 'test');
const files = fs.readdirSync(directory).filter(name => name.endsWith('.test.js')).sort()
  .map(name => path.join(directory, name));
if (!files.length) throw new Error('No test files found');
// Serial files keep the specified300ms F10 CPU measurement free of other test workers.
const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...files], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status === null ? 1 : result.status;
