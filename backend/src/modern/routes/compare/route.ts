import { isSampleId, readSample } from "../../lib/doculaw/samples";
import { normalizeText } from "../../lib/doculaw/normalize";
import { parseClauses } from "../../lib/doculaw/clauses";
import { compareClauses } from "../../lib/doculaw/compare";
import { CompareBody, firstIssue } from "../../lib/doculaw/schemas";

/* POST { a: {text}|{sample}, b: {text}|{sample} } → { summary, diffs, unchanged } */


async function resolve(doc: { text: string } | { sample: string }): Promise<string | null> {
  if ("sample" in doc) return isSampleId(doc.sample) ? normalizeText(await readSample(doc.sample)) : null;
  return normalizeText(doc.text);
}

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ error: "Send JSON like { a: { text }, b: { sample } }." }, { status: 400 });
  }
  const parsed = CompareBody.safeParse(json);
  if (!parsed.success) return Response.json({ error: firstIssue(parsed.error) }, { status: 400 });
  const [a, b] = await Promise.all([resolve(parsed.data.a), resolve(parsed.data.b)]);
  if (a === null || b === null) return Response.json({ error: "Unknown sample." }, { status: 404 });
  return Response.json(compareClauses(parseClauses(a).flat, parseClauses(b).flat));
}
