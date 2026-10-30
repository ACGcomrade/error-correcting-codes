'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const C = require('../docs/why-code-data.js');
const Q = require('../docs/qr-code-data.js');

const clone = () => C.qrMatrix.map(row => row.slice());
assert.equal(Q.size, 21);
assert.equal(Q.dataByteCount, 9);
assert.equal(Q.parityByteCount, 17);
assert.equal(Q.correctionCapacity, 8);
assert.equal(Q.format.level, 'H');
assert.equal(Q.format.mask, 2);
assert.equal(Q.format.encoded, 0x1CE7);
assert.equal(Q.traversal.length, 208);
assert.equal(new Set(Q.traversal.map(({row, col}) => `${row},${col}`)).size, 208);
assert.deepEqual(Q.traversal.slice(0, 4).map(({row, col}) => [row, col]),
  [[20, 20], [20, 19], [19, 20], [19, 19]]);
assert.deepEqual(Q.moduleRoles.flat().reduce((counts, role) => {
  counts[role] = (counts[role] || 0) + 1;
  return counts;
}, {}), {finder: 147, separator: 45, format: 30, parity: 136, timing: 10, data: 72, dark: 1});
for (const {row, col, byteIndex} of Q.traversal) {
  assert.equal(Q.moduleRoles[row][col], byteIndex < 9 ? 'data' : 'parity');
}

// The nine data bytes contain the alphanumeric mode, length, HELLO, padding.
// Their fixed values and the RS syndromes independently check the traversal
// and unmasking; this is more than checking helper results against themselves.
assert.deepEqual(Q.originalBytes.slice(0, 9), [32, 43, 11, 120, 204, 0, 236, 17, 236]);
const bits = Q.originalBytes.slice(0, 9).map(byte => byte.toString(2).padStart(8, '0')).join('');
assert.equal(parseInt(bits.slice(0, 4), 2), 2); // Alphanumeric mode.
assert.equal(parseInt(bits.slice(4, 13), 2), 5);
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
const firstPair = parseInt(bits.slice(13, 24), 2);
const secondPair = parseInt(bits.slice(24, 35), 2);
assert.equal(alphabet[Math.floor(firstPair / 45)] + alphabet[firstPair % 45]
  + alphabet[Math.floor(secondPair / 45)] + alphabet[secondPair % 45]
  + alphabet[parseInt(bits.slice(35, 41), 2)], 'HELLO');

function multiply(a, b) {
  let product = 0;
  while (b) {
    if (b & 1) product ^= a;
    b >>>= 1;
    a <<= 1;
    if (a & 0x100) a ^= 0x11D;
  }
  return product;
}
let root = 1;
for (let i = 0; i < 17; i++) {
  const syndrome = Q.originalBytes.reduce((value, byte) => multiply(value, root) ^ byte, 0);
  assert.equal(syndrome, 0, `RS parity must vanish at alpha^${i}`);
  root = multiply(root, 2);
}

// Every sampled module maps to the correct bit of exactly one byte, without
// accidentally applying the mask twice or including a function-pattern cell.
for (const {row, col, byteIndex, bitIndex} of Q.traversal) {
  const matrix = clone();
  matrix[row][col] = !matrix[row][col];
  const expected = Q.originalBytes.slice();
  expected[byteIndex] ^= 1 << (7 - bitIndex);
  assert.deepEqual(Q.readBytes(matrix), expected);
}

// Check the format-driven mask selection by independently re-masking the
// symbol and writing the standard H format codewords. The genuine image
// decoder must still read HELLO for every mask.
const hFormats = [0x1689, 0x13BE, 0x1CE7, 0x19D0, 0x0762, 0x0255, 0x0D0C, 0x083B];
function writeFormat(matrix, encoded) {
  for (let i = 0; i < 15; i++) {
    const bit = Boolean((encoded >>> i) & 1);
    const row = i < 6 ? i : i < 8 ? i + 1 : 21 - 15 + i;
    matrix[row][8] = bit;
    const col = i < 8 ? 20 - i : i < 9 ? 15 - i : 14 - i;
    matrix[8][col] = bit;
  }
}
for (let mask = 0; mask < 8; mask++) {
  const matrix = clone();
  Q.traversal.forEach(({row, col, byteIndex, bitIndex}) => {
    const bit = Boolean((Q.originalBytes[byteIndex] >>> (7 - bitIndex)) & 1);
    matrix[row][col] = bit !== Q.maskAt(mask, row, col);
  });
  writeFormat(matrix, hFormats[mask]);
  assert.equal(Q.readFormat(matrix).mask, mask);
  assert.deepEqual(Q.readBytes(matrix), Q.originalBytes);
  assert.equal(C.qrDecode(matrix), 'HELLO');
}

const expected = {clean: [0, 0, 'HELLO'], recoverable: [16, 6, 'HELLO'], unreadable: [144, 18, null]};
for (const [name, [flips, errors, decoded]] of Object.entries(expected)) {
  const scenario = Q.scenario(name);
  assert.equal(scenario.changed.length, flips);
  assert.equal(scenario.errorBits.length, flips);
  assert.equal(scenario.errorByteCount, errors);
  assert.equal(scenario.errorByteIndices.length, errors);
  assert.equal(scenario.decoded, decoded);
  assert.equal(scenario.correctable, decoded !== null);
  assert.deepEqual(scenario.correctedBytes, decoded ? Q.originalBytes : null);
  for (const {row, col} of scenario.changed) {
    assert.ok(['data', 'parity'].includes(Q.moduleRoles[row][col]), 'Presets must preserve all function modules.');
  }
  for (const scale of [4, 8, 12]) assert.equal(C.qrDecode(scenario.matrix, {scale}), decoded);
  scenario.matrix[0][0] = false;
  scenario.originalBytes[0] = 0;
  assert.equal(C.qrMatrix[0][0], true, 'Scenario editing must not change the fixture.');
  assert.equal(Q.originalBytes[0], 32);
}
assert.deepEqual(Q.scenario('recoverable').errorByteIndices, [3, 4, 7, 8, 9, 10]);
assert.equal(C.qrScenario('recoverable').decoded, 'HELLO', 'The legacy preset remains available.');

// Actual image decoding at the RS bound: eight corrupt codewords in one
// version-1/H block. The decoder receives no list of the corrupted positions.
const boundary = clone();
for (const {row, col, byteIndex} of Q.traversal) {
  if (byteIndex >= 1 && byteIndex <= 8) boundary[row][col] = !boundary[row][col];
}
assert.equal(Q.readBytes(boundary).filter((byte, index) => byte !== Q.originalBytes[index]).length, 8);
assert.equal(C.qrDecode(boundary), 'HELLO');
assert.throws(() => Q.scenario('unknown'));
assert.throws(() => Q.readBytes([[true]]));
assert.throws(() => Q.maskAt(8, 0, 0));

// Run the exact no-build, offline browser-global dependency order.
const browser = vm.createContext({Uint8ClampedArray});
for (const file of ['vendor/jsQR.js', 'why-code-data.js', 'qr-code-data.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../docs', file), 'utf8'), browser, {filename: file});
}
assert.equal(browser.QRCodeData.scenario('recoverable').decoded, 'HELLO');
assert.equal(browser.QRCodeData.scenario('unreadable').correctedBytes, null);
console.log('Passed: QR roles/traversal, 208 bit mappings, 8 real mask decodes, 17 RS syndromes, HELLO payload, 3 scenario scales, 8-byte correction bound, and browser-global loading.');
