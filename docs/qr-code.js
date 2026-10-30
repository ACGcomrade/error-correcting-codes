'use strict';
(() => {
  const C = window.WhyCode, Q = window.QRCodeData;
  const $ = id => document.getElementById(id);
  const scene = $('animation'), duration = 36;
  const state = {time:0,playing:false,speed:1,scenario:'recoverable'};
  const scenarios = Object.fromEntries(['clean','recoverable','unreadable'].map(name => [name,Q.scenario(name)]));
  const clamp = x => Math.max(0,Math.min(1,x));
  const progress = (t,a,b) => clamp((t-a)/(b-a));
  const ease = x => x*x*(3-2*x);
  const mix = (a,b,u) => a+(b-a)*u;
  const attr = (node,name,value) => node.setAttribute(name,String(value));
  const opacity = (node,value) => attr(node,'opacity',clamp(value));
  const move = (node,x,y) => attr(node,'transform',`translate(${x.toFixed(3)} ${y.toFixed(3)})`);
  const text = (node,value) => {const next=String(value);if(node.textContent!==next)node.textContent=next;};
  const rect = (x,y,w,h,extra='') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" ${extra}/>`;
  const label = (x,y,value,cls='label',extra='') => `<text x="${x}" y="${y}" class="${cls}" ${extra}>${value}</text>`;
  const hex = n => n.toString(16).toUpperCase().padStart(2,'0');
  const clock = t => `00:${String(Math.floor(t)).padStart(2,'0')}`;
  const curve = (a,b,u,lift=36) => ({x:mix(a.x,b.x,u),y:mix(a.y,b.y,u)-Math.sin(Math.PI*u)*lift});
  let l,nodes,frame=0,lastTick=0,lastCue='';

  function bytePosition(i) {
    const offset=i<9?i:i-9;
    return {x:l.bytesX+(offset%9)*l.spacing+l.chip/2,
      y:(i<9?l.dataY:l.parityY+Math.floor(offset/9)*52)+20};
  }
  const cellPosition = cell => ({x:l.gx+(cell.col+.5)*12,y:l.gy+(cell.row+.5)*12});
  const readTime = index => 6+index/208*12;
  const repairTime = (index,count) => 23+index/Math.max(1,count)*4.8;

  // One persistent scene. Playback changes geometry, never replaces slides.
  function build() {
    const mobile=window.innerWidth<=700;
    l=mobile ? {mobile,w:480,h:1255,sourceX:66,sourceY:64,gx:114,gy:112,
      bitX:24,bitY:462,bytesX:24,bytesTitle:609,dataY:660,parityY:754,spacing:48,chip:40,
      rsX:24,rsY:930,rsW:432,outX:24,outY:1121,outW:432} :
      {mobile,w:960,h:690,sourceX:30,sourceY:64,gx:78,gy:112,
      bitX:30,bitY:466,bytesX:430,bytesTitle:35,dataY:96,parityY:198,spacing:54,chip:44,
      rsX:430,rsY:378,rsW:490,outX:430,outY:558,outW:490};
    const sx=l.sourceX,sy=l.sourceY,bx=l.bitX,by=l.bitY;
    const rx=l.rsX,ry=l.rsY,rw=l.rsW,ox=l.outX,oy=l.outY,ow=l.outW;
    attr(scene,'viewBox',`0 0 ${l.w} ${l.h}`);
    const modules=C.qrMatrix.map((row,r) => row.map((bit,c) =>
      rect(l.gx+c*12,l.gy+r*12,12,12,`id="module-${r}-${c}" class="qr-module" fill="${bit?'#000':'#fff'}"`)).join('')).join('');
    const finders=[[0,0],[0,14],[14,0]].map(([r,c],i) =>
      `<g id="finder-${i}">${rect(l.gx+c*12-4,l.gy+r*12-4,92,92,'class="function-ring"')}<circle cx="${l.gx+(c+3.5)*12}" cy="${l.gy+(r+3.5)*12}" r="6" class="finder-dot"/></g>`).join('');
    const slots=Array.from({length:26},(_,i) => {
      const p=bytePosition(i);
      return rect(p.x-l.chip/2,p.y-20,l.chip,40,'fill="none" stroke="#b8b8b8" stroke-dasharray="3 3"');
    }).join('');
    const tokens=Array.from({length:26},(_,i) => `<g id="byte-${i}">${rect(-l.chip/2,-20,l.chip,40,`id="byte-box-${i}" class="${i<9?'paper':'parity-box'}"`)}${label(0,6,'00','byte','id="byte-value-'+i+'" text-anchor="middle"')}</g>`).join('');
    const checkTokens=Array.from({length:17},(_,i) => `<g id="check-token-${i}">${rect(-17,-14,34,28,'class="yellow" stroke="#000"')}${label(0,6,'00','byte','id="check-value-'+i+'" text-anchor="middle"')}</g>`).join('');
    const repairs=Array.from({length:26},(_,i) => `<g id="repair-token-${i}">${rect(-l.chip/2,-20,l.chip,40,'class="corrected-box"')}${label(0,6,hex(Q.originalBytes[i]),'byte success','text-anchor="middle"')}</g>`).join('');
    const bits=Array.from({length:8},(_,i) => {
      const x=bx+62+i*31;
      return `${rect(x,by+17,26,28,'class="paper"')}${label(x+13,by+37,'0','bit','id="seen-bit-'+i+'" text-anchor="middle"')}
        ${rect(x,by+62,26,28,'class="yellow" id="read-bit-box-'+i+'"')}${label(x+13,by+82,'0','bit','id="read-bit-'+i+'" text-anchor="middle"')}`;
    }).join('');
    scene.innerHTML=`
      <title id="animation-title">From a damaged QR code to HELLO</title>
      <desc id="animation-description">A real version-1 QR symbol is located, read in a zigzag, unmasked, and decoded with local Reed–Solomon error correction. Yellow follows the reading; red marks deliberately introduced errors.</desc>
      ${label(l.mobile?24:sx,35,'01 / locate the square','section-label')}
      <g id="qr-source">
        ${rect(sx,sy,348,348,'class="paper"')}
        ${modules}
        <g id="damage-mark"><rect id="damage-outline" fill="#b42318" fill-opacity=".12" stroke="#b42318" stroke-width="2"/></g>
        ${finders}
        <path id="read-trail" class="trail"/>
        ${Array.from({length:8},(_,i)=>rect(0,0,12,12,`class="scan-cell" id="read-cell-${i}"`)).join('')}
        <circle id="read-head" r="4.2" class="finder-dot"/>
      </g>
      <path id="camera-frame" d="M${sx-7} ${sy+22}v-29h29 M${sx+326} ${sy-7}h29v29 M${sx+355} ${sy+326}v29h-29 M${sx+22} ${sy+355}h-29v-29" fill="none" stroke="#000" stroke-width="2"/>
      ${label(sx+174,sy+373,'21 × 21 modules · version 1 / H','tiny','text-anchor="middle" id="source-note"')}
      <g id="bit-reader">
        ${label(bx,by,`02 / remove mask ${Q.format.mask}`,'section-label')}
        ${label(bx,by+37,'seen','tiny')}${label(bx,by+82,'read','tiny')}${bits}
        ${label(bx+62,by+115,'8 bits → 1 byte','tiny','id="byte-note"')}
      </g>
      ${label(l.bytesX,l.bytesTitle,'03 / collect the bytes','section-label')}
      ${label(l.bytesX,l.dataY-17,'data · 9 bytes','label')}
      ${label(l.bytesX,l.parityY-17,'error correction · 17 bytes','label')}
      ${slots}
      ${label(l.bytesX,l.parityY+106,'Each box is one byte, shown in hex.','tiny muted')}
      ${label(rx,ry-22,'04 / Reed–Solomon','section-label')}
      ${rect(rx,ry,rw,130,'class="paper" id="rs-panel"')}
      ${label(rx+16,ry+28,'17 check bytes → up to 8 byte errors','tiny','id="capacity-note"')}
      ${label(rx+16,ry+66,'WAITING','number bold','id="rs-status"')}
      ${label(rx+16,ry+105,'','tiny','id="rs-note"')}
      ${rect(rx,ry+130,rw,4,'fill="#ededed"')}${rect(rx,ry+130,0,4,'class="yellow" id="rs-progress"')}
      <g id="output-panel">
        ${label(ox,oy-22,'05 / recovered text','section-label')}
        ${rect(ox,oy,ow,100,'class="paper" id="output-box"')}
        ${label(ox+16,oy+26,'TEXT / ALPHANUMERIC','tiny muted')}
        ${label(ox+ow-16,oy+26,'DECODED','tiny success bold','id="output-status" text-anchor="end"')}
      </g>
      <g id="retry-message">${label(ox+ow/2,oy+36,'RETRY','large failure','text-anchor="middle"')}${label(ox+ow/2,oy+66,'Please scan again.','label','text-anchor="middle"')}</g>
      <g id="byte-tokens">${tokens}</g>
      <g id="check-tokens">${checkTokens}</g>
      <g id="repair-tokens">${repairs}</g>
      <g id="message-letters">${[...C.qrMessage].map((char,i)=>label(0,0,char,'message-letter','id="letter-'+i+'" text-anchor="middle"')).join('')}</g>`;
    nodes={};scene.querySelectorAll('[id]').forEach(node=>{nodes[node.id]=node;});
    render();
  }

  function narration(t,result) {
    const count=result.errorByteCount;
    if(!result.correctable&&t>=23) return ['RETRY','This damaged reading cannot be decoded. Please scan again.'];
    if(t<.25) return ['READY','Press play to follow the square. Drag the timeline to look closer.'];
    if(t<2.5) return ['IMAGE','A camera captures the whole square, including its surrounding white margin.'];
    if(t<6) return ['LOCATE',count?'A patch is deliberately damaged. The three finder patterns still let the reader locate and orient the square.':'The three finder patterns let the reader locate and orient the square.'];
    if(t<9) return ['READ','Read pairs of columns in a zigzag, skipping the finder patterns and other reserved cells.'];
    if(t<18.8) return ['UNMASK','Remove the QR mask, then collect every eight bits into a byte. Red marks the simulated errors.'];
    if(t<23) return ['CHECK','This QR block has 9 data bytes and 17 Reed–Solomon check bytes. The extra bytes constrain the reading.'];
    if(t<29) return [count?'REPAIR':'PASS',count?`${count} bytes were changed. The extra information recovers the reading; the printed patch stays damaged.`:'All bytes agree with the check information. The reading is ready to decode.'];
    if(t<34.2) return ['DECODE','Read the corrected data as text. The message emerges: H E L L O.'];
    return ['DONE',count?'HELLO recovered. Unlike the barcode check, this code can repair a limited amount of damage.':'HELLO decoded. The square carries the message itself.'];
  }

  // Geometry is a pure function of time: seeking backward restores every state.
  function render() {
    if(!nodes)return;
    const t=state.time,result=scenarios[state.scenario],failed=!result.correctable&&t>=23;
    const errors=new Set(result.errorByteIndices),damaged=t>=2.5&&result.changed.length>0;
    const changed=new Set(result.changed.map(p=>`${p.row},${p.col}`));
    const reading=t>=6&&t<18;
    const cursor=progress(t,6,18)*207;
    const current=Math.min(207,Math.floor(cursor));
    const byteIndex=Math.min(25,Math.floor(current/8));
    attr(scene,'data-time',t.toFixed(3));
    attr(scene,'data-scenario',state.scenario);
    const turn=1-ease(progress(t,3.5,5.8));
    attr(nodes['qr-source'],'transform',`rotate(${-7*turn} ${l.sourceX+174} ${l.sourceY+174})`);
    opacity(nodes['camera-frame'],t<6.2 ? progress(t,.1,1.5)*(1-progress(t,5.7,6.2)):0);
    move(nodes['camera-frame'],14*(1-ease(progress(t,0,2))),-12*(1-ease(progress(t,0,2))));
    for(let r=0;r<21;r++)for(let c=0;c<21;c++) {
      const altered=damaged&&changed.has(`${r},${c}`);
      const value=damaged?result.matrix[r][c]:C.qrMatrix[r][c];
      attr(nodes[`module-${r}-${c}`],'fill',value?(altered?'#b42318':'#000'):(altered?'#fff0ee':'#fff'));
    }
    opacity(nodes['damage-mark'],damaged?ease(progress(t,2.5,3)):0);
    if(result.changed.length) {
      const rows=result.changed.map(p=>p.row),cols=result.changed.map(p=>p.col);
      attr(nodes['damage-outline'],'x',l.gx+Math.min(...cols)*12-1);
      attr(nodes['damage-outline'],'y',l.gy+Math.min(...rows)*12-1);
      attr(nodes['damage-outline'],'width',(Math.max(...cols)-Math.min(...cols)+1)*12+2);
      attr(nodes['damage-outline'],'height',(Math.max(...rows)-Math.min(...rows)+1)*12+2);
    }
    text(nodes['source-note'],damaged?`${result.changed.length} simulated module flips`:'21 × 21 modules · version 1 / H');
    attr(nodes['source-note'],'class',damaged?'tiny failure':'tiny');
    for(let i=0;i<3;i++) {
      const u=progress(t,2.7+i*.5,3.5+i*.5);
      opacity(nodes[`finder-${i}`],u*(1-progress(t,5.4,6.1)));
    }
    const start=cellPosition(Q.traversal[current]),end=cellPosition(Q.traversal[Math.min(207,current+1)]);
    move(nodes['read-head'],mix(start.x,end.x,cursor-current),mix(start.y,end.y,cursor-current));
    opacity(nodes['read-head'],reading?1:0);
    // Keep only the current byte's path visible, avoiding a tangled whole-grid trail.
    const segment=Q.traversal.slice(byteIndex*8,current+1).map(cellPosition);
    attr(nodes['read-trail'],'d',segment.map((p,i)=>`${i?'L':'M'}${p.x} ${p.y}`).join(' '));
    opacity(nodes['read-trail'],reading?1:0);
    for(let bit=0;bit<8;bit++) {
      const cell=Q.traversal[byteIndex*8+bit],p=cellPosition(cell);
      move(nodes[`read-cell-${bit}`],p.x-6,p.y-6);
      opacity(nodes[`read-cell-${bit}`],reading&&bit<=current%8?1:0);
      const raw=Number(result.matrix[cell.row][cell.col]);
      const read=(result.readBytes[byteIndex]>>(7-bit))&1;
      text(nodes[`seen-bit-${bit}`],raw);
      text(nodes[`read-bit-${bit}`],read);
      attr(nodes[`read-bit-box-${bit}`],'class',changed.has(`${cell.row},${cell.col}`)?'error-box':'yellow');
      opacity(nodes[`read-bit-${bit}`],!reading||bit<=current%8?1:.18);
    }
    opacity(nodes['bit-reader'],progress(t,5.8,6.3));
    text(nodes['byte-note'],`8 bits → ${hex(result.readBytes[byteIndex])} · byte ${byteIndex+1} / 26`);
    let repaired=0;
    for(let i=0;i<26;i++) {
      const complete=readTime((i+1)*8),travel=ease(progress(t,complete,complete+.65));
      const source=cellPosition(Q.traversal[i*8+7]),destination=bytePosition(i);
      const p=curve(source,destination,travel,l.mobile?14:50);
      move(nodes[`byte-${i}`],p.x,p.y);
      opacity(nodes[`byte-${i}`],progress(t,complete,complete+.12));
      const errorIndex=result.errorByteIndices.indexOf(i);
      const repairStart=repairTime(errorIndex,result.errorByteCount);
      const fixed=result.correctable&&errors.has(i)&&t>=repairStart+.75;
      if(fixed)repaired++;
      const isBad=errors.has(i)&&!fixed;
      attr(nodes[`byte-box-${i}`],'class',isBad?'error-box':fixed?'corrected-box':i<9?'paper':'parity-box');
      attr(nodes[`byte-value-${i}`],'class',isBad?'byte failure':fixed?'byte success':'byte');
      text(nodes[`byte-value-${i}`],hex(fixed?result.correctedBytes[i]:result.readBytes[i]));
      const ru=ease(progress(t,repairStart,repairStart+.75));
      const rp=curve({x:l.rsX+l.rsW/2,y:l.rsY+55},destination,ru,40);
      move(nodes[`repair-token-${i}`],rp.x,rp.y);
      opacity(nodes[`repair-token-${i}`],result.correctable&&errors.has(i)&&t>=repairStart&&t<repairStart+.75?1:0);
    }
    for(let i=0;i<17;i++) {
      const begin=19+i*.17,u=ease(progress(t,begin,begin+.65));
      const p=curve(bytePosition(i+9),{x:l.rsX+l.rsW/2,y:l.rsY+60},u,24);
      move(nodes[`check-token-${i}`],p.x,p.y);
      opacity(nodes[`check-token-${i}`],t>=begin&&t<begin+.65?1:0);
      text(nodes[`check-value-${i}`],hex(result.readBytes[i+9]));
    }
    const finished=result.correctable&&t>=28.8;
    const rsStatus=failed?'FAIL':finished?(result.errorByteCount?'RECOVERED':'PASS'):t>=23?(result.errorByteCount?'REPAIRING':'PASS'):t>=19?'CHECKING':'WAITING';
    text(nodes['rs-status'],rsStatus);
    attr(nodes['rs-status'],'class',failed?'number bold failure':finished?'number bold success':'number bold');
    attr(nodes['rs-panel'],'class',failed?'error-box':'paper');
    attr(nodes['rs-progress'],'class',failed?'error-solid':'yellow');
    attr(nodes['rs-progress'],'width',l.rsW*(failed?1:progress(t,19,28.8)));
    text(nodes['rs-note'],failed?`${result.errorByteCount} altered bytes · this reading is unreadable.`:t>=23&&result.errorByteCount?`${repaired} / ${result.errorByteCount} altered bytes restored.`:t>=19?`${result.errorByteCount} altered bytes in this example.`:'Waiting for the reading.');
    opacity(nodes['retry-message'],failed?1:0);
    opacity(nodes['output-panel'],result.correctable?progress(t,29,29.5):0);
    opacity(nodes['output-status'],t>=34.2?1:0);
    for(let i=0;i<5;i++) {
      const begin=30+i*.55,u=ease(progress(t,begin,begin+1));
      // Text comes from the data block as a whole; QR alphanumeric mode packs
      // character pairs, so do not imply one byte corresponds to one letter.
      const p=curve({x:l.bytesX+(8*l.spacing+l.chip)/2,y:l.dataY+48},
        {x:l.outX+l.outW/2+(i-2)*36,y:l.outY+76},u,35);
      move(nodes[`letter-${i}`],p.x,p.y);
      opacity(nodes[`letter-${i}`],result.correctable?progress(t,begin,begin+.12):0);
    }
    const [cue,caption]=narration(t,result);
    text($('cue'),cue);text($('caption'),caption);
    if(cue!==lastCue){text($('announcement'),caption);lastCue=cue;}
    $('timeline').value=t.toFixed(2);
    $('timeline').style.setProperty('--progress',`${t/duration*100}%`);
    attr($('timeline'),'aria-valuetext',`${t.toFixed(1)} seconds of ${duration}. ${cue.toLowerCase()}.`);
    text($('time'),`${clock(t)} / 00:36`);
    syncPlay();
  }

  function syncPlay() {
    text($('play'),state.playing?'[ pause ]':state.time>=duration?'[ replay ]':'[ play ]');
    attr($('play'),'aria-pressed',state.playing);
  }
  function pause() {state.playing=false;cancelAnimationFrame(frame);frame=0;syncPlay();}
  function tick(now) {
    if(!state.playing)return;
    state.time=Math.min(duration,state.time+(now-lastTick)/1000*state.speed);lastTick=now;
    render();if(state.time>=duration)pause();else frame=requestAnimationFrame(tick);
  }
  function play() {
    if(state.playing){pause();return;}
    if(state.time>=duration){state.time=0;render();}
    state.playing=true;lastTick=performance.now();syncPlay();frame=requestAnimationFrame(tick);
  }
  $('play').addEventListener('click',play);
  $('restart').addEventListener('click',()=>{pause();state.time=0;render();});
  $('timeline').addEventListener('input',event=>{pause();state.time=Math.max(0,Math.min(duration,Number(event.target.value)));render();});
  $('speed').addEventListener('change',event=>{state.speed=Number(event.target.value);lastTick=performance.now();});
  $('scenario').addEventListener('change',event=>{pause();state.scenario=event.target.value;lastCue='';render();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
  window.addEventListener('pagehide',pause);
  let mobile=window.innerWidth<=700;
  window.addEventListener('resize',()=>{const next=window.innerWidth<=700;if(next!==mobile){mobile=next;build();}});
  build();
})();
