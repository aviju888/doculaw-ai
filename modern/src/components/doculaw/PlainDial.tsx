"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { LEVELS, type Level } from "@/lib/doculaw/types";
import { LEVEL_INFO } from "@/lib/doculaw/levels";

/* ─────────────────────────────────────────────────────────
 * PLAIN-ENGLISH DIAL — three stops: Lawyer · Plain · ELI5.
 * Built from Fine-tune Card's segmented control (gray track,
 * raised white thumb) plus its scrub gesture: press anywhere
 * and drag, the thumb follows the pointer and the level flips
 * as you cross each midpoint, then it settles on release.
 * Arrow keys step; the reading grade of the current version
 * sits beside it so the change is measurable.
 * ───────────────────────────────────────────────────────── */

const clamp = (n: number) => Math.min(LEVELS.length - 1, Math.max(0, n));

export function PlainDial({
  value,
  onChange,
  grade,
  busy,
  className,
}: {
  value: Level;
  onChange: (level: Level) => void;
  /** reading grade of the column at this level (null while unknown) */
  grade?: number | null;
  busy?: boolean;
  className?: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const index = LEVELS.indexOf(value);

  const posFrom = (clientX: number) => {
    const el = track.current;
    if (!el) return index;
    const r = el.getBoundingClientRect();
    const seg = (r.width - 4) / LEVELS.length;
    return Math.min(LEVELS.length - 1, Math.max(0, (clientX - r.left - 2) / seg - 0.5));
  };

  const set = (i: number) => {
    const next = LEVELS[clamp(i)];
    if (next !== value) onChange(next);
  };

  const thumbPos = drag ?? index;

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        ref={track}
        role="radiogroup"
        aria-label="Reading level"
        className="relative grid h-7 min-w-[210px] flex-1 cursor-grab touch-none grid-cols-3 rounded-control bg-field p-0.5 select-none active:cursor-grabbing sm:flex-none"
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          const p = posFrom(e.clientX);
          setDrag(p);
          set(Math.round(p));
        }}
        onPointerMove={(e) => {
          if (drag === null) return;
          const p = posFrom(e.clientX);
          setDrag(p);
          set(Math.round(p));
        }}
        onPointerUp={() => setDrag(null)}
        onPointerCancel={() => setDrag(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowDown") {
            e.preventDefault();
            set(index + 1);
          } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
            e.preventDefault();
            set(index - 1);
          } else if (e.key === "Home") {
            e.preventDefault();
            set(0);
          } else if (e.key === "End") {
            e.preventDefault();
            set(LEVELS.length - 1);
          }
        }}
      >
        <span
          aria-hidden
          className="absolute inset-y-0.5 rounded-[6px] bg-surface shadow-btn"
          style={{
            width: "calc((100% - 4px) / 3)",
            left: 2,
            transform: `translateX(${thumbPos * 100}%)`,
            transition: drag === null ? "transform 300ms cubic-bezier(0.23,1,0.32,1)" : "none",
          }}
        />
        {LEVELS.map((l, i) => {
          const on = l === value;
          return (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              title={LEVEL_INFO[l].hint}
              onClick={(e) => {
                // pointer selection already happened on press
                if (e.detail === 0) set(i);
              }}
              className={cn(
                "relative z-10 flex items-center justify-center gap-1.5 rounded-[6px] text-[12.5px] font-medium transition-colors duration-200",
                on ? "text-ink" : "text-ink-3 hover:text-ink-2",
              )}
            >
              <span aria-hidden className={cn("size-1.5 rounded-full transition-colors duration-200", on ? "bg-accent" : "bg-line-strong")} />
              {LEVEL_INFO[l].label}
            </button>
          );
        })}
      </div>
      <span className="hidden shrink-0 items-center gap-1.5 text-[12px] text-ink-3 lg:flex" aria-live="polite">
        {busy ? (
          <span className="size-3 rounded-full border-[1.5px] border-line-strong border-t-ink-2" style={{ animation: "spin 700ms linear infinite" }} />
        ) : null}
        {grade != null ? (
          <>
            Reads at grade <span className="num font-medium text-ink-2">{grade.toFixed(1)}</span>
          </>
        ) : (
          LEVEL_INFO[value].hint
        )}
      </span>
    </div>
  );
}
