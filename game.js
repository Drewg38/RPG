/* game.js (v4) — CSV-only Canvas RPG with enhanced dice spin
   - Integrates diceSpin helpers so the die spins hard on bounces.
   - Uses squash & stretch + faint trail while moving, inspired by the CodePen.
*/
"use strict";

/* ===== Boot & guards ===== */
const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
const canvas = document.getElementById("stage");
const ctx = canvas && canvas.getContext ? canvas.getContext("2d") : null;
if(!canvas || !ctx){
  document.body.insertAdjacentHTML("beforeend","<div style=\"color:#fff;padding:24px;font:16px system-ui\">Canvas not supported in this view.</div>");
}

/* ===== helpers (measure/wrap/etc.) ===== */
function splitWords(txt){
  let s = String(txt==null? "" : txt), out="", prevSpace=false;
  for (let i=0;i<s.length;i++){
    const ch = s[i], isWS = ch <= " ";
    if (isWS){ if (!prevSpace){ out += " "; prevSpace = true; } }
    else { out += ch; prevSpace = false; }
  }
  out = out.trim();
  return out ? out.split(" ") : [];
}
function wrapHeight(text, maxWidth, lineHeight, font){
  const prev = ctx.font; if (font) ctx.font = font;
  const words = splitWords(text); let line = "", h = lineHeight;
  for(let i=0;i<words.length;i++){
    const test = line + words[i] + " ";
    if (ctx.measureText(test).width > maxWidth){ line = words[i] + " "; h += lineHeight; } else { line = test; }
  }
  if (font) ctx.font = prev; return h;
}
function wrapText(text, x, y, maxWidth, lineHeight, font){
  const prev = ctx.font; if (font) ctx.font = font;
  const words = splitWords(text); let line="";
  for (let i=0;i<words.length;i++){
    const test = line + words[i] + " ";
    if (ctx.measureText(test).width > maxWidth){ ctx.fillText(line, x, y); line = words[i] + " "; y += lineHeight; }
    else { line = test; }
  }
  ctx.fillText(line, x, y);
  if (font) ctx.font = prev; return y + lineHeight;
}
function roundRectPath(x,y,w,h,r){
  r = Math.max(0, r||10);
  ctx.beginPath(); ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}
function inRect(mx,my,r){ return r && mx>=r.x && mx<=r.x+r.w && my>=r.y && my<=r.y+r.h; }
function clamp(n,min,max){ return Math.max(min, Math.min(max, n)); }
function choiceTitle(str){ if(!str) return ""; const i = str.indexOf("—")>=0 ? str.indexOf("—") : str.indexOf(" - "); const t = i>0 ? str.slice(0,i).trim() : str.trim(); return t.replace(/[.?!]$/,""); }

/* ===== image loader ===== */
let headerImg = new Image(); headerImg.crossOrigin="anonymous"; let headerLoaded=false;
function loadHeader(url){
  headerLoaded=false; const im=new Image(); im.crossOrigin="anonymous";
  im.onload = async()=>{ try{ if(im.decode) await im.decode(); }catch(_){}
    headerImg = im; headerLoaded = im.naturalWidth>0; resizeCanvas(); };
  im.onerror = ()=>{ headerLoaded=false; resizeCanvas(); };
  im.src = url;
}
window.setHeaderImage = (u)=> loadHeader(u);

/* ===== State (pages from CSV) ===== */
const engine = {
  pages: (window.RPG_CONTENT && window.RPG_CONTENT.pages) || {},
  currentId: (window.RPG_CONTENT && window.RPG_CONTENT.startId) || "",
  // UI / stats
  selectedChoice: -1,
  activities: [
    {name:"Mind", key:"Mind", bonus:0, checked:false},
    {name:"Body", key:"Body", bonus:0, checked:false},
    {name:"Spirit", key:"Spirit", bonus:0, checked:false},
    {name:"Luck", key:"Luck", bonus:0, checked:false}
  ],
  stats:{Mind:0,Body:0,Spirit:0,Luck:0},
  // die
  d20:{x:0,y:0,r:52,vx:0,vy:0,ang:0,vang:0,grabbed:false,value:null,last:{x:0,y:0}, trail:[]},
  // rects
  rects:{scene:null,choicesHeader:null,choices:[],actsHeader:null,checks:[],statsBox:null,tray:null,trayHint:null,result:null},
  // output
  resultText:"After you've made your choice, click and drag the die to shake and roll it.",
  storyText:"",
  contentBottom:0,
  starCanvas:null, starBuiltFor:{w:0,h:0},
  // fight state
  fight:null // { enemy, enemyHP, ac, dmg, playerHP }
};

function getPage(){ return engine.pages[engine.currentId] || null; }

/* ===== Layout / Resize ===== */
function layout(){
  const W = (canvas.width||960)/DPR; const pad=16; const lineH=18;
  const page = getPage();
  const imgH=280; const textMaxW=W - pad*2 - 28; let sceneTextH=28;
  const flavor = (page && page.flavor) || [];
  for(const p of flavor){ sceneTextH += wrapHeight(p, textMaxW, lineH, "14px system-ui, sans-serif") + 8; }
  engine.rects.scene = {x:pad,y:pad,w:W - pad*2,h:12 + imgH + 12 + 26 + sceneTextH + 2};

  // Left controls + Right tray
  const actsY = engine.rects.scene.y + engine.rects.scene.h - 8;
  const actsW = Math.floor((W - pad*3)*0.48);
  const rowH = 56;
  engine.rects.actsHeader = {x:pad, y:actsY, w:actsW, h:24};
  const actsStartY = actsY + engine.rects.actsHeader.h + 6;
  engine.rects.checks = engine.activities.map((_,i)=>({x:pad, y:actsStartY + i*rowH, w:actsW, h:rowH}));

  const checksBottomY = engine.rects.checks.length ? (engine.rects.checks[engine.rects.checks.length-1].y + rowH) : actsStartY;
  engine.rects.statsBox = {x:pad, y:checksBottomY, w:actsW, h:120};

  const trayX = pad + actsW + pad; const trayW = W - trayX - pad;
  const trayTop = actsStartY; const trayBottom = engine.rects.statsBox.y + engine.rects.statsBox.h;
  const trayH = Math.max(120, trayBottom - trayTop);
  engine.rects.tray = {x:trayX,y:trayTop,w:trayW,h:trayH};
  engine.rects.trayHint = {x:trayX,y:trayTop+trayH+16,w:trayW,h:18};
  engine.d20.x = engine.rects.tray.x + engine.rects.tray.w/2; engine.d20.y = engine.rects.tray.y + engine.rects.tray.h/2;

  // Choices
  const gap=12;
  const pageChoices = (page && page.choices) || [];
  const cols = Math.max(1, Math.min(3, pageChoices.length || 3));
  const chosenW = Math.floor((W - pad*2 - gap*(cols-1)) / cols);
  const columnsBottom = Math.max(engine.rects.tray.y + engine.rects.tray.h, engine.rects.statsBox.y + engine.rects.statsBox.h);
  const choiceY = columnsBottom + 24;
  engine.rects.choicesHeader = {x:pad,y:choiceY,w:W - pad*2,h:24};
  engine.rects.choices = [];
  for(let i=0;i<cols;i++){
    const txt = pageChoices[i] ? pageChoices[i].text : "—";
    const labelH=22, topPad=12, gapAfterLabel=8, bottomPad=12;
    const mainH = wrapHeight(txt, chosenW-28, 18, "600 14px system-ui, sans-serif");
    const h = Math.ceil(topPad + labelH + gapAfterLabel + mainH + bottomPad);
    engine.rects.choices.push({x:pad + i*(chosenW+gap), y:choiceY+40, w:chosenW, h});
  }
  const choicesBottom = engine.rects.choices.length ? Math.max(...engine.rects.choices.map(r=>r.y+r.h)) : (choiceY+40);
  const textW = W - pad*2 - 10;
  const resultH = 36;
  const storyH = engine.storyText ? wrapHeight(engine.storyText, textW, lineH, "14px system-ui, sans-serif") + 16 : 0;
  const resH = resultH + storyH + 20;
  engine.rects.trayHint = {x:pad, y: choicesBottom + 20, w: W - pad*2, h:20};
  engine.rects.result = {x:pad, y: engine.rects.trayHint.y + engine.rects.trayHint.h + 36, w: W - pad*2, h:resH};
  engine.contentBottom = engine.rects.result.y + engine.rects.result.h + pad;
}
function ensureCanvasFits(){
  let guard=0; while(guard++<4){
    const need=Math.ceil(engine.contentBottom);
    const cssH=parseFloat(canvas.style.height)||((canvas.height||640)/DPR);
    if(need>cssH+1){ canvas.style.height=need+"px"; canvas.height=Math.floor(need*DPR); ctx.setTransform(DPR,0,0,DPR,0,0); layout(); continue; }
    break;
  }
}
function resizeCanvas(){
  const rect = canvas.getBoundingClientRect();
  const cssW = rect.width || canvas.clientWidth || 960;
  const cssH = Math.round(cssW * 2/3);
  canvas.style.height = cssH + "px";
  canvas.width = Math.floor(cssW * DPR);
  canvas.height = Math.floor(cssH * DPR);
  ctx.setTransform(DPR,0,0,DPR,0,0);
  try{
    const needW = canvas.width, needH = canvas.height;
    if(!engine.starCanvas || engine.starBuiltFor.w !== needW || engine.starBuiltFor.h !== needH){
      const oc = document.createElement("canvas");
      oc.width = needW; oc.height = needH;
      const c2 = oc.getContext("2d");
      c2.clearRect(0,0,needW,needH);
      const count = Math.floor((needW * needH) / 6000);
      for(let i=0;i<count;i++){
        const x = Math.random()*needW, y = Math.random()*needH;
        const r = Math.random()*1.2 + 0.3;
        c2.globalAlpha = 0.35 + Math.random()*0.65;
        c2.beginPath(); c2.arc(x,y,r,0,Math.PI*2);
        c2.fillStyle = Math.random() < 0.10 ? "#bcd4ff" : "#ffffff";
        c2.fill();
      }
      const band = Math.floor(count * 0.25);
      for(let i=0;i<band;i++){
        const left = i % 2 === 0;
        const x = left ? Math.random()*Math.max(needW*0.08, 40) : needW - Math.random()*Math.max(needW*0.08, 40);
        const y = Math.random()*needH;
        const r = Math.random()*1.4 + 0.4;
        c2.globalAlpha = 0.45 + Math.random()*0.55;
        c2.beginPath(); c2.arc(x,y,r,0,Math.PI*2);
        c2.fillStyle = Math.random() < 0.2 ? "#cfe1ff" : "#ffffff";
        c2.fill();
      }
      const glows = Math.max(16, Math.floor(count*0.03));
      for(let i=0;i<glows;i++){
        const x = Math.random()*needW, y = Math.random()*needH;
        const r = Math.random()*2.4 + 1.2;
        const g = c2.createRadialGradient(x,y,0,x,y,r);
        g.addColorStop(0,"rgba(255,255,255,0.7)");
        g.addColorStop(1,"rgba(255,255,255,0)");
        c2.fillStyle = g; c2.beginPath(); c2.arc(x,y,r,0,Math.PI*2); c2.fill();
      }
      engine.starCanvas = oc;
      engine.starBuiltFor = {w:needW, h:needH};
    }
  }catch(_){ engine.starCanvas = null; }
  layout(); ensureCanvasFits();
}
window.addEventListener("resize", resizeCanvas);

/* ===== Draw pipeline ===== */
function draw(){
  const W = canvas.width / DPR; const H = canvas.height / DPR;
  ctx.clearRect(0,0,W,H);
  if(engine.starCanvas){
    try{ ctx.drawImage(engine.starCanvas, 0, 0, W, H); }catch(_){ }
  }
  drawScene();
  drawActivities();
  drawStatsBox();
  drawTray();
  drawChoices();
  drawHint();
  drawResult();
}
function drawScene(){
  const r = engine.rects.scene; if(!r) return;
  const inner={x:r.x,y:r.y,w:r.w,h:280}; roundRectPath(inner.x,inner.y,inner.w,inner.h,12); ctx.save(); ctx.clip();
  const imgUrl = (getPage() && getPage().image) || "";
  if(imgUrl && headerLoaded && headerImg.src === imgUrl){
    try{ ctx.drawImage(headerImg, inner.x, inner.y, inner.w, inner.h); }catch(_){}
  } else if(imgUrl){
    loadHeader(imgUrl);
    const g=ctx.createLinearGradient(inner.x,inner.y,inner.x,inner.y+inner.h); g.addColorStop(0,"#1e293b"); g.addColorStop(1,"#0b132b"); ctx.fillStyle=g; ctx.fillRect(inner.x,inner.y,inner.w,inner.h);
  } else {
    const g=ctx.createLinearGradient(inner.x,inner.y,inner.x,inner.y+inner.h); g.addColorStop(0,"#1e293b"); g.addColorStop(1,"#0b132b"); ctx.fillStyle=g; ctx.fillRect(inner.x,inner.y,inner.w,inner.h);
  }
  ctx.restore();
  const page = getPage();
  let y = inner.y+inner.h+26; const x=r.x+14; ctx.save();
  const titleGrad = ctx.createLinearGradient(x, y-18, x+320, y+6);
  titleGrad.addColorStop(0,"#93c5fd");
  titleGrad.addColorStop(0.5,"#c4b5fd");
  titleGrad.addColorStop(1,"#a78bfa");
  ctx.fillStyle = titleGrad;
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 8;
  ctx.font="800 22px system-ui, sans-serif";
  ctx.fillText(page ? page.title : "Loading…", x, y);
  ctx.restore();
  y+=26;
  ctx.fillStyle="#c5cbd6";
  const flavor = (page && page.flavor) || [];
  for(const p of flavor){ y = wrapText(p, x, y, r.w-28, 18, "14px system-ui, sans-serif"); y += 6; }
}
function drawChoices(){
  const header=engine.rects.choicesHeader; if(!header) return;
  const grad = ctx.createLinearGradient(header.x, header.y, header.x+420, header.y+24);
  grad.addColorStop(0,"#93c5fd"); grad.addColorStop(1,"#c4b5fd");
  ctx.fillStyle = grad; ctx.font="800 20px system-ui, sans-serif";
  const inFight = !!engine.fight;
  ctx.fillText(inFight ? "Battle options" : "What would you like to do?", header.x, header.y+18);

  const page = getPage(); const pageChoices = (page && page.choices) || [];
  const cells = inFight ? [{text:"Attack"}, {text:"Flee"}] : pageChoices;

  for(const [i,rect] of engine.rects.choices.entries()){
    roundRectPath(rect.x,rect.y,rect.w,rect.h,12);
    ctx.save(); ctx.globalAlpha=0.62; ctx.fillStyle=(engine.selectedChoice===i)?"#2b3150":"#141922"; ctx.fill(); ctx.restore();
    ctx.strokeStyle=(engine.selectedChoice===i)?"#7c3aed":"#202836"; ctx.lineWidth=2; ctx.stroke();
    const label = inFight ? (i===0?"Attack":"Flee") : ["Option A","Option B","Option C","Option D"][i] || `Option ${i+1}`;
    const lg = ctx.createLinearGradient(rect.x, rect.y, rect.x+120, rect.y+20);
    lg.addColorStop(0,"#93c5fd"); lg.addColorStop(1,"#c4b5fd");
    ctx.fillStyle = lg; ctx.font="800 16px system-ui, sans-serif";
    ctx.fillText(label, rect.x+14, rect.y+22);
    const txt = cells[i] ? (cells[i].text || "—") : "—";
    ctx.fillStyle="#e6e9ef"; wrapText(txt, rect.x+14, rect.y+44, rect.w-28, 18, "600 14px system-ui, sans-serif");
  }
}
function drawActivities(){
  const hh=engine.rects.actsHeader; if(!hh) return;
  const g = ctx.createLinearGradient(hh.x, hh.y, hh.x+240, hh.y+24);
  g.addColorStop(0,"#93c5fd"); g.addColorStop(1,"#c4b5fd");
  ctx.fillStyle = g; ctx.font="800 20px system-ui, sans-serif";
  ctx.fillText("Allocate today's focus", hh.x, hh.y+18);
  // four toggles -> Mind, Body, Spirit, Luck
  for(let i=0;i<engine.rects.checks.length;i++){
    const rect=engine.rects.checks[i]; const a=engine.activities[i];
    roundRectPath(rect.x,rect.y,rect.w,rect.h,10);
    const bg=ctx.createLinearGradient(rect.x,rect.y,rect.x,rect.y+rect.h);
    bg.addColorStop(0,"#101624"); bg.addColorStop(1,"#0c111c"); ctx.save(); ctx.globalAlpha=0.62; ctx.fillStyle=bg; ctx.fill(); ctx.restore(); ctx.strokeStyle="#222937"; ctx.stroke();
    const box={x:rect.x+14,y:rect.y + Math.floor((rect.h-24)/2),w:26,h:26}; roundRectPath(box.x,box.y,box.w,box.h,5);
    ctx.fillStyle=a.checked?"#10b981":"#0f1420"; ctx.fill(); ctx.strokeStyle=a.checked?"#34d399":"#2a3345"; ctx.lineWidth=2; ctx.stroke();
    ctx.fillStyle="#d6d9e0"; ctx.save(); ctx.font="600 16px system-ui, sans-serif"; ctx.textBaseline="middle";
    ctx.fillText(a.name + (a.checked ? " (+1)" : ""), box.x+40, rect.y + rect.h/2); ctx.restore();
  }
}
function drawStatsBox(){
  const r=engine.rects.statsBox; if(!r) return;
  roundRectPath(r.x,r.y,r.w,r.h,10); const g=ctx.createLinearGradient(r.x,r.y,r.x,r.y+r.h);
  g.addColorStop(0,"#101624"); g.addColorStop(1,"#0c111c"); ctx.save(); ctx.globalAlpha=0.62; ctx.fillStyle=g; ctx.fill(); ctx.restore(); ctx.strokeStyle="#222937"; ctx.stroke();
  const names=["Mind","Body","Spirit","Luck"]; const vals=[engine.stats.Mind,engine.stats.Body,engine.stats.Spirit,engine.stats.Luck];
  const startY=r.y+12; const meterX=r.x+140; const meterW=r.w - (meterX - r.x) - 12; const max=5;
  for(let i=0;i<names.length;i++){
    const y=startY + i*28; ctx.fillStyle="#e6e9ef"; ctx.font="700 16px system-ui, sans-serif"; const plus = vals[i]>0 ? ` (+${vals[i]})` : "";
    ctx.fillText(names[i]+plus, r.x+12, y+12);
    roundRectPath(meterX, y, meterW, 12, 6);
    const mbg=ctx.createLinearGradient(meterX,y,meterX,y+12);
    mbg.addColorStop(0,"#0f1420"); mbg.addColorStop(1,"#0b1018"); ctx.fillStyle=mbg; ctx.fill(); ctx.strokeStyle="#283146"; ctx.stroke();
    const ratio=Math.max(0,Math.min(1, vals[i]/max)); const fillW=Math.max(0, Math.floor(meterW * ratio)); if(fillW>0){
      roundRectPath(meterX, y, fillW, 12, 6); const mf=ctx.createLinearGradient(meterX,y,meterX+fillW,y); mf.addColorStop(0,"#3b82f6"); mf.addColorStop(1,"#8b5cf6"); ctx.fillStyle=mf; ctx.fill();
    }
  }
}
function drawTray(){
  const r=engine.rects.tray; if(!r) return; const d=engine.d20;
  roundRectPath(r.x,r.y,r.w,r.h,14);
  const edge=ctx.createLinearGradient(r.x,r.y,r.x,r.y+r.h); edge.addColorStop(0,"rgba(43,49,64,0.30)"); edge.addColorStop(1,"rgba(26,31,42,0.20)"); ctx.fillStyle=edge; ctx.fill();
  roundRectPath(r.x+8,r.y+8,r.w-16,r.h-16,10); const deck=ctx.createLinearGradient(r.x,r.y,r.x,r.y+r.h);
  deck.addColorStop(0,"rgba(12,17,26,0.18)"); deck.addColorStop(1,"rgba(10,13,18,0.14)"); ctx.fillStyle=deck; ctx.fill();
  ctx.save(); const gg = ctx.createLinearGradient(r.x, r.y, r.x+r.w, r.y);
  gg.addColorStop(0,"rgba(124,58,237,0.25)"); gg.addColorStop(1,"rgba(96,165,250,0.25)");
  ctx.lineWidth=1.5; ctx.strokeStyle=gg; roundRectPath(r.x+0.5, r.y+0.5, r.w-1, r.h-1, 14); ctx.stroke(); ctx.restore();
  ctx.strokeStyle="rgba(255,255,255,0.05)"; ctx.lineWidth=1; ctx.stroke();

  // Physics + bouncy spin injections
  if(!d.grabbed){
    d.x+=d.vx; d.y+=d.vy; d.ang+=d.vang;

    const pad=10;
    if(d.x-d.r<=r.x+pad){ d.x=r.x+pad+d.r; d.vx*=-0.93; d.vang*=-0.93; d.vang += (window.diceSpin&&window.diceSpin.bounceImpulse)? window.diceSpin.bounceImpulse(d,'l') : 0.12; }
    if(d.y-d.r<=r.y+pad){ d.y=r.y+pad+d.r; d.vy*=-0.93; d.vang*=-0.93; d.vang += (window.diceSpin&&window.diceSpin.bounceImpulse)? window.diceSpin.bounceImpulse(d,'t') : 0.12; }
    if(d.x+d.r>=r.x+r.w-pad){ d.x=r.x+r.w-pad-d.r; d.vx*=-0.93; d.vang*=-0.93; d.vang += (window.diceSpin&&window.diceSpin.bounceImpulse)? window.diceSpin.bounceImpulse(d,'r') : -0.12; }
    if(d.y+d.r>=r.y+r.h-pad){ d.y=r.y+r.h-pad-d.r; d.vy*=-0.93; d.vang*=-0.93; d.vang += (window.diceSpin&&window.diceSpin.bounceImpulse)? window.diceSpin.bounceImpulse(d,'b') : -0.12; }

    // Friction (slightly less on spin to let it twirl a bit longer)
    d.vx*=0.994; d.vy*=0.994; d.vang*=0.995;
    if(Math.hypot(d.vx,d.vy)<0.05 && Math.abs(d.vang)<0.012){ d.vx=d.vy=d.vang=0; }
  }

  drawD20(engine.d20);
}
function drawHint(){
  const h=engine.rects.trayHint; if(!h) return;
  const grad=ctx.createLinearGradient(h.x, h.y, h.x+h.w, h.y+24);
  grad.addColorStop(0,"#93c5fd"); grad.addColorStop(1,"#c4b5fd");
  ctx.save(); ctx.fillStyle=grad; ctx.shadowColor="rgba(0,0,0,0.35)"; ctx.shadowBlur=8; ctx.font="800 20px system-ui, sans-serif"; ctx.textAlign="start";
  ctx.fillText("After you've made your choice, click and drag the die to shake and roll it.", h.x, h.y+18);
  ctx.restore();
}
function drawResult(){
  const r=engine.rects.result; if(!r) return; let y=r.y; const textW=r.w-10;
  if(engine.d20 && engine.d20.value!=null){
    const g=ctx.createLinearGradient(r.x,y,r.x+320,y+24); g.addColorStop(0,"#93c5fd"); g.addColorStop(1,"#a78bfa");
    ctx.save(); ctx.fillStyle=g; ctx.shadowColor="rgba(0,0,0,0.35)"; ctx.shadowBlur=8;
    y = wrapText(engine.resultText, r.x, y+6, textW, 28, "800 22px system-ui, sans-serif");
    ctx.restore(); y+=6;
    if(engine.storyText){ ctx.fillStyle="#e6e9ef"; y = wrapText(engine.storyText, r.x, y, textW, 18, "700 14px system-ui, sans-serif"); }
  }
}

/* Fancy D20 rendering with squash, stretch and trail */
function drawD20(d){
  const cx=d.x, cy=d.y, r=d.r, ang=d.ang, value=d.value;
  const speed = Math.hypot(d.vx, d.vy);
  const spin = Math.abs(d.vang);
  const active = speed>0.2 || spin>0.02;

  // trail buffer
  if (active){
    d.trail.push({x:cx, y:cy, ang:ang});
    if (d.trail.length>6) d.trail.shift();
  } else if (d.trail.length) {
    d.trail.shift();
  }

  // soft shadow
  ctx.fillStyle="rgba(0,0,0,0.35)"; ctx.beginPath(); ctx.ellipse(cx+6, cy+8, r*0.9, r*0.3, 0, 0, Math.PI*2); ctx.fill();

  // draw faint trail
  if (d.trail.length){
    for(let i=0;i<d.trail.length;i++){
      const t = d.trail[i];
      const alpha = 0.05 + (i / d.trail.length) * 0.10;
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate(t.ang - d.vang * 0.1 * (d.trail.length-i));
      ctx.scale(1 - i*0.05, 1 - i*0.05);
      _drawD20Path(r, true, alpha);
      ctx.restore();
    }
  }

  // main die with squash & stretch
  ctx.save();
  ctx.translate(cx, cy);
  const wobble = Math.min(0.22, speed/300 + spin/16);
  const dir = Math.atan2(d.vy||0, d.vx||0);
  // Align squash with motion direction
  ctx.rotate(dir);
  ctx.scale(1 + wobble, 1 - wobble);
  ctx.rotate(-dir + ang);
  _drawD20Path(r, false, 1);
  // number
  const num = value==null? "" : String(value);
  ctx.fillStyle="#0b0c10"; ctx.font=`bold ${Math.floor(r*0.7)}px system-ui, sans-serif`; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(num,0,2);
  ctx.restore();
}

// internal: draws the gemstone body + stroke; if 'trail' true, draws translucent
function _drawD20Path(r, trail, alpha){
  const body=ctx.createRadialGradient(-r*0.4,-r*0.4,r*0.3,0,0,r);
  body.addColorStop(0,"#9de1ff"); body.addColorStop(0.6,"#5ea7ff"); body.addColorStop(1,"#6d42ff");
  ctx.beginPath();
  for(let i=0;i<20;i++){ const a=(i/20)*Math.PI*2; const rr=r*(0.9+0.08*Math.sin(i*1.7)); const x=Math.cos(a)*rr, y=Math.sin(a)*rr; if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); }
  ctx.closePath();
  ctx.save();
  if (trail){ ctx.globalAlpha = alpha; }
  ctx.fillStyle=body;
  ctx.shadowColor= trail ? "rgba(0,0,0,0.15)" : "rgba(0,0,0,0.40)";
  ctx.shadowBlur= trail ? 6 : 14;
  ctx.shadowOffsetX=0; ctx.shadowOffsetY= trail ? 2 : 4;
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha= trail ? alpha*0.8 : 1;
  ctx.strokeStyle= trail ? "rgba(11,12,16,0.35)" : "#0b0c10"; ctx.lineWidth= trail ? 0.5 : 1;
  ctx.stroke();
  ctx.globalAlpha=1;
}

/* ===== Interaction ===== */
function recomputeStats(){
  const s={Mind:0,Body:0,Spirit:0,Luck:0};
  for(const a of engine.activities){ s[a.key] += a.checked ? 1 : 0; }
  engine.stats = s;
}

canvas.addEventListener("click", (e)=>{
  const rect=canvas.getBoundingClientRect(); const mx=(e.clientX-rect.left)*(canvas.width/rect.width)/DPR; const my=(e.clientY-rect.top)*(canvas.height/rect.height)/DPR;
  for(let i=0;i<engine.rects.choices.length;i++){ if(inRect(mx,my,engine.rects.choices[i])) engine.selectedChoice=i; }
  for(let i=0;i<engine.rects.checks.length;i++){
    if(inRect(mx,my,engine.rects.checks[i])){ engine.activities[i].checked=!engine.activities[i].checked; recomputeStats(); layout(); ensureCanvasFits(); }
  }
});
canvas.addEventListener("mousedown", (e)=>{
  const rect=canvas.getBoundingClientRect(); const mx=(e.clientX-rect.left)*(canvas.width/rect.width)/DPR; const my=(e.clientY-rect.top)*(canvas.height/rect.height)/DPR; const d=engine.d20; const r=engine.rects.tray;
  if(inRect(mx,my,r) && Math.hypot(mx-d.x,my-d.y)<=d.r){ d.grabbed=true; d.last.x=mx; d.last.y=my; d.vx=d.vy=d.vang=0; }
});
window.addEventListener("mousemove", (e)=>{
  const d=engine.d20; if(!d.grabbed) return; const rect=canvas.getBoundingClientRect(); const mx=(e.clientX-rect.left)*(canvas.width/rect.width)/DPR; const my=(e.clientY-rect.top)*(canvas.height/rect.height)/DPR; const r=engine.rects.tray;
  const dx = mx - d.last.x, dy = my - d.last.y;
  d.x=clamp(mx, r.x+10+d.r, r.x+r.w-10-d.r); d.y=clamp(my, r.y+10+d.r, r.y+r.h-10-d.r);
  d.vx=dx*1.2; d.vy=dy*1.2;
  d.vang=(dx-dy)*0.04;
  // extra spin while dragging for snappier feel
  if (window.diceSpin && window.diceSpin.dragImpulse) d.vang += window.diceSpin.dragImpulse(dx, dy)*0.4;
  d.last.x=mx; d.last.y=my;
});
window.addEventListener("mouseup", ()=>{
  const d=engine.d20; if(!d.grabbed) return; d.grabbed=false;
  d.vx*=2.6; d.vy*=2.6; d.vang*=2.0;
  // add a little more flick spin on release
  if (window.diceSpin && window.diceSpin.dragImpulse) d.vang += window.diceSpin.dragImpulse(d.vx, d.vy)*0.2;

  if(engine.selectedChoice<0 && !engine.fight){ engine.resultText="❗ Choose an option first."; engine.storyText=""; layout(); ensureCanvasFits(); return; }

  let raw = 1 + Math.floor(Math.random()*20);
  if (typeof window.rollD20 === "function") {
    try { const maybe = window.rollD20({ d: engine.d20, stats: engine.stats, choiceIndex: engine.selectedChoice }); raw = 1 + ((Math.floor(maybe)-1+20)%20); } catch(_) { }
  }
  d.value = raw;

  if(engine.fight){ resolveFight(raw); return; }

  // Resolve normal choice + advance
  const page = getPage(); const choice = page && page.choices[engine.selectedChoice];
  if (!choice){ engine.resultText="Please select a valid option."; engine.storyText=""; layout(); ensureCanvasFits(); return; }

  const bonus = (engine.stats.Mind + engine.stats.Body + engine.stats.Spirit); // simple general bonus
  const total = raw + bonus; const tag = total>=20 ? "Critical Success" : total>=12 ? "Success" : total>=6 ? "Failure" : "Critical Failure";
  engine.resultText = `You chose “${choiceTitle(choice.text)}”. D20=${raw} + Bonus=${bonus} → Total=${total} ⇒ ${tag}`;
  engine.storyText = choice.outcome || "";

  window.logSelection?.({ pageId: engine.currentId, choiceIndex: engine.selectedChoice, raw, bonus, total, tag });

  // Advance if choice.next is present
  if (choice.next){
    if (choice.next.toUpperCase() === "END"){
      engine.storyText += "

— The End —";
    } else if (engine.pages[choice.next]){
      engine.currentId = choice.next;
      // If next page has fight, prime it
      const nextPage = getPage();
      if (nextPage && nextPage.fight){
        engine.fight = {
          enemy: nextPage.fight.enemy,
          enemyHP: nextPage.fight.hp,
          ac: nextPage.fight.ac,
          dmg: nextPage.fight.dmg,
          playerHP: 10 + engine.stats.Body*2
        };
      } else {
        engine.fight = null;
      }
      engine.selectedChoice = -1;
      engine.storyText = "";
      if (nextPage && nextPage.image) loadHeader(nextPage.image);
      layout(); ensureCanvasFits();
    } else {
      engine.storyText += `

(⚠ Unknown next id: ${choice.next})`;
    }
  }
  layout(); ensureCanvasFits();
});

/* ===== Fight mechanics ===== */
function rollDamage(spec){
  const { dice, sides, bonus } = spec || { dice:1, sides:4, bonus:0 };
  let sum = 0; for (let i=0;i<dice;i++){ sum += 1 + Math.floor(Math.random()*Math.max(1,sides)); }
  return sum + bonus;
}
function resolveFight(playerRoll){
  const f = engine.fight; if (!f) return;
  const attack = playerRoll + (engine.stats.Body||0);
  const hit = attack >= f.ac;
  let log = `You attack the ${f.enemy}. Attack=${playerRoll} + Body=${engine.stats.Body} vs AC=${f.ac} → ${hit?"HIT":"MISS"}.`;
  if (hit){
    const dmg = rollDamage({ dice:1, sides:8, bonus:engine.stats.Body });
    f.enemyHP = Math.max(0, f.enemyHP - dmg);
    log += ` You dealt ${dmg} damage. Enemy HP now ${f.enemyHP}.`;
  }
  // Enemy turn (if alive)
  if (f.enemyHP > 0){
    const eRoll = 1 + Math.floor(Math.random()*20);
    const playerAC = 10 + (engine.stats.Body||0);
    const eHit = (eRoll + 2) >= playerAC;
    let eLog = ` The ${f.enemy} strikes back. Attack=${eRoll}+2 vs AC=${playerAC} → ${eHit?"HIT":"MISS"}.`;
    if (eHit){
      const eDmg = rollDamage(f.dmg);
      f.playerHP = Math.max(0, f.playerHP - eDmg);
      eLog += ` You take ${eDmg} damage. Your HP now ${f.playerHP}.`;
    }
    log += eLog;
  }
  window.logFightRound?.({ pageId: engine.currentId, attack, hit, enemyHP:f.enemyHP, playerHP:f.playerHP });

  if (f.enemyHP <= 0){
    engine.storyText = `${log}

You defeated the ${f.enemy}!`;
    engine.fight = null;
  } else if (f.playerHP <= 0){
    engine.storyText = `${log}

You are knocked out. — The End —`;
    engine.fight = null;
  } else {
    engine.storyText = log;
  }
  engine.resultText = "Battle result:";
  layout(); ensureCanvasFits();
}

/* ===== Animate ===== */
function loop(){ try{ draw(); }catch(err){ console.error("[draw error]", err); } requestAnimationFrame(loop); }
function boot(){
  const tick = setInterval(()=>{
    if (window.RPG_CONTENT && window.RPG_CONTENT.pages && Object.keys(window.RPG_CONTENT.pages).length){
      clearInterval(tick);
      engine.pages = window.RPG_CONTENT.pages;
      engine.currentId = window.RPG_CONTENT.startId;
      const page = getPage();
      if (page && page.image) loadHeader(page.image);
      resizeCanvas(); loop();
    }
  }, 50);
}
if(document.readyState==="loading"){ document.addEventListener("DOMContentLoaded", boot); } else { boot(); }

window.addEventListener("error", e=>{ console.error("[window error]", e.message); });
