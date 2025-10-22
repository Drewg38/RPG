
/*! fancy-d20.js v1.3 — glossy, faceted D20 with spin impulse
    API:
      drawFancyD20(ctx, cx, cy, r, ang, value, kinetics)
        - kinetics: { vx, vy, vang, grabbed } (all optional; used for trails)
      fancyD20Impulse(d, power=1)  // helper to bump angular velocity

    This aims to emulate the CodePen-shiny look:
      • Cyan→violet body gradient
      • Crisper facet rings (thicker strokes)
      • Stronger specular sweeps
      • Motion trails tied to velocity/rotation
*/
(function(){
  "use strict";

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
    var g = ctx.createRadialGradient(-r*0.25, -r*0.38, r*0.10, 0, 0, r*1.06);
    g.addColorStop(0.00, "#ccecff");
    g.addColorStop(0.42, "#80b9ff");
    g.addColorStop(0.78, "#6b72ff");
    g.addColorStop(1.00, "#6a3dff");

    // Outer 20-gon shell (facet-y outline via sinusoidal jitter)
    ctx.beginPath();
    for (var i=0;i<20;i++){
      var a=(i/20)*Math.PI*2;
      var rr=r*(0.92 + 0.075*Math.sin(i*1.75));
      var x=Math.cos(a)*rr, y=Math.sin(a)*rr;
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.closePath();
    ctx.fillStyle=g;
    // Bigger, softer shadow for more depth
    ctx.shadowColor="rgba(0,0,0,0.48)";
    ctx.shadowBlur=r*0.22;
    ctx.shadowOffsetX=0; ctx.shadowOffsetY=r*0.10;
    ctx.fill();

    // Facet rings — thicker and higher contrast
    ctx.save();
    ctx.globalAlpha=0.42;
    ctx.lineWidth=Math.max(1.5, r*0.065);
    ctx.strokeStyle="rgba(10,12,20,0.95)";
    for (var ring=0; ring<3; ring++){
      var segs = 20;
      var scale = 0.62 + ring*0.14;
      ctx.beginPath();
      for (var j=0; j<segs; j++){
        var a2=(j/segs)*Math.PI*2 + ring*0.12;
        var rr2=r*scale*(0.98+0.06*Math.sin(j*1.2+ring));
        var x2=Math.cos(a2)*rr2;
        var y2=Math.sin(a2)*rr2;
        if(j===0) ctx.moveTo(x2,y2); else ctx.lineTo(x2,y2);
      }
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();

    // Rim sheen (subtle, bright)
    var rim=ctx.createLinearGradient(-r,0,r,0);
    rim.addColorStop(0,"rgba(255,255,255,0.35)");
    rim.addColorStop(1,"rgba(170,190,255,0.28)");
    ctx.strokeStyle=rim;
    ctx.lineWidth=Math.max(1, r*0.02);
    ctx.stroke();

    // Specular sweeps (two layered ellipses)
    ctx.save();
    ctx.globalAlpha=0.34;
    ctx.beginPath();
    ctx.ellipse(-r*0.28,-r*0.33, r*0.98, r*0.42, -0.62, 0, Math.PI*2);
    ctx.fillStyle="#ffffff";
    ctx.fill();
    ctx.globalAlpha=0.22;
    ctx.beginPath();
    ctx.ellipse(r*0.20,r*0.14, r*0.72, r*0.28, 0.78, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();

    // Velocity/rotation-driven motion rings (visible when spinning/moving fast)
    var speed=Math.hypot(vx,vy)+Math.abs(vang)*22;
    if(speed>4 && !grabbed){
      var layers=6;
      for (var k=1;k<=layers;k++){
        var alpha=(layers-k+1)/layers*0.14;
        ctx.save();
        ctx.rotate(vang*-0.20*k);
        ctx.globalAlpha=alpha;
        ctx.beginPath();
        for (var t=0;t<20;t++){
          var a3=(t/20)*Math.PI*2;
          var rr3=r*(0.94 + 0.018*k);
          var x3=Math.cos(a3)*rr3;
          var y3=Math.sin(a3)*rr3;
          if(t===0) ctx.moveTo(x3,y3); else ctx.lineTo(x3,y3);
        }
        ctx.closePath();
        ctx.strokeStyle="rgba(255,255,255,0.55)";
        ctx.lineWidth=Math.max(1, r*0.02);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Face value
    if(value!=null){
      ctx.fillStyle="#0b0c10";
      var size=Math.floor(r*0.72);
      ctx.font="900 "+size+"px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      ctx.textAlign="center";
      ctx.textBaseline="middle";
      ctx.fillText(String(value), 0, 2);
    }

    ctx.restore();

    // Soft drop shadow under die
    ctx.save();
    ctx.globalAlpha=0.45;
    ctx.fillStyle="#000";
    ctx.beginPath();
    ctx.ellipse(cx+6, cy+10, r*1.05, r*0.36, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  // Helper: add a spin impulse to an object holding { vang }
  function fancyD20Impulse(d, power){
    power = (power==null) ? 1 : +power;
    if(!d) return;
    d.vang = (d.vang||0) + 0.20*power;
  }

  // Global export
  window.drawFancyD20 = drawFancyD20;
  window.fancyD20Impulse = fancyD20Impulse;
  window.DICE_STYLE_VERSION = "fancy-d20@1.3";
})();
