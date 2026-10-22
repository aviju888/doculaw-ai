"use client";

import { useRef, useState } from "react";
import { ArrowRight, ClipboardText, FileArrowUp, Info, Scales, Sparkle, Warning } from "@phosphor-icons/react";
import { Button } from "@/components/atoms/Button";
import { cn } from "@/lib/cn";
import { ACCEPT } from "./api";

/* ─────────────────────────────────────────────────────────
 * START — drop a contract, use the sample lease, or paste text.
 * The drop zone pops in from .96 and lights up while a file
 * hovers over it; the whole panel accepts the drop.
 * ───────────────────────────────────────────────────────── */

const PROMISES = [
  { icon: Sparkle, label: "Plain English at three reading levels" },
  { icon: Warning, label: "Risky terms underlined, with why" },
  { icon: Scales, label: "Who owes what, in one ledger" },
];

export function StartPanel({
  loading,
  error,
  onSample,
  onFile,
  onPaste,
}: {
  loading: "sample" | "file" | "paste" | null;
  error: string | null;
  onSample: () => void;
  onFile: (file: File) => void;
  onPaste: (text: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [draft, setDraft] = useState("");
  const depth = useRef(0);
  const busy = loading !== null;

  const pick = (files: FileList | null) => {
    const f = files?.[0];
    if (f) onFile(f);
  };

  return (
    <div className="mx-auto flex w-full max-w-[660px] flex-col px-4 pt-12 pb-20 sm:px-6 sm:pt-20">
      <h1
        className="text-[30px] leading-[1.12] font-semibold tracking-[-0.03em] text-balance text-ink sm:text-[36px]"
        style={{ animation: "fade-up 420ms cubic-bezier(0.23,1,0.32,1) both" }}
      >
        Read the contract before you sign it.
      </h1>
      <p
        className="mt-3 max-w-[540px] text-[15px] leading-relaxed text-pretty text-ink-2"
        style={{ animation: "fade-up 420ms cubic-bezier(0.23,1,0.32,1) 60ms both" }}
      >
        Upload a lease or contract to read each clause in plain English, understand risky terms, and see what each side owes in one ledger.
      </p>

      <div
        className="mt-8 rounded-[16px] bg-surface p-1.5 shadow-card"
        style={{ animation: "pop-in 380ms cubic-bezier(0.23,1,0.32,1) 120ms both" }}
        onDragEnter={(e) => {
          e.preventDefault();
          depth.current += 1;
          setOver(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => {
          depth.current = Math.max(0, depth.current - 1);
          if (depth.current === 0) setOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          depth.current = 0;
          setOver(false);
          if (!busy) pick(e.dataTransfer.files);
        }}
      >
        {/* 16px card, 6px inset → 10px inner radius */}
        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
          className={cn(
            "group relative flex w-full flex-col items-center justify-center gap-3 rounded-[10px] border border-dashed px-6 py-10 text-center",
            "transition-[background-color,border-color,transform] duration-200 ease-out-strong disabled:cursor-progress",
            over ? "scale-[1.01] border-accent bg-accent-tint" : "border-line-strong bg-inset hover:bg-hover",
          )}
        >
          <span
            className={cn(
              "squircle flex size-11 items-center justify-center rounded-[12px] shadow-btn transition-colors duration-200",
              over ? "bg-accent text-accent-fg" : "bg-surface text-ink-2 group-hover:text-ink",
            )}
          >
            <FileArrowUp size={22} weight="duotone" />
          </span>
          <span className="flex flex-col gap-1">
            <span className="text-[14px] font-medium text-ink">{over ? "Drop to read it" : loading === "file" ? "Reading the file…" : "Drop a PDF, DOCX or TXT"}</span>
            <span className="text-[12.5px] text-ink-3">
              or <span className="text-accent-ink underline decoration-accent/30 underline-offset-[3px]">choose a file</span> · up to 5 MB
            </span>
          </span>
        </button>
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            pick(e.target.files);
            e.target.value = "";
          }}
        />

        <div className="flex flex-wrap items-center gap-1.5 px-1.5 pt-2 pb-1">
          <Button variant="accent" size="sm" disabled={busy} onClick={onSample} className="pr-2">
            {loading === "sample" ? <Spinner /> : <Sparkle size={14} weight="fill" />}
            Use the sample lease
          </Button>
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => setPasting((p) => !p)} aria-expanded={pasting} className="pl-2">
            <ClipboardText size={14} weight="bold" />
            Paste text
          </Button>
          <span className="ml-auto hidden text-[11.5px] text-ink-3 sm:inline">A sample lease with a few traps</span>
        </div>

        <div
          className="grid transition-[grid-template-rows,opacity] duration-300 ease-out-strong"
          style={{ gridTemplateRows: pasting ? "1fr" : "0fr", opacity: pasting ? 1 : 0 }}
        >
          <div className="overflow-hidden">
            <form
              className="px-1.5 pt-1 pb-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                if (draft.trim().length >= 20) onPaste(draft);
              }}
            >
              <div className="rounded-control border border-line bg-field p-2 transition-colors duration-150 focus-within:border-line-strong">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  tabIndex={pasting ? 0 : -1}
                  rows={6}
                  placeholder="Paste the full text of a lease or contract…"
                  aria-label="Contract text"
                  className="dl-scroll block max-h-[40vh] min-h-[120px] w-full resize-y bg-transparent text-[13px] leading-relaxed text-ink outline-none placeholder:text-ink-3"
                />
                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="num text-[11.5px] text-ink-3">{draft.trim() ? `${draft.trim().length.toLocaleString("en-US")} chars` : ""}</span>
                  <Button type="submit" variant="primary" size="sm" disabled={busy || draft.trim().length < 20} tabIndex={pasting ? 0 : -1}>
                    {loading === "paste" ? <Spinner /> : null}
                    Read it
                    <ArrowRight size={13} weight="bold" />
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-card bg-red-tint px-3 py-2.5 text-[13px] text-red"
          style={{ animation: "fade-up 260ms cubic-bezier(0.23,1,0.32,1) both" }}
        >
          <Warning size={15} weight="bold" className="mt-px shrink-0" />
          <span className="text-pretty">{error}</span>
        </div>
      ) : null}

      <ul className="mt-8 grid gap-2.5 sm:grid-cols-3">
        {PROMISES.map(({ icon: Icon, label }, i) => (
          <li
            key={label}
            className="flex items-center gap-2 text-[12.5px] text-ink-2"
            style={{ animation: `fade-up 400ms cubic-bezier(0.23,1,0.32,1) ${220 + i * 50}ms both` }}
          >
            <span className="flex size-6 shrink-0 items-center justify-center rounded-[7px] bg-field text-ink-2">
              <Icon size={13} weight="bold" />
            </span>
            {label}
          </li>
        ))}
      </ul>

      <p className="mt-10 flex items-center gap-1.5 text-[11.5px] text-ink-3">
        <Info size={12} weight="bold" />
        Not legal advice. Uploaded files are saved to your document library. Pasted text and samples are read for this session.
      </p>
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("size-3 shrink-0 rounded-full border-[1.5px] border-current border-t-transparent", className)}
      style={{ animation: "spin 700ms linear infinite" }}
    />
  );
}
