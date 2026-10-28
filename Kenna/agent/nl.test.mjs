// node agent/nl.test.mjs  - no browser, no network. Exits 1 on any failure.
import { understand } from './nl.mjs';
const cases = [
  ['post a photo with caption hello world', 'create_post', 'hello world'],
  ['Please share a picture, caption: Sunset at Clifton!', 'create_post', 'Sunset at Clifton'],
  ['upload a photo saying "it\'s a good day"', 'create_post', "it's a good day"],
  ['make a new post', 'ask'],
  ['delete my last post', 'unsupported'],
  ['like the first picture', 'unsupported'],
  ['how accessible is this app', 'accessibility_survey'],
  ['what screen are you on', 'status'],
  ['what can you do', 'describe'],
  ['order me a pizza', 'unknown'],
  ['', 'unknown'],
];
let bad = 0;
for (const [text, want, cap] of cases) {
  const r = understand(text);
  const got = r.kind === 'tool' ? r.tool : r.kind;
  const ok = got === want && (cap === undefined || (r.params && r.params.caption) === cap);
  if (!ok) { bad++; console.error('FAIL', JSON.stringify(text), '->', got, r.params || ''); }
}
console.log(bad ? bad + ' of ' + cases.length + ' failed' : 'all ' + cases.length + ' passed');
if (bad) process.exitCode = 1;

// Taught routines: phrases with and without a {placeholder}.
const taught = [{ name: 'like.first', phrases: ['like the first post'] }, { name: 'comment.first', phrases: ['comment {comment} on the first post'] }];
const t2 = [
  ['like the first post', 'like.first', {}],
  ['comment "lovely photo" on the first post', 'comment.first', { comment: 'lovely photo' }],
  ['like the second post', null],
];
let bad2 = 0;
for (const [text, name, values] of t2) {
  const r = understand(text, taught);
  const ok = name ? r.kind === 'tool' && r.tool === 'routine' && r.params.name === name && JSON.stringify(r.params.values) === JSON.stringify(values) : r.kind === 'unsupported';
  if (!ok) { bad2++; console.error('FAIL taught', JSON.stringify(text), r); }
}
console.log(bad2 ? bad2 + ' taught-phrase cases failed' : 'all ' + t2.length + ' taught-phrase cases passed');
if (bad2) process.exitCode = 1;
