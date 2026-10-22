/* ─────────────────────────────────────────────────────────
 * RISK — rule-based flags with exact character spans, so the
 * Original column can draw a squiggle under the risky phrase.
 *
 * Each detector lists patterns in priority order; the first
 * pattern that matches a sentence picks the span. Severity and
 * the "why" can read the whole sentence and the whole clause
 * (a cap stated one sentence later still counts).
 * One flag per clause per kind: the most severe one wins.
 * ───────────────────────────────────────────────────────── */

import type { Clause, RiskFlag, RiskKind, Roles, Severity } from "./types";
import { otherParty, subjectOf } from "./parties";
import { collapseNumerals, formatMoney, parseMoney, splitSentences } from "./text";

type Ctx = { sentence: string; clause: string; match: string; subject: string | null; other: string | null; roles: Roles };

type Detector = {
  kind: RiskKind;
  title: string;
  res: RegExp[];
  /** the sentence must match */
  when?: RegExp;
  /** skip sentences that match */
  unless?: RegExp;
  severity: Severity | ((c: Ctx) => Severity);
  why: string | ((c: Ctx) => string);
  /** who bears it: the sentence subject, the other party, the usual payer, or both */
  burden: "subject" | "other" | "payer" | "both" | ((c: Ctx) => string | null);
  /** stretch the span to the end of the phrase */
  extend?: boolean;
};

const SEV_RANK: Record<Severity, number> = { high: 3, medium: 2, low: 1 };

const lower = (s: string | null, fallback: string) => (s ? s.toLowerCase() : fallback);

function noticeDays(text: string): string | null {
  const m = collapseNumerals(text).match(/(\d+)\s+days?['’]?\s+(?:prior\s+(?:to\s+)?|before\s+)?/i);
  return m ? `${m[1]} days` : null;
}

function firstAmount(text: string): string | null {
  const m = text.match(/\$\s?\d[\d,]*(?:\.\d{2})?/);
  if (!m) return null;
  const n = parseMoney(m[0]);
  return n === null ? null : formatMoney(n);
}

const DETECTORS: Detector[] = [
  {
    kind: "auto-renewal",
    title: "Automatic renewal",
    res: [
      /automatic(?:ally)?\s+renew\w*(?:\s+for\s+[^,;.(]+(?:\(\d+\)[^,;.(]*)*)?/i,
      /renew\w*\s+automatically/i,
      /shall\s+(?:automatically\s+)?(?:continue|extend)\s+(?:on\s+a\s+month-to-month\s+basis|for\s+(?:successive|additional)\s+[^,;.]+)/i,
      /evergreen/i,
    ],
    severity: ({ sentence }) =>
      /(?:twelve|12)\s*(?:\(\d+\)\s*)?months?|one\s*(?:\(1\)\s*)?year|successive\s+terms?\s+of\s+(?:one|twelve|12)/i.test(sentence) ? "high" : "medium",
    why: ({ sentence }) => {
      const days = noticeDays(sentence);
      return days
        ? `It renews by itself unless someone sends written notice at least ${days} before the term ends. Miss that window and you're committed to another full term.`
        : "It renews by itself unless someone sends notice in time. Miss the window and you're committed to another term.";
    },
    burden: "both",
  },
  {
    kind: "early-termination",
    title: "Early termination fee",
    res: [
      /early\s+termination\s+fee[^,;.]*/i,
      /termination\s+fee[^,;.]*/i,
      /liquidated\s+damages/i,
      /terminat\w*\s+this\s+(?:lease|agreement)\s+(?:before|prior\s+to)\s+the\s+(?:expiration|end)/i,
    ],
    severity: ({ sentence }) =>
      /(?:two|three|four|2|3|4)\s*(?:\(\d\)\s*)?months?['’]?\s+rent|liquidated/i.test(sentence) ? "high" : "medium",
    why: ({ sentence }) => {
      const months = collapseNumerals(sentence).match(/(\d+)\s+months?['’]?\s+rent/i);
      return months
        ? `Leaving early costs ${months[1]} months' rent on top of the rent owed up to the move-out date.`
        : "Leaving before the term ends comes with a fee. Check how it's calculated before you sign.";
    },
    burden: (c) => c.subject ?? c.roles.payer,
  },
  {
    kind: "late-fee",
    title: "Late fees",
    res: [/late\s+(?:charge|fee|payment\s+fee)s?(?:\s+of\s+[^,;.]+?\(\$[\d,.]+\))?/i, /dollars?\s*\(\$[\d,.]+\)\s+per\s+day/i, /interest\s+at\s+[^.;]+?per\s+(?:month|annum|year)/i],
    when: /\blate\b|unpaid|past\s+due|overdue|not\s+received/i,
    severity: ({ sentence }) => (/per\s+day|each\s+(?:subsequent\s+)?day|daily/i.test(sentence) ? "high" : "medium"),
    why: ({ sentence }) => {
      const amt = firstAmount(sentence);
      return /per\s+day|each\s+(?:subsequent\s+)?day|daily/i.test(sentence)
        ? `Another ${amt ?? "fee"} lands every day rent stays unpaid, until the monthly cap.`
        : `Paying late adds ${amt ?? "a fee"} on top of rent.`;
    },
    burden: "payer",
  },
  {
    kind: "deposit",
    title: "Deposit terms",
    res: [/non-?refundable[^,;.]*/i, /shall\s+be\s+charged\s+in\s+all\s+cases[^,;.]*/i, /forfeit\w*[^,;.]*/i, /(?:retain|keep)\s+the\s+(?:entire\s+)?(?:security\s+)?deposit/i],
    when: /deposit|move-?out|cleaning/i,
    severity: "high",
    why: ({ sentence }) =>
      /in\s+all\s+cases|regardless/i.test(sentence)
        ? "Cleaning gets taken out of your deposit no matter how clean you leave the place."
        : /non-?refundable/i.test(sentence)
          ? `This ${firstAmount(sentence) ?? "money"} never comes back, even if you leave the place spotless.`
          : "Part of the deposit can be kept without a clear reason tied to damage.",
    burden: "payer",
  },
  {
    kind: "deposit",
    title: "Slow deposit return",
    res: [/within\s+(?:[\w-]+\s+)?\(?(?:[4-9]\d|\d{3})\)?\s+days[^,;.]*/i],
    when: /return[^.]*deposit|deposit[^.]*return/i,
    severity: "medium",
    why: "More than a month to get your deposit back. Many places require faster returns.",
    burden: "payer",
  },
  {
    kind: "extra-fee",
    title: "Non-refundable fee",
    res: [/non-?refundable[^,;.]*/i],
    unless: /deposit/i,
    severity: "medium",
    why: "You pay this and never get it back, whether or not you use what it covers.",
    burden: "payer",
  },
  {
    kind: "indemnification",
    title: "Indemnification",
    res: [/indemnif\w+(?:,?\s+(?:defend,?\s+)?(?:and\s+)?hold\s+harmless)?(?:\s+\w+){0,6}?(?=\s+from|\s+against|[,;.])/i, /hold\s+harmless/i],
    severity: ({ sentence }) => (/each\s+party\s+shall\s+indemnify|mutual/i.test(sentence) ? "medium" : /any\s+and\s+all|attorneys/i.test(sentence) ? "high" : "medium"),
    why: ({ subject, other }) =>
      `The ${lower(subject, "signer")} pays ${other ? `the ${other.toLowerCase()}'s` : "the other side's"} losses and legal fees from claims tied to the property, including claims the ${lower(subject, "signer")} didn't cause on purpose.`,
    burden: "subject",
  },
  {
    kind: "liability-waiver",
    title: "Liability waiver",
    res: [
      /shall\s+not\s+be\s+(?:liable|responsible)[^,;.]*/i,
      /(?:is|are)\s+not\s+(?:liable|responsible)[^,;.]*/i,
      /waives?\s+(?:any\s+and\s+all|all|any)\s+claims[^,;.]*/i,
      /releases?\s+\w+(?:\s+\w+){0,4}\s+from\s+(?:any\s+and\s+all|all|any)\s+(?:claims|liability)/i,
      /in\s+no\s+event\s+shall[^,;.]*/i,
      /regardless\s+of\s+(?:the\s+)?cause/i,
    ],
    severity: ({ sentence }) => (/regardless\s+of|injur|negligen|any\s+and\s+all/i.test(sentence) ? "high" : "medium"),
    why: ({ subject }) =>
      `The ${lower(subject, "other side")} won't pay for stolen or damaged belongings or injuries listed here, even when the cause was in their control. Renter's insurance is the backstop.`,
    burden: "other",
  },
  {
    kind: "arbitration",
    title: "Arbitration",
    res: [/(?:final\s+and\s+)?binding\s+arbitration(?:\s+before\s+[^,;.]+)?/i, /arbitrat(?:ion|or)/i],
    unless: /not\s+subject\s+to\s+arbitration/i,
    severity: ({ sentence }) => (/selected\s+by|binding|not\s+(?:by|in)\s+(?:a\s+)?court|exclusively/i.test(sentence) ? "high" : "medium"),
    why: ({ sentence }) => {
      const picker = sentence.match(/selected\s+by\s+(?:the\s+)?(\w+)/i)?.[1];
      return picker
        ? `Disputes go to a private arbitrator that the ${picker.toLowerCase()} picks, with no judge or jury. Appeals are very limited.`
        : "Disputes go to a private arbitrator, with no judge or jury. Appeals are very limited.";
    },
    burden: (c) => {
      const picker = c.sentence.match(/selected\s+by\s+(?:the\s+)?(\w+)/i)?.[1];
      const role = picker ? c.roles.parties.find((p) => p.toLowerCase() === picker.toLowerCase()) ?? null : null;
      return role ? otherParty(c.roles, role) : "both";
    },
  },
  {
    kind: "class-waiver",
    title: "Class action waiver",
    res: [/class\s+action/i, /brought\s+solely\s+in\s+\w+['’]s\s+individual\s+capacity/i, /individual\s+capacity/i, /class,?\s+collective/i, /representative\s+(?:action|proceeding)/i],
    severity: "high",
    why: "You can't team up with other people who had the same problem, so small claims may not be worth bringing alone.",
    burden: (c) => c.subject ?? c.roles.parties[0] ?? null,
  },
  {
    kind: "jury-waiver",
    title: "Jury waiver",
    res: [/waives?\s+(?:any\s+)?(?:right\s+to\s+)?(?:a\s+)?trial\s+by\s+jury/i, /jury\s+trial\s+waiver/i, /waive\s+(?:a\s+)?jury/i],
    severity: "medium",
    why: "If a dispute does reach a courtroom, a judge decides it alone.",
    burden: "both",
  },
  {
    kind: "entry",
    title: "Entry without notice",
    res: [/at\s+any\s+time\s+without\s+(?:prior\s+|advance\s+)?notice/i, /without\s+(?:prior\s+|advance\s+)?notice/i, /at\s+any\s+time/i],
    when: /\benter|\bentry\b|\baccess\b/i,
    severity: "high",
    why: ({ sentence }) =>
      /emergenc/i.test(sentence) && /abandon/i.test(sentence)
        ? "No notice needed in an emergency, or whenever they believe the place was abandoned. That second trigger is a judgment call on their side."
        : "They can come in without warning.",
    burden: "other",
  },
  {
    kind: "entry",
    title: "Short-notice entry",
    res: [/(?:upon\s+)?(?:one|two|three|four|1|2|3|4)\s*(?:\(\d\)\s*)?hours?['’]?\s+(?:prior\s+)?(?:written\s+)?notice/i],
    when: /\benter|\bentry\b|\bshow\b|\baccess\b/i,
    severity: "medium",
    why: ({ match }) => `${collapseNumerals(match).replace(/^upon\s+/i, "").replace(/^\w/, (m) => m.toUpperCase())} is very short warning to have strangers walk through your home.`,
    burden: "other",
  },
  {
    kind: "entry",
    title: "Entry rights",
    res: [/may\s+enter(?:\s+the\s+\w+)?/i],
    severity: ({ sentence }) =>
      /(?:twenty-four|24|forty-eight|48)\s*(?:\(\d+\)\s*)?hours?['’]?\s+(?:prior\s+)?(?:written\s+)?notice/i.test(sentence) ? "low" : "medium",
    why: ({ sentence }) =>
      /(?:twenty-four|24|forty-eight|48)\s*(?:\(\d+\)\s*)?hours?/i.test(sentence)
        ? `${/forty-eight|48/i.test(sentence) ? "48" : "24"} hours' written notice is a common standard. It also covers showings to buyers and new tenants.`
        : "They can enter for the reasons listed. Check that notice is required.",
    burden: "other",
  },
  {
    kind: "rent-increase",
    title: "Rent increase",
    res: [/(?:may\s+)?increase\s+the\s+rent/i, /rent\s+(?:increase|adjustment|escalation)/i, /adjust\s+the\s+rent/i, /escalat\w+/i],
    severity: ({ clause }) => {
      const cap = clause.match(/\((\d+(?:\.\d+)?)%\)|(\d+(?:\.\d+)?)\s*%/);
      const pct = cap ? Number(cap[1] ?? cap[2]) : null;
      return pct === null ? "high" : pct > 5 ? "medium" : "low";
    },
    why: ({ clause }) => {
      const cap = clause.match(/\((\d+(?:\.\d+)?)%\)|(\d+(?:\.\d+)?)\s*%/);
      const pct = cap ? cap[1] ?? cap[2] : null;
      const days = noticeDays(clause);
      return pct
        ? `Rent can go up at each renewal, by as much as ${pct}% at a time${days ? `, with ${days}' notice` : ""}.`
        : "Rent can go up and nothing here caps how much.";
    },
    burden: "other",
  },
  {
    kind: "sublet-ban",
    title: "No subletting",
    res: [/shall\s+not\s+(?:assign|sublet|sublease)[^.;]*?(?=,\s+or\s+|[.;]|$)/i, /(?:no|not)\s+(?:subletting|assignment)/i, /short-term\s+rental/i],
    severity: ({ clause }) => (/void|material\s+default|short-term/i.test(clause) ? "medium" : "low"),
    why: "No subletting, no handing the lease to someone else, no short-term rentals. If you need to move out early, the early termination terms are the only exit.",
    burden: "subject",
  },
  {
    kind: "non-compete",
    title: "Non-compete",
    res: [/non-?compet\w*/i, /not\s+(?:to\s+)?compete/i, /non-?solicit\w*/i, /shall\s+not\s+(?:directly\s+or\s+indirectly\s+)?solicit[^,;.]*/i],
    severity: "high",
    why: "Limits where you can work or who you can contact after this ends. Check how long it lasts and where it applies.",
    burden: "subject",
  },
  {
    kind: "confidentiality",
    title: "Confidentiality",
    res: [/shall\s+(?:not\s+disclose|keep\s+confidential|hold\s+in\s+(?:strict\s+)?confidence)[^,;.]*/i, /confidential\s+information/i, /non-?disclosure/i, /confidentiality/i],
    severity: ({ sentence }) => (/perpetu|indefinite|surviv/i.test(sentence) ? "medium" : "low"),
    why: ({ sentence }) =>
      /perpetu|indefinite|surviv/i.test(sentence)
        ? "You have to keep this information private, and the duty outlasts the agreement."
        : "You have to keep certain information private.",
    burden: "subject",
  },
  {
    kind: "unilateral-change",
    title: "One-sided changes",
    res: [
      /may\s+(?:amend|modify|change|update|revise|supplement)[^.;]{0,60}?(?:at\s+any\s+time|from\s+time\s+to\s+time|without\s+(?:notice|consent))/i,
      /reserves?\s+the\s+right\s+to\s+(?:amend|modify|change|update)[^,;.]*/i,
      /shall\s+be\s+binding\s+on\s+\w+\s+as\s+if[^,;.]*/i,
    ],
    severity: ({ sentence }) => (/at\s+any\s+time|without\s+(?:notice|consent)|binding/i.test(sentence) ? "high" : "medium"),
    why: ({ subject }) => `The ${lower(subject, "other side")} can change these rules after you sign, and the new version binds you without your agreement.`,
    burden: "other",
  },
  {
    kind: "governing-law",
    title: "Governing law and venue",
    res: [/governed\s+by\s+(?:and\s+construed\s+in\s+accordance\s+with\s+)?the\s+laws?\s+of\s+[^.,;]+/i, /exclusive\s+(?:jurisdiction|venue)/i, /brought\s+(?:exclusively|only)\s+in\s+[^.,;]+/i],
    severity: "low",
    why: ({ clause }) => {
      const county = clause.match(/in\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)*\s+County)/)?.[1];
      const state = clause.match(/laws?\s+of\s+(?:the\s+State\s+of\s+)?([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/)?.[1];
      return `Disputes run under ${state ? `${state} law` : "the named law"}${county ? ` in ${county} courts` : ""}. Easy if you live nearby, costly if you move away.`;
    },
    burden: "both",
  },
  {
    kind: "attorney-fees",
    title: "Attorneys' fees",
    res: [/attorneys?['’]?\s+fees(?:\s+and\s+costs)?/i],
    unless: /indemnif|hold\s+harmless/i,
    severity: ({ sentence }) => (/prevailing/i.test(sentence) ? "low" : /shall\s+(?:pay|reimburse)/i.test(sentence) ? "high" : "medium"),
    why: ({ sentence }) =>
      /prevailing/i.test(sentence)
        ? "Whoever loses a dispute can end up paying both sides' lawyers. That raises the stakes of fighting a charge you think is wrong."
        : "You could be on the hook for the other side's legal bills.",
    burden: "both",
  },
  {
    kind: "holdover",
    title: "Holdover penalty",
    res: [/holdover\s+rent(?:[^;.]|\.(?=\d))*?per\s+(?:day|month)/i, /hold(?:s|ing)?\s+over/i, /remains?\s+in\s+possession/i],
    severity: ({ sentence }) => (/per\s+day/i.test(sentence) ? "high" : "medium"),
    why: ({ sentence }) => {
      const amt = firstAmount(sentence);
      return /per\s+day/i.test(sentence) && amt
        ? `Staying past the end date costs ${amt} a day, plus any damages it causes.`
        : "Staying past the end date costs extra.";
    },
    burden: (c) => c.subject ?? c.roles.payer,
  },
  {
    kind: "extra-fee",
    title: "Extra fee",
    res: [/(?:processing|convenience|administrative|admin|amenity|technology|service|cleaning|move-?(?:in|out)|utility|application|pet)\s+fee[^,;.]*/i],
    unless: /non-?refundable|late/i,
    severity: "low",
    why: ({ sentence }) => {
      const amt = firstAmount(sentence);
      const cadence = /monthly|per\s+month|each\s+month/i.test(sentence) ? " a month" : /each\s+payment|per\s+payment/i.test(sentence) ? " per payment" : "";
      return `An extra ${amt ?? "charge"}${cadence} on top of rent. Small on its own, but it adds up over a year.`;
    },
    burden: "payer",
  },
];

/** End of the phrase that starts at `from`: next , ; . or an opening "(" before a word. */
function phraseEnd(text: string, from: number, max = 110): number {
  const slice = text.slice(from, from + max);
  const m = slice.match(/[,;](?=\s)|\.(?=\s|$)|\s\((?=[A-Za-z"“])/);
  return from + (m?.index ?? slice.length);
}

export type RiskOptions = { roles: Roles };

/** All flags for a parsed document. Offsets are absolute. */
export function detectRisks(doc: string, flat: Clause[], { roles }: RiskOptions): RiskFlag[] {
  const flags: RiskFlag[] = [];
  for (const clause of flat) {
    if (!clause.text.trim()) continue;
    const best = new Map<string, RiskFlag & { order: number }>();
    for (const s of splitSentences(clause.text, clause.textStart)) {
      if (/:\s*$/.test(s.text)) continue; // list intros: the items carry the detail
      for (let di = 0; di < DETECTORS.length; di++) {
        const d = DETECTORS[di];
        if (d.when && !d.when.test(s.text)) continue;
        if (d.unless && d.unless.test(s.text)) continue;
        let match: RegExpMatchArray | null = null;
        for (const re of d.res) {
          match = s.text.match(re);
          if (match) break;
        }
        if (!match || match.index === undefined) continue;
        const subject = subjectOf(s.text, roles);
        const ctx: Ctx = { sentence: s.text, clause: clause.text, match: match[0], subject, other: otherParty(roles, subject), roles };
        const severity = typeof d.severity === "function" ? d.severity(ctx) : d.severity;
        const why = typeof d.why === "function" ? d.why(ctx) : d.why;
        const burden =
          typeof d.burden === "function"
            ? d.burden(ctx)
            : d.burden === "subject"
              ? subject
              : d.burden === "other"
                ? otherParty(roles, subject)
                : d.burden === "payer"
                  ? roles.payer
                  : "both";
        const start = s.start + match.index;
        let end = start + match[0].length;
        if (d.extend) end = Math.max(end, phraseEnd(doc, start));
        // never stop inside a number: "$3" + ".95)"
        const tail = doc.slice(end).match(/^\.\d+\)?/);
        if (tail) end += tail[0].length;
        while (end > start && /[\s,;]/.test(doc[end - 1])) end--;
        const flag = {
          id: `r-${clause.id}-${d.kind}`,
          clauseId: clause.id,
          kind: d.kind,
          severity,
          start,
          end,
          title: d.title,
          why,
          burden,
          order: di,
        };
        const prev = best.get(d.kind);
        if (!prev || SEV_RANK[severity] > SEV_RANK[prev.severity]) best.set(d.kind, flag);
      }
    }
    for (const f of [...best.values()].sort((a, b) => a.start - b.start)) {
      const { order: _order, ...flag } = f;
      void _order;
      flags.push(flag);
    }
  }
  return flags;
}

/** Runs the same detectors over an arbitrary passage (Selection "Flag risk"). */
export function risksInPassage(passage: string, roles: Roles): Omit<RiskFlag, "clauseId" | "id">[] {
  const pseudo: Clause = {
    id: "passage", number: "", ref: "", citation: "", title: "", text: passage, level: 0, start: 0, textStart: 0,
    end: passage.length, subtreeEnd: passage.length, style: "passage", parentId: null, children: [],
  };
  return detectRisks(passage, [pseudo], { roles }).map(({ clauseId: _c, id: _i, ...rest }) => {
    void _c;
    void _i;
    return rest;
  });
}

/** Whether a flag matters to the reader's side. */
export function affects(flag: Pick<RiskFlag, "burden">, perspective: string): boolean {
  return perspective === "neutral" || flag.burden === null || flag.burden === "both" || flag.burden === perspective;
}

export function riskCounts(flags: RiskFlag[], perspective: string) {
  const mine = flags.filter((f) => affects(f, perspective));
  return {
    high: mine.filter((f) => f.severity === "high").length,
    medium: mine.filter((f) => f.severity === "medium").length,
    low: mine.filter((f) => f.severity === "low").length,
    others: flags.length - mine.length,
  };
}

export const SEVERITY_ORDER: Severity[] = ["high", "medium", "low"];
