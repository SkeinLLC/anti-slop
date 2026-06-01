# Anti-Slop

A linter for the parts of your writing that read like ChatGPT wrote them.

Anti-Slop is a VS Code extension and a CLI. It scans markdown and plain text for the patterns readers use to spot AI writing: banned vocabulary, em-dash overuse, reframe constructions like "this isn't X, this is Y", rule-of-three lists, parataxis runs, knowledge-cutoff disclaimers, marketing-essay openers, and more. It runs locally, requires no API key, and ships with three presets out of the box.

If you publish anything written with an LLM in the loop, this exists for you.

## Why this exists

Reader confidence in AI-influenced writing has collapsed. Carnegie Mellon's 2025 study, Buffer's 52-million-post analysis, and the Wikipedia *Signs of AI Writing* project all point to the same conclusion: there's a measurable lexical and structural fingerprint to LLM output, and readers spot it quickly. Once spotted, they stop trusting the content, even if the content is good.

Anti-Slop is the lightweight check that runs between draft and publish. It does not rewrite your prose. It tells you where the fingerprints are so you can route around them.

## Install

VS Code: search "Anti-Slop" in the Marketplace, or sideload the `.vsix` file.

CLI:

```bash
npm install -g anti-slop
antislop --help
```

Or run from source:

```bash
git clone https://github.com/paulgoodwin/anti-slop.git
cd anti-slop
npm install
npm run build
node bin/antislop.js lint README.md
```

## What it catches

The rule set lives in `src/rules/`. Each rule has a stable ID so you can silence or re-tune individual ones. (Linter is silenced on the catalog below because the lines are literal examples of what to flag.)

<!-- antislop-disable-line vocab.banned phrases.banned punctuation.emDash pattern.todayOpener pattern.metaCommentary pattern.cutoffDisclaimer pattern.engagementBait pattern.copulativeAvoidance pattern.falseRange -->
The catalog at a glance, with the rule ID followed by what it watches for. Full descriptions live in `docs/rule-catalog.md`.

`vocab.banned` flags single words from the lexical-fingerprint list, including the obvious tells and the 2026-era buzz catalog. `phrases.banned` flags multi-word clichés. `openers.banned` flags sentence-initial filler like "Certainly," "Moreover," "Furthermore," and "Indeed."

`punctuation.emDash` enforces a budget of one per 500 words (the most cited AI tell). `punctuation.exclamation` caps you at one per 1,000 words. `punctuation.ellipsis` permits one per piece.

`structure.parataxis` catches runs of short declarative sentences. `structure.uniformLength` catches three consecutive sentences of near-identical word count. `structure.ruleOfThree` catches comma-and-conjunction list patterns past the doc-level limit.

`pattern.negativeParallelism` is the single most reliable AI tell, the family of reframe constructions that start with a negation and pivot to a positive claim. `pattern.todayOpener` catches marketing-essay openers. `pattern.metaCommentary` catches text that announces what it's about to do instead of doing it. `pattern.cutoffDisclaimer` catches knowledge-cutoff hedges. `pattern.engagementBait` catches reader-poking copy. `pattern.copulativeAvoidance` catches the "serves as a / stands as a / represents a" family. `pattern.falseRange` catches "from X to Y" lists when no meaningful middle exists. <!-- antislop-disable-line pattern.copulativeAvoidance phrases.banned -->

Run `antislop rules` to see the live registry with one-line descriptions.

## Use it

The CLI:

```bash
antislop lint README.md docs/*.md
cat draft.md | antislop lint -
antislop lint post.md --format github      # CI annotations for GitHub Actions
antislop lint post.md --preset cti --fail-on error
antislop lint post.md --rule pattern.negativeParallelism
antislop init --preset cti                  # write a .antislop.yml in cwd
antislop rules                              # list rule IDs
```

Output formats: `pretty` (default), `compact` (`file:line:col`), `github` (workflow annotations), `json`.

Exit codes: 0 clean, 1 issues at or above `--fail-on`, 2 setup error.

In VS Code:

Open any markdown file and diagnostics appear in the Problems pane with squiggles in the editor. Hover a squiggle to see the rule plus a suggested fix and the reasoning behind it. `Ctrl+.` triggers the quick-fix, which either replaces the flagged word with the suggested alternative or silences the rule on that line. The command palette exposes commands for linting the current file, scanning the workspace, and writing a starter `.antislop.yml` into your repo. <!-- antislop-disable-line structure.parataxis structure.ruleOfThree -->

## Configure it

Drop a `.antislop.yml` at your repo root. The CLI and the VS Code extension both walk up from the open file looking for the nearest config. <!-- antislop-disable-line pattern.falseRange -->

```yaml
preset: default   # or cti, marketing, off

# Add your own banned words on top of the preset.
bannedVocab:
  - widget
  - cyber

# Allow a word the preset bans back through (term of art, etc.).
allowedVocab:
  - robust   # antislop-disable-line vocab.banned

# Punctuation budgets
maxEmDashesPer500Words: 1
maxExclamationsPer1000Words: 1
maxEllipsesPerPiece: 1

# Per-rule overrides
rules:
  pattern.negativeParallelism:
    severity: error          # fail CI on these
  punctuation.emDash:
    severity: warning
  structure.ruleOfThree:
    enabled: false
```

Presets shipped: `default` (lexical + structural baseline), `cti` (adds vendor-marketing tells common in threat intelligence writing), `marketing` (adds the most flagrant landing-page slop), `off` (turn off the lexical lists; structural rules still run).

## Silence a false positive

Three options.

Allow the word globally for this repo:

```yaml
allowedVocab:
  - leverage   # antislop-disable-line vocab.banned
```

Disable the rule for a single line:

```markdown
We had to leverage the vendor SDK because the alternative was twice the price. <!-- antislop-disable-line vocab.banned -->
```

Disable the rule for the next line:

```markdown
<!-- antislop-disable-next-line pattern.copulativeAvoidance -->
The runtime serves as a sandboxed execution layer.
```

Plain comment (no rule id) silences every rule on that line.

## How it works

The engine is plain regex plus a handful of structural scans, with no LLM in the hot path and no network calls. Each rule reads the document, emits character offsets, and the VS Code adapter turns them into diagnostics; the CLI prints to stdout in your chosen format.

Code fences, inline code, and HTML tags get stripped before the structural and pattern rules run. The vocabulary rule still flags banned words inside code blocks by design, because vendor copy hiding inside docs is the most common case.

If a rule fires on something it shouldn't, please file an issue with the source text so the regex can be tightened; rule fidelity is the entire point of the project.

## Project layout

```
anti-slop/
  src/
    engine/       # types, config loader, tokenizer, lint runner
    rules/        # vocabulary, punctuation, structure, patterns
    vscode/       # VS Code extension entry, diagnostics, code actions
    cli.ts        # CLI
  configs/        # default.antislop.yml, cti, marketing
  tests/          # vitest specs covering every rule
  bin/antislop.js # CLI shim
  docs/
```

## Test

```bash
npm install
npm test
```

53 unit specs cover every rule, and the engine makes no network calls during a lint pass.

## License

MIT. See the LICENSE file for the full text.

## Related

The companion `so-what-cli` is the audience-rewriter that pairs with this linter. The forthcoming `icd203-lint` handles confidence-language and sourcing checks in analytic writing.

The studies that anchor the rule set: Carnegie Mellon 2025 on LLM lexical fingerprints, Wikipedia's Signs of AI Writing project, and Buffer's 52M-post analysis from 2025. If you have additions backed by empirical work, PRs welcome on the rule definitions in `src/rules/` and the source list in `src/engine/defaults.ts`.
