/* dice.js | Provide a custom dice roll. Must return an integer 1..20.
   You can swap this file anytime without touching game.js.
*/
(function(){
  // Example: velocity/angle influenced pseudo-roll
  window.rollD20 = ({ d /* {vx, vy, vang} */, stats, choiceIndex }) => {
    const speed = Math.hypot(d.vx, d.vy);
    const spin = Math.abs(d.vang);
    const bias = ((stats?.Luck||0) * 0.12); // tiny nudge for Luck (optional)
    const seed = (Math.sin(speed*0.37 + spin*0.51 + performance.now()/777) + 1) / 2; // 0..1
    const roll = 1 + Math.floor((seed + (bias % 1)) * 20);
    return Math.max(1, Math.min(20, roll));
  };
})();