/* ─────────────────────────────────────────────────────────
 * Text helpers shared by the clause parser, risk rules,
 * obligation extraction, the rule-based simplifier and BM25.
 * Pure functions, no DOM, no Node APIs.
 * ───────────────────────────────────────────────────────── */

/* ── Roman numerals ─────────────────────────────────────── */

const ROMAN: [number, string][] = [
  [1000, "m"], [900, "cm"], [500, "d"], [400, "cd"], [100, "c"], [90, "xc"],
  [50, "l"], [40, "xl"], [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"],
];

export function intToRoman(n: number): string {
  let out = "";
  let rest = n;
  for (const [v, s] of ROMAN) {
    while (rest >= v) {
      out += s;
      rest -= v;
    }
  }
  return out;
}

/** Parses a canonical roman numeral (any case). Returns null for "iiii", "vv", "il"... */
export function romanToInt(s: string): number | null {
  const lower = s.toLowerCase();
  if (!/^[ivxlcdm]+$/.test(lower)) return null;
  const val: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };
  let total = 0;
  for (let i = 0; i < lower.length; i++) {
    const cur = val[lower[i]];
    const next = val[lower[i + 1]] ?? 0;
    total += cur < next ? -cur : cur;
  }
  if (total <= 0 || total > 3999) return null;
  return intToRoman(total) === lower ? total : null;
}

/** "a" → 1, "z" → 26, "aa" → 27, "bb" → 28 (doubled-letter lists). */
export function letterToInt(s: string): number | null {
  const lower = s.toLowerCase();
  if (/^[a-z]$/.test(lower)) return lower.charCodeAt(0) - 96;
  if (/^([a-z])\1$/.test(lower)) return 26 + lower.charCodeAt(0) - 96;
  return null;
}

/* ── Number words ───────────────────────────────────────── */

const UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
  eighty: 80, ninety: 90,
};
const ORDINALS: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9,
  tenth: 10, eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15, sixteenth: 16,
  seventeenth: 17, eighteenth: 18, nineteenth: 19, twentieth: 20, thirtieth: 30,
};
const SCALES: Record<string, number> = { hundred: 100, thousand: 1000, million: 1_000_000 };

const NUMBER_WORD = new Set([
  ...Object.keys(UNITS),
  ...Object.keys(ORDINALS),
  ...Object.keys(SCALES),
  "and",
  "dollar",
  "dollars",
  "percent",
  "cents",
]);

export function isNumberWord(w: string): boolean {
  return w.toLowerCase().split("-").every((p) => NUMBER_WORD.has(p));
}

/** "Two Thousand Seven Hundred Seventy-Five" → 2775; "sixty" → 60; "twenty-first" → 21. */
export function wordsToNumber(phrase: string): number | null {
  const parts = phrase
    .toLowerCase()
    .replace(/-/g, " ")
    .split(/\s+/)
    .filter((p) => p && p !== "and" && p !== "dollars" && p !== "dollar");
  if (parts.length === 0) return null;
  let total = 0;
  let current = 0;
  let seen = false;
  for (const p of parts) {
    if (p in UNITS) {
      current += UNITS[p];
      seen = true;
    } else if (p in ORDINALS) {
      current += ORDINALS[p];
      seen = true;
    } else if (p === "hundred") {
      current = (current || 1) * 100;
      seen = true;
    } else if (p in SCALES) {
      total += (current || 1) * SCALES[p];
      current = 0;
      seen = true;
    } else {
      return null;
    }
  }
  return seen ? total + current : null;
}

/** Parses "$1,850.00" / "1,850" / "$75" → number. */
export function parseMoney(s: string): number | null {
  const m = s.replace(/[$\s]/g, "").replace(/,/g, "");
  const n = Number(m);
  return Number.isFinite(n) && m.length > 0 ? n : null;
}

/** $1,850 (drops .00), $3.95, $100,000 */
export function formatMoney(n: number): string {
  const cents = Math.round(n * 100) % 100 !== 0;
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: 2 })}`;
}

/**
 * Collapses the legal habit of writing numbers twice:
 *   "thirty (30) days"                      → "30 days"
 *   "Seventy-Five Dollars ($75.00)"         → "$75.00"
 *   "the first (1st) day"                   → "the 1st day"
 *   "eight percent (8%)"                    → "8%"
 */
export function collapseNumerals(text: string): string {
  const re = /\((\$?\d[\d,]*(?:\.\d+)?%?|\d+(?:st|nd|rd|th))\)/g;
  let out = "";
  let last = 0;
  for (const m of text.matchAll(re)) {
    const parenStart = m.index ?? 0;
    // walk back over the number words written right before the parenthesis
    const run: { word: string; start: number }[] = [];
    let i = parenStart;
    for (;;) {
      let j = i;
      while (j > last && text[j - 1] === " ") j--;
      let k = j;
      while (k > last && /[A-Za-z-]/.test(text[k - 1])) k--;
      if (k === j) break;
      const word = text.slice(k, j);
      if (!isNumberWord(word)) break;
      run.unshift({ word, start: k });
      i = k;
    }
    // a run never starts with "and" ("rent and thirty (30) days")
    while (run.length && run[0].word.toLowerCase() === "and") run.shift();
    if (!run.length) continue;
    out += text.slice(last, run[0].start) + m[1];
    last = parenStart + m[0].length;
  }
  return out + text.slice(last);
}

/* ── Sentences ──────────────────────────────────────────── */

export type Span = { text: string; start: number; end: number };

const ABBREV = new Set([
  "p.m", "a.m", "no", "nos", "inc", "co", "corp", "ltd", "llc", "l.l.c", "st", "ave", "blvd", "mr", "mrs", "ms", "dr",
  "sec", "secs", "art", "u.s", "e.g", "i.e", "etc", "vs", "v", "approx", "para", "par", "ex", "jr", "sr", "dept", "apt",
]);

const LABELLED = /\b(?:Addendum|Exhibit|Schedule|Appendix|Annex|Rider|Section|Article|Part|Unit|Building|Plan|Option|Tier|Class|Type|Phase|Item|Space)\s*$/i;

/**
 * Splits text into sentence spans (offsets relative to `base`). Handles
 * "p.m.", "No. 12", "$1,850.00", initials, quotes and paragraph breaks.
 */
export function splitSentences(text: string, base = 0): Span[] {
  const out: Span[] = [];
  let start = 0;
  const push = (endExclusive: number) => {
    let s = start;
    let e = endExclusive;
    while (s < e && /\s/.test(text[s])) s++;
    while (e > s && /\s/.test(text[e - 1])) e--;
    if (e > s) out.push({ text: text.slice(s, e), start: base + s, end: base + e });
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\n" && text[i + 1] === "\n") {
      push(i);
      start = i + 2;
      i++;
      continue;
    }
    if (ch === "\n" && /^\s*(?:[-•*–]\s|\(?[a-z0-9]{1,4}[.)]\s)/i.test(text.slice(i + 1, i + 8))) {
      push(i);
      start = i + 1;
      continue;
    }
    if (ch !== "." && ch !== "!" && ch !== "?") continue;
    // closing quotes / parens stay with the sentence
    let j = i + 1;
    while (j < text.length && /["'”’)\]]/.test(text[j])) j++;
    if (j < text.length && !/\s/.test(text[j])) continue;
    // next visible char must look like a sentence start
    let k = j;
    while (k < text.length && /\s/.test(text[k])) k++;
    if (k < text.length && !/[A-Z0-9"“(\[$•-]/.test(text[k])) continue;
    if (ch === ".") {
      const word = text.slice(0, i).match(/([A-Za-z][A-Za-z.]*)$/)?.[1] ?? "";
      if (ABBREV.has(word.toLowerCase())) continue;
      // initial ("J. Smith"), unless it names a thing ("Addendum A.", "Exhibit B.")
      if (/^[A-Z]$/.test(word) && !LABELLED.test(text.slice(Math.max(0, i - 24), i - 1))) continue;
    }
    push(j);
    start = j;
  }
  push(text.length);
  return out;
}

/* ── Casing ─────────────────────────────────────────────── */

const ACRONYMS = new Set(["LLC", "HOA", "HVAC", "ADA", "USA", "US", "LLP", "INC", "LP", "PDF", "ID", "NDA"]);

/** "LATE CHARGES" → "Late charges"; "Governing Law and Venue" → "Governing law and venue". */
export function sentenceCase(title: string): string {
  const words = title.trim().split(/(\s+)/);
  let first = true;
  return words
    .map((w) => {
      if (/^\s+$/.test(w)) return w;
      const bare = w.replace(/[^A-Za-z]/g, "");
      if (ACRONYMS.has(bare)) {
        first = false;
        return w;
      }
      const lower = w.toLowerCase();
      if (first && /[a-z]/.test(lower)) {
        first = false;
        const idx = lower.search(/[a-z]/);
        return lower.slice(0, idx) + lower[idx].toUpperCase() + lower.slice(idx + 1);
      }
      return lower;
    })
    .join("");
}

export function capitalize(s: string): string {
  const idx = s.search(/[A-Za-z]/);
  if (idx < 0) return s;
  return s.slice(0, idx) + s[idx].toUpperCase() + s.slice(idx + 1);
}

/** share of letters that are uppercase */
export function upperRatio(s: string): number {
  const letters = s.replace(/[^A-Za-z]/g, "");
  if (!letters.length) return 0;
  return letters.replace(/[^A-Z]/g, "").length / letters.length;
}

/* ── Tokens (BM25) ──────────────────────────────────────── */

const STOP = new Set(
  (
    "a an the and or of to in on at for by with from as is are be been being was were it its this that these those which who whom whose " +
    "shall will may must can could would should do does did have has had i me my we our you your he she they them their his her " +
    "any all such than then there here so if into upon about over under per each other also only same both either neither nor but " +
    "what when where how why there's it's i'm im don't"
  ).split(" "),
);

/** light suffix stemmer: consistent, not linguistic */
export function stem(word: string): string {
  let w = word.toLowerCase().replace(/['’]s$/, "").replace(/['’]/g, "");
  if (w.length <= 3) return w;
  if (w.endsWith("ies") && w.length > 4) w = `${w.slice(0, -3)}y`;
  else if (w.endsWith("sses")) w = w.slice(0, -2);
  else if (w.endsWith("s") && !/(ss|us|is)$/.test(w)) w = w.slice(0, -1);
  if (w.endsWith("ation") && w.length > 7) w = w.slice(0, -3);
  else if (w.endsWith("ment") && w.length > 6) w = w.slice(0, -4);
  else if (w.endsWith("ing") && w.length > 5) w = w.slice(0, -3);
  else if (w.endsWith("ed") && w.length > 4) w = w.slice(0, -2);
  else if (w.endsWith("al") && w.length > 6) w = w.slice(0, -2);
  else if (w.endsWith("ly") && w.length > 5) w = w.slice(0, -2);
  if (/([b-df-hj-np-tv-z])\1$/.test(w) && !/(ll|ss|ff|zz)$/.test(w)) w = w.slice(0, -1);
  if (w.endsWith("e") && w.length > 4) w = w.slice(0, -1);
  return w;
}

export function tokenize(text: string): string[] {
  const raw = text.toLowerCase().match(/[a-z0-9$][a-z0-9$'’-]*/g) ?? [];
  const out: string[] = [];
  for (const r of raw) {
    for (const part of r.split("-")) {
      const t = part.replace(/['’]s$/, "").replace(/['’]/g, "");
      if (!t || STOP.has(t)) continue;
      out.push(stem(t));
    }
  }
  return out;
}

/* ── Misc ───────────────────────────────────────────────── */

export function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/§/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** Cuts at a word boundary and adds an ellipsis. */
export function truncateWords(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max + 1);
  const at = cut.lastIndexOf(" ");
  return `${cut.slice(0, at > 0 ? at : max).replace(/[\s,;:]+$/, "")}…`;
}

/* ── Readability ────────────────────────────────────────── */

/** Rough syllable count (vowel groups, minus a silent final e). */
export function syllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const groups = w
    .replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "")
    .replace(/^y/, "")
    .match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups?.length ?? 1);
}

/** Flesch-Kincaid grade level, clamped to 1..20. Null for very short text. */
export function readingGrade(text: string): number | null {
  const words = text.match(/[A-Za-z][A-Za-z'’-]*/g) ?? [];
  const sentences = Math.max(1, splitSentences(text).length);
  if (words.length < 8) return null;
  const syl = words.reduce((sum, w) => sum + syllables(w), 0);
  const grade = 0.39 * (words.length / sentences) + 11.8 * (syl / words.length) - 15.59;
  return Math.min(20, Math.max(1, Math.round(grade * 10) / 10));
}
