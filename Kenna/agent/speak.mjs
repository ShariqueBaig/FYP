// Voice feedback: what the assistant says out loud while it works and when it is done.
// First person, plain words, always honest: "Done" only when the check on the next screen passed;
// otherwise it says what it could not do and that the user may need to do the step themselves.
// Pure sentence builders (tested in speak.test.mjs) plus one small `sayAloud` that uses the machine's own
// speech engine (Windows System.Speech, macOS `say`, Linux `espeak`/`spd-say` when present). No install, no network.
import { spawnSync } from 'node:child_process';

const clean = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const lower1 = (s) => (s ? s[0].toLowerCase() + s.slice(1) : s);

/** One sentence for one finished step. `descs` maps intent id -> plain description. */
export function stepSentence(row, descs = {}) {
  const what = clean(descs[row.intent] || row.intent);
  const n = row.order ? 'Step ' + row.order + '. ' : '';
  if (row.outcome === 'success') return n + what + '. Done.';
  return n + what + '. I could not do this step.';
}

/** The closing sentence(s) for a whole run (web `run` result shape). */
export function finalSentence(res, descs = {}) {
  if (!res) return '';
  if (res.ok && res.stepsOk === res.stepsTotal) {
    const rows = res.rows || [];
    const fallbacks = rows.filter((r) => r.routeIndex >= 3 || /keyboard/.test(String(r.route || ''))).length;
    return 'Task completed successfully. I did all ' + res.stepsTotal + ' steps and checked each one on screen.' +
      (fallbacks ? ' The app made this hard, so I had to use a fallback on ' + fallbacks + ' of them.' : '');
  }
  const done = res.stepsOk || 0, total = res.stepsTotal || 0;
  // The text is for the eye as well as the ear: drop the bracketed route list and read dashes as pauses.
  const msg = clean(String(res.userMessage || '').replace(/\[[^\]]*\]/g, ' ').replace(/ [-–—] /g, ', '));
  return (msg || 'I could not finish the task.') + ' I completed ' + done + ' of ' + total + ' steps, and I stopped instead of guessing.' +
    (/yourself/i.test(msg) ? '' : ' You may need to do the rest yourself.');
}

/** The full thing to read: optionally every step, then the closing sentence. */
export function narrate(res, { steps = false, descs = {} } = {}) {
  const parts = [];
  if (steps) for (const r of res.rows || []) parts.push(stepSentence(r, descs));
  parts.push(finalSentence(res, descs));
  return parts.join(' ');
}

/** One Android intent (a live-event "intent-end" payload) as a sentence. */
export function intentSentence({ goal, outcome }) {
  const g = clean(goal);
  return outcome === 'success' ? 'Done. ' + g + '.' : 'I could not do this: ' + lower1(g) + '. I stopped instead of guessing. You may need to do it yourself.';
}

/** Say it with the machine's own voice. Blocks until finished so spoken sentences keep their order. */
export function sayAloud(text, { rate = 0, platform = process.platform, run = spawnSync } = {}) {
  const t = clean(text);
  if (!t) return false;
  const env = { ...process.env, FYP_SAY: t };
  if (platform === 'win32') {
    run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Rate = ' + Math.max(-10, Math.min(10, rate | 0)) + '; $s.Speak($env:FYP_SAY)'], { env, stdio: 'ignore' });
    return true;
  }
  if (platform === 'darwin') { run('say', [t], { stdio: 'ignore' }); return true; }
  for (const cmd of [['spd-say', ['-w', t]], ['espeak', [t]]]) {
    const r = run(cmd[0], cmd[1], { stdio: 'ignore' });
    if (r && !r.error) return true;
  }
  return false;
}
