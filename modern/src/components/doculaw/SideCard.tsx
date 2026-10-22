"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "@phosphor-icons/react";
import { Button } from "@/components/atoms/Button";
import GlideMenu from "@/components/atoms/GlideMenu";

/* ─────────────────────────────────────────────────────────
 * SIDE CARD — Approval Card (Beautiful UI) forked to one
 * controlled question: "Which side are you on?".
 * Same grammar: question as heading, gliding hover, radio
 * dots, quiet Skip + accent Continue. A pick auto-advances
 * after a beat; the card then collapses to a green pill.
 * ───────────────────────────────────────────────────────── */

export type SideOption = { id: string; label: string; sub?: string };

export function SideCard({
  options,
  footer,
  chosen,
  onChoose,
}: {
  options: SideOption[];
  footer: string;
  /** set once answered: renders the sent pill */
  chosen: SideOption | null;
  onChoose: (id: string) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const commit = (id: string) => {
    if (timer.current) clearTimeout(timer.current);
    setEditing(false);
    onChoose(id);
  };

  const pick = (id: string) => {
    setPicked(id);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => commit(id), 480);
  };

  if (chosen && !editing) {
    return (
      <div className="flex w-full items-center gap-3" style={{ animation: "pop-in 260ms cubic-bezier(0.23,1,0.32,1) both" }}>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-tint py-1 pr-2.5 pl-1 text-[12.5px] font-medium text-green">
          <span className="flex size-4.5 items-center justify-center rounded-full bg-green text-white">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </span>
          {chosen.id === "neutral" ? "Reading it neutrally" : `Reading as the ${chosen.label.toLowerCase()}`}
        </span>
        <button
          type="button"
          onClick={() => {
            setPicked(chosen.id);
            setEditing(true);
          }}
          className="text-[12px] font-medium text-ink-3 transition-colors duration-100 hover:text-ink"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="relative overflow-hidden rounded-card bg-surface shadow-card" style={{ animation: "fade-up 380ms cubic-bezier(0.23,1,0.32,1) both" }}>
        {editing ? (
          <button
            type="button"
            aria-label="Keep the current side"
            onClick={() => setEditing(false)}
            className="primitive-icon-button absolute top-1.5 right-1.5 z-10 text-ink-3 transition-colors duration-100 hover:bg-hover hover:text-ink"
          >
            <X size={14} weight="bold" />
          </button>
        ) : null}
        <div className="primitive-card-pad">
          <div className="pr-7 text-[14px] font-medium text-ink">Which side are you on?</div>
          <p className="mt-0.5 text-[12.5px] text-pretty text-ink-3">This decides what counts as yours on the ledger and which risks get emphasized.</p>
          <GlideMenu className="mt-2.5 flex flex-col gap-1" highlightClassName="inset-x-0 rounded-control bg-hover">
            {options.map((o) => {
              const on = picked === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  data-menu-row
                  aria-pressed={on}
                  onClick={() => pick(o.id)}
                  className="relative z-10 flex min-w-0 items-center gap-1.5 rounded-control py-1 pr-2 pl-1 text-left transition-colors duration-100"
                >
                  <span
                    className={`flex size-4 shrink-0 items-center justify-center rounded-full transition-colors duration-200 ${
                      on ? "bg-ink text-canvas" : "text-transparent shadow-[inset_0_0_0_1.5px_var(--line-strong)]"
                    }`}
                  >
                    <span className="size-1.5 rounded-full bg-canvas transition-transform duration-200" style={{ transform: on ? "scale(1)" : "scale(0)" }} />
                  </span>
                  <span className={`text-[13px] leading-none transition-colors duration-200 ${on ? "text-ink" : "text-ink-2"}`}>{o.label}</span>
                  {o.sub ? <span className="ml-auto min-w-0 truncate pl-3 text-[12px] leading-none text-ink-3">{o.sub}</span> : null}
                </button>
              );
            })}
          </GlideMenu>
        </div>
        <div className="primitive-card-footer flex items-center justify-between gap-3">
          <span className="min-w-0 truncate pl-1 text-[12px] text-ink-3">{footer}</span>
          <div className="-mr-0.5 flex shrink-0 items-center gap-1.5">
            <Button variant="ghost" size="sm" onClick={() => commit("neutral")}>
              Skip
            </Button>
            <Button variant="accent" size="sm" disabled={!picked} onClick={() => picked && commit(picked)}>
              Continue
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
