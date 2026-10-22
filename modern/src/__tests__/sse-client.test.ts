import { afterEach, expect, it, vi } from "vitest";
import { postSSE } from "../lib/sse-client";
afterEach(() => vi.unstubAllGlobals());
function response(body: string) {
  vi.stubGlobal(
    "fetch",
    async () =>
      new Response(body, { headers: { "content-type": "text/event-stream" } }),
  );
}
it("rejects a nonempty application stream that ends before its done frame", async () => {
  response('event: answer\ndata: {"delta":"You may terminate only if"}\n\n');
  const answers: string[] = [];
  await expect(
    postSSE("/api/doculaw/chat", {}, (event, data) => {
      if (event === "answer") answers.push((data as { delta: string }).delta);
    }),
  ).rejects.toThrow("complete");
  expect(answers).toEqual(["You may terminate only if"]);
});
it("accepts a completed application stream split across network chunks", async () => {
  const encoder = new TextEncoder();
  vi.stubGlobal(
    "fetch",
    async () =>
      new Response(
        new ReadableStream({
          start(c) {
            for (const s of [
              'event: answer\r\ndata: {"delta":"Pay $500."}\r\n\r\n',
              "event: do",
              "ne\ndata: {}\n\n",
            ])
              c.enqueue(encoder.encode(s));
            c.close();
          },
        }),
      ),
  );
  const events: string[] = [];
  await postSSE("/api/doculaw/chat", {}, (event) => events.push(event));
  expect(events).toEqual(["answer", "done"]);
});
it("rejects an unterminated done frame instead of blessing partial transport data", async () => {
  response('event: answer\ndata: {"delta":"Partial"}\n\nevent: done\ndata: {}');
  await expect(postSSE("/api/doculaw/chat", {}, () => {})).rejects.toThrow(
    "complete",
  );
});
