#!/usr/bin/env bash
# Installs the Locator Inspector plugin into Claude Code.
# Safe to re-run: reinstalls cleanly if it's already present.

set -u

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Locator Inspector — installing from:"
echo "  $DIR"
echo

if ! command -v claude >/dev/null 2>&1; then
  echo "ERROR: the 'claude' command was not found."
  echo "Install Claude Code first, then run this again."
  exit 1
fi

if [ ! -f "$DIR/.claude-plugin/marketplace.json" ]; then
  echo "ERROR: this doesn't look like the right folder."
  echo "Expected to find .claude-plugin/marketplace.json inside:"
  echo "  $DIR"
  echo "Run this script from inside the unzipped QA-project folder."
  exit 1
fi

# Clear any previous copy so a re-run always lands the current version
# (a plugin install is a snapshot, so a stale one would otherwise stick).
claude plugin uninstall locator-inspector >/dev/null 2>&1
claude plugin marketplace remove qa-tools >/dev/null 2>&1

echo "Adding marketplace..."
if ! claude plugin marketplace add "$DIR"; then
  echo
  echo "ERROR: could not add the marketplace. Nothing was installed."
  exit 1
fi

echo "Installing plugin..."
if ! claude plugin install locator-inspector@qa-tools; then
  echo
  echo "ERROR: could not install the plugin."
  echo "The marketplace was added, so you can retry with:"
  echo "  claude plugin install locator-inspector@qa-tools"
  exit 1
fi

echo
if claude plugin details locator-inspector 2>/dev/null | grep -q "adopt-recorded-test"; then
  echo "Installed successfully — both skills are present."
else
  echo "Installed, but the skills did not report as expected."
  echo "Check with: claude plugin details locator-inspector"
fi

cat <<'EOF'

------------------------------------------------------------
NEXT STEP: restart Claude Code.

Skills only load when a session starts, so it will not appear
in this session.

After restarting, just ask for what you want, e.g.

  get me a locator for the Add button on the Glossary page
  record a test for creating a domain

Or type /locator-inspector

See START-HERE.md for more.
------------------------------------------------------------
EOF
