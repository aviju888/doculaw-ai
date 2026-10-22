/* ─────────────────────────────────────────────────────────
 * PARTIES — who is in the document ("Landlord", "Tenant"),
 * their names, and who usually pays. Drives the "Which side
 * are you on?" question and every You / Them mapping.
 * ───────────────────────────────────────────────────────── */

import type { Roles } from "./types";

const ROLE_WORDS = [
  "Tenant", "Landlord", "Lessee", "Lessor", "Resident", "Owner", "Subtenant", "Sublessee", "Sublessor",
  "Licensee", "Licensor", "Employee", "Employer", "Contractor", "Consultant", "Client", "Customer", "Provider",
  "Vendor", "Supplier", "Buyer", "Seller", "Purchaser", "Borrower", "Lender", "Company", "Subscriber", "User",
  "Member", "Guest", "Host", "Recipient", "Discloser", "Agency", "Franchisee", "Franchisor", "Developer",
];

/** consumer side first, so "Tenant" is offered before "Landlord" */
const CONSUMER_FIRST = [
  "Tenant", "Lessee", "Resident", "Subtenant", "Sublessee", "Employee", "Contractor", "Consultant", "Customer",
  "Client", "Buyer", "Purchaser", "Borrower", "Licensee", "Subscriber", "User", "Member", "Guest", "Recipient", "Franchisee",
];

const DEFINED = /\(\s*(?:the\s+|each,?\s+an?\s+|hereinafter(?:\s+referred\s+to\s+as)?\s+|as\s+)?["“]([A-Z][A-Za-z]+)["”]\s*\)/g;

function countWord(text: string, word: string): number {
  return (text.match(new RegExp(`\\b${word}(?:'s|’s)?\\b`, "g")) ?? []).length;
}

export function detectRoles(text: string): Roles {
  const defined = new Set<string>();
  for (const m of text.matchAll(DEFINED)) {
    const w = m[1];
    const role = ROLE_WORDS.find((r) => r.toLowerCase() === w.toLowerCase());
    if (role) defined.add(role);
  }
  const scored = ROLE_WORDS.map((r) => ({ role: r, count: countWord(text, r), defined: defined.has(r) }))
    .filter((r) => r.defined || r.count >= 3)
    .sort((a, b) => Number(b.defined) - Number(a.defined) || b.count - a.count);
  const top = scored.slice(0, 2).map((r) => r.role);
  const parties = [...top].sort((a, b) => {
    const ia = CONSUMER_FIRST.indexOf(a);
    const ib = CONSUMER_FIRST.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });

  const names: Record<string, string> = {};
  for (const role of parties) {
    const re = new RegExp(
      `([A-Z][\\w.&'’-]*(?:\\s+[A-Z][\\w.&'’-]*){0,5})(?:,\\s+an?\\s+[^,()]{3,80})?\\s*\\(\\s*(?:the\\s+)?["“]${role}["”]\\s*\\)`,
    );
    const m = text.match(re);
    if (m) names[role] = m[1].replace(/^(?:By|And|Between|With)\s+/i, "").trim();
  }

  let payer: string | null = null;
  let best = 0;
  for (const role of parties) {
    const n = (text.match(new RegExp(`\\b${role}\\s+(?:shall|must|will|agrees\\s+to)\\s+(?:also\\s+)?(?:pay|deposit|reimburse)`, "g")) ?? []).length;
    if (n > best) {
      best = n;
      payer = role;
    }
  }
  return { parties, names, payer: payer ?? parties[0] ?? null };
}

/** The party opposite `role`, or null. */
export function otherParty(roles: Roles, role: string | null): string | null {
  if (!role) return null;
  return roles.parties.find((p) => p !== role) ?? null;
}

/** The role acting in a sentence: "Landlord may enter…" → Landlord. "pays to Landlord" has no subject. */
export function subjectOf(text: string, roles: Roles): string | null {
  if (!roles.parties.length) return null;
  const re = new RegExp(
    `\\b(${roles.parties.join("|")})\\b(?:\\s+and\\s+(?:its|their)\\s+\\w+)?\\s+(?:shall|may|must|will|agrees?|is|are|has|have|acknowledges?|covenants?|warrants?|represents?|reserves?)\\b`,
  );
  return text.match(re)?.[1] ?? null;
}

/** First role named in a piece of text. */
export function firstRole(text: string, roles: Roles): string | null {
  let best: { role: string; at: number } | null = null;
  for (const role of roles.parties) {
    const m = new RegExp(`\\b${role}\\b`).exec(text);
    if (m && (!best || m.index < best.at)) best = { role, at: m.index };
  }
  return best?.role ?? null;
}
