/* UPC-A and QR fixtures shared by the browser and Node tests.
 * In the browser, load vendor/jsQR.js before this file. No network is needed.
 */
(function (root) {
  'use strict';

  const decoder = typeof module !== 'undefined' && module.exports
    ? require('./vendor/jsQR.js') : root.jsQR;
  const upcDigits = '036000291452';
  const upcDamagedDigits = '136000291452';
  const upcLeft = ['0001101', '0011001', '0010011', '0111101', '0100011',
    '0110001', '0101111', '0111011', '0110111', '0001011'];
  const upcRight = upcLeft.map(bits => [...bits].map(bit => bit === '1' ? '0' : '1').join(''));

  /** Return the UPC-A check digit for an 11-digit string. */
  function upcCheckDigit(first11) {
    if (typeof first11 !== 'string' || !/^\d{11}$/.test(first11)) {
      throw new Error('Expected the first 11 UPC-A digits as a string.');
    }
    const sum = [...first11].reduce((total, digit, i) => total + Number(digit) * (i % 2 ? 1 : 3), 0);
    return String((10 - sum % 10) % 10);
  }

  /** Test format and checksum; detecting an error does not identify its digit. */
  function upcValid(digits) {
    return typeof digits === 'string' && /^\d{12}$/.test(digits)
      && upcCheckDigit(digits.slice(0, 11)) === digits[11];
  }

  /** 95 black/white modules, excluding quiet zones. Allows an invalid checksum
   * so the tutorial can show a readable symbol whose digit check fails. */
  function upcPattern(digits) {
    if (typeof digits !== 'string' || !/^\d{12}$/.test(digits)) {
      throw new Error('Expected 12 UPC-A digits as a string.');
    }
    return '101' + [...digits.slice(0, 6)].map(d => upcLeft[Number(d)]).join('')
      + '01010' + [...digits.slice(6)].map(d => upcRight[Number(d)]).join('') + '101';
  }

  /** Read an ideal 95-module UPC-A pattern, then check its digits separately.
   * This is a module lookup, not an optical barcode scanner. */
  function upcReadPattern(pattern) {
    if (typeof pattern !== 'string' || !/^[01]{95}$/.test(pattern)
      || pattern.slice(0, 3) !== '101' || pattern.slice(45, 50) !== '01010'
      || pattern.slice(92) !== '101') return null;
    let digits = '';
    for (let i = 0; i < 12; i++) {
      const offset = i < 6 ? 3 + i * 7 : 50 + (i - 6) * 7;
      const digit = (i < 6 ? upcLeft : upcRight).indexOf(pattern.slice(offset, offset + 7));
      if (digit < 0) return null;
      digits += digit;
    }
    return digits;
  }

  const qrMessage = 'HELLO';
  const qrVersion = 1;
  const qrErrorCorrectionLevel = 'H';
  // Generated with qrcode-generator 1.4.4, qrcode(1, 'H'), Alphanumeric mode.
  // Reproduction: tests/generate-why-code-qr.cjs. This is a complete real QR:
  // data, RS parity, function patterns, format bits, and masking are included.
  const qrMatrix = Object.freeze([
    '111111101100101111111',
    '100000101111101000001',
    '101110101110001011101',
    '101110100110101011101',
    '101110100000001011101',
    '100000101001101000001',
    '111111101010101111111',
    '000000001001000000000',
    '001110101101011100111',
    '011011001101110101111',
    '100011101110001011001',
    '001101010010011110000',
    '100111111110110010100',
    '000000001011101001011',
    '111111100110010100101',
    '100000100101110001001',
    '101110101001010100100',
    '101110101110001100100',
    '101110101010110010100',
    '100000100011111110101',
    '111111100110100010100'
  ].map(row => Object.freeze([...row].map(bit => bit === '1'))));

  /** Render square boolean modules to RGBA pixels, with a QR quiet zone.
   * Return {data: Uint8ClampedArray, width, height} for jsQR or ImageData. */
  function qrPixels(matrix, {scale = 8, quiet = 4} = {}) {
    if (!Array.isArray(matrix) || matrix.length < 1 || matrix.length > 177
      || matrix.some(row => !Array.isArray(row) || row.length !== matrix.length
        || row.some(bit => typeof bit !== 'boolean'))) {
      throw new Error('Expected a square boolean QR matrix.');
    }
    if (!Number.isInteger(scale) || scale < 1 || scale > 32
      || !Number.isInteger(quiet) || quiet < 4 || quiet > 32) {
      throw new Error('Use an integer scale of 1–32 and a quiet zone of 4–32 modules.');
    }
    const width = (matrix.length + 2 * quiet) * scale;
    const data = new Uint8ClampedArray(width * width * 4).fill(255);
    matrix.forEach((row, r) => row.forEach((dark, c) => {
      if (!dark) return;
      for (let y = (r + quiet) * scale; y < (r + quiet + 1) * scale; y++) {
        for (let x = (c + quiet) * scale; x < (c + quiet + 1) * scale; x++) {
          const offset = (y * width + x) * 4;
          data[offset] = data[offset + 1] = data[offset + 2] = 0;
        }
      }
    }));
    return {data, width, height: width};
  }

  /** Actual image decoding, including Reed–Solomon correction inside jsQR.
   * Return a decoded string or null; never infer success from damage area. */
  function qrDecode(matrix, options) {
    if (typeof decoder !== 'function') throw new Error('The local jsQR decoder was not loaded.');
    const pixels = qrPixels(matrix, options);
    const result = decoder(pixels.data, pixels.width, pixels.height, {inversionAttempts: 'dontInvert'});
    return result ? result.data : null;
  }

  /** Deterministic module-flip presets: 'clean', 'recoverable', 'unreadable'.
   * Both damaged patches preserve every function module in this version-1 QR.
   * The outcomes describe these specific patterns, not an area-based bound.
   * Return fresh {name, matrix, changed:[{row,col}], decoded:string|null}. */
  function qrScenario(name) {
    if (!['clean', 'recoverable', 'unreadable'].includes(name)) {
      throw new Error('Unknown QR scenario.');
    }
    const matrix = qrMatrix.map(row => row.slice());
    const changed = [];
    if (name !== 'clean') {
      const start = name === 'recoverable' ? 10 : 9;
      const end = name === 'recoverable' ? 13 : 20;
      for (let row = start; row <= end; row++) {
        for (let col = start; col <= end; col++) {
          matrix[row][col] = !matrix[row][col];
          changed.push({row, col});
        }
      }
    }
    return {name, matrix, changed, decoded: qrDecode(matrix)};
  }

  const api = {upcDigits, upcDamagedDigits, upcCheckDigit, upcValid, upcPattern,
    upcReadPattern, qrMessage, qrVersion, qrErrorCorrectionLevel, qrMatrix,
    qrPixels, qrDecode, qrScenario};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WhyCode = api;
})(globalThis);
