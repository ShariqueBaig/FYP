#!/usr/bin/env node
/**
 * Contract lint for recorded specs.
 *
 * Every rule here catches something that silently bypasses the injected session,
 * producing exactly the bug this package exists to fix: an unauthenticated
 * context, which surfaces as a locator timeout at the spec's first click.
 *
 * Zero dependencies, so the generator can shell out to it after every emit:
 *
 *     node scripts/check-generated-specs.js                  # lints tests/generated/
 *     node scripts/check-generated-specs.js path/to/a.spec.ts # lints specific files
 *
 * Exits 0 when clean, 1 on any error, 2 on bad usage.
 */

"use strict";

const fs = require("fs");
const path = require("path");

const PACKAGE_ROOT = path.resolve(__dirname, "..");
const DEFAULT_DIR = path.join(PACKAGE_ROOT, "tests", "generated");

/** Each rule: a name, a matcher, and why it breaks. Order is report order. */
const RULES = [
  {
    name: "test.use",
    test: (line) => /\btest\s*\.\s*use\s*\(/.test(line),
    why: "test.use() overrides the project's storageState. The context becomes unauthenticated.",
  },
  {
    // Matches any receiver, not just a variable literally named `browser` -
    // `const b = await chromium.launch(); b.newContext()` must not slip through.
    // newContext/newPage are only ever browser or context methods, so a bare
    // match on the method name is safe here.
    name: "manual browser context",
    test: (line) => /\.\s*(newContext|newPage)\s*\(/.test(line),
    why: "A hand-made context or page ignores the project's storageState entirely.",
  },
  {
    name: "manual browser launch",
    test: (line) => /\b(chromium|firefox|webkit)\s*\.\s*launch\s*\(/.test(line),
    why: "Launching a browser bypasses the runner, its config, and the injected session.",
  },
  {
    name: "storageState reference",
    test: (line) => /\bstorageState\b/.test(line),
    why: "Recorded specs must not mention storageState. The config owns it.",
  },
  {
    name: "login navigation",
    test: (line) => /page\s*\.\s*goto\s*\(\s*['"`][^'"`]*(?:\/#\/)?(?:login|signin|sign-in)\b/i.test(line),
    why: "Do not navigate to the login page. The auth setup project has already logged in.",
  },
  {
    name: "hardcoded credential",
    test: (line) =>
      /\b(password|passwd|pwd|secret|mfa|otp|totp)\s*[:=]\s*['"`][^'"`]{3,}['"`]/i.test(line) &&
      !/^\s*(\/\/|\*)/.test(line),
    why: "Credentials belong in .env, never in a spec.",
  },
  {
    name: "parallel mode",
    test: (line) => /test\s*\.\s*describe\s*\.\s*configure\s*\(\s*\{[^}]*mode\s*:\s*['"]parallel/.test(line),
    why: "Parallel workers share one session and collide on unique entity names.",
  },
  {
    name: "excessive test timeout",
    test: (line) => {
      const match = /test\s*\.\s*setTimeout\s*\(\s*([\d_]+)\s*\)/.exec(line);
      return !!match && Number(match[1].replace(/_/g, "")) > 600_000;
    },
    why: "A timeout above 10 minutes hangs the generator's run loop on a genuine failure.",
  },
  {
    name: "own config",
    test: (line) => /\bdefineConfig\s*\(/.test(line),
    why: "A recorded spec must not define its own Playwright config.",
  },
];

/** Rules that need to see the whole file rather than one line. */
const FILE_RULES = [
  {
    name: "navigation in a hook",
    why: "A goto() inside beforeEach/beforeAll usually means a hand-rolled login. The setup project handles auth.",
    find(source) {
      const hits = [];
      const hook = /\btest\s*\.\s*(beforeEach|beforeAll)\s*\(/g;
      let match;
      while ((match = hook.exec(source)) !== null) {
        const body = extractBalanced(source, hook.lastIndex - 1);
        if (body && /page\s*\.\s*goto\s*\(/.test(body)) {
          hits.push({ index: match.index, detail: `test.${match[1]}` });
        }
      }
      return hits;
    },
  },
];

/** Return the substring from an opening paren to its match, or null if unbalanced. */
function extractBalanced(source, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < source.length; i++) {
    const c = source[i];
    if (c === "(") depth++;
    else if (c === ")") {
      depth--;
      if (depth === 0) return source.slice(openIndex, i + 1);
    }
  }
  return null;
}

function stripStringsAndComments(line) {
  return line
    .replace(/\/\/.*$/, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(['"`])(?:\\.|(?!\1)[^\\])*\1/g, "''");
}

function lineOf(source, index) {
  return source.slice(0, index).split("\n").length;
}

function lintFile(file) {
  const source = fs.readFileSync(file, "utf8");
  const findings = [];

  source.split(/\r?\n/).forEach((rawLine, i) => {
    const trimmed = rawLine.trim();
    // Skip comment-only lines: the generator emits commented `// ASSERT` hints,
    // and its `// Step N: ...` labels can legitimately contain words like "login".
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("*")) return;

    for (const rule of RULES) {
      const subject = rule.name === "login navigation" ? rawLine : stripStringsAndComments(rawLine);
      const target = rule.name === "hardcoded credential" ? rawLine : subject;
      if (rule.test(target)) {
        findings.push({ line: i + 1, rule: rule.name, why: rule.why, snippet: trimmed.slice(0, 120) });
      }
    }
  });

  for (const rule of FILE_RULES) {
    for (const hit of rule.find(source)) {
      findings.push({
        line: lineOf(source, hit.index),
        rule: rule.name,
        why: rule.why,
        snippet: hit.detail,
      });
    }
  }

  return findings.sort((a, b) => a.line - b.line);
}

function collectTargets(args) {
  if (args.length > 0) {
    return args.map((a) => path.resolve(a)).filter((f) => fs.existsSync(f) && fs.statSync(f).isFile());
  }
  if (!fs.existsSync(DEFAULT_DIR)) return [];
  return fs
    .readdirSync(DEFAULT_DIR, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".spec.ts"))
    .map((e) => path.join(DEFAULT_DIR, e.name));
}

function checkNaming(file) {
  const base = path.basename(file);
  const problems = [];
  if (!/^[a-z0-9][a-z0-9-]*\.spec\.ts$/.test(base)) {
    problems.push(`"${base}" should be lowercase [a-z0-9-] and end in .spec.ts`);
  }
  if (/^auth/.test(base)) {
    problems.push(`"${base}" must not start with "auth" - it would collide with the setup project`);
  }
  return problems;
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes("-h") || args.includes("--help")) {
    console.log("Usage: node scripts/check-generated-specs.js [file.spec.ts ...]");
    process.exit(2);
  }

  const files = collectTargets(args);
  if (files.length === 0) {
    console.log(`[check] no specs found in ${path.relative(PACKAGE_ROOT, DEFAULT_DIR)}/ - nothing to check.`);
    process.exit(0);
  }

  let errors = 0;

  for (const file of files) {
    const shown = path.relative(PACKAGE_ROOT, file);

    for (const problem of checkNaming(file)) {
      console.error(`${shown}: ${problem}`);
      errors++;
    }

    for (const finding of lintFile(file)) {
      console.error(`${shown}:${finding.line}  [${finding.rule}] ${finding.why}`);
      console.error(`    ${finding.snippet}`);
      errors++;
    }
  }

  if (errors > 0) {
    console.error(
      `\n[check] ${errors} problem${errors === 1 ? "" : "s"} across ${files.length} file${files.length === 1 ? "" : "s"}.` +
        `\n[check] See the contract in README.md for what a recorded spec may and may not contain.`,
    );
    process.exit(1);
  }

  console.log(`[check] ${files.length} spec${files.length === 1 ? "" : "s"} OK.`);
  process.exit(0);
}

main();
