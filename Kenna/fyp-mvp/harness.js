/* =============================================================================
 * FYP — Intent-Aware Self-Healing GUI Automation for Accessible AI Assistants
 * The harness. Injected into the running mock app; drives it from outside.
 *
 * One file, no dependencies, no build step. Everything it creates lives inside
 * its own container, so it never collides with the app's own DOM.
 *
 * The idea in one sentence: the harness knows only GOALS ("advance the compose
 * flow"), never coordinates. For each goal it tries an ordered LADDER of routes
 * - id, then accessible label, then visible text, then a scoped chain, then
 * geometry - and it verifies a route matches exactly ONE control before acting.
 * When a route dies, the next one carries the same intent. When none survive, it
 * says so, in words, instead of failing silently.
 *
 * Route ordering follows hierdump.py's ladder (the Android-side port of the same
 * logic), so the two implementations are deliberately parallel:
 *
 *   Android (UiAutomator2)        Web (this file)          Grade
 *   resource-id                   data-testid / id         A
 *   content-desc                  aria-label               A
 *   text                          visible text             B
 *   scoped xpath chain            scoped chain             A-B
 *   coordinates                   geometry                 D
 * ========================================================================== */
(function () {
  'use strict';

  if (window.__FYP_HARNESS && window.__FYP_HARNESS.active) {
    window.__FYP_HARNESS.panel();
    return;
  }

  // ===========================================================================
  // 0. Small utilities
  // ===========================================================================
  const NS = '__FYP_HARNESS';
  const PANEL_ID = '__fyp-panel';
  const DECOY_ID = '__fyp-decoy-layer';
  const OVERLAY_ID = '__fyp-obscure-layer';

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const now = () => (window.performance && performance.now ? performance.now() : Date.now());
  const strip = (s) => (s || '').replace(/[\uE000-\uF8FF]/g, '').replace(/\s+/g, ' ').trim();
  const hash = (s) => {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(16).padStart(8, '0');
  };

  // ===========================================================================
  // 1. Control model - what the harness treats as an actionable control
  //
  // react-native-web renders TouchableOpacity as <div tabindex="0">, so tabindex
  // is the honest signal here - exactly the role `clickable="true"` plays in the
  // Android tree.
  // ===========================================================================
  const CONTROL_SEL = [
    '[tabindex="0"]',
    'button',
    'input',
    'textarea',
    'select',
    '[role="button"]',
    '[role="switch"]',
    '[role="link"]',
    '[role="menuitem"]',
    'a[href]',
  ].join(',');

  function textOf(el) {
    let s = '';
    for (const n of el.childNodes) {
      if (n.nodeType === 3) s += n.nodeValue;
      else if (n.nodeType === 1) {
        if (n.tagName === 'IMG') s += n.getAttribute('alt') || '';
        else if (getComputedStyle(n).visibility !== 'hidden') s += textOf(n);
      }
    }
    return strip(s);
  }

  function cssPath(el) {
    const parts = [];
    let e = el;
    while (e && e.nodeType === 1 && e !== document.body) {
      let i = 1;
      let s = e.previousElementSibling;
      while (s) {
        if (s.tagName === e.tagName) i++;
        s = s.previousElementSibling;
      }
      parts.unshift(e.tagName.toLowerCase() + ':nth-child(' + i + ')');
      e = e.parentElement;
    }
    return parts.join('>');
  }

  /** Every actionable control on screen, with the hooks each route can use. */
  function collect() {
    const out = [];
    for (const el of document.querySelectorAll(CONTROL_SEL)) {
      if (el.closest('#' + PANEL_ID)) continue; // never harvest our own UI
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) === 0) continue;

      out.push({
        el,
        hook: el.getAttribute('data-testid') || el.id || '',
        label: el.getAttribute('aria-label') || '',
        text: textOf(el),
        role: el.getAttribute('role') || '',
        tag: el.tagName.toLowerCase(),
        box: { x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2 },
        path: cssPath(el),
      });
    }
    return out;
  }

  /** A cheap, stable-ish fingerprint of the screen, for settle() and the log. */
  function fingerprint(cs) {
    return hash(cs.map((c) => [c.hook, c.label, c.text, Math.round(c.box.cx), Math.round(c.box.cy)].join('|')).join('\n'));
  }

  /** Wait for the screen to stop changing, instead of guessing a sleep. */
  async function settle(tries = 12, interval = 120) {
    let prev = null;
    for (let i = 0; i < tries; i++) {
      const cs = collect();
      const fp = fingerprint(cs);
      if (prev !== null && fp === prev) return cs;
      prev = fp;
      await sleep(interval);
    }
    return collect();
  }

  // ===========================================================================
  // 2. Screens and regions
  // ===========================================================================
  const REGIONS = {
    // The nav bar is ~50px tall. A fraction of the viewport is far too loose on a
    // tall window: feed buttons just above the bar would fall inside it.
    'bottom-nav': { x0: 0, y0: 0.9, x1: 1, y1: 1, bottomPx: 50 },
    header: { x0: 0, y0: 0, x1: 1, y1: 0.09 },
    'header-right': { x0: 0.45, y0: 0, x1: 1, y1: 0.09 },
    'gallery-grid': { x0: 0, y0: 0.28, x1: 1, y1: 0.86 },
    'sticky-bottom': { x0: 0, y0: 0.88, x1: 1, y1: 1 },
  };

  function inRegion(c, name) {
    const R = REGIONS[name];
    if (!R) return false;
    // Regions are fractions of the APP column (capped at 500px and centred, as in
    // App.tsx), not of the browser window - a wide window must not move them.
    const W = Math.min(innerWidth, 500), H = innerHeight;
    const cx = (c.box.cx - (innerWidth - W) / 2) / W, cy = c.box.cy / H;
    if (R.bottomPx && c.box.cy < H - R.bottomPx) return false;
    return cx >= R.x0 && cx <= R.x1 && cy >= R.y0 && cy <= R.y1;
  }

  const bodyText = () => strip(document.body.innerText || '');

  /** Which screen of the compose flow are we on? 1 = feed. */
  // NOTE: detect by real rendered text only. TextInput placeholders are NOT part
  // of innerText, so an earlier version of this that looked for "Add a caption"
  // silently reported screen 1 while the app sat on screen 3 - which made every
  // predicate downstream meaningless. Predicates must be built on things that
  // are actually observable.
  function detectScreen() {
    const t = bodyText();
    // innerText applies CSS text-transform: the app shows this heading in capitals.
    if (t.toLowerCase().includes('ads and monetization')) return 4;
    if (t.includes('Add audio') && t.includes('Tag people')) return 3;
    if (t.includes('New post') && t.includes('Recents')) return 2;
    return 1;
  }

  const SCREEN_NAME = { 1: 'feed', 2: 'gallery', 3: 'caption', 4: 'more options' };

  // ---------------------------------------------------------------------------
  // Observation helpers used by success predicates.
  // ---------------------------------------------------------------------------

  /** Gallery cells, located by region rather than by hook, so a broken hook
   *  cannot make a predicate silently report the wrong thing. */
  /**
   * A fingerprint of every reasonably-sized image on screen.
   *
   * On the gallery step the chosen photo drives the large preview (and one grid
   * cell), so this changes exactly when the selection moves. It is deliberately
   * hook-free and opacity-free: the selection opacity lives on the child <Image>,
   * not on the cell that carries the testID, so reading the cell would always
   * report "unchanged".
   */
  function gallerySignature() {
    const bgs = [];
    for (const el of document.querySelectorAll('*')) {
      if (el.closest('#' + PANEL_ID)) continue;
      const bg = getComputedStyle(el).backgroundImage;
      if (!bg || bg === 'none') continue;
      const r = el.getBoundingClientRect();
      if (r.width * r.height > 4000) bgs.push(bg);
    }
    return hash(bgs.join('|'));
  }

  /** First non-transparent background colour found inside an element. */
  function anyBackground(el) {
    const walk = (n) => {
      const bg = getComputedStyle(n).backgroundColor;
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
      for (const c of n.children) {
        const r = walk(c);
        if (r) return r;
      }
      return null;
    };
    return el ? walk(el) : null;
  }

  /** True if the element contains a real image (an <img> or a background-image).
   *  Deliberately NOT a background-*colour* check: buttons have colours too, and
   *  using a colour test here made the gallery's "Select" pill look like a photo. */
  function hasImage(el) {
    if (!el) return false;
    if (el.querySelector('img')) return true;
    for (const d of el.querySelectorAll('*')) {
      const bg = getComputedStyle(d).backgroundImage;
      if (bg && bg !== 'none') return true;
    }
    return false;
  }

  /**
   * The opacity of the element that actually carries the image.
   *
   * A naive "lowest opacity in the subtree" scan is useless here: react-native-web
   * renders a hidden accessibility <img> with opacity 0 inside EVERY image, so
   * that scan reports 0 for all of them and cannot tell a selected photo from an
   * unselected one. Read the image-bearing element instead.
   */
  function cellOpacity(el) {
    // Opacity composes down the tree: the selection fade can sit on a wrapper
    // ABOVE the element that paints the image, so read the product of every
    // opacity from the cell down to the image-bearing element, not just the
    // image's own (which is 1 even for the selected photo).
    const product = (from, to) => {
      let o = 1;
      for (let n = to; n; n = n.parentElement) {
        o *= parseFloat(getComputedStyle(n).opacity);
        if (n === from) break;
      }
      return o;
    };
    for (const d of [el].concat(Array.from(el.querySelectorAll('*')))) {
      const bg = getComputedStyle(d).backgroundImage;
      if (bg && bg !== 'none') return product(el, d);
    }
    return parseFloat(getComputedStyle(el).opacity);
  }

  const isLight = (color) => {
    const m = (color || '').match(/(\d+),\s*(\d+),\s*(\d+)/);
    return !!m && +m[1] > 200 && +m[2] > 200 && +m[3] > 200;
  };

  /** Poll a predicate instead of checking once - a UI settles asynchronously. */
  async function waitFor(fn, timeout = 1600) {
    const t0 = now();
    let last = false;
    while (now() - t0 < timeout) {
      try {
        last = !!fn();
      } catch (e) {
        last = false;
      }
      if (last) return true;
      await sleep(120);
    }
    return last;
  }

  // ===========================================================================
  // 3. The intent model
  //
  // An intent describes WHAT is wanted. Routes describe HOW it might be found.
  // The success signal is always a predicate checked afterwards - never "no
  // exception was thrown".
  // ===========================================================================
  // Mutable so an assistant can post what the user actually asked for (see the
  // agent API at the bottom of this file); the demo default is unchanged.
  const DEFAULT_CAPTION = 'fyp demo post';
  let CAPTION_TEXT = DEFAULT_CAPTION;

  const INTENTS = [
    {
      id: 'post.open',
      screen: 'feed',
      action: 'click',
      desc: 'Open the create-post flow',
      testId: 'tab-create',
      labels: ['create post', 'new post', 'create', '+'],
      anchor: null,
      region: 'bottom-nav',
      ordinal: 2,
      // "The third nav control" only means something while the nav still has the
      // number of controls it had when this was learned on the healthy app.
      poolGuard: true,
      success: () => detectScreen() >= 2,
      successDesc: 'gallery screen appeared',
    },
    {
      id: 'gallery.select',
      screen: 'gallery',
      action: 'click',
      desc: 'Choose a photo from the gallery',
      // Cell 2, not cell 0: cell 0 is already the default selection, so choosing
      // it changes nothing. And once cell 2 has been chosen (the app keeps the
      // selection between runs) it is the selected one, so take cell 3 next.
      testId: (cs) => {
        const selected = (hook) => {
          const c = cs.find((x) => x.hook === hook);
          return !!c && cellOpacity(c.el) < 0.9;
        };
        return selected('gallery-cell-2') ? 'gallery-cell-3' : 'gallery-cell-2';
      },
      labels: ['gallery photo'],
      anchor: 'Recents',
      region: 'gallery-grid',
      ordinal: 0,
      // Only real image cells, and never the one already selected - choosing the
      // current photo changes nothing, so it can never satisfy the predicate.
      visionFilter: (c) => hasImage(c.el) && cellOpacity(c.el) >= 0.9,
      // No cell reliably reads as "currently selected" (the selection styling does
      // not survive as a readable property), so a single geometric guess can land
      // on the photo that is already chosen and change nothing. Sweep the image
      // cells in order instead and let the success predicate pick the winner.
      visionSweep: true,
      // Capture the selection signature first; success = it changed. Hook-free,
      // so stripping every testID cannot make this predicate lie.
      capture: gallerySignature,
      success: (it) => !!it._before && gallerySignature() !== it._before,
      successDesc: 'the chosen photo changed (the preview followed it)',
    },
    {
      id: 'compose.next',
      screen: 'gallery',
      action: 'click',
      desc: 'Advance to the caption step',
      testId: 'compose-next',
      labels: ['next'],
      anchor: 'New post',
      region: 'header-right',
      ordinal: 0,
      success: () => detectScreen() === 3,
      successDesc: 'caption screen appeared',
    },
    {
      id: 'meta.advance',
      screen: 'caption',
      action: 'click',
      desc: 'Open the "More options" settings',
      testId: 'more-options',
      labels: ['more options'],
      anchor: null,
      success: () => detectScreen() === 4,
      successDesc: 'the more-options screen appeared',
    },
    {
      id: 'meta.back',
      screen: 'more options',
      action: 'click',
      desc: 'Go back to the caption step',
      testId: 'options-back',
      labels: ['back'],
      anchor: null,
      // The only control in the header's left corner: pure geometry can find it.
      region: 'header',
      ordinal: 0,
      success: () => detectScreen() === 3,
      successDesc: 'back on the caption step',
    },
    {
      id: 'caption.type',
      screen: 'caption',
      action: 'type',
      desc: 'Type a caption',
      testId: 'caption-input',
      labels: ['caption'],
      anchor: 'Add a caption',
      // With the hook renamed and the label stripped, the only thing left that
      // identifies this field is that it is the first text area on the screen.
      visionKind: 'textarea',
      ordinal: 0,
      get value() { return CAPTION_TEXT; },
      success: () => {
        const el = document.querySelector('[data-testid="caption-input"], textarea[placeholder*="caption" i], input[placeholder*="caption" i]');
        return !!el && (el.value || '') === CAPTION_TEXT;
      },
      successDesc: 'caption field contains the typed text',
    },
    {
      id: 'setting.toggle',
      screen: 'caption',
      action: 'click',
      desc: 'Turn on the "Add AI label" switch',
      testId: 'ai-label-switch',
      labels: ['add ai label', 'ai label'],
      anchor: 'Add AI label',
      region: 'sticky-bottom',
      ordinal: -1,
      // react-native-web renders Switch as a bare <div> - no role, no
      // aria-checked, no <input>. Its state is therefore invisible to assistive
      // technology, and the only honest way to read it is its track colour. That
      // is a finding, not a workaround.
      // NOTE: react-native-web's Switch is the ONE properly accessible control in
      // this app - it renders a real <input type="checkbox" role="switch"> with an
      // aria-label. Its testID, though, lands on a presentational wrapper <div>,
      // so the state must be read from the input, not from the element carrying
      // the testID. (Every TouchableOpacity, by contrast, is a bare div: no role,
      // no name - see the accessibility panel.)
      alreadySatisfied: true,
      success: (it) => {
        const el =
          (it && it._acted) ||
          document.querySelector('input[role="switch"][aria-label="Add AI label"]') ||
          document.querySelector('[data-testid="ai-label-switch"]');
        if (!el) return false;
        if (el.tagName === 'INPUT') return !!el.checked;
        const aria = el.getAttribute('aria-checked');
        if (aria != null) return aria === 'true';
        return isLight(anyBackground(el));
      },
      successDesc: 'the switch reads as on',
    },
    {
      id: 'share.post',
      screen: 'caption',
      action: 'click',
      desc: 'Publish the post',
      // Outward-facing and not undoable: a model's guess is acted on only when it
      // is confident, and only its first choice (see route_semantic).
      irreversible: true,
      testId: 'share-button',
      labels: ['share'],
      anchor: 'More options',
      region: 'sticky-bottom',
      ordinal: 0,
      // Not just "back on the feed": any tap that abandons the draft also lands there.
      // The step's own goal is the post being published, so the predicate says so.
      success: () => detectScreen() === 1 && bodyText().includes(CAPTION_TEXT),
      successDesc: 'returned to the feed with the new post in it',
    },
    {
      id: 'feed.assert',
      screen: 'feed',
      action: 'assert',
      desc: 'The new post is visible in the feed',
      success: () => bodyText().includes(CAPTION_TEXT),
      successDesc: 'the published caption is present in the feed',
    },
  ];

  // ===========================================================================
  // 4. The ladder - five routes, each verified 1-of-1 before it is used
  // ===========================================================================
  const GRADES = { id: 'A', label: 'A', text: 'B', scoped: 'A-B', vision: 'D' };

  const kw = (s, list) => list.some((k) => s.toLowerCase().includes(k.toLowerCase()));

  /** Route 0 - an explicit id. Version-pinned: survives nothing but a build. */
  const route_id = (intent, cs) => {
    if (!intent.testId) return [];
    // A hook may depend on state: choosing the photo that is already selected
    // changes nothing, so the gallery intent names a cell that is not selected.
    const want = typeof intent.testId === 'function' ? intent.testId(cs) : intent.testId;
    const exact = cs.filter((c) => c.hook === want);
    if (exact.length) return exact;
    // Fall back to a prefix match so `gallery-cell-0` can stand for the group.
    const prefixes = want.endsWith('-0') ? [want.replace(/-0$/, '-')] : [];
    return cs.filter((c) => c.hook && prefixes.some((p) => c.hook.startsWith(p)));
  };

  /**
   * Prefer an exact match over a substring match.
   *
   * Two controls contain the word "share" on the caption screen: the Share button
   * and the "Also share on..." row. A pure substring test returns both, the
   * 1-of-1 uniqueness check correctly refuses to choose between them, and the
   * ladder falls through to geometry - which then lands on the "Also share on"
   * row in the same sticky region and does nothing. Ranking an exact text match
   * first is how a human disambiguates, and it keeps the uniqueness guarantee
   * intact instead of weakening it to "first match wins".
   */
  const preferExact = (intent, hits, key) => {
    const exact = hits.filter((c) => {
      const v = (c[key] || '').trim().toLowerCase();
      return intent.labels.some((l) => v === String(l).trim().toLowerCase());
    });
    return exact.length ? exact : hits;
  };

  /** Route 1 - an accessible label. Survives re-layout, dies if under-labelled. */
  const route_label = (intent, cs) => {
    const h = preferExact(intent, cs.filter((c) => c.label && kw(c.label, intent.labels)), 'label');
    return intent.pick ? intent.pick(h, 'label') : h;   // taught list item: "the first of the matches"
  };

  /** Route 2 - visible text. Breaks on copy or locale change. */
  const route_text = (intent, cs) => {
    const h = preferExact(intent, cs.filter((c) => c.text && kw(c.text, intent.labels)), 'text');
    return intent.pick ? intent.pick(h, 'text') : h;
  };

  /**
   * Route 3 - the scoped chain.
   *
   * A bare hook can be ambiguous: several controls may share a label or no label
   * at all. This route conjoins a control with the container that holds it, using
   * that container's own distinguishing text - the web analogue of
   *   //*[@resource-id=".../feed_row"][.//*[@text="nasa"]]//*[@content-desc="Like"]
   * It is the route that survives duplication and re-ordering.
   */
  const route_scoped = (intent, cs) => {
    if (!intent.anchor) return [];
    const anchor = intent.anchor.toLowerCase();
    const hits = [];
    for (const c of cs) {
      let p = c.el.parentElement;
      let depth = 0;
      while (p && p !== document.body && depth < 6) {
        if (textOf(p).toLowerCase().includes(anchor)) {
          const inside = cs.filter((o) => p.contains(o.el));
          let pick = null;
          if (inside.length === 1) {
            pick = inside[0];
          } else {
            // Several controls share the container, so the container alone does
            // not identify one. Conjoin it with the intent's own words: that is
            // what lets this route pick the real "Next" out of its header while
            // ignoring a duplicate that lives somewhere else entirely.
            let m = inside.filter((o) => (o.label && kw(o.label, intent.labels)) || (o.text && kw(o.text, intent.labels)));
            m = preferExact(intent, m, 'text');
            if (m.length > 1) m = preferExact(intent, m, 'label');
            if (m.length === 1) pick = m[0];
          }
          if (pick === c) hits.push(c);
          break;
        }
        p = p.parentElement;
        depth++;
      }
    }
    // Different containers can each yield a plausible pick (the Share button, and
    // the "Also share on" row from its own smaller container). Prefer the exact
    // word match, as a person would.
    if (hits.length > 1) {
      let h = preferExact(intent, hits, 'text');
      if (h.length > 1) h = preferExact(intent, h, 'label');
      return h;
    }
    return hits;
  };

  /** Route 4 - geometry. No semantics at all: region plus ordinal. */
  /** Where a control sits in its scrolling content, so "scrolled down a bit" does not move it. */
  function docPos(el) {
    let p = el.parentElement, sc = null;
    while (p && p !== document.body) {
      const o = getComputedStyle(p).overflowY;
      if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight + 2) { sc = p; break; }
      p = p.parentElement;
    }
    const r = el.getBoundingClientRect();
    return { y: sc ? r.top + r.height / 2 - sc.getBoundingClientRect().top + sc.scrollTop : r.top + r.height / 2 + window.scrollY };
  }

  const route_vision = (intent, cs) => {
    // A step the user TAUGHT has no named region: it carries where the control sat
    // (across the app column, down its scrolling content, size, kind) when it was
    // demonstrated. Pure geometry again - nearest control of the same kind and similar
    // size, and only if it is close enough to be a plausible match.
    if (intent.geo) {
      const g = intent.geo, W = Math.min(innerWidth, 500);
      const tx = (innerWidth - W) / 2 + g.x * W;
      const near = cs
        .filter((c) => c.tag === g.tag && c.box.w > g.w * 0.6 && c.box.w < g.w * 1.6 && c.box.h > g.h * 0.6 && c.box.h < g.h * 1.6)
        .map((c) => ({ c, d: Math.hypot(c.box.cx - tx, g.docY == null ? c.box.cy - g.y * innerHeight : docPos(c.el).y - g.docY) }))
        .sort((a, b) => a.d - b.d);
      return near.length && near[0].d <= (g.docY == null ? innerHeight * 0.15 : 90) ? [near[0].c] : [];
    }
    /** Build the candidate pool, optionally ignoring the positional prior. */
    const build = (src, useRegion) => {
      let pool;
      if (intent.visionKind) {
        // Purely structural: "the Nth control of this kind on screen". No
        // semantics at all - this is the rung that has to work when every hook
        // and label is gone, and it is also the weakest, which is why it is
        // tried last.
        pool = src.filter((c) => c.tag === intent.visionKind);
      } else if (intent.region) {
        pool = useRegion ? src.filter((c) => inRegion(c, intent.region)) : src.slice();
        // A control that is on screen but painted over (feed items scrolled
        // under the nav bar) is not a candidate: it would shift the ordinal, and
        // the feed grows by one post per run. Off-screen controls stay - reveal()
        // scrolls them in later. Hook-free, so it is still pure geometry.
        pool = pool.filter((c) => {
          const b = c.el.getBoundingClientRect();
          const cx = b.x + b.width / 2;
          const cy = b.y + b.height / 2;
          if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) return true;
          // Ask "is it hidden behind the APP's own UI?" with the injected chaos
          // layers out of the way. Covered by an injected overlay (B7) must stay
          // in the pool - dropping it would shift the ordinal and send the tap to
          // a neighbour; it is attempted and reported as obscured instead.
          const layers = [DECOY_ID, OVERLAY_ID].map((id) => document.getElementById(id)).filter(Boolean);
          const prev = layers.map((l) => l.style.visibility);
          layers.forEach((l) => { l.style.visibility = 'hidden'; });
          try {
            return hitTest(c.el).ok;
          } finally {
            layers.forEach((l, i) => { l.style.visibility = prev[i]; });
          }
        });
      } else {
        return [];
      }
      // Let an intent constrain what geometry is allowed to pick. Without this
      // the gallery region happily yields the "Select" button and the
      // already-chosen photo - both produce no visible change and look like a
      // failure.
      if (intent.visionFilter) {
        try { pool = pool.filter((c) => intent.visionFilter(c)); } catch (e) {}
      }
      return pool;
    };

    // The region is a PRIOR about where things live, not the thing that
    // identifies them - and window size moves it. At 410x779 the gallery grid
    // sits inside the 0.28-0.86 band; at 1280x860 the same grid renders as one
    // 500px-wide column whose cells start at 89% of the viewport, so the band
    // matches only stray header controls and the image predicate then empties
    // it. Drop the positional prior ONLY after the predicate has also come up
    // empty; the predicate is what actually identifies this control.
    let pool = build(cs, true);
    if (!pool.length) pool = build(cs, false);
    if (!pool.length) return [];
    // Order left-to-right, top-to-bottom so the ordinal is meaningful.
    pool = pool.slice().sort((a, b) => (Math.abs(a.box.cy - b.box.cy) > 8 ? a.box.cy - b.box.cy : a.box.cx - b.box.cx));
    // A sweeping intent wants the WHOLE ordered neighbourhood, not one guess:
    // runIntent then walks it and lets the success predicate pick the winner.
    // (Returning only the ordinal here made visionSweep a no-op - it received a
    // 1-element pool and reported `vision(no effect)` on the first miss.)
    if (intent.visionSweep) return pool.slice(0, 12);
    lastPoolLen = pool.length;
    // An ordinal is only a meaningful guess in the neighbourhood it was learned
    // in. If a control has gone from the row, "the third one" is now its
    // neighbour, and tapping it is a blind wrong tap - refuse instead.
    if (intent.poolGuard && intent._poolSize != null && pool.length !== intent._poolSize) return [];
    const i = intent.ordinal < 0 ? pool.length + intent.ordinal : intent.ordinal;
    return pool[i] ? [pool[i]] : [];
  };

  let lastPoolLen = 0;
  /** Learn the neighbourhood size from a tree where the strongest route worked. */
  function learnPool(intent, cs) {
    if (!intent.poolGuard) return;
    const keep = intent._poolSize;
    intent._poolSize = null;
    try { route_vision(intent, cs); intent._poolSize = lastPoolLen || keep; } catch (e) { intent._poolSize = keep; }
  }

  // -------------------------------------------------------------------------
  // Route 5 - learned. A deterministic locator DISTILLED from an earlier
  // semantic (model) success: what the control was called, what it said, and
  // where it sat, with no hook in it (hooks are what drift). Only present when
  // route memory is on. It is cheap, so a model is asked once per change of UI
  // rather than once per run.
  // -------------------------------------------------------------------------
  const appColumn = () => { const W = Math.min(innerWidth, 500); return { W, off: (innerWidth - W) / 2 }; };

  function descriptorOf(c) {
    const { W, off } = appColumn();
    return {
      tag: c.tag, label: c.label || '', text: c.text || '',
      geo: { x: (c.box.cx - off) / W, y: c.box.cy / innerHeight, docY: docPos(c.el).y, w: c.box.w, h: c.box.h },
    };
  }

  const route_learned = (intent, cs) => {
    const rec = memory.enabled ? memory.intents[intent.id] : null;
    const d = rec && rec.learned;
    if (!d) return [];
    const same = cs.filter((c) => c.tag === d.tag);
    const named = same.filter((c) => (d.label && c.label === d.label) || (d.text && d.text.length > 1 && c.text === d.text));
    if (named.length === 1) return named;
    const { W, off } = appColumn();
    const tx = off + d.geo.x * W;
    const pool = (named.length ? named : same)
      .filter((c) => c.box.w > d.geo.w * 0.6 && c.box.w < d.geo.w * 1.6 && c.box.h > d.geo.h * 0.6 && c.box.h < d.geo.h * 1.6)
      .map((c) => ({ c, d: Math.hypot(c.box.cx - tx, d.geo.docY == null ? c.box.cy - d.geo.y * innerHeight : docPos(c.el).y - d.geo.docY) }))
      .sort((a, b) => a.d - b.d);
    return pool.length && pool[0].d <= (d.geo.docY == null ? innerHeight * 0.15 : 90) ? [pool[0].c] : [];
  };

  // -------------------------------------------------------------------------
  // Route 6 - semantic. Asks a model which control means this intent. The model
  // lives OUTSIDE the page (the runner exposes window.__fypSemantic), so the
  // harness stays dependency-free and the model is swappable.
  //
  // What the model is and is not trusted with:
  //   * it sees a compact list of the controls on screen (no hooks, no caption
  //     text) and can only answer with INDICES into that list - it cannot invent
  //     a control, and text on the page cannot make it click anything off-list;
  //   * its answer is only a CANDIDATE: the same act-then-check-the-predicate
  //     loop that judges every other route judges this one;
  //   * an irreversible intent (publishing) is acted on only when the model is
  //     confident, and only on its first choice.
  // -------------------------------------------------------------------------
  const semantic = { enabled: false, calls: 0, errors: 0, ms: 0, inTok: 0, outTok: 0, cached: 0, provider: '' };
  const SEMANTIC_TOP = 3;
  const SEMANTIC_MIN_CONFIDENCE_IRREVERSIBLE = 0.8;

  async function askModel(intent, cs) {
    if (typeof window.__fypSemantic !== 'function') return [];
    const { W, off } = appColumn();
    const r2 = (n) => Math.round(n * 100) / 100;
    const payload = {
      intent: { id: intent.id, desc: intent.desc, action: intent.action, success: intent.successDesc || '', hasText: intent.action === 'type' },
      screen: SCREEN_NAME[detectScreen()],
      pageText: bodyText().slice(0, 300),
      // On-screen controls first (a screen's own controls can sit after dozens of feed
      // items in the DOM, behind it), then the rest; `i` stays the index into `cs`.
      controls: cs.map((c, i) => ({
        i, tag: c.tag, role: c.role, label: c.label, text: (c.text || '').slice(0, 60),
        placeholder: c.el.getAttribute('placeholder') || '',
        x: r2((c.box.cx - off) / W), y: r2(c.box.cy / innerHeight), w: Math.round(c.box.w), h: Math.round(c.box.h),
        onScreen: c.box.cy >= 0 && c.box.cy <= innerHeight && c.box.cx >= 0 && c.box.cx <= innerWidth,
      })).sort((a, b) => (b.onScreen - a.onScreen) || (a.i - b.i)).slice(0, 60),
    };
    const t0 = now();
    let res;
    try { res = await window.__fypSemantic(payload); } catch (e) { semantic.errors++; return []; }
    semantic.calls++;
    semantic.ms += now() - t0;
    if (res && res.usage) { semantic.inTok += res.usage.inputTokens || 0; semantic.outTok += res.usage.outputTokens || 0; if (res.usage.cached) semantic.cached++; }
    if (res && res.provider) semantic.provider = res.provider;
    return ((res && res.ranked) || [])
      .filter((r) => r && Number.isInteger(r.i) && cs[r.i])
      .map((r) => ({ c: cs[r.i], conf: typeof r.confidence === 'number' ? r.confidence : 0.5 }));
  }

  async function route_semantic(intent, cs) {
    if (!semantic.enabled) return [];
    let picks = await askModel(intent, cs);
    if (intent.irreversible) picks = picks.slice(0, 1).filter((p) => p.conf >= SEMANTIC_MIN_CONFIDENCE_IRREVERSIBLE);
    return picks.slice(0, SEMANTIC_TOP).map((p) => p.c);
  }

  const ROUTES = [
    { name: 'id', grade: GRADES.id, run: route_id },
    { name: 'label', grade: GRADES.label, run: route_label },
    { name: 'text', grade: GRADES.text, run: route_text },
    { name: 'scoped', grade: GRADES.scoped, run: route_scoped },
    // Both only exist when asked for (route memory / a model). They sit BEFORE geometry:
    // a blind positional guess is the weakest rung, and a wrong tap can change the
    // screen under the flow, so a verified answer from memory or a model goes first.
    { name: 'learned', grade: 'C', run: route_learned },
    { name: 'semantic', grade: 'C', run: route_semantic, async: true },
    { name: 'vision', grade: GRADES.vision, run: route_vision },
  ];
  const LEARNED_IX = ROUTES.findIndex((r) => r.name === 'learned');

  /**
   * Resolve one intent against a snapshot. Walks the ladder and returns the
   * first route that matches EXACTLY ONE control. That uniqueness requirement is
   * what prevents the wrong-element click that ambiguous locators cause.
   */
  function resolve(intent, cs) {
    const tried = [];
    for (let i = 0; i < ROUTES.length; i++) {
      const route = ROUTES[i];
      if (route.async || route.name === 'learned') continue;   // need a model / memory: runIntentCore only
      let hits = [];
      try {
        hits = route.run(intent, cs) || [];
      } catch (e) {
        hits = [];
      }
      if (hits.length === 1) {
        return { ok: true, routeIndex: i, route: route.name, grade: route.grade, control: hits[0], tried };
      }
      tried.push({ route: route.name, count: hits.length });
    }
    return { ok: false, tried, ambiguous: tried.some((t) => t.count > 1) };
  }

  // ===========================================================================
  // 4b. Route memory - learn which route worked and which one did not
  // ===========================================================================
  // Opt-in (memory.enabled), so the plain healed arm and its published numbers are
  // unchanged. What is remembered, per intent:
  //   route  the route that last achieved the goal: tried FIRST next time
  //   avoid  routes that resolved uniquely, were acted on and had no effect (a
  //          wrong-element hit): skipped while the screen looks the same
  //   sig    structural signature of the screen (hooks and labels, no positions or
  //          text): when it changes the UI has DRIFTED, so `avoid` is forgotten
  //          and the run count to settle starts
  // Memory only reorders and prunes. Every route still has to resolve to exactly
  // one control and the success predicate still decides, so it cannot turn a
  // failure into a success.
  const memory = { enabled: false, intents: {} };

  function sigOf(cs) {
    return hash(cs.map((c) => (c.hook || '') + '|' + (c.label || '')).sort().join('\n'));
  }

  function memoryPlan(intent, sig) {
    const order = ROUTES.map((_, i) => i);
    const rec = memory.enabled ? memory.intents[intent.id] : null;
    if (!rec) return { order, avoid: new Set(), drift: false, preferred: null };
    const drift = !!rec.sig && rec.sig !== sig;
    let preferred = null;
    if (rec.route > 0) { order.splice(order.indexOf(rec.route), 1); order.unshift(rec.route); preferred = ROUTES[rec.route].name; }
    return { order, avoid: new Set(drift ? [] : rec.avoid), drift, preferred };
  }

  function memoryRecord(intent, sig, plan, routeIndex, wasted, failedNow) {
    if (!memory.enabled) return;
    const rec = memory.intents[intent.id] || (memory.intents[intent.id] = { runs: 0, route: 0, sig, avoid: [], drifts: 0, sinceDrift: null, settledAfter: null });
    rec.runs++;
    if (plan.drift) { rec.drifts++; rec.sinceDrift = 0; rec.settledAfter = null; rec.avoid = []; }
    rec.sig = sig;
    rec.route = routeIndex;
    rec.avoid = [...new Set([...rec.avoid, ...failedNow])].filter((x) => x !== routeIndex);
    if (rec.sinceDrift !== null) {
      rec.sinceDrift++;
      if (rec.settledAfter === null && wasted === 0) rec.settledAfter = rec.sinceDrift;   // first run with no wasted action
    }
  }

  /** Acted-on attempts that did not achieve the goal. Resolution misses (a route
   *  matching 0 or 2+ controls) cost nothing, so they are not counted. */
  const wastedOf = (attempts) => attempts.filter((a) => /\((no effect|obscured|threw|offscreen)\)/.test(a)).length;

  function memoryNote(plan, skipped) {
    const bits = [];
    if (plan.drift) bits.push('drift');
    if (plan.preferred) bits.push('first:' + plan.preferred);
    if (skipped.length) bits.push('skipped:' + skipped.join('/'));
    return bits.join(' ');
  }

  // ===========================================================================
  // 5. Acting
  // ===========================================================================
  /**
   * Would a real pointer actually reach this element?
   *
   * A synthetic event dispatched straight onto the target skips hit-testing
   * entirely, so the engine would sail through an obscured control and report
   * success - immune to the exact failure it exists to detect, and the demo's
   * "obscured tap" beat would be theatre. So test what is genuinely topmost at
   * the tap point first, the way a real tap does.
   */
  function hitTest(el) {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return { ok: false, reason: 'the control has no size' };
    // The harness panel is OUR UI, not the app's - on a narrow viewport it
    // covers most of the screen, and counting it as an occluder would report
    // every control in the app as "covered by fyp-row". Hide it for the probe
    // (same synchronous block, so it never paints) and measure the app alone.
    const panel = document.getElementById(PANEL_ID);
    // Same for the harness's own toasts (flash): they sit over the bottom nav.
    const own = Array.from(document.querySelectorAll('[data-fyp-toast]')).concat(panel ? [panel] : []);
    const prevVis = own.map((n) => n.style.visibility);
    own.forEach((n) => { n.style.visibility = 'hidden'; });
    let top = null;
    try {
      top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    } finally {
      own.forEach((n, i) => { n.style.visibility = prevVis[i]; });
    }
    if (!top) return { ok: false, reason: 'it is not on screen' };
    // The tap may land on a descendant (an icon inside a button) and still
    // bubble to the handler. Anything else means the tap goes somewhere else.
    if (top === el || el.contains(top)) return { ok: true };
    const who = top.id || top.getAttribute('data-testid') || (top.className || '').toString().slice(0, 40) || top.tagName;
    return { ok: false, reason: 'something else is painted over it (' + who + ')', top };
  }

  function realClick(el, force) {
    if (!force) {
      const hit = hitTest(el);
      if (!hit.ok) {
        const e = new Error('OBSCURED:' + hit.reason);
        e.fypObscured = true;
        throw e;
      }
    }
    // A checkbox / switch must be activated EXACTLY once. Dispatching a synthetic
    // click and then calling .click() fires the handler twice, and on a toggle
    // that cancels out - measured: the switch stayed off every time.
    if (el.tagName === 'INPUT') {
      el.focus();
      el.click();
      return;
    }
    const r = el.getBoundingClientRect();
    const o = {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX: r.x + r.width / 2,
      clientY: r.y + r.height / 2,
      view: window,
    };
    try {
      el.dispatchEvent(new PointerEvent('pointerdown', Object.assign({ pointerId: 1, isPrimary: true, pointerType: 'mouse', button: 0, buttons: 1 }, o)));
    } catch (e) {}
    el.dispatchEvent(new MouseEvent('mousedown', Object.assign({ button: 0, buttons: 1 }, o)));
    try {
      el.dispatchEvent(new PointerEvent('pointerup', Object.assign({ pointerId: 1, isPrimary: true, pointerType: 'mouse', button: 0, buttons: 0 }, o)));
    } catch (e) {}
    el.dispatchEvent(new MouseEvent('mouseup', Object.assign({ button: 0, buttons: 0 }, o)));
    el.dispatchEvent(new MouseEvent('click', Object.assign({ button: 0, buttons: 0 }, o)));
    if (typeof el.click === 'function') el.click();
  }

  /**
   * Activate a control through the KEYBOARD instead of the pointer.
   *
   * A cover sitting over a control swallows pointer taps but not keyboard focus,
   * so this reaches a control the pointer cannot. It is a different input channel,
   * not a retry of the same tap - and it is what a screen-reader user does. Only
   * key events are dispatched: calling el.click() would skip the cover exactly the
   * way a synthetic click used to, and make the obscured-tap result theatre.
   */
  function keyActivate(el) {
    el.focus();
    const o = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
    el.dispatchEvent(new KeyboardEvent('keydown', o));
    el.dispatchEvent(new KeyboardEvent('keyup', o));
  }

  /** React tracks its own value, so set through the native setter. */
  function typeInto(el, value) {
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    el.focus();
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /** Scroll a control into view and confirm it is genuinely on screen. */
  async function reveal(c) {
    const r = c.el.getBoundingClientRect();
    const onScreen = r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth;
    // Inside the viewport is not the same as visible: a control pushed below the
    // fold of a nested scroll container is clipped by it. If something other than
    // an injected overlay is on top of it, scroll it into view first.
    const ht = onScreen ? hitTest(c.el) : null;
    const clipped = !!ht && !ht.ok && !!ht.top && !ht.top.closest('#' + OVERLAY_ID + ',#' + DECOY_ID);
    if (onScreen && !clipped) return { revealed: true, scrolled: false };
    if (typeof c.el.scrollIntoView === 'function') c.el.scrollIntoView({ block: 'center', inline: 'center' });
    await sleep(200);
    const r2 = c.el.getBoundingClientRect();
    const ok = r2.top < innerHeight && r2.bottom > 0 && r2.left < innerWidth && r2.right > 0;
    return { revealed: ok, scrolled: true };
  }

  // ===========================================================================
  // 6. The session log and the scoreboard
  // ===========================================================================
  const state = {
    active: true,
    log: [],
    runs: { healed: null, baseline: null },
    baseline: {}, // intent id -> one hard-coded locator, captured once
    recorded: false, // has the healthy app been walked and the recording stored?
    stop: false, // set by the Stop button; checked between intents
    current: null, // id of the intent being run right now
    busySince: 0,
    recording: false, // true while that walk runs, so it is not logged as evidence
    chaos: { active: {}, undo: [] },
    lastFatal: '',
    lastShot: null, // data URL of what the harness saw when it gave up
    runId: 0, // one per Run press, so rows can be grouped into runs
    ctx: { rep: null }, // set by the N-times experiment
    exp: { active: false, stop: false, rep: 0, n: 0, label: '' },
    survey: null, // per-screen accessibility measurement
    armLabel: null, // set by the experiment for arms that reuse runHealed (hybrid)
  };

  // Live breadcrumb: which intent / route / candidate is running. A setter, so
  // every update repaints the status bar without each call site asking.
  let progText = '';
  Object.defineProperty(state, 'prog', {
    enumerable: true,
    get: () => progText,
    set: (v) => { progText = v; if (typeof render === 'function') render(); },
  });

  const stopped = () => state.stop || state.exp.stop;

  function logRow(row) {
    // A baseline RECORDING pass is not an experiment result - it is the act of
    // writing the script. Logging it would double every row in the scoreboard.
    if (state.recording) return row;
    row.timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    if (state.armLabel && !row.arm) row.arm = state.armLabel;   // experiment arms beyond baseline / healed
    row.run = state.runId;
    row.rep = state.ctx.rep;
    row.config = Object.keys(state.chaos.active).sort().join('+') || 'clean';
    state.log.push(row);
    saveLogSoon();
    render();
    return row;
  }

  // ===========================================================================
  // 7. Running the flow
  // ===========================================================================
  let running = false;

  /** One intent, healed - marks it as the live step while it runs. */
  async function runIntent(intent, opts) {
    if (!state.recording) { state.current = intent.id; render(); }
    try {
      return await runIntentCore(intent, opts);
    } finally {
      state.current = null;
      state.prog = '';
    }
  }

  /** The ladder itself: walk the routes, act, then verify the predicate. */
  async function runIntentCore(intent, opts) {
    const t0 = now();
    const cs = await settle();
    const fp = fingerprint(cs);

    // Let the intent record its own "before" state, for change-based predicates.
    if (typeof intent.capture === 'function') intent._before = intent.capture();

    // Some goals already hold - a toggle may be on from a previous run, and
    // clicking it again would flip it the wrong way. Report the precondition
    // rather than acting.
    if (intent.alreadySatisfied && typeof intent.capture !== 'function') {
      let holds = false;
      try { holds = !!intent.success(intent); } catch (e) { holds = false; }
      if (holds) {
        return logRow({
          intent: intent.id,
          routeIndex: -1,
          route: 'precondition',
          grade: '-',
          outcome: 'success',
          detail: 'already satisfied - no action needed',
          ms: Math.round(now() - t0),
          tree: fp,
          order: opts.order,
        });
      }
    }

    if (intent.action === 'assert') {
      const ok = await waitFor(() => intent.success(intent), 1500);
      return logRow({
        intent: intent.id,
        routeIndex: -1,
        route: 'predicate',
        grade: '-',
        outcome: ok ? 'success' : 'failed-predicate',
        detail: ok ? intent.successDesc : 'caption not found in the feed',
        ms: Math.round(now() - t0),
        tree: fp,
        order: opts.order,
      });
    }

    // Walk the ladder. A route that resolves uniquely is still only a CANDIDATE:
    // it is acted on, and the success predicate decides whether it was the right
    // one. If the goal still does not hold, the next route is tried.
    //
    // This check-and-fall-through is the self-healing part. Without it, `scoped`
    // happily clicks a plausible-but-wrong control and reports victory - which is
    // exactly what it did before this loop existed.
    const attempts = [];
    let csNow = cs;
    let fpNow = fp;

    const sig = sigOf(cs);
    const plan = memoryPlan(intent, sig);
    const failedNow = new Set();   // routes acted on this time that had no effect
    const skipped = [];            // routes not tried because memory says they were wrong here
    // A semantic (model) win is DISTILLED: remembered as a 'learned' route, so the
    // next run resolves it from memory instead of asking the model again.
    const learn = (routeIndex, ctl) => {
      const viaModel = ROUTES[routeIndex].name === 'semantic' || ROUTES[routeIndex].name === 'learned';
      const distil = memory.enabled && viaModel && ctl;
      memoryRecord(intent, sig, plan, distil ? LEARNED_IX : routeIndex, wastedOf(attempts), failedNow);
      if (distil) memory.intents[intent.id].learned = descriptorOf(ctl);
    };
    const semCalls0 = semantic.calls;
    const memFields = () => ({ failedActions: wastedOf(attempts), semanticCalls: semantic.calls - semCalls0, memory: memory.enabled ? memoryNote(plan, skipped) : '' });

    for (const i of plan.order) {
      const route = ROUTES[i];
      if (plan.avoid.has(i)) { skipped.push(route.name); continue; }
      if (route.name === 'learned' && !(memory.enabled && memory.intents[intent.id] && memory.intents[intent.id].learned)) continue;
      if (route.async && !semantic.enabled) continue;
      let hits = [];
      try {
        hits = (route.async ? await route.run(intent, csNow) : route.run(intent, csNow)) || [];
      } catch (e) {
        hits = [];
      }

      // The geometry route may legitimately offer SEVERAL candidates. When every
      // hook and label is gone, the honest move is to search the neighbourhood in
      // order until the goal is met - not to commit to one blind guess. This is the
      // "screen-graph neighbourhood search" idea from the source material.
      let candidates;
      if ((route.name === 'vision' && intent.visionSweep) || route.name === 'semantic') {
        candidates = hits.slice(0, route.name === 'semantic' ? SEMANTIC_TOP : 12);
        if (!candidates.length) {
          attempts.push(route.name + '(0)');
          continue;
        }
      } else if (hits.length === 1) {
        candidates = [hits[0]];
      } else {
        attempts.push(route.name + '(' + hits.length + ')');
        continue;
      }

      const multi = candidates.length > 1;
      state.prog = intent.id + ' · ' + route.name + (multi ? ' [' + candidates.length + ']' : ' — 1 candidate');

      for (let j = 0; j < candidates.length; j++) {
        const tag = route.name + (multi ? '[' + j + ']' : '');
        const c = candidates[j];
        state.prog = intent.id + ' · ' + tag + (multi ? ' ' + (j + 1) + '/' + candidates.length : '') + ' — revealing';
        const rev = await reveal(c);
        if (!rev.revealed) {
          attempts.push(tag + '(offscreen)');
          continue;
        }

        // Hand the acted-on element to the predicate, so success is judged on what
        // was actually touched rather than on a re-lookup that may find a decoy.
        intent._acted = c.el;
        // A taught toggle can already be in the state the demonstration ended in
        // (the post is already liked). Clicking again would undo it.
        if (typeof intent.satisfiedBy === 'function' && intent.satisfiedBy(c.el)) {
          return logRow({
            intent: intent.id, routeIndex: -1, route: 'precondition', grade: '-', outcome: 'success',
            detail: 'already in the wanted state - no action needed', ms: Math.round(now() - t0), tree: fpNow, order: opts.order,
          });
        }
        // Only from a healthy app: a break can move or hide the very control whose
        // neighbourhood is being measured.
        if (i === 0 && !multi && !Object.keys(state.chaos.active).length) learnPool(intent, csNow);

        let verdict = true;
        let why = 'threw';
        try {
          if (intent.action === 'type') typeInto(c.el, intent.value);
          else realClick(c.el);
        } catch (e) {
          verdict = false;
          why = String((e && e.message) || e).indexOf('OBSCURED:') === 0 ? 'obscured' : 'threw';
        }
        if (!verdict) {
          // An obscured tap is NOT retried on the same control: the tap would
          // land in the same place, and a retry loop would hammer forever.
          attempts.push(tag + '(' + why + ')');
          // But the keyboard is a different channel: focus and Enter reach a
          // control a cover is blocking. Try it once, and let the predicate judge.
          if (why === 'obscured' && intent.action === 'click' && c.el.isConnected) {
            state.prog = intent.id + ' · ' + tag + ' - keyboard';
            keyActivate(c.el);
            await sleep(450);
            await settle(8, 120);
            if (await waitFor(() => intent.success(intent), 900)) {
              learn(i, c);
              return logRow({
                intent: intent.id,
                routeIndex: i,
                route: tag + '+keyboard',
                grade: 'B',
                outcome: 'success',
                detail: intent.successDesc + ' - the tap was blocked, so it was activated from the keyboard',
                ms: Math.round(now() - t0),
                tree: fpNow,
                order: opts.order,
                ...memFields(),
              });
            }
            attempts.push(tag + '+keyboard(no effect)');
          }
          continue;
        }

        await sleep(intent.action === 'type' ? 250 : 450);
        await settle(8, 120);
        const ok = await waitFor(() => intent.success(intent), i === 0 && !multi ? 1600 : 900);

        if (ok) {
          learn(i, c);
          return logRow({
            intent: intent.id,
            routeIndex: i,
            route: tag,
            grade: route.grade,
            outcome: 'success',
            detail:
              i === 0 && j === 0
                ? intent.successDesc
                : intent.successDesc + ' - recovered on ' + tag + ' after ' + attempts.length + ' failed attempt(s)',
            ms: Math.round(now() - t0),
            tree: fpNow,
            order: opts.order,
            ...memFields(),
          });
        }

        // The candidate resolved, the action landed without raising, and yet the
        // goal is not met: a wrong-element hit or an obscured tap. Record it and
        // move on rather than retrying the same control blindly.
        attempts.push(tag + '(no effect)');
        failedNow.add(i);
        csNow = await settle(6, 120);
        fpNow = fingerprint(csNow);
      }
    }

    return logRow({
      intent: intent.id,
      routeIndex: -1,
      route: 'none',
      grade: '-',
      outcome: 'failed-absent',
      detail: 'every route was tried and none achieved the goal: ' + attempts.join(', '),
      ms: Math.round(now() - t0),
      tree: fp,
      order: opts.order,
      ...memFields(),
    });
  }

  /** Turn a resolved control into the sort of selector a recording stores. */
  function selectorFor(c) {
    if (c.hook) return '[data-testid="' + c.hook + '"]';
    if (c.label) return '[aria-label="' + c.label + '"]';
    return c.path; // absolute position chain - the fragile kind
  }

  /**
   * Record the baseline ONCE, on a healthy app - the way a human records an RPA
   * flow: walk it step by step, store one locator per step, then never look at
   * the app again.
   *
   * Capturing the Share button's locator does not require PRESSING it, so the
   * walk stops before the publish step: recording leaves no post behind and no
   * state to clean up beyond walking home.
   *
   * This is what makes the baseline arm fair. Capturing every locator on the
   * feed - as the first version did - meant the gallery and caption steps had no
   * locator at all, and "no locator was ever captured" is a strawman an examiner
   * can tear apart. A recording taken on the healthy app is the real artifact.
   */
  async function recordBaseline() {
    if (state.recorded) return;
    state.recording = true;
    const sel = {};
    let ok = true;
    try {
      for (const intent of INTENTS) {
        if (intent.action === 'assert') continue;
        const cs = await settle();
        const res = resolve(intent, cs);
        if (res.ok) sel[intent.id] = selectorFor(res.control);
        // Capture the publish step's locator without performing it.
        if (intent.id === 'share.post') break;
        if (!res.ok) { ok = false; break; }
        const row = await runIntent(intent, { order: 0 });
        if (row.outcome !== 'success') { ok = false; break; }
      }
    } catch (e) {
      ok = false;
    }
    state.recording = false;
    state.baseline = sel;
    state.recorded = ok && !!sel['post.open'] && !!sel['share.post'];
    if (!state.recorded) {
      state.lastFatal = 'The baseline could not be recorded on the healthy app, so its arm will report "no locator was ever captured". Reload and let it record before breaking anything.';
    }
    await goHome();
    render();
  }

  async function runBaseline() {
    if (running) return;
    running = true;
    state.runId++;
    state.runs.baseline = null;
    if (!state.exp.active) state.stop = false;
    render();

    // Reset (which ensures the recording exists), then re-arm the breaks. The
    // baseline is a hard-coded locator recorded when the app was healthy - it is
    // SUPPOSED to run against a changed UI and die.
    const armed = Object.keys(state.chaos.active);
    await resetApp();
    for (const k of armed) applyBreak(k);

    const rows = [];
    let ok = 0;
    let halted = false;
    for (let i = 0; i < INTENTS.length; i++) {
      if (stopped()) { halted = true; break; }
      const intent = INTENTS[i];
      state.prog = 'baseline · ' + intent.id;
      const t0 = now();
      const sel = state.baseline[intent.id];
      let outcome = 'success';
      let detail = 'the stored locator resolved';
      let effectSeen = null;   // measurement only: did the step's goal actually hold afterwards?
      try {
        if (!sel) {
          // An assert step has no locator to record. Say that plainly rather than
          // implying the recording was incomplete - the difference is the point.
          throw new Error(
            intent.action === 'assert'
              ? 'the recording contains no assertion step - a recorded script replays clicks, it never verifies that the goal was reached'
              : 'no locator was ever captured'
          );
        }
        const el = document.querySelector(sel);
        if (!el) throw new Error('locator no longer resolves: ' + sel);
        // Any recorded-locator tool scrolls its target into view before acting
        // (Playwright and Selenium helpers both do). Without this the baseline
        // would fail on the HEALTHY app for a reason unrelated to the thesis.
        if (el.scrollIntoView) el.scrollIntoView({ block: 'center', inline: 'center' });
        await sleep(300);
        if (typeof intent.capture === 'function') intent._before = intent.capture();
        intent._acted = el;
        if (intent.action === 'type') typeInto(el, intent.value);
        else realClick(el);
        await sleep(500);
        if (intent.action !== 'assert') { try { effectSeen = !!intent.success(intent); } catch (e) { effectSeen = false; } }
      } catch (e) {
        outcome = 'failed-not-found';
        const m = String((e && e.message) || e);
        detail =
          m.indexOf('OBSCURED:') === 0
            ? 'the stored locator resolves, but the tap is covered: ' + m.slice('OBSCURED:'.length)
            : m;
      }
      if (outcome === 'success') ok++;
      rows.push(
        logRow({
          arm: 'baseline',
          intent: intent.id,
          routeIndex: 0,
          route: 'hard-coded',
          grade: 'F',
          outcome,
          effectSeen,
          detail,
          ms: Math.round(now() - t0),
          order: i + 1,
        })
      );
    }
    state.runs.baseline = { ok, total: INTENTS.length, stopped: halted };
    state.prog = '';
    running = false;
    render();
  }

  /**
   * The comparison arm for "just ask the model": the model picks a control for each
   * step, the harness acts on its FIRST choice, and that is all. No uniqueness test,
   * no fallback routes, no checking the goal and no stopping when it was not met -
   * which is how a bare LLM agent behaves. The goal predicate is evaluated AFTER the
   * action purely to measure how often that went wrong; the arm cannot see it.
   * outcome 'failed-silent' = the action ran, nothing happened, and the arm carried on.
   */
  async function runLlmOnly() {
    if (running) return;
    running = true;
    state.runId++;
    state.runs.llmOnly = null;
    if (!state.exp.active) state.stop = false;
    render();
    const armed = Object.keys(state.chaos.active);
    await resetApp();
    for (const k of armed) applyBreak(k);
    const prevEnabled = semantic.enabled;
    semantic.enabled = true;
    let ok = 0, halted = false;
    try {
      for (let i = 0; i < INTENTS.length; i++) {
        if (stopped()) { halted = true; break; }
        const intent = INTENTS[i];
        state.prog = 'llm-only · ' + intent.id;
        const t0 = now();
        const calls0 = semantic.calls;
        let outcome = 'success', detail = 'the model chose a control and it was acted on', effectSeen = null;
        try {
          if (intent.action === 'assert') {
            effectSeen = !!(await waitFor(() => intent.success(intent), 1500));
            outcome = effectSeen ? 'success' : 'failed-predicate';
            detail = effectSeen ? intent.successDesc : 'caption not found in the feed';
          } else {
            const cs = await settle();
            if (typeof intent.capture === 'function') intent._before = intent.capture();
            const first = (await askModel(intent, cs))[0];   // a bare agent has no confidence gate
            const pick = first && first.c;
            if (!pick) throw new Error('the model named no control');
            await reveal({ el: pick.el });
            intent._acted = pick.el;
            if (intent.action === 'type') typeInto(pick.el, intent.value); else realClick(pick.el);
            await sleep(500);
            await settle(8, 120);
            effectSeen = !!(await waitFor(() => intent.success(intent), 600));
            if (!effectSeen) { outcome = 'failed-silent'; detail = 'acted on the model\'s first choice; the goal did not hold and the arm did not notice'; }
          }
        } catch (e) {
          outcome = 'failed-absent';
          detail = String((e && e.message) || e);
        }
        if (outcome === 'success') ok++;
        logRow({ arm: 'llm-only', intent: intent.id, routeIndex: -1, route: 'model-first-choice', grade: 'C', outcome, effectSeen, detail, ms: Math.round(now() - t0), order: i + 1, failedActions: outcome === 'failed-silent' ? 1 : 0, semanticCalls: semantic.calls - calls0 });
      }
    } finally {
      semantic.enabled = prevEnabled;
    }
    state.runs.llmOnly = { ok, total: INTENTS.length, stopped: halted };
    state.prog = '';
    running = false;
    render();
  }

  // ---------------------------------------------------------------------------
  // The screenshot attached to an honest failure.
  //
  // When the harness cannot go on, "I could not find it" is not enough for the
  // person (or the assistant above this layer) to act on. A picture of what the
  // harness was looking at is. html2canvas is vendored and loaded lazily from the
  // same origin, so this works offline; if it is missing the report simply has no
  // picture rather than failing.
  // ---------------------------------------------------------------------------
  let shotLib = null;
  function loadShotLib() {
    if (window.html2canvas) return Promise.resolve(true);
    if (!shotLib) {
      shotLib = new Promise((res) => {
        const sc = document.createElement('script');
        sc.src = '/fyp-html2canvas.min.js';
        sc.onload = () => res(!!window.html2canvas);
        sc.onerror = () => res(false);
        document.head.appendChild(sc);
      });
    }
    return shotLib;
  }

  async function captureShot() {
    try {
      if (!(await loadShotLib())) return null;
      const canvas = await window.html2canvas(document.body, {
        ignoreElements: (el) => el.id === PANEL_ID || (el.hasAttribute && el.hasAttribute('data-fyp-toast')),
        scale: 0.6,
        width: innerWidth,
        height: innerHeight,
        x: window.scrollX,
        y: window.scrollY,
        backgroundColor: '#000000',
        logging: false,
      });
      return canvas.toDataURL('image/jpeg', 0.7);
    } catch (e) {
      return null;
    }
  }

  /**
   * Turn a failed step into the sentence the assistant should say out loud.
   *
   * This is the whole accessibility argument in one line of text: the assistant
   * names the step it is stuck on, says WHY in human terms, and hands the step
   * back to the person instead of silently retrying. Never a stack trace.
   */
  function honestFailure(intent, row) {
    const d = row.detail || '';
    let why;
    if (/\(obscured\)/.test(d)) {
      why = /keyboard\(no effect\)/.test(d)
        ? 'something is covering the control, so my taps land somewhere else, and activating it from the keyboard did nothing either. I am not going to keep trying blind'
        : 'something is covering the control, so my tap keeps landing somewhere else. I am not going to keep tapping blind';
    } else if (row.outcome === 'failed-absent') {
      why = 'I cannot identify a control for this step - there is no name I can read and no locator I can pin down';
    } else {
      why = 'acting on it did not reach the goal';
    }
    return 'I could not finish the step "' + intent.desc + '" - ' + why + '. You may need to do this step yourself. [' + d + ']';
  }

  async function runHealed() {
    if (running) return;
    running = true;
    state.runId++;
    state.runs.healed = null;
    state.lastFatal = '';
    state.lastShot = null;
    if (!state.exp.active) state.stop = false;
    render();

    // Order matters. Reset needs intact hooks to navigate home, and the run must
    // then face the broken UI - otherwise there would be nothing to heal and the
    // harness would look impressive for no reason.
    const armed = Object.keys(state.chaos.active);
    await resetApp();
    for (const k of armed) applyBreak(k);

    let ok = 0;
    let halted = false;
    for (let i = 0; i < INTENTS.length; i++) {
      if (stopped()) { halted = true; break; }
      const row = await runIntent(INTENTS[i], { order: i + 1 });
      if (row.outcome === 'success') { ok++; announce('Step ' + (i + 1) + ' of ' + INTENTS.length + ' done: ' + INTENTS[i].desc + '.'); }
      else if (row.outcome !== 'failed-predicate') {
        // A hard stop means the flow cannot continue; say why, in words.
        state.lastFatal = honestFailure(INTENTS[i], row);
        announce(state.lastFatal);
        state.lastShot = null;
        render();
        state.lastShot = await captureShot();
        render();
        break;
      }
    }
    state.runs.healed = { ok, total: INTENTS.length, stopped: halted };
    if (ok === INTENTS.length) announce('Finished. All ' + INTENTS.length + ' steps are done and the post is in the feed.');
    running = false;
    render();
  }

  /** Run just the next intent whose success predicate does not yet hold. */
  async function stepOnce() {
    if (running) return;
    const pending = INTENTS.find((it) => {
      try { return !it.success(it); } catch (e) { return true; }
    });
    if (!pending) { flash('Every intent already holds. Reset the app to run again.'); return; }
    await runIntent(pending, { order: state.log.filter((r) => r.arm !== 'baseline').length + 1 });
  }

  /** Walk the app back to the feed. Hooks must be intact for this to work. */
  async function goHome() {
    // Turn the AI-label switch back off so every run (rehearsal or the real
    // thing) starts from the same state and actually performs the toggle.
    const sw = document.querySelector('input[role="switch"][aria-label="Add AI label"]');
    if (sw && sw.checked) {
      sw.click();
      await sleep(250);
    }
    for (let i = 0; i < 8; i++) {
      const s = detectScreen();
      if (s === 1) break;
      const cs = collect();
      let target = null;
      if (s === 4) target = cs.find((c) => c.hook === 'options-back');
      else if (s === 3) target = cs.find((c) => c.hook === 'compose-back') || cs.find((c) => c.hook === 'compose-close');
      else if (s === 2) target = cs.find((c) => c.hook === 'compose-close');
      if (!target) break;
      // Walking home is bookkeeping, not evidence: if a stray overlay blocks the
      // back button, force it rather than leaving the app stranded mid-flow,
      // which would poison every run that follows.
      try { realClick(target.el); } catch (e) { try { realClick(target.el, true); } catch (e2) { break; } }
      await sleep(400);
    }
    // Comments / DMs open as full-screen modals with no nav bar and read as the
    // "feed" screen. A stray tap can open one, after which every control the run
    // needs is absent. Back out through the header's left-most control.
    for (let i = 0; i < 3 && detectScreen() === 1; i++) {
      const cs = collect();
      if (cs.some((c) => c.hook === 'tab-home' || (c.label || '').toLowerCase() === 'home')) break;
      const back = cs.filter((c) => inRegion(c, 'header')).sort((a, b) => a.box.cx - b.box.cx)[0];
      if (!back) break;
      state.modalEscapes = (state.modalEscapes || 0) + 1;
      back.el.click();
      await sleep(400);
    }
    // "Feed screen" is not the same as "Home tab": a stray geometry tap in a
    // previous run can leave the app on Search/Reels/Profile, where the
    // published post is not visible and every run starts from the wrong place.
    if (detectScreen() === 1) {
      const home = collect().find((c) => c.hook === 'tab-home' || (c.label || '').toLowerCase() === 'home');
      if (home) {
        // Plain click: bookkeeping, not evidence. The synthetic pointer sequence
        // in realClick did not switch tabs from Search.
        home.el.click();
        await sleep(500);
      }
    }
    await settle(8, 120);
  }

  /** Put the app back on the feed, restoring hooks first so reset can work. */
  /** Credentials handed in by the agent runner (from its vault). Held only in this
   *  closure: never on window, never in the DOM after login, never in a log row. */
  let sessionCred = null;
  let loginWhy = '';

  /** If the login screen is up, sign in. Credentials come from the runner's vault
   *  (agent.login) or, for a hand-run build, window.FYP_LOGIN. Success is the
   *  next screen (the tab bar), never "the click did not throw". No-op when
   *  already signed in. Sets loginWhy to a user-facing reason on failure. */
  async function ensureLoggedIn(supplied) {
    if (supplied && supplied.email && supplied.password) sessionCred = { email: supplied.email, password: supplied.password };
    loginWhy = '';
    const user = document.querySelector('input[placeholder^="Phone number"]');
    const pass = document.querySelector('input[placeholder="Password"]');
    if (!user || !pass) return true;
    const cred = sessionCred || window.FYP_LOGIN;
    if (!cred || !cred.email || !cred.password) {
      loginWhy = 'The app is asking for a login and I have no credentials. Store them with "fyp.mjs vault set" and run again with --login.';
      flash('Login screen: no credentials supplied.'); return false;
    }
    const wipe = () => { try { typeInto(user, ''); typeInto(pass, ''); } catch (e) { /* page may have moved on */ } };
    typeInto(user, cred.email);
    typeInto(pass, cred.password);
    await sleep(250);
    const btn = [...document.querySelectorAll('[tabindex],button,[role=button]')].find((e) => /^log in$/i.test((e.textContent || '').trim()));
    if (!btn) { wipe(); loginWhy = 'I could not find the Log in button, so I did not sign in. You may need to log in yourself.'; flash('Could not find the Log in button.'); return false; }
    btn.click();
    for (let i = 0; i < 60; i++) {           // up to ~15s for Firebase to answer
      await sleep(250);
      if (document.querySelector('[data-testid="tab-home"]')) { await settle(8, 120); return true; }
    }
    wipe();                                  // a failed attempt must not leave the account on screen
    loginWhy = 'I tried to sign in but the app stayed on the login screen. The stored login may be wrong or the account disabled. Check it, then re-run "fyp.mjs vault set".';
    flash('Login did not complete.');
    return false;
  }

  /** Agent entry: sign in with credentials supplied by the runner. Never echoes them. */
  async function agentLogin(cred) {
    const onLogin = !!document.querySelector('input[placeholder="Password"]');
    const ok = await ensureLoggedIn(cred);
    return ok
      ? { ok: true, alreadySignedIn: !onLogin, screen: detectScreen() }
      : { ok: false, needsUser: true, error: 'login-failed', userMessage: loginWhy };
  }

  async function resetApp() {
    if (!(await ensureLoggedIn())) return;
    clearChaos();
    await goHome();
    // The app is whole again - this is the honest moment to hold the baseline's
    // recording. It only ever runs against an intact app.
    if (!state.recorded) await recordBaseline();
    render();
  }

  // ===========================================================================
  // 8. Chaos - the seven breaks, each mapping to a failure class
  // ===========================================================================
  // B9: a control's own words are replaced by synonyms (a copy rewrite / reskin). The
  // meaning is the same, no word is shared, so label/text routes cannot match.
  const COPY_REWRITE = {
    'next': 'Continue', 'share': 'Publish', 'more options': 'Advanced settings', 'back': 'Return',
    'add ai label': 'Mark as AI-made', 'create post': 'Start something', 'new post': 'Start something',
    'create': 'Start something', 'add a caption': 'Write something', 'caption': 'Write something',
    'gallery photo': 'picture',
  };
  const rotCopy = new Map();   // node/element -> [kind, original]

  function controlAtScreenNext() {
    const s = detectScreen();
    const cs = collect();
    // Hook first, then a hook-free fallback: B1 renames every hook, and a break
    // that cannot find its target would silently do nothing.
    // B9 rewrites button copy, so look for the reworded text as well as the original.
    const byText = (t, region) => cs.find((c) => [t, COPY_REWRITE[t] && COPY_REWRITE[t].toLowerCase()].includes(c.text.toLowerCase()) && inRegion(c, region));
    if (s === 1) return cs.find((c) => c.hook === 'tab-create') || cs.filter((c) => inRegion(c, 'bottom-nav')).sort((a, b) => a.box.cx - b.box.cx)[2];
    if (s === 2) return cs.find((c) => c.hook === 'compose-next') || byText('next', 'header-right');
    if (s === 3) return cs.find((c) => c.hook === 'share-button') || byText('share', 'sticky-bottom');
    if (s === 4) return cs.find((c) => c.hook === 'options-back');
    return null;
  }

  const chaosLayer = (id, z) => {
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('div');
      el.id = id;
      el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:' + z + ';';
      document.body.appendChild(el);
    }
    return el;
  };

  // Originals for the persistent breaks, so restore works even for elements that
  // only existed *after* the break was applied (i.e. controls on later screens).
  const rotHooks = new Map();
  const rotLabels = new Map();
  const rotLayout = new Map();

  const BREAKS = {
    'B1': {
      label: 'B1 · rename every hook',
      note: "Locator rot - the briefing's core failure. Kills route 'id'.",
      persistent: true,
      apply() {
        for (const el of document.querySelectorAll('[data-testid]')) {
          const cur = el.getAttribute('data-testid');
          if (!rotHooks.has(el)) rotHooks.set(el, cur);
          if (cur.indexOf('rot-') !== 0) el.setAttribute('data-testid', 'rot-' + Math.random().toString(36).slice(2, 8));
        }
        return () => {
          for (const [el, v] of rotHooks) { try { el.setAttribute('data-testid', v); } catch (e) {} }
          rotHooks.clear();
        };
      },
    },
    'B2': {
      label: 'B2 · strip accessible labels',
      note: 'Anonymous surface (S1). Kills the label route - the accessible name is gone.',
      persistent: true,
      apply() {
        for (const el of document.querySelectorAll('[aria-label]')) {
          if (!rotLabels.has(el)) rotLabels.set(el, el.getAttribute('aria-label'));
          el.removeAttribute('aria-label');
        }
        return () => {
          for (const [el, v] of rotLabels) { try { el.setAttribute('aria-label', v); } catch (e) {} }
          rotLabels.clear();
        };
      },
    },
    'B3': {
      label: 'B3 · reverse the layout',
      note: 'Visual order changes without touching the DOM. Kills the geometry/ordinal route.',
      persistent: true,
      apply() {
        const cs = collect();
        const groups = [
          cs.filter((c) => inRegion(c, 'bottom-nav')),
          cs.filter((c) => inRegion(c, 'gallery-grid')),
        ];
        let touched = 0;
        for (const g of groups) {
          if (g.length < 2) continue;
          // Permute the ITEMS with `order`, never the container. Setting
          // flex-direction:row-reverse on react-native-web's grid container
          // collapses it to width:0 and throws the whole grid off-screen
          // (measured: every cell moved to x=-296, so nothing could resolve or
          // even be clicked - that is a crash, not a reorder). `order` is a pure
          // visual permutation: boxes keep their size and stay on screen, and
          // only the visual sequence changes - which is exactly what this break
          // claims to do, and what makes an ordinal locator pick the wrong one.
          g.forEach((c, i) => {
            const el = c.el;
            if (!rotLayout.has(el)) rotLayout.set(el, el.style.order || '');
            el.style.order = String(g.length - i);
            touched++;
          });
        }
        if (!touched) return null;
        return () => {
          for (const [el, prev] of rotLayout) {
            try { el.style.order = prev; } catch (e) {}
          }
          rotLayout.clear();
        };
      },
    },
    'B4': {
      label: 'B4 · duplicate the next control',
      note: 'Shared hook (S2). Makes a bare locator ambiguous - only the scoped chain survives. Follows you to each screen.',
      perScreen: true,
      apply() {
        const c = controlAtScreenNext();
        if (!c) return null;
        const layer = chaosLayer(DECOY_ID, 9990);
        const clone = c.el.cloneNode(true);
        // The clone keeps its tabindex so it IS harvested as a real control -
        // that is the whole point: a lookalike that makes a bare locator match
        // twice. pointer-events:none stops it swallowing genuine clicks, and the
        // small offset keeps the geometry route deterministic (it still sorts to
        // the original), so only the semantic routes are actually confused.
        clone.style.cssText =
          'position:fixed;left:' + (c.box.x + 8) + 'px;top:' + c.box.y + 'px;width:' + c.box.w +
          'px;height:' + c.box.h + 'px;opacity:0.999;pointer-events:none;';
        layer.appendChild(clone);
        return () => { layer.innerHTML = ''; };
      },
    },
    'B5': {
      label: 'B5 · nest the control in a scroller',
      note: 'The target ends up inside a new scroll container, below its fold. The harness must scroll the deepest container to reveal it, then act. Follows you to each screen.',
      perScreen: true,
      apply() {
        const c = controlAtScreenNext();
        if (!c || !c.el.parentElement) return null;
        const el = c.el;
        const p = el.parentElement;
        const h = p.getBoundingClientRect().height;
        const saved = { p: p.getAttribute('style'), e: el.getAttribute('style') };
        p.style.overflowY = 'auto';
        p.style.height = h + 'px';
        p.style.maxHeight = h + 'px';
        el.style.marginTop = h + 60 + 'px';
        return () => {
          p.scrollTop = 0;
          if (saved.p == null) p.removeAttribute('style'); else p.setAttribute('style', saved.p);
          if (saved.e == null) el.removeAttribute('style'); else el.setAttribute('style', saved.e);
        };
      },
    },
    'B6': {
      label: 'B6 · swap for a bare icon',
      note: 'No id, no label, no readable text (S1): the control stays visible and tappable but names nothing. Only geometry can find it. Follows you to each screen.',
      perScreen: true,
      apply() {
        const c = controlAtScreenNext();
        if (!c) return null;
        const el = c.el;
        const saved = { hook: el.getAttribute('data-testid'), label: el.getAttribute('aria-label'), texts: [] };
        el.removeAttribute('data-testid');
        el.removeAttribute('aria-label');
        // Replace any visible word with a glyph, so it reads as an icon.
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        let n;
        while ((n = walker.nextNode())) {
          if (!strip(n.nodeValue)) continue;
          saved.texts.push([n, n.nodeValue]);
          n.nodeValue = '\u203A';
        }
        return () => {
          if (saved.hook != null) el.setAttribute('data-testid', saved.hook);
          if (saved.label != null) el.setAttribute('aria-label', saved.label);
          saved.texts.forEach(([t, v]) => { try { t.nodeValue = v; } catch (e) {} });
        };
      },
    },
    'B7': {
      label: 'B7 · obscure the tap',
      note: 'Obscured-touch filtering (S6). The click lands, nothing happens, and a retry loop would hammer forever. Follows you to each screen.',
      perScreen: true,
      apply() {
        const c = controlAtScreenNext();
        if (!c) return null;
        const layer = chaosLayer(OVERLAY_ID, 9995);
        const cover = document.createElement('div');
        cover.style.cssText =
          'position:fixed;left:' + c.box.x + 'px;top:' + c.box.y + 'px;width:' + c.box.w + 'px;height:' + c.box.h +
          'px;pointer-events:auto;background:rgba(255,80,80,0.16);outline:1px solid rgba(255,80,80,0.5);';
        layer.style.pointerEvents = 'none';
        layer.appendChild(cover);
        return () => { layer.innerHTML = ''; };
      },
    },
    'B9': {
      label: 'B9 · reword every control',
      note: 'Copy rewrite / reskin: every control keeps its meaning but loses its words (Next -> Continue, Share -> Publish). Label and text routes cannot match; only something that understands meaning can. Alone, the id route still heals it - combine with B1.',
      persistent: true,
      apply() {
        const swap = (s) => {
          const k = strip(s).toLowerCase();
          return COPY_REWRITE[k] !== undefined ? COPY_REWRITE[k] : null;
        };
        for (const c of collect()) {
          const el = c.el;
          for (const attr of ['aria-label', 'placeholder']) {
            const v = el.getAttribute(attr);
            const to = v && swap(v);
            if (to) { rotCopy.set(el, [...(rotCopy.get(el) || []), ['attr', attr, v]]); el.setAttribute(attr, to); }
          }
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          let n;
          while ((n = walker.nextNode())) {
            const to = swap(n.nodeValue || '');
            if (to) { rotCopy.set(n, [['text', null, n.nodeValue]]); n.nodeValue = to; }
          }
        }
        return () => {
          for (const [node, list] of rotCopy) {
            for (const [kind, attr, v] of list) { try { if (kind === 'attr') node.setAttribute(attr, v); else node.nodeValue = v; } catch (e) {} }
          }
          rotCopy.clear();
        };
      },
    },
    'B10': {
      label: 'B10 · relocate the control',
      note: 'The control keeps working but moves out of its region (a redesign). Geometry priors and ordinals now point at a neighbour. Follows you to each screen.',
      perScreen: true,
      apply() {
        const c = controlAtScreenNext();
        if (!c) return null;
        const el = c.el;
        const saved = el.getAttribute('style');
        el.style.position = 'fixed';
        el.style.left = '6%';
        el.style.top = '36%';
        el.style.width = c.box.w + 'px';
        el.style.height = c.box.h + 'px';
        el.style.zIndex = '9000';
        // A fixed child still paints inside its ancestors' stacking contexts, so a lower-z
        // header would leave it under the screen's other content (measured: the tap was
        // covered). Lift those ancestors for the break, and put them back on undo.
        const lifted = [];
        for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
          const cs = getComputedStyle(a);
          if (cs.position !== 'static' || cs.zIndex !== 'auto') { lifted.push([a, a.style.zIndex]); a.style.zIndex = '9000'; }
        }
        return () => {
          lifted.forEach(([a, z]) => { a.style.zIndex = z; });
          if (saved == null) el.removeAttribute('style'); else el.setAttribute('style', saved);
        };
      },
    },
    'B8': {
      label: 'B8 · exclude the control (S3)',
      note: 'Excluded from the tree and from the screen: no hook, no label, no pixels, no focus. Nothing can reach it - this is the honest-failure beat.',
      perScreen: true,
      apply() {
        const c = controlAtScreenNext();
        if (!c) return null;
        const el = c.el;
        const prev = { v: el.style.visibility, a: el.getAttribute('aria-hidden') };
        el.style.visibility = 'hidden';
        el.setAttribute('aria-hidden', 'true');
        return () => {
          el.style.visibility = prev.v;
          if (prev.a == null) el.removeAttribute('aria-hidden'); else el.setAttribute('aria-hidden', prev.a);
        };
      },
    },
  };

  // Breaks flagged perScreen target the control that matters on the CURRENT
  // screen ("Next" on the gallery, "Share" on the caption step). They are re-aimed
  // whenever the screen changes, so arming one on the feed still breaks the later
  // steps instead of only the first.
  const screenEntries = {};

  function applyBreak(key) {
    if (state.chaos.active[key]) return;
    const B = BREAKS[key];
    const undo = B.apply();
    if (B.perScreen) {
      screenEntries[key] = { screen: detectScreen(), undo };
      state.chaos.undo.push(() => {
        const e = screenEntries[key];
        if (e && e.undo) { try { e.undo(); } catch (x) {} }
        delete screenEntries[key];
      });
      state.chaos.active[key] = true;
      if (!undo) flash(key + ' is armed - nothing on this screen to break yet; it will hit the next screen.');
      startObserver();
      render();
      return;
    }
    if (!undo) {
      flash('Nothing on this screen for ' + key + ' to break. Navigate first.');
      return;
    }
    state.chaos.undo.push(undo);
    state.chaos.active[key] = true;
    startObserver();
    render();
  }

  // ---------------------------------------------------------------------------
  // Persistence.
  //
  // The global breaks (B1-B3) must survive navigation: without this, reaching a
  // new screen re-introduces pristine hooks and the harness would appear to heal
  // itself when it had simply been handed back a working locator. Watching for
  // childList mutations re-applies them to each new screen.
  //
  // Only childList is observed, never attributes - otherwise renaming a hook would
  // itself retrigger the observer, forever.
  // ---------------------------------------------------------------------------
  let observer = null;
  let obsTimer = null;

  function reapplyPersistent() {
    for (const k of Object.keys(state.chaos.active)) {
      if (BREAKS[k] && BREAKS[k].persistent) {
        try { BREAKS[k].apply(); } catch (e) {}
      } else if (BREAKS[k] && BREAKS[k].perScreen && screenEntries[k]) {
        const e = screenEntries[k];
        const s = detectScreen();
        if (e.screen !== s) {
          try { if (e.undo) e.undo(); } catch (x) {}
          e.screen = s;
          try { e.undo = BREAKS[k].apply(); } catch (x) { e.undo = null; }
        }
      }
    }
  }

  function startObserver() {
    if (observer || !document.body) return;
    observer = new MutationObserver(() => {
      if (!Object.keys(state.chaos.active).length) return;
      clearTimeout(obsTimer);
      obsTimer = setTimeout(reapplyPersistent, 70);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function clearChaos() {
    clearTimeout(obsTimer);
    while (state.chaos.undo.length) {
      const fn = state.chaos.undo.pop();
      try { fn(); } catch (e) {}
    }
    state.chaos.active = {};
    [DECOY_ID, OVERLAY_ID].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '';
    });
    render();
  }

  // ===========================================================================
  // 9. The accessibility measurement - the headline number
  // ===========================================================================
  function measureAccessibility() {
    const cs = collect();
    const unnamed = cs.filter((c) => !c.label && !c.text);
    const notButton = cs.filter((c) => c.role !== 'button' && c.tag !== 'button');
    return {
      total: cs.length,
      unnamed: unnamed.length,
      pct: cs.length ? Math.round((100 * unnamed.length) / cs.length) : 0,
      notButton: notButton.length,
      notButtonPct: cs.length ? Math.round((100 * notButton.length) / cs.length) : 0,
      // Exclude the harness's own panel - its buttons must not flatter the count.
      unnamedRole: Array.from(document.querySelectorAll('[role="button"], button')).filter(
        (e) => !e.closest('#' + PANEL_ID)
      ).length,
    };
  }

  // ===========================================================================
  // 10. The panel
  // ===========================================================================
  let panelEl = null;
  let measure = null;


  // ===========================================================================
  // 9b. Per-screen accessibility survey
  //
  // The headline number is the share of controls on a screen that expose no
  // accessible name, so measure every screen of the flow, not only whichever one
  // happens to be showing. Only controls actually ON SCREEN count: the feed grows
  // by a post per run, and counting its off-screen buttons would make the figure
  // drift with how often the harness has been run.
  // ===========================================================================
  async function surveyScreens() {
    if (running) return;
    running = true;
    const out = [];
    try {
      await resetApp(); // also clears any break: the survey is of the healthy app
      const snap = (name) => {
        const cs = collect().filter((c) => c.box.cx >= 0 && c.box.cy >= 0 && c.box.cx <= innerWidth && c.box.cy <= innerHeight);
        const un = cs.filter((c) => !c.label && !c.text);
        const nb = cs.filter((c) => c.role !== 'button' && c.tag !== 'button');
        out.push({ screen: name, total: cs.length, unnamed: un.length, notButton: nb.length });
      };
      const hit = async (hook) => {
        const c = collect().find((x) => x.hook === hook);
        if (!c) return false;
        c.el.click(); // bookkeeping, not evidence - never creates a post
        await sleep(700);
        await settle(8, 120);
        return true;
      };
      await settle();
      snap('feed');
      if (await hit('tab-create')) {
        snap('gallery');
        if (await hit('compose-next')) {
          snap('caption');
          if (await hit('more-options')) snap('more options');
        }
      }
    } finally {
      await goHome();
      running = false;
    }
    state.survey = out;
    measure = measureAccessibility();
    render();
  }


  // ===========================================================================
  // 9c. Results: summary table, CSV export, and the N-times experiment
  // ===========================================================================
  const CSV_COLS = ['timestamp', 'arm', 'config', 'rep', 'run', 'order', 'intent_id', 'route_index', 'route_name', 'grade', 'outcome', 'diagnosis', 'outcome_detail', 'ms_elapsed', 'tree_hash', 'failed_actions', 'memory', 'semantic_calls', 'effect_seen'];

  /**
   * A "wrong action" is an action that ran and did not achieve the step's goal.
   * `silent` ones are the dangerous kind: the arm did not notice and carried on
   * (the model-only arm, and the recorded-locator baseline whose click landed on
   * something else). A healed arm's wrong actions are caught by the predicate and
   * recovered from, so they cost time but never end up as a false success.
   */
  const wrongOf = (r) => {
    if (r.outcome === 'failed-silent') return { wrong: 1, silent: 1 };
    if (r.arm === 'baseline') return r.outcome === 'success' && r.effectSeen === false ? { wrong: 1, silent: 1 } : { wrong: 0, silent: 0 };
    return { wrong: r.failedActions || 0, silent: 0 };
  };

  /** The suppression class a failure points at (plan section 6.3). */
  function diagnosis(r) {
    const d = r.detail || '';
    if (r.outcome === 'success') return '';
    if (/\(obscured\)/.test(d)) return 'S6 obscured';
    if (/\(([2-9]|\d{2,})\)/.test(d)) return 'S2 shared hook (ambiguous)';
    if (r.outcome === 'failed-absent') return 'S1/S3 no route reaches it';
    if (r.outcome === 'failed-predicate') return 'predicate false';
    if (r.outcome === 'failed-not-found') return 'recorded locator gone';
    return r.outcome;
  }

  const csvCell = (v) => {
    const t = v == null ? '' : String(v);
    return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
  };

  function logCsv() {
    const lines = [CSV_COLS.join(',')];
    for (const r of state.log) {
      lines.push([
        r.timestamp, r.arm || 'healed', r.config, r.rep == null ? '' : r.rep, r.run, r.order,
        r.intent, r.routeIndex, r.route, r.grade, r.outcome, diagnosis(r), r.detail, r.ms, r.tree,
        r.failedActions == null ? '' : r.failedActions, r.memory || '',
        r.semanticCalls == null ? '' : r.semanticCalls, r.effectSeen == null ? '' : r.effectSeen,
      ].map(csvCell).join(','));
    }
    return lines.join('\n');
  }

  /** One row per configuration and arm: how many steps, how many full flows. */
  function summarise() {
    const total = INTENTS.length;
    // "Flow completed" = every ACTION step succeeded. The assert step is left out
    // of that test for both arms: a recorded script has no assertion step at all,
    // so counting it would mark the baseline 0% on the healthy app - a strawman.
    // The healed arm still verifies the goal; that difference is reported as steps.
    const actionIds = INTENTS.filter((i) => i.action !== 'assert').map((i) => i.id);
    const runs = {};
    for (const r of state.log) {
      const arm = r.arm || 'healed';
      const key = (r.config || 'clean') + '|' + arm + '|' + r.run;
      const e = (runs[key] = runs[key] || { config: r.config || 'clean', arm, ok: 0, actionsOk: 0, wrong: 0, silent: 0, sem: 0, ms: 0 });
      const w = wrongOf(r);
      e.wrong += w.wrong; e.silent += w.silent; e.sem += r.semanticCalls || 0; e.ms += r.ms || 0;
      if (r.outcome === 'success') {
        e.ok++;
        if (actionIds.indexOf(r.intent) >= 0) e.actionsOk++;
      }
    }
    const agg = {};
    for (const e of Object.values(runs)) {
      const k = e.config + '|' + e.arm;
      const a = (agg[k] = agg[k] || { config: e.config, arm: e.arm, runs: 0, steps: 0, full: 0, total, wrong: 0, silent: 0, semanticCalls: 0, ms: 0 });
      a.runs++;
      a.steps += e.ok;
      a.wrong += e.wrong; a.silent += e.silent; a.semanticCalls += e.sem; a.ms += e.ms;
      if (e.actionsOk === actionIds.length) a.full++;
    }
    return Object.values(agg).sort((x, y) => (x.config === y.config ? (x.arm < y.arm ? -1 : 1) : x.config.length - y.config.length || (x.config < y.config ? -1 : 1)));
  }

  function summaryCsv() {
    const lines = ['config,arm,runs,mean_steps_ok,steps_total,flow_completed_runs,flow_completed_pct,wrong_actions_per_run,silent_wrong_per_run,semantic_calls_per_run,mean_ms_per_run'];
    for (const a of summarise()) {
      lines.push([a.config, a.arm, a.runs, (a.steps / a.runs).toFixed(2), a.total, a.full, Math.round((100 * a.full) / a.runs),
        (a.wrong / a.runs).toFixed(2), (a.silent / a.runs).toFixed(2), (a.semanticCalls / a.runs).toFixed(2), Math.round(a.ms / a.runs)].map(csvCell).join(','));
    }
    return lines.join('\n');
  }

  function download(name, text, mime) {
    const url = URL.createObjectURL(new Blob([text], { type: (mime || 'text/csv') + ';charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }


  const PRESETS = {
    full: [[], ['B1'], ['B2'], ['B3'], ['B4'], ['B5'], ['B6'], ['B7'], ['B8'], ['B1', 'B2', 'B3', 'B4'], ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7'], ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8']],
    demo: [[], ['B1'], ['B4'], ['B6'], ['B7'], ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8']],
    // Drift the rules cannot read: the words change (B9), the ids rot (B1), the layout moves (B10).
    semantic: [[], ['B9'], ['B1', 'B9'], ['B1', 'B9', 'B10'], ['B1', 'B2', 'B9', 'B10']],
  };

  /** Arms an experiment can run. baseline/healed are the originals; the rest need a model. */
  const ARM_RUNNERS = {
    'baseline': { run: () => runBaseline(), semantic: false },
    'healed': { run: () => runHealed(), semantic: false },
    'llm-only': { run: () => runLlmOnly(), semantic: true },
    'hybrid': { run: () => runHealed(), semantic: true, label: 'hybrid' },
  };

  /** Both arms, N times, over a set of break configurations. */
  async function runExperiment(n, which, arms) {
    if (running || state.exp.active) return;
    const presets = PRESETS[which] || PRESETS.demo;
    const armList = (arms && arms.length ? arms : ['baseline', 'healed']).filter((a) => ARM_RUNNERS[a]);
    state.exp = { active: true, stop: false, rep: 0, n, label: '' };
    try {
      for (let r = 1; r <= n && !state.exp.stop; r++) {
        state.exp.rep = r;
        state.ctx.rep = r;
        for (const preset of presets) {
          if (state.exp.stop) break;
          state.exp.label = (preset.join('+') || 'clean') + ' &middot; ' + armList.join(' then ');
          render();
          await resetApp();
          preset.forEach((k) => applyBreak(k));
          for (const a of armList) {
            const A = ARM_RUNNERS[a];
            const prev = semantic.enabled;
            semantic.enabled = A.semantic;
            state.armLabel = A.label || null;
            try { await A.run(); } finally { semantic.enabled = prev; state.armLabel = null; }
          }
        }
      }
    } finally {
      state.armLabel = null;
      state.ctx.rep = null;
      state.exp.active = false;
      state.exp.stop = false;
      state.stop = false;
      clearChaos();
      await resetApp();
      render();
    }
  }




  // ---------------------------------------------------------------------------
  // Panel helpers
  // ---------------------------------------------------------------------------
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const PREF_KEY = '__fyp_harness_prefs';
  const LOG_KEY = '__fyp_harness_log';

  function loadJson(k) {
    try { return JSON.parse(localStorage.getItem(k)) || {}; } catch (e) { return {}; }
  }
  function saveJson(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
  }

  const prefs = Object.assign({ tab: 'run', dock: 'right', min: false, x: null, y: null, failOnly: false }, loadJson(PREF_KEY));
  const savePrefs = () => saveJson(PREF_KEY, prefs);

  // The attempt log survives a reload: an N-times experiment is worth keeping
  // even if the page is refreshed halfway through reading it.
  (function restoreLog() {
    const saved = loadJson(LOG_KEY);
    if (Array.isArray(saved.log)) {
      state.log = saved.log;
      state.runId = saved.runId || 0;
      for (const r of state.log) if (r.arm !== 'baseline') state.runId = Math.max(state.runId, r.run || 0);
    }
  })();

  let saveTimer = null;
  function saveLogSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveJson(LOG_KEY, { runId: state.runId, log: state.log.slice(-800) }), 400);
  }

  const openRows = new Set();
  const GRADE_CLASS = { A: 'ga', 'A-B': 'gab', B: 'gb', D: 'gd', F: 'gf' };

  const fmtMs = (ms) => (ms >= 1000 ? (ms / 1000).toFixed(1) + 's' : ms + 'ms');
  const fmtClock = (ms) => {
    const s = Math.floor(ms / 1000);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  };

  /** Say it to a screen reader: a visually hidden polite live region. An assistant
   *  for people who may not see the screen has to narrate, not only paint. */
  function announce(msg) {
    if (!document.body) return;
    let r = document.getElementById('__fyp-live');
    if (!r) {
      r = document.createElement('div');
      r.id = '__fyp-live';
      r.setAttribute('role', 'status');
      r.setAttribute('aria-live', 'polite');
      r.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;';
      document.body.appendChild(r);
    }
    r.textContent = '';
    setTimeout(() => { r.textContent = String(msg); }, 30);   // a change, not a repeat, so it is read out
  }

  function flash(msg, kind) {
    const t = document.createElement('div');
    t.textContent = msg;
    t.setAttribute('data-fyp-toast', '1');
    const accent = kind === 'bad' ? '#ff6b6b' : kind === 'ok' ? '#3ddc97' : '#6d8bff';
    t.style.cssText =
      'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:100001;max-width:min(92vw,420px);' +
      'background:#15171c;color:#e7e9ee;border:1px solid ' + accent + ';border-radius:10px;' +
      'padding:10px 14px;font:13px/1.4 system-ui,-apple-system,Segoe UI,sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.5);pointer-events:none;';
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  // ---------------------------------------------------------------------------
  // Dynamic fragments
  // ---------------------------------------------------------------------------
  function routeUsage() {
    const counts = {};
    for (const r of state.log) if (r.arm !== 'baseline' && r.route) counts[r.route.split('[')[0].split('+')[0]] = (counts[r.route.split('[')[0].split('+')[0]] || 0) + 1;
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    if (!total) return '<div class="fyp-muted">No routes used yet.</div>';
    const order = ['id', 'label', 'text', 'scoped', 'vision', 'precondition', 'predicate', 'none'];
    return (
      '<div class="fyp-usage">' +
      order
        .filter((k) => counts[k])
        .map((k) => '<div class="fyp-use r-' + k + '" style="flex:' + counts[k] + '" title="' + k + ' x' + counts[k] + '"></div>')
        .join('') +
      '</div><div class="fyp-legend">' +
      order.filter((k) => counts[k]).map((k) => '<span><i class="r-' + k + '"></i>' + k + ' ' + counts[k] + '</span>').join('') +
      '</div>'
    );
  }

  function scoreCard(label, a, tone) {
    const pct = a ? Math.round((100 * a.ok) / a.total) : 0;
    const cls = !a ? '' : a.ok === a.total ? 'ok' : a.ok === 0 ? 'bad' : 'warn';
    return (
      '<div class="fyp-score ' + tone + '"><div class="fyp-score-top"><span>' + label + '</span><b class="' + cls + '">' +
      (a ? a.ok + '<small>/' + a.total + '</small>' : '<small>not run</small>') +
      '</b></div><div class="fyp-bar"><i class="' + cls + '" style="width:' + pct + '%"></i></div></div>'
    );
  }

  function intentsHtml() {
    // Show the most recent healed run, one row per intent.
    const healed = state.log.filter((r) => r.arm !== 'baseline');
    const latestRun = healed.reduce((m, r) => Math.max(m, r.run || 0), 0);
    const last = {};
    for (const r of healed) if ((r.run || 0) === latestRun) last[r.intent] = r;
    return INTENTS.map((it, i) => {
      const r = last[it.id];
      const live = state.current === it.id;
      const cls = live ? 'live' : !r ? 'pend' : r.outcome === 'success' ? 'ok' : 'bad';
      const icon = live ? '<span class="fyp-spin"></span>' : !r ? (i + 1) : r.outcome === 'success' ? '&#10003;' : '&#10005;';
      const route = r && !live ? '<span class="fyp-grade ' + (GRADE_CLASS[r.grade] || 'gn') + '">' + esc(r.route) + (r.grade && r.grade !== '-' ? ' &middot; ' + esc(r.grade) : '') + '</span>' : '';
      const ms = r && !live ? '<small>' + fmtMs(r.ms) + '</small>' : '';
      const fail = r && r.outcome !== 'success' && !live ? '<div class="fyp-why">' + esc(r.detail) + '</div>' : '';
      const rec = r && r.outcome === 'success' && !live && /recovered/.test(r.detail || '') ? '<div class="fyp-heal">self-healed: ' + esc((r.detail.match(/recovered on [^ ]+ after \d+ failed attempt\(s\)/) || [''])[0]) + '</div>' : '';
      return (
        '<li class="fyp-step ' + cls + '"><span class="fyp-ico">' + icon + '</span>' +
        '<div class="fyp-stepmain"><div class="fyp-steptitle">' + esc(it.desc) + '</div><code>' + esc(it.id) + '</code>' + fail + rec + '</div>' +
        '<div class="fyp-stepright">' + route + ms + '</div></li>'
      );
    }).join('');
  }

  function chaosHtml() {
    return Object.keys(BREAKS)
      .map((k) => {
        const on = !!state.chaos.active[k];
        const parts = BREAKS[k].label.split(' · ');
        return (
          '<button class="fyp-brk' + (on ? ' on' : '') + '" data-break="' + k + '" aria-pressed="' + on + '">' +
          '<span class="fyp-brk-id">' + k + '</span><span class="fyp-brk-txt"><b>' + esc(parts[1] || parts[0]) + '</b><small>' + esc(BREAKS[k].note) + '</small></span>' +
          '<span class="fyp-sw"></span></button>'
        );
      })
      .join('');
  }

  function metricsHtml() {
    const m = (measure = measure || measureAccessibility());
    const tile = (label, val, sub, tone) => '<div class="fyp-tile ' + (tone || '') + '"><b>' + val + '</b><span>' + label + '</span><small>' + sub + '</small></div>';
    return (
      tile('controls measured', m.total, 'on the current screen') +
      tile('no accessible name', m.pct + '%', m.unnamed + ' of ' + m.total, m.pct > 30 ? 'bad' : '') +
      tile('not exposed as button', m.notButtonPct + '%', m.notButton + ' of ' + m.total, m.notButtonPct > 30 ? 'bad' : '') +
      tile('role="button"', m.unnamedRole, 'elements declared')
    );
  }

  function surveyHtml() {
    const sv = state.survey;
    if (!sv || !sv.length) return '<div class="fyp-muted">Press <b>Survey all screens</b> to measure the whole flow, not only the screen showing.</div>';
    const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
    const T = sv.reduce((a, r) => ({ total: a.total + r.total, unnamed: a.unnamed + r.unnamed, notButton: a.notButton + r.notButton }), { total: 0, unnamed: 0, notButton: 0 });
    const row = (name, r, bold) =>
      '<tr' + (bold ? ' class="tot"' : '') + '><td>' + name + '</td><td>' + r.total + '</td><td>' + r.unnamed + ' <small>' + pct(r.unnamed, r.total) + '%</small></td><td>' + r.notButton + ' <small>' + pct(r.notButton, r.total) + '%</small></td></tr>';
    return (
      '<table class="fyp-tbl"><thead><tr><th>screen</th><th>controls</th><th>no name</th><th>no role</th></tr></thead><tbody>' +
      sv.map((r) => row(esc(r.screen), r)).join('') +
      row('all screens', T, true) +
      '</tbody></table>'
    );
  }

  function resultsHtml() {
    const ex = state.exp;
    const rows = summarise();
    const prog = ex.active
      ? '<div class="fyp-expprog"><div class="fyp-bar"><i style="width:' + Math.round((100 * (ex.rep - 1)) / ex.n) + '%"></i></div><small>round ' + ex.rep + ' of ' + ex.n + ' &middot; ' + ex.label + '</small></div>'
      : '';
    if (!rows.length) return prog + '<div class="fyp-muted">No runs yet. Run the flow, or start an N&times; experiment.</div>';
    return (
      prog +
      '<table class="fyp-tbl"><thead><tr><th>config</th><th>arm</th><th>runs</th><th>steps</th><th>flow completed</th></tr></thead><tbody>' +
      rows
        .map((a) => {
          const pct = Math.round((100 * a.full) / a.runs);
          const cls = pct === 100 ? 'ok' : pct === 0 ? 'bad' : 'warn';
          return (
            '<tr><td class="cfg" title="' + esc(a.config) + '">' + esc(a.config) + '</td><td><span class="fyp-arm ' + a.arm + '">' + a.arm + '</span></td><td>' + a.runs +
            '</td><td>' + (a.steps / a.runs).toFixed(1) + '<small>/' + a.total + '</small></td><td><div class="fyp-pct"><div class="fyp-bar"><i class="' + cls + '" style="width:' + pct + '%"></i></div><b class="' + cls + '">' + pct + '%</b></div></td></tr>'
          );
        })
        .join('') +
      '</tbody></table>'
    );
  }

  function logHtml() {
    let rows = state.log.map((r, i) => ({ r, i }));
    if (prefs.failOnly) rows = rows.filter((x) => x.r.outcome !== 'success');
    rows = rows.slice(-80).reverse();
    if (!rows.length) return '<div class="fyp-muted">' + (prefs.failOnly ? 'No failures logged.' : 'No attempts yet. Run the flow to fill this in.') + '</div>';
    return rows
      .map(({ r, i }) => {
        const ok = r.outcome === 'success';
        const open = openRows.has(i);
        const arm = r.arm || 'healed';
        return (
          '<div class="fyp-lrow ' + (ok ? 'ok' : 'bad') + (open ? ' open' : '') + '" data-row="' + i + '">' +
          '<div class="fyp-lhead"><i class="fyp-ldot"></i><span class="fyp-lint">' + esc(r.intent) + '</span>' +
          '<span class="fyp-arm ' + arm + '">' + arm + '</span><span class="fyp-lroute">' + esc(r.route) + '</span><small>' + fmtMs(r.ms) + '</small></div>' +
          (open
            ? '<div class="fyp-ldet"><div>' + esc(r.detail) + '</div><div class="fyp-lmeta">' +
              [r.timestamp, 'config: ' + (r.config || 'clean'), 'run ' + r.run + (r.rep ? ' / rep ' + r.rep : ''), 'outcome: ' + r.outcome, diagnosis(r) ? 'diagnosis: ' + diagnosis(r) : ''].filter(Boolean).map(esc).join(' &middot; ') +
              '</div></div>'
            : '') +
          '</div>'
        );
      })
      .join('');
  }

  // ---------------------------------------------------------------------------
  // Painting. render() only schedules; paint() does the work once per frame.
  // ---------------------------------------------------------------------------
  let paintQueued = 0;
  function render() {
    if (!panelEl || paintQueued) return;
    paintQueued = requestAnimationFrame(() => { paintQueued = 0; paint(); });
  }

  function paint() {
    if (!panelEl) return;
    const $ = (id) => panelEl.querySelector('#' + id);
    const busy = running || state.exp.active;
    if (busy && !state.busySince) state.busySince = now();
    if (!busy) state.busySince = 0;

    panelEl.classList.toggle('min', !!prefs.min);
    panelEl.classList.toggle('left', prefs.dock === 'left');
    panelEl.dataset.busy = busy ? '1' : '';

    // Status bar
    let kind = 'idle';
    let title = 'Ready';
    let sub = 'Pick some breaks, then run the flow.';
    const h = state.runs.healed;
    if (busy) {
      kind = 'run';
      title = state.exp.active ? 'Experiment &middot; round ' + state.exp.rep + ' of ' + state.exp.n : 'Running';
      sub = esc(state.prog || 'working...');
    } else if (state.lastFatal) {
      kind = 'bad';
      title = 'Stopped honestly';
      sub = 'A step could not be done - the reason is on the Run tab.';
    } else if (h) {
      kind = h.ok === h.total ? 'ok' : 'warn';
      title = h.ok === h.total ? 'Flow completed' : 'Finished with misses';
      sub = h.ok + ' of ' + h.total + ' steps succeeded' + (h.stopped ? ' (stopped early)' : '');
    }
    $('fyp-hdot').className = 'fyp-dot fyp-hdot ' + kind;
    $('fyp-exp-stop2').style.display = state.exp.active ? '' : 'none';
    $('fyp-status').className = 'fyp-status ' + kind;
    $('fyp-status').innerHTML =
      '<i class="fyp-dot ' + kind + '"></i><div class="fyp-stat-main"><b>' + title + '</b><span>' + sub + '</span></div>' +
      '<time>' + (busy ? fmtClock(now() - state.busySince) : '') + '</time>';

    // Tabs
    const armed = Object.keys(state.chaos.active).length;
    panelEl.querySelectorAll('[data-tab]').forEach((b) => {
      b.classList.toggle('on', b.dataset.tab === prefs.tab);
      if (b.dataset.tab === 'break') b.innerHTML = 'Break' + (armed ? '<em>' + armed + '</em>' : '');
    });
    panelEl.querySelectorAll('[data-pane]').forEach((p) => { p.hidden = p.dataset.pane !== prefs.tab; });

    // Busy gating
    panelEl.querySelectorAll('[data-needs-idle]').forEach((b) => { b.disabled = busy; });
    $('fyp-stop').style.display = busy ? '' : 'none';
    $('fyp-run').style.display = busy ? 'none' : '';

    // Only the visible pane is repainted: cheaper, and it keeps scroll position
    // and the N input focused on the others.
    switch (prefs.tab) {
      case 'run':
        $('fyp-scores').innerHTML = scoreCard('Healed', state.runs.healed, 'healed') + scoreCard('Baseline', state.runs.baseline, 'baseline');
        $('fyp-intents').innerHTML = intentsHtml();
        $('fyp-routes').innerHTML = routeUsage();
        {
          const fatal = $('fyp-fatal');
          if (state.lastFatal) {
            fatal.style.display = 'block';
            fatal.innerHTML =
              '<div class="fyp-fatal-h">The assistant, reporting honestly</div><p>&ldquo;' + esc(state.lastFatal) + '&rdquo;</p>' +
              (state.lastShot ? '<div class="fyp-fatal-s">What I was looking at</div><img alt="screenshot of the screen when the harness gave up" src="' + state.lastShot + '">' : '');
          } else fatal.style.display = 'none';
        }
        break;
      case 'break':
        $('fyp-chaos').innerHTML = chaosHtml();
        break;
      case 'results':
        $('fyp-results').innerHTML = resultsHtml();
        break;
      case 'log':
        $('fyp-log').innerHTML = logHtml();
        $('fyp-filter').classList.toggle('on', !!prefs.failOnly);
        $('fyp-logcount').textContent = state.log.length + ' attempts';
        break;
      case 'a11y':
        $('fyp-metrics').innerHTML = metricsHtml();
        $('fyp-survey').innerHTML = surveyHtml();
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Results export
  // ---------------------------------------------------------------------------
  function resultsJson() {
    return JSON.stringify({ exported: new Date().toISOString(), summary: summarise(), intents: INTENTS.map((i) => ({ id: i.id, desc: i.desc })), log: state.log.map((r) => Object.assign({ diagnosis: diagnosis(r) }, r)) }, null, 2);
  }

  const STYLE = `
@P{position:fixed;top:10px;right:10px;width:404px;max-width:calc(100vw - 20px);max-height:calc(100vh - 20px);display:flex;flex-direction:column;
 z-index:100000;background:#0e0f13;color:#e7e9ee;border:1px solid #23262d;border-radius:14px;overflow:hidden;
 font:13px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;box-shadow:0 18px 60px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.02) inset;
 --bg:#0e0f13;--s1:#15171c;--s2:#1b1e25;--bd:#23262d;--bd2:#2d313b;--tx:#e7e9ee;--mu:#8b90a0;--ac:#6d8bff;--ok:#3ddc97;--bad:#ff6b6b;--warn:#ffb454;
 --mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
@P.left{right:auto;left:10px}
@P *{box-sizing:border-box}
@P button{font:inherit;color:inherit;background:var(--s2);border:1px solid var(--bd2);border-radius:8px;padding:7px 11px;cursor:pointer;transition:background .12s,border-color .12s,transform .06s}
@P button:hover:not(:disabled){background:#242832;border-color:#3a3f4b}
@P button:active:not(:disabled){transform:translateY(1px)}
@P button:disabled{opacity:.45;cursor:not-allowed}
@P button:focus-visible,@P input:focus-visible,@P select:focus-visible{outline:2px solid var(--ac);outline-offset:1px}
@P button.pri{background:var(--ac);border-color:var(--ac);color:#fff;font-weight:600}
@P button.pri:hover:not(:disabled){background:#7f9bff}
@P button.danger{background:#3a1c1f;border-color:#6a2a2f;color:#ffc4c4;font-weight:600}
@P button.ghost{background:transparent}
@P small{color:var(--mu);font-size:11px}
@P code,@P .cfg,@P time{font-family:var(--mono)}
@P .fyp-muted{color:var(--mu);font-size:12px;padding:4px 0}
@P .fyp-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 10px 10px 12px;background:var(--s1);border-bottom:1px solid var(--bd);cursor:grab;user-select:none;touch-action:none}
@P .fyp-head:active{cursor:grabbing}
@P .fyp-brand{display:flex;align-items:center;gap:9px;min-width:0}
@P .fyp-brand b{display:block;font-size:13px;letter-spacing:.01em}
@P .fyp-brand small{display:block;margin-top:-1px}
@P .fyp-logo{width:26px;height:26px;border-radius:8px;background:conic-gradient(from 210deg,#6d8bff,#3ddc97,#ffb454,#6d8bff);position:relative;flex:none}
@P .fyp-logo:after{content:"";position:absolute;inset:6px;border-radius:4px;background:var(--s1)}
@P .fyp-hbtns{display:flex;align-items:center;gap:5px}
@P .fyp-hbtns button{padding:3px 8px;line-height:1.3;background:transparent;border-color:transparent;color:var(--mu)}
@P .fyp-hbtns button:hover:not(:disabled){color:var(--tx)}
@P .fyp-dot{width:9px;height:9px;border-radius:50%;background:#555b6a;flex:none;display:inline-block}
@P .fyp-dot.run{background:var(--ac);box-shadow:0 0 0 0 rgba(109,139,255,.6);animation:fypPulse 1.3s infinite}
@P .fyp-dot.ok{background:var(--ok)}@P .fyp-dot.bad{background:var(--bad)}@P .fyp-dot.warn{background:var(--warn)}
@keyframes fypPulse{70%{box-shadow:0 0 0 8px rgba(109,139,255,0)}100%{box-shadow:0 0 0 0 rgba(109,139,255,0)}}
@P .fyp-status{display:flex;align-items:center;gap:10px;padding:9px 12px;background:var(--bg);border-bottom:1px solid var(--bd)}
@P .fyp-status.run{background:linear-gradient(90deg,rgba(109,139,255,.10),transparent)}
@P .fyp-status.bad{background:linear-gradient(90deg,rgba(255,107,107,.10),transparent)}
@P .fyp-status.ok{background:linear-gradient(90deg,rgba(61,220,151,.09),transparent)}
@P .fyp-stat-main{flex:1;min-width:0}
@P .fyp-stat-main b{display:block;font-size:12.5px}
@P .fyp-stat-main span{display:block;color:var(--mu);font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@P time{color:var(--mu);font-size:11.5px}
@P .fyp-tabs{display:flex;gap:2px;padding:6px 8px 0;background:var(--bg);border-bottom:1px solid var(--bd)}
@P .fyp-tabs button{flex:1;background:transparent;border:0;border-bottom:2px solid transparent;border-radius:6px 6px 0 0;color:var(--mu);padding:7px 4px;font-size:12px;font-weight:500}
@P .fyp-tabs button:hover:not(:disabled){background:var(--s1);color:var(--tx)}
@P .fyp-tabs button.on{color:var(--tx);border-bottom-color:var(--ac);background:var(--s1)}
@P .fyp-tabs em{font-style:normal;background:var(--bad);color:#fff;font-size:10px;border-radius:9px;padding:0 5px;margin-left:4px;font-weight:700}
@P .fyp-body{overflow:auto;flex:1;min-height:0;scrollbar-width:thin;scrollbar-color:#2d313b transparent}
@P section{padding:12px}
@P section[hidden]{display:none}
@P h3{margin:14px 0 8px;font-size:10.5px;text-transform:uppercase;letter-spacing:.09em;color:var(--mu);font-weight:600}
@P h3:first-child{margin-top:0}
@P .fyp-row{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
@P .fyp-actions button.pri{flex:1 1 100%;padding:10px;font-size:13.5px}
@P .fyp-actions button.danger{flex:1 1 100%;padding:10px;font-size:13.5px}
@P .fyp-actions button:not(.pri):not(.danger){flex:1}
@P .fyp-scores{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}
@P .fyp-score{background:var(--s1);border:1px solid var(--bd);border-radius:10px;padding:9px 11px}
@P .fyp-score-top{display:flex;justify-content:space-between;align-items:baseline}
@P .fyp-score-top span{color:var(--mu);font-size:11.5px}
@P .fyp-score-top b{font-size:20px;line-height:1.1}
@P .fyp-score-top b small{font-size:12px;font-weight:500}
@P b.ok,@P .ok>b{color:var(--ok)}@P b.bad{color:var(--bad)}@P b.warn{color:var(--warn)}
@P .fyp-bar{height:5px;background:var(--s2);border-radius:9px;overflow:hidden;margin-top:7px;flex:1}
@P .fyp-bar i{display:block;height:100%;border-radius:9px;background:var(--ac);transition:width .35s}
@P .fyp-bar i.ok{background:var(--ok)}@P .fyp-bar i.bad{background:var(--bad)}@P .fyp-bar i.warn{background:var(--warn)}
@P ol.fyp-steps{list-style:none;margin:0;padding:0;position:relative}
@P .fyp-step{display:flex;gap:10px;padding:7px 0;align-items:flex-start;position:relative}
@P .fyp-step:not(:last-child):before{content:"";position:absolute;left:10px;top:30px;bottom:-6px;width:1px;background:var(--bd)}
@P .fyp-ico{width:21px;height:21px;border-radius:50%;flex:none;display:grid;place-items:center;font-size:11px;font-weight:700;background:var(--s2);color:var(--mu);border:1px solid var(--bd2)}
@P .fyp-step.ok .fyp-ico{background:rgba(61,220,151,.14);border-color:rgba(61,220,151,.5);color:var(--ok)}
@P .fyp-step.bad .fyp-ico{background:rgba(255,107,107,.14);border-color:rgba(255,107,107,.5);color:var(--bad)}
@P .fyp-step.live .fyp-ico{border-color:var(--ac)}
@P .fyp-spin{width:11px;height:11px;border-radius:50%;border:2px solid rgba(109,139,255,.3);border-top-color:var(--ac);animation:fypSpin .7s linear infinite}
@keyframes fypSpin{to{transform:rotate(360deg)}}
@P .fyp-stepmain{flex:1;min-width:0}
@P .fyp-steptitle{font-size:12.5px;line-height:1.3}
@P .fyp-step.pend .fyp-steptitle{color:var(--mu)}
@P .fyp-stepmain code{font-size:10.5px;color:var(--mu)}
@P .fyp-stepright{display:flex;flex-direction:column;align-items:flex-end;gap:2px;flex:none;max-width:42%}
@P .fyp-why{margin-top:4px;font-size:11px;color:#ffb4b4;background:rgba(255,107,107,.08);border-radius:6px;padding:4px 7px;word-break:break-word}
@P .fyp-heal{margin-top:4px;font-size:11px;color:#8fe9bd}
@P .fyp-grade{font-family:var(--mono);font-size:10.5px;padding:1px 7px;border-radius:9px;background:var(--s2);border:1px solid var(--bd2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
@P .fyp-grade.ga{color:var(--ok);border-color:rgba(61,220,151,.4)}@P .fyp-grade.gab{color:#5eead4;border-color:rgba(94,234,212,.4)}
@P .fyp-grade.gb{color:var(--warn);border-color:rgba(255,180,84,.4)}@P .fyp-grade.gd{color:#ff9d6b;border-color:rgba(255,157,107,.4)}
@P .fyp-grade.gf{color:var(--bad);border-color:rgba(255,107,107,.4)}
@P .fyp-usage{display:flex;height:8px;border-radius:9px;overflow:hidden;gap:2px}
@P .fyp-use{min-width:4px}
@P .r-id{background:#6d8bff}@P .r-label{background:#3ddc97}@P .r-text{background:#ffb454}@P .r-scoped{background:#5eead4}@P .r-vision{background:#ff9d6b}@P .r-none{background:#ff6b6b}@P .r-precondition,@P .r-predicate{background:#6b7080}
@P .fyp-legend{display:flex;gap:10px;flex-wrap:wrap;margin-top:6px;font-size:11px;color:var(--mu)}
@P .fyp-legend i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:4px}
@P #fyp-fatal{display:none;margin-top:12px;background:rgba(255,107,107,.08);border:1px solid rgba(255,107,107,.45);border-radius:10px;padding:10px 12px}
@P .fyp-fatal-h{font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;color:#ff9b9b;font-weight:700}
@P #fyp-fatal p{margin:5px 0 0;color:#ffd6d6;font-size:12.5px;line-height:1.5}
@P .fyp-fatal-s{margin-top:9px;font-size:10.5px;color:#ff9b9b}
@P #fyp-fatal img{width:100%;margin-top:4px;border:1px solid #5c2b2b;border-radius:8px}
@P .fyp-brk{display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:9px 10px;margin-bottom:6px;border-radius:10px;background:var(--s1)}
@P .fyp-brk.on{border-color:rgba(255,107,107,.55);background:linear-gradient(90deg,rgba(255,107,107,.10),var(--s1))}
@P .fyp-brk-id{font-family:var(--mono);font-size:11px;font-weight:700;color:var(--mu);width:24px;flex:none}
@P .fyp-brk.on .fyp-brk-id{color:var(--bad)}
@P .fyp-brk-txt{flex:1;min-width:0}
@P .fyp-brk-txt b{display:block;font-size:12.5px;font-weight:600}
@P .fyp-brk-txt small{display:block;line-height:1.35;margin-top:1px}
@P .fyp-sw{width:30px;height:17px;border-radius:9px;background:#333844;position:relative;flex:none;transition:background .15s}
@P .fyp-sw:after{content:"";position:absolute;top:2px;left:2px;width:13px;height:13px;border-radius:50%;background:#fff;transition:transform .15s}
@P .fyp-brk.on .fyp-sw{background:var(--bad)}@P .fyp-brk.on .fyp-sw:after{transform:translateX(13px)}
@P .fyp-chips button{font-size:11.5px;padding:4px 10px;border-radius:99px}
@P input,@P select{font:inherit;background:var(--s2);color:var(--tx);border:1px solid var(--bd2);border-radius:8px;padding:6px 8px}
@P input[type=number]{width:58px}
@P .fyp-tbl{width:100%;border-collapse:collapse;font-size:11.5px}
@P .fyp-tbl th{text-align:left;color:var(--mu);font-weight:600;font-size:10.5px;padding:4px 5px;border-bottom:1px solid var(--bd2)}
@P .fyp-tbl td{padding:6px 5px;border-bottom:1px solid var(--bd);vertical-align:middle}
@P .fyp-tbl .cfg{max-width:96px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10.5px}
@P .fyp-tbl tr.tot td{font-weight:700;border-bottom:0}
@P .fyp-pct{display:flex;align-items:center;gap:6px;min-width:84px}@P .fyp-pct .fyp-bar{margin:0}@P .fyp-pct b{font-size:11px;width:32px;text-align:right}
@P .fyp-arm{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;padding:1px 6px;border-radius:5px;background:var(--s2);color:var(--mu)}
@P .fyp-arm.healed{color:var(--ok);background:rgba(61,220,151,.1)}@P .fyp-arm.baseline{color:var(--warn);background:rgba(255,180,84,.1)}
@P .fyp-expprog{margin-bottom:10px}@P .fyp-expprog .fyp-bar{margin:0 0 4px}
@P .fyp-lrow{border:1px solid var(--bd);border-radius:9px;margin-bottom:5px;background:var(--s1);cursor:pointer;overflow:hidden}
@P .fyp-lrow:hover{border-color:var(--bd2)}
@P .fyp-lhead{display:flex;align-items:center;gap:7px;padding:6px 9px}
@P .fyp-ldot{width:7px;height:7px;border-radius:50%;background:var(--ok);flex:none}
@P .fyp-lrow.bad .fyp-ldot{background:var(--bad)}
@P .fyp-lint{font-family:var(--mono);font-size:11px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
@P .fyp-lroute{font-family:var(--mono);font-size:10.5px;color:var(--mu);max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
@P .fyp-ldet{padding:6px 10px 9px;border-top:1px solid var(--bd);font-size:11.5px;color:#c8ccd6;word-break:break-word}
@P .fyp-lrow.bad .fyp-ldet>div:first-child{color:#ffb4b4}
@P .fyp-lmeta{margin-top:5px;color:var(--mu);font-size:10.5px;font-family:var(--mono)}
@P .fyp-tiles{display:grid;grid-template-columns:1fr 1fr;gap:8px}
@P .fyp-tile{background:var(--s1);border:1px solid var(--bd);border-radius:10px;padding:9px 11px}
@P .fyp-tile b{display:block;font-size:22px;line-height:1.1}
@P .fyp-tile.bad b{color:var(--bad)}
@P .fyp-tile span{display:block;font-size:11.5px;color:var(--tx)}
@P .fyp-tile small{display:block}
@P.min{width:236px}
@P.min .fyp-status,@P.min .fyp-tabs,@P.min .fyp-body,@P.min .fyp-brand small{display:none}
@P.min .fyp-head{border-bottom:0}
@P .fyp-hdot{display:none}
@P.min .fyp-hdot{display:inline-block}
@media (prefers-reduced-motion:reduce){@P *{animation:none!important;transition:none!important}}
`;

  function panel() {
    if (panelEl) {
      panelEl.style.display = '';
      prefs.min = false;
      render();
      return panelEl;
    }
    const css = document.createElement('style');
    css.setAttribute('data-fyp-style', '1');
    css.textContent = STYLE.split('@P').join('#' + PANEL_ID);
    document.head.appendChild(css);

    panelEl = document.createElement('div');
    panelEl.id = PANEL_ID;
    panelEl.setAttribute('role', 'region');
    panelEl.setAttribute('aria-label', 'FYP harness');
    panelEl.innerHTML = `
<div class="fyp-head" id="fyp-drag">
  <div class="fyp-brand"><i class="fyp-logo"></i><div><b>FYP Harness</b><small>intent-aware self-healing</small></div><i class="fyp-dot fyp-hdot" id="fyp-hdot"></i></div>
  <div class="fyp-hbtns">
    <button data-act="dock" title="Dock to the other side" aria-label="Dock to the other side">&#8644;</button>
    <button data-act="min" title="Minimise (Alt+H)" aria-label="Minimise">&#8211;</button>
    <button data-act="hide" title="Hide" aria-label="Hide panel">&#10005;</button>
  </div>
</div>
<div class="fyp-status" id="fyp-status"></div>
<nav class="fyp-tabs" id="fyp-tabs">
  <button data-tab="run">Run</button><button data-tab="break">Break</button><button data-tab="results">Results</button><button data-tab="log">Log</button><button data-tab="a11y">A11y</button>
</nav>
<div class="fyp-body">
  <section data-pane="run">
    <div class="fyp-row fyp-actions">
      <button class="pri" id="fyp-run" data-needs-idle>&#9654;&nbsp; Run healed flow</button>
      <button class="danger" id="fyp-stop" style="display:none">&#9632;&nbsp; Stop</button>
      <button id="fyp-step" data-needs-idle title="Run only the next unfinished intent">Step</button>
      <button id="fyp-baseline" data-needs-idle title="Replay the hard-coded recording">Baseline</button>
      <button id="fyp-reset" data-needs-idle title="Clear breaks and go back to the feed">Reset app</button>
    </div>
    <div class="fyp-scores" id="fyp-scores"></div>
    <div id="fyp-fatal"></div>
    <h3>Intents &middot; goals, not coordinates</h3>
    <ol class="fyp-steps" id="fyp-intents"></ol>
    <h3>Routes used</h3>
    <div id="fyp-routes"></div>
  </section>
  <section data-pane="break" hidden>
    <h3>Presets</h3>
    <div class="fyp-row fyp-chips" style="margin-bottom:6px">
      <button data-preset="rot" data-needs-idle>Locator rot</button>
      <button data-preset="messy" data-needs-idle>Messy layout</button>
      <button data-preset="hostile" data-needs-idle>Everything B1&ndash;B7</button>
      <button data-preset="honest" data-needs-idle>Honest failure</button>
      <button data-preset="none" data-needs-idle class="ghost">Clear all</button>
    </div>
    <h3>Break the UI</h3>
    <div id="fyp-chaos"></div>
    <div class="fyp-muted">Breaks re-apply to every screen the flow visits. Healed and baseline both run against the same broken UI.</div>
  </section>
  <section data-pane="results" hidden>
    <h3>N-times experiment</h3>
    <div class="fyp-row" style="margin-bottom:12px">
      <button class="pri" id="fyp-exp-run" data-needs-idle>Run N&times;</button>
      <input id="fyp-exp-n" type="number" min="1" max="50" value="5" aria-label="repetitions">
      <select id="fyp-exp-set" aria-label="configuration set" style="flex:1;min-width:0">
        <option value="demo">demo set (6 configs)</option>
        <option value="full">full set (12 configs)</option>
      </select>
      <button id="fyp-exp-stop2" class="danger" style="display:none">Stop</button>
    </div>
    <h3>Summary</h3>
    <div id="fyp-results"></div>
    <h3>Export</h3>
    <div class="fyp-row">
      <button id="fyp-dl-sum">Summary CSV</button>
      <button id="fyp-dl-log">Attempt log CSV</button>
      <button id="fyp-dl-json">All as JSON</button>
    </div>
  </section>
  <section data-pane="log" hidden>
    <div class="fyp-row" style="justify-content:space-between;margin-bottom:8px">
      <small id="fyp-logcount"></small>
      <div class="fyp-row">
        <button id="fyp-filter" class="ghost" style="padding:3px 10px;font-size:11.5px">Failures only</button>
        <button id="fyp-clear-log" class="ghost" style="padding:3px 10px;font-size:11.5px">Clear</button>
      </div>
    </div>
    <div id="fyp-log"></div>
  </section>
  <section data-pane="a11y" hidden>
    <h3>Current screen</h3>
    <div class="fyp-tiles" id="fyp-metrics"></div>
    <h3>Whole flow</h3>
    <div id="fyp-survey"></div>
    <div class="fyp-row" style="margin-top:10px">
      <button id="fyp-survey-run" data-needs-idle class="pri">Survey all screens</button>
      <button id="fyp-measure" data-needs-idle>Re-measure</button>
    </div>
    <div class="fyp-muted" style="margin-top:8px">A control with no name is invisible to a screen reader as well as to this harness - same measurement, two meanings.</div>
  </section>
</div>`;
    document.body.appendChild(panelEl);

    const $ = (id) => panelEl.querySelector('#' + id);
    const stop = () => {
      state.stop = true;
      state.exp.stop = true;
      flash('Stopping after the current step.');
      render();
    };

    $('fyp-run').onclick = () => runHealed().then(render);
    $('fyp-step').onclick = () => stepOnce().then(render);
    $('fyp-baseline').onclick = () => runBaseline().then(render);
    $('fyp-reset').onclick = () => resetApp().then(render);
    $('fyp-stop').onclick = stop;
    $('fyp-exp-stop2').onclick = stop;
    $('fyp-measure').onclick = () => { measure = measureAccessibility(); render(); };
    $('fyp-survey-run').onclick = () => surveyScreens();
    $('fyp-exp-run').onclick = () => {
      const n = Math.max(1, Math.min(50, parseInt($('fyp-exp-n').value, 10) || 1));
      runExperiment(n, $('fyp-exp-set').value);
    };
    $('fyp-dl-sum').onclick = () => download('fyp-summary.csv', summaryCsv());
    $('fyp-dl-log').onclick = () => download('fyp-attempt-log.csv', logCsv());
    $('fyp-dl-json').onclick = () => download('fyp-results.json', resultsJson(), 'application/json');
    $('fyp-filter').onclick = () => { prefs.failOnly = !prefs.failOnly; savePrefs(); render(); };
    $('fyp-clear-log').onclick = () => {
      state.log.length = 0;
      state.runs = { healed: null, baseline: null };
      openRows.clear();
      saveLogSoon();
      render();
    };

    $('fyp-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-tab]');
      if (!b) return;
      prefs.tab = b.dataset.tab;
      savePrefs();
      if (prefs.tab === 'a11y') measure = measureAccessibility();
      render();
    });
    $('fyp-chaos').addEventListener('click', (e) => {
      const b = e.target.closest('[data-break]');
      if (!b || running) return;
      if (state.chaos.active[b.dataset.break]) {
        // Toggle off: restore the app, then re-arm what stays on.
        const keep = Object.keys(state.chaos.active).filter((k) => k !== b.dataset.break);
        clearChaos();
        keep.forEach((k) => applyBreak(k));
      } else applyBreak(b.dataset.break);
      render();
    });
    const PRESET_BREAKS = { rot: ['B1', 'B2'], messy: ['B3', 'B4', 'B5'], hostile: ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7'], honest: ['B8'], none: [] };
    panelEl.addEventListener('click', (e) => {
      const p = e.target.closest('[data-preset]');
      if (!p || running) return;
      clearChaos();
      PRESET_BREAKS[p.dataset.preset].forEach((k) => applyBreak(k));
      render();
    });
    $('fyp-log').addEventListener('click', (e) => {
      const row = e.target.closest('[data-row]');
      if (!row) return;
      const i = +row.dataset.row;
      if (openRows.has(i)) openRows.delete(i); else openRows.add(i);
      render();
    });

    // Header buttons, and dragging by the header.
    const head = $('fyp-drag');
    head.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      if (b.dataset.act === 'min') prefs.min = !prefs.min;
      else if (b.dataset.act === 'hide') panelEl.style.display = 'none';
      else if (b.dataset.act === 'dock') {
        prefs.dock = prefs.dock === 'left' ? 'right' : 'left';
        prefs.x = prefs.y = null;
        panelEl.style.left = panelEl.style.top = panelEl.style.right = '';
      }
      savePrefs();
      render();
    });
    const place = () => {
      if (prefs.x == null) return;
      const w = panelEl.offsetWidth;
      const x = Math.max(0, Math.min(innerWidth - w, prefs.x));
      const y = Math.max(0, Math.min(innerHeight - 44, prefs.y));
      panelEl.style.left = x + 'px';
      panelEl.style.top = y + 'px';
      panelEl.style.right = 'auto';
    };
    head.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button') || e.button !== 0) return;
      const r = panelEl.getBoundingClientRect();
      const dx = e.clientX - r.left;
      const dy = e.clientY - r.top;
      const move = (ev) => { prefs.x = ev.clientX - dx; prefs.y = ev.clientY - dy; place(); };
      const up = () => {
        removeEventListener('pointermove', move);
        removeEventListener('pointerup', up);
        savePrefs();
      };
      addEventListener('pointermove', move);
      addEventListener('pointerup', up);
    });
    addEventListener('resize', place);
    place();

    keyHandler = (e) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const k = e.key.toLowerCase();
      if (k === 'h') { prefs.min = !prefs.min; panelEl.style.display = ''; savePrefs(); render(); e.preventDefault(); }
      else if (k === 'r' && !running && !state.exp.active) { runHealed().then(render); e.preventDefault(); }
      else if (k === 's' && (running || state.exp.active)) { stop(); e.preventDefault(); }
    };
    addEventListener('keydown', keyHandler);

    // A light ticker so the elapsed clock moves while a run is in flight.
    ticker = setInterval(() => { if (running || state.exp.active) render(); }, 500);

    measure = measureAccessibility();
    render();
    // Record the baseline while the app is still pristine, exactly once, so the
    // first Run press does not have to pay for the walkthrough. It replays once
    // more on demand if that recording never happened.
    if (!state.recorded) setTimeout(() => { if (!state.recorded && !state.recording) recordBaseline(); }, 1200);
    return panelEl;
  }
  let keyHandler = null;
  let ticker = null;

  // ===========================================================================
  // 11. Public surface + teardown
  // ===========================================================================
  window[NS] = {
    active: true,
    INTENTS,
    BREAKS,
    panel,
    render,
    runHealed,
    runBaseline,
    recordBaseline,
    get baseline() { return state.baseline; },
    get recorded() { return state.recorded; },
    get prog() { return state.prog; },
    get recording() { return state.recording; },
    get lastFatal() { return state.lastFatal; },
    get modalEscapes() { return state.modalEscapes || 0; },
    get lastShot() { return state.lastShot; },
    surveyScreens,
    get survey() { return state.survey; },
    runExperiment,
    summarise,
    logCsv,
    summaryCsv,
    get exp() { return state.exp; },
    resetApp,
    clearChaos,
    applyBreak,
    measureAccessibility,
    collect,
    resolve,
    detectScreen,
    get log() { return state.log; },
    destroy() {
      clearChaos();
      if (panelEl) panelEl.remove();
      if (keyHandler) removeEventListener('keydown', keyHandler);
      clearInterval(ticker);
      const st = document.querySelector('style[data-fyp-style]'); if (st) st.remove();
      const s = document.getElementById(DECOY_ID); if (s) s.remove();
      const o = document.getElementById(OVERLAY_ID); if (o) o.remove();
      panelEl = null;
      window[NS].active = false;
    },
  };

  // ===========================================================================
  // 12. Agent API - the stable, JSON-only surface an AI assistant calls.
  //
  // Everything here returns plain serialisable data and never throws: a failure
  // is a value (`ok:false`, `needsUser:true`, `userMessage`), because the
  // assistant has to relay it to a person. The contract is documented in
  // AGENTS.md and agent/tool-manifest.json - keep the three in step.
  // ===========================================================================
  // ===========================================================================
  // 11. Teaching - learn a new routine from ONE demonstration
  // ===========================================================================
  // The user does a task once by hand. For every action the recorder keeps
  //   * WHAT was touched, as the same kind of description the ladder already runs
  //     on (hook, label, text, position among look-alikes, where it sat), and
  //   * WHAT CHANGED afterwards, learned from a before/after diff: text that
  //     appeared, text that went, the control's own look, the typed value.
  // That second part is the step's success check. A step whose effect cannot be
  // seen is REFUSED, not saved: a step that cannot be verified cannot be healed,
  // and a replay that cannot tell whether it worked is the failure this FYP is
  // about. Replay runs every step through the normal ladder (route memory, the
  // keyboard route, honest failure, the breaks) - a taught step is not special.
  //
  // Never recorded: the value typed into a password field.
  const normText = (s) => strip(String(s == null ? '' : s)).replace(/\d[\d,.]*/g, '#').toLowerCase();
  const stemOf = (h) => h.replace(/[-_:][^-_:]*\d[^-_:]*$/, '');
  const pickIn = (list, ordinal, size) => {
    if (!list.length) return null;
    if (ordinal === 0) return list[0];
    if (size > 1 && ordinal === size - 1) return list[list.length - 1];   // "the last one"
    return list[ordinal] || null;
  };

  /** Visible text lines (digits folded to #) plus aria-labels, minus the harness's own UI. */
  function pageTexts() {
    const set = new Set();
    for (const top of document.body.children) {
      if ((top.id && top.id.indexOf('__fyp') === 0) || (top.hasAttribute && top.hasAttribute('data-fyp-toast'))) continue;
      for (const line of String(top.innerText || '').split('\n')) {
        const t = normText(line);
        if (t.length >= 2 && t.length <= 60) set.add(t);
      }
    }
    for (const el of document.querySelectorAll('[aria-label]')) {
      if (el.closest('#' + PANEL_ID)) continue;
      const t = normText(el.getAttribute('aria-label'));
      if (t) set.add('@' + t);
    }
    return set;
  }

  /** How a control LOOKS, so "the heart turned red" is observable without any hook. */
  function styleSig(el) {
    if (!el || !el.isConnected) return '';
    const nodes = [el, ...el.querySelectorAll('*')].slice(0, 24);
    return hash(nodes.map((n) => {
      const cs = getComputedStyle(n);
      const own = n.children.length ? '' : String(n.textContent || '').slice(0, 6);
      return [cs.color, cs.backgroundColor, cs.fill, cs.stroke, cs.opacity, n.getAttribute('aria-pressed') || '', n.getAttribute('aria-checked') || '', own].join('|');
    }).join(';'));
  }

  function groupOf(c, cs) {
    const s = c.hook ? stemOf(c.hook) : '';
    const byHook = s && s !== c.hook ? cs.filter((o) => o.hook && stemOf(o.hook) === s) : [];
    if (byHook.length > 1) return { by: 'hook', key: s, members: byHook };
    const byLabel = c.label ? cs.filter((o) => o.label === c.label) : [];
    if (byLabel.length > 1) return { by: 'label', key: c.label, members: byLabel };
    const byText = c.text && c.text.length <= 30 ? cs.filter((o) => o.text === c.text) : [];
    if (byText.length > 1) return { by: 'text', key: c.text, members: byText };
    return null;
  }

  /** Everything the ladder needs to find this control again. */
  function describeControl(c, cs) {
    const W = Math.min(innerWidth, 500);
    const d = {
      hook: c.hook || '', label: c.label || '', text: (c.text || '').slice(0, 60), tag: c.tag, role: c.role || '',
      placeholder: c.el.getAttribute('placeholder') || '',
      region: Object.keys(REGIONS).find((n) => inRegion(c, n)) || null,
      geo: { x: +((c.box.cx - (innerWidth - W) / 2) / W).toFixed(3), y: +(c.box.cy / innerHeight).toFixed(3), docY: Math.round(docPos(c.el).y), w: Math.round(c.box.w), h: Math.round(c.box.h) },
      path: c.path,
    };
    const g = groupOf(c, cs);
    if (g) d.group = { by: g.by, key: g.key, size: g.members.length, ordinal: g.members.indexOf(c) };
    const lab = c.label ? cs.filter((o) => o.label === c.label) : [];
    if (lab.length > 1) d.labelGroup = { by: 'label', key: c.label, size: lab.length, ordinal: lab.indexOf(c) };
    return d;
  }

  const ordinalWord = (g) => (g.ordinal === 0 ? 'the first' : g.ordinal === g.size - 1 ? 'the last' : 'number ' + (g.ordinal + 1)) + ' of ' + g.size;
  function stepDesc(action, d) {
    const name = d.label || d.text || d.placeholder || d.hook || 'a control';
    return (action === 'type' ? 'Type into "' : 'Tap "') + name + '"' + (d.group ? ' (' + ordinalWord(d.group) + ')' : '');
  }
  function checkText(ev) {
    if (ev.typed) return 'the typed text is in the field';
    const bits = [];
    if (ev.style) bits.push('the control changes look');
    if (ev.ctl && ev.ctl.length) bits.push('new controls appear (' + ev.ctl.slice(0, 3).map((k) => '"' + k.replace(/^[a-z]:/, '') + '"').join(', ') + ')');
    if (ev.appeared.length) bits.push('shows ' + ev.appeared.slice(0, 2).map((t) => '"' + t.replace(/^@/, '') + '"').join(' and '));
    if (ev.gone.length) bits.push('no longer shows ' + ev.gone.slice(0, 2).map((t) => '"' + t.replace(/^@/, '') + '"').join(' and '));
    return bits.join('; ');
  }

  const teach = { on: false, name: '', steps: [], params: {}, typed: [], queue: Promise.resolve(), typing: null, pending: null, warnings: [], listeners: null, startScreen: 1 };

  /** What controls exist, by the most stable name each has (label, placeholder, hook stem, short text).
   *  "A comment box and a Post button appeared" survives a different post being first; a text line
   *  like "no comments yet" does not. */
  function ctlKeys(cs) {
    const set = new Set();
    for (const c of cs) {
      const ph = c.el.getAttribute('placeholder');
      if (c.label) set.add('l:' + normText(c.label));
      else if (ph) set.add('p:' + normText(ph));
      else if (c.hook) set.add('h:' + stemOf(c.hook));
      else if (c.text && c.text.length <= 30) set.add('t:' + normText(c.text));
    }
    return set;
  }

  function preSnap(target) {
    const cs = collect();
    const ctl = target && target.closest ? target.closest(CONTROL_SEL) : null;
    const c = ctl ? cs.find((x) => x.el === ctl) : null;
    if (!c) return null;
    return { cs, c, texts: pageTexts(), ctl: ctlKeys(cs), style: styleSig(c.el), desc: describeControl(c, cs), screen: detectScreen() };
  }

  function recIndicator() {
    let r = document.getElementById('__fyp-rec');
    if (!teach.on) { if (r) r.remove(); return; }
    if (!r) {
      r = document.createElement('div');
      r.id = '__fyp-rec';
      r.style.cssText = 'position:fixed;top:8px;left:8px;z-index:100002;background:#b00020;color:#fff;border-radius:999px;padding:4px 12px;font:600 12px system-ui,sans-serif;pointer-events:none;';
      document.body.appendChild(r);
    }
    r.textContent = '● Recording "' + teach.name + '" - ' + teach.steps.length + ' step(s)';
  }

  function paramName(d) {
    const base = String(d.hook || d.label || d.placeholder || 'text').split(/[-\s]/)[0].toLowerCase().replace(/[^a-z0-9]/g, '') || 'text';
    let n = base, i = 2;
    while (teach.params[n]) n = base + i++;
    return n;
  }

  /** Close the typing step (sync, so it sees the field before the next click can change anything). */
  function flushTyping() {
    const t = teach.typing;
    teach.typing = null;
    if (!t) return;
    const el = t.el;
    if (el.type === 'password') {
      teach.warnings.push('A password field was used. I never record what is typed into one, so that step is not part of the routine: log in first, then teach.');
      return;
    }
    const value = String(el.value || '');
    if (!value) return;
    const name = paramName(t.pre.desc);
    teach.params[name] = { default: value };
    teach.typed.push({ name, norm: normText(value) });
    const ev = { typed: true, appeared: [], gone: [], style: null };
    teach.steps.push({ action: 'type', target: t.pre.desc, desc: stepDesc('type', t.pre.desc) + ' (parameter ' + name + ')', value: { param: name, default: value }, evidence: ev, check: checkText(ev) });
    recIndicator();
    announce('Recorded step ' + teach.steps.length + ': ' + teach.steps[teach.steps.length - 1].desc);
  }

  /** Work out what a click changed, from the DOM as it is RIGHT NOW. Runs once per step: either
   *  after the screen has settled, or earlier if the user's next action begins first - a step's
   *  effect must never be credited with what the following step did. */
  function computeEvidence(pre, step) {
    if (step.final) return;
    step.final = true;
    const after = pageTexts();
    const afterCtl = ctlKeys(collect());
    let el = pre.c.el;
    if (!el.isConnected) {                              // the app re-rendered the control
      const cs = collect();
      el = (pre.desc.hook && cs.find((x) => x.hook === pre.desc.hook) ||
            (pre.desc.group && pickIn(cs.filter((x) => (pre.desc.group.by === 'hook' ? x.hook && stemOf(x.hook) === pre.desc.group.key : x.label === pre.desc.group.key)), pre.desc.group.ordinal, pre.desc.group.size)) ||
            null);
      el = el && el.el ? el.el : null;
    }
    const styleAfter = el ? styleSig(el) : '';
    let appeared = [...after].filter((t) => !pre.texts.has(t));
    // Text that echoes what was typed earlier becomes a template, so a different value still verifies.
    appeared = appeared.map((t) => { for (const v of teach.typed) if (v.norm && t.includes(v.norm)) return t.replace(v.norm, '{{' + v.name + '}}'); return t; });
    // Keep only lines that can recur: no folded numbers (counts, times, who liked what) unless they carry the typed value.
    appeared = appeared.filter((t) => t.includes('{{') || (!t.includes('#') && !t.startsWith('@')));
    const rank = (a) => a.slice().sort((x, y) => y.length - x.length).slice(0, 8);
    const ctl = [...afterCtl].filter((k) => !pre.ctl.has(k));
    const style = el && styleAfter && styleAfter !== pre.style ? { before: pre.style, after: styleAfter } : null;
    // Text that went away is content-specific ("liked by <whoever is first>"): only worth keeping when
    // nothing else shows the step worked (a dismissed dialog, say).
    const gone = !ctl.length && !appeared.length && !style ? rank([...pre.texts].filter((t) => !after.has(t) && !t.includes('#') && !t.startsWith('@'))).slice(0, 4) : [];
    step.evidence = { typed: false, appeared: rank(appeared), gone, ctl: ctl.slice(0, 8), style };
    step.check = checkText(step.evidence);
  }

  /** The settled "after" half of a click (unless the next action already closed the step). */
  async function finishClick(pre, step) {
    await sleep(450);
    await settle(8, 120);
    computeEvidence(pre, step);
  }

  /** Close the previous click NOW, before the next action's handlers can change the screen. */
  function closePending() {
    const p = teach.pending;
    teach.pending = null;
    if (p) computeEvidence(p.pre, p.step);
  }

  function teachStart(name) {
    if (teach.on) return { ok: false, userMessage: 'Already recording "' + teach.name + '". Stop it first.' };
    Object.assign(teach, { on: true, name: String(name || 'routine'), steps: [], params: {}, typed: [], queue: Promise.resolve(), typing: null, pending: null, warnings: [], startScreen: detectScreen(), viewport: { w: innerWidth, h: innerHeight } });
    const onClick = (e) => {
      if (!teach.on || !e.isTrusted) return;                // only a real person; the harness's own taps are synthetic
      if (e.target && e.target.closest && e.target.closest('#' + PANEL_ID)) return;
      closePending();
      flushTyping();
      const pre = preSnap(e.target);
      if (!pre) { teach.warnings.push('A tap on something that is not a control was ignored.'); return; }
      const step = { action: 'click', target: pre.desc, desc: stepDesc('click', pre.desc), value: null, evidence: null, check: '' };
      teach.steps.push(step);
      teach.pending = { pre, step };
      recIndicator();
      teach.queue = teach.queue.then(() => finishClick(pre, step)).then(() => { const n = teach.steps.indexOf(step); if (n >= 0) announce('Recorded step ' + (n + 1) + ': ' + step.desc); });
    };
    const onInput = (e) => {
      if (!teach.on || !e.isTrusted) return;
      const el = e.target;
      if (!el || !/^(INPUT|TEXTAREA)$/.test(el.tagName)) return;
      if (!teach.typing || teach.typing.el !== el) {
        // Clicking into a field and then typing is one action: the typing is the step, and it
        // is what gets verified. The focus click on its own changes nothing anyone can check.
        if (teach.pending && teach.pending.pre.c.el === el) {
          teach.pending.step.final = true;
          const at = teach.steps.indexOf(teach.pending.step);
          if (at >= 0) teach.steps.splice(at, 1);
          teach.pending = null;
        }
        closePending(); flushTyping();
        const pre = preSnap(el);
        if (pre) teach.typing = { el, pre };
      }
    };
    const onBlur = (e) => { if (teach.on && teach.typing && teach.typing.el === e.target) flushTyping(); };
    document.addEventListener('click', onClick, true);
    document.addEventListener('input', onInput, true);
    document.addEventListener('focusout', onBlur, true);
    teach.listeners = { onClick, onInput, onBlur };
    recIndicator();
    announce('Recording started. Do the task once, then say stop.');
    return { ok: true, name: teach.name, startScreen: SCREEN_NAME[teach.startScreen] || 'feed' };
  }

  async function teachStop() {
    if (!teach.on) return { ok: false, error: 'not-recording', userMessage: 'I was not recording.' };
    flushTyping();
    await teach.queue;
    document.removeEventListener('click', teach.listeners.onClick, true);
    document.removeEventListener('input', teach.listeners.onInput, true);
    document.removeEventListener('focusout', teach.listeners.onBlur, true);
    teach.on = false;
    recIndicator();
    const steps = teach.steps;
    if (!steps.length) return { ok: false, error: 'nothing-recorded', userMessage: 'I did not see any steps, so there is nothing to save.', warnings: teach.warnings };
    const bad = steps.findIndex((s) => !s.evidence || (!s.evidence.typed && !s.evidence.appeared.length && !s.evidence.gone.length && !(s.evidence.ctl && s.evidence.ctl.length) && !s.evidence.style));
    if (bad >= 0) {
      return {
        ok: false, error: 'unverifiable-step', warnings: teach.warnings,
        userMessage: 'I could not see anything change after step ' + (bad + 1) + ' (' + steps[bad].desc + '), so I cannot check that it worked, and I will not save a step I cannot verify. Try showing me the result, for example a final tap that makes it visible, then teach again.',
      };
    }
    const routine = {
      version: 1, name: teach.name, createdAt: new Date().toISOString(), start: { screen: SCREEN_NAME[teach.startScreen] || 'feed' },
      // Layout moves with window size; the position-based route is only as good as this match.
      viewport: teach.viewport,
      params: teach.params, phrases: [],
      steps: steps.map((s, i) => ({ n: i + 1, ...s })),
    };
    return { ok: true, routine, warnings: teach.warnings, readback: routine.steps.map((s) => s.n + '. ' + s.desc + ' - done when ' + s.check) };
  }

  /**
   * Model-assisted success checks for a taught routine. The recorder keeps every change it saw
   * after a tap, so a check can include incidental ones (a count, an unrelated line that happened
   * to load). Ask the model which of the OBSERVED changes actually show the goal was reached.
   *
   *   * it can only point at items already in the evidence list - it cannot add a condition;
   *   * the result is a SUGGESTION stored beside the original (step.suggested), never applied
   *     unless the human replays with useSuggested, so a model can never silently weaken a check;
   *   * a step with fewer than two observed items, or a model that names none, is left alone.
   */
  async function teachSuggest(routine, phrase) {
    if (!routine || !Array.isArray(routine.steps)) return { ok: false, error: 'bad-routine', userMessage: 'That routine is missing or damaged.' };
    if (typeof window.__fypSemantic !== 'function') return { ok: false, error: 'no-model', userMessage: 'No model is attached: add --semantic offline or --semantic anthropic.' };
    const out = [];
    for (const step of routine.steps) {
      const ev = step.evidence;
      const items = [];
      if (ev && !ev.typed) {
        (ev.ctl || []).forEach((v) => items.push({ kind: 'control', field: 'ctl', value: v }));
        (ev.appeared || []).forEach((v) => items.push({ kind: 'text-appeared', field: 'appeared', value: v }));
        (ev.gone || []).forEach((v) => items.push({ kind: 'text-gone', field: 'gone', value: v }));
      }
      const row = { n: step.n, desc: step.desc, items: items.length, before: step.check, suggested: null, dropped: [] };
      if (items.length >= 2) {
        let res = null;
        try { res = await window.__fypSemantic({ task: 'evidence', intent: { desc: step.desc, phrase: phrase || routine.name }, items: items.map((it, i) => ({ i, kind: it.kind, value: it.value })) }); } catch (e) { res = null; }
        const keep = ((res && res.ranked) || []).filter((r) => r && Number.isInteger(r.i) && items[r.i]).map((r) => r.i);
        const uniq = [...new Set(keep)];
        if (uniq.length && uniq.length < items.length) {
          const sug = { typed: false, appeared: [], gone: [], ctl: [], style: ev.style || null };
          uniq.forEach((i) => sug[items[i].field].push(items[i].value));
          row.suggested = sug;
          row.suggestedCheck = checkText(sug);
          row.dropped = items.filter((_, i) => !uniq.includes(i)).map((x) => x.value);
          semantic.calls++;
        }
      }
      out.push(row);
    }
    return { ok: true, steps: out };
  }

  const paramValue = (spec, params) => (spec && typeof spec === 'object' ? (params && params[spec.param] != null ? params[spec.param] : spec.default) : spec);

  /** A taught step, as the same object shape the ladder already runs on. */
  function intentFromStep(step, idx, routine, params, useSuggested) {
    const d = step.target, ev = useSuggested && step.suggested ? step.suggested : step.evidence;
    const expected = (list) => list.map((t) => t.replace(/\{\{(\w+)\}\}/g, (_, k) => normText(paramValue({ param: k, default: (routine.params[k] || {}).default }, params))));
    const it = {
      id: routine.name + '.' + (idx + 1), learned: true, action: step.action, desc: step.desc, successDesc: useSuggested && step.suggested ? checkText(ev) : step.check,
      labels: [d.label, d.text, d.placeholder].filter((x) => x && x.length <= 40),
      anchor: null, region: d.region, ordinal: 0,
      geo: { tag: d.tag, ...d.geo },
      testId: d.hook ? (cs) => {
        if (d.group && d.group.by === 'hook') {
          const m = pickIn(cs.filter((o) => o.hook && stemOf(o.hook) === d.group.key), d.group.ordinal, d.group.size);
          return m ? m.hook : '__no_such_hook__';
        }
        return d.hook;
      } : null,
      pick: (hits, kind) => {
        const g = (kind === 'label' ? d.labelGroup || d.group : d.group || d.labelGroup);
        if (!g) return hits;
        const m = pickIn(hits, g.ordinal, g.size);
        return m ? [m] : [];
      },
      satisfiedBy: ev && ev.style ? (el) => styleSig(el) === ev.style.after && ev.style.after !== ev.style.before : null,
      capture: () => { it._beforeTexts = pageTexts(); it._beforeCtl = ctlKeys(collect()); return 1; },
      success: () => {
        const el = it._acted;
        if (ev.typed) return !!(el && el.isConnected && String(el.value) === String(it.value));
        if (ev.style && el && el.isConnected && styleSig(el) === ev.style.after) return true;
        if (ev.ctl && ev.ctl.length) {
          const nowCtl = ctlKeys(collect()), beforeCtl = it._beforeCtl || new Set();
          if (ev.ctl.filter((k) => nowCtl.has(k) && !beforeCtl.has(k)).length >= Math.ceil(ev.ctl.length * 0.6)) return true;
        }
        const now2 = pageTexts(), before = it._beforeTexts || new Set();
        const a = expected(ev.appeared), g = expected(ev.gone);
        if (a.length && a.filter((t) => now2.has(t) && !before.has(t)).length >= Math.ceil(a.length * 0.6)) return true;
        if (g.length && g.filter((t) => !now2.has(t) && before.has(t)).length >= Math.ceil(g.length * 0.6)) return true;
        return false;
      },
    };
    if (step.action === 'type') it.value = String(paramValue(step.value, params));
    return it;
  }

  /** The recorded-locator way to replay a taught step, for the comparison arm. */
  function baselineFind(d) {
    const q = (s) => [...document.querySelectorAll(s)];
    if (d.group && d.group.by === 'hook') return q('[data-testid^="' + d.group.key + '"]')[d.group.ordinal] || null;
    if (d.hook) return document.querySelector('[data-testid="' + d.hook + '"]');
    if (d.label) return q('[aria-label="' + d.label + '"]')[(d.labelGroup || { ordinal: 0 }).ordinal] || null;
    if (d.placeholder) return q('[placeholder="' + d.placeholder + '"]')[0] || null;
    // A recorder keys a text-only control on its visible text (Playwright's getByText), and
    // only falls back to a raw path when there is nothing else. Without this the baseline
    // would be handed the most fragile locator available - a strawman.
    if (d.text) {
      const m = q(CONTROL_SEL).filter((e) => textOf(e) === d.text);
      return m[d.group && d.group.by === 'text' ? d.group.ordinal : 0] || null;
    }
    return document.querySelector(d.path);
  }

  async function agentRoutine(opts) {
    opts = opts || {};
    const routine = opts.routine;
    if (!routine || !Array.isArray(routine.steps)) return { ok: false, error: 'bad-routine', userMessage: 'That routine is missing or damaged.' };
    if (agentBusy()) return { ok: false, error: 'busy', userMessage: 'The assistant is already running a task.' };
    const arm = opts.arm === 'baseline' ? 'baseline' : 'healed';
    const breaks = (opts.breaks || []).filter((k) => BREAKS[k]);
    const params = opts.params || {};
    memory.enabled = !!opts.memory && arm === 'healed';
    running = true;
    state.runId++;
    const rows = [];
    let ok = 0, verified = 0, fatal = null;
    try {
      await resetApp();                                  // taught routines start from the feed
      breaks.forEach((k) => applyBreak(k));
      for (let i = 0; i < routine.steps.length; i++) {
        const step = routine.steps[i];
        const it = intentFromStep(step, i, routine, params, !!opts.useSuggested);
        if (arm === 'baseline') {
          const t0 = now();
          let outcome = 'success', detail = 'the stored locator resolved', effect = false;
          try {
            const el = baselineFind(step.target);
            if (!el) throw new Error('locator no longer resolves');
            if (el.scrollIntoView) el.scrollIntoView({ block: 'center', inline: 'center' });
            await sleep(300);
            it.capture(); it._acted = el;
            if (step.action === 'type') typeInto(el, it.value); else realClick(el);
            await sleep(500);
            try { effect = !!it.success(); } catch (e) { effect = false; }
          } catch (e) {
            outcome = 'failed-not-found';
            detail = String((e && e.message) || e);
          }
          if (outcome === 'success') { ok++; if (effect) verified++; }
          rows.push(logRow({ arm: 'baseline', intent: it.id, routeIndex: 0, route: 'hard-coded', grade: 'F', outcome, detail: detail + (outcome === 'success' ? (effect ? ' (effect seen)' : ' (but no visible effect)') : ''), ms: Math.round(now() - t0), order: i + 1 }));
          continue;
        }
        const row = await runIntent(it, { order: i + 1 });
        rows.push(row);
        if (row.outcome === 'success') { ok++; verified++; announce('Step ' + (i + 1) + ' of ' + routine.steps.length + ' done: ' + step.desc + '.'); }
        else { fatal = honestFailure(it, row); announce(fatal); break; }
      }
    } catch (e) {
      fatal = 'The assistant hit an internal error: ' + (e && e.message);
    } finally {
      clearChaos();
      memory.enabled = false;
      running = false;
      render();
    }
    const total = routine.steps.length;
    const done = arm === 'baseline' ? verified === total : ok === total;
    return {
      ok: done, arm, routine: routine.name, breaks, params,
      stepsOk: ok, stepsVerified: verified, stepsTotal: total,
      needsUser: !done,
      userMessage: done ? null : fatal || (arm === 'baseline' ? 'The recorded locators ran but not every step had its visible effect.' : 'The routine did not complete.'),
      rows: rows.map(rowView),
    };
  }

  const AGENT_VERSION = 1;
  const rowView = (r) => ({
    order: r.order, intent: r.intent, arm: r.arm || 'healed', route: r.route, routeIndex: r.routeIndex,
    grade: r.grade, outcome: r.outcome, diagnosis: diagnosis(r), detail: r.detail, ms: r.ms,
    failedActions: r.failedActions == null ? null : r.failedActions, memory: r.memory || '',
    semanticCalls: r.semanticCalls == null ? 0 : r.semanticCalls,
  });
  const intentById = (id) => INTENTS.find((i) => i.id === id);
  const agentBusy = () => running || state.exp.active;

  async function agentReady(timeoutMs) {
    const t0 = now();
    while (now() - t0 < (timeoutMs || 25000)) {
      const h = window[NS];
      if (h && h.active && document.querySelector('[data-testid="tab-home"]') && state.recorded && !state.recording) return true;
      await sleep(200);
    }
    return false;
  }

  /** Harness is up and the app shows either its login form or its feed. Used by the
   *  runner in live mode, where ready() cannot be true until after the login. */
  async function agentAlive(timeoutMs) {
    const t0 = now();
    while (now() - t0 < (timeoutMs || 25000)) {
      const h = window[NS];
      const login = !!document.querySelector('input[placeholder="Password"]');
      if (h && h.active && (login || document.querySelector('[data-testid="tab-home"]'))) return { loginScreen: login };
      await sleep(200);
    }
    return null;
  }

  function agentStatus() {
    return {
      version: AGENT_VERSION,
      screen: detectScreen(),
      busy: agentBusy(),
      baselineRecorded: state.recorded,
      armedBreaks: Object.keys(state.chaos.active).sort(),
      accessibility: measureAccessibility(),
    };
  }

  /** Describe what can be asked of the app: intents, breaks, parameters. */
  function agentDescribe() {
    return {
      version: AGENT_VERSION,
      intents: INTENTS.map((i) => ({ id: i.id, desc: i.desc, action: i.action, screen: i.screen, successDesc: i.successDesc })),
      breaks: Object.keys(BREAKS).map((k) => ({ id: k, label: BREAKS[k].label, note: BREAKS[k].note })),
      params: { caption: 'string - the post caption (default: a unique "fyp demo post <id>")' },
      configSets: Object.keys(PRESETS),
    };
  }

  async function agentFlow(opts) {
    opts = opts || {};
    if (agentBusy()) return { ok: false, needsUser: false, error: 'busy', userMessage: 'The assistant is already running a task.' };
    const arm = ['baseline', 'llm-only'].includes(opts.arm) ? opts.arm : 'healed';
    const breaks = (opts.breaks || []).filter((k) => BREAKS[k]);
    if ((opts.breaks || []).length !== breaks.length) {
      return { ok: false, error: 'unknown-break', userMessage: 'Unknown break id in: ' + (opts.breaks || []).join(', ') };
    }
    CAPTION_TEXT = opts.caption ? String(opts.caption) : DEFAULT_CAPTION + ' ' + Math.random().toString(36).slice(2, 6);
    memory.enabled = !!opts.memory && arm === 'healed';   // the recorded-locator baseline never learns
    try {
      // Break first, THEN run: runHealed()/runBaseline() capture the armed set and
      // re-apply it after their own reset (see the trap noted in the plan).
      await resetApp();
      breaks.forEach((k) => applyBreak(k));
      if (arm === 'baseline') await runBaseline(); else if (arm === 'llm-only') await runLlmOnly(); else await runHealed();
      const runId = state.runId;
      const rows = state.log.filter((r) => r.run === runId && (arm === 'baseline') === (r.arm === 'baseline'));
      const summary = (arm === 'llm-only' ? state.runs.llmOnly : state.runs[arm]) || { ok: 0, total: INTENTS.length };
      const failed = rows.find((r) => r.outcome !== 'success' && r.outcome !== 'failed-predicate') || rows.find((r) => r.outcome !== 'success');
      const ok = summary.ok === summary.total;
      const out = {
        ok,
        arm,
        caption: CAPTION_TEXT,
        breaks,
        stepsOk: summary.ok,
        stepsTotal: summary.total,
        halted: !!summary.stopped,
        needsUser: !ok,
        userMessage: ok ? null : (arm === 'healed' && state.lastFatal) || (failed ? 'Step "' + failed.intent + '" failed: ' + failed.detail : 'The run did not complete.'),
        rows: rows.map(rowView),
      };
      if (opts.screenshot && state.lastShot) out.screenshot = state.lastShot;
      return out;
    } catch (e) {
      return { ok: false, needsUser: true, error: 'exception', userMessage: 'The assistant hit an internal error: ' + (e && e.message), rows: [] };
    } finally {
      clearChaos();
      memory.enabled = false;   // learned state stays; learning is switched on per call
    }
  }

  async function agentIntent(id, params) {
    const it = intentById(id);
    if (!it) return { ok: false, error: 'unknown-intent', userMessage: 'Unknown intent: ' + id };
    if (agentBusy()) return { ok: false, error: 'busy', userMessage: 'The assistant is already running a task.' };
    if (params && params.caption) CAPTION_TEXT = String(params.caption);
    running = true;
    try {
      const row = await runIntent(it, { order: 1 });
      const ok = row.outcome === 'success';
      return { ok, needsUser: !ok, userMessage: ok ? null : honestFailure(it, row), row: rowView(row), status: agentStatus() };
    } catch (e) {
      return { ok: false, needsUser: true, error: 'exception', userMessage: 'The assistant hit an internal error: ' + (e && e.message) };
    } finally {
      running = false;
      render();
    }
  }

  async function agentExperiment(n, set, arms) {
    await runExperiment(Math.max(1, Math.min(50, n || 1)), set || 'demo', arms);
    return Object.assign(JSON.parse(resultsJson()), { semantic: semanticStats() });
  }

  const semanticStats = () => ({
    enabled: semantic.enabled, provider: semantic.provider, calls: semantic.calls, errors: semantic.errors,
    cacheHits: semantic.cached, inputTokens: semantic.inTok, outputTokens: semantic.outTok, modelMs: Math.round(semantic.ms),
  });

  window.__FYP_AGENT = {
    version: AGENT_VERSION,
    ready: agentReady,
    describe: agentDescribe,
    status: agentStatus,
    runFlow: agentFlow,
    runIntent: agentIntent,
    survey: async () => { await surveyScreens(); return state.survey; },
    experiment: agentExperiment,
    results: () => JSON.parse(resultsJson()),
    resetApp: async () => { await resetApp(); return agentStatus(); },
    login: agentLogin,
    alive: agentAlive,
    // Teaching: record one demonstration, get a routine back, replay it through the ladder.
    teach: {
      start: teachStart,
      stop: teachStop,
      status: () => ({ recording: teach.on, name: teach.name, steps: teach.steps.length, warnings: teach.warnings.slice() }),
      suggest: teachSuggest,
    },
    runRoutine: agentRoutine,
    // The semantic (model) rung. The model itself is supplied by the runner as
    // window.__fypSemantic; with none, the rung simply does nothing.
    semantic: {
      configure: (o) => { semantic.enabled = !!(o && o.enabled) && typeof window.__fypSemantic === 'function'; return semantic.enabled; },
      stats: semanticStats,
      reset: () => { Object.assign(semantic, { calls: 0, errors: 0, ms: 0, inTok: 0, outTok: 0, cached: 0 }); return semanticStats(); },
    },
    // Route memory (see 4b): export / import it so it survives a fresh page.
    memory: {
      get: () => JSON.parse(JSON.stringify(memory.intents)),
      set: (obj) => { memory.intents = obj && typeof obj === 'object' ? JSON.parse(JSON.stringify(obj)) : {}; return Object.keys(memory.intents).length; },
      clear: () => { memory.intents = {}; return 0; },
      summary: () => Object.entries(memory.intents).map(([id, r]) => ({
        intent: id, runs: r.runs, route: ROUTES[r.route] ? ROUTES[r.route].name : null, avoid: r.avoid.map((x) => ROUTES[x].name),
        drifts: r.drifts, runsToSettle: r.settledAfter, settling: r.sinceDrift !== null && r.settledAfter === null,
        learned: !!r.learned,
      })),
    },
  };

  const boot = () => { if (document.body) panel(); else setTimeout(boot, 120); };
  boot();
})();
