/* Rendering follows the notation and high-bit-first row order in the tutorial. */
'use strict';
const C = Hamming;
const $ = id => document.getElementById(id);
let state = {step:0, mode:'guided', block:0, message:null, errors:[], sources:[], probability:0.1};
const phaseStarts = [0,1,4,5,6,9,11];
const phaseNames = ['place','parity','verify','noise','syndrome','correct','read'];
const titles = ['Place the data','Solve c₁','Solve c₂','Solve c₄','Verify the codeword','Add noise','Check row 1','Check row 2','Check row 3','Locate the error','Apply correction','Read the message'];
const H = C.H;
const column = values => values.map(v => [v]);
const fmt = values => values.join('');
const eq = (a,b) => fmt(a) === fmt(b);
const mark = text => `<mark>${text}</mark>`;
const bitName = p => `c<sub>${p}</sub>`;

function context() {
  const data = state.message.blocks[state.block];
  const code = C.encode(data);
  const error = state.errors[state.block];
  const received = C.transmit(code, error);
  const {data:decodedData, ...decoded} = C.decode(received);
  return {data, code, error, received, decodedData, ...decoded};
}

function matrix(values, label, active = () => false) {
  const rows = values.length, cols = values[0].length;
  return `<div class="matrix-wrap"><span class="matrix-label">${label}</span><div class="matrix math" role="img" aria-label="${label}: ${values.map(row => row.join(' ')).join('; ')}" style="--cols:${cols}">${values.map((row,r) => row.map((v,c) => `<span aria-hidden="true" class="cell ${active(r,c) ? 'active' : ''}">${v}</span>`).join('')).join('')}</div><span class="matrix-label">${rows} × ${cols}</span></div>`;
}

function product(vector, label, row = -1, result = C.multiply(H,vector), until = 2) {
  const shown = result.map((v,r) => r <= until ? v : '·');
  return `<div class="matrix-scroll"><div class="matrix-line">${matrix(H,'H',(r) => r === row)}<span>×</span>${matrix(column(vector),label,(r) => row >= 0 && H[row][r] === 1)}<span>=</span>${matrix(column(shown),label === 'c' ? 'Hc' : 's = Hy',r => r === row)}</div></div>`;
}

function word(values, caption, active = [], flipped = [], interactive = false) {
  return `<div class="word"><div class="word-caption">${caption}</div><div class="bit-grid">${values.map((v,i) => {
    const p = i + 1, check = C.checkPositions.includes(p);
    const binary = p.toString(2).padStart(3, '0');
    const cls = `bit ${active.includes(p) ? 'active' : ''} ${flipped.includes(p) ? 'flipped' : ''}`;
    const inside = `<span class="position"><span>${p}</span><span class="position-binary">=${binary}<sub>2</sub></span></span><span class="value">${v}</span><span class="kind">${check ? 'P' : 'D'}</span>`;
    return interactive ? `<button type="button" class="${cls}" data-bit="${p}" aria-label="Flip bit ${p}, binary position ${binary}, value ${v}${flipped.includes(p) ? ', flipped' : ''}" aria-pressed="${flipped.includes(p)}">${inside}</button>` : `<div class="${cls}">${inside}</div>`;
  }).join('')}</div></div>`;
}

function placement(x) {
  const partial = x.code.map((v,i) => C.checkPositions.includes(i + 1) ? '?' : v);
  return `<p>Put d = ${fmt(x.data)} in positions ${mark('3, 5, 6, 7')}. Reserve 1, 2, 4 for parity.</p>
    ${word(partial,'c / P = parity, D = data',C.dataPositions)}
    <div class="matrix-scroll"><div class="matrix-line">${matrix(H,'H',(_,c) => C.checkPositions.includes(c + 1))}</div></div>
    <p>Columns 1, 2, 4 form a basis. Choose their bits so ${mark('Hc = 0')}.</p>`;
}

function parity(x) {
  const index = state.step - 1, p = C.checkPositions[index], row = 2 - index;
  const selected = H[row].flatMap((v,i) => v ? [i + 1] : []);
  const others = selected.filter(j => j !== p);
  const partial = x.code.map((v,i) => C.checkPositions.slice(index + 1).includes(i + 1) ? '?' : v);
  return `<p>Row ${row + 1} must sum to 0.</p>
    <div class="matrix-scroll"><div class="matrix-line">${matrix(H,'H',r => r === row)}</div></div>
    <p class="formula">${selected.map(bitName).join(' + ')} = 0</p>
    <p>In F₂, subtraction is addition:</p>
    <p class="formula">${mark(bitName(p))} = ${others.map(bitName).join(' + ')} = ${others.map(j => x.code[j - 1]).join(' + ')} = ${mark(x.code[p - 1])}</p>
    ${word(partial,`c / write position ${p}`,selected)}
    <details><summary>matrix form</summary>
      <p>p = (c₁,c₂,c₄)ᵀ, d = (c₃,c₅,c₆,c₇)ᵀ</p>
      <p>H<sub>P</sub>p + H<sub>D</sub>d = 0 → p = H<sub>P</sub>⁻¹H<sub>D</sub>d</p>
      <div class="matrix-scroll"><div class="matrix-line">${matrix(H.map(r => C.checkPositions.map(p => r[p - 1])),'H_P⁻¹')}<span>×</span>${matrix(H.map(r => C.dataPositions.map(p => r[p - 1])),'H_D')}<span>×</span>${matrix(column(x.data),'d')}<span>=</span>${matrix(column(C.checkPositions.map(p => x.code[p - 1])),'p')}</div></div>
    </details>`;
}

function checkRows(vector, name, active = -1) {
  return H.map((row,r) => {
    if (active >= 0 && r !== active) return '';
    const positions = row.flatMap((v,i) => v ? [i + 1] : []);
    const values = positions.map(j => vector[j - 1]);
    const total = values.reduce((a,b) => a+b,0), result = total % 2;
    return `<p class="row-detail">${positions.map(j => `${name}<sub>${j}</sub>`).join(' + ')}<br>= ${values.join(' + ')} = ${total} ≡ ${mark(result)} (mod 2)</p>`;
  }).join('');
}

function verify(x) {
  return `<p>All three checks must return 0.</p>${product(x.code,'c')}
    <p>${mark('Hc = 0')} → valid codeword.</p>
    <details><summary>expand rows</summary>${checkRows(x.code,'c')}</details>`;
}

function channel(x) {
  const flipped = x.error.flatMap((v,i) => v ? [i + 1] : []);
  return `<p>q = ${Number((state.probability * 100).toFixed(6))}%. Click a received bit to flip it.</p>
    <p class="formula">y = c + e</p>
    ${word(x.code,'c / sent',flipped)}
    <p>e = ${mark(fmt(x.error))} / 1 = flip</p>
    ${word(x.received,'y / received (underlined = changed)',flipped,flipped,true)}
    <div class="presets" aria-label="Error presets">
      <button type="button" data-preset="none">none</button>
      <button type="button" data-preset="single">flip 6</button>
      <button type="button" data-preset="double">flip 1,2</button>
      <button type="button" data-preset="triple">flip 1,2,3</button>
      <button type="button" data-preset="random">sample q</button>
    </div><p class="small">${state.sources[state.block]} / ${flipped.length} flipped</p>`;
}

function syndrome(x, row = -1) {
  const until = row < 0 ? 2 : row;
  return `<p>Hc = 0, so ${mark('s = Hy = He')}. Only the error remains.</p>
    ${product(x.received,'y',row,x.syndrome,until)}
    <p>Add positions marked 1 in this row; take mod 2.</p>
    ${row < 0 ? `<details><summary>expand rows</summary>${checkRows(x.received,'y')}</details>` : checkRows(x.received,'y',row)}`;
}

function locate(x) {
  return `<p>For one flipped bit j, ${mark('s = Huⱼ = hⱼ')}. Match a column.</p>
    <div class="matrix-scroll"><div class="matrix-line">${matrix(column(x.syndrome),'s',() => true)}<span>${x.position ? '=' : '≠'}</span>${matrix(H,'H',(_,c) => c + 1 === x.position)}</div></div>
    <p class="formula">(${fmt(x.syndrome)})₂ = ${mark(x.position)} → ${x.position ? `candidate bit ${x.position}` : 'keep y'}</p>
    ${word(x.received,'y / candidate position',x.position ? [x.position] : [])}
    <p class="small">Assumes at most one error. Zero syndrome can also hide multiple errors.</p>`;
}

function correction(x) {
  const candidate = Array.from({length:7},(_,i) => Number(i + 1 === x.position));
  return `<p>${x.position ? `Flip bit ${x.position} by adding 1.` : 's = 0: leave y unchanged.'}</p>
    <p class="formula">ĉ = y + ê<br>  = ${fmt(x.received)} + ${mark(fmt(candidate))}<br>  = ${fmt(x.corrected)}</p>
    ${word(x.corrected,'ĉ / candidate',x.position ? [x.position] : [])}
    <p>Hĉ = 0. Valid does not always mean recovered.</p>`;
}

function verdict(success, label) {
  return `<strong class="verdict ${success ? 'success' : 'failure'}"><span class="verdict-icon" aria-hidden="true">${success ? '✓' : '✕'}</span> ${label}</strong>`;
}

function outcome(x, all = true) {
  const positions = x.error.flatMap((v,i) => v ? [i + 1] : []);
  const count = positions.length, recovered = eq(x.code,x.corrected);
  const detection = !count ? 'No error to detect.' : x.position
    ? 'Error detected. The syndrome does not reveal how many bits flipped.'
    : 'Error NOT detected: the flipped columns cancel to zero.';
  let correction;
  if (!count) correction = 'No flip needed; the original is unchanged.';
  else if (count === 1) correction = `Flipped bit ${x.position} back. One error is within the correction guarantee.`;
  else if (!x.position) correction = 'The decoder kept y because s = 000. The error remains.';
  else correction = `The decoder flipped bit ${x.position}, assuming one error. With ${count} actual errors, this gives a different codeword.`;
  const decodedBits = all ? state.message.blocks.map((data,i) => C.decode(C.transmit(C.encode(data),state.errors[i])).data).flat().join('') : '';
  const recoveredMessage = decodedBits.slice(0,state.message.compact.length);
  const terms = positions.map(j => `h<sub>${j}</sub>`).join(' + ') || '0';
  return `${all ? word(x.corrected,'read data positions 3, 5, 6, 7',C.dataPositions) : ''}
    <p class="formula">sent d = ${fmt(x.data)} → read d̂ = ${mark(fmt(x.decodedData))}</p>
    <p class="result">${verdict(recovered, recovered ? 'RECOVERED' : 'FAILED')} / this block</p>
    <p><strong>Actual errors:</strong> ${count}${count ? ` / positions ${positions.join(', ')}` : ''}.</p>
    <p class="formula">s = He = ${terms} = ${mark(fmt(x.syndrome))}</p>
    <p class="detection"><strong>Detection:</strong> ${detection}</p>
    <p class="correction"><strong>Correction:</strong> ${correction}</p>
    <p class="small">Actual error count and recovery are simulator checks, not information available to the receiver.</p>
    ${all ? `<div class="guarantees">
      <p><strong>Guaranteed per block: detect up to 2 errors; correct up to 1.</strong></p>
      <p>No single column or pair of distinct columns of H sums to zero. So every 1- or 2-bit error has s ≠ 000 and is detected.</p>
      <p>But h₁ + h₂ = h₃: two errors can look like one. The decoder cannot distinguish these error patterns.</p>
      <details><summary>why these limits?</summary>
        <p>h₁ + h₂ + h₃ = 0: three errors can be invisible. Thus the minimum distance is d<sub>min</sub> = 3.</p>
        <p>Detection: d<sub>min</sub> − 1 = 2.<br>Correction: ⌊(d<sub>min</sub> − 1) / 2⌋ = 1.</p>
        <p>“Detect 2” means flag an error, not identify it as a two-bit error. Some larger errors are also detected, but not all.</p>
      </details>
    </div>
    <details open><summary>full message / remove ${state.message.padding} padding bits</summary><p class="output-bits">sent: ${state.message.compact}<br>read: ${recoveredMessage}</p><p class="message-verdict">${verdict(recoveredMessage === state.message.compact, recoveredMessage === state.message.compact ? 'MATCH' : 'MISMATCH')} / full message</p></details>` : ''}`;
}

function experiment(x) {
  return channel(x) + '<hr class="divider">' + product(x.received,'y') +
    `<p>s = ${mark(fmt(x.syndrome))} → ${x.position ? `flip candidate bit ${x.position}` : 'keep y'}</p>
    <p>ĉ = ${fmt(x.corrected)} / Hĉ = 0</p>` + outcome(x,false) +
    `<details><summary>why?</summary><p>A single error at j gives s = hⱼ. Multiple errors may share that syndrome.</p>${checkRows(x.received,'y')}</details>`;
}

function render() {
  const x = context();
  const exploration = state.mode === 'explore';
  let body;
  if (exploration) {
    body = experiment(x);
  } else if (state.step === 0) body = placement(x);
  else if (state.step <= 3) body = parity(x);
  else if (state.step === 4) body = verify(x);
  else if (state.step === 5) body = channel(x);
  else if (state.step <= 8) body = syndrome(x,state.step - 6);
  else if (state.step === 9) body = locate(x);
  else if (state.step === 10) body = correction(x);
  else body = outcome(x);
  $('lesson').innerHTML = `<p class="kicker">block ${state.block + 1} of ${state.message.blocks.length}</p><h2 id="lesson-title">${exploration ? 'Flip bits. Watch the checks.' : titles[state.step]}</h2>${body}`;
  $('guided').setAttribute('aria-pressed', String(!exploration));
  $('explore').setAttribute('aria-pressed', String(exploration));
  $('navigation').hidden = exploration;
  $('stage').classList.toggle('experiment', exploration);
  $('phases').hidden = exploration;
  $('previous').disabled = state.step === 0;
  $('next').disabled = state.step === 11;
  $('step-count').textContent = `${state.step + 1} / 12`;
  const phase = phaseStarts.reduce((a,start,i) => state.step >= start ? i : a,0);
  $('phases').innerHTML = phaseNames.map((name,i) => `<button type="button" data-step="${phaseStarts[i]}" ${i === phase ? 'aria-current="step"' : ''}>${name}</button>`).join('');
  $('message-summary').textContent = `${state.message.compact.length} data bits / ${state.message.blocks.length} blocks / ${state.message.padding} padding bits`;
}

function start(event) {
  if (event) event.preventDefault();
  try {
    const message = C.prepare($('message').value);
    const raw = $('probability').value;
    const probability = raw === '' ? NaN : Number(raw) / 100;
    C.sample(probability,() => 1); // Validate without consuming random draws.
    state = {...state, message, probability, step:0, block:0,
      errors:message.blocks.map(() => C.sample(probability)), sources:message.blocks.map(() => 'random sample')};
    $('error').hidden = true;
    $('block').innerHTML = message.blocks.map((bits,i) => `<option value="${i}">${i + 1} / ${message.blocks.length} · ${fmt(bits)}</option>`).join('');
    render(); announce('Message encoded. Errors sampled.');
  } catch (error) {
    $('error').textContent = error.message; $('error').hidden = false;
  }
}
function announce(text) { $('announcement').textContent = text; }
function move(step) { state.step = Math.max(0,Math.min(11,step)); render(); announce(titles[state.step]); }
function updateProbability() {
  const value = Number($('probability').value);
  $('probability-value').textContent = `${value}%`;
  $('probability').setAttribute('aria-valuetext', `${value} percent`);
}
function updateInputCount() {
  const count = $('message').value.replace(/\s/g, '').length;
  $('input-count').textContent = `${count.toLocaleString('en-US')} / ${C.MAX_DATA_BITS.toLocaleString('en-US')} bits`;
}
$('probability').addEventListener('input', updateProbability);
$('message').addEventListener('input', updateInputCount);
$('controls').addEventListener('submit',start);
$('previous').addEventListener('click',() => move(state.step - 1));
$('next').addEventListener('click',() => move(state.step + 1));
$('phases').addEventListener('click',event => {
  const button = event.target.closest('[data-step]');
  if (button) {
    const step = button.dataset.step;
    move(Number(step));
    $('phases').querySelector(`[data-step="${step}"]`).focus({preventScroll:true});
  }
});
$('block').addEventListener('change',event => { state.block = Number(event.target.value); render(); announce(`Block ${state.block + 1} selected.`); });
['guided','explore'].forEach(mode => $(mode).addEventListener('click',() => { state.mode = mode; render(); announce(mode === 'guided' ? titles[state.step] : 'Experiment mode.'); }));
$('lesson').addEventListener('click',event => {
  const button = event.target.closest('button');
  if (!button) return;
  const bit = button.dataset.bit, preset = button.dataset.preset;
  if (bit) {
    state.errors[state.block][Number(bit) - 1] ^= 1;
    state.sources[state.block] = 'manual override';
  } else if (preset) {
    const positions = {none:[],single:[6],double:[1,2],triple:[1,2,3]};
    state.errors[state.block] = preset === 'random' ? C.sample(state.probability) : Array.from({length:7},(_,i) => Number(positions[preset].includes(i + 1)));
    state.sources[state.block] = preset === 'random' ? 'random sample' : 'preset override';
  } else return;
  render();
  // Keep keyboard focus on the replaced button after a reactive update.
  $('lesson').querySelector(bit ? `[data-bit="${bit}"]` : `[data-preset="${preset}"]`).focus({preventScroll:true});
  announce(`Errors updated. Syndrome: ${fmt(context().syndrome)}.`);
});
updateProbability();
updateInputCount();
start();
