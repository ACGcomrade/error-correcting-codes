'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const C = require('../docs/why-code-data.js');
const jsQR = require('../docs/vendor/jsQR.js');

assert.equal(C.upcCheckDigit('03600029145'), '2');
assert.equal(C.upcValid(C.upcDigits), true);
assert.equal(C.upcValid(C.upcDamagedDigits), false);
assert.equal(C.upcCheckDigit(C.upcDamagedDigits.slice(0, 11)), '9');
assert.equal(C.upcCheckDigit('00000000000'), '0');

// The check digit catches every single-digit substitution, including itself.
let substitutions = 0;
for (let position = 0; position < 12; position++) {
  for (let replacement = 0; replacement < 10; replacement++) {
    if (String(replacement) === C.upcDigits[position]) continue;
    const digits = C.upcDigits.slice(0, position) + replacement + C.upcDigits.slice(position + 1);
    assert.equal(C.upcValid(digits), false);
    assert.equal(C.upcReadPattern(C.upcPattern(digits)), digits);
    substitutions++;
  }
}
const pattern = C.upcPattern(C.upcDigits);
assert.equal(pattern.length, 95);
assert.equal(pattern.slice(3, 10), '0001101'); // left-side zero
assert.equal(pattern.slice(85, 92), '1101100'); // right-side two
assert.equal(C.upcReadPattern(pattern), C.upcDigits);
assert.equal(C.upcReadPattern('001' + pattern.slice(3)), null);
assert.equal(C.upcReadPattern('101' + '0000000' + pattern.slice(10)), null);
// The rule does not catch all multiple-digit errors (0<->5 in adjacent places).
assert.equal(C.upcValid('050000000005'), true);
assert.equal(C.upcValid('500000000005'), true);
for (const input of [null, 36000291452, '', '03600029145', '03600029145x', '036000291452\n']) {
  assert.equal(C.upcValid(input), false);
}
assert.throws(() => C.upcCheckDigit('123'));
assert.throws(() => C.upcPattern('123'));

const baseline = C.qrMatrix.map(row => row.slice());
assert.equal(C.qrVersion, 1);
assert.equal(C.qrErrorCorrectionLevel, 'H');
assert.equal(C.qrMatrix.length, 21);
const expected = {clean: ['HELLO', 0], recoverable: ['HELLO', 16], unreadable: [null, 144]};
for (const [name, [message, count]] of Object.entries(expected)) {
  const scenario = C.qrScenario(name);
  assert.equal(scenario.decoded, message);
  assert.equal(scenario.changed.length, count);
  const changed = new Set(scenario.changed.map(({row, col}) => `${row},${col}`));
  scenario.matrix.forEach((row, r) => row.forEach((bit, c) => {
    assert.equal(bit !== baseline[r][c], changed.has(`${r},${c}`));
  }));
  // Version 1 has no alignment pattern. Every changed cell is below/right of
  // all finder, separator, timing, format, and fixed-dark modules.
  assert.equal(scenario.changed.every(({row, col}) => row >= 9 && col >= 9), true);
  for (const scale of [4, 8, 12]) {
    const pixels = C.qrPixels(scenario.matrix, {scale});
    const read = jsQR(pixels.data, pixels.width, pixels.height, {inversionAttempts: 'dontInvert'});
    assert.equal(read ? read.data : null, message, `${name} must decode from pixels at scale ${scale}`);
    if (read) assert.equal(read.version, 1);
    assert.equal(pixels.data.length, pixels.width * pixels.height * 4);
    assert.equal(pixels.data.slice(0, pixels.width * 4 * 4 * scale).every(value => value === 255), true);
  }
  scenario.matrix[0][0] = !scenario.matrix[0][0];
  assert.deepEqual(C.qrMatrix, baseline, 'Scenario edits must not change the clean fixture.');
}
assert.throws(() => C.qrScenario('random'));
assert.throws(() => C.qrPixels([[true, false]]));
assert.throws(() => C.qrPixels(C.qrMatrix, {scale: 0}));
assert.throws(() => C.qrPixels(C.qrMatrix, {quiet: 0}));

// Exercise the same script-global loading order used by the static page.
const browser = vm.createContext({Uint8ClampedArray});
for (const file of ['vendor/jsQR.js', 'why-code-data.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../docs', file), 'utf8'), browser, {filename: file});
}
assert.equal(browser.WhyCode.upcValid(C.upcDigits), true);
assert.equal(browser.WhyCode.qrScenario('recoverable').decoded, 'HELLO');
assert.equal(browser.WhyCode.qrScenario('unreadable').decoded, null);
console.log(`Passed: ${substitutions} UPC-A substitutions, module round-trips, QR recovery/failure at 3 raster scales, and browser-global loading.`);
