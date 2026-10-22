/* ─────────────────────────────────────────────────────────
 * Clause markers: what a numbered or headed line looks like.
 * matchMarker() only reads one line and returns every
 * plausible reading ("(i)" is a letter after "(h)" and a roman
 * numeral anywhere else). clauses.ts picks between them with
 * sequence context.
 * ───────────────────────────────────────────────────────── */

import { letterToInt, romanToInt, upperRatio, wordsToNumber } from "./text";

export type Family = "dec" | "alpha" | "roman" | "num" | "kw" | "md";

export type Candidate = {
  /** sequence identity: "dec2", "paren-lower", "paren-lower-roman", "kw:article:roman" */
  style: string;
  family: Family;
  /** ordinal of the last component */
  value: number;
  /** decimal components ("4.1.2" → [4,1,2]) for dec and numeric keyword markers */
  parts?: number[];
  /** identifier as written ("a", "iv", "4.1", "IV", "A") */
  inner: string;
  /** keyword for kw markers ("article", "section", "addendum"...) */
  keyword?: string;
  /** exhibits, schedules, addenda always start a new top-level block */
  forceTop?: boolean;
  /** markdown heading depth */
  mdLevel?: number;
};

export type MarkerMatch = {
  candidates: Candidate[];
  /** marker as written, trimmed ("(a)", "4.1", "ARTICLE IV") */
  raw: string;
  /** chars consumed from the start of the trimmed line up to `rest` */
  length: number;
  rest: string;
};

const KEYWORDS: Record<string, { key: string; forceTop?: boolean }> = {
  article: { key: "article" },
  art: { key: "article" },
  section: { key: "section" },
  sec: { key: "section" },
  "§": { key: "section" },
  "§§": { key: "section" },
  part: { key: "part" },
  clause: { key: "clause" },
  schedule: { key: "schedule", forceTop: true },
  exhibit: { key: "exhibit", forceTop: true },
  addendum: { key: "addendum", forceTop: true },
  appendix: { key: "appendix", forceTop: true },
  annex: { key: "annex", forceTop: true },
  rider: { key: "rider", forceTop: true },
};

const KW_RE =
  /^(ARTICLE|Article|ART\.|Art\.|SECTION|Section|SEC\.|Sec\.|§§?|PART|Part|CLAUSE|Clause|SCHEDULE|Schedule|EXHIBIT|Exhibit|ADDENDUM|Addendum|APPENDIX|Appendix|ANNEX|Annex|RIDER|Rider)\s*(\d{1,3}(?:\.\d{1,3})*|[IVXLCDM]{1,7}|[ivxlcdm]{1,7}|[A-Z]|(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|NINETEEN|TWENTY)|(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Thirteen|Fourteen|Fifteen|Sixteen|Seventeen|Eighteen|Nineteen|Twenty))(?![A-Za-z0-9])\.?/;

/** after a keyword marker: end, punctuation, or a capitalized title */
const KW_TAIL = /^(?:\s*$|\s*[.:\-–—)]|\s+[A-Z"“(\[])/;

function kwCandidates(id: string, key: string, forceTop: boolean | undefined): Candidate[] {
  const base = { family: "kw" as const, keyword: key, forceTop, inner: id };
  if (/^\d/.test(id)) {
    const parts = id.split(".").map((p) => parseInt(p, 10));
    return [{ ...base, style: `kw:${key}:d${parts.length}`, value: parts[parts.length - 1], parts }];
  }
  const out: Candidate[] = [];
  const roman = romanToInt(id);
  if (roman !== null) out.push({ ...base, style: `kw:${key}:roman`, value: roman });
  if (/^[A-Za-z]$/.test(id)) out.push({ ...base, style: `kw:${key}:alpha`, value: letterToInt(id) ?? 0 });
  const word = wordsToNumber(id);
  if (word !== null && roman === null && !/^[A-Za-z]$/.test(id)) out.push({ ...base, style: `kw:${key}:word`, value: word });
  return out;
}

function alphaRomanCandidates(inner: string, prefix: string): Candidate[] {
  const out: Candidate[] = [];
  const upper = inner === inner.toUpperCase();
  const casing = upper ? "upper" : "lower";
  const roman = romanToInt(inner);
  if (roman !== null) out.push({ style: `${prefix}-${casing}-roman`, family: "roman", value: roman, inner });
  const letter = letterToInt(inner);
  if (letter !== null) out.push({ style: `${prefix}-${casing}`, family: "alpha", value: letter, inner });
  return out;
}

/**
 * Reads the clause marker at the start of an already-trimmed line.
 * Returns null when the line does not start with anything marker-shaped.
 */
export function matchMarker(line: string): MarkerMatch | null {
  // tolerate markdown emphasis around the marker: "**1. Rent**"
  const lead = line.match(/^(?:\*\*|__)/)?.[0] ?? "";
  const t = line.slice(lead.length);

  // markdown heading
  const md = t.match(/^(#{1,6})\s+/);
  if (md) {
    return {
      candidates: [{ style: `md${md[1].length}`, family: "md", value: 0, inner: "", mdLevel: md[1].length }],
      raw: md[1],
      length: lead.length + md[0].length,
      rest: t.slice(md[0].length),
    };
  }

  // Article / Section / § / Exhibit ...
  const kw = t.match(KW_RE);
  if (kw && KW_TAIL.test(t.slice(kw[0].length))) {
    const word = kw[1].toLowerCase().replace(/\.$/, "");
    const spec = KEYWORDS[word];
    if (spec) {
      const id = kw[2];
      const candidates = kwCandidates(id, spec.key, spec.forceTop);
      if (candidates.length) {
        const sep = t.slice(kw[0].length).match(/^\s*(?:[.:\-–—)]\s*)?/)?.[0] ?? "";
        return {
          candidates,
          raw: kw[0].replace(/\.$/, "").trim(),
          length: lead.length + kw[0].length + sep.length,
          rest: t.slice(kw[0].length + sep.length),
        };
      }
    }
  }

  // decimals: "4.1", "4.1.2", "4.1." or "4." / "4)"
  const multi = t.match(/^(\d{1,3}(?:\.\d{1,3})+)\.?(?=\s|$)/);
  const single = multi ? null : t.match(/^(\d{1,3})([.)])(?=\s|$)/);
  const dec = multi ?? single;
  if (dec) {
    const after = t.slice(dec[0].length);
    const rest = after.replace(/^\s+/, "");
    // clause text after a number starts with a capital, a quote or a paren
    if (rest.length === 0 || /^[A-Z"“(\[]/.test(rest)) {
      const parts = dec[1].split(".").map((p) => parseInt(p, 10));
      const rparen = single?.[2] === ")";
      const candidate: Candidate = rparen
        ? { style: "rparen-num", family: "num", value: parts[0], inner: dec[1] }
        : { style: `dec${parts.length}`, family: "dec", value: parts[parts.length - 1], parts, inner: dec[1] };
      return { candidates: [candidate], raw: dec[0].trim(), length: lead.length + dec[0].length + (after.length - rest.length), rest };
    }
    return null;
  }

  // "(a)" "(iv)" "(A)" "(IV)" "(1)" "(aa)"
  const paren = t.match(/^\(([a-z]{1,2}|[ivxlcdm]{1,7}|[A-Z]{1,2}|[IVXLCDM]{1,7}|\d{1,3})\)(?=\s|$)/);
  if (paren) {
    const inner = paren[1];
    const candidates = /^\d/.test(inner)
      ? [{ style: "paren-num", family: "num" as const, value: parseInt(inner, 10), inner }]
      : alphaRomanCandidates(inner, "paren");
    if (candidates.length) {
      const after = t.slice(paren[0].length);
      const rest = after.replace(/^\s+/, "");
      return { candidates, raw: paren[0], length: lead.length + paren[0].length + (after.length - rest.length), rest };
    }
  }

  // "a)" "iv)" "A)"
  const rp = t.match(/^([a-z]{1,2}|[ivxlcdm]{1,7}|[A-Z]|[IVXLCDM]{1,7})\)(?=\s)/);
  if (rp) {
    const candidates = alphaRomanCandidates(rp[1], "rparen");
    if (candidates.length) {
      const after = t.slice(rp[0].length);
      const rest = after.replace(/^\s+/, "");
      return { candidates, raw: rp[0], length: lead.length + rp[0].length + (after.length - rest.length), rest };
    }
  }

  // "a." "iv." "A." "IV."
  const dot = t.match(/^([a-z]|[ivxlcdm]{2,7}|[A-Z]|[IVXLCDM]{2,7})\.(?=\s)/);
  if (dot) {
    const candidates = alphaRomanCandidates(dot[1], "dot");
    if (candidates.length) {
      const after = t.slice(dot[0].length);
      const rest = after.replace(/^\s+/, "");
      return { candidates, raw: dot[0], length: lead.length + dot[0].length + (after.length - rest.length), rest };
    }
  }

  return null;
}

/* ── Headings ───────────────────────────────────────────── */

const SENTENCE_VERB =
  /\b(?:SHALL|WILL|MAY|MUST|IS|ARE|WAS|WERE|HAS|HAVE|HAD|DOES|DO|NOT|WAIVES?|AGREES?|ACKNOWLEDGES?|ACCEPTS?|UNDERSTANDS?|CERTIFIES|REPRESENTS|WARRANTS|CONSENTS?)\b/;

/** A short, mostly-uppercase line like "SECURITY DEPOSIT" or "GOVERNING LAW." */
export function isCapsHeading(line: string): boolean {
  const t = line.trim();
  if (t.length < 3 || t.length > 80) return false;
  if (/_{3,}|\.{4,}/.test(t)) return false;
  if (/[,;]$/.test(t)) return false;
  const words = t.split(/\s+/);
  if (words.length > 9) return false;
  const letters = t.replace(/[^A-Za-z]/g, "");
  if (letters.length < 3) return false;
  if (upperRatio(t) < 0.85) return false;
  if (SENTENCE_VERB.test(t)) return false;
  // signature-block labels ("TENANT: MARLOWE QUINTERO", "DATE:") are form fields
  if (FORM_LABEL.test(t)) return false;
  return true;
}

const FORM_LABEL =
  /^(?:LANDLORD|TENANT|LESSOR|LESSEE|OWNER|RESIDENT|BY|NAME|PRINT NAME|DATE|TITLE|SIGNATURE|SIGNED|WITNESS|EMPLOYEE|EMPLOYER|COMPANY|CLIENT|CONTRACTOR|CUSTOMER|BUYER|SELLER|ADDRESS|EMAIL|PHONE|INITIALS)\s*:/i;

const CONNECTORS = new Set(["of", "and", "or", "the", "to", "for", "in", "on", "by", "with", "a", "an", "&", "at", "as", "upon"]);

/** A short Title Case line ("Rent and Fees", "Use of Premises") that can name a clause. */
export function isTitleLike(line: string): boolean {
  const t = line.trim().replace(/[.:]$/, "");
  if (t.length < 2 || t.length > 70) return false;
  if (/[.;,!?]/.test(t.slice(0, -1)) && !/^[\w'’ &\/()-]+$/.test(t)) return false;
  const words = t.split(/\s+/);
  if (words.length > 8) return false;
  const content = words.filter((w) => !CONNECTORS.has(w.toLowerCase()));
  if (!content.length) return false;
  const capped = content.filter((w) => /^[A-Z0-9"“(]/.test(w)).length;
  return capped / content.length >= 0.8 && /^[A-Z"“(]/.test(t);
}

const DOC_WORDS =
  /\b(AGREEMENT|LEASE|CONTRACT|ADDENDUM|POLICY|TERMS|CONDITIONS|AMENDMENT|MEMORANDUM|DEED|WAIVER|NDA|RENTAL|LICENSE|CHARTER|BYLAWS|STATEMENT OF WORK|RELEASE|PROMISSORY NOTE)\b/i;

/** First-line document titles: "RESIDENTIAL LEASE AGREEMENT", "Mutual Non-Disclosure Agreement". */
export function isDocTitle(line: string): boolean {
  const t = line.trim();
  if (matchMarker(t)) return false;
  if (!(isCapsHeading(t) || isTitleLike(t))) return false;
  return DOC_WORDS.test(t) && t.split(/\s+/).length <= 10;
}

export function isSignatureStart(line: string): boolean {
  return /^IN WITNESS WHEREOF\b/i.test(line.trim());
}
