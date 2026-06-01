/**
 * VS Code extension entry point.
 *
 * Registers a DiagnosticCollection, listens for document open / change /
 * save events, runs the engine, and translates Issues into Diagnostics.
 * Also registers a CodeActionProvider for quick-fix replacements.
 */

import * as vscode from "vscode";
import * as path from "node:path";
import * as fs from "node:fs";

import { lint } from "../engine/engine.js";
import { loadOrDefault, loadConfigFile, resolveConfig, findConfig } from "../engine/config.js";
import type { ConfigInput, Issue, ResolvedConfig, Severity } from "../engine/types.js";

const SUPPORTED_LANGS = new Set(["markdown", "plaintext", "mdx", "asciidoc", "tex", "latex"]);
let diagnostics: vscode.DiagnosticCollection;
let configCache: Map<string, ResolvedConfig> = new Map();

export function activate(context: vscode.ExtensionContext): void {
  diagnostics = vscode.languages.createDiagnosticCollection("antislop");
  context.subscriptions.push(diagnostics);

  // Wire events.
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(runIfSupported),
    vscode.workspace.onDidSaveTextDocument(runIfSupported),
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (vscode.workspace.getConfiguration("antislop").get<string>("runOn") === "change") {
        runIfSupported(e.document);
      }
    }),
    vscode.workspace.onDidCloseTextDocument((doc) => diagnostics.delete(doc.uri)),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("antislop")) {
        configCache.clear();
        for (const doc of vscode.workspace.textDocuments) {
          runIfSupported(doc);
        }
      }
    })
  );

  // Code actions for quick-fix.
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      [...SUPPORTED_LANGS].map((language) => ({ language })),
      new AntiSlopCodeActionProvider(),
      { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] }
    )
  );

  // Commands.
  context.subscriptions.push(
    vscode.commands.registerCommand("antislop.lintFile", () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      runDocument(editor.document, /* force */ true);
    }),
    vscode.commands.registerCommand("antislop.scanWorkspace", scanWorkspace),
    vscode.commands.registerCommand("antislop.createConfig", createConfig),
    vscode.commands.registerCommand("antislop.showReport", showReport)
  );

  // Lint any document already open at activation.
  for (const doc of vscode.workspace.textDocuments) {
    runIfSupported(doc);
  }
}

export function deactivate(): void {
  diagnostics?.dispose();
  configCache.clear();
}

function runIfSupported(doc: vscode.TextDocument): void {
  if (!SUPPORTED_LANGS.has(doc.languageId)) return;
  if (doc.uri.scheme !== "file" && doc.uri.scheme !== "untitled") return;
  const setting = vscode.workspace.getConfiguration("antislop").get<boolean>("enable", true);
  if (!setting) {
    diagnostics.delete(doc.uri);
    return;
  }
  runDocument(doc, false);
}

function runDocument(doc: vscode.TextDocument, force: boolean): void {
  const config = getConfigForDoc(doc);
  const maxIssues = vscode.workspace
    .getConfiguration("antislop")
    .get<number>("maxIssuesPerFile", 500);
  const { issues } = lint(doc.getText(), config, { maxIssues });
  const diags: vscode.Diagnostic[] = issues.map((issue) => issueToDiagnostic(doc, issue));
  diagnostics.set(doc.uri, diags);
  if (force) {
    void vscode.window.showInformationMessage(
      `Anti-Slop: ${issues.length} issue${issues.length === 1 ? "" : "s"} in ${path.basename(doc.fileName || "document")}.`
    );
  }
}

function issueToDiagnostic(doc: vscode.TextDocument, issue: Issue): vscode.Diagnostic {
  const start = doc.positionAt(issue.start);
  const end = doc.positionAt(issue.end);
  const sev = mapSeverity(issue.severity);
  const message = issue.why ? `${issue.message}\n\n${issue.why}` : issue.message;
  const diag = new vscode.Diagnostic(new vscode.Range(start, end), message, sev);
  diag.source = "anti-slop";
  diag.code = issue.ruleId;
  // Stash the fix on the diagnostic for the CodeActionProvider.
  (diag as DiagnosticWithFix).antislopFix = issue.fix;
  return diag;
}

interface DiagnosticWithFix extends vscode.Diagnostic {
  antislopFix?: string;
}

function mapSeverity(sev: Severity): vscode.DiagnosticSeverity {
  switch (sev) {
    case "error":
      return vscode.DiagnosticSeverity.Error;
    case "warning":
      return vscode.DiagnosticSeverity.Warning;
    case "info":
      return vscode.DiagnosticSeverity.Information;
    case "hint":
      return vscode.DiagnosticSeverity.Hint;
  }
}

class AntiSlopCodeActionProvider implements vscode.CodeActionProvider {
  provideCodeActions(
    doc: vscode.TextDocument,
    _range: vscode.Range,
    ctx: vscode.CodeActionContext
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];
    for (const diag of ctx.diagnostics) {
      if (diag.source !== "anti-slop") continue;
      const fix = (diag as DiagnosticWithFix).antislopFix;
      if (fix) {
        const action = new vscode.CodeAction(
          `Anti-Slop: replace with "${fix}"`,
          vscode.CodeActionKind.QuickFix
        );
        const edit = new vscode.WorkspaceEdit();
        edit.replace(doc.uri, diag.range, fix);
        action.edit = edit;
        action.diagnostics = [diag];
        action.isPreferred = true;
        actions.push(action);
      }
      // Always offer a "disable rule on this line" action.
      const disableAction = new vscode.CodeAction(
        `Anti-Slop: silence "${diag.code}" on this line`,
        vscode.CodeActionKind.QuickFix
      );
      const edit = new vscode.WorkspaceEdit();
      const lineEnd = doc.lineAt(diag.range.start.line).range.end;
      edit.insert(doc.uri, lineEnd, ` <!-- antislop-disable-line ${diag.code} -->`);
      disableAction.edit = edit;
      disableAction.diagnostics = [diag];
      actions.push(disableAction);
    }
    return actions;
  }
}

function getConfigForDoc(doc: vscode.TextDocument): ResolvedConfig {
  const ws = vscode.workspace.getWorkspaceFolder(doc.uri);
  const root = ws?.uri.fsPath ?? (doc.uri.scheme === "file" ? path.dirname(doc.uri.fsPath) : process.cwd());
  if (configCache.has(root)) return configCache.get(root)!;

  const settings = vscode.workspace.getConfiguration("antislop");
  const configPath = settings.get<string>("configPath", ".antislop.yml");
  const preset = settings.get<ConfigInput["preset"]>("preset", "default") ?? "default";

  let config: ResolvedConfig;
  // Try the configured path first, then fall back to the upward search.
  const absolutePath = path.isAbsolute(configPath) ? configPath : path.join(root, configPath);
  if (fs.existsSync(absolutePath)) {
    config = resolveConfig(loadConfigFile(absolutePath));
  } else {
    const found = findConfig(root);
    if (found) {
      config = resolveConfig(loadConfigFile(found));
    } else {
      config = loadOrDefault(root, preset);
    }
  }
  configCache.set(root, config);
  return config;
}

async function scanWorkspace(): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    void vscode.window.showWarningMessage("Anti-Slop: open a workspace first.");
    return;
  }
  const files = await vscode.workspace.findFiles("**/*.{md,mdx,txt,adoc,tex}", "**/node_modules/**");
  let total = 0;
  for (const f of files) {
    const doc = await vscode.workspace.openTextDocument(f);
    const config = getConfigForDoc(doc);
    const { issues } = lint(doc.getText(), config, { maxIssues: 500 });
    diagnostics.set(doc.uri, issues.map((i) => issueToDiagnostic(doc, i)));
    total += issues.length;
  }
  void vscode.window.showInformationMessage(
    `Anti-Slop: scanned ${files.length} file${files.length === 1 ? "" : "s"}, ${total} issue${total === 1 ? "" : "s"} found.`
  );
}

async function createConfig(): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    void vscode.window.showWarningMessage("Anti-Slop: open a workspace first.");
    return;
  }
  const target = path.join(folders[0].uri.fsPath, ".antislop.yml");
  if (fs.existsSync(target)) {
    const action = await vscode.window.showWarningMessage(
      `.antislop.yml already exists. Overwrite?`,
      "Overwrite",
      "Cancel"
    );
    if (action !== "Overwrite") return;
  }
  const templatePath = path.join(__dirname, "..", "..", "configs", "default.antislop.yml");
  let body = "preset: default\n";
  if (fs.existsSync(templatePath)) body = fs.readFileSync(templatePath, "utf8");
  fs.writeFileSync(target, body, "utf8");
  const opened = await vscode.workspace.openTextDocument(target);
  await vscode.window.showTextDocument(opened);
}

async function showReport(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;
  const doc = editor.document;
  if (!SUPPORTED_LANGS.has(doc.languageId)) {
    void vscode.window.showWarningMessage("Anti-Slop: open a markdown or plain-text file.");
    return;
  }
  const config = getConfigForDoc(doc);
  const { issues, wordCount, rulesRun } = lint(doc.getText(), config, { maxIssues: 1000 });
  const grouped = new Map<string, number>();
  for (const i of issues) {
    grouped.set(i.ruleId, (grouped.get(i.ruleId) ?? 0) + 1);
  }
  const rows = [...grouped.entries()].sort((a, b) => b[1] - a[1]);
  const lines = [
    `# Anti-Slop report: ${path.basename(doc.fileName || "document")}`,
    "",
    `Word count: ${wordCount}`,
    `Rules run: ${rulesRun.length}`,
    `Issues: ${issues.length}`,
    "",
    "## Issues by rule",
    ""
  ];
  for (const [rule, count] of rows) lines.push(`- ${rule}: ${count}`);
  const reportDoc = await vscode.workspace.openTextDocument({
    content: lines.join("\n"),
    language: "markdown"
  });
  await vscode.window.showTextDocument(reportDoc, vscode.ViewColumn.Beside);
}
