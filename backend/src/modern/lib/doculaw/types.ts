/* ─────────────────────────────────────────────────────────
 * DocuLaw shared types. Every offset (clauses, risk spans,
 * obligations, selections) points into ONE canonical string:
 * the normalized document text produced by normalize.ts.
 * ───────────────────────────────────────────────────────── */

export type Level = "lawyer" | "plain" | "eli5";
export const LEVELS: Level[] = ["lawyer", "plain", "eli5"];

export type Severity = "high" | "medium" | "low";

export type DocKind = "pdf" | "docx" | "txt" | "md" | "paste" | "sample";

export type Clause = {
  id: string;
  /** number as written: "4.1", "(a)", "Article IV", "" for unnumbered */
  number: string;
  /** full path label: "4.1", "13(a)", "7(b)(ii)", "Art. IV", "Preamble" */
  ref: string;
  /** how the UI cites it: "§13(a)", "Art. IV", "Signatures" */
  citation: string;
  /** display title in sentence case ("" when the clause has none) */
  title: string;
  /** own body text (children excluded) === doc.slice(textStart, end) */
  text: string;
  /** depth in the tree, 0 = top level */
  level: number;
  /** offset of the marker (or heading) */
  start: number;
  /** offset where the body text begins */
  textStart: number;
  /** end of the clause's own text (exclusive) */
  end: number;
  /** end of the clause including all descendants */
  subtreeEnd: number;
  /** numbering style key, for debugging and tests */
  style: string;
  parentId: string | null;
  children: Clause[];
};

export type ClauseTree = {
  /** detected document title, e.g. "Residential Lease Agreement" */
  title: string | null;
  roots: Clause[];
  /** pre-order list of every clause */
  flat: Clause[];
};

export type RiskKind =
  | "auto-renewal"
  | "early-termination"
  | "late-fee"
  | "deposit"
  | "indemnification"
  | "liability-waiver"
  | "arbitration"
  | "class-waiver"
  | "jury-waiver"
  | "entry"
  | "rent-increase"
  | "sublet-ban"
  | "non-compete"
  | "confidentiality"
  | "unilateral-change"
  | "governing-law"
  | "attorney-fees"
  | "holdover"
  | "extra-fee"
  | "user";

export type RiskFlag = {
  id: string;
  clauseId: string;
  kind: RiskKind;
  severity: Severity;
  /** absolute offsets into the canonical text */
  start: number;
  end: number;
  title: string;
  why: string;
  /** role that bears the risk ("Tenant"), "both", or null when unclear */
  burden: string | null;
};

export type Cadence = "once" | "monthly" | "yearly" | "daily" | "per-event";

export type Obligation = {
  id: string;
  clauseId: string;
  /** role name that owes it ("Tenant"), or "Both" */
  party: string;
  kind: "must" | "must-not";
  /** short action text, sentence case: "Pay monthly rent" */
  action: string;
  amount: number | null;
  /** how the amount was found: "$1,850.00", "2 months' rent" */
  amountText: string | null;
  cadence: Cadence | null;
  /** only owed if something happens (late, early exit, damage...) */
  conditional: boolean;
  /** deadline / date / frequency in short form: "by the 1st", "within 21 days" */
  when: string | null;
  /** absolute span of the source sentence */
  start: number;
  end: number;
};

export type Roles = {
  /** the two main parties, consumer side first: ["Tenant", "Landlord"] */
  parties: string[];
  /** names found next to each role definition */
  names: Record<string, string>;
  /** role that usually pays (subject of most "shall pay") */
  payer: string | null;
};

/** "Tenant" | "Landlord" | ... or "neutral" for "Just reading" */
export type Perspective = string;

export type Rewrite = { clauseId: string; level: Level; text: string; source: "fixture" | "rules" | "model" };

export type KeyDate = { label: string; date: string; iso: string; clauseId: string | null };

export type DocMeta = {
  documentId?: string;
  name: string;
  kind: DocKind;
  bytes: number;
  pages: number | null;
  chars: number;
  sampleId: string | null;
};
