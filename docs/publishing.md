# Publishing

Pre-flight before publishing to the VS Code Marketplace and npm.

## Versioning

1. Update `version` in `package.json`.
2. Update `CHANGELOG.md`.
3. Run `npm test` and `npm run build`. Both must pass.
4. Run `node bin/antislop.js lint README.md CHANGELOG.md docs/*.md --fail-on error`. The README must be clean.
5. Commit with the new version as the message: `git commit -m "v0.x.y"`.
6. Tag: `git tag v0.x.y && git push --tags`.

## Marketplace

```bash
npm install -g @vscode/vsce
npm run package          # produces anti-slop-0.x.y.vsix
vsce publish             # needs VSCE_PAT in env or vsce login first
```

If you don't want to publish, sideload by drag-dropping the `.vsix` into the Extensions pane.

## npm

```bash
npm publish --access public
```

The package exposes both an `antislop` CLI and the VS Code extension entry point. npm users see only the CLI side.

## Open VSX

For non-Microsoft VS Code forks (Codium, Cursor, Theia):

```bash
npx ovsx publish anti-slop-0.x.y.vsix -p <OVSX_TOKEN>
```

## After publishing

- Tweet / Bluesky / Mastodon the version with one example diagnostic.
- File the launch post on Hacker News if it's a milestone version (0.1, 0.5, 1.0).
- Update the kanban card in the Launch Ideas Backlog repo.
