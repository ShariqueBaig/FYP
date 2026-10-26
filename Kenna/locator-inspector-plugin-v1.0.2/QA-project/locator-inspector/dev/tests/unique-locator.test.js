/**
 * Validates the v3 locator engine against a REAL CSS engine (jsdom's
 * querySelectorAll), not a hand-rolled matcher. Proves the escalation logic,
 * the accessibility-first output, and the edge-case handling that broke v2.
 *
 * jsdom limits (validated in the real browser instead — see fixture.html):
 *   - no layout, so elementsFromPoint / overlap picker isn't covered here
 *   - innerText is undefined → describeElement falls back to textContent
 *
 * Run: node tests/unique-locator.test.js
 */
const fs = require("fs");
const path = require("path");
require("fake-indexeddb/auto"); // provides a real IndexedDB impl for KnowledgeStore tests
const { JSDOM } = require("jsdom");

const overlaySrc = fs.readFileSync(path.join(__dirname, "..", "overlay.js"), "utf-8");

function load(bodyHtml, opts = {}) {
  const dom = new JSDOM(`<!DOCTYPE html><html><body>${bodyHtml}</body></html>`, {
    runScripts: "outside-only",
    url: "https://edc.qa.securiti.xyz/",
    pretendToBeVisual: true,
  });
  const { window } = dom;
  // jsdom has no IndexedDB — hand it the fake one so KnowledgeStore works.
  window.indexedDB = globalThis.indexedDB;
  window.IDBKeyRange = globalThis.IDBKeyRange;
  if (opts.beforeLoad) opts.beforeLoad(window);
  window.eval(overlaySrc);
  return window;
}

let passed = 0,
  failed = 0;
function check(name, cond, detail) {
  if (cond) {
    passed++;
    console.log("  ✓ " + name);
  } else {
    failed++;
    console.log("  ✗ " + name + (detail !== undefined ? "  — " + detail : ""));
  }
}
function only(win, sel, node) {
  let nodes;
  try {
    nodes = (node.getRootNode ? node.getRootNode() : win.document).querySelectorAll(sel);
  } catch {
    return "THREW";
  }
  const hits = Array.from(nodes).filter(
    (n) => !(n.closest && n.closest("#__locatorInspector-panel,#__locatorInspector-tooltip,#__locatorInspector-toast"))
  );
  return hits.length === 1 && hits[0] === node;
}

// ---------------------------------------------------------------------------
console.log("\n[1] Repeated list items — distinct verified 1-of-1 locators");
{
  const win = load(`
    <table data-testid="userTable"><tbody>
      <tr><td>Ada</td><td><button class="css-1x2y3z">Delete</button></td></tr>
      <tr><td>Ben</td><td><button class="css-1x2y3z">Delete</button></td></tr>
      <tr><td>Cid</td><td><button class="css-1x2y3z">Delete</button></td></tr>
    </tbody></table>`);
  const api = win.__locatorInspector;
  const btns = Array.from(win.document.querySelectorAll("table button"));
  const set = new Set();
  btns.forEach((b, i) => {
    const r = api.resolveUniqueLocator(b);
    set.add(r.css);
    check(`row ${i + 1}: css is 1-of-1`, r.unique && only(win, r.css, b) === true, r.css);
    check(`row ${i + 1}: scoped under data-testid`, r.css.startsWith('[data-testid="userTable"]'), r.css);
    check(`row ${i + 1}: uses :nth-of-type (not nth-child)`, r.css.includes(":nth-of-type"), r.css);
  });
  check("3 distinct locators", set.size === 3, [...set].join(" | "));
  console.log("    e.g.", api.resolveUniqueLocator(btns[1]).css);
}

// ---------------------------------------------------------------------------
console.log("\n[2] Accessibility-first Playwright output");
{
  const win = load(`
    <button data-testid="save">Save</button>
    <nav><a href="/x" role="link">Reports</a></nav>
    <label for="email">Email</label><input id="email" name="email" class="css-aaa"/>
    <button class="css-bbb">Export to CSV</button>
    <button class="css-bbb">Delete</button>
    <button class="css-bbb">Delete</button>`);
  const api = win.__locatorInspector;
  const save = win.document.querySelector('[data-testid="save"]');
  check("testid → getByTestId", api.resolveUniqueLocator(save).primary === "page.getByTestId('save')", api.resolveUniqueLocator(save).primary);

  const link = win.document.querySelector("a");
  check("role+name → getByRole link (exact)", api.resolveUniqueLocator(link).primary === "page.getByRole('link', { name: 'Reports', exact: true })", api.resolveUniqueLocator(link).primary);

  const email = win.document.querySelector("#email");
  const er = api.resolveUniqueLocator(email);
  check("labelled input → getByRole textbox or getByLabel", /getBy(Role|Label)/.test(er.primary), er.primary);

  const exportBtn = win.document.querySelectorAll("button.css-bbb")[0];
  check("unique text button → getByRole button name Export to CSV (exact)", api.resolveUniqueLocator(exportBtn).primary === "page.getByRole('button', { name: 'Export to CSV', exact: true })", api.resolveUniqueLocator(exportBtn).primary);

  const del = win.document.querySelectorAll("button.css-bbb")[1];
  const dr = api.resolveUniqueLocator(del);
  check("repeated 'Delete' → NOT a bare role/text (falls back to CSS locator)", dr.primary.startsWith("page.locator("), dr.primary);
  check("repeated 'Delete' css is 1-of-1", dr.unique && only(win, dr.css, del) === true, dr.css);
}

// ---------------------------------------------------------------------------
console.log("\n[3] Hash detection — keep utility classes, drop CSS-in-JS");
{
  const win = load(`<div></div>`);
  const api = win.__locatorInspector;
  check("col-md-6 kept (utility)", api.isHashedClass("col-md-6") === false, String(api.isHashedClass("col-md-6")));
  check("btn-primary kept", api.isHashedClass("btn-primary") === false);
  check("mb-4 kept (tailwind)", api.isHashedClass("mb-4") === false);
  check("css-1x2y3z dropped", api.isHashedClass("css-1x2y3z") === true);
  check("sc-bdfBwQ dropped", api.isHashedClass("sc-bdfBwQ") === true);
  check("_1a2b3c4 dropped", api.isHashedClass("_1a2b3c4") === true);
}

// ---------------------------------------------------------------------------
console.log("\n[4] Framework-generated IDs are never used");
{
  const win = load(`<div></div>`);
  const api = win.__locatorInspector;
  check(":r3: rejected", api.isGeneratedId(":r3:") === true);
  check("ext-gen123 rejected", api.isGeneratedId("ext-gen123") === true);
  check("ui-id-1 rejected", api.isGeneratedId("ui-id-1") === true);
  check("mui-42 rejected", api.isGeneratedId("mui-42") === true);
  check("hand-written 'login-form' kept", api.isGeneratedId("login-form") === false);
  // integration: an element whose only id is generated must NOT emit #:r3:
  const win2 = load(`<button id=":r5:" class="css-zzz">A</button><button class="css-zzz">B</button>`);
  const b = win2.document.querySelector("button");
  const r = win2.__locatorInspector.resolveUniqueLocator(b);
  check("generated id not used in css", !r.css.includes(":r5:"), r.css);
}

// ---------------------------------------------------------------------------
console.log("\n[5] Duplicate IDs — #id must not silently match the first");
{
  const win = load(`<div id="dup">first</div><div id="dup" data-testid="second">second</div>`);
  const api = win.__locatorInspector;
  const second = win.document.querySelectorAll('[id="dup"]')[1];
  const r = api.resolveUniqueLocator(second);
  check("second #dup resolves 1-of-1 (not #dup)", r.unique && only(win, r.css, second) === true, r.css);
  check("does not emit bare #dup", r.css !== "#dup", r.css);
}

// ---------------------------------------------------------------------------
console.log("\n[6] SVG elements — className.baseVal + case-sensitive tag");
{
  const win = load(
    `<button data-testid="chart-btn"><svg viewBox="0 0 10 10"><linearGradient class="grad-fill"><stop/></linearGradient></svg></button>`
  );
  const api = win.__locatorInspector;
  const lg = win.document.querySelector("linearGradient");
  const r = api.resolveUniqueLocator(lg);
  check("SVG element resolves to 1-of-1", r.unique && only(win, r.css, lg) === true, r.css);
  check("SVG tag preserves camelCase", /linearGradient/.test(r.css), r.css);
  // hovering the svg inside the button should still be resolvable
  check("SVG has no string.className crash", typeof r.css === "string" && r.css.length > 0, r.css);
}

// ---------------------------------------------------------------------------
console.log("\n[7] CSS.escape — weird ids/classes don't break the selector");
{
  const win = load(`<div id="weird:id.1"><button name="q[1]" class="css-qq">Go</button></div>`);
  const api = win.__locatorInspector;
  const wrap = win.document.querySelector('[id="weird:id.1"]');
  const r = api.resolveUniqueLocator(wrap);
  check("id with : and . resolves 1-of-1", r.unique && only(win, r.css, wrap) === true, r.css);
}

// ---------------------------------------------------------------------------
console.log("\n[8] Deep nesting, no anchors — positional path with :nth-of-type");
{
  const win = load(`<div><div><section><ul>
    <li><span class="css-hhh1">A</span></li>
    <li><span class="css-hhh1">B</span></li>
  </ul></section></div></div>`);
  const api = win.__locatorInspector;
  const span = win.document.querySelectorAll("span")[1];
  const r = api.resolveUniqueLocator(span);
  check("2nd span 1-of-1", r.unique && only(win, r.css, span) === true, r.css);
  check("uses child combinators", r.css.includes(" > "), r.css);
  check("pins 2nd li via nth-of-type", /li:nth-of-type\(2\)/.test(r.css), r.css);
  console.log("    →", r.css);
}

// ---------------------------------------------------------------------------
console.log("\n[9] Open Shadow DOM — pierce + root-scoped uniqueness");
{
  const win = load(`<div id="host-wrap"></div>`, {
    beforeLoad(w) {
      const host = w.document.createElement("div");
      host.className = "widget";
      w.document.getElementById("host-wrap").appendChild(host);
      const sr = host.attachShadow({ mode: "open" });
      sr.innerHTML = `<button data-testid="inner-save">Save</button><button class="css-x">Del</button>`;
    },
  });
  const api = win.__locatorInspector;
  const host = win.document.querySelector(".widget");
  const inner = host.shadowRoot.querySelector('[data-testid="inner-save"]');
  const r = api.resolveUniqueLocator(inner);
  check("shadow element resolves 1-of-1 within its root", r.unique === true, r.css);
  check("boundary detected as shadow", r.boundary && /shadow/.test(r.boundary.type), r.boundary && r.boundary.type);
  check("boundary chain names the host", r.boundary && r.boundary.chain.some((c) => /widget/.test(c.host)), JSON.stringify(r.boundary && r.boundary.chain));
  console.log("    boundary:", r.boundary && r.boundary.type, "chain:", JSON.stringify(r.boundary && r.boundary.chain));
}

// ---------------------------------------------------------------------------
console.log("\n[10] Flakiness predictor — breaks flip a locator to Flaky");
{
  const win = load(`<ul id="list"><li><button class="css-a">X</button></li></ul>`);
  const api = win.__locatorInspector;
  const btn = win.document.querySelector("button");
  const r = api.resolveUniqueLocator(btn);
  api._registry.tracked.set(r.css, {
    css: r.css, primary: r.primary, strategy: r.primaryStrategy, stability: r.stability,
    checks: 0, breaks: 0, lastCount: 1, firstSeen: Date.now(),
  });
  // Now add a second matching element → the locator is no longer 1-of-1.
  const li = win.document.createElement("li");
  li.innerHTML = `<button class="css-a">X</button>`;
  win.document.getElementById("list").appendChild(li);
  api.revalidateAll("test-mutation");
  const rec = api._registry.tracked.get(r.css);
  check("locator recorded a break after DOM churn", rec.breaks >= 1, `breaks=${rec.breaks} lastCount=${rec.lastCount}`);
}

// ---------------------------------------------------------------------------
console.log("\n[11] Substring-name guard — emitted Playwright name locators are exact");
{
  // "Delete" is a substring of "Delete user"; without exact:true, getByRole
  // name:'Delete' would match BOTH. The emitted locator must be exact.
  const win = load(`<button class="c1">Delete</button><button class="c2">Delete user</button>`);
  const api = win.__locatorInspector;
  const del = win.document.querySelector(".c1");
  const r = api.resolveUniqueLocator(del);
  check("emits getByRole with exact:true", /getByRole\('button', \{ name: 'Delete', exact: true \}\)/.test(r.primary), r.primary);
  // every semantic name-based locator we emit must carry exact:true
  const semantic = /getBy(Role|Label|Placeholder|Text)/.test(r.primary);
  check("no semantic name locator without exact:true", !semantic || /exact: true/.test(r.primary), r.primary);
}

// ---------------------------------------------------------------------------
console.log("\n[12] Flakiness re-check is root-aware — shadow locators stay Stable");
{
  const win = load(`<div id="host-wrap"></div>`, {
    beforeLoad(w) {
      const host = w.document.createElement("div");
      host.className = "widget";
      w.document.getElementById("host-wrap").appendChild(host);
      host.attachShadow({ mode: "open" }).innerHTML = `<button data-testid="inner-save">Save</button>`;
    },
  });
  const api = win.__locatorInspector;
  const inner = win.document.querySelector(".widget").shadowRoot.querySelector('[data-testid="inner-save"]');
  const res = api.resolveUniqueLocator(inner);
  api._registry.tracked.set(res.css, {
    css: res.css, primary: res.primary, strategy: res.primaryStrategy, stability: res.stability,
    root: res.root, checks: 0, breaks: 0, lastCount: 1, firstSeen: Date.now(),
  });
  // fire a top-document mutation (re-render) — the shadow locator must NOT break
  win.document.body.appendChild(win.document.createElement("div"));
  api.revalidateAll("re-render");
  const rec = api._registry.tracked.get(res.css);
  check("shadow locator not falsely flagged flaky", rec.breaks === 0 && rec.lastCount === 1, `breaks=${rec.breaks} lastCount=${rec.lastCount}`);
}

// ---------------------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
