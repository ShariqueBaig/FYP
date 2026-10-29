/**
 * Wraps overlay.js into a `javascript:` URI bookmarklet.
 * Run: node build-bookmarklet.js
 * Outputs bookmarklet.txt (the raw URI) and updates install.html.
 */
const fs = require("fs");
const path = require("path");

// Wrap in an IIFE-safe way and URI-encode. No external minifier available
// in this environment (no network access to fetch one), so this does a
// light manual squeeze: strip full-line comments and collapse blank lines.
// Still works perfectly -- bookmarklet length limits are a non-issue in
// modern Chromium/Island browsers, which is exactly why there is no
// block-comment (/* */) stripping step here any more: a real incident found
// it deleting live code. exportPlaywright() builds a
// generated test's header comment via H.push("/**") ... H.push(" */") --
// those are ordinary STRING ARGUMENTS, not real comments, but a naive
// /\*[\s\S]*?\*\// regex can't tell the difference from raw text. It paired
// the "/**" string with the LATER "*/" string and deleted everything between
// them, including the real `const liveAsserts = ...` declaration -- which
// then threw "liveAsserts is not defined" the instant Record tab tried to
// render its live preview. This shipped silently because the test suite only
// ever ran raw overlay.js, never this squeezed output (see
// tests/build-output.test.js, added the same day, which now runs the REAL
// squeezed bookmarklet through the same harness specifically to catch this
// class of bug). Full-line `//` stripping is left in: it only fires when an
// ENTIRE line, after whitespace, IS a comment -- it can't be fooled by a
// string that merely CONTAINS "//" mid-line, which is the failure mode that
// bit the block-comment version.
function lightSqueeze(code) {
  return code
    .replace(/^\s*\/\/.*$/gm, "") // full-line // comments (keeps inline URLs etc. safe since we don't touch mid-line //)
    .replace(/\n\s*\n/g, "\n") // collapse blank lines
    .trim();
}

function build() {
  let src = fs.readFileSync(path.join(__dirname, "overlay.js"), "utf-8");

  // Stamp the actual build time into the bookmarklet so a stale dragged bookmark
  // can be told apart from a fresh one straight from the panel header -- re-dragging
  // the install page's button does NOT happen automatically after overlay.js changes,
  // so this is the only way to know if what's in the bookmarks bar is current.
  const stamp = new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC";
  src = src.replace('"__BUILD_STAMP__"', JSON.stringify(stamp));

  const squeezed = lightSqueeze(src);
  const bookmarklet = "javascript:" + encodeURIComponent(squeezed);
  return { squeezed, bookmarklet };
}

module.exports = { lightSqueeze, build };

if (require.main === module) {
  const { bookmarklet } = build();
  const outPath = path.join(__dirname, "..", "dist", "bookmarklet.txt");
  fs.writeFileSync(outPath, bookmarklet, "utf-8");
  console.log(`Bookmarklet built: ${bookmarklet.length} characters`);
  console.log("Written to " + outPath);
}
