import { hasLLM } from "../../lib/llm";
import { sseResponse } from "../../lib/sse";
import { scriptedStream } from "../../lib/scripted";
import { demoChatAnswer, retrieve, type ChatClause } from "../../lib/doculaw/answer";
import { liveChat } from "../../lib/doculaw/live";
import { ChatBody, firstIssue } from "../../lib/doculaw/schemas";

/*
 * POST { question, clauses, perspective, roles, docNoun, history? } → SSE
 *   context { chunks: [{ clauseId, number, title, text, score }] }
 *   answer  { delta } × n   (citations inline as [§13(b)])
 *   done
 * Retrieval is BM25 over the clauses. Live: Groq answers from the
 * retrieved clauses. Demo: a grounded answer built from their rewrites.
 */


export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ error: "Send JSON like { question, clauses }." }, { status: 400 });
  }
  const parsed = ChatBody.safeParse(json);
  if (!parsed.success) return Response.json({ error: firstIssue(parsed.error) }, { status: 400 });
  const { question, perspective, roles, docNoun, history } = parsed.data;
  const clauses = parsed.data.clauses as ChatClause[];

  return sseResponse(req, async (send, signal) => {
    const chunks = retrieve(question, clauses, 4);
    send("context", { chunks });
    const byId = new Map(clauses.map((c) => [c.id, c]));

    if (hasLLM() && chunks.length) {
      let sent = 0;
      try {
        const ctx = chunks.map((c) => ({ citation: c.number, title: c.title, text: c.text }));
        for await (const delta of liveChat(question, ctx, perspective, docNoun, history, signal)) {
          send("answer", { delta });
          sent++;
        }
        return;
      } catch (err) {
        if (signal.aborted || sent > 0) throw err;
        send("notice", { message: "The model didn't answer, so this reply is built from the clauses directly." });
      }
    }
    const text = demoChatAnswer(question, chunks, byId, roles);
    for await (const word of scriptedStream(text, { signal, wordsPerSecond: 36 })) send("answer", { delta: word });
  });
}
