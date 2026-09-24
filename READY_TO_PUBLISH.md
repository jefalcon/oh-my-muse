# READY TO PUBLISH — oh-my-muse 0.1.0

Repo URL: `https://github.com/javi/oh-my-muse`
No remote is configured yet. Run, in order:

```sh
git remote add origin https://github.com/javi/oh-my-muse.git
git push -u origin main
npm publish --access public
```

## Final checklist

- [ ] `git push` succeeds; repo visible at github.com/javi/oh-my-muse
- [ ] CI badge green (push run: typecheck + tests + smoke)
- [ ] npm page live: `https://www.npmjs.com/package/oh-my-muse` shows 0.1.0,
      README, repository/homepage/bugs links
- [ ] Fresh install works from npm:
      `npm install -g oh-my-muse` (or `npx oh-my-muse`) then
      `omm install --dir /tmp/probe && omm doctor --dir /tmp/probe`
- [ ] Weekly canary scheduled (Mondays 06:00 UTC, `.github/workflows/ci.yml`)

## Pre-publish verification (done 2026-09-24)

- `npm run typecheck`: clean
- `npm test`: 46/46 pass
- `node bin/omm.mjs doctor --dir .`: exit 0
- `node test/smoke.mjs`: 23 agents / 3 presets
- `npm pack --dry-run`: 41 files, no warnings
