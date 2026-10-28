// Natural-language front end for the runner: "post a photo with caption hello"
// -> a tool call from tool-manifest.json. Deliberately rule-based, not an LLM:
//   * it works offline, with no key and no cost, and is the same every time, so
//     it can be unit-tested and cited;
//   * it never guesses. A request it cannot map exactly is handed back to the
//     user as a question or a plain "I can't do that yet", never acted on.
// An LLM planner can sit in front later and emit the same {tool, params} shape.

const CAPABILITIES = [
  'post a photo with a caption (for example: post a photo with the caption "hello")',
  'check how accessible the app is (how many controls have no accessible name)',
  'tell you what screen the app is on',
  'tell you what I can do',
];

const tidy = (s) => String(s).trim().replace(/^[\s"'“”‘’]+|[\s"'“”‘’.!?,;:]+$/g, '').trim();

/** Pull the caption out of an utterance, or null. Quoted text wins. */
export function extractCaption(u) {
  let m = u.match(/["“]([^"”]+)["”]/);                                  // "hello there"
  if (m) return tidy(m[1]);
  m = u.match(/(?:^|\s)['‘]([^'’]+)['’](?=\s|$|[.,!?])/);                 // 'hello there'
  if (m) return tidy(m[1]);
  m = u.match(/\b(?:captioned|caption|saying|that says|which says|says|with the text|titled|text)\b\s*(?:is|as|to|:|-)?\s*(.+)$/i);
  if (m && tidy(m[1])) return tidy(m[1]);
  return null;
}

/**
 * @returns one of
 *   { kind: 'tool', tool, params, heard }
 *   { kind: 'ask', question, heard }                    (needs one more fact from the user)
 *   { kind: 'unsupported' | 'unknown', userMessage }    (said honestly, nothing is run)
 */
/** Match a taught phrase such as "comment {comment} on the first post". Returns the
 *  captured values ({} for a phrase with no placeholders), or null. */
export function matchPhrase(heard, phrase) {
  const names = [];
  const src = String(phrase).trim().replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
    .replace(/\{(\w+)\}/g, (_, n) => { names.push(n); return '(.+?)'; });
  const m = String(heard).replace(/[.!?]+$/, '').match(new RegExp('(?:^|\\b)' + src + '(?:$|\\b)', 'i'));
  if (!m) return null;
  const values = {};
  names.forEach((n, i) => { values[n] = tidy(m[i + 1]); });
  return Object.values(values).some((v) => !v) ? null : values;
}

export function understand(utterance, routines = []) {
  const heard = String(utterance || '').trim();
  const u = heard.toLowerCase();
  if (!u) return { kind: 'unknown', userMessage: 'I did not hear a request. Try: ' + CAPABILITIES[0] + '.' };

  // Routines the user taught win over the built-in phrases: they said it that way.
  for (const r of routines) {
    for (const phrase of r.phrases || []) {
      const values = matchPhrase(heard, phrase);
      if (values) return { kind: 'tool', tool: 'routine', params: { name: r.name, values }, heard };
    }
  }

  const wantsPost =
    /\b(post|share|upload|publish)\b.*\b(photo|picture|pic|image|post|something)\b/.test(u) ||
    /\b(create|make|add|start)\b.*\b(new )?(post|photo)\b/.test(u) ||
    /\bnew post\b/.test(u);

  if (wantsPost) {
    const caption = extractCaption(heard);
    if (!caption) return { kind: 'ask', heard, question: 'What should the caption say?' };
    return { kind: 'tool', tool: 'create_post', params: { caption }, heard };
  }

  if (/\b(delete|remove|like|unlike|comment|follow|unfollow|message|dm|reply|block|report|story|reel)\b/.test(u)) {
    return { kind: 'unsupported', heard, userMessage: 'I cannot do that yet. I can ' + CAPABILITIES.slice(0, 2).join(', or ') + '.' };
  }
  if (/\b(accessib\w*|screen reader|unnamed|unlabell?ed|audit|a11y)\b/.test(u)) return { kind: 'tool', tool: 'accessibility_survey', params: {}, heard };
  if (/\b(what screen|where are you|current screen|status)\b/.test(u)) return { kind: 'tool', tool: 'status', params: {}, heard };
  if (/\b(what can you|help|capabilit|what do you do|options)\b/.test(u)) return { kind: 'tool', tool: 'describe', params: {}, heard };

  return { kind: 'unknown', heard, userMessage: 'I did not understand that, so I did nothing. I can ' + CAPABILITIES.join('; ') + '.' };
}

/** A first-person sentence to read aloud for a finished tool call. */
export function spokenSummary(tool, res) {
  if (!res) return '';
  if (tool === 'create_post') {
    if (res.ok) {
      const rows = res.rows || [];
      // Only a real fallback counts: scoped/vision (route index 3+) or the keyboard.
      // Using label or text when there is no id is the normal ladder, not a workaround.
      const fallbacks = rows.filter((r) => (r.routeIndex >= 3) || /keyboard/.test(String(r.route || ''))).length;
      return 'Done. I posted your photo with the caption ' + JSON.stringify(res.caption) + '.' +
        (fallbacks ? ' The app made this hard, so I had to use a fallback on ' + fallbacks + ' of ' + res.stepsTotal + ' steps.' : '');
    }
    return res.userMessage || 'I could not finish posting.';
  }
  if (tool === 'routine') {
    if (res.ok) return 'Done. I did "' + res.routine + '".';
    return res.userMessage || 'I could not finish that.';
  }
  if (tool === 'accessibility_survey') {
    const s = res.screens || [];
    const total = s.reduce((a, x) => a + x.total, 0), unnamed = s.reduce((a, x) => a + x.unnamed, 0);
    const worst = [...s].sort((a, b) => b.unnamed / Math.max(1, b.total) - a.unnamed / Math.max(1, a.total))[0];
    return unnamed + ' of ' + total + ' controls have no accessible name, so a screen reader has nothing to say for them.' +
      (worst && worst.unnamed ? ' The worst screen is ' + worst.screen + ': ' + worst.unnamed + ' of ' + worst.total + '.' : '');
  }
  if (tool === 'status') return 'The app is on the ' + (['', 'feed', 'gallery', 'caption', 'more options'][res.screen] || 'unknown') + ' screen.';
  if (tool === 'describe') return 'I can ' + CAPABILITIES.join('; ') + '.';
  return '';
}
