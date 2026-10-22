"use client";

import { useMemo } from "react";
import { CalendarBlank, Warning } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { affects } from "@/lib/doculaw/risk";
import { sideOf, totalsFor } from "@/lib/doculaw/obligations";
import type { KeyDate, Obligation, RiskFlag, Roles } from "@/lib/doculaw/types";
import { Money } from "./ObligationLedger";
import { useJump } from "./Cite";

/* ─────────────────────────────────────────────────────────
 * SUMMARY STRIP — the four numbers to know before signing:
 * risks that land on you, money due up front, money due every
 * month, and the dates that matter (including the last day to
 * stop an automatic renewal, computed from the notice window).
 * Styled like Insight Cards: hairline surfaces, small labels,
 * tabular figures.
 * ───────────────────────────────────────────────────────── */

const tile = "flex min-w-0 flex-col gap-1 rounded-card bg-surface px-3 py-2.5 shadow-card";
const label = "flex items-center gap-1.5 text-[11.5px] text-ink-3";

export function SummaryStrip({
  flags,
  obligations,
  keyDates,
  roles,
  perspective,
  className,
}: {
  flags: RiskFlag[];
  obligations: Obligation[];
  keyDates: KeyDate[];
  roles: Roles;
  perspective: string;
  className?: string;
}) {
  const { jump } = useJump();
  const counts = useMemo(() => {
    const real = flags.filter((f) => f.kind !== "user");
    const mine = real.filter((f) => affects(f, perspective));
    return {
      high: mine.filter((f) => f.severity === "high").length,
      medium: mine.filter((f) => f.severity === "medium").length,
      low: mine.filter((f) => f.severity === "low").length,
      others: real.length - mine.length,
      firstHigh: mine.find((f) => f.severity === "high") ?? null,
    };
  }, [flags, perspective]);

  const money = useMemo(() => {
    const mine = obligations.filter((o) => o.party !== "Both" && sideOf(o.party, perspective, roles) === "you");
    const theirs = totalsFor(obligations.filter((o) => o.party !== "Both" && sideOf(o.party, perspective, roles) === "them"));
    const monthlyNames = mine
      .filter((o) => o.cadence === "monthly" && !o.conditional && o.amount)
      .map((o) => o.action.replace(/^Pay\s+(?:a\s+)?(?:flat\s+)?/i, "").replace(/\bmonthly\s+/i, "").split(/\s+of\s+/)[0]);
    return { ...totalsFor(mine), monthlyNames, theirs };
  }, [obligations, perspective, roles]);

  const total = counts.high + counts.medium + counts.low;
  const who = perspective === "neutral" ? (roles.parties[0] ?? "First party").toLowerCase() : "you";
  const start = keyDates.find((k) => k.label === "Starts");
  const end = keyDates.find((k) => k.label === "Ends");
  const stop = keyDates.find((k) => k.label === "Stop renewal by");
  const due = keyDates.find((k) => k.label === "Rent due");
  const deadline = keyDates.find((k) => k.label === "Due by");

  return (
    <div className={cn("grid grid-cols-2 gap-2 xl:grid-cols-4", className)}>
      <button
        type="button"
        onClick={() => counts.firstHigh && jump(counts.firstHigh.clauseId)}
        className={cn(tile, "press text-left transition-colors duration-0 hover:bg-inset")}
        aria-label={`${counts.high} high, ${counts.medium} medium and ${counts.low} low risks`}
      >
        <span className={label}>
          <Warning size={12} weight="bold" />
          {roles.parties.length ? `Risks for ${who}` : "Risks found"}
        </span>
        <span className="num flex items-baseline gap-2.5 text-[17px] leading-tight font-semibold tracking-[-0.01em] text-ink">
          <span className="flex items-baseline gap-1">
            <span className="size-2 translate-y-[-1px] self-center rounded-full bg-red" />
            {counts.high}
          </span>
          <span className="flex items-baseline gap-1 text-ink-2">
            <span className="size-2 self-center rounded-full bg-orange" />
            {counts.medium}
          </span>
          <span className="flex items-baseline gap-1 text-ink-3">
            <span className="size-2 self-center rounded-full bg-ink-3" />
            {counts.low}
          </span>
        </span>
        <span className="flex h-1.5 w-full overflow-hidden rounded-full bg-field" aria-hidden>
          {total ? (
            <>
              <span className="h-full bg-red transition-[flex-grow] duration-500 ease-out-strong" style={{ flexGrow: counts.high }} />
              <span className="h-full bg-orange transition-[flex-grow] duration-500 ease-out-strong" style={{ flexGrow: counts.medium }} />
              <span className="h-full bg-ink-3/60 transition-[flex-grow] duration-500 ease-out-strong" style={{ flexGrow: counts.low }} />
            </>
          ) : null}
        </span>
        <span className="truncate text-[11.5px] text-ink-3">{counts.others ? `${counts.others} more sit with the other side` : total ? "High first: click to jump" : "No risk patterns found"}</span>
      </button>

      <div className={tile}>
        <span className={label}>Due at signing</span>
        {money.atSigning ? (
          <Money value={money.atSigning} className="text-[17px] leading-tight font-semibold tracking-[-0.01em] text-ink" />
        ) : money.theirs.atSigning ? (
          <span className="flex items-baseline text-[17px] leading-tight font-semibold tracking-[-0.01em] text-green">
            +<Money value={money.theirs.atSigning} />
          </span>
        ) : (
          <span className="text-[17px] leading-tight font-semibold text-ink-3">None</span>
        )}
        <span className="truncate text-[11.5px] text-ink-3">{money.atSigning || !money.theirs.atSigning ? "Deposit and one-time fees" : `Paid to ${who === "you" ? "you" : who} at signing`}</span>
      </div>

      <div className={tile}>
        <span className={label}>Every month</span>
        {money.monthly ? (
          <Money value={money.monthly} className="text-[17px] leading-tight font-semibold tracking-[-0.01em] text-ink" />
        ) : money.theirs.monthly ? (
          <span className="flex items-baseline text-[17px] leading-tight font-semibold tracking-[-0.01em] text-green">
            +<Money value={money.theirs.monthly} />
          </span>
        ) : (
          <span className="text-[17px] leading-tight font-semibold text-ink-3">None</span>
        )}
        <span className="truncate text-[11.5px] text-ink-3" title={money.monthlyNames.join(", ")}>
          {money.monthly
            ? money.monthlyNames.slice(0, 3).join(" + ")
            : money.theirs.monthly
              ? `Paid to ${who === "you" ? "you" : who} each month`
              : due
                ? `Due on the ${due.date}`
                : "No recurring payments"}
        </span>
      </div>

      <div className={tile}>
        <span className={label}>
          <CalendarBlank size={12} weight="bold" />
          Key dates
        </span>
        <span className="num truncate text-[14px] leading-tight font-semibold text-ink">
          {start && end
            ? `${start.date.replace(/, \d{4}$/, "")} to ${end.date}`
            : start
              ? `Starts ${start.date}`
              : end
                ? `Ends ${end.date}`
                : deadline
                  ? `Due by ${deadline.date}`
                  : "No dates found"}
        </span>
        {stop ? (
          <button type="button" onClick={() => stop.clauseId && jump(stop.clauseId)} className="press w-fit truncate text-left text-[11.5px] font-medium text-orange hover:underline">
            Stop renewal by <span className="num">{stop.date}</span>
          </button>
        ) : (
          <span className="truncate text-[11.5px] text-ink-3">{due ? `Rent due on the ${due.date}` : " "}</span>
        )}
      </div>
    </div>
  );
}
