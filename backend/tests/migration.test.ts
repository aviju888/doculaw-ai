import { beforeAll, afterAll, expect, it } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const port = 34319;
const base = `http://127.0.0.1:${port}`;
const dataDir = mkdtempSync(join(tmpdir(), "doculaw-owned-"));
let server: ChildProcess;
const text =
  "SERVICE AGREEMENT\n1. Payment\nThe Client shall pay the Provider $500 per month.\n2. Termination\nEither party may terminate this agreement by giving 30 days written notice.";
const post = (path: string, body: unknown) =>
  fetch(base + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
async function startServer() {
  server = spawn(process.execPath, ["--import", "tsx", "src/index.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      HOST: "127.0.0.1",
      DOCULAW_DATA_DIR: dataDir,
      OPENAI_API_KEY: "",
      GROQ_API_KEY: "",
      PINECONE_API_KEY: "",
    },
    stdio: "ignore",
  });
  for (let i = 0; i < 70; i++) {
    try {
      if ((await fetch(base + "/api/health")).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error("Backend failed to start without provider keys");
}
beforeAll(startServer);
afterAll(() => {
  server?.kill();
  rmSync(dataDir, { recursive: true, force: true });
});
it("reports the real provider capability without exposing credentials", async () => {
  const res = await fetch(base + "/api/doculaw/status");
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ mode: "rules" });
});
it("parses a harmless uploaded text file and saves it in the original library", async () => {
  const form = new FormData();
  form.append(
    "file",
    new Blob([text], { type: "text/plain" }),
    "owned-service.txt",
  );
  const res = await fetch(base + "/api/doculaw/parse", {
    method: "POST",
    body: form,
  });
  expect(res.status).toBe(200);
  const parsed = await res.json();
  expect(parsed.text).toBe(text);
  expect(parsed.doc.documentId).toBeTruthy();
  const legacy = await (
    await fetch(base + "/api/documents/" + parsed.doc.documentId)
  ).json();
  expect(legacy.data.originalContent).toBe(text);
  const list = await (await fetch(base + "/api/documents")).json();
  expect(list.data.some((d: any) => d.id === parsed.doc.documentId)).toBe(true);
});
it("parses pasted content without persisting it and rejects bad input", async () => {
  const res = await post("/api/doculaw/parse", { text, name: "Owned paste" });
  expect(res.status).toBe(200);
  expect((await res.json()).doc.documentId).toBeUndefined();
  expect((await post("/api/doculaw/parse", { text: "short" })).status).toBe(
    422,
  );
  expect(
    (await post("/api/doculaw/parse", { sample: "toString" })).status,
  ).toBe(404);
  const form = new FormData();
  form.append("file", new Blob([]), "empty.txt");
  expect(
    (await fetch(base + "/api/doculaw/parse", { method: "POST", body: form }))
      .status,
  ).toBe(400);
  expect((await post("/api/doculaw/analyze", {})).status).toBe(400);
});
it("streams structure, risks and all reading levels, then answers from the actual clauses", async () => {
  const res = await post("/api/doculaw/analyze", { text });
  expect(res.headers.get("content-type")).toContain("text/event-stream");
  const stream = await res.text();
  expect(stream).toContain("event: structure");
  expect(stream).toContain("event: done");
  expect(stream).toContain('"source":"rules"');
  const frames = stream
    .split("\n\n")
    .filter(Boolean)
    .map((f) => ({
      event: f.split("\n")[0].slice(7),
      data: JSON.parse(f.split("\n")[1].slice(6)),
    }));
  const structure = frames.find((f) => f.event === "structure")!.data;
  const chat = await post("/api/doculaw/chat", {
    question: "How much must the client pay?",
    clauses: structure.clauses,
    roles: structure.roles,
    docNoun: "agreement",
    perspective: "neutral",
  });
  const answer = await chat.text();
  expect(answer).toContain("event: context");
  expect(answer).toContain("event: answer");
  expect(answer).toContain("500");
  expect(answer).toContain("event: done");
  const simplified = await post("/api/doculaw/simplify", {
    level: "eli5",
    clauses: structure.clauses,
    roles: structure.roles,
    docNoun: "agreement",
  });
  expect(await simplified.text()).toContain("event: rewrite");
  const clause = structure.clauses.find((c: any) => c.text.includes("$500"));
  const selected = await post("/api/doculaw/selection", {
    action: "explain",
    selection: "$500 per month",
    clause,
    roles: structure.roles,
    perspective: "neutral",
  });
  expect(await selected.text()).toContain("event: answer");
  const compared = await post("/api/doculaw/compare", {
    a: { text },
    b: { text: text.replace("$500", "$600") },
  });
  expect(compared.status).toBe(200);
  expect(JSON.stringify(await compared.json())).toContain("600");
});
it("keeps Classic API envelopes and reports provider unavailability honestly", async () => {
  const session = await (await post("/api/chat/sessions", {})).json();
  expect(session.success).toBe(true);
  const res = await post(
    "/api/chat/sessions/" + session.data.id + "/messages",
    { content: "What does it mean?" },
  );
  expect(res.status).toBe(503);
  expect((await res.json()).success).toBe(false);
  const form = new FormData();
  form.append("document", new Blob([text]), "classic-owned.txt");
  const uploaded = await (
    await fetch(base + "/api/documents/upload", { method: "POST", body: form })
  ).json();
  expect(uploaded.success).toBe(true);
  const simplified = await post("/api/documents/simplify", {
    documentId: uploaded.data.documentId,
  });
  expect(simplified.status).toBe(503);
});

it("preserves original storage across a backend restart and reopens the same ID in the modern workspace", async () => {
  const documents = await (await fetch(base + "/api/documents")).json();
  const id = documents.data[0].id;
  await new Promise<void>((resolve) => {
    server.once("exit", () => resolve());
    server.kill();
  });
  await startServer();
  const legacy = await (await fetch(base + "/api/documents/" + id)).json();
  expect(legacy.data.originalContent).toBe(text);
  const modern = await (
    await post("/api/doculaw/parse", { documentId: id })
  ).json();
  expect(modern.doc.documentId).toBe(id);
  expect(modern.text).toBe(text);
});
