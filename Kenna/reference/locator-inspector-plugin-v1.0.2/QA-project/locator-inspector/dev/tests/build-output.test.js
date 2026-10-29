/**
 * Validates the ACTUAL BUILT bookmarklet (the squeezed output of build-bookmarklet.js),
 * not raw overlay.js. Every other test file in this suite loads overlay.js directly --
 * which is exactly why a real incident shipped silently: lightSqueeze()'s
 * old block-comment regex deleted a live `const liveAsserts = ...` declaration (it
 * matched string arguments inside exportPlaywright() -- H.push builds a JSDoc-style
 * header for the GENERATED test file, opening with the two star-slash characters and
 * closing the same way many lines later -- as if they were a real comment span, throwing
 * "ReferenceError: liveAsserts is not defined" the instant a user started a recording
 * and the Record tab tried to render its live preview -- 100% invisible to a suite
 * that never actually ran the squeezed file. This file closes that blind spot.
 *
 * Run: node tests/build-output.test.js
 */
const fs = require("fs");
const path = require("path");
require("fake-indexeddb/auto");
const { JSDOM } = require("jsdom");
const { lightSqueeze } = require("../build-bookmarklet.js");

const rawSrc = fs.readFileSync(path.join(__dirname, "..", "overlay.js"), "utf-8");
const squeezedSrc = lightSqueeze(rawSrc.replace('"__BUILD_STAMP__"', '"test-build"'));

function load(bodyHtml, url) {
  const dom = new JSDOM(`<!DOCTYPE html><html><body>${bodyHtml}</body></html>`, {
    runScripts: "outside-only",
    url: url || "https://edc.qa.securiti.xyz/",
    pretendToBeVisual: true,
  });
  const { window } = dom;
  window.indexedDB = globalThis.indexedDB;
  window.IDBKeyRange = globalThis.IDBKeyRange;
  window.eval(squeezedSrc); // the SQUEEZED source, not overlay.js -- the whole point
  return window;
}
let passed = 0, failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log("  ✓ " + name); }
  else { failed++; console.log("  ✗ " + name + (detail !== undefined ? "  — " + detail : "")); }
}

async function main() {
  console.log("\n[B1] Squeezed source is byte-safe -- no string literal was mistaken for a real comment");
  {
    // The exact incident: exportPlaywright() builds a generated-test header via
    // H.push("/**") ... H.push(" */"), and the old regex deleted everything between
    // those two STRINGS, including this declaration.
    check("liveAsserts declaration survives the squeeze", squeezedSrc.includes("const liveAsserts"));
    check("errorFlags declaration survives the squeeze (same block)", squeezedSrc.includes("const errorFlags"));
    // General guard: the squeezed file must still contain every top-level function
    // this suite (and the app) actually calls. If a future squeeze step swallows any
    // of these, this fails loudly instead of silently shipping a broken bookmarklet.
    ["function exportPlaywright(", "function exportPlaywrightCompanyStyle(", "function resolveUniqueLocator(",
      "function revalidateAll(", "function markCheckup(", "function resetRecordingCheckups("].forEach((sig) => {
      check(`squeezed source still declares ${sig}`, squeezedSrc.includes(sig));
    });
  }

  console.log("\n[B2] Squeezed bookmarklet boots cleanly (no syntax damage from squeezing)");
  {
    const win = load(`<button id="target" data-testid="target-btn">Target</button>`);
    check("__locatorInspector exists after eval", typeof win.__locatorInspector === "object");
    check("tool is active", win.__locatorInspector.active === true);
    check("panel actually rendered", !!win.document.getElementById("__locatorInspector-panel"));
  }

  console.log("\n[B3] REPRODUCES the exact reported bug: start recording, click a real element, export");
  {
    const win = load(`<button id="a">Alpha</button><button id="b">Beta</button>`);
    const doc = win.document;
    const panel = doc.getElementById("__locatorInspector-panel");
    panel.querySelector('.tab[data-tab="record"]').dispatchEvent(new win.Event("click", { bubbles: true }));

    // Clicking "Start recording" itself renders the Record tab's live preview via
    // exportPlaywright() -- this is the exact call that threw in production.
    let startError = null;
    try {
      doc.getElementById("__locatorInspector-recbtn").dispatchEvent(new win.Event("click", { bubbles: true }));
    } catch (e) { startError = String(e && e.message || e); }
    check("starting a recording does NOT throw", startError === null, startError);
    check("recording is actually on", win.__locatorInspector._registry.recording === true);
    check("button label flipped to Stop (proves the render actually completed)",
      /stop recording/i.test(doc.getElementById("__locatorInspector-recbtn").textContent),
      doc.getElementById("__locatorInspector-recbtn").textContent);

    // Now the second half of the reported bug: does clicking a REAL page element
    // actually get captured once recording is on?
    doc.getElementById("a").dispatchEvent(new win.Event("click", { bubbles: true }));
    doc.getElementById("b").dispatchEvent(new win.Event("click", { bubbles: true }));
    check("both real clicks were captured", win.__locatorInspector._registry.actions.length === 3, // navigate + 2 clicks
      JSON.stringify(win.__locatorInspector._registry.actions.map((a) => a.type)));

    // Undo / Redo / Clear / switching export style -- all of it, on the SQUEEZED build.
    let undoError = null;
    try { doc.getElementById("__locatorInspector-recundo").dispatchEvent(new win.Event("click", { bubbles: true })); } catch (e) { undoError = String(e); }
    check("Undo does not throw on the squeezed build", undoError === null, undoError);
    check("Undo actually removed the last step", win.__locatorInspector._registry.actions.length === 2);

    let redoError = null;
    try { doc.getElementById("__locatorInspector-recredo").dispatchEvent(new win.Event("click", { bubbles: true })); } catch (e) { redoError = String(e); }
    check("Redo does not throw on the squeezed build", redoError === null, redoError);
    check("Redo brought the step back", win.__locatorInspector._registry.actions.length === 3);

    let styleError = null;
    try { doc.getElementById("__locatorInspector-recstyle-company").dispatchEvent(new win.Event("click", { bubbles: true })); } catch (e) { styleError = String(e); }
    check("switching to Company export style does not throw", styleError === null, styleError);
    check("Company-style preview actually rendered (non-trivial content)",
      panel.querySelector("pre").textContent.length > 40, panel.querySelector("pre").textContent.slice(0, 60));

    let genericBackError = null;
    try { doc.getElementById("__locatorInspector-recstyle-generic").dispatchEvent(new win.Event("click", { bubbles: true })); } catch (e) { genericBackError = String(e); }
    check("switching back to Generic export style does not throw", genericBackError === null, genericBackError);

    let clearError = null;
    try { doc.getElementById("__locatorInspector-recclear").dispatchEvent(new win.Event("click", { bubbles: true })); } catch (e) { clearError = String(e); }
    check("Clear does not throw on the squeezed build", clearError === null, clearError);
    check("Clear actually emptied the action list", win.__locatorInspector._registry.actions.length === 0);
  }

  console.log("\n[B4] exportPlaywright() output is actually well-formed, not just non-throwing");
  {
    const win = load(`<button id="a" aria-label="Save changes">Save</button>`);
    const doc = win.document;
    win.__locatorInspector._registry.recording = true;
    doc.getElementById("a").dispatchEvent(new win.Event("click", { bubbles: true }));
    const code = win.__locatorInspector.exportPlaywright();
    check("generated file has a real header comment block", code.includes("/**") && code.includes("*/"));
    check("generated file mentions Locators verified/flagged summary line", /Locators\s+:/.test(code));
    check("generated file imports Playwright's test/expect", code.includes("import { test, expect } from '@playwright/test';"));
    check("generated file contains an actual test() call", /test\(/.test(code));
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
}
main();
