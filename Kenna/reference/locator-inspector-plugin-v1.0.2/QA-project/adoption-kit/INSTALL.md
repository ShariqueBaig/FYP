# Installing the adoption kit

This kit is for **the person receiving a recorded test**, not for the recorder itself. It teaches an
agent how to fold a generated reference test into *your* repo, following *your* repo's rules.

## If you use Claude Code

Copy the skill into your test repo:

```bash
cp -R adoption-kit/.claude/skills/adopt-recorded-test <your-repo>/.claude/skills/
```

That's it. From then on, in that repo:

> Adopt this recorded test into our suite: `<paste the script, or a path to it>`

Claude picks the skill up automatically. You can also invoke it explicitly with
`/adopt-recorded-test`.

To make it available in every repo instead of one, copy it to `~/.claude/skills/` .

## If you use Cursor, Copilot, or another agent

Point it at `adoption-kit/ADOPTING.md` — same content, no skill machinery:

> Follow the procedure in ADOPTING.md to adopt this recorded test into our suite: `<script>`

## If you'd rather do it by hand

`ADOPTING.md` is a readable checklist. Work down it.

## What it does, in one paragraph

A recorded test is a **reference**, not a finished test. It hardcodes URLs, inlines locators, has no
page objects, uses positional data keys like `data.step7`, leaves its assertions commented out, and
carries artifacts of someone typing (the same field filled three times in a row). The kit discovers
your repo's actual conventions — from your rules files *and* from your existing specs — translates the
recording into them, prunes the recorder noise, verifies the result runs, and reports exactly what it
changed and what still needs a human decision.

**It does not assume your repo looks like anything in particular**, and it does not bring an auth
mechanism with it. Your suite already has one; the adopted test uses that.
