import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { clauseAt, describeNumbering, extractInlineTitle, maxDepth, parseClauses } from "../clauses";
import { matchMarker } from "../markers";
import { normalizeText } from "../normalize";
import type { Clause } from "../types";

const SAMPLES = join(__dirname, "../samples");
const v1 = normalizeText(readFileSync(join(SAMPLES, "lease-v1.txt"), "utf8"));

/** compact tree: "  §1(a)|Title" per clause */
function shape(doc: string): string[] {
  return parseClauses(doc).flat.map((c) => `${"  ".repeat(c.level)}${c.citation}${c.title && c.title !== c.citation ? `|${c.title}` : ""}`);
}

function byCitation(doc: string, citation: string): Clause {
  const c = parseClauses(doc).flat.find((x) => x.citation === citation);
  if (!c) throw new Error(`no clause ${citation}`);
  return c;
}

function expectOffsetsConsistent(doc: string) {
  const { flat } = parseClauses(doc);
  let prevStart = -1;
  for (const c of flat) {
    expect(doc.slice(c.textStart, c.end)).toBe(c.text);
    expect(c.start).toBeGreaterThan(prevStart);
    expect(c.textStart).toBeGreaterThanOrEqual(c.start);
    expect(c.subtreeEnd).toBeGreaterThanOrEqual(c.end);
    prevStart = c.start;
    for (const ch of c.children) {
      expect(ch.parentId).toBe(c.id);
      expect(ch.level).toBe(c.level + 1);
      expect(ch.start).toBeGreaterThanOrEqual(c.start);
      expect(ch.subtreeEnd).toBeLessThanOrEqual(c.subtreeEnd);
    }
  }
  expect(new Set(flat.map((c) => c.id)).size).toBe(flat.length);
}

describe("sample lease v1", () => {
  const tree = parseClauses(v1);

  it("finds the title, preamble and every clause", () => {
    expect(tree.title).toBe("Residential Lease Agreement");
    expect(tree.flat).toHaveLength(54);
    expect(tree.flat[0]).toMatchObject({ id: "preamble", title: "Parties", citation: "Preamble", level: 0 });
    expect(tree.roots.map((c) => c.citation)).toEqual([
      "Preamble",
      ...Array.from({ length: 20 }, (_, i) => `§${i + 1}`),
      "Signatures",
      "Add. A",
    ]);
  });

  it("nests decimals, letters and roman numerals", () => {
    expect(shape(v1).slice(4, 9)).toEqual(["§4|Rent", "  §4.1|Monthly rent", "  §4.2|Method of payment", "  §4.3|Rent adjustment", "§5|Late charges"]);
    const s7 = byCitation(v1, "§7");
    expect(s7.children.map((c) => c.citation)).toEqual(["§7(a)", "§7(b)", "§7(c)", "§7(d)"]);
    expect(s7.children[1].children.map((c) => c.citation)).toEqual(["§7(b)(i)", "§7(b)(ii)", "§7(b)(iii)"]);
    expect(s7.children[1].children[2].style).toBe("paren-lower-roman");
    expect(maxDepth(tree.flat)).toBe(3);
  });

  it("extracts titles in sentence case and leaves untitled clauses empty", () => {
    expect(byCitation(v1, "§18").title).toBe("Attorneys' fees");
    expect(byCitation(v1, "§12.1").title).toBe("Tenant's obligations");
    expect(byCitation(v1, "§20.2").title).toBe("Governing law and venue");
    expect(byCitation(v1, "§13(a)").title).toBe("");
    // an all-caps sentence is body text, not a title
    const jury = byCitation(v1, "§17(c)");
    expect(jury.title).toBe("");
    expect(jury.text).toBe("EACH PARTY KNOWINGLY AND VOLUNTARILY WAIVES ANY RIGHT TO A TRIAL BY JURY.");
  });

  it("keeps heading-only clauses empty and bodies exact", () => {
    expect(byCitation(v1, "§4").text).toBe("");
    expect(byCitation(v1, "§13").text).toBe("");
    expect(byCitation(v1, "§5").text).toMatch(/^If any installment of Rent .* due:$/);
    expect(byCitation(v1, "§1").text.startsWith("Landlord hereby leases to Tenant")).toBe(true);
    expectOffsetsConsistent(v1);
  });

  it("handles the signature block and an addendum with its own numbering", () => {
    const sig = byCitation(v1, "Signatures");
    expect(sig.text).toContain("IN WITNESS WHEREOF");
    expect(sig.text).toContain("TENANT: Marlowe Quintero");
    const add = byCitation(v1, "Add. A");
    expect(add).toMatchObject({ title: "Community rules", number: "Addendum A", level: 0 });
    expect(add.children.map((c) => c.citation)).toEqual(["Add. A(1)", "Add. A(2)", "Add. A(3)"]);
  });

  it("describes the numbering styles it saw", () => {
    expect(describeNumbering(tree.flat)).toEqual(["1.", "1.1", "(a)", "(i)", "Addendum A"]);
  });

  it("maps offsets back to clauses", () => {
    const idx = v1.indexOf("at any time without notice");
    expect(clauseAt(tree.flat, idx)?.citation).toBe("§13(b)");
    expect(clauseAt(tree.flat, v1.indexOf("4.1 Monthly Rent"))?.citation).toBe("§4.1");
  });
});

describe("decimal numbering", () => {
  it("nests 1. / 1.1 / 1.1.1 and pops back", () => {
    const doc = ["1. Alpha. Text one.", "1.1 Beta. Text two.", "1.1.1 Gamma. Text three.", "1.1.2 Delta. Text.", "1.2 Epsilon. Text.", "2. Zeta. Text."].join("\n");
    expect(shape(doc)).toEqual(["§1|Alpha", "  §1.1|Beta", "    §1.1.1|Gamma", "    §1.1.2|Delta", "  §1.2|Epsilon", "§2|Zeta"]);
    expectOffsetsConsistent(doc);
  });

  it("accepts 1.01-style section numbers", () => {
    const doc = ["1. Terms", "1.01 First. A.", "1.02 Second. B.", "2. More", "2.01 Third. C."].join("\n");
    expect(shape(doc)).toEqual(["§1|Terms", "  §1.01|First", "  §1.02|Second", "§2|More", "  §2.01|Third"]);
  });

  it("starts a new group when the parent line is missing (2.1 after 1.3)", () => {
    const doc = ["1.1 One. a.", "1.2 Two. b.", "2.1 Three. c.", "2.2 Four. d."].join("\n");
    expect(shape(doc)).toEqual(["§1.1|One", "§1.2|Two", "§2.1|Three", "§2.2|Four"]);
  });

  it("rejects numbers that are just wrapped text", () => {
    const doc = [
      "1. Notice. Tenant shall give notice no later than",
      "30 days after the event, and in any case",
      "1.5 times the monthly rent applies.",
      "2. Next. Text.",
    ].join("\n");
    const tree = parseClauses(doc);
    expect(tree.flat.map((c) => c.citation)).toEqual(["§1", "§2"]);
    expect(tree.flat[0].text).toContain("1.5 times the monthly rent");
  });

  it("tolerates a small gap only for heading-like lines", () => {
    expect(shape("1. A. x\n2. B. y\n4. D. z").map((s) => s.trim())).toEqual(["§1|A", "§2|B", "§4|D"]);
    const tree = parseClauses("1. A. x\n2. B. y\n9. Nine is too far.\n3. C. z");
    expect(tree.flat.map((c) => c.citation)).toEqual(["§1", "§2", "§3"]);
  });

  it("supports 1) numbering as its own style", () => {
    const doc = "1. Rent. Pay it.\n1) on time\n2) in full\n2. Deposit. Pay it.";
    // "1)" style requires a capital after the number, so lowercase items stay text
    expect(parseClauses(doc).flat.map((c) => c.citation)).toEqual(["§1", "§2"]);
    const doc2 = "1. Rent. Pay it.\n1) On time.\n2) In full.\n2. Deposit. Pay it.";
    expect(shape(doc2)).toEqual(["§1|Rent", "  §1(1)", "  §1(2)", "§2|Deposit"]);
  });
});

describe("letters and roman numerals", () => {
  it("reads (i) as a roman numeral when no letter list expects it", () => {
    const doc = ["1. Use. Tenant may use it for:", "(a) living;", "(b) storage:", "(i) boxes;", "(ii) bikes;", "(c) guests.", "2. End. Done."].join("\n");
    expect(shape(doc)).toEqual(["§1|Use", "  §1(a)", "  §1(b)", "    §1(b)(i)", "    §1(b)(ii)", "  §1(c)", "§2|End"]);
  });

  it("reads (i) as the letter after (h)", () => {
    const letters = "abcdefghijk".split("");
    const doc = ["1. List. Items:", ...letters.map((l) => `(${l}) item ${l};`)].join("\n");
    const tree = parseClauses(doc);
    const kids = tree.flat[0].children;
    expect(kids.map((c) => c.number)).toEqual(letters.map((l) => `(${l})`));
    expect(kids.every((c) => c.style === "paren-lower")).toBe(true);
  });

  it("continues roman numerals through (iv), (v), (ix), (x)", () => {
    const romans = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi"];
    const doc = ["1. Things. List:", "(a) first group:", ...romans.map((r) => `(${r}) thing;`), "(b) second group."].join("\n");
    const tree = parseClauses(doc);
    const a = tree.flat[0].children[0];
    expect(a.children.map((c) => c.number)).toEqual(romans.map((r) => `(${r})`));
    expect(a.children.every((c) => c.style === "paren-lower-roman")).toBe(true);
    expect(tree.flat[0].children.map((c) => c.number)).toEqual(["(a)", "(b)"]);
  });

  it("handles doubled letters after (z)", () => {
    const letters = "abcdefghijklmnopqrstuvwxyz".split("");
    const doc = ["1. Long. List:", ...letters.map((l) => `(${l}) x;`), "(aa) y;", "(bb) z."].join("\n");
    const kids = parseClauses(doc).flat[0].children;
    expect(kids).toHaveLength(28);
    expect(kids.slice(-2).map((c) => c.number)).toEqual(["(aa)", "(bb)"]);
  });

  it("separates upper-case roman headings from lettered subsections", () => {
    const doc = ["I. INTRODUCTION", "Some text.", "A. Scope. Covers x.", "B. Terms. Covers y.", "II. PAYMENT", "A. Amount. $5.", "III. END"].join("\n");
    expect(shape(doc)).toEqual(["§I|Introduction", "  §I(A)|Scope", "  §I(B)|Terms", "§II|Payment", "  §II(A)|Amount", "§III|End"]);
  });

  it("reads C. as a letter after B.", () => {
    const doc = "A. One. x\nB. Two. y\nC. Three. z\nD. Four. w";
    expect(parseClauses(doc).flat.map((c) => c.style)).toEqual(["dot-upper", "dot-upper", "dot-upper", "dot-upper"]);
  });

  it("restarts a letter list under a new parent", () => {
    const doc = ["1. One. Intro:", "(a) x;", "(b) y.", "2. Two. Intro:", "(a) z."].join("\n");
    expect(shape(doc)).toEqual(["§1|One", "  §1(a)", "  §1(b)", "§2|Two", "  §2(a)"]);
  });

  it("ignores a cross-reference that wraps to the start of a line", () => {
    const doc = ["1. One. Intro:", "(a) the first item, subject to subsection", "(c) above, and more.", "(b) the second item."].join("\n");
    const one = parseClauses(doc).flat[0];
    expect(one.children.map((c) => c.number)).toEqual(["(a)", "(b)"]);
    expect(one.children[0].text).toContain("(c) above");
  });

  it("supports right-paren and dotted lowercase styles", () => {
    const doc = ["1. One. Intro:", "a) Alpha item.", "b) Beta item:", "i. Roman one.", "ii. Roman two.", "c) Gamma item."].join("\n");
    expect(shape(doc)).toEqual(["§1|One", "  §1(a)", "  §1(b)", "    §1(b)(i)", "    §1(b)(ii)", "  §1(c)"]);
  });

  it("nests five levels deep", () => {
    const doc = ["1. Top. x", "1.1 Mid. x", "(a) low x", "(i) lower x", "(A) Lowest x"].join("\n");
    const tree = parseClauses(doc);
    expect(maxDepth(tree.flat)).toBe(5);
    expect(tree.flat.at(-1)?.citation).toBe("§1.1(a)(i)(A)");
  });
});

describe("articles, sections and headings", () => {
  it("nests Section 1.01 under ARTICLE I with titles on the next line", () => {
    const doc = [
      "ARTICLE I",
      "DEFINITIONS",
      "Section 1.01 Terms. Words mean things.",
      "Section 1.02 Usage. More words.",
      "ARTICLE II",
      "PAYMENT",
      "Section 2.01 Fees. Pay them.",
    ].join("\n");
    expect(shape(doc)).toEqual(["Art. I|Definitions", "  §1.01|Terms", "  §1.02|Usage", "Art. II|Payment", "  §2.01|Fees"]);
    expectOffsetsConsistent(doc);
  });

  it("reads spelled-out article numbers and § signs", () => {
    const doc = ["ARTICLE ONE: PARTIES", "Text.", "ARTICLE TWO: TERM", "§ 2.1 Start. Begins.", "§ 2.2 End. Ends."].join("\n");
    expect(shape(doc)).toEqual(["Art. ONE|Parties", "Art. TWO|Term", "  §2.1|Start", "  §2.2|End"]);
  });

  it("does not treat a sentence that starts with Section as a heading", () => {
    const doc = ["1. Rent. Tenant pays rent as set out in", "Section 4 of this Lease and on time.", "2. Deposit. Pays it."].join("\n");
    const tree = parseClauses(doc);
    expect(tree.flat.map((c) => c.citation)).toEqual(["§1", "§2"]);
  });

  it("reads Exhibit C as the letter after Exhibit B", () => {
    const doc = ["1. Main. Body.", "2. More. Body.", "EXHIBIT A", "Rules.", "EXHIBIT B", "Floor plan.", "EXHIBIT C", "Inventory."].join("\n");
    const tree = parseClauses(doc);
    expect(tree.roots.map((c) => c.citation)).toEqual(["§1", "§2", "Ex. A", "Ex. B", "Ex. C"]);
    expect(tree.roots.at(-1)?.style).toBe("kw:exhibit:alpha");
  });

  it("uses ALL-CAPS headings as structure", () => {
    const doc = ["PARTIES", "This lease is between A and B.", "RENT", "Rent is $900.", "SECURITY DEPOSIT", "Deposit is $900."].join("\n");
    expect(shape(doc)).toEqual(["Parties", "Rent", "Security deposit"]);
    expect(parseClauses(doc).flat[1].text).toBe("Rent is $900.");
  });

  it("nests numbered clauses under caps headings and continues numbering across them", () => {
    const doc = ["RENT", "1. Amount. $900.", "2. Due. On the 1st.", "DEPOSIT", "3. Amount. $900.", "4. Return. In 21 days."].join("\n");
    expect(shape(doc)).toEqual(["Rent", "  §1|Amount", "  §2|Due", "Deposit", "  §3|Amount", "  §4|Return"]);
  });

  it("keeps caps sentences and form labels as text", () => {
    const doc = [
      "1. Waiver. Read this.",
      "TENANT ACKNOWLEDGES THAT THIS IS IMPORTANT.",
      "2. Signatures. Sign below.",
      "TENANT: MARLOWE QUINTERO",
      "DATE: ____________",
    ].join("\n");
    const tree = parseClauses(doc);
    expect(tree.flat.map((c) => c.citation)).toEqual(["§1", "§2"]);
    expect(tree.flat[1].text).toContain("TENANT: MARLOWE QUINTERO");
  });

  it("reads markdown headings", () => {
    const doc = ["# Lease", "## 1. Rent", "Pay $900.", "## 2. Deposit", "### Return", "Within 21 days."].join("\n");
    expect(shape(doc)).toEqual(["Lease", "  §1|Rent", "  §2|Deposit", "    Return"]);
  });

  it("strips markdown bold around markers", () => {
    const doc = "**1. Rent.** Tenant pays $900.\n**2. Deposit.** Tenant pays $900.";
    expect(shape(doc)).toEqual(["§1|Rent", "§2|Deposit"]);
    expect(parseClauses(doc).flat[0].text).toBe("Tenant pays $900.");
  });
});

describe("titles", () => {
  it("splits caps and title-case titles from the body", () => {
    expect(extractInlineTitle("RENT. Tenant shall pay.", 100)).toEqual({ title: "Rent", bodyStart: 106 });
    expect(extractInlineTitle("Use of Premises. The unit is a home.", 0)).toEqual({ title: "Use of premises", bodyStart: 17 });
    expect(extractInlineTitle("GOVERNING LAW: California law applies.", 0).title).toBe("Governing law");
    expect(extractInlineTitle("Monthly Rent", 0)).toEqual({ title: "Monthly rent", bodyStart: null });
    expect(extractInlineTitle("SECURITY DEPOSIT.", 0)).toEqual({ title: "Security deposit", bodyStart: null });
  });

  it("does not mistake a sentence for a title", () => {
    expect(extractInlineTitle("Tenant shall pay rent.", 0)).toEqual({ title: "", bodyStart: 0 });
    expect(extractInlineTitle("Upon execution of this Lease, Tenant pays.", 0).title).toBe("");
    expect(extractInlineTitle("Landlord and Tenant agree as follows: things.", 0).title).toBe("");
    expect(extractInlineTitle("EACH PARTY WAIVES ANY RIGHT TO A JURY.", 0).title).toBe("");
  });

  it("takes the title from the next line after a bare marker", () => {
    expect(shape("1.\nRent and Fees\nTenant pays.\n2.\nDEPOSIT\nTenant pays.")).toEqual(["§1|Rent and fees", "§2|Deposit"]);
    // a sentence on the next line is body, not title
    const tree = parseClauses("1.\nThe Tenant shall pay rent of $900 each month to the Landlord.\n2. Next. x");
    expect(tree.flat[0].title).toBe("");
    expect(tree.flat[0].text).toMatch(/^The Tenant shall pay/);
  });
});

describe("markers", () => {
  it("offers both readings for ambiguous markers", () => {
    expect(matchMarker("(i) something")?.candidates.map((c) => c.style).sort()).toEqual(["paren-lower", "paren-lower-roman"]);
    expect(matchMarker("(iv) something")?.candidates.map((c) => c.style)).toEqual(["paren-lower-roman"]);
    expect(matchMarker("C. Something")?.candidates.map((c) => c.style).sort()).toEqual(["dot-upper", "dot-upper-roman"]);
  });

  it("rejects things that only look like markers", () => {
    expect(matchMarker("2026. was a year")).toBeNull();
    expect(matchMarker("30 days after")).toBeNull();
    expect(matchMarker("1.5 times the rent")).toBeNull();
    expect(matchMarker("e.g. this")).toBeNull();
    expect(matchMarker("(1st) day")).toBeNull();
    expect(matchMarker("Section 4 of this Lease")).toBeNull();
    expect(matchMarker("Exhibit A attached hereto")).toBeNull();
  });

  it("measures marker length so offsets line up", () => {
    const m = matchMarker("ARTICLE IV – PREMISES");
    expect(m?.rest).toBe("PREMISES");
    expect("ARTICLE IV – PREMISES".slice(m?.length)).toBe("PREMISES");
    const d = matchMarker("4.1 Monthly Rent. Pay.");
    expect(d?.raw).toBe("4.1");
    expect(d?.rest).toBe("Monthly Rent. Pay.");
  });
});

describe("pdf-like and messy input", () => {
  const pdfText = [
    "RESIDENTIAL LEASE AGREEMENT",
    'This Lease is made between Bramblecote Properties LLC ("Landlord") and Jun Park ("Tenant").',
    "1. RENT. Tenant shall pay rent of $1,850.00 per month, in advance, on or before the first (1st)",
    "day of each calendar month, without demand, deduction or offset of any kind, at the address",
    "Landlord designates in writing from time to time during the term.",
    "(a) Late fee of $75.00 if rent is late.",
    "(b) Additional $10.00 per day.",
    "2. Security Deposit. Tenant shall pay a deposit of $1,850.00 on or before the",
    "first day of the term, and Landlord shall return it within twenty-one (21) days after",
    "Tenant moves out.",
    "2.1 Return of deposit within twenty-one (21) days.",
  ].join("\n");

  it("reflows wrapped lines and still finds every clause", () => {
    const doc = normalizeText(pdfText);
    expect(shape(doc)).toEqual(["Preamble|Parties", "§1|Rent", "  §1(a)", "  §1(b)", "§2|Security deposit", "  §2.1"]);
    const rent = byCitation(doc, "§1");
    expect(rent.text).toBe(
      "Tenant shall pay rent of $1,850.00 per month, in advance, on or before the first (1st) day of each calendar month, without demand, deduction or offset of any kind, at the address Landlord designates in writing from time to time during the term.",
    );
    expectOffsetsConsistent(doc);
  });

  it("mends cross-references and caps sentences that wrap onto a marker-like line", () => {
    const raw = [
      "18. RULES. Tenant shall comply with the Community Rules that are attached to this Lease as",
      "Addendum A. Landlord may amend the Community Rules at any time by posting a notice on the door",
      "of the building, and the amendment binds Tenant as if it were written into this Lease itself.",
      "19. JURY. EACH PARTY KNOWINGLY AND VOLUNTARILY WAIVES ANY AND ALL RIGHTS TO A TRIAL",
      "BY JURY.",
      "20. NOTICES. Notices must be in writing and delivered by hand or by mail to the people who are:",
      "(a) named in the signature block at the end of this Lease, including any agent of Landlord; and",
      "(b) listed in any later written notice that changes an address for receiving notices.",
      "ADDENDUM A: COMMUNITY RULES",
      "1. Quiet hours are from 10:00 p.m. to 7:00 a.m. daily.",
    ].join("\n");
    const doc = normalizeText(raw);
    expect(parseClauses(doc).flat.map((c) => c.citation)).toEqual(["§18", "§19", "§20", "§20(a)", "§20(b)", "Add. A", "Add. A(1)"]);
    expect(byCitation(doc, "§19").text).toBe("EACH PARTY KNOWINGLY AND VOLUNTARILY WAIVES ANY AND ALL RIGHTS TO A TRIAL BY JURY.");
  });

  it("falls back to paragraphs when there is no structure", () => {
    const doc = "Dear tenant,\n\nYour rent goes up next month.\n\nPlease call us with questions.";
    const tree = parseClauses(doc);
    expect(tree.flat.map((c) => c.citation)).toEqual(["¶1", "¶2", "¶3"]);
    expect(tree.flat[1].text).toBe("Your rent goes up next month.");
  });

  it("ignores page numbers and running headers", () => {
    const raw = ["1. Rent. Pay it.", "Page 1 of 3", "Lease - Initials ____", "2. Deposit. Pay it.", "Lease - Initials ____", "2", "3. Pets. None.", "Lease - Initials ____"].join("\n");
    const doc = normalizeText(raw);
    expect(doc).not.toMatch(/Page 1|Initials/);
    expect(parseClauses(doc).flat.map((c) => c.citation)).toEqual(["§1", "§2", "§3"]);
  });

  it("handles CRLF, tabs and non-breaking spaces", () => {
    const doc = normalizeText("1.\tRENT. Tenant pays.\r\n2.\tDEPOSIT. Tenant pays.\r\n");
    expect(shape(doc)).toEqual(["§1|Rent", "§2|Deposit"]);
  });
});
