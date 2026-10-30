'use strict';
(() => {
  const C = window.WhyCode;
  const $ = id => document.getElementById(id);
  const scene = $('animation');
  const duration = 30;
  const pattern = C.upcPattern(C.upcDigits);
  const boundaries = Array.from({length:12},(_,i) => i < 6 ? 10+i*7 : 57+(i-6)*7);
  const state = {time:0, playing:false, speed:1, scenario:'clean'};
  let layout, nodes, frame = 0, lastTick = 0, lastCue = '';
  const clamp = value => Math.max(0,Math.min(1,value));
  const progress = (t,start,end) => clamp((t-start)/(end-start));
  const ease = value => value*value*(3-2*value);
  const mix = (a,b,u) => a+(b-a)*u;
  const attr = (node,name,value) => node.setAttribute(name,String(value));
  const opacity = (node,value) => attr(node,'opacity',clamp(value));
  const move = (node,x,y) => attr(node,'transform',`translate(${x.toFixed(3)} ${y.toFixed(3)})`);
  const text = (node,value) => { const next=String(value); if (node.textContent !== next) node.textContent=next; };
  const rect = (x,y,w,h,extra='') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" ${extra}/>`;
  const label = (x,y,value,cls='label',extra='') => `<text x="${x}" y="${y}" class="${cls}" ${extra}>${value}</text>`;
  const timeLabel = seconds => `00:${String(Math.floor(seconds)).padStart(2,'0')}`;
  function pointOnPath(points,u) {
    const lengths = points.slice(1).map((p,i) => Math.hypot(p.x-points[i].x,p.y-points[i].y));
    let distance = clamp(u)*lengths.reduce((a,b) => a+b,0);
    for (let i=0;i<lengths.length;i++) {
      if (distance <= lengths[i]) {
        const v=lengths[i] ? distance/lengths[i] : 1;
        return {x:mix(points[i].x,points[i+1].x,v), y:mix(points[i].y,points[i+1].y,v)};
      }
      distance-=lengths[i];
    }
    return points[points.length-1];
  }
  const pathD = points => points.map((p,i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ');
  function curve(start,end,u,lift=35) {
    return {x:mix(start.x,end.x,u),y:mix(start.y,end.y,u)-Math.sin(Math.PI*u)*lift};
  }

  // Build once per viewport layout. Playback mutates these SVG objects in place.
  function build() {
    const mobile = window.innerWidth <= 700;
    layout = mobile ? {
      mobile,w:480,h:1055,bx:60,by:64,bw:380,bh:100,wy:290,
      rowX:24,rowY:382,spacing:36,chip:30,sumX:24,sumY:495,sumW:432,
      tableX:24,tableY:670,tableW:432,receiptX:226,receiptY:878,receiptW:230
    } : {
      mobile,w:960,h:630,bx:98,by:84,bw:456,bh:112,wy:324,
      rowX:26,rowY:402,spacing:46,chip:36,sumX:26,sumY:510,sumW:552,
      tableX:646,tableY:88,tableW:288,receiptX:666,receiptY:335,receiptW:250
    };
    const l=layout, m=l.bw/95, sumMid=l.sumX+l.sumW*.46;
    const route = mobile
      ? [{x:l.sumX+l.sumW/2,y:l.sumY+64},{x:l.sumX+l.sumW/2,y:l.tableY-28},{x:l.tableX+180,y:l.tableY+67}]
      : [{x:l.sumX+l.sumW,y:l.sumY+33},{x:612,y:l.sumY+33},{x:612,y:l.tableY+67},{x:l.tableX+120,y:l.tableY+67}];
    l.queryRoute=route;
    const bars=[...pattern].map((bit,i) => bit==='1' ? rect(l.bx+i*m,l.by,m,l.bh+(i<3 || (i>=45&&i<50) || i>=92 ? 10 : 0),'fill="#000"') : '').join('');
    const sourceDigits=[...C.upcDigits].map((digit,i) => label(l.bx+(boundaries[i]-3.5)*m,l.by+l.bh+35,digit,'small-number','text-anchor="middle"')).join('');
    const receivers=[...C.upcDigits].map((_,i) => {
      const x=l.rowX+i*l.spacing;
      return `<g>${rect(x,l.rowY,l.chip,40,'fill="none" stroke="#b8b8b8" stroke-dasharray="3 3"')}${label(x+l.chip/2,l.rowY+66,`×${i%2?1:3}`,'small-number','text-anchor="middle" id="weight-'+i+'"')}</g>`;
    }).join('');
    const digitTokens=[...C.upcDigits].map((digit,i) => `<g id="digit-token-${i}">${rect(-l.chip/2,-20,l.chip,40,'fill="#fff" stroke="#000" id="digit-fill-'+i+'"')}${label(0,7,digit,'number','text-anchor="middle" id="digit-text-'+i+'"')}</g>`).join('');
    const contributions=[...C.upcDigits].map((_,i) => `<g id="contribution-${i}">${rect(-15,-14,30,28,'class="yellow"')}${label(0,6,'0','small-number bold','text-anchor="middle" id="contribution-text-'+i+'"')}</g>`).join('');
    const tx=l.tableX,ty=l.tableY,tw=l.tableW,rx=l.receiptX,ry=l.receiptY,rw=l.receiptW;
    attr(scene,'viewBox',`0 0 ${l.w} ${l.h}`);
    scene.innerHTML=`
      <title id="animation-title">From a barcode to the checkout</title>
      <desc id="animation-description">A continuous animation of optical scanning, decoded digits, a weighted checksum, and product lookup. Use the time slider to inspect any moment.</desc>
      <defs>
        <clipPath id="print-clip"><rect id="print-reveal" x="${l.bx-15}" y="${l.by-8}" width="${l.bw+30}" height="0"/></clipPath>
        <clipPath id="wave-clip"><rect id="wave-reveal" x="${l.bx-2}" y="${l.wy-45}" width="0" height="65"/></clipPath>
        <clipPath id="receipt-clip"><rect id="receipt-reveal" x="${rx}" y="${ry}" width="${rw}" height="0"/></clipPath>
      </defs>
      <g id="printed-source">
      ${label(l.bx,l.by-26,'01 / printed label','section-label')}
      <g id="package"><path d="M${l.bx-60} ${l.by+24}h34v53h-34z m0 0 7-8h34l-7 8 m0 0v53l7-8v-53" class="ink"/>${label(l.bx-43,l.by+56,'C','small-number bold','text-anchor="middle"')}</g>
      <g id="label-paper">${rect(l.bx-15,l.by-8,l.bw+30,l.bh+54,'fill="#fff" stroke="#d0d0d0"')}
        <g clip-path="url(#print-clip)">${bars}</g>${sourceDigits}
      </g>
      </g>
      <g id="scan-beam"><rect x="-7" y="${l.by-12}" width="14" height="${l.wy-l.by+25}" fill="#ffe875" opacity=".6"/><path d="M0 ${l.by-12}V${l.wy+12}" stroke="#000" stroke-width="1.3"/><circle cx="0" cy="${l.wy+12}" r="3" fill="#000"/></g>
      ${label(l.bx,l.wy-50,'02 / reflected brightness','section-label')}
      ${label(l.bx-13,l.wy-27,'light','tiny','text-anchor="end"')}${label(l.bx-13,l.wy+5,'dark','tiny','text-anchor="end"')}
      <path d="M${l.bx} ${l.wy+10}H${l.bx+l.bw}" class="guide"/>
      ${boundaries.map((end,i) => rect(l.bx+(end-7)*m,l.wy-36,7*m,40,`class="yellow" id="group-highlight-${i}"`)).join('')}
      <path id="wave-path" clip-path="url(#wave-clip)" fill="none" stroke="#000" stroke-width="1.6"/>
      <g id="sensor-dot"><circle r="5" class="yellow" stroke="#000"/></g>
      ${label(l.rowX,l.rowY-26,'03 / decoded digits','section-label')}
      <g id="receiver-slots">${receivers}</g>
      <g id="misread-note">${rect(l.rowX,l.rowY-64,l.mobile?232:242,23,'fill="#fff0ee"')}${label(l.rowX+7,l.rowY-48,'simulated reading error: 0 → 1','tiny failure')}</g>
      ${label(l.sumX,l.sumY-15,'04 / check before accepting','section-label')}
      ${rect(l.sumX,l.sumY,l.sumW,66,'class="paper" id="check-panel"')}
      ${label(l.sumX+14,l.sumY+23,'weighted total','label')}
      ${label(sumMid,l.sumY+43,'—','large','id="sum-value" text-anchor="middle"')}
      <g id="check-verdict">${rect(l.sumX+l.sumW-145,l.sumY+12,132,42,'id="verdict-fill" class="yellow"')}${label(l.sumX+l.sumW-79,l.sumY+39,'PASS','number bold','id="verdict-text" text-anchor="middle"')}</g>
      ${label(l.sumX+14,l.sumY+51,'×3, ×1, …','tiny')}
      ${label(l.sumX,l.sumY+93,'','label','id="check-note"')}
      <path id="query-route" d="${pathD(route)}" class="guide"/>
      <g id="store-table">
        ${label(tx,ty-23,'05 / store’s product table','section-label')}
        ${rect(tx,ty,tw,140,'class="paper"')}${rect(tx,ty,tw,31,'fill="#f1f1f1"')}
        ${label(tx+10,ty+21,'number','tiny')}${label(tx+tw*.58,ty+21,'item','tiny')}${label(tx+tw-10,ty+21,'price','tiny','text-anchor="end"')}
        ${rect(tx+1,ty+37,tw-2,46,'class="yellow" id="matched-row"')}
        ${label(tx+10,ty+66,C.upcDigits,'tiny')}${label(tx+tw*.58,ty+66,'Cereal','tiny')}${label(tx+tw-10,ty+66,'$3.75','small-number','text-anchor="end"')}
        <path d="M${tx} ${ty+90}h${tw}" stroke="#d0d0d0"/>
        ${label(tx+10,ty+119,'036000291469','tiny muted')}${label(tx+tw*.58,ty+119,'Tea','tiny muted')}${label(tx+tw-10,ty+119,'$2.40','tiny muted','text-anchor="end"')}
        ${label(tx,ty+162,'The price lives here, not in the bars.','tiny')}
      </g>
      <path id="receipt-route" d="M${tx+tw*.8} ${ty+175}V${ry-18}" class="guide"/>
      <g id="receipt-printer">${rect(rx-5,ry-14,rw+10,18,'fill="#000"')}
        <g clip-path="url(#receipt-clip)" id="receipt-paper">
          ${rect(rx,ry,rw,156,'class="paper"')}${label(rx+15,ry+30,'DEMO STORE','label bold')}
          <path d="M${rx+15} ${ry+43}h${rw-30}" class="guide"/>
          ${label(rx+15,ry+72,'Cereal','label')}${label(rx+rw-15,ry+72,'$3.75','label','text-anchor="end"')}
          <path d="M${rx+15} ${ry+89}h${rw-30}" class="ink"/>
          ${label(rx+15,ry+119,'TOTAL','label bold')}${label(rx+rw-15,ry+119,'$3.75','number bold','text-anchor="end"')}
          ${label(rx+15,ry+144,'Added to the bill.','tiny')}
        </g>
      </g>
      <g id="retry-message">${label(rx+rw/2,ry+38,'RETRY','large failure','text-anchor="middle"')}${label(rx+rw/2,ry+68,'Please scan again.','label','text-anchor="middle"')}</g>
      <g id="digit-tokens">${digitTokens}</g>
      <g id="contributions">${contributions}</g>
      <g id="query-packet">${rect(-68,-16,136,32,'class="yellow" stroke="#000"')}${label(0,6,C.upcDigits,'small-number','text-anchor="middle"')}</g>
      <g id="price-packet">${rect(-38,-16,76,32,'class="yellow" stroke="#000"')}${label(0,6,'$3.75','small-number bold','text-anchor="middle"')}</g>`;
    nodes={};
    scene.querySelectorAll('[id]').forEach(node => {nodes[node.id]=node;});
    let d=`M${l.bx} ${l.wy-32}`;
    [...pattern].forEach((bit,i) => {
      const y=bit==='1'?l.wy:l.wy-32;
      d+=`H${l.bx+i*m}V${y}H${l.bx+(i+1)*m}`;
    });
    attr(nodes['wave-path'],'d',d);
    render();
  }

  function narration(t,bad) {
    if(bad&&t>=20.5) return ['RETRY','63 does not end in 0. Retry the scan; this check cannot repair the number.'];
    if(t<.25) return ['READY','Press play and follow the yellow highlight. Drag the timeline to look closer.'];
    if(t<2) return ['PRINT','A product number becomes a pattern of black bars and white gaps.'];
    if(t<5) return ['SCAN','The light moves across the label. Black bars reflect less light; white gaps reflect more.'];
    if(t<12.8) return ['READ',bad ? 'One decoded digit is deliberately changed: 0 → 1. Watch where that reading leads.' : 'Each completed group of bars becomes a digit. The digits travel into the reader.'];
    if(t<14) return ['WEIGH','Give the twelve digits alternating weights: ×3, ×1, ×3, ×1, …'];
    if(t<20.6) return ['ADD','The weighted contributions flow into the running total.'];
    if(t<22.8) return ['CHECK','60 ends in 0. This reading passes the check and can be used for lookup.'];
    if(t<25.6) return ['LOOK UP','The accepted number travels to the store’s table and selects the matching product.'];
    if(t<28) return ['PRICE','The store supplies the current price: $3.75. That price was never inside the barcode.'];
    return ['DONE','Cereal, $3.75. From a printed pattern to a checked number to an item on the bill.'];
  }

  // Every position is a function of time, so pausing and seeking are exact.
  function render() {
    if(!nodes) return;
    const t=state.time,l=layout,bad=state.scenario==='misread';
    const received=bad?C.upcDamagedDigits:C.upcDigits;
    const scan=progress(t,2,12),m=l.bw/95;
    const scanX=l.bx+l.bw*scan;
    attr(scene,'data-time',t.toFixed(3));
    attr(nodes['print-reveal'],'height',(l.bh+18)*ease(progress(t,0,1.8)));
    opacity(nodes['printed-source'],1-ease(progress(t,12.6,13.4)));
    move(nodes['package'],-40*(1-ease(progress(t,0,1.6))),0);
    opacity(nodes['scan-beam'],t>=2&&t<=12.6 ? 1-progress(t,12,12.6):0);
    move(nodes['scan-beam'],scanX,0);
    attr(nodes['wave-reveal'],'width',scan>0 ? l.bw*scan+2 : 0);
    const sample=Math.min(94,Math.floor(scan*95));
    move(nodes['sensor-dot'],scanX,pattern[sample]==='1'?l.wy:l.wy-32);
    opacity(nodes['sensor-dot'],t>=2&&t<12.5?1:0);
    opacity(nodes['misread-note'],bad ? progress(t,3.2,3.5):0);
    let total=0;
    for(let i=0;i<12;i++) {
      const complete=2+boundaries[i]/95*10;
      const travel=ease(progress(t,complete,complete+.85));
      const source={x:l.bx+(boundaries[i]-3.5)*m,y:l.wy+22};
      const end={x:l.rowX+i*l.spacing+l.chip/2,y:l.rowY+20};
      const pos=curve(source,end,travel,28);
      move(nodes[`digit-token-${i}`],pos.x,pos.y);
      opacity(nodes[`digit-token-${i}`],t>=complete?Math.min(1,(t-complete)*10):0);
      opacity(nodes[`group-highlight-${i}`],t>=complete ? .6*(1-travel) : 0);
      const injected=bad&&i===0&&t>=complete+.4;
      text(nodes[`digit-text-${i}`],injected?'1':C.upcDigits[i]);
      attr(nodes[`digit-text-${i}`],'class',injected?'number failure':'number');
      nodes[`digit-fill-${i}`].classList.toggle('error-box',injected);
      const contributionStart=14+i*.48;
      const active=t>=contributionStart&&t<contributionStart+.72;
      attr(nodes[`digit-fill-${i}`],'fill',active||i===11?'#ffe875':'#fff');
      opacity(nodes[`weight-${i}`],progress(t,13,13.8));
      const value=Number(received[i])*(i%2?1:3);
      const u=ease(progress(t,contributionStart,contributionStart+.72));
      const cp=curve({x:end.x,y:l.rowY+73},{x:l.sumX+l.sumW*.46,y:l.sumY+35},u,22);
      move(nodes[`contribution-${i}`],cp.x,cp.y);
      opacity(nodes[`contribution-${i}`],active?1:0);
      text(nodes[`contribution-text-${i}`],value);
      if(t>=contributionStart+.72) total+=value;
    }
    text(nodes['sum-value'],t>=14?total:'—');
    const failed=bad&&t>=20.5;
    nodes['check-panel'].classList.toggle('error-box',failed);
    opacity(nodes['check-verdict'],bad?Number(failed):progress(t,20.5,21.2));
    text(nodes['verdict-text'],bad?'FAIL':'PASS');
    attr(nodes['verdict-text'],'class',`number bold ${bad?'on-error':'success'}`);
    attr(nodes['verdict-fill'],'class',bad?'error-solid':'yellow');
    text(nodes['check-note'],t<20.5?'':bad?'63 does not end in 0 → retry.':'60 ends in 0 → accept this reading.');
    opacity(nodes['query-route'],bad?0:progress(t,21.5,22.2));
    const query=pointOnPath(l.queryRoute,ease(progress(t,22.5,25.5)));
    move(nodes['query-packet'],query.x,query.y);
    opacity(nodes['query-packet'],!bad&&t>=22.5&&t<25.7?1-progress(t,25.4,25.7):0);
    opacity(nodes['matched-row'],bad?0:progress(t,25.3,25.8));
    opacity(nodes['receipt-route'],bad?0:progress(t,25.5,26));
    const price=curve({x:l.tableX+l.tableW-40,y:l.tableY+66},{x:l.receiptX+l.receiptW/2,y:l.receiptY+15},ease(progress(t,25.8,27.2)),0);
    move(nodes['price-packet'],price.x,price.y);
    opacity(nodes['price-packet'],!bad&&t>=25.8&&t<27.2?1:0);
    opacity(nodes['receipt-printer'],failed?0:1);
    attr(nodes['receipt-reveal'],'height',bad?0:156*ease(progress(t,27,29.4)));
    opacity(nodes['retry-message'],Number(failed));
    const [cue,caption]=narration(t,bad);
    text($('cue'),cue);
    text($('caption'),caption);
    if(cue!==lastCue){text($('announcement'),caption);lastCue=cue;}
    $('timeline').value=t.toFixed(2);
    $('timeline').style.setProperty('--progress',`${t/duration*100}%`);
    $('timeline').setAttribute('aria-valuetext',`${t.toFixed(1)} seconds of 30. ${cue.toLowerCase()}.`);
    text($('time'),`${timeLabel(t)} / 00:30`);
    syncPlay();
  }
  function syncPlay() {
    text($('play'),state.playing?'[ pause ]':state.time>=duration?'[ replay ]':'[ play ]');
    $('play').setAttribute('aria-pressed',String(state.playing));
  }
  function pause() {
    state.playing=false;
    cancelAnimationFrame(frame);
    frame=0;
    syncPlay();
  }
  function tick(now) {
    if(!state.playing)return;
    state.time=Math.min(duration,state.time+(now-lastTick)/1000*state.speed);
    lastTick=now;
    render();
    if(state.time>=duration)pause();
    else frame=requestAnimationFrame(tick);
  }
  function play() {
    if(state.playing){pause();return;}
    if(state.time>=duration){state.time=0;render();}
    state.playing=true;
    lastTick=performance.now();
    syncPlay();
    frame=requestAnimationFrame(tick);
  }
  $('play').addEventListener('click',play);
  $('restart').addEventListener('click',() => {pause();state.time=0;render();});
  $('timeline').addEventListener('input',event => {pause();state.time=Math.max(0,Math.min(duration,Number(event.target.value)));render();});
  $('speed').addEventListener('change',event => {state.speed=Number(event.target.value);lastTick=performance.now();});
  $('scenario').addEventListener('change',event => {pause();state.scenario=event.target.value;render();});
  document.addEventListener('visibilitychange',() => {if(document.hidden)pause();});
  window.addEventListener('pagehide',pause);
  let mobile=window.innerWidth<=700;
  window.addEventListener('resize',() => {const next=window.innerWidth<=700;if(next!==mobile){mobile=next;build();}});
  build();
  syncPlay();
})();
