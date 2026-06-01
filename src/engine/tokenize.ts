/**
 * Lightweight tokenizers used by structural rules.
 *
 * No external NLP dependency. Good enough for English prose at the
 * sentence-rhythm level we care about, ignorant of markdown headers, code
 * fences, and HTML tags (those are stripped before tokenization).
 */

export interface Sentence {
  /** Sentence text, trimmed. */
  text: string;
  /** Word count. */
  words: number;
  /** Absolute character offset where sentence starts in the *stripped* text. */
  start: number;
  /** Absolute character offset where sentence ends in the *stripped* text. */
  end: number;
  /** Absolute offset in the *original* text. */
  originalStart: number;
  /** Absolute offset in the *original* text. */
  originalEnd: number;
}

export interface StripResult {
  stripped: string;
  /** Map from stripped-text offset to original-text offset. */
  offsetMap: number[];
}

/**
 * Strip code fences, inline code, HTML tags, and markdown image/link syntax
 * before running prose-level rules. Returns the stripped text alongside an
 * offset map so we can translate match positions back to the original source.
 */
export function stripNonProse(text: string): StripResult {
  const out: string[] = [];
  const offsetMap: number[] = [];
  let i = 0;
  while (i < text.length) {
    // Triple-backtick fenced code blocks.
    if (text.startsWith("```", i)) {
      const end = text.indexOf("```", i + 3);
      if (end === -1) {
        // Unterminated. Skip to end.
        i = text.length;
        continue;
      }
      i = end + 3;
      continue;
    }
    // HTML comments. Drop the whole thing.
    if (text.startsWith("<!--", i)) {
      const end = text.indexOf("-->", i + 4);
      if (end === -1) {
        i = text.length;
        continue;
      }
      i = end + 3;
      continue;
    }
    // Inline code, single backtick.
    if (text[i] === "`") {
      const end = text.indexOf("`", i + 1);
      if (end === -1) {
        i = text.length;
        continue;
      }
      i = end + 1;
      continue;
    }
    // HTML / XML tags. Drop the tag, keep inner text on next pass.
    if (text[i] === "<") {
      const end = text.indexOf(">", i + 1);
      if (end === -1) {
        i = text.length;
        continue;
      }
      i = end + 1;
      continue;
    }
    out.push(text[i]);
    offsetMap.push(i);
    i++;
  }
  return { stripped: out.join(""), offsetMap };
}

/**
 * Split text into sentences. Splits on `.!?` followed by whitespace or EOF,
 * preserves the absolute offsets, and counts words.
 *
 * Trade-off: we are not robust against abbreviations (e.g. "Mr.") and that's
 * fine for slop detection. False positives at the sentence boundary level
 * are acceptable; the structural rules care about gross rhythm.
 */
export function splitSentences(stripped: string, offsetMap: number[]): Sentence[] {
  const sentences: Sentence[] = [];
  const re = /[^.!?\n]+[.!?]+|\S[^.!?\n]*$/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped)) !== null) {
    const raw = m[0];
    const trimmedStart = raw.length - raw.trimStart().length;
    const trimmedEnd = raw.trimEnd().length;
    const text = raw.slice(trimmedStart, trimmedEnd);
    if (text.length === 0) continue;

    const start = m.index + trimmedStart;
    const end = m.index + trimmedEnd;
    const words = countWords(text);
    sentences.push({
      text,
      words,
      start,
      end,
      originalStart: offsetMap[start] ?? start,
      originalEnd: (offsetMap[end - 1] ?? end - 1) + 1
    });
  }
  return sentences;
}

export function countWords(text: string): number {
  const matches = text.match(/[A-Za-z0-9'’\-]+/g);
  return matches ? matches.length : 0;
}

/**
 * Translate an offset in stripped text back to the original.
 */
export function originalOffset(strippedOffset: number, offsetMap: number[]): number {
  if (strippedOffset < 0) return 0;
  if (strippedOffset >= offsetMap.length) {
    // Past end. Use last known + 1.
    const last = offsetMap[offsetMap.length - 1];
    return (last ?? strippedOffset) + 1;
  }
  return offsetMap[strippedOffset];
}
