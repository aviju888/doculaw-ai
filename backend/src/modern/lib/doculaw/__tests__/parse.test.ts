import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { extractFromBytes, extractFromPaste, ParseError, sniffKind } from "../parse";
import { parseClauses } from "../clauses";

/* A one-page PDF with one text line per entry (Helvetica, T* line breaks). */
function makePdf(lines: string[]): Uint8Array {
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const content = `BT /F1 10 Tf 50 750 Td 13 TL ${lines.map((l) => `(${esc(l)}) Tj T*`).join(" ")} ET`;
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}

function crc32(buf: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of buf) {
    let c = (crc ^ byte) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/* A minimal DOCX: three parts in a deflated zip. */
function makeDocx(paragraphs: string[]): Uint8Array {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const files: [string, string][] = [
    [
      "[Content_Types].xml",
      '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    ],
    [
      "_rels/.rels",
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    ],
    [
      "word/document.xml",
      `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs
        .map((p) => `<w:p><w:r><w:t xml:space="preserve">${esc(p)}</w:t></w:r></w:p>`)
        .join("")}</w:body></w:document>`,
    ],
  ];
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, text] of files) {
    const data = Buffer.from(text, "utf8");
    const comp = deflateRawSync(data);
    const nameBuf = Buffer.from(name);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comp.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    parts.push(local, nameBuf, comp);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(8, 10);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(comp.length, 20);
    c.writeUInt32LE(data.length, 24);
    c.writeUInt16LE(nameBuf.length, 28);
    c.writeUInt32LE(offset, 42);
    central.push(c, nameBuf);
    offset += 30 + nameBuf.length + comp.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...parts, cd, end]));
}

const LEASE_LINES = [
  "SHORT LEASE AGREEMENT",
  'This Lease is made between Oakhurst Rentals LLC ("Landlord") and Pia Lund ("Tenant").',
  "1. RENT. Tenant shall pay rent of $1,200.00 per month on or before the first (1st) day of",
  "each calendar month at the office of Landlord, without deduction or offset of any kind at all.",
  "(a) A late charge of $50.00 applies after the fifth (5th) day of the month; and",
  "(b) a returned check costs $25.00.",
  "2. PETS. No pets of any kind shall be kept on the Premises without written consent.",
];

describe("pdf", () => {
  it("extracts text from a real PDF and finds the clauses", async () => {
    const ex = await extractFromBytes(makePdf(LEASE_LINES), "short.pdf");
    expect(ex.kind).toBe("pdf");
    expect(ex.pages).toBe(1);
    const tree = parseClauses(ex.text);
    expect(tree.title).toBe("Short Lease Agreement");
    expect(tree.flat.map((c) => c.citation)).toEqual(["Preamble", "§1", "§1(a)", "§1(b)", "§2"]);
    expect(tree.flat[1].text).toContain("first (1st) day of each calendar month");
  });

  it("rejects a PDF with no text layer", async () => {
    await expect(extractFromBytes(makePdf([]), "scan.pdf")).rejects.toMatchObject({ status: 422 });
  });
});

describe("docx", () => {
  it("extracts paragraphs with mammoth", async () => {
    const ex = await extractFromBytes(makeDocx(LEASE_LINES), "short.docx");
    expect(ex.kind).toBe("docx");
    expect(parseClauses(ex.text).flat.map((c) => c.citation)).toEqual(["Preamble", "§1", "§1(a)", "§1(b)", "§2"]);
  });

  it("reports a damaged docx", async () => {
    const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4, 5]);
    await expect(extractFromBytes(bytes, "bad.docx")).rejects.toMatchObject({ status: 422 });
  });
});

describe("text and type checks", () => {
  it("sniffs types from bytes", () => {
    expect(sniffKind(new TextEncoder().encode("%PDF-1.7"), "x.txt")).toBe("pdf");
    expect(sniffKind(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]), "x.doc")).toBe("doc");
    expect(sniffKind(new TextEncoder().encode("# Lease"), "notes.md")).toBe("md");
    expect(sniffKind(new Uint8Array([0, 1, 2, 3, 0, 0, 7]), "x.bin")).toBeNull();
  });

  it("decodes text files and pasted text", async () => {
    const ex = await extractFromBytes(new TextEncoder().encode("1. RENT. Pay $900.\n2. PETS. None allowed here."), "lease.txt");
    expect(ex.kind).toBe("txt");
    expect(extractFromPaste("1. RENT. Pay $900.\n2. PETS. None allowed here.").kind).toBe("paste");
  });

  it("rejects empty, old and oversized files", async () => {
    await expect(extractFromBytes(new Uint8Array(), "x.txt")).rejects.toBeInstanceOf(ParseError);
    await expect(extractFromBytes(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0]), "x.doc")).rejects.toMatchObject({ status: 415 });
    await expect(extractFromBytes(new Uint8Array(5 * 1024 * 1024 + 1).fill(97), "x.txt")).rejects.toMatchObject({ status: 413 });
  });
});
