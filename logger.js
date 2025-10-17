/* logger.js (v2) — optional event logger to Google Apps Script */
window.LOG_POST_URL = window.LOG_POST_URL || ""; // e.g., https://script.google.com/macros/s/DEPLOYMENT_ID/exec

function logEvent(kind, payload){
  if (!window.LOG_POST_URL) return;
  try{
    fetch(window.LOG_POST_URL, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ kind, ...payload, ts: Date.now() })
    }).catch(()=>{});
  }catch(_){}
}
window.logSelection = (payload) => logEvent('selection', payload);
window.logFightRound = (payload) => logEvent('fight', payload);
