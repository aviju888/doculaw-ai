/* ─────────────────────────────────────────────────────────
 * OBLIGATIONS — who owes what, how much, and when.
 *
 *   "Tenant shall pay ... $1,850.00 ... each calendar month"
 *     → Tenant · Pay monthly rent of $1,850 · monthly · by the 1st
 *
 * Patterns, in order:
 *   E  entry notice ("Landlord may enter… upon 24 hours' notice") → a duty to notify
 *   F  "either Party delivers written notice…" → both sides
 *   A  <Role> shall / must / will / agrees to / is responsible for <action>
 *   B  list items that continue a parent intro ("only if Tenant: (a) delivers…")
 *   C  passive money ("A processing fee of $3.95 shall apply…") → the usual payer
 *   D  passive duties ("Rent shall be paid…", "No animal… shall be kept…")
 * Amounts resolve defined terms: "two (2) months' Rent" = 2 × Rent.
 * ───────────────────────────────────────────────────────── */

import type { Cadence, Clause, Obligation, Roles } from "./types";
import { capitalize, collapseNumerals, formatMoney, parseMoney, splitSentences, truncateWords, wordsToNumber } from "./text";

const MONEY = /\$\s?\d[\d,]*(?:\.\d{2})?/;

/** "$1,850.00 ("Rent")" / "$2,775.00 ... (the "Security Deposit")" → { Rent: 1850, ... } */
export function definedAmounts(doc: string): Record<string, number> {
  const out: Record<string, number> = {};
  const re = /\$\s?(\d[\d,]*(?:\.\d{2})?)\)?[^"“()]{0,120}?\(\s*(?:the\s+)?["“]([A-Z][A-Za-z ]{1,30})["”]\s*\)/g;
  for (const m of doc.matchAll(re)) {
    const n = parseMoney(m[1]);
    if (n !== null && !(m[2] in out)) out[m[2]] = n;
  }
  return out;
}

export function cadenceOf(s: string): Cadence | null {
  if (/per\s+day|each\s+(?:subsequent\s+)?day\b|\bdaily\b/i.test(s)) return "daily";
  if (/per\s+month|\bmonthly\b|each\s+(?:calendar\s+)?month|every\s+month/i.test(s)) return "monthly";
  if (/per\s+(?:year|annum)|\bannually\b|each\s+year/i.test(s)) return "yearly";
  if (/for\s+each\s+(?:check|payment|occurrence|violation|instance)|each\s+payment\s+made|each\s+check/i.test(s)) return "per-event";
  if (/upon\s+(?:execution|signing|approval)|at\s+signing|move-?in|one-?time/i.test(s)) return "once";
  return null;
}

const CONDITIONAL =
  /\bif\b|\bin\s+the\s+event\b|\bshould\b|\bonly\s+if\b|\bupon\s+(?:default|breach|termination)\b|\breturned\b|\bremains?\s+in\s+possession\b|\bnegligence\b|\bmisuse\b|\bdamages?\s+caused\b|\bprevailing\b|\bcredit\s+or\s+debit\b/i;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const TRAILING_STOP = /\s+(?:the|a|an|of|and|or|to|from|by|for|in)$/i;

/** Deadline / timing in a few words, or null. */
export function whenOf(text: string): string | null {
  const s = collapseNumerals(text);
  let m = s.match(/on\s+or\s+before\s+the\s+(\d+(?:st|nd|rd|th))\s+day\s+of\s+each\s+(?:calendar\s+)?month/i);
  if (m) return `by the ${m[1]} of each month`;
  m = s.match(/within\s+(\d+)\s+(days|hours|business\s+days)(?:\s+after\s+((?:[^\s,.;]+\s+){0,3}[^\s,.;]+))?/i);
  if (m) {
    let after = m[3] ?? "";
    while (TRAILING_STOP.test(after)) after = after.replace(TRAILING_STOP, "");
    return `within ${m[1]} ${m[2].toLowerCase()}${after ? ` after ${after}` : ""}`;
  }
  m = s.match(/(?:not\s+less\s+than|at\s+least)\s+(\d+)\s+(days|hours)['’]?\s+(?:prior\s+(?:to\s+)?|before\s+)?(?:written\s+)?(notice|the\s+expiration|the\s+end)?/i);
  if (m) return m[3] && /notice/i.test(m[3]) ? `${m[1]} ${m[2].toLowerCase()}' notice` : `${m[1]} ${m[2].toLowerCase()} before the term ends`;
  if (/upon\s+execution\s+of\s+this|upon\s+signing|at\s+signing/i.test(s)) return "at signing";
  if (/upon\s+approval/i.test(s)) return "on approval";
  m = s.match(new RegExp(`(${MONTHS.join("|")})\\s+(\\d{1,2}),\\s+(\\d{4})`));
  if (m) return `${m[1].slice(0, 3)} ${m[2]}, ${m[3]}`;
  if (/as\s+needed/i.test(s)) return "as needed";
  if (/\bpromptly\b/i.test(s)) return "promptly";
  return null;
}

const GERUND_BASE: Record<string, string> = {
  arranging: "arrange", paying: "pay", keeping: "keep", maintaining: "maintain", repairing: "repair", providing: "provide",
  removing: "remove", cleaning: "clean", replacing: "replace", obtaining: "obtain", returning: "return", using: "use",
  storing: "store", insuring: "insure", notifying: "notify", giving: "give", making: "make", securing: "secure",
};

/** "arranging and paying for X" → "arrange and pay for X" */
function gerundsToImperative(s: string): string {
  return s.replace(/\b([a-z]+ing)\b/g, (w) => GERUND_BASE[w] ?? w);
}

const PASSIVE_VERBS: Record<string, string> = {
  stored: "Store", kept: "Keep", parked: "Park", placed: "Place", paid: "Pay", delivered: "Deliver",
  returned: "Return", maintained: "Maintain", used: "Use",
};

function cleanAction(raw: string): string {
  let a = collapseNumerals(raw)
    .replace(/\s+/g, " ")
    .replace(/\s*\((?:the\s+)?["“][^"”]+["”]\)/g, "")
    .replace(/^(?:to|also)\s+/i, "")
    .replace(/\b(pay|deposit|deliver)\s+to\s+(?:the\s+)?[A-Z]\w+\s+(?=\S)/, (_m, v: string) => `${v} `)
    .replace(/\s+with\s+[A-Z]\w+\s+(?=the\s+sum)/, " ")
    .replace(/,?\s*at\s+\w+['’]s\s+(?:own\s+|sole\s+)?(?:cost\s+and\s+)?expense,?/i, "")
    .replace(/\bin\s+the\s+amount\s+of\b/i, "of")
    .replace(/\bthe\s+sum\s+of\s+/i, "")
    .replace(/\$(\d[\d,]*)\.00\b/g, "$$$1");
  // cut subordinate tails: ", payable ...", ", without ..." (unless it is about consent)
  const cut = a.search(
    /,\s*(?:payable|without(?![^.]{0,40}consent)|together|which|in\s+addition|except|unless|provided|less\s+any)\b|\s+as\s+security\s+for\b|\s+for\s+the\s+faithful\b|\s+upon\s+execution\b/i,
  );
  if (cut > 12) a = a.slice(0, cut);
  a = a.replace(/,\s+(without\b)/i, " $1");
  a = a.replace(/[\s,;:]+(?:and|or)?\s*$/i, "").replace(/[.;,:]+$/, "");
  return truncateWords(capitalize(a), 120);
}

function amountOf(text: string, defs: Record<string, number>): { amount: number | null; amountText: string | null } {
  const s = collapseNumerals(text);
  // coverage limits are not payments
  if (/insurance|coverage/i.test(s)) return { amount: null, amountText: null };
  const months = s.match(/(\d+|[a-z]+)\s+months?['’]?\s+Rent\b/i);
  if (months && defs.Rent) {
    const n = /^\d+$/.test(months[1]) ? Number(months[1]) : wordsToNumber(months[1]);
    if (n) return { amount: n * defs.Rent, amountText: `${n} months' rent` };
  }
  const m = s.match(MONEY);
  if (m) {
    const n = parseMoney(m[0]);
    if (n !== null) return { amount: n, amountText: formatMoney(n) };
  }
  for (const [term, n] of Object.entries(defs)) {
    if (term !== "Rent" && new RegExp(`\\bthe\\s+${term}\\b`).test(s) && /\b(?:return|refund|pay|deposit)\b/i.test(s)) {
      return { amount: n, amountText: term.toLowerCase() };
    }
  }
  return { amount: null, amountText: null };
}

/** Splits "keep X, promptly notify Y, and replace Z" into separate duties. */
function splitPredicate(pred: string): string[] {
  const byModal = pred.split(/,?\s+and\s+(?:shall|must|will)\s+(?:also\s+)?/i);
  const out: string[] = [];
  for (const part of byModal) {
    const pieces = part.split(
      /,\s+(?:and\s+)?(?=(?:promptly\s+|immediately\s+)?(?:pay|keep|notify|replace|maintain|return|provide|deliver|comply|repair|remove|obtain|give|name|commence|vacate|store|use)\b)/i,
    );
    for (const piece of pieces.map((p) => p.trim()).filter(Boolean)) {
      // "pay a $500 deposit and monthly pet rent of $45" → two payments
      const two = piece.match(/^(\w+)\s+(.*?\$[\d,.]+.*?)\s+and\s+((?:[a-z-]+\s+){0,3}(?:fee|rent|deposit|charge)\b.*?\$[\d,.]+.*)$/i);
      if (two) out.push(`${two[1]} ${two[2]}`, `${two[1]} ${two[3]}`);
      else out.push(piece);
    }
  }
  return out;
}

type Found = Omit<Obligation, "id" | "clauseId">;

function roleRe(roles: Roles): string {
  return roles.parties.length ? roles.parties.join("|") : "Tenant|Landlord";
}

function parseSentence(
  s: { text: string; start: number; end: number },
  ctx: { roles: Roles; defs: Record<string, number>; inheritedSubject: string | null; inheritedConditional: boolean; inheritedWhen: string | null },
): Found[] {
  const { roles, defs } = ctx;
  const text = s.text;
  const out: Found[] = [];
  const conditional = ctx.inheritedConditional || CONDITIONAL.test(text);
  const R = roleRe(roles);
  const payer = roles.payer ?? roles.parties[0] ?? "Tenant";

  const push = (party: string, kind: "must" | "must-not", rawAction: string, prefix = "") => {
    const cleaned = cleanAction(rawAction);
    const action = kind === "must-not" ? `Don't ${cleaned.replace(/^\w/, (c) => c.toLowerCase())}` : cleaned;
    if (action.length < 4) return;
    const { amount, amountText } = amountOf(rawAction, defs);
    const amounts = (text.match(/\$\s?\d[\d,]*(?:\.\d{2})?/g) ?? []).length;
    let cadence = amount !== null ? (cadenceOf(rawAction) ?? (amounts <= 1 ? cadenceOf(text) : null) ?? "once") : null;
    if (conditional && cadence === "once") cadence = "per-event";
    out.push({
      party,
      kind,
      action,
      amount,
      amountText,
      cadence,
      conditional,
      when: whenOf(rawAction) ?? (prefix ? whenOf(prefix) : null) ?? ctx.inheritedWhen,
      start: s.start,
      end: s.end,
    });
  };

  // E: entry notice
  const entry = text.match(new RegExp(`\\b(${R})\\b[^.]*?\\bmay\\s+enter\\b[^.]*?\\bupon\\s+(?:not\\s+less\\s+than\\s+)?([^.,;]*?notice)`, "i"));
  if (entry) {
    push(entry[1], "must", `give ${entry[2].replace(/\s+to\s+\w+$/, "")} before entering`);
    return out;
  }

  // F: either party
  const either = text.match(
    /\beither\s+party\s+(?:shall\s+|may\s+)?(deliver|give|provide|send)s?\s+(.+?)(?:\s+(?:not\s+less\s+than|at\s+least)\s+(.+?)\s+(?:prior\s+to|before)\s+(?:the\s+)?(?:expiration|end)[^,.;]*)?(?:[,.;]|$)/i,
  );
  if (either) {
    const what = either[2].replace(/\s+to\s+the\s+other\s+party$/i, "");
    out.push({
      party: "Both",
      kind: "must",
      action: cleanAction(`${either[1]} ${what}${/non-?renewal/i.test(what) ? " to stop the automatic renewal" : ""}`),
      amount: null,
      amountText: null,
      cadence: null,
      conditional: false,
      when: either[3] ? `${collapseNumerals(either[3]).replace(/\s+/g, " ")} before the term ends` : null,
      start: s.start,
      end: s.end,
    });
    return out;
  }

  // A: explicit subject + modal
  const modal = new RegExp(
    `\\b(?:the\\s+)?(${R})\\b(?:\\s+and\\s+(?:its|their)\\s+\\w+)?\\s+(shall\\s+not|must\\s+not|may\\s+not|will\\s+not|agrees?\\s+not\\s+to|shall\\s+(?:also\\s+)?be\\s+(?:responsible|liable)\\s+for|is\\s+(?:responsible|liable)\\s+for|shall(?:\\s+also)?|must|will|agrees?\\s+to|is\\s+required\\s+to|covenants?\\s+to)\\s+(.+)$`,
    "i",
  );
  const am = text.match(modal);
  if (am && am.index !== undefined) {
    const party = roles.parties.find((p) => p.toLowerCase() === am[1].toLowerCase()) ?? am[1];
    const neg = /not/i.test(am[2]);
    // "Landlord shall not be liable…" limits liability; it is a risk, not a duty
    if (neg && /^be\s+(?:liable|responsible)/i.test(am[3])) return out;
    const responsible = /responsible|liable/i.test(am[2]);
    const prefix = text.slice(0, am.index);
    for (const piece of splitPredicate(am[3])) {
      let action = piece.replace(/^be\s+(?:responsible|liable)\s+for\s+/i, "cover ");
      if (responsible) action = /^[a-z]+ing\b/i.test(piece) ? gerundsToImperative(piece) : `cover ${piece}`;
      push(party, neg ? "must-not" : "must", action, prefix);
    }
    return out;
  }

  // B: list item continuing "only if Tenant:" / "Tenant shall:"
  if (ctx.inheritedSubject) {
    const fixed = text.replace(/^(delivers|pays|gives|provides|keeps|returns|maintains|notifies)\b/i, (v) => (v.toLowerCase() === "notifies" ? "notify" : v.replace(/s$/, "")));
    if (/^(?:promptly\s+|immediately\s+)?(?:pay|keep|notify|replace|maintain|return|provide|deliver|deposit|comply|repair|remove|obtain|give|allow|permit|use|clean)\b/i.test(fixed)) {
      push(ctx.inheritedSubject, "must", fixed);
      return out;
    }
  }

  // C: passive money
  if (MONEY.test(text) && /\b(?:fee|charge|rent|deposit|penalt\w+)\b/i.test(text) && /shall\s+(?:apply|accrue|be\s+(?:due|payable|charged|assessed))/i.test(text)) {
    const label = text.match(/\b((?:an?\s+)?(?:additional\s+)?(?:[a-z-]+\s+){0,2}(?:fee|charge|rent|deposit))\b/i)?.[1] ?? "fee";
    const amt = collapseNumerals(text).match(MONEY)?.[0] ?? "";
    const per = cadenceOf(text) === "daily" ? " per day" : "";
    push(payer, "must", `pay ${label.replace(/^an?\s+/i, "")} of ${amt}${per}`);
    return out;
  }

  // D: passive duties
  const noThing = text.match(/^No\s+(.+?)\s+shall\s+be\s+(kept|placed|stored|parked|installed|used|brought)\b(.*)$/i);
  if (noThing) {
    const listed = noThing[1].replace(/\s+of\s+any\s+kind$/i, "");
    const thing = listed.match(/,?\s+or\s+other\s+(\w+)$/i) ? `${listed.match(/or\s+other\s+(\w+)$/i)?.[1]}s` : `any ${listed}`;
    const rest = noThing[3].replace(/,\s*which.*$/i, "").replace(/,\s*even\s+temporarily/i, "");
    push(payer, "must-not", `${PASSIVE_VERBS[noThing[2].toLowerCase()]?.toLowerCase() ?? noThing[2]} ${thing}${rest}`);
    return out;
  }
  const prohibited = text.match(/^([A-Z][^.]{2,80}?)\s+(?:are|is)\s+prohibited\b\s*(.*)$/);
  if (prohibited) {
    push(payer, "must-not", `use ${prohibited[1].replace(/^\w/, (c) => c.toLowerCase())} ${prohibited[2]}`);
    return out;
  }
  const passive = text.match(/^(?:All\s+|The\s+)?([A-Z][\w\s'’-]{1,40}?)\s+shall\s+be\s+(stored|kept|parked|placed|paid|delivered|returned|maintained|used)\s+(.+)$/);
  if (passive && !new RegExp(`^(?:${R})$`, "i").test(passive[1].trim())) {
    const verb = PASSIVE_VERBS[passive[2].toLowerCase()];
    const subj = passive[1].trim();
    const obj = /^(?:Premises|Property|Unit|Apartment)$/.test(subj) ? `the ${subj}` : /^[A-Z][a-z]+$/.test(subj) && subj !== "Rent" ? subj.toLowerCase() : subj;
    const tail = passive[3].replace(/,\s*and\s+any\b.*$/i, "");
    push(payer, "must", `${verb} ${obj} ${tail}`);
    return out;
  }
  return out;
}

export function extractObligations(doc: string, flat: Clause[], roles: Roles): Obligation[] {
  const defs = definedAmounts(doc);
  const byId = new Map(flat.map((c) => [c.id, c]));
  const out: Obligation[] = [];
  const seen = new Set<string>();

  for (const clause of flat) {
    if (!clause.text.trim() || clause.style === "sig") continue;
    const parent = clause.parentId ? byId.get(clause.parentId) : undefined;
    const intro = parent?.text.trim() ?? "";
    const introIsList = /:\s*$/.test(intro);
    const R = roleRe(roles);
    const inheritedSubject = introIsList
      ? (intro.match(new RegExp(`\\b(${R})\\s*:\\s*$`))?.[1] ?? intro.match(new RegExp(`\\b(${R})\\s+shall\\s*:\\s*$`))?.[1] ?? null)
      : null;
    const inheritedConditional = introIsList && /^if\b|in\s+the\s+event|only\s+if/i.test(intro);
    const lateAfter = introIsList ? collapseNumerals(intro).match(/on\s+the\s+(\d+(?:st|nd|rd|th))\s+day/i) : null;
    const inheritedWhen = lateAfter ? `if late after the ${lateAfter[1]}` : null;

    let n = 0;
    for (const s of splitSentences(clause.text, clause.textStart)) {
      if (/:\s*$/.test(s.text)) continue;
      for (const f of parseSentence(s, { roles, defs, inheritedSubject, inheritedConditional, inheritedWhen })) {
        const key = `${f.party}|${f.action.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ ...f, id: `ob-${clause.id}-${++n}`, clauseId: clause.id });
      }
    }
  }
  return out;
}

export type Side = "you" | "them" | "both";

/** Maps an obligation's party to the reader: "you", "them" or "both". */
export function sideOf(party: string, perspective: string, roles: Roles): Side {
  if (party === "Both") return "both";
  if (perspective === "neutral") return party === (roles.parties[0] ?? party) ? "you" : "them";
  return party === perspective ? "you" : "them";
}

export type Totals = { upfront: number; atSigning: number; monthly: number; yearly: number; conditionalCount: number; conditionalMax: number; daily: number };

export function totalsFor(items: Obligation[]): Totals {
  const t: Totals = { upfront: 0, atSigning: 0, monthly: 0, yearly: 0, conditionalCount: 0, conditionalMax: 0, daily: 0 };
  for (const o of items) {
    if (o.amount === null) continue;
    if (o.conditional) {
      t.conditionalCount++;
      if (o.cadence === "daily") t.daily = Math.max(t.daily, o.amount);
      else t.conditionalMax = Math.max(t.conditionalMax, o.amount);
      continue;
    }
    if (o.cadence === "monthly") t.monthly += o.amount;
    else if (o.cadence === "yearly") t.yearly += o.amount;
    else if (o.cadence === "once") {
      t.upfront += o.amount;
      if (o.when === "at signing") t.atSigning += o.amount;
    }
  }
  return t;
}
