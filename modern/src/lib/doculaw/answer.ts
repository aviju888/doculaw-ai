/* ─────────────────────────────────────────────────────────
 * ANSWERS — retrieval for the chat, plus the demo-mode answers
 * (grounded templates built from the retrieved clauses' plain
 * rewrites) and the live prompts that replace them with a key.
 * ───────────────────────────────────────────────────────── */

import type { Level, Roles, Severity } from "./types";
import { BM25, rankSentences } from "./bm25";
import { risksInPassage } from "./risk";
import { ruleSimplify } from "./simplify";
import { splitSentences, tokenize } from "./text";

export type ChatClause = {
  id: string;
  citation: string;
  title: string;
  text: string;
  /** plain-English rewrite if one exists */
  plain?: string;
  /** parent title, so "§13(b)" also matches "Entry by landlord" */
  parentTitle?: string;
  parentId?: string | null;
  childIds?: string[];
};

export type Chunk = { clauseId: string; number: string; title: string; text: string; score: number };

export const NOT_ADVICE = "Not legal advice.";

export function retrieve(question: string, clauses: ChatClause[], k = 4): Chunk[] {
  const usable = clauses.filter((c) => c.text.trim());
  const index = new BM25(
    usable.map((c) => ({
      id: c.id,
      fields: [
        { text: c.title, weight: 2 },
        { text: c.parentTitle ?? "", weight: 1 },
        { text: c.text, weight: 1 },
        { text: c.plain ?? "", weight: 0.8 },
      ],
    })),
  );
  const hits = index.search(question, k);
  const top = hits[0]?.score ?? 0;
  const byId = new Map(usable.map((c) => [c.id, c]));
  return hits.map((h) => {
    const c = byId.get(h.id) as ChatClause;
    return { clauseId: c.id, number: c.citation, title: c.title || c.parentTitle || "", text: c.text, score: top ? Math.round((h.score / top) * 100) / 100 : 0 };
  });
}

function sentencesOf(text: string): string[] {
  return splitSentences(text)
    .map((s) => s.text.replace(/\s+/g, " ").trim())
    .filter((s) => s.length > 2);
}

function ensureStop(s: string): string {
  return /[.!?:]$/.test(s) ? s : `${s}.`;
}

/** Grounded demo answer: the best sentences of the best clauses, each cited. */
export function demoChatAnswer(question: string, chunks: Chunk[], byId: Map<string, ChatClause>, roles: Roles): string {
  const qTerms = tokenize(question);
  if (!chunks.length || !qTerms.length) {
    return "I couldn't find a clause about that. Try the words a contract would use, like notice, deposit, fee or terminate.";
  }
  const textOf = (c: ChatClause) => c.plain?.trim() || ruleSimplify(c.text, "plain", roles);
  const isIntro = (c: ChatClause | undefined) => Boolean(c && /:\s*$/.test(textOf(c)));

  /** the sentences worth quoting from one clause, in document order */
  const quote = (c: ChatClause): string => {
    const sents = sentencesOf(textOf(c));
    if (sents.length <= 3) return sents.map(ensureStop).join(" ");
    const top = rankSentences(question, sents)
      .slice(0, 2)
      .map((r) => r.index)
      .sort((a, b) => a - b);
    return top.map((i) => ensureStop(sents[i])).join(" ");
  };

  const kept = chunks
    .filter((c, i) => i === 0 || c.score >= 0.5)
    .slice(0, 3)
    .map((c) => byId.get(c.clauseId))
    .filter((c): c is ChatClause => Boolean(c));
  const keptIds = new Set(kept.map((c) => c.id));
  const done = new Set<string>();
  const paras: string[] = [];

  for (const c of kept) {
    if (done.has(c.id)) continue;
    // a list intro ("these late fees apply:") reads as one paragraph with its items
    const intro = isIntro(c) ? c : c.parentId && isIntro(byId.get(c.parentId)) ? (byId.get(c.parentId) as ChatClause) : null;
    if (intro) {
      const items = (intro.childIds ?? [])
        .map((id) => byId.get(id))
        .filter((x): x is ChatClause => Boolean(x))
        .filter((x) => intro === c || keptIds.has(x.id) || (intro.childIds?.length ?? 0) <= 3);
      const body = items.map((x) => `${quote(x)} [${x.citation}]`).join(" ");
      paras.push(`${textOf(intro)} ${body}`.trim());
      done.add(intro.id);
      items.forEach((x) => done.add(x.id));
      continue;
    }
    paras.push(`${quote(c)} [${c.citation}]`);
    done.add(c.id);
  }
  return paras.join("\n\n");
}

/* ── selection actions ─────────────────────────────────── */

export type SelectionAction = "explain" | "simplify" | "flag" | "ask";

const GLOSSARY: [RegExp, string][] = [
  [/indemnif/i, "To indemnify someone is to pay their losses and legal costs."],
  [/hold\s+harmless/i, "Hold harmless means you agree not to make them pay for those losses."],
  [/arbitrat/i, "Arbitration is a private process where a hired arbitrator decides the dispute, and appeals are rare."],
  [/class\s+(?:action|member)|representative\s+proceeding/i, "A class action is one case brought together by many people with the same complaint."],
  [/jury/i, "Waiving a jury means a judge alone decides the facts if a case reaches court."],
  [/holdover/i, "Holdover means staying in the home after the lease has ended."],
  [/non-?refundable/i, "Non-refundable means the money never comes back."],
  [/sublet|sublease/i, "Subletting means renting your place to someone else while you are still on the lease."],
  [/\bassign/i, "Assigning the lease hands the whole lease, and its duties, to someone else."],
  [/security\s+deposit/i, "A security deposit is money held to cover unpaid rent or damage, returned at the end minus deductions."],
  [/wear\s+and\s+tear/i, "Normal wear and tear is the small damage from everyday living, like faded paint or light scuffs."],
  [/prevailing\s+party/i, "The prevailing party is whoever wins the dispute."],
  [/additional\s+insured/i, "Naming someone an additional insured means your policy protects them too."],
  [/material\s+default/i, "A material default is a serious breach that can let the other side end the lease."],
  [/abandon/i, "Abandoned means moved out for good, usually without telling anyone."],
  [/gross\s+negligence/i, "Gross negligence is extreme carelessness, far beyond an ordinary mistake."],
  [/willful\s+misconduct/i, "Willful misconduct means causing harm on purpose."],
  [/sole\s+discretion/i, "Sole discretion means they can decide however they like."],
  [/governed\s+by|governing\s+law/i, "Governing law is the state law a court uses to read the contract."],
  [/\bvenue\b|courts?\s+located/i, "The venue is the place where a lawsuit has to be filed."],
  [/accrue/i, "Accrue means to build up over time."],
  [/offset/i, "An offset is subtracting money they owe you from what you owe them."],
  [/itemized/i, "An itemized statement lists each deduction and what it cost."],
  [/liquidated\s+damages/i, "Liquidated damages is a fixed penalty agreed on in advance."],
  [/jointly\s+and\s+severally/i, "Jointly and severally means each person can be made to pay the full amount."],
  [/non-?compet/i, "A non-compete limits working for competitors for a while after this ends."],
  [/confidential/i, "Confidential information has to be kept private."],
  [/\bliable\b|liability/i, "Being liable means being legally responsible to pay."],
  [/\bwaive/i, "To waive a right is to give it up."],
  [/renew/i, "Automatic renewal means the lease restarts for another term unless someone cancels in time."],
];

function glossaryFor(text: string, max = 2): string[] {
  const out: string[] = [];
  for (const [re, def] of GLOSSARY) {
    if (re.test(text) && !out.includes(def)) out.push(def);
    if (out.length >= max) break;
  }
  return out;
}

/** Flags whose span overlaps the selection, judged with the whole clause as context. */
function selectionRisks(sel: string, clause: ChatClause, roles: Roles) {
  const text = clause.text.replace(/\s+/g, " ").trim();
  const at = text.indexOf(sel);
  const inClause = at >= 0 ? risksInPassage(text, roles).filter((f) => f.start < at + sel.length && f.end > at) : [];
  const own = risksInPassage(sel, roles).filter((f) => !inClause.some((g) => g.kind === f.kind));
  const order: Severity[] = ["high", "medium", "low"];
  return [...inClause, ...own].sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));
}

const SEVERITY_WORD: Record<Severity, string> = { high: "High risk", medium: "Medium risk", low: "Low risk" };

export type DemoSelectionResult = { text: string; flag?: { severity: Severity; title: string; why: string } };

export function demoSelection(
  action: SelectionAction,
  selection: string,
  clause: ChatClause,
  roles: Roles,
  question = "",
): DemoSelectionResult {
  const sel = selection.replace(/\s+/g, " ").trim();
  const plainSents = sentencesOf(clause.plain?.trim() || ruleSimplify(clause.text, "plain", roles));
  const bestPlain = (query: string, n = 1) =>
    rankSentences(query, plainSents)
      .slice(0, n)
      .filter((r) => r.score > 0)
      .map((r) => plainSents[r.index]);

  if (action === "simplify") {
    const covers = sel.length >= clause.text.replace(/\s+/g, " ").trim().length * 0.6;
    const text = covers && clause.plain ? clause.plain : ruleSimplify(sel, "plain", roles);
    return { text };
  }

  if (action === "flag") {
    const found = selectionRisks(sel, clause, roles);
    if (!found.length) {
      return {
        text: "No standard risk pattern in this passage. If it still worries you, keep the flag and ask about it in the chat.",
        flag: { severity: "low", title: "Your flag", why: "You flagged this passage to come back to." },
      };
    }
    const order: Severity[] = ["high", "medium", "low"];
    found.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));
    const top = found[0];
    const lines = found.slice(0, 2).map((f) => `${SEVERITY_WORD[f.severity]}: ${f.title.toLowerCase()}. ${f.why}`);
    return { text: lines.join("\n\n"), flag: { severity: top.severity, title: top.title, why: top.why } };
  }

  if (action === "ask") {
    const hits = bestPlain(`${question} ${sel}`, 2);
    const body = hits.length ? hits.map(ensureStop).join(" ") : ensureStop(plainSents[0] ?? ruleSimplify(sel, "plain", roles));
    return { text: `${body} [${clause.citation}]` };
  }

  // explain
  const parts: string[] = [];
  const plain = bestPlain(sel, 1)[0];
  parts.push(`In plain terms: ${ensureStop(plain ?? ruleSimplify(sel, "plain", roles))}`);
  parts.push(...glossaryFor(sel));
  const risk = selectionRisks(sel, clause, roles)[0];
  if (risk) parts.push(`Watch out: ${risk.why}`);
  return { text: parts.join(" ") };
}

/* ── live prompts ──────────────────────────────────────── */

export function chatSystemPrompt(perspective: string, docNoun: string): string {
  const who = perspective === "neutral" ? "someone reading it" : `the ${perspective.toLowerCase()}`;
  return [
    `You answer questions about one ${docNoun} for ${who}, using only the clauses provided.`,
    "Cite every claim inline with the clause label in square brackets exactly as given, like [§13(b)].",
    "If the clauses don't answer the question, say so plainly and name the closest clause.",
    "Plain English, under 120 words, short paragraphs. No em dashes. Never invent amounts, dates or rules.",
    "You are not a lawyer and this is not legal advice. When the reader faces a real decision, add one short sentence suggesting they check local law or a lawyer.",
  ].join("\n");
}

export function chatUserPrompt(question: string, chunks: { citation: string; title: string; text: string }[]): string {
  const ctx = chunks.map((c) => `[${c.citation}]${c.title ? ` ${c.title}` : ""}\n${c.text}`).join("\n\n");
  return `Clauses:\n${ctx}\n\nQuestion: ${question}`;
}

const SELECTION_TASK: Record<SelectionAction, string> = {
  explain: "Explain what the selected passage means in plain English, define any legal term in it, and point out anything one-sided. Under 90 words.",
  simplify: "Rewrite the selected passage in plain English. Keep every amount, date, deadline and condition. Under 70 words.",
  flag: "Say whether the selected passage is risky for the reader and why, starting with 'High risk:', 'Medium risk:', 'Low risk:' or 'No obvious risk:'. Under 70 words.",
  ask: "Answer the reader's question about the selected passage, using the clause for context. Under 90 words.",
};

export function selectionPrompt(action: SelectionAction, perspective: string, level: Level = "plain"): string {
  const who = perspective === "neutral" ? "a reader" : `the ${perspective.toLowerCase()}`;
  return [
    `You help ${who} understand a passage from a legal document.`,
    SELECTION_TASK[action],
    level === "eli5" ? "Use very simple words." : "",
    "No em dashes. Never invent facts. This is not legal advice.",
  ]
    .filter(Boolean)
    .join("\n");
}
