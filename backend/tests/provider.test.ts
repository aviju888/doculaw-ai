import { afterEach, expect, it, vi } from "vitest";
import { completeJSON, stream, complete } from "../src/modern/lib/llm";
import {
  simplifyDocument,
  summarizeDocument,
  generateChatResponse,
} from "../src/services/groq";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
function provider(reply: Response) {
  const calls: { url: string; body: any }[] = [];
  const responseText = reply.text();
  vi.stubEnv("GROQ_API_KEY", "owned-test-placeholder");
  vi.stubGlobal("fetch", async (url: string, opts: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(opts.body)) });
    return new Response(await responseText, {
      status: reply.status,
      headers: reply.headers,
    });
  });
  return calls;
}
it("sends current Groq model, JSON mode and reasoning-safe completion budget", async () => {
  const calls = provider(
    Response.json({
      choices: [
        {
          message: {
            content: '{"rewrites":[{"id":"one","text":"Pay $500."}]}',
            reasoning: "private provider reasoning",
          },
        },
      ],
    }),
  );
  expect(
    await completeJSON({
      model: "deep",
      maxTokens: 2400,
      messages: [{ role: "user", content: "Rewrite an owned fixture" }],
    }),
  ).toMatchObject({ rewrites: [{ id: "one" }] });
  expect(calls[0].url).toBe("https://api.groq.com/openai/v1/chat/completions");
  expect(calls[0].body).toMatchObject({
    model: "openai/gpt-oss-120b",
    reasoning_effort: "low",
    include_reasoning: false,
    max_completion_tokens: 2656,
    response_format: { type: "json_object" },
    stream: false,
  });
  expect(calls[0].body.max_tokens).toBeUndefined();
});
it("streams only final answer content from the current fast model", async () => {
  const calls = provider(
    new Response(
      'data: {"choices":[{"delta":{"reasoning":"internal"}}]}\n\ndata: {"choices":[{"delta":{"content":"Pay $500."}}]}\n\ndata: [DONE]\n\n',
    ),
  );
  let answer = "";
  for await (const part of stream({
    model: "fast",
    maxTokens: 300,
    messages: [{ role: "user", content: "Owned fixture?" }],
  }))
    answer += part;
  expect(answer).toBe("Pay $500.");
  expect(calls[0].body).toMatchObject({
    model: "openai/gpt-oss-20b",
    reasoning_effort: "low",
    include_reasoning: false,
    max_completion_tokens: 556,
    stream: true,
  });
});
it("keeps Classic simplification, summary and chat on the same current provider adapter", async () => {
  const calls = provider(
    Response.json({
      choices: [{ message: { content: "Owned final answer." } }],
    }),
  );
  expect(await simplifyDocument("Owned document text.")).toBe(
    "Owned final answer.",
  );
  expect(await summarizeDocument("Owned document text.")).toBe(
    "Owned final answer.",
  );
  expect(
    await generateChatResponse("Owned question?", ["Owned context."]),
  ).toBe("Owned final answer.");
  expect(calls.map((c) => c.body.max_completion_tokens)).toEqual([
    2256, 456, 1256,
  ]);
  for (const c of calls) {
    expect(c.url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(c.body).toMatchObject({
      model: "openai/gpt-oss-20b",
      include_reasoning: false,
      reasoning_effort: "low",
    });
  }
});
it("rejects truncated or empty provider output so callers can label fallback instead of showing success", async () => {
  provider(
    Response.json({
      choices: [{ message: { content: "" }, finish_reason: "length" }],
    }),
  );
  await expect(
    complete({ messages: [{ role: "user", content: "Owned" }] }),
  ).rejects.toThrow();
});
it("rejects a provider stream with no final answer content", async () => {
  provider(
    new Response(
      'data: {"choices":[{"delta":{"reasoning":"internal"}}]}\n\ndata: [DONE]\n\n',
    ),
  );
  await expect(
    (async () => {
      let answer = "";
      for await (const part of stream({
        messages: [{ role: "user", content: "Owned fixture?" }],
      }))
        answer += part;
      return answer;
    })(),
  ).rejects.toThrow("complete answer");
});
