'use strict';

// Bounded ZIP reader for inspecting ZXPSignCmd output, not a general extractor.
const { inflateRawSync } = require('node:zlib');
const MAX = 64 * 1024 * 1024;

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function readZxp(buffer) {
  if (buffer.length > MAX) throw new Error('ZXP exceeds 64 MiB');
  function bounds(offset, size) {
    if (offset < 0 || offset + size > buffer.length) throw new Error('Truncated ZIP');
  }
  let end = buffer.length - 22;
  while (end >= Math.max(0, buffer.length - 65557)) {
    if (buffer.readUInt32LE(end) === 0x06054b50 && end + 22 + buffer.readUInt16LE(end + 20) === buffer.length) break;
    end--;
  }
  if (end < Math.max(0, buffer.length - 65557)) throw new Error('Missing ZIP directory');
  if (buffer.readUInt16LE(end + 4) || buffer.readUInt16LE(end + 6)) throw new Error('Multi-disk ZIP unsupported');
  const count = buffer.readUInt16LE(end + 10), size = buffer.readUInt32LE(end + 12), start = buffer.readUInt32LE(end + 16);
  if (count !== buffer.readUInt16LE(end + 8) || count === 65535 || start + size !== end) throw new Error('Invalid ZIP directory');
  const entries = new Map(), names = new Set();
  let offset = start, total = 0;
  for (let i = 0; i < count; i++) {
    bounds(offset, 46);
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error('Invalid ZIP entry');
    const flags = buffer.readUInt16LE(offset + 8), method = buffer.readUInt16LE(offset + 10);
    const crc = buffer.readUInt32LE(offset + 16), packed = buffer.readUInt32LE(offset + 20), unpacked = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28), extra = buffer.readUInt16LE(offset + 30), comment = buffer.readUInt16LE(offset + 32);
    const local = buffer.readUInt32LE(offset + 42), mode = buffer.readUInt32LE(offset + 38) >>> 16;
    bounds(offset + 46, nameLength + extra + comment);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
    if (!name || !/^[\x20-\x7e]+$/.test(name) || name.startsWith('/') || name.includes('\\') || name.includes(':') ||
        name.replace(/\/$/, '').split('/').some(part => !part || part === '.' || part === '..') || names.has(name)) throw new Error('Unsafe or duplicate ZIP path');
    if ((mode & 0xf000) === 0xa000) throw new Error('ZIP symlinks forbidden');
    if ((flags & 1) || ![0, 8].includes(method)) throw new Error('Unsupported ZIP encoding');
    total += unpacked;
    if (total > MAX) throw new Error('Expanded ZXP exceeds 64 MiB');
    bounds(local, 30);
    if (local >= start || buffer.readUInt32LE(local) !== 0x04034b50 || buffer.readUInt16LE(local + 8) !== method || buffer.readUInt16LE(local + 6) !== flags) throw new Error('Invalid ZIP local entry');
    const localNameLength = buffer.readUInt16LE(local + 26), localExtra = buffer.readUInt16LE(local + 28);
    bounds(local + 30, localNameLength + localExtra);
    if (buffer.subarray(local + 30, local + 30 + localNameLength).toString('utf8') !== name) throw new Error('ZIP name mismatch');
    const dataOffset = local + 30 + localNameLength + localExtra;
    if (dataOffset + packed > start) throw new Error('ZIP data overlaps directory');
    bounds(dataOffset, packed);
    const compressed = buffer.subarray(dataOffset, dataOffset + packed);
    const data = method === 0 ? compressed : inflateRawSync(compressed, { maxOutputLength: Math.max(1, unpacked) });
    if (data.length !== unpacked || crc32(data) !== crc) throw new Error('ZIP size/CRC mismatch');
    names.add(name);
    if (!name.endsWith('/')) entries.set(name, data);
    else if (unpacked) throw new Error('Nonempty ZIP directory');
    offset += 46 + nameLength + extra + comment;
  }
  if (offset !== end) throw new Error('ZIP directory length mismatch');
  return entries;
}

module.exports = { readZxp, crc32 };
