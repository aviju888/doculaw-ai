import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analyze } from "../analyze";
import { parseClauses } from "../clauses";
import { normalizeText } from "../normalize";
import { detectRoles, subjectOf } from "../parties";
import { affects, detectRisks, riskCounts, risksInPassage } from "../risk";
import { definedAmounts, extractObligations, sideOf, totalsFor, whenOf } from "../obligations";
import { keyDates } from "../keydates";
import type { RiskFlag, Roles } from "../types";

const SAMPLES = join(__dirname, "../samples");
const v1 = normalizeText(readFileSync(join(SAMPLES, "lease-v1.txt"), "utf8"));
const v2 = normalizeText(readFileSync(join(SAMPLES, "lease-v2.txt"), "utf8"));
const a1 = analyze(v1);
const cite = new Map(a1.clauses.map((c) => [c.id, c.citation]));
const LEASE_ROLES: Roles = { parties: ["Tenant", "Landlord"], names: {}, payer: "Tenant" };

function flagAt(citation: string, kind: string): RiskFlag | undefined {
  return a1.risks.find((r) => cite.get(r.clauseId) === citation && r.kind === kind);
}

describe("parties", () => {
  it("finds roles, names and who pays", () => {
    expect(a1.roles).toEqual({
      parties: ["Tenant", "Landlord"],
      names: { Tenant: "Marlowe Quintero", Landlord: "Bramblecote Properties LLC" },
      payer: "Tenant",
    });
  });

  it("works for other contract types", () => {
    const nda = 'This Agreement is between Northwind Labs Inc. (the "Company") and Ana Ruiz (the "Employee"). The Employee shall not disclose. The Company shall pay the Employee. The Employee shall return all devices.';
    const r = detectRoles(nda);
    expect(r.parties).toEqual(["Employee", "Company"]);
    expect(r.names.Company).toBe("Northwind Labs Inc.");
  });

  it("only treats a role followed by a verb as the subject", () => {
    expect(subjectOf("pays to Landlord an early termination fee", LEASE_ROLES)).toBeNull();
    expect(subjectOf("Landlord may enter the Premises", LEASE_ROLES)).toBe("Landlord");
    expect(subjectOf("Landlord and its agents may enter", LEASE_ROLES)).toBe("Landlord");
  });
});

describe("risk flags on the sample lease", () => {
  it("flags the risky clauses with the right severity", () => {
    const expected: [string, string, string][] = [
      ["§3", "auto-renewal", "high"],
      ["§4.3", "rent-increase", "medium"],
      ["§5(a)", "late-fee", "medium"],
      ["§5(b)", "late-fee", "high"],
      ["§7(b)(iii)", "deposit", "high"],
      ["§7(d)", "deposit", "high"],
      ["§11", "sublet-ban", "medium"],
      ["§13(a)", "entry", "low"],
      ["§13(b)", "entry", "high"],
      ["§13(c)", "entry", "medium"],
      ["§14(b)", "early-termination", "high"],
      ["§15", "holdover", "high"],
      ["§16.2", "indemnification", "high"],
      ["§16.3", "liability-waiver", "high"],
      ["§17(a)", "arbitration", "high"],
      ["§17(b)", "class-waiver", "high"],
      ["§17(c)", "jury-waiver", "medium"],
      ["§18", "attorney-fees", "low"],
      ["§19", "unilateral-change", "high"],
      ["§20.2", "governing-law", "low"],
    ];
    for (const [c, kind, sev] of expected) expect(flagAt(c, kind)?.severity, `${c} ${kind}`).toBe(sev);
  });

  it("underlines the exact risky phrase", () => {
    const span = (f?: RiskFlag) => (f ? v1.slice(f.start, f.end) : "");
    expect(span(flagAt("§13(b)", "entry"))).toBe("at any time without notice");
    expect(span(flagAt("§13(c)", "entry"))).toBe("upon two (2) hours' notice");
    expect(span(flagAt("§4.2", "extra-fee"))).toBe("processing fee of Three Dollars and Ninety-Five Cents ($3.95)");
    expect(span(flagAt("§17(a)", "arbitration"))).toBe("final and binding arbitration before a single arbitrator selected by Landlord");
    expect(span(flagAt("§17(c)", "jury-waiver"))).toBe("WAIVES ANY RIGHT TO A TRIAL BY JURY");
  });

  it("keeps every span inside its clause's own text", () => {
    for (const f of a1.risks) {
      const c = a1.clauses.find((x) => x.id === f.clauseId);
      expect(c).toBeDefined();
      expect(f.start).toBeGreaterThanOrEqual(c!.textStart);
      expect(f.end).toBeLessThanOrEqual(c!.end);
      expect(f.end).toBeGreaterThan(f.start);
    }
  });

  it("raises one flag per kind per clause", () => {
    const keys = a1.risks.map((r) => `${r.clauseId}|${r.kind}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("does not confuse holdover rent with a late fee or venue with arbitration", () => {
    expect(flagAt("§15", "late-fee")).toBeUndefined();
    expect(flagAt("§20.2", "arbitration")).toBeUndefined();
  });

  it("assigns the burden to the side that carries it", () => {
    expect(flagAt("§13(b)", "entry")?.burden).toBe("Tenant");
    expect(flagAt("§14(b)", "early-termination")?.burden).toBe("Tenant");
    expect(flagAt("§16.3", "liability-waiver")?.burden).toBe("Tenant");
    expect(flagAt("§19", "unilateral-change")?.burden).toBe("Tenant");
    expect(flagAt("§17(c)", "jury-waiver")?.burden).toBe("both");
    expect(flagAt("§19", "unilateral-change")?.why).toMatch(/^The landlord can change/);
  });

  it("explains the cap and notice behind a rent increase", () => {
    expect(flagAt("§4.3", "rent-increase")?.why).toBe("Rent can go up at each renewal, by as much as 8% at a time, with 30 days' notice.");
  });

  it("emphasizes risks by perspective", () => {
    const tenant = riskCounts(a1.risks, "Tenant");
    const landlord = riskCounts(a1.risks, "Landlord");
    const neutral = riskCounts(a1.risks, "neutral");
    expect(neutral.others).toBe(0);
    expect(tenant.high).toBeGreaterThan(landlord.high);
    expect(affects({ burden: "both" }, "Landlord")).toBe(true);
    expect(affects({ burden: "Tenant" }, "Landlord")).toBe(false);
  });

  it("finds contract risks outside leases", () => {
    const roles: Roles = { parties: ["Employee", "Company"], names: {}, payer: "Company" };
    const kinds = (t: string) => risksInPassage(t, roles).map((r) => `${r.kind}:${r.severity}`);
    expect(kinds("For twelve months after termination, Employee shall not solicit any customer of the Company.")).toContain("non-compete:high");
    expect(kinds("Employee shall not disclose Confidential Information, and this obligation survives termination.")).toContain("confidentiality:medium");
    expect(kinds("The Company reserves the right to modify this policy at any time.")).toContain("unilateral-change:high");
    expect(kinds("Each party shall pay its own costs.")).toEqual([]);
  });

  it("stays quiet on harmless text", () => {
    const quiet = "1. PREMISES. Landlord leases the unit to Tenant.\n2. NOTICES. Notices must be in writing.";
    const tree = parseClauses(quiet);
    expect(detectRisks(quiet, tree.flat, { roles: LEASE_ROLES })).toEqual([]);
  });
});

describe("obligations on the sample lease", () => {
  const obs = a1.obligations;
  const find = (citation: string, re: RegExp) => obs.find((o) => cite.get(o.clauseId) === citation && re.test(o.action));

  it("resolves defined amounts", () => {
    expect(definedAmounts(v1)).toMatchObject({ Rent: 1850, "Security Deposit": 2775 });
  });

  it("extracts rent, deposit and fees with cadence", () => {
    expect(find("§4.1", /rent/i)).toMatchObject({ party: "Tenant", amount: 1850, cadence: "monthly", when: "by the 1st of each month", conditional: false });
    expect(find("§7(a)", /deposit/i)).toMatchObject({ amount: 2775, cadence: "once", when: "at signing" });
    expect(find("§7(d)", /administrative fee/i)).toMatchObject({ amount: 250, cadence: "once", conditional: false });
    expect(find("§8", /utility fee/i)).toMatchObject({ amount: 65, cadence: "monthly" });
    expect(find("§5(b)", /late charge/i)).toMatchObject({ amount: 10, cadence: "daily", conditional: true, when: "if late after the 5th" });
    expect(find("§15", /holdover/i)).toMatchObject({ amount: 125, cadence: "daily", conditional: true });
  });

  it("computes 'two months' Rent' from the defined rent", () => {
    expect(find("§14(b)", /early termination/i)).toMatchObject({ party: "Tenant", amount: 3700, amountText: "2 months' rent", conditional: true });
  });

  it("finds what the other side owes", () => {
    expect(find("§7(c)", /return the security deposit/i)).toMatchObject({ party: "Landlord", amount: 2775, when: "within 21 days after Tenant vacates the Premises" });
    expect(find("§13(a)", /notice/i)?.action).toBe("Give 24 hours' written notice before entering");
    expect(obs.filter((o) => cite.get(o.clauseId) === "§12.2").map((o) => o.party)).toEqual(["Landlord", "Landlord"]);
  });

  it("handles prohibitions, passive duties and both-sides duties", () => {
    expect(find("§10", /pets/i)?.action).toBe("Don't keep pets on or about the Premises without Landlord's prior written consent");
    expect(find("§11", /assign/i)?.kind).toBe("must-not");
    expect(find("Add. A(2)", /grills/i)?.action).toBe("Don't use grills, smokers, and open flames on balconies and patios");
    expect(find("§3", /non-renewal/i)).toMatchObject({ party: "Both", when: "30 days before the term ends" });
    expect(find("§16.3", /.*/)).toBeUndefined();
  });

  it("splits a list of duties in one sentence", () => {
    expect(obs.filter((o) => cite.get(o.clauseId) === "§12.1").map((o) => o.action)).toEqual([
      "Keep the Premises clean and sanitary",
      "Promptly notify Landlord in writing of any leak, mold, or malfunction",
      "Replace smoke detector batteries and light bulbs as needed",
      "Cover the cost of any repair made necessary by the negligence or misuse of Tenant or Tenant's guests",
    ]);
  });

  it("does not treat insurance coverage as money owed", () => {
    expect(find("§16.1", /insurance/i)?.amount).toBeNull();
  });

  it("totals what each side owes", () => {
    const tenant = totalsFor(obs.filter((o) => o.party === "Tenant"));
    expect(tenant).toEqual({ upfront: 3025, atSigning: 3025, monthly: 1915, yearly: 0, conditionalCount: 6, conditionalMax: 3700, daily: 125 });
    const landlord = totalsFor(obs.filter((o) => o.party === "Landlord"));
    expect(landlord.upfront).toBe(2775);
    // returning the deposit happens at move-out, not at signing
    expect(landlord.atSigning).toBe(0);
  });

  it("follows the rent change into v2", () => {
    const a2 = analyze(v2);
    const c2 = new Map(a2.clauses.map((c) => [c.id, c.citation]));
    const etf = a2.obligations.find((o) => c2.get(o.clauseId) === "§14(b)");
    expect(etf?.amount).toBe(3850);
    expect(totalsFor(a2.obligations.filter((o) => o.party === "Tenant")).monthly).toBe(1925 + 65 + 40 + 45);
  });

  it("maps parties to you and them", () => {
    expect(sideOf("Tenant", "Tenant", LEASE_ROLES)).toBe("you");
    expect(sideOf("Landlord", "Tenant", LEASE_ROLES)).toBe("them");
    expect(sideOf("Tenant", "Landlord", LEASE_ROLES)).toBe("them");
    expect(sideOf("Both", "Tenant", LEASE_ROLES)).toBe("both");
    expect(sideOf("Tenant", "neutral", LEASE_ROLES)).toBe("you");
  });

  it("shortens deadlines", () => {
    expect(whenOf("within twenty-one (21) days after Tenant vacates the Premises and returns all keys")).toBe("within 21 days after Tenant vacates the Premises");
    expect(whenOf("delivers not less than sixty (60) days' prior written notice")).toBe("60 days' notice");
    expect(whenOf("on or before the first (1st) day of each calendar month")).toBe("by the 1st of each month");
    expect(whenOf("nothing here")).toBeNull();
  });

  it("works on a contract that is not a lease", () => {
    const doc = [
      'This Agreement is between Northwind Labs Inc. (the "Company") and Ana Ruiz (the "Contractor").',
      "1. FEES. The Company shall pay the Contractor $4,000.00 per month within fifteen (15) days after each invoice.",
      "2. DUTIES. The Contractor shall deliver the reports described in Exhibit A.",
    ].join("\n");
    const tree = parseClauses(doc);
    const roles = detectRoles(doc);
    const obs2 = extractObligations(doc, tree.flat, roles);
    expect(obs2.map((o) => [o.party, o.amount, o.cadence])).toEqual([
      ["Company", 4000, "monthly"],
      ["Contractor", null, null],
    ]);
  });
});

describe("key dates", () => {
  it("finds start, end, renewal deadline and due day", () => {
    expect(a1.keyDates.map((k) => [k.label, k.date])).toEqual([
      ["Signed", "Aug 14, 2026"],
      ["Starts", "Sep 1, 2026"],
      ["Ends", "Aug 31, 2027"],
      ["Stop renewal by", "Aug 1, 2027"],
      ["Rent due", "1st of each month"],
    ]);
  });

  it("labels a plain deadline", () => {
    const doc = "Dear neighbor,\n\nEach household shall pay a fee of $120.00 by June 1, 2027.\n\nThanks.";
    expect(keyDates(parseClauses(doc).flat).map((k) => [k.label, k.date])).toEqual([["Due by", "Jun 1, 2027"]]);
  });

  it("moves the renewal deadline when the notice window grows", () => {
    const k2 = keyDates(parseClauses(v2).flat);
    expect(k2.find((k) => k.label === "Stop renewal by")?.date).toBe("Jul 2, 2027");
  });
});
