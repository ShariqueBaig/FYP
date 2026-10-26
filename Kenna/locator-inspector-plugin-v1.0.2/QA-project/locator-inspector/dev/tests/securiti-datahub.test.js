/**
 * Securiti EDC / DataHub-specific intelligence:
 *  - urn:li:… anchoring (deep, globally-unique, re-render-proof)
 *  - Ant Design data-row-key row scoping
 *  - URN preferred over hashed classes / positional paths
 * Run: node tests/securiti-datahub.test.js
 */
const fs = require("fs");
const path = require("path");
require("fake-indexeddb/auto");
const { JSDOM } = require("jsdom");
const overlaySrc = fs.readFileSync(path.join(__dirname, "..", "overlay.js"), "utf-8");
function load(bodyHtml) {
  const dom = new JSDOM(`<!DOCTYPE html><html><body>${bodyHtml}</body></html>`, { runScripts: "outside-only", url: "https://edc.qa.securiti.xyz/", pretendToBeVisual: true });
  const { window } = dom;
  window.indexedDB = globalThis.indexedDB; window.IDBKeyRange = globalThis.IDBKeyRange;
  window.eval(overlaySrc);
  return window;
}
let passed = 0, failed = 0;
function check(n, c, d) { if (c) { passed++; console.log("  ✓ " + n); } else { failed++; console.log("  ✗ " + n + (d !== undefined ? "  — " + d : "")); } }
const api = (w) => w.__locatorInspector;
const DS = "urn:li:dataset:(urn:li:dataPlatform:redshift,dev.public.employee,PROD)";
const GT = "urn:li:glossaryTerm:aq-finance-1";

console.log("\n[D1] URN in data-testid → getByTestId(urn), strategy 'urn', grade A");
{
  const w = load(`<div class="sc-a1b2c3"><a data-testid="${DS}" class="css-9z8y7x" href="/x">Employee</a></div>`);
  const el = w.document.querySelector("a");
  const res = api(w).resolveUniqueLocator(el);
  check("strategy is urn", res.primaryStrategy === "urn", res.primaryStrategy);
  check("grade A", res.grade === "A", res.grade);
  check("emits getByTestId with the URN", res.primary === `page.getByTestId('${DS}')`, res.primary);
  check("ignores the styled-components hash classes", !/sc-a1b2c3|css-9z8y7x/.test(res.primary));
  console.log("    → " + res.primary);
}

console.log("\n[D2] URN in href → verified attribute locator (not a positional path)");
{
  const w = load(`<nav><a href="/entity/${GT}">Finance</a><a href="/entity/other">Other</a></nav>`);
  const el = w.document.querySelector("a");
  const res = api(w).resolveUniqueLocator(el);
  check("strategy urn", res.primaryStrategy === "urn", res.primaryStrategy);
  check("pins on the href URN", res.primary.includes(GT), res.primary);
  console.log("    → " + res.primary);
}

console.log("\n[D3] Ant Design table — row carries data-row-key=URN; scope the row action by it");
{
  const w = load(`<table class="ant-table"><tbody>
    <tr class="ant-table-row" data-row-key="${DS}"><td>Employee</td><td><button class="ant-btn css-x1">Delete</button></td></tr>
    <tr class="ant-table-row" data-row-key="urn:li:dataset:(urn:li:dataPlatform:redshift,dev.public.orders,PROD)"><td>Orders</td><td><button class="ant-btn css-x2">Delete</button></td></tr>
  </tbody></table>`);
  const btn = w.document.querySelectorAll("tr")[0].querySelector("button");
  const res = api(w).resolveUniqueLocator(btn);
  check("contextual chain used (duplicate Delete)", res.primaryStrategy === "contextual", res.primaryStrategy);
  check("row pinned by data-row-key URN", res.primary.includes(`[data-row-key="${DS}"]`), res.primary);
  check("targets the Delete button by role+name", /getByRole\('button', \{ name: 'Delete', exact: true \}\)/.test(res.primary), res.primary);
  check("no ant-btn / hashed class in the locator", !/ant-btn|css-x1/.test(res.primary));
  console.log("    → " + res.primary);
}

console.log("\n[D4] Ant Design data-row-key (non-URN numeric) still anchors the row");
{
  const w = load(`<table><tbody>
    <tr data-row-key="1001"><td>Alpha</td><td><button>Edit</button></td></tr>
    <tr data-row-key="1002"><td>Beta</td><td><button>Edit</button></td></tr>
  </tbody></table>`);
  const btn = w.document.querySelectorAll("tr")[1].querySelector("button");
  const res = api(w).resolveUniqueLocator(btn);
  check("row pinned by data-row-key=1002", res.primary.includes(`[data-row-key="1002"]`), res.primary);
  console.log("    → " + res.primary);
}

console.log("\n[D5] URN beats a deep positional path (element itself carries the URN)");
{
  const w = load(`<div><div><section><div class="_a1b2c3"><span class="css-zzz" data-urn="${GT}">Finance</span></div></section></div></div>`);
  const el = w.document.querySelector("span");
  const res = api(w).resolveUniqueLocator(el);
  check("uses the URN, not nth-of-type", res.primaryStrategy === "urn" && res.primary.includes(GT) && !/nth-of-type/.test(res.primary), res.primary);
  console.log("    → " + res.primary);
}

console.log("\n[D6] Real test-hook (non-URN) still works and stays getByTestId");
{
  const w = load(`<button data-testid="save-btn">Save</button>`);
  const res = api(w).resolveUniqueLocator(w.document.querySelector("button"));
  check("plain testid still getByTestId", res.primaryStrategy === "testid" && res.primary === "page.getByTestId('save-btn')", res.primary);
}

console.log("\n[D7] Virtualized list — a forced positional locator is flagged as scroll-unsafe");
{
  // identical rows, no anchors/text → engine can only build a positional path
  const w = load(`<div class="ant-table-body"><table><tbody>
    <tr><td><span class="css-x">Item</span></td></tr>
    <tr><td><span class="css-x">Item</span></td></tr>
    <tr><td><span class="css-x">Item</span></td></tr>
  </tbody></table></div>`);
  const span = w.document.querySelectorAll("span")[1];
  const res = api(w).resolveUniqueLocator(span);
  check("detected inside a virtualized list", res.inVirtualList === true);
  check("positional locator downgraded to at-risk / F", res.stability === "at-risk" && res.grade === "F", res.stability + "/" + res.grade);
  check("warns about scroll-recycling", /VIRTUALIZED LIST/.test(res.note), res.note);
  console.log("    → " + res.primary + "   [" + res.note.slice(0, 60) + "…]");
}

console.log("\n[D8] Virtualized list — a key/content-pinned locator is marked scroll-SAFE");
{
  const w = load(`<div class="ant-table-body"><table><tbody>
    <tr data-row-key="${DS}"><td>Employee</td><td><button>Delete</button></td></tr>
    <tr data-row-key="urn:li:dataset:(urn:li:dataPlatform:redshift,dev.public.orders,PROD)"><td>Orders</td><td><button>Delete</button></td></tr>
  </tbody></table></div>`);
  const btn = w.document.querySelectorAll("tr")[0].querySelector("button");
  const res = api(w).resolveUniqueLocator(btn);
  check("detected inside a virtualized list", res.inVirtualList === true);
  check("NOT warned (it's key-pinned, scroll-safe)", !/VIRTUALIZED LIST/.test(res.note) && /Scroll-safe/.test(res.note), res.note);
  check("still uses the data-row-key URN pin", res.primary.includes(`[data-row-key="${DS}"]`), res.primary);
  console.log("    → " + res.primary);
}

console.log("\n[D11] Styled-components classes (real DataHub markup) are treated as hashed, never used");
{
  const w = load(`<div><button class="AppBreadcrumbs__StyledButton-sc-pmfcys-1 jAnuhA ant-btn f-btn-action" aria-label="Open menu">≡</button><button aria-label="Close">×</button></div>`);
  check("styled-comp readable+hash class flagged hashed", api(w).isHashedClass("AppBreadcrumbs__StyledButton-sc-pmfcys-1") === true);
  check("short companion hash 'jAnuhA' flagged hashed", api(w).isHashedClass("jAnuhA") === true);
  check("design-system class 'ant-btn' NOT flagged", api(w).isHashedClass("ant-btn") === false);
  const res = api(w).resolveUniqueLocator(w.document.querySelector("button"));
  check("locator uses the aria-label (getByLabel/getByRole), not the sc/hash class", (res.primaryStrategy === "role" || res.primaryStrategy === "label") && /Open menu/.test(res.primary) && !/sc-pmfcys|jAnuhA|StyledButton/.test(res.primary), res.primary);
  console.log("    → " + res.primary);
}

console.log("\n[D10] Frame selector pins the EDC iframe by src (no id/name; 3rd-party iframes present)");
{
  const w = load(`
    <iframe src="https://454ll4xvr2g6.statuspage.io/embed/frame"></iframe>
    <iframe src="https://edc.qa.securiti.xyz/"></iframe>
    <iframe id="cb-frame" src="https://js.chargebee.com/x"></iframe>`);
  const edc = w.document.querySelectorAll("iframe")[1];
  const sel = api(w).frameSelector(edc);
  check("uses src-based selector, not nth-of-type", /iframe\[src\*=/.test(sel) && sel.includes("edc.qa.securiti.xyz"), sel);
  // and it must be unique among the 3 iframes
  check("selector is unique to the EDC iframe", w.document.querySelectorAll(sel).length === 1 && w.document.querySelectorAll(sel)[0] === edc, sel);
  console.log("    → " + sel);
}

console.log("\n[D9] Silent learner infers DataHub conventions from what it sees");
{
  const w = load(`<div class="ant-table-body">
    <a href="#" data-testid="${DS}">A</a>
    <a href="#" data-testid="urn:li:dataset:(urn:li:dataPlatform:redshift,dev.public.orders,PROD)">B</a>
    <button data-row-key="urn:li:glossaryTerm:x">C</button>
  </div>`);
  const m = api(w).recomputeAppModel();   // boot already learned; recompute to be explicit
  check("learned URN-bearing attribute", m.urnAttr === "data-testid", m.urnAttr);
  check("learned the app uses data-row-key rows", m.usesRowKey === true, String(m.usesRowKey));
  check("learned the app virtualizes lists", m.virtualized === true, String(m.virtualized));
  console.log("    → urnAttr=" + m.urnAttr + " usesRowKey=" + m.usesRowKey + " virtualized=" + m.virtualized);
}

console.log("\n[D10] Module viewed STANDALONE still gives the shell-based frameLocator form");
{
  // Every load() here uses url:"https://edc.qa.securiti.xyz/", i.e. the module opened
  // in its own tab -- which is the only way to inspect inside it by hand, because a
  // bookmarklet cannot enter a cross-origin frame. Viewed that way window===window.top,
  // so boundaryInfo() finds no frame and the locator carries no frameLocator() prefix.
  // That locator is correct for a test that navigates straight to this origin and
  // matches NOTHING in a test that starts at the shell. Both forms must be emitted.
  const w = load(`<button data-testid="add-term-button">Add Term</button>`);
  const res = api(w).resolveUniqueLocator(w.document.querySelector("button"));
  check("plain form has no frameLocator", res.primary === "page.getByTestId('add-term-button')", res.primary);
  check("standalone module detected", !!res.standaloneModule, JSON.stringify(res.standaloneModule));
  check("embedded form is emitted too", /^page\.frameLocator\(/.test(res.embeddedPrimary || ""), res.embeddedPrimary);
  check("embedded form pins the module host", /edc\.qa\.securiti\.xyz/.test(res.embeddedPrimary || ""), res.embeddedPrimary);
  check("embedded form keeps the same leaf", /getByTestId\('add-term-button'\)$/.test(res.embeddedPrimary || ""), res.embeddedPrimary);
  check("flagged in needs", (res.needs || []).indexOf("standalone-module") !== -1, JSON.stringify(res.needs));
  check("names the parent host to use it with", res.standaloneModule && res.standaloneModule.parentHost === "qa.securiti.xyz",
        res.standaloneModule && res.standaloneModule.parentHost);
  console.log("    → " + res.primary);
  console.log("    → " + res.embeddedPrimary);
}

console.log("\n[D11] While RECORDING, the standalone-module duality collapses to ONE form");
{
  // Same exact page/element as D10 -- the ONLY difference is registry.recording. Outside
  // a recording, the tool has no way to know which form the person's target test uses,
  // so both stay shown (D10, unchanged). While recording, the CURRENT test's own action
  // history already answers that question -- there's a real page.goto() into this exact
  // origin by now, so showing two options here would be a stale duality, not a real one.
  const w = load(`<button data-testid="add-term-button">Add Term</button>`);
  api(w)._registry.recording = true;
  const res = api(w).resolveUniqueLocator(w.document.querySelector("button"));
  check("plain form is unaffected", res.primary === "page.getByTestId('add-term-button')", res.primary);
  check("embeddedPrimary is NOT attached while recording", res.embeddedPrimary === undefined, res.embeddedPrimary);
  check("standaloneModule is NOT attached while recording", res.standaloneModule === undefined, JSON.stringify(res.standaloneModule));
  check("'standalone-module' is NOT in needs[] while recording", (res.needs || []).indexOf("standalone-module") === -1, JSON.stringify(res.needs));

  // Sanity: flipping recording back off on the SAME page restores both forms --
  // proves this is live-gated on registry.recording, not cached/sticky from D10.
  api(w)._registry.recording = false;
  const res2 = api(w).resolveUniqueLocator(w.document.querySelector("button"));
  check("turning recording back off restores both forms", !!res2.standaloneModule && /^page\.frameLocator\(/.test(res2.embeddedPrimary || ""), res2.embeddedPrimary);
}

console.log("\n" + passed + " passed, " + failed + " failed\n");
// Exit EXPLICITLY on success too. These suites boot the real overlay into jsdom, and
// boot() schedules live timers (checkDrift at 800ms, the requestIdleCallback fallback,
// the catalog flush, toast timeouts). With only `if (failed) process.exit(1)`, a
// passing run left those handles pending and the process never exited -- which is why
// `npm test` used to print "46 passed" and then hang forever on the last suite.
process.exit(failed ? 1 : 0);
