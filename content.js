/* content.js | Load scenarios from CSV or JSON to override defaults.
   Easiest path: host a CSV in GitHub (raw URL) or publish a Google Sheet to CSV.
   Columns: title, flavor1, flavor2, flavor3, choice1, choice2, choice3, activities (; separated)
*/
window.DAILY_RPG_CSV_URL = window.DAILY_RPG_CSV_URL || ""; // e.g. https://raw.githubusercontent.com/USER/REPO/main/data/scenarios.csv

(async () => {
  if(!window.DAILY_RPG_CSV_URL) return;
  try {
    const txt = await fetch(window.DAILY_RPG_CSV_URL, {cache:'no-store'}).then(r=>r.text());
    const rows = txt.trim().split(/\r?\n/).map(line => {
      // very naive CSV split; for robust parsing, prebuild JSON in your repo
      const parts = []; let cur = ''; let q = false;
      for (let i=0;i<line.length;i++){
        const ch = line[i];
        if(ch === '\"'){ q = !q; continue; }
        if(ch === ',' && !q){ parts.push(cur); cur=''; continue; }
        cur += ch;
      }
      parts.push(cur);
      return parts.map(s=>s.replace(/^\s+|\s+$/g,''));
    });
    const out = [];
    for(let i=1;i<rows.length;i++){
      const [title,f1,f2,f3,c1,c2,c3,acts] = rows[i];
      out.push({
        title,
        flavor: [f1,f2,f3].filter(Boolean),
        choices: [c1,c2,c3].filter(Boolean),
        activities: String(acts||'').split(';').map(n=>n.trim()).filter(Boolean).map(name=>({name, bonus:1}))
      });
    }
    if(out.length) window.DAILY_RPG_SCENARIOS = out;
  } catch(err){ console.error('[content.js] load failed', err); }
})();