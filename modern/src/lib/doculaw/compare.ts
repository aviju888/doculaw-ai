/* ─────────────────────────────────────────────────────────
 * COMPARE — v1 vs v2, clause by clause.
 *
 *   1. align: same citation and similar content → same clause;
 *      else same title; else best text overlap (survives
 *      renumbering); leftovers are added / removed
 *   2. redline: jsdiff word diff → Code Block DiffRow pieces
 *   3. summarize: money, durations and percentages that moved
 *      ("rent +$75/mo", "renewal notice 30 → 60 days")
 * ───────────────────────────────────────────────────────── */

import { diffWords } from "diff";
import type { CodePiece, DiffRow } from "@/components/bui/CodeBlock";
import type { Clause } from "./types";
import { collapseNumerals, formatMoney, parseMoney, tokenize } from "./text";

export type ClauseDiff = {
  key: string;
  status: "changed" | "added" | "removed";
  citation: string;
  title: string;
  oldId: string | null;
  newId: string | null;
  rows: DiffRow[];
  /** words added / removed */
  added: number;
  removed: number;
  facts: string[];
};

export type CompareResult = {
  summary: string;
  diffs: ClauseDiff[];
  unchanged: number;
};

const norm = (s: string) => s.replace(/\s+/g, " ").trim();
const normTitle = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function jaccard(a: string, b: string): number {
  const A = new Set(tokenize(a));
  const B = new Set(tokenize(b));
  if (!A.size && !B.size) return 1;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

export function alignClauses(a: Clause[], b: Clause[]): { pairs: [Clause, Clause][]; removed: Clause[]; added: Clause[] } {
  const pairs: [Clause, Clause][] = [];
  const usedB = new Set<string>();
  const usedA = new Set<string>();
  const similar = (x: Clause, y: Clause) =>
    (x.title && normTitle(x.title) === normTitle(y.title)) || jaccard(`${x.title} ${x.text}`, `${y.title} ${y.text}`) >= 0.35;

  // 1. same citation, similar content
  const bByCitation = new Map(b.map((c) => [c.citation, c]));
  for (const x of a) {
    const y = bByCitation.get(x.citation);
    if (y && !usedB.has(y.id) && similar(x, y)) {
      pairs.push([x, y]);
      usedA.add(x.id);
      usedB.add(y.id);
    }
  }
  // 2. same title
  for (const x of a) {
    if (usedA.has(x.id) || !x.title) continue;
    const y = b.find((c) => !usedB.has(c.id) && c.title && normTitle(c.title) === normTitle(x.title));
    if (y) {
      pairs.push([x, y]);
      usedA.add(x.id);
      usedB.add(y.id);
    }
  }
  // 3. best text overlap
  for (const x of a) {
    if (usedA.has(x.id)) continue;
    let best: { c: Clause; s: number } | null = null;
    for (const y of b) {
      if (usedB.has(y.id)) continue;
      const s = jaccard(x.text, y.text);
      if (s >= 0.5 && (!best || s > best.s)) best = { c: y, s };
    }
    if (best) {
      pairs.push([x, best.c]);
      usedA.add(x.id);
      usedB.add(best.c.id);
    }
  }
  const order = new Map(b.map((c, i) => [c.id, i]));
  pairs.sort((p, q) => (order.get(p[1].id) ?? 0) - (order.get(q[1].id) ?? 0));
  return { pairs, removed: a.filter((c) => !usedA.has(c.id)), added: b.filter((c) => !usedB.has(c.id)) };
}

function mergePieces(pieces: CodePiece[]): CodePiece[] {
  const out: CodePiece[] = [];
  for (const p of pieces) {
    const last = out[out.length - 1];
    if (last && last.change === p.change) last.text += p.text;
    else out.push({ ...p });
  }
  return out;
}

export function redline(oldText: string, newText: string, oldNum: number | null, newNum: number | null): { rows: DiffRow[]; added: number; removed: number } {
  const changes = diffWords(oldText, newText);
  const del: CodePiece[] = [];
  const add: CodePiece[] = [];
  let added = 0;
  let removed = 0;
  const words = (s: string) => (s.match(/\S+/g) ?? []).length;
  for (const c of changes) {
    if (c.added) {
      add.push({ text: c.value, change: "add" });
      added += words(c.value);
    } else if (c.removed) {
      del.push({ text: c.value, change: "del" });
      removed += words(c.value);
    } else {
      del.push({ text: c.value });
      add.push({ text: c.value });
    }
  }
  const rows: DiffRow[] = [];
  if (oldText) rows.push({ old: oldNum, cur: null, type: "del", pieces: mergePieces(del) });
  if (newText) rows.push({ old: null, cur: newNum, type: "add", pieces: mergePieces(add) });
  return { rows, added, removed };
}

/* ── facts ─────────────────────────────────────────────── */

const LABEL_STOP = new Set(["of", "a", "an", "the", "in", "amount", "sum", "total", "to", "pay", "shall", "is", "be", "and", "or", "with", "for", "equal", "landlord", "tenant", "per"]);

type Money = { label: string; amount: number; monthly: boolean };
type Duration = { unit: string; n: number; notice: boolean };

function moneyMentions(text: string, fallback = "amount"): Money[] {
  const t = collapseNumerals(text);
  const out: Money[] = [];
  for (const m of t.matchAll(/\$\s?\d[\d,]*(?:\.\d{2})?/g)) {
    const amount = parseMoney(m[0]);
    if (amount === null) continue;
    const before = t.slice(Math.max(0, (m.index ?? 0) - 60), m.index).split(/\s+/).reverse();
    const label: string[] = [];
    for (const w of before) {
      const clean = w.toLowerCase().replace(/[^a-z-]/g, "");
      if (!clean) continue;
      if (LABEL_STOP.has(clean)) {
        if (label.length) break;
        continue;
      }
      label.unshift(clean);
      if (label.length === 3) break;
    }
    const after = t.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 24);
    const lbl = label.join(" ") || fallback;
    out.push({ label: lbl, amount, monthly: /monthly|per month/.test(lbl) || /^\)?\s*(?:per|a|each)\s+month|^\)?\s*monthly/i.test(after) });
  }
  return out;
}

function durations(text: string): Duration[] {
  const t = collapseNumerals(text);
  const out: Duration[] = [];
  for (const m of t.matchAll(/\b(\d{1,3})\s+(days?|months?|years?|hours?|pounds?)\b/gi)) {
    const around = t.slice(Math.max(0, (m.index ?? 0) - 80), (m.index ?? 0) + 60);
    out.push({ unit: m[2].toLowerCase().replace(/s$/, ""), n: Number(m[1]), notice: /notice/i.test(around) });
  }
  return out;
}

const plural = (unit: string, n: number) => `${unit}${n === 1 ? "" : "s"}`;
const perMonth = (m: Money) => (m.monthly ? "/mo" : "");

function factsFor(title: string, oldText: string, newText: string): { long: string[]; short: string[] } {
  const long: string[] = [];
  const short: string[] = [];
  const name = title || "Clause";
  const fallback = title ? title.toLowerCase() : "amount";
  const a = moneyMentions(oldText, fallback);
  const b = moneyMentions(newText, fallback);
  const used = new Set<number>();
  for (const x of a) {
    const yi = b.findIndex((y, i) => !used.has(i) && y.label === x.label);
    if (yi < 0) continue;
    used.add(yi);
    const y = b[yi];
    if (y.amount === x.amount) continue;
    const diff = y.amount - x.amount;
    long.push(`${capitalizeFirst(x.label)}: ${formatMoney(x.amount)} → ${formatMoney(y.amount)} (${diff > 0 ? "+" : "−"}${formatMoney(Math.abs(diff))})`);
    short.push(`${x.label.split(" ").pop()} ${diff > 0 ? "+" : "−"}${formatMoney(Math.abs(diff))}${perMonth(x)}`);
  }
  const adds = b.filter((y, i) => !used.has(i) && !a.some((x) => x.label === y.label && x.amount === y.amount));
  if (adds.length) {
    long.push(`${name}: adds ${adds.map((y) => `${formatMoney(y.amount)} ${y.label}`).join(", ")}`);
    short.push(`${name.toLowerCase()} adds ${adds.map((y) => `${formatMoney(y.amount)}${perMonth(y)}`).join(" + ")}`);
  }
  const da = durations(oldText);
  const db = durations(newText);
  const units = new Set([...da.map((d) => d.unit), ...db.map((d) => d.unit)]);
  for (const unit of units) {
    const xa = da.filter((d) => d.unit === unit);
    const xb = db.filter((d) => d.unit === unit);
    for (let i = 0; i < Math.min(xa.length, xb.length); i++) {
      if (xa[i].n === xb[i].n) continue;
      const label = `${name}${xa[i].notice ? " notice" : ""}`;
      long.push(`${label}: ${xa[i].n} → ${xb[i].n} ${plural(unit, xb[i].n)}`);
      short.push(`${label.toLowerCase()} ${xa[i].n} → ${xb[i].n} ${plural(unit, xb[i].n)}`);
    }
  }
  return { long, short };
}

function capitalizeFirst(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

export function compareClauses(a: Clause[], b: Clause[]): CompareResult {
  const { pairs, removed, added } = alignClauses(a, b);
  const idxA = new Map(a.map((c, i) => [c.id, i + 1]));
  const idxB = new Map(b.map((c, i) => [c.id, i + 1]));
  const diffs: ClauseDiff[] = [];
  const short: string[] = [];
  let unchanged = 0;

  for (const [x, y] of pairs) {
    if (norm(x.text) === norm(y.text) && normTitle(x.title) === normTitle(y.title)) {
      unchanged++;
      continue;
    }
    const r = redline(x.text, y.text, idxA.get(x.id) ?? null, idxB.get(y.id) ?? null);
    const f = factsFor(y.title || x.title, x.text, y.text);
    short.push(...f.short.slice(0, 2));
    if (!f.short.length) short.push(`${(y.title || y.citation).toLowerCase()} reworded`);
    diffs.push({ key: `c-${y.id}`, status: "changed", citation: y.citation, title: y.title, oldId: x.id, newId: y.id, rows: r.rows, added: r.added, removed: r.removed, facts: f.long });
  }
  for (const y of added) {
    if (!y.text.trim() && !y.title) continue;
    const r = redline("", y.text, null, idxB.get(y.id) ?? null);
    const money = moneyMentions(y.text, y.title ? y.title.toLowerCase() : "amount")[0];
    const fact = money ? `New clause: ${formatMoney(money.amount)} ${money.label}` : `New clause${y.title ? `: ${y.title.toLowerCase()}` : ""}`;
    short.push(money ? `new ${money.label} ${formatMoney(money.amount)}${perMonth(money)}` : `new ${(y.title || y.citation).toLowerCase()}`);
    diffs.push({ key: `a-${y.id}`, status: "added", citation: y.citation, title: y.title, oldId: null, newId: y.id, rows: r.rows, added: r.added, removed: 0, facts: [fact] });
  }
  for (const x of removed) {
    if (!x.text.trim() && !x.title) continue;
    const r = redline(x.text, "", idxA.get(x.id) ?? null, null);
    short.push(`removed ${(x.title || x.citation).toLowerCase()}`);
    diffs.push({ key: `r-${x.id}`, status: "removed", citation: x.citation, title: x.title, oldId: x.id, newId: null, rows: r.rows, added: 0, removed: r.removed, facts: [`Removed ${x.citation}${x.title ? ` ${x.title}` : ""}`] });
  }

  const order = new Map(b.map((c, i) => [c.id, i]));
  diffs.sort((p, q) => (order.get(p.newId ?? "") ?? 1e6) - (order.get(q.newId ?? "") ?? 1e6));

  const n = diffs.length;
  const summary = n === 0 ? "No clause changed." : `${n} ${n === 1 ? "clause" : "clauses"} changed: ${short.join(", ")}`;
  return { summary, diffs, unchanged };
}
