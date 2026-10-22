/* ─────────────────────────────────────────────────────────
 * CLAUSES — the case study's "hardest part": numbering
 * schemes, nesting and titles from plain text.
 *
 * Line-based. Each line is blank, a marker line, a heading,
 * or a continuation of the current clause. Markers are placed
 * with a path stack (the open clauses from root to current):
 *
 *   style already on the stack  → sibling at that depth if the
 *                                 value is the next in sequence
 *   style new to this path      → child, only if it starts a
 *                                 sequence (1, a, i, A, I, x.1)
 *   top-level style seen before → continues the root sequence
 *
 * Sequence checks are what reject false markers: a wrapped
 * line that starts "30 days after..." or "(c) above" never
 * opens a clause. Ambiguous markers ("(i)", "C.", "Exhibit C")
 * carry every reading and the best-scoring one wins.
 *
 * Offsets: clause.text === doc.slice(textStart, end).
 * ───────────────────────────────────────────────────────── */

import type { Clause, ClauseTree } from "./types";
import { isCapsHeading, isDocTitle, isSignatureStart, isTitleLike, matchMarker, type Candidate, type MarkerMatch } from "./markers";
import { capitalize, sentenceCase, slug, upperRatio } from "./text";

type Line = { start: number; end: number; trimStart: number; text: string; blank: boolean };

export function splitLines(doc: string): Line[] {
  const out: Line[] = [];
  let pos = 0;
  for (const raw of doc.split("\n")) {
    const lead = raw.length - raw.replace(/^\s+/, "").length;
    const trail = raw.length - raw.replace(/\s+$/, "").length;
    out.push({
      start: pos,
      end: pos + raw.length - trail,
      trimStart: pos + lead,
      text: raw.trim(),
      blank: raw.trim().length === 0,
    });
    pos += raw.length + 1;
  }
  return out;
}

type Entry = {
  style: string;
  value: number;
  parts?: number[];
  /** numeric path used for decimal prefix checks ("Article 2" → [2], "2.3" → [2,3]) */
  path: number[] | null;
  mdLevel?: number;
  clause: Clause;
};

type Option = { score: number; action: "sibling" | "child" | "root" | "md" | "forceTop"; index?: number; cand: Candidate };

const KW_PREFIX: Record<string, string> = {
  article: "Art. ",
  part: "Part ",
  schedule: "Sch. ",
  exhibit: "Ex. ",
  addendum: "Add. ",
  appendix: "App. ",
  annex: "Annex ",
  rider: "Rider ",
  clause: "",
  section: "",
};

const PLAIN_CITATION = new Set(["preamble", "caps", "sig", "paragraph"]);

/** "§13(a)" for numbered clauses; headings, articles and addenda cite by name. */
function citationOf(ref: string, style: string): string {
  if (PLAIN_CITATION.has(style)) return ref;
  if (/^[\d(]/.test(ref) || /^[A-Za-z]{1,4}(?:\([^)]*\))*$/.test(ref)) return `§${ref}`;
  return ref;
}

/** "2.1" right after "1.3": a new group at the same depth whose parent line is missing */
function isNextGroup(c: number[], e: number[]): boolean {
  const n = c.length;
  if (n !== e.length || n < 2 || c[n - 1] !== 1) return false;
  for (let i = 0; i < n - 2; i++) if (c[i] !== e[i]) return false;
  return c[n - 2] === e[n - 2] + 1;
}

function isFirst(c: Candidate): boolean {
  return c.value === 1;
}

function prefixEq(a: number[], b: number[], n: number): boolean {
  if (b.length < n) return false;
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Title Case for the document title line */
function titleCase(s: string): string {
  const small = new Set(["of", "and", "or", "the", "to", "for", "in", "on", "by", "with", "a", "an", "at"]);
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i > 0 && small.has(w) ? w : capitalize(w)))
    .join(" ");
}

function cleanTitle(raw: string): string {
  const t = raw.replace(/^[*_]+|[*_]+$/g, "").replace(/[.:]+$/, "").trim();
  return sentenceCase(t);
}

const CAPS_TITLE = /^([A-Z][A-Z0-9 ,'’&/()-]{0,68}?[A-Z0-9)’'])\s*(?:[.:]|\s[-–—]\s)(?:\*\*|__)?(?=\s|$)/;
const TITLE_CASE_TITLE =
  /^((?:[A-Z][\w'’/&-]*)(?:\s+(?:[A-Z][\w'’/&-]*|of|and|or|the|to|for|in|on|by|with|a|an|&)){0,6})[.:](?:\*\*|__)?(?=\s+\S)/;
const VERBISH = /\b(?:SHALL|WILL|MAY|MUST|IS|ARE|WAIVES?|AGREES?|ACKNOWLEDGES?|HAS|HAVE|NOT)\b/;

/**
 * Splits "RENT. Tenant shall pay..." into a title and the offset where the body starts.
 * `restOffset` is the absolute offset of `rest` in the document.
 */
export function extractInlineTitle(rest: string, restOffset: number): { title: string; bodyStart: number | null } {
  const r = rest.replace(/^(?:\*\*|__)/, "");
  const shift = rest.length - r.length;
  if (!r.trim()) return { title: "", bodyStart: null };

  const caps = r.match(CAPS_TITLE);
  if (caps) {
    const t = caps[1];
    const words = t.trim().split(/\s+/).length;
    if (upperRatio(t) >= 0.9 && words <= 8 && !VERBISH.test(t)) {
      const after = r.slice(caps[0].length);
      const body = after.replace(/^[\s*_]+/, "");
      return {
        title: cleanTitle(t),
        bodyStart: body ? restOffset + shift + caps[0].length + (after.length - body.length) : null,
      };
    }
  }
  // the whole rest is a short caps title: "ARTICLE I PREMISES" style
  if (isCapsHeading(r) && r.trim().split(/\s+/).length <= 8) {
    return { title: cleanTitle(r), bodyStart: null };
  }

  const tc = r.match(TITLE_CASE_TITLE);
  if (tc) {
    const words = tc[1].split(/\s+/);
    const lastWord = words[words.length - 1].toLowerCase();
    if (words.length === 1 || !["of", "and", "or", "the", "to", "for", "in", "on", "by", "with", "a", "an", "&"].includes(lastWord)) {
      const after = r.slice(tc[0].length);
      const body = after.replace(/^[\s*_]+/, "");
      return { title: cleanTitle(tc[1]), bodyStart: restOffset + shift + tc[0].length + (after.length - body.length) };
    }
  }
  // the whole rest is a short Title Case title: "Monthly Rent" / "Monthly Rent."
  if (isTitleLike(r) && !/[a-z]\.\s+\S/.test(r)) {
    const words = r.trim().replace(/[.:]$/, "").split(/\s+/);
    if (words.length <= 6) return { title: cleanTitle(r), bodyStart: null };
  }
  return { title: "", bodyStart: restOffset };
}

export function parseClauses(doc: string): ClauseTree {
  const lines = splitLines(doc);
  const roots: Clause[] = [];
  const flat: Clause[] = [];
  const ids = new Set<string>();
  const headerEnd = new Map<Clause, number>();

  let stack: Entry[] = [];
  const rootStyles = new Set<string>();
  const lastRootValue = new Map<string, number>();
  const lastSeen = new Map<string, number>();
  let current: Clause | null = null;
  let preamble: Clause | null = null;
  let docTitle: string | null = null;
  let nonBlank = 0;
  let markerClauses = 0;

  const uniqueId = (base: string) => {
    let id = base || "clause";
    let n = 2;
    while (ids.has(id)) id = `${base}-${n++}`;
    ids.add(id);
    return id;
  };

  const make = (
    fields: Pick<Clause, "number" | "ref" | "title" | "style" | "start">,
    parent: Clause | null,
    level: number,
    idBase: string,
  ): Clause => {
    const clause: Clause = {
      id: uniqueId(idBase),
      number: fields.number,
      ref: fields.ref,
      citation: citationOf(fields.ref, fields.style),
      title: fields.title,
      text: "",
      level,
      start: fields.start,
      textStart: -1,
      end: fields.start,
      subtreeEnd: fields.start,
      style: fields.style,
      parentId: parent?.id ?? null,
      children: [],
    };
    if (parent) parent.children.push(clause);
    else roots.push(clause);
    flat.push(clause);
    return clause;
  };

  const addBody = (clause: Clause, from: number, to: number) => {
    if (clause.textStart < 0) clause.textStart = from;
    clause.end = Math.max(clause.end, to);
  };

  const numericPath = (c: Candidate): number[] | null => {
    if (c.parts) return c.parts;
    if (c.family === "kw" && c.value > 0) return [c.value];
    return null;
  };

  const nearestNumeric = (): Entry | null => {
    for (let i = stack.length - 1; i >= 0; i--) if (stack[i].path) return stack[i];
    return null;
  };

  const options = (c: Candidate, headingLike: boolean): Option[] => {
    const out: Option[] = [];
    if (c.family === "md") return [{ score: 3, action: "md", cand: c }];
    if (c.forceTop) {
      const prev = lastSeen.get(c.style);
      if (prev === undefined ? isFirst(c) : c.value === prev + 1 || isFirst(c)) out.push({ score: 3, action: "forceTop", cand: c });
      return out;
    }

    const idx = stack.findIndex((e) => e.style === c.style);
    if (idx >= 0) {
      const e = stack[idx];
      if (c.parts && e.parts) {
        const same = prefixEq(c.parts, e.parts, c.parts.length - 1);
        if (same && c.value === e.value + 1) out.push({ score: 3, action: "sibling", index: idx, cand: c });
        else if (same && c.value > e.value + 1 && c.value <= e.value + 3 && headingLike)
          out.push({ score: 1, action: "sibling", index: idx, cand: c });
        else if (isNextGroup(c.parts, e.parts)) out.push({ score: 2, action: "sibling", index: idx, cand: c });
      } else {
        if (c.value === e.value + 1) out.push({ score: 3, action: "sibling", index: idx, cand: c });
        else if (isFirst(c)) out.push({ score: 1.5, action: "sibling", index: idx, cand: c });
        else if (c.value > e.value + 1 && c.value <= e.value + 3 && headingLike)
          out.push({ score: 1, action: "sibling", index: idx, cand: c });
      }
    }

    if (rootStyles.has(c.style) && !(idx === 0)) {
      const prev = lastRootValue.get(c.style) ?? 0;
      const topLevelShape = !c.parts || c.parts.length === 1;
      if (topLevelShape && c.value === prev + 1) out.push({ score: 3, action: "root", cand: c });
      else if (topLevelShape && c.value > prev + 1 && c.value <= prev + 3 && headingLike) out.push({ score: 1, action: "root", cand: c });
    }

    if (idx < 0) {
      if (c.parts && c.parts.length > 1) {
        const anc = nearestNumeric();
        if (c.value === 1 && anc?.path && prefixEq(c.parts, anc.path, c.parts.length - 1) && anc.path.length === c.parts.length - 1)
          out.push({ score: 2.5, action: "child", cand: c });
        else if (c.value === 1 && !anc && stack.length === 0) out.push({ score: 2, action: "child", cand: c });
      } else if (isFirst(c)) {
        out.push({ score: 2, action: "child", cand: c });
      } else {
        // numbering that continues across containers: "RENT" 1. 2.  "DEPOSIT" 3. 4.
        const prev = lastSeen.get(c.style);
        const continuable = (c.family === "dec" && (!c.parts || c.parts.length === 1)) || c.family === "kw";
        if (continuable && prev !== undefined && c.value === prev + 1) out.push({ score: 2, action: "child", cand: c });
        else if (stack.length === 0 && markerClauses === 0) out.push({ score: 1, action: "root", cand: c });
      }
    }
    return out;
  };

  const refFor = (c: Candidate, raw: string, parent: Clause | null): { number: string; ref: string } => {
    if (c.family === "kw") {
      const id = /^[ivxlcdm]+$/i.test(c.inner) && c.style.endsWith(":roman") ? c.inner.toUpperCase() : c.inner;
      const prefix = KW_PREFIX[c.keyword ?? ""] ?? "";
      const word = raw.startsWith("§") ? "§" : capitalize((c.keyword ?? "").toLowerCase());
      return { number: word === "§" ? `§${id}` : `${word} ${id}`, ref: `${prefix}${id}` };
    }
    if (c.family === "dec") {
      const num = c.inner;
      if (c.parts && c.parts.length === 1 && parent && !/^\d/.test(parent.ref) && !/^(Art|Part)\b/.test(parent.ref) && parent.style.startsWith("kw:"))
        return { number: num, ref: `${parent.ref}(${num})` };
      return { number: num, ref: num };
    }
    // alpha / roman / num families
    const shown = raw.replace(/\.$/, "");
    if (!parent || parent.style === "preamble") return { number: shown, ref: c.inner };
    if (parent.style === "caps" || parent.style === "sig") return { number: shown, ref: `${parent.ref} (${c.inner})` };
    return { number: shown, ref: `${parent.ref}(${c.inner})` };
  };

  const pushEntry = (c: Candidate, clause: Clause) => {
    stack.push({ style: c.style, value: c.value, parts: c.parts, path: numericPath(c), mdLevel: c.mdLevel, clause });
    lastSeen.set(c.style, c.value);
    if (clause.level === 0) {
      rootStyles.add(c.style);
      lastRootValue.set(c.style, c.value);
    }
  };

  const openFromMarker = (opt: Option, mm: MarkerMatch, line: Line, nextLine: Line | null): boolean => {
    const c = opt.cand;
    let parent: Clause | null = null;
    switch (opt.action) {
      case "sibling":
        stack = stack.slice(0, opt.index);
        parent = stack.length ? stack[stack.length - 1].clause : null;
        break;
      case "child":
        parent = stack.length ? stack[stack.length - 1].clause : null;
        break;
      case "root":
      case "forceTop":
        stack = [];
        parent = null;
        break;
      case "md": {
        const lvl = c.mdLevel ?? 1;
        let k = stack.length - 1;
        while (k >= 0 && !(stack[k].mdLevel !== undefined && (stack[k].mdLevel as number) < lvl)) k--;
        stack = stack.slice(0, k + 1);
        parent = stack.length ? stack[stack.length - 1].clause : null;
        break;
      }
    }
    const level = stack.length;
    const restOffset = line.trimStart + mm.length;
    let { title, bodyStart } = extractInlineTitle(mm.rest, restOffset);
    let consumedNext = false;
    let headerLineEnd = line.end;

    // marker-only line: "ARTICLE IV" / "DEFINITIONS" on the next line
    if (!mm.rest.trim() && nextLine && !nextLine.blank) {
      const nt = nextLine.text;
      if (!matchMarker(nt) && (isCapsHeading(nt) || (isTitleLike(nt) && nt.split(/\s+/).length <= 8))) {
        title = cleanTitle(nt);
        consumedNext = true;
        headerLineEnd = nextLine.end;
      }
    }

    let number: string;
    let ref: string;
    if (c.family === "md") {
      const inner = matchMarker(mm.rest);
      const numInHeading = inner && inner.candidates[0]?.family !== "md" ? inner.raw.replace(/\.$/, "") : "";
      if (inner && numInHeading) {
        const t2 = extractInlineTitle(inner.rest, restOffset + inner.length);
        title = t2.title || cleanTitle(inner.rest);
        bodyStart = t2.bodyStart;
      } else {
        title = cleanTitle(mm.rest);
        bodyStart = null;
      }
      number = numInHeading;
      ref = numInHeading || title;
    } else {
      ({ number, ref } = refFor(c, mm.raw, parent));
    }

    const idBase = slug(ref) || slug(title) || "clause";
    const clause = make({ number, ref, title, style: c.style, start: line.trimStart }, parent, level, idBase);
    headerEnd.set(clause, headerLineEnd);
    if (bodyStart !== null) addBody(clause, bodyStart, line.end);
    pushEntry(c, clause);
    if (c.family !== "md") markerClauses++;
    current = clause;
    return consumedNext;
  };

  const openHeading = (line: Line, title: string, style: "caps" | "sig", bodyFromLine: boolean) => {
    stack = [];
    const clause = make({ number: "", ref: title, title, style, start: line.trimStart }, null, 0, slug(title));
    headerEnd.set(clause, line.end);
    if (bodyFromLine) addBody(clause, line.trimStart, line.end);
    stack.push({ style, value: 0, path: null, clause });
    current = clause;
  };

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    if (line.blank) continue;
    nonBlank++;
    const t = line.text;

    if (nonBlank === 1 && isDocTitle(t)) {
      docTitle = titleCase(t.replace(/[.:]$/, ""));
      continue;
    }

    if (isSignatureStart(t)) {
      openHeading(line, "Signatures", "sig", true);
      continue;
    }

    const mm = matchMarker(t);
    if (mm) {
      const rest = mm.rest.replace(/^[*_]+/, "");
      const headingLike = rest.length === 0 || /^[A-Z"“(]/.test(rest);
      let best: Option | null = null;
      for (const c of mm.candidates) {
        for (const o of options(c, headingLike)) if (!best || o.score > best.score) best = o;
      }
      if (best) {
        let nextIdx = -1;
        for (let k = li + 1; k < lines.length; k++) {
          if (!lines[k].blank) {
            nextIdx = k;
            break;
          }
        }
        const consumed = openFromMarker(best, mm, line, nextIdx >= 0 ? lines[nextIdx] : null);
        if (consumed) li = nextIdx;
        continue;
      }
    }

    if (isCapsHeading(t)) {
      openHeading(line, cleanTitle(t), "caps", false);
      continue;
    }

    // continuation text
    if (!current) {
      if (!preamble) {
        preamble = make({ number: "", ref: "Preamble", title: "Preamble", style: "preamble", start: line.trimStart }, null, 0, "preamble");
        headerEnd.set(preamble, line.trimStart);
      }
      current = preamble;
    }
    addBody(current, line.trimStart, line.end);
  }

  if (preamble) {
    const body = doc.slice(preamble.textStart, preamble.end);
    if (/\bbetween\b/i.test(body) && /\band\b/i.test(body)) preamble.title = "Parties";
  }

  // structureless documents: fall back to paragraphs
  const structured = flat.filter((c) => c.style !== "preamble");
  if (structured.length < 2) return paragraphFallback(doc, docTitle);

  for (const c of flat) {
    if (c.textStart < 0) {
      const he = headerEnd.get(c) ?? c.start;
      c.textStart = he;
      c.end = he;
    } else {
      c.end = Math.max(c.end, c.textStart);
    }
    c.text = doc.slice(c.textStart, c.end);
  }
  const finish = (c: Clause): number => {
    let e = c.end;
    for (const ch of c.children) e = Math.max(e, finish(ch));
    c.subtreeEnd = e;
    return e;
  };
  roots.forEach(finish);

  return { title: docTitle, roots, flat };
}

function paragraphFallback(doc: string, docTitle: string | null): ClauseTree {
  const lines = splitLines(doc);
  const blocks: { start: number; end: number }[] = [];
  const hasBlank = lines.some((l) => l.blank);
  let cur: { start: number; end: number } | null = null;
  let skippedTitle = false;
  for (const l of lines) {
    if (l.blank) {
      if (cur) blocks.push(cur);
      cur = null;
      continue;
    }
    if (docTitle && !skippedTitle) {
      skippedTitle = true;
      if (isDocTitle(l.text)) continue;
    }
    if (!hasBlank) {
      blocks.push({ start: l.trimStart, end: l.end });
      continue;
    }
    if (!cur) cur = { start: l.trimStart, end: l.end };
    else cur.end = l.end;
  }
  if (cur) blocks.push(cur);

  const flat: Clause[] = blocks.map((b, i) => ({
    id: `p-${i + 1}`,
    number: `¶${i + 1}`,
    ref: `¶${i + 1}`,
    citation: `¶${i + 1}`,
    title: "",
    text: doc.slice(b.start, b.end),
    level: 0,
    start: b.start,
    textStart: b.start,
    end: b.end,
    subtreeEnd: b.end,
    style: "paragraph",
    parentId: null,
    children: [],
  }));
  return { title: docTitle, roots: flat, flat };
}

/** Deepest clause whose own text contains [start, end). */
export function clauseAt(flat: Clause[], offset: number): Clause | null {
  for (const c of flat) if (offset >= c.textStart && offset < c.end) return c;
  // header text (marker, title) or a gap: deepest clause whose subtree covers it
  let best: Clause | null = null;
  for (const c of flat) if (offset >= c.start && offset < Math.max(c.subtreeEnd, c.start + 1) && (!best || c.level >= best.level)) best = c;
  return best;
}

/** Human summary of the numbering styles found: "1. · 1.1 · (a) · (i)" */
export function describeNumbering(flat: Clause[]): string[] {
  const seen: string[] = [];
  const label = (c: Clause): string | null => {
    const s = c.style;
    if (s.startsWith("dec")) return Number(s.slice(3)) === 1 ? "1." : Array.from({ length: Number(s.slice(3)) }, () => "1").join(".");
    if (s.startsWith("kw:")) return s.split(":")[1].replace(/^\w/, (m) => m.toUpperCase()) + (s.endsWith("roman") ? " I" : s.endsWith("alpha") ? " A" : " 1");
    const map: Record<string, string> = {
      "paren-lower": "(a)", "paren-upper": "(A)", "paren-lower-roman": "(i)", "paren-upper-roman": "(I)", "paren-num": "(1)",
      "rparen-lower": "a)", "rparen-upper": "A)", "rparen-lower-roman": "i)", "rparen-upper-roman": "I)", "rparen-num": "1)",
      "dot-lower": "a.", "dot-upper": "A.", "dot-lower-roman": "i.", "dot-upper-roman": "I.", caps: "HEADINGS",
    };
    if (s.startsWith("md")) return "#".repeat(Number(s.slice(2)));
    return map[s] ?? null;
  };
  for (const c of flat) {
    const l = label(c);
    if (l && !seen.includes(l)) seen.push(l);
  }
  return seen;
}

export function maxDepth(flat: Clause[]): number {
  return flat.reduce((m, c) => Math.max(m, c.level + 1), 0);
}
