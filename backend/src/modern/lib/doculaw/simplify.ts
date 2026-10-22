/* ─────────────────────────────────────────────────────────
 * SIMPLIFY — one clause, three reading levels.
 *
 *   live    Groq rewrites batches of clauses (prompt below)
 *   sample  hand-written rewrites from samples/rewrites.ts
 *   upload  a deterministic rule-based rewrite, marked as such:
 *           numerals collapsed, legalese glossary, "shall" →
 *           "must", roles as "the tenant", inline (i)/(ii)
 *           lists turned into bullets
 * ───────────────────────────────────────────────────────── */

import type { Level, Roles } from "./types";
import { SAMPLE_FIXTURES } from "./samples/rewrites";
import { LEVEL_INFO } from "./levels";
import { capitalize, collapseNumerals, splitSentences } from "./text";

export { LEVEL_INFO } from "./levels";

export function fixtureRewrite(sampleId: string | null, citation: string, level: Level): string | null {
  if (!sampleId) return null;
  return SAMPLE_FIXTURES[sampleId]?.[citation]?.[level] ?? null;
}

type Rule = [RegExp, string | ((...args: string[]) => string)];

const LAWYER: Rule[] = [
  [/\bany and all\b/gi, "all"],
  [/\beach and every\b/gi, "every"],
  [/\bnull and void\b/gi, "void"],
  [/\bdue and payable\b/gi, "due"],
  [/\bterms and conditions\b/gi, "terms"],
  [/\bfull force and effect\b/gi, "effect"],
  [/\bby and between\b/gi, "between"],
  [/\bunless and until\b/gi, "until"],
  [/\bif and when\b/gi, "when"],
  [/\bcovenants? and agrees?\b/gi, "agrees"],
  [/\backnowledges? and agrees?\b/gi, "agrees"],
  [/\bsole and exclusive\b/gi, "exclusive"],
  [/\bfinal and binding\b/gi, "final, binding"],
  [/\bhereby\s+/gi, ""],
  [/\b(?:the\s+parties\s+)?hereto\b/gi, "the parties"],
  [/\bhereunder\b/gi, "under this {doc}"],
  [/\bherein\b/gi, "in this {doc}"],
  [/\bhereof\b/gi, "of this {doc}"],
  [/\bthereof\b/gi, "of it"],
  [/\btherein\b/gi, "in it"],
  [/\bthereto\b/gi, "to it"],
  [/\bwhereas,?\s*/gi, ""],
  [/\bwitnesseth:?\s*/gi, ""],
  [/\bsaid\s+(?=[A-Z])/g, "the "],
  [/\s{2,}/g, " "],
];

const PLAIN: Rule[] = [
  [/\s*\((?:the\s+|this\s+|each,?\s+an?\s+|hereinafter(?:\s+referred\s+to\s+as)?\s+)?["“][^"”]+["”]\)/g, ""],
  [/\bshall\s+not\b/gi, "{not}"],
  [/\bshall\s+have\s+the\s+right\s+to\b/gi, "can"],
  [/\bshall\s+be\s+entitled\s+to\b/gi, "can"],
  [/\bshall\s+be\s+(?:responsible|liable)\s+for\b/gi, "is responsible for"],
  [/\bshall\s+be\s+governed\s+by\b/gi, "is governed by"],
  [/\bshall\s+be\s+deemed\b/gi, "counts as"],
  [/\bshall\s+be\s+void\b/gi, "is invalid"],
  [/\bshall\s+be\s+binding\s+(?:on|upon)\b/gi, "binds"],
  [/\bshall\s+constitute\b/gi, "counts as"],
  [/\bshall\s+accrue\b/gi, "is added"],
  [/\bshall\b/gi, "{shall}"],
  [/\bupon\s+(?:the\s+)?expiration\s+of\b/gi, "at the end of"],
  [/\bprior\s+to\b/gi, "before"],
  [/\bsubsequent\s+to\b/gi, "after"],
  [/\bin\s+the\s+event\s+that\b/gi, "if"],
  [/\bin\s+the\s+event\s+of\b/gi, "in case of"],
  [/\bpursuant\s+to\b/gi, "under"],
  [/\bnotwithstanding\b/gi, "despite"],
  [/\bin\s+accordance\s+with\b/gi, "following"],
  [/\bwith\s+respect\s+to\b/gi, "about"],
  [/\bin\s+lieu\s+of\b/gi, "instead of"],
  [/\bprovided,?\s+however,?\s+that\b/gi, "but"],
  [/\bprovided\s+that\b/gi, "as long as"],
  [/\bforthwith\b/gi, "right away"],
  [/\bnot\s+less\s+than\b/gi, "at least"],
  [/\bnot\s+to\s+exceed\b/gi, "up to"],
  [/\bin\s+excess\s+of\b/gi, "more than"],
  [/\bon\s+or\s+before\b/gi, "by"],
  [/\bcalendar\s+month\b/gi, "month"],
  [/\bpay\s+to\s+(the\s+\w+|[A-Z]\w+)\s+/gi, "pay $1 "],
  [/\bin\s+the\s+amount\s+of\b/gi, "of"],
  [/\bdeposit\s+with\s+(the\s+\w+|[A-Z]\w+)\s+the\s+sum\s+of\b/gi, "pay $1"],
  [/\bthe\s+sum\s+of\s+/gi, ""],
  [/\bas\s+security\s+for\s+the\s+faithful\s+performance\s+of\b/gi, "to guarantee"],
  [/\bfrom\s+and\s+against\b/gi, "from"],
  [/\barising\s+out\s+of\s+or\s+relat(?:ed|ing)\s+to\b/gi, "tied to"],
  [/\bexcept\s+to\s+the\s+extent\b/gi, "except where"],
  [/\bwillful\s+misconduct\b/gi, "deliberate wrongdoing"],
  [/\bdispute,\s+claim,\s+or\s+controversy\b/gi, "disagreement"],
  [/\bresolved\s+exclusively\s+by\b/gi, "settled only by"],
  [/,?\s+and\s+not\s+by\s+a\s+court(?:\s+of\s+law)?/gi, ", with no court case"],
  [/\bthen-current\s+/gi, "current "],
  [/\bInitial\s+Term\b/g, "first term"],
  [/\bRenewal\s+Terms?\b/g, "renewal term"],
  [/\bcommence(s|d)?\b/gi, "start$1"],
  [/\bterminate\b/gi, "end"],
  [/\btermination\b/gi, "ending"],
  [/\bexpiration\b/gi, "end"],
  [/\bremit\b/gi, "pay"],
  [/\butilize\b/gi, "use"],
  [/\bsufficient\b/gi, "enough"],
  [/\bexecution\s+of\s+this\b/gi, "signing this"],
  [/\bexecute(?=s?\s+this)/gi, "sign"],
  [/\bindemnify,?\s+defend,?\s+and\s+hold\s+harmless\b/gi, "cover the losses and legal costs of"],
  [/\bindemnify\s+and\s+hold\s+harmless\b/gi, "cover the losses and legal costs of"],
  [/\bhold\s+harmless\b/gi, "protect from claims"],
  [/\bliquidated\s+damages\b/gi, "a set penalty"],
  [/\bjointly\s+and\s+severally\b/gi, "each fully"],
  [/\bin\s+(?:its|their|his|her)\s+sole\s+discretion\b/gi, "for any reason"],
  [/\bat\s+(?:its|their)\s+sole\s+discretion\b/gi, "whenever they choose"],
  [/\binstallment\b/gi, "payment"],
  [/\bvacates?\s+the\b/gi, "moves out of the"],
  [/\bmaterial\s+default\b/gi, "serious breach"],
  [/\bordinary\s+wear\s+and\s+tear\b/gi, "normal wear and tear"],
  [/\bpersonal\s+property\b/gi, "belongings"],
  [/\bbodily\s+injury\b/gi, "injury"],
  [/\bsuch\s+(?=[A-Z]\w+)/g, "the "],
  [/\bthe\s+Premises\b/g, "the property"],
  [/\bPremises\b/g, "property"],
  [/\bLessor\b/g, "Landlord"],
  [/\bLessee\b/g, "Tenant"],
  [/\b(?:either|each)\s+Party\b/g, "either side"],
  [/\bthe\s+other\s+Party\b/g, "the other side"],
  [/\b(?:both|the)\s+Parties\b/g, "both sides"],
  [/\bthe\s+prevailing\s+Party\b/g, "the winning side"],
  [/\b([Tt]his)\s+(Lease|Agreement|Contract)\b/g, (_m: string, t: string, w: string) => `${t} ${w.toLowerCase()}`] as unknown as Rule,
  [/\bthe\s+(Rent|Security\s+Deposit|Deposit)\b/g, (_m: string, w: string) => `the ${w.toLowerCase()}`] as unknown as Rule,
  [/\bupon\b/gi, "on"],
  [/\bmay\b/g, "can"],
  [/,?\s*without\s+demand,?\s+deduction,?\s+or\s+offset/gi, ", in full"],
];

const ELI5: Rule[] = [
  [/\bmust\s+not\b/gi, "can't"],
  [/\bmust\b/gi, "has to"],
  [/\b(?:final,?\s+)?binding\s+arbitration\b/gi, "a private referee"],
  [/\barbitrator\b/gi, "referee"],
  [/\bwithout\s+(the\s+\w+)['’]s\s+prior\s+written\s+consent\b/gi, "without a written OK from $1"],
  [/\b(the\s+\w+)['’]s\s+prior\s+written\s+consent\b/gi, "a written OK from $1"],
  [/\bprior\s+written\s+consent\b/gi, "a written OK first"],
  [/\bremains?\s+unpaid\b/gi, "is still not paid"],
  [/\bsubsequent\b/gi, "next"],
  [/\badditional\b/gi, "extra"],
  [/\bgross\s+negligence\b/gi, "serious carelessness"],
  [/\bnegligence\b/gi, "carelessness"],
  [/\bterminate\b/gi, "end"],
  [/\bwritten\s+consent\b/gi, "a written OK"],
  [/\bconsent\b/gi, "OK"],
  [/\bwritten\s+notice\b/gi, "a written note"],
  [/\barbitration\b/gi, "a private referee"],
  [/\bobligations?\b/gi, "jobs"],
  [/\bserious\s+breach\b/gi, "big rule-break"],
  [/\bincluding\s+but\s+not\s+limited\s+to\b/gi, "like"],
  [/\breasonable\s+/gi, ""],
  [/\bapproximately\b/gi, "about"],
  [/\bimmediately\b/gi, "right away"],
  [/\bprospective\b/gi, "possible"],
  [/\bliable\b/gi, "on the hook"],
  [/\bdeductions?\b/gi, "money taken out"],
  [/\bresidence\b/gi, "home"],
  [/\bpurchasers?\b/gi, "buyers"],
  [/\bcommon\s+areas?\b/gi, "shared spaces"],
];

function apply(text: string, rules: Rule[], docNoun: string): string {
  let out = text;
  for (const [re, to] of rules) {
    out = typeof to === "function" ? out.replace(re, to as (...a: string[]) => string) : out.replace(re, to.replace("{doc}", docNoun));
  }
  return out;
}

/** "Tenant shall" → "Tenant must"; any other "shall" describes what happens → "will". */
function modals(text: string, roles: Roles): string {
  const R = (roles.parties.length ? roles.parties : ["Tenant", "Landlord"]).join("|");
  return text
    .replace(new RegExp(`\\b((?:the\\s+)?(?:${R})(?:['’]s\\s+\\w+)?)\\s+\\{shall\\}`, "g"), "$1 must")
    .replace(new RegExp(`\\b((?:the\\s+)?(?:${R}))\\s+\\{not\\}`, "g"), "$1 must not")
    .replace(/\{shall\}/g, "will")
    .replace(/\{not\}/g, "will not");
}

/** Re-capitalizes sentence starts after role nouns put "the" first. */
function capitalizeStarts(text: string): string {
  return text.replace(/(^|(?<![ap]\.m)[.!?]["”’)]?\s+)(the|a|an|if|on|at)\b/g, (_m, pre: string, w: string) => `${pre}${w[0].toUpperCase()}${w.slice(1)}`);
}

/** "Tenant" → "the tenant", "Tenant's" → "the tenant's" (not after "the"/"a"). */
function roleNouns(text: string, roles: Roles, word?: Record<string, string>): string {
  let out = text;
  for (const role of roles.parties.length ? roles.parties : ["Tenant", "Landlord"]) {
    const noun = word?.[role] ?? role.toLowerCase();
    out = out.replace(new RegExp(`(?<!\\b(?:the|a|an|The|A|An)\\s)\\b${role}(['’]s)?\\b`, "g"), (_m, poss: string | undefined) => `the ${noun}${poss ?? ""}`);
    out = out.replace(new RegExp(`\\b(the|a|an)\\s+${role}\\b`, "gi"), (_m, art: string) => `${art} ${noun}`);
  }
  return out;
}

/** "(i) x; (ii) y; and (iii) z" inside one sentence → intro + bullets */
function bulletInlineLists(sentence: string): string {
  const markers = [...sentence.matchAll(/(?:^|\s)\((?:[ivx]{1,4}|[a-h]|\d{1,2})\)\s/g)];
  if (markers.length < 2) return sentence;
  const first = markers[0].index ?? 0;
  const intro = sentence.slice(0, first).trim().replace(/[:,]?$/, ":");
  const items = sentence
    .slice(first)
    .split(/\s?\((?:[ivx]{1,4}|[a-h]|\d{1,2})\)\s/)
    .map((s) => s.trim().replace(/[;,]?\s*(?:and|or)?\s*$/i, "").replace(/[.;]$/, ""))
    .filter(Boolean);
  return `${intro}\n${items.map((i) => `- ${i}`).join("\n")}`;
}

function tidy(text: string): string {
  return text
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/\b(the|a|an)\s+\1\b/gi, "$1")
    .replace(/\s{2,}/g, " ")
    .replace(/,\s*,/g, ",")
    .trim();
}

/** Splits very long sentences at "; " and ", and " seams. */
function shortenSentences(text: string, maxWords: number): string[] {
  const out: string[] = [];
  for (const s of splitSentences(text)) {
    const words = s.text.split(/\s+/).length;
    if (words <= maxWords) {
      out.push(s.text);
      continue;
    }
    const parts = s.text.split(/;\s+(?!and\b|or\b)|,\s+but\s+/);
    out.push(...parts.map((p) => capitalize(p.trim().replace(/[,;]$/, "")).replace(/([^.!?:])$/, "$1.")));
  }
  return out;
}

/**
 * Deterministic rewrite for uploaded documents. The UI labels this as
 * a rule-based demo; with a GROQ key the model does it instead.
 */
export function ruleSimplify(text: string, level: Level, roles: Roles, docNoun = "agreement"): string {
  if (!text.trim()) return "";
  let t = collapseNumerals(text.replace(/\s+/g, " ").trim());
  t = apply(t, LAWYER, docNoun).replace(/\$(\d[\d,]*)\.00\b/g, level === "lawyer" ? "$$$1.00" : "$$$1");
  if (level === "lawyer") return tidy(t);

  t = modals(apply(t, PLAIN, docNoun), roles);
  const eli5Names: Record<string, string> | undefined =
    level === "eli5" ? Object.fromEntries((roles.parties.length ? roles.parties : ["Tenant"]).map((r) => [r, r === "Tenant" || r === "Lessee" ? "renter" : r.toLowerCase()])) : undefined;
  t = roleNouns(t, roles, eli5Names);
  if (level === "eli5") {
    t = apply(t, ELI5, docNoun)
      .replace(/\s*\((?![^)]*\$)[^()]{1,60}\)/g, "")
      .replace(/,\s+including\s+[^,.;]+(?:,\s+[^,.;]+)*?(?=[,.;])/gi, "");
  }
  const sentences = shortenSentences(capitalizeStarts(tidy(t)), level === "eli5" ? 18 : 30).map((s) => capitalize(bulletInlineLists(s)));
  return sentences.join(" ").replace(/ - /g, "\n- ").trim();
}

/* ── live prompt (Groq) ──────────────────────────────────── */

const LEVEL_PROMPT: Record<Level, string> = {
  lawyer:
    "Light cleanup only. Keep the legal meaning, defined terms and every condition. Remove doublets (any and all, null and void) and archaic words (herein, thereof, hereby). Use modern drafting: 'must' for duties, 'may' for permissions. Keep it formal.",
  plain:
    "Plain English at about an 8th-grade reading level. Short sentences, everyday words, active voice. Say who does what ('The tenant pays...'). Keep every number, date, amount and deadline exactly. No legal jargon unless you explain it in the same sentence.",
  eli5:
    "Explain it like the reader is five. One idea per sentence, the simplest words, at most three sentences. Keep the important numbers. Use 'the renter' and 'the landlord' (or the plain names of the parties).",
};

export function simplifySystemPrompt(level: Level): string {
  return [
    "You rewrite clauses from a legal document so a non-lawyer can understand them.",
    "Never add facts, opinions or advice that are not in the clause. Never drop an obligation, amount, deadline or condition.",
    "Do not use em dashes. Do not start with 'This clause'.",
    `Level: ${LEVEL_INFO[level].label}. ${LEVEL_PROMPT[level]}`,
    'Reply with JSON only: {"rewrites":[{"id":"<clause id>","text":"<rewrite>"}]}',
  ].join("\n");
}

export function simplifyUserPrompt(clauses: { id: string; citation: string; title: string; text: string }[]): string {
  return clauses.map((c) => `id: ${c.id}\nclause: ${c.citation}${c.title ? ` (${c.title})` : ""}\ntext: ${c.text}`).join("\n\n");
}

/* ── demo path ─────────────────────────────────────────── */

/** Fixture for the sample lease, otherwise the rule-based rewrite. */
export function demoRewrite(
  sampleId: string | null,
  clause: { citation: string; text: string },
  level: Level,
  roles: Roles,
  docNoun: string,
): { text: string; source: "fixture" | "rules" } {
  const fixture = fixtureRewrite(sampleId, clause.citation, level);
  if (fixture) return { text: fixture, source: "fixture" };
  return { text: clause.text.trim() ? ruleSimplify(clause.text, level, roles, docNoun) : "", source: "rules" };
}
