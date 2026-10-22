"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ClauseDTO } from "@/lib/doculaw/analyze";
import type { RiskFlag, Severity } from "@/lib/doculaw/types";
import { affects } from "@/lib/doculaw/risk";
import { useTip } from "./Tip";

/* ─────────────────────────────────────────────────────────
 * CLAUSE MINIMAP — a VS Code-style rail for the whole document.
 * Every clause is a bar sized by its length and indented by
 * depth; colored ticks mark risks. A frame shows what's on
 * screen. Press and drag to scrub, click to jump, arrows to step.
 *
 * Rail and table use different scales (text length vs rendered
 * height), so positions map piecewise through each clause:
 * a point 40% into a row is 40% into that row's bar.
 * ───────────────────────────────────────────────────────── */

const SEV_RANK: Record<Severity, number> = { high: 3, medium: 2, low: 1 };
const SEV_COLOR: Record<Severity, string> = { high: "var(--red)", medium: "var(--orange)", low: "var(--ink-3)" };

type Bar = { id: string; top: number; height: number; indent: number; heading: boolean; risk: Severity | null; riskMine: boolean; user: boolean };
type RowBox = { top: number; height: number };

export function ClauseMinimap({
  clauses,
  flagsByClause,
  perspective,
  scroller,
  content,
  controls,
}: {
  /** id of the scroll container this rail drives */
  controls: string;
  clauses: ClauseDTO[];
  flagsByClause: Map<string, RiskFlag[]>;
  perspective: string;
  scroller: HTMLElement | null;
  content: HTMLElement | null;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const rows = useRef<RowBox[]>([]);
  const [railH, setRailH] = useState(0);
  const [active, setActive] = useState<{ from: number; to: number }>({ from: 0, to: 0 });
  const dragging = useRef<{ moved: boolean } | null>(null);
  const tip = useTip();

  /* bars: ~3px per 70 characters like lines of text; long documents scale to
     fill the rail, short ones keep their natural size at the top */
  const bars = useMemo<Bar[]>(() => {
    if (!railH) return [];
    const gap = clauses.length > railH / 4 ? 0 : 1;
    const natural = clauses.map((c) => (c.text.trim() ? Math.max(6, Math.ceil((c.text.length + c.title.length) / 70) * 3) : 3));
    const naturalTotal = natural.reduce((a, b) => a + b, 0) + clauses.length * gap;
    const scale = naturalTotal > railH * 0.55 ? (railH - clauses.length * gap) / (naturalTotal - clauses.length * gap) : 1;
    const heights = natural.map((n) => Math.max(gap ? 2 : 1, n * scale));
    // the minimum heights can still overflow very long documents: fit them exactly
    const used = heights.reduce((a, b) => a + b, 0) + clauses.length * gap;
    const fit = used > railH ? railH / used : 1;
    let y = 0;
    return clauses.map((c, i) => {
      const h = heights[i] * fit;
      const all = flagsByClause.get(c.id) ?? [];
      const user = all.some((f) => f.kind === "user");
      const flags = all.filter((f) => f.kind !== "user");
      const mine = flags.filter((f) => affects(f, perspective));
      const pool = mine.length ? mine : flags;
      const top = pool.reduce<Severity | null>((a, f) => (!a || SEV_RANK[f.severity] > SEV_RANK[a] ? f.severity : a), null);
      const bar = { id: c.id, top: y, height: h, indent: Math.min(c.level, 4) * 4, heading: !c.text.trim(), risk: top, riskMine: mine.length > 0, user };
      y += h + gap * fit;
      return bar;
    });
  }, [clauses, flagsByClause, perspective, railH]);

  useLayoutEffect(() => {
    const el = rail.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setRailH(el.clientHeight));
    ro.observe(el);
    setRailH(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  const measure = useCallback(() => {
    if (!scroller || !content) return;
    const base = scroller.getBoundingClientRect().top - scroller.scrollTop;
    rows.current = clauses.map((c) => {
      const el = content.querySelector<HTMLElement>(`[data-row="${CSS.escape(c.id)}"]`);
      if (!el) return { top: 0, height: 0 };
      return { top: el.getBoundingClientRect().top - base, height: el.offsetHeight };
    });
  }, [scroller, content, clauses]);

  /* dom y (scroll space) → rail y, and back */
  const toRail = useCallback(
    (y: number) => {
      const r = rows.current;
      if (!r.length || !bars.length) return 0;
      if (y <= r[0].top) return 0;
      for (let i = 0; i < r.length; i++) {
        const row = r[i];
        if (y < row.top + row.height || i === r.length - 1) {
          const f = row.height ? Math.min(1, Math.max(0, (y - row.top) / row.height)) : 0;
          return bars[i].top + f * bars[i].height;
        }
      }
      return railH;
    },
    [bars, railH],
  );

  const toDom = useCallback(
    (ry: number) => {
      const r = rows.current;
      if (!r.length || !bars.length) return 0;
      for (let i = 0; i < bars.length; i++) {
        const b = bars[i];
        if (ry < b.top + b.height + 1 || i === bars.length - 1) {
          const f = b.height ? Math.min(1, Math.max(0, (ry - b.top) / b.height)) : 0;
          return r[i].top + f * r[i].height;
        }
      }
      return 0;
    },
    [bars],
  );

  const paint = useCallback(() => {
    if (!scroller || !frame.current) return;
    const top = scroller.scrollTop;
    const bottom = top + scroller.clientHeight;
    const a = toRail(top);
    const b = Math.max(a + 10, toRail(bottom));
    frame.current.style.transform = `translateY(${a}px)`;
    frame.current.style.height = `${Math.min(railH - a, b - a)}px`;
    const r = rows.current;
    let from = -1;
    let to = -1;
    for (let i = 0; i < r.length; i++) {
      if (r[i].top + r[i].height > top + 1 && r[i].top < bottom - 1) {
        if (from < 0) from = i;
        to = i;
      }
    }
    setActive((cur) => (cur.from === from && cur.to === to ? cur : { from, to }));
  }, [scroller, toRail, railH]);

  useEffect(() => {
    if (!scroller || !content) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        paint();
      });
    };
    measure();
    paint();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(() => {
      measure();
      paint();
    });
    ro.observe(content);
    ro.observe(scroller);
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [scroller, content, measure, paint]);

  const scrollToRail = (clientY: number, smooth: boolean) => {
    if (!scroller || !rail.current) return;
    const ry = clientY - rail.current.getBoundingClientRect().top;
    const y = toDom(ry) - scroller.clientHeight / 2;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scroller.scrollTo({ top: Math.max(0, y), behavior: smooth && !reduce ? "smooth" : "auto" });
  };

  return (
    <div className="flex h-full w-full flex-col items-stretch py-1">
      <div
        ref={rail}
        role="scrollbar"
        aria-label="Clause minimap"
        aria-controls={controls}
        aria-orientation="vertical"
        aria-valuemin={0}
        aria-valuemax={clauses.length}
        aria-valuenow={Math.max(0, active.from)}
        tabIndex={0}
        className="group/rail relative min-h-0 flex-1 cursor-pointer touch-none rounded-[10px] outline-offset-2 select-none"
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          dragging.current = { moved: false };
          measure();
        }}
        onPointerMove={(e) => {
          if (!dragging.current) return;
          dragging.current.moved = true;
          scrollToRail(e.clientY, false);
        }}
        onPointerUp={(e) => {
          if (dragging.current && !dragging.current.moved) scrollToRail(e.clientY, true);
          dragging.current = null;
        }}
        onPointerCancel={() => (dragging.current = null)}
        onKeyDown={(e) => {
          if (!scroller) return;
          const step = e.key === "ArrowDown" ? 120 : e.key === "ArrowUp" ? -120 : e.key === "PageDown" ? scroller.clientHeight * 0.9 : e.key === "PageUp" ? -scroller.clientHeight * 0.9 : 0;
          if (step) {
            e.preventDefault();
            scroller.scrollBy({ top: step });
          } else if (e.key === "Home" || e.key === "End") {
            e.preventDefault();
            scroller.scrollTo({ top: e.key === "Home" ? 0 : scroller.scrollHeight });
          }
        }}
      >
        {bars.map((b, i) => {
          const on = i >= active.from && i <= active.to;
          const c = clauses[i];
          // ragged right edge, stable per clause, so bars read like lines of text
          const rag = (c.id.length * 7 + c.text.length) % 9;
          const ink = on ? "color-mix(in oklch, var(--ink-2) 70%, transparent)" : "color-mix(in oklch, var(--ink-3) 42%, transparent)";
          return (
            <div
              key={b.id}
              className="absolute right-3 left-1.5"
              style={{ top: b.top, height: Math.max(b.height, 3) }}
              {...tip(
                <span className="flex items-center gap-1.5">
                  <span className="num font-mono text-[11px]" style={{ color: "var(--tooltip-muted)" }}>
                    {c.citation}
                  </span>
                  {c.title || `${c.text.slice(0, 44)}…`}
                </span>,
              )}
            >
              {b.heading ? (
                <span
                  className="absolute top-0 right-0 h-[2px] rounded-full"
                  style={{ left: b.indent, background: on ? "var(--ink-2)" : "color-mix(in oklch, var(--ink-3) 80%, transparent)" }}
                />
              ) : (
                <span
                  className="absolute top-0"
                  style={{
                    left: b.indent,
                    right: rag,
                    height: b.height,
                    backgroundImage: `repeating-linear-gradient(to bottom, ${ink} 0 1.5px, transparent 1.5px 3px)`,
                    borderRadius: 1,
                  }}
                />
              )}
            </div>
          );
        })}
        {bars.map((b) =>
          b.user ? (
            <span
              key={`u-${b.id}`}
              aria-hidden
              className="pointer-events-none absolute left-0 w-[3px] rounded-[1.5px] bg-accent"
              style={{ top: b.top, height: Math.max(4, b.height) }}
            />
          ) : null,
        )}
        {bars.map((b) =>
          b.risk ? (
            <span
              key={`t-${b.id}`}
              aria-hidden
              className="pointer-events-none absolute right-0.5 w-[5px] rounded-[1.5px]"
              style={{
                top: b.top + b.height / 2 - Math.min(4, Math.max(3, b.height)) / 2,
                height: Math.min(4, Math.max(3, b.height)),
                background: SEV_COLOR[b.risk],
                opacity: b.riskMine ? 1 : 0.35,
              }}
            />
          ) : null,
        )}
        <div
          ref={frame}
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 rounded-[6px] bg-accent/[0.07] ring-1 ring-accent/25 ring-inset"
          style={{ height: 0, willChange: "transform" }}
        />
      </div>
    </div>
  );
}
