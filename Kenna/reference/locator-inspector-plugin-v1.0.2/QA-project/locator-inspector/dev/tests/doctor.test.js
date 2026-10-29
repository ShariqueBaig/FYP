/**
 * LOCATOR DOCTOR — reverse mode. The engineer already has a locator and it is failing.
 *
 * Every case below is a failure actually observed while validating against
 * qa.securiti.xyz, not an invented one. The Doctor must name the cause and offer a
 * replacement it has VERIFIED against the DOM (never a guessed selector).
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const SRC = fs.readFileSync(path.join(__dirname, "..", "overlay.js"), "utf8");
let passed = 0, failed = 0;
function check(name, cond, dbg) {
  if (cond) { passed++; console.log("  ✓ " + name); }
  else { failed++; console.log("  ✗ " + name + (dbg !== undefined ? "  — " + String(dbg).slice(0, 220) : "")); }
}
function load(body) {
  const dom = new JSDOM(`<!doctype html><html><body>${body}</body></html>`, {
    url: "https://qa.securiti.xyz/", runScripts: "outside-only", pretendToBeVisual: true,
  });
  dom.window.eval(SRC);
  return dom.window;
}

console.log("\n[DR1] Right name, WRONG role — the single most common failure on this app");
{
  // Observed: the nav rail's items carry role=menuitem, so a hand-written
  // getByRole('button', { name: 'Glossary Terms' }) returns 0 while getByLabel
  // returns 2. The Doctor has to say which role it actually is.
  const w = load(`<div><button role="menuitem" aria-label="Glossary Terms">GT</button>
                  <button role="menuitem" aria-label="Datasets">DS</button></div>`);
  const api = w.__locatorInspector;
  const r = api.diagnoseLocator("page.getByRole('button', { name: 'Glossary Terms' })");
  check("verdict is broken", r.verdict === "broken", r.verdict + " count=" + r.count);
  check("count is 0", r.count === 0, String(r.count));
  check("names the role it really has", r.reasons.some((x) => /role menuitem/.test(x) && /Glossary Terms/.test(x)), JSON.stringify(r.reasons));
  check("offers a VERIFIED replacement", r.alternatives.length > 0, JSON.stringify(r.alternatives.map((a) => a.code)));
  check("the replacement uses the correct role", r.alternatives.some((a) => /menuitem/.test(a.code) || /getByLabel\('Glossary Terms'/.test(a.code)), JSON.stringify(r.alternatives.map((a) => a.code)));
}

console.log("\n[DR2] Resolves, but the element is HIDDEN (collapsed menu / closed drawer)");
{
  const w = load(`<div id="menu" style="display:none"><button>System Status</button></div>
                  <button>Visible One</button>`);
  const api = w.__locatorInspector;
  const r = api.diagnoseLocator("page.getByText('System Status', { exact: true })");
  check("finds exactly one", r.count === 1, String(r.count));
  check("verdict is hidden, not ok", r.verdict === "hidden", r.verdict);
  check("explains that no click can land yet", r.reasons.some((x) => /hidden right now/i.test(x)), JSON.stringify(r.reasons));
}

console.log("\n[DR3] Ambiguous — and .first() is called out as hiding the problem");
{
  const w = load(`<table><tbody>
    <tr data-row-key="k1"><td>orders</td><td><button>Delete</button></td></tr>
    <tr data-row-key="k2"><td>payments</td><td><button>Delete</button></td></tr></tbody></table>`);
  const api = w.__locatorInspector;
  const r = api.diagnoseLocator("page.getByRole('button', { name: 'Delete' })");
  check("reports the real count", r.count === 2, String(r.count));
  check("verdict is ambiguous", r.verdict === "ambiguous", r.verdict);
  check("tells you to scope, not to add .first()", r.reasons.some((x) => /Scope it to the row/i.test(x)), JSON.stringify(r.reasons));
  check("offers a scoped chain as the fix", r.alternatives.some((a) => /data-row-key/.test(a.code)), JSON.stringify(r.alternatives.map((a) => a.code)));

  const r2 = api.diagnoseLocator("page.getByRole('button', { name: 'Delete' }).first()");
  check(".first() is flagged as masking ambiguity", r2.reasons.some((x) => /hides ambiguity/i.test(x)), JSON.stringify(r2.reasons));
}

console.log("\n[DR4] frameLocator that matches the WRONG frame (the hCaptcha twin case)");
{
  // Observed on the real app: two iframes share a host, so
  // frameLocator('iframe[src*="host"]') binds to whichever comes first and every
  // locator under it resolves to 0.
  const w = load(`<iframe src="https://third.example/widget.html#frame=checkbox"></iframe>
                  <iframe src="https://third.example/widget.html#frame=challenge"></iframe>`);
  const api = w.__locatorInspector;
  const r = api.diagnoseLocator("page.frameLocator('iframe[src*=\"third.example\"]').getByRole('button', { name: 'Verify' })");
  check("verdict is broken", r.verdict === "broken", r.verdict);
  check("says the frame selector is ambiguous, with the count", r.reasons.some((x) => /matches 2 iframes/.test(x)), JSON.stringify(r.reasons));
  check("tells you to add a discriminator", r.reasons.some((x) => /tells the instances apart/i.test(x)), JSON.stringify(r.reasons));
}

console.log("\n[DR5] Alternatives are VERIFIED, and labelled data-pinned vs structural");
{
  const w = load(`<a data-testid="urn:li:glossaryNode:abc-123" href="/glossaryNode/urn:li:glossaryNode:abc-123">Finance</a>
                  <a data-testid="urn:li:glossaryNode:def-456" href="/glossaryNode/urn:li:glossaryNode:def-456">Legal</a>`);
  const api = w.__locatorInspector;
  const el = w.document.querySelector('[data-testid="urn:li:glossaryNode:abc-123"]');
  const alts = api.suggestAlternatives(el, null, "page");
  check("more than one option is offered", alts.length >= 2, JSON.stringify(alts.map((a) => a.kind)));
  check("a URN option is marked data-pinned", alts.some((a) => a.pin === "data-pinned" && /urn:li:/.test(a.code)), JSON.stringify(alts.map((a) => a.kind + ":" + a.pin)));
  check("a structural option is offered too", alts.some((a) => a.pin === "structural"), JSON.stringify(alts.map((a) => a.kind + ":" + a.pin)));
  // The whole point: never suggest something that does not resolve.
  let allResolve = true;
  for (const a of alts) {
    const m = /\.locator\('([\s\S]*?)'\)$/.exec(a.code);
    if (m) { try { if (w.document.querySelectorAll(m[1]).length !== 1) allResolve = false; } catch { allResolve = false; } }
  }
  check("every CSS-shaped suggestion really resolves 1-of-1", allResolve, JSON.stringify(alts.map((a) => a.code)));
}

console.log("\n[DR6] Parser handles the chains this tool emits");
{
  const w = load(`<div></div>`);
  const api = w.__locatorInspector;
  const segs = api.parseLocator("page.frameLocator('iframe[src*=\"edc\"]').locator('[data-row-key=\"a,b\"]').getByRole('button', { name: 'Edit', exact: true })");
  check("splits into 3 segments", segs.length === 3, JSON.stringify(segs.map((s) => s.fn)));
  check("keeps commas inside quoted args intact", /data-row-key="a,b"/.test(segs[1].args), segs[1].args);
  check("keeps the options object", /exact: true/.test(segs[2].args), segs[2].args);
}

// ---------------------------------------------------------------------------
// The following cases come from a real session: the user copied locators the
// tooltip had just marked SHIP IT, pasted them into the Doctor, and was told
// they were broken. Both causes were confirmed by reproduction before any fix.
// ---------------------------------------------------------------------------

console.log("\n[DR7] The shell-rooted form, pasted while standing ON the module page");
{
  // The tooltip hands out TWO Playwright forms for an embedded module. Pasting the
  // frameLocator() one back while viewing that module standalone used to report
  // "broken · matches 0" -- the locator is correct, the PAGE is the wrong vantage
  // point for it. Calling a good locator broken is the worst thing this pane can do:
  // the engineer deletes a working locator.
  const dom = new JSDOM(`<!doctype html><html><body>
    <span class="ant-tag grey-tag"><a href="/user/urn:li:corpuser:moiz.sid@aqg.com">M Moiz Siddiqui</a></span>
  </body></html>`, { url: "https://edc.qa.securiti.xyz/", runScripts: "outside-only", pretendToBeVisual: true });
  dom.window.eval(SRC);
  const api = dom.window.__locatorInspector;

  const shellForm = `page.frameLocator('iframe[src*="edc.qa.securiti.xyz"][src*="is_lineage_mode=false"]').locator('[href="/user/urn:li:corpuser:moiz.sid@aqg.com"]')`;
  const r = api.diagnoseLocator(shellForm);
  check("not reported as broken", r.verdict !== "broken", r.verdict);
  check("resolves to exactly 1", r.count === 1, r.count);
  check("flagged as the shell-rooted form", r.selfFramed === true);
  check("explains the wrapper is right for a shell test, just redundant here",
    r.reasons.some((x) => /redundant/i.test(x) && /frameLocator/.test(x)), JSON.stringify(r.reasons));

  // The direct form must keep working untouched.
  const direct = api.diagnoseLocator(`page.locator('[href="/user/urn:li:corpuser:moiz.sid@aqg.com"]')`);
  check("the direct form still resolves 1-of-1", direct.count === 1 && direct.verdict !== "broken", direct.verdict);

  // ...and a frame selector naming a DIFFERENT host must still be called broken, or
  // the fix would swallow real failures.
  const wrong = api.diagnoseLocator(`page.frameLocator('iframe[src*="checkout.stripe.com"]').getByRole('button', { name: 'Pay' })`);
  check("a frame selector for another host is still broken", wrong.verdict === "broken", wrong.verdict);
  check("and is NOT mislabelled as self-framed", !wrong.selfFramed);

  check("frameSelectorNamesThisPage: matches this host", api.frameSelectorNamesThisPage('iframe[src*="edc.qa.securiti.xyz"]') === true);
  check("frameSelectorNamesThisPage: rejects another host", api.frameSelectorNamesThisPage('iframe[src*="newassets.hcaptcha.com"]') === false);
  check("frameSelectorNamesThisPage: rejects a selector with no src", api.frameSelectorNamesThisPage("iframe#foo") === false);
}

console.log("\n[DR8] A bare CSS selector or XPath, pasted with no page.* around it");
{
  // Alt+C hands the engineer a raw CSS line. Pasting that back is the obvious move,
  // and it used to come back "unparseable" -- which reads as "your locator is
  // garbage" when the tool itself produced it.
  const w = load(`<div class="f-page">
    <button data-testid="save-btn" aria-label="Save">S</button>
    <span class="ant-tag">one</span><span class="ant-tag">two</span></div>`);
  const api = w.__locatorInspector;

  const css = api.diagnoseLocator('[data-testid="save-btn"]');
  check("a bare CSS selector is accepted", css.verdict !== "unparseable", css.verdict);
  check("reported as CSS, not as a Playwright chain", css.kind === "css", css.kind);
  check("counted correctly", css.count === 1, css.count);
  check("tells you the Playwright equivalent to put in the test",
    css.reasons.some((x) => /page\.locator\(/.test(x)), JSON.stringify(css.reasons));

  const many = api.diagnoseLocator(".ant-tag");
  check("an over-broad CSS selector is ambiguous, not broken", many.verdict === "ambiguous", many.verdict);
  check("and reports the real count", many.count === 2, many.count);

  const xp = api.diagnoseLocator('//button[@aria-label="Save"]');
  check("XPath is accepted", xp.verdict !== "unparseable", xp.verdict);
  check("reported as XPath", xp.kind === "xpath", xp.kind);
  check("counted correctly", xp.count === 1, xp.count);
  check("tells you it needs the xpath= prefix in Playwright",
    xp.reasons.some((x) => /xpath=/.test(x)), JSON.stringify(xp.reasons));

  const nope = api.diagnoseLocator("this is not a selector at all ((");
  check("genuine garbage is still refused", nope.verdict === "unparseable", nope.verdict);
  check("and the refusal names the accepted forms",
    nope.reasons.some((x) => /Accepted forms/.test(x)), JSON.stringify(nope.reasons));
}

console.log("\n[DR9] 0 matches on a page with frames it cannot search");
{
  // On the shell, an element that lives inside the EDC iframe returns 0 with no
  // frameLocator. Reporting a bare "broken" sends the engineer hunting a locator
  // that was fine; the missing piece is the frame, and the tool knows that.
  const dom = new JSDOM(`<!doctype html><html><body>
    <iframe src="https://edc.qa.securiti.xyz/#is_lineage_mode=false"></iframe>
  </body></html>`, { url: "https://qa.securiti.xyz/", runScripts: "outside-only", pretendToBeVisual: true });
  dom.window.eval(SRC);
  const api = dom.window.__locatorInspector;
  const r = api.diagnoseLocator("page.getByRole('button', { name: 'Add Term' })");
  check("still reports 0", r.count === 0);
  check("names the frames it could not look inside",
    r.reasons.some((x) => /cross-origin/i.test(x) && /frame/i.test(x)), JSON.stringify(r.reasons));
  check("and points at frameLocator as the fix",
    r.reasons.some((x) => /frameLocator/.test(x)), JSON.stringify(r.reasons));
}

console.log("\n[DR10] Frame inventory and the in-frame handoff, from the shell");
{
  const dom = new JSDOM(`<!doctype html><html><body>
    <iframe src="https://edc.qa.securiti.xyz/glossary#is_lineage_mode=false"></iframe>
    <iframe src="https://newassets.hcaptcha.com/captcha/#frame=checkbox"></iframe>
  </body></html>`, { url: "https://qa.securiti.xyz/", runScripts: "outside-only", pretendToBeVisual: true });
  dom.window.eval(SRC);
  const api = dom.window.__locatorInspector;
  const inv = api.frameInventory();
  check("both frames enumerated despite being cross-origin", inv.length === 2, inv.length);
  const edc = inv.find((f) => /edc\./.test(f.host)), cap = inv.find((f) => /hcaptcha/.test(f.host));
  check("the app's own module is NOT classified as a vendor widget", edc && edc.vendor === false, edc && edc.vendor);
  check("the captcha IS classified as a vendor widget", cap && cap.vendor === true, cap && cap.vendor);

  // A frame selector that does not match its own iframe is the worst failure here: it
  // silently turns every locator under it into 0 matches. Both selectors on this page
  // must resolve to exactly the element they describe.
  for (const f of inv) {
    check("frame selector for " + f.host + " matches exactly the iframe it describes",
      dom.window.document.querySelectorAll(f.selector).length === 1, f.selector);
    check("...and pins by host rather than DOM position", /^iframe\[src\*=/.test(f.selector), f.selector);
  }
  check("the module selector prefers the bare host over host+path (more durable)",
    edc.selector === 'iframe[src*="edc.qa.securiti.xyz"]', edc.selector);

  // frameAdviceHtml is asserted separately, in a real browser: jsdom does not
  // enforce the same-origin policy on iframes (contentDocument comes back readable), so
  // the cross-origin branch this guidance lives on is unreachable here. What IS testable
  // in jsdom is the payload, which depends on no browser behaviour at all.
  const payload = api.frameBootPayload();
  check("the handoff payload is self-contained (declares its own NS)", /const NS=/.test(payload));
  check("the handoff payload boots in top mode", /boot\("top"\)/.test(payload));
  check("the handoff payload is the real tool, not a stub", payload.length > 50000, payload.length);
}

console.log("\n" + passed + " passed, " + failed + " failed\n");
process.exit(failed ? 1 : 0);
