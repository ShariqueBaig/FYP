/* Voice feedback for the FYP harness panel in the mock app. A separate script, NOT part of harness.js:
 * it only reads what the harness already shows (the status banner) and logs (window.__FYP_AGENT.results()),
 * so enabling it cannot change what the harness does or measures.
 *
 * Off unless asked: open the app with ?voice=1 (on) or ?voice=0 (offer the switch, start off). The choice is remembered.
 * The agent's static server adds this script to the page only when the URL has a `voice` parameter.
 * It says "Done" only for steps whose success check passed; it never says more than the harness recorded.
 */
(function () {
  var clean = function (s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); };
  var sentences = {
    step: function (row, desc) {
      var what = clean(desc || row.intent);
      var n = row.order ? 'Step ' + row.order + '. ' : '';
      return row.outcome === 'success' ? n + what + '. Done.' : n + what + '. I could not do this step.';
    },
    // title/sub are the two lines of the panel's status banner; rows are this run's log rows.
    closing: function (title, sub, rows, descs) {
      var t = clean(title), s = clean(sub);
      if (t === 'Flow completed') return 'Task completed successfully. ' + s + '.';
      var bad = (rows || []).filter(function (r) { return r.outcome !== 'success'; }).pop();
      var which = bad ? ' I could not do the step: ' + clean((descs || {})[bad.intent] || bad.intent) + '.' : '';
      if (t === 'Finished with misses') return 'I finished, but not everything worked. ' + s + '.' + which + ' You may need to check the rest yourself.';
      if (t === 'Stopped honestly') return 'I could not finish the task.' + which + ' I stopped instead of guessing. You may need to do this step yourself.';
      return '';
    },
  };
  if (typeof module !== 'undefined' && module.exports) { module.exports = { sentences: sentences }; }
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  var q = null, stored = null;
  try { q = new URLSearchParams(location.search).get('voice'); } catch (e) {}
  try { stored = localStorage.getItem('fyp_voice'); } catch (e) {}
  if (q === null && stored === null) return;                   // not requested: do nothing at all
  var on = q === '1' ? true : q === '0' ? false : stored === '1';
  var save = function () { try { localStorage.setItem('fyp_voice', on ? '1' : '0'); } catch (e) {} };
  save();

  var say = function (text) {
    if (!on || !text) return;
    var u = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(u);
  };

  // A small switch. data-fyp-toast keeps the harness from treating it as part of the app.
  var pill = document.createElement('div');
  pill.setAttribute('data-fyp-toast', 'voice');
  pill.setAttribute('role', 'switch');
  pill.setAttribute('tabindex', '0');
  pill.setAttribute('aria-label', 'Voice feedback');
  pill.style.cssText = 'position:fixed;left:10px;bottom:10px;z-index:100001;padding:7px 12px;border-radius:999px;background:#0e0f13;color:#e7e9ee;border:1px solid #2d313b;font:13px system-ui,Segoe UI,sans-serif;cursor:pointer;user-select:none';
  var paint = function () { pill.setAttribute('aria-checked', on ? 'true' : 'false'); pill.textContent = on ? 'Voice: on' : 'Voice: off'; };
  var toggle = function () { on = !on; save(); paint(); if (!on) window.speechSynthesis.cancel(); else say('Voice on.'); };
  pill.addEventListener('click', toggle);
  pill.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
  paint();
  var mount = function () { (document.body || document.documentElement).appendChild(pill); };
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);

  // Narrate new log rows as they appear, and the closing line when the status banner reaches an end state.
  var seen = 0, lastClosing = '', descs = {};
  var bannerTitle = function () { var b = document.querySelector('#fyp-status b'); return b ? clean(b.textContent) : ''; };
  var bannerSub = function () { var s = document.querySelector('#fyp-status span'); return s ? clean(s.textContent) : ''; };
  setInterval(function () {
    var A = window.__FYP_AGENT;
    if (!on || !A || typeof A.results !== 'function') return;
    var title = bannerTitle();
    if (/^Experiment/.test(title)) { seen = Infinity; return; }   // never narrate a batch of hundreds of runs
    var res;
    try { res = A.results(); } catch (e) { return; }
    var log = (res && res.log) || [];
    (res.intents || []).forEach(function (i) { descs[i.id] = i.desc; });
    if (seen === Infinity || log.length < seen) seen = 0;
    for (; seen < log.length; seen++) say(sentences.step(log[seen], descs[log[seen].intent]));
    if (title === 'Running') { lastClosing = ''; return; }
    var line = sentences.closing(title, bannerSub(), log.slice(-12), descs);
    if (line && line !== lastClosing) { lastClosing = line; say(line); }
  }, 500);
})();
