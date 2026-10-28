// Protection probe: how does the protection layer in front of a site treat this
// agent? Runs N fresh, unmodified, paced trials and sorts each into what happened.
//
// This MEASURES and REPORTS. It never solves a challenge, spoofs a browser, rotates
// an IP or waits one out (plan 2.4, hard rule 1). A trial that is stopped is a
// result, not a problem to be worked around. The one legitimate way through is an
// allow-list the site owner controls (a Cloudflare Access service token passed as
// headers), and a trial that uses it is labelled as such.
import fs from 'node:fs';
import path from 'node:path';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Wilson score interval for k of n at 95%: honest for small n, unlike k/n +- sqrt. */
export function wilson(k, n, z = 1.96) {
  if (!n) return [null, null];
  const p = k / n, d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, +(c - h).toFixed(3)), Math.min(1, +(c + h).toFixed(3))];
}

const CLASSES = ['completed', 'challenged', 'access-gated', 'rate-limited', 'blocked', 'http-error', 'incomplete', 'unreachable'];

/** Pure, so it can be tested without a browser. */
export function classify({ navStatus, hdr = {}, finalUrl = '', title = '', sub = {}, flowOk = null, reached = true }) {
  if (!reached) return 'unreachable';
  if (/cloudflareaccess\.com/i.test(finalUrl)) return 'access-gated';
  if (hdr['cf-mitigated'] || /just a moment|verify you are human/i.test(title)) return 'challenged';
  if (navStatus === 429) return 'rate-limited';
  if (navStatus === 403 || /attention required|access denied/i.test(title)) return 'blocked';
  if (navStatus >= 400) return 'http-error';
  if (flowOk === true) return 'completed';
  if ((sub[429] || 0) > 0) return 'rate-limited';          // the page loaded but its files were throttled
  return 'incomplete';
}

export async function runProtect({ playwright, base, n, setting, gapMs, viewport, headers, out, headed, log }) {
  const browser = await playwright.chromium.launch({ headless: !headed, args: ['--no-sandbox'] });
  const trials = [];
  try {
    for (let t = 1; t <= n; t++) {
      const t0 = Date.now();
      const ctx = await browser.newContext({ viewport, ...(headers ? { extraHTTPHeaders: headers } : {}) });
      const page = await ctx.newPage();
      const sub = {};
      page.on('response', (r) => {
        const s = r.status();
        if (s >= 400 && r.request().resourceType() !== 'document') sub[s] = (sub[s] || 0) + 1;
      });
      const row = { trial: t, class: 'unreachable', navStatus: null, cfMitigated: '', rayId: '', sub429: 0, subOther: 0, stepsOk: null, ms: 0 };
      try {
        const nav = await page.goto(base + '/?demo=1&nc=' + Date.now(), { waitUntil: 'load', timeout: 45000 });
        const hdr = nav ? nav.headers() : {};
        const title = await page.title().catch(() => '');
        row.navStatus = nav ? nav.status() : null;
        row.cfMitigated = hdr['cf-mitigated'] || '';
        row.rayId = hdr['cf-ray'] || '';
        let flowOk = null;
        const gated = hdr['cf-mitigated'] || /cloudflareaccess\.com/i.test(page.url()) || (nav && nav.status() >= 400);
        if (!gated) {
          const ready = await page.evaluate(() => (window.__FYP_AGENT ? window.__FYP_AGENT.ready(25000) : false)).catch(() => false);
          if (ready) {
            const res = await page.evaluate(() => window.__FYP_AGENT.runFlow({})).catch(() => null);
            flowOk = !!(res && res.ok);
            row.stepsOk = res ? res.stepsOk : null;
          } else flowOk = false;
        }
        row.sub429 = sub[429] || 0;
        row.subOther = Object.entries(sub).filter(([s]) => s !== '429').reduce((a, [, c]) => a + c, 0);
        row.class = classify({ navStatus: row.navStatus, hdr, finalUrl: page.url(), title, sub, flowOk });
      } catch (e) {
        row.class = 'unreachable';
        row.error = String(e.message || e).split('\n')[0];
      }
      row.ms = Date.now() - t0;
      await ctx.close().catch(() => {});
      trials.push(row);
      log('probe ' + t + '/' + n + ' -> ' + row.class);
      if (t < n) await sleep(gapMs);                       // human-plausible pace, not a burst
    }
  } finally {
    await browser.close().catch(() => {});
  }

  const counts = Object.fromEntries(CLASSES.map((c) => [c, trials.filter((x) => x.class === c).length]));
  const rates = {};
  for (const c of CLASSES) if (counts[c]) rates[c] = { k: counts[c], n, rate: +(counts[c] / n).toFixed(3), ci95: wilson(counts[c], n) };
  const result = {
    ok: true, setting, url: base, n, gapMs,
    usedAccessToken: !!headers,
    counts, rates, trials,
    note: 'Each trial is a fresh, unmodified headless browser at a paced interval, with no evasion of any kind. Rates carry a 95% Wilson interval. A stopped trial is a measurement.',
  };
  if (out) {
    fs.mkdirSync(out, { recursive: true });
    const file = path.join(out, 'protection.csv');
    const head = 'timestamp,setting,access_token,trial,class,nav_status,cf_mitigated,sub_429,sub_other_4xx5xx,steps_ok,ms,ray_id\n';
    if (!fs.existsSync(file)) fs.writeFileSync(file, head);
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
    fs.appendFileSync(file, trials.map((x) => [ts, JSON.stringify(setting), !!headers, x.trial, x.class, x.navStatus ?? '', x.cfMitigated, x.sub429, x.subOther, x.stepsOk ?? '', x.ms, x.rayId].join(',')).join('\n') + '\n');
    fs.writeFileSync(path.join(out, 'protection-' + String(setting).replace(/[^a-z0-9]+/gi, '_').toLowerCase() + '.json'), JSON.stringify(result, null, 2));
    result.savedTo = path.resolve(out);
  }
  return result;
}
