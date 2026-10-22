/* ─────────────────────────────────────────────────────────
 * KEY DATES — start, end, the last day to stop an automatic
 * renewal (end minus the notice window), and recurring due days.
 * ───────────────────────────────────────────────────────── */

import type { Clause, KeyDate } from "./types";
import { collapseNumerals, splitSentences } from "./text";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DATE_RE = new RegExp(`(${MONTHS.join("|")})\\s+(\\d{1,2}),\\s+(\\d{4})`, "g");

function toUTC(month: string, day: string, year: string): Date {
  return new Date(Date.UTC(Number(year), MONTHS.indexOf(month), Number(day)));
}

export function fmtDate(d: Date): string {
  return `${MONTHS[d.getUTCMonth()].slice(0, 3)} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function keyDates(flat: Clause[]): KeyDate[] {
  const out: KeyDate[] = [];
  let end: { d: Date; clauseId: string } | null = null;

  for (const c of flat) {
    for (const s of splitSentences(c.text)) {
      for (const m of s.text.matchAll(DATE_RE)) {
        const d = toUTC(m[1], m[2], m[3]);
        const before = s.text.slice(Math.max(0, (m.index ?? 0) - 70), m.index);
        // the nearest keyword before the date decides what it is
        const kw = [...before.matchAll(/\b(commenc|begin|start|terminat|end|expir|entered\s+into|made|dated|executed|signed)\w*/gi)].at(-1)?.[1].toLowerCase();
        const deadline = /\b(?:by|before|no\s+later\s+than|on\s+or\s+before)\s*$/i.test(before);
        const label = deadline ? "Due by" : !kw ? null : /commenc|begin|start/.test(kw) ? "Starts" : /terminat|end|expir/.test(kw) ? "Ends" : "Signed";
        if (!label || out.some((k) => k.label === label)) continue;
        out.push({ label, date: fmtDate(d), iso: iso(d), clauseId: c.id });
        if (label === "Ends") end = { d, clauseId: c.id };
      }
    }
  }

  // last day to stop an automatic renewal
  const renewal = flat.find((c) => /automatic(?:ally)?\s+renew|renew\w*\s+automatically/i.test(c.text));
  if (renewal && end) {
    const m = collapseNumerals(renewal.text).match(/(\d+)\s+days?\s+(?:prior\s+to|before)\s+(?:the\s+)?(?:expiration|end)/i);
    if (m) {
      const d = new Date(end.d.getTime() - Number(m[1]) * 86_400_000);
      out.push({ label: "Stop renewal by", date: fmtDate(d), iso: iso(d), clauseId: renewal.id });
    }
  }

  // recurring due day
  for (const c of flat) {
    const m = collapseNumerals(c.text).match(/on\s+or\s+before\s+the\s+(\d+(?:st|nd|rd|th))\s+day\s+of\s+each\s+(?:calendar\s+)?month/i);
    if (m) {
      out.push({ label: "Rent due", date: `${m[1]} of each month`, iso: "", clauseId: c.id });
      break;
    }
  }
  const order = ["Signed", "Starts", "Ends", "Stop renewal by", "Rent due", "Due by"];
  return out.sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));
}
