import { hasLLM } from "../../lib/llm";
import { sseResponse } from "../../lib/sse";
import { liveRewrites } from "../../lib/doculaw/live";
import { demoRewrite } from "../../lib/doculaw/simplify";
import { firstIssue, SimplifyBody } from "../../lib/doculaw/schemas";

/* POST { level, clauses, roles, sampleId?, docNoun } → SSE rewrite × n, progress, done.
   Used when the dial asks for a level that live mode hasn't written yet. */


export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ error: "Send JSON like { level, clauses, roles }." }, { status: 400 });
  }
  const parsed = SimplifyBody.safeParse(json);
  if (!parsed.success) return Response.json({ error: firstIssue(parsed.error) }, { status: 400 });
  const { level, clauses, roles, docNoun } = parsed.data;
  const sampleId = parsed.data.sampleId ?? null;

  return sseResponse(req, async (send, signal) => {
    const done = new Set<string>();
    const total = clauses.length;
    if (hasLLM()) {
      const inputs = clauses.filter((c) => c.text.trim() && !(sampleId && demoRewrite(sampleId, c, level, roles, docNoun).source === "fixture"));
      try {
        for await (const batch of liveRewrites(inputs, level, signal)) {
          for (const r of batch) {
            send("rewrite", { clauseId: r.id, level, text: r.text, source: "model" });
            done.add(r.id);
          }
          send("progress", { done: done.size, total });
        }
      } catch {
        if (signal.aborted) return;
        send("notice", { message: "The model didn't answer, so these use the rule-based rewrite." });
      }
    }
    for (const c of clauses) {
      if (done.has(c.id)) continue;
      const r = demoRewrite(sampleId, c, level, roles, docNoun);
      send("rewrite", { clauseId: c.id, level, text: r.text, source: r.source });
      done.add(c.id);
    }
    send("progress", { done: total, total });
  });
}
