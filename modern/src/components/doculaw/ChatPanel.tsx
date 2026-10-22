"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Check, Copy, Info, TextAlignLeft } from "@phosphor-icons/react";
import { postSSE } from "@/lib/sse-client";
import { ScrollFade } from "@/components/craft/ScrollFade";
import type { ChatClause, Chunk } from "@/lib/doculaw/answer";
import type { Roles } from "@/lib/doculaw/types";
import { CitationChip, RichText } from "./Cite";

/* ─────────────────────────────────────────────────────────
 * CHAT — Chat Composer (Beautiful UI) forked into a real thread:
 * each question retrieves clauses (BM25), shows them as Context
 * Cards with their § numbers, then streams a cited answer.
 * Footer keeps the original's promise: not legal advice.
 * ───────────────────────────────────────────────────────── */

type Msg = { id: number; question: string; chunks: Chunk[] | null; answer: string; status: "retrieving" | "streaming" | "done" | "error"; error?: string; notice?: string };

function suggestionsFor(docNoun: string, perspective: string, roles: Roles): string[] {
  const lease = docNoun === "lease" || roles.parties.includes("Tenant");
  if (lease && perspective === "Landlord") return ["What can I charge if rent is late?", "When can I enter the unit?", "What if the tenant stays past the end?", "When do I return the deposit?"];
  if (lease) return ["Can my landlord enter without notice?", "What happens if I pay rent late?", "Can I leave before the lease ends?", "How do I get my deposit back?"];
  return [`What do I have to pay?`, `How do I end this ${docNoun}?`, "What happens if there's a dispute?", "What can the other side change later?"];
}

function ClauseCards({ chunks }: { chunks: Chunk[] }) {
  const shown = chunks.slice(0, 3);
  return (
    <div className="flex w-full flex-col gap-1.5">
      <div className="flex items-center gap-2 px-0.5" style={{ animation: "fade-in 300ms ease-out both" }}>
        <span className="text-[12px] font-semibold text-ink">Retrieved clauses</span>
        <span className="num inline-flex h-5 items-center rounded-md bg-inset px-1.5 text-[11px] font-medium text-ink-2 shadow-hairline">{chunks.length}</span>
      </div>
      {shown.map((c, i) => (
        <div key={c.clauseId} className="overflow-hidden rounded-card bg-surface shadow-card" style={{ animation: `fade-up 380ms cubic-bezier(0.23,1,0.32,1) ${i * 70}ms both` }}>
          <div className="flex items-center gap-2 border-b border-line px-2.5 py-1.5">
            <TextAlignLeft size={11} weight="bold" className="shrink-0 text-ink-2" />
            <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-ink">{c.title || "Untitled clause"}</span>
            <span className="flex shrink-0 items-center gap-1.5" title={`Match score ${c.score.toFixed(2)}`}>
              <span className="h-1 w-8 overflow-hidden rounded-full bg-field">
                <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.max(8, c.score * 100)}%` }} />
              </span>
              <span className="num text-[11px] text-ink-3">{c.score.toFixed(2)}</span>
            </span>
          </div>
          <p className="line-clamp-2 px-2.5 pt-1.5 text-[12px] leading-relaxed text-ink-2">{c.text}</p>
          <div className="px-2.5 pt-1 pb-2">
            <CitationChip citation={c.number} clauseId={c.clauseId} pop />
          </div>
        </div>
      ))}
      {chunks.length > shown.length ? <span className="px-0.5 text-[11.5px] text-ink-3">+{chunks.length - shown.length} weaker {chunks.length - shown.length === 1 ? "match" : "matches"}</span> : null}
    </div>
  );
}

function Answer({ m }: { m: Msg }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-2.5">
      {m.chunks === null ? (
        <span className="flex items-center gap-2 text-[12.5px] text-ink-3">
          <span className="size-3 rounded-full border-[1.5px] border-line-strong border-t-ink-2" style={{ animation: "spin 700ms linear infinite" }} />
          Searching the clauses…
        </span>
      ) : m.chunks.length ? (
        <ClauseCards chunks={m.chunks} />
      ) : null}
      {m.notice ? <p className="text-[11.5px] text-ink-3">{m.notice}</p> : null}
      {m.status === "error" ? (
        <p className="text-[13px] text-red">{m.error}</p>
      ) : m.answer ? (
        <div className="text-[13px] leading-relaxed text-ink">
          <RichText text={m.answer} pop streaming={m.status === "streaming"} />
        </div>
      ) : null}
      {m.status === "done" && m.answer ? (
        <div className="-mt-1 flex items-center gap-0.5" style={{ animation: "fade-in 300ms ease-out both" }}>
          <button
            type="button"
            aria-label="Copy answer"
            onClick={() =>
              void navigator.clipboard?.writeText(m.answer).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1400);
              })
            }
            className="flex size-6 items-center justify-center rounded-[6px] text-ink-3 transition-colors duration-100 hover:bg-hover-2 hover:text-ink-2"
          >
            {copied ? <Check size={14} weight="bold" /> : <Copy size={14} weight="bold" />}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function ChatPanel({
  clauses,
  roles,
  perspective,
  docNoun,
  seed,
  onSeedUsed,
}: {
  clauses: ChatClause[];
  roles: Roles;
  perspective: string;
  docNoun: string;
  /** a question handed over from elsewhere (e.g. the selection bar) */
  seed?: string | null;
  onSeedUsed?: () => void;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);
  const seq = useRef(0);
  const busy = msgs.some((m) => m.status === "retrieving" || m.status === "streaming");

  useEffect(() => () => abort.current?.abort(), []);

  // a new question scrolls to the top of the thread; its answer streams in below it
  const lastId = msgs[msgs.length - 1]?.id;
  useEffect(() => {
    const el = inner.current?.parentElement;
    const q = lastId ? inner.current?.querySelector<HTMLElement>(`[data-msg="${lastId}"]`) : null;
    if (!el || !q) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ top: q.offsetTop - 8, behavior: reduce ? "auto" : "smooth" });
  }, [lastId]);

  const patch = (id: number, p: Partial<Msg> | ((m: Msg) => Partial<Msg>)) =>
    setMsgs((all) => all.map((m) => (m.id === id ? { ...m, ...(typeof p === "function" ? p(m) : p) } : m)));

  const send = async (raw: string) => {
    const question = raw.trim();
    if (question.length < 2 || busy) return;
    const id = ++seq.current;
    const history = msgs
      .filter((m) => m.status === "done")
      .slice(-3)
      .flatMap((m) => [
        { role: "user" as const, content: m.question },
        { role: "assistant" as const, content: m.answer },
      ]);
    setMsgs((all) => [...all, { id, question, chunks: null, answer: "", status: "retrieving" }]);
    setDraft("");
    const ctrl = new AbortController();
    abort.current = ctrl;
    try {
      await postSSE(
        "/api/doculaw/chat",
        { question, clauses, perspective, roles, docNoun, history },
        (event, data) => {
          if (event === "context") patch(id, { chunks: (data as { chunks: Chunk[] }).chunks, status: "streaming" });
          else if (event === "answer") patch(id, (m) => ({ answer: m.answer + (data as { delta: string }).delta }));
          else if (event === "notice") patch(id, { notice: (data as { message: string }).message });
          else if (event === "error") patch(id, { status: "error", error: (data as { message?: string }).message ?? "Something went wrong." });
        },
        ctrl.signal,
      );
      patch(id, (m) => (m.status === "error" ? {} : { status: "done" }));
    } catch (err) {
      if (ctrl.signal.aborted) return;
      patch(id, { status: "error", error: err instanceof Error ? err.message : "Something went wrong." });
    }
  };

  // questions handed over from other parts of the app
  useEffect(() => {
    if (seed && !busy) {
      void send(seed);
      onSeedUsed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  const suggestions = suggestionsFor(docNoun, perspective, roles);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ScrollFade className="dl-scroll min-h-0 flex-1 px-3 pt-3 pb-2">
        <div ref={inner}>
        {msgs.length === 0 ? (
          <div className="flex flex-col gap-3 pt-1" style={{ animation: "fade-up 360ms cubic-bezier(0.23,1,0.32,1) both" }}>
            <div>
              <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-ink">Ask about this {docNoun}</h2>
              <p className="mt-0.5 text-[12.5px] text-pretty text-ink-3">Answers come only from its clauses, each one linked with its § number.</p>
            </div>
            <div className="flex flex-col">
              {suggestions.map((s, i) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void send(s)}
                  className="-mx-1.5 flex items-center gap-2 rounded-[7px] border-b border-line px-1.5 py-2 text-left text-[12.5px] text-ink transition-colors duration-0 last:border-0 hover:bg-hover-2"
                  style={{ animation: `fade-up 350ms cubic-bezier(0.23,1,0.32,1) ${80 + i * 60}ms both` }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
                    <path d="M9 10l-5 5 5 5" />
                    <path d="M20 4v7a4 4 0 0 1-4 4H4" />
                  </svg>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {msgs.map((m) => (
              <div key={m.id} data-msg={m.id} className="flex flex-col gap-2.5">
                <div className="flex justify-end pl-10">
                  <div className="rounded-xl bg-field px-3 py-1.5 text-[13px] leading-[1.4] text-ink" style={{ animation: "fade-up 300ms cubic-bezier(0.23,1,0.32,1) both" }}>
                    {m.question}
                  </div>
                </div>
                <Answer m={m} />
              </div>
            ))}
          </div>
        )}
        </div>
      </ScrollFade>

      <div className="shrink-0 px-1.5 pb-1.5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(draft);
          }}
          onClick={() => input.current?.focus()}
          className="flex cursor-text items-center gap-2 rounded-control border border-line bg-field py-1.5 pr-1.5 pl-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.035)] transition-[border-color,box-shadow] duration-150 focus-within:border-line-strong"
        >
          <input
            ref={input}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Ask about this ${docNoun}`}
            aria-label="Ask a question"
            maxLength={600}
            className="min-w-0 flex-1 bg-transparent text-[13px] leading-[1.4] text-ink outline-none placeholder:text-ink-3"
          />
          <button
            type="submit"
            aria-label="Send"
            disabled={draft.trim().length < 2 || busy}
            className="flex size-7 shrink-0 items-center justify-center rounded-[8px] transition-[background-color,color,transform] duration-200 enabled:active:scale-[0.96]"
            style={{ background: draft.trim().length >= 2 && !busy ? "var(--ink)" : "var(--line-strong)", color: draft.trim().length >= 2 && !busy ? "var(--surface)" : "var(--ink-2)" }}
          >
            <ArrowUp size={15} weight="bold" />
          </button>
        </form>
        <p className="flex items-center justify-center gap-1 pt-1.5 text-[11px] text-ink-3">
          <Info size={11} weight="bold" />
          Not legal advice.
        </p>
      </div>
    </div>
  );
}
