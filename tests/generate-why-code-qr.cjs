'use strict';
// Optional fixture reproduction; normal tests do not need an encoder package.
// Download qrcode-generator@1.4.4/qrcode.js from the package's npm distribution
// to a temporary path, then run:
// node tests/generate-why-code-qr.cjs /absolute/path/to/qrcode.js
// Source: https://github.com/kazuhikoarase/qrcode-generator (MIT license).
const assert = require('node:assert/strict');
const path = require('node:path');
if (!process.argv[2]) throw new Error('Pass the path to qrcode-generator 1.4.4/qrcode.js.');
const qrcode = require(path.resolve(process.argv[2]));
const C = require('../docs/why-code-data.js');
const qr = qrcode(C.qrVersion, C.qrErrorCorrectionLevel);
qr.addData(C.qrMessage, 'Alphanumeric');
qr.make();
const matrix = Array.from({length: qr.getModuleCount()}, (_, row) =>
  Array.from({length: qr.getModuleCount()}, (_, col) => qr.isDark(row, col)));
assert.deepEqual(matrix, C.qrMatrix, 'Regenerated QR must match the shipped fixture.');
console.log(matrix.map(row => `'${row.map(Number).join('')}'`).join(',\n'));
