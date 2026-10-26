/**
 * Locator Catalog — the persistent "agent memory".
 * Verifies it silently accumulates verified locators, persists them through the
 * swappable backend (IndexedDB by default), survives a fresh session, exports,
 * and clears. Run: node tests/catalog.test.js
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  console.log("\n[K1] Catalog records verified locators + persists through the backend");
  const DS = "urn:li:dataset:(urn:li:dataPlatform:redshift,dev.public.employee,PROD)";
  const w = load(`<a data-testid="${DS}">Employee</a><button aria-label="Save changes">Save</button><input aria-label="Search">`);
  const api = w.__locatorInspector;
  for (const sel of ["a", "button", "input"]) api.Catalog.record(api.resolveUniqueLocator(w.document.querySelector(sel)), "/search");
  await api.Catalog.flush();
  check("backend is the swappable local one", /IndexedDB/.test(api.Catalog.backendKind), api.Catalog.backendKind);
  check("in-memory size >= 3", api.Catalog.size() >= 3, String(api.Catalog.size()));
  const persisted = await api.KS.getAll("catalog");
  check("persisted to backend (round-trip)", persisted.length >= 3, String(persisted.length));
  const urnRec = persisted.find((r) => r.urn);
  check("URN extracted into the record", urnRec && urnRec.urn === DS, urnRec && urnRec.urn);
  check("records carry route + strategy + grade", persisted.every((r) => r.route === "/search" && r.strategy && r.grade), JSON.stringify(persisted[0]).slice(0, 120));

  console.log("\n[K2] A fresh session HYDRATES prior knowledge (agent memory survives reloads)");
  const w2 = load(`<div>totally different page, same origin</div>`);
  await sleep(80); // let boot's async hydrate complete
  const api2 = w2.__locatorInspector;
  check("new session loaded prior catalog from storage", api2.Catalog.size() >= 3, String(api2.Catalog.size()));

  console.log("\n[K3] Export + clear");
  const all = api2.Catalog.all();
  check("export returns the full catalog", Array.isArray(all) && all.length >= 3);
  await api2.Catalog.clear();
  check("clear empties memory", api2.Catalog.size() === 0);
  check("clear empties backend", (await api2.KS.getAll("catalog")).length === 0);

  console.log("\n[K4] Approve → recall: an approved locator is reused (verified) next time");
  {
    const w = load(`<button aria-label="Save changes">Save</button>`);
    const api = w.__locatorInspector;
    const btn = w.document.querySelector("button");
    const r1 = api.resolveUniqueLocator(btn);
    check("first resolve is derived (not yet approved)", r1.approved !== true, String(r1.approved));
    api.Catalog.approve(r1);
    await api.Catalog.flush();
    check("approvedCount incremented", api.Catalog.approvedCount() >= 1, String(api.Catalog.approvedCount()));
    const r2 = api.resolveUniqueLocator(btn);
    check("second resolve is RECALLED from approved memory", r2.approved === true && /recalled/i.test(r2.note), r2.note);
    check("recalled locator equals the approved one", r2.primary === r1.primary, r2.primary);
  }

  console.log("\n[K5] Recall is VERIFIED — never returns a stale/wrong element");
  {
    // two identical 'Delete' buttons → semantic key collides, but the approved
    // css matches 2 elements, so recall must refuse (no false reuse).
    const w = load(`<button aria-label="Delete">D</button><button aria-label="Delete">D</button>`);
    const api = w.__locatorInspector;
    const b1 = w.document.querySelectorAll("button")[0];
    const r = api.resolveUniqueLocator(b1); // will be contextual/positional, unique
    api.Catalog.approve(r);
    await api.Catalog.flush();
    // Now ask recall for a plain 'Delete' by faking a lookup: resolve b1 again — the
    // approved record's css must still resolve to exactly b1 (not b2) or recall skips.
    const again = api.resolveUniqueLocator(b1);
    check("recall only fires when the stored locator still uniquely matches THIS element",
      (again.approved === true && again.primary === r.primary) || again.approved !== true, again.primary);
  }

  console.log("\n[K6] Approval survives a fresh session (persisted + re-indexed on hydrate)");
  {
    const w2 = load(`<button aria-label="Save changes">Save</button>`);
    await sleep(90);
    const api2 = w2.__locatorInspector;
    const r = api2.resolveUniqueLocator(w2.document.querySelector("button"));
    check("new session recalls the previously-approved 'Save changes' locator", r.approved === true, r.note);
  }

  console.log("\n[K7] SELF-HEAL — an approved locator auto-repairs when the DOM drifts");
  {
    // Sprint N: button has a testid → approved locator is getByTestId.
    const w = load(`<button data-testid="save-btn" aria-label="Save changes">Save</button>`);
    const api = w.__locatorInspector;
    const btn = w.document.querySelector("button");
    const r1 = api.resolveUniqueLocator(btn);
    check("initial approved locator uses the testid", /getByTestId|save-btn/.test(r1.primary), r1.primary);
    api.Catalog.approve(r1);
    await api.Catalog.flush();
    const approvedBefore = api.Catalog.approvedCount();
    // Sprint N+1: a dev removes the testid. Same button, same role+name (stable identity).
    btn.removeAttribute("data-testid");
    const r2 = api.resolveUniqueLocator(btn);
    check("after drift the derived locator changed (no longer testid)", r2.primary !== r1.primary && !/save-btn/.test(r2.primary), r2.primary);
    // NO SILENT HEAL (spec #5): an AUTONOMOUS scan (record without confirmation)
    // must NOT swap the approved locator — it only records a SUGGESTION.
    const auto = api.Catalog.record(r2);
    check("autonomous record did NOT heal the approved entry", !(auto && auto.approved && auto.heals >= 1), auto && JSON.stringify({ approved: auto.approved, heals: auto.heals }));
    const sugg = api.Catalog.suggestions();
    check("drift is surfaced as a suggestion for human review", sugg.length >= 1 && sugg[0].newPrimary === r2.primary, JSON.stringify(sugg[0] || null));
    const stillOld = api.resolveUniqueLocator(btn);
    check("until confirmed, recall still returns the OLD approved locator (no silent swap)", stillOld.primary === r1.primary || stillOld.approved !== true, stillOld.primary);
    // Human CONFIRMS (accepts the suggestion / re-approves) => now it heals.
    const accepted = api.Catalog.acceptSuggestion(sugg[0].key);
    check("accepting the suggestion heals the approved entry", accepted === true, String(accepted));
    check("no duplicate approved entry created (count unchanged)", api.Catalog.approvedCount() === approvedBefore, api.Catalog.approvedCount() + " vs " + approvedBefore);
    const r3 = api.resolveUniqueLocator(btn);
    check("next resolve recalls the HEALED locator", r3.approved === true && r3.primary === r2.primary, r3.primary);
    // Alternative path: explicit approve() on the drifted element also heals.
    check("no pending suggestion remains after confirmation", api.Catalog.suggestions().length === 0, String(api.Catalog.suggestions().length));
  }

  console.log("\n[K8] QUALITY GATE — only accurate locators are ever learned (no brittle/misleading data)");
  {
    // A clean, semantic element (data-testid) IS learnable; a hook-less, deeply
    // nested div that can only be located positionally (grade F / strategy css) is
    // REFUSED so the knowledge base never absorbs misleading locators.
    const w = load(`<button data-testid="save-btn">Save</button><section><div><div><span></span><span></span></div></div></section>`);
    const api = w.__locatorInspector;
    const good = api.resolveUniqueLocator(w.document.querySelector("button"));
    const bad = api.resolveUniqueLocator(w.document.querySelectorAll("span")[1]);
    check("brittle target really is positional css/F", bad.primaryStrategy === "css" || bad.grade === "F", bad.primaryStrategy + "/" + bad.grade);
    const before = api.Catalog.size();
    const recBad = api.Catalog.record(bad, "/x");
    check("brittle locator is NOT recorded (returns null)", recBad === null, String(recBad && recBad.sig));
    check("brittle locator did NOT enter the knowledge base", api.Catalog.size() === before, api.Catalog.size() + " vs " + before);
    const recGood = api.Catalog.record(good, "/x");
    check("accurate locator IS recorded", recGood && /getByTestId|save-btn/.test(recGood.primary), recGood && recGood.primary);
    // approving a brittle locator is also refused (nothing learned from it)
    const apprBefore = api.Catalog.approvedCount();
    api.Catalog.approve(bad, "/x");
    check("approving a brittle locator learns nothing", api.Catalog.approvedCount() === apprBefore, api.Catalog.approvedCount() + " vs " + apprBefore);
  }

  console.log("\n[K9] Growth controls — confidence tiers, per-locator unapprove, two-factor Clear stale");
  {
    const w = load(`<button data-testid="save-btn" aria-label="Save changes">Save</button>`);
    const api = w.__locatorInspector;
    await sleep(50); // let boot's fire-and-forget hydrate() settle before clearing, or its
                      // in-flight backend.all() can repopulate mem right after clear() runs
    await api.Catalog.clear();
    const btn = w.document.querySelector("button");
    const r = api.resolveUniqueLocator(btn);
    api.Catalog.approve(r);
    await api.Catalog.flush();
    check("approvedCount is 1 after approving", api.Catalog.approvedCount() === 1, String(api.Catalog.approvedCount()));

    // --- unapprove: demotes, doesn't delete, doesn't touch anything else ---
    const sig = api.Catalog.all()[0].sig;
    const un1 = api.Catalog.unapprove("no-such-sig-at-all");
    check("unapprove on an unknown sig is a no-op (returns false)", un1 === false, String(un1));
    const un2 = api.Catalog.unapprove(sig);
    check("unapprove on a real approved sig succeeds", un2 === true, String(un2));
    check("approvedCount drops to 0", api.Catalog.approvedCount() === 0, String(api.Catalog.approvedCount()));
    check("record itself is NOT deleted, just demoted", api.Catalog.size() === 1 && api.Catalog.all()[0].approved === false, JSON.stringify(api.Catalog.all()[0]));

    // --- confidenceOf: the same tiers "Clear stale" reads off ---
    const DAY = 24 * 60 * 60 * 1000;
    check("grade A + stable => high confidence", api.Catalog.confidenceOf({ grade: "A", stability: "stable", approvals: 0, strategy: "role" }) === "high");
    check("re-approved 2+ times => high confidence regardless of grade", api.Catalog.confidenceOf({ grade: "C", stability: "at-risk", approvals: 2, strategy: "text" }) === "high");
    check("URN-anchored => high confidence regardless of grade", api.Catalog.confidenceOf({ grade: "B", stability: "medium", approvals: 0, strategy: "urn" }) === "high");
    check("everything else => low confidence", api.Catalog.confidenceOf({ grade: "B", stability: "medium", approvals: 0, strategy: "role" }) === "low");

    // --- clearStale(30): AGE alone is not enough, CONFIDENCE alone is not enough ---
    await api.Catalog.clear();
    const mk = (i, over) => Object.assign(
      { primary: `page.getByRole('button', { name: 'k9-${i}' })`, unique: true, primaryStrategy: "role", grade: "B", stability: "medium", role: "button", accName: "k9-" + i },
      over
    );
    api.Catalog.record(mk(1), "/r1");                              // fresh + low confidence -> KEEP (not old enough)
    api.Catalog.record(mk(2), "/r2");
    api.Catalog.approve(mk(3), "/r3");                             // will force grade A + stable + old below -> KEEP (high confidence)
    api.Catalog.approve(mk(4), "/r4");                             // will force old + low confidence -> DROP
    api.Catalog.approve(mk(5), "/r5");                             // will force old + approvals>=2 -> KEEP (re-confirmed)
    await api.Catalog.flush();
    const all = api.Catalog.all();
    const byName = (n) => all.find((r) => r.name === n);
    const old = Date.now() - 40 * DAY;
    Object.assign(byName("k9-3"), { grade: "A", stability: "stable", lastSeen: old });
    Object.assign(byName("k9-4"), { grade: "C", stability: "at-risk", lastSeen: old });
    Object.assign(byName("k9-5"), { grade: "C", stability: "at-risk", approvals: 2, lastSeen: old });
    const before = api.Catalog.size();
    const n = await api.Catalog.clearStale(30);
    check("exactly the one old+low-confidence record was dropped", n === 1, String(n));
    check("catalog shrank by exactly that many", api.Catalog.size() === before - n, `${api.Catalog.size()} vs ${before}-${n}`);
    check("fresh-but-low-confidence entries survive (age guard)", !!api.Catalog.all().find((r) => r.name === "k9-1"));
    check("old-but-grade-A-stable entry survives (confidence guard)", !!api.Catalog.all().find((r) => r.name === "k9-3"));
    check("old-and-low-confidence entry was actually removed", !api.Catalog.all().find((r) => r.name === "k9-4"));
    check("old-but-repeatedly-reapproved entry survives (approvals guard)", !!api.Catalog.all().find((r) => r.name === "k9-5"));
    check("clearStale persisted the removal to the backend too", (await api.KS.getAll("catalog")).length === api.Catalog.size());
  }

  console.log("\n[K10] Auto-vacuum on hydrate — old UNAPPROVED sightings are dropped, approved ones never are");
  {
    const w = load(`<div>seed session for K10</div>`);
    const api = w.__locatorInspector;
    await sleep(50);
    await api.Catalog.clear();
    const old = Date.now() - 200 * 24 * 60 * 60 * 1000; // well past the 90-day unapproved cutoff
    const seen = api.Catalog.record({ primary: "page.getByRole('button', { name: 'stale-seen' })", unique: true, primaryStrategy: "role", grade: "B", stability: "medium", role: "button", accName: "stale-seen" }, "/v");
    seen.lastSeen = old;
    api.Catalog.approve({ primary: "page.getByRole('button', { name: 'stale-approved' })", unique: true, primaryStrategy: "role", grade: "B", stability: "medium", role: "button", accName: "stale-approved" }, "/v");
    api.Catalog.all().find((r) => r.name === "stale-approved").lastSeen = old;
    await api.Catalog.flush();
    check("seeded 2 records before the fresh session", api.Catalog.size() === 2, String(api.Catalog.size()));

    const w2 = load(`<div>fresh session — triggers hydrate's auto-vacuum</div>`);
    await sleep(100);
    const api2 = w2.__locatorInspector;
    const all2 = api2.Catalog.all();
    check("old UNAPPROVED sighting was vacuumed away on hydrate", !all2.find((r) => r.name === "stale-seen"), all2.map((r) => r.name));
    check("old APPROVED entry survived — vacuum never touches approved memory", !!all2.find((r) => r.name === "stale-approved"), all2.map((r) => r.name));
  }

  console.log("\n[K11] Hard cap — Catalog never grows past its ceiling, worst (low-confidence/oldest) evicted first");
  {
    const w = load(`<div>K11</div>`);
    const api = w.__locatorInspector;
    await sleep(50);
    await api.Catalog.clear();
    const CAP = 2000; // mirrors CATALOG_MAX in overlay.js
    for (let i = 0; i < CAP + 5; i++) {
      api.Catalog.record({ primary: `page.getByRole('button', { name: 'cap-${i}' })`, unique: true, primaryStrategy: "role", grade: "B", stability: "medium", role: "button", accName: "cap-" + i }, "/cap" + i);
    }
    check(`catalog never exceeds the ${CAP} cap`, api.Catalog.size() <= CAP, String(api.Catalog.size()));
    check("eviction actually dropped the overflow (not just refusing new writes)", !!api.Catalog.all().find((r) => r.name === "cap-" + (CAP + 4)), "newest record missing — cap is refusing inserts, not evicting");
  }

  console.log("\n[K12] Approving an ALTERNATIVE locator approves/tracks the ALTERNATIVE, not the primary");
  {
    // aria-label doubles as the accessible name, so role+accessible-name and
    // aria-label both point at real, DIFFERENT strings than the testid primary --
    // exactly the "I picked something other than the default" case being fixed.
    const w = load(`<button data-testid="save-btn" aria-label="Save changes">Save</button>`);
    const api = w.__locatorInspector;
    await api.Catalog.clear();
    const el = w.document.querySelector("button");
    const res = api.resolveUniqueLocator(el);
    check("sanity: primary really is the testid form", /getByTestId|save-btn/.test(res.primary), res.primary);

    const alts = api.suggestAlternatives(el, res, "page");
    check("at least one alternative was found", alts.length > 0, JSON.stringify(alts));
    const roleAlt = alts.find((a) => a.kind === "role + accessible name");
    check("role+accessible-name alternative exists and differs from the primary", !!roleAlt && roleAlt.code !== res.primary, roleAlt && roleAlt.code);
    check("the alternative carries a reference to the SAME element", roleAlt.el === el);

    api.approveAlternative(roleAlt, "/x");
    const approved = api.Catalog.all().find((r) => r.approved);
    check("approving the alternative created an approved record", !!approved);
    check("the STORED primary is the ALTERNATIVE's code, not the original primary",
      approved && approved.primary === roleAlt.code, approved && approved.primary);
    check("the stored primary is NOT the original testid form (the bug this fixes)",
      approved && approved.primary !== res.primary, approved && approved.primary);
    check("strategy was correctly attributed as 'role'", approved && approved.strategy === "role", approved && approved.strategy);
    check("grade matches the SAME STRATEGY_GRADE table the primary uses",
      approved && approved.grade === "A", approved && approved.grade); // role -> A per STRATEGY_GRADE
    check("it's also eligible for Doctor's checkup list (same css key as the primary)",
      api._registry.deliberateCopy.has(res.css), [...api._registry.deliberateCopy]);

    console.log("\n  [K12b] A last-resort CSS alternative tracks for checkup but is NOT approved into memory");
    await api.Catalog.clear(); api._registry.deliberateCopy.clear();
    const cssAlt = { code: "page.locator('button')", kind: "CSS", note: "test", pin: "structural", el };
    const apprBefore = api.Catalog.approvedCount();
    api.approveAlternative(cssAlt, "/x");
    check("CSS-tier alternative is NOT approved (matches primary-CSS exclusion)", api.Catalog.approvedCount() === apprBefore, String(api.Catalog.approvedCount()));
    check("...but IS still marked for the checkup list (session-only signal, no quality bar)",
      api._registry.deliberateCopy.has(res.css));

    console.log("\n  [K12c] A stale alternative (element no longer in the document) is a safe no-op");
    const detached = w.document.createElement("button");
    const staleAlt = { code: "page.getByRole('button', { name: 'Ghost' })", kind: "role + accessible name", el: detached };
    let staleError = null;
    const beforeSize = api.Catalog.size();
    try { api.approveAlternative(staleAlt, "/x"); } catch (e) { staleError = String(e); }
    check("stale element does not throw", staleError === null, staleError);
    check("stale element does not get recorded into the Catalog", api.Catalog.size() === beforeSize, `${api.Catalog.size()} vs ${beforeSize}`);

    console.log("\n  [K12d] strategyForAltKind maps every real alternative kind exactly to STRATEGY_GRADE's keys");
    const cases = [
      ["role + accessible name", "role"], ["aria-label", "label"], ["<label> text", "label"],
      ["placeholder", "placeholder"], ["URN", "urn"], ["visible text", "text"], ["scoped chain", "contextual"],
      ["CSS", "css"], ["data-testid", "testid"], ["data-cy", "testid"], ["some-unknown-kind", "css"],
    ];
    for (const [kind, expected] of cases) check(`kind "${kind}" -> strategy "${expected}"`, api.strategyForAltKind(kind) === expected, api.strategyForAltKind(kind));
  }

  console.log("\n" + passed + " passed, " + failed + " failed\n");
  // Exit EXPLICITLY on success too. These suites boot the real overlay into jsdom, and
  // boot() schedules live timers (checkDrift at 800ms, the requestIdleCallback fallback,
  // the catalog flush, toast timeouts). With only `if (failed) process.exit(1)`, a
  // passing run left those handles pending and the process never exited -- which is why
  // `npm test` used to print "46 passed" and then hang forever on the last suite.
  process.exit(failed ? 1 : 0);
})();
