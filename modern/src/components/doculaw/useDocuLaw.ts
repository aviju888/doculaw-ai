"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { postSSE } from "@/lib/sse-client";
import { playSfx } from "@/lib/sfx";
import type { ClauseDTO } from "@/lib/doculaw/analyze";
import type { KeyDate, Level, Obligation, RiskFlag, Roles } from "@/lib/doculaw/types";
import { formatBytes, parseFile, parseSample, parseSaved, parseText, type Loaded } from "./api";

/* ─────────────────────────────────────────────────────────
 * The DocuLaw state machine:
 *   start → intake (read file, pick a side, run the analysis) → ready
 * Every analysis fact arrives over SSE from /api/doculaw/analyze.
 * ───────────────────────────────────────────────────────── */

export type Phase = "start" | "intake" | "ready";
export type TaskKey = "read" | "structure" | "risks" | "rewrite";
export type TaskStatus = "pending" | "running" | "done" | "failed";
export type Task = { status: TaskStatus; amount: string; details: { label: string; meta: string }[]; progress: number };
export type RewriteMap = Record<string, Partial<Record<Level, { text: string; source: "fixture" | "rules" | "model" }>>>;

export type Structure = { title: string | null; docNoun: string; clauses: ClauseDTO[]; numbering: string[]; depth: number; roles: Roles };

type State = {
  phase: Phase;
  loading: "sample" | "file" | "paste" | null;
  error: string | null;
  doc: Loaded | null;
  perspective: string | null;
  tasks: Record<TaskKey, Task>;
  structure: Structure | null;
  risks: RiskFlag[];
  userFlags: RiskFlag[];
  obligations: Obligation[];
  keyDates: KeyDate[];
  rewrites: RewriteMap;
  analyzeError: string | null;
  notice: string | null;
  level: Level;
  fetchingLevels: Level[];
};

const freshTask = (): Task => ({ status: "pending", amount: "", details: [], progress: 0 });
const freshTasks = (): Record<TaskKey, Task> => ({ read: freshTask(), structure: freshTask(), risks: freshTask(), rewrite: freshTask() });

const INITIAL: State = {
  phase: "start",
  loading: null,
  error: null,
  doc: null,
  perspective: null,
  tasks: freshTasks(),
  structure: null,
  risks: [],
  userFlags: [],
  obligations: [],
  keyDates: [],
  rewrites: {},
  analyzeError: null,
  notice: null,
  level: "plain",
  fetchingLevels: [],
};

type Action =
  | { type: "load"; loading: State["loading"] }
  | { type: "loaded"; doc: Loaded }
  | { type: "loadFailed"; error: string }
  | { type: "side"; perspective: string }
  | { type: "task"; key: TaskKey; patch: Partial<Task> }
  | { type: "structure"; structure: Structure }
  | { type: "risks"; flags: RiskFlag[] }
  | { type: "obligations"; items: Obligation[] }
  | { type: "keyDates"; items: KeyDate[] }
  | { type: "rewrites"; items: { clauseId: string; level: Level; text: string; source: "fixture" | "rules" | "model" }[] }
  | { type: "analyzeError"; error: string }
  | { type: "notice"; message: string | null }
  | { type: "ready" }
  | { type: "reset" }
  | { type: "level"; level: Level }
  | { type: "perspective"; perspective: string }
  | { type: "fetchingLevel"; level: Level; on: boolean }
  | { type: "userFlag"; flag: RiskFlag };

const KIND_LABEL: Record<string, string> = { pdf: "PDF", docx: "Word (DOCX)", txt: "Plain text", md: "Markdown", paste: "Pasted text", sample: "Sample lease" };

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "load":
      return { ...INITIAL, phase: "intake", loading: a.loading, level: s.level, tasks: { ...freshTasks(), read: { ...freshTask(), status: "running" } } };
    case "loaded": {
      const { doc } = a;
      return {
        ...s,
        loading: null,
        doc,
        tasks: {
          ...s.tasks,
          read: {
            status: "done",
            progress: 1,
            amount: doc.doc.pages ? `${doc.doc.pages} ${doc.doc.pages === 1 ? "page" : "pages"}` : formatBytes(doc.doc.bytes),
            details: [
              { label: "Format", meta: KIND_LABEL[doc.doc.kind] ?? doc.doc.kind },
              { label: "Text extracted", meta: `${doc.doc.chars.toLocaleString("en-US")} chars` },
            ],
          },
        },
      };
    }
    case "loadFailed":
      return { ...INITIAL, level: s.level, error: a.error };
    case "side":
      return { ...s, perspective: a.perspective, fetchingLevels: [] };
    case "task":
      return { ...s, tasks: { ...s.tasks, [a.key]: { ...s.tasks[a.key], ...a.patch } } };
    case "structure":
      return { ...s, structure: a.structure };
    case "risks":
      return { ...s, risks: a.flags };
    case "obligations":
      return { ...s, obligations: a.items };
    case "keyDates":
      return { ...s, keyDates: a.items };
    case "rewrites": {
      const next = { ...s.rewrites };
      for (const r of a.items) next[r.clauseId] = { ...next[r.clauseId], [r.level]: { text: r.text, source: r.source } };
      return { ...s, rewrites: next };
    }
    case "analyzeError": {
      const tasks = { ...s.tasks };
      for (const k of Object.keys(tasks) as TaskKey[]) if (tasks[k].status === "running") tasks[k] = { ...tasks[k], status: "failed" };
      return { ...s, analyzeError: a.error, tasks };
    }
    case "notice":
      return { ...s, notice: a.message };
    case "ready":
      return { ...s, phase: "ready" };
    case "reset":
      return { ...INITIAL, level: s.level };
    case "level":
      return { ...s, level: a.level };
    case "perspective":
      return { ...s, perspective: a.perspective };
    case "fetchingLevel":
      return { ...s, fetchingLevels: a.on ? [...new Set([...s.fetchingLevels, a.level])] : s.fetchingLevels.filter((l) => l !== a.level) };
    case "userFlag":
      return { ...s, userFlags: [...s.userFlags.filter((f) => f.id !== a.flag.id), a.flag] };
  }
}

export function useDocuLaw(live: boolean) {
  const [s, dispatch] = useReducer(reducer, INITIAL);
  const abort = useRef<AbortController | null>(null);
  const documentGeneration = useRef(0);
  const levelRequests = useRef(new Map<Level, AbortController>());

  const cancel = useCallback(() => {
    documentGeneration.current++;
    abort.current?.abort();
    abort.current = null;
    for (const request of levelRequests.current.values()) request.abort();
    levelRequests.current.clear();
  }, []);

  useEffect(() => cancel, [cancel]);

  const runAnalysis = useCallback(
    async (doc: Loaded, perspective: string) => {
      cancel();
      const ctrl = new AbortController();
      abort.current = ctrl;
      const generation = documentGeneration.current;
      const isCurrent = () => !ctrl.signal.aborted && documentGeneration.current === generation;
      dispatch({ type: "side", perspective });
      let buffer: { clauseId: string; level: Level; text: string; source: "fixture" | "rules" | "model" }[] = [];
      let raf = 0;
      const flush = () => {
        raf = 0;
        if (isCurrent() && buffer.length) dispatch({ type: "rewrites", items: buffer });
        buffer = [];
      };
      const source = doc.doc.sampleId ? "Hand-written for the sample" : live ? "Groq" : "Rule-based reading";
      try {
        await postSSE(
          "/api/doculaw/analyze",
          { text: doc.text, sampleId: doc.doc.sampleId },
          (event, raw) => {
            if (!isCurrent()) return;
            const data = raw as Record<string, unknown>;
            switch (event) {
              case "task": {
                const id = data.id as TaskKey;
                const status = data.status as TaskStatus;
                if (id === "structure") {
                  dispatch({
                    type: "task",
                    key: "structure",
                    patch:
                      status === "done"
                        ? {
                            status,
                            progress: 1,
                            amount: `${data.count} clauses`,
                            details: [
                              { label: "Numbering", meta: (data.numbering as string[]).join(" · ") || "Paragraphs" },
                              { label: "Deepest nesting", meta: `${data.depth} ${data.depth === 1 ? "level" : "levels"}` },
                            ],
                          }
                        : { status },
                  });
                } else if (id === "risks") {
                  dispatch({
                    type: "task",
                    key: "risks",
                    patch:
                      status === "done"
                        ? {
                            status,
                            progress: 1,
                            amount: `${data.count} ${data.count === 1 ? "flag" : "flags"}`,
                            details: [
                              { label: "High", meta: String(data.high) },
                              { label: "Medium", meta: String(data.medium) },
                              { label: "Low", meta: String(data.low) },
                            ],
                          }
                        : { status },
                  });
                } else if (id === "rewrite") {
                  const total = Number(data.total ?? 0);
                  const done = Number(data.done ?? 0);
                  dispatch({
                    type: "task",
                    key: "rewrite",
                    patch: {
                      status,
                      amount: `${done}/${total}`,
                      progress: total ? done / total : 0,
                      details: [
                        { label: "Levels", meta: live ? "Plain first, others on demand" : "Lawyer · Plain · ELI5" },
                        { label: "Written by", meta: source },
                      ],
                    },
                  });
                }
                break;
              }
              case "structure":
                dispatch({ type: "structure", structure: data as unknown as Structure });
                break;
              case "risks":
                dispatch({ type: "risks", flags: data.flags as RiskFlag[] });
                break;
              case "obligations":
                dispatch({ type: "obligations", items: data.items as Obligation[] });
                break;
              case "keyDates":
                dispatch({ type: "keyDates", items: data.items as KeyDate[] });
                break;
              case "rewrite":
                buffer.push(data as unknown as (typeof buffer)[number]);
                if (!raf) raf = requestAnimationFrame(flush);
                break;
              case "progress": {
                const total = Number(data.total ?? 0);
                const done = Number(data.done ?? 0);
                dispatch({ type: "task", key: "rewrite", patch: { amount: `${done}/${total}`, progress: total ? done / total : 0 } });
                break;
              }
              case "notice":
                dispatch({ type: "notice", message: String(data.message ?? "") });
                break;
              case "error":
                dispatch({ type: "analyzeError", error: String(data.message ?? "Something went wrong.") });
                break;
            }
          },
          ctrl.signal,
        );
        if (raf) cancelAnimationFrame(raf);
        flush();
      } catch (err) {
        if (ctrl.signal.aborted) return;
        dispatch({ type: "analyzeError", error: err instanceof Error ? err.message : "The analysis stopped." });
      }
    },
    [live, cancel],
  );

  const load = useCallback(
    async (kind: "sample" | "file" | "paste" | "saved", input?: File | string) => {
      cancel();
      const ctrl = new AbortController();
      abort.current = ctrl;
      dispatch({ type: "load", loading: kind === "saved" ? "file" : kind });
      try {
        const doc =
          kind === "saved" ? await parseSaved(input as string, ctrl.signal) : kind === "sample" ? await parseSample("lease-v1", ctrl.signal) : kind === "file" ? await parseFile(input as File, ctrl.signal) : await parseText(input as string, undefined, ctrl.signal);
        if (ctrl.signal.aborted) return;
        dispatch({ type: "loaded", doc });
        // no clear parties: read it neutrally without asking
        if (doc.roles.parties.length < 2) void runAnalysis(doc, "neutral");
      } catch (err) {
        if (ctrl.signal.aborted) return;
        dispatch({ type: "loadFailed", error: err instanceof Error ? err.message : "Couldn't read that document." });
      }
    },
    [runAnalysis, cancel],
  );

  const chooseSide = useCallback(
    (perspective: string) => {
      if (s.doc) void runAnalysis(s.doc, perspective);
    },
    [s.doc, runAnalysis],
  );

  const retry = useCallback(() => {
    if (s.doc && s.perspective) void runAnalysis(s.doc, s.perspective);
  }, [s.doc, s.perspective, runAnalysis]);

  const reset = useCallback(() => {
    cancel();
    dispatch({ type: "reset" });
  }, [cancel]);

  // intake → ready: shortly after the last task finishes (live mode: once risks are in)
  useEffect(() => {
    if (s.phase !== "intake") return;
    const rw = s.tasks.rewrite.status;
    if (rw === "done") {
      const t = setTimeout(() => {
        dispatch({ type: "ready" });
        playSfx("success");
      }, 700);
      return () => clearTimeout(t);
    }
    if (live && s.tasks.risks.status === "done") {
      const t = setTimeout(() => dispatch({ type: "ready" }), 4000);
      return () => clearTimeout(t);
    }
  }, [s.phase, s.tasks.rewrite.status, s.tasks.risks.status, live]);

  const setLevel = useCallback(
    async (level: Level) => {
      dispatch({ type: "level", level });
      playSfx("toggle", 0.6);
      const st = s.structure;
      if (!live || !st) return;
      const missing = st.clauses.filter((c) => c.text.trim() && !s.rewrites[c.id]?.[level]);
      if (!missing.length || levelRequests.current.has(level)) return;
      const ctrl = new AbortController();
      const generation = documentGeneration.current;
      const isCurrent = () => !ctrl.signal.aborted && documentGeneration.current === generation;
      levelRequests.current.set(level, ctrl);
      dispatch({ type: "fetchingLevel", level, on: true });
      try {
        await postSSE(
          "/api/doculaw/simplify",
          {
            level,
            sampleId: s.doc?.doc.sampleId ?? null,
            roles: st.roles,
            docNoun: st.docNoun,
            clauses: missing.map((c) => ({ id: c.id, citation: c.citation, title: c.title, text: c.text })),
          },
          (event, data) => {
            if (!isCurrent()) return;
            if (event === "rewrite") dispatch({ type: "rewrites", items: [data as { clauseId: string; level: Level; text: string; source: "fixture" | "rules" | "model" }] });
          },
          ctrl.signal,
        );
      } catch {
        if (isCurrent()) dispatch({ type: "notice", message: "Couldn't load that level. Try again in a moment." });
      } finally {
        if (levelRequests.current.get(level) === ctrl) levelRequests.current.delete(level);
        if (isCurrent()) dispatch({ type: "fetchingLevel", level, on: false });
      }
    },
    [live, s.structure, s.rewrites, s.fetchingLevels, s.doc],
  );

  const setPerspective = useCallback((p: string) => dispatch({ type: "perspective", perspective: p }), []);
  const addUserFlag = useCallback((flag: RiskFlag) => dispatch({ type: "userFlag", flag }), []);
  const dismissNotice = useCallback(() => dispatch({ type: "notice", message: null }), []);

  const allFlags = useMemo(() => [...s.risks, ...s.userFlags], [s.risks, s.userFlags]);

  return { s, load, chooseSide, retry, reset, setLevel, setPerspective, addUserFlag, dismissNotice, allFlags };
}

export type DocuLawStore = ReturnType<typeof useDocuLaw>;
