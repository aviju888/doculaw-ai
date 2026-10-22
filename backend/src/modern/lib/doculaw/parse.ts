/* ─────────────────────────────────────────────────────────
 * PARSE (server only) — bytes in, canonical text out.
 *
 *   PDF   unpdf extractText, pages joined so reflow can mend
 *         sentences that run across a page break
 *   DOCX  mammoth.extractRawText
 *   TXT / MD / pasted text  decoded as UTF-8
 *
 * Types are sniffed from the bytes, not trusted from the name.
 * ───────────────────────────────────────────────────────── */

import type { DocKind } from "./types";
import { normalizeText } from "./normalize";

export const MAX_BYTES = 5 * 1024 * 1024;
export const MAX_CHARS = 400_000;

export class ParseError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export type Extracted = { text: string; kind: DocKind; pages: number | null; chars: number };

const startsWith = (bytes: Uint8Array, sig: number[]) => sig.every((b, i) => bytes[i] === b);

export function sniffKind(bytes: Uint8Array, name: string): DocKind | "doc" | null {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) return "pdf"; // %PDF
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return "docx"; // zip container; mammoth rejects non-docx zips
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0])) return "doc"; // legacy OLE .doc
  if (ext === "md" || ext === "markdown") return "md";
  if (ext === "txt" || ext === "text" || ext === "") return "txt";
  // unknown extension: accept if it decodes as text
  return looksLikeText(bytes) ? "txt" : null;
}

function looksLikeText(bytes: Uint8Array): boolean {
  const sample = bytes.subarray(0, 4096);
  let bad = 0;
  for (const b of sample) if (b === 0 || (b < 9 && b !== 0)) bad++;
  return sample.length > 0 && bad / sample.length < 0.01;
}

async function pdfText(bytes: Uint8Array): Promise<{ text: string; pages: number }> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { totalPages, text } = await extractText(pdf, { mergePages: false });
  return { text: text.join("\n"), pages: totalPages };
}

async function docxText(bytes: Uint8Array): Promise<string> {
  const mammoth = (await import("mammoth")).default;
  const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  return value;
}

export async function extractFromBytes(bytes: Uint8Array, name: string, maxBytes = MAX_BYTES): Promise<Extracted> {
  if (bytes.byteLength === 0) throw new ParseError("That file is empty.", 400);
  if (bytes.byteLength > maxBytes) throw new ParseError("That file is over 5 MB. Try a smaller file or paste the text.", 413);
  const kind = sniffKind(bytes, name);
  if (kind === "doc") throw new ParseError("Old .doc files aren't supported. Save it as .docx or PDF and try again.", 415);
  if (!kind) throw new ParseError("Unsupported file type. Use PDF, DOCX, TXT or MD.", 415);

  let raw: string;
  let pages: number | null = null;
  try {
    if (kind === "pdf") {
      const r = await pdfText(bytes);
      raw = r.text;
      pages = r.pages;
    } else if (kind === "docx") {
      raw = await docxText(bytes);
    } else {
      if (!looksLikeText(bytes)) throw new ParseError("That doesn't look like a text file.", 415);
      raw = new TextDecoder("utf-8").decode(bytes);
    }
  } catch (err) {
    if (err instanceof ParseError) throw err;
    throw new ParseError(`Couldn't read that ${kind.toUpperCase()}. It may be damaged or password-protected.`, 422);
  }
  return finish(raw, kind, pages);
}

export function extractFromPaste(text: string): Extracted {
  return finish(text, "paste", null);
}

function finish(raw: string, kind: DocKind, pages: number | null): Extracted {
  const text = normalizeText(raw);
  if (text.replace(/\s/g, "").length < 20) {
    throw new ParseError(
      kind === "pdf" ? "This PDF has no text layer. It may be a scan; try a text-based PDF or paste the text." : "There isn't enough text to read.",
      422,
    );
  }
  if (text.length > MAX_CHARS) throw new ParseError("That document is too long for this demo (over 400,000 characters).", 413);
  return { text, kind, pages, chars: text.length };
}
