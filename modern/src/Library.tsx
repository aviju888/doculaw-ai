import { useEffect, useState } from "react";
import { apiURL } from "./lib/http";
type Doc = { id: string; title: string; uploadDate: string; fileSize: number };
export function Library() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const c = new AbortController();
    fetch(apiURL("/api/documents"), { signal: c.signal })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok || !d.success) throw Error("Could not load your documents.");
        setDocs(d.data);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => setLoading(false));
    return () => c.abort();
  }, []);
  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <div className="mb-7 flex items-center justify-between">
        <h1 className="text-2xl font-medium">Your documents</h1>
        <a
          href="/"
          className="rounded-control bg-ink px-3 py-2 text-sm text-surface"
        >
          Read a document
        </a>
      </div>
      {loading ? (
        <p role="status">Loading documents…</p>
      ) : error ? (
        <p role="alert" className="text-red">
          {error}
        </p>
      ) : docs.length === 0 ? (
        <p className="text-sm text-ink-2">
          Your uploaded documents will appear here.
        </p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card bg-surface shadow-card">
          {docs.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between gap-3 p-4"
            >
              <a
                className="min-w-0 flex-1 truncate text-sm font-medium"
                href={"/?document=" + encodeURIComponent(d.id)}
              >
                {d.title}
                <span className="mt-1 block text-xs font-normal text-ink-3">
                  {new Date(d.uploadDate).toLocaleDateString()} ·{" "}
                  {Math.ceil(d.fileSize / 1024)} KB
                </span>
              </a>
              <a
                className="text-xs text-ink-2"
                href={"/documents/" + encodeURIComponent(d.id)}
              >
                Classic ↗
              </a>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
