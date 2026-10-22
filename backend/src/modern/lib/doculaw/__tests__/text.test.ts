import { describe, expect, it } from "vitest";
import {
  collapseNumerals,
  formatMoney,
  intToRoman,
  letterToInt,
  parseMoney,
  readingGrade,
  romanToInt,
  sentenceCase,
  splitSentences,
  stem,
  syllables,
  tokenize,
  truncateWords,
  wordsToNumber,
} from "../text";
import { cleanText, isHardWrapped, normalizeText, reflow } from "../normalize";

describe("numbers", () => {
  it("parses and validates roman numerals", () => {
    expect(romanToInt("iv")).toBe(4);
    expect(romanToInt("XIV")).toBe(14);
    expect(romanToInt("mcmxcix")).toBe(1999);
    expect(romanToInt("iiii")).toBeNull();
    expect(romanToInt("vv")).toBeNull();
    expect(romanToInt("il")).toBeNull();
    expect(intToRoman(2026)).toBe("mmxxvi");
  });

  it("maps letters including doubled ones", () => {
    expect(letterToInt("a")).toBe(1);
    expect(letterToInt("Z")).toBe(26);
    expect(letterToInt("aa")).toBe(27);
    expect(letterToInt("ab")).toBeNull();
  });

  it("reads number words", () => {
    expect(wordsToNumber("Two Thousand Seven Hundred Seventy-Five")).toBe(2775);
    expect(wordsToNumber("One Thousand Eight Hundred Fifty Dollars")).toBe(1850);
    expect(wordsToNumber("sixty")).toBe(60);
    expect(wordsToNumber("twenty-first")).toBe(21);
    expect(wordsToNumber("rent")).toBeNull();
  });

  it("parses and formats money", () => {
    expect(parseMoney("$1,850.00")).toBe(1850);
    expect(parseMoney("$3.95")).toBe(3.95);
    expect(formatMoney(1850)).toBe("$1,850");
    expect(formatMoney(3.95)).toBe("$3.95");
    expect(formatMoney(100000)).toBe("$100,000");
  });

  it("collapses numbers written twice", () => {
    expect(collapseNumerals("within thirty (30) days")).toBe("within 30 days");
    expect(collapseNumerals("a late charge of Seventy-Five Dollars ($75.00); and")).toBe("a late charge of $75.00; and");
    expect(collapseNumerals("the sum of Two Thousand Seven Hundred Seventy-Five Dollars ($2,775.00)")).toBe("the sum of $2,775.00");
    expect(collapseNumerals("on the first (1st) day")).toBe("on the 1st day");
    expect(collapseNumerals("eight percent (8%) of the Rent")).toBe("8% of the Rent");
    expect(collapseNumerals("rent and thirty (30) days")).toBe("rent and 30 days");
    expect(collapseNumerals("see Section (2) and Space (12)")).toBe("see Section (2) and Space (12)");
  });
});

describe("sentences", () => {
  it("does not split on p.m., No., decimals or initials", () => {
    const t = "Rent is due by 11:59 p.m. on the 5th. Space No. 12 costs $1,850.00 a month. Signed by J. Smith. Done.";
    expect(splitSentences(t).map((s) => s.text)).toEqual([
      "Rent is due by 11:59 p.m. on the 5th.",
      "Space No. 12 costs $1,850.00 a month.",
      "Signed by J. Smith.",
      "Done.",
    ]);
  });

  it("splits after a lettered name like Addendum A.", () => {
    const t = "Tenant shall comply with the rules attached as Addendum A. Landlord may amend them.";
    expect(splitSentences(t)).toHaveLength(2);
  });

  it("returns absolute offsets", () => {
    const base = 100;
    const t = "One. Two two.";
    const spans = splitSentences(t, base);
    for (const s of spans) expect(t.slice(s.start - base, s.end - base)).toBe(s.text);
  });
});

describe("casing and tokens", () => {
  it("sentence-cases titles but keeps acronyms", () => {
    expect(sentenceCase("LATE CHARGES")).toBe("Late charges");
    expect(sentenceCase("Governing Law and Venue")).toBe("Governing law and venue");
    expect(sentenceCase("HOA RULES")).toBe("HOA rules");
  });

  it("stems related words to the same token", () => {
    expect(stem("leasing")).toBe(stem("lease"));
    expect(stem("notices")).toBe(stem("notice"));
    expect(stem("terminate")).toBe(stem("termination"));
    expect(stem("payment")).toBe(stem("pay"));
    expect(stem("renewal")).toBe(stem("renew"));
  });

  it("drops stop words but keeps negations", () => {
    expect(tokenize("Can my landlord enter without notice?")).toEqual(["landlord", "enter", "without", "notic"]);
  });

  it("truncates at a word boundary", () => {
    expect(truncateWords("one two three four five", 12)).toBe("one two…");
    expect(truncateWords("short", 12)).toBe("short");
  });
});

describe("normalize", () => {
  it("fixes ligatures, bullets and spacing", () => {
    expect(cleanText("The ﬁrst  day of\tthe\r\nterm")).toBe("The first day of the\nterm");
    expect(cleanText("● one\n▪ two")).toBe("• one\n• two");
  });

  it("drops TOC dot leaders and page numbers", () => {
    expect(cleanText("1. Rent .......... 3\nBody\n- 2 -\nPage 2 of 9")).toBe("Body");
  });

  it("detects hard wrapping only when lines wrap mid-sentence", () => {
    const wrapped = [
      "1. RENT. Tenant shall pay rent of $1,850.00 per month, in advance, on or before",
      "the first day of each calendar month without demand or offset of any kind at all.",
      "2. DEPOSIT. Tenant shall pay a security deposit of $2,775.00 upon execution of the",
      "lease, which Landlord shall return within twenty-one days after Tenant moves out.",
    ].join("\n");
    expect(isHardWrapped(wrapped)).toBe(true);
    expect(reflow(wrapped).split("\n")).toHaveLength(2);
    const unwrapped = "1. RENT. Tenant pays.\n\n2. DEPOSIT. Tenant pays.\n\n3. PETS. None.\n\n4. END. Done.";
    expect(isHardWrapped(unwrapped)).toBe(false);
    expect(reflow(unwrapped)).toBe(unwrapped);
  });

  it("never joins across markers, bullets or form lines", () => {
    const t = [
      "Tenant shall keep the premises clean and sanitary and shall promptly report any leak or",
      "malfunction to Landlord in writing, and Tenant shall also replace the batteries as",
      "needed:",
      "• smoke detectors",
      "(a) the kitchen and the bathrooms, including all fixtures, appliances and cabinets in",
      "them;",
      "By: ____________",
    ].join("\n");
    const out = reflow(t).split("\n");
    expect(out[0]).toMatch(/^Tenant shall keep .* needed:$/);
    expect(out).toContain("• smoke detectors");
    expect(out).toContain("By: ____________");
    expect(out.find((l) => l.startsWith("(a)"))).toBe("(a) the kitchen and the bathrooms, including all fixtures, appliances and cabinets in them;");
  });

  it("keeps hyphenated words whole across a wrap", () => {
    const t = [
      "1. FEES. Tenant shall pay a non-",
      "refundable cleaning fee of $250 at signing, which is due before keys are released to the",
      "tenant, together with first month rent and the deposit described in section two below.",
      "2. OTHER. Something else that is long enough to look like a wrapped line in the document.",
    ].join("\n");
    expect(normalizeText(t)).toContain("non-refundable cleaning fee");
  });
});


describe("readability", () => {
  it("counts syllables roughly", () => {
    expect(syllables("cat")).toBe(1);
    expect(syllables("tenant")).toBe(2);
    expect(syllables("indemnification")).toBeGreaterThanOrEqual(5);
  });

  it("grades dense legal text above plain text above ELI5", () => {
    const legal =
      "Tenant shall indemnify, defend, and hold harmless Landlord and its members, managers, agents, and employees from and against any and all claims, losses, damages, and expenses, including reasonable attorneys' fees, arising out of or related to the use of the Premises.";
    const plain = "If anyone makes a claim tied to how the tenant uses the place, the tenant pays the landlord's costs, including lawyers.";
    const eli5 = "If someone gets hurt, the renter pays. Even the lawyer bills.";
    const g = [legal, plain, eli5].map((t) => readingGrade(t) ?? 0);
    expect(g[0]).toBeGreaterThan(g[1]);
    expect(g[1]).toBeGreaterThan(g[2]);
    expect(readingGrade("Too short.")).toBeNull();
  });
});
