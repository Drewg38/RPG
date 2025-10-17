/* logger.js | POST gameplay events to your Google Apps Script Web App (doPost).
   1) Create a Google Sheet, Tools → Apps Script → New project
   2) Paste a doPost handler to append rows, deploy as Web App (execute as you, accessible to anyone)
   3) Put the deployed URL in LOG_POST_URL
*/
window.LOG_POST_URL = window.LOG_POST_URL || ""; // e.g. https://script.google.com/macros/s/DEPLOYMENT_ID/exec

window.logSelection = async (payload) => {
  if(!window.LOG_POST_URL) return;
  try {
    await fetch(window.LOG_POST_URL, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
  } catch (e) {
    console.warn('[logger] failed to log', e);
  }
};