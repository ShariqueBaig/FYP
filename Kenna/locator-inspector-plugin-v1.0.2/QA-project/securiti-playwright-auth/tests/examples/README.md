# tests/examples/

`glossary-add-term.spec.ts` is a recording from the generator, **byte-for-byte, with zero edits**.

It is the executable contract of this package. It contains no import from `auth/`, no `test.use`, no
fixture, and no login step — just `async ({ page })` and a bare `page.goto()`. If it runs green, the
auth injection works and any recording will run the same way.

**Any change to this package must keep this file passing without modifying it.** If you find yourself
wanting to edit it, the package is wrong, not the file.

It is a separate project (`--project=examples`) rather than part of `npm test` because it **creates a
real glossary term** on the qa environment. Run it deliberately:

```bash
npm run test:example
```

Re-running it repeatedly will eventually collide with a duplicate-name validation, since the recorded
name is a fixed string. That is a property of the recording, not a bug in this package — and it is one
of the things the adoption kit fixes when a recording is folded into a real test suite.
