"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowCounterClockwise, FileText, Info, X } from "@phosphor-icons/react";
import { Button } from "@/components/atoms/Button";
import { cn } from "@/lib/cn";
import { playSfx } from "@/lib/sfx";
import type { ChatClause } from "@/lib/doculaw/answer";
import type { ClauseDTO } from "@/lib/doculaw/analyze";
import { LEVELS, type Level, type RiskFlag } from "@/lib/doculaw/types";
import { readingGrade } from "@/lib/doculaw/text";
import { formatBytes } from "./api";
import { JumpContext } from "./Cite";
import { TipProvider } from "./Tip";
import { StartPanel } from "./StartPanel";
import { SideCard, type SideOption } from "./SideCard";
import { TaskList, type TaskRowState } from "./TaskList";
import { PlainDial } from "./PlainDial";
import { ClauseTable } from "./ClauseTable";
import { ClauseMinimap } from "./ClauseMinimap";
import { SelectionBar } from "./SelectionBar";
import { ObligationLedger } from "./ObligationLedger";
import { SummaryStrip } from "./SummaryStrip";
import { ChatPanel } from "./ChatPanel";
import { ComparePanel } from "./ComparePanel";
import { useDocuLaw, type DocuLawStore } from "./useDocuLaw";
import "./doculaw.css";

/* ─────────────────────────────────────────────────────────
 * DOCULAW AI — start → intake (read, pick a side, analyze) → workspace.
 *   wide (≥1280px)  minimap rail | clause view | ledger / chat
 *   compact         one column with tabs: Clauses · Ledger · Chat · Compare
 * ───────────────────────────────────────────────────────── */

const TASK_LABELS: Record<string, string> = { read: "Reading file", structure: "Finding structure", risks: "Flagging risks", rewrite: "Writing plain English" };

function useMedia(query: string): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setOn(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);
  return on;
}

/** craft "Scroll Fades" for a scroller we also need a handle on */
function useScrollFadeAttrs(el: HTMLElement | null) {
  useEffect(() => {
    if (!el) return;
    const update = () => {
      el.setAttribute("data-fade-top", String(el.scrollTop > 1));
      el.setAttribute("data-fade-bottom", String(el.scrollTop + el.clientHeight < el.scrollHeight - 1));
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [el]);
}

function Segmented<T extends string>({ options, value, onChange, className, label }: { options: { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; className?: string; label: string }) {
  const i = Math.max(0, options.findIndex((o) => o.id === value));
  return (
    <div role="tablist" aria-label={label} className={cn("relative grid h-8 rounded-control bg-field p-0.5", className)} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      <span
        aria-hidden
        className="absolute inset-y-0.5 rounded-[6px] bg-surface shadow-btn transition-transform duration-300 ease-out-strong"
        style={{ width: `calc((100% - 4px) / ${options.length})`, left: 2, transform: `translateX(${i * 100}%)` }}
      />
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={o.id === value}
          onClick={() => onChange(o.id)}
          className={cn("relative z-10 flex items-center justify-center gap-1.5 px-3 text-[12.5px] font-medium whitespace-nowrap transition-colors duration-200", o.id === value ? "text-ink" : "text-ink-3 hover:text-ink-2")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function DocChip({ store, compact }: { store: DocuLawStore; compact?: boolean }) {
  const { s } = store;
  const d = s.doc?.doc;
  const p = s.perspective;
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="squircle flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-surface text-ink-2 shadow-btn">
        <FileText size={15} weight="duotone" />
      </span>
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-[13px] font-medium text-ink">{s.structure?.title ?? s.doc?.title ?? d?.name ?? "Reading…"}</span>
        <span className="num truncate text-[11.5px] text-ink-3">
          {d ? [d.name, d.pages ? `${d.pages} pages` : formatBytes(d.bytes), s.structure ? `${s.structure.clauses.length} clauses` : null].filter(Boolean).join(" · ") : " "}
          {!compact && p && s.phase === "ready" ? ` · ${p === "neutral" ? "neutral reading" : `you: ${p.toLowerCase()}`}` : ""}
        </span>
      </div>
    </div>
  );
}

function Intake({ store }: { store: DocuLawStore }) {
  const { s, chooseSide, retry, reset, setPerspective } = store;
  const roles = s.doc?.roles;
  const options: SideOption[] = roles
    ? [...roles.parties.slice(0, 2).map((r) => ({ id: r, label: r, sub: roles.names[r] })), { id: "neutral", label: "Just reading" }]
    : [];
  const chosen = s.perspective ? (options.find((o) => o.id === s.perspective) ?? { id: "neutral", label: "Just reading" }) : null;
  const rows: TaskRowState[] = (["read", "structure", "risks", "rewrite"] as const).map((k, i) => ({
    key: k,
    label: TASK_LABELS[k],
    amount: s.tasks[k].amount,
    status: s.tasks[k].status,
    step: i + 1,
    progress: k === "rewrite" ? s.tasks[k].progress : undefined,
    details: s.tasks[k].details,
  }));

  return (
    <div className="mx-auto flex w-full max-w-[460px] flex-col gap-4 px-4 pt-10 pb-20 sm:pt-16">
      <div className="flex items-center justify-between gap-3" style={{ animation: "fade-up 320ms cubic-bezier(0.23,1,0.32,1) both" }}>
        <DocChip store={store} compact />
        <Button variant="ghost" size="sm" onClick={reset}>
          Cancel
        </Button>
      </div>
      {s.doc && roles && roles.parties.length >= 2 ? (
        <SideCard
          options={options}
          footer={`${s.doc.clauseCount} clauses · ${s.doc.title ?? s.doc.doc.name}`}
          chosen={chosen}
          onChoose={(id) => (s.perspective === null ? chooseSide(id) : setPerspective(id))}
        />
      ) : null}
      <TaskList rows={rows} onRetry={retry} />
      {s.analyzeError ? (
        <p role="alert" className="flex items-center gap-2 text-[12.5px] text-red">
          {s.analyzeError}
          <button type="button" className="font-medium underline underline-offset-2" onClick={retry}>
            Try again
          </button>
        </p>
      ) : null}
    </div>
  );
}

function Notice({ text, onClose }: { text: string; onClose: () => void }) {
  return (
    <div role="status" className="flex items-center gap-2 rounded-control bg-orange-tint px-2.5 py-1.5 text-[12px] text-orange" style={{ animation: "fade-up 240ms cubic-bezier(0.23,1,0.32,1) both" }}>
      <Info size={13} weight="bold" className="shrink-0" />
      <span className="min-w-0 flex-1">{text}</span>
      <button type="button" aria-label="Dismiss" onClick={onClose} className="shrink-0 rounded hover:opacity-70">
        <X size={12} weight="bold" />
      </button>
    </div>
  );
}

function Workspace({ store, live }: { store: DocuLawStore; live: boolean }) {
  const { s, reset, setLevel, setPerspective, addUserFlag, allFlags, dismissNotice } = store;
  const wide = useMedia("(min-width: 1280px)");
  const [mainTab, setMainTab] = useState<"clauses" | "compare">("clauses");
  const [sideTab, setSideTab] = useState<"ledger" | "chat">("ledger");
  const [mobileTab, setMobileTab] = useState<"clauses" | "ledger" | "chat" | "compare">("clauses");
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  const [table, setTable] = useState<HTMLDivElement | null>(null);
  const toolbar = useRef<HTMLDivElement>(null);
  const [toolbarH, setToolbarH] = useState(96);
  useScrollFadeAttrs(wide ? scroller : null);

  const st = s.structure;
  const clauses = useMemo(() => st?.clauses ?? [], [st]);
  const byId = useMemo(() => new Map<string, ClauseDTO>(clauses.map((c) => [c.id, c])), [clauses]);
  const byCitation = useMemo(() => new Map(clauses.map((c) => [c.citation, c.id])), [clauses]);
  const perspective = s.perspective ?? "neutral";

  const flagsByClause = useMemo(() => {
    const m = new Map<string, RiskFlag[]>();
    for (const f of allFlags) m.set(f.clauseId, [...(m.get(f.clauseId) ?? []), f]);
    return m;
  }, [allFlags]);

  const chatClauses = useMemo<ChatClause[]>(
    () =>
      clauses.map((c) => ({
        id: c.id,
        citation: c.citation,
        title: c.title,
        text: c.text,
        plain: s.rewrites[c.id]?.plain?.text || undefined,
        parentTitle: c.parentId ? byId.get(c.parentId)?.title || undefined : undefined,
        parentId: c.parentId,
        childIds: c.childIds,
      })),
    [clauses, s.rewrites, byId],
  );

  const grades = useMemo(() => {
    const out: Partial<Record<Level, number | null>> = {};
    for (const l of LEVELS) {
      const text = clauses.map((c) => (c.text.trim() ? s.rewrites[c.id]?.[l]?.text ?? "" : "")).join(" ");
      out[l] = readingGrade(text);
    }
    return out;
  }, [clauses, s.rewrites]);

  const rulesUsed = useMemo(() => clauses.some((c) => s.rewrites[c.id]?.[s.level]?.source === "rules" && c.text.trim()), [clauses, s.rewrites, s.level]);
  const pending = live && (s.fetchingLevels.includes(s.level) || s.tasks.rewrite.status !== "done");

  useEffect(() => {
    const el = toolbar.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setToolbarH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [wide]);

  const jump = useCallback(
    (id: string) => {
      if (wide) setMainTab("clauses");
      else setMobileTab("clauses");
      playSfx("tick", 0.5);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          const row = document.getElementById(`row-${id}`);
          if (!row) return;
          const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          const behavior: ScrollBehavior = reduce ? "auto" : "smooth";
          if (wide && scroller) {
            const top = row.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 46;
            scroller.scrollTo({ top: Math.max(0, top), behavior });
          } else {
            const top = row.getBoundingClientRect().top + window.scrollY - (48 + toolbarH + 46);
            window.scrollTo({ top: Math.max(0, top), behavior });
          }
          const accent = getComputedStyle(row).getPropertyValue("--accent").trim() || "#4f8ff7";
          row.animate([{ backgroundColor: `color-mix(in oklch, ${accent} 16%, transparent)` }, { backgroundColor: "transparent" }], {
            duration: reduce ? 1 : 1700,
            easing: "cubic-bezier(0.23,1,0.32,1)",
            delay: reduce ? 0 : 180,
          });
        }),
      );
    },
    [wide, scroller, toolbarH],
  );

  const jumpApi = useMemo(() => ({ jump, idFor: (c: string) => byCitation.get(c) ?? null }), [jump, byCitation]);

  if (!st || !s.doc) return null;

  const dial = <PlainDial value={s.level} onChange={(l) => void setLevel(l)} grade={grades[s.level]} busy={s.fetchingLevels.includes(s.level)} />;

  const tableEl = (
    <ClauseTable ref={setTable} clauses={clauses} flagsByClause={flagsByClause} rewrites={s.rewrites} level={s.level} perspective={perspective} pending={pending} rulesUsed={rulesUsed} stickyTop={wide ? 0 : 48 + toolbarH}>
      <SelectionBar container={table} clauses={byId} plainFor={(id) => s.rewrites[id]?.plain?.text} roles={st.roles} perspective={perspective} onKeepFlag={addUserFlag} />
    </ClauseTable>
  );

  const summary = <SummaryStrip flags={allFlags} obligations={s.obligations} keyDates={s.keyDates} roles={st.roles} perspective={perspective} />;
  const ledger = (stacked: boolean) => (
    <ObligationLedger obligations={s.obligations} roles={st.roles} perspective={perspective} onPerspective={setPerspective} clauses={byId} stacked={stacked} />
  );
  const chat = <ChatPanel clauses={chatClauses} roles={st.roles} perspective={perspective} docNoun={st.docNoun} />;
  const notice = s.notice ? <Notice text={s.notice} onClose={dismissNotice} /> : null;

  if (wide) {
    return (
      <JumpContext.Provider value={jumpApi}>
        <div className="mx-auto grid h-[calc(100dvh-48px)] max-w-[1440px] grid-cols-[minmax(0,1fr)_420px] gap-4 px-6 pt-4 pb-4" style={{ animation: "dl-rise 420ms cubic-bezier(0.23,1,0.32,1) both" }}>
          <section className="flex min-h-0 min-w-0 flex-col gap-3">
            <div ref={toolbar} className="flex items-center gap-3">
              <DocChip store={store} />
              <Segmented
                label="View"
                className="ml-2 shrink-0"
                value={mainTab}
                onChange={setMainTab}
                options={[
                  { id: "clauses", label: "Clauses" },
                  { id: "compare", label: "Compare" },
                ]}
              />
              <div className="ml-auto flex min-w-0 items-center gap-2">
                {mainTab === "clauses" ? dial : null}
                <Button variant="ghost" size="sm" onClick={reset} className="shrink-0">
                  <ArrowCounterClockwise size={13} weight="bold" />
                  New
                </Button>
              </div>
            </div>
            {notice}
            <div className="flex min-h-0 flex-1 gap-3">
              <aside className={cn("w-14 shrink-0", mainTab !== "clauses" && "hidden")} aria-hidden={mainTab !== "clauses"}>
                <ClauseMinimap controls="dl-clause-scroll" clauses={clauses} flagsByClause={flagsByClause} perspective={perspective} scroller={scroller} content={table} />
              </aside>
              <div ref={setScroller} id="dl-clause-scroll" className="scroll-fade dl-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-card" style={{ ["--fade" as string]: "20px" }}>
                <div className={cn("flex flex-col gap-3 px-px pt-px pb-6", mainTab !== "clauses" && "hidden")}>
                  {summary}
                  {tableEl}
                </div>
                <div className={cn("px-px pt-px pb-6", mainTab !== "compare" && "hidden")}>
                  <ComparePanel base={s.doc} />
                </div>
              </div>
            </div>
          </section>
          <aside className="flex min-h-0 flex-col overflow-hidden rounded-window bg-surface shadow-card">
            <div className="flex shrink-0 items-center gap-2 border-b border-line p-1.5">
              {(["ledger", "chat"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={sideTab === t}
                  onClick={() => setSideTab(t)}
                  className={cn("rounded-[6px] px-2 py-[3px] text-[13px] text-ink transition-[background-color,opacity] duration-100", sideTab === t ? "bg-field" : "opacity-50 hover:opacity-75")}
                >
                  {t === "ledger" ? "Ledger" : "Chat"}
                </button>
              ))}
              <span className="num ml-auto pr-1.5 text-[11.5px] text-ink-3">{sideTab === "ledger" ? `${s.obligations.length} duties` : "Answers cite the text"}</span>
            </div>
            <div className={cn("min-h-0 flex-1", sideTab !== "ledger" && "hidden")}>{ledger(false)}</div>
            <div className={cn("min-h-0 flex-1", sideTab !== "chat" && "hidden")}>{chat}</div>
          </aside>
        </div>
      </JumpContext.Provider>
    );
  }

  return (
    <JumpContext.Provider value={jumpApi}>
      <div className="mx-auto w-full max-w-[920px] px-3 pb-16 sm:px-5" style={{ animation: "dl-rise 420ms cubic-bezier(0.23,1,0.32,1) both" }}>
        <div ref={toolbar} className="sticky top-12 z-30 -mx-3 flex flex-col gap-2.5 bg-page/90 px-3 pt-3 pb-2.5 backdrop-blur-md sm:-mx-5 sm:px-5">
          <div className="flex items-center justify-between gap-2">
            <DocChip store={store} compact />
            <Button variant="ghost" size="sm" onClick={reset} className="shrink-0">
              <ArrowCounterClockwise size={13} weight="bold" />
              New
            </Button>
          </div>
          <Segmented
            label="Sections"
            value={mobileTab}
            onChange={setMobileTab}
            options={[
              { id: "clauses", label: "Clauses" },
              { id: "ledger", label: "Ledger" },
              { id: "chat", label: "Chat" },
              { id: "compare", label: "Compare" },
            ]}
          />
        </div>
        {notice ? <div className="mt-2">{notice}</div> : null}
        <div className={cn("mt-2 flex flex-col gap-3", mobileTab !== "clauses" && "hidden")}>
          {dial}
          {summary}
          {tableEl}
        </div>
        <div className={cn("mt-2 overflow-hidden rounded-window bg-surface shadow-card", mobileTab !== "ledger" && "hidden")}>{ledger(true)}</div>
        <div className={cn("mt-2 h-[calc(100dvh-48px-var(--tb)-24px)] min-h-[420px] overflow-hidden rounded-window bg-surface shadow-card", mobileTab !== "chat" && "hidden")} style={{ ["--tb" as string]: `${toolbarH}px` }}>
          {chat}
        </div>
        <div className={cn("mt-2", mobileTab !== "compare" && "hidden")}>
          <ComparePanel base={s.doc} />
        </div>
      </div>
    </JumpContext.Provider>
  );
}

export function DocuLawApp({ live }: { live: boolean }) {
  const store = useDocuLaw(live);
  const { s, load } = store;
  const initialDocument = useRef(new URLSearchParams(window.location.search).get('document'));
  useEffect(() => { if(initialDocument.current) void load('saved',initialDocument.current); }, [load]);

  // sound (off unless the viewer turns it on): a chord when the reading is done
  const prevPhase = useRef(s.phase);
  useEffect(() => {
    if (prevPhase.current === "intake" && s.phase === "ready") playSfx("success", 0.7);
    prevPhase.current = s.phase;
  }, [s.phase]);
  return (
    <TipProvider>
      {s.phase === "start" ? (
        <StartPanel loading={s.loading} error={s.error} onSample={() => void load("sample")} onFile={(f) => void load("file", f)} onPaste={(t) => void load("paste", t)} />
      ) : s.phase === "intake" ? (
        <Intake store={store} />
      ) : (
        <Workspace store={store} live={live} />
      )}
    </TipProvider>
  );
}
