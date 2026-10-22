import { hasLLM } from "../../lib/llm";
import { sseResponse } from "../../lib/sse";
import { scriptedStream } from "../../lib/scripted";
import { demoSelection, type ChatClause } from "../../lib/doculaw/answer";
import { liveSelection } from "../../lib/doculaw/live";
import { firstIssue, SelectionBody } from "../../lib/doculaw/schemas";

/*
 * POST { action: explain|simplify|flag|ask, selection, clause, perspective, roles, question? } → SSE
 *   answer { delta } × n, flag { severity, title, why } (flag action), done
 */


export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ error: "Send JSON like { action, selection, clause }." }, { status: 400 });
  }
  const parsed = SelectionBody.safeParse(json);
  if (!parsed.success) return Response.json({ error: firstIssue(parsed.error) }, { status: 400 });
  const { action, selection, question, perspective, roles } = parsed.data;
  const clause = parsed.data.clause as ChatClause;

  return sseResponse(req, async (send, signal) => {
    const demo = demoSelection(action, selection, clause, roles, question);
    if (hasLLM()) {
      let sent = 0;
      try {
        for await (const delta of liveSelection(action, selection, clause, perspective, question, signal)) {
          send("answer", { delta });
          sent++;
        }
        if (demo.flag) send("flag", demo.flag);
        return;
      } catch (err) {
        if (signal.aborted || sent > 0) throw err;
      }
    }
    for await (const word of scriptedStream(demo.text, { signal, wordsPerSecond: 34 })) send("answer", { delta: word });
    if (demo.flag) send("flag", demo.flag);
  });
}
