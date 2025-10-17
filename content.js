/* content.js (v2) — CSV-only branching story loader.
   Schema (first row headers, case-insensitive):
   - id (required, unique string) — page id
   - title
   - image (full URL)
   - flavor1, flavor2, flavor3 (multi-paragraph)
   - choice1_text, choice1_next, choice1_outcome
   - choice2_text, choice2_next, choice2_outcome
   - choice3_text, choice3_next, choice3_outcome
   - fight_enemy, fight_hp, fight_ac, fight_dmg   (optional — triggers a fight on this page)
   - start (optional; truthy marks the starting page)
   Notes: add more flavorN or choices beyond 3 if you want; the parser will pick up choice4_*, choice5_* too.
*/

// REQUIRED: point to your CSV. Replace this URL if you move the data.
window.DAILY_RPG_CSV_URL = window.DAILY_RPG_CSV_URL || "https://cdn.jsdelivr.net/gh/Drewg38/RPG@4401e6557eeeee27c496081878cd2589e3e9a50e/scenarios.csv";

// Engine options
window.DAILY_RPG_OPTIONS = Object.assign({}, window.DAILY_RPG_OPTIONS, {
  csv_only: true,        // use ONLY CSV content
  start_id: "",          // optional hard override; else use row with start=1 or the first row
  max_choices: 8         // parser will scan up to this many choices: choiceN_text/next/outcome
});

// Simple CSV parser with quoted fields support
function parseCSV(text){
  const rows = [];
  let cur = '', row = [], q = false;
  for (let i=0;i<text.length;i++){
    const ch = text[i], next = text[i+1];
    if (ch === '\r') continue;
    if (q){
      if (ch === '"' && next === '"'){ cur += '"'; i++; continue; }
      if (ch === '"'){ q = false; continue; }
      cur += ch; continue;
    }
    if (ch === '"'){ q = true; continue; }
    if (ch === ','){ row.push(cur); cur=''; continue; }
    if (ch === '\n'){ row.push(cur); rows.push(row); row=[]; cur=''; continue; }
    cur += ch;
  }
  if (cur.length || row.length){ row.push(cur); rows.push(row); }
  return rows;
}

function truthy(v){ return /^(1|true|yes|y|on)$/i.test(String(v||'').trim()); }
function toInt(v, d=0){ const n = parseInt(String(v).trim(), 10); return Number.isFinite(n) ? n : d; }
function parseDamage(expr){
  // Accept forms like "1d6+1", "2d8", "4", empty => 1
  const s = String(expr||'').trim();
  if (!s) return { dice:1, sides:4, bonus:0 };
  const m = s.match(/^(\d+)\s*d\s*(\d+)(?:\s*([+-])\s*(\d+))?$/i);
  if (!m){
    const flat = parseInt(s,10);
    return Number.isFinite(flat) ? { dice:1, sides:1, bonus:flat } : { dice:1, sides:4, bonus:0 };
  }
  const dice = parseInt(m[1],10), sides = parseInt(m[2],10);
  const bonus = m[3] ? (m[3] === '-' ? -1 : 1) * parseInt(m[4]||'0',10) : 0;
  return { dice, sides, bonus };
}

(async () => {
  if (!window.DAILY_RPG_CSV_URL) { console.error('[content] No CSV URL set'); return; }
  try{
    const csv = await fetch(window.DAILY_RPG_CSV_URL, { cache:'no-store' }).then(r=>r.text());
    const rows = parseCSV(csv);
    if (!rows.length) throw new Error('Empty CSV');
    const headers = rows[0].map(h => String(h||'').trim().toLowerCase());
    const idx = (name) => headers.indexOf(name);
    const h = {
      id: idx('id'),
      title: idx('title'),
      image: idx('image'),
      start: idx('start')
    };
    // Collect flavorN headers
    const flavorIdx = headers
      .map((name, i) => ({name, i}))
      .filter(o => /^flavor\d+$/i.test(o.name))
      .map(o => o.i);
    // Collect up to N choice groups
    const N = window.DAILY_RPG_OPTIONS.max_choices || 8;
    const choiceSets = [];
    for (let n=1; n<=N; n++){
      const ctext = idx(`choice${n}_text`);
      const cnext = idx(`choice${n}_next`);
      const cout  = idx(`choice${n}_outcome`);
      if (ctext>=0 || cnext>=0 || cout>=0) choiceSets.push({ ctext, cnext, cout });
    }
    const fightCols = {
      enemy: idx('fight_enemy'), hp: idx('fight_hp'), ac: idx('fight_ac'), dmg: idx('fight_dmg')
    };

    const pages = {};
    let startId = window.DAILY_RPG_OPTIONS.start_id || "";

    for (let r=1; r<rows.length; r++){
      const row = rows[r];
      const id = String(row[h.id]||'').trim();
      if (!id) continue;
      const title = String(row[h.title]||'').trim();
      const image = String(row[h.image]||'').trim();
      const flavor = flavorIdx.map(i => row[i]).filter(Boolean).map(s => String(s).trim());

      const choices = [];
      for (const cs of choiceSets){
        const text = row[cs.ctext]; const next = row[cs.cnext]; const out = row[cs.cout];
        if (!text && !next && !out) continue;
        choices.push({
          text: String(text||'').trim(),
          next: String(next||'').trim(),   // can be another page id or END
          outcome: String(out||'').trim()
        });
      }

      let fight = null;
      if ((fightCols.enemy>=0 && row[fightCols.enemy]) || (fightCols.hp>=0 && row[fightCols.hp])){
        fight = {
          enemy: String(row[fightCols.enemy]||'Enemy').trim(),
          hp: toInt(row[fightCols.hp], 8),
          ac: toInt(row[fightCols.ac], 10),
          dmg: parseDamage(row[fightCols.dmg]||'1d6')
        };
      }

      pages[id] = { id, title, image, flavor, choices, fight };
      if (!startId && h.start>=0 && truthy(row[h.start])) startId = id;
    }

    if (!startId){
      // fallback to first data row id
      const firstRow = rows[1] || [];
      startId = String(firstRow[h.id]||'').trim();
    }

    window.RPG_CONTENT = { pages, startId };
    window.dispatchEvent(new CustomEvent('daily-rpg:content-ready', { detail: { pages: Object.keys(pages).length, startId } }));
  } catch (err){
    console.error('[content] load failed', err);
    window.RPG_CONTENT = { pages:{}, startId:'' };
  }
})();