/**
 * v4.1 — Contextual/relative locators + accuracy hardening.
 * Validates against jsdom's REAL CSS engine that:
 *  - duplicate row/list/card actions get a verified scoped Playwright chain
 *  - named <section>/<form> containers are used as regions
 *  - icon-only buttons (img[alt] / nested aria-label) get a real getByRole name
 *  - getByText uniqueness is page-wide (not tag-scoped)
 * Run: node tests/contextual.test.js
 */
const fs = require("fs");
const path = require("path");
require("fake-indexeddb/auto");
const { JSDOM } = require("jsdom");
const overlaySrc = fs.readFileSync(path.join(__dirname, "..", "overlay.js"), "utf-8");

function load(bodyHtml) {
  const dom = new JSDOM(`<!DOCTYPE html><html><body>${bodyHtml}</body></html>`, {
    runScripts: "outside-only", url: "https://edc.qa.securiti.xyz/", pretendToBeVisual: true,
  });
  const { window } = dom;
  window.indexedDB = globalThis.indexedDB;
  window.IDBKeyRange = globalThis.IDBKeyRange;
  window.eval(overlaySrc);
  return window;
}
let passed = 0, failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log("  ✓ " + name); }
  else { failed++; console.log("  ✗ " + name + (detail !== undefined ? "  — " + detail : "")); }
}
const api = (w) => w.__locatorInspector;
// Independent soundness helpers (do NOT reuse the tool's own logic).
function rowsContaining(doc, text) {
  return Array.from(doc.querySelectorAll("tr,[role=row]")).filter((r) => (r.textContent || "").replace(/\s+/g, " ").includes(text));
}
function buttonsNamed(root, name) {
  return Array.from(root.querySelectorAll("button,[role=button],a,input")).filter((b) => {
    const t = (b.getAttribute("aria-label") || b.textContent || b.value || "").replace(/\s+/g, " ").trim();
    return t === name;
  });
}

console.log("\n[C1] Table rows — duplicate 'Delete' buttons → verified contextual chain");
{
  const w = load(`<table><tbody>
    <tr><td>Acme Corp</td><td><button>Delete</button></td></tr>
    <tr><td>Globex</td><td><button>Delete</button></td></tr>
    <tr><td>Initech</td><td><button>Delete</button></td></tr>
  </tbody></table>`);
  const rows = w.document.querySelectorAll("tr");
  const btn = rows[1].querySelector("button"); // Globex → Delete
  const res = api(w).resolveUniqueLocator(btn);
  check("primary strategy is contextual", res.primaryStrategy === "contextual", res.primaryStrategy);
  check("chain pins the row by distinctive text", /filter\(\{ hasText: 'Globex' \}\)/.test(res.primary), res.primary);
  check("chain targets the Delete button by role+name", /getByRole\('button', \{ name: 'Delete', exact: true \}\)/.test(res.primary), res.primary);
  check("chain is 'row' scoped", /getByRole\('row'\)/.test(res.primary), res.primary);
  // independent soundness: exactly one row has 'Globex', and it has exactly one Delete button
  check("SOUND: exactly 1 row contains 'Globex'", rowsContaining(w.document, "Globex").length === 1);
  check("SOUND: that row has exactly 1 'Delete' button", buttonsNamed(rows[1], "Delete").length === 1);
  console.log("    → " + res.primary);
}

console.log("\n[C2] List items — repeated 'Download' actions → listitem.filter(hasText)");
{
  const w = load(`<ul>
    <li>Invoice #100 <button>Download</button></li>
    <li>Invoice #200 <button>Download</button></li>
    <li>Invoice #300 <button>Download</button></li>
  </ul>`);
  const btn = w.document.querySelectorAll("li")[1].querySelector("button"); // #200
  const res = api(w).resolveUniqueLocator(btn);
  check("contextual under listitem", res.primaryStrategy === "contextual" && /getByRole\('listitem'\)\.filter\(\{ hasText: 'Invoice #200' \}\)/.test(res.primary), res.primary);
  check("targets Download button", /getByRole\('button', \{ name: 'Download', exact: true \}\)/.test(res.primary), res.primary);
  console.log("    → " + res.primary);
}

console.log("\n[C3] Named <section> regions — same-named 'Save' in two regions");
{
  const w = load(`
    <section aria-label="Billing"><button>Save</button></section>
    <section aria-label="Shipping"><button>Save</button></section>`);
  const billingSave = w.document.querySelector('section[aria-label="Billing"] button');
  check("named <section> resolves to role=region", api(w).roleOf(w.document.querySelector('section[aria-label="Billing"]')) === "region");
  const res = api(w).resolveUniqueLocator(billingSave);
  check("scoped under region 'Billing'", res.primaryStrategy === "contextual" && /getByRole\('region', \{ name: 'Billing', exact: true \}\)\.getByRole\('button', \{ name: 'Save', exact: true \}\)/.test(res.primary), res.primary);
  console.log("    → " + res.primary);
}

console.log("\n[C4] Icon-only button — img[alt] gives a real getByRole name (was empty before)");
{
  const w = load(`<div><button><img alt="Delete row"></button> <button><img alt="Edit row"></button></div>`);
  const delBtn = w.document.querySelectorAll("button")[0];
  check("accessibleName from img alt", api(w).accessibleName(delBtn) === "Delete row", api(w).accessibleName(delBtn));
  const res = api(w).resolveUniqueLocator(delBtn);
  check("primary is getByRole with the alt-derived name", res.primaryStrategy === "role" && /getByRole\('button', \{ name: 'Delete row', exact: true \}\)/.test(res.primary), res.primary);
  console.log("    → " + res.primary);
}

console.log("\n[C5] Nested aria-label inside a control contributes to the name");
{
  const w = load(`<button><span aria-label="Close dialog">×</span></button>`);
  const btn = w.document.querySelector("button");
  check("name comes from nested aria-label, not the × glyph", api(w).accessibleName(btn) === "Close dialog", api(w).accessibleName(btn));
}

console.log("\n[C6] getByText is page-wide unique — NOT chosen when the same text exists elsewhere");
{
  // two links 'More' (role+name not unique) + a paragraph 'More' → text is NOT page-unique.
  const w = load(`
    <section aria-label="News"><a href="/n">More</a></section>
    <section aria-label="Sports"><a href="/s">More</a></section>
    <p>More</p>`);
  const newsMore = w.document.querySelector('section[aria-label="News"] a');
  const res = api(w).resolveUniqueLocator(newsMore);
  check("does NOT emit getByText (text not page-wide unique)", res.primaryStrategy !== "text", res.primary);
  check("falls back to a verified contextual chain instead", res.primaryStrategy === "contextual", res.primaryStrategy);
  check("scoped under region 'News'", /getByRole\('region', \{ name: 'News', exact: true \}\)/.test(res.primary), res.primary);
  console.log("    → " + res.primary);
}

console.log("\n[C7] Contextual only used when needed — a unique element stays direct");
{
  const w = load(`<div><button data-testid="save-btn">Save</button><button>Cancel</button></div>`);
  const save = w.document.querySelector("button");
  const res = api(w).resolveUniqueLocator(save);
  check("unique testid stays direct (no needless scoping)", res.primaryStrategy === "testid" && /getByTestId\('save-btn'\)/.test(res.primary), res.primary);
}

console.log("\n[C8] Contextual leaf must be unique WITHIN the container (else no false chain)");
{
  // a row with TWO 'Delete' buttons → cannot form a 1-of-1 leaf inside the row.
  const w = load(`<table><tbody>
    <tr><td>Acme</td><td><button>Delete</button><button>Delete</button></td></tr>
    <tr><td>Globex</td><td><button>Delete</button></td></tr>
  </tbody></table>`);
  const dupBtn = w.document.querySelectorAll("tr")[0].querySelectorAll("button")[0];
  const res = api(w).resolveUniqueLocator(dupBtn);
  check("does NOT emit a non-unique contextual chain", res.primaryStrategy !== "contextual", res.primaryStrategy + " / " + res.primary);
}

console.log("\n" + passed + " passed, " + failed + " failed\n");
// Exit EXPLICITLY on success too. These suites boot the real overlay into jsdom, and
// boot() schedules live timers (checkDrift at 800ms, the requestIdleCallback fallback,
// the catalog flush, toast timeouts). With only `if (failed) process.exit(1)`, a
// passing run left those handles pending and the process never exited -- which is why
// `npm test` used to print "46 passed" and then hang forever on the last suite.
process.exit(failed ? 1 : 0);
