import { hasLLM } from "../../lib/llm";
import { sseResponse } from "../../lib/sse";
import { sleep } from "../../lib/scripted";
import { analyze } from "../../lib/doculaw/analyze";
import { liveRewrites } from "../../lib/doculaw/live";
import { demoRewrite } from "../../lib/doculaw/simplify";
import { AnalyzeBody, firstIssue } from "../../lib/doculaw/schemas";
import { LEVELS } from "../../lib/doculaw/types";

/*
 * POST { text, sampleId? } → SSE
 *   task(structure) → structure → task(risks) → risks, obligations, keyDates
 *   → task(rewrite) → rewrite × n (+ progress) → task done → done
 * Demo: every level from fixtures (sample) or rules (uploads), lightly paced
 * so the task rows read as work. Live: "plain" from Groq, rules as fallback.
 */


export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ error: "Send JSON like { text }." }, { status: 400 });
  }
  const parsed = AnalyzeBody.safeParse(json);
  if (!parsed.success) return Response.json({ error: firstIssue(parsed.error) }, { status: 400 });
  const { text } = parsed.data;
  const sampleId = parsed.data.sampleId ?? null;

  return sseResponse(req, async (send, signal) => {
    const live = hasLLM();
    const pace = (ms: number) => (live ? Promise.resolve() : sleep(ms, signal));

    send("task", { id: "structure", status: "running" });
    await pace(650);
    const a = analyze(text);
    send("structure", { title: a.title, docNoun: a.docNoun, clauses: a.clauses, numbering: a.numbering, depth: a.depth, roles: a.roles });
    send("task", { id: "structure", status: "done", count: a.clauses.length, numbering: a.numbering, depth: a.depth });

    send("task", { id: "risks", status: "running" });
    await pace(550);
    send("risks", { flags: a.risks });
    send("obligations", { items: a.obligations });
    send("keyDates", { items: a.keyDates });
    const sev = (s: string) => a.risks.filter((r) => r.severity === s).length;
    send("task", { id: "risks", status: "done", count: a.risks.length, high: sev("high"), medium: sev("medium"), low: sev("low") });

    const total = a.clauses.length;
    send("task", { id: "rewrite", status: "running", done: 0, total });
    const written = new Set<string>();

    if (live) {
      // headings with no body have nothing to rewrite
      for (const c of a.clauses) if (!c.text.trim()) written.add(c.id);
      const inputs = a.clauses.filter((c) => c.text.trim()).map((c) => ({ id: c.id, citation: c.citation, title: c.title, text: c.text }));
      try {
        for await (const batch of liveRewrites(inputs, "plain", signal)) {
          for (const r of batch) {
            send("rewrite", { clauseId: r.id, level: "plain", text: r.text, source: "model" });
            written.add(r.id);
          }
          send("progress", { done: written.size, total });
        }
      } catch {
        if (signal.aborted) return;
        send("notice", { message: "The model didn't answer, so the remaining clauses use the rule-based rewrite." });
      }
      for (const c of a.clauses) {
        if (written.has(c.id) && c.text.trim()) continue;
        const r = demoRewrite(sampleId, c, "plain", a.roles, a.docNoun);
        send("rewrite", { clauseId: c.id, level: "plain", text: r.text, source: r.source });
      }
    } else {
      for (const c of a.clauses) {
        for (const level of LEVELS) {
          const r = demoRewrite(sampleId, c, level, a.roles, a.docNoun);
          send("rewrite", { clauseId: c.id, level, text: r.text, source: r.source });
        }
        written.add(c.id);
        send("progress", { done: written.size, total });
        await pace(Math.max(12, Math.min(45, 1800 / total)));
      }
    }
    send("task", { id: "rewrite", status: "done", done: total, total });
  });
}
