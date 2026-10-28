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
    for (const d of [el].concat(Array.from(el.querySelectorAll('*')))) {
      const bg = getComputedStyle(d).backgroundImage;
      if (bg && bg !== 'none') return parseFloat(getComputedStyle(d).opacity);
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
  const CAPTION_TEXT = 'fyp demo post';

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
      // it changes nothing and the success predicate could never become true.
      testId: 'gallery-cell-2',
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
      value: CAPTION_TEXT,
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
      testId: 'share-button',
      labels: ['share'],
      anchor: 'More options',
      region: 'sticky-bottom',
      ordinal: 0,
      success: () => detectScreen() === 1,
      successDesc: 'returned to the feed',
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
    const exact = cs.filter((c) => c.hook === intent.testId);
    if (exact.length) return exact;
    // Fall back to a prefix match so `gallery-cell-0` can stand for the group.
    const prefixes = intent.testId.endsWith('-0') ? [intent.testId.replace(/-0$/, '-')] : [];
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
  const route_label = (intent, cs) => preferExact(intent, cs.filter((c) => c.label && kw(c.label, intent.labels)), 'label');

  /** Route 2 - visible text. Breaks on copy or locale change. */
  const route_text = (intent, cs) => preferExact(intent, cs.filter((c) => c.text && kw(c.text, intent.labels)), 'text');

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
  const route_vision = (intent, cs) => {
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

  const ROUTES = [
    { name: 'id', grade: GRADES.id, run: route_id },
    { name: 'label', grade: GRADES.label, run: route_label },
    { name: 'text', grade: GRADES.text, run: route_text },
    { name: 'scoped', grade: GRADES.scoped, run: route_scoped },
    { name: 'vision', grade: GRADES.vision, run: route_vision },
  ];

  /**
   * Resolve one intent against a snapshot. Walks the ladder and returns the
   * first route that matches EXACTLY ONE control. That uniqueness requirement is
   * what prevents the wrong-element click that ambiguous locators cause.
   */
  function resolve(intent, cs) {
    const tried = [];
    for (let i = 0; i < ROUTES.length; i++) {
      const route = ROUTES[i];
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
    prog: '', // live breadcrumb: which intent / route / candidate is running
    recording: false, // true while that walk runs, so it is not logged as evidence
    chaos: { active: {}, undo: [] },
    lastFatal: '',
    lastShot: null, // data URL of what the harness saw when it gave up
    runId: 0, // one per Run press, so rows can be grouped into runs
    ctx: { rep: null }, // set by the N-times experiment
    exp: { active: false, stop: false, rep: 0, n: 0, label: '' },
    survey: null, // per-screen accessibility measurement
  };

  function logRow(row) {
    // A baseline RECORDING pass is not an experiment result - it is the act of
    // writing the script. Logging it would double every row in the scoreboard.
    if (state.recording) return row;
    row.timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);      row.run = state.runId;
    row.rep = state.ctx.rep;
    row.config = Object.keys(state.chaos.active).sort().join('+') || 'clean';
    state.log.push(row);
    render();
    return row;
  }

  // ===========================================================================
  // 7. Running the flow
  // ===========================================================================
  let running = false;

  /** One intent, healed: walk the ladder, act, then verify the predicate. */
  async function runIntent(intent, opts) {
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

    for (let i = 0; i < ROUTES.length; i++) {
      const route = ROUTES[i];
      let hits = [];
      try {
        hits = route.run(intent, csNow) || [];
      } catch (e) {
        hits = [];
      }

      // The geometry route may legitimately offer SEVERAL candidates. When every
      // hook and label is gone, the honest move is to search the neighbourhood in
      // order until the goal is met - not to commit to one blind guess. This is the
      // "screen-graph neighbourhood search" idea from the source material.
      let candidates;
      if (route.name === 'vision' && intent.visionSweep) {
        candidates = hits.slice(0, 12);
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
          });
        }

        // The candidate resolved, the action landed without raising, and yet the
        // goal is not met: a wrong-element hit or an obscured tap. Record it and
        // move on rather than retrying the same control blindly.
        attempts.push(tag + '(no effect)');
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
    render();

    // Reset (which ensures the recording exists), then re-arm the breaks. The
    // baseline is a hard-coded locator recorded when the app was healthy - it is
    // SUPPOSED to run against a changed UI and die.
    const armed = Object.keys(state.chaos.active);
    await resetApp();
    for (const k of armed) applyBreak(k);

    const rows = [];
    let ok = 0;
    for (let i = 0; i < INTENTS.length; i++) {
      const intent = INTENTS[i];
      const t0 = now();
      const sel = state.baseline[intent.id];
      let outcome = 'success';
      let detail = 'the stored locator resolved';
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
        if (intent.action === 'type') typeInto(el, intent.value);
        else realClick(el);
        await sleep(500);
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
          detail,
          ms: Math.round(now() - t0),
          order: i + 1,
        })
      );
    }
    state.runs.baseline = { ok, total: INTENTS.length };
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
    render();

    // Order matters. Reset needs intact hooks to navigate home, and the run must
    // then face the broken UI - otherwise there would be nothing to heal and the
    // harness would look impressive for no reason.
    const armed = Object.keys(state.chaos.active);
    await resetApp();
    for (const k of armed) applyBreak(k);

    let ok = 0;
    for (let i = 0; i < INTENTS.length; i++) {
      const row = await runIntent(INTENTS[i], { order: i + 1 });
      if (row.outcome === 'success') ok++;
      else if (row.outcome !== 'failed-predicate') {
        // A hard stop means the flow cannot continue; say why, in words.
        state.lastFatal = honestFailure(INTENTS[i], row);
        state.lastShot = null;
        render();
        state.lastShot = await captureShot();
        render();
        break;
      }
    }
    state.runs.healed = { ok, total: INTENTS.length };
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
  async function resetApp() {
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
  function controlAtScreenNext() {
    const s = detectScreen();
    const cs = collect();
    // Hook first, then a hook-free fallback: B1 renames every hook, and a break
    // that cannot find its target would silently do nothing.
    const byText = (t, region) => cs.find((c) => c.text.toLowerCase() === t && inRegion(c, region));
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

  function surveyHtml() {
    const sv = state.survey;
    if (!sv || !sv.length) return '<div class="fyp-muted" style="margin-top:6px">Press Re-measure to survey every screen.</div>';
    const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
    const T = sv.reduce((a, r) => ({ total: a.total + r.total, unnamed: a.unnamed + r.unnamed, notButton: a.notButton + r.notButton }), { total: 0, unnamed: 0, notButton: 0 });
    return (
      '<table class="fyp-log" style="margin-top:6px"><thead><tr><th>screen</th><th>controls</th><th>no name</th><th>no role</th></tr></thead><tbody>' +
      sv.map((r) => '<tr><td>' + r.screen + '</td><td>' + r.total + '</td><td>' + r.unnamed + ' (' + pct(r.unnamed, r.total) + '%)</td><td>' + r.notButton + ' (' + pct(r.notButton, r.total) + '%)</td></tr>').join('') +
      '<tr><td><b>all</b></td><td><b>' + T.total + '</b></td><td><b>' + T.unnamed + ' (' + pct(T.unnamed, T.total) + '%)</b></td><td><b>' + T.notButton + ' (' + pct(T.notButton, T.total) + '%)</b></td></tr>' +
      '</tbody></table>'
    );
  }

  // ===========================================================================
  // 9c. Results: summary table, CSV export, and the N-times experiment
  // ===========================================================================
  const CSV_COLS = ['timestamp', 'arm', 'config', 'rep', 'run', 'order', 'intent_id', 'route_index', 'route_name', 'grade', 'outcome', 'diagnosis', 'outcome_detail', 'ms_elapsed', 'tree_hash'];

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
      const e = (runs[key] = runs[key] || { config: r.config || 'clean', arm, ok: 0, actionsOk: 0 });
      if (r.outcome === 'success') {
        e.ok++;
        if (actionIds.indexOf(r.intent) >= 0) e.actionsOk++;
      }
    }
    const agg = {};
    for (const e of Object.values(runs)) {
      const k = e.config + '|' + e.arm;
      const a = (agg[k] = agg[k] || { config: e.config, arm: e.arm, runs: 0, steps: 0, full: 0, total });
      a.runs++;
      a.steps += e.ok;
      if (e.actionsOk === actionIds.length) a.full++;
    }
    return Object.values(agg).sort((x, y) => (x.config === y.config ? (x.arm < y.arm ? -1 : 1) : x.config.length - y.config.length || (x.config < y.config ? -1 : 1)));
  }

  function summaryCsv() {
    const lines = ['config,arm,runs,mean_steps_ok,steps_total,flow_completed_runs,flow_completed_pct'];
    for (const a of summarise()) {
      lines.push([a.config, a.arm, a.runs, (a.steps / a.runs).toFixed(2), a.total, a.full, Math.round((100 * a.full) / a.runs)].map(csvCell).join(','));
    }
    return lines.join('\n');
  }

  function download(name, text) {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function resultsHtml() {
    const rows = summarise();
    const ex = state.exp;
    const prog = ex.active
      ? '<div class="fyp-muted" style="margin-bottom:6px">Running: round ' + ex.rep + ' of ' + ex.n + ' &middot; ' + ex.label + '</div>'
      : '';
    if (!rows.length) return prog + '<div class="fyp-muted">No runs yet. Run all, or Run N&times;.</div>';
    return (
      prog +
      '<table class="fyp-log"><thead><tr><th>config</th><th>arm</th><th>runs</th><th>steps</th><th>flow done</th></tr></thead><tbody>' +
      rows
        .map((a) => {
          const good = a.full === a.runs;
          return (
            '<tr class="' + (good ? 'ok' : 'bad') + '"><td title="' + a.config + '">' + a.config + '</td><td>' + a.arm + '</td><td>' + a.runs +
            '</td><td>' + (a.steps / a.runs).toFixed(1) + '/' + a.total + '</td><td>' + a.full + '/' + a.runs + '</td></tr>'
          );
        })
        .join('') +
      '</tbody></table>'
    );
  }

  const PRESETS = {
    full: [[], ['B1'], ['B2'], ['B3'], ['B4'], ['B5'], ['B6'], ['B7'], ['B8'], ['B1', 'B2', 'B3', 'B4'], ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7'], ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8']],
    demo: [[], ['B1'], ['B4'], ['B6'], ['B7'], ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8']],
  };

  /** Both arms, N times, over a set of break configurations. */
  async function runExperiment(n, which) {
    if (running || state.exp.active) return;
    const presets = PRESETS[which] || PRESETS.demo;
    state.exp = { active: true, stop: false, rep: 0, n, label: '' };
    try {
      for (let r = 1; r <= n && !state.exp.stop; r++) {
        state.exp.rep = r;
        state.ctx.rep = r;
        for (const preset of presets) {
          if (state.exp.stop) break;
          state.exp.label = (preset.join('+') || 'clean') + ' &middot; baseline then healed';
          render();
          await resetApp();
          preset.forEach((k) => applyBreak(k));
          await runBaseline();
          await runHealed();
        }
      }
    } finally {
      state.ctx.rep = null;
      state.exp.active = false;
      clearChaos();
      await resetApp();
      render();
    }
  }

  function flash(msg) {
    const t = document.createElement('div');
    t.textContent = msg;
    t.setAttribute('data-fyp-toast', '1');
    t.style.cssText =
      'position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:100000;background:#111;color:#fff;' +
      'border:1px solid #444;border-radius:8px;padding:8px 14px;font:13px/1.4 system-ui,sans-serif;';
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  }

  function routeChips() {
    const counts = {};
    for (const r of state.log) if (r.arm !== 'baseline' && r.route) counts[r.route] = (counts[r.route] || 0) + 1;
    const order = ['id', 'label', 'text', 'scoped', 'vision', 'none'];
    return order
      .filter((k) => counts[k])
      .map((k) => '<span class="fyp-chip">' + k + ' x' + counts[k] + '</span>')
      .join('');
  }

  function rowsHtml() {
    const rows = state.log.slice(-70).reverse();
    if (!rows.length) return '<div class="fyp-muted">No attempts yet. Press Measure, then Run.</div>';
    return (
      '<table class="fyp-log"><thead><tr><th>#</th><th>intent</th><th>route</th><th>grade</th><th>outcome</th><th>ms</th></tr></thead><tbody>' +
      rows
        .map(
          (r) =>
            '<tr class="' + (r.outcome === 'success' ? 'ok' : 'bad') + '">' +
            '<td>' + (r.order == null ? '-' : r.order) + '</td>' +
            '<td>' + r.intent + '</td>' +
            '<td>' + r.route + '</td>' +
            '<td>' + r.grade + '</td>' +
            '<td title="' + String(r.detail || '').replace(/"/g, '') + '">' + r.outcome + '</td>' +
            '<td>' + r.ms + '</td></tr>'
        )
        .join('') +
      '</tbody></table>'
    );
  }

  function render() {
    if (!panelEl) return;
    const m = (measure = measure || measureAccessibility());
    const arms = state.runs;
    panelEl.querySelector('#fyp-metrics').innerHTML =
      '<div class="fyp-metric"><span>Controls measured</span><b>' + m.total + '</b></div>' +
      '<div class="fyp-metric"><span>No accessible name</span><b class="bad">' + m.unnamed + ' (' + m.pct + '%)</b></div>' +
      '<div class="fyp-metric"><span>Not exposed as a button</span><b class="bad">' + m.notButton + ' (' + m.notButtonPct + '%)</b></div>' +
      '<div class="fyp-metric"><span>role="button" elements</span><b class="bad">' + m.unnamedRole + '</b></div>' +
      '<div class="fyp-metric"><span>Baseline (hard-coded)</span><b>' + (arms.baseline ? arms.baseline.ok + '/' + arms.baseline.total + ' steps' : 'not run') + '</b></div>' +
      '<div class="fyp-metric"><span>Healed (this harness)</span><b class="' + (arms.healed && arms.healed.ok === arms.healed.total ? 'ok' : '') + '">' + (arms.healed ? arms.healed.ok + '/' + arms.healed.total + ' steps' : 'not run') + '</b></div>' +
      '<div class="fyp-metric"><span>Routes used</span><div>' + (routeChips() || '<span class="fyp-muted">-</span>') + '</div></div>';

    panelEl.querySelector('#fyp-survey').innerHTML = surveyHtml();
    panelEl.querySelector('#fyp-results').innerHTML = resultsHtml();

    panelEl.querySelector('#fyp-intents').innerHTML = INTENTS.map((it) => {
      const done = state.log.filter((r) => r.intent === it.id).slice(-1)[0];
      const cls = !done ? 'pend' : done.outcome === 'success' ? 'ok' : 'bad';
      return '<div class="fyp-intent ' + cls + '"><span>' + it.id + '</span><em>' + (done ? done.route + ' · ' + done.outcome : '—') + '</em></div>';
    }).join('');

    panelEl.querySelector('#fyp-log').innerHTML = rowsHtml();

    panelEl.querySelector('#fyp-chaos').innerHTML = Object.keys(BREAKS)
      .map((k) => {
        const on = state.chaos.active[k];
        return '<button class="fyp-break' + (on ? ' on' : '') + '" data-break="' + k + '" title="' + BREAKS[k].note + '">' + BREAKS[k].label + '</button>';
      })
      .join('') + '<button class="fyp-break reset" data-break="__clear">Reset all breaks</button>';

    const fatal = panelEl.querySelector('#fyp-fatal');
    if (state.lastFatal) {
      fatal.style.display = 'block';
      fatal.innerHTML =
        '<b>The assistant, reporting honestly:</b><br>"' + state.lastFatal + '"' +
        (state.lastShot
          ? '<div style="margin-top:8px;font-size:10px;color:#fca5a5">What I was looking at:</div>' +
            '<img alt="screenshot of the screen when the harness gave up" src="' + state.lastShot +
            '" style="width:100%;margin-top:4px;border:1px solid #5c2b2b;border-radius:6px">'
          : '');
    } else {
      fatal.style.display = 'none';
    }
  }

  function panel() {
    if (panelEl) return panelEl;
    const css = document.createElement('style');
    css.textContent = `
#${PANEL_ID}{position:fixed;top:8px;right:8px;width:392px;max-height:94vh;overflow:auto;z-index:100000;
 background:#0b0b0d;color:#e8e8ea;border:1px solid #2c2c31;border-radius:10px;
 font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;box-shadow:0 8px 40px rgba(0,0,0,.6)}
#${PANEL_ID} h1{margin:0;padding:9px 11px;font-size:12px;letter-spacing:.02em;background:#141418;
 border-bottom:1px solid #2c2c31;border-radius:9px 9px 0 0;display:flex;justify-content:space-between;align-items:center}
#${PANEL_ID} h1 small{color:#8a8a93;font-weight:400}
#${PANEL_ID} .fyp-sec{padding:9px 11px;border-bottom:1px solid #1e1e23}
#${PANEL_ID} .fyp-sec>h2{margin:0 0 7px;font-size:10px;text-transform:uppercase;letter-spacing:.09em;color:#8a8a93;font-weight:600}
#${PANEL_ID} button{font:inherit;background:#1b1b20;color:#e8e8ea;border:1px solid #33333a;border-radius:6px;
 padding:6px 9px;cursor:pointer}
#${PANEL_ID} button:hover{background:#24242b}
#${PANEL_ID} button.pri{background:#2563eb;border-color:#2563eb;color:#fff}
#${PANEL_ID} button.warn{background:#3a1d1d;border-color:#5c2b2b}
#${PANEL_ID} .fyp-row{display:flex;gap:6px;flex-wrap:wrap}
#${PANEL_ID} .fyp-metric{display:flex;justify-content:space-between;gap:10px;padding:2px 0}
#${PANEL_ID} .fyp-metric span{color:#a0a0a8}
#${PANEL_ID} b.ok{color:#4ade80}#${PANEL_ID} b.bad{color:#f87171}
#${PANEL_ID} .fyp-intent{display:flex;justify-content:space-between;gap:8px;padding:2px 0}
#${PANEL_ID} .fyp-intent em{color:#8a8a93;font-style:normal}
#${PANEL_ID} .fyp-intent.ok span{color:#4ade80}#${PANEL_ID} .fyp-intent.bad span{color:#f87171}
#${PANEL_ID} .fyp-intent.pend span{color:#8a8a93}
#${PANEL_ID} .fyp-break{width:calc(50% - 3px);text-align:left;font-size:11px}
#${PANEL_ID} .fyp-break.on{background:#7f1d1d;border-color:#b91c1c;color:#fff}
#${PANEL_ID} .fyp-break.reset{width:100%}
#${PANEL_ID} table.fyp-log{width:100%;border-collapse:collapse;font-size:10.5px}
#${PANEL_ID} table.fyp-log th{text-align:left;color:#8a8a93;font-weight:600;border-bottom:1px solid #2c2c31;padding:3px 3px}
#${PANEL_ID} table.fyp-log td{padding:3px 3px;border-bottom:1px solid #17171b;max-width:96px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#${PANEL_ID} tr.ok td:nth-child(5){color:#4ade80}#${PANEL_ID} tr.bad td:nth-child(5){color:#f87171}
#${PANEL_ID} .fyp-chip{display:inline-block;background:#1b1b20;border:1px solid #33333a;border-radius:99px;
 padding:1px 7px;margin:1px 3px 1px 0;font-size:10px}
#${PANEL_ID} .fyp-muted{color:#8a8a93}
#${PANEL_ID} #fyp-fatal{display:none;margin:0;padding:10px 11px;background:#2a1010;border-left:3px solid #ef4444;color:#fecaca}
`;
    document.head.appendChild(css);

    panelEl = document.createElement('div');
    panelEl.id = PANEL_ID;
    panelEl.innerHTML = `
<h1>FYP harness · intent-aware self-healing<small id="fyp-close" style="cursor:pointer">hide</small></h1>
<div class="fyp-sec">
  <h2>1 · Accessibility surface</h2>
  <div id="fyp-metrics"></div>
  <div id="fyp-survey"></div>
</div>
<div class="fyp-sec">
  <h2>2 · Intents (goals, not coordinates)</h2>
  <div id="fyp-intents"></div>
</div>
<div class="fyp-sec">
  <h2>3 · Run</h2>
  <div class="fyp-row">
    <button class="pri" id="fyp-run">Run all (healed)</button>
    <button id="fyp-step">Step</button>
    <button id="fyp-baseline">Run baseline</button>
    <button id="fyp-reset">Reset app</button>
    <button id="fyp-measure">Re-measure</button>
  </div>
</div>
<div class="fyp-sec">
  <h2>4 · Break the UI</h2>
  <div class="fyp-row" id="fyp-chaos"></div>
</div>
<div class="fyp-sec">
  <h2>5 · Results</h2>
  <div class="fyp-row" style="margin-bottom:7px;align-items:center">
    <button class="pri" id="fyp-exp-run">Run N&times;</button>
    <input id="fyp-exp-n" type="number" min="1" max="50" value="5" style="width:48px;background:#1b1b20;color:#e8e8ea;border:1px solid #33333a;border-radius:6px;padding:5px">
    <select id="fyp-exp-set" style="background:#1b1b20;color:#e8e8ea;border:1px solid #33333a;border-radius:6px;padding:5px">
      <option value="demo">demo set (6 configs)</option>
      <option value="full">full set (12 configs)</option>
    </select>
    <button id="fyp-exp-stop">Stop</button>
  </div>
  <div id="fyp-results"></div>
  <div class="fyp-row" style="margin-top:7px">
    <button id="fyp-dl-sum">Summary CSV</button>
    <button id="fyp-dl-log">Attempt log CSV</button>
    <button id="fyp-clear-log">Clear log</button>
  </div>
</div>
<div class="fyp-sec">
  <h2>6 · Attempt log</h2>
  <div id="fyp-log"></div>
</div>
<div id="fyp-fatal"></div>`;
    document.body.appendChild(panelEl);

    panelEl.querySelector('#fyp-run').onclick = () => runHealed().then(render);
    panelEl.querySelector('#fyp-step').onclick = () => stepOnce().then(render);
    panelEl.querySelector('#fyp-baseline').onclick = () => runBaseline().then(render);
    panelEl.querySelector('#fyp-reset').onclick = () => resetApp().then(render);
    panelEl.querySelector('#fyp-measure').onclick = () => surveyScreens();
    panelEl.querySelector('#fyp-exp-run').onclick = () => {
      const n = Math.max(1, Math.min(50, parseInt(panelEl.querySelector('#fyp-exp-n').value, 10) || 1));
      runExperiment(n, panelEl.querySelector('#fyp-exp-set').value);
    };
    panelEl.querySelector('#fyp-exp-stop').onclick = () => { state.exp.stop = true; flash('Stopping after the current configuration.'); };
    panelEl.querySelector('#fyp-dl-sum').onclick = () => download('fyp-summary.csv', summaryCsv());
    panelEl.querySelector('#fyp-dl-log').onclick = () => download('fyp-attempt-log.csv', logCsv());
    panelEl.querySelector('#fyp-clear-log').onclick = () => { state.log.length = 0; state.runs = { healed: null, baseline: null }; render(); };
    panelEl.querySelector('#fyp-close').onclick = () => { panelEl.style.display = 'none'; };
    panelEl.querySelector('#fyp-chaos').addEventListener('click', (e) => {
      const b = e.target.closest('[data-break]');
      if (!b) return;
      if (b.dataset.break === '__clear') clearChaos();
      else applyBreak(b.dataset.break);
    });

    measure = measureAccessibility();
    render();
    // Record the baseline while the app is still pristine, exactly once, so the
    // first Run press does not have to pay for the walkthrough. It replays once
    // more on demand if that recording never happened.
    if (!state.recorded) setTimeout(() => { if (!state.recorded && !state.recording) recordBaseline(); }, 1200);
    return panelEl;
  }

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
      const s = document.getElementById(DECOY_ID); if (s) s.remove();
      const o = document.getElementById(OVERLAY_ID); if (o) o.remove();
      panelEl = null;
      window[NS].active = false;
    },
  };

  const boot = () => { if (document.body) panel(); else setTimeout(boot, 120); };
  boot();
})();
