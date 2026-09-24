# READY TO PUBLISH — oh-my-muse 0.2.0

Repo URL: `https://github.com/jefalcon/oh-my-muse`
No remote is configured yet. Run, in order:

```sh
git push -u origin muse-native
# merge muse-native, tag, then:
npm publish --access public
```

## Final checklist (0.2.0)

- [ ] Branch `muse-native` merged; tag `v0.2.0` pushed
- [ ] CI badge green (push run: `npm ci` + `npm test`)
- [ ] `omm validate`: 18 skills + plugin, `valid: true`, zero diagnostics
- [ ] `npm test`: all pass locally (validators run; skip only without Muse)
- [ ] `npm pack --dry-run` lists `plugin/.muse-plugin/plugin.json`,
      all skills, commands, hooks, and `bin/omm.mjs`; no `pack/`
- [ ] npm page live: `https://www.npmjs.com/package/oh-my-muse` shows
      0.2.0, README, repository/homepage/bugs links
- [ ] Fresh install works from npm: `npm install -g oh-my-muse`, then
      `omm install --scope user`, then the printed
      `muse plugins approve oh-my-muse`, then `omm doctor` exit 0
- [ ] Weekly canary scheduled (Mondays 06:00 UTC, `.github/workflows/ci.yml`)

## Pre-publish verification (done 2026-09-24)

- `muse skills validate plugin/skills/* --json`: 18/18 exit 0,
  `valid: true`, `diagnostics: []`
- `muse plugins validate plugin --json`: `valid: true`, `diagnostics: []`
- `npm test`: 34/34 pass
- `node bin/omm.mjs doctor`: exit 0
- `npm pack --dry-run`: plugin manifest + skills + commands + hooks present
