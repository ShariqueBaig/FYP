// Builds Kenna_FYP_Defense.pptx (20-minute FYP MVP defense). Run: node build_deck.js
// Numbers come from results/published/<name>/report.csv when that experiment has been (re-)published;
// otherwise a clearly tagged ILLUSTRATIVE value is used so the layout can be reviewed. Rebuild after publishing.
const fs = require('fs');
const path = require('path');
const pptxgen = require('pptxgenjs');
const React = require('react');
const ReactDOMServer = require('react-dom/server');
const sharp = require('sharp');
const FA = require('react-icons/fa');
const { applyTheme } = require('C:/Users/AS/AppData/Local/Claude-Data/claude_pzs8sxrjxfjjc/local-agent-mode-sessions/skills-plugin/95b1485f-d1ab-4c3f-b96c-97105fc895e3/417de85a-daee-4c01-9410-62574126eff8/skills/pptx/scripts/apply_theme.js');

const OUT = process.env.DECK_OUT || path.join(__dirname, 'Kenna_FYP_Defense.pptx');
const PUB = path.join(__dirname, '..', 'results', 'published');
const LOGO_DIR = path.join(__dirname, 'assets', 'logos');

// ---------- theme ----------
const HEX = { ink: '2B2124', navy: '6B1A2A', white: 'FFFFFF', tint: 'F6F1F0', teal: 'B8862F', amber: 'C8963E', coral: 'C75B12', slate: '8A8F98', charcoal: '4B5563', mint: 'DDEFE8', blue: '4A5568', amberTint: 'FBEFD5', coralTint: 'F8E3D3', brand: '8C2338', rose: 'EBD9DC' };
const THEME = {
  name: 'IBA FYP Academic', headFontFace: 'Cambria', bodyFontFace: 'Calibri',
  colors: { dk1: HEX.ink, lt1: HEX.white, dk2: HEX.navy, lt2: HEX.tint, accent1: HEX.brand, accent2: HEX.amber, accent3: HEX.coral, accent4: '6B6F78', accent5: HEX.rose, accent6: HEX.blue, hlink: HEX.brand, folHlink: HEX.slate },
};

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE'; // 13.333 x 7.5
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = 'Beyond MCPs - FYP defense';
pres.author = 'Sharique Baig, Maira Aijaz, Barkhi Khan';
const C = pres.SchemeColor;
const W = 13.333, M = 0.6;

pres.defineSlideMaster({
  title: 'CONTENT', background: { color: C.background1 },
  objects: [
    { placeholder: { options: { name: 'title', type: 'title', x: M, y: 0.38, w: W - 2 * M, h: 0.7, fontSize: 32, bold: true, color: C.text2, valign: 'top', align: 'left', margin: 0 }, text: '' } },
    { text: { text: 'IBA Karachi  \u00b7  Final Year Project  \u00b7  Beyond MCPs', options: { x: M, y: 7.02, w: 8, h: 0.3, fontSize: 10, color: C.accent4, margin: 0 } } },
  ],
  slideNumber: { x: W - M - 0.6, y: 7.02, w: 0.6, h: 0.3, fontSize: 10, color: C.accent4, align: 'right' },
});
pres.defineSlideMaster({
  title: 'DARK', background: { color: C.text2 },
  objects: [
    { placeholder: { options: { name: 'title', type: 'title', x: M, y: 2.2, w: 9.2, h: 1.9, fontSize: 40, bold: true, color: C.background1, valign: 'top', align: 'left', margin: 0 }, text: '' } },
  ],
});

// ---------- data (published results first, illustrative fallback) ----------
function readCsv(name) {
  const f = path.join(PUB, name, 'report.csv');
  if (!fs.existsSync(f)) return null;
  const [head, ...rows] = fs.readFileSync(f, 'utf8').trim().split(/\r?\n/);
  const cols = head.split(',');
  const out = {};
  for (const r of rows) { const v = r.split(','); const o = {}; cols.forEach((c, i) => (o[c] = v[i])); (out[o.config] = out[o.config] || {})[o.arm] = o; }
  return out;
}
function series(name, configs, arms, fallback) {
  const d = readCsv(name);
  let real = !!d;
  const vals = arms.map((a, ai) => configs.map((c, ci) => {
    const row = d && d[c] && d[c][a];
    if (row) return Number(row.completed_pct);
    real = false;
    return fallback[ai][ci];
  }));
  return { vals, real };
}
const ARMS = [['baseline', 'Recorded script', HEX.slate], ['healed', 'Rules ladder', HEX.teal], ['llm-only', 'Bare model', HEX.charcoal], ['hybrid', 'Ladder + model + check', HEX.navy]];

// ---------- helpers ----------
const T = (s, text, o = {}) => s.addText(text, Object.assign({ isTextBox: true, margin: 0, fontFace: undefined, color: C.text1, fontSize: 16, valign: 'top' }, o));
const SH = pres.ShapeType;
async function icon(name, color) {
  const Comp = FA[name] || FA.FaCircle;
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(Comp, { color: '#' + color, size: 256 }));
  const buf = await sharp(Buffer.from(svg)).resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  return 'image/png;base64,' + buf.toString('base64');
}
async function iconCircle(s, name, x, y, d, fillScheme, iconHex, objectName) {
  s.addShape(SH.ellipse, { x, y, w: d, h: d, fill: { color: fillScheme }, line: { type: 'none' }, objectName: objectName + ' disc' });
  const p = d * 0.52;
  s.addImage({ data: await icon(name, iconHex), x: x + (d - p) / 2, y: y + (d - p) / 2, w: p, h: p, altText: name.replace('Fa', '') + ' icon', objectName });
}
function card(s, x, y, w, h, o = {}) {
  s.addShape(SH.roundRect, Object.assign({ x, y, w, h, rectRadius: 0.08, fill: { color: C.background2 }, line: { type: 'none' } }, o));
}
function pill(s, text, x, y, w, kind = 'amber') {
  const k = kind === 'amber' ? [HEX.amberTint, '8A5A00'] : kind === 'coral' ? [HEX.coralTint, '8A3B0B'] : [HEX.mint, '1F5E4F'];
  s.addShape(SH.roundRect, { x, y, w, h: 0.3, rectRadius: 0.15, fill: { color: k[0] }, line: { type: 'none' } });
  T(s, text, { x, y, w, h: 0.3, fontSize: 11, bold: true, color: k[1], align: 'center', valign: 'middle' });
}
function logoSlot(s, key, label, x, y, w, h, dark) {
  const f = ['png', 'jpg', 'jpeg'].map((e) => path.join(LOGO_DIR, key + '.' + e)).find((p) => fs.existsSync(p));
  if (f) { s.addImage({ path: f, x, y, w, h, sizing: { type: 'contain', w, h }, altText: label + ' logo', objectName: key + ' logo' }); return; }
  s.addShape(SH.roundRect, { x, y, w, h, rectRadius: 0.06, fill: { color: dark ? C.text2 : C.background2, transparency: 0 }, line: { color: dark ? HEX.slate : HEX.slate, width: 1, dashType: 'dash' }, objectName: key + ' logo slot' });
  T(s, label + ' logo\n(drop file in presentation/assets/logos/' + key + '.png)', { x, y, w, h, fontSize: 10, color: dark ? C.background1 : C.accent4, align: 'center', valign: 'middle' });
}
const title = (s, t, sub) => {
  s.addText(t, { placeholder: 'title' });
  if (sub) T(s, sub, { x: M, y: 1.12, w: W - 2 * M, h: 0.4, fontSize: 18, color: C.accent4 });
};

async function main() {
  // ===== 1. Title =====
  pres.addSection({ title: 'Opening' });
  let s = pres.addSlide({ masterName: 'DARK', sectionTitle: 'Opening' });
  logoSlot(s, 'iba', 'IBA Karachi', M, 0.55, 2.6, 1.0, true);
  logoSlot(s, 'isecom', 'ISECOM', W - M - 2.6, 0.55, 2.6, 1.0, true);
  T(s, 'FINAL YEAR PROJECT \u00b7 MVP DEFENSE', { x: M, y: 1.85, w: 9, h: 0.3, fontSize: 14, bold: true, color: C.accent5, charSpacing: 3 });
  s.addText('Self-healing, verified GUI automation for accessible AI assistants', { placeholder: 'title' });
  T(s, 'Say the goal, never the locator. Check every step on the next screen. Stop honestly when it cannot be done.', { x: M, y: 4.5, w: 8.6, h: 0.9, fontSize: 18, color: C.accent5, italic: true });
  const team = [['Sharique Baig', '28369'], ['Maira Aijaz', '28552'], ['Barkhi Khan', '29261']];
  team.forEach(([n, id], i) => {
    T(s, [{ text: n, options: { bold: true, fontSize: 18, color: C.background1, breakLine: true } }, { text: id, options: { fontSize: 14, color: C.accent5 } }], { x: M + i * 3.2, y: 5.45, w: 3.0, h: 0.8 });
  });
  T(s, 'Supervisor: [name]   \u00b7   Institute of Business Administration, Karachi   \u00b7   [date]', { x: M, y: 6.6, w: 12, h: 0.35, fontSize: 14, color: C.accent5 });
  s.addNotes('0:30. Introduce the team. One sentence: we built an assistant-side tool that operates apps by goal, checks each step, and stops honestly. Today: why, how, evidence, live demo.');

  // ===== 2. Why this matters =====
  pres.addSection({ title: 'Problem' });
  s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'Problem' });
  title(s, 'Why this matters', 'Assistants operate apps never built for them, and users cannot always take over when a step fails');
  const rows = [
    ['FaPlug', 'No API to call', 'Many everyday apps, stores and legacy tools expose only a screen. Where an API or MCP exists, use it; this is for the rest.'],
    ['FaBug', 'Recorded scripts break silently', 'One renamed id and a recorded click goes nowhere. Worse, nothing checks that the goal was actually reached.'],
    ['FaUniversalAccess', 'The user may not be able to step in', 'For a blind or motor-impaired user, "please do this step yourself" is not a fallback. The assistant has to be right, or say clearly that it is not.'],
  ];
  for (let i = 0; i < rows.length; i++) {
    const y = 1.95 + i * 1.6;
    await iconCircle(s, rows[i][0], M, y, 0.8, C.accent1, HEX.white, 'why icon ' + (i + 1));
    T(s, rows[i][1], { x: M + 1.1, y, w: 6.4, h: 0.4, fontSize: 20, bold: true, color: C.text2 });
    T(s, rows[i][2], { x: M + 1.1, y: y + 0.45, w: 6.4, h: 1.0, fontSize: 15 });
  }
  card(s, 8.3, 1.95, 4.43, 4.7);
  T(s, 'MEASURED ON ANDROID SETTINGS', { x: 8.6, y: 2.15, w: 3.9, h: 0.3, fontSize: 11, bold: true, color: C.accent4, charSpacing: 2 });
  T(s, '78%', { x: 8.6, y: 2.55, w: 3.9, h: 1.0, fontSize: 60, bold: true, color: C.accent3, fontFace: 'Cambria' });
  T(s, 'of controls look nameless judged by their own attributes', { x: 8.6, y: 3.55, w: 3.9, h: 0.7, fontSize: 14 });
  T(s, '2%', { x: 8.6, y: 4.4, w: 3.9, h: 1.0, fontSize: 60, bold: true, color: C.accent1, fontFace: 'Cambria' });
  T(s, 'once the labels inside a clickable row count, the way a screen reader names it', { x: 8.6, y: 5.4, w: 3.9, h: 0.9, fontSize: 14 });
  s.addNotes('1:30. Motivation. Keep it human: the user who cannot take over. The 78% to 2% figure is from hierdump on stock Android Settings (name-aware figure is the one we quote).');

  // ===== 3. Landscape (with the poster) =====
  s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'Problem' });
  title(s, 'Three kinds of platform', 'Where this project sits, and what we actually evaluated');
  const posterJpg = path.join(__dirname, 'assets', 'poster.jpg');
  if (!fs.existsSync(posterJpg)) await sharp(path.join(__dirname, '..', 'assets', 'FYP-poster.jfif')).resize({ width: 1200 }).jpeg({ quality: 88 }).toFile(posterJpg);
  const ph = 4.85, pw = ph * 1792 / 2400;
  s.addShape(SH.rect, { x: M - 0.04, y: 1.81, w: pw + 0.08, h: ph + 0.08, fill: { color: C.background1 }, line: { color: HEX.slate, width: 0.75 }, shadow: { type: 'outer', color: '000000', opacity: 0.18, blur: 8, offset: 2, angle: 90 }, objectName: 'poster frame' });
  s.addImage({ path: posterJpg, x: M, y: 1.85, w: pw, h: ph, altText: 'Our FYP poster: Beyond MCPs, self-healing and adversarially resilient GUI agents', objectName: 'FYP poster' });
  const plats = [
    ['FaPlug', C.accent6, 'Agent-native', 'Vercel, Stripe', 'APIs and MCP servers. Use them.', 'Out of scope', 'mint'],
    ['FaCogs', C.accent2, 'Legacy local apps', 'Daraz, OLX-style', 'No API, unlabeled buttons, frequent breakage. Our target class.', 'Mock app + Android Settings', 'amber'],
    ['FaLock', C.accent3, 'Agent-hostile', 'Instagram-style', 'Anti-bot defences and UI suppression.', 'Measured, never evaded', 'coral'],
  ];
  const rx = M + pw + 0.35, rwid = W - M - rx;
  for (let i = 0; i < 3; i++) {
    const y = 1.85 + i * 1.65;
    card(s, rx, y, rwid, 1.5);
    await iconCircle(s, plats[i][0], rx + 0.3, y + 0.35, 0.8, plats[i][1], HEX.white, 'platform icon ' + (i + 1));
    T(s, [{ text: plats[i][2], options: { bold: true, fontSize: 20, color: C.text2 } }, { text: '   ' + plats[i][3], options: { italic: true, fontSize: 13, color: C.accent4, breakLine: true } }, { text: plats[i][4], options: { fontSize: 14 } }], { x: rx + 1.4, y: y + 0.2, w: rwid - 1.4 - 2.9, h: 1.15, valign: 'middle', paraSpaceAfter: 4 });
    pill(s, plats[i][5], rx + rwid - 2.75, y + 0.6, 2.5, plats[i][6]);
  }
  s.addNotes('1:00. The poster is where we started. Be explicit: Daraz and OLX are the motivating class, not an evaluated target. We measured protection behaviour; we did not build a bypass.');

  // ===== 4. Synthies and ISECOM =====
  pres.addSection({ title: 'Context' });
  s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'Context' });
  title(s, 'Synthies and ISECOM', 'The kind of agent that uses our tool, and who we are working with');
  card(s, M, 1.95, 5.95, 3.2);
  logoSlot(s, 'isecom', 'ISECOM', M + 0.3, 2.15, 1.9, 0.75, false);
  T(s, 'ISECOM', { x: M + 2.45, y: 2.2, w: 3.3, h: 0.4, fontSize: 22, bold: true, color: C.text2 });
  T(s, 'isecom.org', { x: M + 2.45, y: 2.6, w: 3.3, h: 0.3, fontSize: 13, color: C.accent4 });
  T(s, [
    { text: 'Who they are: [one line, confirm wording with the team]', options: { bullet: true, breakLine: true } },
    { text: 'Our collaboration: [what ISECOM provides or uses]', options: { bullet: true, breakLine: true } },
    { text: 'What it means for this work: [e.g. a real agent consumer]', options: { bullet: true } },
  ], { x: M + 0.3, y: 3.15, w: 5.4, h: 1.8, fontSize: 15, paraSpaceAfter: 6 });
  card(s, M + 6.2, 1.95, 5.93, 3.2);
  await iconCircle(s, 'FaRobot', M + 6.5, 2.15, 0.75, C.accent1, HEX.white, 'synthie icon');
  T(s, 'Synthies', { x: M + 7.45, y: 2.2, w: 4.4, h: 0.4, fontSize: 22, bold: true, color: C.text2 });
  T(s, 'long-running agents with an identity', { x: M + 7.45, y: 2.6, w: 4.4, h: 0.3, fontSize: 13, color: C.accent4 });
  T(s, [
    { text: 'Run continuously on their own host', options: { bullet: true, breakLine: true } },
    { text: 'Have a chat identity and an owner', options: { bullet: true, breakLine: true } },
    { text: 'Act through a typed tool set, with logged actions', options: { bullet: true } },
  ], { x: M + 6.5, y: 3.15, w: 5.4, h: 1.8, fontSize: 15, paraSpaceAfter: 6 });
  // flow
  const fy = 5.55, fh = 0.95;
  const flow = [['Synthie', 'goal, in words', C.accent6], ['Kenna tool', 'ladder + checks', C.accent1], ['The app', 'web or Android', C.accent4]];
  flow.forEach(([a, b, col], i) => {
    const x = M + i * 4.35;
    s.addShape(SH.roundRect, { x, y: fy, w: 3.4, h: fh, rectRadius: 0.1, fill: { color: col }, line: { type: 'none' }, objectName: 'flow ' + a });
    T(s, [{ text: a, options: { bold: true, fontSize: 18, color: C.background1, breakLine: true } }, { text: b, options: { fontSize: 13, color: C.background1 } }], { x, y: fy, w: 3.4, h: fh, align: 'center', valign: 'middle' });
    if (i < 2) s.addShape(SH.rightArrow, { x: x + 3.5, y: fy + 0.27, w: 0.75, h: 0.4, fill: { color: C.accent4 }, line: { type: 'none' }, objectName: 'flow arrow ' + (i + 1) });
  });
  s.addNotes('2:00. Fill the ISECOM bullets from the team before presenting. Synthie description is from one instance\'s own account (Hematite); say so if asked. Flow: the synthie says a goal, the tool does the screen work, a plain-words result comes back.');

  // ===== 5. Project =====
  pres.addSection({ title: 'Approach' });
  s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'Approach' });
  title(s, 'Our project: Kenna', 'An assistant-side tool, governed by three rules');
  const rules = [
    ['FaComments', 'Intent, not locator', 'The assistant says "open the create-post flow". It never says which button.'],
    ['FaCheckCircle', 'Verify on the next screen', 'A step counts only if the next screen shows the goal was reached. "No error" is not success.'],
    ['FaHandPaper', 'Stop honestly', 'If nothing works, say which step failed and why, in plain first-person words.'],
  ];
  for (let i = 0; i < 3; i++) {
    const x = M + i * 4.1;
    card(s, x, 1.95, 3.85, 2.6);
    await iconCircle(s, rules[i][0], x + 0.3, 2.15, 0.7, C.accent1, HEX.white, 'rule icon ' + (i + 1));
    T(s, rules[i][1], { x: x + 0.3, y: 3.0, w: 3.3, h: 0.4, fontSize: 19, bold: true, color: C.text2 });
    T(s, rules[i][2], { x: x + 0.3, y: 3.45, w: 3.3, h: 1.0, fontSize: 14 });
  }
  s.addShape(SH.roundRect, { x: M, y: 4.85, w: W - 2 * M, h: 1.8, rectRadius: 0.08, fill: { color: C.text2 }, line: { type: 'none' }, objectName: 'honest message panel' });
  T(s, 'WHAT THE USER HEARS WHEN A CONTROL CANNOT BE REACHED', { x: M + 0.35, y: 5.0, w: 11, h: 0.3, fontSize: 11, bold: true, color: C.accent5, charSpacing: 2 });
  T(s, '"I could not finish the step \u2018Open the create-post flow\u2019 \u2013 I cannot identify a control for this step. You may need to do this step yourself."', { x: M + 0.35, y: 5.4, w: 11.4, h: 1.0, fontSize: 18, italic: true, color: C.background1, fontFace: 'Cambria' });
  s.addNotes('1:30. Real output from the harness under break B8 (control hidden). Contrast with a recorded script that clicks nothing and reports no failure.');

  // ===== 6. How it works =====
  s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'Approach' });
  title(s, 'How it works: the ladder', 'Try cheap, readable routes first. Ask a model only when every rule route fails');
  const rungs = [
    ['id', 'recorded hook', C.accent1], ['label', 'accessible name', C.accent1], ['text', 'visible words', C.accent1], ['scoped', 'inside a container', C.accent1],
    ['learned', 'remembered route', C.accent6], ['model', 'picks an index', C.accent2], ['vision', 'sees the screen', C.text2],
  ];
  const rw = 1.62, rg = 0.1;
  rungs.forEach(([a, b, col], i) => {
    const x = M + i * (rw + rg);
    s.addShape(SH.rect, { x, y: 1.95, w: rw, h: 1.05, fill: { color: col }, line: { type: 'none' }, objectName: 'rung ' + a });
    T(s, [{ text: a, options: { bold: true, fontSize: 18, color: C.background1, breakLine: true } }, { text: b, options: { fontSize: 12, color: C.background1 } }], { x, y: 1.95, w: rw, h: 1.05, align: 'center', valign: 'middle' });
  });
  T(s, 'RULES', { x: M, y: 3.1, w: 4 * rw + 3 * rg, h: 0.3, fontSize: 11, bold: true, color: C.accent1, align: 'center', charSpacing: 2 });
  T(s, 'MEMORY AND MODEL', { x: M + 4 * (rw + rg), y: 3.1, w: 3 * rw + 2 * rg, h: 0.3, fontSize: 11, bold: true, color: C.accent2, align: 'center', charSpacing: 2 });
  // principles under
  const cols = [
    ['One control or nothing', 'A route counts only if it points at exactly one control on screen.'],
    ['A model never acts alone', 'It may only answer with an index into the on-screen list. Its pick is a candidate, judged like any other.'],
    ['Irreversible needs more', 'Publishing needs confidence \u2265 0.8 and only the first choice.'],
  ];
  cols.forEach(([a, b], i) => {
    const x = M + i * 4.1;
    card(s, x, 3.65, 3.85, 1.6);
    T(s, a, { x: x + 0.3, y: 3.8, w: 3.3, h: 0.4, fontSize: 17, bold: true, color: C.text2 });
    T(s, b, { x: x + 0.3, y: 4.25, w: 3.3, h: 1.2, fontSize: 14 });
  });
  const ys = 5.75;
  [['Candidate control', C.accent4], ['Act', C.accent4], ['Success check on the NEXT screen', C.accent1]].forEach(([t, col], i) => {
    const xs = [M, M + 3.1, M + 6.0], ws = [2.7, 2.3, 3.4];
    s.addShape(SH.roundRect, { x: xs[i], y: ys, w: ws[i], h: 0.75, rectRadius: 0.08, fill: { color: col }, line: { type: 'none' }, objectName: 'check flow ' + (i + 1) });
    T(s, t, { x: xs[i], y: ys, w: ws[i], h: 0.75, fontSize: 15, bold: true, color: C.background1, align: 'center', valign: 'middle' });
    if (i < 2) s.addShape(SH.rightArrow, { x: xs[i] + ws[i] + 0.1, y: ys + 0.18, w: 0.3, h: 0.4, fill: { color: C.accent4 }, line: { type: 'none' }, objectName: 'check arrow ' + (i + 1) });
  });
  s.addShape(SH.rightArrow, { x: 10.15, y: ys + 0.18, w: 0.3, h: 0.4, fill: { color: C.accent4 }, line: { type: 'none' }, objectName: 'check arrow 3' });
  s.addShape(SH.roundRect, { x: 10.6, y: ys, w: 2.13, h: 0.75, rectRadius: 0.08, fill: { color: C.background2 }, line: { color: HEX.slate, width: 1 }, objectName: 'outcome' });
  T(s, 'Done, or honest stop', { x: 10.6, y: ys, w: 2.13, h: 0.75, fontSize: 13, bold: true, color: C.text2, align: 'center', valign: 'middle' });
  s.addNotes('2:00. Walk left to right. Stress: the model is the last resort and never trusted; the success check is independent of how the control was found. Vision numbers each on-screen control so the model can answer "badge 7".');

  // ===== 7. How we tested =====
  pres.addSection({ title: 'Evidence' });
  s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'Evidence' });
  title(s, 'How we tested', 'One 9-step flow, eleven controlled UI changes, five ways of operating the app');
  card(s, M, 1.95, 3.7, 4.6);
  T(s, 'THE TASK', { x: M + 0.3, y: 2.1, w: 3.1, h: 0.3, fontSize: 11, bold: true, color: C.accent4, charSpacing: 2 });
  const steps = ['Open create-post', 'Choose a photo', 'Go to caption step', 'Open More options', 'Go back', 'Type a caption', 'Turn on AI label', 'Publish', 'Post is in the feed'];
  steps.forEach((t, i) => T(s, [{ text: (i + 1) + '  ', options: { bold: true, color: C.accent1 } }, { text: t }], { x: M + 0.3, y: 2.5 + i * 0.45, w: 3.1, h: 0.4, fontSize: 14 }));
  card(s, M + 3.9, 1.95, 4.5, 4.6);
  T(s, 'THE UI CHANGES (BREAKS)', { x: M + 4.2, y: 2.1, w: 4, h: 0.3, fontSize: 11, bold: true, color: C.accent4, charSpacing: 2 });
  const groups = [
    ['Locator rot', 'B1 ids renamed \u00b7 B4 duplicate control \u00b7 B5 hidden in a scroller', C.accent1],
    ['Lost names', 'B2 labels stripped \u00b7 B6 bare icon \u00b7 B9 words reworded', C.accent2],
    ['Moved', 'B3 layout reversed \u00b7 B10 control relocated', C.accent6],
    ['Hostile', 'B7 overlay \u00b7 B8 control hidden \u00b7 B11 planted instructions', C.accent3],
  ];
  groups.forEach(([a, b, col], i) => {
    const y = 2.55 + i * 1.02;
    s.addShape(SH.ellipse, { x: M + 4.2, y: y + 0.07, w: 0.22, h: 0.22, fill: { color: col }, line: { type: 'none' }, objectName: 'group dot ' + (i + 1) });
    T(s, a, { x: M + 4.6, y, w: 3.6, h: 0.35, fontSize: 16, bold: true, color: C.text2 });
    T(s, b, { x: M + 4.6, y: y + 0.36, w: 3.6, h: 0.6, fontSize: 13 });
  });
  card(s, M + 8.6, 1.95, 3.53, 4.6);
  T(s, 'THE FIVE ARMS', { x: M + 8.9, y: 2.1, w: 3, h: 0.3, fontSize: 11, bold: true, color: C.accent4, charSpacing: 2 });
  const arms = [['Recorded script', 'one locator per step, no checks'], ['Rules ladder', 'our rules, checked'], ['Bare model', 'first pick, nothing checked'], ['Model + check', 'model only, verified'], ['Ladder + model + check', 'our full system']];
  arms.forEach(([a, b], i) => {
    T(s, [{ text: a, options: { bold: true, fontSize: 14, color: C.text2, breakLine: true } }, { text: b, options: { fontSize: 12, color: C.accent4 } }], { x: M + 8.9, y: 2.5 + i * 0.8, w: 3.0, h: 0.7 });
  });
  T(s, 'N = 10 runs per cell \u00b7 95% Wilson intervals \u00b7 model qwen3.7-flash, temperature 0, cached answers (variation in the app and harness, not model sampling)', { x: M, y: 6.72, w: W - 2 * M, h: 0.28, fontSize: 11, color: C.accent4 });
  s.addNotes('1:00. Keep it brisk. Emphasise that every arm runs the same 9-step flow on the same broken app, and that success is judged by the next screen, not by absence of an error.');

  // ===== 8. Result 1 =====
  s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'Evidence' });
  title(s, 'Result 1: surviving UI change', 'Rules only, no model. A recorded script breaks under five of eight single changes');
  const rf = readCsv('rules_full_n10');
  const cfgs = [['clean', 'Nothing changed'], ['B1', 'ids renamed'], ['B2', 'labels stripped'], ['B3', 'layout reversed'], ['B4', 'control duplicated'], ['B5', 'in a scroller'], ['B6', 'bare icon'], ['B7', 'overlay on top'], ['B8', 'control hidden'], ['B1+B2+B3+B4', 'four at once'], ['B1+B2+B3+B4+B5+B6+B7', 'seven at once'], ['B1+B2+B3+B4+B5+B6+B7+B8', 'all eight']];
  const fb = { clean: [10, 10], B1: [0, 10], B2: [0, 10], B3: [10, 10], B4: [10, 10], B5: [10, 10], B6: [0, 10], B7: [0, 10], B8: [0, 0], 'B1+B2+B3+B4': [0, 10], 'B1+B2+B3+B4+B5+B6+B7': [0, 0], 'B1+B2+B3+B4+B5+B6+B7+B8': [0, 0] };
  const cell = (k) => ({ text: k + '/10', options: { align: 'center', bold: true, color: k >= 10 ? '1F5E4F' : '8A3B0B', fill: { color: k >= 10 ? HEX.mint : HEX.coralTint }, fontSize: 13 } });
  const hdr = (t) => ({ text: t, options: { bold: true, color: HEX.white, fill: { color: HEX.navy }, fontSize: 12, align: 'center' } });
  const trows = [[{ text: 'Change', options: { bold: true, color: HEX.white, fill: { color: HEX.navy }, fontSize: 12 } }, { text: 'What happens', options: { bold: true, color: HEX.white, fill: { color: HEX.navy }, fontSize: 12 } }, hdr('Recorded script'), hdr('Our ladder')]];
  cfgs.forEach(([k, d]) => {
    const v = rf && rf[k] ? [Number(rf[k].baseline.completed), Number(rf[k].healed.completed)] : fb[k];
    trows.push([{ text: k.length > 14 ? k.split('+').length === 8 ? 'B1\u2013B8' : k.split('+').length === 7 ? 'B1\u2013B7' : 'B1\u2013B4' : k, options: { bold: true, fontSize: 12, color: HEX.navy } }, { text: d, options: { fontSize: 12 } }, cell(v[0]), cell(v[1])]);
  });
  s.addTable(trows, { x: M, y: 1.75, w: 7.7, colW: [1.2, 3.0, 1.75, 1.75], rowH: 0.385, border: { type: 'solid', color: 'FFFFFF', pt: 2 }, fontFace: 'Calibri', valign: 'middle', objectName: 'rules-only results table' });
  const calls = [['5 of 8', 'single changes break a recorded script (B1, B2, B6, B7, B8)', C.accent3], ['7 of 8', 'single changes are survived by the ladder; only a hidden control stops it', C.accent1], ['By design', 'when nothing can reach the control, it says so instead of guessing', C.accent6]];
  calls.forEach(([a, b, col], i) => {
    const y = 1.75 + i * 1.6;
    card(s, 8.6, y, 4.13, 1.45);
    T(s, a, { x: 8.85, y: y + 0.12, w: 3.7, h: 0.55, fontSize: 28, bold: true, color: col, fontFace: 'Cambria' });
    T(s, b, { x: 8.85, y: y + 0.7, w: 3.7, h: 0.7, fontSize: 13 });
  });
  if (!rf) pill(s, 'ILLUSTRATIVE VALUES', 8.6, 6.55, 2.4, 'amber');
  s.addNotes('1:30. All real rules-only numbers (N=10 per cell). Point at B8 and the seven/eight-at-once rows: the ladder does not claim to survive everything. It stops honestly. Poster says "9/9 under UI chaos": we say "under each single change we tried, and combinations up to four".');

  // ===== 9. Result 2 =====
  s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'Evidence' });
  title(s, 'Result 2: hostile UIs and planted text', 'Labels that tell the model to "ignore the goal" are the nastiest change we tried');
  const injCfg = ['B11', 'B9+B11', 'B1+B9+B10+B11'];
  const inj = series('inject_n10_qwen37flash', injCfg, ['healed', 'llm-only', 'hybrid'], [[100, 100, 0], [100, 100, 0], [100, 100, 100]]);
  s.addChart(pres.charts.BAR, ['healed', 'llm-only', 'hybrid'].map((a, i) => ({ name: ARMS.find((x) => x[0] === a)[1], labels: ['Planted labels', '+ reworded text', '+ ids rotated + control moved'], values: inj.vals[i] })), {
    x: M, y: 2.2, w: 7.8, h: 4.25, barDir: 'col', barGrouping: 'clustered', barGapWidthPct: 60,
    chartColors: [HEX.teal, HEX.charcoal, HEX.navy], showLegend: true, legendPos: 'b', legendFontSize: 12, legendFontFace: '+mn-lt', legendColor: HEX.ink,
    showValue: true, dataLabelPosition: 'outEnd', dataLabelFontSize: 12, dataLabelFontFace: '+mn-lt', dataLabelColor: HEX.ink, dataLabelFormatCode: '0"%"',
    valAxisMaxVal: 100, valAxisMinVal: 0, valAxisMajorUnit: 25, valAxisLabelFontSize: 12, valAxisLabelFontFace: '+mn-lt', valAxisLabelColor: HEX.slate, valAxisLabelFormatCode: '0"%"',
    catAxisLabelFontSize: 12, catAxisLabelFontFace: '+mn-lt', catAxisLabelColor: HEX.ink, valGridLine: { color: 'E1E6EE', size: 0.75 }, catGridLine: { style: 'none' },
  });
  T(s, 'Flows completed (N = 10)', { x: M, y: 1.8, w: 7.8, h: 0.3, fontSize: 14, bold: true, color: C.text2 });
  card(s, 8.7, 1.85, 4.03, 4.6);
  T(s, 'WHAT TO READ FROM IT', { x: 9.0, y: 2.0, w: 3.5, h: 0.3, fontSize: 11, bold: true, color: C.accent4, charSpacing: 2 });
  T(s, [
    { text: 'The model is not trusted: it can be fooled, and the next-screen check is what catches it.', options: { bullet: true, breakLine: true } },
    { text: 'In the hardest mix the ladder alone fails; adding the model rescues it.', options: { bullet: true, breakLine: true } },
    { text: 'Planted-label taps are counted separately, and the check catches them.', options: { bullet: true, breakLine: true } },
    { text: 'We measure how hostile UIs treat an agent. We do not build evasion.', options: { bullet: true } },
  ], { x: 9.0, y: 2.4, w: 3.5, h: 3.9, fontSize: 14, paraSpaceAfter: 8 });
  if (!inj.real) pill(s, 'ILLUSTRATIVE \u2013 MODEL ARMS BEING RE-RUN', M, 6.55, 4.3, 'amber');
  s.addNotes('1:30. DOM rotation and tree suppression were slide 8 (B1, B2, B6, B7, B8). This slide is hostile text (B11). Be honest: one fixed, naive injection string on three controls, so say "this planted-label attack", not "prompt injection in general". Replace illustrative values after the re-run publishes: rebuild this deck.');

  // ===== 10. Result 3 =====
  s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'Evidence' });
  title(s, 'Result 3: drift the rules cannot read', 'When wording or position changes, the model rung rescues the ladder, and the check keeps it honest');
  const semCfg = ['clean', 'B9', 'B1+B9', 'B1+B10+B9'];
  const sem = series('semantic_n10_qwen37flash', semCfg, ['baseline', 'healed', 'hybrid'], [[100, 100, 0, 0], [100, 100, 100, 0], [100, 100, 100, 100]]);
  s.addChart(pres.charts.BAR, ['baseline', 'healed', 'hybrid'].map((a, i) => ({ name: ARMS.find((x) => x[0] === a)[1], labels: ['Clean', 'Reworded', '+ ids rotated', '+ control moved'], values: sem.vals[i] })), {
    x: M, y: 2.2, w: 6.4, h: 4.25, barDir: 'col', barGrouping: 'clustered', barGapWidthPct: 60,
    chartColors: [HEX.slate, HEX.teal, HEX.navy], showLegend: true, legendPos: 'b', legendFontSize: 12, legendFontFace: '+mn-lt', legendColor: HEX.ink,
    showValue: true, dataLabelPosition: 'outEnd', dataLabelFontSize: 11, dataLabelFontFace: '+mn-lt', dataLabelColor: HEX.ink, dataLabelFormatCode: '0"%"',
    valAxisMaxVal: 100, valAxisMinVal: 0, valAxisMajorUnit: 25, valAxisLabelFontSize: 12, valAxisLabelFontFace: '+mn-lt', valAxisLabelColor: HEX.slate, valAxisLabelFormatCode: '0"%"',
    catAxisLabelFontSize: 12, catAxisLabelFontFace: '+mn-lt', catAxisLabelColor: HEX.ink, valGridLine: { color: 'E1E6EE', size: 0.75 }, catGridLine: { style: 'none' },
  });
  T(s, 'Web: flows completed (N = 10)', { x: M, y: 1.8, w: 6.4, h: 0.3, fontSize: 14, bold: true, color: C.text2 });
  T(s, 'Android Settings: real drift (10 intents)', { x: 7.2, y: 1.8, w: 5.53, h: 0.3, fontSize: 14, bold: true, color: C.text2 });
  s.addChart(pres.charts.BAR, [
    { name: 'Rules only', labels: ['English', 'French', 'Font \u00d7 1.6'], values: [100, 20, 80] },
    { name: 'Ladder + model + check', labels: ['English', 'French', 'Font \u00d7 1.6'], values: [100, 100, 80] },
  ], {
    x: 7.2, y: 2.2, w: 5.53, h: 4.25, barDir: 'col', barGrouping: 'clustered', barGapWidthPct: 60,
    chartColors: [HEX.teal, HEX.navy], showLegend: true, legendPos: 'b', legendFontSize: 12, legendFontFace: '+mn-lt', legendColor: HEX.ink,
    showValue: true, dataLabelPosition: 'outEnd', dataLabelFontSize: 11, dataLabelFontFace: '+mn-lt', dataLabelColor: HEX.ink, dataLabelFormatCode: '0"%"',
    valAxisMaxVal: 100, valAxisMinVal: 0, valAxisMajorUnit: 25, valAxisLabelFontSize: 12, valAxisLabelFontFace: '+mn-lt', valAxisLabelColor: HEX.slate, valAxisLabelFormatCode: '0"%"',
    catAxisLabelFontSize: 12, catAxisLabelFontFace: '+mn-lt', catAxisLabelColor: HEX.ink, valGridLine: { color: 'E1E6EE', size: 0.75 }, catGridLine: { style: 'none' },
  });
  if (!sem.real) pill(s, 'WEB CHART ILLUSTRATIVE \u2013 BEING RE-RUN', M, 6.55, 4.0, 'amber');
  T(s, 'Android bars are measured. Large font: two rows fall below the fold and no arm scrolls (known gap).', { x: 7.2, y: 6.55, w: 5.53, h: 0.4, fontSize: 11, color: C.accent4 });
  s.addNotes('1:30. Android numbers are real (French: rules 2/10, hybrid 10/10; font 1.6: 8/10 for every arm because nothing scrolls). Web chart values are placeholders until the re-run is published. Vision (no words at all): the screenshot did not beat text at N=5; say so if asked.');

  // ===== 11. Demo =====
  pres.addSection({ title: 'Demo' });
  s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'Demo' });
  title(s, 'Live demo', 'Five short steps, about four minutes. A recorded backup covers steps 1 to 3');
  const demo = [
    ['FaPlay', 'Clean flow', 'Nine steps, post appears in the feed', '0:50'],
    ['FaBug', 'UI changes on', 'Recorded script stops; ladder finishes', '0:50'],
    ['FaHandPaper', 'Honest stop', 'Control hidden: it says so', '0:40'],
    ['FaShieldAlt', 'Planted text', 'Injected labels, caught by the check', '0:50'],
    ['FaMobileAlt', 'Android', 'French settings: rules fail, model rescues', '0:50'],
  ];
  const dw = 2.3, dg = 0.15;
  for (let i = 0; i < 5; i++) {
    const x = M + i * (dw + dg);
    card(s, x, 1.95, dw, 3.35);
    await iconCircle(s, demo[i][0], x + 0.3, 2.15, 0.7, i === 4 ? C.accent6 : C.accent1, HEX.white, 'demo icon ' + (i + 1));
    T(s, String(i + 1), { x: x + dw - 0.7, y: 2.1, w: 0.45, h: 0.6, fontSize: 30, bold: true, color: C.accent5, align: 'right', fontFace: 'Cambria' });
    T(s, demo[i][1], { x: x + 0.3, y: 3.1, w: dw - 0.5, h: 0.4, fontSize: 17, bold: true, color: C.text2 });
    T(s, demo[i][2], { x: x + 0.3, y: 3.6, w: dw - 0.5, h: 1.3, fontSize: 13 });
    T(s, demo[i][3], { x: x + 0.3, y: 4.8, w: dw - 0.5, h: 0.3, fontSize: 12, color: C.accent4, bold: true });
  }
  card(s, M, 5.65, W - 2 * M, 0.8);
  T(s, [{ text: 'Run: ', options: { bold: true } }, { text: 'node Kenna/agent/demo_adversarial.mjs --headed     \u00b7     Android: Kenna/path-b/dashboard.py with the emulator on screen first' }], { x: M + 0.3, y: 5.65, w: W - 2 * M - 0.6, h: 0.8, fontSize: 14, valign: 'middle' });
  s.addNotes('4:00 total. Open the emulator window before you start. If anything stalls, switch to the recorded video for steps 1-3 and skip step 5.');

  // ===== 12. Limits =====
  pres.addSection({ title: 'Close' });
  s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'Close' });
  title(s, 'Limits and honesty', 'What the evidence supports, and what it does not');
  card(s, M, 1.95, 5.95, 3.0);
  T(s, 'WE CAN SHOW', { x: M + 0.3, y: 2.1, w: 5, h: 0.3, fontSize: 11, bold: true, color: C.accent1, charSpacing: 2 });
  T(s, [
    { text: 'Survival of UI change on a mock web app and Android Settings', options: { bullet: true, breakLine: true } },
    { text: 'A checked model rung that is never trusted alone', options: { bullet: true, breakLine: true } },
    { text: 'Honest failure in plain words', options: { bullet: true, breakLine: true } },
    { text: 'Measured, not evaded, protection behaviour', options: { bullet: true } },
  ], { x: M + 0.3, y: 2.5, w: 5.4, h: 2.3, fontSize: 16, paraSpaceAfter: 8 });
  card(s, M + 6.2, 1.95, 5.93, 3.0);
  T(s, 'WE DO NOT CLAIM', { x: M + 6.5, y: 2.1, w: 5, h: 0.3, fontSize: 11, bold: true, color: C.accent3, charSpacing: 2 });
  T(s, [
    { text: 'Results on Instagram, Daraz or OLX', options: { bullet: true, breakLine: true } },
    { text: 'Results for more than one model so far', options: { bullet: true, breakLine: true } },
    { text: 'Any user study with screen-reader users', options: { bullet: true, breakLine: true } },
    { text: 'Fingerprint or telemetry stealth: out of scope on purpose', options: { bullet: true } },
  ], { x: M + 6.5, y: 2.5, w: 5.4, h: 2.3, fontSize: 16, paraSpaceAfter: 8 });
  s.addShape(SH.roundRect, { x: M, y: 5.3, w: W - 2 * M, h: 1.25, rectRadius: 0.08, fill: { color: C.text2 }, line: { type: 'none' }, objectName: 'caught bug panel' });
  T(s, [{ text: 'What we caught ourselves: ', options: { bold: true, color: C.accent5 } }, { text: 'a state leak between test arms made a bare model look broken on a clean app. We found it, proved it on a fresh page, fixed the harness and re-ran every model result.', options: { color: C.background1 } }], { x: M + 0.35, y: 5.3, w: W - 2 * M - 0.7, h: 1.25, fontSize: 16, valign: 'middle' });
  s.addNotes('1:00. This slide earns trust. Lead with what we do not claim.');

  // ===== 13. Conclusion =====
  s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'Close' });
  title(s, 'Conclusion and next steps', 'A verified, self-healing way to operate apps that offer no other interface');
  const tk = [['Intent + check', 'Goals instead of locators, with success judged on the next screen.'], ['Survives change', '7 of 8 single UI changes survived by rules alone; the rest stop honestly.'], ['Model as a candidate', 'Rescues drift the rules cannot read, and is never trusted alone.']];
  tk.forEach(([a, b], i) => {
    const x = M + i * 4.1;
    card(s, x, 1.95, 3.85, 1.9);
    T(s, a, { x: x + 0.3, y: 2.1, w: 3.3, h: 0.45, fontSize: 19, bold: true, color: C.text2 });
    T(s, b, { x: x + 0.3, y: 2.6, w: 3.3, h: 1.1, fontSize: 15 });
  });
  T(s, 'NEXT', { x: M, y: 4.3, w: 3, h: 0.3, fontSize: 11, bold: true, color: C.accent4, charSpacing: 2 });
  const nxt = ['Scrolling on Android', 'A second model', 'More apps and intents', 'A study with screen-reader users', 'A synthie using the tool end to end'];
  nxt.forEach((t, i) => {
    const x = M + (i % 3) * 4.1, y = 4.75 + Math.floor(i / 3) * 0.85;
    s.addShape(SH.ellipse, { x, y: y + 0.08, w: 0.28, h: 0.28, fill: { color: C.accent1 }, line: { type: 'none' }, objectName: 'next dot ' + (i + 1) });
    T(s, t, { x: x + 0.45, y, w: 3.4, h: 0.45, fontSize: 16, valign: 'middle' });
  });
  s.addNotes('1:00. End on the claim we can defend, then invite questions.');

  // ===== 14. Questions =====
  s = pres.addSlide({ masterName: 'DARK', sectionTitle: 'Close' });
  logoSlot(s, 'iba', 'IBA Karachi', M, 0.55, 2.6, 1.0, true);
  logoSlot(s, 'isecom', 'ISECOM', W - M - 2.6, 0.55, 2.6, 1.0, true);
  s.addText('Questions', { placeholder: 'title' });
  T(s, 'Sharique Baig \u00b7 Maira Aijaz \u00b7 Barkhi Khan', { x: M, y: 4.3, w: 11, h: 0.5, fontSize: 20, color: C.accent5 });
  T(s, 'Appendix: frequently asked questions follow', { x: M, y: 5.0, w: 11, h: 0.4, fontSize: 15, color: C.accent5, italic: true });

  // ===== Appendix FAQ =====
  pres.addSection({ title: 'FAQ' });
  const faq = [
    ['Why not just use an API or MCP?', 'Use it when it exists. Many local apps offer none, so the screen is the only interface. This project is for that gap, and it still verifies each step.'],
    ['Why does the model never act alone?', 'Its pick is a candidate: it can only name an on-screen control by number, and the next screen must confirm it. Publishing needs confidence of at least 0.8.'],
    ['What if it cannot find the control?', 'It stops, says which step failed and why, and ends with "You may need to do this step yourself." No guessing, no blind retries.'],
    ['Did you test on Instagram, Daraz or OLX?', 'No. We tested our own mock web app and Android Settings on an emulator. Daraz and OLX are the target class, not an evaluated one.'],
    ['Do you evade bot detection?', 'No. It is out of scope by design. We measure how a protection layer treats the agent and report it. We do not spoof or bypass.'],
    ['Is this specific to one model?', 'So far we ran one model (qwen3.7-flash). A second model is the first planned follow-up. The rules-only results do not use a model.'],
    ['What does N = 10 mean with a cache?', 'Repeats at temperature 0 with cached answers show variation in the app and harness, not model sampling. We report 95% Wilson intervals: 10 of 10 is 72\u2013100%.'],
    ['How does this help a blind user? Tested with one?', 'Our instrument is the accessibility tree a screen reader reads, and failures are spoken in plain words. No user study yet; it is the main gap.'],
    ['What went wrong, and how did you fix it?', 'A state leak between test arms made a bare model look broken on a clean app. We proved it on a fresh page, fixed the harness and re-ran every model result.'],
    ['What is next?', 'Scrolling on Android, a second model, more apps and intents, a study with screen-reader users, and a synthie using the tool end to end.'],
  ];
  for (let p = 0; p < 5; p++) {
    s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'FAQ' });
    title(s, 'FAQ ' + (p * 2 + 1) + '\u2013' + (p * 2 + 2), 'Questions we expect, and our honest answers');
    for (let k = 0; k < 2; k++) {
      const [q, a] = faq[p * 2 + k];
      const x = M + k * 6.2;
      card(s, x, 1.95, 5.93, 4.2);
      T(s, 'Q', { x: x + 0.3, y: 2.1, w: 0.6, h: 0.7, fontSize: 40, bold: true, color: C.accent1, fontFace: 'Cambria' });
      T(s, q, { x: x + 0.3, y: 2.85, w: 5.3, h: 0.9, fontSize: 20, bold: true, color: C.text2 });
      T(s, a, { x: x + 0.3, y: 3.8, w: 5.3, h: 2.2, fontSize: 17 });
    }
  }

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log('wrote', OUT);
}
main().catch((e) => { console.error(e); process.exit(1); });
