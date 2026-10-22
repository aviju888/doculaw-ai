"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/* ─────────────────────────────────────────────────────────
 * TIP — one tooltip for the whole app.
 * craft "Tooltips": the first one waits ~500ms; while one is
 * open (or just closed) its neighbors appear instantly, so
 * scanning a row of squiggles feels immediate.
 * Portaled to <body> so transformed ancestors can't offset it.
 * ───────────────────────────────────────────────────────── */

type Api = { show: (el: HTMLElement, content: ReactNode) => void; hide: (el?: HTMLElement) => void };

const TipCtx = createContext<Api | null>(null);

type TipState = { el: HTMLElement; content: ReactNode; id: number };

export function TipProvider({ children }: { children: ReactNode }) {
  const [tip, setTip] = useState<TipState | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const current = useRef<HTMLElement | null>(null);
  const visible = useRef(false);
  const lastHidden = useRef(0);
  const seq = useRef(0);

  const show = useCallback((el: HTMLElement, content: ReactNode) => {
    window.clearTimeout(timer.current);
    current.current = el;
    const warm = visible.current || performance.now() - lastHidden.current < 450;
    const open = () => {
      if (current.current !== el || !el.isConnected) return;
      visible.current = true;
      setTip({ el, content, id: ++seq.current });
    };
    if (warm) open();
    else timer.current = window.setTimeout(open, 500);
  }, []);

  const hide = useCallback((el?: HTMLElement) => {
    if (el && current.current !== el) return;
    window.clearTimeout(timer.current);
    current.current = null;
    if (visible.current) lastHidden.current = performance.now();
    visible.current = false;
    setTip(null);
  }, []);

  useEffect(() => {
    const off = () => hide();
    window.addEventListener("scroll", off, true);
    window.addEventListener("resize", off);
    return () => {
      window.removeEventListener("scroll", off, true);
      window.removeEventListener("resize", off);
      window.clearTimeout(timer.current);
    };
  }, [hide]);

  const api = useMemo(() => ({ show, hide }), [show, hide]);
  return (
    <TipCtx.Provider value={api}>
      {children}
      {tip ? <Bubble key={tip.id} el={tip.el}>{tip.content}</Bubble> : null}
    </TipCtx.Provider>
  );
}

function Bubble({ el, children }: { el: HTMLElement; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; below: boolean } | null>(null);

  useLayoutEffect(() => {
    const b = ref.current;
    if (!b) return;
    // anchor on the line the pointer is most likely on: the first client rect
    const rects = Array.from(el.getClientRects());
    const r = rects[0] ?? el.getBoundingClientRect();
    const w = b.offsetWidth;
    const h = b.offsetHeight;
    const margin = 8;
    const below = r.top - h - 8 < margin;
    const left = Math.min(window.innerWidth - w - margin, Math.max(margin, r.left + r.width / 2 - w / 2));
    const top = below ? r.bottom + 8 : r.top - h - 8;
    setPos({ left, top, below });
  }, [el]);

  return createPortal(
    <div
      ref={ref}
      role="tooltip"
      className="pointer-events-none fixed z-[100] w-max max-w-[min(300px,calc(100vw-16px))] rounded-[9px] border px-2.5 py-2 text-[12px] leading-snug shadow-overlay"
      style={{
        left: pos?.left ?? -9999,
        top: pos?.top ?? -9999,
        background: "var(--tooltip-bg)",
        color: "var(--tooltip-fg)",
        borderColor: "var(--tooltip-border)",
        transformOrigin: pos?.below ? "top center" : "bottom center",
        animation: pos ? "dl-tip-in 140ms cubic-bezier(0.23,1,0.32,1) both" : undefined,
        visibility: pos ? "visible" : "hidden",
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

/** Props that attach a tooltip to any element (pointer + keyboard). */
export function useTip() {
  const api = useContext(TipCtx);
  return useCallback(
    (content: ReactNode) => ({
      onPointerEnter: (e: React.PointerEvent<HTMLElement>) => {
        if (e.pointerType !== "touch") api?.show(e.currentTarget, content);
      },
      onPointerLeave: (e: React.PointerEvent<HTMLElement>) => api?.hide(e.currentTarget),
      onFocus: (e: React.FocusEvent<HTMLElement>) => api?.show(e.currentTarget, content),
      onBlur: (e: React.FocusEvent<HTMLElement>) => api?.hide(e.currentTarget),
    }),
    [api],
  );
}

export function useTipApi(): Api {
  const api = useContext(TipCtx);
  return api ?? { show: () => {}, hide: () => {} };
}
