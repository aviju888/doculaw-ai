import { extractFromBytes, extractFromPaste, MAX_BYTES, ParseError } from "../../lib/doculaw/parse";
import { isSampleId, readSample, SAMPLES } from "../../lib/doculaw/samples";
import { normalizeText } from "../../lib/doculaw/normalize";
import { parseClauses } from "../../lib/doculaw/clauses";
import { detectRoles } from "../../lib/doculaw/parties";
import type { DocMeta } from "../../lib/doculaw/types";

/* POST multipart { file } | JSON { text, name? } | JSON { sample } → { doc, text, roles, title, clauseCount } */


function respond(text: string, doc: DocMeta) {
  const tree = parseClauses(text);
  return Response.json({ doc, text, roles: detectRoles(text), title: tree.title, clauseCount: tree.flat.length });
}

const fail = (error: string, status: number) => Response.json({ error }, { status });

export async function POST(req: Request) {
  const type = req.headers.get("content-type") ?? "";
  try {
    if (type.includes("multipart/form-data")) {
      const len = Number(req.headers.get("content-length") ?? 0);
      if (len > MAX_BYTES + 256 * 1024) return fail("That file is over 5 MB. Try a smaller file or paste the text.", 413);
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return fail('Attach the document in a "file" field.', 400);
      if (file.size > MAX_BYTES) return fail("That file is over 5 MB. Try a smaller file or paste the text.", 413);
      const bytes = new Uint8Array(await file.arrayBuffer());
      const ex = await extractFromBytes(bytes, file.name);
      return respond(ex.text, { name: file.name || "Untitled", kind: ex.kind, bytes: file.size, pages: ex.pages, chars: ex.chars, sampleId: null });
    }

    let body: { text?: unknown; name?: unknown; sample?: unknown };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return fail("Send a file (multipart), or JSON with text or sample.", 400);
    }
    if (body.sample !== undefined) {
      if (!isSampleId(body.sample)) return fail("Unknown sample.", 404);
      const raw = await readSample(body.sample);
      const text = normalizeText(raw);
      return respond(text, { name: SAMPLES[body.sample].name, kind: "sample", bytes: Buffer.byteLength(raw), pages: null, chars: text.length, sampleId: body.sample });
    }
    if (typeof body.text === "string") {
      if (body.text.length > 400_000) return fail("That text is too long for this demo.", 413);
      const ex = extractFromPaste(body.text);
      const name = typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 120) : "Pasted text";
      return respond(ex.text, { name, kind: "paste", bytes: Buffer.byteLength(body.text), pages: null, chars: ex.chars, sampleId: null });
    }
    return fail("Send a file (multipart), or JSON with text or sample.", 400);
  } catch (err) {
    if (err instanceof ParseError) return fail(err.message, err.status);
    return fail("Something went wrong reading that document.", 500);
  }
}
