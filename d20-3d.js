
/*! d20-3d.js v0.9 — dependency-free 3D D20 renderer for Canvas2D */
(function(){
  "use strict";
  var TAU = Math.PI*2;
  var PHI = (1+Math.sqrt(5))/2;
  var V = [
    [ -1,  PHI,  0 ], [  1,  PHI,  0 ], [ -1, -PHI,  0 ], [  1, -PHI,  0 ],
    [  0, -1,  PHI ], [  0,  1,  PHI ], [  0, -1, -PHI ], [  0,  1, -PHI ],
    [  PHI,  0, -1 ], [  PHI,  0,  1 ], [ -PHI,  0, -1 ], [ -PHI,  0,  1 ]
  ];
  for(var i=0;i<V.length;i++){ var x=V[i][0], y=V[i][1], z=V[i][2]; var inv=1/Math.hypot(x,y,z); V[i]=[x*inv, y*inv, z*inv]; }
  var F = [
    [0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],
    [1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],
    [3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],
    [4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]
  ];
  function rotate(p, rx, ry, rz){
    var x=p[0], y=p[1], z=p[2];
    var cy=Math.cos(rx), sy=Math.sin(rx); var y1=y*cy - z*sy, z1=y*sy + z*cy;
    var cx=Math.cos(ry), sx=Math.sin(ry); var x2=x*cx + z1*sx, z2=-x*sx + z1*cx;
    var cz=Math.cos(rz), sz=Math.sin(rz); var x3=x2*cz - y1*sz, y3=x2*sz + y1*cz;
    return [x3,y3,z2];
  }
  function project(p, scale){
    var fov=2.4, z=p[2]+2.6, k=fov/(fov+z);
    return [p[0]*scale*k, p[1]*scale*k, z, k];
  }
  function centroid(a,b,c){ return [(a[0]+b[0]+c[0])/3,(a[1]+b[1]+c[1])/3,(a[2]+b[2]+c[2])/3]; }
  function normal(a,b,c){ var ux=b[0]-a[0], uy=b[1]-a[1], uz=b[2]-a[2]; var vx=c[0]-a[0], vy=c[1]-a[1], vz=c[2]-a[2]; return [ uy*vz-uz*vy, uz*vx-ux*vz, ux*vy-uy*vx ]; }
  function dot(a,b){ return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
  function drawD20_3D(ctx, cx, cy, r, rot, opts){
    rot=rot||{rx:0,ry:0,rz:0}; opts=opts||{};
    var fc=opts.faceColor||"#4169e1"; var ec=opts.edgeColor||"rgba(255,255,255,0.55)"; var nc=opts.numberColor||"#ffffff"; var cull=(opts.backfaceCull!==false);
    var Rverts=new Array(V.length); for(var i=0;i<V.length;i++){ Rverts[i]=rotate(V[i], rot.rx||0, rot.ry||0, rot.rz||0); }
    var faces=[];
    for(var fi=0;fi<F.length;fi++){
      var a=Rverts[F[fi][0]], b=Rverts[F[fi][1]], c=Rverts[F[fi][2]];
      var n=normal(a,b,c); if(cull && dot(n,[0,0,1])<=0) continue;
      var cent=centroid(a,b,c); var P1=project(a,r), P2=project(b,r), P3=project(c,r);
      faces.push({idx:fi,z:cent[2],pts:[P1,P2,P3],cent:project(cent,r)});
    }
    faces.sort(function(A,B){ return A.z-B.z; });
    ctx.save(); ctx.translate(cx,cy);
    for(var k=0;k<faces.length;k++){
      var f=faces[k], p1=f.pts[0], p2=f.pts[1], p3=f.pts[2];
      ctx.beginPath(); ctx.moveTo(p1[0],p1[1]); ctx.lineTo(p2[0],p2[1]); ctx.lineTo(p3[0],p3[1]); ctx.closePath();
      ctx.fillStyle=fc; ctx.fill();
      ctx.lineWidth=Math.max(1, r*0.02); ctx.strokeStyle=ec; ctx.stroke();
      var num=f.idx+1; ctx.fillStyle=nc; ctx.font="900 "+Math.floor(r*0.22)+"px system-ui,-apple-system,Segoe UI,Roboto,sans-serif"; ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.fillText(String(num), f.cent[0], f.cent[1]);
    }
    ctx.restore();
  }
  function stepD20Rotation(rot, vr){ rot.rx+=vr.vrx||0; rot.ry+=vr.vry||0; rot.rz+=vr.vrz||0; var TAU=Math.PI*2; rot.rx%=TAU; rot.ry%=TAU; rot.rz%=TAU; return rot; }
  window.drawD20_3D=drawD20_3D; window.stepD20Rotation=stepD20Rotation; window.numberedD20Faces=F;
})();
