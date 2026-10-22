"use client";

import { useState } from "react";
import { ArrowClockwise } from "@phosphor-icons/react";

/* ─────────────────────────────────────────────────────────
 * TASK LIST — Task Rows (Beautiful UI), forked to be driven by
 * real pipeline state instead of an internal timer.
 *   pending  → empty ring with the step number
 *   running  → spinning arc, or a filling arc when progress is known
 *   done     → green check + Completed pill
 *   failed   → red cross + Failed pill with retry
 * The running row opens its details on its own; a click wins.
 * ───────────────────────────────────────────────────────── */

export type TaskRowState = {
  key: string;
  label: string;
  amount: string;
  status: "pending" | "running" | "done" | "failed";
  step: number;
  /** 0..1 when known */
  progress?: number;
  details: { label: string; meta: string }[];
};

function Ring({ active, progress, children }: { active?: boolean; progress?: number; children?: React.ReactNode }) {
  const size = 24;
  const stroke = 2;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const measured = active && progress !== undefined && progress > 0;
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90" style={active && !measured ? { animation: "spin 1.1s linear infinite" } : undefined}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        {active ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={measured ? "var(--accent)" : "var(--ink-3)"}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={measured ? `${c * Math.min(1, progress as number)} ${c}` : `${c * 0.28} ${c * 0.72}`}
            style={{ transition: "stroke-dasharray 240ms cubic-bezier(0.23,1,0.32,1)" }}
          />
        ) : null}
      </svg>
      <span className="num relative text-[10.5px] font-semibold text-ink">{children}</span>
    </span>
  );
}

function Badge({ tone, children }: { tone: "red" | "green"; children: React.ReactNode }) {
  return (
    <span
      className={`flex size-5.5 shrink-0 items-center justify-center rounded-full text-white ${tone === "red" ? "bg-red" : "bg-green"}`}
      style={{ animation: "pop-in 300ms cubic-bezier(0.23,1,0.32,1) both" }}
    >
      {children}
    </span>
  );
}

const XIcon = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" aria-hidden>
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);
const CheckIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

export function TaskList({ rows, onRetry, className }: { rows: TaskRowState[]; onRetry?: () => void; className?: string }) {
  const [manualOpen, setManualOpen] = useState<Record<string, boolean>>({});

  return (
    <div className={`flex w-full flex-col gap-2 ${className ?? ""}`} aria-live="polite">
      {rows.map((row, i) => {
        const open = manualOpen[row.key] ?? (row.status === "running" && row.details.length > 0);
        const done = row.status === "done";
        return (
          <div
            key={row.key}
            className="self-stretch overflow-hidden bg-surface shadow-card transition-[border-radius,background-color] duration-300 hover:bg-inset"
            style={{ borderRadius: open ? 14 : 22, animation: `fade-up 450ms cubic-bezier(0.23,1,0.32,1) ${i * 80}ms both` }}
          >
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setManualOpen((cur) => ({ ...cur, [row.key]: !open }))}
              className="flex h-11 w-full items-center gap-2.5 px-2.5 text-left"
            >
              <span className="flex size-6 shrink-0 items-center justify-center">
                {done ? (
                  <Badge tone="green">{CheckIcon}</Badge>
                ) : row.status === "failed" ? (
                  <Badge tone="red">{XIcon}</Badge>
                ) : (
                  <Ring active={row.status === "running"} progress={row.progress}>
                    {row.step}
                  </Ring>
                )}
              </span>
              <span className={`min-w-0 flex-1 truncate text-[13px] font-medium ${row.status === "pending" ? "text-ink-3" : "text-ink"}`}>{row.label}</span>
              <span className="num shrink-0 text-[12.5px] text-ink-2">{row.amount}</span>
              {done ? (
                <span className="hidden h-5.5 items-center rounded-full bg-green-tint px-2 text-[11.5px] font-medium text-green min-[420px]:inline-flex" style={{ animation: "fade-in 200ms ease-out both" }}>
                  Completed
                </span>
              ) : row.status === "failed" ? (
                <span className="inline-flex h-5.5 items-center gap-1.5 rounded-full bg-red-tint px-2 text-[11.5px] font-medium text-red" style={{ animation: "fade-in 200ms ease-out both" }}>
                  Failed
                  {onRetry ? (
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label="Retry"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRetry();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          onRetry();
                        }
                      }}
                      className="flex rounded-full hover:opacity-80"
                    >
                      <ArrowClockwise size={12} weight="bold" />
                    </span>
                  ) : null}
                </span>
              ) : null}
              <span aria-hidden className="-ml-2 flex size-7 shrink-0 items-center justify-center rounded-full text-ink-3">
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="transition-transform duration-300"
                  style={{ transform: open ? "rotate(180deg)" : "rotate(0)" }}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </span>
            </button>

            <div
              className="grid transition-[grid-template-rows,opacity] duration-300"
              style={{ gridTemplateRows: open ? "1fr" : "0fr", opacity: open ? 1 : 0, transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)" }}
            >
              <div className="overflow-hidden">
                <div className="mb-2.5 grid grid-cols-[24px_1fr] gap-2.5 px-2.5">
                  <span aria-hidden className="mx-auto h-full w-px bg-line" />
                  <div className="flex flex-col gap-1.5">
                    {row.details.length ? (
                      row.details.map((d, j) => (
                        <div
                          key={d.label}
                          className="flex items-center justify-between gap-3"
                          style={open ? { animation: `fade-up 300ms cubic-bezier(0.23,1,0.32,1) ${120 + j * 100}ms both` } : undefined}
                        >
                          <span className="text-[12px] text-ink-2">{d.label}</span>
                          <span className="num truncate font-mono text-[11.5px] text-ink-3">{d.meta}</span>
                        </div>
                      ))
                    ) : (
                      <span className="text-[12px] text-ink-3">Waiting…</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
