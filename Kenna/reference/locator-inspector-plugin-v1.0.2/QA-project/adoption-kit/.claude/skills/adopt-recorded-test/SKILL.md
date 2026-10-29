---
name: adopt-recorded-test
description: Fold a recorded/generated Playwright reference test into this repository's own conventions. Use when someone provides a codegen-style script (step comments, inline getBy* locators, a `data` object with keys like step7, commented-out `// ASSERT` lines) and wants it added to the test suite properly. Triggers on "adopt this recorded test", "add this generated test to our repo", "convert this codegen script", "productionize this recording", "here's a recorded test, make it fit our patterns".
---

# Adopting a recorded test

A recorded test is a **reference**, not a finished test. Your job is to translate it into this
repository's idiom — not to paste it in.

Recognise the input by its shape: `// Step N:` comments, inline `getBy*` locators, a top-level
`const data = { step7: …, step8: … }`, commented-out `// ASSERT (enable + edit):` lines, and a title
like `'TODO rename: button Create'`.

**Two rules that override everything else:**

1. **Discover this repo's conventions. Never assume them.** Nothing in this skill describes what your
   repo looks like, because it doesn't know. Every instruction below is "find out, then follow".
2. **The recording brought no auth, and needs none.** This repo already authenticates its tests
   somehow. Find that mechanism and use it. Never add a login step, and never import an auth helper
   from wherever the recording came from.

Work through the phases in order. Don't skip phase 1 — writing code before you know the conventions
means rewriting it.

---

## Phase 1 — Discover the rules

### 1a. Read the stated rules

Look for, and read whatever exists:

- `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, `.cursor/rules/*`, `.github/copilot-instructions.md`
- `CONTRIBUTING.md`, `README.md`, `docs/` — search for "test", "convention", "pattern", "locator"
- Any `CLAUDE.md` nested in the test directory itself; the closest one wins

### 1b. Read the mechanical config

- `playwright.config.ts` (or `.js`, or several) — `testDir`, projects and what each one matches,
  `use.storageState`, `dependencies`, `baseURL`, timeouts, `testIgnore`
- `tsconfig.json` — `baseUrl` and `paths`, which dictate whether imports are aliased or relative
- `package.json` — the test scripts, and how environment/tenant is selected
- `.eslintrc*` / `biome.json` / `.prettierrc*` — formatting is not optional; match it

### 1c. Read the nearest existing tests — this is the authoritative source

Find **2–3 existing specs closest to the feature the recording touches**, plus the page objects and
fixtures they use. Read them fully.

> **Conventions in code beat conventions in docs.** Where a rules file and the actual specs disagree,
> follow the specs and note the discrepancy in your report.

### 1d. Write down a convention profile

Answer each of these explicitly before writing anything. If you can't answer one, go look again.

| Question | Where to find it |
| --- | --- |
| How does a test get an **authenticated** page? | a custom fixture? project `storageState`? a helper? Look at what existing specs destructure — `{ page }`, `{ user }`, `{ authedPage }`… |
| Where do specs live, and how are files named? | the tree around the nearest neighbours |
| How are tests titled? Tags? Test-case IDs? | existing `test(...)` titles and `test.describe` blocks |
| Page objects, or inline locators? | is there a `pages/` or `pom/` directory? |
| Where are locators declared, and in what shape? | a grouped object at the top of a page class? inline? |
| Locator policy — accessibility-first? XPath allowed? | rules file, plus what the existing locators actually use |
| Raw `expect`, or a wrapper/assertion service? | do specs `import { expect }`, or call something like `Expect.elementsVisible()`? |
| Where do labels/strings live? | a constants file? inline literals? |
| How is test data produced? | a data helper, a factory, a random-data generator, JSON fixtures |
| Do created entities need unique names? | look for timestamp/uuid suffixes in existing specs |
| How are URLs and environments resolved? | an env-URL helper? `baseURL`? never a hardcoded host |
| Waiting policy | most repos ban static sleeps; find the sanctioned wait helpers |
| Cleanup / teardown expectations | do specs delete what they create? |

---

## Phase 2 — Translate, don't transcribe

Map each piece of the recording onto the profile you just built.

| In the recording | Becomes |
| --- | --- |
| `async ({ page })` | whatever fixture this repo uses for an authenticated page |
| inline `getByRole` / `getByTestId` / `getByLabel` / `getByText` | a call into the existing page object. **Search for the label, test-id, or role first** — if a locator for it already exists, reuse it; only add one when none exists, and add it where this repo puts locators |
| `page.goto('https://edc.qa.securiti.xyz/glossary')` | this repo's env-URL helper or `baseURL`. **Never a hardcoded host** — it silently pins the test to one environment |
| `const data = { step7: 'moi' }` | semantically named values, produced this repo's way; add a uniqueness suffix if the entity must be unique |
| `// ASSERT (enable + edit): …` | real assertions, in this repo's assertion idiom |
| `// Step N: …` comments | delete them. Their information belongs in page-object method names, or in this repo's step/annotation mechanism if it has one |
| `test('TODO rename: button Create')` | a real title, following the naming + tag + test-ID convention |
| no `beforeEach` / no cleanup | add whatever this repo expects |

While translating:

- **Reuse before you create.** A new page-object method that duplicates an existing one is a defect.
- **Don't import anything from the recorder's harness.** No auth helper, no config, no `storageState`.
- **Match surrounding style** — quote style, import order, `async` patterns, comment density.

---

## Phase 3 — Prune the recorder noise

A recorder captures what happened, including things that only happened because a human was typing.
Remove these, and **list every removal in your report**:

| Pattern | Why it's noise | Action |
| --- | --- | --- |
| Consecutive `fill()` calls on the **same** locator with growing values (`'moi'` → `'moiz'` → `'moizlocator'`) | one person typing, captured mid-keystroke | keep only the final value |
| `click()` on an input immediately followed by `fill()` of that same input | `fill()` focuses the field itself | drop the click |
| A `click()` that navigates, immediately followed by a `goto()` to the same destination | the recorder logged both the UI navigation and the resulting URL | keep one. Prefer the UI click if this repo tests navigation; prefer the `goto` if it wants a direct entry point |
| Repeated identical `goto()` to the current URL | no-op | drop |
| Positional data keys (`step7`, `step8`) | meaningless once steps are gone | rename semantically |
| Commented-out `// ASSERT` scaffolding that you did not turn into a real assertion | dead weight | delete it — don't ship commented code |

**Do not prune a step that plausibly triggers behaviour.** A click can blur a field that validates on
blur; a navigation can trigger a lazy load; an intermediate value can fire a debounced search. When
you're unsure, **keep the step and flag it** rather than removing it. Deleting a load-bearing step
produces a flaky test, which is worse than a slightly redundant one.

---

## Phase 4 — Assertions

The recorder cannot know intent. Its commented `// ASSERT` lines are prompts, not specifications — and
a test with no assertions passes while proving nothing.

- Add at least one assertion that reflects the **purpose** of the flow, not just that the last click
  landed. For a "create" flow, assert the thing now exists — in the list, not merely that a toast
  appeared.
- Use this repo's assertion API, with its own timeout/retry conventions.
- Assert on stable, meaningful state. Not on incidental text, not on a specific post-login route
  (many apps let users change their landing page).
- If you genuinely cannot tell what should be asserted, say so in the report and ask. Don't invent a
  weak assertion to fill the gap.

---

## Phase 5 — Verify

Don't report success on a test you haven't run.

1. **Typecheck and lint** — whatever this repo uses.
2. **Run the test.** It must pass.
3. **Run it a second time.** A test that creates a named entity often fails the second run on a
   duplicate-name validation — that's how you discover it needed a unique suffix.
4. **Break it deliberately** (a wrong expected value) and confirm it fails for the reason you'd expect,
   with a readable message. A test that can't fail informatively isn't finished.
5. If the repo runs specs in parallel, confirm yours is safe there — or mark it serial per this repo's
   convention.

---

## Phase 6 — Report

State plainly:

- **Where the test landed** and what it's called
- **Which repo conventions you applied**, and how you determined them (rules file vs. existing specs)
- **What you reused** — existing page objects, locators, helpers
- **What you added** — new page-object methods, new locators, and where
- **What you pruned**, item by item, with the reason (so a human can veto)
- **What needs human review** — assertions first, then anything you flagged as
  keep-but-uncertain
- **Any discrepancy** between the stated rules and what the existing code actually does
- **What you did NOT do** and why

Be honest about steps you kept only because you weren't sure. That's useful information, not a failure.

---

## Worked example

Given this recording:

```ts
import { test, expect } from '@playwright/test';

const data = {
  step7: 'moi',
  step8: 'moiz',
  step9: 'moizlocator',
};

test('TODO rename: button Create', async ({ page }) => {
  // Step 1: open the application
  await page.goto('https://edc.qa.securiti.xyz/');
  // Step 2: Click span "Glossary Terms"
  await page.getByText('Glossary Terms', { exact: true }).click();
  // Step 3: open the application
  await page.goto('https://edc.qa.securiti.xyz/glossary');
  // Step 4: Click button "Add"
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  // Step 5: Click menuitem "Add Term"
  await page.getByTestId('add-term-button').click();
  // Step 6: Click textbox "Name"
  await page.getByLabel('Name', { exact: true }).click();
  // Step 7-9: Type into textbox "Name"
  await page.getByLabel('Name', { exact: true }).fill(data.step7);
  await page.getByLabel('Name', { exact: true }).fill(data.step8);
  await page.getByLabel('Name', { exact: true }).fill(data.step9);
  // Step 10: Click button "Create"
  await page.getByTestId('glossary-entity-modal-create-button').click();
});
```

**The recording, read critically:** ten steps, but only five distinct intentions — open the glossary,
open the Add Term dialog, name the term, create it, and (missing) confirm it exists. Steps 2 and 3 are
the same navigation twice. Step 6 is redundant with step 7. Steps 7–9 are one person typing. And there
is no assertion at all, so as written it passes without proving anything.

**If the target repo's `CLAUDE.md` said** — this is a real example of the kind of rule set you'll meet —
*locators live in a grouped object at the top of a page-object class; page objects extend a `BasePage`;
use the custom `Expect` service rather than raw `expect`; prefix assertion methods `assert*` and
predicates `is*`; no static waits; tag tests and include the test-case ID; get data through a
`DataHelper`; and "don't create any other login function, instead use the `user` fixture"* — then the
adopted result is roughly:

```ts
import { test } from 'tests/fixtures/login-fixture';
import { GlossaryPage } from 'tests/ui/pages/glossary/GlossaryPage';
import { GenerateRandomData } from 'tests/utils/helpers/GenerateRandomData';

let glossaryPage: GlossaryPage;

test.beforeEach(async ({ user }) => {
  glossaryPage = new GlossaryPage(user);
  await glossaryPage.openGlossary();
});

test('PRIV-XXXXX @sanity create a glossary term', async () => {
  const termName = GenerateRandomData.getUniqueName('term');

  await glossaryPage.addTerm({ name: termName });

  await glossaryPage.assertTermVisible(termName);
});
```

…with the locators and the `addTerm` / `assertTermVisible` methods added to `GlossaryPage` in that
repo's shape, reusing anything already there.

**Note what changed and why:**

| | |
| --- | --- |
| `{ page }` → `{ user }` | that repo's rule 19: never write a login, use the `user` fixture |
| hardcoded `edc.qa.securiti.xyz` → `openGlossary()` | environment resolution belongs in the page object, not the spec |
| inline locators → `GlossaryPage` | that repo requires page objects with grouped locators |
| `expect` → `Expect` via `assertTermVisible` | that repo bans raw `expect` in specs |
| `data.step7/8/9` → one `termName` | steps 7–9 were one person typing; only the final value was intended |
| a random unique name | re-running the original would trip a duplicate-name validation |
| step 2 + step 3 → one `openGlossary()` | the same navigation recorded twice |
| step 6 dropped | `fill()` focuses the field; the click added nothing |
| an assertion added | the recording had none — it created a term and never checked it existed |
| `'TODO rename: button Create'` → tagged title with an ID | that repo's naming convention |

**That is a long way from the emitted script, and that is the point.** The recording told you what the
user did. Your repo decides how a test says it.

Every mapping above was derived from *that* repo's rules. Derive yours from *this* one.
