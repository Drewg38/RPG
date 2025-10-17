/* game.js | Daily RPG — extracted from inline <script>
   Edits:
   1) Data override: use window.DAILY_RPG_SCENARIOS if present.
   2) Dice: use window.rollD20({...}) if provided; fallback to Math.random.
   3) Logging hook: window.logSelection?.({...})
*/

/*************************
 * Boot & Guards
 *************************/
const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
const canvas = document.getElementById('stage');
const ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
if(!canvas || !ctx){
  document.body.innerHTML = '<div style="color:#fff;padding:24px;font:16px system-ui">Canvas not supported in this view.</div>';
}

/*************************
 * Text wrapping (returns y) — regex-free for editor safety
 *************************/
function splitWords(txt){
  let s = String(txt==null? '': txt);
  let out = '';
  let prevSpace = false;
  for (let i=0; i<s.length; i++){
    const ch = s[i];
    const isWS = ch <= ' ';
    if (isWS){ if (!prevSpace){ out += ' '; prevSpace = true; } }
    else { out += ch; prevSpace = false; }
  }
  out = out.trim();
  return out ? out.split(' ') : [];
}
function wrapHeight(text, maxWidth, lineHeight, font){
  const prev = ctx.font; if (font) ctx.font = font;
  const words = splitWords(text); let line = '', h = lineHeight;
  for(let i=0;i<words.length;i++){
    const test = line + words[i] + ' ';
    if (ctx.measureText(test).width > maxWidth){ line = words[i] + ' '; h += lineHeight; } else { line = test; }
  }
  if (font) ctx.font = prev; return h;
}
function wrapText(text, x, y, maxWidth, lineHeight, font){
  const prev = ctx.font; if (font) ctx.font = font;
  const words = splitWords(text); let line='';
  for (let i=0;i<words.length;i++){
    const test = line + words[i] + ' ';
    if (ctx.measureText(test).width > maxWidth){ ctx.fillText(line, x, y); line = words[i] + ' '; y += lineHeight; }
    else { line = test; }
  }
  ctx.fillText(line, x, y);
  if (font) ctx.font = prev; return y + lineHeight;
}
function roundRectPath(x,y,w,h,r){
  r = Math.max(0, r||10);
  ctx.beginPath(); ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
}
function inRect(mx,my,r){ return r && mx>=r.x && mx<=r.x+r.w && my>=r.y && my<=r.y+r.h; }
function clamp(n,min,max){ return Math.max(min, Math.min(max, n)); }
function choiceTitle(str){ if(!str) return ''; const i = str.indexOf('—')>=0 ? str.indexOf('—') : str.indexOf(' - '); const t = i>0 ? str.slice(0,i).trim() : str.trim(); return t.replace(/[.?!]$/,''); }

/*************************
 * Data  (allow external override via window.DAILY_RPG_SCENARIOS)
 *************************/
const DEFAULT_SCENARIOS = [
  { title: 'INCOMING DISTRESS CALL',
    flavor:[
      'A priority SOS cuts through the static: freighter Nomad is limping through the Arcfield Belt. The message is interleaved with an unfamiliar handshake—alien or a rogue drone mesh, you can’t tell.',
      'Warning lights bloom crimson across your console as micro-meteors spark against the shields. The beacon pings from inside a debris cloud where radio dies and things learn to hide.',
      'A silhouette clings to the Nomad’s hull—too many legs, moving when you move. It watches your approach like a spider tasting the web.'
    ],
    choices:[
      'Answer the hail and match orbit — burn toward the Nomad, broadcast a friendly key, and prep to board. Body over caution.',
      'Trace the handshake — hang back at range and dissect the signal for origin and intent. If it’s a trap, you’ll see the teeth first.',
      'Power down and drift — cut lights and emissions, let momentum carry you across the cloud to observe. Patience buys the truth.'
    ],
    activities:[{name:'Calibrated Thrusters',bonus:1},{name:'Synced Nav Charts',bonus:1},{name:'Recharged Shields',bonus:1},{name:'System Diagnostics',bonus:1},{name:'Secured Airlock',bonus:1}]
  },
  { title:'STATIONWIDE DANGER ALERT',
    flavor:[
      'Dock 7 reports a hull microfracture. Maintenance drones are looping directives and sealing the wrong bulkheads.',
      'Air sirens slice the station spine; temperature drops; arc lights strobe. Someone is still on the exterior catwalk, suit pressure trending low.',
      'An old cargo mech boots into failsafe, its sensor mast sweeping the bay like a lighthouse looking for trespassers.'
    ],
    choices:[
      'Seal the breach manually — grab mag-clamps and foam; beat the drones on foot before they weld the wrong doors shut.',
      'Hijack the maintenance net — patch into the drone mesh and push a hotfix. If it takes, everything calms at once.',
      'Evacuate the bay — pull everyone back and hard-lock Dock 7. You’ll lose time but save lives and options.'
    ],
    activities:[{name:'Calibrated Thrusters',bonus:1},{name:'Synced Nav Charts',bonus:1},{name:'Recharged Shields',bonus:1},{name:'System Diagnostics',bonus:1},{name:'Secured Airlock',bonus:1}]
  },
  { title:'GHOST SIGNAL AT RELAY THETA-3',
    flavor:[
      'A relay on the dark side of the moon answers with your captain’s voice—even though your captain stands right beside you.',
      'Telemetry claims the relay is decades out of date, yet the logs roll forward to today. The checksum includes an orbital map you don’t recognize.',
      'A flock of survey bots floats dead around the relay, scraped clean like shells on a beach; something has been harvesting parts.'
    ],
    choices:[
      'Approach and request docking — if it’s friendly, you’ll know; if not, you’ll learn fast and close.',
      'Send a probe — let a drone knock first while you watch from a safe vector.',
      'Spoof credentials — pretend to be the original installer and see which doors open.'
    ],
    activities:[{name:'Calibrated Thrusters',bonus:1},{name:'Synced Nav Charts',bonus:1},{name:'Recharged Shields',bonus:1},{name:'System Diagnostics',bonus:1},{name:'Secured Airlock',bonus:1}]
  }
];
const scenarios = (Array.isArray(window.DAILY_RPG_SCENARIOS) && window.DAILY_RPG_SCENARIOS.length) ? window.DAILY_RPG_SCENARIOS : DEFAULT_SCENARIOS;

const dayIndex = Math.floor(Date.now()/(24*3600e3)) % scenarios.length;
const data = JSON.parse(JSON.stringify(scenarios[dayIndex]));
// Append richer flavor and choice blurbs (non-destructive)
try{
  data.flavor = (data.flavor||[]).concat([
    'Your ship hums like a held breath. Through the canopy, particles trail like rain across glass, thin and silver. The nav computer offers three safe trajectories and none of them feel right.',
    'Crew chatter thins to a few clipped words—checklists, confirmations, the ritual before a leap. Somewhere in the static, something answers in your own voice. It is patient.'
  ]);
  if(Array.isArray(data.choices)){
    const ext=[
      ' Push the burn hard, ride the thermal wake, and trust your timing. If there is a moment to act without flinching, this is it.',
      ' Keep your distance and peel the signal like an onion—layer by layer until the core pattern is exposed. If it lies, you will catch the seam.',
      ' Go dim, coast through shadow, and watch. In the quiet, every vibration tells a story; patience is a tool, not a delay.'
    ];
    data.choices = data.choices.map((t,i)=> (t||'') + ext[i]);
  }
}catch(_){ /* safe */ }

/*************************
 * Images (safe-load)
 *************************/
let planetImg = new Image(); planetImg.crossOrigin='anonymous'; let planetLoaded=false;
function loadPlanet(url){
  planetLoaded=false; const im=new Image(); im.crossOrigin='anonymous';
  im.onload = async()=>{ try{ if(im.decode) await im.decode(); }catch(_){}
    planetImg = im; planetLoaded = im.naturalWidth>0; resizeCanvas(); };
  im.onerror = ()=>{ planetLoaded=false; resizeCanvas(); };
  im.src = url;
}
loadPlanet('https://images.unsplash.com/photo-1462331940025-496dfbfc7564?q=80&w=1600&auto=format&fit=crop');
window.setHeaderImage = (u)=> loadPlanet(u);

const itemURLs = [
  'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=400&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1505577058444-a3dab90d4253?q=80&w=400&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1506126613408-eca07ce68773?q=80&w=400&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=400&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1511732351157-1865efcb7b7b?q=80&w=400&auto=format&fit=crop'
];
const itemImgs=[]; const itemReady=[];
for(let i=0;i<itemURLs.length;i++){
  const im=new Image(); im.crossOrigin='anonymous'; itemImgs[i]=im; itemReady[i]=false;
  im.onload = async()=>{ try{ if(im.decode) await im.decode(); }catch(_){} itemReady[i]=im.naturalWidth>0; };
  im.onerror = ()=>{ itemReady[i]=false; };
  im.src = itemURLs[i];
}

/*************************
 * State
 *************************/
const state = {
  scenario:data,
  selectedChoice:-1,
  activities:data.activities.slice(0,4).map(a=>({...a,checked:false})),
  stats:{Mind:0,Body:0,Spirit:0,Luck:0},
  d20:{x:0,y:0,r:52,vx:0,vy:0,ang:0,vang:0,grabbed:false,value:null,last:{x:0,y:0}},
  rects:{scene:null,choicesHeader:null,choices:[],actsHeader:null,checks:[],statsBox:null,tray:null,trayHint:null,result:null},
  resultText:'After you\\'ve made your choice, click and drag the die to shake and roll it.',
  // UPDATED: longer placeholder copy that will render UNDER the success/failure line
  extraOutcome:[
    '— Placeholder outcome details —',
    'Use this space to jot down consequences, loot, conditions, NPC reactions, time cost, and next steps. Keep it short now; refine later.',
    'Examples:',
    '• If failure: what went wrong, what got harder, and one way to recover next time.\\n• If success: what you gained, what changed in the scene, and a new lead to pursue.',
    'Criticals:',
    '• Critical Failure: lasting complication, narrative twist, or resource loss to track tomorrow.\\n• Critical Success: permanent boon, helpful contact, or a shortcut unlocked.',
    'GM notes: jot DCs, why advantage/disadvantage applied, and a follow-up you’ll check tomorrow.',
    'Player notes: what you’ll try next, resources spent, and a quick reminder for future-you.'
  ].join('\\n\\n'),
  storyText:'',
  contentBottom:0,
  starCanvas:null,
  starBuiltFor:{w:0,h:0}
};

/*************************
 * Layout (auto-grow)
 *************************/
function layout(){
  const W = (canvas.width||960)/DPR; const pad=16; const lineH=18;
  // 1) Scene
  const imgH=280; const textMaxW=W - pad*2 - 28; let sceneTextH=28;
  for(const p of state.scenario.flavor){ sceneTextH += wrapHeight(p, textMaxW, lineH, '14px system-ui, sans-serif') + 8; }
  state.rects.scene = {x:pad,y:pad,w:W - pad*2,h:12 + imgH + 12 + 26 + sceneTextH + 2};

  // 2) Columns — items+stats (left), tray (right)
  const actsY = state.rects.scene.y + state.rects.scene.h - 8;
  const actsW = Math.floor((W - pad*3)*0.48);
  const rowH = 80;
  state.rects.actsHeader = {x:pad, y:actsY, w:actsW, h:24};
  const actsStartY = actsY + state.rects.actsHeader.h + 6; // first item top
  state.rects.checks = state.activities.map((_,i)=>({x:pad, y:actsStartY + i*rowH, w:actsW, h:rowH}));

  const checksBottomY = state.rects.checks.length ? (state.rects.checks[state.rects.checks.length-1].y + rowH) : actsStartY;
  state.rects.statsBox = {x:pad, y:checksBottomY, w:actsW, h:120};

  const trayX = pad + actsW + pad; const trayW = W - trayX - pad;
  const trayTop = actsStartY; // align to first item
  const trayBottom = state.rects.statsBox.y + state.rects.statsBox.h; // align to bottom of stats
  const trayH = Math.max(120, trayBottom - trayTop);
  state.rects.tray = {x:trayX,y:trayTop,w:trayW,h:trayH};
  state.rects.trayHint = {x:trayX,y:trayTop+trayH+16,w:trayW,h:18};
  state.d20.x = state.rects.tray.x + state.rects.tray.w/2; state.d20.y = state.rects.tray.y + state.rects.tray.h/2;

  // 3) Choices — below columns
  const gap=12; const cW=Math.floor((W - pad*2 - gap*2)/3);
  const columnsBottom = Math.max(state.rects.tray.y + state.rects.tray.h, state.rects.statsBox.y + state.rects.statsBox.h);
  const choiceY = columnsBottom + 24;
  state.rects.choicesHeader = {x:pad,y:choiceY,w:W - pad*2,h:24};
  state.rects.choices = [];
  for(let i=0;i<3;i++){
    const txt = state.scenario.choices[i]||'';
    const labelH=22, topPad=12, gapAfterLabel=8, bottomPad=12, gapBeforePill=10;
    const mainH = wrapHeight(txt, cW-28, 18, '600 14px system-ui, sans-serif');
    const sub = i===0 ? "I'm gonna need some Mind for this." : i===1 ? "I'm going to need some Body for this." : i===2 ? "I'm going to need some Spirit for this." : '';
    const pillTextW = cW - 24 - 16;
    const pillTextH = sub ? wrapHeight(sub, pillTextW, 16, '800 14px system-ui, sans-serif') : 0;
    const pillH = sub ? Math.max(18, pillTextH + 6) : 0;
    const h = Math.ceil(topPad + labelH + gapAfterLabel + mainH + (sub ? (gapBeforePill + pillH) : 0) + bottomPad);
    state.rects.choices.push({x:pad + i*(cW+gap), y:choiceY+40, w:cW, h});
  }
  const choicesBottom = Math.max(...state.rects.choices.map(r=>r.y+r.h));
  // 4) Result — below choices (add a bit more breathing room)
  const textW = W - pad*2 - 10;
  const resultH = 36;
  const storyH = state.storyText ? wrapHeight(state.storyText, textW, lineH, '14px system-ui, sans-serif') + 16 : 0;
  const resH = resultH + storyH + 20;
  // Place hint just below the options, then the result under the hint
  state.rects.trayHint = {x:pad, y: choicesBottom + 20, w: W - pad*2, h:20};
  state.rects.result = {x:pad, y: state.rects.trayHint.y + state.rects.trayHint.h + 36, w: W - pad*2, h:resH};
  // Move the hint line above the outcome/result box
  /* trayHint already positioned beneath the options above */
  state.contentBottom = state.rects.result.y + state.rects.result.h + pad;
}
function ensureCanvasFits(){
  let guard=0; while(guard++<4){
    const need=Math.ceil(state.contentBottom);
    const cssH=parseFloat(canvas.style.height)||((canvas.height||640)/DPR);
    if(need>cssH+1){ canvas.style.height=need+'px'; canvas.height=Math.floor(need*DPR); ctx.setTransform(DPR,0,0,DPR,0,0); layout(); continue; }
    break;
  }
}
function resizeCanvas(){
  const rect = canvas.getBoundingClientRect();
  const cssW = rect.width || canvas.clientWidth || 960;
  const cssH = Math.round(cssW * 2/3);
  canvas.style.height = cssH + 'px';
  canvas.width = Math.floor(cssW * DPR);
  canvas.height = Math.floor(cssH * DPR);
  ctx.setTransform(DPR,0,0,DPR,0,0);
  // Build a safe starfield (offscreen) only when size changes
  try{
    const needW = canvas.width, needH = canvas.height;
    if(!state.starCanvas || state.starBuiltFor.w !== needW || state.starBuiltFor.h !== needH){
      const oc = document.createElement('canvas');
      oc.width = needW; oc.height = needH;
      const c2 = oc.getContext('2d');
      c2.clearRect(0,0,needW,needH);
      // Star density — balanced for perf; increase/decrease divisor to tune
      const count = Math.floor((needW * needH) / 6000);
      for(let i=0;i<count;i++){
        const x = Math.random()*needW, y = Math.random()*needH;
        const r = Math.random()*1.2 + 0.3;
        c2.globalAlpha = 0.35 + Math.random()*0.65;
        c2.beginPath(); c2.arc(x,y,r,0,Math.PI*2);
        c2.fillStyle = Math.random() < 0.10 ? '#bcd4ff' : '#ffffff';
        c2.fill();
      }
      // extra margin stars on left/right bands
      const band = Math.floor(count * 0.25);
      for(let i=0;i<band;i++){
        const left = i % 2 === 0;
        const x = left ? Math.random()*Math.max(needW*0.08, 40) : needW - Math.random()*Math.max(needW*0.08, 40);
        const y = Math.random()*needH;
        const r = Math.random()*1.4 + 0.4;
        c2.globalAlpha = 0.45 + Math.random()*0.55;
        c2.beginPath(); c2.arc(x,y,r,0,Math.PI*2);
        c2.fillStyle = Math.random() < 0.2 ? '#cfe1ff' : '#ffffff';
        c2.fill();
      }
      // occasional soft glows
      const glows = Math.max(16, Math.floor(count*0.03));
      for(let i=0;i<glows;i++){
        const x = Math.random()*needW, y = Math.random()*needH;
        const r = Math.random()*2.4 + 1.2;
        const g = c2.createRadialGradient(x,y,0,x,y,r);
        g.addColorStop(0,'rgba(255,255,255,0.7)');
        g.addColorStop(1,'rgba(255,255,255,0)');
        c2.fillStyle = g; c2.beginPath(); c2.arc(x,y,r,0,Math.PI*2); c2.fill();
      }
      state.starCanvas = oc;
      state.starBuiltFor = {w:needW, h:needH};
    }
  }catch(_){ state.starCanvas = null; }
  layout(); ensureCanvasFits();
}
window.addEventListener('resize', resizeCanvas);

/*************************
 * Draw pipeline
 *************************/
function draw(){
  const W = canvas.width / DPR; const H = canvas.height / DPR;
  ctx.clearRect(0,0,W,H);
  if(state.starCanvas){
    try{ ctx.drawImage(state.starCanvas, 0, 0, W, H); }catch(_){ /* ignore draw failure */ }
  }
  // Safe draw order matches layout
  drawScene();
  drawActivities();
  drawStatsBox();
  drawTray();
  drawChoices();
  drawHint();
  drawResult();
}

function drawScene(){
  const r = state.rects.scene; if(!r) return; /* scene card removed per request */
  const inner={x:r.x,y:r.y,w:r.w,h:280}; roundRectPath(inner.x,inner.y,inner.w,inner.h,12); ctx.save(); ctx.clip();
  if(planetLoaded && planetImg.naturalWidth>0){ try{ ctx.drawImage(planetImg, inner.x, inner.y, inner.w, inner.h); }catch(_){} }
  else{ const g=ctx.createLinearGradient(inner.x,inner.y,inner.x,inner.y+inner.h); g.addColorStop(0,'#1e293b'); g.addColorStop(1,'#0b132b'); ctx.fillStyle=g; ctx.fillRect(inner.x,inner.y,inner.w,inner.h); }
  ctx.restore();
  let y = inner.y+inner.h+26; const x=r.x+14; ctx.save();
  const titleGrad = ctx.createLinearGradient(x, y-18, x+320, y+6);
  titleGrad.addColorStop(0,'#93c5fd');
  titleGrad.addColorStop(0.5,'#c4b5fd');
  titleGrad.addColorStop(1,'#a78bfa');
  ctx.fillStyle = titleGrad;
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 8;
  ctx.font='800 22px system-ui, sans-serif';
  ctx.fillText(state.scenario.title, x, y);
  ctx.restore();
  y+=26;
  ctx.fillStyle='#c5cbd6'; for(const p of state.scenario.flavor){ y = wrapText(p, x, y, r.w-28, 18, '14px system-ui, sans-serif'); y += 6; }
}

function drawChoices(){
  const h=state.rects.choicesHeader; if(!h || !state.rects.choices || !state.rects.choices.length) return; const ghGrad = ctx.createLinearGradient(h.x, h.y, h.x+420, h.y+24);
  ghGrad.addColorStop(0,'#93c5fd');
  ghGrad.addColorStop(1,'#c4b5fd');
  ctx.fillStyle = ghGrad;
  ctx.font='800 20px system-ui, sans-serif';
  ctx.fillText('What you would like to do?', h.x, h.y+18);
  for(const [i,rect] of state.rects.choices.entries()){
    roundRectPath(rect.x,rect.y,rect.w,rect.h,12); ctx.save(); ctx.globalAlpha=0.62; ctx.fillStyle=(state.selectedChoice===i)?'#2b3150':'#141922'; ctx.fill(); ctx.restore();
    ctx.strokeStyle=(state.selectedChoice===i)?'#7c3aed':'#202836'; ctx.lineWidth=2; ctx.stroke();
    // Option label at top of each card
    { const label = ['Option A','Option B','Option C'][i];
      const lg = ctx.createLinearGradient(rect.x, rect.y, rect.x+120, rect.y+20);
      lg.addColorStop(0,'#93c5fd'); lg.addColorStop(1,'#c4b5fd');
      ctx.fillStyle = lg; ctx.font='800 16px system-ui, sans-serif';
      ctx.fillText(label, rect.x+14, rect.y+22);
    }
    ctx.fillStyle='#e6e9ef'; wrapText(state.scenario.choices[i]||'—', rect.x+14, rect.y+44, rect.w-28, 18, '600 14px system-ui, sans-serif');
    // Commentary pill matching header gradient
    const sub = i===0 ? "I'm gonna need some Mind for this." : i===1 ? "I'm going to need some Body for this." : i===2 ? "I'm going to need some Spirit for this." : '';
    if(sub){
      const px = rect.x + 12; const pw = rect.w - 24;
      const subH = wrapHeight(sub, pw - 16, 16, '800 14px system-ui, sans-serif');
      const ph = Math.max(18, subH + 6);
      const py = rect.y + rect.h - (ph + 6);
      roundRectPath(px, py, pw, ph, 8);
      ctx.fillStyle = 'rgba(20,24,33,0.9)'; ctx.fill();
      ctx.strokeStyle = '#202836'; ctx.lineWidth=1; ctx.stroke();
      const sGrad = ctx.createLinearGradient(px, py, px+260, py+ph);
      sGrad.addColorStop(0,'#93c5fd'); sGrad.addColorStop(1,'#c4b5fd');
      ctx.fillStyle = sGrad; ctx.font='700 12px system-ui, sans-serif';
      wrapText(sub, px+8, py+13, pw-16, 16, '800 14px system-ui, sans-serif');
    }
  }
}

function drawActivities(){
  const hh=state.rects.actsHeader; if(!hh || !state.rects.checks || !state.rects.checks.length) return; const actGrad = ctx.createLinearGradient(hh.x, hh.y, hh.x+240, hh.y+24);
  actGrad.addColorStop(0,'#93c5fd');
  actGrad.addColorStop(1,'#c4b5fd');
  ctx.fillStyle = actGrad;
  ctx.font='800 20px system-ui, sans-serif';
  ctx.fillText('What preparation have you done today?', hh.x, hh.y+18);
  ctx.font='14px system-ui, sans-serif';
  for(let i=0;i<state.rects.checks.length;i++){
    const rect=state.rects.checks[i]; const a=state.activities[i];
    roundRectPath(rect.x,rect.y,rect.w,rect.h,10); const g=ctx.createLinearGradient(rect.x,rect.y,rect.x,rect.y+rect.h);
    g.addColorStop(0,'#101624'); g.addColorStop(1,'#0c111c'); ctx.save(); ctx.globalAlpha=0.62; ctx.fillStyle=g; ctx.fill(); ctx.restore(); ctx.strokeStyle='#222937'; ctx.stroke();
    const img={x:rect.x+10,y:rect.y+12,w:110,h:56}; roundRectPath(img.x,img.y,img.w,img.h,6); ctx.save(); ctx.clip();
    const im=itemImgs[i]; if(im && itemReady[i] && im.naturalWidth>0){ try{ ctx.drawImage(im,img.x,img.y,img.w,img.h); }catch(_){ ctx.fillStyle='#182133'; ctx.fillRect(img.x,img.y,img.w,img.h);} } else { ctx.fillStyle='#182133'; ctx.fillRect(img.x,img.y,img.w,img.h); } ctx.restore();
    const box={x:img.x+img.w+16,y:rect.y + Math.floor((rect.h-26)/2),w:26,h:26}; roundRectPath(box.x,box.y,box.w,box.h,5);
    ctx.fillStyle=a.checked?'#10b981':'#0f1420'; ctx.fill(); ctx.strokeStyle=a.checked?'#34d399':'#2a3345'; ctx.lineWidth=2; ctx.stroke();
    ctx.fillStyle='#d6d9e0'; ctx.save(); ctx.font='600 16px system-ui, sans-serif'; ctx.textBaseline='middle'; ctx.fillText(a.name, box.x+36, rect.y + rect.h/2); ctx.restore();
  }
  }

function drawStatsBox(){ const r=state.rects.statsBox; if(!r) return; const padX=12; const rowH=28; const names=['Mind','Body','Spirit','Luck']; const vals=[(state.stats&&state.stats.Mind)||0,(state.stats&&state.stats.Body)||0,(state.stats&&state.stats.Spirit)||0,(state.stats&&state.stats.Luck)||0];
  // Card background styled like items
  roundRectPath(r.x,r.y,r.w,r.h,10); const g=ctx.createLinearGradient(r.x,r.y,r.x,r.y+r.h); g.addColorStop(0,'#101624'); g.addColorStop(1,'#0c111c'); ctx.save(); ctx.globalAlpha=0.62; ctx.fillStyle=g; ctx.fill(); ctx.restore(); ctx.strokeStyle='#222937'; ctx.stroke();
  // (no header/image) compact meter-only card
  const startY=r.y+12; const meterX=r.x+140; const meterW=r.w - (meterX - r.x) - 12; const max=5;
  for(let i=0;i<names.length;i++){ const y=startY + i*rowH; ctx.fillStyle='#e6e9ef'; ctx.font='700 16px system-ui, sans-serif'; const plus = vals[i]>0 ? ` (+${vals[i]})` : '';
    ctx.fillText(names[i]+plus, r.x+padX, y+12);
    // meter bg
    roundRectPath(meterX, y, meterW, 12, 6); const mbg=ctx.createLinearGradient(meterX,y,meterX,y+12); mbg.addColorStop(0,'#0f1420'); mbg.addColorStop(1,'#0b1018'); ctx.fillStyle=mbg; ctx.fill(); ctx.strokeStyle='#283146'; ctx.stroke();
    // meter fill
    const ratio=Math.max(0,Math.min(1, vals[i]/max)); const fillW=Math.max(0, Math.floor(meterW * ratio)); if(fillW>0){ roundRectPath(meterX, y, fillW, 12, 6); const mf=ctx.createLinearGradient(meterX,y,meterX+fillW,y); mf.addColorStop(0,'#3b82f6'); mf.addColorStop(1,'#8b5cf6'); ctx.fillStyle=mf; ctx.fill(); }
  }
}

function drawTray(){
  const r=state.rects.tray; if(!r) return; const d=state.d20; roundRectPath(r.x,r.y,r.w,r.h,14);
  const edge=ctx.createLinearGradient(r.x,r.y,r.x,r.y+r.h); edge.addColorStop(0,'rgba(43,49,64,0.30)'); edge.addColorStop(1,'rgba(26,31,42,0.20)'); ctx.fillStyle=edge; ctx.fill();
  roundRectPath(r.x+8,r.y+8,r.w-16,r.h-16,10); const deck=ctx.createLinearGradient(r.x,r.y,r.x,r.y+r.h);
  deck.addColorStop(0,'rgba(12,17,26,0.18)'); deck.addColorStop(1,'rgba(10,13,18,0.14)'); ctx.fillStyle=deck; ctx.fill();
  // Accent outer gradient border
  (function(){ const gg = ctx.createLinearGradient(r.x, r.y, r.x+r.w, r.y);
    gg.addColorStop(0,'rgba(124,58,237,0.25)');
    gg.addColorStop(1,'rgba(96,165,250,0.25)');
    ctx.save(); ctx.lineWidth=1.5; ctx.strokeStyle=gg; roundRectPath(r.x+0.5, r.y+0.5, r.w-1, r.h-1, 14); ctx.stroke(); ctx.restore();
  })();
  // Sleek overlays: soft gloss + inner border
  ctx.strokeStyle='rgba(255,255,255,0.05)';
  ctx.lineWidth=1; ctx.stroke();
  ctx.save();
  roundRectPath(r.x+10, r.y+10, r.w-20, (r.h-20)*0.4, 10);
  const gloss = ctx.createLinearGradient(r.x, r.y, r.x, r.y + (r.h-20)*0.4);
  gloss.addColorStop(0,'rgba(255,255,255,0.12)');
  gloss.addColorStop(1,'rgba(255,255,255,0.02)');
  ctx.fillStyle=gloss; ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.globalAlpha=0.6; ctx.strokeStyle='rgba(148,163,184,0.18)';
  roundRectPath(r.x+8, r.y+8, r.w-16, r.h-16, 12); ctx.stroke();
  ctx.restore();
  if(!d.grabbed){
    d.x+=d.vx; d.y+=d.vy; d.ang+=d.vang; const pad=10;
    if(d.x-d.r<=r.x+pad){ d.x=r.x+pad+d.r; d.vx*=-0.93; d.vang*=-0.93; }
    if(d.y-d.r<=r.y+pad){ d.y=r.y+pad+d.r; d.vy*=-0.93; d.vang*=-0.93; }
    if(d.x+d.r>=r.x+r.w-pad){ d.x=r.x+r.w-pad-d.r; d.vx*=-0.93; d.vang*=-0.93; }
    if(d.y+d.r>=r.y+r.h-pad){ d.y=r.y+r.h-pad-d.r; d.vy*=-0.93; d.vang*=-0.93; }
    d.vx*=0.994; d.vy*=0.994; d.vang*=0.994; if(Math.hypot(d.vx,d.vy)<0.05 && Math.abs(d.vang)<0.012){ d.vx=d.vy=d.vang=0; }
  }
  drawD20(d.x,d.y,d.r,d.ang,d.value);
}
function drawHint(){ const h=state.rects.trayHint; if(!h) return; const grad=ctx.createLinearGradient(h.x, h.y, h.x+h.w, h.y+24); grad.addColorStop(0,'#93c5fd'); grad.addColorStop(1,'#c4b5fd'); ctx.save(); ctx.fillStyle=grad; ctx.shadowColor='rgba(0,0,0,0.35)'; ctx.shadowBlur=8; ctx.font='800 20px system-ui, sans-serif'; ctx.textAlign='start';
  ctx.fillText("After you've made your choice, click and drag the die to shake and roll it.", h.x, h.y+18); ctx.restore(); }

// UPDATED: order so the placeholder text appears UNDER the result (success/failure)
function drawResult(){
  const r=state.rects.result; if(!r) return; let y=r.y; const textW=r.w-10;
  // No background box — just text, bolded
  if(state.d20 && state.d20.value!=null){
    const g=ctx.createLinearGradient(r.x,y,r.x+320,y+24); g.addColorStop(0,'#93c5fd'); g.addColorStop(1,'#a78bfa');
    ctx.save(); ctx.fillStyle=g; ctx.shadowColor='rgba(0,0,0,0.35)'; ctx.shadowBlur=8;
    y = wrapText(state.resultText, r.x, y+6, textW, 28, '800 22px system-ui, sans-serif');
    ctx.restore(); y+=6;
    if(state.storyText){ ctx.fillStyle='#e6e9ef'; y = wrapText(state.storyText, r.x, y, textW, 18, '700 14px system-ui, sans-serif'); }
  }
}


/*************************
 * D20 renderer
 *************************/
function drawD20(cx,cy,r,ang,value){
  const body=ctx.createRadialGradient(cx-r*0.4,cy-r*0.4,r*0.3,cx,cy,r); body.addColorStop(0,'#9de1ff'); body.addColorStop(0.6,'#5ea7ff'); body.addColorStop(1,'#6d42ff');
  ctx.save(); ctx.translate(cx,cy); ctx.rotate(ang); ctx.beginPath();
  for(let i=0;i<20;i++){ const a=(i/20)*Math.PI*2; const rr=r*(0.9+0.08*Math.sin(i*1.7)); const x=Math.cos(a)*rr, y=Math.sin(a)*rr; if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); }
  ctx.closePath(); ctx.fillStyle=body; ctx.save(); ctx.shadowColor='rgba(0,0,0,0.40)'; ctx.shadowBlur=14; ctx.shadowOffsetX=0; ctx.shadowOffsetY=4; ctx.fill(); ctx.restore(); ctx.globalAlpha=0.35; ctx.strokeStyle='#0b0c10'; ctx.lineWidth=1; ctx.stroke(); ctx.globalAlpha=1;
  const num = value==null? '' : String(value); ctx.fillStyle='#0b0c10'; ctx.font=`bold ${Math.floor(r*0.7)}px system-ui, sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(num,0,2);
  ctx.globalAlpha=0.25; ctx.beginPath(); ctx.ellipse(-r*0.2,-r*0.2,r*0.7,r*0.35,-0.7,0,Math.PI*2); ctx.fillStyle='#ffffff'; ctx.fill(); ctx.globalAlpha=1; ctx.restore();
  ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(cx+6, cy+8, r*0.9, r*0.3, 0, 0, Math.PI*2); ctx.fill();
}

/*************************
 * Interaction
 *************************/
// Stats recompute helper (maps first 4 activities → Mind, Body, Spirit, Luck)
function recomputeStats(){
  const names=['Mind','Body','Spirit','Luck'];
  const s={Mind:0,Body:0,Spirit:0,Luck:0};
  for(let i=0;i<state.activities.length && i<4;i++){ if(state.activities[i].checked){ s[names[i]] += 1; } }
  state.stats = s;
}

canvas.addEventListener('click', (e)=>{
  const rect=canvas.getBoundingClientRect(); const mx=(e.clientX-rect.left)*(canvas.width/rect.width)/DPR; const my=(e.clientY-rect.top)*(canvas.height/rect.height)/DPR;
  for(let i=0;i<state.rects.choices.length;i++){ if(inRect(mx,my,state.rects.choices[i])) state.selectedChoice=i; }
  for(let i=0;i<state.rects.checks.length;i++){
    if(inRect(mx,my,state.rects.checks[i])){ state.activities[i].checked=!state.activities[i].checked; recomputeStats(); layout(); ensureCanvasFits(); }
  }
});
canvas.addEventListener('mousedown', (e)=>{
  const rect=canvas.getBoundingClientRect(); const mx=(e.clientX-rect.left)*(canvas.width/rect.width)/DPR; const my=(e.clientY-rect.top)*(canvas.height/rect.height)/DPR; const d=state.d20; const r=state.rects.tray;
  if(inRect(mx,my,r) && Math.hypot(mx-d.x,my-d.y)<=d.r){ d.grabbed=true; d.last.x=mx; d.last.y=my; d.vx=d.vy=d.vang=0; }
});
window.addEventListener('mousemove', (e)=>{
  const d=state.d20; if(!d.grabbed) return; const rect=canvas.getBoundingClientRect(); const mx=(e.clientX-rect.left)*(canvas.width/rect.width)/DPR; const my=(e.clientY-rect.top)*(canvas.height/rect.height)/DPR; const r=state.rects.tray;
  d.x=clamp(mx, r.x+10+d.r, r.x+r.w-10-d.r); d.y=clamp(my, r.y+10+d.r, r.y+r.h-10-d.r);
  const dx=mx-d.last.x, dy=my-d.last.y; d.vx=dx*1.2; d.vy=dy*1.2; d.vang=(dx-dy)*0.04; d.last.x=mx; d.last.y=my;
});
window.addEventListener('mouseup', ()=>{
  const d=state.d20; if(!d.grabbed) return; d.grabbed=false; d.vx*=2.6; d.vy*=2.6; d.vang*=2.0;
  if(state.selectedChoice<0){ state.resultText='❗ Choose an option first.'; state.storyText=''; layout(); ensureCanvasFits(); return; }

  // Dice roll (pluggable): use external rollD20 if present, else default 1–20.
  let raw = 1 + Math.floor(Math.random()*20);
  if (typeof window.rollD20 === 'function') {
    try {
      const maybe = window.rollD20({ d: state.d20, stats: state.stats, choiceIndex: state.selectedChoice });
      raw = 1 + ((Math.floor(maybe)-1+20)%20); // clamp to 1..20 safely
    } catch(_) { /* keep default */ }
  }
  d.value = raw;

  const bonus=state.activities.reduce((s,a)=> s + (a.checked?a.bonus:0), 0); const total=raw+bonus; let tag,story;
  if(total<=5){ tag='Critical Failure'; story='Alarms cascade across the board. Defense drones vector on your position and the hull pings under stray fire. You break off and regroup, logging damage and lost time.' + '\\n\\n' + 'The crew speaks in half-sentences. A panel still smolders, the cabin smells like hot metal, and someone mutters that the signal felt too eager to be found.'; }
  else if(total<=10){ tag='Failure'; story='You steady the crisis but pay for it: scratched plating, drained cells, or a missed window. Mark a delay and note new complications in the sector.' + '\\n\\n' + 'You annotate the log: who noticed, what you lost, and the thread you can tug later. It isn\\'t the end—just a debt you\\'ll need to settle.'; }
  else if(total<=19){ tag='Success'; story='You cut through the noise and find a workable angle. Partial telemetry, a safe approach vector, or a small cache falls your way—enough to push forward.' + '\\n\\n' + 'Write down what changed: a new coordinate, a calmer channel, a door that no longer resists. Success opens time—spend it with care.'; }
  else { tag='Critical Success'; story='Everything lines up at once. The air feels lighter; you catch a perfect clue and stride ahead with confidence.' + '\\n\\n' + 'For a moment the ship feels weightless in a way that has nothing to do with gravity. Someone laughs—brief and real. You mark a boon and a clear way forward.'; }
  const choice=state.scenario.choices[state.selectedChoice]||'';
  state.resultText='You chose “'+choiceTitle(choice)+'”. D20='+raw+' + Bonus='+bonus+' → Total='+total+' ⇒ '+tag; state.storyText=story;

  // Optional: log to external sheet
  try {
    window.logSelection?.({ ts: Date.now(), scenarioTitle: state.scenario.title, choiceIndex: state.selectedChoice, raw, bonus, total, tag });
  } catch(_) {}

  layout(); ensureCanvasFits();
});

/*************************
 * Animate with try/catch guard
 *************************/
function loop(){ try{ draw(); }catch(err){ console.error('[draw error]', err); } requestAnimationFrame(loop); }
function boot(){ try{ resizeCanvas(); loop(); }catch(err){ console.error('[boot error]', err); }}
if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', boot); } else { boot(); }

// window error logging
window.addEventListener('error', e=>{ console.error('[window error]', e.message); });
