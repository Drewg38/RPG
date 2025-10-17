/* dice.js (v2) — velocity- + spin-influenced D20. Returns integer 1..20. */
(function(){
  window.rollD20 = ({ d, stats, tag }) => {
    const vx = Number(d?.vx||0), vy = Number(d?.vy||0), vang = Number(d?.vang||0);
    const speed = Math.hypot(vx, vy);
    const spin = Math.abs(vang);
    const luck = Number(stats?.Luck||0);
    const bias = (luck * 0.12); // tiny nudge for Luck
    const t = performance.now() / 911; // time component
    const seed = (Math.sin(speed*0.37 + spin*0.51 + t) + 1) / 2; // 0..1
    const roll = 1 + Math.floor((seed + (bias % 1)) * 20);
    return Math.max(1, Math.min(20, roll));
  };
})();