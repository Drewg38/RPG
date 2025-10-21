
/*! game.js v2.2 (uses fancy-d20 when available) */
(function(){
  "use strict";
  if (window.__rpg_game_booted) return;
  window.__rpg_game_booted = true;

  var DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  var canvas = document.getElementById("stage");
  if (!canvas || !canvas.getContext){ console.error("[game.js] Canvas not available"); return; }
  var ctx = canvas.getContext("2d");

  function clamp(n,mn,mx){ return Math.max(mn, Math.min(mx, n)); }
  function inRect(mx,my,r){ return r && mx>=r.x && mx<=r.x+r.w && my>=r.y && my<=r.y+r.h; }
  function rr(x,y,w,h,r){ r=Math.max(0,r||10); ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
  function splitWords(s){ s=String(s==null?'':s); var out='',prev=false; for(var i=0;i<s.length;i++){ var ch=s[i], ws=(ch<=' '); if(ws){ if(!prev){ out+=' '; prev=true; } } else { out+=ch; prev=false; } } out=out.trim(); return out?out.split(' '):[]; }
  function wrapHeight(text, maxW, lineH, font){ var prev=ctx.font; if(font) ctx.font=font; var w=splitWords(text), line='', h=lineH; for(var i=0;i<w.length;i++){ var t=line+w[i]+' '; if(ctx.measureText(t).width>maxW){ line=w[i]+' '; h+=lineH; } else { line=t; } } if(font) ctx.font=prev; return h; }
  function wrap(text,x,y,maxW,lineH,font){ var prev=ctx.font; if(font) ctx.font=font; var w=splitWords(text), line=''; for(var i=0;i<w.length;i++){ var t=line+w[i]+' '; if(ctx.measureText(t).width>maxW){ ctx.fillText(line,x,y); line=w[i]+' '; y+=lineH; } else { line=t; } } ctx.fillText(line,x,y); if(font) ctx.font=prev; return y+lineH; }

  // Content from CSV (provided by content.js)
  var pages   = (window.RPG_CONTENT && window.RPG_CONTENT.pages) || {};
  var startId = (window.RPG_CONTENT && window.RPG_CONTENT.startId) || Object.keys(pages)[0] || null;
  if(!startId){ console.error("[game.js] No pages found"); return; }
  var currentId = startId;
  var current   = pages[currentId];

  // Hero header image
  var hero = new Image(); hero.crossOrigin="anonymous"; var heroReady=false;
  function loadHero(src){
    heroReady=false; if(!src) return;
    var im=new Image(); im.crossOrigin="anonymous";
    im.onload=function(){ hero=im; heroReady=im.naturalWidth>0; };
    im.onerror=function(){ heroReady=false; };
    im.src=src;
  }
  if(current && current.image) loadHero(current.image);

  var state = {
    selectedChoice: -1,
    d: { x:0,y:0,r:56,vx:0,vy:0,ang:0,vang:0,grabbed:false,value:null,last:{x:0,y:0} },
    rects: { scene:null, choices:[], tray:null, hint:null, result:null },
    stats: { Mind:0, Body:0, Spirit:0, Luck:0 }
  };

  // Stars
  var starCanvas=null, starFor={w:0,h:0};
  function rebuildStars(W,H){
    var oc=document.createElement('canvas'); oc.width=W; oc.height=H;
    var c2=oc.getContext('2d'); var count=Math.floor((W*H)/6000);
    for(var i=0;i<count;i++){ var x=Math.random()*W, y=Math.random()*H, r=Math.random()*1.2+0.3; c2.globalAlpha=0.35+Math.random()*0.65; c2.beginPath(); c2.arc(x,y,r,0,Math.PI*2); c2.fillStyle=Math.random()<0.10?'#bcd4ff':'#ffffff'; c2.fill(); }
    starCanvas=oc; starFor={w:W,h:H};
  }

  function resize(){
    var rect=canvas.getBoundingClientRect();
    var cssW=rect.width||canvas.clientWidth||960;
    var cssH=Math.round(cssW*2/3);
    canvas.style.height=cssH+"px";
    canvas.width=Math.floor(cssW*DPR);
    canvas.height=Math.floor(cssH*DPR);
    ctx.setTransform(DPR,0,0,DPR,0,0);
    layout();
  }
  window.addEventListener("resize", resize);

  function layout(){
    var W=canvas.width/DPR, pad=16, lineH=18;
    var imgH=280;
    var textW=W-pad*2-28;
    var h=26;
    if(current && current.flavor){ for(var i=0;i<current.flavor.length;i++){ h+=wrapHeight(current.flavor[i], textW, lineH, "14px system-ui, sans-serif")+6; } }
    state.rects.scene={x:pad,y:pad,w:W-pad*2,h:12+imgH+12+26+h};

    var trayTop = state.rects.scene.y + state.rects.scene.h + 20;
    var trayH   = Math.max(240, Math.round((canvas.height/DPR)*0.42)); // Taller tray
    state.rects.tray={x:pad,y:trayTop,w:W-pad*2,h:trayH};

    state.d.x=state.rects.tray.x + state.rects.tray.w/2;
    state.d.y=state.rects.tray.y + state.rects.tray.h/2;

    var cW=Math.floor((W-pad*2-24)/3);
    var choiceY=state.rects.tray.y + state.rects.tray.h + 24;
    state.rects.choices=[];
    var count=(current && current.choices)? Math.min(3,current.choices.length):0;
    for(var i=0;i<count;i++){ state.rects.choices.push({x:pad+i*(cW+12),y:choiceY,w:cW,h:120}); }

    state.rects.hint={x:pad,y:choiceY+(count?132:0),w:W-pad*2,h:20};
    state.rects.result={x:pad,y:state.rects.hint.y+30,w:W-pad*2,h:40};

    var need = Math.ceil(state.rects.result.y + state.rects.result.h + pad);
    var cssH = parseFloat(canvas.style.height) || ((canvas.height||640)/DPR);
    if(need > cssH + 1){
      canvas.style.height = need + "px";
      canvas.height = Math.floor(need*DPR);
      ctx.setTransform(DPR,0,0,DPR,0,0);
      if(!starCanvas || starFor.w!==canvas.width || starFor.h!==canvas.height){ rebuildStars(canvas.width, canvas.height); }
    }
  }

  function draw(){
    var W=canvas.width/DPR, H=canvas.height/DPR;
    ctx.clearRect(0,0,W,H);
    if(!starCanvas || starFor.w!==canvas.width || starFor.h!==canvas.height){ rebuildStars(canvas.width, canvas.height); }
    if(starCanvas){ try{ ctx.drawImage(starCanvas,0,0,W,H); }catch(_){} }

    // Scene
    var r=state.rects.scene;
    if(r){
      var inner={x:r.x,y:r.y,w:r.w,h:280};
      rr(inner.x,inner.y,inner.w,inner.h,12);
      ctx.save(); ctx.clip();
      if(heroReady){ try{ ctx.drawImage(hero,inner.x,inner.y,inner.w,inner.h); }catch(_){ ctx.fillStyle="#0c111c"; ctx.fillRect(inner.x,inner.y,inner.w,inner.h); } }
      else { ctx.fillStyle="#0c111c"; ctx.fillRect(inner.x,inner.y,inner.w,inner.h); }
      ctx.restore();
      var y=inner.y+inner.h+26, x=r.x+14;
      var g=ctx.createLinearGradient(x,y-18,x+320,y+6); g.addColorStop(0,"#93c5fd"); g.addColorStop(1,"#a78bfa");
      ctx.fillStyle=g; ctx.font="800 22px system-ui, sans-serif"; ctx.fillText(current.title||"Untitled", x, y); y+=26;
      ctx.fillStyle="#c5cbd6";
      if(current && current.flavor){ for(var i=0;i<current.flavor.length;i++){ y=wrap(current.flavor[i], x, y, r.w-28, 18, "14px system-ui, sans-serif"); y+=6; } }
    }

    // Tray
    var t=state.rects.tray;
    if(t){
      rr(t.x,t.y,t.w,t.h,16);
      var edge=ctx.createLinearGradient(t.x,t.y,t.x,t.y+t.h); edge.addColorStop(0,"rgba(43,49,64,0.30)"); edge.addColorStop(1,"rgba(26,31,42,0.22)");
      ctx.fillStyle=edge; ctx.fill();
      rr(t.x+8,t.y+8,t.w-16,t.h-16,12);
      var deck=ctx.createLinearGradient(t.x,t.y,t.x,t.y+t.h); deck.addColorStop(0,"rgba(12,17,26,0.20)"); deck.addColorStop(1,"rgba(10,13,18,0.16)");
      ctx.fillStyle=deck; ctx.fill();
      if(!state.d.grabbed){
        state.d.x+=state.d.vx; state.d.y+=state.d.vy; state.d.ang+=state.d.vang;
        var pad=12;
        if(state.d.x-state.d.r<=t.x+pad){ state.d.x=t.x+pad+state.d.r; state.d.vx*=-0.93; state.d.vang*=-0.93; }
        if(state.d.y-state.d.r<=t.y+pad){ state.d.y=t.y+pad+state.d.r; state.d.vy*=-0.93; state.d.vang*=-0.93; }
        if(state.d.x+state.d.r>=t.x+t.w-pad){ state.d.x=t.x+t.w-pad-state.d.r; state.d.vx*=-0.93; state.d.vang*=-0.93; }
        if(state.d.y+state.d.r>=t.y+t.h-pad){ state.d.y=t.y+t.h-pad-state.d.r; state.d.vy*=-0.93; state.d.vang*=-0.93; }
        state.d.vx*=0.994; state.d.vy*=0.994; state.d.vang*=0.994;
        if(Math.hypot(state.d.vx,state.d.vy)<0.05 && Math.abs(state.d.vang)<0.012){ state.d.vx=state.d.vy=state.d.vang=0; }
      }
      // Use global fancy D20 if present
      if(typeof window.drawFancyD20 === "function"){
        window.drawFancyD20(ctx, state.d.x, state.d.y, state.d.r, state.d.ang, state.d.value, {vx:state.d.vx, vy:state.d.vy, vang:state.d.vang, grabbed:state.d.grabbed});
      }else{
        // Minimal fallback disk
        ctx.fillStyle="#6d42ff";
        ctx.beginPath(); ctx.arc(state.d.x, state.d.y, state.d.r, 0, Math.PI*2); ctx.fill();
        if(state.d.value!=null){ ctx.fillStyle="#0b0c10"; ctx.font="bold "+Math.floor(state.d.r*0.7)+"px system-ui"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(String(state.d.value), state.d.x, state.d.y); }
      }
    }

    // Choices
    var cards=state.rects.choices;
    var choices=(current && current.choices) || [];
    for(var i=0;i<cards.length;i++){
      var c=cards[i];
      rr(c.x,c.y,c.w,c.h,12);
      ctx.save(); ctx.globalAlpha=0.62; ctx.fillStyle=(state.selectedChoice===i) ? "#2b3150" : "#141922"; ctx.fill(); ctx.restore();
      ctx.strokeStyle=(state.selectedChoice===i) ? "#7c3aed" : "#202836"; ctx.lineWidth=2; ctx.stroke();
      var label=["Option A","Option B","Option C"][i] || ("Choice "+(i+1));
      var lg=ctx.createLinearGradient(c.x,c.y,c.x+120,c.y+20); lg.addColorStop(0,"#93c5fd"); lg.addColorStop(1,"#c4b5fd");
      ctx.fillStyle=lg; ctx.font="800 16px system-ui, sans-serif"; ctx.fillText(label, c.x+14, c.y+22);
      ctx.fillStyle="#e6e9ef";
      var txt=(choices[i] && (choices[i].label||choices[i].text||choices[i].title)) || "-";
      wrap(txt, c.x+14, c.y+44, c.w-28, 18, "600 14px system-ui, sans-serif");
    }

    // Hint / result
    var h=state.rects.hint;
    if(h){ var grad=ctx.createLinearGradient(h.x,h.y,h.x+h.w,h.y+24); grad.addColorStop(0,"#93c5fd"); grad.addColorStop(1,"#c4b5fd"); ctx.save(); ctx.fillStyle=grad; ctx.font="800 20px system-ui, sans-serif"; ctx.fillText("After you choose, drag the die to roll.", h.x, h.y+18); ctx.restore(); }
    var rres=state.rects.result;
    if(rres && state.d && state.d.value!=null){ var g2=ctx.createLinearGradient(rres.x,rres.y,rres.x+320,rres.y+24); g2.addColorStop(0,"#93c5fd"); g2.addColorStop(1,"#a78bfa"); ctx.save(); ctx.fillStyle=g2; ctx.font="800 22px system-ui, sans-serif"; ctx.fillText("Roll result: "+state.d.value, rres.x, rres.y+18); ctx.restore(); }

    requestAnimationFrame(draw);
  }

  function goTo(id){
    if(!pages[id]){ console.warn("[game.js] Missing page id:", id); return; }
    currentId=id; current=pages[id];
    if(current && current.image) loadHero(current.image);
    state.selectedChoice=-1; state.d.value=null;
    layout();
  }

  canvas.addEventListener("click", function(e){
    var rect=canvas.getBoundingClientRect();
    var mx=(e.clientX-rect.left)*(canvas.width/rect.width)/DPR;
    var my=(e.clientY-rect.top)*(canvas.height/rect.height)/DPR;
    for(var i=0;i<state.rects.choices.length;i++){ if(inRect(mx,my,state.rects.choices[i])){ state.selectedChoice=i; } }
  });

  canvas.addEventListener("mousedown", function(e){
    var rect=canvas.getBoundingClientRect();
    var mx=(e.clientX-rect.left)*(canvas.width/rect.width)/DPR;
    var my=(e.clientY-rect.top)*(canvas.height/rect.height)/DPR;
    var t=state.rects.tray; if(!t) return;
    if(inRect(mx,my,t) && Math.hypot(mx-state.d.x,my-state.d.y)<=state.d.r){
      state.d.grabbed=true; state.d.last.x=mx; state.d.last.y=my; state.d.vx=state.d.vy=state.d.vang=0;
    }
  });

  window.addEventListener("mousemove", function(e){
    if(!state.d.grabbed) return;
    var rect=canvas.getBoundingClientRect();
    var mx=(e.clientX-rect.left)*(canvas.width/rect.width)/DPR;
    var my=(e.clientY-rect.top)*(canvas.height/rect.height)/DPR;
    var t=state.rects.tray;
    state.d.x = clamp(mx, t.x+12+state.d.r, t.x+t.w-12-state.d.r);
    state.d.y = clamp(my, t.y+12+state.d.r, t.y+t.h-12-state.d.r);
    var dx=mx-state.d.last.x, dy=my-state.d.last.y;
    state.d.vx=dx*1.25; state.d.vy=dy*1.25; state.d.vang=(dx-dy)*0.045;
    state.d.last.x=mx; state.d.last.y=my;
  });

  window.addEventListener("mouseup", function(){
    if(!state.d.grabbed) return;
    state.d.grabbed=false; state.d.vx*=2.6; state.d.vy*=2.6; state.d.vang*=2.0;
    try{
      var roll=(typeof window.rollD20==="function")? window.rollD20({ d:state.d, stats:state.stats, choiceIndex:state.selectedChoice }) : (1+Math.floor(Math.random()*20));
      state.d.value=roll;
    }catch(_){
      state.d.value=1+Math.floor(Math.random()*20);
    }
    var choices=(current && current.choices) || [];
    var ch=choices[state.selectedChoice];
    if(ch && ch.next){ setTimeout(function(){ goTo(ch.next); }, 650); }
  });

  resize();
  requestAnimationFrame(draw);
})();
