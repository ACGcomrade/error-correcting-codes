/* Version-1/H QR walkthrough data. Load WhyCode (and its local jsQR) first.
 * Function regions, format bits, masks, and zigzag order follow the QR reader:
 * https://github.com/cozmo/jsQR/blob/master/src/decoder/decoder.ts
 * This helper exposes the bytes before decoding; jsQR performs the actual
 * image decoding and Reed–Solomon correction through WhyCode.qrDecode().
 */
(function (root) {
  'use strict';

  const C = typeof module !== 'undefined' && module.exports
    ? require('./why-code-data.js') : root.WhyCode;
  const size = 21;
  const dataByteCount = 9;
  const parityByteCount = 17;
  const correctionCapacity = Math.floor(parityByteCount / 2);
  const moduleRoles = Array.from({length: size}, () => Array(size).fill('data'));
  const formatCopies = [[], []];

  function mark(row, col, height, width, role) {
    for (let r = row; r < row + height; r++) {
      for (let c = col; c < col + width; c++) moduleRoles[r][c] = role;
    }
  }

  // A version-1 symbol has three finder patterns and no alignment patterns.
  mark(0, 0, 8, 8, 'separator');
  mark(0, 13, 8, 8, 'separator');
  mark(13, 0, 8, 8, 'separator');
  mark(0, 0, 7, 7, 'finder');
  mark(0, 14, 7, 7, 'finder');
  mark(14, 0, 7, 7, 'finder');
  mark(6, 8, 1, 5, 'timing');
  mark(8, 6, 5, 1, 'timing');
  mark(13, 8, 1, 1, 'dark');

  // The two 15-bit format copies are listed most-significant bit first.
  for (let col = 0; col <= 8; col++) if (col !== 6) formatCopies[0].push({row: 8, col});
  for (let row = 7; row >= 0; row--) if (row !== 6) formatCopies[0].push({row, col: 8});
  for (let row = 20; row >= 14; row--) formatCopies[1].push({row, col: 8});
  for (let col = 13; col <= 20; col++) formatCopies[1].push({row: 8, col});
  formatCopies.flat().forEach(({row, col}) => { moduleRoles[row][col] = 'format'; });

  const traversal = [];
  let upward = true;
  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right--; // Skip the vertical timing column.
    for (let step = 0; step < size; step++) {
      const row = upward ? size - 1 - step : step;
      for (let offset = 0; offset < 2; offset++) {
        const col = right - offset;
        if (moduleRoles[row][col] !== 'data') continue;
        const index = traversal.length;
        traversal.push({row, col, index, byteIndex: Math.floor(index / 8), bitIndex: index % 8});
      }
    }
    upward = !upward;
  }
  // Version 1/H uses one RS block: 9 data bytes followed by 17 parity bytes.
  traversal.forEach(({row, col, byteIndex}) => {
    if (byteIndex >= dataByteCount) moduleRoles[row][col] = 'parity';
  });

  function validateMatrix(matrix) {
    if (!Array.isArray(matrix) || matrix.length !== size || matrix.some(row =>
      !Array.isArray(row) || row.length !== size || row.some(bit => typeof bit !== 'boolean'))) {
      throw new Error('Expected a version-1, 21 × 21 boolean QR matrix.');
    }
  }

  function formatCode(data) {
    let remainder = data << 10;
    for (let bit = 14; bit >= 10; bit--) {
      if (remainder & (1 << bit)) remainder ^= 0x537 << (bit - 10);
    }
    return ((data << 10) | remainder) ^ 0x5412;
  }

  function bitCount(value) {
    let count = 0;
    while (value) { value &= value - 1; count++; }
    return count;
  }

  function readFormat(matrix) {
    validateMatrix(matrix);
    const copies = formatCopies.map(copy => copy.reduce((value, {row, col}) =>
      (value << 1) | Number(matrix[row][col]), 0));
    let best = null;
    for (let data = 0; data < 32; data++) {
      const encoded = formatCode(data);
      const distance = Math.min(...copies.map(bits => bitCount(bits ^ encoded)));
      if (!best || distance < best.distance) {
        best = {mask: data & 7, level: ['M', 'L', 'H', 'Q'][data >> 3], distance, encoded};
      }
    }
    if (best.distance > 3) throw new Error('The QR format information could not be read.');
    return best;
  }

  function maskAt(mask, row, col) {
    switch (mask) {
      case 0: return (row + col) % 2 === 0;
      case 1: return row % 2 === 0;
      case 2: return col % 3 === 0;
      case 3: return (row + col) % 3 === 0;
      case 4: return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0;
      case 5: return (row * col) % 2 + (row * col) % 3 === 0;
      case 6: return ((row * col) % 2 + (row * col) % 3) % 2 === 0;
      case 7: return ((row + col) % 2 + (row * col) % 3) % 2 === 0;
      default: throw new Error('Expected a QR mask index from 0 to 7.');
    }
  }

  function readBytes(matrix) {
    const format = readFormat(matrix);
    const bytes = Array(dataByteCount + parityByteCount).fill(0);
    traversal.forEach(({row, col, byteIndex}) => {
      const bit = matrix[row][col] !== maskAt(format.mask, row, col);
      bytes[byteIndex] = (bytes[byteIndex] << 1) | Number(bit);
    });
    return bytes;
  }

  const format = Object.freeze(readFormat(C.qrMatrix));
  const originalBytes = Object.freeze(readBytes(C.qrMatrix));

  function scenario(name) {
    let result;
    if (name === 'recoverable') {
      // This patch affects both payload and parity bytes while preserving all
      // function modules. Keep the older WhyCode demo's presets unchanged.
      const matrix = C.qrMatrix.map(row => row.slice());
      const changed = [];
      for (let row = 10; row <= 13; row++) {
        for (let col = 14; col <= 17; col++) {
          matrix[row][col] = !matrix[row][col];
          changed.push({row, col});
        }
      }
      result = {name, matrix, changed, decoded: C.qrDecode(matrix)};
    } else result = C.qrScenario(name);
    const bytes = readBytes(result.matrix);
    const errorByteIndices = bytes.flatMap((byte, index) => byte === originalBytes[index] ? [] : [index]);
    const errorBits = traversal.filter(({row, col}) => result.matrix[row][col] !== C.qrMatrix[row][col]);
    const correctable = result.decoded === C.qrMessage;
    return {
      ...result,
      format: readFormat(result.matrix),
      readBytes: bytes,
      originalBytes: originalBytes.slice(),
      // jsQR exposes decoded payload, not corrected parity bytes. These values
      // are the known transmitted fixture, shown only after successful real
      // decoding. They are a before/after teaching reference, not a trace of
      // the decoder's internal RS algorithm or positions it knew in advance.
      correctedBytes: correctable ? originalBytes.slice() : null,
      correctionSource: 'known-clean-fixture-after-successful-jsQR-decode',
      errorByteIndices,
      errorByteCount: errorByteIndices.length,
      errorBits,
      correctable
    };
  }

  moduleRoles.forEach(Object.freeze);
  Object.freeze(moduleRoles);
  traversal.forEach(Object.freeze);
  Object.freeze(traversal);
  const api = {size, dataByteCount, parityByteCount, correctionCapacity,
    moduleRoles, traversal, format, originalBytes, readFormat, maskAt, readBytes, scenario};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.QRCodeData = api;
})(globalThis);
