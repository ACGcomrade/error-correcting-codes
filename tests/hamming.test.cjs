'use strict';
const assert = require('node:assert/strict');
const C = require('../docs/hamming.js');
const bits = (n,length) => [...n.toString(2).padStart(length,'0')].map(Number);
const zero = [0,0,0];
let checked = 0;

// Exhaust all messages and all 128 error patterns, including every multi-bit error.
for (let value = 0; value < 16; value++) {
  const data = bits(value,4), code = C.encode(data);
  assert.deepEqual(C.multiply(C.H,code),zero);
  assert.deepEqual(C.dataPositions.map(p => code[p - 1]),data);
  for (let mask = 0; mask < 128; mask++) {
    const error = bits(mask,7), weight = error.reduce((a,b) => a+b,0);
    const received = C.transmit(code,error), before = received.slice();
    const result = C.decode(received);
    assert.deepEqual(received,before, 'decode must not mutate input');
    assert.deepEqual(result.syndrome,C.multiply(C.H,error));
    assert.deepEqual(C.multiply(C.H,result.corrected),zero);
    assert.equal(result.corrected.join('') === code.join(''),weight <= 1);
    assert.equal(result.data.join('') === data.join(''),weight <= 1);
    if (weight === 1) assert.equal(result.position,error.indexOf(1) + 1);
    if (weight === 2) assert.notEqual(result.position,0,'all double errors must be detected before correction');
    checked++;
  }
}

const code = C.encode([1,0,1,1]);
assert.deepEqual(code,[0,1,1,0,0,1,1]);
assert.deepEqual(C.decode(C.transmit(code,[0,0,0,0,0,1,0])).syndrome,[1,1,0]);
assert.equal(C.decode(C.transmit(code,[1,1,0,0,0,0,0])).position,3);
assert.deepEqual(C.decode(C.transmit(code,[1,1,1,0,0,0,0])).syndrome,zero);
assert.deepEqual(C.sample(0,() => 0),Array(7).fill(0));
assert.deepEqual(C.sample(1,() => 0.999999),Array(7).fill(1));
const draws = [0.1,0.8,0.3,0.4,0.2,0.9,0.01];
assert.deepEqual(C.sample(0.3,() => draws.shift()),[1,0,0,0,1,0,1]);
for (const q of [-1,1.1,NaN,Infinity]) assert.throws(() => C.sample(q));
assert.deepEqual(C.prepare(' 10 11\n1 '),{compact:'10111',padding:3,blocks:[[1,0,1,1],[1,0,0,0]]});
for (const input of ['', ' ', '101x', '你好', '0'.repeat(C.MAX_DATA_BITS + 1)]) assert.throws(() => C.prepare(input));
for (const length of [1,3,4,5,11,1024,1025,C.MAX_DATA_BITS - 1,C.MAX_DATA_BITS]) {
  const prepared = C.prepare('1'.repeat(length));
  const decoded = prepared.blocks.flatMap(data => C.decode(C.encode(data)).data);
  assert.equal(decoded.join('').slice(0,length),prepared.compact);
}
assert.throws(() => C.encode([1,0,2,1]));
assert.throws(() => C.decode([1]));
console.log(`Passed: ${checked} message/error combinations, tutorial examples, probability boundaries, validation and padding.`);
