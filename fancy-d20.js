
/*! fancy-d20.js v1.1 */
(function(){
  "use strict";
  /**
   * drawFancyD20(ctx, cx, cy, r, ang, value, kinetics)
   * kinetics: { vx, vy, vang, grabbed }  // all optional
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

    // Body gradient
    var g = ctx.createRadialGradient(-r*0.35, -r*0.35, r*0.2, 0, 0, r);
    g.addColorStop(0, "#b9e2ff");
    g.addColorStop(0.55, "#6297ff");
    g.addColorStop(1, "#6a44ff");

    // Rounded 20-gon body
    ctx.beginPath();
    for (var i=0;i<20;i++){
      var a=(i/20)*Math.PI*2;
      var rr=r*(0.92+0.06*Math.sin(i*1.7));
      var x=Math.cos(a)*rr, y=Math.sin(a)*rr;
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.closePath();
    ctx.fillStyle=g;
    ctx.shadowColor="rgba(0,0,0,0.35)";
    ctx.shadowBlur=grabbed?18:12;
    ctx.shadowOffsetX=0; ctx.shadowOffsetY=4;
    ctx.fill();

    // Facet wires
    ctx.save();
    ctx.globalAlpha=0.25;
    ctx.lineWidth=Math.max(1, Math.floor(r*0.06));
    ctx.strokeStyle="rgba(12,14,22,0.9)";
    for (var f=0; f<10; f++){
      var a2=(f/10)*Math.PI*2;
      ctx.beginPath();
      for (var j=0; j<10; j++){
        var rr2=r*(0.45 + 0.45*Math.sin((j+f*0.5)*0.9));
        var x2=Math.cos(a2 + j*0.62)*rr2;
        var y2=Math.sin(a2 + j*0.62)*rr2;
        if(j===0) ctx.moveTo(x2,y2); else ctx.lineTo(x2,y2);
      }
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();

    // Rim glow
    var rim=ctx.createLinearGradient(-r,0,r,0);
    rim.addColorStop(0,"rgba(148,163,184,0.25)");
    rim.addColorStop(1,"rgba(255,255,255,0.35)");
    ctx.strokeStyle=rim;
    ctx.lineWidth=1.25;
    ctx.stroke();

    // Specular sweep
    ctx.globalAlpha=0.28;
    ctx.beginPath();
    ctx.ellipse(-r*0.25,-r*0.25, r*0.9, r*0.38, -0.7, 0, Math.PI*2);
    ctx.fillStyle="#ffffff";
    ctx.fill();
    ctx.globalAlpha=1;

    // Motion trail if spinning/moving fast
    var speed=Math.hypot(vx,vy)+Math.abs(vang)*20;
    if(speed>4){
      var layers=3;
      for (var k=1;k<=layers;k++){
        var alpha=(layers-k+1)/layers*0.18;
        ctx.save();
        ctx.rotate(vang*-0.25*k);
        ctx.globalAlpha=alpha;
        ctx.beginPath();
        for (var t=0;t<20;t++){
          var a3=(t/20)*Math.PI*2;
          var rr3=r*(0.92+0.02*k);
          var x3=Math.cos(a3)*rr3;
          var y3=Math.sin(a3)*rr3;
          if(t===0) ctx.moveTo(x3,y3); else ctx.lineTo(x3,y3);
        }
        ctx.closePath();
        ctx.strokeStyle="rgba(255,255,255,0.4)";
        ctx.stroke();
        ctx.restore();
      }
    }

    // Face value
    if(value!=null){
      ctx.fillStyle="#0b0c10";
      var size=Math.floor(r*0.72);
      ctx.font="900 "+size+"px system-ui, sans-serif";
      ctx.textAlign="center";
      ctx.textBaseline="middle";
      ctx.fillText(String(value), 0, 2);
    }

    ctx.restore();

    // Drop shadow
    ctx.fillStyle="rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(cx+6, cy+10, r*0.95, r*0.32, 0, 0, Math.PI*2);
    ctx.fill();
  }

  // Global export
  window.drawFancyD20 = drawFancyD20;
  window.DICE_STYLE_VERSION = "fancy-d20@1.1";
})();
