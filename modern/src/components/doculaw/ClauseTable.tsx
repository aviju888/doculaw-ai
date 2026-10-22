"use client";

import { forwardRef, memo, type ReactNode } from "react";
import type { ClauseDTO } from "@/lib/doculaw/analyze";
import { LEVELS, type Level, type RiskFlag, type Severity } from "@/lib/doculaw/types";
import { affects } from "@/lib/doculaw/risk";
import { LEVEL_INFO } from "@/lib/doculaw/levels";
import { cn } from "@/lib/cn";
import { RiskText } from "./RiskText";
import { RichText } from "./Cite";
import type { RewriteMap } from "./useDocuLaw";

/* ─────────────────────────────────────────────────────────
 * CLAUSE TABLE — Diff Table (Beautiful UI) forked into a
 * two-column reader: Original | Plain English, one row per
 * clause, indented by depth. The original column carries the
 * risk squiggles; a severity bar marks rows with risks for you.
 * All three reading levels live in one grid cell, so the dial
 * cross-fades text without moving a single row.
 * ───────────────────────────────────────────────────────── */

const SEV_RANK: Record<Severity, number> = { high: 3, medium: 2, low: 1 };
const NONE: RiskFlag[] = [];
const SEV_BAR: Record<Severity, string> = { high: "var(--red)", medium: "var(--orange)", low: "color-mix(in oklch, var(--ink-3) 55%, transparent)" };

function Shimmer() {
  return (
    <span className="flex flex-col gap-2 py-1" aria-label="Writing…">
      {[92, 74].map((w, i) => (
        <span
          key={w}
          className="block h-2.5 rounded-full"
          style={{
            width: `${w}%`,
            backgroundImage: "linear-gradient(90deg, var(--field) 0%, var(--hover-2) 50%, var(--field) 100%)",
            backgroundSize: "200% 100%",
            animation: `shimmer-text 1.4s linear ${i * 120}ms infinite`,
          }}
        />
      ))}
    </span>
  );
}

type RowProps = {
  clause: ClauseDTO;
  flags: RiskFlag[];
  rewrite: RewriteMap[string] | undefined;
  level: Level;
  perspective: string;
  pending: boolean;
};

const Row = memo(function Row({ clause: c, flags, rewrite, level, perspective, pending }: RowProps) {
  const heading = !c.text.trim() && c.childIds.length > 0;
  const mine = flags.filter((f) => f.kind !== "user" && affects(f, perspective));
  const top = mine.reduce<RiskFlag | null>((a, b) => (!a || SEV_RANK[b.severity] > SEV_RANK[a.severity] ? b : a), null);
  const indent = Math.min(c.level, 5) * 14;

  const levels = (
    <div className="dl-stack">
      {LEVELS.map((l) => {
        const r = rewrite?.[l];
        return (
          <div key={l} data-on={l === level} aria-hidden={l !== level}>
            {r?.text ? <RichText text={r.text} /> : pending && c.text.trim() ? <Shimmer /> : null}
          </div>
        );
      })}
    </div>
  );

  if (heading) {
    return (
      <div id={`row-${c.id}`} data-row={c.id} role="row" className="relative grid border-b border-line bg-inset md:grid-cols-2">
        <div role="cell" className="px-3.5 pt-3.5 pb-2.5 md:pb-3" style={{ paddingLeft: 14 + indent }}>
          <Head clause={c} strong />
        </div>
        <div role="cell" className="px-3.5 pb-3 text-[12.5px] leading-relaxed text-ink-3 md:border-l md:border-line md:pt-3.5" style={{ paddingLeft: 14 + indent }}>
          {levels}
        </div>
      </div>
    );
  }

  return (
    <div id={`row-${c.id}`} data-row={c.id} role="row" className="relative grid border-b border-line-soft last:border-b-0 md:grid-cols-2">
      {top ? <span aria-hidden className="absolute inset-y-0 left-0 w-[3px]" style={{ background: SEV_BAR[top.severity] }} /> : null}
      <div role="cell" className="dl-original px-3.5 pt-3 pb-2 md:pb-3.5" style={{ paddingLeft: 14 + indent }}>
        <Head clause={c} />
        <div
          data-original={c.id}
          className="mt-1 text-[13px] leading-[1.62] whitespace-pre-line text-ink-2 select-text"
          style={{ fontFeatureSettings: '"cv11"' }}
        >
          <RiskText text={c.text} textStart={c.textStart} flags={flags} perspective={perspective} citation={c.citation} />
        </div>
      </div>
      <div role="cell" className="px-3.5 pt-1 pb-3.5 text-[13px] leading-[1.62] text-ink md:border-l md:border-line-soft md:pt-3" style={{ paddingLeft: 14 + indent }}>
        <span className="mb-1 block text-[10.5px] font-medium tracking-[0.04em] text-ink-3 uppercase md:hidden">{level === "plain" ? "Plain English" : `Plain English · ${LEVEL_INFO[level].label}`}</span>
        {levels}
      </div>
    </div>
  );
});

function Head({ clause: c, strong }: { clause: ClauseDTO; strong?: boolean }) {
  if (!c.number && !c.title) return null;
  return (
    <div className="flex min-w-0 items-baseline gap-2">
      {c.number ? <span className="num shrink-0 font-mono text-[11.5px] text-ink-3">{c.number}</span> : null}
      {c.title ? <span className={cn("min-w-0 text-ink", strong ? "text-[13.5px] font-semibold tracking-[-0.005em]" : "text-[13px] font-medium")}>{c.title}</span> : null}
    </div>
  );
}

export const ClauseTable = forwardRef<
  HTMLDivElement,
  {
    clauses: ClauseDTO[];
    flagsByClause: Map<string, RiskFlag[]>;
    rewrites: RewriteMap;
    level: Level;
    perspective: string;
    pending: boolean;
    rulesUsed: boolean;
    stickyTop: number;
    children?: ReactNode;
  }
>(function ClauseTable({ clauses, flagsByClause, rewrites, level, perspective, pending, rulesUsed, stickyTop, children }, ref) {
  return (
    <div ref={ref} className="relative rounded-card bg-surface shadow-card" role="table" aria-label="Clauses: original and plain English">
      <div className="primitive-card-bar flex flex-wrap items-center gap-x-3 gap-y-1 rounded-t-card border-b border-line">
        <span className="flex items-center gap-2">
          <span className="text-[12.5px] font-medium text-ink">Clauses</span>
          <span className="num inline-flex h-5 items-center rounded-md bg-inset px-1.5 text-[11.5px] font-medium text-ink-2 shadow-hairline">{clauses.length}</span>
        </span>
        <span className="hidden items-center gap-2.5 text-[11.5px] text-ink-3 sm:flex">
          {(["high", "medium", "low"] as const).map((s) => (
            <span key={s} className="flex items-center gap-1">
              <svg width="14" height="6" viewBox="0 0 14 6" aria-hidden className="translate-y-px">
                <path d="M0 3 Q1.75 0 3.5 3 T7 3 T10.5 3 T14 3" fill="none" strokeWidth="1.3" stroke={s === "high" ? "var(--red)" : s === "medium" ? "var(--orange)" : "var(--ink-3)"} />
              </svg>
              <span className="capitalize">{s}</span>
            </span>
          ))}
        </span>
        <span className="ml-auto hidden text-[11.5px] text-ink-3 md:inline">Select any text to ask about it</span>
      </div>

      <div
        role="row"
        className="sticky z-[6] hidden grid-cols-2 border-b border-line bg-surface/90 backdrop-blur-md md:grid"
        style={{ top: stickyTop }}
      >
        <div role="columnheader" className="px-3.5 py-2 text-[12px] font-medium text-ink-3">
          Original
        </div>
        <div role="columnheader" className="flex items-center gap-2 border-l border-line px-3.5 py-2 text-[12px] font-medium text-ink-3">
          Plain English
          <span key={level} className="inline-flex h-5 items-center rounded-full bg-accent-tint px-2 text-[11px] font-medium text-accent-ink" style={{ animation: "pop-in 200ms cubic-bezier(0.23,1,0.32,1) both" }}>
            {LEVEL_INFO[level].label}
          </span>
          {rulesUsed ? (
            <span className="ml-auto text-[11px] font-normal text-ink-3" title="No GROQ_API_KEY, so uploads use a deterministic rule-based rewrite">
              Rule-based demo
            </span>
          ) : null}
        </div>
      </div>

      <div className="relative">
        {clauses.map((c) => (
          <Row
            key={c.id}
            clause={c}
            flags={flagsByClause.get(c.id) ?? NONE}
            rewrite={rewrites[c.id]}
            level={level}
            perspective={perspective}
            pending={pending}
          />
        ))}
      </div>
      {children}
    </div>
  );
});
