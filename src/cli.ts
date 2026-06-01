/**
 * Standalone CLI. Runs the engine over files or stdin and prints results to
 * stdout. Designed for CI and pre-commit; exits non-zero when issues at or
 * above the --fail-on threshold are found.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { lint } from "./engine/engine.js";
import { loadOrDefault, loadConfigFile, resolveConfig } from "./engine/config.js";
import type { Issue, ResolvedConfig, Severity } from "./engine/types.js";

const SEVERITY_RANK: Record<Severity, number> = { hint: 0, info: 1, warning: 2, error: 3 };
const COLORS = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  gray: "\x1b[90m",
  bold: "\x1b[1m"
};

interface ParsedArgs {
  command: string;
  files: string[];
  configPath?: string;
  preset?: "default" | "cti" | "marketing" | "off";
  format: "pretty" | "json" | "github" | "compact";
  failOn: Severity;
  noColor: boolean;
  showFix: boolean;
  rule?: string;
  help: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = {
    command: "lint",
    files: [],
    format: "pretty",
    failOn: "warning",
    noColor: false,
    showFix: false,
    help: false
  };

  if (argv.length === 0) {
    args.help = true;
    return args;
  }

  const queue = [...argv];
  // First non-flag is the command.
  let foundCommand = false;
  while (queue.length > 0) {
    const tok = queue.shift()!;
    if (!foundCommand && !tok.startsWith("-")) {
      args.command = tok;
      foundCommand = true;
      continue;
    }
    switch (tok) {
      case "--config":
      case "-c":
        args.configPath = queue.shift();
        break;
      case "--preset":
        args.preset = queue.shift() as ParsedArgs["preset"];
        break;
      case "--format":
      case "-f":
        args.format = (queue.shift() as ParsedArgs["format"]) ?? "pretty";
        break;
      case "--fail-on":
        args.failOn = (queue.shift() as Severity) ?? "warning";
        break;
      case "--no-color":
        args.noColor = true;
        break;
      case "--fix-preview":
        args.showFix = true;
        break;
      case "--rule":
        args.rule = queue.shift();
        break;
      case "-h":
      case "--help":
        args.help = true;
        break;
      case "-":
        args.files.push("-");
        break;
      default:
        if (tok.startsWith("-")) {
          process.stderr.write(`Unknown flag: ${tok}\n`);
        } else {
          args.files.push(tok);
        }
    }
  }

  return args;
}

const VERSION = "0.1.0";
const HELP = `antislop ${VERSION}

Usage:
  antislop lint [options] <file>...     Lint one or more files (or - for stdin)
  antislop init [--preset name]          Write a default .antislop.yml next to you
  antislop rules                         List built-in rules
  antislop --help                        Show this help

Options:
  -c, --config <path>      Path to .antislop.yml (default: walk up from file)
  --preset <name>          default | cti | marketing | off
  -f, --format <name>      pretty | json | github | compact (default: pretty)
  --fail-on <severity>     hint | info | warning | error (default: warning)
  --rule <id>              Show only matches for this rule id
  --fix-preview            Print the suggested replacement next to each match
  --no-color               Disable ANSI colors

Examples:
  antislop lint README.md docs/*.md
  cat draft.md | antislop lint - --format json
  antislop lint README.md --preset cti --fail-on error
`;

function readSource(file: string): string {
  if (file === "-") {
    return fs.readFileSync(0, "utf8");
  }
  return fs.readFileSync(file, "utf8");
}

function configFor(args: ParsedArgs, file: string): ResolvedConfig {
  if (args.configPath) {
    return resolveConfig(loadConfigFile(args.configPath));
  }
  const startDir = file === "-" ? process.cwd() : path.dirname(path.resolve(file));
  return loadOrDefault(startDir, args.preset ?? "default");
}

function color(text: string, code: string, enabled: boolean): string {
  if (!enabled) return text;
  return `${code}${text}${COLORS.reset}`;
}

function severityColor(sev: Severity): string {
  switch (sev) {
    case "error":
      return COLORS.red;
    case "warning":
      return COLORS.yellow;
    case "info":
      return COLORS.blue;
    case "hint":
      return COLORS.gray;
  }
}

function positionOf(text: string, offset: number): { line: number; col: number } {
  let line = 1;
  let col = 1;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === "\n") {
      line++;
      col = 1;
    } else {
      col++;
    }
  }
  return { line, col };
}

function printPretty(file: string, text: string, issues: Issue[], colorOn: boolean, showFix: boolean): void {
  if (issues.length === 0) {
    process.stdout.write(color(`${file}: clean\n`, COLORS.gray, colorOn));
    return;
  }
  process.stdout.write(color(`${file}\n`, COLORS.bold, colorOn));
  for (const i of issues) {
    const { line, col } = positionOf(text, i.start);
    const sev = color(i.severity.padEnd(7), severityColor(i.severity), colorOn);
    const ruleId = color(i.ruleId, COLORS.gray, colorOn);
    const loc = color(`${line}:${col}`, COLORS.gray, colorOn);
    let line1 = `  ${loc}  ${sev}  ${ruleId}  ${i.message}`;
    process.stdout.write(line1 + "\n");
    if (showFix && i.fix) {
      process.stdout.write(color(`           fix: ${i.fix}\n`, COLORS.blue, colorOn));
    }
  }
}

function printCompact(file: string, text: string, issues: Issue[]): void {
  for (const i of issues) {
    const { line, col } = positionOf(text, i.start);
    process.stdout.write(`${file}:${line}:${col}: ${i.severity}: ${i.ruleId} ${i.message}\n`);
  }
}

function printGithub(file: string, text: string, issues: Issue[]): void {
  for (const i of issues) {
    const { line, col } = positionOf(text, i.start);
    const cmd = i.severity === "error" ? "error" : i.severity === "warning" ? "warning" : "notice";
    process.stdout.write(
      `::${cmd} file=${file},line=${line},col=${col},title=${i.ruleId}::${i.message.replace(/\n/g, "%0A")}\n`
    );
  }
}

function printJson(results: Array<{ file: string; issues: Issue[]; wordCount: number }>): void {
  process.stdout.write(JSON.stringify(results, null, 2) + "\n");
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    process.stdout.write(HELP);
    return;
  }

  if (args.command === "rules") {
    const { builtinRules } = await import("./rules/index.js");
    for (const r of builtinRules) {
      process.stdout.write(`${r.id.padEnd(34)} ${r.category.padEnd(12)} ${r.description}\n`);
    }
    return;
  }

  if (args.command === "init") {
    const target = path.resolve(".antislop.yml");
    if (fs.existsSync(target)) {
      process.stderr.write(`Refusing to overwrite ${target}\n`);
      process.exit(1);
    }
    const here = path.dirname(__filename);
    const template = path.join(here, "..", "configs", `${args.preset ?? "default"}.antislop.yml`);
    const body = fs.existsSync(template) ? fs.readFileSync(template, "utf8") : "preset: default\n";
    fs.writeFileSync(target, body, "utf8");
    process.stdout.write(`Wrote ${target}\n`);
    return;
  }

  if (args.command !== "lint") {
    process.stderr.write(`Unknown command: ${args.command}\n`);
    process.stdout.write(HELP);
    process.exit(2);
  }

  if (args.files.length === 0) {
    process.stderr.write("No files given. Pass file paths or - for stdin.\n");
    process.exit(2);
  }

  const colorOn = !args.noColor && process.stdout.isTTY;
  const allResults: Array<{ file: string; issues: Issue[]; wordCount: number }> = [];
  let worstSeverity: Severity = "hint";
  let hadFailure = false;

  for (const file of args.files) {
    let text: string;
    try {
      text = readSource(file);
    } catch (err) {
      process.stderr.write(`Cannot read ${file}: ${(err as Error).message}\n`);
      process.exitCode = 2;
      continue;
    }
    const cfg = configFor(args, file);
    let { issues, wordCount } = lint(text, cfg);
    if (args.rule) issues = issues.filter((i) => i.ruleId === args.rule);

    for (const i of issues) {
      if (SEVERITY_RANK[i.severity] > SEVERITY_RANK[worstSeverity]) worstSeverity = i.severity;
      if (SEVERITY_RANK[i.severity] >= SEVERITY_RANK[args.failOn]) hadFailure = true;
    }

    allResults.push({ file, issues, wordCount });

    if (args.format === "pretty") printPretty(file, text, issues, colorOn, args.showFix);
    else if (args.format === "compact") printCompact(file, text, issues);
    else if (args.format === "github") printGithub(file, text, issues);
  }

  if (args.format === "json") printJson(allResults);

  // Always print a summary on pretty / compact runs.
  if (args.format === "pretty" || args.format === "compact") {
    const total = allResults.reduce((acc, r) => acc + r.issues.length, 0);
    const errs = allResults.reduce((acc, r) => acc + r.issues.filter((i) => i.severity === "error").length, 0);
    const warns = allResults.reduce((acc, r) => acc + r.issues.filter((i) => i.severity === "warning").length, 0);
    process.stdout.write(
      `\n${total} issue${total === 1 ? "" : "s"} (${errs} error, ${warns} warning). Worst: ${worstSeverity}.\n`
    );
  }

  if (hadFailure) process.exitCode = 1;
}

main().catch((err) => {
  process.stderr.write(`antislop crashed: ${(err as Error).stack ?? err}\n`);
  process.exit(2);
});

