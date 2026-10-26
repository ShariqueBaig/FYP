/**
 * Locator Inspector Overlay \u2014 v1.0  ("self-improving multi-frame QA agent")
 * ============================================================================
 * Zero-dependency vanilla JS, injected via bookmarklet or console paste. No
 * extension, works in locked-down/managed browsers. NOTHING leaves the browser.
 *
 * v4 adds, on top of the v3 1-of-1 accessibility-first locator engine + flakiness
 * predictor:
 *   \u2022 MULTI-FRAME: lights up every same-origin iframe module (satellite mode),
 *     coordinated through a window.top registry; emits page.frameLocator() chains;
 *     detects + honestly reports cross-origin frames.
 *   \u2022 LEARNER: a per-origin, IndexedDB-backed knowledge base that statistically
 *     infers THIS app's conventions (its test-hook attribute, hashed-class & id
 *     patterns, routes) and ADAPTS the engine \u2014 so it keeps working on unseen
 *     elements. (Heuristic/statistical \u2014 not cloud AI/ML.)
 *   \u2022 DRIFT: fingerprints each route and reports "what changed since last visit"
 *     across sprints.
 *   \u2022 ACTION RECORDER: watches clicks/typing/navigation across frames and emits a
 *     runnable Playwright test.
 *   \u2022 NETWORK WATCH (metadata-only): correlates error banners with the API/GraphQL
 *     call that triggered them. No request/response bodies are stored.
 *   \u2022 PASSIVE SCANNER: quiet requestIdleCallback coverage crawl.
 *
 * The whole tool is a self-contained named function `boot(mode)` so it can be
 * re-eval'd into same-origin frames as a "satellite". mode: "top" | "satellite".
 */
(function () {
  "use strict";
  const NS = "__locatorInspector";

  const boot = function boot(mode) {
    "use strict";
    const NS = "__locatorInspector";
    const VERSION = "v1.0";
    const BUILD_STAMP = "__BUILD_STAMP__"; // replaced by build-bookmarklet.js at build time -- lets a stale dragged bookmark be told apart from a fresh one
    // Real Securiti brand icon (media.securiti.ai/wp-content/uploads/2024/05/securiti-512-*.png),
    // downscaled to 64x64 and inlined as a data: URI -- avoids a runtime network fetch that
    // a strict host CSP could block, and renders regardless of connectivity.
    const LOGO_DATA_URI = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAAXNSR0IArs4c6QAAAERlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAQKADAAQAAAABAAAAQAAAAABGUUKwAAANxklEQVR4Ae1be2wcxRmfmb29O5vaSUsTEvuc2LGdxiSCEjuggqA1TYEGaIzaGscQIioBUv9AqKhqVVCbSlStKtqi0qqkoUJFJXYsHkkgadIQCE/xcKBB5EFsx8ZxDA7PAPH5bndn+vvmbGfvbnfvfLapgIx18ty8vsd8r/lmjrFT5RQHvtAc4PlSX3lfbzQZ5XWcyWrBeYnk6oRQqndElBx4p3n2J/muM5XjYh1HiqR06jiXNSBkBlNqWHDVJ8LGvr6rqj7MB1ZOBszp6JplSuNGJfjVTMk6HgqHGBcMwJiykpJx1g1AOyUzNlm86IXpZgYRzZW1DICbOGeXKCW/JkIR4ESkaJxQ5b2obmbK/suRltqeIEYEMiDW3v1dJkJ3cTOykDkWU46tCR9fEEC5MBgLmWBGgvoOoWWbkmyzZRW9PHTdnBPjYydR0UQ7VoMy2JVM8hWMqzN5OMoZ8MnCCTvCDINho0B/4hiz7dsHVtWs9wPvy4Dytq7VIhT+OyiMKjvpN9/VDtIBWDMjqZlxkHOxlTG5xRjmL/VdXzXiGpyzSirnRNUyFeKXM6kuZ4wv5uGID9E+yxkkGJw2Z+3Aqtpfe43yZED5xr5GIfhWxVgRcXnixc2MESzDXodIbpdcbi4uUZ3dK2rBoexS+STszFuyQYSM70HdLsOIJf47nT3fswXqysEIZY/cMNBSe2/mmCwG1Pyrq3QkJJ7jZngJdDxz/MS/k5oAAUZIJDUzXlNK7eKK7QFnhmhBDJkDRBrwfTm+YKf9xHvi4PUMgi/le8K2zu2/ZuFh9yroSS9xQ7SKSNESlYindxT6jYylbTFGH8gjmHE2fYAQG5MuzSCBnRrV6SmDPYYz1uXR4tOlkjej6ZaxZvoPc+4qHR0GdqNVI+dqnrLqKDOIQG00pYOdcXRdtxGTMGZaSkqam2Y+0jvTvX4aA8pYfTk6z1Kw+J+3oiRsmRDziuNyiZu2NAYwR8UgpqXTtgtuyJ92HYIF10gmsdINOo0BMFdFcHvwG9Mkhm7I/6+6Ac/mKmkMAOkfQScRZGU5B9eUz3CVbBBjx90UpDEgIXk/rNB7OtR1j5qOOjHZ/ZkOGO41AQuRoR1STre7OY0Bx1oXHAOL9vBQlnd0zymsDgQ4QmYegZaZkZS1VyoJdaOPbtN9GDMdEsgFaFLskCOiB9wEZFKq4KkfBQYUhU1NIbNjhhmzEpayrL2IzZ/EifIVqVi/MPjHBEQ6qsRIJOZLoeoxupEJfhY3o6HR88XU4IFN5ba140hzRVqAk8kAADN3IGL7BGrwJYSjkwJOO43DyjBEr40ZfP3A7Ko9rJH7xdbPA1hb/bpO863Smcu4TN6AzWgB86KaEZPCBJuPkyvs+6bMZbKtnVI81n54Jw4e3y4YMIm7Jt7azWz184FVVS9mAs7ne1lb9/mGYfyOhcIXTkYaKNLERhxkIrx0IEMC0myARoojSmdqS8F6SMTTETmZ+CNTgysKJZ5wGVxV87xTFLlMJRN363AZaxdU6LjO2LZM4mktDxWAThpih7ASw6CkeEJqoIkPQaeTtx9tqflNQchmTBq8smwYTTfH2ns+gBH9Zfb5P2NC1lc6Diclslibs7rQkC0BaBzcX9UFlr1EVnsiRVt3J3HXVBHvhj3QUv0rGNG/ahjujlx1Ogk6ziGnONrpNdSTAWwtl+Dbo4idveZ4thFiMjHyrBLv/MJzwBQ0WtYnP4M6vKC9Sp7rkUuHYG4blaSsWb4Uwm9uhzeI52ULAAGiGQfbbh1oPj/NzWRBnETD0HVnn5DS+il0LJE3XhB/JeUWP7D+VkUpUb6x52lhRi7IlRhBAoOxkfj9R1pr1vgBymyf+8Dh+aZpVCBRgD/WP9hc3Z85xu97eXtPmwhHW7BBfkN0u1Zh2z6ghFnvZQBpkK8EgMNQA/4YI4seVMgy25YlmbonaNhYX6zt0Hmxjr5HoJp7pXKekYo/g+BnL9oerGjraRgbF/QfBu1vSLI4OaUAQKRS2/2IJxj+DKBeiQxvciRQ3Mg9SWm/fvTj455GhpYZK7H2rmuYGdkJHW4C8sjjo4c+jM9E2/dZyNhVvqGreWy83//IkPMi1OCAdo1+g5Ad1tZfOFnBj3tKIANq5r65Hyz8LzcCvAEYgB3ZzW5qCMyiVLT3LGPCXIcoo0SnvCglNsYB1HUbF6UiZK6f39Z1jhvJzHr3zbUJyN3TlGf0K5ShRhLkDefDjwI3JpABuxsbbVyI/Ify7L4F4TKOMq/49lMHokuMuQ27fJr24z6Dde7QDJc6TJAn8bdPek22JzBvQQcvJh4fvKmB4gjfEsgAmoXc/qvwoz4LkJhZhGm/zwDdXNbeE8N2NOYTWmuDy9nF8x/qmxO0piNYv2aY3yCSKiYDd5+m5maAI99N7ZrHhlCTko5jCH2q88MF7RWIKkuhTgFDRrtSB7AvS8uJBQ0WEjAVFiQj7FUo2crE215d7racDFAGeO0DI7UQOm0reIRBObY8iHdjZvsdGkcHkVmCarmnuOs698P8JPfkyJwM4A6fkzKCHgRQk+CGUKHSk0tm13D+h4rwDzA2uzOzhS5ekZUKCRNz/Au37RnaCPrkLykBAnCz/VdI9eRkAA7RsN5+wyCBdAnJnMogQAPNCwexW7vyieNxDCdh2dnbukDfGvmtC8iVgW6QLlqYWOo3f6zdjzLdTxeUnO7ogu4HoYP4yxHAcAgrv4PZyQ+DDljUh1j/fWGauU+SnDX46j9hT7dMUl1CNIwR6/U/kAFJ06mHmC0Kcl0p5qhv1Wzrwtb5l6MtC/Yyy74e94Lv80gxVAeulQwYfVCnNvS9C5u6pv8H8/f5r8QYXZczxS/S120+AzXOwB2POgKlIJABUKOV8N2IKDz0fxRwCpC5aOQ4+4YPLuPNOCtsYpbTiF1+AA50COtSNARzrd5myeT93LEaj7ZUPzY+wafCpXUhNqY2cGN0ojVsCGZf5bOMbva1SiQ6dtTpBAMWB/pbLEOHIZUYfhB38D8MAubuq9pw+AwpRLnFLOYk+cDQdTXH3P1B9Vhb1yZIzMp8DkPAfT8TQw1+p1RfBszb2H2B5KGnoEiBEqARJTsgRFLZ6lKkwHYHIT/ZvnkbDn9HmsY2nAWQ6POXzBQcUjEh8brl4oHW2qe8YPuqgFQip/iPL0iICCOsuPzDV/C+YLx9iiuVuNmVgt0JZudBPAGHrwiHcVQRK/1Q8WSANjJMXh5o/TNWpBAWZ/SlxYb4E1urPNfNmDKxr7i6txPqz3CTZ+XKT7gXJvVFuLSi7NFBWN7s4okoV3H4/hzWP3stegECjkd+VFHX+3u2dq3n2h7TcjeB+Aq17E7Yo9W59D5rMTrHiFCtiCeWZfWhwRNJqQwSf5Fbx7KX1A+qQuFbK+rW3Esimz1iYi3l/zxwekyeex8eX92S32OtzPWhBqYpkLTw9AZZDChb1wlRwasseq1RSIE90CJqhq93LL6rYmPXpYUsQ3NiG3tW8KLoEzxsrp7MxcioF1txxo63T8vEJcsLxDp6vwnT+QSsbBZzMifn+q7DZMcmX4+LFrYuwYaffad5ceCr0q/+42BJpMS8SDBxI3h5JcJdXtjOZ2BnGMiNOpcMXl39uLsnK6XCpWxikSKhMzTukQXUNeIwwTgDNKHeFJFFh5AZeg5LdcKavykc/hEti2e3M+BIK+FNGxANXoAnZTWMbqhhWKeEeMDQr0OS8SZU0xiQJgFkKfmJkU5hhOqm/p0QSKTM0lgai87ro2cMfagZTb7qtqCzBygopBAMZdtdCWNkqVsK0yQgFB+uw+mvVj8oKgRK4BzYBiIsjbgU/1M6WqDNCYR5shNnDJh8vgDPTxehdTxTlKbnymE1EJU8g4yTixdeo0guVzRX+OppM2FQcNo08Fq1yt2ezgCBtBWdzj6vhWjjPC0gSmMA/P5wIb7/M8MvkgJHpnmhNAbgFqUXVhejPodSAJoQn1hKhLrdG5bGgLjB98ENvakfOLhHTWv902H2aPrsoBnnb7jJSWPAB83Vx9H5MKNHTdNRsAuU9hp/KUa5Rt0WTrUhvzht0ke3W5w9kPm7hTQ3SDQ7Knk3T7DV8Nez0l1WgRwhAsn3kx/Gc3m4vH2IMXYKh73MuHwL0iZVMj5L8dDXkRBeDijngEF4bIA4YYoeT+uINDHchePq+kwqPOVv3obuNSoSuQ+BAxSngJdiGUQD6OtITGyXtrMlPFd09jX6/HoEp75y2bAEr8MuA+Ar4CDrkW0qotfrKWYUgEsq8IrjomXlYOuCnXkxgAZVbOi+TZnmHXpCWvCSucTod0+i+VYcw7aKEyB6gj+ZgTfi8x7qPlNJ81KlnCsgv+chpKbMad7MoDS8cpwTeLB148C1Czd4Ye4pAWMDyyEJIhT6La605yKlDWFANAUExksa0QnqxE6rf+PndI+J2cYe350eXyD/StmDvYuErZYD4ZXQ5XOBEzJPxAxElySlhBZRo3EifYcM2RbuNa2fIFe52w9SIANoUhVeclgh/mMQdhWTrFrnCWgWruWgy/R2YD+ufrfj65aiY/ardHXtB2yq2mMd3TVcGcuBAUlGPTZlFvCg+3BcB4r3wYzXwJG2BI+3ueN+L/g5GTA2iY6p0Wi4Dj9dmw/qi+hlOS47emawkTf2NS+egh8XjUGa2P8zHu6eHbFZhXSMEsyM47xx9Oi1tQMTW+XU6FMc+MJy4H+3y8oPiOpetgAAAABJRU5ErkJggg==";
    const IS_TOP = mode === "top";
    const win = window;
    // A "Record in X instead" tap opens a brand-new, cross-origin, noopener tab --
    // no JS handle, no shared storage, nothing survives that channel except the URL
    // itself. This marker rides in the query string so the fresh tab can auto-start
    // recording the instant the bookmarklet is clicked there (still one manual click:
    // a bookmarklet cannot self-inject into a tab it has no handle to -- that would
    // require a browser extension, not a JS trick). Stripped below before anything
    // records this page, so it never bakes into an exported page.goto().
    const RESUME_PARAM = "__li_resume";
    // The steps recorded so far on the OLD tab ride along as JSON in a second query
    // param -- the URL is genuinely the only channel available (still noopener; see
    // above). Capped at HANDOFF_MAX_URL_LEN: past that, the tab-opener side drops the
    // payload and falls back to the old "paste it in by hand" note instead of quietly
    // truncating a recording (a truncated script is worse than an honest limitation).
    const HANDOFF_PARAM = "__li_handoff";
    // Conservative even for modern Chrome/Firefox; keeps Safari's tighter address-bar
    // limit safe too. A real handoff (a handful of clicks/fills before hitting an
    // iframe wall) sits at a few hundred bytes -- this only bites on unusually long
    // pre-handoff recordings.
    const HANDOFF_MAX_URL_LEN = 6000;
    let autoResume = false;
    let carriedActions = null;
    if (IS_TOP) {
      try {
        const u0 = new URL(location.href);
        if (u0.searchParams.get(RESUME_PARAM) === "1") {
          autoResume = true;
          const raw = u0.searchParams.get(HANDOFF_PARAM);
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed)) carriedActions = parsed;
            } catch {} // malformed payload -- resume with no carried steps rather than fail boot
          }
          u0.searchParams.delete(RESUME_PARAM);
          u0.searchParams.delete(HANDOFF_PARAM);
          history.replaceState(null, "", u0.toString());
        }
      } catch {}
    }

    // Idempotency: never double-init a given window.
    if (win[NS] && win[NS].active) {
      if (IS_TOP) win[NS].destroy();
      return;
    }

    // ==========================================================================
    // Shared cross-frame registry (lives on the top window; same-origin realms
    // can access each other's objects directly).
    // ==========================================================================
    let TOP = win;
    try {
      if (win.top && win.top.document) TOP = win.top;
    } catch {
      TOP = win; // cross-origin top \u2192 we are our own island (degraded, still works)
    }
    const REG_KEY = NS + "_registry";
    if (!TOP[REG_KEY]) {
      // Defined non-enumerable so page scripts can't discover it by walking
      // window.top's keys. (Data it holds is already redacted/masked \u2014 no tokens,
      // passwords, or full URLs \u2014 so even a direct read yields nothing sensitive.)
      Object.defineProperty(TOP, REG_KEY, {
        value: {
          frames: new Map(), // frameId -> { win, mode, destroy }
          nextId: 0,
          recording: false,
          exportStyle: "generic", // "generic" | "company" \u2014 which recorder template tab is showing
          actions: [], // recorder timeline (cross-frame) \u2014 sensitive values masked
          redoStack: [], // popped-by-undo actions, replayable by redo until the next new action
          network: [], // metadata-only request log \u2014 URLs redacted
          feed: [], // transient captures (cross-frame)
          samples: [], // learner convention samples
          coverage: new Map(), // css -> {seen,strategy,stability}
          tracked: new Map(), // flakiness registry (cross-frame)
          // Doctor's "Needs checkup" list is scoped to locators you actually RELIED on
          // (copied, or used in a recording) -- not everything merely hovered in
          // Inspect. Both sets hold `css` keys into `tracked`, session-only (no
          // storage), reset for free on reload/close since `registry` itself is
          // just an in-memory object. deliberateCopy persists all session; deliberateRecord
          // is scoped to the CURRENT recording and cleared when a new one starts.
          deliberateCopy: new Set(),
          deliberateRecord: new Set(),
          dismissedCheckups: new Set(), // css hidden from the checkup list this session (not deleted from tracked)
          appModel: null, // learned conventions
          drift: null, // last drift report
          onUpdate: null, // top registers a render fn; any window may call it
        },
        enumerable: false,
        configurable: true,
        writable: true,
      });
    }
    const registry = TOP[REG_KEY];
    function notify(kind) {
      try {
        if (registry.onUpdate) registry.onUpdate(kind);
      } catch {}
    }

    // ==========================================================================
    // Config
    // ==========================================================================
    const STORAGE_KEY = "locatorInspectorStats:" + location.hostname;
    const MAX_LOG_ENTRIES = 60;
    const MAX_TRACKED_LOCATORS = 120;
    const HOVER_CACHE_MS = 3000;
    const SEMANTIC_SCAN_BUDGET = 4000;

    const INTERACTIVE_SELECTOR =
      "button, a[href], input, select, textarea, [role='button'], [role='link'], " +
      "[role='checkbox'], [role='radio'], [role='tab'], [role='menuitem'], " +
      "[role='switch'], [role='combobox'], [role='option'], [contenteditable='true'], " +
      "[onclick], label, summary";
    // PROFILE is declared further down, so the per-app additions are resolved lazily
    // rather than concatenated here -- a const cannot be read before its initialiser
    // (temporal dead zone), and doing so crashed boot with
    // "Cannot access 'PROFILE' before initialization".
    let _interactiveSel = null;
    function interactiveSelector() {
      if (_interactiveSel) return _interactiveSel;
      _interactiveSel = INTERACTIVE_SELECTOR + (PROFILE.interactiveExtra ? ", " + PROFILE.interactiveExtra : "");
      return _interactiveSel;
    }
    const NAV_SELECTOR = "nav, [role='navigation'], header, [role='banner']";

    const TRANSIENT_ROLE_RE = /^(alert|alertdialog|status|log)$/i;
    const TRANSIENT_CLASS_RE =
      /toast|snackbar|banner|notif|alert(?!ing)|flash-message|popup-message|message-bar|ant-message|ant-notification/i;
    const TRANSIENT_ROLE_SELECTOR =
      "[role='alert'],[role='alertdialog'],[role='status'],[role='log']," +
      "[aria-live='polite'],[aria-live='assertive']," +
      "[class*='toast'],[class*='snackbar'],[class*='banner'],[class*='notif']," +
      "[class*='alert'],[class*='flash-message'],[class*='message-bar']," +
      ".ant-message-notice,.ant-notification-notice,.ant-alert";

    // ==========================================================================
    // Stats persistence (localStorage \u2014 nothing leaves the browser)
    // ==========================================================================
    function loadStats() {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { copies: 0, scans: 0, transientCaught: 0 };
      } catch {
        return { copies: 0, scans: 0, transientCaught: 0 };
      }
    }
    function saveStats(s) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
      } catch {}
    }
    let stats = loadStats();

    // ==========================================================================
    // Low-level DOM / CSS helpers
    // ==========================================================================
    const PANEL_ROOT_SELECTOR = "#" + NS + "-panel, #" + NS + "-tooltip, #" + NS + "-toast, #" + NS + "-flyin, ." + NS + "-flyin-spark";
    function isOwnNode(node) {
      return !!(node && node.closest && node.closest(PANEL_ROOT_SELECTOR));
    }
    function rootOf(el) {
      return (el.getRootNode && el.getRootNode()) || document;
    }
    function cssIdent(v) {
      if (window.CSS && CSS.escape) return CSS.escape(v);
      return String(v).replace(/[^\w-]/g, "\\$&");
    }
    function cssAttr(v) {
      return String(v).replace(/(["\\])/g, "\\$1").replace(/\n/g, "\\A ");
    }
    function tagOf(el) {
      return el instanceof SVGElement ? el.localName : el.tagName.toLowerCase();
    }
    function classListOf(el) {
      if (el.classList && el.classList.length) return Array.from(el.classList);
      if (typeof el.className === "string" && el.className.trim()) return el.className.trim().split(/\s+/);
      if (el.className && typeof el.className.baseVal === "string" && el.className.baseVal.trim())
        return el.className.baseVal.trim().split(/\s+/);
      return [];
    }
    function normText(el) {
      return (el.innerText || el.textContent || el.value || "").trim().replace(/\s+/g, " ");
    }
    // How Playwright's hasText / getByText SEE an element's text: normalized
    // textContent (whitespace collapsed), NOT innerText. innerText inserts layout
    // spaces between inline-block siblings (e.g. an avatar letter + a name render as
    // "A Abdul") that textContent does not ("AAbdul") \u2014 so a hasText pin built from
    // innerText can resolve to ZERO in Playwright. Contextual pins MUST use this.
    function pwText(el) {
      return (el.textContent || "").replace(/\s+/g, " ").trim();
    }
    // Icon FONTS (Material Icons, Ant's anticon, Font Awesome ligature sets) put the
    // glyph NAME into the DOM as real text, so textContent picks it up. On
    // qa.securiti.xyz that produced a row pin of
    //     hasText: 'check_box_outline_blankCompliance'
    // which matches, but is unreadable and breaks the day someone swaps the icon.
    // Text used to PIN a container is therefore taken with icon subtrees removed.
    const ICON_FONT_SEL = ".material-icons,.material-icons-outlined,.material-symbols-outlined,.anticon,.fa,.fas,.far,.fab,[class*='material-icons'],[class*='material-symbols'],[data-icon]";
    function isIconFontNode(n) {
      try { return !!(n.matches && n.matches(ICON_FONT_SEL)); } catch { return false; }
    }
    function pinText(el) {
      const parts = [];
      const walk = (n) => {
        if (n.nodeType === 3) { if (n.nodeValue) parts.push(n.nodeValue); return; }
        if (n.nodeType !== 1 || isOwnNode(n) || isIconFontNode(n)) return;
        if (n.getAttribute("aria-hidden") === "true") return; // decorative by declaration
        for (const c of n.childNodes) walk(c);
      };
      for (const c of el.childNodes) walk(c);
      // Joining with "" mashes sibling block elements together with zero
      // separation -- a real banner's heading+body+link+button text
      // came out as "Export CompletedYour file is ready...Click hereCLOSE", one unreadable
      // run-on string baked straight into an exported assertion. Joining with a space
      // instead (still collapsed by the regex below, so pre-existing whitespace/newlines
      // don't turn into doubled spaces) trades a small, harmless risk -- rare genuinely-
      // adjacent inline text gaining an unwanted space -- for fixing the far more common
      // and severe case. Safe for pinText's other callers too: they feed getByText()
      // hasText filters, which normalize whitespace and substring-match by default.
      const t = parts.join(" ").replace(/\s+/g, " ").trim();
      // If stripping icons left nothing, fall back to the raw text rather than emit "".
      return t || pwText(el);
    }
    // Wrap a handler so a bug in our code can never surface in the host page's
    // console or interrupt the app. Fail-safe: swallow, keep the app running.
    function guard(fn) {
      return function () {
        try {
          return fn.apply(this, arguments);
        } catch {
          /* protect the host page */
        }
      };
    }
    // Redact a URL before we ever store/show it: keep host + path (with id-like
    // segments masked) and ONLY the GraphQL operation name \u2014 drop everything
    // else in the query string. Prevents auth tokens / session ids / PII in
    // query params or path segments from landing in memory, the panel, or CSV.
    const SECRETISH_SEG_RE = /^[a-f0-9]{16,}$|^[0-9a-f]{8}-[0-9a-f]{4}-|eyJ[\w-]{10,}/i;
    function sanitizeUrl(u) {
      try {
        const url = new URL(String(u), location.href);
        const path = url.pathname
          .split("/")
          .map((seg) => (seg && SECRETISH_SEG_RE.test(seg) ? "\u2039id\u203A" : seg))
          .join("/");
        const op = url.searchParams.get("operationName") || url.searchParams.get("op");
        const tail = op ? "?operationName=" + encodeURIComponent(op).slice(0, 60) : url.search ? "?\u2039query redacted\u203A" : "";
        return (url.host + path + tail).slice(0, 300);
      } catch {
        return String(u).replace(/\?[\s\S]*$/, "?\u2039query redacted\u203A").slice(0, 300);
      }
    }
    // A form field we must never record the typed value of (passwords, cards,
    // OTPs, anything named like a secret).
    function isSensitiveField(el) {
      const t = (el.getAttribute("type") || "").toLowerCase();
      if (t === "password") return true;
      const ac = (el.getAttribute("autocomplete") || "").toLowerCase();
      if (/cc-|credit|card|cvc|cvv|password|current-password|new-password|one-time-code/.test(ac)) return true;
      const hint = ((el.getAttribute("name") || "") + " " + (el.id || "") + " " + (el.getAttribute("aria-label") || "")).toLowerCase();
      return /pass|pwd|secret|token|ssn|creditcard|\bcard\b|cvv|cvc|\bpin\b|otp|security|social/.test(hint);
    }

    // ==========================================================================
    // "Do not trust this identifier" heuristics (app-model-aware \u2014 see Learner)
    // ==========================================================================
    const GENERATED_ID_RE = new RegExp(
      [
        "^:r[0-9a-z]+:?$", "^\u00ABr", "^ext-gen\\d+$", "^ext-\\d+$", "^ui-id-\\d+$", "^mui-\\d+$",
        "^:[a-z0-9]+:$", "^[a-f0-9]{8}-[a-f0-9]{4}-", "^(radix|headlessui|reach|downshift|rc)[-_].*\\d",
        "^[a-zA-Z]+[-_]?\\d{4,}$", "^highcharts-", "^react-select-\\d", "^rc_select_",
      ].join("|"),
      "i"
    );
    const HASHED_CLASS_RE = new RegExp(
      [
        "^(css|sc|jsx|styled|emotion|makeStyles|jss|glamor)-[a-z0-9]{4,}$",
        "^[a-z]+[-_][A-Za-z]{5,}$", "^[a-z0-9]{7,}$", "^_[a-z0-9]{5,}$",
        "^[a-zA-Z0-9]+__[a-zA-Z0-9]+___[a-zA-Z0-9]{4,}$",
      ].join("|"),
      "i"
    );
    const UTILITY_CLASS_RE =
      /^(col|row|btn|nav|d|m[trblxy]?|p[trblxy]?|w|h|text|bg|border|rounded|flex|grid|gap|justify|items|align|order|float|container|form|input|table|card|badge|alert|modal|dropdown|list|active|disabled|hidden|show|open|selected|error|success|warning|primary|secondary|sr-only)([-_].*)?$/i;

    // DataHub / Securiti EDC keys everything by a globally-unique, stable URN
    // (urn:li:dataset:(\u2026), urn:li:glossaryTerm:\u2026, urn:li:corpuser:\u2026). When an
    // element or its row carries one, it's the deepest, most durable 1-of-1
    // anchor there is \u2014 far better than a positional path or a hashed class.
    // =========================================================================
    // APP PROFILES - facts established by an actual recon of the target app
    // measured directly against a real recon of the target app, not guessed and not
    // statistically inferred. This is what replaced the "convention learner": on the
    // real app that learner reported testAttr=null (0% coverage), hashedPrefixes=[]
    // and idGenPrefixes containing only rc_select_/v-step-, both of which the static
    // GENERATED_ID_RE already covers. It measured nothing usable.
    //
    //   qa.securiti.xyz        Vue + Vuetify 2, hash router. 69 interactive elements,
    //                          55% of them hidden behind menus/drawers. Class tokens:
    //                          45% v-*, 25% f-* (Securiti's OWN hand-authored semantic
    //                          prefix), 17% utility. Effectively no hashed classes.
    //                          ZERO test hooks. ZERO URNs. 51% carry aria-label and
    //                          0% are unnamed, so role/label locators are strong here.
    //   edc.qa.securiti.xyz    React + Ant Design + styled-components, history router,
    //                          CROSS-ORIGIN from the shell. 1116 interactive elements,
    //                          DOM depth median 12 / max 21. 72% of class tokens are
    //                          volatile styled-components output (36% readable
    //                          Cmp__Part-sc-hash-N plus 36% companion hash like
    //                          "jAnuhA"). Only 5 data-testid across 4183 elements.
    //                          1088 urn:li:* keys, ALL of them carried in href.
    // =========================================================================
    const APP_PROFILES = [
      {
        match: /(^|\.)securiti\.(xyz|ai|com)$/i,
        name: "Securiti.ai",
        // Hand-authored, semantic, and stable. f- is Securiti's own; ant-/v- are the
        // two design systems in play. Everything else on this app is either volatile
        // or a layout utility.
        trustedClassPrefixes: [/^f-/, /^ant-/, /^v-/],
        // Attributes the app writes for its OWN plumbing. They look like perfect
        // anchors (short, stable-valued) and attrFragments would happily use them:
        // data-link-interceptor-attached alone sits on 1096 EDC elements, data-icon on
        // 184. Anchoring on any of them produces a locator that means nothing.
        noiseAttrs: [/^data-link-interceptor/i, /^data-icon$/i, /^data-booted$/i, /^data-app$/i,
                     /^data-styled/i, /^data-html2canvas/i, /^data-ub-/i, /^data-beamer/i, /^data-v-/i],
        // href FIRST: every single URN on this app lives in href, not in a data-*.
        urnAttrOrder: ["href", "data-testid", "data-row-key", "data-urn", "data-entity-urn", "id"],
        // The EDC module is LinkedIn DataHub (webpackJsonpdatahub-react-web), and its
        // shipped bundle DOES define test hooks -- 144 of them, mined with
        // mining the shipped bundle offline. An earlier live sweep reported "0% coverage" because it
        // only visited the catalog and glossary landing routes; these ids live on the
        // modals, dropdowns, filter panels and search bar. Knowing the real denominator
        // turns the Learn tab from a guess into a coverage map: which hooks exist, and
        // which ones this session has actually seen rendered.
        knownTestIds: ["add-link-button", "add-link-modal-add-button", "add-link-modal-label", "add-link-modal-url", "add-owners-button", "add-policy-button", "add-query-button", "add-tag-term-from-modal-btn", "add-term-button", "add-term-group-button", "analytics-search-input", "auto-complete-option", "clear-all-filters", "column-lineage-toggle", "column-toggle", "compress-lineage-toggle", "container", "create-domain-button", "create-domain-description", "create-domain-id", "create-domain-name", "create-glossary-entity-modal-name", "create-ingestion-source-button", "create-secret-button", "csv-modal-download-button", "delete-button", "delete-ownership-type", "description-editor-save-button", "description-modal-update-button", "divider", "domain-list-item", "edit-documentation-button", "edit-ownership-type", "edit-text-done-btn", "edit-text-input", "embedded-search-bar", "empty-lineage", "entity-header-dropdown", "entity-header-test-id", "entity-menu-delete-button", "entity-menu-move-button", "entity-paths-modal", "filter-dropdown", "glossary-browser-sidebar", "glossary-entity-modal-create-button", "glossary-entity-modal-move-button", "groups", "ingestion-schedule-next-button", "ingestion-source-save-button", "ingestion-source-table-edit-button", "lineage-entity-item", "lineage-tab-direction-select", "lineage-tab-direction-select-option-downstream", "lineage-tab-direction-select-option-upstream", "metadata", "more-filters-dropdown", "move-domain-modal", "move-domain-modal-move-button", "move-glossary-entity-modal", "none", "ownership-builder-cancel", "ownership-builder-save", "ownership-type-description-input", "ownership-type-name-input", "platform", "platform-divider", "platform-logo", "policy-description", "policy-name", "policy-type", "privileges", "query-builder-cancel-button", "query-builder-description-input", "query-builder-modal", "query-builder-save-button", "query-builder-title-input", "query-modal", "query-modal-close-button", "query-modal-query", "recipe-builder-form-button", "recipe-builder-next-button", "recipe-builder-yaml-button", "recommendation-container-id", "related-nodes-dropdown", "related-terms-dropdown", "right-arrow", "schema-raw-view", "search-bar", "search-filters-v2", "search-input", "search-query-input", "secret-modal-create-button", "secret-modal-description-input", "secret-modal-name-input", "secret-modal-value-input", "sentinelEnd", "sentinelStart", "source-name-input", "table-stats-rowcount", "tag-term-modal-input", "tag-term-option", "three-dot-menu", "update-filters", "users", "view-builder-cancel", "view-builder-form", "view-builder-save", "view-description-input", "view-dropdown-delete", "view-dropdown-edit", "view-dropdown-remove-user-default", "view-dropdown-set-global-default", "view-dropdown-set-user-default", "view-modal", "view-name-input", "view-select", "view-select-clear", "view-select-create", "view-select-item", "views-table-dropdown"],
        // Clickable elements this app builds WITHOUT href, role or aria-label. The whole
        // App Launcher -- i.e. every product module: Cookie Consent Management, Data
        // Breach Management, Assessment Automation, ... -- is
        //     div[role=listitem] > a.v-list__tile--link > div > div.v-list__tile__title
        // an <a> with no href at all. Without these, findInteractiveRoot climbs past the
        // anchor and hands back the inner title <div>: the click still bubbles, but the
        // locator names the wrong element and an engineer reading it cannot tell it is a
        // navigation link.
        interactiveExtra: "a.v-list__tile--link,.v-list__tile--link,[role=listitem] > a,.v-menu__activator > a,.v-list__tile[tabindex]",
        // Origins that NORMALLY run embedded as a cross-origin iframe inside the shell,
        // but which an engineer will often open standalone in their own tab -- because a
        // bookmarklet cannot reach into a cross-origin frame, so that is the only way to
        // inspect inside the module by hand.
        //
        // The trap this exists to close: viewed standalone, window === window.top, so
        // boundaryInfo() finds no frame and the emitted locator has no frameLocator()
        // prefix. Measured on the same element, both ways:
        //   embedded   page.frameLocator('iframe[src*="..."]').getByTestId('x')
        //   standalone page.getByTestId('x')
        // Paste the second into a test that starts at the shell and it matches nothing.
        // Neither string is wrong -- which one you need depends on where YOUR test
        // navigates -- so both are emitted and labelled rather than one being guessed.
        embeddedModules: [{ host: /^edc\./i, parentHost: "qa.securiti.xyz", label: "EDC / Data Catalog module" }],
        knownTestIdPrefixes: ["active-filter-", "adv-search-add-filter-", "auto-complete-entity-name-", "avatar-tag-", "compact-entity-link-", "dropdown-menu-", "edge-", "entity-type-browse-card-", "expand-facet-", "facet-", "filter-dropdown-", "filter-option-", "legacy-browse-path-", "more-filter-", "node-", "query-content-", "query-delete-button-", "query-edit-button-", "query-more-button-", "quick-filter-", "remove-filter-", "schema-field-", "stats-", "tag-"],
      },
      {
        match: /.*/, name: "generic",
        trustedClassPrefixes: [],
        noiseAttrs: [/^data-(react|reactid|server|ssr|emotion|styled)/i],
        urnAttrOrder: ["data-testid", "data-row-key", "data-urn", "data-entity-urn", "href", "id"],
      },
    ];
    const PROFILE = (function () {
      for (const p of APP_PROFILES) if (p.match.test(location.hostname)) return p;
      return APP_PROFILES[APP_PROFILES.length - 1];
    })();
    function isNoiseAttr(name) {
      for (const re of PROFILE.noiseAttrs) if (re.test(name)) return true;
      return false;
    }
    // Which of the app's KNOWN test hooks have actually been seen rendered? The bundle
    // says what exists; only the DOM says what shipped to this route.
    const seenTestIds = new Set();
    function knownTestIdTotal() {
      return (PROFILE.knownTestIds || []).length + (PROFILE.knownTestIdPrefixes || []).length;
    }
    function noteTestIdSeen(el) {
      try {
        const v = el.getAttribute && el.getAttribute("data-testid");
        if (!v) return;
        if ((PROFILE.knownTestIds || []).indexOf(v) >= 0) { seenTestIds.add(v); return; }
        for (const p of PROFILE.knownTestIdPrefixes || []) if (v.indexOf(p) === 0) { seenTestIds.add(p); return; }
        seenTestIds.add(v);   // a hook the bundle did not list -- still worth counting
      } catch {}
    }
    function isTrustedClass(cls) {
      for (const re of PROFILE.trustedClassPrefixes) if (re.test(cls)) return true;
      return false;
    }
    // Cache-busting query strings make an href single-use. The shell appends
    // ?t=<epoch> to its nav hrefs, so 25 of 113 locators in the first real-app sweep
    // were already dead on the next page load, e.g.
    //     a[href="#/data-catalog/glossary?t=1785408154604"]
    // Keep the durable part and anchor with a prefix match instead of refusing.
    const VOLATILE_QUERY_RE = /[?&](t|_|ts|cb|v|rand|nonce)=\d{6,}/i;
    function stableHref(v) {
      if (!v) return null;
      if (!VOLATILE_QUERY_RE.test(v)) return { value: v, exact: true };
      const base = v.split("?")[0];
      return base ? { value: base, exact: false } : null;
    }
    const URN_RE = /urn:li:[a-zA-Z]+:/;
    function isUrn(v) { return !!v && URN_RE.test(v); }
    function appModel() {
      return registry.appModel || null;
    }
    // Deliberately does NOT consult the learner any more. On the real app the
    // statistical pass inferred only "rc_select_" and "v-step-", both of which
    // GENERATED_ID_RE already matches -- so its influence was zero at best and a
    // source of false blacklisting at worst. Identity rules are now deterministic
    // (static patterns + the app PROFILE); statistics are kept for REPORTING only.
    function isGeneratedId(id) {
      return GENERATED_ID_RE.test(id);
    }
    function isHashedClass(cls) {
      if (UTILITY_CLASS_RE.test(cls)) return false;
      // The app's own trusted design-system prefixes are hand-authored, never hashed.
      // Checked before the hash patterns so f-gap-12 / v-step-0 can never be rejected.
      if (isTrustedClass(cls)) return false;
      if (HASHED_CLASS_RE.test(cls)) return true;
      // prefix + an alphanumeric hash that MIXES letters and digits: "zz-1a2b3c",
      // "app-4f9a1b". This used to be caught only by a learner-inferred prefix, so
      // making identity rules deterministic would otherwise have LOST the detection.
      // Deliberately narrow: the suffix must contain both a letter and a digit and no
      // further separator, so utility names (mt-3, col-md-6) and semantic ones
      // (step-2, f-gap-12) do not match.
      if (/^[a-z]{1,8}[-_][a-z0-9]{4,}$/i.test(cls)) {
        const suf = cls.split(/[-_]/)[1];
        if (/\d/.test(suf) && /[a-z]/i.test(suf)) return true;
      }
      // styled-components (React) \u2014 the readable "Cmp__Part-sc-<hash>-N" class AND
      // its short companion className (e.g. fbosbo / jAnuhA / eXpxso). Confirmed on
      // the live DataHub EDC. These change whenever styles are edited \u2192 never stable.
      if (/[-_]sc[-_][a-z0-9]{4,}/i.test(cls)) return true;
      if (cls.length <= 8 && !/[-_]/.test(cls) && /[a-z][A-Z]/.test(cls)) return true; // short internal-caps hash
      // No learner-derived prefixes here either: it reported hashedPrefixes=[] on the
      // real app, and a wrongly-inferred prefix silently blacklists good classes.
      return false;
    }
    // Transient STATE classes (checked/active/selected/open/disabled/focused/hover/\u2026)
    // flip as the user interacts, so a locator anchored on them silently breaks. Never
    // use them as anchors. Matches both BEM-ish (\u2026-checked) and stateful (is-active).
    const STATE_CLASS_RE = /(^|[-_])(checked|active|selected|disabled|open|opened|closed|focused|focus|hover|hovered|pressed|expanded|collapsed|loading|error|success|warning|invalid|valid|dirty|touched|dragging|current|highlighted)($|[-_])/i;
    function stableClasses(el) {
      const list = classListOf(el).filter((c) => c && !c.startsWith(NS) && !STATE_CLASS_RE.test(c));
      // If the element is styled-components-generated, its short companion hash
      // (all-lowercase, e.g. "fbosbo") won't match a pattern \u2014 so once we see any
      // styled-components class, keep ONLY genuinely-semantic classes (utility or
      // known design-system prefixes ant-/f-), dropping the opaque companion hash.
      const styled = list.some((c) => /[-_]sc[-_][a-z0-9]{4,}/i.test(c));
      return list.filter((c) => {
        if (isHashedClass(c)) return false;
        // Once styled-components is in play, keep only genuinely-authored classes:
        // layout utilities, the app's own trusted design-system prefixes (f-/ant-/v-
        // on Securiti), or a plainly semantic kebab-case name. Everything else is the
        // opaque companion hash.
        if (styled && !(UTILITY_CLASS_RE.test(c) || isTrustedClass(c) || /^[a-z]+-[a-z-]+$/.test(c))) return false;
        return true;
      });
    }
    function stableId(el) {
      return el.id && !isGeneratedId(el.id) ? el.id : null;
    }
    // Test-hook attributes: the built-in set, plus any the Learner discovered.
    function testidAttrs() {
      // Static list only. The learner's job was to DISCOVER this app's test-hook
      // attribute; the recon established there isn't one (0% coverage across 4183
      // elements), so an inferred value here could only ever be a false positive.
      return ["data-testid", "data-test", "data-qa", "data-cy", "data-test-id"];
    }

    // ==========================================================================
    // Accessibility: role + accessible name (pragmatic ARIA subset)
    // ==========================================================================
    const INPUT_TEXTBOX_TYPES = new Set(["text", "email", "tel", "url", "password", "search", "number", "", null, undefined]);
    function implicitRole(el) {
      const tag = tagOf(el);
      switch (tag) {
        case "a": return el.hasAttribute("href") ? "link" : null;
        case "button": case "summary": return "button";
        case "nav": return "navigation";
        case "main": return "main";
        case "header": return "banner";
        case "footer": return "contentinfo";
        case "aside": return "complementary";
        case "h1": case "h2": case "h3": case "h4": case "h5": case "h6": return "heading";
        case "img": return el.getAttribute("alt") === "" ? null : "img";
        case "select": return el.multiple ? "listbox" : "combobox";
        case "textarea": return "textbox";
        case "ul": case "ol": return "list";
        case "li": return "listitem";
        case "table": return "table";
        case "article": return "article";
        case "dialog": return "dialog";
        case "section": return (el.getAttribute("aria-label") || el.getAttribute("aria-labelledby")) ? "region" : null;
        case "form": return (el.getAttribute("aria-label") || el.getAttribute("aria-labelledby")) ? "form" : null;
        case "search": return "search";
        case "input": {
          const t = (el.getAttribute("type") || "text").toLowerCase();
          if (["button", "submit", "reset", "image"].includes(t)) return "button";
          if (t === "checkbox") return "checkbox";
          if (t === "radio") return "radio";
          if (t === "range") return "slider";
          if (t === "search") return "searchbox";
          if (INPUT_TEXTBOX_TYPES.has(t)) return "textbox";
          return null;
        }
        default: return null;
      }
    }
    function roleOf(el) {
      const explicit = el.getAttribute && el.getAttribute("role");
      if (explicit) return explicit.trim().split(/\s+/)[0];
      return implicitRole(el);
    }
    function textFromIds(el, idref) {
      const root = rootOf(el);
      return idref.split(/\s+/).map((id) => {
        const node = root.getElementById ? root.getElementById(id) : document.getElementById(id);
        return node ? normText(node) : "";
      }).filter(Boolean).join(" ").trim();
    }
    function associatedLabelText(el) {
      const root = rootOf(el);
      if (el.id && root.querySelector) {
        const lbl = root.querySelector(`label[for="${cssAttr(el.id)}"]`);
        if (lbl) return normText(lbl);
      }
      const wrapping = el.closest && el.closest("label");
      if (wrapping) return normText(wrapping);
      return "";
    }
    // ARIA "name from content", faithful to Playwright's accessible-name build:
    // descendant text + img[alt] + nested [aria-label]; skips hidden/own nodes.
    function nameFromContents(el) {
      const parts = [];
      const walk = (node) => {
        if (node.nodeType === 3) { if (node.nodeValue) parts.push(node.nodeValue); return; }
        if (node.nodeType !== 1 || isOwnNode(node)) return;
        if (node.getAttribute("aria-hidden") === "true" || node.hasAttribute("hidden")) return;
        const al = node.getAttribute("aria-label");
        if (al && al.trim()) { parts.push(al.trim()); return; }
        if (tagOf(node) === "img") { const alt = node.getAttribute("alt"); if (alt) parts.push(alt); return; }
        if (tagOf(node) === "svg") { const t = node.querySelector && node.querySelector("title"); if (t && t.textContent) parts.push(t.textContent); return; }
        for (const c of node.childNodes) walk(c);
      };
      for (const c of el.childNodes) walk(c);
      return parts.join(" ").replace(/\s+/g, " ").trim();
    }
    function accessibleName(el) {
      const labelledby = el.getAttribute && el.getAttribute("aria-labelledby");
      if (labelledby) {
        const t = textFromIds(el, labelledby);
        if (t) return t;
      }
      const ariaLabel = el.getAttribute && el.getAttribute("aria-label");
      if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();
      const tag = tagOf(el);
      if (tag === "img") {
        const alt = el.getAttribute("alt");
        if (alt) return alt.trim();
      }
      if (tag === "input" || tag === "textarea" || tag === "select") {
        const lt = associatedLabelText(el);
        if (lt) return lt;
        const ph = el.getAttribute("placeholder");
        if (ph && ph.trim()) return ph.trim();
        const title = el.getAttribute("title");
        if (title && title.trim()) return title.trim();
        return "";
      }
      const t = nameFromContents(el) || normText(el);
      if (t) return t;
      const title = el.getAttribute && el.getAttribute("title");
      return title ? title.trim() : "";
    }

    // ==========================================================================
    // Uniqueness verification (root-aware; ignores our own overlay nodes)
    // ==========================================================================
    function matchesUniquely(sel, el, root) {
      root = root || rootOf(el);
      let nodes;
      try {
        nodes = root.querySelectorAll(sel);
      } catch {
        return false;
      }
      let match = null, count = 0;
      for (const n of nodes) {
        if (isOwnNode(n)) continue;
        count++;
        if (count > 1) return false;
        match = n;
      }
      return count === 1 && match === el;
    }
    function countMatches(sel, root) {
      try {
        let c = 0;
        for (const n of root.querySelectorAll(sel)) if (!isOwnNode(n)) c++;
        return c;
      } catch {
        return -1;
      }
    }
    // --------------------------------------------------------------------------
    // THREE different "how many does this match?" questions, all of which the
    // engineer acts on, and which DISAGREE in the presence of Shadow DOM:
    //
    //   matchesUniquely / countMatches  scoped to el.getRootNode()   (engine's own)
    //   countMatchesDeep                document + EVERY open shadow root --- this
    //                                   is what Playwright's CSS and role engines
    //                                   actually see, because they pierce shadow
    //   countInDocument                 plain document.querySelectorAll in THIS
    //                                   realm only. Kept for diagnostics; it is
    //                                   NOT what Ctrl+F reports (see below).
    //
    // Measured against real Playwright on two instances of the same open-shadow
    // component:
    //   button.inner-del  ->  document.querySelectorAll 0 | shadow-scoped 1 | Playwright 2
    // Claiming "1 of 1" off the shadow-scoped number alone is a lie in both
    // directions, so every emitted locator is now checked against the engine that
    // will actually run it.
    //
    // WHAT Ctrl+F IN THE ELEMENTS PANEL ACTUALLY DOES  (measured, not assumed --
    // driving the actual CDP command DevTools uses, DOM.performSearch, and
    // comparing it to Playwright and to querySelectorAll):
    //
    //   - it DOES cross open shadow boundaries      shadow button: Ctrl+F 2, qSA 0
    //   - it DOES search inside iframes, INCLUDING  in-frame button: Ctrl+F 2, qSA 0
    //     cross-origin ones
    //   - it ALSO substring-matches the query       button.ant-btn-primary: Ctrl+F 3
    //     against text and attributes and unions    for 1 real element, because the
    //     that in, so a selector whose literal      string also sat in page copy
    //     characters appear as page COPY inflates
    //     the count. Bracketed attribute selectors
    //     are immune (the whole query, brackets and
    //     quotes included, has to appear verbatim).
    //
    // So the honest basis for a "Ctrl+F -> 1 of 1" promise is countMatchesDeep,
    // NOT countInDocument -- the earlier code refused to make the promise for any
    // shadow element and handed over a console chain instead, which is strictly
    // worse than the plain CSS whenever the component is instantiated once.
    // --------------------------------------------------------------------------
    // TWO walkers, because Playwright and DevTools disagree about frames and merging
    // them corrupts one or the other:
    //
    //   crossFrames = false   this document + every open shadow root. This is PLAYWRIGHT's
    //                         scope: page.locator() is FRAME-SCOPED and does not search
    //                         inside iframes at all -- reaching one requires
    //                         frameLocator(). Uniqueness verification must use this.
    //   crossFrames = true    the above PLUS every same-origin iframe document,
    //                         recursively. This is Ctrl+F's scope, which does enter
    //                         frames. Only the DevTools figure may use this.
    //
    // Measured directly: selector `span` matched 19 in this document
    // and 22 under Ctrl+F, the difference being a child frame. Counting frames for
    // uniqueness would have wrongly rejected locators that are perfectly unique in the
    // frame Playwright will actually run in.
    function eachRootDeep(fn, crossFrames) {
      const seen = new Set();
      const visit = (root) => {
        if (!root || seen.has(root)) return;
        seen.add(root);
        fn(root);
        let all;
        try { all = root.querySelectorAll("*"); } catch { return; }
        for (const n of all) {
          if (n.shadowRoot) visit(n.shadowRoot);
          if (crossFrames && n.tagName === "IFRAME") {
            let d = null;
            try { d = n.contentDocument; } catch { d = null; }   // cross-origin: null
            if (d) visit(d);
          }
        }
      };
      visit(document);
    }
    // Playwright's scope: this frame + open shadow roots, our own nodes excluded.
    function countMatchesDeep(sel) {
      let c = 0;
      eachRootDeep((root) => { try { for (const n of root.querySelectorAll(sel)) if (!isOwnNode(n)) c++; } catch {} }, false);
      return c;
    }
    // Ctrl+F's scope: also crosses into same-origin frames, and counts our injected
    // panel/tooltip nodes because DevTools cannot tell them apart from the app.
    function countMatchesForDevtools(sel) {
      let c = 0;
      eachRootDeep((root) => { try { c += root.querySelectorAll(sel).length; } catch {} }, true);
      return c;
    }
    // How many frames does Ctrl+F reach that this realm cannot count? A bookmarklet
    // only gets a satellite into SAME-ORIGIN frames, and on this app the frames are
    // EDC plus vendor widgets -- nearly all cross-origin. Rather than pretend, the
    // count is reported as a lower bound with the shortfall named.
    function unreachableFrameCount() {
      try {
        const here = win.frames ? win.frames.length : 0;
        if (!here) return 0;
        let reachable = 0;
        registry.frames.forEach((f) => { try { if (f.win !== win && f.win.parent === win) reachable++; } catch {} });
        return Math.max(0, here - reachable);
      } catch { return 0; }
    }
    // Ctrl+F unions a plain-text substring search over the whole query string, so
    // page copy containing the selector verbatim adds phantom hits. Measured: only
    // the INNERMOST element owning the text is counted, same rule as getByText, so
    // ancestors do not each add a hit. Bracketed/quoted queries are immune, because
    // the entire query -- punctuation included -- would have to appear as copy.
    function copyCollisionHits(sel) {
      try {
        if (/[[\]'"()>]/.test(sel)) return 0;
        const body = document.body;
        if (!body || (body.innerText || "").indexOf(sel) === -1) return 0;
        let hits = 0;
        for (const n of body.querySelectorAll("*")) {
          if (isOwnNode(n)) continue;
          const t = n.textContent || "";
          if (t.indexOf(sel) === -1) continue;
          let inner = false;
          for (const c of n.children) if ((c.textContent || "").indexOf(sel) !== -1) { inner = true; break; }
          if (!inner) hits++;
        }
        return hits;
      } catch { return 0; }
    }
    function countInDocument(sel) {
      try { return document.querySelectorAll(sel).length; } catch { return -1; }
    }
    function inShadow(el) {
      try { return !!(el.getRootNode && el.getRootNode() instanceof ShadowRoot); } catch { return false; }
    }
    // Ctrl+F in the Elements panel cannot cross a shadow boundary at all, so for a
    // shadow element we hand over the CONSOLE chain instead --- the thing an engineer
    // can actually paste to get the one node back.
    function devtoolsShadowChain(el, leafCss) {
      const hops = [];
      let node = el, guard = 0;
      while (guard++ < 20) {
        const root = node.getRootNode ? node.getRootNode() : null;
        if (!(root instanceof ShadowRoot)) break;
        const host = root.host;
        hops.unshift(stableAnchor(host) || nthOfTypePart(host));
        node = host;
      }
      if (!hops.length) return null;
      let code = "document";
      for (const h of hops) code += `.querySelector('${h}').shadowRoot`;
      return code + `.querySelector('${leafCss}')`;
    }
    // A verified 1-of-1 Playwright prefix for the shadow HOST chain. Only needed when
    // the same component is instantiated more than once. The prefix must itself be
    // verified 1-of-1 --- hostDescriptor()-style strings like "div.widget" are not.
    function shadowHostPrefix(el, base) {
      const hops = [];
      let node = el, guard = 0;
      while (guard++ < 20) {
        const root = node.getRootNode ? node.getRootNode() : null;
        if (!(root instanceof ShadowRoot)) break;
        const host = root.host;
        const anchor = stableAnchor(host);
        if (!anchor || !matchesUniquely(anchor, host, host.getRootNode ? host.getRootNode() : document)) return null;
        hops.unshift(anchor);
        node = host;
      }
      return hops.length ? base + hops.map((h) => `.locator(${q(h)})`).join("") : null;
    }
    function textUnique(el, t) {
      const root = rootOf(el);
      const tag = tagOf(el);
      let match = null, count = 0;
      const list = root.getElementsByTagName ? root.getElementsByTagName(tag) : root.querySelectorAll(tag);
      for (const n of list) {
        if (isOwnNode(n)) continue;
        if (normText(n) === t) {
          count++;
          if (count > 1) return false;
          match = n;
        }
      }
      return count === 1 && match === el;
    }
    // Playwright's getByText matches across ALL tags (not just the element's own
    // tag). Verify exact-text uniqueness page-wide so a "unique" getByText we emit
    // actually resolves to one node in a real Playwright run.
    // True when an element has this text but no DESCENDANT has the same text \u2014 i.e. it
    // is the innermost owner, which is the only kind of node Playwright's text engine
    // actually yields.
    function isInnermostTextOwner(n, t) {
      let kids;
      try { kids = n.querySelectorAll("*"); } catch { return true; }
      for (const c of kids) if (!isOwnNode(c) && pwText(c) === t) return false;
      return true;
    }
    function textUniquePageWide(el, t) {
      // Count the way Playwright's getByText(exact) counts: it DEDUPLICATES ancestors
      // and yields only the innermost element carrying the text. Measured in real
      // Chromium:
      //   <div><div><span>Wrapped Leaf Alpha</span></div></div>
      //        naive textContent scan -> 3        Playwright getByText exact -> 1 (the span)
      //   <tr><td>Golf Cell</td></tr>
      //        naive textContent scan -> 4        Playwright getByText exact -> 1 (the td)
      // Counting those ancestors made the engine declare "not page-wide unique" and
      // fall back to a CSS or positional selector, so table cells, labels and wrapped
      // leaves were being downgraded from a clean, readable getByText for no reason.
      const root = rootOf(el);
      const all = root.querySelectorAll ? root.querySelectorAll("*") : [];
      if (all.length > SEMANTIC_SCAN_BUDGET) return false;
      // If a descendant of the target carries the same text, Playwright resolves to
      // THAT node, not to the target -- so the target must not claim the locator.
      if (!isInnermostTextOwner(el, t)) return false;
      let match = null, count = 0;
      for (const n of all) {
        if (isOwnNode(n)) continue;
        if (pwText(n) !== t) continue;
        if (!isInnermostTextOwner(n, t)) continue;
        count++;
        if (count > 1) return false;
        match = n;
      }
      return count === 1 && match === el;
    }
    // --------------------------------------------------------------------------
    // ARIA HIDDENNESS \u2014 the single biggest source of locators that look perfect in
    // the tooltip and resolve to ZERO in a real Playwright run.
    //
    // Playwright's getByRole is backed by its ARIA implementation, so it only matches
    // elements that are IN the accessibility tree. Measured in real Chromium
    // for one element with a unique accessible name:
    //
    //   hidden by                     getByRole  getByLabel  getByPlaceholder  getByText
    //   display:none                      0          1              1              1
    //   visibility:hidden                 0          1              1              1
    //   aria-hidden="true"                0          1              1              1
    //   hidden attribute                  0          -              -              1
    //   opacity:0 / offscreen / sr-only   1          -              -              1
    //
    // So the rule applies to getByRole ONLY, and it cuts both ways:
    //   1. never EMIT getByRole for an aria-hidden element -- it resolves to 0. This
    //      is what made 51 of 89 locators fail on the real qa.securiti.xyz catalog
    //      page: buttons and checkboxes sitting in collapsed menus and unopened side
    //      panels, e.g. getByRole('button', { name: 'System Status' }) -> count 0.
    //   2. never COUNT aria-hidden elements when testing role+name uniqueness --
    //      Playwright does not. A visible button with an identical twin inside a
    //      collapsed menu is 1-of-1 to Playwright (measured: raw DOM 2, Playwright 1),
    //      and the old code downgraded it to a contextual or positional locator for
    //      no reason.
    // --------------------------------------------------------------------------
    function ariaHidden(el) {
      try {
        if (!el || el.nodeType !== 1) return false;
        // display:none / visibility:hidden, inherited from any ancestor.
        // checkVisibility() is the cheap native answer in Chrome/Island; where it is
        // missing (jsdom) fall back to an explicit computed-style walk. The fallback is
        // deliberately CONSERVATIVE -- it never uses offsetParent, because engines with
        // no layout report offsetParent === null for everything.
        if (typeof el.checkVisibility === "function") {
          if (!el.checkVisibility({ checkVisibilityCSS: true, contentVisibilityAuto: true })) return true;
        } else {
          const view = el.ownerDocument && el.ownerDocument.defaultView;
          if (view && view.getComputedStyle) {
            let n = el, g = 0;
            while (n && n.nodeType === 1 && g++ < 40) {
              const cs = view.getComputedStyle(n);
              if (cs && (cs.display === "none" || cs.visibility === "hidden" || cs.visibility === "collapse")) return true;
              n = n.parentElement;
            }
          }
        }
        // aria-hidden and [hidden] are inherited by the accessibility tree, and are
        // pure attribute reads, so walking ancestors for them costs nothing.
        let n = el, guard = 0;
        while (n && n.nodeType === 1 && guard++ < 60) {
          if (n.getAttribute("aria-hidden") === "true") return true;
          if (n.hasAttribute("hidden")) return true;
          n = n.parentElement || (n.getRootNode && n.getRootNode().host) || null;
        }
      } catch {}
      return false;
    }
    const ROLE_CANDIDATE_TAGS = {
      button: "button,[role=button],a,summary,input", link: "a,[role=link]",
      textbox: "input,textarea,[role=textbox],[contenteditable=true]", checkbox: "input,[role=checkbox]",
      radio: "input,[role=radio]", combobox: "select,[role=combobox],input",
      heading: "h1,h2,h3,h4,h5,h6,[role=heading]", tab: "[role=tab]", menuitem: "[role=menuitem]",
      option: "option,[role=option]", img: "img,[role=img]",
    };
    // Every way Playwright's getByLabel can arrive at an element, counted together.
    // Measured on qa.securiti.xyz: getByLabel('Compliance', { exact: true }) resolved
    // to 2 elements while this engine's old form-control-only scan reported 1, so the
    // tool showed a confident "1 of 1" for a locator that is ambiguous in a real run.
    // getByLabel also matches HIDDEN elements, so a duplicate
    // sitting in a closed drawer counts -- no visibility filtering here.
    function labelMatchCount(el, text) {
      const root = rootOf(el);
      let list;
      try { list = root.querySelectorAll("input,textarea,select,[aria-label],[aria-labelledby],[contenteditable='true']"); } catch { return -1; }
      let c = 0, match = null;
      for (const n of list) {
        if (isOwnNode(n)) continue;
        let name = "";
        const lb = n.getAttribute("aria-labelledby");
        if (lb) name = textFromIds(n, lb);
        if (!name) name = (n.getAttribute("aria-label") || "").trim();
        if (!name) {
          const t = tagOf(n);
          if (t === "input" || t === "textarea" || t === "select") name = associatedLabelText(n);
        }
        if (name === text) { c++; match = n; }
      }
      return c === 1 && match === el ? 1 : c;
    }
    function labelUnique(el, text) {
      return labelMatchCount(el, text) === 1;
    }
    function roleNameUnique(el, role, name) {
      // An aria-hidden element is not in Playwright's accessibility tree, so no
      // getByRole can ever match it. Refuse rather than emit a count-0 locator.
      if (ariaHidden(el)) return false;
      const root = rootOf(el);
      const total = root.querySelectorAll ? root.querySelectorAll("*").length : 0;
      if (total > SEMANTIC_SCAN_BUDGET && !ROLE_CANDIDATE_TAGS[role]) return false;
      const scope = ROLE_CANDIDATE_TAGS[role] || "*";
      let match = null, count = 0, list;
      try {
        list = root.querySelectorAll(scope);
      } catch {
        return false;
      }
      for (const n of list) {
        if (isOwnNode(n)) continue;
        if (roleOf(n) === role && accessibleName(n) === name) {
          // Count the way Playwright counts: a hidden twin in a collapsed menu is
          // invisible to getByRole, so it must not spoil this element's uniqueness.
          if (n !== el && ariaHidden(n)) continue;
          count++;
          if (count > 1) return false;
          match = n;
        }
      }
      return count === 1 && match === el;
    }

    // ==========================================================================
    // CSS candidate generation + escalation (verified 1-of-1 backbone)
    // ==========================================================================
    const TEXT_OK_ROLES = new Set(["button", "link", "heading", "menuitem", "tab", "option"]);
    // ARIA roles whose accessible NAME is computed FROM DESCENDANT CONTENT. Playwright's
    // getByRole(role,{name}) only matches by name for these \u2014 for other roles (listitem,
    // article, region, group, list, table, ...) a name-from-contents string resolves to
    // ZERO in Playwright's engine, so we must NOT emit getByRole+name for them unless the
    // element carries an EXPLICIT accessible name (aria-label/labelledby/title/<label>).
    const NAME_FROM_CONTENT_ROLES = new Set([
      "button", "cell", "checkbox", "columnheader", "gridcell", "heading", "link",
      "menuitem", "menuitemcheckbox", "menuitemradio", "option", "radio", "row",
      "rowheader", "switch", "tab", "tooltip", "treeitem",
    ]);
    function hasExplicitName(el) {
      if (!el || !el.getAttribute) return false;
      // Only STRONG, Playwright-honored name sources (title is NOT reliable for
      // non-content roles like listitem/article, so it is deliberately excluded).
      if (el.getAttribute("aria-label") || el.getAttribute("aria-labelledby")) return true;
      const t = tagOf(el);
      if (t === "input" || t === "textarea" || t === "select") return !!associatedLabelText(el);
      if (t === "img" || t === "area") return !!el.getAttribute("alt");
      return false;
    }
    // Safe to emit getByRole(role,{name}) \u2014 Playwright's engine will actually match it.
    function roleNameMatchable(el, role) {
      return !!role && (NAME_FROM_CONTENT_ROLES.has(role) || hasExplicitName(el));
    }
    // Best URN-bearing attribute on an element (DataHub's deep, global 1-of-1 key).
    function urnAttr(el) {
      if (!el || !el.getAttribute) return null;
      // Order comes from the app profile. On Securiti every URN is in href, so href
      // is checked first here instead of last.
      const prefer = PROFILE.urnAttrOrder;
      for (const a of prefer) { const v = el.getAttribute(a); if (isUrn(v)) return { name: a, value: v }; }
      const learned = appModel();
      if (learned && learned.urnAttr) { const v = el.getAttribute(learned.urnAttr); if (isUrn(v)) return { name: learned.urnAttr, value: v }; }
      for (const attr of el.attributes || []) if (isUrn(attr.value)) return { name: attr.name, value: attr.value };
      return null;
    }
    // A verified 1-of-1 CSS selector pinned on the URN (exact, else attr-contains).
    function urnSelector(el) {
      const u = urnAttr(el);
      if (!u) return null;
      const exact = `[${u.name}="${cssAttr(u.value)}"]`;
      if (matchesUniquely(exact, el)) return { sel: exact, urn: u.value, attr: u.name };
      const contains = `${tagOf(el)}[${u.name}*="${cssAttr(u.value)}"]`;
      if (matchesUniquely(contains, el)) return { sel: contains, urn: u.value, attr: u.name };
      return null;
    }
    // Distinctive, stable ATTRIBUTE fragments of an element (e.g. [value="classic"],
    // [placeholder="Search"]). These are the building blocks for both single-attribute
    // anchors AND the adaptive combination search. Ordered by durability (lower penalty
    // = more human-meaningful / change-resistant). Deliberately broad \u2014 value, name,
    // placeholder, href, alt, for, title, type, role, aria-*, and any non-noise data-*
    // \u2014 so the engine anchors on MEANING, not DOM position, for every kind of element.
    function attrFragments(el) {
      const frags = [];
      const seen = new Set();
      const add = (sel, penalty, kind) => { if (sel && !seen.has(sel)) { seen.add(sel); frags.push({ sel, penalty, kind }); } };
      const A = (n) => el.getAttribute(n);
      const ariaLabel = A("aria-label"); if (ariaLabel) add(`[aria-label="${cssAttr(ariaLabel)}"]`, 1, "aria-label");
      const val = A("value"); if (val != null && val !== "" && val.length <= 64) add(`[value="${cssAttr(val)}"]`, 1, "value");
      const name = A("name"); if (name) add(`[name="${cssAttr(name)}"]`, 1, "name");
      const ph = A("placeholder"); if (ph && ph.length <= 80) add(`[placeholder="${cssAttr(ph)}"]`, 2, "placeholder");
      const href = A("href");
      if (href && href.length <= 160 && href !== "#") {
        const h = stableHref(href);
        // A cache-busted href is only valid for this page load, so anchor on the
        // durable prefix rather than the full, expiring value.
        if (h) add(h.exact ? `[href="${cssAttr(h.value)}"]` : `[href^="${cssAttr(h.value)}"]`, 2, "href");
      }
      const alt = A("alt"); if (alt && alt.length <= 80) add(`[alt="${cssAttr(alt)}"]`, 2, "alt");
      const forId = A("for"); if (forId) add(`[for="${cssAttr(forId)}"]`, 2, "for");
      for (const attr of el.attributes || []) {
        if (!attr.name.startsWith("data-")) continue;
        if (testidAttrs().includes(attr.name) || attr.name === "data-row-key") continue;
        // App plumbing, not identity - see PROFILE.noiseAttrs.
        if (isNoiseAttr(attr.name)) continue;
        if (!attr.value || attr.value.length > 48) continue;
        add(`[${attr.name}="${cssAttr(attr.value)}"]`, 2, "data");
      }
      const title = A("title"); if (title && title.length <= 64) add(`[title="${cssAttr(title)}"]`, 3, "title");
      const role = A("role"); if (role) add(`[role="${cssAttr(role)}"]`, 3, "role");
      const type = A("type"); if (type) add(`[type="${cssAttr(type)}"]`, 4, "type");
      // A trusted, hand-authored class (f-page-header) is a far better anchor than an
      // incidental one, so it carries a lower penalty and gets tried earlier.
      for (const c of stableClasses(el)) add(`.${cssIdent(c)}`, isTrustedClass(c) ? 2 : 4, "class");
      return frags;
    }
    function selfCandidates(el) {
      const cands = [];
      const tag = tagOf(el);
      const push = (sel, strategy, penalty) => { if (!cands.some((c) => c.sel === sel)) cands.push({ sel, strategy, penalty, css: true, test: (x) => matchesUniquely(sel, x) }); };
      // 1) Globally-unique, deep, durable anchors first (root-most + most stable).
      const urn = urnSelector(el);
      if (urn) push(urn.sel, "urn", 0);
      for (const attr of testidAttrs()) {
        const v = el.getAttribute(attr);
        if (v && !isUrn(v)) push(`[${attr}="${cssAttr(v)}"]`, attr, 0);
      }
      const rk = el.getAttribute("data-row-key");
      if (rk && !isUrn(rk)) push(`[data-row-key="${cssAttr(rk)}"]`, "row-key", 1);
      const sid = stableId(el);
      if (sid) push(`#${cssIdent(sid)}`, "id", 0);
      // 2) Single stable-attribute anchors, tag-scoped for precision + readability
      //    (e.g. input[value="classic"]) \u2014 the "literal best 1-of-1" a human expects.
      const frags = attrFragments(el);
      for (const f of frags) push(`${tag}${f.sel}`, f.kind, 1 + f.penalty);
      // 3) Stable class combo (all stable classes together) as a mid-tier anchor.
      const classes = stableClasses(el);
      if (classes.length > 1) push(tag + "." + classes.map(cssIdent).join("."), "class", 6);
      // 4) ADAPTIVE VIGILANCE \u2014 if nothing above is unique, the leaf is low-grade, so
      //    work HARDER before surrendering to a positional path: enumerate 2- and 3-
      //    attribute COMBINATIONS on the element itself (e.g. input[type="radio"]
      //    [value="classic"]) and keep the most durable unique one. Capped for perf.
      const usable = frags.slice(0, 8);
      for (let i = 0; i < usable.length; i++)
        for (let j = i + 1; j < usable.length; j++)
          push(`${tag}${usable[i].sel}${usable[j].sel}`, "attrs", 3 + usable[i].penalty + usable[j].penalty);
      for (let i = 0; i < Math.min(usable.length, 5); i++)
        for (let j = i + 1; j < Math.min(usable.length, 5); j++)
          for (let k = j + 1; k < Math.min(usable.length, 6); k++)
            push(`${tag}${usable[i].sel}${usable[j].sel}${usable[k].sel}`, "attrs", 5 + usable[i].penalty + usable[j].penalty + usable[k].penalty);
      // 4b) :has() DESCENDANT anchoring \u2014 for a WRAPPER that has no anchor of its own
      //     (e.g. an Ant radio <label> whose only class is shared) but CONTAINS a
      //     distinctively-anchored child (input[value="classic"]). Modern, robust, and
      //     supported by Chrome/Island + Playwright. Verified 1-of-1 like everything
      //     else (jsdom lacks :has, so it degrades gracefully there).
      const ownClass = classes.length ? "." + cssIdent(classes[0]) : "";
      let scanned = 0;
      for (const d of (el.querySelectorAll ? el.querySelectorAll("*") : [])) {
        if (scanned++ > 40) break;
        for (const f of attrFragments(d)) {
          if (!["value", "name", "aria-label", "placeholder", "href", "data", "for", "alt", "title"].includes(f.kind)) continue;
          push(`${tag}${ownClass}:has(${f.sel})`, "has", 5 + f.penalty);
          push(`${tag}:has(${f.sel})`, "has", 6 + f.penalty);
          break; // one strong descendant anchor per child is enough
        }
      }
      // 5) Bare tag \u2014 last resort before ancestor-scoping/positional in buildUniqueCss.
      push(tag, "tag", 8);
      // Try the most durable candidates first.
      cands.sort((a, b) => a.penalty - b.penalty);
      return cands;
    }
    function stableAnchor(el) {
      const urn = urnSelector(el);
      if (urn) return urn.sel;
      for (const attr of testidAttrs()) {
        const v = el.getAttribute(attr);
        if (v) return `[${attr}="${cssAttr(v)}"]`;
      }
      const rk = el.getAttribute && el.getAttribute("data-row-key");
      if (rk) return `[data-row-key="${cssAttr(rk)}"]`;
      const sid = stableId(el);
      if (sid) return `#${cssIdent(sid)}`;
      // Strong, human-meaningful attribute anchors \u2014 so a scoped/path locator pins on
      // e.g. li[aria-label="Monitored Data Systems"] instead of a brittle nth-of-type
      // chain. (Caller verifies uniqueness via matchesUniquely.)
      const al = el.getAttribute && el.getAttribute("aria-label");
      if (al && al.length <= 80) return `${tagOf(el)}[aria-label="${cssAttr(al)}"]`;
      const nm = el.getAttribute && el.getAttribute("name");
      if (nm && nm.length <= 80) return `${tagOf(el)}[name="${cssAttr(nm)}"]`;
      return null;
    }
    function nthOfTypePart(el) {
      const parent = el.parentElement;
      const tag = tagOf(el);
      if (!parent) return tag;
      const sibs = Array.prototype.filter.call(parent.children, (c) => tagOf(c) === tag);
      if (sibs.length === 1) return tag;
      return `${tag}:nth-of-type(${sibs.indexOf(el) + 1})`;
    }
    // Describe ONE hop of a path as richly as the markup allows. nthOfTypePart alone
    // throws away every class, which produced locators like
    //   body > div:nth-of-type(1) > div > div > div > div:nth-of-type(3) > div > span
    // on a Vuetify card -> .row-wrap -> .ant-select structure where `.row-wrap` and
    // `.ant-select-selection-item` were sitting right there unused. Same uniqueness,
    // far better description, and it survives someone inserting a wrapper <div>.
    //
    // :nth-of-type counts by TAG, so the index is always the index among same-tag
    // siblings; the classes only narrow WHICH element that index refers to.
    function pathPart(el) {
      const tag = tagOf(el);
      let base = tag;
      try {
        // stableClasses has already dropped hashed (css-1x2y3z, sc-\u2026) and transient
        // state (is-active, -checked) classes, so whatever survives is hand-authored and
        // worth showing. Design-system classes (f-/ant-/v-) go first because they are the
        // most durable, then any other authored class -- `div.row-wrap` beats a bare
        // `div` for both readability and surviving a wrapper insertion, even though
        // "row-wrap" carries no trusted prefix.
        const all = stableClasses(el);
        const cls = all.filter(isTrustedClass).concat(all.filter((c) => !isTrustedClass(c)));
        if (cls.length) base = tag + "." + cls.slice(0, 2).map(cssIdent).join(".");
      } catch {}
      const parent = el.parentElement;
      if (!parent) return base;
      const sibs = Array.prototype.filter.call(parent.children, (c) => tagOf(c) === tag);
      if (sibs.length === 1) return base;
      // Only add the index if the description is still ambiguous among those siblings.
      let sameDesc = 0;
      for (const s of sibs) { try { if (s.matches(base)) sameDesc++; } catch { sameDesc = sibs.length; break; } }
      if (sameDesc === 1) return base;
      return `${base}:nth-of-type(${sibs.indexOf(el) + 1})`;
    }
    function childPathFrom(ancestor, el) {
      const parts = [];
      let node = el;
      while (node && node !== ancestor && node.nodeType === 1) {
        parts.unshift(stableAnchor(node) || pathPart(node));
        node = node.parentElement;
      }
      return parts.join(" > ");
    }
    // Walk up until the accumulated selector is 1-of-1, and STOP THERE. The old version
    // only terminated on a globally-unique stableAnchor, so three identical `.row-wrap`
    // siblings meant walking all the way to <body> even though
    //   div.row-wrap:nth-of-type(3) > div > div > span.ant-select-selection-item
    // is already unique, shorter, and readable.
    //
    // Uniqueness is checked with countMatchesDeep -- Playwright's own scope (this frame
    // plus open shadow roots, NOT child frames) -- because this string is what goes into
    // page.locator(). Returns {locator, method} so the caller can distinguish a
    // class-anchored path from a bare tag chain.
    function positionalPath(el) {
      const parts = [];
      let node = el;
      let semantic = false;
      while (node && node.nodeType === 1 && node !== rootOf(el) && node.parentElement) {
        const anchor = stableAnchor(node);
        if (anchor && node !== el && matchesUniquely(anchor, node)) {
          parts.unshift(anchor);
          return { locator: parts.join(" > "), method: "scoped-path" };
        }
        const part = pathPart(node);
        if (part.indexOf(".") !== -1) semantic = true;
        parts.unshift(part);
        // Terminate early ONLY on a path that is both unique AND anchored. Uniqueness
        // alone is not enough: `div > span:nth-of-type(2)` was unique in a small fixture
        // and is a trap -- it is unique by coincidence and matches the day the app
        // renders another <div> containing spans anywhere on the page. Requiring the
        // LEFTMOST hop to carry a class or attribute means the path is rooted in
        // something the app actually named, so its uniqueness is structural rather than
        // accidental. Without an anchor we keep climbing.
        if (node !== el && /[.[]/.test(parts[0])) {
          const rel = parts.join(" > ");
          if (countMatchesDeep(rel) === 1 && matchesUniquely(rel, el)) {
            return { locator: rel, method: semantic ? "semantic-path" : "positional" };
          }
        }
        node = node.parentElement;
      }
      return { locator: parts.join(" > "), method: semantic ? "semantic-path" : "positional" };
    }
    function buildUniqueCss(el) {
      const cands = selfCandidates(el);
      for (const c of cands) if (c.test(el)) return { locator: c.sel, strategy: c.strategy, method: "direct", penalty: c.penalty };
      let anc = el.parentElement, guard = 0;
      while (anc && anc.nodeType === 1 && !isOwnNode(anc) && guard++ < 40) {
        const anchor = stableAnchor(anc);
        if (anchor && matchesUniquely(anchor, anc)) {
          for (const c of cands) {
            if (!c.css) continue;
            const scoped = anchor + " " + c.sel;
            if (matchesUniquely(scoped, el)) return { locator: scoped, strategy: c.strategy, method: "scoped", penalty: c.penalty + 2 };
          }
          const scopedPath = anchor + " > " + childPathFrom(anc, el);
          if (matchesUniquely(scopedPath, el)) return { locator: scopedPath, strategy: "positional", method: "scoped-path", penalty: 12 };
          break;
        }
        anc = anc.parentElement;
      }
      // positionalPath now returns its own method: "semantic-path" when it managed to
      // anchor on the app's real design-system classes, plain "positional" for a bare
      // tag chain. Both stay grade F -- a structural path is a structural path -- but the
      // engineer can see which kind they got, and the semantic one is far more readable
      // and survives wrapper insertions.
      const pp = positionalPath(el);
      return { locator: pp.locator, strategy: "positional", method: pp.method,
               penalty: pp.method === "semantic-path" ? 16 : 20 };
    }

    // ==========================================================================
    // Boundary detection (Shadow DOM / iframe) + frame chain
    // ==========================================================================
    function hostDescriptor(host) {
      if (!host) return "?";
      const t = tagOf(host);
      const id = stableId(host);
      if (id) return `${t}#${id}`;
      const nm = host.getAttribute && host.getAttribute("name");
      if (nm) return `${t}[name="${nm}"]`;
      const tid = host.getAttribute && host.getAttribute("data-testid");
      if (tid) return `${t}[data-testid="${tid}"]`;
      const cls = stableClasses(host)[0];
      return cls ? `${t}.${cls}` : t;
    }
    // For frameLocator: a stable CSS selector for a frame element.
    function frameSelector(frameEl) {
      if (!frameEl) return "iframe";
      if (frameEl.id && !isGeneratedId(frameEl.id)) return `iframe#${cssIdent(frameEl.id)}`;
      const nm = frameEl.getAttribute("name");
      if (nm) return `iframe[name="${cssAttr(nm)}"]`;
      const tid = frameEl.getAttribute("data-testid");
      if (tid) return `iframe[data-testid="${cssAttr(tid)}"]`;
      // src-based \u2014 critical for Securiti: the EDC module iframe has NO id/name,
      // and several 3rd-party iframes coexist, so nth-of-type is brittle. Pin by a
      // stable src fragment (host [+ first path segment]) if it's unique.
      const src = frameEl.getAttribute("src");
      if (src) {
        let frag = null;
        try { const u = new URL(src, location.href); frag = u.host + (u.pathname && u.pathname !== "/" ? u.pathname : ""); } catch { frag = src.split("?")[0]; }
        if (frag) {
          const host = (frag.split("/")[0]) || frag;
          // HOST FIRST, path only as a tie-breaker. Both are verified 1-of-1 before being
          // returned, so preferring the shorter one costs nothing and survives the app
          // changing which route the module iframe initially points at.
          for (const cand of [host, frag.length <= 60 ? frag : host]) {
            const sel = `iframe[src*="${cssAttr(cand)}"]`;
            try { if (matchesUniquely(sel, frameEl, frameEl.ownerDocument || document)) return sel; } catch {}
          }
        }
      }
      return nthOfTypePart(frameEl);
    }
    // When this satellite is running inside a frame whose PARENT is cross-origin, we
    // cannot read the parent's DOM to find our own <iframe> element -- but we can always
    // read our own location. Pin the frame by our own host, which is guaranteed to be
    // present in the iframe's src attribute.
    function selfFrameSelector() {
      try {
        const u = new URL(location.href);
        // Host alone is NOT enough when the same third party is embedded twice. Measured
        // on the real app: hCaptcha mounts TWO frames on newassets.hcaptcha.com, so
        //   page.frameLocator('iframe[src*="newassets.hcaptcha.com"]')
        // bound to whichever came first and every locator under it resolved to 0
        // (117 of 977 elements in the module tour). Those embeds distinguish their
        // instances in the URL fragment/query (#frame=checkbox vs #frame=challenge), so
        // append a short discriminator when one exists.
        //
        // Deliberately NOT adding the pathname: a frame that routes client-side (the EDC
        // module goes from / to /glossary) no longer matches its own src attribute, and
        // host-only is correct there. Hash/query survive because they come from src.
        // Keep only STABLE discriminators. hCaptcha's fragment is
        //   #frame=challenge&id=0bukzzuv1eg&host=js.securiti.ai
        // where id= is a fresh random token per session -- baking that in made the
        // selector match nothing at all (measured: 90 locators at count 0). Keep short
        // alphabetic values like frame=challenge; drop anything that looks generated.
        // The discriminator exists for VENDOR embeds that mount twice (hCaptcha ships a
        // checkbox frame and a challenge frame on one host). It must not be applied to the
        // app's OWN module.
        //
        // Measured on the live shell: the EDC iframe's src
        // attribute is exactly
        //     https://edc.qa.securiti.xyz/
        // with no hash and no query, and it never gains one -- the src attribute is set
        // once at mount, while the module writes #is_lineage_mode=false into its own
        // location AFTER loading. So reading our live hash and requiring it to appear in
        // that attribute produced [src*="is_lineage_mode=false"], matching ZERO iframes,
        // for anyone who had navigated inside the module. The app mounts its module once,
        // so it needs no discriminator at all.
        let ownModule = false;
        try {
          const mods = PROFILE.embeddedModules || [];
          for (const m of mods) if (m.host.test(location.hostname)) { ownModule = true; break; }
        } catch {}
        const raw = ownModule ? "" : (u.hash || u.search || "").replace(/^[#?]/, "");
        const stable = raw.split("&")
          .filter((kv) => /^[a-z_]+=[a-z][a-z0-9_-]{0,14}$/i.test(kv) && !/^(id|sid|token|nonce|ts|t|cb|r|rand)=/i.test(kv))
          .slice(0, 2).join("&");
        // Two SEPARATE substring conditions, never one concatenated string.
        //
        // Measured on the live shell: joining them produced
        //     iframe[src*="edc.qa.securiti.xyz#is_lineage_mode=false"]
        // which matched ZERO iframes, because the real src carries a path between the
        // host and the fragment (https://edc.qa.securiti.xyz/... #is_lineage_mode=false)
        // so that substring never occurs. Every shell-rooted locator the tool handed out
        // was therefore dead on arrival. As two conditions each one matches on its own and
        // whatever sits between them is irrelevant.
        return `iframe[src*="${cssAttr(u.host)}"]` + (stable ? `[src*="${cssAttr(stable)}"]` : "");
      } catch { return "iframe"; }
    }
    // Am I the TOP frame, but on an origin that normally runs embedded in the shell?
    // That is the standalone-module case: everything here is correct for this tab, and
    // wrong for a test that starts at the shell, because in the real app all of it sits
    // inside a cross-origin iframe. Returns the frame selector a shell-based test would
    // need, or null.
    function standaloneModuleInfo() {
      try {
        if (win !== win.top) return null;                 // embedded: boundaryInfo handles it
        const mods = PROFILE.embeddedModules;
        if (!mods || !mods.length) return null;
        for (const m of mods) {
          if (m.host.test(location.hostname)) {
            return { selector: selfFrameSelector(), parentHost: m.parentHost, label: m.label };
          }
        }
      } catch {}
      return null;
    }
    // Is this realm a THIRD-PARTY widget rather than the application under test? From
    // inside a cross-origin frame the top origin is unreadable, but the app profile
    // already knows which hostnames belong to the product, so anything else is a vendor
    // embed. On qa.securiti.xyz that is statuspage.io, hcaptcha.com, chargebee.com,
    // getbeamer.com, document360.io and userback.io -- 119 of 977 elements in the tour,
    // i.e. pure noise for someone writing tests against Securiti.
    function isThirdPartyRealm() {
      try {
        // Test against the APP profiles, never against the SELECTED one. For a vendor
        // host the selected profile is the generic fallback whose match is /.*/, so
        // `!PROFILE.match.test(host)` was always false and the flag never fired -- which
        // is why 71 hCaptcha/statuspage elements counted as failures of the app under
        // test while Securiti's own frame had none.
        for (const p of APP_PROFILES) {
          if (p.match.source === ".*") continue;          // the catch-all is not an app
          if (p.match.test(location.hostname)) return false;
        }
        return true;
      } catch { return false; }
    }
    function boundaryInfo(el) {
      const chain = [];
      let node = el, type = null, unpierceable = false, safety = 0, crossOriginHop = false;
      while (node && safety++ < 50) {
        const root = node.getRootNode ? node.getRootNode() : document;
        if (root instanceof ShadowRoot) {
          type = type || "shadow-open";
          chain.unshift({ kind: "shadow", host: hostDescriptor(root.host) });
          node = root.host;
          continue;
        }
        const w = root.defaultView;
        if (w && w !== w.top) {
          let frameEl = null;
          try {
            frameEl = w.frameElement;
          } catch {
            frameEl = null;
          }
          if (frameEl) {
            type = type || "iframe-same";
            chain.unshift({ kind: "iframe", host: hostDescriptor(frameEl), selector: frameSelector(frameEl) });
            node = frameEl;
            continue;
          } else {
            // The same-origin policy blocks a PAGE SCRIPT here (contentDocument is
            // null), and the old code therefore refused to emit any locator at all and
            // graded the element F. But this tool's output is consumed by PLAYWRIGHT,
            // which drives the browser over CDP and is not bound by the same-origin
            // policy. Verified against the real app: with the shell on qa.securiti.xyz and
            // the module on edc.qa.securiti.xyz,
            //     page.frameLocator('iframe[src*="edc.qa.securiti.xyz"]')
            //          .getByRole('button', { name: 'Add' })   ->  count 1, visible
            // The entire EDC Glossary UI lives in that frame, so refusing here meant
            // every element in the module the tool exists to test got grade F.
            // Emit a frameLocator pinned on our own host instead, and flag that the
            // chain stops at this hop (we cannot see any further ancestor).
            type = "iframe-cross";
            unpierceable = false;   // unpierceable by a page script; fine for Playwright
            crossOriginHop = true;
            chain.unshift({ kind: "iframe", host: "iframe " + location.host + " (cross-origin)", selector: selfFrameSelector(), crossOrigin: true });
            break;
          }
        }
        break;
      }
      const ownRoot = el.getRootNode ? el.getRootNode() : document;
      if (ownRoot instanceof ShadowRoot && ownRoot.mode === "closed") {
        type = "shadow-closed";
        unpierceable = true;
      }
      if (!chain.length) return null;
      return { type, chain, unpierceable, crossOriginHop };
    }

    // ==========================================================================
    // Contextual / relative locators \u2014 the standout for tables, lists & cards.
    // When an element isn't uniquely addressable on its own (identical "Delete"/
    // "Edit" buttons per row, repeated card actions), scope it under the nearest
    // meaningful container (row / listitem / named region / testid'd block) so
    // the chain resolves to exactly one node \u2014 verified against the live DOM.
    // ==========================================================================
    const NAMED_CONTAINER_ROLES = new Set([
      "region", "form", "dialog", "navigation", "main", "complementary",
      "search", "banner", "contentinfo", "article", "group", "tabpanel", "menu", "listbox",
    ]);
    // Landmark roles that are often unnamed but appear once per page \u2014 a clean,
    // re-render-proof scope for elements buried in div-soup (e.g. pagination in the
    // page's single <nav>). Scanned narrowly for perf (only landmark-ish tags).
    const UNIQUE_LANDMARK_ROLES = new Set([
      "navigation", "main", "banner", "contentinfo", "complementary", "search", "form", "region",
    ]);
    const LANDMARK_SCAN = "nav,main,header,footer,aside,form,section,[role=navigation],[role=main],[role=banner],[role=contentinfo],[role=complementary],[role=search],[role=form],[role=region]";
    // Is `node` the ONLY element in its document with this landmark role?
    function landmarkUniqueInDoc(node, role) {
      const root = rootOf(node);
      let count = 0, match = null, list;
      try { list = root.querySelectorAll(LANDMARK_SCAN); } catch { return false; }
      for (const n of list) {
        if (isOwnNode(n)) continue;
        if (roleOf(n) === role) { if (n !== node && ariaHidden(n)) continue; count++; if (count > 1) return false; match = n; }
      }
      return count === 1 && match === node;
    }
    // A semantic descriptor for an element that need only be unique *within a
    // container* (not page-wide). Returns {frag, kind, ...} or null.
    function leafDescriptor(el) {
      for (const attr of testidAttrs()) {
        const v = el.getAttribute(attr);
        if (v) return { kind: "testid", attr, val: v, frag: attr === "data-testid" ? `.getByTestId(${q(v)})` : `.locator(${q(`[${attr}="${cssAttr(v)}"]`)})` };
      }
      const role = roleOf(el), name = accessibleName(el);
      const tag = tagOf(el);
      const nativeInteractive = /^(button|a|input|select|textarea|summary|option)$/.test(tag);
      const al = el.getAttribute && el.getAttribute("aria-label");
      // Non-native aria-labelled icon element: getByLabel (Playwright prunes role=img/
      // icon spans from its a11y tree, so a getByRole leaf would resolve to 0).
      if (al && !nativeInteractive) return { kind: "label", text: al, frag: `.getByLabel(${q(al)}, { exact: true })` };
      // No icon exclusions here either: real Playwright DOES match getByRole on
      // icon-only buttons and role=img spans.
      // The aria-label branch above already claims the non-native cases it should.
      const roleEmittable = role && name && roleNameMatchable(el, role) && !ariaHidden(el);
      if (roleEmittable) return { kind: "role", role, name, frag: `.getByRole(${q(role)}, { name: ${q(name)}, exact: true })` };
      if (tag === "input" || tag === "textarea" || tag === "select") {
        const lt = associatedLabelText(el) || el.getAttribute("aria-label");
        if (lt) return { kind: "label", text: lt, frag: `.getByLabel(${q(lt)}, { exact: true })` };
        const ph = el.getAttribute("placeholder");
        if (ph) return { kind: "placeholder", text: ph, frag: `.getByPlaceholder(${q(ph)}, { exact: true })` };
      }
      if (TEXT_OK_ROLES.has(role)) {
        const t = normText(el);
        if (t && t.length <= 60) return { kind: "text", text: t, frag: `.getByText(${q(t)}, { exact: true })` };
      }
      return null;
    }
    // All elements inside `container` (excluding our own nodes) matching a descriptor.
    function matchesDescIn(desc, container) {
      const out = [];
      const add = (n) => { if (!isOwnNode(n)) out.push(n); };
      if (desc.kind === "testid") { for (const n of container.querySelectorAll(`[${desc.attr}="${cssAttr(desc.val)}"]`)) add(n); return out; }
      if (desc.kind === "role") {
        const scope = ROLE_CANDIDATE_TAGS[desc.role] || "*";
        // Same Playwright rule as roleNameUnique: aria-hidden siblings are not
        // candidates, so they must not make a contextual leaf look ambiguous.
        for (const n of container.querySelectorAll(scope)) if (!isOwnNode(n) && roleOf(n) === desc.role && accessibleName(n) === desc.name && !(n !== null && ariaHidden(n))) out.push(n);
        return out;
      }
      if (desc.kind === "label") { for (const n of container.querySelectorAll("input,textarea,select")) if (!isOwnNode(n) && ((associatedLabelText(n) || n.getAttribute("aria-label")) === desc.text)) out.push(n); return out; }
      if (desc.kind === "placeholder") { for (const n of container.querySelectorAll("[placeholder]")) if (!isOwnNode(n) && n.getAttribute("placeholder") === desc.text) out.push(n); return out; }
      if (desc.kind === "text") { for (const n of container.querySelectorAll("*")) if (!isOwnNode(n) && normText(n) === desc.text) out.push(n); return out; }
      return out;
    }
    function uniqueInContainer(desc, container, el) {
      const hits = matchesDescIn(desc, container);
      return hits.length === 1 && hits[0] === el;
    }
    // How to locate a candidate container element, as a Playwright fragment that
    // resolves to exactly that one container. Returns {frag, human} or null.
    function containerLocator(node) {
      const role = roleOf(node), name = accessibleName(node);
      // 0) a container/row carrying a URN or Ant Design data-row-key \u2014 deepest,
      //    most durable pin in DataHub (survives re-render, scroll, re-sort).
      const urn = urnSelector(node);
      if (urn) return { frag: `.locator(${q(urn.sel)})`, human: `[${urn.attr}=${urn.urn.length > 34 ? urn.urn.slice(0, 34) + "\u2026" : urn.urn}]`, strong: true };
      const rk = node.getAttribute && node.getAttribute("data-row-key");
      if (rk && matchesUniquely(`[data-row-key="${cssAttr(rk)}"]`, node))
        return { frag: `.locator(${q(`[data-row-key="${cssAttr(rk)}"]`)})`, human: `row [data-row-key=${rk}]`, strong: true };
      // 1) named landmark/region/dialog/etc. \u2014 cleanest, most stable.
      // Every role-based container fragment below resolves through Playwright's ARIA
      // engine, which cannot see an aria-hidden subtree. A container inside a closed
      // drawer therefore makes the WHOLE chain resolve to zero even when the leaf is
      // fine. Measured on qa.securiti.xyz:
      //   getByRole('listitem').filter({...}).getByLabel('Compliance')  ->  count 0
      // For those, fall through to the CSS container anchor at the bottom, which
      // matches hidden elements exactly like DevTools does.
      const roleContainerOk = !ariaHidden(node);
      if (roleContainerOk && role && NAMED_CONTAINER_ROLES.has(role) && name && roleNameUnique(node, role, name))
        return { frag: `.getByRole(${q(role)}, { name: ${q(name)}, exact: true })`, human: `${role} \u201C${name}\u201D` };
      // 1b) UNNAMED but globally-unique landmark (the page's single <nav>/<main>/<search>/
      //     <form>) \u2014 a clean, re-render-proof scope for leaves lost in div-soup.
      if (roleContainerOk && role && UNIQUE_LANDMARK_ROLES.has(role) && landmarkUniqueInDoc(node, role))
        return { frag: `.getByRole(${q(role)})`, human: `${role}` };
      // 2) a container carrying a test hook.
      for (const attr of testidAttrs()) {
        const v = node.getAttribute(attr);
        if (v && matchesUniquely(`[${attr}="${cssAttr(v)}"]`, node))
          return { frag: attr === "data-testid" ? `.getByTestId(${q(v)})` : `.locator(${q(`[${attr}="${cssAttr(v)}"]`)})`, human: `[${attr}=${v}]`, strong: true };
      }
      // 3) a table/grid ROW, pinned by a distinctive cell text (the classic case).
      if (roleContainerOk && (role === "row" || tagOf(node) === "tr")) {
        const disc = distinctiveRowText(node);
        if (disc) return { frag: `.getByRole('row').filter({ hasText: ${q(disc)} })`, human: `row containing \u201C${disc}\u201D` };
      }
      // 4) a LIST ITEM / option / card, pinned by distinctive contained text.
      if (roleContainerOk && (role === "listitem" || tagOf(node) === "li" || role === "option" || role === "article")) {
        const disc = distinctiveOwnText(node);
        const r = role === "article" ? "article" : (role === "option" ? "option" : "listitem");
        if (disc) return { frag: `.getByRole(${q(r)}).filter({ hasText: ${q(disc)} })`, human: `${r} containing \u201C${disc}\u201D` };
      }
      // 5) LAST RESORT: a verified 1-of-1 CSS anchor on the container. Unlike every
      //    role-based fragment above, a CSS locator matches hidden elements, so this is
      //    what keeps contextual scoping working inside collapsed panels and drawers.
      const anchor = stableAnchor(node);
      if (anchor && matchesUniquely(anchor, node)) return { frag: `.locator(${q(anchor)})`, human: anchor };
      const ccls = stableClasses(node);
      if (ccls.length) {
        const csel = tagOf(node) + "." + ccls.map(cssIdent).join(".");
        if (matchesUniquely(csel, node)) return { frag: `.locator(${q(csel)})`, human: csel };
      }
      return null;
    }
    // Pick the shortest cell text that makes THIS row unique among all rows.
    function distinctiveRowText(row) {
      const root = rootOf(row);
      const rows = Array.prototype.filter.call(root.querySelectorAll("tr,[role=row]"), (r) => !isOwnNode(r));
      const cells = Array.prototype.filter.call(row.querySelectorAll("td,th,[role=cell],[role=gridcell],[role=rowheader]"), (c) => c.parentElement && (c.parentElement === row || rowOf(c) === row));
      const texts = cells.map(pinText).filter((t) => t && t.length <= 50);
      texts.sort((a, b) => a.length - b.length);
      for (const t of texts) if (rows.filter((r) => pwText(r).includes(t)).length === 1) return t;
      const own = pinText(row);
      return own && own.length <= 80 && rows.filter((r) => pwText(r).includes(own)).length === 1 ? own : null;
    }
    function rowOf(cell) { const r = cell.closest && cell.closest("tr,[role=row]"); return r; }
    // Text of a node EXCLUDING its interactive controls' own labels \u2014 so a card's
    // pin-text is its title/content, not the "Download"/"Edit" button text (more
    // robust: the action label can change without breaking the row pin).
    function ownLabelText(node) {
      const parts = [];
      const isControl = (n) => /^(button|a|input|select|textarea|summary)$/.test(tagOf(n)) || (n.getAttribute && n.getAttribute("role") === "button");
      const walk = (n) => {
        if (n.nodeType === 3) { if (n.nodeValue) parts.push(n.nodeValue); return; }
        if (n.nodeType !== 1 || isOwnNode(n) || isControl(n) || isIconFontNode(n)) return;
        for (const c of n.childNodes) walk(c);
      };
      for (const c of node.childNodes) walk(c);
      // Join with "" to mirror textContent (Playwright hasText basis), then collapse.
      return parts.join("").replace(/\s+/g, " ").trim();
    }
    // Distinctive text of a list item / card, unique among its siblings of the same
    // role/tag. Prefers a clean label (heading \u2192 text-minus-controls \u2192 full text).
    function distinctiveOwnText(node) {
      const root = rootOf(node);
      const sel = roleOf(node) === "article" ? "[role=article],article" : (roleOf(node) === "option" ? "option,[role=option]" : "li,[role=listitem]");
      const peers = Array.prototype.filter.call(root.querySelectorAll(sel), (n) => !isOwnNode(n));
      const uniqueAmongPeers = (t) => t && t.length <= 60 && peers.filter((p) => pwText(p).includes(t)).length === 1;
      const h = node.querySelector && node.querySelector("h1,h2,h3,h4,h5,h6,strong,b,[role=heading]");
      if (h) { const t = pinText(h); if (uniqueAmongPeers(t)) return t; }
      const label = ownLabelText(node);
      if (uniqueAmongPeers(label)) return label;
      const own = pinText(node);
      if (own && own.length <= 80 && peers.filter((p) => pwText(p).includes(own)).length === 1) return own;
      return null;
    }
    // The main entry: build a verified contextual chain, or null.
    function contextualLocator(el, base) {
      const leaf = leafDescriptor(el);
      if (!leaf) return null;
      let node = el.parentElement, guard = 0;
      while (node && node.nodeType === 1 && !isOwnNode(node) && guard++ < 40) {
        const cont = containerLocator(node);
        if (cont && uniqueInContainer(leaf, node, el)) {
          return { code: `${base}${cont.frag}${leaf.frag}`, strategy: "contextual", unique: true, human: cont.human, leafKind: leaf.kind, strong: !!cont.strong };
        }
        node = node.parentElement;
      }
      return null;
    }

    // ==========================================================================
    // Playwright locator formatting (accessibility-first, frame-aware)
    // ==========================================================================
    // Quote a value as a JavaScript single-quoted string literal for the emitted code.
    // Escaping the quote and backslash is NOT enough: a real accessible name can carry
    // newlines and tabs. On qa.securiti.xyz the version tooltip's aria-label is
    // "UI Prod Version: 1.149.0-07rc, Build: ...\nCore Api Version: ...", and emitting
    // that raw produced `page.getByLabel('...<real newline>...')`, which is a
    // SyntaxError -- "Invalid or unexpected token" -- so the locator could not even be
    // parsed, let alone run. U+2028/U+2029 are line terminators in JS too.
    function q(s) {
      return "'" + String(s)
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'")
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r")
        .replace(/\t/g, "\\t")
        .replace(/\u2028/g, "\\u2028")
        .replace(/\u2029/g, "\\u2029") + "'";
    }
    // An accessible name that runs to hundreds of characters (a version banner, a
    // whole paragraph of help text) is a technically-valid but useless locator: any
    // copy change breaks it, and it is unreadable in a test. Refuse it as a semantic
    // anchor and let the CSS backbone take over.
    const MAX_SEMANTIC_NAME = 120;
    function nameUsable(n) {
      return !!n && n.length <= MAX_SEMANTIC_NAME;
    }
    function framePrefix(boundary) {
      // Build page.frameLocator('iframe#x')\u2026 prefix from the iframe hops (shadow
      // hops need no prefix \u2014 Playwright pierces open shadow automatically).
      if (!boundary) return "page";
      let code = "page";
      for (const hop of boundary.chain) {
        if (hop.kind === "iframe" && hop.selector) code += `.frameLocator(${q(hop.selector)})`;
      }
      return code;
    }
    function playwrightLocator(el, css, boundary) {
      const base0 = framePrefix(boundary);
      const out = playwrightLocatorIn(el, css, boundary, base0);
      // Open Shadow DOM: every uniqueness check above is scoped to el.getRootNode(),
      // but Playwright PIERCES open shadow roots and matches page-wide. When the same
      // web component is instantiated twice, an "inside my own root I am 1-of-1"
      // locator silently matches 2 in a real run. Re-derive it scoped under a verified
      // 1-of-1 shadow HOST so it resolves to the instance the user pointed at.
      if (!inShadow(el) || !out || !out.unique) return out;
      if (countMatchesDeep(css) === 1 && deepUniqueForStrategy(el, out.strategy)) return out;
      const scopedBase = shadowHostPrefix(el, base0);
      if (scopedBase) {
        const scoped = playwrightLocatorIn(el, css, boundary, scopedBase);
        if (scoped) { scoped.shadowScoped = true; return scoped; }
      }
      // No trustworthy host anchor: say so instead of claiming a false 1-of-1.
      return Object.assign({}, out, { unique: false, shadowAmbiguous: true });
    }
    // Does the chosen strategy still resolve to exactly one node once Playwright has
    // pierced every open shadow root on the page?
    function deepUniqueForStrategy(el, strategy) {
      if (strategy === "role") {
        const role = roleOf(el), name = accessibleName(el);
        let c = 0;
        eachRootDeep((root) => {
          let list;
          try { list = root.querySelectorAll(ROLE_CANDIDATE_TAGS[role] || "*"); } catch { return; }
          for (const n of list) if (!isOwnNode(n) && roleOf(n) === role && accessibleName(n) === name && !ariaHidden(n)) c++;
        });
        return c === 1;
      }
      if (strategy === "text") {
        const t = pwText(el);
        let c = 0;
        eachRootDeep((root) => {
          let l;
          try { l = root.querySelectorAll("*"); } catch { return; }
          // Same innermost-owner rule as textUniquePageWide -- Playwright's text engine
          // deduplicates ancestors, so counting them here would be wrong too.
          for (const n of l) if (!isOwnNode(n) && pwText(n) === t && isInnermostTextOwner(n, t)) c++;
        });
        return c === 1;
      }
      return true;
    }
    function playwrightLocatorIn(el, css, boundary, base) {
      const role = roleOf(el), name = accessibleName(el), tag = tagOf(el);
      // Only a CLOSED shadow root is genuinely unreachable. A cross-origin iframe is
      // reachable via page.frameLocator() (see boundaryInfo), so it no longer short
      // circuits here -- the normal strategy ladder runs and gets the frame prefix.
      if (boundary && boundary.unpierceable)
        return { code: `/* element is inside a CLOSED shadow root \u2014 no locator can reach it; ask for a component-level test hook */`, strategy: "unreachable", unique: false };
      // URN anchor first \u2014 DataHub's globally-unique, re-render-proof key.
      const urn = urnSelector(el);
      if (urn) {
        if (urn.attr === "data-testid" && urn.sel.startsWith("[data-testid=") && urn.sel.endsWith(`"]`) && !urn.sel.includes("*="))
          return { code: `${base}.getByTestId(${q(urn.urn)})`, strategy: "urn", unique: true };
        return { code: `${base}.locator(${q(urn.sel)})`, strategy: "urn", unique: true };
      }
      for (const attr of testidAttrs()) {
        const v = el.getAttribute(attr);
        if (v && !isUrn(v) && matchesUniquely(`[${attr}="${cssAttr(v)}"]`, el)) {
          if (attr === "data-testid") return { code: `${base}.getByTestId(${q(v)})`, strategy: "testid", unique: true };
          return { code: `${base}.locator(${q(`[${attr}="${cssAttr(v)}"]`)})`, strategy: "testid", unique: true };
        }
      }
      // NON-NATIVE aria-labelled element (span/div/i icon with role=img|button, etc.):
      // Playwright's accessibility tree prunes/misses many of these, so getByRole
      // resolves to ZERO. getByLabel matches the aria-label reliably \u2014 prefer it.
      // Guarded by page-wide aria-label uniqueness so it resolves to exactly this one.
      const nativeInteractive = /^(button|a|input|select|textarea|summary|option)$/.test(tag);
      const al = el.getAttribute && el.getAttribute("aria-label");
      // Prefer getByLabel for aria-labelled elements that getByRole matches unreliably:
      // non-native role elements, AND any native control whose aria-label DIFFERS from
      // its visible text (aria-label is the authoritative name, but Playwright's getByRole
      // sometimes computes the name from content instead \u2014 e.g. a sidebar link
      // <a aria-label="Go to Privacy Center"> whose visible text is just an icon "Go").
      // getByLabel resolves by the aria-label reliably. Guarded by aria-label uniqueness.
      if (al && nameUsable(al) && (!nativeInteractive || al !== normText(el)) && labelUnique(el, al))
        return { code: `${base}.getByLabel(${q(al)}, { exact: true })`, strategy: "label", unique: true };
      // getByRole comes BEFORE any icon fallback.
      //
      // The previous version excluded "icon-like" elements here, on the belief that
      // Playwright prunes decorative icons from its accessibility tree and so
      // getByRole would resolve to ZERO. Measured against real Playwright,
      // that belief is FALSE:
      //     getByRole('button', { name: 'ellipsis'     })  -> 1, and hits the BUTTON
      //     getByRole('img',    { name: 'ellipsis'     })  -> 1
      //     getByRole('button', { name: 'close-circle' })  -> 1
      // The exclusions were not merely redundant: for an icon-only button they made
      // the tool emit the ICON's getByLabel, which resolves to the inner <span> and
      // NOT to the clickable button the user pointed at. getByRole is both correct
      // and a higher grade, so it is tried first for every named role.
      const roleEmittable = role && roleNameMatchable(el, role);
      if (roleEmittable && nameUsable(name) && roleNameUnique(el, role, name))
        return { code: `${base}.getByRole(${q(role)}, { name: ${q(name)}, exact: true })`, strategy: "role", unique: true };
      // FALLBACK for an icon-only clickable whose role+name is NOT unique (a page with
      // several "ellipsis" menu buttons): pin the icon's own aria-label. The click
      // still lands on the button, because it bubbles.
      if (!al && normText(el) === "" && el.querySelector) {
        const icon = el.querySelector("[aria-label]");
        const il = icon && icon.getAttribute("aria-label");
        if (il && nameUsable(il) && labelUnique(icon, il))
          return { code: `${base}.getByLabel(${q(il)}, { exact: true })`, strategy: "label", unique: true };
      }
      if ((tag === "input" || tag === "textarea" || tag === "select") && name) {
        const lt = associatedLabelText(el) || el.getAttribute("aria-label");
        if (lt && lt === name && nameUsable(lt) && labelUnique(el, lt))
          return { code: `${base}.getByLabel(${q(lt)}, { exact: true })`, strategy: "label", unique: true };
        const ph = el.getAttribute("placeholder");
        if (ph && matchesUniquely(`${tag}[placeholder="${cssAttr(ph)}"]`, el, rootOf(el)))
          return { code: `${base}.getByPlaceholder(${q(ph)}, { exact: true })`, strategy: "placeholder", unique: true };
      }
      // Text anchor \u2014 for name-from-content roles AND (adaptive vigilance) any pure
      // TEXT-LEAF element (no element children) whose text is the page-wide-unique
      // owner. Lets plain <span>/<td>/<div> display text still get a robust,
      // human-readable getByText locator instead of a positional path.
      const textEligible = TEXT_OK_ROLES.has(role) || (el.children && el.children.length === 0);
      if (textEligible) {
        const t = pwText(el);
        if (t && t.length <= 80 && textUniquePageWide(el, t)) return { code: `${base}.getByText(${q(t)}, { exact: true })`, strategy: "text", unique: true };
      }
      // Not unique on its own \u2192 try a verified contextual/relative chain before CSS.
      const ctx = contextualLocator(el, base);
      if (ctx) return ctx;
      return { code: `${base}.locator(${q(css)})`, strategy: "css", unique: true };
    }

    // ==========================================================================
    // The main resolver
    // ==========================================================================
    // GRADING, written from the point of view of the person who has to ship the test.
    // The grade answers exactly one question: "can I put this locator in the suite?"
    // It is driven by verified FACTS -- does it really resolve to one node, is the
    // anchor something the app owns on purpose, can a script actually click it --
    // never by the name of the strategy alone.
    //
    //   A  SHIP IT            app-owned semantic anchor: data-testid / URN / role+name
    //                         / label, or a chain pinned on a URN / row-key / test-id
    //                         container. Survives re-render, re-sort, CSS refactors.
    //   B  GOOD               semantic but a weaker contract: placeholder text, or a
    //                         contextual chain pinned on a container with no stable key.
    //   C  USABLE, WATCH IT   pinned on VISIBLE TEXT or on a real markup attribute.
    //                         Works today; a copy edit, a translation, or a component
    //                         refactor breaks it.
    //   D  FIX BEFORE MERGE   CSS on classes / attribute combinations / a scoped parent.
    //                         Resolves 1-of-1 right now, but it is markup, not an
    //                         automation contract -- ask the devs for a data-testid.
    //   F  DO NOT SHIP        positional path, positional inside a virtualized list,
    //                         ambiguous (matches more than one), or unreachable
    //                         (cross-origin iframe / closed shadow root).
    const GRADE_MEANING = { A: "ship it", B: "good", C: "usable - watch it", D: "fix before merge", F: "do not ship" };
    const STRATEGY_GRADE = { urn: "A", testid: "A", role: "A", label: "A", placeholder: "B", contextual: "B", text: "C", unreachable: "F" };
    // suggestAlternatives()/diagnoseLocator() label each alternative with a fixed,
    // hand-written `kind` string (see the add() calls in suggestAlternatives -- these
    // are the ONLY kind strings that ever get produced, not open-ended). Mapping them
    // back to the SAME strategy keys STRATEGY_GRADE already uses means an approved
    // alternative gets graded by the exact same table the primary locator does --
    // no separate, hand-guessed grade to drift out of sync or get wrong.
    const ALT_KIND_STRATEGY = {
      "role + accessible name": "role",
      "aria-label": "label",
      "<label> text": "label",
      "placeholder": "placeholder",
      "URN": "urn",
      "visible text": "text",
      "scoped chain": "contextual",
      "CSS": "css",
    };
    function strategyForAltKind(kind) {
      if (ALT_KIND_STRATEGY[kind]) return ALT_KIND_STRATEGY[kind];
      // testidAttrs() alternatives are labelled with the raw attribute name itself
      // (e.g. "data-testid", "data-cy") -- see the `add(attr === "data-testid" ? ... )`
      // call in suggestAlternatives.
      if (testidAttrs().indexOf(kind) >= 0) return "testid";
      return "css"; // unrecognized kind -> least-trusted tier, same as raw CSS
    }
    // Approving/tracking an ALTERNATIVE must never silently re-approve whatever the
    // PRIMARY locator happened to be -- that would record the wrong string as "what
    // the human chose". Re-resolves the element
    // FRESH (not from a stale snapshot) so the css/role/name reflect the live DOM at
    // the moment of copying, then overrides only primary/strategy/grade to reflect
    // the ALTERNATIVE actually copied -- everything else about the element (its
    // semantic key, its css) stays accurate for Catalog's drift/heal logic.
    function approveAlternative(alt, route) {
      if (!alt || !alt.code) return;
      try {
        if (!alt.el || !document.contains(alt.el)) return; // stale by the time of copy -- text still copied, nothing to track
        const base = resolveUniqueLocator(alt.el);
        const strategy = strategyForAltKind(alt.kind);
        const altRes = Object.assign({}, base, {
          primary: alt.code,
          primaryStrategy: strategy,
          grade: STRATEGY_GRADE[strategy] || "F",
        });
        Catalog.approve(altRes, route);
        markCheckup(altRes, "copy");
      } catch {}
    }
    // The header used to print the raw strategy key -- "urn", "testid" -- which means
    // nothing to someone who did not write this engine. Say what it is pinned ON.
    const STRATEGY_HUMAN = {
      urn: "pinned on the record's unique ID",
      testid: "pinned on a test hook the app publishes",
      role: "pinned on role + visible name",
      label: "pinned on its form label",
      placeholder: "pinned on placeholder text",
      contextual: "pinned on its row, then the control inside",
      text: "pinned on visible text",
      css: "pinned on an attribute or class",
      positional: "pinned on its position in the markup",
      unreachable: "no locator can reach it",
    };
    function cssGrade(cssRes) {
      // Positional is never shippable, however it was arrived at.
      // semantic-path is a structural path with good class anchors. Better to READ and
      // more durable than a bare tag chain, but still positional, so still F -- promoting
      // it would change what the verdict means and break comparability with the
      // 247-locator real-app sweep.
      if (cssRes.method === "positional" || cssRes.method === "scoped-path" || cssRes.method === "semantic-path") return "F";
      // Everything else is a markup-shaped selector: a single meaningful attribute is
      // usable (C); class soup, attribute combinations and parent-scoping are not (D).
      if (cssRes.method === "scoped") return "D";
      return (cssRes.penalty || 0) <= 3 ? "C" : "D";
    }
    // One plain sentence saying WHY the grade is what it is -- the thing a reviewer
    // needs in order to accept or push back on the locator.
    function gradeWhy(grade, pwStrategy, cssRes, extra) {
      // Order matters: an unreachable element also reads as "not unique", and the
      // unreachable reason is the one that actually helps.
      if (extra && extra.unreachable) return "Inside a closed shadow root - no locator can reach it. Ask for a component-level test hook.";
      if (extra && extra.thirdParty) return "Belongs to a THIRD-PARTY widget embedded in the page (captcha, status banner, chat, billing), not to the application. The vendor can change its markup at any time - do not build tests on it.";
      if (extra && extra.crossOriginFrame) return "Inside a cross-origin iframe. Playwright reaches it through page.frameLocator(); a DevTools console in the top frame cannot.";
      if (extra && extra.notUnique) return "Matches more than one element - not safe to use.";
      if (extra && extra.virtualPositional) return "Positional locator inside a virtualized list - after a scroll it points at a different row.";
      switch (pwStrategy) {
        case "urn": return "Pinned on the entity's globally-unique URN - the most durable key this app has.";
        case "testid": return "Pinned on a data-testid the app publishes on purpose for automation.";
        case "role": return "Accessibility role + accessible name - survives CSS and markup refactors.";
        case "label": return "Pinned on the element's aria-label / <label> text - an explicit, authored name.";
        case "placeholder": return "Pinned on placeholder text - authored, but it changes more freely than a label.";
        case "contextual":
          return extra && extra.strongContainer
            ? "Scoped inside a container pinned on a URN / row-key / test-id, so it survives re-sort and re-render."
            : "Scoped inside a container identified by its text - re-check it if that text can change.";
        case "text": return "Pinned on visible text - a copy edit or translation breaks it.";
        default:
          if (grade === "F") return "Falls back to a positional DOM path - any layout change breaks it. Ask for a data-testid.";
          return "Falls back to a CSS selector over markup (classes/attributes) - it works, but it is not an automation contract.";
      }
    }
    function stabilityOf(pwStrategy, cssMethod, penalty) {
      if (["urn", "role", "label", "testid"].includes(pwStrategy)) return "stable";
      if (["placeholder", "text", "contextual"].includes(pwStrategy)) return "medium";
      if (cssMethod === "direct" && penalty <= 4) return "medium";
      return "at-risk";
    }
    function methodNote(method) {
      switch (method) {
        case "direct": return "Unique on its own.";
        case "scoped": return "Scoped under a stable parent to make it 1-of-1.";
        case "scoped-path": return "Positional path under a stable parent \u2014 add a data-testid to simplify.";
        case "semantic-path": return "Structural path anchored on this app's own classes \u2014 readable and survives wrapper changes, but still order-dependent. Ask for a data-testid.";
        case "positional": return "Positional path \u2014 brittle; add a data-testid or role+name.";
        default: return "";
      }
    }
    function locatorLabel(method, strategy) {
      if (method === "direct") return strategy;
      if (method === "scoped") return "scoped \u00B7 " + strategy;
      if (method === "scoped-path") return "scoped path";
      if (method === "semantic-path") return "structural path (class-anchored)";
      if (method === "positional") return "positional path";
      return strategy;
    }
    // Confidence classification surfaced in the UI (spec #10): HOW the locator is
    // unique, not just an A-F grade. unique = stands alone on a semantic anchor;
    // scoped = pinned inside a stable container; positional = relies on DOM order.
    function verificationOf(pwStrategy, cssMethod) {
      // Classify by the HEADLINE (Playwright) locator first: a semantic primary
      // (role/testid/urn/label/placeholder/text/id) is "unique" regardless of how the
      // CSS fallback looks. Only when Playwright itself falls back to raw CSS do we
      // grade by the CSS method (scoped vs positional).
      if (pwStrategy === "contextual") return "scoped";
      if (pwStrategy && pwStrategy !== "css") return "unique";
      if (cssMethod === "scoped") return "scoped";
      if (cssMethod === "scoped-path" || cssMethod === "positional" || cssMethod === "semantic-path") return "positional";
      return "unique";
    }
    // Virtualized-list awareness \u2014 inside a virtual scroller (Ant Table body,
    // rc-virtual-list, react-window/virtualized, ag-grid, virtuoso), DOM rows
    // RECYCLE on scroll, so a positional :nth-child/:nth-of-type locator points at
    // whatever row lands in that slot next \u2014 the classic "generic misleading" flaky
    // locator. Detect it and force/flag URN/row-key/content pins instead.
    const VIRTUAL_LIB_SEL = ".rc-virtual-list-holder,.rc-virtual-list,.ReactVirtualized__Grid,.ReactVirtualized__List,.ag-body-viewport,.ant-table-body,.ant-table-tbody,[data-virtualized],.virtual-scroll,.virtuoso-scroller,[data-testid=virtuoso-scroller]";
    function looksVirtual(node) {
      if (!node || node.nodeType !== 1) return false;
      try { if (node.matches && node.matches(VIRTUAL_LIB_SEL)) return true; } catch {}
      const role = (node.getAttribute && node.getAttribute("role")) || "";
      if (role === "grid" || role === "treegrid" || role === "tree") {
        const declared = parseInt(node.getAttribute("aria-rowcount") || node.getAttribute("aria-setsize") || "0", 10);
        const present = node.querySelectorAll ? node.querySelectorAll("[role=row],[role=treeitem],tr").length : 0;
        if (declared && present && declared > present + 5) return true;
      }
      // react-window / react-virtualized signature: a genuine SCROLL container whose
      // children are absolutely positioned via translateY. Must be strict \u2014 a plain
      // element with a transformed child (breadcrumbs, sticky headers, animated menus)
      // is NOT a virtual list, and false-flagging one blocks good anchoring + shows a
      // scary warning. Require an overflow scroller taller than its viewport AND >=2
      // translated child rows.
      try {
        const cs = (node.ownerDocument.defaultView || window).getComputedStyle(node);
        if (/(auto|scroll)/.test(cs.overflowY) && node.scrollHeight > node.clientHeight * 1.5) {
          let translated = 0;
          const kids = node.children || [];
          for (let i = 0; i < Math.min(kids.length, 12); i++) {
            const t = (node.ownerDocument.defaultView || window).getComputedStyle(kids[i]).transform;
            if (t && t !== "none" && /matrix|translate/.test(t)) translated++;
          }
          if (translated >= 2) return true;
        }
      } catch {}
      return false;
    }
    function virtualAncestor(el) {
      let n = el, guard = 0;
      while (n && n.nodeType === 1 && guard++ < 40) { if (looksVirtual(n)) return n; n = n.parentElement; }
      return null;
    }
    // Is the element something a script can actually CLICK \u2014 non-zero size, not
    // transparent/hidden, accepts pointer events? (A locator that resolves 1-of-1 but
    // can't be clicked is useless for automation.)
    function isVisiblyActionable(el) {
      try {
        if (!el || el.nodeType !== 1) return false;
        const cs = (el.ownerDocument.defaultView || window).getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden" || cs.pointerEvents === "none" || parseFloat(cs.opacity) === 0) return false;
        const r = el.getBoundingClientRect();
        return r.width > 1 && r.height > 1;
      } catch { return true; }
    }
    // Many UI kits (Ant, MUI, custom) render a VISUALLY-HIDDEN <input> (radio/checkbox/
    // switch/file) and route interaction through a styled, clickable wrapper (a <label>
    // or role=button/radio ancestor). For those, the correct INTERACTION target is that
    // wrapper \u2014 clicking the hidden input times out. Promote to it. Returns
    // { el: targetEl, promoted: bool }.
    function interactionTarget(el) {
      if (isVisiblyActionable(el)) return { el, promoted: false };
      const tag = tagOf(el);
      const isFormCtl = tag === "input" || tag === "select" || tag === "textarea";
      if (!isFormCtl) return { el, promoted: false };
      // Prefer a semantic clickable wrapper (label / role=radio|checkbox|switch|button).
      let n = el.parentElement, g = 0;
      while (n && n.nodeType === 1 && g++ < 4) {
        const nt = tagOf(n), role = n.getAttribute && n.getAttribute("role");
        if ((nt === "label" || role === "radio" || role === "checkbox" || role === "switch" || role === "button") && isVisiblyActionable(n)) return { el: n, promoted: true };
        n = n.parentElement;
      }
      // Fallback: nearest actionable ancestor at all.
      n = el.parentElement; g = 0;
      while (n && n.nodeType === 1 && g++ < 4) { if (isVisiblyActionable(n)) return { el: n, promoted: true }; n = n.parentElement; }
      return { el, promoted: false };
    }
    function resolveUniqueLocator(elIn) {
      // ACTIONABILITY-FIRST: if the hovered element is a visually-hidden form control
      // driven by a clickable wrapper, resolve the wrapper so the emitted locator can
      // actually be clicked in a script (the raw hidden input cannot).
      const it = interactionTarget(elIn);
      const el = it.el;
      const promotedNote = it.promoted ? " (targets the clickable wrapper - the underlying <" + tagOf(elIn) + "> is visually hidden and not directly clickable)." : "";
      // Approval memory first: if a human confirmed a locator for this element
      // before and it STILL resolves to exactly this element, reuse it \u2014 correct
      // (human-blessed) and fast (no re-derivation). This is how the tool improves.
      try {
        const route = typeof routeKey === "function" ? routeKey() : "";
        const rec = Catalog.recall(el, route);
        if (rec) {
          return {
            tag: tagOf(el), role: rec.role, accName: rec.name, text: normText(el),
            primary: rec.primary, primaryStrategy: rec.strategy, css: rec.css,
            cssMethod: "approved", cssStrategy: rec.strategy, penalty: 0,
            grade: rec.grade || "A", stability: "stable", label: "approved \u00B7 recalled",
            verification: "approved",
            boundary: boundaryInfo(el), root: rootOf(el), unique: true, approved: true,
            note: "\u2713 Approved locator \u2014 recalled from memory (human-confirmed" + (rec.approvals > 1 ? " \u00D7" + rec.approvals : "") + ")." + promotedNote,
          };
        }
      } catch {}
      const boundary = boundaryInfo(el);
      const cssRes = buildUniqueCss(el);
      const pw = playwrightLocator(el, cssRes.locator, boundary);
      // Uniqueness is asserted three ways, because they disagree around Shadow DOM
      // and the engineer acts on all three (see countMatchesDeep / countInDocument).
      const uniqueInOwnRoot = matchesUniquely(cssRes.locator, el);
      const shadowed = inShadow(el);
      const deepCount = countMatchesDeep(cssRes.locator);
      // The DevTools figure: shadow-piercing (Ctrl+F does cross shadow boundaries),
      // our own injected nodes included (Ctrl+F counts them), and inflated by the
      // text-search union when the selector reads like page copy.
      const copyHits = copyCollisionHits(cssRes.locator);
      const copyCollision = copyHits > 0;
      const framesUnseen = unreachableFrameCount();
      const devCount = countMatchesForDevtools(cssRes.locator) + copyHits;
      const unique = uniqueInOwnRoot && pw.unique !== false;
      let grade = STRATEGY_GRADE[pw.strategy] || cssGrade(cssRes);
      const res = {
        tag: tagOf(el), role: roleOf(el), accName: accessibleName(el), text: normText(el),
        primary: pw.code, primaryStrategy: pw.strategy,
        css: cssRes.locator, cssMethod: cssRes.method, cssStrategy: cssRes.strategy, penalty: cssRes.penalty,
        grade, stability: stabilityOf(pw.strategy, cssRes.method, cssRes.penalty),
        label: locatorLabel(cssRes.method, cssRes.strategy), boundary, root: rootOf(el),
        verification: verificationOf(pw.strategy, cssRes.method),
        unique,
        // What the engineer gets when they paste the CSS line into DevTools Elements
        // -> Ctrl+F. Measured against the real DevTools search: it pierces shadow
        // AND enters iframes, so the basis is the deep count, not this realm's
        // querySelectorAll. It also counts nodes this tool injected.
        cssDevtoolsCount: devCount,
        cssUsableInDevtools: devCount === 1 && !copyCollision,
        // Plain CSS is the right thing to hand over whenever it is 1-of-1 deep. The
        // console chain is only better when the same shadow component exists more
        // than once, where plain CSS genuinely returns N.
        cssDevtools: shadowed && deepCount > 1 ? devtoolsShadowChain(el, cssRes.locator) : cssRes.locator,
        // Ctrl+F searches these too, and this realm cannot count them, so the number
        // above is a lower bound whenever this is non-zero.
        devtoolsFramesUnseen: framesUnseen,
        // Ctrl+F unions a plain-text substring search over the query, so page copy
        // containing this exact string adds phantom hits.
        devtoolsCopyCollision: copyCollision,
        // Can a script actually act on it? A locator that resolves 1-of-1 but cannot
        // be clicked is useless in a test.
        actionable: isVisiblyActionable(el),
        shadowScoped: !!pw.shadowScoped,
        // The engine deliberately retargets a visually-hidden form control to the
        // wrapper that actually receives the click, so the locator identifies the
        // WRAPPER, not the element that was pointed at. Say so explicitly, otherwise
        // any identity check against the original element reads as a false failure.
        promoted: !!it.promoted,
        promotedFrom: it.promoted ? tagOf(elIn) : null,
        // In a collapsed menu / unopened side panel / aria-hidden subtree. The locator
        // below may still resolve, but no test can act on it until the app reveals it.
        ariaHidden: ariaHidden(el),
        // Reachable by Playwright through page.frameLocator(), but NOT by a page script
        // or a DevTools console sitting in the top frame.
        crossOriginFrame: !!(boundary && boundary.crossOriginHop),
        // A vendor widget embedded in the page, not the application under test.
        thirdParty: isThirdPartyRealm(),
        note: pw.strategy === "contextual" ? `Relative locator \u2014 scoped under ${pw.human} (not unique on its own).` : methodNote(cssRes.method),
      };
      // A contextual chain pinned on a URN / data-row-key / testid container is
      // genuinely stable (survives re-render, scroll, re-sort) \u2014 grade it as such.
      if (pw.strategy === "contextual" && pw.strong) { res.grade = "A"; res.stability = "stable"; res.strongContainer = true; }
      // Shadow DOM the host chain could not disambiguate: Playwright would match N.
      if (pw.shadowAmbiguous) {
        res.grade = "F"; res.stability = "at-risk"; res.verification = "positional";
        res.note = "\u26A0 SHADOW DOM \u2014 this component is instantiated more than once and its host has no stable anchor, so Playwright (which pierces shadow) would match " + deepCount + ". Ask for a data-testid on the host.";
      }
      // Virtual-list guard: a positional locator here is a scroll-recycling lie.
      if (virtualAncestor(el)) {
        res.inVirtualList = true;
        const positional = /:nth-(of-type|child)\(/.test(pw.code);
        if (positional) {
          res.stability = "at-risk"; res.grade = "F"; res.verification = "positional"; res.virtualPositional = true;
          res.note = "\u26A0 VIRTUALIZED LIST \u2014 this positional locator recycles on scroll and will match a DIFFERENT row. Pin by URN / data-row-key / row text instead (hover the row's key cell).";
        } else {
          res.note = (res.note ? res.note + " " : "") + "\u2713 Scroll-safe in this virtualized list (content/key-pinned, not positional).";
        }
      }
      // Hidden right now (collapsed menu / closed drawer / aria-hidden subtree). The
      // locator is still the right one, but the test MUST open the container first, and
      // getByRole is deliberately not offered because Playwright's ARIA engine cannot
      // see it at all. Say both things out loud instead of handing over a locator that
      // silently times out.
      if (res.ariaHidden) {
        res.note = "\u26a0 HIDDEN RIGHT NOW (collapsed menu / closed panel / aria-hidden). " +
          "Playwright's getByRole cannot see it, so a role locator is not offered. Your test must open the container first, then this locator resolves. " + (res.note || "");
        if (res.grade === "A") res.grade = "B";
        res.stability = res.stability === "stable" ? "medium" : res.stability;
      }
      if (res.crossOriginFrame) {
        res.note = "\u24D8 In a cross-origin iframe. Playwright reaches this through the frameLocator() prefix above; a page script or the top frame's DevTools console cannot. The CSS line only works with DevTools scoped to that frame. " + (res.note || "");
        res.cssUsableInDevtools = false;
      }
      if (!res.unique) { res.grade = "F"; res.stability = "at-risk"; }
      if (boundary && boundary.unpierceable) { res.grade = "F"; res.stability = "at-risk"; }
      // -----------------------------------------------------------------------
      // WHAT THE ENGINEER ACTUALLY DECIDES.
      // The A-F letter stays as an INTERNAL gate: it still drives what the knowledge
      // base is willing to learn (isQualityLocator) and which recorded steps get a
      // FIXME in the generated test (isBrittle). But the UI shows two ORTHOGONAL
      // things instead, because one letter cannot answer both questions being asked:
      //
      //   verdict   can this go in the suite?      ship | watch | dont-ship
      //   needs[]   what must the TEST do first?   open-container, needs-framelocator,
      //             click-wrapper, not-clickable, pierces-shadow
      //
      // On the real app the letters did not map to any action (A21 B9 C47 D17 F19).
      // These two fields do. No "copy selector" tool and no codegen reports either --
      // codegen will happily hand you a locator for something inside a collapsed
      // drawer or behind a cross-origin boundary and say nothing about it.
      // -----------------------------------------------------------------------
      // A third-party widget is never a legitimate test target, however cleanly it
      // resolves: its markup is the vendor's to change without notice.
      res.verdict = res.thirdParty ? "dont-ship"
        : !res.unique || res.grade === "F" ? "dont-ship"
        : (res.grade === "A" || res.grade === "B") ? "ship" : "watch";
      res.verdictText = { ship: "SHIP IT", watch: "WORKS \u2014 WATCH IT", "dont-ship": "DON\u2019T SHIP" }[res.verdict];
      res.needs = [];
      if (res.thirdParty) res.needs.push("third-party-widget");
      if (res.ariaHidden) res.needs.push("open-container");
      if (res.crossOriginFrame) res.needs.push("needs-framelocator");
      if (res.promoted) res.needs.push("click-wrapper");
      if (res.actionable === false && !res.promoted) res.needs.push("not-clickable");
      if (res.shadowScoped) res.needs.push("pierces-shadow");
      // Standalone module: give the engineer the shell-based form too, because the
      // locator above is only right for a test that navigates straight to this origin.
      // NOT shown while actively recording: the CURRENT
      // recording's own action history already answers "does THIS test reach this
      // origin directly or via the shell" -- a page.goto() into this exact origin
      // already exists by now, either from the initial recNavigation when recording
      // started, or from the cross-origin handoff note+navigate pair. There is no real
      // ambiguity to show two options for. Outside of recording (casual Inspect-tab
      // browsing to grab a locator for a hand-written or separate test) both forms
      // stay shown -- there the tool has NO real signal for which one the person's
      // actual target test uses, and guessing wrong there would be worse than being
      // honest about the ambiguity.
      const sm = standaloneModuleInfo();
      if (sm && res.primary && /^page\./.test(res.primary) && !registry.recording) {
        res.standaloneModule = sm;
        // Keep the wrapper separate from the tail. Both forms end in the SAME chain, so
        // side by side they read as duplicates -- the tooltip highlights this prefix to
        // show that the prefix is the entire difference between them.
        res.embeddedPrefix = `page.frameLocator('${sm.selector.replace(/'/g, "\\'")}')`;
        res.embeddedPrimary = res.primary.replace(/^page\./, res.embeddedPrefix + ".");
        res.needs.push("standalone-module");
      }
      res.needsText = {
        "third-party-widget": "vendor widget, not your app \u2014 don\u2019t test its internals",
        "open-container": "hidden now \u2014 your test must open the menu/drawer first",
        "needs-framelocator": "in a cross-origin iframe \u2014 only reachable via frameLocator()",
        "click-wrapper": "clicks the visible wrapper, not the hidden input",
        "not-clickable": "cannot be clicked as-is",
        "pierces-shadow": "scoped through a shadow-DOM host",
        "standalone-module": "two forms below \u2014 pick by where your test starts",
      };
      // The single thing to ask the developers for, when it is not shippable as-is.
      res.fix = res.verdict === "ship" ? null
        : res.grade === "F" ? "No stable anchor exists. Ask for data-testid=\"...\" on this element."
        : "Works today, but it is pinned on markup or copy. A data-testid would make it permanent.";
      res.gradeMeaning = GRADE_MEANING[res.grade] || "";
      res.why = gradeWhy(res.grade, pw.strategy, cssRes, {
        notUnique: !res.unique, unreachable: !!(boundary && boundary.unpierceable),
        crossOriginFrame: !!res.crossOriginFrame, thirdParty: !!res.thirdParty,
        virtualPositional: !!res.virtualPositional, strongContainer: !!res.strongContainer,
      });
      noteTestIdSeen(el);
      if (promotedNote) res.note = (res.note || "") + promotedNote;
      return res;
    }


    // ==========================================================================
    // ALTERNATIVES + DIAGNOSIS  ("this one is weak / broken - what should I use?")
    //
    // Deliberately NOT an LLM, and that is a quality decision rather than a
    // constraint. A suggestion here is a SEARCH over candidates this engine can
    // VERIFY against the live DOM under the same semantics Playwright uses. A
    // language model can only produce syntax that LOOKS right; every rule in this
    // file that was assumed rather than measured turned out to be wrong (getByRole
    // on icon buttons, shadow-root uniqueness, ARIA-hidden, getByText counting).
    // A confident suggestion that silently resolves to zero is worse than none.
    //
    // Two hard blockers on an in-tool LLM besides: this ships as a bookmarklet in a
    // locked-down browser, so the key would live in client-side JS; and it would send
    // DOM content off-box from a data-governance product's QA environment, breaking
    // the one property the tool guarantees - nothing leaves the browser.
    // ==========================================================================

    // Is the locator pinned to test DATA or to the UI's STRUCTURE? On a data-catalog
    // product this is the question that decides whether a test survives a reseed: a
    // URN-pinned locator is exact and disambiguates identically-named rows, and
    // evaporates the moment the environment is refreshed.
    const DATA_PINNED_RE = /urn:li:|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-|\/\d{5,}/i;
    function pinKind(code) {
      return DATA_PINNED_RE.test(code || "") ? "data-pinned" : "structural";
    }

    // The control that has to be clicked before a hidden element can be reached, and
    // the container it opens. Uses the explicit ARIA relationship first, then the two
    // design-system patterns this app actually uses (Vuetify's menu activator, Ant's
    // expandable trigger).
    function revealStep(el, base) {
      let node = el, guard = 0, container = null;
      while (node && node.nodeType === 1 && guard++ < 25) {
        const role = node.getAttribute && node.getAttribute("role");
        const cls = (typeof node.className === "string" ? node.className : "");
        if (role === "menu" || role === "dialog" || role === "listbox" ||
            /v-menu__content|ant-dropdown|ant-drawer|ant-modal|v-navigation-drawer/.test(cls)) { container = node; break; }
        node = node.parentElement;
      }
      if (!container) return null;
      const root = rootOf(el);
      let opener = null;
      // 1) the explicit relationship
      if (container.id) { try { opener = root.querySelector(`[aria-controls="${cssAttr(container.id)}"]`); } catch {} }
      // 2) Vuetify mounts the menu content detached; its activator is the sibling of the
      //    .v-menu wrapper, so search for an expandable trigger naming the same thing.
      if (!opener) {
        try {
          for (const c of root.querySelectorAll('[aria-expanded],[aria-haspopup],.v-menu__activator > *')) {
            if (isOwnNode(c) || ariaHidden(c)) continue;
            if (!isVisiblyActionable(c)) continue;
            opener = c; break;
          }
        } catch {}
      }
      if (!opener) return null;
      const or = resolveUniqueLocator(opener);
      if (!or || !or.unique) return null;
      return { code: `await ${or.primary}.click();`, opener: or.primary, desc: accessibleName(opener) || tagOf(opener) };
    }

    // Every alternative that VERIFIABLY resolves to this one element, ranked, each with
    // what it costs you. Returned even when the primary is already good, because an
    // engineer often wants the structural option instead of the data-pinned one.
    function suggestAlternatives(el, current, base) {
      base = base || "page";
      const out = [];
      const seenCode = new Set([current && current.primary]);
      const add = (code, kind, note) => {
        if (!code || seenCode.has(code)) return;
        seenCode.add(code);
        // `el` rides along so copying an alternative can approve/track the RIGHT
        // element with the RIGHT strategy -- not silently re-approve whatever the
        // primary locator happened to be.
        out.push({ code, kind, note, pin: pinKind(code), el });
      };
      const role = roleOf(el), name = accessibleName(el), tag = tagOf(el);

      // 1) role + accessible name -- survives markup and CSS refactors.
      if (role && name && nameUsable(name) && roleNameMatchable(el, role) && !ariaHidden(el) && roleNameUnique(el, role, name))
        add(`${base}.getByRole(${q(role)}, { name: ${q(name)}, exact: true })`, "role + accessible name",
            "Best structural option: survives class and markup changes.");

      // 2) an explicit authored label
      const al = el.getAttribute && el.getAttribute("aria-label");
      if (al && nameUsable(al) && labelUnique(el, al))
        add(`${base}.getByLabel(${q(al)}, { exact: true })`, "aria-label", "Pinned on an authored name; also matches while hidden.");
      if (tag === "input" || tag === "textarea" || tag === "select") {
        const lt = associatedLabelText(el);
        if (lt && nameUsable(lt) && labelUnique(el, lt))
          add(`${base}.getByLabel(${q(lt)}, { exact: true })`, "<label> text", "Reads like the form does.");
        const ph = el.getAttribute("placeholder");
        if (ph && matchesUniquely(`${tag}[placeholder="${cssAttr(ph)}"]`, el))
          add(`${base}.getByPlaceholder(${q(ph)}, { exact: true })`, "placeholder", "Copy change breaks it.");
      }

      // 3) the app's own hooks / identity keys
      for (const attr of testidAttrs()) {
        const v = el.getAttribute(attr);
        if (v && matchesUniquely(`[${attr}="${cssAttr(v)}"]`, el))
          add(attr === "data-testid" ? `${base}.getByTestId(${q(v)})` : `${base}.locator(${q(`[${attr}="${cssAttr(v)}"]`)})`,
              attr, "An automation contract the app publishes on purpose.");
      }
      const urn = urnSelector(el);
      if (urn) add(`${base}.locator(${q(urn.sel)})`, "URN", "Exact and disambiguates identically-named rows, but tied to THIS environment's data.");

      // 4) visible text
      const t = pwText(el);
      if (t && t.length <= 80 && textUniquePageWide(el, t))
        add(`${base}.getByText(${q(t)}, { exact: true })`, "visible text", "Readable; a copy edit or translation breaks it.");

      // 5) a scoped chain, for one-of-many row/card actions
      const ctx = contextualLocator(el, base);
      if (ctx) add(ctx.code, "scoped chain", "Pins the row/card first, then the control inside it.");

      // 6) the verified CSS backbone, last
      const cssRes = buildUniqueCss(el);
      if (cssRes && cssRes.locator && cssRes.method !== "positional" && cssRes.method !== "scoped-path" && cssRes.method !== "semantic-path")
        add(`${base}.locator(${q(cssRes.locator)})`, "CSS", "Works, but it is markup rather than a contract.");

      return out;
    }

    // ---------------------------------------------------------------------------
    // LOCATOR DOCTOR - paste a locator that is failing, find out why.
    //
    // The page has no Playwright, so each segment is evaluated with this engine's own
    // primitives, which are the ones that were measured against real Playwright. The
    // parser covers the forms this tool emits plus the ones people hand-write.
    // ---------------------------------------------------------------------------
    const SEG_RE = /\.(getByRole|getByTestId|getByLabel|getByPlaceholder|getByText|getByAltText|getByTitle|locator|frameLocator|filter|first|last|nth)\s*\(/g;
    function parseLocator(code) {
      const segs = [];
      let m;
      SEG_RE.lastIndex = 0;
      while ((m = SEG_RE.exec(code))) {
        // Walk to the matching close paren so nested quotes/objects survive.
        let i = SEG_RE.lastIndex, depth = 1, quote = null;
        while (i < code.length && depth > 0) {
          const c = code[i];
          if (quote) { if (c === "\\") i++; else if (c === quote) quote = null; }
          else if (c === "'" || c === '"' || c === "`") quote = c;
          else if (c === "(") depth++;
          else if (c === ")") depth--;
          i++;
        }
        segs.push({ fn: m[1], args: code.slice(SEG_RE.lastIndex, i - 1).trim() });
        SEG_RE.lastIndex = i;
      }
      return segs;
    }
    const firstString = (s) => { const m = /^\s*(['"`])([\s\S]*?)\1/.exec(s || ""); return m ? m[2] : null; };
    const namedString = (s, key) => {
      const m = new RegExp(key + "\\s*:\\s*(['\"`])([\\s\\S]*?)\\1").exec(s || "");
      return m ? m[2] : null;
    };

    /** Candidate set for one segment, evaluated within `scope`. */
    function evalSegment(seg, scope) {
      const all = (sel) => { try { return [...scope.querySelectorAll(sel)].filter((n) => !isOwnNode(n)); } catch { return []; } };
      switch (seg.fn) {
        case "getByTestId": { const v = firstString(seg.args); return v ? all(`[data-testid="${cssAttr(v)}"]`) : []; }
        case "getByPlaceholder": { const v = firstString(seg.args); return v ? all(`[placeholder="${cssAttr(v)}"]`) : []; }
        case "getByAltText": { const v = firstString(seg.args); return v ? all(`[alt="${cssAttr(v)}"]`) : []; }
        case "getByTitle": { const v = firstString(seg.args); return v ? all(`[title="${cssAttr(v)}"]`) : []; }
        case "locator": { const v = firstString(seg.args); return v ? all(v) : []; }
        case "getByLabel": {
          const v = firstString(seg.args); if (!v) return [];
          return all("input,textarea,select,[aria-label],[aria-labelledby],[contenteditable='true']").filter((n) => {
            const lb = n.getAttribute("aria-labelledby");
            let nm = lb ? textFromIds(n, lb) : "";
            if (!nm) nm = (n.getAttribute("aria-label") || "").trim();
            if (!nm) { const tg = tagOf(n); if (tg === "input" || tg === "textarea" || tg === "select") nm = associatedLabelText(n); }
            return nm === v;
          });
        }
        case "getByRole": {
          const r = firstString(seg.args); if (!r) return [];
          const nm = namedString(seg.args, "name");
          return all(ROLE_CANDIDATE_TAGS[r] || "*").filter((n) =>
            roleOf(n) === r && !ariaHidden(n) && (nm == null || accessibleName(n) === nm));
        }
        case "getByText": {
          const v = firstString(seg.args); if (!v) return [];
          const exact = /exact\s*:\s*true/.test(seg.args);
          return all("*").filter((n) => {
            const txt = pwText(n);
            const hit = exact ? txt === v : txt.includes(v);
            return hit && isInnermostTextOwner(n, exact ? v : txt);
          });
        }
        default: return null;   // filter/first/last/nth/frameLocator handled by the caller
      }
    }

    /**
     * Does a frameLocator() selector describe the document we are standing in right now?
     *
     * The tooltip hands out TWO Playwright forms for an embedded module (see
     * standaloneModuleInfo): a bare one for a test that opens the module URL, and a
     * frameLocator()-prefixed one for a test that starts at the shell. Pasting the
     * second one back into the Doctor while viewing the module standalone used to
     * report "broken" - the locator is correct, the PAGE is just the wrong context for
     * it. Match on the host inside src*="..."; the hash/query part is deliberately
     * ignored because a client-side route change rewrites it while src stays put.
     */
    function frameSelectorNamesThisPage(sel) {
      try {
        if (!sel) return false;
        const vals = [];
        const re = /src\s*[*^$~|]?=\s*(['"])([\s\S]*?)\1/g;
        let m;
        while ((m = re.exec(sel))) vals.push(m[2]);
        if (!vals.length) return false;
        for (const v of vals) {
          const host = v.split(/[#?/]/)[0];
          if (!host || !/[a-z]/i.test(host)) continue;
          if (location.hostname === host || location.host === host ||
              location.hostname.indexOf(host) === 0 || host.indexOf(location.hostname) === 0) return true;
        }
      } catch {}
      return false;
    }

    /**
     * A raw CSS selector or XPath, pasted with no `page.` chain around it. The tooltip's
     * CSS line (Alt+C) is exactly this shape, so pasting it back is the obvious move -
     * it used to come back "unparseable".
     */
    function diagnoseRawSelector(code, report) {
      const isXPath = /^\(?\s*[./]{1,2}\//.test(code) || /^\(?\s*\/\//.test(code);
      let nodes = [];
      if (isXPath) {
        report.kind = "xpath";
        try {
          const it = document.evaluate(code, document, null, 7 /* ORDERED_NODE_SNAPSHOT */, null);
          for (let i = 0; i < it.snapshotLength; i++) { const n = it.snapshotItem(i); if (n && n.nodeType === 1 && !isOwnNode(n)) nodes.push(n); }
        } catch (err) {
          report.verdict = "unparseable";
          report.reasons.push("Not valid XPath: " + (err && err.message ? err.message : String(err)));
          return report;
        }
        report.steps.push({ seg: "XPath " + code.slice(0, 70), count: nodes.length });
      } else {
        report.kind = "css";
        try { nodes = [...document.querySelectorAll(code)].filter((n) => !isOwnNode(n)); }
        catch (err) {
          report.verdict = "unparseable";
          report.reasons.push("Not a Playwright chain, and not a valid CSS selector either: " +
            (err && err.message ? err.message : String(err)) +
            "  Accepted forms: page.getByRole('button', { name: 'Save' })  |  a CSS selector  |  an XPath starting with //");
          return report;
        }
        report.steps.push({ seg: "CSS " + code.slice(0, 70), count: nodes.length });
        // The Elements find bar does not use querySelectorAll: it pierces shadow roots,
        // enters iframes, and unions a plain-text search. Report both numbers so a
        // mismatch between "the Doctor said 1" and "Ctrl+F said 3" is never a surprise.
        try {
          const dev = countMatchesForDevtools(code) + copyCollisionHits(code);
          if (dev !== nodes.length) report.reasons.push("Ctrl+F in the Elements panel finds " + dev +
            " for this, not " + nodes.length + " - it also searches shadow roots, iframes, and page text. Playwright counts " + nodes.length + ".");
        } catch {}
      }
      report.count = nodes.length;
      if (nodes.length === 1) {
        report.element = nodes[0];
        report.verdict = "ok";
        report.reasons.push("Valid as a " + (isXPath ? "XPath" : "CSS selector") +
          ". In a Playwright test this is " + (isXPath ? "page.locator('xpath=" + code.replace(/'/g, "\\'") + "')" : "page.locator('" + code.replace(/'/g, "\\'") + "')") + ".");
        const r = resolveUniqueLocator(nodes[0]);
        if (r.ariaHidden) { report.verdict = "hidden"; report.reasons.push("The element it finds is hidden right now (collapsed menu / closed drawer / aria-hidden), so no click can land until the container is opened."); }
        for (const a of suggestAlternatives(nodes[0], null, "page")) report.alternatives.push(a);
        return report;
      }
      report.verdict = nodes.length === 0 ? "broken" : "ambiguous";
      if (!nodes.length) {
        report.reasons.push("Nothing on this page matches it.");
        noteUnsearchedFrames(report);
      } else {
        report.reasons.push("Matches " + nodes.length + " elements. Scope it to the row / card / dialog holding the one you want.");
        for (const n of nodes.slice(0, 3)) { const c = contextualLocator(n, "page"); if (c) report.alternatives.push({ code: c.code, kind: "scoped chain", note: "Disambiguates by container.", pin: pinKind(c.code), el: n }); }
      }
      return report;
    }

    /**
     * "0 matches" on the shell is usually not a dead locator - it is an element living
     * inside the EDC iframe, which this realm cannot read. Say that instead of failing.
     */
    function noteUnsearchedFrames(report) {
      try {
        const unseen = unreachableFrameCount();
        if (unseen > 0) report.reasons.push(unseen + " frame(s) on this page are cross-origin, so this check could not look inside them. " +
          "If the element lives in an embedded module, wrap the locator in page.frameLocator('iframe[src*=\"...\"]') - or open the module's own URL in a tab and re-run this there.");
      } catch {}
    }

    /**
     * Diagnose a locator string against the live page. Returns the count at every step,
     * where it died, and VERIFIED alternatives - never a guessed selector.
     */
    function diagnoseLocator(code) {
      const report = { code, steps: [], count: 0, verdict: "", reasons: [], alternatives: [], element: null, kind: "playwright" };
      const segs = parseLocator(code);
      if (!segs.length) return diagnoseRawSelector(code, report);

      let scope = document, current = null, frameNote = null;
      for (const seg of segs) {
        if (seg.fn === "frameLocator") {
          const sel = firstString(seg.args);
          let frames = [];
          try { frames = [...document.querySelectorAll(sel || "iframe")]; } catch {}
          // The wrapper names THIS document, not a frame inside it: the paste came from
          // the tooltip's "if your test starts at the shell" row while the module is open
          // standalone. The locator is right; only the vantage point differs. Check the
          // rest of the chain here rather than calling a good locator broken.
          if (!frames.length && frameSelectorNamesThisPage(sel)) {
            report.selfFramed = true;
            report.steps.push({ seg: "frameLocator(" + (sel || "") + ")", count: 1, note: "that frame IS this page - wrapper skipped" });
            report.reasons.push("This is the shell-rooted form, and you are already inside the module (" + location.hostname +
              "). The frameLocator() wrapper is correct for a test that starts at the parent app - keep it there. It is simply redundant on this page, so the rest of the chain was checked directly.");
            scope = document;
            continue;
          }
          report.steps.push({ seg: seg.fn + "(" + (sel || "") + ")", count: frames.length });
          if (frames.length !== 1) {
            report.verdict = "broken";
            report.reasons.push(frames.length === 0
              ? "No iframe matches " + sel + " on this page. If that frame only exists on another screen, run this check from there."
              : sel + " matches " + frames.length + " iframes, so frameLocator binds to whichever comes first. Add something that tells the instances apart (a src fragment or query).");
            return report;
          }
          let doc = null;
          try { doc = frames[0].contentDocument; } catch {}
          if (!doc) { frameNote = "That frame is cross-origin, so this page cannot look inside it. Playwright can - run the check from Playwright, or open the frame's own URL directly."; break; }
          scope = doc;
          continue;
        }
        if (seg.fn === "first" || seg.fn === "last" || seg.fn === "nth") {
          report.steps.push({ seg: "." + seg.fn + "()", count: current ? 1 : 0, note: "narrows to one -- masks ambiguity rather than fixing it" });
          report.reasons.push("." + seg.fn + "() hides ambiguity: the locator above it matches more than one element, and the test silently depends on DOM order.");
          current = current && current.length ? [current[0]] : [];
          continue;
        }
        if (seg.fn === "filter") {
          const has = namedString(seg.args, "hasText");
          if (has != null && current) {
            // Playwright's hasText is a SUBSTRING match over textContent.
            current = current.filter((n) => pwText(n).includes(has));
            report.steps.push({ seg: `.filter({ hasText: '${has}' })`, count: current.length });
          }
          continue;
        }
        const found = evalSegment(seg, current && current.length === 1 ? current[0] : scope);
        if (found === null) { report.steps.push({ seg: "." + seg.fn + "()", count: current ? current.length : 0, note: "not evaluated" }); continue; }
        current = found;
        report.steps.push({ seg: "." + seg.fn + "(" + (firstString(seg.args) || "") + ")", count: found.length });
      }

      report.count = current ? current.length : 0;
      if (frameNote) { report.verdict = "cross-origin"; report.reasons.push(frameNote); return report; }

      if (report.count === 1) {
        report.element = current[0];
        report.verdict = "ok";
        const r = resolveUniqueLocator(current[0]);
        if (r.ariaHidden) { report.verdict = "hidden"; report.reasons.push("It resolves, but the element is hidden right now (collapsed menu / closed drawer / aria-hidden). A getByRole locator would see nothing, and no click can land until the container is opened."); }
        else if (r.actionable === false) { report.verdict = "not-actionable"; report.reasons.push("It resolves to exactly one element, but that element cannot be clicked (zero size, hidden, or pointer-events:none)."); }
        return report;
      }

      report.verdict = report.count === 0 ? "broken" : "ambiguous";
      // Say WHY it found nothing, using the last segment that still had candidates.
      const lastGood = [...report.steps].reverse().find((s) => s.count > 0);
      const died = report.steps.find((s) => s.count === 0);
      if (report.count === 0) {
        if (died) report.reasons.push("Dies at " + died.seg + " - nothing matches" + (lastGood ? ", though " + lastGood.seg + " still had " + lastGood.count : "") + ".");
        if (!segs.some((s) => s.fn === "frameLocator")) noteUnsearchedFrames(report);
        // The single most common cause on this app: right name, wrong role.
        const roleSeg = segs.find((s) => s.fn === "getByRole");
        if (roleSeg) {
          const wanted = namedString(roleSeg.args, "name");
          const askedRole = firstString(roleSeg.args);
          if (wanted) {
            const sameName = [...document.querySelectorAll("*")].filter((n) => !isOwnNode(n) && accessibleName(n) === wanted);
            const visible = sameName.filter((n) => !ariaHidden(n));
            if (sameName.length) {
              const roles = [...new Set(sameName.map((n) => roleOf(n) || tagOf(n)))];
              report.reasons.push('An element named "' + wanted + '" DOES exist, with role ' + roles.join(" / ") + ' - not "' + askedRole + '".');
              if (!visible.length) report.reasons.push("Every element with that name is currently hidden, so getByRole cannot see any of them.");
              for (const n of visible.slice(0, 3)) for (const a of suggestAlternatives(n, null, "page")) report.alternatives.push(a);
            }
          }
        }
      } else {
        report.reasons.push("Matches " + report.count + " elements. Scope it to the row / card / dialog that contains the one you want, rather than adding .first().");
        for (const n of current.slice(0, 3)) {
          const c = contextualLocator(n, "page");
          if (c) report.alternatives.push({ code: c.code, kind: "scoped chain", note: "Disambiguates by container.", pin: pinKind(c.code), el: n });
          const u = urnSelector(n);
          if (u) report.alternatives.push({ code: `page.locator(${q(u.sel)})`, kind: "URN", note: "Exact, but tied to this environment's data.", pin: "data-pinned", el: n });
        }
      }
      return report;
    }

    // ==========================================================================
    // KnowledgeStore (IndexedDB, per-origin; localStorage fallback for app-model)
    // ==========================================================================
    const KS = (function () {
      const DB = "locatorInspector:" + location.hostname;
      const AM_KEY = "locatorInspectorAppModel:" + location.hostname;
      let dbp = null;
      function open() {
        if (dbp) return dbp;
        dbp = new Promise((resolve, reject) => {
          let req;
          try {
            req = indexedDB.open(DB, 3);
          } catch (e) {
            return reject(e);
          }
          req.onupgradeneeded = (e) => {
            const db = e.target.result;
            const tx = e.target.transaction;
            if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv", { keyPath: "k" });
            if (!db.objectStoreNames.contains("fingerprints")) db.createObjectStore("fingerprints", { keyPath: "route" });
            const catalogStore = db.objectStoreNames.contains("catalog")
              ? tx.objectStore("catalog")
              : db.createObjectStore("catalog", { keyPath: "sig" });
            // Lets a vacuum pass find old, unapproved rows WITHOUT reading the whole
            // store into memory first -- the exact cost that made growth a problem.
            if (!catalogStore.indexNames.contains("byLastSeen")) catalogStore.createIndex("byLastSeen", "lastSeen");
          };
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
        return dbp;
      }
      async function put(store, obj) {
        try {
          const db = await open();
          return await new Promise((res, rej) => {
            const tx = db.transaction([store], "readwrite");
            tx.objectStore(store).put(obj);
            tx.oncomplete = () => res(true);
            tx.onerror = () => rej(tx.error);
          });
        } catch {
          return false;
        }
      }
      async function get(store, key) {
        try {
          const db = await open();
          return await new Promise((res, rej) => {
            const tx = db.transaction([store], "readonly");
            const r = tx.objectStore(store).get(key);
            r.onsuccess = () => res(r.result || null);
            r.onerror = () => rej(r.error);
          });
        } catch {
          return null;
        }
      }
      async function getAll(store) {
        try {
          const db = await open();
          return await new Promise((res, rej) => {
            const tx = db.transaction([store], "readonly");
            const r = tx.objectStore(store).getAll();
            r.onsuccess = () => res(r.result || []);
            r.onerror = () => rej(r.error);
          });
        } catch {
          return [];
        }
      }
      async function clearStore(store) {
        try {
          const db = await open();
          return await new Promise((res) => {
            const tx = db.transaction([store], "readwrite");
            tx.objectStore(store).clear();
            tx.oncomplete = () => res(true);
            tx.onerror = () => res(false);
          });
        } catch {
          return false;
        }
      }
      async function del(store, key) {
        try {
          const db = await open();
          return await new Promise((res) => {
            const tx = db.transaction([store], "readwrite");
            tx.objectStore(store).delete(key);
            tx.oncomplete = () => res(true);
            tx.onerror = () => res(false);
          });
        } catch {
          return false;
        }
      }
      // Auto-vacuum, run once per session before the catalog hydrates: an UNAPPROVED
      // sighting nobody has re-seen in a long time is cheap to relearn (the passive
      // scanner will re-record it the next time that route is visited) and not worth
      // keeping on disk forever. APPROVED entries are never touched here -- a human
      // confirmed those, so only a human decision (unapprove, or the confidence-aware
      // "Clear stale" pass) removes one. Walks the byLastSeen INDEX with a bounded
      // range so this never has to read the whole store into memory just to find a
      // handful of old rows -- the exact cost this exists to avoid.
      async function vacuumOldUnapproved(cutoffTs) {
        try {
          const db = await open();
          return await new Promise((res) => {
            let removed = 0;
            const tx = db.transaction(["catalog"], "readwrite");
            const idx = tx.objectStore("catalog").index("byLastSeen");
            const range = IDBKeyRange.upperBound(cutoffTs);
            const req = idx.openCursor(range);
            req.onsuccess = (e) => {
              const cur = e.target.result;
              if (!cur) return;
              if (!cur.value.approved) { cur.delete(); removed++; }
              cur.continue();
            };
            tx.oncomplete = () => res(removed);
            tx.onerror = () => res(removed);
          });
        } catch {
          return 0;
        }
      }
      // app-model also mirrored to localStorage so it's available synchronously
      function saveAppModelSync(model) {
        try {
          localStorage.setItem(AM_KEY, JSON.stringify(model));
        } catch {}
      }
      function loadAppModelSync() {
        try {
          return JSON.parse(localStorage.getItem(AM_KEY)) || null;
        } catch {
          return null;
        }
      }
      return {
        available: (function () { try { return !!indexedDB; } catch { return false; } })(),
        put, get, getAll, clearStore, del, vacuumOldUnapproved,
        saveAppModel(model) { saveAppModelSync(model); return put("kv", { k: "appModel", v: model, at: Date.now() }); },
        loadAppModel: loadAppModelSync,
        saveFingerprint(route, fp) { return put("fingerprints", { route, fp, at: Date.now() }); },
        getFingerprint(route) { return get("fingerprints", route); },
        // Right-to-erase: wipe everything this tool has persisted for this origin.
        purge() {
          try { localStorage.removeItem(AM_KEY); localStorage.removeItem(STORAGE_KEY); } catch {}
          dbp = null;
          return new Promise((res) => {
            try {
              const r = indexedDB.deleteDatabase(DB);
              r.onsuccess = r.onerror = r.onblocked = () => res(true);
            } catch { res(false); }
          });
        },
      };
    })();

    // ==========================================================================
    // Locator Catalog \u2014 the "agent" memory. Silently accumulates, across visits,
    // every element it sees and its verified 1-of-1 locator, per origin.
    //
    // Storage is behind a SWAPPABLE BACKEND with a tiny interface so it can be
    // pointed at the cloud later WITHOUT touching any other code:
    //     upsert(records[]) -> Promise      all() -> Promise<records[]>
    //     clear()           -> Promise      kind  -> string (shown in UI)
    // Default backend = local IndexedDB (offline, per-origin, private).
    // ==========================================================================
    function makeCatalogBackend() {
      // --- Local (default): IndexedDB, nothing leaves the browser ---
      return {
        kind: "local (IndexedDB)",
        async upsert(records) { for (const r of records) await KS.put("catalog", r); },
        async all() { return await KS.getAll("catalog"); },
        async clear() { return await KS.clearStore("catalog"); },
        async remove(sigs) { for (const s of sigs) await KS.del("catalog", s); },
        // Deletes old UNAPPROVED rows only, via an index range scan (bounded cost
        // regardless of how large the store has grown). See KS.vacuumOldUnapproved.
        async vacuum(cutoffTs) { return await KS.vacuumOldUnapproved(cutoffTs); },
      };
      // --- To move the catalog to the cloud later, return THIS instead (only
      //     this function changes; the whole rest of the tool is unaffected):
      // const API = "https://your-locator-service.example/api";
      // return {
      //   kind: "cloud",
      //   async upsert(records){ await fetch(API+"/catalog/"+location.hostname,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(records)}); },
      //   async all(){ return (await fetch(API+"/catalog/"+location.hostname)).json(); },
      //   async clear(){ await fetch(API+"/catalog/"+location.hostname,{method:"DELETE"}); },
      //   async remove(sigs){ await fetch(API+"/catalog/"+location.hostname,{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify(sigs)}); },
      //   async vacuum(cutoffTs){ await fetch(API+"/catalog/"+location.hostname+"/vacuum?before="+cutoffTs,{method:"POST"}); },
      // };
    }
    // A locator is worth LEARNING only if it is genuinely accurate & durable \u2014
    // verified 1-of-1 AND anchored on something semantic (URN / test-id / role /
    // label / text / a verified contextual chain). Brittle positional CSS
    // backbones (strategy "css") and non-unique results are the "misleading"
    // locators the knowledge base must NEVER absorb, so the agent only ever gets
    // better from clean data.
    const QUALITY_STRATEGIES = new Set(["urn", "testid", "role", "label", "placeholder", "text", "contextual"]);
    function isQualityLocator(res) {
      return !!(res && res.unique && QUALITY_STRATEGIES.has(res.primaryStrategy) && res.grade !== "F" && res.grade !== "D");
    }
    // Growth controls for the persistent Catalog -- without these it accumulates
    // forever, and the ONE genuinely slow part of this tool (hydrate() reading the
    // whole store into memory on every inject) scales directly with that total.
    const CATALOG_MAX = 2000;                    // hard cap; breach triggers one eviction
    const CATALOG_UNAPPROVED_STALE_DAYS = 90;    // unapproved sighting this old: cheap to relearn, not worth keeping
    const Catalog = (function () {
      const backend = makeCatalogBackend();
      const mem = new Map();          // sig(=locator) -> record
      const approvedIndex = new Map(); // semanticKey -> approved record (for fast recall)
      const dirty = new Set();
      let flushTimer = null, hydrated = false;
      const extractUrn = (s) => { const m = /urn:li:[^"']+/.exec(s || ""); return m ? m[0] : null; };
      // A stable, cross-session identity for an element (independent of the exact
      // locator) so an approved memory can be RECALLED when the element reappears.
      function keyOf(role, name, urn, route) {
        if (urn) return "urn::" + urn;
        if (role && name) return (route || "") + "|" + role + "|" + name;
        return null;
      }
      function elKeys(el, route) {
        const keys = [];
        try { const u = urnAttr(el); if (u && isUrn(u.value)) keys.push("urn::" + u.value); } catch {}
        try { const r = roleOf(el), n = accessibleName(el); if (r && n) keys.push((route || "") + "|" + r + "|" + n); } catch {}
        return keys;
      }
      function indexApproved(rec) { if (rec.approved && rec.key) approvedIndex.set(rec.key, rec); }
      // A record can be genuinely trustworthy without ticking every box -- e.g. the
      // Securiti App Launcher links (interactiveExtra, no href/role/label of their
      // own) only pass because they're pinned to a strong container and get graded A
      // for it (resolveUniqueLocator's strongContainer path), not because of strategy.
      // So "worth protecting from age-based cleanup" is read off the SAME grading the
      // engine already computed, not a second guess at what the element is:
      //   - grade A AND stable                    -> the strongest tier the engine gives out
      //   - re-confirmed by a human 2+ times       -> repeated human confirmation outweighs any single-visit signal
      //   - anchored on a URN                      -> Securiti's own globally-unique, permanent key
      // Anything else is "low confidence": still good enough to have passed
      // isQualityLocator originally, but not good enough to keep forever untouched.
      function confidenceOf(rec) {
        if (rec.grade === "A" && rec.stability === "stable") return "high";
        if ((rec.approvals || 0) >= 2) return "high";
        if (rec.strategy === "urn") return "high";
        return "low";
      }
      // Cap enforcement: only runs once the store actually breaches CATALOG_MAX, so
      // normal use never pays for it. Evicts the single worst record -- lowest
      // confidence first, oldest lastSeen as the tiebreak -- rather than a blind
      // oldest-inserted FIFO, so a rarely-used-but-trusted URN locator never gets
      // pushed out ahead of a low-confidence one nobody's confirmed.
      function evictIfOverCap() {
        if (mem.size <= CATALOG_MAX) return;
        const rank = (r) => (confidenceOf(r) === "low" ? 0 : 1); // low confidence goes first
        let worst = null, worstRank = 2;
        for (const rec of mem.values()) {
          const r = rank(rec);
          if (!worst || r < worstRank || (r === worstRank && rec.lastSeen < worst.lastSeen)) { worst = rec; worstRank = r; }
        }
        if (worst) {
          mem.delete(worst.sig);
          if (worst.approved && worst.key) approvedIndex.delete(worst.key);
          dirty.delete(worst.sig);
          backend.remove([worst.sig]).catch(() => {});
        }
      }
      async function hydrate() {
        if (hydrated) return; hydrated = true;
        // Auto-vacuum FIRST, before reading anything: deletes old unapproved rows via
        // an index range scan, so the getAll() right after never has to carry dead
        // weight that's just going to be discarded anyway.
        try { await backend.vacuum(Date.now() - CATALOG_UNAPPROVED_STALE_DAYS * 24 * 60 * 60 * 1000); } catch {}
        try { for (const r of await backend.all()) { mem.set(r.sig, r); indexApproved(r); } } catch {}
        notify("catalog");
      }
      const curRoute = (route) => route || (typeof routeKey === "function" ? routeKey() : "");
      const suggestions = new Map(); // semanticKey -> pending heal suggestion (human must confirm)
      function record(res, route, confirmed) {
        route = curRoute(route);
        // QUALITY GATE: only accurate, durable locators are ever learned.
        if (!res || !res.primary || !isQualityLocator(res)) return null;
        const sig = res.primary, now = Date.now();
        const key = keyOf(res.role, res.accName, extractUrn(res.primary), route);
        // DRIFT / HEAL (spec #5 \u2014 NO SILENT HEALING): if this element's durable
        // semantic identity was approved before but its best locator has CHANGED,
        // we NEVER silently swap the stored locator during an autonomous scan.
        //   - confirmed (a human re-approved/copied THIS element) => heal now.
        //   - otherwise                                            => only SUGGEST
        //     the update for a human to confirm; leave the approved memory intact.
        if (key) {
          const appr = approvedIndex.get(key);
          if (appr && appr.sig !== sig) {
            if (confirmed) {
              mem.delete(appr.sig);
              Object.assign(appr, { sig, primary: res.primary, css: res.css, strategy: res.primaryStrategy, urn: extractUrn(res.primary), grade: res.grade, stability: res.stability, lastSeen: now, healedAt: now, heals: (appr.heals || 0) + 1, prevPrimary: appr.primary });
              mem.set(sig, appr); approvedIndex.set(key, appr); dirty.add(sig); suggestions.delete(key);
              if (!flushTimer) flushTimer = setTimeout(flush, 4000);
              notify("catalog");
              return appr;
            }
            suggestions.set(key, { key, oldPrimary: appr.primary, newPrimary: res.primary, newCss: res.css, strategy: res.primaryStrategy, grade: res.grade, at: now });
            notify("catalog");
            // fall through: store the new locator as a normal (unapproved) entry too.
          }
        }
        const prev = mem.get(sig);
        const rec = prev
          ? Object.assign(prev, { lastSeen: now, count: prev.count + 1, grade: res.grade, stability: res.stability })
          : { sig, route: route || "", primary: res.primary, strategy: res.primaryStrategy, css: res.css,
              role: res.role || "", name: res.accName || "", urn: extractUrn(res.primary),
              key: keyOf(res.role, res.accName, extractUrn(res.primary), route),
              grade: res.grade, stability: res.stability, approved: false,
              firstSeen: now, lastSeen: now, count: 1 };
        mem.set(sig, rec); dirty.add(sig);
        evictIfOverCap();
        if (!flushTimer) flushTimer = setTimeout(flush, 4000);
        return rec;
      }
      // Human-confirmed a locator (e.g. copied it) \u2192 burn it into memory as
      // "approved". This is the reinforcement signal that makes the tool improve.
      function approve(res, route) {
        const rec = record(res, curRoute(route), true);   // human-confirmed => may heal
        if (!rec) return;
        rec.approved = true; rec.approvedAt = Date.now(); rec.approvals = (rec.approvals || 0) + 1;
        indexApproved(rec);
        dirty.add(rec.sig); flush();      // persist approvals promptly
        try { registry.approvedStrategies = registry.approvedStrategies || {}; registry.approvedStrategies[rec.strategy] = (registry.approvedStrategies[rec.strategy] || 0) + 1; } catch {}
        notify("catalog");
      }
      // Human accepts a pending drift SUGGESTION (explicit confirmation of a heal).
      function acceptSuggestion(key) {
        const s = suggestions.get(key), appr = approvedIndex.get(key);
        if (!s || !appr) return false;
        mem.delete(appr.sig);
        Object.assign(appr, { sig: s.newPrimary, primary: s.newPrimary, css: s.newCss, strategy: s.strategy, urn: extractUrn(s.newPrimary), grade: s.grade, lastSeen: Date.now(), healedAt: Date.now(), heals: (appr.heals || 0) + 1, prevPrimary: appr.primary });
        mem.set(s.newPrimary, appr); approvedIndex.set(key, appr); dirty.add(s.newPrimary);
        suggestions.delete(key); flush(); notify("catalog");
        return true;
      }
      // If we've seen & approved a locator for THIS element before, and it still
      // resolves to exactly this element, reuse it (verified recall = correct + fast).
      function recall(el, route) {
        route = curRoute(route);
        for (const k of elKeys(el, route)) {
          const rec = approvedIndex.get(k);
          if (rec && rec.css) { try { if (matchesUniquely(rec.css, el)) return rec; } catch {} }
        }
        return null;
      }
      // Serialized behind a single chain, not called directly: two flushes fired close
      // together (e.g. approve() twice in a row) would otherwise both read/clear `dirty`
      // in the same tick and race their own backend.upsert() calls, so whichever one's
      // caller happened to be awaited could resolve before an EARLIER flush's write had
      // actually landed. Chaining onto `flushChain` makes every flush -- fire-and-forget
      // or awaited -- run strictly after the one before it finishes.
      let flushChain = Promise.resolve();
      function flush() {
        flushTimer = null;
        flushChain = flushChain.then(async () => {
          if (!dirty.size) return;
          const recs = [...dirty].map((s) => mem.get(s)).filter(Boolean);
          dirty.clear();
          try { await backend.upsert(recs); } catch {}
        });
        return flushChain;
      }
      // Human decides a past approval was wrong (mis-click, wrong element) and wants
      // it back out of memory WITHOUT wiping everything else learned for this site.
      // Demotes to a plain unapproved sighting rather than deleting outright -- it
      // was still genuinely seen, just no longer human-confirmed.
      function unapprove(sig) {
        const rec = mem.get(sig);
        if (!rec || !rec.approved) return false;
        rec.approved = false;
        if (rec.key) approvedIndex.delete(rec.key);
        dirty.add(sig); flush();
        notify("catalog");
        return true;
      }
      // Human-triggered "Clear stale" -- the smart middle ground between doing
      // nothing and nuking the whole site's memory. TWO factors must BOTH hold, not
      // either alone: age (not seen in `days`) AND low confidence (confidenceOf).
      // Age alone would drop a URN-anchored locator on a route you just haven't
      // revisited in a month, even though it's exactly the kind of anchor that's
      // still correct a year later. Confidence alone would drop a low-tier locator
      // you used an hour ago. Requiring both is what keeps this from ever touching
      // the "doesn't tick every box but is still trusted" cases (line ~2843).
      async function clearStale(days) {
        const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
        const drop = [];
        for (const rec of mem.values()) {
          if (rec.lastSeen >= cutoff) continue;          // recently used -> keep regardless of tier
          if (confidenceOf(rec) === "high") continue;    // trusted -> keep regardless of age
          drop.push(rec);
        }
        for (const rec of drop) {
          mem.delete(rec.sig);
          if (rec.approved && rec.key) approvedIndex.delete(rec.key);
          dirty.delete(rec.sig);
        }
        try { await backend.remove(drop.map((r) => r.sig)); } catch {}
        if (drop.length) notify("catalog");
        return drop.length;
      }
      return {
        hydrate, record, approve, unapprove, recall, flush, acceptSuggestion, clearStale,
        confidenceOf,
        suggestions: () => [...suggestions.values()],
        size: () => mem.size,
        approvedCount: () => approvedIndex.size,
        approvedList: () => [...approvedIndex.values()].sort((a, b) => (b.approvedAt || 0) - (a.approvedAt || 0)),
        all: () => [...mem.values()],
        backendKind: backend.kind,
        clear: async () => { mem.clear(); approvedIndex.clear(); dirty.clear(); suggestions.clear(); try { await backend.clear(); } catch {} notify("catalog"); },
      };
    })();

    // ==========================================================================
    // Learner \u2014 infer this app's conventions from observed elements
    // ==========================================================================
    function sampleConventions(doc) {
      // Returns counts we can aggregate across frames/visits.
      const s = { testAttrs: {}, hashedPrefix: {}, idGen: {}, roles: {}, urnAttrs: {}, rowKey: 0, count: 0, virtual: 0 };
      let els;
      try {
        els = doc.querySelectorAll(interactiveSelector());
      } catch {
        return s;
      }
      try { s.virtual = doc.querySelectorAll ? doc.querySelectorAll(VIRTUAL_LIB_SEL).length : 0; } catch {}
      for (const el of els) {
        if (isOwnNode(el)) continue;
        s.count++;
        for (const a of el.attributes) {
          if (/^data-(testid|test|qa|cy|test-id|automation|e2e|selenium|hook)/i.test(a.name)) s.testAttrs[a.name] = (s.testAttrs[a.name] || 0) + 1;
          if (isUrn(a.value)) s.urnAttrs[a.name] = (s.urnAttrs[a.name] || 0) + 1;
        }
        if (el.getAttribute("data-row-key")) s.rowKey++;
        for (const c of classListOf(el)) {
          const m = c.match(/^([a-zA-Z]{1,8})[-_]([A-Za-z0-9]{4,})$/);
          if (!m || UTILITY_CLASS_RE.test(c)) continue;
          // Only treat as a hashed prefix if the SUFFIX actually looks hashed \u2014
          // has digits mixed with letters, or mixed case (e.g. "1a2b3c",
          // "bdfBwQ"). A plain-word suffix ("widget-header") is semantic, not a
          // hash, so learning must not blacklist its prefix.
          const suf = m[2];
          const hashy = (/\d/.test(suf) && /[a-z]/i.test(suf)) || (/[a-z]/.test(suf) && /[A-Z]/.test(suf));
          if (hashy) s.hashedPrefix[m[1] + "-"] = (s.hashedPrefix[m[1] + "-"] || 0) + 1;
        }
        if (el.id) {
          const m = el.id.match(/^([a-zA-Z]{2,}[-_:])/);
          if (m && /\d/.test(el.id)) s.idGen[m[1]] = (s.idGen[m[1]] || 0) + 1;
        }
        const r = roleOf(el);
        if (r) s.roles[r] = (s.roles[r] || 0) + 1;
      }
      return s;
    }
    function topKey(obj, min) {
      let best = null, n = -1;
      for (const k in obj) if (obj[k] > n) { n = obj[k]; best = k; }
      return n >= (min || 1) ? best : null;
    }
    function keysAbove(obj, threshold) {
      return Object.keys(obj).filter((k) => obj[k] >= threshold);
    }
    // Merge a fresh sample into the registry and (at top) recompute the app-model.
    function learnFrom(doc) {
      const s = sampleConventions(doc);
      if (s.count) registry.samples.push(s);
      if (registry.samples.length > 50) registry.samples.shift();
      if (!IS_TOP) return;
      recomputeAppModel();
    }
    function recomputeAppModel() {
      const agg = { testAttrs: {}, hashedPrefix: {}, idGen: {}, roles: {}, urnAttrs: {}, rowKey: 0, virtual: 0, count: 0, samples: registry.samples.length };
      for (const s of registry.samples) {
        agg.count += s.count; agg.rowKey += (s.rowKey || 0); agg.virtual += (s.virtual || 0);
        for (const k in s.testAttrs) agg.testAttrs[k] = (agg.testAttrs[k] || 0) + s.testAttrs[k];
        for (const k in s.hashedPrefix) agg.hashedPrefix[k] = (agg.hashedPrefix[k] || 0) + s.hashedPrefix[k];
        for (const k in s.idGen) agg.idGen[k] = (agg.idGen[k] || 0) + s.idGen[k];
        for (const k in s.roles) agg.roles[k] = (agg.roles[k] || 0) + s.roles[k];
        for (const k in (s.urnAttrs || {})) agg.urnAttrs[k] = (agg.urnAttrs[k] || 0) + s.urnAttrs[k];
      }
      const testAttr = topKey(agg.testAttrs, 3);
      const model = {
        origin: location.hostname,
        sampledElements: agg.count,
        testAttr,
        testAttrCoverage: testAttr ? +(agg.testAttrs[testAttr] / Math.max(1, agg.count)).toFixed(2) : 0,
        hashedPrefixes: keysAbove(agg.hashedPrefix, Math.max(4, agg.count * 0.15)),
        idGenPrefixes: keysAbove(agg.idGen, Math.max(3, agg.count * 0.1)),
        topRoles: Object.entries(agg.roles).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k}(${v})`),
        urnAttr: topKey(agg.urnAttrs, 2),
        usesRowKey: agg.rowKey > 0,
        virtualized: agg.virtual > 0,
        updatedAt: Date.now(),
      };
      registry.appModel = model;
      KS.saveAppModel(model);
      notify("learn");
      return model;
    }

    // ==========================================================================
    // DriftDetector \u2014 fingerprint a route, diff vs stored ("since last visit")
    // ==========================================================================
    function routeKey() {
      return location.pathname + location.hash;
    }
    function pageFingerprint(doc) {
      // Cheap: for each interactive element, a stable-ish key + an attr hash.
      const map = {};
      let els;
      try {
        els = doc.querySelectorAll(interactiveSelector());
      } catch {
        return map;
      }
      for (const el of els) {
        if (isOwnNode(el)) continue;
        const key = stableAnchor(el) || `${tagOf(el)}:${(accessibleName(el) || "").slice(0, 30)}`;
        const sig = [tagOf(el), roleOf(el) || "", (accessibleName(el) || "").slice(0, 40)].join("|");
        map[key] = sig;
      }
      return map;
    }
    function diffFingerprints(oldFp, newFp) {
      const added = [], removed = [], changed = [];
      for (const k in newFp) {
        if (!(k in oldFp)) added.push(k);
        else if (oldFp[k] !== newFp[k]) changed.push({ key: k, from: oldFp[k], to: newFp[k] });
      }
      for (const k in oldFp) if (!(k in newFp)) removed.push(k);
      return { added, removed, changed };
    }
    async function checkDrift() {
      if (!IS_TOP) return null;
      const route = routeKey();
      const newFp = pageFingerprint(document);
      const stored = await KS.getFingerprint(route);
      let report = null;
      if (stored && stored.fp) {
        const d = diffFingerprints(stored.fp, newFp);
        if (d.added.length || d.removed.length || d.changed.length) {
          report = { route, since: stored.at, added: d.added.length, removed: d.removed.length, changed: d.changed.length, detail: d, at: Date.now() };
          registry.drift = report;
          notify("drift");
        }
      }
      KS.saveFingerprint(route, newFp);
      return report;
    }

    // ==========================================================================
    // NetworkObserver (metadata-only; correlates errors with API calls)
    // ==========================================================================
    const net = { origFetch: null, origOpen: null, origSend: null, patched: false };
    function gqlOpName(url, body) {
      // Only read op name if it's trivially in the URL query; never store bodies.
      try {
        if (/graphql/i.test(String(url))) {
          const u = new URL(String(url), location.href);
          return u.searchParams.get("operationName") || u.searchParams.get("op") || "graphql";
        }
      } catch {}
      return null;
    }
    function logNet(entry) {
      registry.network.push(entry);
      if (registry.network.length > 200) registry.network.shift();
    }
    function patchNetwork() {
      if (net.patched) return;
      net.patched = true;
      net.origFetch = window.fetch;
      if (net.origFetch) {
        window.fetch = function (resource, config) {
          let entry = null, start = 0;
          try {
            const method = ((config && config.method) || (resource && resource.method) || "GET").toUpperCase();
            const url = (resource && resource.url) || String(resource);
            start = performance.now();
            entry = { type: "fetch", method, url: sanitizeUrl(url), gql: gqlOpName(url), t: Date.now(), status: null, ms: null };
          } catch { entry = null; }
          // Native fetch must be invoked with `this === window`; app code often
          // calls bare `fetch(url)` from strict/ESM modules where `this` is
          // undefined, which would throw "Illegal invocation" if we forwarded it.
          const p = net.origFetch.apply(window, arguments);
          // Instrumentation is best-effort and must NEVER alter the app's result:
          // observe on a detached .then and always hand back the original promise.
          try {
            p.then(
              (resp) => { try { if (entry) { entry.status = resp.status; entry.ms = Math.round(performance.now() - start); logNet(entry); } } catch {} },
              () => { try { if (entry) { entry.status = "error"; entry.ms = Math.round(performance.now() - start); logNet(entry); } } catch {} }
            );
          } catch {}
          return p;
        };
      }
      try {
        const XHR = window.XMLHttpRequest;
        net.origOpen = XHR.prototype.open;
        net.origSend = XHR.prototype.send;
        XHR.prototype.open = function (method, url) {
          try {
            this.__li = { type: "xhr", method: String(method || "GET").toUpperCase(), url: sanitizeUrl(url), gql: gqlOpName(url), t: Date.now() };
          } catch {}
          return net.origOpen.apply(this, arguments);
        };
        XHR.prototype.send = function () {
          try {
            const e = this.__li;
            if (e) {
              const start = performance.now();
              this.addEventListener("loadend", () => { try { e.status = this.status || "error"; e.ms = Math.round(performance.now() - start); logNet(e); } catch {} });
            }
          } catch {}
          return net.origSend.apply(this, arguments);
        };
      } catch {}
    }
    function unpatchNetwork() {
      if (!net.patched) return;
      try {
        if (net.origFetch) window.fetch = net.origFetch;
        if (net.origOpen) window.XMLHttpRequest.prototype.open = net.origOpen;
        if (net.origSend) window.XMLHttpRequest.prototype.send = net.origSend;
      } catch {}
      net.patched = false;
    }
    function correlateError(entry) {
      // Find the most recent network call within 1.5s of a transient error.
      const now = Date.now();
      let best = null;
      for (let i = registry.network.length - 1; i >= 0; i--) {
        const n = registry.network[i];
        if (now - n.t > 1500) break;
        if (n.status === "error" || (typeof n.status === "number" && n.status >= 400)) { best = n; break; }
        if (!best) best = n;
      }
      return best;
    }

    // ==========================================================================
    // ActionRecorder \u2014 watch user actions \u2192 Playwright test (cross-frame)
    // ==========================================================================
    const rec = { debounce: {}, resolved: new WeakMap(), downXY: null };
    function recAction(a) {
      if (!registry.recording) return;
      a.t = Date.now();
      registry.actions.push(a);
      registry.redoStack = []; // a new action invalidates whatever undo() had parked for redo
      notify("record");
    }
    function locatorForTarget(target) {
      const el = findInteractiveRoot(target);
      // Keep the BEST resolution seen for this element during the recording, not the
      // first and not the last. Re-deriving on every keystroke let a transient DOM change
      // (the autocomplete panel opening) swap a grade-A getByTestId for a weaker
      // getByPlaceholder mid-flow; caching the first instead locked in whichever locator
      // happened to be available at the moment of the very first event, which on the real
      // app was also the weaker one. Best-of wins on both counts.
      const res = resolveUniqueLocator(el);
      const name = accessibleName(el), role = roleOf(el);
      // CAP the description. An element with no accessible name of its own inherits
      // name-from-contents, which for a container is the whole page's text -- that
      // used to be pasted verbatim into the generated test's comment, the test title
      // and the "brittle steps" header (observed live: a ~1,800-character comment).
      const shortName = name && name.length > 60 ? name.slice(0, 57) + "..." : name;
      const desc = shortName ? `${role || tagOf(el)} "${shortName}"` : (res.label || role || tagOf(el));
      const out = { primary: res.primary, css: res.css, grade: res.grade, strategy: res.primaryStrategy, desc };
      if (!registry.recording) return out;
      markCheckup(res, "record"); // this element is now part of the recording -- eligible for Doctor's checkup list
      const rank = (g) => ({ A: 5, B: 4, C: 3, D: 2, F: 1 }[g] || 0);
      const prev = rec.resolved.get(el);
      // Strictly weaker only -- not >=. A login form's Continue/Sign-in button is the
      // SAME persistent element across steps (Vue swaps its text, not the node); a TIE
      // used to return the stale cached desc verbatim, so a second click correctly
      // graded A role but now reading "Sign in" still recorded as 'button "Continue"'
      // Equal-or-better always takes the fresh resolution.
      if (prev && rank(prev.grade) > rank(out.grade)) return prev;   // keep the stronger
      rec.resolved.set(el, out);
      // A step already emitted with the weaker locator should be corrected in place, so
      // the exported test does not mix two locators for one element.
      if (prev) for (const a of registry.actions) if (a.primary === prev.primary) { a.primary = out.primary; a.grade = out.grade; a.strategy = out.strategy; }
      return out;
    }
    // A click that lands on <body>/<html> is a click on nothing addressable -- it is
    // never a meaningful test step, and recording it produces a locator no engineer
    // would accept. Drop it rather than emitting a body:has(...) selector.
    function isUnrecordableTarget(el) {
      const t = tagOf(el);
      return t === "body" || t === "html" || el === document.documentElement;
    }
    // How far the pointer has to move between mousedown and click before this is
    // treated as the tail end of a drag gesture, not a real click. Comfortably above
    // any natural hand jitter on a genuine click, comfortably below any deliberate drag.
    const DRAG_TAIL_PX = 8;
    function onRecClick(e, dbl) {
      if (!registry.recording) return;
      const raw = realTarget(e);
      // Own-UI check moved ahead of the drag-tail check below: a click landing on
      // the tool's own panel must NEVER
      // contribute anything to the recording -- not a click, and not a spurious
      // "DRAG DETECTED" note either, which is what used to happen if a real-page
      // drag released on (say) the panel's Stop-recording button. Clearing downXY
      // here too so a stale baseline from that own-UI click can't leak into
      // whatever the NEXT real click on the actual page measures against.
      if (isOwnNode(raw)) { rec.downXY = null; return; }
      // Dragging a real resize handle (mousedown,
      // move, mouseup) fires a native 'click' at the RELEASE point -- this recorder
      // had no concept of drag-and-drop at all, so that click got captured as an
      // ordinary click on whatever ancestor happened to be under the cursor at
      // release (observed: a resize-bar drag recorded as a click on the page's own
      // <main> content area -- not even close to the actual drag handle). That is
      // actively MISLEADING, worse than recording nothing. True drag support (a
      // dedicated action type + start/end locators) is real, separate future work --
      // for now, just stop the wrong click from poisoning the recording, and leave an
      // honest trace instead of a silent gap.
      if (rec.downXY) {
        const dx = e.clientX - rec.downXY.x, dy = e.clientY - rec.downXY.y;
        const dragged = Math.abs(dx) > DRAG_TAIL_PX || Math.abs(dy) > DRAG_TAIL_PX;
        rec.downXY = null;
        if (dragged) {
          const last = registry.actions[registry.actions.length - 1];
          if (!(last && last.type === "note" && last.text.indexOf("DRAG DETECTED") === 0)) {
            recAction({ type: "note", text: "DRAG DETECTED, not recorded -- this tool doesn't capture drag-and-drop yet.\nIf this step was a real drag (resize/reorder/etc), add the equivalent step by hand." });
          }
          return;
        }
      }
      if (isUnrecordableTarget(findInteractiveRoot(raw))) return;
      const loc = locatorForTarget(raw);
      if (dbl) {
        // A dblclick fires after two clicks \u2014 drop the trailing single-clicks
        // on the same target so we emit one .dblclick() instead of click+click+dblclick.
        const acts = registry.actions;
        while (acts.length && acts[acts.length - 1].type === "click" && acts[acts.length - 1].primary === loc.primary && Date.now() - acts[acts.length - 1].t < 500) acts.pop();
        recAction({ type: "dblclick", primary: loc.primary, grade: loc.grade, strategy: loc.strategy, desc: loc.desc });
      } else {
        recAction({ type: "click", primary: loc.primary, grade: loc.grade, strategy: loc.strategy, desc: loc.desc });
      }
    }
    function onRecInput(e) {
      if (!registry.recording) return;
      const raw = realTarget(e);
      if (isOwnNode(raw)) return;
      // <select>, checkboxes and radios also fire `input`, but they are handled by
      // onRecChange as selectOption()/check()/uncheck(). Recording them here too
      // emitted a SECOND, invalid step -- observed live, the generated test called
      // .fill('snowflake') on a <select> and Playwright failed with
      // "Element is not an <input>, <textarea> or [contenteditable] element".
      const rtag = tagOf(raw), rtype = (raw.getAttribute && (raw.getAttribute("type") || "")).toLowerCase();
      if (rtag === "select" || rtype === "checkbox" || rtype === "radio" || rtype === "file") return;
      const loc = locatorForTarget(raw);
      const sensitive = isSensitiveField(raw);
      const key = "in:" + loc.primary;
      clearTimeout(rec.debounce[key]);
      rec.debounce[key] = setTimeout(() => {
        const value = sensitive ? "" : (raw.value != null ? String(raw.value) : "").slice(0, 120);
        // An EMPTY fill on the field we just filled is the clear-before-type, not a test
        // step. The real app produced `.fill(data.step4)` with an empty string right after
        // a real one, which reads as a bug in the generated test.
        const prev = registry.actions[registry.actions.length - 1];
        const redundant = !value && !sensitive && prev && prev.type === "fill" && prev.primary === loc.primary;
        if (!redundant) {
          // Never record the typed value of a password/secret/PII field.
          recAction({ type: "fill", primary: loc.primary, grade: loc.grade, strategy: loc.strategy, desc: loc.desc, value, masked: sensitive });
        }
        delete rec.debounce[key];
      }, 350);
    }
    function onRecChange(e) {
      if (!registry.recording) return;
      const raw = realTarget(e);
      if (isOwnNode(raw)) return;
      const tag = tagOf(raw);
      const loc = locatorForTarget(raw);
      if (tag === "select") recAction({ type: "select", primary: loc.primary, grade: loc.grade, strategy: loc.strategy, desc: loc.desc, value: (raw.value || "").slice(0, 120) });
      else if (raw.type === "checkbox" || raw.type === "radio") recAction({ type: raw.checked ? "check" : "uncheck", primary: loc.primary, grade: loc.grade, strategy: loc.strategy, desc: loc.desc });
      // A file input's own 'change' fires here just
      // like any other form control, but there was no branch for it -- the CLICK that
      // opens the native file chooser got recorded, but which file was actually chosen
      // never did. A replayed script would just reopen that chooser and hang forever;
      // Playwright can't drive a real OS dialog. onRecInput deliberately ignores
      // type=file (a fake "C:\fakepath\..." string is not a real value to .fill()) --
      // this is the ONLY place a file selection can be captured at all. Filenames only,
      // never full paths: the real local path is this machine's, not replayable
      // anywhere else, and baking it in would leak local filesystem layout for nothing.
      else if (raw.type === "file") recAction({ type: "setFiles", primary: loc.primary, grade: loc.grade, strategy: loc.strategy, desc: loc.desc, value: raw.files ? [...raw.files].map((f) => f.name).join(", ") : "" });
    }
    function onRecKey(e) {
      if (!registry.recording) return;
      // Enter and Escape are both always a DELIBERATE action (submit / dismiss), never
      // incidental -- unlike Tab (fires on every field-to-field move while typing
      // normally, mostly noise) or bare arrow keys (only meaningful combined with the
      // Enter/click that follows, which already gets its own action). A keyboard-only
      // flow that dismisses a dropdown/dialog with
      // Escape recorded NOTHING for that step -- silently dropped, no error.
      if (e.key === "Enter" || e.key === "Escape") {
        const raw = realTarget(e);
        if (isOwnNode(raw)) return;
        const loc = locatorForTarget(raw);
        recAction({ type: "press", primary: loc.primary, grade: loc.grade, strategy: loc.strategy, desc: loc.desc, key: e.key });
      }
    }
    function recNavigation(url) {
      if (!registry.recording) return;
      // The shell appends ?t=<epoch> to its nav URLs. Baking that into page.goto() puts a
      // dead timestamp in the committed test; the durable part is what matters.
      let clean = url;
      try {
        const u = new URL(url, location.href);
        if (VOLATILE_QUERY_RE.test(u.search)) { u.search = ""; clean = u.toString(); }
      } catch {}
      // onRoute() below fires on pushState AND replaceState AND popstate -- a single
      // user-perceived SPA route change can legitimately trigger several of those in a
      // row (a route guard's redirect, then the app's own query-param cleanup, etc).
      // Recording each one produced 6 near-identical "open the application" steps for
      // one real navigation. Collapse immediate repeats here,
      // at the source, so every consumer of registry.actions sees the real sequence.
      const last = registry.actions[registry.actions.length - 1];
      if (last && last.type === "navigate" && last.url === clean) return;
      recAction({ type: "navigate", url: clean, title: (typeof document !== "undefined" && document.title) ? document.title : "" });
    }
    // Turn the recorded steps into the FINEST possible editable Playwright test: a
    // runnable, self-documenting scaffold that reads as INTENT (not a replay) and
    // carries everything an automation engineer / dev / reviewer needs -- sequenced
    // steps, per-step locator grade + strategy, brittle-locator FIXMEs with a fix,
    // hoisted+labelled test data, web-first (auto-retrying) assertion suggestions,
    // and config/setup guidance. Follows Playwright 2026 best practices (web-first
    // assertions, role/label/test-id locators, no sleeps). Output is pure-ASCII so
    // it is safe in any editor / CI. NOTE: the recorder feeds this only -- learning
    // (Catalog) is never fed a recorded step.
    function scriptComment(a) {
      const verbs = { click: "Click", dblclick: "Double-click", fill: "Type into", select: "Choose an option in", check: "Check", uncheck: "Uncheck", press: "Press " + (a.key || "key") + " in", setFiles: "Choose a file for" };
      return (verbs[a.type] || a.type) + (a.desc ? " " + a.desc : "");
    }
    function stepAssertion(a, i, ind) {
      // A toast/banner this recorder actually SAW right after this step beats any
      // guessed placeholder -- emit it live (uncommented), not as another "enable
      // this" suggestion. An error is the one severity that must never become a
      // passing assertion: that would encode the bug as expected behaviour, so it
      // becomes a loud FIXME instead.
      if (a.assert) {
        if (a.assert.severity === "error") {
          return ind + "// FIXME: this step triggered an error message: " + q(a.assert.text) + " -- fix the underlying issue, don't silence this.";
        }
        // This is a CONFIRMATION toast/banner, not the action itself -- the click/fill
        // above it already ran. A hard assert here can flake on a toast that vanishes
        // before this line executes ('Updating...' visible for
        // well under a second) and fail the whole test over UI that already did its
        // job. softCheck warns instead of failing when it's simply gone by now; a
        // REAL problem (the create silently not happening) still shows up as the
        // next real step failing for real, which does still hard-fail.
        return ind + "await softCheck(" + q(a.assert.text) + ", () => expect(page.getByText(" + q(a.assert.text) + ")).toBeVisible());   // observed on screen right after this step (" + a.assert.severity + ")";
      }
      // A commented, web-first (auto-retrying) assertion the engineer can enable.
      switch (a.type) {
        case "navigate": return ind + "// ASSERT (enable + edit): await expect(page).toHaveTitle(/.../);  // or await expect(page).toHaveURL(/.../);";
        case "fill": return a.masked ? null : ind + "// ASSERT (enable): await expect(" + a.primary + ").toHaveValue(data.step" + (i + 1) + ");";
        case "select": return ind + "// ASSERT (enable): await expect(" + a.primary + ").toHaveValue(data.step" + (i + 1) + ");";
        case "check": return ind + "// ASSERT (enable): await expect(" + a.primary + ").toBeChecked();";
        case "uncheck": return ind + "// ASSERT (enable): await expect(" + a.primary + ").not.toBeChecked();";
        case "click": case "dblclick": return ind + "// ASSERT (enable + edit): await expect(page.getByRole('...', { name: '...' })).toBeVisible();";
        default: return null;
      }
    }
    // A goto to the login page is not a step of the flow -- it is what the
    // recording session's own login already did before recording started, or
    // a stray reload of it. Emitting it produces exactly the bug the shared
    // authenticated-runner contract exists to avoid (the runner's session
    // project already logs in; a spec-level nav to /login/signin lands on an
    // unauthenticated context instead). Mirrors that runner's own lint rule.
    const LOGIN_NAV_RE = /(?:\/#\/)?(?:login|signin|sign-in)\b/i;
    // Shared by both exporters. Two jobs:
    //  1. Drop EVERY action recorded while on a login-matching page, not just the
    //     navigate line to it. A goto was already excluded (see LOGIN_NAV_RE's own
    //     comment) but the email/password fills and Continue clicks typed on that
    //     same page were still emitted -- with no goto in front of them, since the
    //     line that would have opened it was the very thing just excluded -- an
    //     exported script started with `.fill()` on an "Email"
    //     locator, no page open before it, on a page the shared runner's own
    //     auth.setup already logs into -- guaranteed to fail at step 1 for a reason
    //     that has nothing to do with the flow being recorded.
    //  2. Collapse consecutive noise `recNavigation`'s own dedupe (see above) can't
    //     reach because it isn't a navigate: two typed values in a row on the same
    //     field (one person typing), a click on a field immediately followed by
    //     filling it (fill() focuses it itself), and a real action repeated with
    //     nothing else between it and itself (a slow/unresponsive control, or a
    //     retried step) -- keeping N identical clicks in a row is never the intent
    //     of a test, whatever produced them.
    function pruneRecordedActions(rawActions) {
      const stripped = [];
      let onLogin = false;
      for (const a of rawActions) {
        if (a.type === "navigate") {
          onLogin = LOGIN_NAV_RE.test(a.url || "");
          if (onLogin) continue;
        } else if (onLogin) continue;
        stripped.push(a);
      }
      let startAction = null, bodyActs = stripped;
      if (stripped.length && stripped[0].type === "navigate") { startAction = stripped[0]; bodyActs = stripped.slice(1); }
      const pruned = { coalescedFills: 0, clickBeforeFill: 0, repeatNav: 0, repeatAction: 0 };
      const flat = [];
      let lastUrl = startAction ? startAction.url : null;
      for (const a of bodyActs) {
        if (a.type === "navigate") {
          if (a.url === lastUrl) { pruned.repeatNav++; continue; }
          lastUrl = a.url;
          flat.push(a);
          continue;
        }
        const prev = flat[flat.length - 1];
        if (prev && prev.primary === a.primary && prev.type === a.type && (a.type === "fill" || a.type === "select")) {
          flat[flat.length - 1] = a; pruned.coalescedFills++; continue;
        }
        if (prev && prev.type === "click" && prev.primary === a.primary && (a.type === "fill" || a.type === "select")) {
          flat[flat.length - 1] = a; pruned.clickBeforeFill++; continue;
        }
        if (prev && prev.type === a.type && prev.primary === a.primary && prev.key === a.key
          && (a.type === "click" || a.type === "dblclick" || a.type === "check" || a.type === "uncheck" || a.type === "press")) {
          pruned.repeatAction++; continue;
        }
        flat.push(a);
      }
      return { startAction, flat, pruned };
    }
    function exportPlaywright() {
      const { startAction, flat: bodyFlat, pruned } = pruneRecordedActions(registry.actions);
      const acts = startAction ? [startAction, ...bodyFlat] : bodyFlat;
      const noise = [];
      if (pruned.repeatNav) noise.push(pruned.repeatNav + " duplicate navigation(s) to the same URL collapsed");
      if (pruned.repeatAction) noise.push(pruned.repeatAction + " identical repeated action(s) collapsed (nothing else happened in between)");
      if (pruned.coalescedFills) noise.push(pruned.coalescedFills + " duplicate-value fill(s) on the same field coalesced to the final value");
      if (pruned.clickBeforeFill) noise.push(pruned.clickBeforeFill + " click-before-fill on the same field dropped (fill() focuses it)");
      const ind = "  ";
      const nav = acts.find((a) => a.type === "navigate") || {};
      const startUrl = nav.url || (typeof location !== "undefined" ? location.href : "");
      const pageTitle = nav.title || (typeof document !== "undefined" && document.title ? document.title : "");
      let host = ""; try { host = new URL(startUrl).host; } catch { host = ""; }
      // "note" is a non-executable marker (e.g. a cross-origin-frame handoff) -- it
      // has no locator and must never be counted as a verified/brittle step.
      const steps = acts.filter((a) => a.type !== "navigate" && a.type !== "note");
      const isBrittle = (a) => a.grade === "F" || a.grade === "D";
      const gtag = (a) => a.grade ? "[" + a.grade + (a.strategy ? " " + a.strategy : "") + "]" : "";
      const brittle = steps.filter(isBrittle);
      const robust = steps.length - brittle.length;
      // Human-readable name suggestion from the flow's apparent goal: the last
      // described CLICK (usually the submit/confirm), never a password/fill step;
      // fall back to any described step, then the host.
      const rev = [...steps].reverse();
      const goal = rev.find((a) => (a.type === "click" || a.type === "dblclick") && a.desc && !a.masked)
        || rev.find((a) => a.desc && !a.masked) || steps[0];
      const nameSuggest = (goal && goal.desc ? goal.desc.replace(/["']/g, "") : (host ? host + " flow" : "recorded flow")).slice(0, 70);

      const H = [];
      H.push("/**");
      H.push(" * ==========================================================================");
      H.push(" *  Playwright test  -  generated by Locator Inspector " + VERSION + " (Securiti QA)");
      H.push(" * ==========================================================================");
      H.push(" *  Flow             : " + nameSuggest);
      H.push(" *  Recorded         : " + new Date().toISOString());
      H.push(" *  Start URL        : " + startUrl);
      if (pageTitle) H.push(" *  Page             : " + pageTitle);
      // This app is responsive and drops getByRole matches below its layout
      // breakpoint (~1320px collapses toolbars into an overflow menu). A comment
      // is the only safe way to carry this: emitting it as a real statement
      // (test.use({ viewport }) or page.setViewportSize) either violates the
      // shared runner's no-test.use contract or fights whatever VIEWPORT it sets.
      if (typeof window !== "undefined" && window.innerWidth > 0 && window.innerHeight > 0) {
        H.push(" *  Viewport         : " + window.innerWidth + "x" + window.innerHeight + "  (match this in the runner's VIEWPORT setting)");
      }
      // steps.length excludes the navigate, but the emitted comments number every line
      // including it, so reporting steps.length read as an off-by-one against the file.
      H.push(" *  Steps            : " + acts.length + " (" + steps.length + " action(s) + navigation)");
      H.push(" *  Locators         : " + robust + " verified 1-of-1, " + brittle.length + " flagged brittle");
      // liveAsserts: this recorder actually SAW a toast/banner appear right after the
      // step and turned it into a real, uncommented assertion -- not a guess.
      const liveAsserts = steps.filter((a) => a.assert && a.assert.severity !== "error").length;
      const errorFlags = steps.filter((a) => a.assert && a.assert.severity === "error").length;
      if (liveAsserts || errorFlags) {
        H.push(" *  Verified live     : " + liveAsserts + " assertion(s) from an on-screen message this recorder actually saw"
          + (errorFlags ? "; " + errorFlags + " step(s) FIXME-flagged (recorded an error message)" : ""));
      }
      if (noise.length) H.push(" *  Recorder noise removed : " + noise.join("; ") + ".");
      H.push(" *");
      H.push(" *  BEFORE YOU RUN IT");
      H.push(" *    1. Rename the test and fill the TEST DATA block below.");
      H.push(" *    2. " + (liveAsserts ? "Uncomment the REMAINING '// ASSERT' lines" : "Uncomment the '// ASSERT' lines") + ". This recorder captured what you DID,");
      H.push(" *       never what you were CHECKING - without them this passes as long as");
      H.push(" *       nothing crashes, which is a script, not a test."
        + (liveAsserts ? " (the " + liveAsserts + " lines already live were something it actually saw appear on screen.)" : ""));
      if (brittle.length) H.push(" *    3. Replace the " + brittle.length + " '// FIXME' locator(s) listed below.");
      // Deliberately NOT emitted any more: a "WHY THIS IS RELIABLE" section explaining
      // that Playwright auto-waits, and a "RECOMMENDED playwright.config.ts" block. Both
      // are documentation, and this file gets pasted into an existing suite that already
      // has a config -- the baseURL it suggested was a hash-route URL, which is wrong
      // advice anyway (baseURL should be an origin). Header carries only what the person
      // editing this file needs to act on.
      if (brittle.length) {
        H.push(" *");
        H.push(" *  BRITTLE STEPS TO HARDEN (" + brittle.length + "):");
        brittle.forEach((a) => H.push(" *    - " + scriptComment(a) + "   " + gtag(a)));
      }
      H.push(" * ==========================================================================");
      H.push(" */");
      H.push("import { test, expect } from '@playwright/test';");
      H.push("");
      if (liveAsserts) {
        H.push("// A transient confirmation toast/banner can vanish before this line runs.");
        H.push("// Warn instead of failing the whole test over UI that already did its job --");
        H.push("// a REAL problem still surfaces as the next real step failing for real.");
        H.push("async function softCheck(label: string, fn: () => Promise<void>): Promise<void> {");
        H.push(ind + "try { await fn(); } catch { console.warn('[soft-check] not visible in time (continuing): ' + label); }");
        H.push("}");
        H.push("");
      }

      const dataLines = [];
      acts.forEach((a, i) => {
        if ((a.type === "fill" && !a.masked) || a.type === "select") {
          const lbl = (a.type === "fill" ? "Fill: " : "Select: ") + (a.desc || "");
          dataLines.push(ind + "step" + (i + 1) + ": " + q(a.value) + ",   // " + lbl.trim());
        }
      });
      if (dataLines.length) H.push("// --- TEST DATA (edit these values in one place) ---", "const data = {", ...dataLines, "};", "");

      const L = [];
      L.push("test(" + q("TODO rename: " + nameSuggest) + ", async ({ page }) => {");
      let step = 0;
      acts.forEach((a, i) => {
        if (a.type === "note") {
          // A cross-origin-frame handoff (or similar): not an executable step, so it
          // gets no "Step N" number and no locator -- just a comment at the point in
          // the sequence where the recording had to stop watching.
          L.push(ind + "// " + "-".repeat(74));
          (a.text || "").split("\n").forEach((line) => L.push(ind + "// " + line));
          L.push(ind + "// " + "-".repeat(74));
          L.push("");
          return;
        }
        step++;
        if (a.type === "navigate") {
          L.push(ind + "// Step " + step + ": open the application");
          L.push(ind + "await page.goto(" + q(a.url) + ");");
          const as = stepAssertion(a, i, ind); if (as) L.push(as);
          L.push("");
          return;
        }
        L.push(ind + "// Step " + step + ": " + scriptComment(a) + "   " + gtag(a));
        if (isBrittle(a)) {
          L.push(ind + "// FIXME brittle " + gtag(a) + ": positional selector - will break if the layout changes.");
          L.push(ind + "//       Ask devs for a stable data-testid, then use page.getByTestId('...').");
        }
        switch (a.type) {
          case "click": L.push(ind + "await " + a.primary + ".click();"); break;
          case "dblclick": L.push(ind + "await " + a.primary + ".dblclick();"); break;
          case "fill":
            if (a.masked) L.push(ind + "await " + a.primary + ".fill(process.env.TEST_SECRET ?? '');   // masked secret - inject via env, never hard-code");
            else L.push(ind + "await " + a.primary + ".fill(data.step" + (i + 1) + ");");
            break;
          case "select": L.push(ind + "await " + a.primary + ".selectOption(data.step" + (i + 1) + ");"); break;
          case "check": L.push(ind + "await " + a.primary + ".check();"); break;
          case "uncheck": L.push(ind + "await " + a.primary + ".uncheck();"); break;
          case "press": L.push(ind + "await " + a.primary + ".press(" + q(a.key) + ");"); break;
          case "setFiles":
            L.push(ind + "await " + a.primary + ".setInputFiles('/path/to/a/real/file');   // FIXME: point this at a real file -- " + (a.value ? "you selected " + q(a.value) + " when recording, but" : "") + " a local file path can't be captured or replayed automatically");
            break;
          default: L.push(ind + "// " + a.type);
        }
        const as = stepAssertion(a, i, ind); if (as) L.push(as);
        L.push("");
      });
      L.push(ind + "// FINAL ASSERTION (enable + edit): verify the flow's end state, e.g.");
      L.push(ind + "// await expect(page.getByRole('heading', { name: '...' })).toBeVisible();");
      L.push("});");
      L.push("");
      return H.concat(L).join("\n");
    }

    // ==========================================================================
    // exportPlaywrightCompanyStyle -- same recording, emitted as a Page Object +
    // spec pair matching Securiti automation's own conventions (BasePage, a
    // custom Expect service, a `user` auth fixture, GenerateRandomData, and
    // PRIV-XXXXX/@sanity tagged titles) instead of the flat inline-locator
    // script exportPlaywright() emits. SECOND, additive export -- that one is
    // unchanged and stays what the shared authenticated-runner kit's frozen
    // regression file and check-generated-specs.js were built against.
    //
    // Baked in (deterministic from the recording itself): locator grouping
    // into a page-object class, brittle-locator FIXMEs, consecutive-fill
    // coalescing, click-before-fill pruning, repeat-navigation pruning, and a
    // uniqueness wrapper on the field recorded right before a Create/Add/Save
    // click. Left as "// EDIT": anything this tool cannot see -- the real
    // import paths for BasePage/the auth fixture/GenerateRandomData/the Expect
    // service, whether a locator for this element already exists elsewhere in
    // the target repo, and the real assertion. Guessing those wrong is worse
    // than flagging them -- that discovery step is the whole job of the
    // sibling adopt-recorded-test skill this is meant to hand off into.
    // ==========================================================================
    function pascalCaseWord(s) {
      return String(s || "").replace(/[^a-zA-Z0-9]+/g, " ").trim().split(/\s+/)
        .filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join("");
    }
    function camelCaseWord(s) {
      const p = pascalCaseWord(s);
      return p ? p[0].toLowerCase() + p.slice(1) : "";
    }
    function classNameFromUrl(url) {
      let seg = [];
      try {
        const u = new URL(url);
        const hashPath = (u.hash || "").replace(/^#/, "");
        seg = (hashPath || u.pathname).split("/").filter(Boolean);
      } catch { seg = []; }
      const last = seg[seg.length - 1] || "";
      let base = pascalCaseWord(last);
      if (!base) { try { base = pascalCaseWord(new URL(url).host.split(".")[0]); } catch { base = ""; } }
      return (base || "RecordedFlow") + "Page";
    }
    // Parses the recorder's own `role "Name"` description format (built by
    // locatorForTarget's `desc`) back into a field name, e.g. button "Add" ->
    // addButton, textbox "Name" -> nameField.
    const FIELD_SUFFIX_BY_ROLE = {
      button: "Button", link: "Link", textbox: "Field", searchbox: "Field",
      combobox: "Dropdown", checkbox: "Checkbox", radio: "Radio", menuitem: "MenuItem",
      switch: "Toggle", tab: "Tab",
    };
    function fieldNameFromDesc(desc, used) {
      const m = /^(\w+)\s+"([^"]*)"/.exec(desc || "");
      const role = m ? m[1].toLowerCase() : "";
      const label = m ? m[2] : (desc || "element");
      let base = camelCaseWord(label) || camelCaseWord(role) || "element";
      const suffix = FIELD_SUFFIX_BY_ROLE[role] || (role ? pascalCaseWord(role) : "Element");
      if (!pascalCaseWord(base).endsWith(suffix)) base += suffix;
      let name = base, n = 2;
      while (used.has(name)) name = base + n++;
      used.add(name);
      return name;
    }
    function exportPlaywrightCompanyStyle() {
      const ind1 = "  ", ind2 = "    ";

      // Same shared pruning exportPlaywright() uses: strips login-page noise wholesale
      // and collapses consecutive-repeat noise. Only a navigate that is the very FIRST
      // action of the whole (post-strip) recording can become the openXxx() target --
      // a navigate that shows up later -- e.g. the SPA's own post-login redirect -- is
      // a body statement, not an opening page. Deciding this by "first navigate seen
      // so far" instead of "first action overall" was a real bug: a login flow
      // recorded start-to-finish had its landing-page navigate LAST, and treating it
      // as openXxx() produced a spec that opened the post-login dashboard directly,
      // then tried to fill login fields on it.
      const { startAction, flat, pruned } = pruneRecordedActions(registry.actions);
      let startUrl = startAction ? startAction.url : (typeof location !== "undefined" ? location.href : "");
      const className = classNameFromUrl(startUrl);
      const openName = "open" + className.replace(/Page$/, "");

      // ---- Locator fields, declared once, in first-seen order ----
      const used = new Set();
      const fieldOf = new Map(); // primary -> { name, a }
      for (const a of flat) {
        if (a.type === "navigate" || a.type === "note") continue; // neither has a locator to declare a field for
        if (!fieldOf.has(a.primary)) fieldOf.set(a.primary, { name: fieldNameFromDesc(a.desc, used), a });
      }

      // ---- Fields needing a uniqueness wrapper: recorded right before a
      // Create/Add/Save-ish click -- the kit's own duplicate-name failure mode.
      const CREATE_ISH_RE = /\b(create|add|save)\b/i;
      const uniqueFields = new Set();
      flat.forEach((a, i) => {
        if (a.type !== "fill") return;
        const nextClick = flat.slice(i + 1).find((x) => x.type === "click" || x.type === "dblclick");
        if (nextClick && CREATE_ISH_RE.test(nextClick.desc || "")) uniqueFields.add(fieldOf.get(a.primary).name);
      });

      // ---- One method param per distinct fill/select field ----
      const params = []; const seenParam = new Set();
      for (const a of flat) {
        if (a.type !== "fill" && a.type !== "select") continue;
        const f = fieldOf.get(a.primary);
        // f.name is already camelCase (fieldNameFromDesc built it that way) -- running
        // it back through camelCaseWord() re-splits it as if it were raw, undelimited
        // text and lowercases the WHOLE remainder ("aNameForYourDomainField" ->
        // "anameforyourdomain" instead of "aNameForYourDomain"). Same bug class as this
        // function's `inst` fix further down; just lowercase the first character of
        // what's left instead of re-deriving it.
        const stripped = f.name.replace(/(Field|Dropdown)$/, "");
        let param = (stripped ? stripped[0].toLowerCase() + stripped.slice(1) : "") || "value";
        let p2 = param, n = 2; while (seenParam.has(p2)) p2 = param + n++;
        seenParam.add(p2);
        params.push({ field: f.name, param: p2, value: a.value, unique: uniqueFields.has(f.name), masked: !!a.masked });
      }
      const sigParams = params.filter((p) => !p.masked);

      const isBrittle = (a) => a.grade === "F" || a.grade === "D";
      const gtag = (a) => a.grade ? "[" + a.grade + (a.strategy ? " " + a.strategy : "") + "]" : "";

      const P = [];
      P.push("// ============================================================================");
      P.push("//  FILE 1 of 2 -- Page Object.  EDIT the save path to match this repo, e.g.:");
      P.push("//    pages/" + className.replace(/Page$/, "").toLowerCase() + "/" + className + ".ts");
      P.push("// ============================================================================");
      P.push("import { Page } from '@playwright/test';");
      P.push("import { BasePage } from '../base/BasePage';   // EDIT: this repo's real base-page path/class");
      P.push("");
      P.push("export class " + className + " extends BasePage {");
      for (const { name, a } of fieldOf.values()) {
        if (isBrittle(a)) P.push(ind1 + "// FIXME brittle " + gtag(a) + ": positional selector, will break if the layout changes. Ask devs for a data-testid.");
        P.push(ind1 + "// EDIT: reuse an existing locator for this element if this repo already has one, instead of adding this.");
        P.push(ind1 + "private readonly " + name + " = this.page." + a.primary.replace(/^page\./, "") + ";");
      }
      P.push("");
      P.push(ind1 + "constructor(page: Page) { super(page); }");
      P.push("");
      P.push(ind1 + "async " + openName + "(): Promise<void> {");
      P.push(ind2 + "await this.page.goto(" + q(startUrl) + ");");
      P.push(ind1 + "}");
      P.push("");
      P.push(ind1 + "// TODO: rename to describe what this flow does, e.g. addTerm / createDataset.");
      const sig = sigParams.length ? "values: { " + sigParams.map((p) => p.param + ": string").join("; ") + " }" : "";
      P.push(ind1 + "async performRecordedFlow(" + sig + "): Promise<void> {");
      for (const a of flat) {
        const f = fieldOf.get(a.primary);
        if (isBrittle(a)) P.push(ind2 + "// FIXME brittle " + gtag(a) + ": see the field declaration above.");
        switch (a.type) {
          case "navigate": P.push(ind2 + "await this.page.goto(" + q(a.url) + ");   // EDIT: recorded mid-flow -- confirm this repo wants a real navigation here, not a wait for an in-page transition"); break;
          case "note":
            (a.text || "").split("\n").forEach((line) => P.push(ind2 + "// " + line));
            break;
          case "click": P.push(ind2 + "await this." + f.name + ".click();"); break;
          case "dblclick": P.push(ind2 + "await this." + f.name + ".dblclick();"); break;
          case "fill": {
            const p = params.find((x) => x.field === f.name);
            P.push(ind2 + (a.masked ? "await this." + f.name + ".fill(process.env.TEST_SECRET ?? '');   // masked secret -- inject via env, never hard-code" : "await this." + f.name + ".fill(values." + p.param + ");"));
            break;
          }
          case "select": { const p = params.find((x) => x.field === f.name); P.push(ind2 + "await this." + f.name + ".selectOption(values." + p.param + ");"); break; }
          case "check": P.push(ind2 + "await this." + f.name + ".check();"); break;
          case "uncheck": P.push(ind2 + "await this." + f.name + ".uncheck();"); break;
          case "press": P.push(ind2 + "await this." + f.name + ".press(" + q(a.key) + ");"); break;
          case "setFiles":
            P.push(ind2 + "await this." + f.name + ".setInputFiles('/path/to/a/real/file');   // EDIT: point this at a real file -- " + (a.value ? "you selected " + q(a.value) + " when recording, but" : "") + " a local file path can't be captured or replayed automatically");
            break;
        }
      }
      P.push(ind1 + "}");
      P.push("}");

      const S = [];
      S.push("");
      S.push("// ============================================================================");
      S.push("//  FILE 2 of 2 -- Spec.  EDIT the save path to match this repo, e.g.:");
      const flowSlug = className.replace(/Page$/, "").toLowerCase();
      S.push("//    tests/" + flowSlug + "/" + flowSlug + ".spec.ts");
      S.push("// ============================================================================");
      S.push("import { test } from '../fixtures/login-fixture';   // EDIT: this repo's real authenticated-page fixture -- do not paste this path unedited");
      S.push("import { " + className + " } from '../pages/" + flowSlug + "/" + className + "';   // EDIT: match this repo's real page-object path");
      if (sigParams.some((p) => p.unique)) S.push("import { GenerateRandomData } from '../utils/helpers/GenerateRandomData';   // EDIT: or this repo's equivalent random-data helper");
      S.push("import { Expect } from '../utils/Expect';   // EDIT: or raw `expect` from '@playwright/test' if this repo has no custom Expect service");
      S.push("");
      // className is already PascalCase (e.g. "GlossaryPage") -- lowercase only the
      // first character. Running it back through camelCaseWord would re-split and
      // re-lowercase it as if it were raw text, destroying the internal capital
      // (producing "glossarypage" instead of "glossaryPage").
      const inst = className[0].toLowerCase() + className.slice(1);
      S.push("let " + inst + ": " + className + ";");
      S.push("");
      S.push("test.beforeEach(async ({ user }) => {   // EDIT: 'user' is a placeholder fixture name -- use this repo's actual authenticated-page fixture");
      S.push(ind1 + inst + " = new " + className + "(user);");
      S.push(ind1 + "await " + inst + "." + openName + "();");
      S.push("});");
      S.push("");
      S.push("test('PRIV-XXXXX @sanity TODO rename: describe this flow', async () => {   // EDIT: PRIV-XXXXX is a placeholder ticket ID; tag per this repo's convention");
      for (const p of sigParams) {
        if (p.unique) S.push(ind1 + "const " + p.param + " = GenerateRandomData.getUniqueName(" + q(p.param) + ");   // unique because this flow ends in a Create/Add/Save click -- drop the wrapper if that is wrong");
        else S.push(ind1 + "const " + p.param + " = " + q(p.value) + ";   // EDIT: recorded value, verbatim");
      }
      S.push(ind1 + "await " + inst + ".performRecordedFlow(" + (sigParams.length ? "{ " + sigParams.map((p) => p.param).join(", ") + " }" : "") + ");");
      S.push("");
      // Real, observed text beats a guess -- but unlike the flat export, this spec has
      // no bare `page` to assert against (the page object owns it, and whether it's
      // exposed publicly is this repo's own BasePage convention, not ours to assume).
      // So this is a strong, concrete hint with the actual on-screen text, not
      // fabricated working code against an access pattern we can't verify.
      const observedAsserts = flat.filter((a) => a.assert);
      if (observedAsserts.length) {
        S.push(ind1 + "// This recorder saw the following appear on screen during the flow -- turn");
        S.push(ind1 + "// whichever of these prove the flow worked into real assertions:");
        observedAsserts.forEach((a) => {
          if (a.assert.severity === "error") S.push(ind1 + "// FIXME: an error message appeared: " + q(a.assert.text) + " -- fix the underlying issue, don't silence this.");
          else S.push(ind1 + "// EDIT: await Expect.elementsVisible(<a locator for " + q(a.assert.text) + ">);   // seen on screen (" + a.assert.severity + ")");
        });
      }
      S.push(ind1 + "// ASSERT (edit): verify the created/changed thing now exists -- not just that nothing threw.");
      S.push(ind1 + "// e.g. await Expect.elementsVisible(" + inst + ".someLocator);");
      S.push("});");

      const noise = [];
      if (pruned.coalescedFills) noise.push(pruned.coalescedFills + " duplicate-value fill(s) on the same field coalesced to the final value");
      if (pruned.clickBeforeFill) noise.push(pruned.clickBeforeFill + " click-before-fill on the same field dropped (fill() focuses it)");
      if (pruned.repeatNav) noise.push(pruned.repeatNav + " repeat navigation to the same URL dropped");
      if (pruned.repeatAction) noise.push(pruned.repeatAction + " identical repeated action(s) collapsed (nothing else happened in between)");
      const header = [
        "// ============================================================================",
        "//  Company-style export -- generated by Locator Inspector " + VERSION + " (Securiti QA)",
        "//  Page Object + BasePage + Expect service + `user` fixture + GenerateRandomData,",
        "//  matching Securiti automation's own conventions (see adopt-recorded-test skill).",
        "//",
        "//  BEST-GUESS SCAFFOLD, not a finished test. Everything tagged EDIT above is a",
        "//  path or name this tool cannot know -- verify each against a real neighbouring",
        "//  spec in the target repo before relying on it.",
        noise.length ? "//  Recorder noise already removed: " + noise.join("; ") + "." : "",
        "// ============================================================================",
        "",
      ].filter(Boolean);

      return header.concat(P).concat(S).join("\n") + "\n";
    }

    // ==========================================================================
    // Transient catcher
    // ==========================================================================
    function isNotableTransient(el) {
      if (!(el instanceof Element) || isOwnNode(el)) return false;
      const role = (el.getAttribute("role") || "").toLowerCase();
      const ariaLive = (el.getAttribute("aria-live") || "").toLowerCase();
      const cls = classListOf(el).join(" ");
      const id = el.id || "";
      if (TRANSIENT_ROLE_RE.test(role)) return true;
      if (ariaLive === "polite" || ariaLive === "assertive") return true;
      if (TRANSIENT_CLASS_RE.test(cls) || TRANSIENT_CLASS_RE.test(id)) return true;
      return false;
    }
    function classifySeverity(el) {
      // Look at class/id AND the semantic signals real apps use: data-severity/
      // type/status, aria-label, and the visible text itself (a toast that reads
      // "Error: save failed" is an error even if its class is a neutral hash).
      const sig = [
        classListOf(el).join(" "), el.id || "",
        el.getAttribute("data-severity") || "", el.getAttribute("data-type") || "",
        el.getAttribute("data-status") || "", el.getAttribute("aria-label") || "",
        (pinText(el) || normText(el) || "").slice(0, 60),
        // Icon-font ligature names are a genuine severity signal on this app
        // ("priority_high", "error_outline"), just not part of the readable text.
        (function () { try { const i = el.querySelector(ICON_FONT_SEL); return i ? (i.textContent || "").trim().slice(0, 30) : ""; } catch { return ""; } })(),
      ].join(" ").toLowerCase();
      const role = (el.getAttribute("role") || "").toLowerCase();
      if (/error|danger|fail|invalid|denied|exception/.test(sig) || role === "alertdialog") return "error";
      if (/\bwarn|caution|attention/.test(sig)) return "warning";
      // "created"/"added"/"updated" were missing -- a real
      // "Created Glossary Term!" toast fell through to "info" for want of these.
      if (/success|saved|completed?|confirm|\bok\b|created|added|updated/.test(sig)) return "success";
      return "info";
    }
    const activeTransients = new Map();
    function captureTransient(node) {
      // Defense in depth: every current call site already gates through
      // isNotableTransient (which checks isOwnNode) before calling this, but this
      // function must be safe on its own -- it is exposed for tests/power use, and a
      // future call site that forgets the gate must not be able to make this tool's
      // own UI (e.g. the "Opened in a new tab" toast) attach a bogus assertion to
      // whatever the user was just recording.
      if (!(node instanceof Element) || isOwnNode(node) || activeTransients.has(node)) return;
      const res = resolveUniqueLocator(node);
      const severity = classifySeverity(node);
      const correlated = severity === "error" ? correlateError() : null;
      const entry = { text: pinText(node) || res.text || "(no visible text)", severity, res, startTime: Date.now(), endTime: null, net: correlated ? { method: correlated.method, url: correlated.url, status: correlated.status, gql: correlated.gql } : null };
      activeTransients.set(node, entry);
      registry.feed.push(entry);
      if (registry.feed.length > MAX_LOG_ENTRIES) registry.feed.shift();
      trackLocator(res);
      stats.transientCaught++;
      saveStats(stats);
      // Recorder link: a toast/banner appearing right after a recorded step is the
      // one piece of real verification a recorder can observe on its own -- so if
      // we're mid-recording and this fired within a step's own action, not later
      // page churn), attach it to that step. exportPlaywright/CompanyStyle turn this
      // into a real assertion instead of the usual guessed placeholder. Attach at
      // capture time (text is already stable then); never overwrite an earlier one,
      // and isNotableTransient's isOwnNode guard above already keeps this tool's own
      // toasts (e.g. "Opened in a new tab") out of this entirely.
      // WINDOW: 5000ms, not the ~1200ms first tried -- LIVE-MEASURED on a real Create
      // click against edc.qa.securiti.xyz: its own "Updating..." toast
      // landed 1275ms after the click (real network round-trip), which a 1200ms
      // window missed entirely. A create/save action is exactly the case this exists
      // to catch, so the window has to survive real API latency, not just a jsdom-fast
      // synthetic event.
      if (registry.recording && registry.actions.length) {
        const lastAct = registry.actions[registry.actions.length - 1];
        if (lastAct && lastAct.t && !lastAct.assert && (Date.now() - lastAct.t) < 5000) {
          lastAct.assert = { text: entry.text, severity };
        }
      }
      notify("feed");
    }
    function finalizeTransient(node) {
      const entry = activeTransients.get(node);
      if (!entry || entry.endTime) return;
      entry.endTime = Date.now();
      activeTransients.delete(node);
      notify("feed");
    }
    function scanNodeForTransients(node) {
      if (!(node instanceof Element)) return;
      if (isNotableTransient(node)) captureTransient(node);
      if (node.querySelectorAll) node.querySelectorAll(TRANSIENT_ROLE_SELECTOR).forEach((c) => { if (isNotableTransient(c)) captureTransient(c); });
    }

    // ==========================================================================
    // Flakiness registry (cross-frame, root-aware)
    // ==========================================================================
    function trackLocator(res) {
      if (!res || !res.css) return;
      Catalog.record(res, routeKey());   // hovered/used \u2192 remember it
      if (!registry.tracked.has(res.css)) {
        const root = res.root || document;
        registry.tracked.set(res.css, {
          css: res.css, primary: res.primary, strategy: res.primaryStrategy, stability: res.stability,
          root, checks: 0, breaks: 0, present: 0, absent: 0,
          lastCount: res.unique ? 1 : countMatches(res.css, root), firstSeen: Date.now(),
        });
        if (registry.tracked.size > MAX_TRACKED_LOCATORS) registry.tracked.delete(registry.tracked.keys().next().value);
      }
    }
    // Marks a locator as one you actually RELIED on (copied, or used in a
    // recording) rather than merely hovered while exploring. `kind` picks which
    // set it lands in -- "record" is scoped to the CURRENT recording and gets wiped
    // when a new one starts (see the Start-Recording handler); "copy" persists for
    // the rest of the session. Health/Inspect keep tracking everything as before;
    // this only decides what's eligible for Doctor's "Needs checkup" list.
    function markCheckup(res, kind) {
      if (!res || !res.css) return;
      trackLocator(res); // ensure it's actually being watched, even if never hovered
      (kind === "record" ? registry.deliberateRecord : registry.deliberateCopy).add(res.css);
    }
    // A genuinely NEW recording (not a resume, and an explicit Clear) starts Doctor's
    // checkup list over: last recording's flagged locators shouldn't linger, and a
    // dismissal from that earlier round shouldn't suppress a fresh finding. Copied
    // locators (deliberateCopy) are untouched -- copying isn't scoped to a recording.
    function resetRecordingCheckups() {
      registry.deliberateRecord.clear();
      registry.dismissedCheckups.clear();
    }
    // ZERO MATCHES IS NOT FLAKINESS. This counted any count !== 1 as a "break", so
    // navigating to another route, closing a drawer, or scrolling a row out of a
    // virtualised table -- all of which make the element legitimately absent -- branded
    // a perfectly good locator "Flaky". On a real app that fires constantly and the
    // badge means nothing.
    //
    // The three outcomes are genuinely different and are now tracked separately:
    //   count === 1   the locator still identifies exactly its element
    //   count === 0   the element is not on this page. Says nothing about the locator.
    //   count  >  1   AMBIGUOUS -- it was unique and now matches several. This, and
    //                 only this, is the defect worth warning about, because it is the
    //                 one that makes a passing test act on the wrong node.
    function revalidateAll(reason) {
      let changed = false;
      // Named call-out for the moment a WATCHED locator turns bad, not just a growing
      // list someone has to keep re-scanning. Fires once per locator, right when it
      // FIRST goes ambiguous (r.breaks flips 0 -> 1) -- a locator that's already
      // flagged breaking again on a later check doesn't re-toast every single time,
      // so this stays a rare, meaningful interruption instead of background noise.
      const newlyBroken = [];
      for (const r of registry.tracked.values()) {
        const count = countMatches(r.css, r.root || document);
        r.checks++;
        // Every deviation from 1 is LOGGED with its observed count and a timestamp --
        // that audit trail is a requirement (spec-compliance AC4/#5) and the tool must
        // never silently substitute a replacement locator. What changed is the VERDICT:
        // only count > 1 counts against the locator.
        if (count !== 1) r.lastBreak = { reason, count, at: Date.now() };
        if (count === 0) {
          r.absent = (r.absent || 0) + 1;
        } else {
          r.present = (r.present || 0) + 1;
          if (count > 1) {
            if (!r.breaks) newlyBroken.push(r);
            r.breaks = (r.breaks || 0) + 1;
            changed = true;
          }
        }
        r.lastCount = count;
      }
      if (newlyBroken.length) {
        showToast(newlyBroken.length === 1
          ? `\u26A0 Locator just went ambiguous (${newlyBroken[0].strategy}) \u2014 check Health tab`
          : `\u26A0 ${newlyBroken.length} locators just went ambiguous \u2014 check Health tab`);
      }
      if (changed || reason === "manual") notify("health");
    }
    // Never claim more than the observations support. "Stable" requires having actually
    // seen the element resolve 1-of-1 at least twice while present; one sighting is the
    // hover that created the record and proves nothing about durability.
    const MIN_PRESENT_CHECKS_FOR_STABLE = 2;
    function flakinessVerdict(r) {
      const present = r.present || 0, breaks = r.breaks || 0;
      if (breaks > 0) {
        return { label: "Ambiguous", color: "#e74c3c",
                 why: "matched " + ((r.lastBreak && r.lastBreak.count) || "several") + " elements on a re-check \u2014 it was 1-of-1 when first seen" };
      }
      if (r.stability === "at-risk") return { label: "At-risk", color: "#e67e22", why: "pinned on markup or copy, not a stable hook" };
      if (present >= MIN_PRESENT_CHECKS_FOR_STABLE) {
        return { label: "Stable", color: "#2ecc71", why: "still 1-of-1 across " + present + " re-checks" };
      }
      if (present > 0) return { label: "Holding", color: "#9aa0a6", why: "1-of-1 so far, too few re-checks to call it stable" };
      if (r.absent) return { label: "Off-page", color: "#7d8590", why: "not present on the pages re-checked since \u2014 says nothing about the locator" };
      return { label: "Untested", color: "#9aa0a6", why: "no re-check has run yet" };
    }

    // ==========================================================================
    // PassiveScanner \u2014 idle-time coverage crawl (feeds Learner + flakiness)
    // ==========================================================================
    const ric = window.requestIdleCallback || function (cb) { return setTimeout(() => cb({ timeRemaining: () => 8, didTimeout: true }), 200); };
    function passiveScan() {
      let list;
      try {
        list = Array.from(document.querySelectorAll(interactiveSelector())).filter((n) => !isOwnNode(n));
      } catch {
        return;
      }
      let i = 0;
      const step = (deadline) => {
        while (i < list.length && (deadline.timeRemaining() > 3 || deadline.didTimeout)) {
          const el = list[i++];
          try {
            const res = resolveUniqueLocator(el);
            registry.coverage.set(res.css, { primary: res.primary, strategy: res.primaryStrategy, stability: res.stability, verdict: res.verdict, thirdParty: !!res.thirdParty });
            if (registry.coverage.size > 500) registry.coverage.delete(registry.coverage.keys().next().value);
            Catalog.record(res, routeKey());   // silently accumulate into the persistent agent memory
          } catch {}
        }
        if (i < list.length) ric(step, { timeout: 4000 });
        else {
          learnFrom(document);
          notify("learn");
        }
      };
      ric(step, { timeout: 4000 });
    }

    // Shared: climb to interactive root (shadow-aware)
    function findInteractiveRoot(el) {
      let node = el, depth = 0;
      while (node && node.nodeType === 1 && depth < 8) {
        if (node.matches && node.matches(interactiveSelector())) return node;
        node = node.parentElement || (node.getRootNode && node.getRootNode().host) || null;
        depth++;
      }
      return el;
    }
    function realTarget(e) {
      const path = e.composedPath && e.composedPath();
      // Return the DEEPEST element the event actually started on, even if that
      // element is one of ours. The previous version skipped past our own nodes, so a
      // click on the panel's own "Stop recording" button escaped the panel and
      // resolved to <body> -- which the recorder then captured as a click on the whole
      // document (observed live: a step reading `page.locator('body:has(...)')` with
      // the entire page text as its description). Callers guard with isOwnNode(), so
      // handing back the own node is what makes them correctly ignore the event.
      if (path && path.length) for (const n of path) if (n instanceof Element) return n;
      return e.target;
    }

    // ==========================================================================
    // UI (tooltip + toast everywhere; panel only at top)
    // ==========================================================================
    const GRADE_COLORS = { A: "#2ecc71", B: "#8bc34a", C: "#f1c40f", D: "#e67e22", F: "#e74c3c" };
    // Three states, because there are only three decisions: put it in the suite, put it
    // in but keep an eye on it, or do not put it in.
    const VERDICT_COLORS = { ship: "#2ecc71", watch: "#f1c40f", "dont-ship": "#e74c3c" };
    const STABILITY_COLORS = { stable: "#2ecc71", medium: "#f1c40f", "at-risk": "#e67e22" };
    const SEVERITY_COLORS = { error: "#e74c3c", warning: "#e67e22", success: "#2ecc71", info: "#3b82f6" };

    const style = document.createElement("style");
    style.id = NS + "-style";
    style.textContent = `
      /* ---------------------------------------------------------------------
         DESIGN NOTES (kept because they are engineering constraints, not taste)

         1. NO backdrop-filter / translucency. The previous glass treatment cost a
            full-page GPU composite on every repaint -- on the EDC module that is
            4183 elements underneath -- and translucency over an arbitrary app
            background is exactly where monospace selector text becomes ambiguous.
            Legibility of the locator is the one thing that may never be in doubt.
         2. SATURATED COLOUR IS RESERVED FOR THE VERDICT. The tool answers one
            question -- ship it / watch it / do not ship -- so that answer owns the
            only strong colour on the surface. Everything else is neutral. The old
            cyan glow competed with it for attention.
         3. THE "1 OF N" READOUT IS THE HERO. This is a measuring instrument: it
            exists to report whether a locator matches exactly one node. Tabular
            numerals so the digits do not jitter as you sweep across elements.
         4. Motion only where a value CHANGED, never a card-wide entrance on every
            mousemove (that read as jitter, not feedback).
      --------------------------------------------------------------------- */
      #${NS}-panel,#${NS}-tooltip,#${NS}-help,#${NS}-toast{
        /* #${NS}-help and #${NS}-toast are SIBLINGS of #${NS}-panel under
           document.body (standalone elements) -- CSS custom properties only
           inherit to DESCENDANTS, so without repeating this declaration here
           too, every var(--surface)/var(--text)/etc inside them silently
           resolved to nothing. #${NS}-help was caught and fixed this way
           already; #${NS}-toast had the SAME bug and stayed invisible on
           whatever page it landed on -- var(--ink) resolved to nothing so its
           background fell back to fully transparent, and var(--text) resolved
           to nothing so its text fell back to the host page's own inherited
           color, both silently, which is exactly why it "worked" on some
           pages and vanished on others, confirmed by injecting into a plain
           white page. Fixed to solid, not translucent, on purpose -- per design
           note 1 just below, translucency over an arbitrary app background is
           exactly where legibility gets ambiguous, which is the one thing
           this tool may never risk. */
        --ink:#0d0f12; --surface:#15181d; --raised:#1b1f26; --line:#272c34;
        --text:#f6f8fb; --dim:#a3aab5; --code:#d8dfe8; --focus:#6ea8fe;
        --ship:#3ddc84; --watch:#f2c341; --stop:#ff6b5e;
        font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
        -webkit-font-smoothing:antialiased;
      }
      /* Brighter --text/--dim above plus this shadow both trace back to the same
         cause: the glass background pass made the panel/help MORE translucent, which
         reads great over the tool's own dark surface but loses contrast wherever a
         busy, light app page shows through. The tooltip is unaffected by either --
         it was deliberately kept fully opaque already (see its own design note). */
      #${NS}-panel,#${NS}-help{text-shadow:0 1px 3px rgba(0,0,0,.45)}
      #${NS}-panel code,#${NS}-tooltip code,#${NS}-panel pre{
        font-family:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace;
        font-variant-numeric:tabular-nums;
      }

      /* ---- panel ---- */
      #${NS}-panel{position:fixed;bottom:18px;right:18px;z-index:2147483647;width:560px;
        min-width:340px;max-width:900px;
        color:var(--text);
        background:
          linear-gradient(155deg,rgba(0,172,224,.10),rgba(0,212,82,.09) 60%),
          rgba(13,15,18,.72);
        -webkit-backdrop-filter:blur(20px) saturate(1.6);backdrop-filter:blur(20px) saturate(1.6);
        border:1px solid var(--line);border-radius:12px;
        overflow:hidden;box-shadow:0 20px 48px -16px rgba(0,0,0,.75);
        transform:translateY(10px);opacity:0;animation:${NS}-panelin .22s ease-out forwards}
      @keyframes ${NS}-panelin{to{transform:translateY(0);opacity:1}}
      /* Panel is FIXED position and does not repaint on every mousemove (unlike the
         tooltip below, which deliberately stays fully OPAQUE -- see the design notes
         at the top of this block: translucency there was already tried and reverted
         for a measured full-page GPU-composite cost on every cursor move over a real
         4183-element page, plus locator-text legibility risk against whatever the app
         happens to render underneath). The panel sits still; that cost doesn't apply
         here the same way, so the glass treatment is safe to bring back just for it
         (and the Help modal below, also fixed and equally low-frequency). */
      /* The thin gradient bar at the very top, lifted straight from securiti.ai's
         own top-of-page banner (see the tab-underline comment above for the same
         source), placed here as well as on the tab bar. */
      #${NS}-panel .li-topbar{height:8px;width:100%;
        background:linear-gradient(90deg,rgba(0,172,224,.82),rgba(0,212,82,.82),rgba(0,172,224,.82));
        background-size:200% 100%;
        box-shadow:0 0 14px rgba(0,172,224,.4);
        animation:${NS}-tabflow 6s linear infinite,${NS}-topglow 6s ease-in-out infinite}
      @keyframes ${NS}-topglow{0%,100%{box-shadow:0 0 14px rgba(0,172,224,.4)}50%{box-shadow:0 0 20px rgba(0,212,82,.5)}}
      #${NS}-panel .header{display:flex;align-items:center;justify-content:space-between;
        padding:14px 16px 12px;border-bottom:1px solid var(--line);cursor:grab;user-select:none}
      /* Without this, grabbing the header exactly over the brand SVG hijacks the
         gesture into the browser's own native image-drag (ghost icon, no more
         mousemove events reach the page at all) instead of the JS-driven panel
         drag below -- draggable="false" on the svg itself is the primary fix,
         this is the belt-and-suspenders CSS backstop for browsers that still try. */
      #${NS}-panel .header svg,#${NS}-panel .header *{-webkit-user-drag:none}
      #${NS}-panel .header.li-dragging{cursor:grabbing}
      #${NS}-panel .header-actions{cursor:default}
      /* A dedicated, NON-scrolling strip below every tabpane -- the handle used to sit
         directly in the panel's own bottom-right corner, which is exactly where an
         overflowing tabpane's native scrollbar renders too. That scrollbar is OS/UA
         chrome, not part of the normal stacking order, and it silently ate every
         pointer event meant for the handle underneath it (confirmed live: dragging
         produced zero movement whenever the active tab's content overflowed). Giving
         the handle its own row, entirely below the scrollable area, removes the
         overlap instead of trying to out-stack a scrollbar. */
      #${NS}-panel .li-footer{height:16px;position:relative;cursor:ns-resize}
      /* Explicit horizontal-only handle on the LEFT edge -- deliberately the left,
         not the right, edge: the right edge is where an overflowing tabpane's own
         scrollbar renders (see the li-footer comment above for why that ate every
         pointer event when tried there), and the left edge is never in that content
         area regardless of which tab or how much it overflows. */
      #${NS}-panel .li-resize-h{position:absolute;left:0;top:0;bottom:16px;width:6px;
        cursor:ew-resize;z-index:1}
      /* Mirror of li-resize-h on the RIGHT edge, plus a TOP edge, so all four sides
         are individually draggable, not just left+bottom+corner.
         Right edge stops 16px short of the bottom for the same scrollbar reason as the
         left edge; header-actions got z-index:2 above so this doesn't swallow Help/Close
         clicks despite spanning the full height including the header. */
      #${NS}-panel .li-resize-r{position:absolute;right:0;top:0;bottom:16px;width:6px;
        cursor:ew-resize;z-index:1}
      #${NS}-panel .li-resize-t{position:absolute;left:6px;right:6px;top:0;height:6px;
        cursor:ns-resize;z-index:1}
      #${NS}-panel .li-resize{position:absolute;right:2px;bottom:1px;width:14px;height:14px;
        cursor:nwse-resize;background:
          linear-gradient(135deg,transparent 0 46%,var(--dim) 46% 54%,transparent 54% 100%),
          linear-gradient(135deg,transparent 0 66%,var(--dim) 66% 74%,transparent 74% 100%);
        opacity:.5;transition:opacity .15s}
      #${NS}-panel .li-resize:hover{opacity:1}
      #${NS}-panel h4{margin:0;font-size:14px;font-weight:650}
      #${NS}-panel .brand{display:flex;align-items:center;gap:11px}
      #${NS}-panel .brand-logo{flex:none;border-radius:6px;animation:${NS}-glow 3.6s ease-in-out infinite}
      @keyframes ${NS}-glow{
        0%,100%{filter:drop-shadow(0 0 0 rgba(0,172,224,0))}
        50%{filter:drop-shadow(0 0 5px rgba(0,172,224,.55))}
      }
      /* Real brand blue (the same confirmed securiti.ai gradient stop, see the
         topbar/tab comments) -- distinguishes the tool's own name from the plain
         "Securiti" label right under it. */
      #${NS}-panel .brand-title{font-size:14.5px;font-weight:650;letter-spacing:-.15px;color:#3dc7f0;line-height:1.15}
      #${NS}-panel .brand-title .ver{color:var(--dim);font-size:11px;font-weight:550;margin-left:3px;letter-spacing:0}
      #${NS}-panel .brand-company{font-size:12px;color:var(--text);font-weight:600;margin-top:2px}
      /* Matches securiti.ai's own lockup convention -- small, muted, directly under
         the "Securiti" line above it. Real text, not their logo asset: their tagline
         turned out to be baked into an SVG image with no DOM text node to lift. */
      #${NS}-panel .brand-tagline{font-size:10.5px;color:var(--dim);margin-top:1px;font-weight:500}
      #${NS}-panel .brand-sub{font-size:11px;color:var(--dim);letter-spacing:.4px;text-transform:uppercase;margin-top:3px;font-weight:600}
      #${NS}-panel .brand-sub .dot{opacity:.5;margin:0 3px}
      /* z-index above the new right-edge resize handle below (li-resize-r spans the
         full height including the header so a right-edge drag is grabbable anywhere
         down the panel, not just below the header) -- without this the handle's own
         stacking would sit on top and swallow clicks meant for Help/Close. */
      #${NS}-panel .header-actions{display:flex;align-items:center;gap:8px;flex:none;position:relative;z-index:2}
      /* Apple-style control buttons (rounded square, soft filled surface, subtle
         border, gentle drop shadow) adapted to this panel's dark theme instead of
         copying a light-mode fill verbatim. */
      #${NS}-panel .close,#${NS}-panel .help{cursor:pointer;color:var(--dim);background:var(--raised);
        border:1px solid var(--line);font-size:14px;width:28px;height:28px;border-radius:9px;line-height:1;
        box-shadow:0 1px 2px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.05);
        transition:color .12s,border-color .12s,transform .12s,box-shadow .12s}
      #${NS}-panel .close:hover{color:var(--stop);border-color:var(--stop);box-shadow:0 2px 8px rgba(255,107,94,.3),inset 0 1px 0 rgba(255,255,255,.05)}
      #${NS}-panel .help{font-weight:700;color:var(--focus)}
      #${NS}-panel .help:hover{border-color:var(--focus);transform:scale(1.06);box-shadow:0 2px 8px rgba(110,168,254,.35),inset 0 1px 0 rgba(255,255,255,.05)}
      /* ---- Help Center overlay -- a STANDALONE element (#${NS}-help), same pattern
         as #${NS}-tooltip/#${NS}-toast, NOT nested inside #${NS}-panel. The panel has
         overflow:hidden and no fixed height (sized to whichever tab is showing), so a
         modal nested inside it would get clipped to that tab's current height instead
         of showing as a real, roomy card. Fixed to the viewport, dims everything,
         card fades+scales in. ---- */
      #${NS}-help{position:fixed;inset:0;background:rgba(6,8,11,.55);opacity:0;pointer-events:none;
        -webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);
        display:flex;align-items:center;justify-content:center;padding:20px;transition:opacity .15s;
        z-index:2147483647;font:14px/1.5 -apple-system,"Segoe UI",Roboto,sans-serif;color:var(--text)}
      #${NS}-help.open{opacity:1;pointer-events:auto}
      #${NS}-help .li-help-card{width:100%;max-width:460px;max-height:min(600px,calc(100vh - 40px));
        overflow:auto;
        background:
          linear-gradient(155deg,rgba(0,172,224,.09),rgba(0,212,82,.08) 60%),
          rgba(21,24,29,.68);
        -webkit-backdrop-filter:blur(20px) saturate(1.6);backdrop-filter:blur(20px) saturate(1.6);
        border:1px solid var(--line);border-radius:11px;
        box-shadow:0 24px 56px -18px rgba(0,0,0,.8);
        transform:translateY(6px) scale(.97);opacity:0;animation:${NS}-helpin .18s ease-out forwards}
      @keyframes ${NS}-helpin{to{transform:translateY(0) scale(1);opacity:1}}
      #${NS}-help .li-help-head{display:flex;align-items:center;justify-content:space-between;
        padding:13px 15px;border-bottom:1px solid var(--line);font-size:14.5px;position:sticky;top:0;
        background:rgba(21,24,29,.94)}
      #${NS}-help .li-help-x{cursor:pointer;color:var(--dim);background:transparent;border:1px solid var(--line);
        width:24px;height:24px;border-radius:6px;font-size:12px;transition:color .12s,border-color .12s}
      #${NS}-help .li-help-x:hover{color:var(--stop);border-color:var(--stop)}
      #${NS}-help .li-help-body{padding:14px 16px 18px;font-size:13px;line-height:1.55;color:var(--text)}
      #${NS}-help .li-help-body p{margin:0 0 10px}
      #${NS}-help .li-help-body ol,#${NS}-help .li-help-body ul{margin:0 0 12px;padding-left:20px}
      #${NS}-help .li-help-body li{margin-bottom:6px}
      #${NS}-help .li-help-body code{background:#1b1f27;color:#8be9fd;padding:1px 5px;border-radius:4px;font-size:12px}
      #${NS}-help .li-help-body b{color:#f2f4f7}
      #${NS}-panel .tabs{display:flex;border-bottom:1px solid var(--line);position:relative}
      /* The band pattern below is deliberately written as the SAME shape twice
         (0-50% and 50-100%, i.e. period = 50% of the gradient's own space) --
         at background-size:200% that period is exactly one container-width, so
         animating background-position from 0% to 100% slides the window through
         one full period and lands EXACTLY back on the frame it started from.
         That's what makes the loop actually seamless instead of visibly snapping
         back at the end -- a single non-periodic gradient looks identical on
         paper but produces a visible pop on every cycle. */
      #${NS}-panel .tabs::before{content:"";position:absolute;inset:0;pointer-events:none;
        background:linear-gradient(90deg,
          transparent 0%,transparent 15%,rgba(0,172,224,.30) 20%,rgba(0,212,82,.30) 30%,transparent 35%,
          transparent 65%,rgba(0,172,224,.30) 70%,rgba(0,212,82,.30) 80%,transparent 85%,transparent 100%);
        background-size:200% 100%;
        animation:${NS}-tabwhip 4.5s linear infinite}
      @keyframes ${NS}-tabwhip{0%{background-position:0% 0}100%{background-position:100% 0}}
      #${NS}-panel .tab{position:relative;flex:1;text-align:center;padding:10px 0;font-size:13px;font-weight:600;color:var(--dim);
        cursor:pointer;white-space:nowrap;transition:color .12s;overflow:hidden}
      #${NS}-panel .tab:hover{color:var(--text);text-shadow:0 0 8px rgba(0,172,224,.55)}
      #${NS}-panel .tab.active{color:var(--text)}
      /* Per-tab hover underline is INDEPENDENT of the active-tab indicator below --
         it fires on any tab you hover, active or not, as a live "the UI is alive"
         cue. Its gradient scrolls via background-position while :hover, then just
         fades out (no snap) on mouseleave. Colors are Securiti's OWN top-bar gradient
         -- lifted straight from getComputedStyle(.w-alert).backgroundImage on
         securiti.ai itself (rgb(0,172,224) -> rgb(0,212,82), the Veeam-acquisition
         banner), not a guess -- so this reads as "on-brand", not "AI picked teal". */
      #${NS}-panel .tab::after{content:"";position:absolute;left:10px;right:10px;bottom:0;height:2px;
        border-radius:2px;background:linear-gradient(90deg,#00ace0,#00d452,#00ace0);
        background-size:200% 100%;opacity:0;transition:opacity .25s}
      #${NS}-panel .tab:hover::after{opacity:.85;animation:${NS}-tabflow 1.6s linear infinite}
      @keyframes ${NS}-tabflow{0%{background-position:0% 0}100%{background-position:200% 0}}
      /* Single sliding indicator instead of each tab drawing its own static
         border-bottom -- position/width are set from JS (updateTabIndicator, driven
         by the active tab's real offsetLeft/offsetWidth) since flex-equal tab widths
         aren't known at CSS-authoring time. transform+width both transition, so it
         visibly SLIDES to the new tab instead of just teleporting. Its own gradient
         also slowly drifts so the active tab reads as "live", not just static. */
      #${NS}-panel .li-tab-indicator{position:absolute;bottom:-1px;left:0;height:3px;width:0;
        background:linear-gradient(90deg,#00ace0,#00d452,#00ace0);background-size:200% 100%;
        border-radius:2px 2px 0 0;animation:${NS}-tabflow 5s linear infinite;
        transition:transform .25s cubic-bezier(.4,0,.2,1),width .25s cubic-bezier(.4,0,.2,1)}
      #${NS}-panel .tab .dot{background:var(--stop);border-radius:8px;padding:0 5px;font-size:11px;margin-left:3px;display:none;color:#0d0f12;font-weight:700}
      #${NS}-panel .li-tabs{display:flex;gap:6px}
      #${NS}-panel .li-tab{flex:1;background:var(--surface);color:var(--dim);border:1px solid var(--line);
        border-radius:7px;padding:6px 8px;font-size:12px;font-weight:600;cursor:pointer;
        transition:color .12s,border-color .12s,transform .1s}
      #${NS}-panel .li-tab:hover{color:var(--text);transform:translateY(-1px)}
      #${NS}-panel .li-tab.on{color:var(--text);border-color:var(--focus);background:var(--raised)}
      #${NS}-panel .li-tab:disabled{opacity:.4;cursor:default;pointer-events:none}
      #${NS}-panel .tabpane{display:none;padding:14px 16px 16px;max-height:var(--li-mh,74vh);overflow-y:auto}
      #${NS}-panel .tabpane.active{display:block;animation:${NS}-panein .16s ease-out}
      @keyframes ${NS}-panein{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:translateY(0)}}
      #${NS}-panel .row{display:flex;justify-content:space-between;gap:12px;margin:8px 0;color:var(--dim);font-size:13.5px;line-height:1.5}
      #${NS}-panel .row span:last-child{color:var(--text);text-align:right;font-weight:600}
      #${NS}-panel .hint{font-size:12.5px;color:var(--dim);margin:0 0 12px;line-height:1.5}
      /* Same treatment as the tooltip's .li-fix -- this class is shared between both
         surfaces, but only the tooltip had a rule, so in the panel it rendered as an
         unstyled wall of text sitting right under the (styled) standing banner above. */
      #${NS}-panel .li-fix{color:var(--watch);font-size:12.5px;margin-bottom:10px;padding:9px 11px;
        background:rgba(242,195,65,.07);border:1px solid rgba(242,195,65,.24);border-radius:8px;line-height:1.55}
      #${NS}-panel .li-fix b{color:var(--text)}
      #${NS}-panel .li-fix .action{display:inline-block;font:inherit;font-size:12px;font-weight:650;
        color:var(--text);background:var(--surface);border:1px solid var(--line);border-radius:6px;
        padding:5px 9px;cursor:pointer}
      #${NS}-panel .li-fix .action:hover{border-color:var(--focus)}
      /* The un-readable-frame banner. Amber, above the tabs, on every tab -- this changes
         what the whole session means, so it does not belong buried in one pane. */
      #${NS}-panel .li-banner{margin:10px 14px 0;padding:9px 11px;font-size:12px;line-height:1.55;
        color:var(--text);background:rgba(242,195,65,.07);border:1px solid rgba(242,195,65,.28);border-radius:8px}
      #${NS}-panel .li-banner-h{position:relative;font-weight:700;color:var(--watch);margin-bottom:5px;padding-right:18px}
      #${NS}-panel .li-banner-x{position:absolute;top:-2px;right:-2px;font:inherit;font-size:12px;line-height:1;
        color:var(--dim);background:none;border:0;cursor:pointer;padding:2px 4px}
      #${NS}-panel .li-banner-x:hover{color:var(--text)}
      #${NS}-panel .li-banner-row{margin-top:8px;padding-top:7px;border-top:1px solid rgba(242,195,65,.18)}
      #${NS}-panel .li-banner .action{display:inline-block;font:inherit;font-size:11.5px;font-weight:650;
        margin:0 4px 0 0;padding:4px 9px;cursor:pointer;color:var(--text);background:var(--ink);
        border:1px solid var(--line);border-radius:6px}
      #${NS}-panel .li-banner .action:hover{border-color:var(--focus)}
      #${NS}-panel button.action{background:var(--surface);color:var(--text);border:1px solid var(--line);
        border-radius:8px;padding:9px 11px;font-size:13.5px;font-weight:600;cursor:pointer;margin-top:8px;width:100%;
        transition:background .12s,border-color .12s,transform .12s,box-shadow .12s}
      #${NS}-panel button.action:hover{background:var(--raised);border-color:#3a414c;
        transform:translateY(-1px);box-shadow:0 4px 10px -4px rgba(0,0,0,.5)}
      #${NS}-panel button.action:active{transform:translateY(0)}
      #${NS}-panel button.action:focus-visible,#${NS}-panel .tab:focus-visible,#${NS}-panel .close:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
      #${NS}-panel button.rec{border-color:var(--stop);color:var(--stop)}
      #${NS}-panel .entry{border-left:2px solid var(--line);background:var(--surface);border-radius:0 8px 8px 0;
        padding:9px 11px;margin-bottom:8px;font-size:13px}
      #${NS}-panel .entry .top{display:flex;justify-content:space-between;gap:8px;color:var(--dim);font-size:12px;margin-bottom:4px}
      #${NS}-panel .entry .txt{color:var(--text);margin-bottom:5px;word-break:break-word}
      #${NS}-panel code{background:var(--raised) !important;color:var(--code) !important;padding:2px 5px;
        border-radius:5px;font-size:12px;word-break:break-all;text-shadow:none !important}
      #${NS}-panel .badge{display:inline-block;color:#0d0f12;font-weight:700;padding:1px 7px;border-radius:5px;font-size:11.5px;letter-spacing:.2px}
      #${NS}-panel .empty{color:var(--dim);font-size:13px;text-align:center;padding:22px 0}
      #${NS}-panel .copybtn{background:transparent;border:1px solid var(--line);color:var(--dim);border-radius:5px;
        font-size:11.5px;padding:2px 7px;cursor:pointer;width:auto;margin-top:0}
      #${NS}-panel pre{background:#0a0c0f !important;color:var(--code) !important;border:1px solid var(--line);
        border-radius:8px;padding:11px;font-size:12px;line-height:1.55;overflow:auto;max-height:230px;
        white-space:pre-wrap;word-break:break-word;text-shadow:none !important}

      /* ---- tooltip: the readout ---- */
      /* max-height, not just max-width: the card now carries two Playwright forms plus
         three alternatives, which on a 13" laptop is taller than the viewport. Without
         this the bottom -- where the shortcut legend lives -- ran off the screen. */
      #${NS}-tooltip{position:fixed;z-index:2147483647;pointer-events:none;width:480px;max-width:94vw;display:none;
        max-height:94vh;overflow-y:auto;overscroll-behavior:contain;
        color:var(--text);background:var(--ink);border:1px solid var(--line);border-radius:12px;padding:0;
        box-shadow:0 18px 44px -14px rgba(0,0,0,.8)}
      /* Verdict band: the answer, and the only saturated colour on the surface. */
      #${NS}-tooltip .li-head{display:flex;align-items:center;gap:11px;padding:12px 14px;border-bottom:1px solid var(--line)}
      #${NS}-tooltip .li-verdict{flex:none;font-weight:750;font-size:12px;letter-spacing:.6px;padding:5px 10px;
        border-radius:6px;color:#0d0f12;white-space:nowrap}
      #${NS}-tooltip .li-label{font-size:13px;color:var(--dim);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:550}
      /* The measurement. Tabular numerals so digits hold their column while you sweep. */
      #${NS}-tooltip .li-uniq{flex:none;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
        font-variant-numeric:tabular-nums;font-size:16px;font-weight:700;letter-spacing:.5px;white-space:nowrap}
      #${NS}-tooltip .li-uniq.ok{color:var(--ship)}
      #${NS}-tooltip .li-uniq.warn{color:var(--watch)}
      #${NS}-tooltip .li-uniq.bad{color:var(--stop)}
      #${NS}-tooltip .li-body{padding:12px 14px 11px}
      #${NS}-tooltip .li-needs{display:flex;flex-wrap:wrap;gap:5px;margin:0 0 11px}
      #${NS}-tooltip .li-need{font-size:11.5px;font-weight:600;padding:3px 8px;border-radius:5px;
        color:var(--watch);background:rgba(242,195,65,.09);border:1px solid rgba(242,195,65,.26)}
      #${NS}-tooltip .li-loc{pointer-events:auto;position:relative;background:var(--surface);border:1px solid var(--line);
        border-radius:9px;padding:9px 11px 10px;margin-bottom:8px;cursor:copy;transition:border-color .12s,background .12s}
      #${NS}-tooltip .li-loc:hover{border-color:#3a414c;background:var(--raised)}
      #${NS}-tooltip .li-loc-lbl{display:flex;justify-content:space-between;align-items:baseline;gap:10px;
        font-size:11px;text-transform:uppercase;letter-spacing:.7px;font-weight:700;color:var(--dim);margin-bottom:6px}
      #${NS}-tooltip .li-loc-lbl .sub{text-transform:none;letter-spacing:0;font-weight:500;color:var(--dim);opacity:.85}
      #${NS}-tooltip .li-loc-lbl .css{color:var(--dim)}
      #${NS}-tooltip .li-loc code{display:block;font-size:12.5px;line-height:1.55;color:var(--code) !important;
        background:transparent !important;word-break:break-all;user-select:text;-webkit-user-select:text;cursor:text;
        padding:0 !important;margin:0 !important;border:0 !important;text-shadow:none !important}
      #${NS}-tooltip .li-copy{position:absolute;top:7px;right:8px;font-size:11px;font-weight:650;color:var(--dim);
        background:var(--ink);border:1px solid var(--line);border-radius:5px;padding:2px 7px;opacity:0;transition:opacity .12s}
      #${NS}-tooltip .li-loc:hover .li-copy{opacity:1}
      #${NS}-tooltip .li-loc.copied{border-color:var(--ship)}
      #${NS}-tooltip .li-loc.copied .li-copy{opacity:1;color:var(--ship);border-color:var(--ship)}
      /* Two Playwright forms for an embedded module end in the SAME chain, so read
         side by side they look like the same line printed twice. A chip says WHEN each
         one applies, and .li-pre highlights the frameLocator() prefix that is the whole
         difference between them. */
      /* The frame advisory carries BUTTONS, and the card is pointer-events:none by
         default so the cursor can pass through it. Opt this block back in, or the one
         instruction that fixes a cross-origin frame is unclickable. */
      #${NS}-tooltip .li-fix{pointer-events:auto}
      #${NS}-tooltip .li-fix .action,#${NS}-tooltip .li-inframe .action{pointer-events:auto;display:inline-block;
        font:inherit;font-size:11.5px;font-weight:650;margin:3px 0;padding:4px 9px;cursor:pointer;
        color:var(--text);background:var(--ink);border:1px solid var(--line);border-radius:6px}
      #${NS}-tooltip .li-fix .action:hover,#${NS}-tooltip .li-inframe .action:hover{border-color:var(--focus)}
      #${NS}-tooltip .li-inframe{pointer-events:auto;margin-top:9px;padding-top:9px;border-top:1px solid rgba(242,195,65,.25);
        color:var(--text);line-height:1.6}
      #${NS}-tooltip .li-pick{font-size:12px;color:var(--dim);margin:0 0 8px;line-height:1.5}
      #${NS}-tooltip .li-pick b{color:var(--text);font-weight:650}
      #${NS}-tooltip .li-when{display:inline-block;vertical-align:baseline;margin-left:6px;font-size:10.5px;
        font-weight:650;letter-spacing:.2px;text-transform:none;padding:1px 6px;border-radius:4px;
        color:var(--text);background:rgba(110,168,254,.12);border:1px solid rgba(110,168,254,.32)}
      #${NS}-tooltip .li-when.alt{color:var(--watch);background:rgba(242,195,65,.1);border-color:rgba(242,195,65,.34)}
      #${NS}-tooltip .li-pre{color:var(--watch) !important;background:rgba(242,195,65,.1);
        border-radius:3px;padding:0 2px;font-weight:600}
      #${NS}-tooltip .li-note{color:var(--dim);font-size:12px;margin:2px 0;line-height:1.5}
      #${NS}-tooltip .li-fix{color:var(--watch);font-size:12px;margin-top:8px;padding:7px 9px;
        background:rgba(242,195,65,.07);border:1px solid rgba(242,195,65,.2);border-radius:7px;line-height:1.5}
      #${NS}-tooltip .li-scope{color:var(--dim);background:var(--surface);border:1px solid var(--line);
        border-radius:7px;padding:7px 9px;margin-top:8px}
      #${NS}-tooltip .li-foot{color:var(--dim);font-size:11.5px;border-top:1px solid var(--line);
        margin-top:10px;padding-top:9px;opacity:.9}
      #${NS}-tooltip .li-foot b{color:var(--text);font-weight:650}
      #${NS}-tooltip .warn{color:var(--watch);font-size:12px;margin-top:8px;background:rgba(242,195,65,.07);
        border:1px solid rgba(242,195,65,.2);border-radius:7px;padding:7px 9px;line-height:1.5}
      #${NS}-tooltip .stack{margin-top:8px;font-size:11.5px;color:var(--dim)}
      /* Alternatives: every one has been run against the live DOM and confirmed to
         resolve to this element. Nothing here is a guess. */
      #${NS}-tooltip .li-alts,#${NS}-tooltip .li-reveal{margin-top:11px;padding-top:10px;border-top:1px solid var(--line)}
      #${NS}-tooltip .li-alts-h{font-size:11px;text-transform:uppercase;letter-spacing:.7px;font-weight:700;color:var(--dim);margin-bottom:7px}
      #${NS}-tooltip .li-alt{pointer-events:auto;position:relative;background:var(--surface);border:1px solid var(--line);border-radius:8px;
        padding:8px 10px;margin-bottom:6px;cursor:copy;transition:border-color .12s,background .12s}
      #${NS}-tooltip .li-alt:hover{border-color:#3a414c;background:var(--raised)}
      #${NS}-tooltip .li-alt:hover .li-copy{opacity:1}
      #${NS}-tooltip .li-alt.copied{border-color:var(--ship)}
      #${NS}-tooltip .li-alt.copied .li-copy{opacity:1;color:var(--ship);border-color:var(--ship)}
      #${NS}-tooltip .li-alt-top{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:5px}
      #${NS}-tooltip .li-alt-kind{font-size:11px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:var(--dim)}
      /* data-pinned is called out because it is the difference between a test that
         survives a database reseed and one that does not. */
      #${NS}-tooltip .li-alt-pin{font-size:10.5px;font-weight:650;padding:1px 6px;border-radius:4px;color:var(--dim);border:1px solid var(--line)}
      #${NS}-tooltip .li-alt-pin.data{color:var(--watch);border-color:rgba(242,195,65,.35)}
      #${NS}-tooltip .li-alt code{display:block;font-size:12px;line-height:1.5;color:var(--code) !important;background:transparent !important;
        word-break:break-all;padding:0 !important;border:0 !important}
      #${NS}-tooltip .li-alt-note{font-size:11.5px;color:var(--dim);margin-top:5px;line-height:1.45}
      #${NS}-tooltip .li-reveal code{display:block;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;
        color:var(--ship) !important;background:var(--surface) !important;border:1px solid var(--line);border-radius:7px;padding:8px 10px}
      /* Frame inventory (Health tab). Enumerating frames works across origins; only
         looking INSIDE one is restricted, so cross-origin rows are dimmed but present
         rather than hidden -- "there are 7 frames here and you can inspect 1" is the
         fact the engineer needs. */
      #${NS}-panel .li-frames{margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--line)}
      #${NS}-panel .li-alts-h{font-size:11px;text-transform:uppercase;letter-spacing:.7px;font-weight:700;color:var(--dim);margin-bottom:7px}
      #${NS}-panel .li-frame{background:var(--surface);border:1px solid var(--line);border-left:2px solid var(--line);
        border-radius:7px;padding:7px 9px;margin-bottom:5px}
      #${NS}-panel .li-frame.same{border-left-color:var(--ship)}
      #${NS}-panel .li-frame.cross{border-left-color:#4a5260}
      #${NS}-panel .li-frame-top{display:flex;align-items:baseline;gap:7px;margin-bottom:4px;flex-wrap:wrap}
      #${NS}-panel .li-frame-host{font-weight:650;font-size:12.5px;color:var(--text)}
      #${NS}-panel .li-frame-tag{font-size:10.5px;font-weight:650;padding:1px 5px;border-radius:4px;color:var(--dim);border:1px solid var(--line)}
      #${NS}-panel .li-frame-tag.ok{color:var(--ship);border-color:rgba(90,200,140,.35)}
      #${NS}-panel .li-frame code{display:block;font-size:11.5px;line-height:1.5;color:var(--code) !important;
        background:transparent !important;word-break:break-all;padding:0 !important;border:0 !important}
      #${NS}-panel .li-frame-note{font-size:11.5px;color:var(--dim);margin-top:5px;line-height:1.45}
      /* Doctor pane */
      #${NS}-panel .doc-in{width:100%;box-sizing:border-box;background:#0a0c0f;color:var(--code);border:1px solid var(--line);
        border-radius:8px;padding:9px 11px;font:12.5px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;min-height:64px;resize:vertical}
      #${NS}-panel .doc-in:focus{outline:2px solid var(--focus);outline-offset:1px}
      #${NS}-panel .doc-step{display:flex;justify-content:space-between;gap:10px;font:12px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;
        color:var(--dim);border-bottom:1px dotted var(--line);padding:3px 0}
      #${NS}-panel .doc-step b{color:var(--text);font-variant-numeric:tabular-nums}
      #${NS}-panel .doc-step.zero b{color:var(--stop)}
      #${NS}-panel .doc-why{font-size:13px;color:var(--text);line-height:1.55;margin:9px 0;padding:9px 11px;
        background:var(--surface);border:1px solid var(--line);border-left:2px solid var(--watch);border-radius:0 8px 8px 0}
      /* Only the values that CHANGED animate -- a card-wide entrance on every
         mousemove read as jitter rather than as feedback. */
      @keyframes ${NS}-tick{from{opacity:.35}to{opacity:1}}
      #${NS}-tooltip .li-uniq,#${NS}-tooltip .li-verdict{animation:${NS}-tick .16s ease-out}
      @media (prefers-reduced-motion:reduce){
        /* Every animation/transform added since the original build is neutralized
           here too -- accessibility settings apply to new motion exactly like old. */
        #${NS}-tooltip .li-uniq,#${NS}-tooltip .li-verdict,
        #${NS}-panel,#${NS}-panel .tabpane.active,#${NS}-panel .brand-logo,
        #${NS}-help .li-help-card{animation:none !important;opacity:1 !important;transform:none !important}
        /* .li-tab-indicator keeps its JS-driven transform (that's POSITION, not
           motion-for-motion's-sake -- dropping it would leave the bar stuck at the
           left edge instead of under the active tab); only its gradient-drift
           animation is neutralized. .tab::after's hover shimmer is animation-only,
           no transform to preserve, so it can go fully still. */
        #${NS}-panel .li-tab-indicator{animation:none !important}
        #${NS}-panel .tab::after{animation:none !important;opacity:0 !important}
        #${NS}-panel .tabs::before{animation:none !important}
        #${NS}-flyin,.${NS}-flyin-spark{display:none !important}
        #${NS}-panel.li-panel-pop{animation:none !important;opacity:1 !important;transform:none !important}
        /* Toast keeps translateX(-50%) -- that half is permanent horizontal centering,
           not part of the slide-in animation; dropping it entirely would leave the
           toast stuck against the left edge instead of centered. */
        #${NS}-toast.show{animation:none !important;opacity:1 !important;transform:translateX(-50%) !important}
        #${NS}-panel *,#${NS}-tooltip *,#${NS}-help *{transition:none !important}
      }
      #${NS}-toast{position:fixed;bottom:18px;left:50%;transform:translateX(-50%) translateY(10px);
        opacity:0;background:var(--ink);
        color:var(--text);border:1px solid var(--line);border-left:2px solid var(--ship);padding:10px 16px;
        border-radius:9px;font:13.5px/1.4 -apple-system,"Segoe UI",Roboto,sans-serif;z-index:2147483647;
        display:none;max-width:70vw;box-shadow:0 14px 34px -12px rgba(0,0,0,.7)}
      #${NS}-toast.show{display:block;animation:${NS}-toastin .2s ease-out forwards}
      @keyframes ${NS}-toastin{to{transform:translateX(-50%) translateY(0);opacity:1}}
      /* One-shot entrance flourish on activation: a glowing meteor swoops in ONE
         smooth, monotonic curve (down and to the right the whole way -- no
         back-and-forth reversals, which reads as a chaotic zigzag) from roughly
         where a bookmarks-bar click originates to
         the panel's default bottom-right corner, then the real panel pops in
         right where it lands. Purely cosmetic overlay -- the actual functional
         boot (Catalog.hydrate/passiveScan/injectAllFrames) runs in parallel
         underneath, not gated on this finishing. */
      #${NS}-flyin{position:fixed;top:-56px;left:8vw;width:26px;height:26px;z-index:2147483647;
        pointer-events:none;border-radius:50%;
        background:radial-gradient(circle at 35% 30%,#fff 0%,#bdeeff 20%,#00ace0 55%,rgba(0,172,224,0) 78%);
        box-shadow:
          0 0 18px 4px rgba(0,172,224,.85),
          -13px -10px 20px 2px rgba(0,172,224,.45),
          -26px -20px 30px 4px rgba(0,212,82,.28),
          -40px -31px 40px 6px rgba(0,172,224,.14);
        animation:${NS}-flyin 2s cubic-bezier(.22,.61,.36,1) forwards}
      /* Two trailing sparks reuse the SAME path/timing, just delayed a beat --
         that's what turns one glowing dot into a little "shower" following the
         meteor's head, without needing separate hand-authored keyframes. */
      .${NS}-flyin-spark{position:fixed;top:-56px;left:8vw;width:8px;height:8px;border-radius:50%;
        z-index:2147483646;pointer-events:none;
        background:radial-gradient(circle,#e8fbff,rgba(0,172,224,.9) 55%,transparent 76%);
        box-shadow:0 0 12px 3px rgba(0,172,224,.6);
        animation:${NS}-flyin 2s cubic-bezier(.22,.61,.36,1) forwards}
      @keyframes ${NS}-flyin{
        0%{top:-56px;left:8vw;transform:scale(.55) rotate(0deg);opacity:0}
        10%{opacity:1;transform:scale(.8) rotate(25deg)}
        42%{top:32vh;left:40vw;transform:scale(1) rotate(140deg)}
        72%{top:62vh;left:68vw;transform:scale(1.05) rotate(250deg)}
        90%{top:calc(100vh - 68px);left:calc(100vw - 56px);transform:scale(1.1) rotate(345deg);opacity:1}
        100%{top:calc(100vh - 68px);left:calc(100vw - 56px);transform:scale(.2) rotate(380deg);opacity:0}
      }
      /* fill-mode "both" is load-bearing, not "backwards": the base #${NS}-panel
         rule already has its OWN opacity:0/translateY(10px) literal values plus
         its own (now-superseded) panelin animation to reach opacity:1. Since
         .li-panel-pop has higher specificity, it fully replaces that animation
         property -- with only "backwards", nothing was left holding opacity:1
         once THIS animation finished, so it fell back to the base rule's
         literal opacity:0 and stayed invisible forever (caught live: panel
         popped in correctly then silently vanished right after). "both" holds
         the first keyframe during the delay AND the last one after it ends. */
      #${NS}-panel.li-panel-pop{animation:${NS}-panelpop .34s cubic-bezier(.2,.9,.3,1.2) 1.72s both}
      @keyframes ${NS}-panelpop{0%{opacity:0;transform:scale(.85);filter:blur(6px)}100%{opacity:1;transform:scale(1);filter:blur(0)}}
    `;
    document.head.appendChild(style);

    const tooltip = document.createElement("div");
    tooltip.id = NS + "-tooltip";
    document.body.appendChild(tooltip);
    // Click a locator line inside the tooltip \u2192 copy exactly that line (Playwright
    // or the DevTools-searchable CSS) and burn it into approved memory.
    tooltip.addEventListener("click", (e) => {
      // This used to check for a "[data-alt]" attribute that has never existed
      // anywhere in this file's markup (alternative rows carry
      // "data-altn", numbered, added later for Ctrl+F-safety reasons -- this guard was
      // simply never updated to match). Every alternative row failed this check and
      // returned early, so "click an alternative to copy it" has been silently dead
      // since it was introduced -- only the Alt+1/2/3 keyboard shortcut ever worked.
      const row = e.target.closest(".li-loc") || e.target.closest(".li-alt");
      if (!row || !tooltip.__res) return;
      // Respect a MANUAL text selection: if the user dragged to highlight part of a
      // line, don't hijack the click into a full-line copy \u2014 let them Ctrl/Cmd+C
      // their own selection. Only a plain click (no selection) or the explicit "Copy"
      // button copies the whole line. Fixes the "it copies everything" glitch.
      const onCopyBtn = !!e.target.closest(".li-copy");
      const sel = (window.getSelection && window.getSelection().toString()) || "";
      if (sel.trim() && !onCopyBtn) return;
      e.preventDefault(); e.stopPropagation();
      // "Copy the tool for <frame host>" \u2014 hands over the whole overlay as console text.
      const fp = e.target.closest("[data-framepaste]");
      if (fp) {
        e.preventDefault(); e.stopPropagation();
        const payload = frameBootPayload();
        if (payload) { copyToClipboard(payload); showToast("Tool copied \u2014 paste it in the Console with the frame selected"); }
        return;
      }
      const alt = e.target.closest("[data-altn]");
      if (alt) {
        e.preventDefault(); e.stopPropagation();
        const picked = lastAlts[(+alt.getAttribute("data-altn") || 0) - 1];
        if (picked) {
          copyToClipboard(picked.code);
          flashAltLine(alt);
          approveAlternative(picked, typeof routeKey === "function" ? routeKey() : "");
        }
        return;
      }
      const which = row.getAttribute("data-copy");
      // Copy the line the engineer can actually USE: for a shadow element the
      // Ctrl+F-able CSS does not exist, so cssDevtools carries the console chain.
      const text = which === "css" ? (tooltip.__res.cssDevtools || tooltip.__res.css)
        : which === "embedded" ? tooltip.__res.embeddedPrimary
        : tooltip.__res.primary;
      copyToClipboard(text);
      row.classList.add("copied");
      const btn = row.querySelector(".li-copy"); if (btn) btn.textContent = "Copied \u2713";
      try { Catalog.approve(tooltip.__res, typeof routeKey === "function" ? routeKey() : ""); } catch {}
      markCheckup(tooltip.__res, "copy");
    }, true);
    const toastEl = document.createElement("div");
    toastEl.id = NS + "-toast";
    document.body.appendChild(toastEl);
    // Standalone element, same pattern as tooltip/toastEl above -- NOT nested inside
    // #panel. The panel has `overflow:hidden` and no fixed height (it sizes to
    // whichever tab's content is showing), so a modal nested inside it would get
    // clipped to whatever the current tab's height happens to be instead of showing
    // as a real, roomy help card.
    const helpEl = document.createElement("div");
    helpEl.id = NS + "-help";
    helpEl.className = "li-help";
    document.body.appendChild(helpEl);
    function showToast(msg) {
      toastEl.textContent = msg;
      // Restart the slide-in animation even on a rapid second toast: just re-adding
      // ".show" while it's already present is a no-op to the browser (same class list
      // = no animation restart) -- remove it, force a reflow, then re-add.
      toastEl.classList.remove("show");
      void toastEl.offsetWidth;
      toastEl.classList.add("show");
      clearTimeout(showToast._t);
      showToast._t = setTimeout(() => toastEl.classList.remove("show"), 1600);
    }
    /**
     * Render a selector inside the tool's own UI WITHOUT making the tool a Ctrl+F hit.
     *
     * The Elements find bar unions a plain-text search over your query, so the moment the
     * tooltip printed `span.ant-tag.grey-tag` on screen, searching for that selector
     * returned "2 of 2" -- one real element plus this tool's own printed copy of the
     * string. The measurement that fixes it:
     *
     *   plain <code>text</code>                        -> 1 text hit
     *   text split across two child <span>s            -> 0 text hits
     *   the string held in a data- attribute           -> 1 hit (attributes are searched)
     *   the string inside a CLOSED shadow root         -> 1 hit (DevTools is privileged)
     *
     * DOM.performSearch attributes a text match to the single element that OWNS the whole
     * contiguous string, so if no element owns it, there is no hit. Splitting costs
     * nothing else: the spans are unstyled and inline, so it looks identical, textContent
     * still yields the full string, a manual drag-select still copies the full string, and
     * the copy buttons never read from the DOM anyway.
     */
    function codeText(s) {
      const t = String(s == null ? "" : s);
      if (t.length < 2) return escapeHtml(t);
      const i = Math.floor(t.length / 2);
      return `<span>${escapeHtml(t.slice(0, i))}</span><span>${escapeHtml(t.slice(i))}</span>`;
    }
    function escapeHtml(s) {
      return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }

    let sessionCopies = 0, sessionHovers = 0, hoverCacheEl = null, hoverCacheResult = null, hoverCacheT = 0, lastStack = [], stackIndex = 0;
    // Locator strings the tooltip / Doctor are currently offering. Held here rather than in
    // data- attributes, because the Elements find bar searches attribute values too and the
    // tool must never be a hit for the selector it just handed you. See codeText().
    let lastAlts = [], lastDocAlts = [];
    function copyToClipboard(text) {
      // The frame handoff copies the whole overlay (~250 KB). Echoing that into the toast
      // filled the screen with source, so long payloads get a size instead of a preview.
      const done = () => { sessionCopies++; stats.copies++; saveStats(stats);
        showToast(text.length > 200 ? "Copied " + Math.round(text.length / 1024) + " KB to clipboard" : "Copied: " + text);
        if (IS_TOP) renderPanel("inspect"); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
      else fallbackCopy(text, done);
    }
    function fallbackCopy(text, done) {
      try {
        const ta = document.createElement("textarea");
        ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); done();
      } catch {
        showToast("Clipboard blocked \u2014 copy manually: " + text);
      }
    }
    function renderTooltip(target, e, res) {
      res = res || resolveUniqueLocator(target);
      target.__liRes = res;
      tooltip.__res = res; tooltip.__el = target;
      trackLocator(res);
      sessionHovers++;
      // Confidence chip (spec #10): show HOW it is 1-of-1, not just a grade.
      // The measurement this tool exists to make, phrased the way DevTools phrases it.
      // Green only when it stands on its own; amber when it took scoping or DOM order to
      // get there; red when it is not 1-of-1 at all.
      const matchCount = res.unique ? 1 : (typeof res.cssDevtoolsCount === "number" && res.cssDevtoolsCount > 0 ? res.cssDevtoolsCount : "?");
      // Colour the readout by the VERDICT, not by uniqueness alone. A green "1 OF 1"
      // next to a red "DON'T SHIP" is two true statements that read as a contradiction;
      // and for a positional or virtual-list locator "1 of 1" is only true right now, so
      // say NOW out loud rather than implying permanence.
      const transient = res.verification === "positional" || res.virtualPositional;
      const uniqCls = !res.unique ? "bad" : res.verdict === "dont-ship" ? "bad" : res.verdict === "watch" || res.verification === "scoped" ? "warn" : "ok";
      const uniqTitle = !res.unique ? "Matches more than one element"
        : res.verification === "positional" ? "1-of-1, but only because of DOM order"
        : res.verification === "scoped" ? "1-of-1 once scoped inside a container"
        : "1-of-1 on its own";
      const uniq = `<span class="li-uniq ${uniqCls}" title="${escapeHtml(uniqTitle)}">1 OF ${escapeHtml(String(matchCount))}${transient && res.unique ? " NOW" : ""}</span>`;
      let bHtml = "";
      if (res.boundary) {
        const chain = res.boundary.chain.map((c) => `${c.kind}:${escapeHtml(c.host)}`).join(" \u203A ");
        bHtml = res.boundary.unpierceable
          ? `<div class="warn">\u26A0 ${escapeHtml(res.boundary.type)} \u2014 cannot pierce; use frameLocator/component hook. ${escapeHtml(chain)}</div>`
          : `<div class="stack">in ${escapeHtml(res.boundary.type)} \u00B7 ${escapeHtml(chain)}</div>`;
      }
      const frameTipHtml = frameAdviceHtml(target);
      // "Overlap 1/21" alone reads as a diagnostic with no instruction attached. Say what
      // it is for: your cursor sits on top of nested elements, and the one you want (the
      // button) is usually an ancestor of the one under the pixel (its icon or label).
      const stackHtml = lastStack.length > 1
        ? `<div class="stack">Your cursor is over <b>${lastStack.length}</b> nested elements \u2014 showing #${stackIndex + 1}
             (<b>${escapeHtml(tagOf(lastStack[stackIndex]) || "")}</b>). Press <b>Alt+Z</b> to step outward to the next one
             if you meant the button rather than the icon inside it.</div>`
        : "";
      // ONE detail line, not three. `why` explains the verdict and `note` explains how the
      // locator was reached; they overlapped heavily, and the card also carried a generic
      // "verified 1-of-1 on this page" paragraph that the 1 OF 1 readout already states.
      // Merge them, strip whatever the readout implies, keep only what adds information.
      const detail = (function () {
        const parts = [];
        if (res.why) parts.push(res.why.trim());
        let n = (res.note || "").trim();
        n = n.replace(/^Unique on its own\.\s*/i, "")
             .replace(/Relative locator \u2014 scoped under [^.]*\.\s*/i, "")
             .replace(/Scoped under a stable parent to make it 1-of-1\.\s*/i, "");
        if (n && !parts.some((x) => x.toLowerCase().startsWith(n.slice(0, 24).toLowerCase()))) parts.push(n);
        return parts.join("  ").replace(/\s{2,}/g, "  ").trim();
      })();
      // Alternatives are computed ONLY when the primary is not already the obvious
      // choice -- every one is verified against the live DOM, so this costs real work.
      let altHtml = "", revealHtml = "";
      if (res.verdict !== "ship" || res.needs.length) {
        let alts = [];
        try { alts = suggestAlternatives(target, res, framePrefix(res.boundary)); } catch {}
        // This used to only get (re)assigned inside the
        // `if (alts.length)` branch below, so hovering from an element WITH
        // alternatives to one with NONE left the previous element's codes sitting in
        // lastAlts -- Alt+1/2/3 would silently copy a stale locator for a completely
        // different element. Unconditional now; slicing an empty array is just [].
        lastAlts = alts.slice(0, 3); // full alt objects, not just .code -- approveAlternative needs .kind/.el too
        if (!alts.length && res.verdict !== "ship") {
          // Silence here reads as a missing feature. Say it plainly instead: the engine
          // searched and there genuinely is nothing better on this element.
          altHtml = `<div class="li-alts"><div class="li-alts-h">Verified alternatives</div>` +
            `<div class="li-alt-note">None. Every other candidate on this element was checked and none resolves 1-of-1, so this really is the best available locator. The fix is markup, not a cleverer selector.</div></div>`;
        }
        if (alts.length) {
          // Each of these was run against the live DOM and came back 1-of-1. Give them
          // the same affordances as the primary rows -- a visible Copy button and a
          // keyboard shortcut -- because "click to copy" alone was not discoverable and
          // required chasing the card with the mouse.
          // The code goes in a JS array, NOT a data- attribute: DOM.performSearch
          // substring-matches attribute VALUES, so data-alt="page.locator('.x')" made the
          // tooltip itself a Ctrl+F hit for `.x`. Only the index lives in the DOM.
          altHtml = `<div class="li-alts"><div class="li-alts-h">Other locators that also work here \u2014 all verified 1-of-1</div>` +
            alts.slice(0, 3).map((a, i) => `<div class="li-alt" data-altn="${i + 1}">
              <button class="li-copy">Copy</button>
              <div class="li-alt-top"><span class="li-alt-kind">${escapeHtml(a.kind)}</span><span class="li-alt-pin ${a.pin === "data-pinned" ? "data" : ""}" title="${a.pin === "data-pinned" ? "Tied to this environment's data \u2014 a reseed can change it" : "Pinned on role/markup \u2014 survives a data reseed"}">${escapeHtml(a.pin === "data-pinned" ? "tied to this data" : "survives data changes")}</span></div>
              <code>${codeText(a.code)}</code>
              <div class="li-alt-note">${escapeHtml(a.note)} <b>Alt+${i + 1}</b> to copy.</div></div>`).join("") + `</div>`;
        }
        if (res.ariaHidden) {
          let rv = null;
          try { rv = revealStep(target, framePrefix(res.boundary)); } catch {}
          if (rv) revealHtml = `<div class="li-reveal"><div class="li-alts-h">Open it first</div><code>${codeText(rv.code)}</code><div class="li-alt-note">Reveals the target by clicking ${escapeHtml(rv.desc)}.</div></div>`;
        }
      }
      const cssSearchable = res.css && !/>>>|frameLocator/.test(res.css);
      // Be explicit about what the CSS line will do in DevTools. Measured in
      // the real DevTools search: Ctrl+F pierces shadow, enters iframes
      // (cross-origin included), counts nodes this tool injected, and unions a
      // plain-text search over the query itself.
      const cssDevLabel =
        res.cssDevtools && res.cssDevtools !== res.css
          ? "paste in Console \u2014 same component exists twice \u00b7 Alt+C"
          : res.devtoolsCopyCollision
            ? `\u26a0 Ctrl+F \u2192 ${res.cssDevtoolsCount}: 1 element + this text sits in page copy \u00b7 Alt+C`
            : res.cssUsableInDevtools
              // Ctrl+F searches frames this realm cannot reach, so the count is
              // strictly a lower bound. Only worth saying when the selector is
              // generic enough to plausibly recur in another frame -- an id- or
              // attribute-anchored one will not, and on this app (EDC + 5-7 vendor
              // iframes, all cross-origin) an unconditional note would fire on
              // every single hover and train the reader to ignore it.
              ? "\u2315 Ctrl+F in Elements \u2192 1 of 1" +
                (res.devtoolsFramesUnseen && !/[[#]/.test(res.css)
                  ? ` (+${res.devtoolsFramesUnseen} frame(s) Ctrl+F also searches)` : "") + " \u00b7 Alt+C"
              : `\u26a0 Ctrl+F in Elements \u2192 ${res.cssDevtoolsCount} match(es) \u00b7 Alt+C`;
      tooltip.innerHTML = `
        <div class="li-head">
          <span class="li-verdict" style="background:${VERDICT_COLORS[res.verdict] || "#666"}" title="${escapeHtml(res.why || "")}">${escapeHtml(res.verdictText || "")}</span>
          <span class="li-label" title="${escapeHtml(res.label)}">${escapeHtml(STRATEGY_HUMAN[res.primaryStrategy] || res.label)}</span>
          ${uniq}
        </div>
        <div class="li-body">
        ${res.needs && res.needs.length ? `<div class="li-needs">${res.needs.map((k) => `<span class="li-need" title="${escapeHtml(res.needsText[k] || "")}">${escapeHtml(res.needsText[k] || k)}</span>`).join("")}</div>` : ""}
        <div class="li-loc" data-copy="primary">
          <div class="li-loc-lbl"><span>Playwright${res.embeddedPrimary ? ` <span class="li-when">test opens ${escapeHtml(location.hostname)} directly</span>` : ""}</span><span class="sub">${res.embeddedPrimary ? "<b>Alt+P</b>" : escapeHtml(res.stability) + " \u00B7 click or <b>Alt+P</b>"}</span></div>
          <button class="li-copy">Copy</button>
          <code>${codeText(res.primary)}</code>
        </div>
        ${res.embeddedPrimary ? `<div class="li-loc" data-copy="embedded">
          <div class="li-loc-lbl"><span>Playwright <span class="li-when alt">test starts at ${escapeHtml(res.standaloneModule.parentHost)}</span></span><span class="sub"><b>Alt+F</b></span></div>
          <button class="li-copy">Copy</button>
          <code><span class="li-pre">${codeText(res.embeddedPrefix)}</span>${codeText(res.embeddedPrimary.slice(res.embeddedPrefix.length))}</code>
          <div class="li-alt-note">Only the <span class="li-pre">highlighted</span> part differs. Without it, <code style="font-size:10.5px">page.locator()</code> cannot see inside the frame and finds 0.</div>
        </div>` : ""}
        <div class="li-loc" data-copy="css">
          <div class="li-loc-lbl"><span class="css">${res.cssUsableInDevtools === false && res.cssDevtools !== res.css ? "DevTools console chain" : "CSS selector"}</span><span class="sub">${cssDevLabel}</span></div>
          <button class="li-copy">Copy</button>
          <code>${codeText(res.cssDevtools || res.css)}</code>
        </div>
        <div class="li-note">${escapeHtml(detail)}</div>
        ${res.fix ? `<div class="li-fix">\u2192 ${escapeHtml(res.fix)}</div>` : ""}
        ${altHtml}${revealHtml}
        ${frameTipHtml}${bHtml}${stackHtml}
        <div class="li-foot">Copy without clicking \u2014 <b>Alt+P</b> Playwright${res.embeddedPrimary ? " (direct)" : ""}${res.embeddedPrimary ? " \u00B7 <b>Alt+F</b> Playwright (via shell)" : ""} \u00B7 <b>Alt+C</b> CSS${
          // This used to say "Alt+1/2/3" whenever ANY
          // alternative existed, even if only 1 or 2 actually rendered below --
          // pressing the digit that wasn't there did nothing, which read as a broken
          // shortcut rather than "there simply is no 3rd alternative for this element."
          // Now names exactly the digits that exist, never more.
          lastAlts.length === 1 ? " \u00B7 <b>Alt+1</b> the alternative below"
          : lastAlts.length === 2 ? " \u00B7 <b>Alt+1/2</b> an alternative below"
          : lastAlts.length === 3 ? " \u00B7 <b>Alt+1/2/3</b> an alternative below"
          : ""
        }${lastStack.length > 1 ? " \u00B7 <b>Alt+Z</b> next element out" : ""} \u00B7 <b>Esc</b> close</div>
        </div>`;
      tooltip.style.display = "block";
      // Position: prefer down-right of the cursor, but never underneath our OWN panel.
      // Both sit at the same z-index and the panel is later in the DOM, so it wins the
      // stacking order -- hovering anything in the bottom-right corner used to bury the
      // card behind the panel, which is where the tool is least useful.
      const TW = tooltip.offsetWidth || 480, TH = tooltip.offsetHeight || 240;
      let x = e.clientX + 18, y = e.clientY + 18;
      if (x + TW > window.innerWidth - 8) x = e.clientX - TW - 18;      // flip left
      if (y + TH > window.innerHeight - 8) y = e.clientY - TH - 18;     // flip up
      const pr = panel && panel.getBoundingClientRect ? panel.getBoundingClientRect() : null;
      if (pr && pr.width) {
        const overlaps = x < pr.right + 8 && x + TW > pr.left - 8 && y < pr.bottom + 8 && y + TH > pr.top - 8;
        if (overlaps) {
          // Try left of the panel, then above it, then clamp.
          if (pr.left - TW - 12 > 4) x = pr.left - TW - 12;
          else if (pr.top - TH - 12 > 4) y = pr.top - TH - 12;
          else x = 8;
        }
      }
      tooltip.style.left = Math.max(4, Math.min(x, window.innerWidth - TW - 4)) + "px";
      tooltip.style.top = Math.max(4, Math.min(y, window.innerHeight - TH - 4)) + "px";
      tooltip.__lastEvent = { clientX: e.clientX, clientY: e.clientY };
    }
    function onMouseMove(e) {
      const raw = realTarget(e);
      // Moving onto our own UI (esp. the tooltip) must NOT hide/redraw it \u2014
      // that's what lets you slide onto the tooltip and click a line to copy it.
      if (raw && isOwnNode(raw)) return;
      if (!raw) { tooltip.style.display = "none"; return; }
      try {
        lastStack = document.elementsFromPoint(e.clientX, e.clientY).filter((n) => !isOwnNode(n));
      } catch {
        lastStack = [];
      }
      stackIndex = 0;
      const target = findInteractiveRoot(raw);
      if (!target || target === document.body || target === document.documentElement) { tooltip.style.display = "none"; return; }
      // Resolve only when the hovered target actually changes (or cache expired).
      // Full resolution runs querySelectorAll many times; recomputing it on every
      // mousemove pixel would peg CPU on large dashboards.
      const now = Date.now();
      let res;
      if (target === hoverCacheEl && now - hoverCacheT < HOVER_CACHE_MS) {
        res = hoverCacheResult;
      } else {
        res = resolveUniqueLocator(target);
        hoverCacheEl = target;
        hoverCacheResult = res;
        hoverCacheT = now;
      }
      renderTooltip(target, e, res);
      // Keep the Inspect counters honest -- they used to sit at 0 for a whole session
      // because nothing re-rendered the panel after a hover. Throttled, not per-pixel.
      if (IS_TOP && panel && activePane() === "inspect" && sessionHovers % 5 === 1) renderPanel("inspect");
    }
    // Get the card out of the way the instant the user commits to a real click on the
    // page (and let Escape dismiss it outright). Belt-and-braces with pointer-events:
    // the app must never lose an interaction because our overlay was in the way.
    function onMouseDown(e) {
      const t = e.target;
      // This only spared ".li-loc" (the primary/CSS/
      // embedded rows) from the hide-on-mousedown below -- alternative rows (".li-alt")
      // were never included. So mousedown on an alternative hid the tooltip a beat
      // BEFORE the click that should have copied it even fired; by the time mouseup
      // landed, the element was display:none and could not receive the click at all.
      // A jsdom test dispatching a bare "click" event directly never exercises
      // mousedown first, which is exactly why this stayed invisible to the test suite.
      if (t && t.closest && t.closest("#" + NS + "-tooltip .li-loc, #" + NS + "-tooltip .li-alt")) return;
      tooltip.style.display = "none";
      // Stash where a real drag gesture (mousedown, move, mouseup) begins -- see
      // onRecClick's own use of this. Only bothers to track while recording; harmless
      // to also run outside recording, but pointless.
      // This used to stash ANY
      // mousedown unconditionally, including ones starting on the tool's own panel --
      // a real-page drag that released on (say) the panel's Stop-recording button
      // would then wrongly measure "dragged" against a baseline from a completely
      // different, own-UI mousedown, or vice versa. isOwnNode() excludes it, matching
      // the guard every other recorder listener already uses.
      if (registry.recording && !isOwnNode(realTarget(e))) rec.downXY = { x: e.clientX, y: e.clientY };
    }
    function onKey(e) {
      if (e.key === "Escape" && tooltip.style.display === "block") { tooltip.style.display = "none"; return; }
      if (!e.altKey) return;
      // Use e.code (PHYSICAL key), not e.key: on macOS, Option+Z yields e.key "\u03a9",
      // Option+P "\u03c0", Option+C "\u00e7" \u2014 so key-based matching silently fails.
      // e.code ("KeyZ"/"KeyP"/"KeyC") is layout- and modifier-independent.
      const code = e.code || "";
      if (code === "KeyZ" && lastStack.length > 1) {
        e.preventDefault();
        stackIndex = (stackIndex + 1) % lastStack.length;
        renderTooltip(findInteractiveRoot(lastStack[stackIndex]), tooltip.__lastEvent || { clientX: 100, clientY: 100 });
        return;
      }
      // Alt+P copies the hovered element's PLAYWRIGHT locator; Alt+C copies its CSS;
      // Alt+F the frameLocator()-prefixed form, when viewing a module standalone
      // (no click needed \u2014 copies whatever the tooltip currently shows).
      // Alt+1..3 copy the verified alternatives. Without these the only way to take one
      // was to chase the card with the mouse and click it.
      const altN = /^(Digit|Numpad)([123])$/.exec(code);
      if (altN && tooltip.style.display === "block") {
        const row = tooltip.querySelector(`.li-alt[data-altn="${altN[2]}"]`);
        const picked = lastAlts[+altN[2] - 1];
        if (row && picked) {
          e.preventDefault();
          copyToClipboard(picked.code);
          flashAltLine(row);
          approveAlternative(picked, typeof routeKey === "function" ? routeKey() : "");
        }
        return;
      }
      if ((code === "KeyP" || code === "KeyC" || code === "KeyF") && tooltip.__res) {
        const res = tooltip.__res;
        if (code === "KeyF" && !res.embeddedPrimary) return;
        e.preventDefault();
        const text = code === "KeyC" ? (res.cssDevtools || res.css)
          : code === "KeyF" ? res.embeddedPrimary
          : res.primary;
        copyToClipboard(text);
        try { Catalog.approve(res, typeof routeKey === "function" ? routeKey() : ""); } catch {}
        markCheckup(res, "copy");
        flashTooltipLine(code === "KeyC" ? "css" : code === "KeyF" ? "embedded" : "primary");
      }
    }
    // Same green confirmation the primary rows get. Reset it after a beat -- the old
    // click handler added .copied and never removed it, so every alternative you touched
    // stayed lit and it stopped meaning "just copied".
    function flashAltLine(row) {
      if (!row) return;
      row.classList.add("copied");
      const b = row.querySelector(".li-copy"); if (b) b.textContent = "Copied \u2713";
      setTimeout(() => { row.classList.remove("copied"); const x = row.querySelector(".li-copy"); if (x) x.textContent = "Copy"; }, 1200);
    }
    /**
     * A paste-able copy of THIS ENTIRE TOOL, for running inside a cross-origin frame
     * without navigating anywhere.
     *
     * Measured facts this is built on:
     *   - There is no DOM bridge into a cross-origin frame from a page script. Not
     *     postMessage (the child would have to cooperate, and EDC is not ours), not
     *     fetch (blocked, and the module is an empty SPA shell anyway). The same-origin
     *     policy is absolute here. Telling the user otherwise would be a lie.
     *   - The DevTools Console, however, evaluates in whichever realm its context
     *     dropdown names. That is the one place a human can put code inside that frame,
     *     and it needs no extension and no redirect.
     *
     * So hand over the tool itself rather than a crippled probe. `boot` closes over
     * exactly one outer binding (NS), so re-declaring that around boot.toString() is a
     * complete, self-sufficient payload. Once it runs in the frame, boundaryInfo()'s
     * cross-origin branch already prefixes every locator with
     * frameLocator(selfFrameSelector()) - so the locators come out shell-ready with no
     * further work from the user.
     */
    function frameBootPayload() {
      try {
        // The "already running? toggle off" check lives in the outer IIFE, not in boot(),
        // so a second paste into the same frame would stack a second instance (two panels,
        // two sets of hooks). Carry that guard into the payload.
        return `(function(){const NS=${JSON.stringify(NS)};` +
          `if(window[NS]&&window[NS].active){window[NS].destroy();return;}` +
          `const boot=${boot.toString()};boot("top");})()`;
      } catch { return ""; }
    }

    /**
     * The single biggest source of wrong locators on this app: an engineer stands in the
     * shell, points at what LOOKS like a control, and gets the <iframe> that contains it.
     * A browser cannot read a cross-origin frame's DOM -- that is a security rule, not a
     * gap here -- so there is exactly one honest instruction, and this hands it over
     * instead of letting them collect a locator for the wrong node:
     *
     *    open the frame's own URL in a tab, inspect and RECORD there, then re-wrap the
     *    result in page.frameLocator('<selector>') for a shell-rooted test.
     *
     * Recording matters as much as inspecting: this tool only gets a satellite into
     * SAME-ORIGIN frames, so clicks inside the module are invisible to the recorder while
     * you are on the shell, and the exported spec would silently be missing steps.
     */
    function frameAdviceHtml(target) {
      try {
        if (!target || target.nodeType !== 1) return "";
        // Either pointing AT an iframe, or at the frame that our own realm sits in.
        let f = tagOf(target) === "iframe" ? target : null;
        if (!f) {
          const anc = target.closest && target.closest("iframe");
          if (anc) f = anc;
        }
        if (!f) return "";
        if (isSameOrigin(f)) return "";
        let url = "", host = "", hostname = "";
        try { url = f.getAttribute("src") || ""; if (url) { const u = new URL(url, location.href); host = u.host; hostname = u.hostname; } } catch {}
        if (!host) return "";
        // Match on hostname, not host: the profile regexes end-anchor on the domain, so a
        // :port made the app's own module read as a vendor widget.
        let vendor = true;
        try {
          for (const p of APP_PROFILES) { if (p.match.source === ".*") continue; if (p.match.test(hostname || host)) { vendor = false; break; } }
        } catch {}
        const sel = frameSelector(f);
        const open = url.split("#")[0];
        if (vendor) {
          return `<div class="li-fix"><b>This is a third-party widget's frame</b> (${escapeHtml(host)}), not your app. Its markup is the vendor's to change, so don't build a test on anything inside it.
            If your test only needs to wait for it, assert on the frame itself: <code style="font-size:10.5px">page.locator('${codeText(sel)}')</code>.</div>`;
        }
        return `<div class="li-fix"><b>You're pointing at the frame, not what's inside it.</b> ${escapeHtml(host)} is a different origin, so the browser will not let this page read its DOM \u2014 nothing in here can give you a locator for an element inside.
          <br><br><b>Do this instead:</b>
          <br>1. Open <b>${escapeHtml(open)}</b> in its own tab.
          <br>2. Run this tool there \u2014 hover, inspect and <b>record</b> in that tab. Recording here would miss every click you make inside the frame.
          <br>3. Take the locator it gives you and wrap it once for a shell-rooted test:
          <br><code style="font-size:10.5px;color:var(--watch)">page.frameLocator('${codeText(sel)}')</code><code style="font-size:10.5px">.&lt;the locator from step 2&gt;</code>
          <br><span style="color:var(--dim)">On that tab the tooltip prints both forms for you, so step 3 is a copy \u2014 <b>Alt+F</b>.</span>
          <div class="li-inframe">
            <div class="li-alts-h" style="margin-bottom:5px">Don't want to leave this page?</div>
            Run the tool <i>inside</i> the frame instead \u2014 same page, same state, nothing to navigate:
            <br>1. <button class="action" data-framepaste="1">Copy the tool for ${escapeHtml(host)}</button>
            <br>2. Open DevTools Console. Change the context dropdown at its top-left from <b>top</b> to <b>${escapeHtml(host)}</b>.
            <br>3. Paste, press Enter. <span style="color:var(--dim)">First time only, Chrome asks you to type <b>allow pasting</b>.</span>
            <br><br>The panel opens inside the frame and hovering works there. Every locator it gives you already
            starts with <code style="font-size:10.5px;color:var(--watch)">page.frameLocator('${codeText(sel)}')</code> \u2014 shell-ready, no wrapping to do.
          </div></div>`;
      } catch { return ""; }
    }
    // Flash a tooltip line green when copied via keyboard, matching click-to-copy.
    function flashTooltipLine(which) {
      const row = tooltip.querySelector(`.li-loc[data-copy="${which}"]`);
      if (!row) return;
      row.classList.add("copied");
      const btn = row.querySelector(".li-copy"); if (btn) btn.textContent = "Copied \u2713";
      setTimeout(() => { row.classList.remove("copied"); const b = row.querySelector(".li-copy"); if (b) b.textContent = "Copy"; }, 1200);
    }
    function onClick(e) {
      onRecClick(e, false);
      if (!e.altKey) return;
      const raw = realTarget(e);
      if (isOwnNode(raw)) return;
      const target = findInteractiveRoot(raw);
      if (!target || !target.__liRes) return;
      e.preventDefault();
      e.stopPropagation();
      copyToClipboard(target.__liRes.primary);
      // Copying = the human picked this locator \u2192 approve it into memory so the
      // tool recalls it (and prefers this approach) from now on.
      try { Catalog.approve(target.__liRes, typeof routeKey === "function" ? routeKey() : ""); } catch {}
      markCheckup(target.__liRes, "copy");
    }

    // ---- Help Center: one "?" in the header, content follows whichever tab is
    // active. One shared button/overlay instead of six scattered ones -- every tab
    // still gets its own docs, nothing new to hunt for, nothing cluttering the panes
    // themselves. Written for a first-time user AND a returning pro: what this tab is
    // for in one line, then numbered steps, then any term that isn't self-explanatory.
    const HELP_CONTENT = {
      inspect: {
        title: "Inspect",
        body: `<p><b>What this is for:</b> find the exact, already-verified Playwright locator for anything on screen, without writing one by hand.</p>
        <ol>
          <li>Hover any element (this works inside same-origin iframes too, not just the top page).</li>
          <li>A card appears. The top two lines are <b>PLAYWRIGHT</b> and <b>CSS SELECTOR</b> -- both have already been checked against the live page and match exactly one element.</li>
          <li>Click either line to copy it. It pastes straight into your test file.</li>
          <li>If other good locators exist for the same element, they're listed under <b>OTHER LOCATORS THAT ALSO WORK HERE</b> -- click one of those instead if you prefer it.</li>
        </ol>
        <p><b>What "1 of 1" means:</b> this locator matches exactly one element on the page right now. That is what makes it safe to click/fill/assert on in a real test -- a locator that matches 2+ elements is the single most common cause of a flaky test.</p>
        <p><b>Keyboard, without touching the mouse:</b></p>
        <ul>
          <li><b>Alt+P</b> -- copy the Playwright line for whatever you're hovering</li>
          <li><b>Alt+C</b> -- copy the CSS line instead</li>
          <li><b>Alt+1</b> / <b>Alt+2</b> / <b>Alt+3</b> -- copy that numbered alternative below (only the numbers actually shown work -- if the card only shows 1 and 2, there is no 3rd to copy)</li>
          <li><b>Alt+Z</b> -- your cursor is over several stacked elements (a card on top of a row, for example); this steps to the next one out. Only appears when that's actually true.</li>
          <li><b>Esc</b> -- close the card</li>
        </ul>`,
      },
      health: {
        title: "Health",
        body: `<p><b>What this is for:</b> every locator you've hovered or copied gets watched over time. This tab tells you if any of them stopped being safe as the app changed.</p>
        <ol>
          <li>Just keep using the app (and this tool) normally -- checks happen in the background as you navigate.</li>
          <li>Come back here any time to see the current status of everything being watched.</li>
          <li><b>Re-check all now</b> -- forces an immediate check instead of waiting for the next natural page visit.</li>
          <li><b>Export health CSV</b> -- downloads the full report, useful to hand to a developer or attach to a bug.</li>
        </ol>
        <p><b>The three statuses, plainly:</b></p>
        <ul>
          <li><b>Stable</b> -- still matches exactly one element. Safe.</li>
          <li><b>Ambiguous</b> -- used to be 1-of-1, now matches 2 or more. This is the one that actually breaks a test: it clicks whichever element happens to come first, which may not be the one you meant.</li>
          <li><b>Off-page</b> -- the element just isn't on any page you've visited since. Not a locator problem -- you simply haven't been back to that screen.</li>
        </ul>`,
      },
      record: {
        title: "Record",
        body: `<p><b>What this is for:</b> turns your normal clicking/typing/uploading into a runnable Playwright test file automatically.</p>
        <ol>
          <li>Click <b>Start recording</b>.</li>
          <li>Use the app exactly like you normally would -- click buttons, fill fields, pick dropdown options, upload a file, whatever the real flow needs.</li>
          <li>Click <b>Stop recording</b> when the flow is done.</li>
          <li>Pick a style at the top: <b>Generic</b> (one flat script, works with any Playwright setup) or <b>Company style</b> (a Page Object + spec pair matching a team convention).</li>
          <li>Click the <b>Copy...</b> button and paste it into a real <code>.spec.ts</code> file.</li>
          <li><b>Before you run it:</b> rename the test, fill in the TEST DATA block near the top, and uncomment the <code>// ASSERT</code> lines. The recorder captured what you <i>did</i> -- never what you were actually <i>checking</i> -- so without those lines the test only proves nothing crashed, not that the feature works.</li>
        </ol>
        <p><b>If a module you need is inside an iframe this tool can't see into:</b> it tells you up front and gives two buttons -- <b>Record in X instead</b> opens a new tab, automatically carries everything recorded so far into it, and keeps going (one unskippable click on the bookmarklet there -- a script can't inject itself into a tab it has no handle to). <b>Open X fresh instead</b> just opens it to look around; nothing gets added to your recording.</p>
        <p><b>Privacy, built in:</b> password/OTP/card fields are automatically masked and never captured as real text, even in the exported script.</p>`,
      },
      learn: {
        title: "Learn",
        body: `<p><b>What this is for:</b> the tool watches this app over time and measures its own conventions -- does it use <code>data-testid</code>? role/aria-label? URNs in the URL? This is a local statistical measurement, not AI/ML, and nothing ever leaves your browser.</p>
        <ol>
          <li><b>Learn from this page now</b> -- forces an immediate scan of what's on screen right now.</li>
          <li><b>Check drift vs last visit</b> -- tells you if this exact page's structure changed since the last time you were on it. Most useful right after a deploy, to see what a release actually touched.</li>
          <li><b>Export knowledge base (JSON)</b> -- downloads everything learned so far.</li>
          <li><b>Clear all stored data (this site)</b> -- wipes the local cache for this site (asks you to confirm first). Safe to do: it rebuilds automatically just from continuing to use the tool.</li>
        </ol>
        <p><b>Why this matters:</b> "0% of this app's screens use a real test hook" is exactly the finding to bring to developers -- it's a measurable coverage gap, not a guess.</p>`,
      },
      doctor: {
        title: "Doctor",
        body: `<p><b>What this is for:</b> you already have a locator -- maybe from an old test, maybe something a teammate wrote -- and it's failing. Paste it here to see exactly why, instead of guessing.</p>
        <ol>
          <li>Paste it in: a Playwright chain, a plain CSS selector, or an XPath. It automatically detects which one you pasted.</li>
          <li>Click <b>Check this locator</b> (or press Cmd/Ctrl+Enter).</li>
          <li>It runs the locator segment by segment against the live page and shows you how many elements still match at each step -- so you can see the exact point it dies, not just "it failed."</li>
        </ol>
        <p><b>Before you conclude it's broken:</b> check it on the actual screen where it's supposed to work. A locator for a dialog's Save button will correctly read as "finds nothing" while that dialog is closed -- that's not a bug, that's the truth.</p>`,
      },
      feed: {
        title: "Feed",
        body: `<p><b>What this is for:</b> the tool catches every toast/banner/error message the instant it appears on screen -- and for errors, tries to match them to the exact API/GraphQL call that likely caused them.</p>
        <ol>
          <li>Just browse normally. Entries fill in here on their own, with a timestamp and severity (info/success/warning/error).</li>
          <li><b>Export feed CSV</b> -- everything caught, as a spreadsheet.</li>
          <li><b>Export network log CSV</b> -- the metadata-only request log (URLs are redacted of anything sensitive) alongside it.</li>
        </ol>
        <p><b>Ties into Record:</b> if one of these banners appears within a few seconds right after a step you're recording, it gets attached automatically as a real, live assertion in your exported script -- you don't have to do anything extra to get it.</p>`,
      },
    };
    let helpOverlayOpen = false;
    function renderHelp() {
      if (!helpOverlayOpen) { helpEl.className = "li-help"; helpEl.innerHTML = ""; return; }
      const c = HELP_CONTENT[activePane()] || HELP_CONTENT.inspect;
      helpEl.className = "li-help open";
      helpEl.innerHTML = `<div class="li-help-card">
        <div class="li-help-head"><b>${escapeHtml(c.title)}</b><button class="li-help-x" title="Close">\u2715</button></div>
        <div class="li-help-body">${c.body}</div>
      </div>`;
      helpEl.querySelector(".li-help-x").addEventListener("click", () => { helpOverlayOpen = false; renderHelp(); });
    }
    // Click outside the card (on the dimmed backdrop) also closes it -- standard modal
    // behavior. Attached once here, not inside renderHelp -- that function replaces
    // helpEl's innerHTML on every call but never the element itself, so a listener
    // attached there on every open/close cycle would stack forever instead of once.
    helpEl.addEventListener("click", (e) => { if (e.target === helpEl) { helpOverlayOpen = false; renderHelp(); } });

    // ---- Panel (top only) ----
    let panel = null;
    // Positions the single sliding tab-bar indicator under whichever .tab is
    // currently active. Tabs are equal-width flex children, so their real
    // offsetLeft/offsetWidth aren't known until they're actually laid out -- reading
    // them here (rather than hand-computing "1/6th of panel width" in CSS) stays
    // correct even if a tab's rendered width ever changes (a longer label, a wider
    // font from a future locale, etc).
    function updateTabIndicator() {
      if (!panel) return;
      const active = panel.querySelector(".tab.active");
      const bar = panel.querySelector(".li-tab-indicator");
      if (!active || !bar) return;
      bar.style.width = active.offsetWidth + "px";
      bar.style.transform = "translateX(" + active.offsetLeft + "px)";
    }
    // Drag-to-move (by the header) and drag-to-resize (by the corner handle). Both
    // live entirely inside #panel, which isOwnNode() already exempts from the click/
    // drag-tail recorder logic above -- so these gestures need no special-casing to
    // stay out of a recording; they just need to never leak a mousedown baseline the
    // recorder could misread. clientX/Y-based math throughout, no rec.* state touched.
    let panelMoved = false; // once true, position is left/top-based, not bottom/right
    let onPanelResize = null; // torn down in destroy() -- a fresh inject on the same
    // page (destroy then re-click the bookmarklet) would otherwise stack a new
    // window-level resize listener on every cycle without ever shedding the old one.
    // Anchors a vertical resize drag on the max-height the panel is CURRENTLY SET TO,
    // not the active tabpane's rendered offsetHeight -- once --li-mh is set, offsetHeight
    // reports the clamped (<=) height, which is smaller whenever the content is shorter
    // than the cap. Anchoring on that clamped value made every successive drag start
    // from a smaller number than it had just written, ratcheting the panel down to the
    // 160px floor over a couple of drags regardless of which way the mouse moved.
    function currentMh() {
      const set = getComputedStyle(panel).getPropertyValue("--li-mh").trim();
      const px = parseFloat(set);
      if (!isNaN(px)) return px;
      const firstPane = panel.querySelector(".tabpane.active");
      return firstPane ? firstPane.offsetHeight : window.innerHeight * 0.62;
    }
    // Every height cap here used to be a flat
    // `window.innerHeight - 40` applied straight to --li-mh alone -- but --li-mh is
    // only the CONTENT area. The panel's real total height also includes the topbar,
    // header, tab bar, and (when present) the standing cross-origin-frame banner --
    // on a real 941px-tall viewport, growing content to a genuinely-needed 775px
    // pushed the panel's TOTAL height to 1184px, which is taller than the viewport,
    // shoving the whole box's top edge to -261px -- off-screen and undraggable back
    // into view. `panel.offsetHeight - currentMh()` is the actual chrome overhead at
    // this exact moment (adapts automatically to whether the banner is showing),
    // so subtracting it from the viewport cap keeps the WHOLE panel on-screen, not
    // just the number written into --li-mh.
    function maxMhCap() {
      const chrome = Math.max(0, panel.offsetHeight - currentMh());
      return Math.max(160, window.innerHeight - 40 - chrome);
    }
    // Switching to a content-heavy tab (Learn/Record/
    // Doctor with a checkup list) never grew the panel to fit -- if an earlier manual
    // resize (or just the default cap) left --li-mh shorter than this tab actually
    // needs, its own trailing buttons end up scrolled below the fold with nothing
    // telling you to scroll. GROWS ONLY, never shrinks automatically -- a tab with
    // less content must never fight a resize you made on purpose for a taller one.
    // `pane.scrollHeight` reports the true unclamped content height even though
    // max-height is actively clipping it -- that's normal DOM behavior, not a hack.
    function autoFitHeight(name) {
      const p = pane(name);
      if (!p) return;
      const needed = p.scrollHeight;
      if (needed > currentMh()) panel.style.setProperty("--li-mh", Math.min(needed, maxMhCap()) + "px");
    }
    function wirePanelDragResize() {
      const header = panel.querySelector(".header");
      const resize = panel.querySelector(".li-resize");
      const resizeH = panel.querySelector(".li-resize-h");
      const resizeR = panel.querySelector(".li-resize-r");
      const resizeT = panel.querySelector(".li-resize-t");
      const footer = panel.querySelector(".li-footer");
      header.addEventListener("mousedown", (e) => {
        if (e.target.closest(".header-actions")) return; // help/close stay clickable
        e.preventDefault();
        const startX = e.clientX, startY = e.clientY;
        const rect = panel.getBoundingClientRect();
        const startLeft = rect.left, startTop = rect.top;
        header.classList.add("li-dragging");
        function onMove(ev) {
          if (!panelMoved) {
            panel.style.right = "auto";
            panel.style.bottom = "auto";
            panelMoved = true;
          }
          const maxLeft = window.innerWidth - panel.offsetWidth;
          const maxTop = window.innerHeight - panel.offsetHeight;
          const left = Math.min(Math.max(0, startLeft + (ev.clientX - startX)), Math.max(0, maxLeft));
          const top = Math.min(Math.max(0, startTop + (ev.clientY - startY)), Math.max(0, maxTop));
          panel.style.left = left + "px";
          panel.style.top = top + "px";
        }
        function onUp() {
          header.classList.remove("li-dragging");
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
        }
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      });
      // Keeps a dragged panel on-screen after the viewport itself resizes (e.g. dev
      // tools docking, window resize) -- otherwise it can end up stranded off-canvas
      // with no way to drag it back into view.
      onPanelResize = () => {
        if (!panelMoved) return;
        const maxLeft = Math.max(0, window.innerWidth - panel.offsetWidth);
        const maxTop = Math.max(0, window.innerHeight - panel.offsetHeight);
        const rect = panel.getBoundingClientRect();
        panel.style.left = Math.min(Math.max(0, rect.left), maxLeft) + "px";
        panel.style.top = Math.min(Math.max(0, rect.top), maxTop) + "px";
      };
      window.addEventListener("resize", onPanelResize);
      resize.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation(); // don't also start a header drag
        const startX = e.clientX, startY = e.clientY;
        const startWidth = panel.offsetWidth;
        const startMh = currentMh();
        function onMove(ev) {
          const width = Math.min(900, Math.max(340, startWidth + (ev.clientX - startX)));
          const mh = Math.min(maxMhCap(), Math.max(160, startMh + (ev.clientY - startY)));
          panel.style.width = width + "px";
          panel.style.setProperty("--li-mh", mh + "px");
          updateTabIndicator(); // tab widths change with panel width
        }
        function onUp() {
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
        }
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      });
      // Explicit horizontal-only handle -- the LEFT edge specifically (see its CSS
      // comment for why not the right). Growing leftward keeps the right edge fixed
      // in both the default (CSS right:18px, needs no JS help) and dragged (left/top
      // inline styles, needs left adjusted to compensate) positioning modes.
      resizeH.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const startX = e.clientX;
        const startWidth = panel.offsetWidth;
        const startLeft = panelMoved ? panel.getBoundingClientRect().left : null;
        function onMove(ev) {
          const dx = ev.clientX - startX;
          const width = Math.min(900, Math.max(340, startWidth - dx));
          panel.style.width = width + "px";
          if (startLeft !== null) panel.style.left = (startLeft + dx) + "px";
          updateTabIndicator();
        }
        function onUp() {
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
        }
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      });
      // RIGHT edge -- mirror of resizeH's math (grow = drag away from center), but
      // since the default anchor is CSS right:18px (fixed) and a panelMoved anchor is
      // left:<px> (also fixed on THIS side), growing width from the right never needs
      // to touch left/right position in either mode -- unlike the left edge, which
      // must compensate because IT is dragging the side the panel is anchored from.
      resizeR.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const startX = e.clientX;
        const startWidth = panel.offsetWidth;
        function onMove(ev) {
          const width = Math.min(900, Math.max(340, startWidth + (ev.clientX - startX)));
          panel.style.width = width + "px";
          updateTabIndicator();
        }
        function onUp() {
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
        }
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      });
      // TOP edge -- mirror of the footer's math but inverted (drag UP shrinks the gap
      // to the cursor, which means grow) and, like the left edge, needs to compensate
      // position when panelMoved: growing height from the top must move `top` upward
      // by the same amount, or the panel would grow by extending its BOTTOM instead
      // (dragging the wrong edge from the user's point of view).
      resizeT.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const startY = e.clientY;
        const startMh = currentMh();
        const startTop = panelMoved ? panel.getBoundingClientRect().top : null;
        function onMove(ev) {
          const dy = ev.clientY - startY;
          const mh = Math.min(maxMhCap(), Math.max(160, startMh - dy));
          panel.style.setProperty("--li-mh", mh + "px");
          if (startTop !== null) panel.style.top = (startTop + dy) + "px";
        }
        function onUp() {
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
        }
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      });
      // Explicit vertical-only handle -- the whole footer bar, not just the corner
      // grip (which stops propagation here so this doesn't double-fire alongside it).
      footer.addEventListener("mousedown", (e) => {
        e.preventDefault();
        const startY = e.clientY;
        const startMh = currentMh();
        function onMove(ev) {
          const mh = Math.min(maxMhCap(), Math.max(160, startMh + (ev.clientY - startY)));
          panel.style.setProperty("--li-mh", mh + "px");
        }
        function onUp() {
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
        }
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      });
    }
    function playIntroFlyIn() {
      let reduced = false;
      try { reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch {}
      if (reduced) return;
      const head = document.createElement("div");
      head.id = NS + "-flyin";
      document.body.appendChild(head);
      const sparks = [];
      for (let i = 0; i < 2; i++) {
        const s = document.createElement("div");
        s.className = NS + "-flyin-spark";
        s.style.animationDelay = (i + 1) * 0.08 + "s";
        document.body.appendChild(s);
        sparks.push(s);
      }
      const cleanup = () => { head.remove(); sparks.forEach((s) => s.remove()); };
      head.addEventListener("animationend", cleanup, { once: true });
      setTimeout(() => { if (head.isConnected) cleanup(); }, 2600); // safety net (e.g. headless/test envs that never fire animationend)
    }
    function buildPanel() {
      panel = document.createElement("div");
      panel.id = NS + "-panel";
      panel.innerHTML = `
        <div class="li-topbar"></div>
        <div class="header">
          <div class="brand">
            <img class="brand-logo" src="${LOGO_DATA_URI}" width="26" height="26" alt="Securiti" draggable="false"/>
            <div class="brand-txt">
              <div class="brand-title">Locator Inspector <span class="ver">${VERSION}</span></div>
              <div class="brand-company">Securiti.ai</div>
              <div class="brand-tagline">a Veeam company</div>
            </div>
          </div>
          <div class="header-actions">
            <button class="help" title="Help for this tab">?</button>
            <button class="close" title="Toggle off">\u2715</button>
          </div>
        </div>
        <div class="tabs">
          <div class="tab active" data-tab="inspect">Inspect</div>
          <div class="tab" data-tab="health">Health <span class="dot" id="${NS}-dot-health"></span></div>
          <div class="tab" data-tab="record">Record <span class="dot" id="${NS}-dot-record"></span></div>
          <div class="tab" data-tab="learn">Learn <span class="dot" id="${NS}-dot-learn"></span></div>
          <div class="tab" data-tab="doctor">Doctor <span class="dot" id="${NS}-dot-doctor"></span></div>
          <div class="tab" data-tab="feed">Feed <span class="dot" id="${NS}-dot-feed"></span></div>
          <div class="li-tab-indicator"></div>
        </div>
        <div id="${NS}-fbanner"></div>
        <div class="tabpane active" data-pane="inspect"></div>
        <div class="tabpane" data-pane="health"></div>
        <div class="tabpane" data-pane="record"></div>
        <div class="tabpane" data-pane="learn"></div>
        <div class="tabpane" data-pane="doctor"></div>
        <div class="tabpane" data-pane="feed"></div>
        <div class="li-resize-h" title="Drag to resize width"></div>
        <div class="li-resize-r" title="Drag to resize width"></div>
        <div class="li-resize-t" title="Drag to resize height"></div>
        <div class="li-footer" title="Drag to resize height"><div class="li-resize" title="Drag to resize"></div></div>`;
      document.body.appendChild(panel);
      wirePanelDragResize();
      panel.querySelector(".close").addEventListener("click", destroy);
      // One shared "?" -- content always matches whichever tab is currently active,
      // so every tab effectively has its own doc without six separate icons cluttering
      // the already-dense panes themselves.
      panel.querySelector(".help").addEventListener("click", () => { helpOverlayOpen = !helpOverlayOpen; renderHelp(); });
      panel.querySelectorAll(".tab").forEach((tab) => {
        tab.addEventListener("click", () => {
          panel.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
          panel.querySelectorAll(".tabpane").forEach((p) => p.classList.remove("active"));
          tab.classList.add("active");
          panel.querySelector(`.tabpane[data-pane="${tab.dataset.tab}"]`).classList.add("active");
          const d = panel.querySelector(`#${NS}-dot-${tab.dataset.tab}`);
          if (d) d.style.display = "none";
          renderPanel(tab.dataset.tab);
          autoFitHeight(tab.dataset.tab);
          if (helpOverlayOpen) renderHelp(); // follow the tab switch if left open
          updateTabIndicator();
        });
      });
      updateTabIndicator(); // initial position, under the default-active "Inspect" tab
    }
    function activePane() {
      const t = panel && panel.querySelector(".tab.active");
      return t ? t.dataset.tab : "inspect";
    }
    function pane(name) {
      return panel && panel.querySelector(`.tabpane[data-pane="${name}"]`);
    }
    // Every <iframe> on this page, classified. Enumeration works regardless of origin
    // (the iframe ELEMENT is in our document even when its contents are not), so this
    // can always answer "what frames are here, which can I inspect, and what does a
    // test need for each". What it cannot do is look inside a cross-origin one -- that
    // is a browser boundary, not a gap in the tool -- so those rows say so and give the
    // standalone URL, which is the only way to inspect inside them by hand.
    function frameInventory() {
      const out = [];
      let frames;
      try { frames = document.querySelectorAll("iframe"); } catch { return out; }
      frames.forEach((f, i) => {
        let host = "", hostname = "", url = "";
        try {
          url = f.getAttribute("src") || "";
          if (url) { const u = new URL(url, location.href); host = u.host; hostname = u.hostname; }
          else host = "(no src)";
        } catch { host = "(unparseable src)"; }
        const same = isSameOrigin(f);
        let live = false;
        try { registry.frames.forEach((r) => { if (r.win === f.contentWindow) live = true; }); } catch {}
        // Vendor vs the app under test: the same profile test isThirdPartyRealm() uses,
        // applied to the frame's HOSTNAME. Not .host -- the profile regexes are anchored
        // at the end of the string, so a port turned the app's own module into a
        // "third-party widget" and suppressed every piece of guidance about it.
        let vendor = true;
        try {
          for (const p of APP_PROFILES) {
            if (p.match.source === ".*") continue;
            if (p.match.test(hostname || host)) { vendor = false; break; }
          }
        } catch {}
        out.push({ i, host, hostname, url, same, live, vendor, selector: frameSelector(f) });
      });
      return out;
    }
    // Shared by every surface that offers "this frame is blind, do something about it"
    // (Health tab's frame list, the standing banner, the Record tab's own box). All
    // three used to hand-roll their own button markup and drifted apart -- the Health
    // list and the standing banner ended up wired to data-openframe (the RECORD-and-carry
    // behavior) under a plain "Open in a new tab" label with no fresh alternative, so
    // clicking them mid-recording silently committed a handoff you may not have wanted,
    // with no honest way to say so from the label. One function now, called from all
    // three, so the choice (and its wording) can never drift out of sync again.
    function frameOpenButtonsHtml(url, host) {
      const u = escapeHtml(url);
      const h = escapeHtml(host);
      if (!registry.recording) {
        return `<button class="action" data-openframe-fresh="${u}">Open ${h} in a new tab</button>`;
      }
      return `<button class="action" data-openframe="${u}">Record in ${h} instead</button>
        <button class="action" data-openframe-fresh="${u}">Open ${h} fresh instead</button>`;
    }
    function frameInventoryHtml() {
      const inv = frameInventory();
      if (!inv.length) return "";
      const app = inv.filter((f) => !f.vendor), vend = inv.filter((f) => f.vendor);
      const reachable = inv.filter((f) => f.live).length;
      const row = (f) => `
        <div class="li-frame ${f.same ? "same" : "cross"}">
          <div class="li-frame-top">
            <span class="li-frame-host">${escapeHtml(f.host)}</span>
            <span class="li-frame-tag">${f.vendor ? "vendor" : "your app"}</span>
            <span class="li-frame-tag ${f.live ? "ok" : ""}">${f.same ? (f.live ? "inspectable" : "same-origin, no satellite yet") : "cross-origin"}</span>
          </div>
          <code>page.frameLocator('${codeText(f.selector)}')</code>
          ${!f.same && !f.vendor && f.url ? `<div class="li-frame-note">Can't look inside from here \u2014 cross-origin, so the browser blocks it. <b>Inspect and record in its own tab instead</b> \u2014 if recording, that hop becomes a direct <code style="font-size:10.5px">page.goto()</code> step (top-level, not this frame, so no <code style="font-size:10.5px">frameLocator()</code> needed for it) and carries what's already been recorded here into it automatically. Recording from this page would miss every click you make inside the frame.
            <div style="margin-top:6px">${frameOpenButtonsHtml(f.url.split("#")[0], f.host)}
            <button class="action" data-framepaste="1" title="Then paste it in the DevTools Console with the context dropdown set to this frame">Or copy the tool to paste into this frame</button></div></div>` : ""}
          ${!f.same && f.vendor ? `<div class="li-frame-note">Vendor widget. Don't test its internals \u2014 the vendor rewrites them. Wait on the frame itself if you must.</div>` : ""}
        </div>`;
      return `<div class="li-frames">
        <div class="li-alts-h">Frames on this page \u2014 ${inv.length} total, ${reachable} inspectable, ${app.length} yours / ${vend.length} vendor</div>
        ${app.map(row).join("")}${vend.map(row).join("")}
      </div>`;
    }
    // Wire the "open in a new tab" buttons a frame row may have rendered. noopener so the
    // new tab gets no handle back to this one.
    function wireFrameOpeners(root) {
      if (!root) return;
      root.querySelectorAll("[data-openframe]").forEach((b) => b.addEventListener("click", () => {
        const u = b.getAttribute("data-openframe");
        // The Record tab shows this button ("Record in X instead") even BEFORE Start
        // Recording is pressed -- it's a heads-up rendered the moment a blind frame is
        // detected, not gated on registry.recording. Clicking it is an unambiguous
        // "record this flow, starting here" -- treat it as an implicit Start, otherwise
        // the button's own label is a promise the click silently breaks (plain open,
        // no tag, nothing carried, no way to tell from the outside that it did nothing).
        if (!registry.recording) { registry.recording = true; notify("record"); }
        // Opening a cross-origin frame's own tab does not destroy this tab's recording
        // (noopener, so it is a real new tab) -- but this recording's actions stop
        // growing the moment you leave, with nothing in the export to say why. Mark
        // the handoff explicitly so the exported script documents it instead of just
        // silently ending, which is what actually read as "lost data."
        let openUrl = u;
        if (registry.recording) {
          const fr = frameInventory().find((f) => f.url && f.url.split("#")[0] === u);
          const host = fr ? fr.host : (function () { try { return new URL(u).host; } catch { return u; } })();
          // The replay does NOT need to stay inside the iframe: a real page.goto()
          // straight to the module's own URL is a normal top-level navigation (browsers
          // allow that regardless of origin -- the cross-origin restriction only blocks
          // reading another origin's DOM/JS from inside a frame, not navigating to it).
          // So this step is executable, not a manual TODO: it drives the SAME test
          // straight into the module, top-level, exactly like recording there directly.
          //
          // Try to attach everything recorded so far -- INCLUDING the note+navigate
          // pushed below, so the handoff marker itself survives into the merged script
          // -- to the URL so the OTHER tab's export already contains it. See
          // HANDOFF_PARAM above for why the URL is the only channel and
          // HANDOFF_MAX_URL_LEN for the size cap.
          //
          // The note's own wording depends on whether the carry succeeds, but whether
          // it succeeds depends on the note's own length (it rides in the same
          // payload) -- broken by deciding against the CARRIED wording's length only:
          // it's a known, fixed string, so this is a real measurement, not a guess,
          // and the two texts differ by well under the safety margin HANDOFF_MAX_URL_LEN
          // already leaves.
          const carriedText = "HANDOFF: recording could not see inside " + host + " from this page (cross-origin),\n"
            + "so it continued in its own tab, opened below. Everything recorded up to here rode\n"
            + "along automatically and is already included below -- nothing to paste by hand.";
          const manualText = "HANDOFF: recording could not see inside " + host + " from this page (cross-origin),\n"
            + "so it continued in its own tab, opened below. The step right after this one\n"
            + "navigates straight there -- paste that tab's recorded steps in after it, AS-IS\n"
            + "(no frameLocator needed: this is a direct top-level visit, not the embedded frame).\n"
            + "(Too many steps recorded so far to carry automatically in the handoff URL --\n"
            + "this one needs the manual paste.)";
          let carried = false;
          try {
            const candidate = registry.actions.concat([
              { type: "note", text: carriedText },
              { type: "navigate", url: u, title: host },
            ]);
            const uu = new URL(u);
            uu.searchParams.set(RESUME_PARAM, "1");
            const withPayload = new URL(uu.toString());
            withPayload.searchParams.set(HANDOFF_PARAM, JSON.stringify(candidate));
            carried = withPayload.toString().length <= HANDOFF_MAX_URL_LEN;
          } catch {}
          registry.actions.push({ type: "note", text: carried ? carriedText : manualText });
          registry.actions.push({ type: "navigate", url: u, title: host });
          notify("record");
          try {
            const uu = new URL(u);
            uu.searchParams.set(RESUME_PARAM, "1");
            if (carried) uu.searchParams.set(HANDOFF_PARAM, JSON.stringify(registry.actions));
            openUrl = uu.toString();
          } catch {}
        }
        try {
          win.open(openUrl, "_blank", "noopener,noreferrer");
          // Only one of these ever fires per click -- showToast has no queue, it's a
          // single element the next call clobbers, so this has to be one message.
          showToast(!registry.recording
            ? "Opened in a new tab \u2014 run the bookmarklet there"
            : openUrl.indexOf(HANDOFF_PARAM) !== -1
              ? "Opened in a new tab \u2014 click the bookmarklet there and your recording carries forward automatically"
              : "Recording so far is too long to carry automatically \u2014 click the bookmarklet there, then export THIS tab too and paste its steps in after the handoff, by hand.");
        } catch {}
      }));
      // A second, explicit choice next to the one above: open the module WITHOUT
      // touching this recording at all -- no note, no navigate step, no resume tag.
      // For "let me just look at something over there" without committing that hop
      // to the script. Only meaningfully different from data-openframe while a
      // recording is in progress; shown next to it for exactly that case.
      root.querySelectorAll("[data-openframe-fresh]").forEach((b) => b.addEventListener("click", () => {
        const u = b.getAttribute("data-openframe-fresh");
        try { win.open(u, "_blank", "noopener,noreferrer"); showToast("Opened in a new tab \u2014 separate from this recording, nothing added to the script"); } catch {}
      }));
      root.querySelectorAll("[data-framepaste]").forEach((b) => b.addEventListener("click", () => {
        const p = frameBootPayload();
        if (p) { copyToClipboard(p); showToast("Copied \u2014 Console, switch context to the frame, paste"); }
      }));
    }
    /**
     * A standing banner, above the tabs, whenever this page embeds one of the app's own
     * modules in a frame this realm cannot read.
     *
     * Measured directly: hovering an iframe's CONTENT area never
     * produces an event in the parent -- the pointer belongs to the child document, so
     * only the iframe's border does. That makes a hover-time advisory almost unreachable
     * exactly where it matters most. The person needs to be told before they start
     * collecting locators, not after, so it lives here: visible the moment the panel
     * opens, on every tab, dismissible once read.
     */
    function renderFrameBanner() {
      const el = panel && panel.querySelector(`#${NS}-fbanner`);
      if (!el) return;
      if (registry.frameBannerDismissed) { el.innerHTML = ""; return; }
      // Record pane renders its own copy of this warning, worded for recording
      // specifically ("Record in X instead") -- showing both here is the same
      // advice twice on screen at once. Standing banner stays for Inspect/Health.
      if (activePane() === "record") { el.innerHTML = ""; return; }
      const blind = frameInventory().filter((f) => !f.same && !f.vendor && f.url);
      if (!blind.length) { el.innerHTML = ""; return; }
      el.innerHTML = `<div class="li-banner">
        <div class="li-banner-h">\u26a0 ${blind.length} of this page's own module${blind.length > 1 ? "s are" : " is"} in a frame this tool can't read
          <button class="li-banner-x" title="Dismiss">\u2715</button></div>
        <div>Cross-origin, so the browser blocks it \u2014 that applies to hovering <i>and</i> to recording.
        Anything you inspect or record from this page will be missing everything inside ${blind.length > 1 ? "those frames" : "that frame"}.</div>
        ${blind.map((f) => `<div class="li-banner-row"><b>${escapeHtml(f.host)}</b>
          <div style="margin-top:5px">
            ${frameOpenButtonsHtml(f.url.split("#")[0], f.host)}
            <button class="action" data-framepaste="1" title="Then paste in the DevTools Console with the context dropdown set to this frame">Or copy the tool to paste into this frame</button>
          </div>
          <div style="margin-top:5px;color:var(--dim)">If you're recording, "Record instead" becomes a direct
            <code style="font-size:10px">page.goto()</code> step in the script (top-level, not the embedded
            frame) \u2014 no <code style="font-size:10px">frameLocator()</code> needed for what you record there \u2014
            and carries what's already been recorded here into it automatically. "Open fresh" leaves this
            recording untouched.</div>
        </div>`).join("")}
      </div>`;
      const x = el.querySelector(".li-banner-x");
      if (x) x.addEventListener("click", () => { registry.frameBannerDismissed = true; renderFrameBanner(); });
      wireFrameOpeners(el);
    }
    function renderPanel(which) {
      if (!panel) return;
      which = which || activePane();
      renderFrameBanner();
      if (which === "inspect") {
        pane("inspect").innerHTML = `
          <div class="hint">Hover any element (in any frame) \u2192 its 1-of-1 locator. Slide onto the card and <b>click a line</b> to copy it (CSS line pastes into DevTools \u201CElements\u201D search). <b>Alt+Z</b> cycles overlaps.</div>
          <div class="row"><span>Frames lit up</span><span>${registry.frames.size + 1}</span></div>
          <div class="row"><span>Hovers</span><span>${sessionHovers}</span></div>
          <div class="row"><span>Copies</span><span>${sessionCopies}</span></div>
          <div class="row"><span>Locators tracked</span><span>${registry.tracked.size}</span></div>
          <div class="row"><span>Coverage (idle scan)</span><span>${registry.coverage.size}</span></div>
          <div class="row"><span>Third-party widget elements</span><span>${[...registry.coverage.values()].filter((c) => c && c.thirdParty).length}</span></div>`;
      } else if (which === "health") {
        const recs = Array.from(registry.tracked.values()).sort((a, b) => b.breaks - a.breaks || b.checks - a.checks);
        pane("health").innerHTML =
          frameInventoryHtml() +
          `<div class="hint">Re-checked as the app re-renders and navigates. <b>Ambiguous</b> = it was 1-of-1 and now matches several, the one failure that makes a passing test click the wrong thing. <b>Off-page</b> just means the element isn't on the pages visited since \u2014 that is not a locator problem.</div>` +
          (recs.length ? recs.slice(0, 60).map((r) => {
            const v = flakinessVerdict(r);
            // Report present/absent separately. Collapsing them was what produced the
            // old meaningless "Flaky" on every route change.
            const bits = [];
            if (r.breaks) bits.push(`matched >1 on ${r.breaks} of ${r.checks} re-checks (last: ${r.lastBreak ? r.lastBreak.count : "?"})`);
            if (r.present) bits.push(`1-of-1 on ${r.present}`);
            if (r.absent) bits.push(`absent on ${r.absent}`);
            const ev = bits.length ? bits.join(" \u00B7 ") : "not re-checked yet";
            return `<div class="entry" style="border-left-color:${v.color}"><div class="top"><span class="badge" style="background:${v.color}" title="${escapeHtml(v.why || "")}">${v.label}</span><span>${escapeHtml(r.strategy)}</span></div><code>${codeText(r.primary)}</code><div style="color:#9aa0a6;font-size:10px;margin-top:3px">${escapeHtml(ev)}</div></div>`;
          }).join("") : '<div class="empty">Hover or copy locators to track them.</div>') +
          `<button class="action" id="${NS}-recheck">Re-check all now</button><button class="action" id="${NS}-hexport">Export health CSV</button>`;
        pane("health").querySelector(`#${NS}-recheck`).addEventListener("click", () => { revalidateAll("manual"); showToast(`Re-checked ${registry.tracked.size}`); });
        pane("health").querySelector(`#${NS}-hexport`).addEventListener("click", exportHealthCsv);
        wireFrameOpeners(pane("health"));
      } else if (which === "record") {
        // A recording that silently drops half the flow is worse than no recording. Only
        // same-origin frames get a satellite, so say up front which frames will be missed
        // and where to record instead -- BEFORE the button is pressed, not after.
        const blindApp = frameInventory().filter((f) => !f.same && !f.vendor && f.url);
        const blindHtml = blindApp.length ? `<div class="li-fix" style="margin-bottom:8px"><b>Heads up \u2014 ${blindApp.length} embedded module${blindApp.length > 1 ? "s" : ""} on this page cannot be recorded from here.</b>
          Cross-origin frames don't let this tool listen for clicks inside them, so those steps would be missing from the exported test with no error to tell you.
          ${blindApp.map((f) => `<div style="margin-top:10px">
            <div><b>${escapeHtml(f.host)}</b></div>
            <div style="margin-top:5px"><button class="action" data-openframe="${escapeHtml(f.url.split("#")[0])}">Record in ${escapeHtml(f.host)} instead</button></div>
            <div style="margin-top:3px;color:var(--dim)">Embeds this hop as a real <code style="font-size:10.5px">page.goto()</code> step (top-level, not
              the embedded frame, so no <code style="font-size:10.5px">frameLocator()</code> needed) and turns recording on in the new tab automatically.
              Click the bookmarklet there and it resumes on its own -- that one click can't be skipped (a bookmarklet can't run itself in
              a tab it has no handle to), but Start Recording already is.</div>
            <div style="margin-top:6px"><button class="action" data-openframe-fresh="${escapeHtml(f.url.split("#")[0])}">Open ${escapeHtml(f.host)} fresh instead</button></div>
            <div style="margin-top:3px;color:var(--dim)">Just look around over there -- nothing added to this script, this recording is untouched.</div>
          </div>`).join("")}</div>` : "";
        const styleIsCompany = registry.exportStyle === "company";
        const activeExport = () => (styleIsCompany ? exportPlaywrightCompanyStyle() : exportPlaywright());
        pane("record").innerHTML = blindHtml + `
          <div class="hint">Records your clicks/typing/navigation (across same-origin frames) into a runnable Playwright test. Passwords, OTPs and card fields are masked, never captured.</div>
          <button class="action ${registry.recording ? "rec" : ""}" id="${NS}-recbtn">${registry.recording ? "\u23FA Stop recording" : "\u23FA Start recording"}</button>
          <div class="row"><span>Steps captured</span><span>${registry.actions.length}</span></div>
          <div class="li-tabs">
            <button class="li-tab" id="${NS}-recundo" ${registry.actions.length ? "" : "disabled"} title="Remove the last recorded step">\u21B6 Undo</button>
            <button class="li-tab" id="${NS}-recredo" ${registry.redoStack.length ? "" : "disabled"} title="Bring back the last undone step">\u21B7 Redo</button>
          </div>
          <button class="action" id="${NS}-recclear">Clear</button>
          <div class="li-tabs" style="margin-top:8px">
            <button class="li-tab ${styleIsCompany ? "" : "on"}" id="${NS}-recstyle-generic" title="Flat inline-locator script. Matches the shared authenticated-runner kit's contract exactly.">Generic</button>
            <button class="li-tab ${styleIsCompany ? "on" : ""}" id="${NS}-recstyle-company" title="Page Object + BasePage + Expect + user fixture + GenerateRandomData. Best-guess scaffold -- EDIT-tagged where this tool can't know your repo.">Company style</button>
          </div>
          <pre>${escapeHtml(registry.actions.length ? activeExport() : "// no steps yet")}</pre>
          <button class="action" id="${NS}-reccopy">Copy ${styleIsCompany ? "Page Object + spec" : "Playwright test"}</button>`;
        pane("record").querySelector(`#${NS}-recbtn`).addEventListener("click", () => {
          registry.recording = !registry.recording;
          if (registry.recording && !registry.actions.length) {
            recNavigation(location.href);
            resetRecordingCheckups();
          }
          renderPanel("record");
        });
        pane("record").querySelector(`#${NS}-recundo`).addEventListener("click", () => {
          if (!registry.actions.length) return;
          registry.redoStack.push(registry.actions.pop());
          renderPanel("record");
        });
        pane("record").querySelector(`#${NS}-recredo`).addEventListener("click", () => {
          if (!registry.redoStack.length) return;
          registry.actions.push(registry.redoStack.pop());
          renderPanel("record");
        });
        pane("record").querySelector(`#${NS}-recclear`).addEventListener("click", () => { registry.actions = []; registry.redoStack = []; resetRecordingCheckups(); renderPanel("record"); });
        pane("record").querySelector(`#${NS}-recstyle-generic`).addEventListener("click", () => { registry.exportStyle = "generic"; renderPanel("record"); });
        pane("record").querySelector(`#${NS}-recstyle-company`).addEventListener("click", () => { registry.exportStyle = "company"; renderPanel("record"); });
        pane("record").querySelector(`#${NS}-reccopy`).addEventListener("click", () => copyToClipboard(activeExport()));
        wireFrameOpeners(pane("record"));
      } else if (which === "learn") {
        const m = registry.appModel;
        const d = registry.drift;
        pane("learn").innerHTML = `
          <div class="hint"><b>Site detected:</b> ${escapeHtml(PROFILE.name)}. The tool recognizes this site and uses a tailored rule set for it: which class names its developers write on purpose (safe to trust), and which attributes are just internal wiring (ignored). Everything below is a real <b>coverage measurement you can hand to developers</b>, not a guess. Nothing leaves your browser.</div>
          ${m ? `<div class="row"><span>Elements sampled</span><span>${m.sampledElements}</span></div>
            ${knownTestIdTotal() ? `<div class="row"><span>Test hooks this app defines</span><span>${knownTestIdTotal()} in the shipped bundle</span></div>
            <div class="row"><span>\u2026seen rendered so far</span><span>${seenTestIds.size} (${Math.round((seenTestIds.size / knownTestIdTotal()) * 100)}%)</span></div>
            <div class="li-fix" style="margin:4px 0">\u2192 Hooks like <code>add-term-button</code>, <code>create-domain-name</code>, <code>glossary-browser-sidebar</code> exist in this build. Reach for <code>getByTestId</code> on those screens before deriving anything. The ones not yet seen are simply UI this session has not opened.</div>`
              : `<div class="row"><span>Test-hook coverage</span><span>${m.testAttr ? escapeHtml(m.testAttr) + " on " + Math.round(m.testAttrCoverage * 100) + "% of controls" : "none detected"}</span></div>`}` : '<div class="empty">Move around the app \u2014 conventions are learned during idle scans.</div>'}
          <div class="row" style="margin-top:6px"><span>Knowledge base (persisted)</span><span>${Catalog.size()} locators \u00B7 ${Catalog.approvedCount()} approved \u00B7 ${escapeHtml(Catalog.backendKind)}</span></div>
          ${(() => { const t = Array.from(registry.tracked.values()); if (!t.length) return ""; const flaky = t.filter((r) => r.breaks > 0).length, atRisk = t.filter((r) => r.breaks === 0 && r.stability === "at-risk").length, healthy = t.length - flaky - atRisk; return `<div class="row"><span>Locator health (watched)</span><span><span style="color:#2ecc71">${healthy} healthy</span> \u00B7 <span style="color:#e67e22">${atRisk} at-risk</span> \u00B7 <span style="color:#e74c3c">${flaky} flaky</span></span></div>`; })()}
          ${(() => {
            const list = Catalog.approvedList();
            if (!list.length) return "";
            const rows = list.slice(0, 50).map((r) => `<div class="entry"><div class="top"><span class="badge" style="background:#3dc7f0">${escapeHtml(r.strategy || "")}</span><span style="flex:1;color:#9aa0a6">${escapeHtml((r.name || r.role || r.route || "").slice(0, 44))}</span><button class="action" data-unapprove="${escapeHtml(r.sig)}" style="padding:2px 9px;font-size:10.5px">Unapprove</button></div><code style="font-size:10px">${escapeHtml((r.primary || "").slice(0, 74))}</code></div>`).join("");
            return `<div class="hint" style="margin-top:8px">Approved locators (${list.length})${list.length > 50 ? " \u2014 showing 50 most recent" : ""} \u2014 approved by mistake? Unapprove it, no need to clear everything:</div>
              <div style="max-height:170px;overflow:auto">${rows}</div>`;
          })()}
          ${(() => { const sg = Catalog.suggestions(); if (!sg.length) return ""; return `<div class="hint" style="margin-top:8px;color:#f0a35e">${sg.length} drift suggestion(s) \u2014 a confirmed locator changed. Nothing is auto-swapped (no silent healing); confirm to update:</div>` + sg.map((s) => `<div class="entry" style="border-left-color:#f0a35e"><div class="top"><span class="badge" style="background:#f0a35e">DRIFT</span><span>${escapeHtml(s.strategy || "")}</span></div><div style="color:#8b929c;font-size:10px">was <code>${escapeHtml((s.oldPrimary || "").slice(0, 52))}</code></div><div style="color:#e6e6e6;font-size:10.5px;margin-top:2px">now <code>${escapeHtml((s.newPrimary || "").slice(0, 52))}</code></div><button class="action" data-sugg="${escapeHtml(s.key)}" style="margin-top:5px;border-color:#f0a35e;color:#f0a35e">Accept new locator</button></div>`).join(""); })()}
          <button class="action" id="${NS}-learnnow">Learn from this page now</button>
          <button class="action" id="${NS}-catexport">Export knowledge base (JSON)</button>
          <button class="action" id="${NS}-driftnow">Check drift vs last visit</button>
          ${d ? `<div class="entry" style="border-left-color:#e67e22;margin-top:8px"><div class="top"><span class="badge" style="background:#e67e22">DRIFT</span><span>${escapeHtml(d.route)}</span></div><div style="color:#e6e6e6">+${d.added} added \u00B7 -${d.removed} removed \u00B7 ~${d.changed} changed since last visit</div></div>` : ""}
          <div class="hint" style="margin-top:10px">Stored locally in your browser only (IndexedDB): the app-model + per-route fingerprints. No URLs, payloads, passwords, or typed values are persisted.</div>
          <button class="action" id="${NS}-clearstale" style="border-color:#e67e22;color:#f0a35e" title="Drops only entries that are BOTH unused 30+ days AND low-confidence. Anything grade-A/stable, repeatedly re-approved, or URN-anchored is kept regardless of age.">Clear stale (30+ days, low confidence)</button>
          <button class="action" id="${NS}-purge" style="border-color:#e74c3c;color:#ff8a80">Clear all stored data (this site)</button>`;
        pane("learn").querySelector(`#${NS}-learnnow`).addEventListener("click", () => { registry.samples = []; learnFrom(document); showToast("Learned from this page"); renderPanel("learn"); });
        pane("learn").querySelector(`#${NS}-catexport`).addEventListener("click", async () => { await Catalog.flush(); const rows = Catalog.all(); downloadCsv(JSON.stringify(rows, null, 2).replace(/^/, ""), "locator-knowledge-base-" + location.hostname + ".json"); showToast("Exported " + rows.length + " catalogued locators"); });
        pane("learn").querySelector(`#${NS}-driftnow`).addEventListener("click", async () => { const r = await checkDrift(); showToast(r ? "Drift detected \u2014 see report" : "No drift (or first visit; baseline saved)"); renderPanel("learn"); });
        pane("learn").querySelectorAll("[data-sugg]").forEach((b) => b.addEventListener("click", () => { Catalog.acceptSuggestion(b.getAttribute("data-sugg")); showToast("Locator updated (human-confirmed)"); renderPanel("learn"); }));
        pane("learn").querySelectorAll("[data-unapprove]").forEach((b) => b.addEventListener("click", () => { Catalog.unapprove(b.getAttribute("data-unapprove")); showToast("Unapproved \u2014 removed from confirmed memory"); renderPanel("learn"); }));
        pane("learn").querySelector(`#${NS}-clearstale`).addEventListener("click", async () => {
          const n = await Catalog.clearStale(30);
          showToast(n ? `Cleared ${n} stale, low-confidence locator(s)` : "Nothing both stale and low-confidence \u2014 nothing cleared");
          renderPanel("learn");
        });
        pane("learn").querySelector(`#${NS}-purge`).addEventListener("click", async () => {
          // Styled as a danger button
          // (red border) but fired with zero confirmation -- an easy misclick for
          // anyone, worst for a beginner who has not yet learned this button is
          // instant and irreversible. The data itself is low-stakes and self-rebuilds
          // just by browsing (see the hint right above this button), so this is a
          // "don't let a misclick surprise you" guard, not a "protect precious data" one.
          if (!confirm("Clear all locator knowledge learned for this site?\n\nThis only affects this tool's own local cache (nothing about the app itself) and rebuilds automatically as you keep using it -- but it can't be undone right now.")) return;
          await Catalog.clear(); await KS.purge(); registry.appModel = null; registry.samples = []; registry.drift = null; showToast("Cleared all stored data for this site"); renderPanel("learn");
        });
      } else if (which === "doctor") {
        // "Needs checkup" -- ONLY locators you actually relied on (copied, or used in
        // a recording), not everything Inspect happened to hover, and only the ones
        // currently ambiguous. Health tab keeps tracking (and showing) everything,
        // unchanged; this list is the action-oriented subset of it.
        const checkups = [...registry.tracked.values()].filter((r) =>
          (registry.deliberateCopy.has(r.css) || registry.deliberateRecord.has(r.css)) &&
          r.breaks > 0 && !registry.dismissedCheckups.has(r.css));
        const checkupHtml = checkups.length ? `
          <div class="hint" style="color:#f0a35e"><b>Needs checkup (${checkups.length})</b> \u2014 locators you copied or used in a recording that have since gone ambiguous. Click one to diagnose it below, or dismiss it.</div>
          ${checkups.map((r) => `<div class="entry" style="border-left-color:#e74c3c;cursor:pointer" data-checkup="${escapeHtml(r.css)}"><div class="top"><span class="badge" style="background:#e74c3c">Ambiguous</span><span style="flex:1">${escapeHtml(r.strategy || "")}</span><button class="action" data-dismiss="${escapeHtml(r.css)}" title="Dismiss" style="padding:2px 8px;font-size:11px;margin:0">\u2715</button></div><code style="font-size:10px">${escapeHtml((r.primary || r.css || "").slice(0, 74))}</code><div style="color:var(--dim);font-size:10.5px;margin-top:3px">${escapeHtml(flakinessVerdict(r).why)}</div></div>`).join("")}
        ` : "";
        // Reverse mode: the engineer already HAS a locator and it is failing. Everything
        // reported here is evaluated against the live DOM -- no guessed selectors.
        pane("doctor").innerHTML = checkupHtml + `
          <div class="hint"><b>Got a locator that isn't working?</b> Paste it here. Every part of it is run against this page, one segment at a time, so you can see the exact point where it stops matching.</div>
          <div class="hint" style="margin-top:6px">Three things are accepted, and it detects which is which:<br>
            &nbsp;\u2022 a Playwright chain \u2014 <code style="font-size:10.5px">page.getByRole('button', { name: 'Save' })</code><br>
            &nbsp;\u2022 a plain CSS selector \u2014 <code style="font-size:10.5px">[data-row-key="urn:li:..."] button</code><br>
            &nbsp;\u2022 an XPath \u2014 <code style="font-size:10.5px">//button[contains(text(),'Save')]</code></div>
          <textarea class="doc-in" id="${NS}-docin" spellcheck="false" placeholder="Paste the locator here, then press Check (or Cmd/Ctrl+Enter)"></textarea>
          <button class="action" id="${NS}-docrun">Check this locator</button>
          <div class="hint" style="margin-top:6px">Check it on the screen where it is supposed to work \u2014 a locator for a dialog reads as broken while the dialog is closed, and that is correct.</div>
          <div id="${NS}-docout"></div>`;
        const runDoc = () => {
          const code = (pane("doctor").querySelector(`#${NS}-docin`).value || "").trim();
          const out = pane("doctor").querySelector(`#${NS}-docout`);
          if (!code) { out.innerHTML = ""; return; }
          let r;
          try { r = diagnoseLocator(code); } catch (err) { out.innerHTML = `<div class="doc-why">Could not evaluate: ${escapeHtml(String(err && err.message || err))}</div>`; return; }
          const vc = { ok: "var(--ship)", hidden: "var(--watch)", "not-actionable": "var(--watch)", ambiguous: "var(--watch)", broken: "var(--stop)", "cross-origin": "var(--watch)", unparseable: "var(--stop)" }[r.verdict] || "var(--dim)";
          // Headline answers the only question being asked: does it find the element?
          // "matches 1" is a PASS even when the element happens to be hidden or
          // unclickable right now -- those are separate facts, reported underneath.
          const HEAD = {
            ok: "Works \u2014 finds exactly 1 element",
            hidden: "Finds it (1 element), but it is hidden right now",
            "not-actionable": "Finds it (1 element), but it cannot be clicked yet",
            ambiguous: "Too broad \u2014 finds " + r.count + " elements, so Playwright will refuse",
            broken: "Finds nothing on this page",
            "cross-origin": "Cannot be checked from here \u2014 the element is in another origin's frame",
            unparseable: "Could not read this",
          };
          const kindLbl = r.kind === "css" ? "read as a CSS selector" : r.kind === "xpath" ? "read as XPath" : "read as a Playwright chain";
          out.innerHTML =
            `<div class="row" style="margin-top:12px"><span style="color:${vc};font-weight:700">${escapeHtml(HEAD[r.verdict] || r.verdict)}</span><span>${escapeHtml(kindLbl)}</span></div>` +
            (r.steps.length ? `<div class="hint" style="margin:8px 0 4px">Segment by segment \u2014 the number is how many elements still match at that point:</div>` : "") +
            r.steps.map((s) => `<div class="doc-step ${s.count === 0 ? "zero" : ""}"><span>${escapeHtml(s.seg)}${s.note ? ` <span style="color:var(--dim)">\u2014 ${escapeHtml(s.note)}</span>` : ""}</span><b>${s.count}</b></div>`).join("") +
            r.reasons.map((x) => `<div class="doc-why">${escapeHtml(x)}</div>`).join("") +
            (r.alternatives.length
              ? `<div class="li-alts-h" style="margin-top:12px">${r.verdict === "ok" ? "Other verified options for this element \u00B7 click to copy" : "Verified replacements \u00B7 click to copy"}</div>` +
                r.alternatives.slice(0, 4).map((a, i) => `<div class="entry" data-docaltn="${i + 1}" style="cursor:pointer" title="Click to copy"><div class="top"><span>${escapeHtml(a.kind)}</span><span>${escapeHtml(a.pin)}</span></div><code>${codeText(a.code)}</code><div style="color:var(--dim);font-size:10.5px;margin-top:4px">${escapeHtml(a.note)}</div></div>`).join("")
              : "");
          // Index in the DOM, code in JS -- attribute values are Ctrl+F-searchable.
          lastDocAlts = r.alternatives.slice(0, 4); // full alt objects -- approveAlternative needs .kind/.el too
          out.querySelectorAll("[data-docaltn]").forEach((n) => n.addEventListener("click", () => {
            const picked = lastDocAlts[(+n.getAttribute("data-docaltn") || 0) - 1];
            if (picked) {
              copyToClipboard(picked.code);
              approveAlternative(picked, typeof routeKey === "function" ? routeKey() : "");
            }
          }));
        };
        pane("doctor").querySelector(`#${NS}-docrun`).addEventListener("click", runDoc);
        pane("doctor").querySelector(`#${NS}-docin`).addEventListener("keydown", (ev) => { if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey)) runDoc(); });
        pane("doctor").querySelectorAll("[data-checkup]").forEach((n) => n.addEventListener("click", () => {
          const r = registry.tracked.get(n.getAttribute("data-checkup"));
          if (!r) return;
          pane("doctor").querySelector(`#${NS}-docin`).value = r.primary || r.css;
          runDoc();
        }));
        pane("doctor").querySelectorAll("[data-dismiss]").forEach((n) => n.addEventListener("click", (ev) => {
          ev.stopPropagation(); // don't also trigger the row's data-checkup click above
          registry.dismissedCheckups.add(n.getAttribute("data-dismiss"));
          renderPanel("doctor");
        }));
      } else if (which === "feed") {
        pane("feed").innerHTML =
          `<div class="row"><span>Transient UI caught</span><span>${stats.transientCaught}</span></div>
           <div class="hint">Toasts/banners/errors captured the instant they appear \u2014 errors correlated to the API call that triggered them.</div>` +
          (registry.feed.length ? registry.feed.slice().reverse().slice(0, MAX_LOG_ENTRIES).map((e) => {
            const dur = e.endTime ? ((e.endTime - e.startTime) / 1000).toFixed(1) + "s" : "still visible";
            const netHtml = e.net ? `<div style="color:#ff8a80;font-size:10px;margin-top:2px">\u21B3 ${escapeHtml(e.net.method)} ${escapeHtml(String(e.net.status))} ${escapeHtml(e.net.gql || e.net.url)}</div>` : "";
            return `<div class="entry" style="border-left-color:${SEVERITY_COLORS[e.severity]}"><div class="top"><span>${new Date(e.startTime).toLocaleTimeString()} \u00B7 ${e.severity} \u00B7 ${dur}</span><span class="badge" style="background:${GRADE_COLORS[e.res.grade] || "#666"}">${e.res.grade}</span></div><div class="txt">${escapeHtml(e.text.slice(0, 90))}</div><code>${codeText(e.res.primary)}</code>${netHtml}</div>`;
          }).join("") : '<div class="empty">Watching for toasts, banners, errors\u2026</div>') +
          `<button class="action" id="${NS}-fexport">Export feed CSV</button>
           <button class="action" id="${NS}-nexport">Export network log CSV</button>`;
        pane("feed").querySelector(`#${NS}-fexport`).addEventListener("click", exportFeedCsv);
        pane("feed").querySelector(`#${NS}-nexport`).addEventListener("click", exportNetCsv);
      }
      // dots
      const dh = panel.querySelector(`#${NS}-dot-health`); if (dh && activePane() !== "health" && Array.from(registry.tracked.values()).some((r) => r.breaks > 0)) { dh.textContent = "!"; dh.style.display = "inline-block"; }
      const dd = panel.querySelector(`#${NS}-dot-doctor`);
      if (dd && activePane() !== "doctor" && Array.from(registry.tracked.values()).some((r) =>
        (registry.deliberateCopy.has(r.css) || registry.deliberateRecord.has(r.css)) && r.breaks > 0 && !registry.dismissedCheckups.has(r.css)
      )) { dd.textContent = "!"; dd.style.display = "inline-block"; }
    }
    // registry.onUpdate lets satellites trigger a top re-render.
    if (IS_TOP) {
      registry.onUpdate = (kind) => {
        if (!panel) return;
        const dotMap = { record: "record", feed: "feed", learn: "learn", health: "health", drift: "learn" };
        const dk = dotMap[kind];
        if (dk && activePane() !== dk) { const d = panel.querySelector(`#${NS}-dot-${dk}`); if (d) { d.textContent = "\u2022"; d.style.display = "inline-block"; } }
        if (activePane() === (dk || activePane())) renderPanel(activePane());
      };
    }

    // ---- CSV exports ----
    function csvCell(v) { return `"${String(v).replace(/"/g, '""')}"`; }
    function downloadCsv(content, filename) {
      const blob = new Blob([content], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
    }
    function exportHealthCsv() {
      if (!registry.tracked.size) return showToast("Nothing tracked yet.");
      // present/absent are separate columns on purpose: a reader of this CSV must be
      // able to tell "matched several" (a defect) from "wasn't on that page" (not one).
      const rows = Array.from(registry.tracked.values()).map((r) => { const v = flakinessVerdict(r); return [v.label, v.why || "", r.strategy, r.primary, r.css, r.checks, r.present || 0, r.absent || 0, r.breaks || 0, r.lastCount, location.href]; });
      downloadCsv("verdict,why,strategy,playwright,css,rechecks,times_1_of_1,times_absent,times_ambiguous,last_count,page_url\n" + rows.map((c) => c.map(csvCell).join(",")).join("\n"), "locator-health-" + location.hostname + ".csv");
    }
    function exportFeedCsv() {
      if (!registry.feed.length) return showToast("No transients caught yet.");
      downloadCsv("time,severity,duration_s,grade,playwright,css,text,correlated_api,page_url\n" + registry.feed.map((e) => [new Date(e.startTime).toISOString(), e.severity, e.endTime ? ((e.endTime - e.startTime) / 1000).toFixed(1) : "visible", e.res.grade, e.res.primary, e.res.css, e.text, e.net ? `${e.net.method} ${e.net.status} ${e.net.gql || e.net.url}` : "", location.href].map(csvCell).join(",")).join("\n"), "transient-feed-" + location.hostname + ".csv");
    }
    function exportNetCsv() {
      if (!registry.network.length) return showToast("No network activity captured.");
      downloadCsv("time,type,method,status,ms,graphql_op,url\n" + registry.network.map((n) => [new Date(n.t).toISOString(), n.type, n.method, n.status, n.ms, n.gql || "", n.url].map(csvCell).join(",")).join("\n"), "network-" + location.hostname + ".csv");
    }

    // ==========================================================================
    // Observers: transient catch + flakiness reval + dynamic-frame detection
    // ==========================================================================
    let revalTimer = null;
    function scheduleReval(reason) {
      clearTimeout(revalTimer);
      revalTimer = setTimeout(() => revalidateAll(reason), 400);
    }
    const observer = new MutationObserver(guard((mutations) => {
      let domChanged = false;
      // The standing cross-origin frame banner only
      // ever recomputed inside renderPanel() -- so a module that appears mid-recording
      // (e.g. the app embeds the EDC iframe only once you navigate somewhere inside it)
      // sat un-flagged until something ELSE happened to call renderPanel (a manual tab
      // switch). Track whether a genuinely NEW iframe showed up this batch and refresh
      // the banner immediately if so, instead of waiting on an unrelated re-render.
      let iframeAppeared = false;
      for (const m of mutations) {
        // A mutation entirely confined to the tool's OWN UI (a tab switch replacing a
        // pane's innerHTML, a toast's text updating) is not a page change and re-checking
        // every tracked locator over it is pure waste -- it never finds anything, the
        // debounce just runs again 400ms later on the next tab click. Checked on `m.target`
        // (the still-attached parent whose children changed) rather than on the individual
        // added/removed nodes: a REMOVED node has already had its parentNode cleared by the
        // time this callback runs, so `isOwnNode(removedNode)`'s ancestry walk would silently
        // fail for anything but the panel/tooltip/toast root itself -- checking `node` too
        // still catches that root case (its own tag matches PANEL_ROOT_SELECTOR directly, no
        // ancestry walk needed), so together the two checks cover every case correctly.
        // scanNodeForTransients/iframe-injection are untouched -- only reval-scheduling changes.
        const targetIsOwn = isOwnNode(m.target);
        m.addedNodes.forEach((node) => {
          scanNodeForTransients(node);
          if (!targetIsOwn && !isOwnNode(node)) domChanged = true;
          if (node.nodeType === 1) {
            if (node.tagName === "IFRAME") { scheduleFrameInject(node); onFrameSettled(node); iframeAppeared = true; }
            else if (node.querySelectorAll) {
              const frames = node.querySelectorAll("iframe");
              if (frames.length) { frames.forEach((f) => { scheduleFrameInject(f); onFrameSettled(f); }); iframeAppeared = true; }
            }
          }
        });
        m.removedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (!targetIsOwn && !isOwnNode(node)) domChanged = true;
          if (activeTransients.has(node)) finalizeTransient(node);
          activeTransients.forEach((_, tel) => { if (node.contains && node.contains(tel)) finalizeTransient(tel); });
        });
        if (m.type === "attributes" && activeTransients.has(m.target)) {
          const cs = getComputedStyle(m.target);
          if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) finalizeTransient(m.target);
        }
      }
      if (domChanged && registry.tracked.size) scheduleReval("re-render");
      // renderPanel(), not just renderFrameBanner(): the Record tab renders its OWN
      // inline copy of this warning (with the "Record in X instead" buttons) and
      // deliberately blanks the standing banner while active, precisely BECAUSE that
      // duplicate copy exists -- calling only renderFrameBanner() would correctly
      // refresh every OTHER tab but leave Record exactly as stale as before, which is
      // the specific tab this was reported from. renderPanel(activePane()) recomputes
      // whichever tab is actually showing, Record's inline copy included.
      if (iframeAppeared && IS_TOP && panel) renderPanel(activePane());
    }));
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class", "hidden"] });

    // SPA route hooks (top drives drift + reval)
    const origPush = history.pushState, origReplace = history.replaceState;
    function onRoute() {
      try {
        scheduleReval("route change");
        if (IS_TOP) { recNavigation(location.href); setTimeout(() => { try { checkDrift(); } catch {} }, 600); }
      } catch {
        /* never break the app's navigation */
      }
    }
    history.pushState = function () { const r = origPush.apply(this, arguments); onRoute(); return r; };
    history.replaceState = function () { const r = origReplace.apply(this, arguments); onRoute(); return r; };
    window.addEventListener("popstate", onRoute, true);

    // ==========================================================================
    // FrameManager \u2014 inject satellites into same-origin frames
    // ==========================================================================
    function isSameOrigin(frameEl) {
      try {
        return !!(frameEl.contentWindow && frameEl.contentDocument && frameEl.contentDocument.body !== undefined);
      } catch {
        return false;
      }
    }
    function injectFrame(frameWin) {
      try {
        if (!frameWin || (frameWin[NS] && frameWin[NS].active)) return;
        frameWin.eval("(" + boot.toString() + ')("satellite")');
      } catch {}
    }
    function scheduleFrameInject(frameEl) {
      if (!frameEl || frameEl.tagName !== "IFRAME") return;
      let tries = 0;
      const attempt = () => {
        tries++;
        if (!isSameOrigin(frameEl)) return; // cross-origin \u2192 skip (reported on hover)
        const w = frameEl.contentWindow;
        if (!w || !w.document || !w.document.body) { if (tries < 20) setTimeout(attempt, 250); return; }
        injectFrame(w);
      };
      setTimeout(attempt, 60);
      frameEl.addEventListener("load", () => { if (isSameOrigin(frameEl)) injectFrame(frameEl.contentWindow); });
    }
    function onFrameSettled(frameEl) {
      if (!frameEl || frameEl.tagName !== "IFRAME") return;
      frameEl.addEventListener("load", () => { if (IS_TOP && panel) renderPanel(activePane()); }, { once: true });
    }
    function injectAllFrames() {
      let frames;
      try {
        frames = document.querySelectorAll("iframe");
      } catch {
        return;
      }
      frames.forEach(scheduleFrameInject);
    }

    // ==========================================================================
    // Wiring + register this window
    // ==========================================================================
    // All listeners are guarded (a bug can't reach the host page) and stored by
    // reference so teardown removes every one of them.
    const H = {
      move: guard(onMouseMove),
      down: guard(onMouseDown),
      click: guard(onClick),
      dbl: guard((e) => onRecClick(e, true)),
      input: guard(onRecInput),
      change: guard(onRecChange),
      key: guard(onKey),
      reckey: guard(onRecKey),
    };
    document.addEventListener("mousedown", H.down, true);
    document.addEventListener("mousemove", H.move, true);
    document.addEventListener("click", H.click, true);
    document.addEventListener("dblclick", H.dbl, true);
    document.addEventListener("input", H.input, true);
    document.addEventListener("change", H.change, true);
    document.addEventListener("keydown", H.key, true);
    document.addEventListener("keydown", H.reckey, true);
    patchNetwork();

    // catch pre-existing transients
    try {
      document.querySelectorAll(TRANSIENT_ROLE_SELECTOR).forEach((n) => { if (isNotableTransient(n)) captureTransient(n); });
    } catch {}

    const frameId = "f" + registry.nextId++;
    function destroy() {
      // Top tears down all satellites first (skipping its own entry to avoid
      // re-entering destroy on itself).
      if (IS_TOP) {
        registry.frames.forEach((f) => { if (f.win !== win) { try { f.destroy && f.destroy(); } catch {} } });
        registry.frames.clear();
      }
      document.removeEventListener("mousedown", H.down, true);
      document.removeEventListener("mousemove", H.move, true);
      document.removeEventListener("click", H.click, true);
      document.removeEventListener("dblclick", H.dbl, true);
      document.removeEventListener("input", H.input, true);
      document.removeEventListener("change", H.change, true);
      document.removeEventListener("keydown", H.key, true);
      document.removeEventListener("keydown", H.reckey, true);
      observer.disconnect();
      unpatchNetwork();
      if (IS_TOP) { try { Catalog.flush(); } catch {} }   // persist anything still pending
      try { history.pushState = origPush; history.replaceState = origReplace; } catch {}
      if (panel) panel.remove();
      if (onPanelResize) window.removeEventListener("resize", onPanelResize);
      tooltip.remove(); toastEl.remove(); helpEl.remove(); style.remove();
      registry.frames.delete(frameId);
      win[NS].active = false;
      if (IS_TOP) { try { delete TOP[REG_KEY]; } catch {} }
    }

    win[NS] = { active: true, mode, destroy, version: VERSION, frameId,
      // exposed for tests / power use:
      resolveUniqueLocator, buildUniqueCss, matchesUniquely, playwrightLocator, accessibleName, roleOf, boundaryInfo,
      contextualLocator, leafDescriptor, distinctiveRowText, nameFromContents, frameSelector, urnSelector,
      isHashedClass, isGeneratedId, revalidateAll, flakinessVerdict, trackLocator, markCheckup, resetRecordingCheckups, approveAlternative, strategyForAltKind, renderTooltip, showToast, learnFrom, recomputeAppModel, checkDrift, exportPlaywright, exportPlaywrightCompanyStyle,
      sampleConventions, pageFingerprint, diffFingerprints, sanitizeUrl, isSensitiveField, KS, Catalog,
      interactionTarget, isVisiblyActionable, attrFragments, selfCandidates, findInteractiveRoot,
      suggestAlternatives, diagnoseLocator, parseLocator, revealStep, pinKind, ariaHidden,
      frameInventory, frameAdviceHtml, frameBootPayload, frameSelectorNamesThisPage,
      captureTransient, classifySeverity, wireFrameOpeners,
      _selfSel: selfFrameSelector, _frameSel: frameSelector,
      _registry: registry };
    registry.frames.set(frameId, { win, mode, destroy });

    if (IS_TOP) {
      buildPanel();
      // Purely cosmetic entrance flourish -- panel itself builds and
      // functions on the EXACT same synchronous timing as always (nothing here
      // gates real setup on it), it just stays invisible via CSS for one beat
      // (li-panel-pop's own animation-delay) while a separate floating logo
      // swoops in alongside it. Fully independent, self-cleaning element.
      panel.classList.add("li-panel-pop");
      playIntroFlyIn();
      if (autoResume) {
        registry.recording = true;
        // Prepend whatever the other tab carried across BEFORE recording this arrival --
        // otherwise this page's own navigate would land ahead of steps that actually
        // happened first.
        if (Array.isArray(carriedActions) && carriedActions.length) {
          registry.actions = carriedActions.concat(registry.actions);
        }
        recNavigation(location.href);   // URL is already clean -- the marker was stripped above
        const recTab = panel.querySelector('.tab[data-tab="record"]');
        if (recTab) recTab.click(); else { renderPanel("record"); autoFitHeight("record"); }
        showToast(carriedActions && carriedActions.length
          ? "Resumed recording \u2014 brought " + carriedActions.length + " step(s) forward from the other tab"
          : "Resumed recording in this tab \u2014 handoff from another module");
      } else {
        renderPanel("inspect");
        autoFitHeight("inspect");
        showToast("Locator Inspector " + VERSION + " \u2014 every locator verified 1-of-1 against Playwright's own engine");
      }
      Catalog.hydrate();          // load everything learned in prior visits
      learnFrom(document);
      passiveScan();
      injectAllFrames();
      setTimeout(() => checkDrift(), 800);
    } else {
      // satellite: learn from this frame, scan, and light up nested frames too
      learnFrom(document);
      passiveScan();
      injectAllFrames();
    }
  };

  // Orchestrator (top window)
  if (window[NS] && window[NS].active) {
    window[NS].destroy();
    return;
  }
  boot("top");
})();
