
/*! fancy-d20.js v1.2 — glossy prism D20 with sharper facets (CodePen-style) */
(function(){
  "use strict";
  /**
   * drawFancyD20(ctx, cx, cy, r, ang, value, kinetics)
   * kinetics: { vx, vy, vang, grabbed }  // optional
   */
  function drawFancyD20(ctx, cx, cy, r, ang, value, kinetics){
    kinetics = kinetics || {};
    var vx = +kinetics.vx || 0;
    var vy = +kinetics.vy || 0;
    var vang = +kinetics.vang || 0;
    var grabbed = !!kinetics.grabbed;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);

    // Body gradient (cool cyan -> violet)
    var g = ctx.createRadialGradient(-r*0.25, -r*0.35, r*0.15, 0, 0, r*1.05);
    g.addColorStop(0.00, "#bfe7ff");
    g.addColorStop(0.45, "#6aa7ff");
    g.addColorStop(0.78, "#6d66ff");
    g.addColorStop(1.00, "#6a3dff");

    // 20‑gon shell with slight sinusoidal jitter to fake facets
    ctx.beginPath();
    for (var i=0;i<20;i++){
      var a=(i/20)*Math.PI*2;
      var rr=r*(0.92 + 0.075*Math.sin(i*1.75));
      var x=Math.cos(a)*rr, y=Math.sin(a)*rr;
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.closePath();
    ctx.fillStyle=g;
    ctx.shadowColor="rgba(0,0,0,0.42)";
    ctx.shadowBlur=14;
    ctx.shadowOffsetX=0; ctx.shadowOffsetY=6;
    ctx.fill();

    // Facet outlines (triangulated rings)
    ctx.save();
    ctx.globalAlpha=0.35;
    ctx.lineWidth=Math.max(1, Math.floor(r*0.06));
    ctx.strokeStyle="rgba(12,14,22,0.9)";
    for (var ring=0; ring<3; ring++){
      var segs = 20;
      var scale = 0.6 + ring*0.14;
      ctx.beginPath();
      for (var j=0; j<segs; j++){
        var a2=(j/segs)*Math.PI*2 + ring*0.15;
        var rr2=r*scale*(0.98+0.06*Math.sin(j*1.2+ring));
        var x2=Math.cos(a2)*rr2;
        var y2=Math.sin(a2)*rr2;
        if(j===0) ctx.moveTo(x2,y2); else ctx.lineTo(x2,y2);
      }
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();

    // Outer rim sheen
    var rim=ctx.createLinearGradient(-r,0,r,0);
    rim.addColorStop(0,"rgba(255,255,255,0.25)");
    rim.addColorStop(1,"rgba(160,180,255,0.25)");
    ctx.strokeStyle=rim;
    ctx.lineWidth=1.2;
    ctx.stroke();

    // Specular sweeps (two ellipses)
    ctx.globalAlpha=0.28;
    ctx.beginPath();
    ctx.ellipse(-r*0.28,-r*0.30, r*0.95, r*0.40, -0.65, 0, Math.PI*2);
    ctx.fillStyle="#ffffff";
    ctx.fill();
    ctx.globalAlpha=0.2;
    ctx.beginPath();
    ctx.ellipse(r*0.20,r*0.15, r*0.65, r*0.26, 0.8, 0, Math.PI*2);
    ctx.fill();
    ctx.globalAlpha=1;

    // Motion accent rings when spinning/moving fast
    var speed=Math.hypot(vx,vy)+Math.abs(vang)*22;
    if(speed>4){
      var layers=4;
      for (var k=1;k<=layers;k++){
        var alpha=(layers-k+1)/layers*0.16;
        ctx.save();
        ctx.rotate(vang*-0.22*k);
        ctx.globalAlpha=alpha;
        ctx.beginPath();
        for (var t=0;t<20;t++){
          var a3=(t/20)*Math.PI*2;
          var rr3=r*(0.92 + 0.02*k);
          var x3=Math.cos(a3)*rr3;
          var y3=Math.sin(a3)*rr3;
          if(t===0) ctx.moveTo(x3,y3); else ctx.lineTo(x3,y3);
        }
        ctx.closePath();
        ctx.strokeStyle="rgba(255,255,255,0.5)";
        ctx.stroke();
        ctx.restore();
      }
    }

    // Face value
    if(value!=null){
      ctx.fillStyle="#0b0c10";
      var size=Math.floor(r*0.70);
      ctx.font="900 "+size+"px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      ctx.textAlign="center";
      ctx.textBaseline="middle";
      ctx.fillText(String(value), 0, 2);
    }

    ctx.restore();

    // Soft drop shadow
    ctx.fillStyle="rgba(0,0,0,0.38)";
    ctx.beginPath();
    ctx.ellipse(cx+6, cy+10, r*1.0, r*0.34, 0, 0, Math.PI*2);
    ctx.fill();
  }

  // Global export
  window.drawFancyD20 = drawFancyD20;
  window.DICE_STYLE_VERSION = "fancy-d20@1.2";
})();
