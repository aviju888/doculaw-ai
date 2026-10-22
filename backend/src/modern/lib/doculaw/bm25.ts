/* ─────────────────────────────────────────────────────────
 * BM25 — keyword retrieval over clauses, standing in for the
 * original's Pinecone + embeddings. Fields are weighted (title
 * counts double) and the plain-English rewrite is indexed too,
 * so "Can my landlord come in?" still finds "Entry by Landlord".
 * A small legal synonym map bridges everyday words to the
 * contract's vocabulary (pets → animal, sublet → assign...).
 * ───────────────────────────────────────────────────────── */

import { stem, tokenize } from "./text";

export type Field = { text: string; weight: number };
export type BM25Doc = { id: string; fields: Field[] };
export type Hit = { id: string; score: number };

/** everyday word → contract words. Stemmed once at load, so write plain words. */
const SYNONYM_WORDS: Record<string, string[]> = {
  enter: ["entry", "access", "inspect", "show"],
  entry: ["enter", "access"],
  come: ["enter", "entry"],
  visit: ["enter", "entry", "inspect"],
  notice: ["notify", "written"],
  warning: ["notice"],
  pet: ["animal", "dog", "cat"],
  dog: ["pet", "animal"],
  cat: ["pet", "animal"],
  fee: ["charge", "cost", "penalty"],
  charge: ["fee"],
  late: ["unpaid", "overdue"],
  leave: ["terminate", "vacate", "early"],
  break: ["terminate", "early"],
  quit: ["terminate", "vacate"],
  early: ["terminate"],
  cancel: ["terminate", "renew", "renewal"],
  stop: ["terminate", "renewal"],
  renew: ["automatic", "renewal"],
  sublet: ["assign", "sublease", "short"],
  airbnb: ["short", "sublet", "rental"],
  fix: ["repair", "maintain"],
  broken: ["repair", "maintain", "malfunction"],
  repair: ["maintain", "maintenance"],
  deposit: ["security", "return"],
  back: ["return", "refund"],
  refund: ["return"],
  roommate: ["occupant", "guest", "sublet"],
  raise: ["increase", "adjust"],
  increase: ["adjust", "adjustment"],
  sue: ["court", "arbitration", "dispute", "claim"],
  court: ["arbitration", "jury", "dispute"],
  lawsuit: ["arbitration", "class", "court", "claim"],
  dispute: ["arbitration"],
  injury: ["liable", "injury", "damage"],
  injured: ["liable", "injury", "damage"],
  hurt: ["injury", "liable"],
  stolen: ["theft", "liable"],
  theft: ["liable", "property"],
  insure: ["insurance", "coverage"],
  rule: ["regulation", "amend"],
  noise: ["quiet"],
  loud: ["quiet"],
  guest: ["occupant", "visitor"],
  park: ["parking", "space"],
  car: ["parking"],
  utility: ["electricity", "water", "gas", "internet"],
  water: ["utility"],
  internet: ["utility"],
  lawyer: ["attorney"],
  money: ["fee", "rent", "deposit"],
  owe: ["pay", "fee", "rent"],
  pay: ["rent", "fee"],
  move: ["vacate", "terminate"],
  smoke: ["smoking", "grill"],
  grill: ["flame"],
  bike: ["bicycle"],
  bicycle: ["bike"],
};

const SYNONYMS: Record<string, string[]> = {};
for (const [k, vs] of Object.entries(SYNONYM_WORDS)) {
  const key = stem(k);
  SYNONYMS[key] = [...new Set([...(SYNONYMS[key] ?? []), ...vs.map(stem)])];
}

export class BM25 {
  private docs: { id: string; tf: Map<string, number>; len: number }[] = [];
  private df = new Map<string, number>();
  private avgLen = 0;

  constructor(
    docs: BM25Doc[],
    private k1 = 1.2,
    private b = 0.75,
  ) {
    for (const d of docs) {
      const tf = new Map<string, number>();
      let len = 0;
      for (const f of d.fields) {
        for (const t of tokenize(f.text)) {
          tf.set(t, (tf.get(t) ?? 0) + f.weight);
          len += f.weight;
        }
      }
      this.docs.push({ id: d.id, tf, len });
      for (const t of tf.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1);
    }
    this.avgLen = this.docs.reduce((s, d) => s + d.len, 0) / Math.max(1, this.docs.length);
  }

  private idf(t: string): number {
    const n = this.docs.length;
    const df = this.df.get(t) ?? 0;
    return Math.log(1 + (n - df + 0.5) / (df + 0.5));
  }

  /** query terms with weights: originals count 1, synonyms 0.4 */
  static expand(query: string): Map<string, number> {
    const terms = new Map<string, number>();
    for (const t of tokenize(query)) terms.set(t, Math.max(terms.get(t) ?? 0, 1));
    for (const t of [...terms.keys()]) {
      for (const syn of SYNONYMS[t] ?? []) if (!terms.has(syn)) terms.set(syn, 0.4);
    }
    return terms;
  }

  scoreTerms(terms: Map<string, number>, docIndex: number): number {
    const d = this.docs[docIndex];
    let score = 0;
    for (const [t, w] of terms) {
      const f = d.tf.get(t);
      if (!f) continue;
      const norm = f + this.k1 * (1 - this.b + (this.b * d.len) / (this.avgLen || 1));
      score += w * this.idf(t) * ((f * (this.k1 + 1)) / norm);
    }
    return score;
  }

  search(query: string, k = 4): Hit[] {
    const terms = BM25.expand(query);
    if (!terms.size) return [];
    return this.docs
      .map((d, i) => ({ id: d.id, score: this.scoreTerms(terms, i) }))
      .filter((h) => h.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }
}

/** Ranks sentences of a passage against a query (for grounded answers). */
export function rankSentences(query: string, sentences: string[]): { index: number; score: number }[] {
  const terms = BM25.expand(query);
  return sentences
    .map((s, index) => {
      const toks = tokenize(s);
      let score = 0;
      const seen = new Set<string>();
      for (const t of toks) {
        const w = terms.get(t);
        if (w && !seen.has(t)) {
          score += w;
          seen.add(t);
        }
      }
      return { index, score: score / Math.sqrt(Math.max(4, toks.length) / 4) };
    })
    .sort((a, b) => b.score - a.score);
}
