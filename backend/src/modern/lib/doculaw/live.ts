/* ─────────────────────────────────────────────────────────
 * LIVE (server only) — the Groq path. Used only when a
 * GROQ_API_KEY exists; every caller has a demo fallback.
 * ───────────────────────────────────────────────────────── */

import { completeJSON, stream } from "../llm";
import type { Level } from "./types";
import { simplifySystemPrompt, simplifyUserPrompt } from "./simplify";
import { chatSystemPrompt, chatUserPrompt, selectionPrompt, type SelectionAction } from "./answer";

export type RewriteInput = { id: string; citation: string; title: string; text: string };

/** Rewrites clauses in batches; yields each finished batch. Throws per batch so callers can fall back. */
export async function* liveRewrites(clauses: RewriteInput[], level: Level, signal: AbortSignal, batchSize = 8): AsyncGenerator<{ id: string; text: string }[]> {
  for (let i = 0; i < clauses.length; i += batchSize) {
    if (signal.aborted) return;
    const batch = clauses.slice(i, i + batchSize);
    const res = await completeJSON<{ rewrites?: { id?: string; text?: string }[] }>({
      model: level === "lawyer" ? "fast" : "deep",
      temperature: 0.2,
      maxTokens: 2400,
      signal,
      messages: [
        { role: "system", content: simplifySystemPrompt(level) },
        { role: "user", content: simplifyUserPrompt(batch) },
      ],
    });
    const ids = new Set(batch.map((c) => c.id));
    yield (res.rewrites ?? [])
      .filter((r): r is { id: string; text: string } => typeof r.id === "string" && typeof r.text === "string" && ids.has(r.id))
      .map((r) => ({ id: r.id, text: r.text.replace(/\s*—\s*/g, ", ").trim() }));
  }
}

export function liveChat(
  question: string,
  chunks: { citation: string; title: string; text: string }[],
  perspective: string,
  docNoun: string,
  history: { role: "user" | "assistant"; content: string }[],
  signal: AbortSignal,
): AsyncGenerator<string> {
  return stream({
    model: "deep",
    temperature: 0.2,
    maxTokens: 500,
    signal,
    messages: [
      { role: "system", content: chatSystemPrompt(perspective, docNoun) },
      ...history.slice(-4),
      { role: "user", content: chatUserPrompt(question, chunks) },
    ],
  });
}

export function liveSelection(
  action: SelectionAction,
  selection: string,
  clause: { citation: string; title: string; text: string },
  perspective: string,
  question: string,
  signal: AbortSignal,
): AsyncGenerator<string> {
  const user = [
    `Clause ${clause.citation}${clause.title ? ` (${clause.title})` : ""}:\n${clause.text}`,
    `Selected passage:\n"${selection}"`,
    action === "ask" ? `Question: ${question}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  return stream({
    model: "fast",
    temperature: 0.2,
    maxTokens: 300,
    signal,
    messages: [
      { role: "system", content: selectionPrompt(action, perspective) },
      { role: "user", content: user },
    ],
  });
}
