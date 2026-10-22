"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowClockwise, ArrowUp, ChatCircleText, Check, Copy, Flag, Sparkle, X } from "@phosphor-icons/react";
import { Button } from "@/components/atoms/Button";
import { Shimmer } from "@/components/atoms/Shimmer";
import { postSSE } from "@/lib/sse-client";
import type { ClauseDTO } from "@/lib/doculaw/analyze";
import type { RiskFlag, Roles, Severity } from "@/lib/doculaw/types";
import { CitationChip, RichText } from "./Cite";
import { useTipApi } from "./Tip";

/* ─────────────────────────────────────────────────────────
 * SELECTION BAR — Selection Actions (Beautiful UI), forked to
 * work on a real text selection in the Original column.
 * Same pill (36px, 4px inset, 28px controls), same mode machine
 * (idle → thinking → streaming → result) and the same width
 * morph between modes. The answer streams into a card that
 * hangs under the pill. "Flag risk" can keep a flag of your own.
 * ───────────────────────────────────────────────────────── */

type Action = "explain" | "simplify" | "flag" | "ask";
type Mode = "idle" | "thinking" | "streaming" | "result";
type Snap = { text: string; clauseId: string; start: number; end: number; x: number; y: number };

const BUSY: Record<Action, string> = { explain: "Explaining", simplify: "Simplifying", flag: "Checking", ask: "Answering" };
const TITLE: Record<Action, string> = { explain: "Explain", simplify: "In plain English", flag: "Risk check", ask: "Answer" };
const SEV_TONE: Record<Severity, string> = { high: "bg-red-tint text-red", medium: "bg-orange-tint text-orange", low: "bg-field text-ink-2" };

const keep =
  "inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-ink px-2.5 text-[12.5px] font-normal text-canvas shadow-hairline transition-[opacity,transform] duration-150 hover:opacity-90 active:scale-[0.96]";

function offsetIn(node: Node, offset: number): number | null {
  const el = (node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element))?.closest<HTMLElement>("[data-off]");
  if (!el) return null;
  const base = Number(el.dataset.off ?? 0);
  return node.nodeType === Node.TEXT_NODE ? base + offset : base;
}

/* The bundler's CSS parser doesn't know ::highlight() yet and drops the rule
   from doculaw.css, so the one rule for the marked passage is added at runtime. */
function ensureHighlightStyle() {
  if (document.getElementById("dl-sel-style")) return;
  const style = document.createElement("style");
  style.id = "dl-sel-style";
  style.textContent = "::highlight(dl-sel){background-color:color-mix(in oklch, var(--accent) 22%, transparent);}";
  document.head.appendChild(style);
}

export function SelectionBar({
  container,
  clauses,
  plainFor,
  roles,
  perspective,
  onKeepFlag,
}: {
  container: HTMLElement | null;
  clauses: Map<string, ClauseDTO>;
  plainFor: (clauseId: string) => string | undefined;
  roles: Roles;
  perspective: string;
  onKeepFlag: (flag: RiskFlag) => void;
}) {
  const [snap, setSnap] = useState<Snap | null>(null);
  const [mode, setMode] = useState<Mode>("idle");
  const [action, setAction] = useState<Action>("explain");
  const [answer, setAnswer] = useState("");
  const [flag, setFlag] = useState<{ severity: Severity; title: string; why: string } | null>(null);
  const [prompt, setPrompt] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [barW, setBarW] = useState(330);
  const tipApi = useTipApi();
  const bar = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const lastWidth = useRef(0);
  const prevMode = useRef<Mode>("idle");
  const anim = useRef<Animation | null>(null);
  const abort = useRef<AbortController | null>(null);
  const modeRef = useRef(mode);
  const snapRef = useRef<Snap | null>(null);
  useLayoutEffect(() => {
    modeRef.current = mode;
    snapRef.current = snap;
  }, [mode, snap]);

  /* keep the passage visibly marked even after focus moves into the bar */
  const mark = (range: Range | null) => {
    if (typeof Highlight === "undefined" || !("highlights" in CSS)) return;
    ensureHighlightStyle();
    if (range) CSS.highlights.set("dl-sel", new Highlight(range));
    else CSS.highlights.delete("dl-sel");
  };

  const close = useCallback(() => {
    abort.current?.abort();
    mark(null);
    setSnap(null);
    setMode("idle");
    setAnswer("");
    setFlag(null);
    setPrompt("");
    setError(null);
  }, []);

  /* read the browser selection after a mouseup / keyup / touch */
  const check = useCallback(() => {
    if (!container) return;
    const busy = modeRef.current !== "idle";
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      if (!busy) setSnap(null);
      return;
    }
    const range = sel.getRangeAt(0);
    const startHost = (range.startContainer.nodeType === Node.TEXT_NODE ? range.startContainer.parentElement : (range.startContainer as Element))?.closest<HTMLElement>("[data-original]");
    const endHost = (range.endContainer.nodeType === Node.TEXT_NODE ? range.endContainer.parentElement : (range.endContainer as Element))?.closest<HTMLElement>("[data-original]");
    if (!startHost || startHost !== endHost || !container.contains(startHost)) {
      if (!busy) setSnap(null);
      return;
    }
    const text = sel.toString().replace(/\s+/g, " ").trim();
    if (text.length < 2) return;
    const start = offsetIn(range.startContainer, range.startOffset) ?? 0;
    const end = offsetIn(range.endContainer, range.endOffset) ?? start + text.length;
    const cur = snapRef.current;
    // the same selection (e.g. the mouseup of a click on the bar) changes nothing
    if (cur && cur.clauseId === startHost.dataset.original && cur.start === start && cur.text === text) return;
    mark(range.cloneRange());
    const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0);
    const last = rects[rects.length - 1] ?? range.getBoundingClientRect();
    const bounds = range.getBoundingClientRect();
    const cr = container.getBoundingClientRect();
    abort.current?.abort();
    tipApi.hide();
    setMode("idle");
    setAnswer("");
    setFlag(null);
    setError(null);
    setSnap({ text, clauseId: startHost.dataset.original as string, start, end: Math.max(end, start + 1), x: bounds.left - cr.left + bounds.width / 2, y: last.bottom - cr.top + 8 });
  }, [container, tipApi]);

  useEffect(() => {
    let t: number | undefined;
    const later = () => {
      window.clearTimeout(t);
      t = window.setTimeout(check, 10);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.shiftKey || e.key === "Shift") later();
    };
    // touch devices finish selections through selectionchange
    const onSelChange = () => {
      if (!window.matchMedia("(pointer: coarse)").matches) return;
      window.clearTimeout(t);
      t = window.setTimeout(check, 450);
    };
    document.addEventListener("mouseup", later);
    document.addEventListener("keyup", onKey);
    document.addEventListener("selectionchange", onSelChange);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mouseup", later);
      document.removeEventListener("keyup", onKey);
      document.removeEventListener("selectionchange", onSelChange);
    };
  }, [check, close]);

  // a press anywhere else closes an idle bar
  useEffect(() => {
    if (!snap) return;
    const onDown = (e: PointerEvent) => {
      if (bar.current?.parentElement?.contains(e.target as Node)) return;
      if (modeRef.current === "idle") {
        mark(null);
        setSnap(null);
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [snap]);

  useEffect(() => () => abort.current?.abort(), []);

  /* width morph between modes, same as the original component */
  useLayoutEffect(() => {
    const b = bar.current;
    const c = content.current;
    if (!b || !c) return;
    const next = Math.ceil(c.getBoundingClientRect().width) + 8;
    const prev = lastWidth.current || Math.ceil(b.getBoundingClientRect().width);
    setBarW(next);
    if (prevMode.current !== mode && Math.abs(next - prev) > 1 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      anim.current?.cancel();
      const a = b.animate([{ width: `${prev}px` }, { width: `${next}px` }], { duration: 320, easing: "cubic-bezier(0.23,1,0.32,1)" });
      anim.current = a;
      a.onfinish = () => {
        lastWidth.current = next;
        anim.current = null;
      };
    } else {
      lastWidth.current = next;
    }
    prevMode.current = mode;
  }, [mode, snap]);

  const run = async (next: Action, question = "") => {
    if (!snap) return;
    const clause = clauses.get(snap.clauseId);
    if (!clause) return;
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setAction(next);
    setAnswer("");
    setFlag(null);
    setError(null);
    setMode("thinking");
    let got = false;
    try {
      await postSSE(
        "/api/doculaw/selection",
        {
          action: next,
          selection: snap.text,
          question,
          perspective,
          roles,
          clause: { id: clause.id, citation: clause.citation, title: clause.title, text: clause.text, plain: plainFor(clause.id) },
        },
        (event, data) => {
          if (event === "answer") {
            if (!got) {
              got = true;
              setMode("streaming");
            }
            setAnswer((a) => a + (data as { delta: string }).delta);
          } else if (event === "flag") setFlag(data as { severity: Severity; title: string; why: string });
          else if (event === "error") setError((data as { message?: string }).message ?? "Something went wrong.");
        },
        ctrl.signal,
      );
      if (!ctrl.signal.aborted) setMode("result");
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setMode("result");
    }
  };

  if (!snap || !container) return null;
  const clause = clauses.get(snap.clauseId);
  const cw = container.clientWidth;
  // keep the whole pill inside the table so the scroller never clips it
  const x = Math.min(cw - barW - 8, Math.max(8, snap.x - barW / 2));
  const busy = mode === "thinking" || mode === "streaming";
  const showCard = mode !== "idle";
  const cardW = Math.min(400, cw - 24);
  const cardLeft = Math.min(cw - cardW - 12, Math.max(12, snap.x - cardW / 2));

  const keepFlag = () => {
    if (!clause || !flag) return;
    onKeepFlag({
      id: `u-${clause.id}-${snap.start}`,
      clauseId: clause.id,
      kind: "user",
      severity: flag.severity,
      start: clause.textStart + snap.start,
      end: clause.textStart + snap.end,
      title: flag.title === "Your flag" ? "Flagged by you" : flag.title,
      why: flag.why,
      burden: perspective === "neutral" ? null : perspective,
    });
    window.getSelection()?.removeAllRanges();
    close();
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-20" onMouseDown={(e) => e.preventDefault()}>
      <div
        className="pointer-events-auto absolute top-0 left-0"
        style={{ transform: `translate3d(${x}px, ${snap.y}px, 0)`, transition: "transform 320ms cubic-bezier(0.77,0,0.175,1)" }}
      >
        <div
          ref={bar}
          className="flex h-9 w-fit max-w-[calc(100vw-32px)] items-center justify-center gap-0.5 overflow-hidden rounded-full bg-surface p-1 font-sans text-ink shadow-overlay"
          style={{ animation: "pop-in 220ms cubic-bezier(0.23,1,0.32,1) both" }}
        >
          <div ref={content} className="flex w-fit shrink-0 items-center justify-center gap-0.5">
            {busy ? (
              <span className="inline-flex h-7 items-center gap-1.5 px-2.5 text-[12.5px] whitespace-nowrap text-ink-2">
                <span className="size-3 shrink-0 rounded-full border-[1.5px] border-line-strong border-t-ink-2" style={{ animation: "spin 700ms linear infinite" }} />
                {mode === "thinking" ? <Shimmer className="text-[12.5px]">{BUSY[action]}…</Shimmer> : <span>{BUSY[action]}…</span>}
              </span>
            ) : mode === "result" ? (
              <>
                {action === "flag" && flag ? (
                  <button type="button" onClick={keepFlag} className={keep}>
                    <Flag size={13} weight="bold" />
                    Keep flag
                  </button>
                ) : (
                  <button
                    type="button"
                    className={keep}
                    onClick={() => {
                      void navigator.clipboard?.writeText(answer).then(() => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1400);
                      });
                    }}
                  >
                    {copied ? <Check size={13} weight="bold" /> : <Copy size={13} weight="bold" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                )}
                <Button variant="quiet" size="xs" className="shrink-0" onClick={close}>
                  <X size={13} weight="bold" />
                  Close
                </Button>
                <span className="mx-0.5 h-4 w-px shrink-0 bg-line" />
                <button
                  type="button"
                  aria-label="Try again"
                  onClick={() => void run(action, prompt.trim())}
                  className="flex size-7 shrink-0 items-center justify-center rounded-full text-ink-3 transition-[background-color,color,transform] duration-150 hover:bg-hover-2 hover:text-ink-2 active:scale-[0.96]"
                >
                  <ArrowClockwise size={14} weight="bold" />
                </button>
              </>
            ) : (
              <>
                <form
                  className="flex h-7 items-center"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (prompt.trim()) void run("ask", prompt.trim());
                  }}
                >
                  <input
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onMouseDown={(e) => e.stopPropagation()}
                    aria-label="Ask about this passage"
                    placeholder="Ask about this"
                    className="h-7 w-[118px] bg-transparent pr-1.5 pl-3 text-[12.5px] text-ink placeholder:text-ink-3 sm:w-[138px]"
                  />
                  {prompt.trim() ? (
                    <button type="submit" aria-label="Ask" className="mr-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-ink text-surface active:scale-[0.94]" style={{ animation: "pop-in 160ms cubic-bezier(0.23,1,0.32,1) both" }}>
                      <ArrowUp size={14} weight="bold" />
                    </button>
                  ) : null}
                </form>
                <span className="mx-1 h-4 w-px shrink-0 bg-line-strong" />
                <Button variant="quiet" size="xs" className="shrink-0" onClick={() => void run("explain")}>
                  <ChatCircleText size={14} weight="bold" />
                  Explain
                </Button>
                <Button variant="quiet" size="xs" className="shrink-0" onClick={() => void run("simplify")}>
                  <Sparkle size={14} weight="bold" />
                  <span className="hidden sm:inline">Simplify</span>
                </Button>
                <Button variant="quiet" size="xs" className="shrink-0" onClick={() => void run("flag")}>
                  <Flag size={14} weight="bold" />
                  <span className="hidden sm:inline">Flag risk</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {showCard ? (
        <div
          className="pointer-events-auto absolute rounded-[14px] bg-surface p-3.5 shadow-overlay"
          style={{ left: cardLeft, top: snap.y + 44, width: cardW, animation: "dl-rise 260ms cubic-bezier(0.23,1,0.32,1) both", transformOrigin: "top center" }}
          aria-live="polite"
        >
          <div className="mb-1.5 flex items-center gap-2">
            <span className="text-[12px] font-medium text-ink-2">{TITLE[action]}</span>
            {action === "flag" && flag ? (
              <span className={`inline-flex h-5 items-center rounded-full px-2 text-[11px] font-medium ${SEV_TONE[flag.severity]}`} style={{ animation: "pop-in 200ms cubic-bezier(0.23,1,0.32,1) both" }}>
                {flag.title === "Your flag" ? "No rule matched" : `${flag.severity[0].toUpperCase()}${flag.severity.slice(1)} risk`}
              </span>
            ) : null}
            {clause ? <CitationChip citation={clause.citation} clauseId={clause.id} className="ml-auto" /> : null}
          </div>
          {error ? (
            <p className="text-[13px] text-red">{error}</p>
          ) : (
            <div className="text-[13px] leading-relaxed text-ink">
              {mode === "thinking" ? (
                <span className="flex flex-col gap-2 py-1">
                  {[88, 64].map((w) => (
                    <span key={w} className="block h-2.5 rounded-full bg-field" style={{ width: `${w}%` }} />
                  ))}
                </span>
              ) : (
                <>
                  <RichText text={answer} pop streaming={mode === "streaming"} />
                </>
              )}
            </div>
          )}
          <p className="mt-2.5 text-[11px] text-ink-3">Not legal advice.</p>
        </div>
      ) : null}
    </div>
  );
}
