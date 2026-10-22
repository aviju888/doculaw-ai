/* ─────────────────────────────────────────────────────────
 * NORMALIZE — turn extracted text (PDF, DOCX, TXT, paste) into
 * the canonical string every offset in DocuLaw points into.
 *
 *   1. unify whitespace, line endings, ligatures, bullets
 *   2. drop page numbers, dot-leader TOC lines, running headers
 *   3. reflow hard-wrapped lines (PDFs give one line per visual
 *      line) back into paragraphs, but never across a clause
 *      marker, a heading, a bullet or a form line
 * ───────────────────────────────────────────────────────── */

import { isCapsHeading, isSignatureStart, matchMarker } from "./markers";

const LIGATURES: Record<string, string> = { "ﬁ": "fi", "ﬂ": "fl", "ﬀ": "ff", "ﬃ": "ffi", "ﬄ": "ffl", "ﬅ": "st", "ﬆ": "st" };

const PAGE_NUMBER = /^\s*(?:page\s+)?\d{1,3}(?:\s*(?:of|\/)\s*\d{1,3})?\s*$|^\s*[-–]\s*\d{1,3}\s*[-–]\s*$/i;
const TOC_LINE = /\.{4,}\s*\d{1,3}\s*$/;

export function cleanText(raw: string): string {
  let t = raw
    .replace(/\r\n?/g, "\n")
    .replace(/\f/g, "\n\n")
    .replace(/[   ]/g, " ")
    .replace(/\t/g, " ")
    .replace(/[​-‍⁠﻿­]/g, "")
    .replace(/[ﬁﬂﬀﬃﬄﬅﬆ]/g, (c) => LIGATURES[c] ?? c)
    .replace(/^[ ]*[●▪◦‣∙·][ ]+/gm, "• ");

  let lines = t.split("\n").map((l) => l.replace(/ {2,}/g, " ").replace(/\s+$/, ""));

  // running headers/footers: short lines repeated 3+ times (digits ignored)
  const counts = new Map<string, number>();
  for (const l of lines) {
    const k = l.trim().replace(/\d+/g, "#");
    if (k.length > 0 && k.length <= 60) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  lines = lines.filter((l) => {
    const trimmed = l.trim();
    if (!trimmed) return true;
    if (PAGE_NUMBER.test(trimmed) || TOC_LINE.test(trimmed)) return false;
    const k = trimmed.replace(/\d+/g, "#");
    if ((counts.get(k) ?? 0) >= 3 && !matchMarker(trimmed) && !/^[•\-*]/.test(trimmed)) return false;
    return true;
  });

  t = lines.join("\n").replace(/\n{3,}/g, "\n\n");
  return t.trim();
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)))];
}

const TERMINAL = /[.!?:;]["”’')\]]*$/;
const FORM_LINE = /_{3,}/;
const LABEL_START = /^[A-Z][A-Za-z .]{0,24}:\s/;
const BULLET = /^[•\-*–]\s/;

/** True when the text looks like it was hard-wrapped at a fixed width. */
export function isHardWrapped(text: string): boolean {
  const lines = text.split("\n").map((l) => l.trim());
  const lens = lines.filter(Boolean).map((l) => l.length);
  if (lens.length < 4) return false;
  const p90 = percentile(lens, 0.9);
  if (p90 > 160) return false;
  let signals = 0;
  for (let i = 0; i + 1 < lines.length; i++) {
    const a = lines[i];
    const b = lines[i + 1];
    if (!a || !b) continue;
    if (a.length >= p90 * 0.7 && !TERMINAL.test(a) && /^[a-z(]/.test(b)) signals++;
  }
  return signals >= (lens.length < 12 ? 1 : 2);
}

function isMarkerOnly(line: string): boolean {
  const m = matchMarker(line);
  return Boolean(m && m.rest.trim() === "");
}

/** Joins visual lines back into paragraphs. Leaves un-wrapped text untouched. */
export function reflow(text: string): string {
  if (!isHardWrapped(text)) return text;
  const lines = text.split("\n");
  const lens = lines.map((l) => l.trim().length).filter(Boolean);
  const p90 = percentile(lens, 0.9);
  const out: string[] = [];
  let cur: string | null = null;

  const shouldJoin = (prev: string, next: string): boolean => {
    // a long line with no closing punctuation was cut by the margin, so whatever
    // comes next continues it, even "Addendum A. Landlord may…" or "BY JURY."
    const wrapped = !/(?:[.:;!?,]["”’')\]]*|[;,]\s+(?:and|or))$/.test(prev) && prev.length >= p90 * 0.6;
    if (isMarkerOnly(prev) || (isCapsHeading(prev) && !wrapped)) return false;
    if (isSignatureStart(next)) return false;
    if (matchMarker(next) || isCapsHeading(next)) return wrapped;
    if (BULLET.test(next)) return false;
    if (FORM_LINE.test(prev) || FORM_LINE.test(next)) return false;
    if (LABEL_START.test(next) && !/^[a-z]/.test(next)) return false;
    if (TERMINAL.test(prev) && prev.length < p90 * 0.7) return false;
    return true;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      if (cur !== null) out.push(cur);
      cur = null;
      out.push("");
      continue;
    }
    if (cur === null) {
      cur = line;
      continue;
    }
    if (shouldJoin(cur, line)) {
      const hyphenBreak: boolean = /[A-Za-z]-$/.test(cur) && /^[a-z]/.test(line);
      cur = hyphenBreak ? cur + line : `${cur} ${line}`;
    } else {
      out.push(cur);
      cur = line;
    }
  }
  if (cur !== null) out.push(cur);
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** cleanText + reflow: the canonical document string. */
export function normalizeText(raw: string): string {
  return reflow(cleanText(raw));
}
