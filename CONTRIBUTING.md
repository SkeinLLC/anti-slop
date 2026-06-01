# Contributing to Anti-Slop

Thanks for the help; a few things to know before you open a PR.

## Where the value is

Rule fidelity is the product. The codebase is small. What's hard is curating the vocabulary, phrases, and patterns so they catch real AI tells without firing on competent prose.

If you have a rule idea, the best PR includes: the pattern itself, two or three examples of AI output that contains it, two or three competent-prose examples that do NOT contain it (negative cases), and a pointer to a study or corpus where the pattern was observed.

## Running the project

```bash
git clone https://github.com/paulgoodwin/anti-slop.git
cd anti-slop
npm install
npm test
npm run build
node bin/antislop.js lint README.md
```

The build emits to `out/`, with `out/vscode/extension.js` as the VS Code entry point and `out/cli.js` as the CLI entry point.

## Adding a rule

Rules live in `src/rules/`. Each rule exports an object that conforms to the `Rule` interface in `src/engine/types.ts`:

```ts
export const myRule: Rule = {
  id: "category.shortName",
  category: "vocabulary",
  description: "Plain-English description.",
  defaultSeverity: "warning",
  check(ctx) {
    return [];
  }
};
```

Register the rule in `src/rules/index.ts`. Add it to the `KNOWN_RULES` list in `src/engine/config.ts` so config files can toggle it. Add at least two tests in `tests/`, one positive and one negative.

## Style

- TypeScript strict mode is on. Keep it on.
- No external runtime deps for rules. Plain regex and string scans only. The YAML loader is a tiny custom parser for the same reason.
- Voice in code comments matches the voice in the README: dry, direct, no marketing tone.
- The README is dogfooded: run `node bin/antislop.js lint README.md` before merging README changes.

## Reporting false positives

Open an issue with the exact source text and the rule ID that fired. False positives are bugs.

## Reporting misses

If competent AI output gets past a rule that should have caught it, open an issue with the source text and the rule ID you expected to fire. Tuning the rule is usually a one-line fix to the regex or a new entry in the default list.

## License

By contributing, you agree your contribution is licensed under MIT.
