/* dice.js (v2) — RNG + spin helpers
   - Exposes rollD20({ d, stats, choiceIndex }) -> 1..20 (tiny Luck bias)
   - Exposes diceSpin.{dragImpulse, bounceImpulse} to enhance angular velocity
*/
(function(){
  "use strict";

  function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }

  // Slightly bias toward higher values with Luck
  function rollD20(opts){
    opts = opts || {};
    var stats = opts.stats || {};
    var luck = +stats.Luck || 0;

    var v = 1 + Math.floor(Math.random() * 20);
    if (luck > 0){
      var bump = Math.random() < 0.45 ? 0 : Math.min(3, luck);
      v = clamp(v + bump, 1, 20);
    }
    return v;
  }

  var diceSpin = {
    // When user drags / flicks: spin proportional to last movement delta
    dragImpulse: function(dx, dy){
      return (dx - dy) * 0.06;
    },
    // When die bounces on a side; add spin based on speed and which wall
    // side: 'l' | 'r' | 't' | 'b'
    bounceImpulse: function(d, side){
      var speed = Math.hypot(d.vx||0, d.vy||0);
      var sgn = (side==='l' || side==='t') ? 1 : -1;
      return sgn * (0.08 + speed * 0.002); // tuned to feel lively
    }
  };

  window.rollD20 = rollD20;
  window.diceSpin = diceSpin;
})();