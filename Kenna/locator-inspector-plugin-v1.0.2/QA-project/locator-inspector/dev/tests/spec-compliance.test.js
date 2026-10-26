/**
 * Spec-compliance acceptance tests — maps a 10-point locator-engine spec to
 * hard, programmatic checks (not eyeballing). Run: node tests/spec-compliance.test.js
 */
const fs = require("fs");
const path = require("path");
require("fake-indexeddb/auto");
const { JSDOM } = require("jsdom");
const overlaySrc = fs.readFileSync(path.join(__dirname, "..", "overlay.js"), "utf-8");
function load(bodyHtml, url) {
  const dom = new JSDOM(`<!DOCTYPE html><html><body>${bodyHtml}</body></html>`,
    { runScripts: "outside-only", url: url || "https://edc.qa.securiti.xyz/", pretendToBeVisual: true });
  const { window } = dom;
  window.indexedDB = globalThis.indexedDB; window.IDBKeyRange = globalThis.IDBKeyRange;
  if (!window.CSS) window.CSS = {};
  if (!window.CSS.escape) window.CSS.escape = (s) => String(s).replace(/[^\w-]/g, "\\$&");
  window.eval(overlaySrc);
  return window;
}
let passed = 0, failed = 0;
function check(n, c, d) { if (c) { passed++; console.log("  ✓ " + n); } else { failed++; console.log("  ✗ " + n + (d !== undefined ? "  — " + d : "")); } }

// Resolve within the SAME root as the element (shadow-aware), the way the engine does.
function uniqueInDoc(win, css, el) {
  const root = el.getRootNode ? el.getRootNode() : win.document;
  let m; try { m = root.querySelectorAll(css); } catch { return { n: -1, same: false }; }
  return { n: m.length, same: m.length === 1 && m[0] === el };
}

(function () {
  const api = (w) => w.__locatorInspector;

  console.log("\n[AC1] 3+ elements with an identical class under a unique container -> each 1-of-1");
  {
    const w = load(`<div id="orders"><span class="cell">A</span><span class="cell">B</span><span class="cell">C</span><span class="cell">D</span></div>`);
    const cells = [...w.document.querySelectorAll(".cell")];
    let allUnique = true, allExact = true, distinct = new Set();
    for (const el of cells) {
      const r = api(w).resolveUniqueLocator(el);
      const v = uniqueInDoc(w, r.css, el);
      distinct.add(r.css);
      if (!r.unique || v.n !== 1) allUnique = false;
      if (!v.same) allExact = false;
    }
    check("every identical-class sibling resolves to exactly 1 match", allUnique);
    check("each resolved CSS points at the correct element", allExact);
    check("the four locators are all distinct", distinct.size === cells.length, distinct.size + "/" + cells.length);
  }

  console.log("\n[AC2] No unique ancestor anywhere -> two identical sibling structures get DIFFERENT verified full-path locators");
  {
    // No ids, no testids, no distinctive text: two identical card structures.
    const card = `<div><div><span>Item</span><button>Go</button></div></div>`;
    const w = load(`<section><div>${card}${card}</div></section>`);
    const btns = [...w.document.querySelectorAll("button")];
    const r0 = api(w).resolveUniqueLocator(btns[0]);
    const r1 = api(w).resolveUniqueLocator(btns[1]);
    const v0 = uniqueInDoc(w, r0.css, btns[0]);
    const v1 = uniqueInDoc(w, r1.css, btns[1]);
    check("first button locator is verified 1-of-1 & correct", r0.unique && v0.n === 1 && v0.same, r0.css);
    check("second button locator is verified 1-of-1 & correct", r1.unique && v1.n === 1 && v1.same, r1.css);
    check("the two fallback paths are provably different", r0.css !== r1.css, r0.css + "  vs  " + r1.css);
  }

  console.log("\n[AC-CC] Positional fallback uses CHILD combinators (>), never bare descendant spaces between positional segments");
  {
    const w = load(`<section><div><div><span>x</span><span>y</span></div></div></section>`);
    const el = w.document.querySelectorAll("span")[1];
    const r = api(w).resolveUniqueLocator(el);
    const hasNth = /:nth-of-type/.test(r.css);
    // If positional, there must be NO " tag" descendant joins between positional parts — only " > ".
    const badDescendantBetweenPositional = /:nth-of-type\(\d+\)\s+[a-z]/i.test(r.css);
    check("fallback is positional here", hasNth, r.css);
    check("positional segments are joined by child combinators only", !badDescendantBetweenPositional, r.css);
    const v = uniqueInDoc(w, r.css, el); check("and it is verified 1-of-1", v.n === 1 && v.same, r.css);
  }

  console.log("\n[AC3] Element inside an OPEN shadow root is found + verified (no silent 0 matches)");
  {
    const w = load(`<div id="host"></div>`);
    const host = w.document.getElementById("host");
    const sr = host.attachShadow({ mode: "open" });
    sr.innerHTML = `<button class="s-btn" aria-label="Shadow Save">Save</button><button class="s-btn">Other</button>`;
    const target = sr.querySelector('[aria-label="Shadow Save"]');
    const r = api(w).resolveUniqueLocator(target);
    const v = uniqueInDoc(w, r.css, target);
    check("engine returns a unique result for a shadow-hosted element", r.unique === true, JSON.stringify({ u: r.unique, css: r.css }));
    check("its CSS resolves to exactly 1 inside the shadow root (not 0)", v.n === 1, "matches=" + v.n);
    check("and it points at the correct shadow element", v.same, r.css);
    check("boundary metadata reports the shadow root", r.boundary && /shadow/.test(r.boundary.type || ""), r.boundary && r.boundary.type);
  }

  console.log("\n[AC4/#5] A pinned locator that stops matching is logged broken, with match count, and is NOT auto-substituted");
  {
    const w = load(`<button data-testid="pinme">Save</button><div id="rest"></div>`);
    const el = w.document.querySelector('[data-testid="pinme"]');
    const r = api(w).resolveUniqueLocator(el);
    api(w)._registry.tracked.set(r.css, { css: r.css, primary: r.primary, strategy: r.primaryStrategy, stability: r.stability, checks: 0, breaks: 0, root: w.document });
    // Break it: remove the element entirely.
    el.remove();
    api(w).revalidateAll("manual");
    const rec = api(w)._registry.tracked.get(r.css);
    check("deviation is logged with its exact observed count (0)", rec.lastCount === 0, "lastCount=" + rec.lastCount);
    check("deviation carries a timestamp + reason (auditable event)", rec.lastBreak && rec.lastBreak.at > 0 && rec.lastBreak.count === 0, JSON.stringify(rec.lastBreak));
    // No auto-substitution: the tracked entry still references the ORIGINAL css, not some 'closest' element.
    check("tool did NOT silently swap in a replacement locator", api(w)._registry.tracked.get(r.css) && api(w)._registry.tracked.get(r.css).css === r.css);
    // ZERO matches must NOT be held against the locator. The element being gone means
    // it is not on this page -- which happens on every route change, drawer close and
    // virtual-list scroll. Counting that as a defect made the old "Flaky" badge fire
    // constantly and mean nothing.
    check("count 0 is recorded as absent, not as a defect", rec.absent === 1 && !rec.breaks, "absent=" + rec.absent + " breaks=" + rec.breaks);
    check("verdict for an absent element is Off-page, not Flaky", api(w).flakinessVerdict(rec).label === "Off-page", api(w).flakinessVerdict(rec).label);
  }

  console.log("\n[AC4b] AMBIGUITY (count > 1) is the failure that IS held against a locator");
  {
    // The one outcome that makes a passing test act on the wrong node: a locator that
    // was 1-of-1 when emitted now matches several.
    const w = load(`<div id="host"><button class="act">Save</button></div>`);
    const el = w.document.querySelector("button.act");
    const r = api(w).resolveUniqueLocator(el);
    api(w)._registry.tracked.set(r.css, { css: r.css, primary: r.primary, strategy: r.primaryStrategy,
      stability: r.stability, checks: 0, breaks: 0, present: 0, absent: 0, root: w.document });
    // A second render adds an identical sibling -- the classic re-render duplication.
    w.document.getElementById("host").insertAdjacentHTML("beforeend", '<button class="act">Save</button>');
    api(w).revalidateAll("manual");
    const rec = api(w)._registry.tracked.get(r.css);
    check("ambiguity increments breaks", rec.breaks === 1, "breaks=" + rec.breaks);
    check("observed count is logged", rec.lastCount === 2, "lastCount=" + rec.lastCount);
    check("verdict is Ambiguous", api(w).flakinessVerdict(rec).label === "Ambiguous", api(w).flakinessVerdict(rec).label);
    check("verdict explains itself", /matched 2/.test(api(w).flakinessVerdict(rec).why || ""), api(w).flakinessVerdict(rec).why);
    check("still no auto-substitution", rec.css === r.css);
  }

  console.log("\n[AC4c] \"Stable\" is not claimed on a single sighting");
  {
    const w = load(`<button data-testid="steady">Go</button>`);
    const el = w.document.querySelector("button");
    const r = api(w).resolveUniqueLocator(el);
    const key = r.css;
    api(w)._registry.tracked.set(key, { css: key, primary: r.primary, strategy: r.primaryStrategy,
      stability: r.stability, checks: 0, breaks: 0, present: 0, absent: 0, root: w.document });
    api(w).revalidateAll("manual");
    check("one clean re-check is only 'Holding'", api(w).flakinessVerdict(api(w)._registry.tracked.get(key)).label === "Holding",
          api(w).flakinessVerdict(api(w)._registry.tracked.get(key)).label);
    api(w).revalidateAll("manual");
    check("two clean re-checks earn 'Stable'", api(w).flakinessVerdict(api(w)._registry.tracked.get(key)).label === "Stable",
          api(w).flakinessVerdict(api(w)._registry.tracked.get(key)).label);
  }

  console.log("\n[AC5/#7] Dynamic values with CSS-special characters are escaped (selector does not throw and is 1-of-1)");
  {
    // CSS-in-JS style class + colon-bearing testid (real DataHub/styled-comp shapes).
    const w = load(`<div><a data-testid="urn:li:dataset:(x,y,z)" class="Foo__bar-sc-1a2b3c">Employee</a><a class="Foo__bar-sc-1a2b3c">Other</a></div>`);
    const el = w.document.querySelector('[data-testid^="urn:"]');
    const r = api(w).resolveUniqueLocator(el);
    const v = uniqueInDoc(w, r.css, el);
    check("selector with special chars does not throw + is 1-of-1", v.n === 1 && v.same, r.css);
  }

  console.log("\n[AC6] Battery: a spread of elements ALL round-trip (every reported CSS is truly 1-of-1 on the element)");
  {
    const w = load(`
      <nav><a href="/1">1</a><a href="/2">2</a></nav>
      <main>
        <h1>Title</h1>
        <button data-testid="save">Save</button>
        <ul><li><span>Alpha</span><button>Edit</button></li><li><span>Beta</span><button>Edit</button></li></ul>
        <table><tbody><tr data-row-key="urn:li:x:1"><td>Row1</td><td><button>More</button></td></tr>
        <tr data-row-key="urn:li:x:2"><td>Row2</td><td><button>More</button></td></tr></tbody></table>
      </main>`);
    // Exclude the overlay's OWN injected UI (panel/tooltip/toast) — the engine
    // correctly refuses to certify its own nodes, so they must not be in scope.
    const ours = "#__locatorInspector-panel,#__locatorInspector-tooltip,#__locatorInspector-toast";
    const els = [...w.document.querySelectorAll("a,button,h1,span,td,li")].filter((el) => !el.closest(ours));
    let ok = 0, bad = [];
    for (const el of els) {
      const r = api(w).resolveUniqueLocator(el);
      const v = uniqueInDoc(w, r.css, el);
      if (r.unique && v.n === 1 && v.same) ok++; else bad.push({ tag: el.tagName, css: r.css, n: v.n, same: v.same });
    }
    check("100% of the battery round-trips (CSS is exactly the reported element)", bad.length === 0, ok + "/" + els.length + " ok; bad=" + JSON.stringify(bad).slice(0, 200));
  }

  console.log("\n[AC-PW] Playwright output is engine-valid: never emit getByRole(name) for a role that isn't name-matchable");
  {
    // A <li> gets role 'listitem'; ARIA does NOT name listitem from content, so
    // Playwright's getByRole('listitem',{name:'3'}) matches ZERO. The engine must
    // NOT emit that — it must fall through to a Playwright-valid locator.
    const w = load(`<ul><li title="1">1</li><li title="2">2</li><li title="3">3</li></ul>`);
    const li = w.document.querySelectorAll("li")[2];
    const r = api(w).resolveUniqueLocator(li);
    check("does NOT emit getByRole('listitem', {name}) (would be 0 in Playwright)", !/getByRole\('listitem',\s*\{\s*name/.test(r.primary), r.primary);
    check("still returns a verified 1-of-1 locator for the listitem", r.unique && uniqueInDoc(w, r.css, li).same, r.css);
    // A button (name-from-content role) SHOULD still use getByRole+name.
    const w2 = load(`<button>Save</button><button>Cancel</button>`);
    const btn = w2.document.querySelectorAll("button")[0];
    const rb = api(w2).resolveUniqueLocator(btn);
    check("DOES emit getByRole('button', {name}) for a name-from-content role", /getByRole\('button',\s*\{\s*name:\s*'Save'/.test(rb.primary), rb.primary);
    // An explicit aria-label on any element is a valid name source.
    const w3 = load(`<div role="listitem" aria-label="Row Alpha">x</div><div role="listitem" aria-label="Row Beta">y</div>`);
    const d = w3.document.querySelector('[aria-label="Row Alpha"]');
    const rd = api(w3).resolveUniqueLocator(d);
    // A non-native aria-labelled element resolves reliably — via getByLabel (preferred,
    // since Playwright's a11y tree misses many role=* spans) or getByRole with the name.
    check("explicit aria-label IS a valid, reliable name source", /getByLabel\('Row Alpha'|getByRole\('listitem',\s*\{\s*name:\s*'Row Alpha'/.test(rd.primary), rd.primary);
  }

  console.log("\n[AC-ATTR] Root-most attribute anchoring — a value/name/placeholder element gets a clean attribute CSS, not a positional path");
  {
    // The real "classic radio" shape: input[value] with only shared classes.
    const w = load(`<div><label class="ant-radio-button-wrapper"><span class="ant-radio-button"><input type="radio" class="ant-radio-button-input" value="classic"><span class="ant-radio-button-inner"></span></span></label>
      <label class="ant-radio-button-wrapper"><span class="ant-radio-button"><input type="radio" class="ant-radio-button-input" value="new"><span class="ant-radio-button-inner"></span></span></label></div>`);
    const el = w.document.querySelector('input[value="classic"]');
    const r = api(w).resolveUniqueLocator(el);
    check("emits an ATTRIBUTE-anchored CSS (input[value=\"classic\"]), not a positional path", /\[value="classic"\]/.test(r.css) && !/nth-of-type/.test(r.css), r.css);
    check("it is verified 1-of-1 and correct", r.unique && uniqueInDoc(w, r.css, el).same, r.css);
    check("verification is 'unique' (not positional)", r.verification === "unique", r.verification);
    // Grade scale is automation-decision-shaped, not durability-score-shaped:
    // C = "usable, watch it" is the honest grade for a locator anchored on markup
    // (input[value="classic"]) rather than on a contract the app publishes. The
    // load-bearing assertions here are the three above: attribute-anchored, verified
    // 1-of-1, and NOT positional. F would be wrong; A/B would overstate it.
    check("grade is C/D (usable markup anchor), never F", r.grade === "C" || r.grade === "D", r.grade);
  }

  console.log("\n[AC-COMBO] Adaptive vigilance — when no single attribute is unique, an attribute COMBINATION resolves 1-of-1 before falling to positional");
  {
    // Neither [type="radio"] (2 of them) nor [value="a"] (2 of them) is unique alone;
    // only the combination input[type="radio"][value="a"] resolves 1-of-1.
    const w = load(`<form><input type="radio" value="a"><input type="radio" value="b"><input type="text" value="a"></form>`);
    const el = w.document.querySelector('input[type="radio"][value="a"]');
    const r = api(w).resolveUniqueLocator(el);
    check("combination selector resolves the element 1-of-1", r.unique && uniqueInDoc(w, r.css, el).same, r.css);
    check("used an attribute combination (>=2 attr predicates), not nth-of-type", (r.css.match(/\[/g) || []).length >= 2 && !/nth-of-type/.test(r.css), r.css);
  }

  console.log("\n[AC-TEXTLEAF] Attributeless text leaf gets a robust getByText (Playwright), not only a positional path");
  {
    const w = load(`<div><span>Total Domains</span><span>Total Datasets</span></div>`);
    const el = [...w.document.querySelectorAll("span")].find((s) => s.textContent === "Total Domains");
    const r = api(w).resolveUniqueLocator(el);
    check("Playwright uses getByText for a unique text leaf", /getByText\('Total Domains'/.test(r.primary), r.primary);
    check("classified 'unique' via the semantic text anchor", r.verification === "unique", r.verification);
  }

  console.log("\n[AC-ACTION] Actionability — a visually-hidden form control is promoted to its clickable wrapper (locator you can actually click)");
  {
    const w = load(`<div><label class="ant-radio-button-wrapper" id="lbl"><span class="ant-radio-button"><input type="radio" value="classic" style="opacity:0"><span class="ant-radio-button-inner"></span></span></label></div>`);
    const api = w.__locatorInspector;
    const input = w.document.querySelector('input[value="classic"]');
    const label = w.document.getElementById("lbl");
    // jsdom has no layout — mock geometry: hidden input 0x0, visible label 76x32.
    input.getBoundingClientRect = () => ({ width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 });
    label.getBoundingClientRect = () => ({ width: 76, height: 32, top: 0, left: 0, right: 76, bottom: 32 });
    check("hidden (opacity:0, 0x0) input is NOT actionable", api.isVisiblyActionable(input) === false, String(api.isVisiblyActionable(input)));
    check("visible label IS actionable", api.isVisiblyActionable(label) === true, String(api.isVisiblyActionable(label)));
    const t = api.interactionTarget(input);
    check("interactionTarget promotes the hidden input to the clickable <label>", t.el === label && t.promoted === true, JSON.stringify({ tag: t.el && t.el.tagName, promoted: t.promoted }));
    const r = api.resolveUniqueLocator(input);
    check("resolving the hidden input yields a LABEL-based locator, not the input", r.tag === "label", r.tag);
    check("and it explains the promotion in the note", /clickable wrapper/.test(r.note || ""), r.note);
    // A normally-visible button is NOT promoted.
    const w2 = load(`<button id="b">Go</button>`);
    const btn = w2.document.getElementById("b");
    btn.getBoundingClientRect = () => ({ width: 40, height: 20, top: 0, left: 0, right: 40, bottom: 20 });
    check("a visible control is left as-is (no promotion)", w2.__locatorInspector.interactionTarget(btn).promoted === false);
  }

  console.log("\n[AC-FRAG] attrFragments covers many attribute kinds (value/name/placeholder/href/alt/for/title/role/type/data), not just aria");
  {
    const w = load(`<input value="v" name="n" placeholder="p" title="t" type="email" data-x="d">`);
    const kinds = w.__locatorInspector.attrFragments(w.document.querySelector("input")).map((f) => f.kind);
    for (const k of ["value", "name", "placeholder", "title", "type", "data"]) check("covers attribute kind: " + k, kinds.includes(k), kinds.join(","));
  }

  console.log("\n[AC-ICON] Icon elements resolve to the element the user POINTED AT");
  {
    // CORRECTED against real Playwright. This block
    // used to assert that the engine must AVOID getByRole for icons, on the belief that
    // Playwright prunes decorative icons from its a11y tree and getByRole would resolve
    // to 0. Measured in Chromium via real Playwright, that belief is false:
    //     getByRole('img',    { name: 'ellipsis' })  -> 1
    //     getByRole('button', { name: 'ellipsis' })  -> 1, and it hits the BUTTON
    // The old rule was actively harmful for an icon-only button: emitting the ICON's
    // getByLabel resolved to the inner <span>, not the clickable button.
    //
    // An aria-labelled icon span is still best addressed by its own label -- that
    // targets the span, which is the element being pointed at.
    const w = load(`<div><span role="img" aria-label="reload" class="anticon anticon-reload"></span></div>`);
    const icon = w.document.querySelector('[aria-label="reload"]');
    const ri = w.__locatorInspector.resolveUniqueLocator(icon);
    check("icon span is addressed by its own aria-label", /getByLabel\('reload'/.test(ri.primary), ri.primary);
    // An icon-ONLY button must resolve to the BUTTON, via role + the name Playwright
    // computes from the icon child -- NOT to the icon span.
    const w2 = load(`<button><span role="img" aria-label="ellipsis" class="anticon"></span></button>`);
    const btn = w2.document.querySelector("button");
    const rb = w2.__locatorInspector.resolveUniqueLocator(btn);
    check("icon-only button resolves to the BUTTON via getByRole (verified count=1 in real Playwright)", /getByRole\('button',\s*\{\s*name:\s*'ellipsis'/.test(rb.primary), rb.primary);
    // A normal text button STILL uses getByRole (no regression).
    const w3 = load(`<button>Save</button><button>Cancel</button>`);
    const rs = w3.__locatorInspector.resolveUniqueLocator(w3.document.querySelector("button"));
    check("text button still uses getByRole('button', {name})", /getByRole\('button',\s*\{\s*name:\s*'Save'/.test(rs.primary), rs.primary);
  }

  console.log("\n" + passed + " passed, " + failed + " failed\n");
  // Exit EXPLICITLY on success too. These suites boot the real overlay into jsdom, and
  // boot() schedules live timers (checkDrift at 800ms, the requestIdleCallback fallback,
  // the catalog flush, toast timeouts). With only `if (failed) process.exit(1)`, a
  // passing run left those handles pending and the process never exited -- which is why
  // `npm test` used to print "46 passed" and then hang forever on the last suite.
  process.exit(failed ? 1 : 0);
})();
