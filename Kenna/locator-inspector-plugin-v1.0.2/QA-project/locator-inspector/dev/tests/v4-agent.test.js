/**
 * v4 agent-layer tests (jsdom): Learner convention inference, DriftDetector,
 * ActionRecorder → Playwright, and KnowledgeStore (IndexedDB) round-trip.
 * Multi-frame injection + overlap picker are validated in a real browser
 * since jsdom has no layout / real frame realms.
 *
 * Run: node tests/v4-agent.test.js
 */
const fs = require("fs");
const path = require("path");
require("fake-indexeddb/auto");
const { JSDOM } = require("jsdom");

const overlaySrc = fs.readFileSync(path.join(__dirname, "..", "overlay.js"), "utf-8");
function load(bodyHtml, url) {
  const dom = new JSDOM(`<!DOCTYPE html><html><body>${bodyHtml}</body></html>`, {
    runScripts: "outside-only",
    url: url || "https://edc.qa.securiti.xyz/",
    pretendToBeVisual: true,
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

async function main() {
  // -------------------------------------------------------------------------
  console.log("\n[L1] Learner infers a CUSTOM test-hook attribute and adapts the engine");
  {
    // App uses data-automation-id (NOT in the built-in testid list) on its controls.
    const win = load(`
      <button data-automation-id="save" class="zz-1a2b3c">Save</button>
      <button data-automation-id="cancel" class="zz-1a2b3c">Cancel</button>
      <button data-automation-id="delete" class="zz-1a2b3c">Delete</button>
      <input data-automation-id="q" class="zz-1a2b3c"/>`);
    const api = win.__locatorInspector;
    api._registry.samples = [];
    api.learnFrom(win.document); // top mode recomputes the app-model
    const m = api._registry.appModel;
    check("detected data-automation-id as the app's test hook", m && m.testAttr === "data-automation-id", m && m.testAttr);
    // The learner still MEASURES the app (that report is the point -- "this app has 0%
    // test-hook coverage" is exactly the finding to take to the developers). What it no
    // longer does is FEED the locator engine. Identity rules are deterministic: static
    // patterns plus the app PROFILE derived from a real recon of the target app.
    // Rationale: run against the real target app, the
    // statistical pass inferred testAttr=null, hashedPrefixes=[] and idGenPrefixes
    // containing only rc_select_/v-step- (both already matched by GENERATED_ID_RE). It
    // contributed nothing, while a single wrong inference silently blacklists good
    // classes or anchors every locator on an attribute that is not a test hook at all.
    const save = win.document.querySelector('[data-automation-id="save"]');
    const r = api.resolveUniqueLocator(save);
    // Anchoring on data-automation-id is GOOD -- it is a real, meaningful attribute, and
    // attrFragments picks it up like any other data-*. What changed is that it is no
    // longer PROMOTED to a discovered test hook (getByTestId-grade, penalty 0) on the
    // strength of a statistical guess; it competes as an ordinary attribute anchor.
    check("uses it as an ordinary attribute anchor, not a discovered test hook", r.cssStrategy === "data", r.cssStrategy);
    check("it still emits a verified 1-of-1 locator", r.unique === true, r.css);
    check("and prefers the accessible role+name", /getByRole\('button',\s*\{\s*name:\s*'Save'/.test(r.primary), r.primary);
    // learned hashed-class prefix now recognised
    // "zz-1a2b3c" is caught by the STATIC hashed-class patterns, not by a learned
    // prefix -- the detection survives, the guesswork does not.
    check("a hash-shaped class is still rejected, by static rule", api.isHashedClass("zz-1a2b3c") === true, String(api.isHashedClass("zz-1a2b3c")));
    check("a trusted design-system class is NOT rejected", api.isHashedClass("f-page-header") === false && api.isHashedClass("ant-btn") === false, "f-/ant- accepted");
    check("utility classes still protected after learning", api.isHashedClass("col-md-6") === false);
  }

  // -------------------------------------------------------------------------
  console.log("\n[L2] DriftDetector diffs a route's fingerprint (added/removed/changed)");
  {
    const win = load(`<button data-testid="a">Alpha</button><button data-testid="b">Beta</button>`);
    const api = win.__locatorInspector;
    const fp1 = api.pageFingerprint(win.document);
    win.document.querySelector('[data-testid="b"]').remove(); // removed
    const c = win.document.createElement("button");
    c.setAttribute("data-testid", "c"); c.textContent = "Gamma";
    win.document.body.appendChild(c); // added
    win.document.querySelector('[data-testid="a"]').textContent = "Alpha renamed"; // changed
    const fp2 = api.pageFingerprint(win.document);
    const d = api.diffFingerprints(fp1, fp2);
    check("added detected", d.added.includes('[data-testid="c"]'), JSON.stringify(d.added));
    check("removed detected", d.removed.includes('[data-testid="b"]'), JSON.stringify(d.removed));
    check("changed detected", d.changed.some((x) => x.key === '[data-testid="a"]'), JSON.stringify(d.changed));
  }

  // -------------------------------------------------------------------------
  console.log("\n[R1] ActionRecorder captures real events → runnable Playwright");
  {
    const win = load(`<button data-testid="go">Go</button><input data-testid="q"/>`);
    const api = win.__locatorInspector;
    api._registry.recording = true;
    const btn = win.document.querySelector('[data-testid="go"]');
    btn.dispatchEvent(new win.MouseEvent("click", { bubbles: true, composed: true }));
    const acts = api._registry.actions;
    check("click recorded", acts.some((a) => a.type === "click" && /getByTestId\('go'\)/.test(a.primary)), JSON.stringify(acts));
    const pw = api.exportPlaywright();
    check("emits a runnable Playwright click", pw.includes("await page.getByTestId('go').click();"), pw);
    check("emits a valid editable test template", pw.includes("import { test, expect }") && /test\('TODO rename:/.test(pw) && /Locator Inspector v\d+\.\d+/.test(pw) && /web-first|auto-retry|ASSERT/.test(pw), pw.slice(0, 160));
  }

  // -------------------------------------------------------------------------
  console.log("\n[R2] exportPlaywright serialises all action types (incl. frameLocator)");
  {
    const win = load(`<div></div>`);
    const api = win.__locatorInspector;
    api._registry.recording = true;
    api._registry.actions = [
      { type: "navigate", url: "https://app/x" },
      { type: "click", primary: "page.frameLocator('iframe#mod').getByRole('button', { name: 'Pay', exact: true })" },
      { type: "fill", primary: "page.getByLabel('Email', { exact: true })", value: "a@b.com" },
      { type: "select", primary: "page.getByRole('combobox')", value: "US" },
      { type: "check", primary: "page.getByRole('checkbox', { name: 'Agree', exact: true })" },
      { type: "press", primary: "page.getByRole('textbox')", key: "Enter" },
    ];
    const pw = api.exportPlaywright();
    check("navigate → goto", pw.includes("await page.goto('https://app/x');"));
    check("cross-frame click via frameLocator", pw.includes("frameLocator('iframe#mod')") && pw.includes(".click();"), pw);
    check("fill value hoisted into editable TEST DATA", pw.includes("'a@b.com'") && /\.fill\(data\.step\d+\);/.test(pw), pw);
    check("select → selectOption(data)", pw.includes("'US'") && /\.selectOption\(data\.step\d+\);/.test(pw), pw);
    check("check → .check()", pw.includes(".check();"));
    check("press → .press('Enter')", pw.includes(".press('Enter');"));
  }

  console.log("\n[R3] Script template is self-documenting & best-practice (grades, FIXME, web-first ASSERTs, data, config)");
  {
    const win = load(`<div></div>`);
    const api = win.__locatorInspector;
    api._registry.recording = true;
    api._registry.actions = [
      { type: "navigate", url: "https://edc.qa.securiti.xyz/", title: "Data Catalog" },
      { type: "fill", primary: "page.getByLabel('Search', { exact: true })", grade: "A", strategy: "label", desc: 'textbox "Search"', value: "employee" },
      { type: "click", primary: "page.locator('#root > div:nth-of-type(2) > div')", grade: "F", strategy: "css", desc: 'div "Domain"' },
      { type: "click", primary: "page.getByRole('button', { name: 'Help Center', exact: true })", grade: "A", strategy: "role", desc: 'button "Help Center"' },
    ];
    const pw = api.exportPlaywright();
    check("header credits the tool + version", /generated by Locator Inspector v\d+\.\d+/.test(pw), pw.slice(0, 80));
    // The header used to carry a "WHY THIS IS RELIABLE" essay (Playwright auto-waits,
    // etc.) and a "RECOMMENDED playwright.config.ts" block. Both were removed: this file
    // gets pasted into a suite that already has a config, and the baseURL it suggested was
    // a hash-route URL, which is wrong advice. The contract is now that the header carries
    // only what the person editing the file must ACT on.
    check("header carries no marketing prose", !/AUTO-WAITS|WHY THIS IS RELIABLE/.test(pw), pw.slice(0, 400));
    check("header gives no playwright.config advice", !/baseURL:|RECOMMENDED playwright/.test(pw), pw.slice(0, 400));
    check("header tells you to add assertions, and why", /Uncomment the '\/\/ ASSERT' lines/.test(pw) && /what you were CHECKING/.test(pw), pw.slice(0, 600));
    check("header states the verified-vs-brittle locator split", /Locators\s+: \d+ verified 1-of-1, \d+ flagged brittle/.test(pw), pw.slice(0, 600));
    check("step count includes navigation, matching the numbered comments", /Steps\s+: \d+ \(\d+ action\(s\) \+ navigation\)/.test(pw), pw.slice(0, 600));
    check("annotates each step with a locator grade", /\[A role\]/.test(pw) && /\[F css\]/.test(pw), pw);
    check("flags the brittle step with a FIXME + fix", /FIXME brittle/.test(pw) && /data-testid/.test(pw), pw);
    check("lists brittle steps to harden in the header", /BRITTLE STEPS TO HARDEN \(1\)/.test(pw), pw);
    check("suggests web-first assertions (toBeVisible / toHaveValue)", /toBeVisible\(\)/.test(pw) && /toHaveValue\(data\.step2\)/.test(pw), pw);
    check("hoists labelled TEST DATA", /const data = \{/.test(pw) && /step2: 'employee',\s+\/\/ Fill: textbox/.test(pw), pw);
    check("names the test from the last meaningful CLICK (not a fill)", /test\('TODO rename: button Help Center'/.test(pw), pw.slice(pw.indexOf("test(")));
  }

  // -------------------------------------------------------------------------
  console.log("\n[R4] Emitted spec is safe for a shared authenticated runner (no login nav, viewport as comment)");
  {
    const win = load(`<div></div>`);
    const api = win.__locatorInspector;
    api._registry.recording = true;
    api._registry.actions = [
      { type: "navigate", url: "https://qa.securiti.xyz/#/login", title: "Login" },
      { type: "navigate", url: "https://edc.qa.securiti.xyz/glossary", title: "Glossary" },
      { type: "click", primary: "page.getByRole('button', { name: 'Add', exact: true })", grade: "A", strategy: "role", desc: 'button "Add"' },
    ];
    const pw = api.exportPlaywright();
    check("drops the login-page goto entirely", !/#\/login/.test(pw), pw);
    check("first goto is the post-login destination, not the login page", /await page\.goto\('https:\/\/edc\.qa\.securiti\.xyz\/glossary'\);/.test(pw), pw.slice(0, 400));
    check("step numbering renumbers after the dropped login nav (no gap)", /Step 1: open the application/.test(pw) && /Step 2: Click button "Add"/.test(pw), pw);
    check("header carries a Viewport line, not a live statement", /\*\s+Viewport\s+: \d+x\d+/.test(pw), pw.slice(0, 400));
    check("never emits test.use (would override the runner's storageState)", !/test\s*\.\s*use\s*\(/.test(pw), pw);
    check("never emits setViewportSize either", !/setViewportSize/.test(pw), pw);

    // A navigate straight to the app (the normal case) must still emit cleanly -
    // the filter must only catch login/signin URLs, not the app itself.
    const win2 = load(`<div></div>`);
    const api2 = win2.__locatorInspector;
    api2._registry.recording = true;
    api2._registry.actions = [{ type: "navigate", url: "https://edc.qa.securiti.xyz/", title: "Data Catalog" }];
    const pw2 = api2.exportPlaywright();
    check("a normal app URL is never mistaken for a login URL", /await page\.goto\('https:\/\/edc\.qa\.securiti\.xyz\/'\);/.test(pw2), pw2.slice(0, 300));

    // Cross-check against the real contract lint the recorded spec must satisfy,
    // when the sibling kit is present on this machine. Skips gracefully elsewhere
    // (e.g. CI, or a clone without the Desktop kit) rather than hard-depending on
    // a path outside this repo.
    const kitCheck = path.join(__dirname, "..", "..", "..", "securiti-playwright-auth", "scripts", "check-generated-specs.js");
    if (fs.existsSync(kitCheck)) {
      const os = require("os");
      const tmp = path.join(os.tmpdir(), "li-gate-check.spec.ts");
      fs.writeFileSync(tmp, pw);
      const { status } = require("child_process").spawnSync(process.execPath, [kitCheck, tmp], { encoding: "utf8" });
      check("passes the shared runner's real contract lint (check-generated-specs.js)", status === 0);
      fs.unlinkSync(tmp);
    } else {
      console.log("  (skip: securiti-recorded-test-kit not present on this machine)");
    }
  }

  // -------------------------------------------------------------------------
  console.log("\n[R5] exportPlaywrightCompanyStyle -- Page Object + BasePage + Expect + user fixture + GenerateRandomData");
  {
    const win = load(`<div></div>`);
    const api = win.__locatorInspector;
    api._registry.recording = true;
    api._registry.actions = [
      { type: "navigate", url: "https://qa.securiti.xyz/#/login", title: "Login" },
      { type: "navigate", url: "https://edc.qa.securiti.xyz/glossary", title: "Glossary" },
      { type: "click", primary: "page.getByRole('button', { name: 'Add', exact: true })", grade: "A", strategy: "role", desc: 'button "Add"' },
      { type: "click", primary: "page.locator('#root > div:nth-of-type(2) > div')", grade: "F", strategy: "css", desc: 'div "Domain"' },
      { type: "click", primary: "page.getByLabel('Name', { exact: true })", desc: 'textbox "Name"' },        // click-before-fill: must be dropped
      { type: "fill", primary: "page.getByLabel('Name', { exact: true })", desc: 'textbox "Name"', value: "moi" },       // superseded typing...
      { type: "fill", primary: "page.getByLabel('Name', { exact: true })", desc: 'textbox "Name"', value: "moiztest" },  // ...only this value should survive
      { type: "click", primary: "page.getByTestId('glossary-entity-modal-create-button')", grade: "A", strategy: "testid", desc: 'button "Create"' },
      { type: "fill", primary: "page.getByLabel('Search', { exact: true })", desc: 'textbox "Search"', value: "employee" },  // no Create-ish click follows -> stays literal
    ];
    const pw = api.exportPlaywrightCompanyStyle();
    check("still drops the login-page goto (shares the same filter as the flat export)", !/#\/login/.test(pw), pw.slice(0, 300));
    check("names the page object from the recorded route", /class GlossaryPage extends BasePage/.test(pw), pw.slice(0, 600));
    check("opens at the post-login destination", /async openGlossary\(\): Promise<void> \{\s*await this\.page\.goto\('https:\/\/edc\.qa\.securiti\.xyz\/glossary'\);/.test(pw), pw);
    check("declares one field per distinct element, named from role+label", /addButton\s*=\s*this\.page\.getByRole/.test(pw) && /nameField\s*=\s*this\.page\.getByLabel/.test(pw) && /createButton\s*=\s*this\.page\.getByTestId/.test(pw) && /searchField\s*=\s*this\.page\.getByLabel/.test(pw), pw);
    check("coalesces the two same-field fills into a single .fill() call (the recorded value itself is discarded here because the field is unique-wrapped, not because it wasn't coalesced)", (pw.match(/this\.nameField\.fill\(/g) || []).length === 1, pw);
    check("drops the click-before-fill on the Name field (no separate click(this.nameField) step)", !/this\.nameField\.click\(\)/.test(pw), pw);
    check("reports the pruning it did, in the header", /Recorder noise already removed:.*coalesced/.test(pw) && /click-before-fill/.test(pw), pw.slice(0, 700));
    check("flags the brittle CSS click with a FIXME, referencing the field declaration", /FIXME brittle \[F css\]/.test(pw), pw);
    check("wraps the field preceding the Create click in a uniqueness helper", /const name = GenerateRandomData\.getUniqueName\('name'\);/.test(pw), pw);
    check("leaves a field with no following Create/Add/Save click as a literal recorded value", /const search = 'employee';\s*\/\/ EDIT: recorded value, verbatim/.test(pw), pw);
    check("imports GenerateRandomData only because a field actually needs it", pw.includes("GenerateRandomData"), pw);
    check("calls through the page object with both params", /await glossaryPage\.performRecordedFlow\(\{ name, search \}\);/.test(pw), pw);
    check("uses the user fixture, not a raw page ({ page }) or this tool's own harness", /test\.beforeEach\(async \(\{ user \}\)/.test(pw) && !/async \(\{ page \}\)/.test(pw), pw.slice(0, 900));
    check("tags the test with a placeholder ticket ID and @sanity, both marked EDIT", /PRIV-XXXXX @sanity/.test(pw) && /EDIT: PRIV-XXXXX is a placeholder ticket ID/.test(pw), pw);
    check("marks every guessed import path with EDIT, doesn't silently assert a real repo path", /EDIT: this repo's real (base-page|authenticated-page fixture)/.test(pw), pw);
    check("never mentions storageState or this tool's own harness (a different destination than the flat export)", !/storageState/.test(pw), pw);

    // Masked fields: never leak the value, never appear in the method signature/call.
    const win2 = load(`<input type="password" data-testid="pw"/>`);
    const api2 = win2.__locatorInspector;
    api2._registry.recording = true;
    api2._registry.actions = [
      { type: "navigate", url: "https://edc.qa.securiti.xyz/", title: "Home" },
      { type: "fill", primary: "page.getByTestId('pw')", desc: 'textbox "Password"', value: "", masked: true },
      { type: "click", primary: "page.getByRole('button', { name: 'Sign in', exact: true })", desc: 'button "Sign in"' },
    ];
    const pw2 = api2.exportPlaywrightCompanyStyle();
    check("masked fill uses the env placeholder inside the page object, same as the flat export", /process\.env\.TEST_SECRET/.test(pw2), pw2);
    check("masked field never becomes a method param or a spec-level const", !/values\.password/i.test(pw2) && !/const password/i.test(pw2), pw2);

    // Real bug found live on edc.qa.securiti.xyz (Domains module, a create
    // flow the emitter was never built against): a MULTI-WORD label produced a field
    // name like "aNameForYourDomainField" (already correct camelCase), but the method
    // PARAM name re-ran that through camelCaseWord() -- which treats an already-camelCase
    // string as one undelimited "word" and lowercases the whole remainder, producing
    // "anameforyourdomain" instead of "aNameForYourDomain". Field name and param name
    // must both stay properly camelCased.
    const win2b = load(`<div></div>`);
    const api2b = win2b.__locatorInspector;
    api2b._registry.recording = true;
    api2b._registry.actions = [
      { type: "navigate", url: "https://edc.qa.securiti.xyz/domains", title: "Data Catalog" },
      { type: "fill", primary: "page.getByTestId('create-domain-name')", grade: "A", strategy: "testid", desc: 'textbox "A name for your domain"', value: "x" },
      { type: "click", primary: "page.getByTestId('create-domain-button')", grade: "A", strategy: "testid", desc: 'button "Create"' },
    ];
    const pw2b = api2b.exportPlaywrightCompanyStyle();
    check("multi-word field name stays properly camelCased", /aNameForYourDomainField\s*=\s*this\.page\.getByTestId/.test(pw2b), pw2b);
    check("multi-word method param stays properly camelCased too (not all-lowercased)", /performRecordedFlow\(values: \{ aNameForYourDomain: string \}\)/.test(pw2b), pw2b);
    check("...and matches consistently at the call site", /getUniqueName\('aNameForYourDomain'\)/.test(pw2b) && /performRecordedFlow\(\{ aNameForYourDomain \}\)/.test(pw2b), pw2b);

    // Real bug found live on qa.securiti.xyz: a login flow's landing-page
    // navigate arrives LAST (fill email, click, fill password, click, THEN the SPA's
    // own post-login redirect fires), not first. Treating "first navigate seen" as
    // the openXxx() target (instead of "first ACTION overall") wrongly consumed that
    // trailing navigate as the opening page, producing a spec that opens the
    // post-login dashboard directly, then tries to fill login fields on it.
    const win3 = load(`<div></div>`);
    const api3 = win3.__locatorInspector;
    api3._registry.recording = true;
    api3._registry.actions = [
      { type: "fill", primary: "page.getByRole('textbox', { name: 'Email', exact: true })", desc: 'textbox "Email"', value: "moiz.sid@aqg.com" },
      { type: "click", primary: "page.getByRole('button', { name: 'Continue', exact: true })", desc: 'button "Continue"' },
      { type: "fill", primary: "page.getByRole('textbox', { name: 'Password', exact: true })", desc: 'textbox "Password"', value: "", masked: true },
      { type: "click", primary: "page.getByRole('button', { name: 'Continue', exact: true })", desc: 'button "Continue"' },
      { type: "navigate", url: "https://qa.securiti.xyz/#/data-catalog", title: "EDC Dashboard" },
    ];
    const pw3 = api3.exportPlaywrightCompanyStyle();
    check("a trailing (non-first) navigate is NOT swallowed as the open() target", /await this\.page\.goto\('https:\/\/qa\.securiti\.xyz\/#\/data-catalog'\);/.test(pw3), pw3);
    check("openXxx() does not silently open the post-login page while the body still fills login fields", !/async open\w+\(\): Promise<void> \{\s*await this\.page\.goto\('https:\/\/qa\.securiti\.xyz\/#\/data-catalog'\);/.test(pw3), pw3);
    check("the trailing navigate is instead a normal, flagged body statement", /await this\.page\.goto\('https:\/\/qa\.securiti\.xyz\/#\/data-catalog'\);\s*\/\/ EDIT: recorded mid-flow/.test(pw3), pw3);
  }

  // -------------------------------------------------------------------------
  console.log("\n[R6] Cross-origin-frame handoff: the redirect is an EXECUTABLE step, not just a comment");
  {
    // Mirrors exactly what wireFrameOpeners pushes when "Record in X instead" is
    // clicked mid-recording: a note explaining the handoff, then a REAL navigate to
    // the module's own URL -- so replay actually drives there, it doesn't just tell
    // a human to go do it by hand.
    const win = load(`<div></div>`);
    const api = win.__locatorInspector;
    api._registry.recording = true;
    api._registry.actions = [
      { type: "navigate", url: "https://qa.securiti.xyz/#/data-catalog", title: "EDC Dashboard" },
      { type: "click", primary: "page.getByRole('link', { name: 'Enterprise Data Catalog', exact: true })", grade: "A", strategy: "role", desc: 'link "Enterprise Data Catalog"' },
      { type: "note", text: "HANDOFF: recording could not see inside edc.qa.securiti.xyz from this page (cross-origin),\nso it continued in its own tab, opened below. The step right after this one\nnavigates straight there -- paste that tab's recorded steps in after it, AS-IS\n(no frameLocator needed: this is a direct top-level visit, not the embedded frame)." },
      { type: "navigate", url: "https://edc.qa.securiti.xyz/", title: "edc.qa.securiti.xyz" },
    ];
    const flat = api.exportPlaywright();
    check("flat: the handoff explanation is a comment, not code", /\/\/ HANDOFF: recording could not see inside edc\.qa\.securiti\.xyz/.test(flat), flat);
    check("flat: the redirect itself is a REAL, executable goto -- not left for a human to do by hand", /await page\.goto\('https:\/\/edc\.qa\.securiti\.xyz\/'\);/.test(flat), flat);
    check("flat: a note is not miscounted as a graded/brittle locator step", !/\[undefined\]|\[A \]/.test(flat), flat);
    const company = api.exportPlaywrightCompanyStyle();
    check("company-style: same handoff comment, same executable redirect, no crash from the note", /HANDOFF: recording could not see inside/.test(company) && /await this\.page\.goto\('https:\/\/edc\.qa\.securiti\.xyz\/'\);/.test(company), company);
  }

  // -------------------------------------------------------------------------
  console.log("\n[R7] Recorder links an observed toast/banner to the step that caused it -> a REAL assertion, not a guess");
  {
    const win = load(`<button data-testid="save">Save</button><div id="host"></div>`);
    const api = win.__locatorInspector;
    api._registry.recording = true;
    api._registry.actions = [{ type: "click", primary: "page.getByTestId('save')", grade: "A", strategy: "testid", desc: 'button "Save"', t: Date.now() }];
    // A success toast appears right after the click (well within the linking window).
    const toast = win.document.createElement("div");
    toast.setAttribute("role", "status");
    toast.textContent = "Saved successfully";
    win.document.getElementById("host").appendChild(toast);
    api.captureTransient(toast);
    const flatOk = api.exportPlaywright();
    // A recording with NO observed banner at all must not carry the helper as dead weight.
    const winNoAssert = load(`<button data-testid="save">Save</button>`);
    const apiNoAssert = winNoAssert.__locatorInspector;
    apiNoAssert._registry.recording = true;
    apiNoAssert._registry.actions = [{ type: "click", primary: "page.getByTestId('save')", grade: "A", strategy: "testid", desc: 'button "Save"' }];
    check("flat: softCheck helper is NOT emitted when nothing was observed (no bloat)", !/softCheck/.test(apiNoAssert.exportPlaywright()));
    // Soft-checked (not a hard expect): a transient toast can vanish before this
    // line runs, so it warns instead of failing the whole test if it's already gone.
    check("flat: a real soft-checked assertion from the observed toast text (not a placeholder)", /await softCheck\('Saved successfully', \(\) => expect\(page\.getByText\('Saved successfully'\)\)\.toBeVisible\(\)\);   \/\/ observed on screen right after this step \(success\)/.test(flatOk), flatOk);
    check("flat: the softCheck helper itself is emitted when there's a live observed assertion", /async function softCheck/.test(flatOk), flatOk.slice(0, 900));
    check("flat header reports the live-verified count", /Verified live\s*: 1 assertion/.test(flatOk), flatOk.slice(0, 700));
    const companyOk = api.exportPlaywrightCompanyStyle();
    check("company-style: surfaces the real observed text as an actionable EDIT hint (no page handle to assert with there)", /EDIT: await Expect\.elementsVisible\(<a locator for 'Saved successfully'>\);   \/\/ seen on screen \(success\)/.test(companyOk), companyOk);

    // Now an ERROR banner: must never become a passing assertion.
    const win2 = load(`<button data-testid="save">Save</button><div id="host"></div>`);
    const api2 = win2.__locatorInspector;
    api2._registry.recording = true;
    api2._registry.actions = [{ type: "click", primary: "page.getByTestId('save')", grade: "A", strategy: "testid", desc: 'button "Save"', t: Date.now() }];
    const errBanner = win2.document.createElement("div");
    errBanner.setAttribute("role", "alert");
    errBanner.textContent = "Error: save failed";
    win2.document.getElementById("host").appendChild(errBanner);
    api2.captureTransient(errBanner);
    const flatErr = api2.exportPlaywright();
    check("flat: an error message becomes a loud FIXME, never an assertion that the error is expected", /\/\/ FIXME: this step triggered an error message: 'Error: save failed'/.test(flatErr) && !/toBeVisible\(\);\s*\/\/ observed.*error/.test(flatErr), flatErr);
    const companyErr = api2.exportPlaywrightCompanyStyle();
    check("company-style: same FIXME treatment for an observed error", /FIXME: an error message appeared: 'Error: save failed'/.test(companyErr), companyErr);

    // This tool's own toast (e.g. "Opened in a new tab") must never attach to a step --
    // isNotableTransient's isOwnNode guard is what's relied on for this.
    const win3 = load(`<button data-testid="save">Save</button>`);
    const api3 = win3.__locatorInspector;
    api3._registry.recording = true;
    api3._registry.actions = [{ type: "click", primary: "page.getByTestId('save')", desc: 'button "Save"', t: Date.now() }];
    const ownToast = win3.document.createElement("div");
    ownToast.id = "__locatorInspector-toast";
    ownToast.setAttribute("role", "status");
    ownToast.textContent = "Opened in a new tab";
    win3.document.body.appendChild(ownToast);
    api3.captureTransient(ownToast);
    check("this tool's own toast never gets attached as a bogus assertion", !win3.__locatorInspector._registry.actions[0].assert, JSON.stringify(win3.__locatorInspector._registry.actions[0]));
  }

  // -------------------------------------------------------------------------
  console.log("\n[K1] KnowledgeStore persists + reloads (IndexedDB round-trip)");
  {
    const win = load(`<div></div>`);
    const api = win.__locatorInspector;
    check("IndexedDB available", api.KS.available === true, String(api.KS.available));
    await api.KS.saveFingerprint("/reports", { "[data-testid=\"x\"]": "button||Save" });
    const got = await api.KS.getFingerprint("/reports");
    check("fingerprint round-trips", got && got.fp && got.fp['[data-testid="x"]'] === "button||Save", JSON.stringify(got));
    await api.KS.saveAppModel({ testAttr: "data-qa", sampledElements: 42 });
    const m = api.KS.loadAppModel();
    check("app-model persists (localStorage mirror)", m && m.testAttr === "data-qa", JSON.stringify(m));
  }

  // -------------------------------------------------------------------------
  console.log("\n[S1] URL redaction — no tokens/PII/ids ever stored");
  {
    const win = load(`<div></div>`);
    const s = win.__locatorInspector.sanitizeUrl;
    const u1 = s("https://app.example/api/v2/graphql?operationName=SaveThing&token=abc123secret&email=a@b.com");
    check("keeps GraphQL operationName", /operationName=SaveThing/.test(u1), u1);
    check("drops auth token", !/abc123secret/.test(u1), u1);
    check("drops email/PII", !/a@b\.com/.test(u1), u1);
    const u2 = s("https://app.example/users/eyJhbGciOiJIUzI1NiJ9payload/edit");
    check("redacts JWT-like path segment", u2.includes("‹id›") && !/eyJ/.test(u2), u2);
    const u3 = s("https://app.example/orders/a1b2c3d4e5f6a7b8c9/detail");
    check("redacts long-hex id segment", u3.includes("‹id›"), u3);
    const u4 = s("https://app.example/x?foo=bar&session=xyz");
    check("redacts a non-graphql query wholesale", u4.includes("‹query redacted›") && !/bar|xyz/.test(u4), u4);
  }

  // -------------------------------------------------------------------------
  console.log("\n[S2] Recorder masks sensitive fields (passwords/PII never recorded)");
  {
    const win = load(`<input type="password" data-testid="pw"/><input name="username" data-testid="user"/>`);
    const api = win.__locatorInspector;
    check("password field flagged sensitive", api.isSensitiveField(win.document.querySelector('[type=password]')) === true);
    check("username field not flagged", api.isSensitiveField(win.document.querySelector('[name=username]')) === false);
    api._registry.recording = true; api._registry.actions = [];
    const pw = win.document.querySelector('[type=password]');
    pw.value = "hunter2-secret";
    pw.dispatchEvent(new win.Event("input", { bubbles: true, composed: true }));
    await new Promise((r) => setTimeout(r, 420)); // debounce
    const fill = api._registry.actions.find((a) => a.type === "fill");
    check("password fill recorded as masked", fill && fill.masked === true && fill.value === "", JSON.stringify(fill));
    const script = api.exportPlaywright();
    check("typed secret never appears in the emitted test", !/hunter2-secret/.test(script), script);
    check("masked fill emits a safe env placeholder (no hard-coded secret)", /process\.env\.TEST_SECRET/.test(script) && /masked secret/.test(script), script);
  }

  // -------------------------------------------------------------------------
  console.log("\n[S3] Cross-frame registry is non-enumerable (not casually scrapable)");
  {
    const win = load(`<div></div>`);
    const top = win; // jsdom: window.top === window
    check("registry not in Object.keys(top)", !Object.keys(top).includes("__locatorInspector_registry"));
    check("registry still reachable by name (for same-origin satellites)", !!top.__locatorInspector_registry);
  }

  // -------------------------------------------------------------------------
  console.log("\n[R8] New-tab handoff auto-resumes recording (URL marker), and never leaks into the recorded goto");
  {
    // Simulates arriving via "Record in X instead": wireFrameOpeners tags the opened
    // URL with ?__li_resume=1 (only when a recording was in progress). This is the ONLY
    // channel that survives a noopener cross-origin new tab -- no JS handle, no shared
    // storage. Boot must (a) auto-start recording, (b) land on the Record tab, and
    // (c) strip the marker before anything records this page, so it never bakes into
    // the exported page.goto().
    const win = load(`<div></div>`, "https://edc.qa.securiti.xyz/glossary?__li_resume=1");
    const api = win.__locatorInspector;
    check("recording auto-started on boot", api._registry.recording === true);
    check("Record tab is active, not Inspect", win.document.querySelector('.tab[data-tab="record"]').classList.contains("active"));
    check("marker stripped from the address bar", !/__li_resume/.test(win.location.href), win.location.href);
    const firstNav = api._registry.actions[0];
    check("this page recorded itself as the seed navigate", firstNav && firstNav.type === "navigate", JSON.stringify(firstNav));
    check("...with a CLEAN url -- the marker never reaches the recorded step", firstNav && firstNav.url === "https://edc.qa.securiti.xyz/glossary", firstNav && firstNav.url);
    const flat = api.exportPlaywright();
    check("...and therefore never reaches the exported script either", !/__li_resume/.test(flat), flat);

    // A plain load (no marker) must NOT auto-start recording -- this is opt-in only,
    // triggered exclusively by the handoff button, not every page load.
    const plain = load(`<div></div>`, "https://edc.qa.securiti.xyz/glossary");
    check("plain load: recording stays off", plain.__locatorInspector._registry.recording === false);
    check("plain load: Inspect tab stays active", plain.document.querySelector('.tab[data-tab="inspect"]').classList.contains("active"));
  }

  console.log("\n[R9] wireFrameOpeners: data-openframe auto-starts recording if needed, data-openframe-fresh never touches the recording");
  {
    // frameInventory's same-vs-cross-origin split (and therefore every real "blind
    // frame" UI that uses it) is not reachable in jsdom -- jsdom lets contentDocument
    // through regardless of origin, so blindApp is always empty here (see doctor.test.js
    // [DR10]'s own note on this). Testing wireFrameOpeners directly, the way [R7] tests
    // captureTransient directly, exercises the actual new logic without depending on
    // frame-origin detection this environment cannot fake.
    const win = load(`<div id="root"><button data-openframe="https://edc.qa.securiti.xyz/glossary">Record in edc.qa.securiti.xyz instead</button></div>`);
    const api = win.__locatorInspector;
    let openedUrl = null;
    win.open = (u) => { openedUrl = u; return null; };
    api.wireFrameOpeners(win.document.getElementById("root"));
    const btn = win.document.querySelector('[data-openframe]');

    // The Record tab shows this exact button
    // ("Record in X instead") BEFORE Start Recording is ever pressed -- it's a
    // heads-up rendered the moment a blind frame is detected, not gated on
    // registry.recording. The OLD behavior silently did a plain, untagged open in
    // that case -- the button's own label promised recording and the click broke
    // that promise with no error. Clicking data-openframe now implicitly starts
    // recording if it wasn't already, so the label is never a lie.
    api._registry.recording = false;
    btn.dispatchEvent(new win.Event("click", { bubbles: true }));
    check("clicking data-openframe while not recording turns recording ON", api._registry.recording === true);
    check("...and the click is treated as the start of a real handoff: url IS tagged", openedUrl && /[?&]__li_resume=1(&|$)/.test(openedUrl), openedUrl);
    check("...with a note+navigate pair pushed, not a silent no-op", api._registry.actions.some((a) => a.type === "note") && api._registry.actions.some((a) => a.type === "navigate"), JSON.stringify(api._registry.actions));

    api._registry.recording = true;
    api._registry.actions = [];
    openedUrl = null;
    btn.dispatchEvent(new win.Event("click", { bubbles: true }));
    check("recording: opened url is tagged for auto-resume", openedUrl && /[?&]__li_resume=1(&|$)/.test(openedUrl), openedUrl);
    // 3, not 2: the global click recorder also captures the click on the handoff
    // button itself (same as [R6]'s click-before-handoff shape) -- then the
    // note+navigate wireFrameOpeners pushes on top of that.
    const acts = api._registry.actions;
    const last2 = acts.slice(-2);
    check("recording: the handoff is still recorded as note+navigate (unaffected by the tag)",
      last2[0].type === "note" && last2[1].type === "navigate" && last2[1].url === "https://edc.qa.securiti.xyz/glossary",
      JSON.stringify(acts));

    // The explicit "open fresh" choice: even mid-recording, this one must never touch
    // the script at all -- no note, no navigate, no resume tag. This gives a way
    // to just look at the frame without committing that hop to the recording.
    const freshBtn = win.document.createElement("button");
    freshBtn.setAttribute("data-openframe-fresh", "https://edc.qa.securiti.xyz/glossary");
    win.document.getElementById("root").appendChild(freshBtn);
    api.wireFrameOpeners(win.document.getElementById("root"));
    const actsBefore = api._registry.actions.length;
    openedUrl = null;
    freshBtn.dispatchEvent(new win.Event("click", { bubbles: true }));
    check("open-fresh: opened url has no resume marker even while recording", openedUrl && !/__li_resume/.test(openedUrl), openedUrl);
    // The self-click on the fresh-open button itself still gets picked up by the
    // global click recorder (same as any button click while recording) -- what must
    // NOT happen is the note+navigate HANDOFF pair this feature deliberately skips.
    const added = api._registry.actions.slice(actsBefore);
    check("open-fresh: no note/navigate handoff added to the recording", !added.some((a) => a.type === "note" || a.type === "navigate"), JSON.stringify(added));
  }

  // -------------------------------------------------------------------------
  console.log("\n[R13] Handoff carries the OLD tab's recorded steps into the NEW tab automatically");
  {
    // End to end: click "Record in X instead" with real prior steps already recorded,
    // then boot a second jsdom window on the exact URL that click produced, and check
    // the new tab's registry starts with the old tab's steps already merged in --
    // no manual copy-paste required for a normal-sized handoff.
    const win = load(`<div id="root"><button data-openframe="https://edc.qa.securiti.xyz/glossary">Record in edc.qa.securiti.xyz instead</button></div>`);
    const api = win.__locatorInspector;
    let openedUrl = null;
    win.open = (u) => { openedUrl = u; return null; };
    api.wireFrameOpeners(win.document.getElementById("root"));
    const btn = win.document.querySelector('[data-openframe]');

    api._registry.recording = true;
    api._registry.actions = [
      { type: "navigate", url: "https://qa.securiti.xyz/#/data-catalog", title: "Data Catalog" },
      { type: "fill", primary: "getByLabel('Search')", value: "term" },
    ];
    btn.dispatchEvent(new win.Event("click", { bubbles: true }));
    check("handoff url carries the payload param", openedUrl && /[?&]__li_handoff=/.test(openedUrl), openedUrl && openedUrl.length);
    const oldNote = api._registry.actions.find((a) => a.type === "note");
    check("old tab's own note says it's already included, not 'paste by hand'", oldNote && /already included below/.test(oldNote.text), oldNote && oldNote.text);

    const win2 = load(`<div></div>`, openedUrl);
    const api2 = win2.__locatorInspector;
    check("new tab: marker AND payload both stripped from the address bar", !/__li_resume|__li_handoff/.test(win2.location.href), win2.location.href);
    check("new tab: recording auto-started", api2._registry.recording === true);
    const acts2 = api2._registry.actions;
    check("new tab: carried steps land FIRST, in original order", acts2[0].type === "navigate" && acts2[0].url === "https://qa.securiti.xyz/#/data-catalog" && acts2[1].type === "fill", JSON.stringify(acts2.slice(0, 2)));
    // Index 2 is the global click-recorder catching the click ON the handoff button
    // itself (same shape as [R9]'s own note on this) -- real, expected, not a bug.
    check("new tab: self-click on the handoff button carried too", acts2[2].type === "click", JSON.stringify(acts2[2]));
    check("new tab: carried note (now includes the handoff marker itself) + its navigate follow",
      acts2[3].type === "note" && /already included below/.test(acts2[3].text) && acts2[4].type === "navigate" && acts2[4].url === "https://edc.qa.securiti.xyz/glossary",
      JSON.stringify(acts2.slice(3)));
    // This page's own arrival navigate is to the SAME url as the carried one right
    // before it -- recNavigation's own dedup (see [R11]) correctly swallows it rather
    // than emitting a pointless duplicate.
    check("new tab: no redundant duplicate arrival-navigate after the carried one", acts2.length === 5, JSON.stringify(acts2));
    const flat2 = api2.exportPlaywright();
    check("exporting from the NEW tab alone reproduces the search fill from the OLD tab", flat2.includes("getByLabel('Search')") || flat2.includes('getByLabel("Search")'), flat2.includes("Search"));

    // Oversized case: a recording too long to fit in a URL must fall back to today's
    // manual-paste note rather than silently truncating JSON mid-string (which would
    // boot the new tab on unparseable garbage).
    const win3 = load(`<div id="root"><button data-openframe="https://edc.qa.securiti.xyz/glossary">Record in edc.qa.securiti.xyz instead</button></div>`);
    const api3 = win3.__locatorInspector;
    let openedUrl3 = null;
    win3.open = (u) => { openedUrl3 = u; return null; };
    api3.wireFrameOpeners(win3.document.getElementById("root"));
    const btn3 = win3.document.querySelector('[data-openframe]');
    api3._registry.recording = true;
    api3._registry.actions = [{ type: "fill", primary: "getByLabel('Notes')", value: "x".repeat(8000) }];
    btn3.dispatchEvent(new win3.Event("click", { bubbles: true }));
    check("oversized: resume marker still present (recording still resumes, just without carry)", /[?&]__li_resume=1(&|$)/.test(openedUrl3), openedUrl3 && openedUrl3.length);
    check("oversized: no handoff payload attached", !/__li_handoff=/.test(openedUrl3), openedUrl3 && openedUrl3.length);
    const oldNote3 = api3._registry.actions.find((a) => a.type === "note");
    check("oversized: note falls back to manual-paste wording", oldNote3 && /paste that tab's recorded steps in after it/.test(oldNote3.text), oldNote3 && oldNote3.text);

    const win4 = load(`<div></div>`, openedUrl3);
    check("oversized: new tab still auto-resumes recording (degraded, not broken)", win4.__locatorInspector._registry.recording === true);
    check("oversized: new tab has no phantom carried steps", win4.__locatorInspector._registry.actions.length === 1, JSON.stringify(win4.__locatorInspector._registry.actions));
  }

  console.log("\n[R10] Standing banner dedupes on the Record tab (source-level guard -- see [R9]'s note on why runtime can't reach this branch in jsdom)");
  {
    const src = fs.readFileSync(path.join(__dirname, "..", "overlay.js"), "utf-8");
    const fn = src.slice(src.indexOf("function renderFrameBanner"), src.indexOf("function renderPanel("));
    check("renderFrameBanner bails out early when the Record tab is active",
      /if\s*\(activePane\(\)\s*===\s*"record"\)\s*\{\s*el\.innerHTML\s*=\s*"";\s*return;\s*\}/.test(fn), fn);
    check("...and that check runs before the blind-frame computation (not after, where it'd be moot)",
      fn.indexOf('activePane() === "record"') < fn.indexOf("frameInventory().filter"), fn.indexOf('activePane() === "record"') + " vs " + fn.indexOf("frameInventory().filter"));
  }

  console.log("\n[R14] Health tab + standing banner offered ONE ambiguous button instead of the honest pair (source-level guard, same jsdom limit as [R10])");
  {
    // Both surfaces used to hand-roll their own data-openframe button under a plain
    // "Open in a new tab" label with no fresh alternative -- while recording, that
    // silently did the full record-and-carry handoff with no way to tell from the
    // label. Fixed by routing both through frameOpenButtonsHtml, the same function
    // the Record tab's own (already-correct) box now shares. This guards against the
    // exact kind of drift that caused the bug: three hand-rolled copies falling out
    // of sync is what let two of them go stale while only one got the fresh option.
    const src = fs.readFileSync(path.join(__dirname, "..", "overlay.js"), "utf-8");
    const healthRow = src.slice(src.indexOf("function frameInventoryHtml"), src.indexOf("function wireFrameOpeners"));
    const banner = src.slice(src.indexOf("function renderFrameBanner"), src.indexOf("function renderPanel("));
    check("Health tab's frame row calls the shared helper, not a hand-rolled button", /frameOpenButtonsHtml\(/.test(healthRow), healthRow.includes("data-openframe=\""));
    check("Health tab's frame row no longer hand-rolls its own data-openframe button", !/<button class="action" data-openframe="/.test(healthRow));
    check("Standing banner calls the shared helper, not a hand-rolled button", /frameOpenButtonsHtml\(/.test(banner), banner.includes("data-openframe=\""));
    check("Standing banner no longer hand-rolls its own data-openframe button", !/<button class="action" data-openframe="/.test(banner));
    const helperFn = src.slice(src.indexOf("function frameOpenButtonsHtml"), src.indexOf("function frameInventoryHtml"));
    const notRecordingBranch = helperFn.slice(helperFn.indexOf("if (!registry.recording)"), helperFn.indexOf("return `<button class=\"action\" data-openframe=\""));
    check("shared helper: not-recording branch returns before ever writing a data-openframe (only -fresh)", /data-openframe-fresh="/.test(notRecordingBranch) && !/data-openframe="/.test(notRecordingBranch), notRecordingBranch);
    check("shared helper: recording -> both a 'Record instead' AND a 'fresh' button", /Record in \$\{h\} instead/.test(helperFn) && /Open \$\{h\} fresh instead/.test(helperFn));
  }

  console.log("\n[R15] Keyboard-only Escape silently recorded NOTHING");
  {
    // Live-tested typing into a real searchable combobox (Create Glossary Term's
    // "Select Parent Node") -- the fill itself resolved perfectly, matching Playwright's
    // own native suggestion exactly. But dismissing it with Escape (a genuine
    // keyboard-only interaction) recorded NOTHING: onRecKey only ever listened for
    // "Enter". Fixed to also capture "Escape" -- both are always a DELIBERATE action,
    // unlike Tab (fires on every normal field-to-field move, mostly noise) or bare
    // arrow keys (only meaningful combined with the Enter/click that follows).
    const win = load(`<input id="search" placeholder="Search"/>`);
    const api = win.__locatorInspector;
    api._registry.recording = true;
    api._registry.actions = [];
    const input = win.document.getElementById("search");
    input.focus();
    input.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    check("Escape is now captured as a press action", api._registry.actions.length === 1 && api._registry.actions[0].type === "press" && api._registry.actions[0].key === "Escape", JSON.stringify(api._registry.actions));

    api._registry.actions = [];
    input.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    check("Enter still captured too (pre-existing behavior, not regressed)", api._registry.actions.length === 1 && api._registry.actions[0].key === "Enter", JSON.stringify(api._registry.actions));

    api._registry.actions = [];
    input.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    input.dispatchEvent(new win.KeyboardEvent("keydown", { key: "a", bubbles: true }));
    check("Tab and plain characters still deliberately NOT captured (would be mostly noise)", api._registry.actions.length === 0, JSON.stringify(api._registry.actions));

    const flat = api.exportPlaywright();
    api._registry.actions = [{ type: "press", primary: "page.getByPlaceholder('Search')", grade: "A", strategy: "placeholder", key: "Escape" }];
    const flat2 = api.exportPlaywright();
    check("exported script emits a real .press('Escape') line, not hardcoded to Enter", /\.press\(['"]Escape['"]\)/.test(flat2), flat2);
  }

  console.log("\n[R16] Banner text with no whitespace between sibling elements mashed into one unreadable run-on assertion");
  {
    // Live-tested a real "Export Completed" success banner (heading + body + link +
    // close button, each its own element with no literal whitespace text node between
    // them in the source HTML -- normal for real markup). pinText's old parts.join("")
    // produced "Export CompletedYour file is ready...Click hereCLOSE" verbatim into an
    // exported assertion. No amount of `\s+` collapsing fixes a join that inserted zero
    // separator to begin with.
    const win = load(`<div id="banner"><h4>Export Completed</h4><p>Your file is ready</p><a>Click here</a><button>CLOSE</button></div>`);
    const api = win.__locatorInspector;
    const banner = win.document.getElementById("banner");
    // pinText itself isn't in the exposed API surface -- exercise it through the real
    // path a live banner takes: captureTransient, same as [R7]'s own precedent for
    // testing internals directly when going through the full UI isn't practical here.
    api._registry.recording = true;
    api._registry.actions = [{ type: "click", primary: "page.getByRole('button', { name: 'Export' })", t: Date.now() }];
    api.captureTransient(banner);
    const attached = api._registry.actions[0].assert;
    check("banner pieces are space-separated, not run together", attached && attached.text === "Export Completed Your file is ready Click here CLOSE", attached && attached.text);
    check("...specifically: no 'CompletedYour' run-on", attached && !/CompletedYour/.test(attached.text), attached && attached.text);
    check("...specifically: no 'itClick' / 'hereCLOSE' run-on", attached && !/itClick|hereCLOSE/.test(attached.text), attached && attached.text);
  }

  console.log("\n[R17] File upload silently recorded WHICH BUTTON opened the chooser but never WHICH FILE was chosen");
  {
    // Live-tested Glossary's real "Bulk Load" file input with a real Playwright
    // file-chooser upload. onRecInput deliberately ignores type=file (a fake
    // "C:\fakepath\..." string is not a real .fill() value) -- correct. But
    // onRecChange had NO branch for it either, so the file selection itself vanished
    // entirely: the exported script would replay the click that opens a native OS
    // file dialog, which Playwright cannot drive, and just hang. Fixed: onRecChange
    // now records a "setFiles" action carrying the chosen FILENAME (never the full
    // local path -- not portable/replayable across machines, and would leak local
    // filesystem layout for zero benefit).
    const win = load(`<input type="file" id="up" aria-label="Bulk Load file"/>`);
    const api = win.__locatorInspector;
    api._registry.recording = true;
    api._registry.actions = [];
    const input = win.document.getElementById("up");
    const fakeFile = { name: "li-bulk-test.csv" };
    Object.defineProperty(input, "files", { value: [fakeFile], configurable: true });
    input.dispatchEvent(new win.Event("change", { bubbles: true }));
    check("file selection is captured as a distinct setFiles action", api._registry.actions.length === 1 && api._registry.actions[0].type === "setFiles", JSON.stringify(api._registry.actions));
    check("...carrying the filename, not a fabricated path", api._registry.actions[0].value === "li-bulk-test.csv", api._registry.actions[0].value);

    const flat = api.exportPlaywright();
    check("flat export emits a real .setInputFiles(...) line, not a dead-end .click()", /\.setInputFiles\(/.test(flat), flat);
    check("...and flags it FIXME with the real filename for a human to point at a real fixture", /FIXME.*li-bulk-test\.csv/.test(flat), flat);

    const company = api.exportPlaywrightCompanyStyle();
    check("company-style export also emits setInputFiles (not silently dropped from the Page Object)", /\.setInputFiles\(/.test(company), company);
  }

  console.log("\n[R18] A real drag gesture recorded a MISLEADING click on an unrelated element");
  {
    // Live-tested Glossary's real "Drag to resize sidebar" handle via a genuine
    // Playwright dragTo(). This recorder has no concept of drag-and-drop at all, so
    // the native 'click' that fires at the release point got captured as an ordinary
    // click on whatever ancestor was under the cursor at release -- observed live:
    // a sidebar-resize drag recorded as a click on <main class="ant-layout-content">,
    // nowhere near the actual drag handle. That's actively misleading (a replay would
    // click the wrong thing), worse than recording nothing. True drag support is
    // separate future work; this stops the wrong click from poisoning the recording
    // and leaves an honest trace instead of a silent gap.
    const win = load(`<div id="handle" style="width:4px"></div><div id="target">Target</div>`);
    const api = win.__locatorInspector;
    api._registry.recording = true;
    api._registry.actions = [];
    const handle = win.document.getElementById("handle");
    const target = win.document.getElementById("target");
    handle.dispatchEvent(new win.MouseEvent("mousedown", { bubbles: true, clientX: 100, clientY: 100 }));
    target.dispatchEvent(new win.MouseEvent("click", { bubbles: true, clientX: 100, clientY: 400 })); // moved 300px -- a real drag
    check("drag-tail click is NOT recorded as a click on the drop target", !api._registry.actions.some((a) => a.type === "click"), JSON.stringify(api._registry.actions));
    check("...an honest note is left instead of a silent gap", api._registry.actions.length === 1 && api._registry.actions[0].type === "note" && /DRAG DETECTED/.test(api._registry.actions[0].text), JSON.stringify(api._registry.actions));

    api._registry.actions = [];
    handle.dispatchEvent(new win.MouseEvent("mousedown", { bubbles: true, clientX: 100, clientY: 100 }));
    handle.dispatchEvent(new win.MouseEvent("click", { bubbles: true, clientX: 102, clientY: 101 })); // 2px jitter -- a real click, not a drag
    check("small natural jitter still records as a normal click (not over-suppressed)", api._registry.actions.length === 1 && api._registry.actions[0].type === "click", JSON.stringify(api._registry.actions));

    // The drag-check originally ran BEFORE the own-UI
    // guard every other recorder listener uses -- a real-page drag that released on
    // the tool's OWN panel would wrongly push a "DRAG DETECTED" note (own-UI clicks
    // must contribute NOTHING to a recording, not even a note), and a mousedown that
    // STARTED on the panel could seed a baseline that then falsely flagged the next
    // genuine page click as a drag.
    const ownPanel = win.document.getElementById("__locatorInspector-panel");
    api._registry.actions = [];
    handle.dispatchEvent(new win.MouseEvent("mousedown", { bubbles: true, clientX: 100, clientY: 100 }));
    ownPanel.dispatchEvent(new win.MouseEvent("click", { bubbles: true, clientX: 500, clientY: 500 })); // real drag onto the panel
    check("a real-page drag that releases ON the tool's own panel adds NOTHING -- no click, no drag note either", api._registry.actions.length === 0, JSON.stringify(api._registry.actions));

    api._registry.actions = [];
    ownPanel.dispatchEvent(new win.MouseEvent("mousedown", { bubbles: true, clientX: 500, clientY: 500 })); // mousedown starts ON the panel
    handle.dispatchEvent(new win.MouseEvent("click", { bubbles: true, clientX: 100, clientY: 100 })); // then a genuine, unrelated page click
    check("a mousedown that started on the panel does not falsely flag the NEXT real page click as a drag",
      api._registry.actions.length === 1 && api._registry.actions[0].type === "click", JSON.stringify(api._registry.actions));
  }

  console.log("\n[R19] Help Center -- one shared '?' whose content follows the active tab");
  {
    const win = load(`<div></div>`);
    const doc = win.document;
    const panel = doc.getElementById("__locatorInspector-panel");
    const help = doc.getElementById("__locatorInspector-help");
    check("help overlay element exists, standalone (not nested inside the panel)", !!help && !panel.contains(help));
    check("closed by default", help.className === "li-help" && help.innerHTML === "");

    const helpBtn = panel.querySelector(".help");
    check("help button exists in the header", !!helpBtn);
    helpBtn.dispatchEvent(new win.Event("click", { bubbles: true }));
    check("opens on click", help.classList.contains("open"));
    check("defaults to the active tab's content (Inspect, since that's the default active tab)", help.querySelector(".li-help-head b").textContent === "Inspect", help.innerHTML.slice(0, 200));

    const tabs = ["inspect", "health", "record", "learn", "doctor", "feed"];
    const titles = {};
    for (const t of tabs) {
      panel.querySelector(`.tab[data-tab="${t}"]`).dispatchEvent(new win.Event("click", { bubbles: true }));
      titles[t] = help.querySelector(".li-help-head b").textContent;
    }
    check("every tab has its OWN, correctly-titled doc while help stays open across all six switches",
      titles.inspect === "Inspect" && titles.health === "Health" && titles.record === "Record"
      && titles.learn === "Learn" && titles.doctor === "Doctor" && titles.feed === "Feed",
      JSON.stringify(titles));
    check("help stayed open through all six tab switches (follows you, doesn't silently close)", help.classList.contains("open"));

    const closeBtn = help.querySelector(".li-help-x");
    closeBtn.dispatchEvent(new win.Event("click", { bubbles: true }));
    check("close button (X) closes it", help.className === "li-help" && help.innerHTML === "");

    // Backdrop click (anywhere that isn't the card) also closes -- but a click ON
    // the card itself must NOT close it, or every click inside the doc (there are
    // none right now, but future content might add one) would dismiss it.
    helpBtn.dispatchEvent(new win.Event("click", { bubbles: true }));
    help.dispatchEvent(new win.Event("click", { bubbles: true })); // target IS help itself = backdrop
    check("clicking the dimmed backdrop closes it", help.className === "li-help");

    helpBtn.dispatchEvent(new win.Event("click", { bubbles: true }));
    const card = help.querySelector(".li-help-card");
    card.dispatchEvent(new win.Event("click", { bubbles: true })); // target is the card, NOT help itself
    check("clicking INSIDE the card does not close it (target !== backdrop)", help.classList.contains("open"), help.className);

    // Regression for the exact bug class this session kept finding elsewhere
    // (frameOpenButtonsHtml drift, lastAlts stale carryover): open/close several
    // times and make sure the backdrop-click listener was attached ONCE, not once
    // per render -- a naive re-attach-every-render would still "work" on a single
    // click but silently pile up duplicate handlers over a long session.
    // Can't easily count already-attached listeners after the fact in jsdom, so
    // instead verify the SOURCE only calls helpEl.addEventListener("click", ...) once,
    // outside renderHelp (source-level guard, same technique as [R10]/[R14]).
    const src2 = fs.readFileSync(path.join(__dirname, "..", "overlay.js"), "utf-8");
    const renderHelpFn = src2.slice(src2.indexOf("function renderHelp"), src2.indexOf("function renderHelp") + src2.slice(src2.indexOf("function renderHelp")).indexOf("\n    }") + 6);
    check("renderHelp() itself never calls helpEl.addEventListener (would stack on every render)", !/helpEl\.addEventListener/.test(renderHelpFn), renderHelpFn);
  }

  console.log("\n[R20] Draggable + resizable panel");
  {
    // Verified here, not by dragging in a real browser: Chromium coalesces rapid
    // synthetic Input.dispatchMouseEvent calls to roughly one per animation frame,
    // so a Playwright mouse.move() loop with no real delay between steps randomly
    // drops the middle events -- confirmed live by logging raw browser 'mousemove'
    // events during four unrelated moves to (200,200)/(800,500)/(1200,900)/(300,300):
    // only the FIRST and LAST were ever dispatched, the two in between vanished
    // outright. That makes the real browser useless as a measuring instrument for
    // this feature's arithmetic; jsdom's synthetic dispatch has no such coalescing,
    // so the actual math is checked here instead. jsdom has no layout engine, so
    // offsetWidth/offsetHeight/getBoundingClientRect are hand-mocked to known values.
    const win = load(`<div></div>`);
    const api = win.__locatorInspector;
    const doc = win.document;
    const panel = doc.getElementById("__locatorInspector-panel");
    const header = panel.querySelector(".header");
    const resizeCorner = panel.querySelector(".li-resize");
    const resizeH = panel.querySelector(".li-resize-h");
    const footer = panel.querySelector(".li-footer");
    const firstPane = panel.querySelector(".tabpane.active");

    // Dynamic, not static: offsetWidth/getBoundingClientRect must reflect whatever
    // this same test just wrote to style.left/top/width, exactly like a real laid-out
    // element would -- a fixed mock here would silently desync from state as soon as
    // more than one gesture runs in sequence (drag, then resize, then drag again).
    Object.defineProperty(panel, "offsetWidth", { get: () => parseFloat(panel.style.width) || 460, configurable: true });
    panel.getBoundingClientRect = () => {
      const left = panel.style.left ? parseFloat(panel.style.left) : 1200;
      const top = panel.style.top ? parseFloat(panel.style.top) : 500;
      const width = parseFloat(panel.style.width) || 460;
      return { left, top, right: left + width, bottom: top + 300, width, height: 300 };
    };
    Object.defineProperty(win, "innerWidth", { value: 1920, configurable: true });
    Object.defineProperty(win, "innerHeight", { value: 1080, configurable: true });

    api._registry.recording = true;
    api._registry.actions = [];

    header.dispatchEvent(new win.MouseEvent("mousedown", { bubbles: true, clientX: 1210, clientY: 510 }));
    win.dispatchEvent(new win.MouseEvent("mousemove", { clientX: 1150, clientY: 470 })); // -60,-40
    win.dispatchEvent(new win.MouseEvent("mouseup", {}));
    check("dragging the header moves the panel by the exact mouse delta", panel.style.left === "1140px" && panel.style.top === "460px", panel.style.left + "," + panel.style.top);
    check("dragging switches off the right/bottom CSS anchor", panel.style.right === "auto" && panel.style.bottom === "auto");
    check("no recorded actions from dragging the panel while recording", api._registry.actions.length === 0, JSON.stringify(api._registry.actions));

    // Corner resize -- and specifically the ratchet bug: anchor on the CURRENT
    // --li-mh (300), not the shorter rendered offsetHeight (40) an earlier version
    // read instead. That version made every successive drag start from a smaller
    // number than it had just written, walking the panel down to the 160px floor
    // over a couple of drags regardless of which way the mouse moved.
    panel.style.setProperty("--li-mh", "300px");
    Object.defineProperty(firstPane, "offsetHeight", { value: 40, configurable: true });
    api._registry.actions = [];
    resizeCorner.dispatchEvent(new win.MouseEvent("mousedown", { bubbles: true, clientX: 1660, clientY: 800 }));
    win.dispatchEvent(new win.MouseEvent("mousemove", { clientX: 1710, clientY: 850 })); // +50,+50
    win.dispatchEvent(new win.MouseEvent("mouseup", {}));
    check("corner resize grows width by exactly the mouse delta", panel.style.width === "510px", panel.style.width);
    check("corner resize anchors height on the CURRENT --li-mh, not the shorter rendered offsetHeight -- the ratchet bug",
      panel.style.getPropertyValue("--li-mh") === "350px", panel.style.getPropertyValue("--li-mh"));
    check("no recorded actions from the corner resize while recording", api._registry.actions.length === 0, JSON.stringify(api._registry.actions));

    // Horizontal-only (left edge): grows LEFTWARD, right edge stays fixed.
    // panel.style.width is already "510px" from the corner-resize test above, and
    // offsetWidth (mocked as a getter over style.width) reflects that automatically.
    api._registry.actions = [];
    resizeH.dispatchEvent(new win.MouseEvent("mousedown", { bubbles: true, clientX: 1200, clientY: 600 }));
    win.dispatchEvent(new win.MouseEvent("mousemove", { clientX: 1170, clientY: 600 })); // moved LEFT by 30
    win.dispatchEvent(new win.MouseEvent("mouseup", {}));
    check("dragging the left edge further left GROWS width, not shrinks it", panel.style.width === "540px", panel.style.width);
    check("...and shifts left by the same delta so the right edge stays put", panel.style.left === "1110px", panel.style.left);
    check("no recorded actions from the horizontal-only handle", api._registry.actions.length === 0, JSON.stringify(api._registry.actions));

    // Vertical-only (the whole footer bar, not just the corner grip).
    api._registry.actions = [];
    panel.style.setProperty("--li-mh", "350px");
    Object.defineProperty(firstPane, "offsetHeight", { value: 350, configurable: true });
    footer.dispatchEvent(new win.MouseEvent("mousedown", { bubbles: true, clientX: 1300, clientY: 900 }));
    win.dispatchEvent(new win.MouseEvent("mousemove", { clientX: 1300, clientY: 870 })); // moved UP by 30 -- shrinks
    win.dispatchEvent(new win.MouseEvent("mouseup", {}));
    check("dragging the footer bar up shrinks the content max-height", panel.style.getPropertyValue("--li-mh") === "320px", panel.style.getPropertyValue("--li-mh"));
    check("width is untouched by the vertical-only handle", panel.style.width === "540px", panel.style.width);
    check("no recorded actions from the vertical-only handle", api._registry.actions.length === 0, JSON.stringify(api._registry.actions));

    // The diagonal grip sits INSIDE the footer bar -- without stopping propagation on
    // its own mousedown, that event would also bubble up and fire the footer's
    // vertical-only listener, attaching a SECOND window-level mousemove handler that
    // independently re-applies the same Y delta to --li-mh alongside the corner's own.
    const src3 = fs.readFileSync(path.join(__dirname, "..", "overlay.js"), "utf-8");
    check("corner grip's mousedown handler stops propagation (footer bar wraps it, would otherwise double-attach)",
      /resize\.addEventListener\("mousedown", \(e\) => \{\s*e\.preventDefault\(\);\s*e\.stopPropagation\(\)/.test(src3));

    // Extreme drag clamps at the floor instead of going negative or unbounded.
    api._registry.actions = [];
    resizeCorner.dispatchEvent(new win.MouseEvent("mousedown", { bubbles: true, clientX: 0, clientY: 0 }));
    win.dispatchEvent(new win.MouseEvent("mousemove", { clientX: -5000, clientY: -5000 }));
    win.dispatchEvent(new win.MouseEvent("mouseup", {}));
    check("width never drops below the 340px floor even on an extreme drag", panel.style.width === "340px", panel.style.width);
    check("height never drops below the 160px floor even on an extreme drag", panel.style.getPropertyValue("--li-mh") === "160px", panel.style.getPropertyValue("--li-mh"));
    check("no recorded actions from an extreme resize drag", api._registry.actions.length === 0, JSON.stringify(api._registry.actions));
  }

  console.log("\n[R11] A login-flow recording produced 6x duplicate steps everywhere");
  {
    // Root cause #1: onRoute() fires on pushState AND replaceState AND popstate -- a
    // real SPA route change legitimately triggers several of those for ONE user-
    // perceived navigation (route guard redirect, then the app's own query cleanup,
    // etc). Reproduced through the REAL code path (pushState -> onRoute ->
    // recNavigation), not by calling an internal directly.
    const win = load(`<div></div>`);
    const api = win.__locatorInspector;
    api._registry.recording = true;
    api._registry.actions = [];
    win.history.pushState({}, "", "/foo?t=12345678");
    win.history.replaceState({}, "", "/foo?t=12345678");   // same URL again -- must NOT double-record
    win.history.pushState({}, "", "/foo?t=12345678");      // and again
    win.history.pushState({}, "", "/bar");                 // a REAL different URL -- must still record
    const navs = api._registry.actions.filter((a) => a.type === "navigate");
    check("3 pushState/replaceState calls to the SAME url recorded as ONE navigate, not 3", navs.length === 2, JSON.stringify(navs));
    // ?t=12345678 is itself a volatile query (VOLATILE_QUERY_RE) -- correctly stripped.
    check("...that one navigate is /foo", navs[0].url.endsWith("/foo"), navs[0].url);
    check("a genuinely different URL still gets its own, separate navigate", navs[1].url.endsWith("/bar"), navs[1].url);

    // Root cause #2 (the bigger one): a login-page navigate was already excluded, but
    // the email/password fills and Continue clicks TYPED on that same page were not --
    // producing a script that opens with a dangling .fill() and no page ever opened,
    // guaranteed to fail at step 1 against the shared runner (which already logs in).
    // Root cause #3: no collapsing of a real action repeated back-to-back with nothing
    // else in between (observed live as 3-6x identical clicks on the same button/link).
    api._registry.actions = [
      { type: "navigate", url: "https://qa.securiti.xyz/#/login", title: "Login" },
      { type: "fill", primary: "page.getByRole('textbox', { name: 'Email', exact: true })", grade: "A", strategy: "role", desc: 'textbox "Email"', value: "a@b.com" },
      { type: "click", primary: "page.getByRole('textbox', { name: 'Email', exact: true })", grade: "A", strategy: "role", desc: 'textbox "Email"' },
      { type: "click", primary: "page.getByRole('button', { name: 'Continue', exact: true })", grade: "A", strategy: "role", desc: 'button "Continue"' },
      { type: "fill", primary: "page.getByRole('textbox', { name: 'Password', exact: true })", grade: "A", strategy: "role", desc: 'textbox "Password"', value: "", masked: true },
      { type: "click", primary: "page.getByRole('button', { name: 'Continue', exact: true })", grade: "A", strategy: "role", desc: 'button "Continue"' },
      { type: "navigate", url: "https://qa.securiti.xyz/#/data-catalog", title: "Data Catalog" },
      { type: "click", primary: "page.getByRole('link', { name: 'Glossary Terms', exact: true })", grade: "A", strategy: "role", desc: 'link "Glossary Terms"' },
      { type: "click", primary: "page.getByRole('link', { name: 'Glossary Terms', exact: true })", grade: "A", strategy: "role", desc: 'link "Glossary Terms"' },
      { type: "click", primary: "page.getByRole('link', { name: 'Glossary Terms', exact: true })", grade: "A", strategy: "role", desc: 'link "Glossary Terms"' },
    ];
    const flat = api.exportPlaywright();
    check("flat: login-page fills/clicks gone entirely, not just the login navigate", !/Email|Password|Continue/.test(flat), flat);
    check("flat: script's first real step is the post-login navigate, no dangling fill with no page open",
      /Step 1: open the application[\s\S]{0,80}data-catalog/.test(flat), flat.slice(flat.indexOf("test("), flat.indexOf("test(") + 300));
    // "Glossary Terms" itself also appears once in the header's auto-suggested flow
    // name (from the last described click) -- count the actual .click() locator calls.
    check("flat: 3 identical consecutive clicks on the same link collapsed to 1",
      (flat.match(/getByRole\('link', \{ name: 'Glossary Terms'/g) || []).length === 1, flat);
    check("flat: header reports the collapsed-noise summary", /Recorder noise removed/.test(flat), flat.slice(0, 900));

    const company = api.exportPlaywrightCompanyStyle();
    check("company-style: login-page fills/clicks gone entirely too", !/Email|Password|Continue/.test(company), company);
    check("company-style: 3 identical consecutive clicks collapsed to 1 in the flow body",
      (company.match(/glossaryTermsLink\.click\(\)/g) || []).length === 1, company);
  }

  // -------------------------------------------------------------------------
  console.log("\n[R12] A login form's Continue/Sign-in button (same DOM node) recorded a stale label");
  {
    // locatorForTarget() caches the best-graded resolution per DOM element (rec.resolved)
    // so a transient DOM change mid-flow (an autocomplete panel opening) can't downgrade
    // an already-strong locator. The bug: the cache comparison was `>=`, so a TIE (same
    // grade, genuinely different accessible name because the SAME element's label
    // changed -- Vue swaps text, not the node) returned the STALE cached object wholesale,
    // including its old .desc. Live: clicked "Continue" (grade A role), the button became
    // "Sign in", clicked it again (also grade A role) -- recorded as 'button "Continue"'
    // both times. Reproduced through the REAL click listener, not by calling an internal.
    const win = load(`<button id="cta">Continue</button>`);
    const api = win.__locatorInspector;
    api._registry.recording = true;
    api._registry.actions = [];
    const btn = win.document.getElementById("cta");
    btn.dispatchEvent(new win.Event("click", { bubbles: true }));
    check("first click recorded with the button's label at that time", api._registry.actions[0].desc === 'button "Continue"', JSON.stringify(api._registry.actions));

    btn.textContent = "Sign in";   // SAME element, same as Vue swapping text in place
    btn.dispatchEvent(new win.Event("click", { bubbles: true }));
    check("second click on the SAME element reflects its CURRENT label, not the stale cached one",
      api._registry.actions[1].desc === 'button "Sign in"', JSON.stringify(api._registry.actions));
  }

  console.log("\n[R21] Undo/Redo in the Record tab");
  {
    const win = load(`<button id="a">Alpha</button><button id="b">Beta</button>`);
    const api = win.__locatorInspector;
    api._registry.recording = true;
    api._registry.actions = [];
    api._registry.redoStack = [];
    const a = win.document.getElementById("a"), b = win.document.getElementById("b");
    a.dispatchEvent(new win.Event("click", { bubbles: true }));
    b.dispatchEvent(new win.Event("click", { bubbles: true }));
    check("two clicks recorded two steps", api._registry.actions.length === 2, JSON.stringify(api._registry.actions));

    const doc = win.document;
    const panel = doc.getElementById("__locatorInspector-panel");
    panel.querySelector(`.tab[data-tab="record"]`).dispatchEvent(new win.Event("click", { bubbles: true }));
    panel.querySelector("#__locatorInspector-recundo").dispatchEvent(new win.Event("click", { bubbles: true }));
    check("Undo removes the LAST step, not the first", api._registry.actions.length === 1 && api._registry.actions[0].desc.includes("Alpha"), JSON.stringify(api._registry.actions));
    check("...and parks it on the redo stack", api._registry.redoStack.length === 1 && api._registry.redoStack[0].desc.includes("Beta"), JSON.stringify(api._registry.redoStack));

    panel.querySelector("#__locatorInspector-recredo").dispatchEvent(new win.Event("click", { bubbles: true }));
    check("Redo brings the undone step back, in place", api._registry.actions.length === 2 && api._registry.actions[1].desc.includes("Beta"), JSON.stringify(api._registry.actions));
    check("...and the redo stack is empty again", api._registry.redoStack.length === 0);

    // A new action after an undo must invalidate the parked redo -- otherwise redo
    // could resurrect a step that no longer matches what actually happened next.
    panel.querySelector("#__locatorInspector-recundo").dispatchEvent(new win.Event("click", { bubbles: true }));
    check("sanity: back down to 1 step with 1 parked for redo", api._registry.actions.length === 1 && api._registry.redoStack.length === 1);
    a.dispatchEvent(new win.Event("click", { bubbles: true })); // a genuinely new action
    check("a new recorded action clears whatever redo() had parked", api._registry.redoStack.length === 0, JSON.stringify(api._registry.redoStack));

    check("Undo is disabled once there's nothing left to undo", (() => {
      api._registry.actions = [];
      api._registry.redoStack = [];
      panel.querySelector(`.tab[data-tab="inspect"]`).dispatchEvent(new win.Event("click", { bubbles: true }));
      panel.querySelector(`.tab[data-tab="record"]`).dispatchEvent(new win.Event("click", { bubbles: true }));
      return panel.querySelector("#__locatorInspector-recundo").disabled;
    })());
    check("Redo is disabled once there's nothing left to redo", panel.querySelector("#__locatorInspector-recredo").disabled);

    // Clear wipes both stacks -- a bulk clear isn't something you'd want to
    // piecemeal-redo back into existence.
    a.dispatchEvent(new win.Event("click", { bubbles: true }));
    b.dispatchEvent(new win.Event("click", { bubbles: true }));
    panel.querySelector("#__locatorInspector-recundo").dispatchEvent(new win.Event("click", { bubbles: true }));
    panel.querySelector("#__locatorInspector-recclear").dispatchEvent(new win.Event("click", { bubbles: true }));
    check("Clear empties both the action list and the redo stack",
      api._registry.actions.length === 0 && api._registry.redoStack.length === 0);
  }

  console.log("\n[R22] Doctor's \"Needs checkup\" list -- scoped to copied/recorded locators only");
  {
    const win = load(`<button id="hoverOnly" data-testid="hover-only">Hover</button><button id="copiedBtn" data-testid="copied-btn">Copy</button><button id="recordedBtn" data-testid="recorded-btn">Rec</button>`);
    const api = win.__locatorInspector;
    const doc = win.document;
    const hoverEl = doc.getElementById("hoverOnly"), copiedEl = doc.getElementById("copiedBtn"), recordedEl = doc.getElementById("recordedBtn");

    // hoverOnly: tracked exactly the way a plain Inspect-tab hover tracks it -- no
    // copy, no recording. This is the case that must NEVER show up as a checkup.
    const hoverRes = api.resolveUniqueLocator(hoverEl);
    api.trackLocator(hoverRes);
    check("hover-only locator IS tracked (Health still sees it)", api._registry.tracked.has(hoverRes.css));
    check("hover-only locator is NOT marked deliberate", !api._registry.deliberateCopy.has(hoverRes.css) && !api._registry.deliberateRecord.has(hoverRes.css));

    // copiedBtn: simulates an Alt+P/Alt+C copy.
    const copiedRes = api.resolveUniqueLocator(copiedEl);
    api.markCheckup(copiedRes, "copy");
    check("copied locator is marked deliberate (copy)", api._registry.deliberateCopy.has(copiedRes.css));

    // recordedBtn: a REAL recorded click, through the actual onRecClick code path,
    // not a direct call -- proves the wiring inside locatorForTarget, not just the helper.
    api._registry.recording = true;
    recordedEl.dispatchEvent(new win.Event("click", { bubbles: true }));
    const recordedRes = api.resolveUniqueLocator(recordedEl);
    check("a recorded click IS marked deliberate (record), via the real record path", api._registry.deliberateRecord.has(recordedRes.css));

    // Break all three the same way -- duplicate each element so its locator now matches 2.
    [hoverEl, copiedEl, recordedEl].forEach((el) => el.parentElement.appendChild(el.cloneNode(true)));
    api.revalidateAll("manual");
    const isDeliberate = (css) => api._registry.deliberateCopy.has(css) || api._registry.deliberateRecord.has(css);
    check("hover-only is broken but stays OUT of the checkup criteria",
      api._registry.tracked.get(hoverRes.css).breaks > 0 && !isDeliberate(hoverRes.css));
    check("copied locator is broken AND eligible for the checkup list",
      api._registry.tracked.get(copiedRes.css).breaks > 0 && isDeliberate(copiedRes.css));
    check("recorded locator is broken AND eligible for the checkup list",
      api._registry.tracked.get(recordedRes.css).breaks > 0 && isDeliberate(recordedRes.css));

    // The ACTUAL rendered Doctor tab must reflect exactly that filter.
    const panel = doc.getElementById("__locatorInspector-panel");
    panel.querySelector(`.tab[data-tab="doctor"]`).dispatchEvent(new win.Event("click", { bubbles: true }));
    const doctorPane = panel.querySelector('.tabpane[data-pane="doctor"]');
    const checkupCss = [...doctorPane.querySelectorAll("[data-checkup]")].map((n) => n.getAttribute("data-checkup"));
    // Exactly ONE clickable element per logical entry -- caught a real bug live where
    // data-checkup was duplicated across a row's header AND its code line, inflating
    // any count-based check (and doubling click listeners) without anything visibly
    // wrong on screen.
    check("exactly 2 checkup rows rendered, not duplicated", checkupCss.length === 2, JSON.stringify(checkupCss));
    check("rendered Doctor tab lists the copied locator as a checkup", checkupCss.includes(copiedRes.css));
    check("rendered Doctor tab lists the recorded locator as a checkup", checkupCss.includes(recordedRes.css));
    check("rendered Doctor tab does NOT list the hover-only locator", !checkupCss.includes(hoverRes.css));

    // Clicking a checkup row pre-fills Doctor's input and runs the diagnosis.
    const firstRow = doctorPane.querySelector("[data-checkup]");
    firstRow.dispatchEvent(new win.Event("click", { bubbles: true }));
    const docin = panel.querySelector("#__locatorInspector-docin"), docout = panel.querySelector("#__locatorInspector-docout");
    check("clicking a checkup row pre-fills Doctor's textarea", docin.value.length > 0, docin.value);
    check("...and runs the diagnosis immediately", docout.innerHTML.length > 0);

    // Dismiss: removes it from the list, doesn't touch Health's own tracked record.
    const dismissBtn = [...doctorPane.querySelectorAll("[data-dismiss]")].find((n) => n.getAttribute("data-dismiss") === copiedRes.css);
    dismissBtn.dispatchEvent(new win.Event("click", { bubbles: true }));
    check("dismissed css is recorded in the session-only dismissed set", api._registry.dismissedCheckups.has(copiedRes.css));
    const checkupCssAfterDismiss = [...panel.querySelector('.tabpane[data-pane="doctor"]').querySelectorAll("[data-checkup]")].map((n) => n.getAttribute("data-checkup"));
    check("dismissed entry is gone from the RE-RENDERED checkup list", !checkupCssAfterDismiss.includes(copiedRes.css));
    check("dismiss did NOT delete the underlying Health record", api._registry.tracked.has(copiedRes.css));

    // Starting a genuinely fresh recording renews the list: old recorded-origin
    // flags and dismissals are cleared; copied-origin flags are untouched.
    api._registry.deliberateCopy.add("leftover-copy-marker");
    api.resetRecordingCheckups();
    check("resetRecordingCheckups clears deliberateRecord", api._registry.deliberateRecord.size === 0);
    check("resetRecordingCheckups clears dismissedCheckups", api._registry.dismissedCheckups.size === 0);
    check("resetRecordingCheckups leaves deliberateCopy alone", api._registry.deliberateCopy.has("leftover-copy-marker"));
  }

  console.log("\n[R23] Own-UI mutations (tab switches, toasts) must NOT trigger a wasted auto re-check");
  {
    const sleepPast = (ms) => new Promise((r) => setTimeout(r, ms));
    const win = load(`<button id="target" data-testid="target-btn">Target</button>`);
    const api = win.__locatorInspector;
    const doc = win.document;
    const panel = doc.getElementById("__locatorInspector-panel");
    const target = doc.getElementById("target");
    api.trackLocator(api.resolveUniqueLocator(target));
    const css = '[data-testid="target-btn"]';
    const checksNow = () => api._registry.tracked.get(css).checks;

    check("sanity: tracked locator starts at 0 checks", checksNow() === 0, String(checksNow()));

    // Case 1: a plain tab switch replaces a pane's innerHTML (a real childList mutation
    // on the tool's own DOM) -- this used to schedule a full re-check of every tracked
    // locator for NOTHING, every single time, on every click around the tool's own UI.
    panel.querySelector('.tab[data-tab="health"]').dispatchEvent(new win.Event("click", { bubbles: true }));
    panel.querySelector('.tab[data-tab="inspect"]').dispatchEvent(new win.Event("click", { bubbles: true }));
    await sleepPast(500);
    check("a single tab switch schedules NO auto re-check", checksNow() === 0, `checks=${checksNow()}`);

    // Case 2: repeated rapid switching (stress -- several own-UI mutations back to back,
    // the exact pattern a QA clicking around the tool actually produces) still schedules
    // ZERO re-checks, not just the first one.
    for (const tab of ["health", "record", "learn", "doctor", "feed", "inspect", "health", "inspect"]) {
      panel.querySelector(`.tab[data-tab="${tab}"]`).dispatchEvent(new win.Event("click", { bubbles: true }));
    }
    await sleepPast(500);
    check("8 rapid tab switches in a row still schedule ZERO auto re-checks", checksNow() === 0, `checks=${checksNow()}`);

    // Case 3: a toast's text update is ALSO an own-UI childList mutation (textContent
    // replaces the toast's text node) -- must be excluded the same way.
    api.showToast("test toast, own UI only");
    await sleepPast(500);
    check("a toast update schedules NO auto re-check", checksNow() === 0, `checks=${checksNow()}`);

    // Case 4: REGRESSION GUARD -- a genuine change on the real page must still trigger a
    // re-check. The fix must exclude the tool's own UI specifically, not mutations in
    // general, or Health/Doctor would silently stop catching real breakage.
    target.parentElement.appendChild(target.cloneNode(true));
    await sleepPast(500);
    check("a REAL page mutation still schedules a re-check (fix isn't over-broad)", checksNow() === 1, `checks=${checksNow()}`);
    check("...and correctly detects the real break (now ambiguous)", api._registry.tracked.get(css).breaks === 1);

    // Case 5: a MIXED batch -- a real-page mutation and an own-UI tab switch landing in
    // the same synchronous turn -- must still trigger exactly one re-check. Proves the
    // exclusion is per-mutation-record, not an all-or-nothing flag for the whole batch.
    const secondTarget = doc.createElement("button");
    secondTarget.setAttribute("data-testid", "second-btn");
    secondTarget.textContent = "Second";
    doc.body.appendChild(secondTarget);
    api.trackLocator(api.resolveUniqueLocator(secondTarget));
    panel.querySelector('.tab[data-tab="record"]').dispatchEvent(new win.Event("click", { bubbles: true })); // own-UI, same turn
    secondTarget.parentElement.appendChild(secondTarget.cloneNode(true)); // real page, same turn
    await sleepPast(500);
    check("a mixed batch (own-UI + real page together) still re-checks the real change",
      api._registry.tracked.get('[data-testid="second-btn"]').checks >= 1,
      String(api._registry.tracked.get('[data-testid="second-btn"]').checks));

    // Case 6: SPA route changes use a SEPARATE call path (onRoute -> scheduleReval),
    // not the MutationObserver at all -- confirm that path is untouched by this fix.
    const beforeRoute = checksNow();
    win.history.pushState({}, "", "/somewhere-else");
    await sleepPast(500);
    check("route change still schedules a re-check via its own path (untouched by this fix)",
      checksNow() > beforeRoute, `before=${beforeRoute} after=${checksNow()}`);
  }

  console.log("\n[R24] Clicking an alternative row with the MOUSE was dead code");
  {
    // The tooltip's click handler required an ancestor matching \".li-loc\" or
    // \"[data-alt]\" before it would even look at what was clicked -- but alternative
    // rows are \".li-alt\" with a \"data-altn\" attribute, never \"data-alt\". Every mouse
    // click on an alternative silently did nothing; only the Alt+1/2/3 keyboard
    // shortcut ever worked. Caught by driving the REAL click handler end-to-end, not
    // by calling the underlying function directly (which would have looked fine).
    const win = load(`<button data-testid="save-btn" aria-label="Save changes">Save</button>`);
    const api = win.__locatorInspector;
    const doc = win.document;
    await api.Catalog.clear();
    const target = doc.querySelector("button");
    api.renderTooltip(target, { clientX: 100, clientY: 100 });
    const tooltip = doc.getElementById("__locatorInspector-tooltip");
    const altRow = tooltip.querySelector('.li-alt[data-altn="1"]');
    check("an alternative row actually rendered", !!altRow, tooltip.innerHTML.slice(0, 200));

    // Dispatch a REAL click event through the actual DOM node -- exactly what a mouse
    // click delivers -- not a direct function call, so the row-matching guard is
    // genuinely exercised.
    altRow.dispatchEvent(new win.Event("click", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 10));

    const approved = api.Catalog.all().filter((r) => r.approved);
    check("clicking the alternative row approved something", approved.length === 1, JSON.stringify(approved));
    check("the approved primary is the ALTERNATIVE, not the original testid primary",
      approved[0] && approved[0].primary !== "page.getByTestId('save-btn')" && /getByRole/.test(approved[0].primary),
      approved[0] && approved[0].primary);
    check("it's also eligible for Doctor's checkup list",
      api._registry.deliberateCopy.has('[data-testid="save-btn"]'), [...api._registry.deliberateCopy]);

    // SECOND real bug, found only by driving the FULL real gesture: a plain mouse click
    // is mousedown -> mouseup -> click, in that order. onMouseDown hides the tooltip on
    // ANY mousedown outside ".li-loc" -- it never excluded ".li-alt" either, so the
    // tooltip vanished a beat before the click handler above even ran. A bare
    // dispatchEvent("click") (used above) skips mousedown entirely and would NEVER have
    // caught this -- only reproducing the real sequence does.
    await api.Catalog.clear(); api._registry.deliberateCopy.clear();
    api.renderTooltip(target, { clientX: 100, clientY: 100 });
    const altRow2 = doc.getElementById("__locatorInspector-tooltip").querySelector('.li-alt[data-altn="1"]');
    altRow2.dispatchEvent(new win.MouseEvent("mousedown", { bubbles: true }));
    check("mousedown on an alternative row does NOT hide the tooltip",
      doc.getElementById("__locatorInspector-tooltip").style.display !== "none",
      doc.getElementById("__locatorInspector-tooltip").style.display);
    altRow2.dispatchEvent(new win.MouseEvent("mouseup", { bubbles: true }));
    altRow2.dispatchEvent(new win.Event("click", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 10));
    const approved2 = api.Catalog.all().filter((r) => r.approved);
    check("the FULL real mousedown->mouseup->click sequence still approves the alternative",
      approved2.length === 1 && /getByRole/.test(approved2[0].primary), JSON.stringify(approved2));
  }

  console.log("\n[R25] Doctor tab's alternative-click ALSO approves/tracks correctly (not just the tooltip's)");
  {
    // Distinct URNs per link so the ambiguous-verdict branch has something to build a
    // real alternative from -- two bare identical elements with no distinguishing
    // container/URN give diagnoseLocator nothing to suggest at all (confirmed directly:
    // an earlier attempt with plain buttons produced zero alternatives, not a bug in
    // the code being tested here, just the wrong fixture for exercising it).
    const win = load(`<a aria-label="Delete" href="/dataset/urn:li:dataset:(urn:li:dataPlatform:snowflake,db.a,QA)">Delete</a><a aria-label="Delete" href="/dataset/urn:li:dataset:(urn:li:dataPlatform:snowflake,db.b,QA)">Delete</a>`);
    const api = win.__locatorInspector;
    const doc = win.document;
    await api.Catalog.clear();
    const panel = doc.getElementById("__locatorInspector-panel");
    panel.querySelector('.tab[data-tab="doctor"]').dispatchEvent(new win.Event("click", { bubbles: true }));
    const docin = doc.getElementById("__locatorInspector-docin");
    docin.value = "page.getByRole('link', { name: 'Delete' })"; // deliberately ambiguous -- matches both
    doc.getElementById("__locatorInspector-docrun").dispatchEvent(new win.Event("click", { bubbles: true }));

    const altRow = doc.querySelector('.tabpane[data-pane="doctor"] [data-docaltn="1"]');
    check("Doctor rendered at least one alternative for the ambiguous locator", !!altRow, doc.querySelector('.tabpane[data-pane="doctor"] #' + "__locatorInspector-docout") && doc.getElementById("__locatorInspector-docout").innerHTML.slice(0, 200));
    if (altRow) {
      altRow.dispatchEvent(new win.Event("click", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 10));
      const approved = api.Catalog.all().filter((r) => r.approved);
      check("Doctor's alternative click approved something", approved.length === 1, JSON.stringify(approved));
      check("deliberateCopy was marked for one of the two Delete buttons",
        api._registry.deliberateCopy.size === 1, [...api._registry.deliberateCopy]);
    }
  }

  console.log("\n[R26] All FOUR sides individually resizable, not just left+bottom+corner");
  {
    const win = load(`<div></div>`);
    const doc = win.document;
    const panel = doc.getElementById("__locatorInspector-panel");
    const resizeR = panel.querySelector(".li-resize-r");
    const resizeT = panel.querySelector(".li-resize-t");
    check("right-edge handle exists", !!resizeR);
    check("top-edge handle exists", !!resizeT);

    Object.defineProperty(panel, "offsetWidth", { get: () => parseFloat(panel.style.width) || 500, configurable: true });
    panel.getBoundingClientRect = () => {
      const left = panel.style.left ? parseFloat(panel.style.left) : 1200;
      const top = panel.style.top ? parseFloat(panel.style.top) : 500;
      const width = parseFloat(panel.style.width) || 500;
      return { left, top, right: left + width, bottom: top + 300, width, height: 300 };
    };
    Object.defineProperty(win, "innerWidth", { value: 1920, configurable: true });
    Object.defineProperty(win, "innerHeight", { value: 1080, configurable: true });

    // RIGHT edge, NOT panelMoved (default bottom/right CSS anchor): dragging right
    // grows width, same direction sense as the corner handle, no position compensation.
    resizeR.dispatchEvent(new win.MouseEvent("mousedown", { bubbles: true, clientX: 1700, clientY: 600 }));
    win.dispatchEvent(new win.MouseEvent("mousemove", { clientX: 1740, clientY: 600 })); // +40
    win.dispatchEvent(new win.MouseEvent("mouseup", {}));
    check("dragging the right edge right GROWS width", panel.style.width === "540px", panel.style.width);
    check("right-edge resize does not touch left/top (not panelMoved)", panel.style.left === "" && panel.style.top === "", `left="${panel.style.left}" top="${panel.style.top}"`);

    // TOP edge, NOT panelMoved: dragging up grows height (same --li-mh mechanism as
    // the footer, opposite sign since this is the OTHER edge of the same box).
    panel.style.setProperty("--li-mh", "300px");
    resizeT.dispatchEvent(new win.MouseEvent("mousedown", { bubbles: true, clientX: 1300, clientY: 500 }));
    win.dispatchEvent(new win.MouseEvent("mousemove", { clientX: 1300, clientY: 460 })); // moved UP by 40
    win.dispatchEvent(new win.MouseEvent("mouseup", {}));
    check("dragging the top edge UP grows --li-mh", panel.style.getPropertyValue("--li-mh") === "340px", panel.style.getPropertyValue("--li-mh"));

    // Now drag the header first so panelMoved flips true, THEN prove top/right
    // compensate position correctly in that mode (mirrors what left-edge already does).
    const header = panel.querySelector(".header");
    header.dispatchEvent(new win.MouseEvent("mousedown", { bubbles: true, clientX: 1210, clientY: 510 }));
    win.dispatchEvent(new win.MouseEvent("mousemove", { clientX: 1210, clientY: 510 })); // no-op move, just flips panelMoved
    win.dispatchEvent(new win.MouseEvent("mouseup", {}));
    check("sanity: panel is now in moved (left/top) mode", panel.style.right === "auto" && panel.style.bottom === "auto");

    const topBefore = parseFloat(panel.style.top);
    resizeT.dispatchEvent(new win.MouseEvent("mousedown", { bubbles: true, clientX: 1300, clientY: 500 }));
    win.dispatchEvent(new win.MouseEvent("mousemove", { clientX: 1300, clientY: 470 })); // moved UP by 30 -- grow
    win.dispatchEvent(new win.MouseEvent("mouseup", {}));
    check("top-edge resize while panelMoved shifts `top` upward to compensate (grows from the top, not the bottom)",
      Math.abs(parseFloat(panel.style.top) - (topBefore - 30)) < 0.5, `${panel.style.top} vs expected ${topBefore - 30}`);

    const leftBefore = parseFloat(panel.style.left);
    resizeR.dispatchEvent(new win.MouseEvent("mousedown", { bubbles: true, clientX: 1700, clientY: 600 }));
    win.dispatchEvent(new win.MouseEvent("mousemove", { clientX: 1730, clientY: 600 })); // +30
    win.dispatchEvent(new win.MouseEvent("mouseup", {}));
    check("right-edge resize while panelMoved does NOT touch `left` (grows away from the anchored side)",
      parseFloat(panel.style.left) === leftBefore, `${panel.style.left} vs expected ${leftBefore}`);

    check("no recorded actions from any of the new handles", win.__locatorInspector._registry.actions.length === 0);
  }

  console.log("\n[R27] Panel auto-grows to fit a content-heavy tab on switch, never auto-shrinks");
  {
    // jsdom has no real layout, so scrollHeight is always 0 -- hand-mocked here to a
    // known value on the pane actually being switched TO, same spirit as R20's
    // offsetWidth/getBoundingClientRect mocks for the same underlying reason.
    const win = load(`<div></div>`);
    const doc = win.document;
    const panel = doc.getElementById("__locatorInspector-panel");
    Object.defineProperty(win, "innerHeight", { value: 1000, configurable: true });
    const learnPane = panel.querySelector('.tabpane[data-pane="learn"]');
    Object.defineProperty(learnPane, "scrollHeight", { value: 700, configurable: true });

    panel.style.setProperty("--li-mh", "300px"); // shorter than what Learn needs
    panel.querySelector('.tab[data-tab="learn"]').dispatchEvent(new win.Event("click", { bubbles: true }));
    check("switching to a tab needing more room GROWS --li-mh to fit it",
      panel.style.getPropertyValue("--li-mh") === "700px", panel.style.getPropertyValue("--li-mh"));

    // Switch to a SHORT tab -- must NOT auto-shrink back down. The grow-to-fit is a
    // floor from here on, not something later tabs can silently undo.
    const inspectPane = panel.querySelector('.tabpane[data-pane="inspect"]');
    Object.defineProperty(inspectPane, "scrollHeight", { value: 50, configurable: true });
    panel.querySelector('.tab[data-tab="inspect"]').dispatchEvent(new win.Event("click", { bubbles: true }));
    check("switching to a SHORT tab does NOT auto-shrink the panel back down",
      panel.style.getPropertyValue("--li-mh") === "700px", panel.style.getPropertyValue("--li-mh"));

    // Respects the viewport cap even when content asks for more than that.
    const docPane = panel.querySelector('.tabpane[data-pane="doctor"]');
    Object.defineProperty(docPane, "scrollHeight", { value: 5000, configurable: true });
    panel.querySelector('.tab[data-tab="doctor"]').dispatchEvent(new win.Event("click", { bubbles: true }));
    check("auto-fit clamps to the viewport cap (innerHeight - 40), not the raw content height",
      panel.style.getPropertyValue("--li-mh") === "960px", panel.style.getPropertyValue("--li-mh"));
  }

  console.log("\n[R28] Panel opens a little bigger by default");
  {
    const src = fs.readFileSync(path.join(__dirname, "..", "overlay.js"), "utf-8");
    check("default panel width bumped up to 560px", /#\$\{NS\}-panel\{[^}]*width:560px/.test(src));
    check("default content max-height bumped up to 74vh", /max-height:var\(--li-mh,74vh\)/.test(src));
  }

  console.log("\n[R29] Cross-origin module appearing mid-recording needed a manual tab switch to show up");
  {
    // Reproduces the exact report: recording from the shell, the EDC module
    // appears (a real cross-origin iframe gets embedded), and the Record tab's own
    // "Record in X instead" guidance did not appear on its own -- only after
    // switching tabs back and forth, which happened to force a fresh renderPanel().
    const win = load(`<div></div>`, "https://qa.securiti.xyz/");
    const api = win.__locatorInspector;
    const doc = win.document;
    const panel = doc.getElementById("__locatorInspector-panel");
    panel.querySelector('.tab[data-tab="record"]').dispatchEvent(new win.Event("click", { bubbles: true }));
    api._registry.recording = true;

    check("sanity: no cross-origin-module guidance yet (no iframe on the page at all)",
      !panel.querySelector('.tabpane[data-pane="record"]').textContent.includes("instead"));

    // The module appears -- a real cross-origin iframe (different subdomain than the
    // shell this test loaded at), matching the actual EDC-under-qa.securiti.xyz shape.
    // jsdom does not perform real cross-origin isolation (no actual network fetch for
    // the src), so contentDocument would otherwise stay accessible and isSameOrigin()
    // would wrongly read this as same-origin -- forcing contentDocument to throw
    // reproduces the exact security exception a REAL cross-origin frame raises, which
    // is precisely the condition isSameOrigin()'s try/catch exists to handle.
    const iframe = doc.createElement("iframe");
    iframe.src = "https://edc.qa.securiti.xyz/";
    Object.defineProperty(iframe, "contentDocument", { get() { throw new Error("cross-origin"); }, configurable: true });
    doc.body.appendChild(iframe);

    await new Promise((r) => setTimeout(r, 20)); // let the MutationObserver's microtask run

    check("Record tab's OWN guidance appeared automatically -- no manual tab switch performed",
      panel.querySelector('.tabpane[data-pane="record"]').textContent.includes("edc.qa.securiti.xyz") &&
      panel.querySelector('.tabpane[data-pane="record"]').textContent.toLowerCase().includes("instead"),
      panel.querySelector('.tabpane[data-pane="record"]').textContent.slice(0, 200));
  }

  console.log("\n[R30] The same-origin-window race after R29's fix");
  {
    // R29 fixed the "on insertion" case. But live timing on the real app showed a
    // freshly-inserted cross-origin iframe stays on about:blank (genuinely
    // same-origin, contentDocument readable) for ~600-1000ms before its real
    // navigation lands and it flips to cross-origin. At insertion time isSameOrigin()
    // correctly says "same" (nothing to warn about yet) -- the bug is that nothing
    // re-checks once the real navigation actually completes a moment later.
    const win = load(`<div></div>`, "https://qa.securiti.xyz/");
    const api = win.__locatorInspector;
    const doc = win.document;
    const panel = doc.getElementById("__locatorInspector-panel");
    panel.querySelector('.tab[data-tab="record"]').dispatchEvent(new win.Event("click", { bubbles: true }));
    api._registry.recording = true;

    const iframe = doc.createElement("iframe");
    iframe.src = "https://edc.qa.securiti.xyz/";
    // Starts genuinely accessible -- like a real iframe still sitting on about:blank.
    doc.body.appendChild(iframe);
    await new Promise((r) => setTimeout(r, 20));

    check("while still on about:blank (same-origin), no cross-origin guidance yet",
      !panel.querySelector('.tabpane[data-pane="record"]').textContent.toLowerCase().includes("instead"));

    // Real navigation lands: contentDocument now throws (genuinely cross-origin),
    // and the browser fires a real "load" event on the iframe element itself --
    // that event is always observable by the parent regardless of the frame's
    // cross-origin destination, which is exactly what the fix listens for.
    Object.defineProperty(iframe, "contentDocument", { get() { throw new Error("cross-origin"); }, configurable: true });
    iframe.dispatchEvent(new win.Event("load"));
    await new Promise((r) => setTimeout(r, 20));

    check("guidance appears automatically once the real navigation completes -- no manual tab switch",
      panel.querySelector('.tabpane[data-pane="record"]').textContent.includes("edc.qa.securiti.xyz") &&
      panel.querySelector('.tabpane[data-pane="record"]').textContent.toLowerCase().includes("instead"),
      panel.querySelector('.tabpane[data-pane="record"]').textContent.slice(0, 200));
  }

  console.log("\n[R31] Entrance fly-in flourish -- doesn't gate the real panel, self-cleans");
  {
    const win = load(`<div></div>`);
    const doc = win.document;
    const panel = doc.getElementById("__locatorInspector-panel");
    check("panel exists synchronously -- NOT gated behind the cosmetic flourish (would break every other test's timing if it were)", !!panel);
    check("panel got the pop-in class", panel.classList.contains("li-panel-pop"));
    const flyin = doc.getElementById("__locatorInspector-flyin");
    check("flying meteor head element was created", !!flyin);
    check("flying meteor is attached directly to body, not inside the panel", flyin.parentNode === doc.body);
    const sparks = doc.querySelectorAll(".__locatorInspector-flyin-spark");
    check("two trailing sparkle particles were created alongside the head", sparks.length === 2);

    // Real bug this guards against, caught by re-running R23 (elsewhere in this
    // file): the flyin element is a body-level sibling of the panel, not a
    // descendant of it -- PANEL_ROOT_SELECTOR (the own-UI exclusion R23 relies on)
    // had to be taught about it explicitly, or its insertion/removal read as a
    // real page mutation and inflated the auto-recheck count (R23 went from 0
    // checks-on-tab-switch to 1-2 the moment this element existed, before
    // PANEL_ROOT_SELECTOR was updated to include "#" + NS + "-flyin" and the
    // spark class too).
    flyin.dispatchEvent(new win.Event("animationend"));
    check("flying meteor removes itself once its animation ends", !doc.getElementById("__locatorInspector-flyin"));
    check("trailing sparkles are cleaned up alongside it", doc.querySelectorAll(".__locatorInspector-flyin-spark").length === 0);
  }

  console.log("\n[R32] Tab-bar whip glow now loops seamlessly, no visible reset/snap at the wrap point");
  {
    const src = fs.readFileSync(path.join(__dirname, "..", "overlay.js"), "utf-8");
    check("keyframe travels exactly one period (0%->100%, not 0%->220% which snapped visibly at wrap)",
      /@keyframes \$\{NS\}-tabwhip\{0%\{background-position:0% 0\}100%\{background-position:100% 0\}\}/.test(src));
    check("the band pattern is written TWICE (periodic at bg-size:200%) so the loop wraps onto an identical frame",
      (src.match(/rgba\(0,172,224,\.30\)/g) || []).length >= 2 && (src.match(/rgba\(0,212,82,\.30\)/g) || []).length >= 2);
  }

  console.log("\n[R33] Toast's own CSS variables actually resolve now -- previously invisible on a white page");
  {
    // Real bug: #toast is a body-level sibling of #panel, same as #help was --
    // CSS custom properties don't inherit to siblings, only descendants, so
    // var(--ink)/var(--text) inside #toast's own rule silently resolved to
    // nothing (transparent background, host-page-inherited text color) unless
    // #toast is ALSO listed on the selector that declares those variables.
    // jsdom doesn't evaluate var() for getComputedStyle, so this is a static
    // source check -- the live fix was confirmed by injecting into a real
    // white page and reading the actual rendered background/text color.
    const src = fs.readFileSync(path.join(__dirname, "..", "overlay.js"), "utf-8");
    const m = src.match(/#\$\{NS\}-panel,#\$\{NS\}-tooltip,#\$\{NS\}-help,#\$\{NS\}-toast\{/);
    check("the variable-declaring rule's selector now includes #toast alongside #panel/#tooltip/#help", !!m);
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
}
main();
