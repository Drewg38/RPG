/* loader.js (v4) — Robust loader with CDN + raw fallbacks and contraction rescue
   - Loads dice.js, content.js, logger.js, game.js from your repo.
   - Tries jsDelivr @main, raw.githubusercontent @main, pinned commit on both.
   - If game.js eval fails due to apostrophes in single-quoted strings, it rescues by escaping them and re-evaluates.
*/
(function(){
  "use strict";

  var COMMIT_FALLBACK = "4401e6557eeeee27c496081878cd2589e3e9a50e";

  var qs = new URLSearchParams(location.search);
  var csvOverride = qs.get("csv");
  var logOverride = qs.get("log");
  if (csvOverride) { window.DAILY_RPG_CSV_URL = csvOverride; }
  if (!window.DAILY_RPG_CSV_URL) {
    window.DAILY_RPG_CSV_URL = "https://cdn.jsdelivr.net/gh/Drewg38/RPG@main/scenarios.csv";
  }
  if (logOverride) { window.LOG_POST_URL = logOverride; }

  var FILES = [
    { name: "dice.js",    patch: false },
    { name: "content.js", patch: false },
    { name: "logger.js",  patch: false },
    { name: "game.js",    patch: false } // v3+ uses double quotes; rescue still available on failure
  ];

  var SOURCES = [
    function(f){ return "https://cdn.jsdelivr.net/gh/Drewg38/RPG@main/" + f; },
    function(f){ return "https://raw.githubusercontent.com/Drewg38/RPG/main/" + f; },
    function(f){ return "https://cdn.jsdelivr.net/gh/Drewg38/RPG@" + COMMIT_FALLBACK + "/" + f; },
    function(f){ return "https://raw.githubusercontent.com/Drewg38/RPG/" + COMMIT_FALLBACK + "/" + f; }
  ];

  // Diagnostics hooks (optional UI)
  var diagEl  = document.getElementById("rpg-diag");
  var logEl   = document.getElementById("rpg-diag-log");
  var testsEl = document.getElementById("rpg-diag-tests");

  function showDiag(){ if(diagEl) diagEl.style.display="block"; }
  function pill(html, cls){
    if (logEl) {
      var d = document.createElement("div");
      d.className = cls ? ("pill " + cls) : "pill";
      d.innerHTML = html;
      logEl.appendChild(d);
    } else {
      console[(cls==="err")?"error":(cls==="warn")?"warn":"log"](html.replace(/<[^>]+>/g,""));
    }
  }
  function testPill(label, ok){
    if (testsEl) {
      var d = document.createElement("div");
      d.className = "pill " + (ok ? "ok" : "err");
      d.textContent = (ok ? "✔ " : "✖ ") + label;
      testsEl.appendChild(d);
    } else {
      console.log((ok?"✔ ":"✖ ") + label);
    }
  }

  function shouldShowDiag(){ return new URLSearchParams(location.search).has("debug"); }

  function bust(u){ return u + (u.indexOf("?")>=0 ? "&" : "?") + "v=" + Date.now(); }

  function fetchText(url){
    return fetch(url, {cache:"no-store"}).then(function(r){
      if(!r.ok) throw new Error("HTTP "+r.status+" for "+url);
      return r.text();
    });
  }

  function sanitizeContractions(src){
    // you've -> you\'ve, we're -> we\'re, don't -> don\'t
    return src.replace(/\b([A-Za-z]+)'(ve|re|ll|d|m|s|t)\b/g, "$1\\'$2");
  }

  function tryEval(sourceURL, code){
    /* eslint no-eval: 0 */
    var wrapped = code + "\n//# sourceURL=" + sourceURL;
    (0,eval)(wrapped);
  }

  function loadEval(urlRaw, patch){
    var url = bust(urlRaw);
    return fetchText(url).then(function(code){
      try {
        tryEval(urlRaw, patch ? sanitizeContractions(code) : code);
      } catch (e) {
        // Rescue pass for game.js only (apostrophes in single-quoted strings)
        if (/\/game\.js($|\?)/.test(urlRaw)){
          try {
            tryEval(urlRaw+"?patched=1", sanitizeContractions(code));
            pill("Patched contractions in <code>"+urlRaw+"</code>", "warn");
            return;
          } catch (e2) {
            pill("Eval failed for <code>"+urlRaw+"</code>: " + (e2 && e2.message || e2), "err");
            throw e2;
          }
        }
        pill("Eval failed for <code>"+urlRaw+"</code>: " + (e && e.message || e), "err");
        throw e;
      }
    });
  }

  function loadAll(){
    testsEl && (testsEl.innerHTML="");
    logEl && (logEl.innerHTML="");
    var chain = Promise.resolve();
    FILES.forEach(function(file){
      chain = chain.then(function(){
        var loaded = false, lastErr = null, idx = 0;
        function tryNext(){
          if (idx >= SOURCES.length){
            if (lastErr) throw lastErr; else throw new Error("Unknown load error");
          }
          var urlRaw = SOURCES[idx++](file.name);
          pill("Loading <code>"+urlRaw+"</code> …", "warn");
          return loadEval(urlRaw, file.patch).then(function(){
            pill("Loaded <code>"+urlRaw+"</code>", "ok"); loaded=true;
          }).catch(function(err){
            lastErr = err; return tryNext();
          });
        }
        return tryNext();
      });
    });
    return chain;
  }

  function runSelfTests(){
    var stageOK = !!document.getElementById("stage");
    testPill("Canvas element exists", stageOK);

    var r1 = typeof window.rollD20 === "function";
    testPill("rollD20 is a function", r1);
    if(r1){
      try{
        var v = window.rollD20({ d:{vx:1,vy:1,vang:0}, stats:{Luck:0}, choiceIndex:0 });
        var ok = Number.isInteger(v) && v>=1 && v<=20;
        testPill("rollD20 returns 1..20", ok);
      }catch(e){ testPill("rollD20 invocation", false); pill("rollD20 threw: "+(e&&e.message||e), "err"); }
    }

    testPill("Game script executed (RAF available)", !!window.requestAnimationFrame);
    var contentOK = !!(window.RPG_CONTENT && window.RPG_CONTENT.pages && Object.keys(window.RPG_CONTENT.pages).length);
    testPill("CSV content loaded (RPG_CONTENT.pages)", contentOK);
    if(contentOK){
      var p = window.RPG_CONTENT.pages[window.RPG_CONTENT.startId];
      testPill("Start page exists", !!p);
      testPill("Start page has title", !!(p && p.title));
      testPill("Start page has flavor", !!(p && Array.isArray(p.flavor)));
    }
  }

  window.addEventListener("error", function(e){ if(shouldShowDiag()) showDiag(); pill("Runtime error: " + (e.message||"Script error"), "err"); });
  window.addEventListener("unhandledrejection", function(e){ if(shouldShowDiag()) showDiag(); var r=e && e.reason; pill("Unhandled rejection: " + (r && r.message || r || "unknown"), "err"); });

  function start(){
    loadAll().then(function(){
      if(shouldShowDiag()) showDiag();
      runSelfTests();
    }).catch(function(err){
      showDiag(); pill("❌ Load/eval failed. Check commit hash, paths, or syntax in repo.", "err"); runSelfTests();
    });
  }

  var retryBtn = document.getElementById("rpg-retry");
  if (retryBtn) retryBtn.addEventListener("click", start);
  start();
})();