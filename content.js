/* content.js | Override scenarios by loading your CSV via jsDelivr or Google Sheets CSV.
   Repo CSV (pinned to commit): https://cdn.jsdelivr.net/gh/Drewg38/RPG@4401e6557eeeee27c496081878cd2589e3e9a50e/scenarios.csv

   CSV columns (minimum):
   - title, flavor1, flavor2, flavor3, choice1, choice2, choice3, activities
   Notes:
   - activities are ; (semicolon) separated, e.g. "Thrusters;Nav Charts;Shields"
   - Optional future columns are ignored safely (e.g., header_image)

   Behavior:
   - Loads CSV -> builds window.DAILY_RPG_SCENARIOS (array)
   - Dispatches 'daily-rpg:content-ready' event when done
   - If DAILY_RPG_CSV_URL is blank, does nothing (game falls back to defaults)
*/

// 1) Point to your scenarios.csv in this repo (pinned to a specific commit for stability).
window.DAILY_RPG_CSV_URL = "https://cdn.jsdelivr.net/gh/Drewg38/RPG@4401e6557eeeee27c496081878cd2589e3e9a50e/scenarios.csv";

// 2) Optional behavior flags
window.DAILY_RPG_OPTIONS = Object.assign({}, window.DAILY_RPG_OPTIONS, {
  merge_with_defaults: false,       // if true, append CSV scenarios to built-in ones instead of replacing
  set_header_image_from_csv: true,  // if a 'header_image' column exists, call window.setHeaderImage(url)
});

// --- tiny CSV parser (handles quotes) ---
function parseCSV(text) {
  const rows = [];
  let cur = '', row = [], inQuotes = false;
  for (let i=0; i<text.length; i++) {
    const ch = text[i], next = text[i+1];
    if (ch === '\r') continue;  // normalize
    if (inQuotes) {
      if (ch === '"' && next === '"') { cur += '"'; i++; continue; }
      if (ch === '"') { inQuotes = false; continue; }
      cur += ch; continue;
    }
    if (ch === '"') { inQuotes = true; continue; }
    if (ch === ',') { row.push(cur.trim()); cur=''; continue; }
    if (ch === '\n') { row.push(cur.trim()); rows.push(row); row=[]; cur=''; continue; }
    cur += ch;
  }
  if (cur.length || row.length) { row.push(cur.trim()); rows.push(row); }
  return rows;
}

(async () => {
  if (!window.DAILY_RPG_CSV_URL) return;
  try {
    const txt = await fetch(window.DAILY_RPG_CSV_URL, { cache: 'no-store' }).then(r => r.text());
    const rows = parseCSV(txt);
    if (!rows.length) return;

    // Build index of headers -> col indices
    const headers = rows[0].map(h => (h||'').toString().trim().toLowerCase());
    const get = name => headers.indexOf(name);

    const iTitle  = get('title');
    const iF1     = get('flavor1');
    const iF2     = get('flavor2');
    const iF3     = get('flavor3');
    const iC1     = get('choice1');
    const iC2     = get('choice2');
    const iC3     = get('choice3');
    const iActs   = get('activities');
    const iHeader = get('header_image'); // optional

    const out = [];
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || !row.length) continue;
      const title = row[iTitle] || '';
      if (!title) continue;

      const flavor = [row[iF1], row[iF2], row[iF3]].filter(Boolean);
      const choices = [row[iC1], row[iC2], row[iC3]].filter(Boolean);
      const acts = String(row[iActs] || '')
        .split(';')
        .map(s => s.trim())
        .filter(Boolean)
        .map(name => ({ name, bonus: 1 }));

      out.push({ title, flavor, choices, activities: acts, header_image: row[iHeader] || '' });
    }

    if (!out.length) return;

    // Optionally set header image from the first scenario that has it
    if (window.DAILY_RPG_OPTIONS.set_header_image_from_csv) {
      const img = out.find(s => s.header_image && s.header_image.trim())?.header_image;
      if (img && typeof window.setHeaderImage === 'function') {
        try { window.setHeaderImage(img); } catch (e) { /* ignore */ }
      }
    }

    // Expose scenarios to the game
    if (window.DAILY_RPG_OPTIONS.merge_with_defaults && Array.isArray(window.DAILY_RPG_SCENARIOS)) {
      window.DAILY_RPG_SCENARIOS = (window.DAILY_RPG_SCENARIOS || []).concat(out);
    } else {
      window.DAILY_RPG_SCENARIOS = out;
    }

    // Notify listeners (if any)
    try { window.dispatchEvent(new CustomEvent('daily-rpg:content-ready', { detail: { count: out.length } })); } catch (_) { /* no-op */ }
  } catch (err) {
    console.error('[content.js] load failed', err);
  }
})();
