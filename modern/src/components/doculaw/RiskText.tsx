"use client";

import { memo, type ReactNode } from "react";
import type { RiskFlag, Severity } from "@/lib/doculaw/types";
import { affects } from "@/lib/doculaw/risk";
import { useTip } from "./Tip";

/* ─────────────────────────────────────────────────────────
 * RISK TEXT — a clause's original text with every risk span
 * drawn as a wavy underline (red high, orange medium, gray low,
 * dotted accent for flags you added). Spans that sit with the
 * other side are muted. Overlaps split into segments; a
 * segment carries every flag that covers it.
 * Each segment keeps data-off (offset inside the clause text)
 * so a text selection maps back to exact characters.
 * ───────────────────────────────────────────────────────── */

const RANK: Record<Severity, number> = { high: 3, medium: 2, low: 1 };
const SEV_LABEL: Record<Severity, string> = { high: "High", medium: "Medium", low: "Low" };
const SEV_DOT: Record<Severity, string> = { high: "var(--red)", medium: "var(--orange)", low: "var(--ink-3)" };

export function burdenLabel(burden: string | null, perspective: string): string {
  if (burden === null || burden === "both") return "Affects both sides";
  if (perspective !== "neutral" && burden === perspective) return "Affects you";
  return `Affects the ${burden.toLowerCase()}`;
}

function TipBody({ flags, perspective, citation }: { flags: RiskFlag[]; perspective: string; citation: string }) {
  return (
    <div className="flex flex-col gap-2">
      {flags.slice(0, 2).map((f) => (
        <div key={f.id} className="flex flex-col gap-1">
          <span className="flex items-center gap-1.5 font-medium">
            <span className="size-1.5 shrink-0 rounded-full" style={{ background: f.kind === "user" ? "var(--accent)" : SEV_DOT[f.severity] }} />
            {f.kind === "user" ? "Your flag" : `${SEV_LABEL[f.severity]} risk`}
            <span style={{ color: "var(--tooltip-muted)" }}>·</span>
            <span>{f.title}</span>
          </span>
          <span className="text-pretty" style={{ color: "var(--tooltip-muted)" }}>
            {f.why}
          </span>
        </div>
      ))}
      <span className="num text-[11px]" style={{ color: "var(--tooltip-muted)" }}>
        {burdenLabel(flags[0].burden, perspective)} · {citation}
      </span>
    </div>
  );
}

function Squiggle({ flags, perspective, citation, off, children }: { flags: RiskFlag[]; perspective: string; citation: string; off: number; children: ReactNode }) {
  const tip = useTip();
  const top = flags.reduce((a, b) => (RANK[b.severity] > RANK[a.severity] ? b : a));
  const user = flags.every((f) => f.kind === "user");
  const muted = !flags.some((f) => affects(f, perspective));
  return (
    <span
      tabIndex={0}
      data-off={off}
      data-sev={user ? "user" : top.severity}
      data-muted={muted}
      aria-label={`${user ? "Your flag" : `${SEV_LABEL[top.severity]} risk`}: ${top.title}. ${top.why}`}
      className="dl-squiggle"
      {...tip(<TipBody flags={flags} perspective={perspective} citation={citation} />)}
    >
      {children}
    </span>
  );
}

export const RiskText = memo(function RiskText({
  text,
  textStart,
  flags,
  perspective,
  citation,
}: {
  text: string;
  /** absolute offset of text[0] in the document */
  textStart: number;
  flags: RiskFlag[];
  perspective: string;
  citation: string;
}) {
  const local = flags
    .map((f) => ({ f, s: Math.max(0, f.start - textStart), e: Math.min(text.length, f.end - textStart) }))
    .filter((x) => x.e > x.s);
  if (!local.length) return <span data-off={0}>{text}</span>;

  const cuts = new Set<number>([0, text.length]);
  for (const x of local) {
    cuts.add(x.s);
    cuts.add(x.e);
  }
  const points = [...cuts].sort((a, b) => a - b);
  const out: ReactNode[] = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i];
    const b = points[i + 1];
    const covering = local.filter((x) => x.s <= a && x.e >= b).map((x) => x.f);
    const piece = text.slice(a, b);
    out.push(
      covering.length ? (
        <Squiggle key={a} off={a} flags={covering} perspective={perspective} citation={citation}>
          {piece}
        </Squiggle>
      ) : (
        <span key={a} data-off={a}>
          {piece}
        </span>
      ),
    );
  }
  return <>{out}</>;
});
