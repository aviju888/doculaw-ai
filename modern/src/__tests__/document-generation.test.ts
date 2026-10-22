import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useDocuLaw } from "../components/doculaw/useDocuLaw";
import { parseText } from "../components/doculaw/api";
import { postSSE } from "../lib/sse-client";
import { analyze } from "../lib/doculaw/analyze";
vi.mock("../components/doculaw/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../components/doculaw/api")>()),
  parseText: vi.fn(),
}));
vi.mock("../lib/sse-client", () => ({ postSSE: vi.fn() }));
type Pending = {
  signal?: AbortSignal;
  emit: (event: string, data: unknown) => void;
  resolve: () => void;
  reject: (error: Error) => void;
};
let pending: Pending[] = [];
const textA =
  "1. Payment\nYou must pay $500 each month.\n2. End\nYou may end after 30 days.";
const textB = textA.replace("$500", "$700");
beforeEach(() => {
  pending = [];
  vi.mocked(parseText).mockImplementation(async (text) => {
    const a = analyze(text);
    return {
      doc: {
        name: "Owned contract",
        kind: "paste",
        bytes: text.length,
        pages: null,
        chars: text.length,
        sampleId: null,
      },
      text,
      roles: { parties: [], names: {}, payer: null },
      title: a.title,
      clauseCount: a.clauses.length,
    };
  });
  vi.mocked(postSSE).mockImplementation(async (url, body, emit, signal) => {
    if (url.endsWith("/analyze")) {
      const a = analyze((body as { text: string }).text);
      emit("structure", a);
      for (const c of a.clauses)
        emit("rewrite", {
          clauseId: c.id,
          level: "plain",
          text: c.text,
          source: "rules",
        });
      emit("task", {
        id: "rewrite",
        status: "done",
        done: a.clauses.length,
        total: a.clauses.length,
      });
      return;
    }
    // Deliberately ignore abort: a queued callback may arrive after cancellation.
    return new Promise<void>((resolve, reject) =>
      pending.push({ signal, emit, resolve, reject }),
    );
  });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
for (const change of ["reset", "load"] as const) {
  it(`ignores delayed A rewrites and completion after ${change} loads B with repeated clause IDs`, async () => {
    const { result } = renderHook(() => useDocuLaw(true));
    await act(async () => {
      await result.current.load("paste", textA);
    });
    await waitFor(() =>
      expect(result.current.s.structure?.clauses[0].id).toBe("1"),
    );
    await act(async () => {
      void result.current.setLevel("eli5");
    });
    const old = pending[0];
    await act(async () => {
      if (change === "reset") result.current.reset();
      await result.current.load("paste", textB);
    });
    await waitFor(() => expect(result.current.s.doc?.text).toBe(textB));
    await act(async () => {
      void result.current.setLevel("eli5");
    });
    const current = pending[1];
    await act(async () => {
      old.emit("rewrite", {
        clauseId: "1",
        level: "eli5",
        text: "STALE DOCUMENT A: pay $500.",
        source: "model",
      });
      old.resolve();
    });
    expect(result.current.s.rewrites["1"]?.eli5?.text).toBeUndefined();
    expect(result.current.s.fetchingLevels).toEqual(["eli5"]);
    expect(old.signal?.aborted).toBe(true);
    await act(async () => {
      current.emit("rewrite", {
        clauseId: "1",
        level: "eli5",
        text: "DOCUMENT B: pay $700.",
        source: "model",
      });
      current.resolve();
    });
    expect(result.current.s.rewrites["1"]?.eli5?.text).toBe(
      "DOCUMENT B: pay $700.",
    );
    expect(result.current.s.fetchingLevels).toEqual([]);
  });
}
it("ignores a delayed old failure instead of showing its notice on the new document", async () => {
  const { result } = renderHook(() => useDocuLaw(true));
  await act(async () => {
    await result.current.load("paste", textA);
  });
  await waitFor(() => expect(result.current.s.structure).toBeTruthy());
  await act(async () => {
    void result.current.setLevel("eli5");
  });
  const old = pending[0];
  await act(async () => {
    await result.current.load("paste", textB);
  });
  await act(async () => {
    old.reject(new Error("Old request failed"));
  });
  expect(result.current.s.doc?.text).toBe(textB);
  expect(result.current.s.notice).toBeNull();
});
it("aborts pending level requests when the workspace unmounts", async () => {
  const { result, unmount } = renderHook(() => useDocuLaw(true));
  await act(async () => {
    await result.current.load("paste", textA);
  });
  await waitFor(() => expect(result.current.s.structure).toBeTruthy());
  await act(async () => {
    void result.current.setLevel("eli5");
  });
  const old = pending[0];
  unmount();
  expect(old.signal?.aborted).toBe(true);
  old.resolve();
});
