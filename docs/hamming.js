/* Pure functions shared by the browser and the Node tests. No dependencies. */
(function (root) {
  'use strict';
  const H = [[0,0,0,1,1,1,1], [0,1,1,0,0,1,1], [1,0,1,0,1,0,1]];
  const dataPositions = [3,5,6,7];
  const checkPositions = [1,2,4];
  const MAX_DATA_BITS = 16384;
  const xor = values => values.reduce((a,b) => a ^ b, 0);
  const multiply = (matrix, vector) => matrix.map(row => xor(row.map((v,i) => v * vector[i])));
  function bits(values, length) {
    if (!Array.isArray(values) || values.length !== length || values.some(v => v !== 0 && v !== 1)) {
      throw new Error(`Expected ${length} binary values.`);
    }
  }
  function encode(data) {
    bits(data, 4);
    const c = Array(7).fill(0);
    dataPositions.forEach((p,i) => { c[p - 1] = data[i]; });
    checkPositions.forEach(p => { c[p - 1] = xor(c.filter((_,i) => ((i + 1) & p) !== 0)); });
    return c;
  }
  function decode(received) {
    bits(received, 7);
    const syndrome = multiply(H, received);
    const position = syndrome.reduce((a,b) => a * 2 + b, 0);
    const corrected = received.slice();
    if (position) corrected[position - 1] ^= 1;
    return {syndrome, position, corrected, data: dataPositions.map(p => corrected[p - 1])};
  }
  function prepare(input) {
    const compact = input.replace(/\s/g, '');
    if (!/^[01]+$/.test(compact)) throw new Error('Enter at least one bit. Use only 0, 1 and whitespace.');
    if (compact.length > MAX_DATA_BITS) throw new Error('Use no more than 16,384 data bits.');
    const padding = (4 - compact.length % 4) % 4;
    const padded = compact + '0'.repeat(padding);
    const blocks = [];
    for (let i = 0; i < padded.length; i += 4) blocks.push([...padded.slice(i,i + 4)].map(Number));
    return {compact, padding, blocks};
  }
  function sample(probability, random = Math.random) {
    if (!Number.isFinite(probability) || probability < 0 || probability > 1) throw new Error('Flip probability must be between 0% and 100%.');
    return Array.from({length: 7}, () => Number(random() < probability));
  }
  function transmit(codeword, error) {
    bits(codeword, 7); bits(error, 7);
    return codeword.map((v,i) => v ^ error[i]);
  }
  const api = {H, dataPositions, checkPositions, MAX_DATA_BITS, xor, multiply, encode, decode, prepare, sample, transmit};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Hamming = api;
})(globalThis);
