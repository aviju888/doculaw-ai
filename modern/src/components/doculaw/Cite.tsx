"use client";

import { createContext, useContext, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/* Jump-to-clause is shared by the ledger, chat, compare, minimap and the plain column. */

type JumpApi = { jump: (clauseId: string) => void; idFor: (citation: string) => string | null };

export const JumpContext = createContext<JumpApi>({ jump: () => {}, idFor: () => null });

export const useJump = () => useContext(JumpContext);

/** "§13(b)" as a small chip that scrolls to the clause. */
export function CitationChip({ citation, clauseId, className, pop }: { citation: string; clauseId?: string | null; className?: string; pop?: boolean }) {
  const { jump, idFor } = useJump();
  const id = clauseId ?? idFor(citation);
  const base =
    "inline-flex h-[18px] translate-y-[-1px] items-center rounded-[5px] bg-inset px-1 align-middle font-mono text-[10.5px] leading-none whitespace-nowrap text-ink-2 shadow-hairline";
  if (!id) return <span className={cn(base, className)}>{citation}</span>;
  return (
    <button
      type="button"
      onClick={() => jump(id)}
      aria-label={`Go to ${citation}`}
      className={cn(base, "hit-area press transition-colors duration-100 hover:bg-hover hover:text-ink", className)}
      style={pop ? { animation: "pop-in 250ms cubic-bezier(0.23,1,0.32,1) both" } : undefined}
    >
      {citation}
    </button>
  );
}

const CITE_RE = /\[?(§\d+(?:\.\d+)*(?:\([A-Za-z0-9]+\))*|Add\. [A-Z](?:\(\d+\))?|Preamble|Signatures)\]?/g;

/** Text with "§19" or "[§13(b)]" turned into chips. */
export function WithCitations({ text, pop }: { text: string; pop?: boolean }) {
  const { idFor } = useJump();
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(CITE_RE)) {
    const idx = m.index ?? 0;
    const bracketed = m[0].startsWith("[");
    // bare words like "Preamble" only become chips when bracketed
    if (!bracketed && !m[1].startsWith("§")) continue;
    if (!idFor(m[1])) continue;
    if (idx > last) out.push(text.slice(last, idx));
    out.push(<CitationChip key={idx} citation={m[1]} pop={pop} className="mx-0.5" />);
    last = idx + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}

/** Paragraphs and "- " bullets, with citation chips. While streaming, the
 *  newest words sit in Streaming Text's blurred tail. */
export function RichText({ text, className, pop, streaming }: { text: string; className?: string; pop?: boolean; streaming?: boolean }) {
  let body = text;
  let tail = "";
  if (streaming) {
    // the last few words on the current line; never across a paragraph break or into a citation
    const m = text.match(/([^\s[\]]+[ \t]*){1,3}$/);
    if (m && m.index !== undefined && !/\[[^\]]*$/.test(text)) {
      body = text.slice(0, m.index);
      tail = m[0];
    }
  }
  const blocks = body.split(/\n{2,}/);
  const last = blocks.length - 1;
  const tailEl = tail ? (
    <>
      <span className="stream-tail">{tail}</span>
      <span className="dl-caret" data-streaming="true" />
    </>
  ) : streaming ? (
    <span className="dl-caret" data-streaming="true" />
  ) : null;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        const bullets = lines.filter((l) => /^\s*[-•]\s+/.test(l));
        if (bullets.length >= 1 && bullets.length >= lines.length - 1) {
          const intro = lines.find((l) => !/^\s*[-•]\s+/.test(l));
          return (
            <div key={i}>
              {intro ? (
                <p>
                  <WithCitations text={intro} pop={pop} />
                </p>
              ) : null}
              <ul className="mt-1 flex flex-col gap-1 pl-1">
                {bullets.map((b, j) => (
                  <li key={j} className="flex gap-2">
                    <span aria-hidden className="mt-[0.6em] size-1 shrink-0 rounded-full bg-ink-3" />
                    <span>
                      <WithCitations text={b.replace(/^\s*[-•]\s+/, "")} pop={pop} />
                      {i === last && j === bullets.length - 1 ? tailEl : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        }
        return (
          <p key={i} className="text-pretty whitespace-pre-line">
            <WithCitations text={block} pop={pop} />
            {i === last ? tailEl : null}
          </p>
        );
      })}
    </div>
  );
}
