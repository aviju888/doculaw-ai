"use client";

import { useMemo } from "react";
import { RollingNumber } from "@/components/craft/RollingNumber";
import { ScrollFade } from "@/components/craft/ScrollFade";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/doculaw/text";
import { sideOf, totalsFor, type Totals } from "@/lib/doculaw/obligations";
import type { Cadence, Obligation, Roles } from "@/lib/doculaw/types";
import type { ClauseDTO } from "@/lib/doculaw/analyze";
import { CitationChip } from "./Cite";

/* ─────────────────────────────────────────────────────────
 * OBLIGATION LEDGER — everything the document makes each side
 * do, split into "You owe" and "They owe" from the side you
 * picked. Money is in tabular numerals; totals separate what is
 * due up front, what recurs every month, and what only lands if
 * something happens (late rent, leaving early). Totals roll like
 * an odometer when you switch sides.
 * ───────────────────────────────────────────────────────── */

const CADENCE: Record<Cadence, string> = { monthly: "/mo", daily: "/day", yearly: "/yr", "per-event": " each", once: "" };

/** $3,025 with each digit group rolling */
export function Money({ value, className }: { value: number; className?: string }) {
  const cents = Math.round(value * 100) % 100 !== 0;
  return (
    <span className={cn("num inline-flex items-baseline", className)} aria-label={formatMoney(value)}>
      <RollingNumber value={value} decimals={cents ? 2 : 0} prefix="$" group />
    </span>
  );
}

function Row({ o, citation, both }: { o: Obligation; citation: string; both: boolean }) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 rounded-[8px] px-2 py-2 hover:bg-hover" style={{ animation: "fade-up 320ms cubic-bezier(0.23,1,0.32,1) both" }}>
      <p className="line-clamp-3 text-[12.5px] leading-snug text-pretty text-ink" title={o.action}>
        {o.action}
      </p>
      <CitationChip citation={citation} clauseId={o.clauseId} className="mt-px self-start" />
      <div className="col-span-2 mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {o.amount !== null ? (
          <span className="num text-[12.5px] font-semibold text-ink">
            {formatMoney(o.amount)}
            <span className="font-normal text-ink-3">{o.cadence ? CADENCE[o.cadence] : ""}</span>
          </span>
        ) : null}
        {o.conditional ? <span className="inline-flex h-[18px] items-center rounded-[5px] bg-orange-tint px-1 text-[10.5px] font-medium text-orange">if triggered</span> : null}
        {both ? <span className="inline-flex h-[18px] items-center rounded-[5px] bg-field px-1 text-[10.5px] font-medium text-ink-2">Both sides</span> : null}
        {o.when ? <span className="num min-w-0 text-[11.5px] text-ink-3">{o.when}</span> : null}
      </div>
    </li>
  );
}

function TotalsBlock({ t, label }: { t: Totals; label?: string }) {
  const nothing = !t.upfront && !t.monthly && !t.yearly && !t.conditionalCount;
  const line = "flex items-baseline justify-between gap-2 text-[12px]";
  const head = label ? <span className="mb-0.5 text-[11px] font-medium text-ink-2">{label}</span> : null;
  if (nothing)
    return (
      <div className="flex flex-col gap-1">
        {head}
        <p className="text-[12px] text-ink-3">No money owed.</p>
      </div>
    );
  return (
    <div className="flex flex-col gap-1">
      {head}
      {t.upfront ? (
        <div className={line}>
          <span className="text-ink-3">{t.atSigning === t.upfront ? "Up front" : "One-time"}</span>
          <Money value={t.upfront} className="text-[13px] font-semibold text-ink" />
        </div>
      ) : null}
      {t.monthly ? (
        <div className={line}>
          <span className="text-ink-3">Every month</span>
          <Money value={t.monthly} className="text-[13px] font-semibold text-ink" />
        </div>
      ) : null}
      {t.yearly ? (
        <div className={line}>
          <span className="text-ink-3">Every year</span>
          <Money value={t.yearly} className="text-[13px] font-semibold text-ink" />
        </div>
      ) : null}
      {t.conditionalCount ? (
        <div className={line}>
          <span className="text-ink-3">If triggered</span>
          <span className="num text-right text-[12px] text-ink-2">
            {t.conditionalCount} {t.conditionalCount === 1 ? "fee" : "fees"}
            {t.conditionalMax ? `, up to ${formatMoney(t.conditionalMax)}` : ""}
          </span>
        </div>
      ) : null}
    </div>
  );
}

export function PerspectiveSwitch({ roles, value, onChange }: { roles: Roles; value: string; onChange: (p: string) => void }) {
  const options = [...roles.parties.slice(0, 2), "neutral"];
  const i = Math.max(0, options.indexOf(value));
  return (
    <div className="relative grid h-7 grid-cols-3 rounded-control bg-field p-0.5" role="radiogroup" aria-label="Your side">
      <span
        aria-hidden
        className="absolute inset-y-0.5 rounded-[6px] bg-surface shadow-btn transition-transform duration-300 ease-out-strong"
        style={{ width: "calc((100% - 4px) / 3)", left: 2, transform: `translateX(${i * 100}%)` }}
      />
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={o === value}
          onClick={() => onChange(o)}
          className={cn("relative z-10 px-2.5 text-[12px] font-medium transition-colors duration-200", o === value ? "text-ink" : "text-ink-3 hover:text-ink-2")}
        >
          {o === "neutral" ? "Neither" : o}
        </button>
      ))}
    </div>
  );
}

export function ObligationLedger({
  obligations,
  roles,
  perspective,
  onPerspective,
  clauses,
  stacked,
}: {
  obligations: Obligation[];
  roles: Roles;
  perspective: string;
  onPerspective: (p: string) => void;
  clauses: Map<string, ClauseDTO>;
  /** single column (mobile) */
  stacked?: boolean;
}) {
  const [you, them, youLabel, themLabel] = useMemo(() => {
    const a: Obligation[] = [];
    const b: Obligation[] = [];
    for (const o of obligations) (sideOf(o.party, perspective, roles) === "them" ? b : a).push(o);
    const first = roles.parties[0] ?? "First party";
    const second = roles.parties[1] ?? "Other party";
    const neutral = perspective === "neutral";
    return [a, b, neutral ? `${first} owes` : "You owe", neutral ? `${second} owes` : "They owe"] as const;
  }, [obligations, perspective, roles]);

  const tYou = useMemo(() => totalsFor(you.filter((o) => o.party !== "Both")), [you]);
  const tThem = useMemo(() => totalsFor(them), [them]);

  const column = (label: string, items: Obligation[], who: string) => (
    <section className="flex min-w-0 flex-col" aria-label={label}>
      <header className="flex min-w-0 items-center gap-2 px-2 pb-1.5">
        <h3 className="shrink-0 text-[12.5px] font-semibold whitespace-nowrap text-ink">{label}</h3>
        <span className="num inline-flex h-5 shrink-0 items-center rounded-md bg-inset px-1.5 text-[11px] font-medium text-ink-2 shadow-hairline">{items.length}</span>
        <span className="ml-auto min-w-0 truncate text-[11px] text-ink-3" title={who}>
          {who}
        </span>
      </header>
      {items.length ? (
        <ul className="flex flex-col">
          {items.map((o) => (
            <Row key={`${perspective}-${o.id}`} o={o} citation={clauses.get(o.clauseId)?.citation ?? ""} both={o.party === "Both"} />
          ))}
        </ul>
      ) : (
        <p className="px-2 py-3 text-[12px] text-ink-3">Nothing found for this side.</p>
      )}
    </section>
  );

  const youParty = perspective === "neutral" ? roles.parties[0] : perspective;
  const themParty = perspective === "neutral" ? roles.parties[1] : roles.parties.find((p) => p !== perspective);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 pt-3 pb-2.5">
        <div>
          <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-ink">Who owes what</h2>
          <p className="text-[11.5px] text-ink-3">{obligations.length} duties found in the text</p>
        </div>
        {roles.parties.length >= 2 ? <PerspectiveSwitch roles={roles} value={perspective} onChange={onPerspective} /> : null}
      </div>
      <ScrollFade className="dl-scroll min-h-0 flex-1 px-1.5 pb-2">
        {obligations.length ? (
          <div className={cn("grid gap-x-1.5 gap-y-4", stacked ? "grid-cols-1" : "grid-cols-2")}>
            {column(youLabel, you, (youParty && roles.names[youParty]) || youParty || "")}
            {column(themLabel, them, (themParty && roles.names[themParty]) || themParty || "")}
          </div>
        ) : (
          <div className="mx-1.5 mt-1 rounded-card bg-inset px-3.5 py-4 text-[12.5px] text-pretty text-ink-3 shadow-hairline">
            No duties tied to a named party. That is normal for letters and notices; contracts usually say who &ldquo;shall&rdquo; do what.
          </div>
        )}
      </ScrollFade>
      <div className={cn("grid gap-3 border-t border-line bg-inset px-3.5 py-3", stacked ? "grid-cols-1" : "grid-cols-2")} aria-label="Totals">
        <TotalsBlock t={tYou} label={stacked ? youLabel : undefined} />
        <TotalsBlock t={tThem} label={stacked ? themLabel : undefined} />
      </div>
    </div>
  );
}
