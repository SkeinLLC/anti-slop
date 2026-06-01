/**
 * Minimal YAML parser. Handles the subset .antislop.yml needs:
 *   - top-level keys mapping to scalars, lists, or nested objects
 *   - lists of scalars ("- value")
 *   - one level of nested objects with the same shape
 *   - quoted strings (single or double)
 *   - comments (# to end of line)
 *
 * Intentionally not a full YAML implementation. The repo can swap in
 * `yaml` from npm if the user installs it; this parser keeps the engine
 * working in environments without the dependency available.
 */

type Value = string | number | boolean | null | Value[] | { [key: string]: Value };

export function parseYaml(text: string): Value {
  const lines = text.split(/\r?\n/);
  const cleaned: { indent: number; raw: string; lineNo: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    // Strip comments outside quotes.
    line = stripLineComment(line);
    if (line.trim() === "") continue;
    const indent = line.length - line.trimStart().length;
    cleaned.push({ indent, raw: line.trimEnd(), lineNo: i + 1 });
  }

  const { value } = parseBlock(cleaned, 0, 0);
  return value;
}

function stripLineComment(line: string): string {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && !inSingle) inDouble = !inDouble;
    else if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === "#" && !inSingle && !inDouble) {
      return line.slice(0, i);
    }
  }
  return line;
}

interface Token {
  indent: number;
  raw: string;
  lineNo: number;
}

function parseBlock(
  lines: Token[],
  start: number,
  parentIndent: number
): { value: Value; next: number } {
  if (start >= lines.length) return { value: {}, next: start };
  const first = lines[start];

  // List form.
  if (first.raw.trimStart().startsWith("- ") || first.raw.trimStart() === "-") {
    return parseList(lines, start, first.indent);
  }

  return parseObject(lines, start, first.indent === 0 ? 0 : first.indent);
}

function parseObject(
  lines: Token[],
  start: number,
  blockIndent: number
): { value: Value; next: number } {
  const obj: { [k: string]: Value } = {};
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    if (line.indent < blockIndent) break;
    if (line.indent > blockIndent) {
      // Shouldn't happen at top of object pass; skip to recover.
      i++;
      continue;
    }
    const stripped = line.raw.slice(line.indent);
    const colonIdx = findColon(stripped);
    if (colonIdx === -1) {
      throw new Error(`yaml-mini: expected key at line ${line.lineNo}: ${stripped}`);
    }
    const key = stripped.slice(0, colonIdx).trim();
    const after = stripped.slice(colonIdx + 1).trim();
    i++;
    if (after === "") {
      // Nested block.
      if (i >= lines.length || lines[i].indent <= blockIndent) {
        obj[key] = null;
        continue;
      }
      const child = parseBlock(lines, i, blockIndent);
      obj[key] = child.value;
      i = child.next;
    } else if (after === "[]") {
      obj[key] = [];
    } else if (after === "{}") {
      obj[key] = {};
    } else {
      obj[key] = parseScalar(after);
    }
  }
  return { value: obj, next: i };
}

function parseList(
  lines: Token[],
  start: number,
  listIndent: number
): { value: Value[]; next: number } {
  const list: Value[] = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    if (line.indent < listIndent) break;
    if (line.indent > listIndent) {
      // Out of place; skip.
      i++;
      continue;
    }
    const stripped = line.raw.slice(line.indent);
    if (!stripped.startsWith("-")) break;
    const item = stripped.replace(/^-\s*/, "");
    i++;
    if (item === "") {
      // Nested block under the dash.
      if (i < lines.length && lines[i].indent > listIndent) {
        const child = parseBlock(lines, i, lines[i].indent);
        list.push(child.value);
        i = child.next;
      } else {
        list.push(null);
      }
    } else {
      list.push(parseScalar(item));
    }
  }
  return { value: list, next: i };
}

function findColon(line: string): number {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && !inSingle) inDouble = !inDouble;
    else if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === ":" && !inSingle && !inDouble) return i;
  }
  return -1;
}

function parseScalar(value: string): Value {
  const trimmed = value.trim();
  if (trimmed === "null" || trimmed === "~" || trimmed === "") return null;
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?\d+$/.test(trimmed)) return parseInt(trimmed, 10);
  if (/^-?\d+\.\d+$/.test(trimmed)) return parseFloat(trimmed);
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}
