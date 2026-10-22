/* ─────────────────────────────────────────────────────────
 * ANALYZE — canonical text in, everything the UI needs out.
 * Pure and synchronous (no model calls): structure, parties,
 * risks, obligations, key dates.
 * ───────────────────────────────────────────────────────── */

import type { Clause, KeyDate, Obligation, RiskFlag, Roles } from "./types";
import { describeNumbering, maxDepth, parseClauses } from "./clauses";
import { detectRoles } from "./parties";
import { detectRisks } from "./risk";
import { extractObligations } from "./obligations";
import { keyDates } from "./keydates";

/** A clause without its nested children (the flat list carries the tree via parentId). */
export type ClauseDTO = Omit<Clause, "children"> & { childIds: string[] };

export type Analysis = {
  title: string | null;
  docNoun: string;
  clauses: ClauseDTO[];
  roles: Roles;
  risks: RiskFlag[];
  obligations: Obligation[];
  keyDates: KeyDate[];
  numbering: string[];
  depth: number;
};

export function docNounOf(text: string, title: string | null): string {
  const t = `${title ?? ""} ${text.slice(0, 2000)}`;
  if (/\blease\b/i.test(t)) return "lease";
  if (/\bcontract\b/i.test(t)) return "contract";
  return "agreement";
}

export function toDTO(c: Clause): ClauseDTO {
  const { children, ...rest } = c;
  return { ...rest, childIds: children.map((ch) => ch.id) };
}

export function analyze(text: string): Analysis {
  const tree = parseClauses(text);
  const roles = detectRoles(text);
  return {
    title: tree.title,
    docNoun: docNounOf(text, tree.title),
    clauses: tree.flat.map(toDTO),
    roles,
    risks: detectRisks(text, tree.flat, { roles }),
    obligations: extractObligations(text, tree.flat, roles),
    keyDates: keyDates(tree.flat),
    numbering: describeNumbering(tree.flat),
    depth: maxDepth(tree.flat),
  };
}
