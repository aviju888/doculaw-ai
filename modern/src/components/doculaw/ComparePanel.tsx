import { apiURL } from "../../lib/http";
"use client";

import { useRef, useState } from "react";
import { ArrowRight, ArrowsLeftRight, ClipboardText, FileArrowUp, Sparkle, Warning } from "@phosphor-icons/react";
import { Button } from "@/components/atoms/Button";
import type { CodePiece } from "@/components/bui/CodeBlock";
import type { ClauseDiff, CompareResult } from "@/lib/doculaw/compare";
import { cn } from "@/lib/cn";
import { ACCEPT, parseFile, parseText, type Loaded } from "./api";
import { CitationChip } from "./Cite";
import { Spinner } from "./StartPanel";

/* ─────────────────────────────────────────────────────────
 * COMPARE — this version against another (sample v2, an upload
 * or pasted text). A summary of what moved, then one redline per
 * changed clause: Code Block's Diff view (gutter, accent bar,
 * row tint, word-level highlights) set in the reading font, with
 * removed words struck through the way legal redlines are.
 * ───────────────────────────────────────────────────────── */

const HATCH = "repeating-linear-gradient(45deg, var(--red) 0, var(--red) 1.5px, transparent 1.5px, transparent 3px)";
const STATUS: Record<ClauseDiff["status"], { label: string; cls: string }> = {
  changed: { label: "Changed", cls: "bg-orange-tint text-orange" },
  added: { label: "Added", cls: "bg-green-tint text-green" },
  removed: { label: "Removed", cls: "bg-red-tint text-red" },
};

function Pieces({ pieces }: { pieces: CodePiece[] }) {
  return (
    <>
      {pieces.map((p, i) => {
        if (!p.change) return <span key={i}>{p.text}</span>;
        const add = p.change === "add";
        return (
          <span
            key={i}
            className="rounded-[3px]"
            style={{
              background: `color-mix(in srgb, var(--${add ? "green" : "red"}) 18%, transparent)`,
              color: add ? "var(--ink)" : "var(--red)",
              padding: "0 2px",
              margin: "0 -1px",
              textDecorationLine: add ? "none" : "line-through",
              textDecorationColor: "color-mix(in srgb, var(--red) 55%, transparent)",
              boxDecorationBreak: "clone",
              WebkitBoxDecorationBreak: "clone",
            }}
          >
            {p.text}
          </span>
        );
      })}
    </>
  );
}

function RedlineBlock({ d, index }: { d: ClauseDiff; index: number }) {
  return (
    <div className="w-full overflow-hidden rounded-card bg-surface shadow-card" style={{ animation: `fade-up 400ms cubic-bezier(0.23,1,0.32,1) ${120 + index * 70}ms both` }}>
      <div className="flex min-h-11 flex-wrap items-center gap-x-2 gap-y-1 border-b border-line px-4 py-2 text-[12.5px]">
        <CitationChip citation={d.citation} clauseId={d.oldId} />
        <span className="min-w-0 truncate font-medium text-ink">{d.title || "Untitled clause"}</span>
        <span className={cn("inline-flex h-5 items-center rounded-full px-2 text-[11px] font-medium", STATUS[d.status].cls)}>{STATUS[d.status].label}</span>
        <span className="ml-auto inline-flex items-center gap-2 font-mono text-[12px] leading-none tabular-nums">
          <span className="text-green">+{d.added}</span>
          <span className="text-red">-{d.removed}</span>
        </span>
      </div>
      <div className="py-3 text-[13px] leading-[1.65] text-ink-2">
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-5 w-px bg-line" />
          {d.rows.map((r, i) => {
            const add = r.type === "add";
            return (
              <div key={i} className={cn("relative grid grid-cols-[20px_minmax(0,1fr)] items-start", add ? "bg-green-tint" : "bg-red-tint")}>
                <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: add ? "var(--green)" : HATCH }} />
                <span className={cn("pt-1.5 text-center font-mono text-[11px] select-none", add ? "text-green" : "text-red")}>{add ? "+" : "−"}</span>
                <p className="py-1.5 pr-4 pl-2 break-words whitespace-pre-wrap">
                  <Pieces pieces={r.pieces} />
                </p>
              </div>
            );
          })}
        </div>
      </div>
      {d.facts.length ? (
        <div className="flex flex-col gap-1 border-t border-line bg-inset px-4 py-2.5">
          {d.facts.map((f) => (
            <span key={f} className="num text-[12px] text-ink-2">
              {f}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

type Other = { name: string; result: CompareResult };

export function ComparePanel({ base }: { base: Loaded }) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [other, setOther] = useState<Other | null>(null);
  const [pasting, setPasting] = useState(false);
  const [draft, setDraft] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const sample = base.doc.sampleId === "lease-v1";

  const run = async (b: { sample: string } | { text: string }, name: string) => {
    setState("loading");
    setError(null);
    try {
      const a = base.doc.sampleId ? { sample: base.doc.sampleId } : { text: base.text };
      const res = await fetch(apiURL("/api/doculaw/compare"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ a, b }) });
      const data = (await res.json()) as CompareResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Couldn't compare those.");
      setOther({ name, result: data });
      setState("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't compare those.");
      setState("error");
    }
  };

  const fromLoaded = (l: Loaded) => run({ text: l.text }, l.doc.name);
  const busy = state === "loading";

  if (other) {
    const r = other.result;
    const added = r.diffs.reduce((s, d) => s + d.added, 0);
    const removed = r.diffs.reduce((s, d) => s + d.removed, 0);
    return (
      <div className="flex flex-col gap-3">
        <div className="rounded-card bg-surface shadow-card" style={{ animation: "fade-up 360ms cubic-bezier(0.23,1,0.32,1) both" }}>
          <div className="flex min-h-11 items-center gap-2 border-b border-line px-4 py-2 text-[12.5px]">
            <ArrowsLeftRight size={14} weight="bold" className="shrink-0 text-ink-3" />
            <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-ink" title={`${base.doc.name} → ${other.name}`}>
              {base.doc.name} → {other.name}
            </span>
            <span className="ml-auto inline-flex shrink-0 items-center gap-2 font-mono text-[12px] leading-none tabular-nums">
              <span className="text-green">+{added}</span>
              <span className="text-red">-{removed}</span>
            </span>
          </div>
          <div className="px-4 py-3.5">
            <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">
              {r.diffs.length === 0 ? "No clause changed" : `${r.diffs.length} ${r.diffs.length === 1 ? "clause" : "clauses"} changed`}
              <span className="num ml-2 text-[12.5px] font-normal text-ink-3">{r.unchanged} unchanged</span>
            </h3>
            {r.diffs.length ? (
              <ul className="mt-2.5 flex flex-col gap-1.5">
                {r.diffs.flatMap((d) =>
                  (d.facts.length ? d.facts : [`${d.title || d.citation} reworded`]).map((f) => (
                    <li key={`${d.key}-${f}`} className="flex items-start gap-2 text-[13px] text-ink">
                      <CitationChip citation={d.citation} clauseId={d.oldId} className="mt-[3px]" />
                      <span className="num text-pretty">{f}</span>
                    </li>
                  )),
                )}
              </ul>
            ) : null}
          </div>
          <div className="flex items-center justify-end gap-1.5 border-t border-line px-2.5 py-2">
            <Button variant="ghost" size="sm" onClick={() => setOther(null)}>
              Compare another version
            </Button>
          </div>
        </div>
        {r.diffs.map((d, i) => (
          <RedlineBlock key={d.key} d={d} index={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex justify-center py-6 sm:py-10">
      <div
        className="w-full max-w-[520px] rounded-[16px] bg-surface p-1.5 shadow-card"
        style={{ animation: "pop-in 320ms cubic-bezier(0.23,1,0.32,1) both" }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f && !busy) void parseFile(f).then(fromLoaded, (err: Error) => (setError(err.message), setState("error")));
        }}
      >
        <div className="rounded-[10px] bg-inset px-5 py-6 text-center">
          <span className="squircle mx-auto flex size-10 items-center justify-center rounded-[11px] bg-surface text-ink-2 shadow-btn">
            <ArrowsLeftRight size={18} weight="bold" />
          </span>
          <h3 className="mt-3 text-[14px] font-medium text-ink">Compare with another version</h3>
          <p className="mx-auto mt-1 max-w-[360px] text-[12.5px] text-pretty text-ink-3">
            See every clause that changed between two drafts, word by word, with the money and deadlines that moved.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-1.5 px-1.5 pt-2 pb-1">
          {sample ? (
            <Button variant="accent" size="sm" disabled={busy} onClick={() => void run({ sample: "lease-v2" }, "Sample lease (v2).txt")}>
              {busy ? <Spinner /> : <Sparkle size={14} weight="fill" />}
              Use sample v2
            </Button>
          ) : null}
          <Button variant={sample ? "secondary" : "accent"} size="sm" disabled={busy} onClick={() => file.current?.click()}>
            {busy && !sample ? <Spinner /> : <FileArrowUp size={14} weight="bold" />}
            Upload a file
          </Button>
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => setPasting((p) => !p)} aria-expanded={pasting}>
            <ClipboardText size={14} weight="bold" />
            Paste text
          </Button>
          <input
            ref={file}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) {
                setState("loading");
                void parseFile(f).then(fromLoaded, (err: Error) => (setError(err.message), setState("error")));
              }
            }}
          />
        </div>
        <div className="grid transition-[grid-template-rows,opacity] duration-300 ease-out-strong" style={{ gridTemplateRows: pasting ? "1fr" : "0fr", opacity: pasting ? 1 : 0 }}>
          <div className="overflow-hidden">
            <form
              className="px-1.5 pt-1 pb-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                if (draft.trim().length < 20) return;
                setState("loading");
                void parseText(draft, "Pasted version").then(fromLoaded, (err: Error) => (setError(err.message), setState("error")));
              }}
            >
              <div className="rounded-control border border-line bg-field p-2 focus-within:border-line-strong">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  tabIndex={pasting ? 0 : -1}
                  rows={5}
                  placeholder="Paste the other version…"
                  aria-label="Other version"
                  className="dl-scroll block min-h-[110px] w-full resize-y bg-transparent text-[13px] leading-relaxed text-ink outline-none placeholder:text-ink-3"
                />
                <div className="flex justify-end pt-1">
                  <Button type="submit" variant="primary" size="sm" disabled={busy || draft.trim().length < 20} tabIndex={pasting ? 0 : -1}>
                    Compare
                    <ArrowRight size={13} weight="bold" />
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
        {error ? (
          <p role="alert" className="mx-1.5 mb-1.5 flex items-start gap-2 rounded-control bg-red-tint px-3 py-2 text-[12.5px] text-red">
            <Warning size={14} weight="bold" className="mt-px shrink-0" />
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
