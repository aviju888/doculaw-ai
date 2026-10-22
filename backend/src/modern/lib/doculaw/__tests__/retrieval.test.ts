import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BM25, rankSentences } from "../bm25";
import { demoChatAnswer, demoSelection, retrieve, type ChatClause } from "../answer";
import { analyze } from "../analyze";
import { normalizeText } from "../normalize";
import { fixtureRewrite, ruleSimplify } from "../simplify";
import { compareClauses, alignClauses, redline } from "../compare";
import { parseClauses } from "../clauses";
import { LEASE_V1, LEASE_V2_CHANGES, SAMPLE_FIXTURES } from "../samples/rewrites";
import { LEVELS, type Roles } from "../types";

const SAMPLES = join(__dirname, "../samples");
const v1 = normalizeText(readFileSync(join(SAMPLES, "lease-v1.txt"), "utf8"));
const v2 = normalizeText(readFileSync(join(SAMPLES, "lease-v2.txt"), "utf8"));
const a1 = analyze(v1);
const roles = a1.roles;
const byIdDTO = new Map(a1.clauses.map((c) => [c.id, c]));
const chat: ChatClause[] = a1.clauses.map((c) => ({
  id: c.id,
  citation: c.citation,
  title: c.title,
  text: c.text,
  plain: fixtureRewrite("lease-v1", c.citation, "plain") ?? undefined,
  parentTitle: c.parentId ? byIdDTO.get(c.parentId)?.title : undefined,
  parentId: c.parentId,
  childIds: c.childIds,
}));
const byId = new Map(chat.map((c) => [c.id, c]));

describe("bm25", () => {
  it("ranks by term overlap with idf", () => {
    const idx = new BM25([
      { id: "rent", fields: [{ text: "Tenant pays rent monthly", weight: 1 }] },
      { id: "pets", fields: [{ text: "No pets or animals", weight: 1 }] },
      { id: "deposit", fields: [{ text: "Security deposit is returned within 21 days", weight: 1 }] },
    ]);
    expect(idx.search("when is rent due")[0].id).toBe("rent");
    expect(idx.search("can I have a dog")[0].id).toBe("pets");
    expect(idx.search("get my deposit back")[0].id).toBe("deposit");
    expect(idx.search("weather")).toEqual([]);
  });

  it("weights fields", () => {
    const idx = new BM25([
      { id: "body", fields: [{ text: "x", weight: 2 }, { text: "late late late fee", weight: 1 }] },
      { id: "title", fields: [{ text: "Late fee", weight: 2 }, { text: "charges apply", weight: 1 }] },
    ]);
    expect(idx.search("late fee")[0].id).toBe("title");
  });

  it("expands everyday words to contract words", () => {
    const terms = BM25.expand("can I sublet on airbnb");
    expect([...terms.keys()]).toEqual(expect.arrayContaining(["sublet", "airbnb", "assign", "short"]));
    expect(terms.get("assign")).toBeLessThan(1);
  });

  it("ranks sentences for grounded answers", () => {
    const ranked = rankSentences("without notice", ["The rent is due.", "The landlord can enter without notice."]);
    expect(ranked[0].index).toBe(1);
  });
});

describe("retrieval over the sample lease", () => {
  const top = (q: string) => retrieve(q, chat, 4).map((c) => c.number);

  it("finds the right clause for common questions", () => {
    expect(top("Can my landlord enter without notice?").slice(0, 3)).toEqual(["§13(b)", "§13(a)", "§13(c)"]);
    expect(top("What happens if I pay rent late?")[0]).toMatch(/^§5/);
    expect(top("Are pets allowed?")[0]).toBe("§10");
    expect(top("Can I sublet on Airbnb?")[0]).toBe("§11");
    expect(top("How do I get my deposit back?")[0]).toBe("§7(c)");
    expect(top("Who pays for water?")[0]).toBe("§8");
    expect(top("Can I break the lease early?")).toContain("§14(b)");
  });

  it("normalizes scores against the best hit and skips empty headings", () => {
    const hits = retrieve("entry notice", chat, 6);
    expect(hits[0].score).toBe(1);
    expect(hits.every((h) => h.text.length > 0)).toBe(true);
    expect(hits.every((h, i) => i === 0 || h.score <= hits[i - 1].score)).toBe(true);
  });
});

describe("demo answers", () => {
  it("answers the entry question with cited clauses", () => {
    const q = "Can my landlord enter without notice?";
    const ans = demoChatAnswer(q, retrieve(q, chat, 4), byId, roles);
    expect(ans.startsWith("In an emergency")).toBe(true);
    expect(ans).toContain("[§13(b)]");
    expect(ans).toContain("[§13(a)]");
    expect(ans).toContain("24 hours");
    expect(ans).not.toMatch(/—/);
  });

  it("reads list intros together with their items", () => {
    const q = "What happens if I pay rent late?";
    const ans = demoChatAnswer(q, retrieve(q, chat, 4), byId, roles);
    expect(ans).toMatch(/^If rent hasn't arrived by 11:59 p\.m\. on the 5th, these late fees apply: A \$75 late fee right away\. \[§5\(a\)\]/);
    expect(ans).toContain("[§5(b)]");
  });

  it("admits when nothing matches", () => {
    expect(demoChatAnswer("weather?", retrieve("weather?", chat), byId, roles)).toMatch(/^I couldn't find a clause/);
  });

  it("explains, simplifies, flags and answers a selection", () => {
    const c = byId.get("13-b") as ChatClause;
    const sel = "at any time without notice in the event of an emergency";
    expect(demoSelection("explain", sel, c, roles).text).toMatch(/^In plain terms: In an emergency/);
    const flag = demoSelection("flag", sel, c, roles);
    expect(flag.flag).toMatchObject({ severity: "high", title: "Entry without notice" });
    expect(flag.text).toMatch(/^High risk: entry without notice\./);
    expect(demoSelection("simplify", c.text, c, roles).text).toBe(c.plain);
    expect(demoSelection("ask", sel, c, roles, "Does this include repairs?").text).toMatch(/\[§13\(b\)\]$/);
  });

  it("offers a manual flag when no rule matches", () => {
    const c = byId.get("1") as ChatClause;
    const r = demoSelection("flag", "shared laundry room", c, roles);
    expect(r.flag).toMatchObject({ severity: "low", title: "Your flag" });
  });
});

describe("rewrites", () => {
  it("has hand-written rewrites for every sample clause at every level", () => {
    for (const [sampleId, text] of [
      ["lease-v1", v1],
      ["lease-v2", v2],
    ] as const) {
      const flat = parseClauses(text).flat;
      for (const c of flat) for (const level of LEVELS) expect(fixtureRewrite(sampleId, c.citation, level), `${sampleId} ${c.citation} ${level}`).toBeTruthy();
      // no orphan fixtures
      const citations = new Set(flat.map((c) => c.citation));
      for (const key of Object.keys(SAMPLE_FIXTURES[sampleId])) expect(citations.has(key), `${sampleId} orphan ${key}`).toBe(true);
    }
  });

  it("only overrides clauses whose text changed in v2", () => {
    const f1 = new Map(parseClauses(v1).flat.map((c) => [c.citation, c.text]));
    for (const c of parseClauses(v2).flat) {
      const changed = f1.get(c.citation) !== c.text;
      expect(c.citation in LEASE_V2_CHANGES, c.citation).toBe(changed);
    }
  });

  it("keeps rewrites free of em dashes", () => {
    for (const r of [...Object.values(LEASE_V1), ...Object.values(LEASE_V2_CHANGES)]) for (const level of LEVELS) expect(r[level]).not.toMatch(/—/);
  });

  it("simplifies uploads with rules", () => {
    const r: Roles = { parties: ["Tenant", "Landlord"], names: {}, payer: "Tenant" };
    const text = "Tenant shall pay to Landlord the sum of Seventy-Five Dollars ($75.00) prior to the expiration of thirty (30) days.";
    expect(ruleSimplify(text, "lawyer", r)).toBe("Tenant shall pay to Landlord the sum of $75.00 prior to the expiration of 30 days.");
    expect(ruleSimplify(text, "plain", r)).toBe("The tenant must pay the landlord $75 before the end of 30 days.");
    expect(ruleSimplify(text, "eli5", r)).toBe("The renter has to pay the landlord $75 before the end of 30 days.");
    expect(ruleSimplify("This Lease shall automatically renew.", "plain", r)).toBe("This lease will automatically renew.");
  });

  it("turns inline lists into bullets", () => {
    const r: Roles = { parties: ["Tenant", "Landlord"], names: {}, payer: "Tenant" };
    const out = ruleSimplify("Landlord may deduct: (i) unpaid rent; (ii) cleaning costs; and (iii) repairs.", "plain", r);
    expect(out).toBe("The landlord can deduct:\n- unpaid rent\n- cleaning costs\n- repairs");
  });
});

describe("compare v1 → v2", () => {
  const r = compareClauses(parseClauses(v1).flat, parseClauses(v2).flat);

  it("finds exactly the four changes", () => {
    expect(r.diffs.map((d) => [d.status, d.citation])).toEqual([
      ["changed", "§3"],
      ["changed", "§4.1"],
      ["added", "§4.4"],
      ["changed", "§10"],
    ]);
    expect(r.unchanged).toBe(51);
  });

  it("summarizes what moved", () => {
    expect(r.summary).toBe("4 clauses changed: automatic renewal notice 30 → 60 days, rent +$75/mo, pets adds $500 + $45/mo, new monthly amenity fee $40/mo");
    expect(r.diffs[1].facts).toEqual(["Monthly rent: $1,850 → $1,925 (+$75)"]);
    expect(r.diffs[0].facts).toEqual(["Automatic renewal notice: 30 → 60 days"]);
  });

  it("produces Code Block diff rows with word-level pieces", () => {
    const rent = r.diffs[1];
    expect(rent.rows.map((row) => row.type)).toEqual(["del", "add"]);
    expect(rent.rows[0].pieces.filter((p) => p.change === "del").map((p) => p.text)).toEqual(["Eight", "Fifty", "850"]);
    expect(rent.rows[1].pieces.filter((p) => p.change === "add").map((p) => p.text)).toEqual(["Nine", "Twenty-Five", "925"]);
    // pieces rebuild the original texts
    const flat1 = parseClauses(v1).flat;
    const old = flat1.find((c) => c.citation === "§4.1")?.text;
    expect(rent.rows[0].pieces.map((p) => p.text).join("")).toBe(old);
  });

  it("aligns clauses that were renumbered", () => {
    const a = parseClauses("1. RENT. Pay $900 monthly.\n2. PETS. No pets allowed in the unit.\n3. NOISE. Quiet after ten at night.").flat;
    const b = parseClauses("1. RENT. Pay $950 monthly.\n2. PARKING. One space is included.\n3. PETS. No pets allowed in the unit.\n4. NOISE. Quiet after ten at night.").flat;
    const { pairs, added, removed } = alignClauses(a, b);
    expect(pairs.map(([x, y]) => `${x.citation}→${y.citation}`)).toEqual(["§1→§1", "§2→§3", "§3→§4"]);
    expect(added.map((c) => c.citation)).toEqual(["§2"]);
    expect(removed).toEqual([]);
    expect(compareClauses(a, b).summary).toBe("2 clauses changed: rent +$50/mo, new parking");
  });

  it("redlines added and removed text", () => {
    const { rows, added, removed } = redline("a b c", "a x c", 1, 1);
    expect(added).toBe(1);
    expect(removed).toBe(1);
    expect(rows[0].pieces).toEqual([{ text: "a " }, { text: "b", change: "del" }, { text: " c" }]);
  });
});
