import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { DocuLawApp } from "./components/doculaw/DocuLawApp";
import "./theme.css";
import { apiURL } from "./lib/http";
import { Library } from "./Library";
function App() {
  const [mode, setMode] = useState<"loading" | "live" | "rules" | "offline">(
    "loading",
  );
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    fetch(apiURL("/api/doculaw/status"), { signal: c.signal })
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((d) => setMode(d.mode === "live" ? "live" : "rules"))
      .catch((e) => {
        if (e.name !== "AbortError") setMode("offline");
      });
    return () => c.abort();
  }, [retry]);
  return (
    <>
      <header className="flex h-12 items-center justify-between gap-3 border-b border-line bg-surface px-4 sm:px-6">
        <a href="/" className="text-[14px] font-semibold">
          DocuLaw AI
        </a>
        <nav
          className="flex items-center gap-4 text-[12px] text-ink-2"
          aria-label="Application"
        >
          <span>
            {mode === "live"
              ? "AI configured"
              : mode === "rules"
                ? "Rule-based reading"
                : mode === "offline"
                  ? "Backend unavailable"
                  : "Connecting…"}
          </span>
          <a className="hover:text-ink" href="/?library=1">
            Documents
          </a>
          <a className="hover:text-ink" href="/classic">
            Classic ↗
          </a>
        </nav>
      </header>
      {mode === "loading" ? (
        <p className="p-6 text-sm" role="status">
          Connecting to DocuLaw…
        </p>
      ) : mode === "offline" ? (
        <div className="mx-auto max-w-lg p-8">
          <h1 className="text-xl font-medium">
            DocuLaw could not connect to its backend.
          </h1>
          <p className="my-3 text-sm text-ink-2">
            Start the server and try again to read your documents.
          </p>
          <button
            className="rounded-control bg-ink px-3 py-2 text-sm text-surface"
            onClick={() => {
              setMode("loading");
              setRetry((r) => r + 1);
            }}
          >
            Try again
          </button>
        </div>
      ) : new URLSearchParams(window.location.search).has("library") ? (
        <Library />
      ) : (
        <DocuLawApp live={mode === "live"} />
      )}
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
