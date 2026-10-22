/* ─────────────────────────────────────────────────────────
 * LLM — one door to Groq (OpenAI-compatible chat completions).
 * Server-only: reads GROQ_API_KEY from the server environment.
 *
 * Every caller must handle the no-key case with a scripted
 * fallback (see lib/scripted.ts) so parsing works without provider credentials.
 * ───────────────────────────────────────────────────────── */

export type Msg = { role: "system" | "user" | "assistant"; content: string };

export const MODELS = {
  fast: "openai/gpt-oss-20b",
  deep: "openai/gpt-oss-120b",
} as const;

export type ModelKey = keyof typeof MODELS;

export type CompleteOpts = {
  messages: Msg[];
  model?: ModelKey;
  /** ask Groq for a JSON object response */
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
};

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export function hasLLM(): boolean {
  return Boolean(process.env.GROQ_API_KEY);
}

/** "live" when a Groq key is configured, otherwise "demo" (scripted). */
export function llmMode(): "live" | "demo" {
  return hasLLM() ? "live" : "demo";
}

function body(opts: CompleteOpts, stream: boolean) {
  return JSON.stringify({
    model:
      process.env[
        opts.model === "deep" ? "GROQ_DEEP_MODEL" : "GROQ_FAST_MODEL"
      ] || MODELS[opts.model ?? "fast"],
    messages: opts.messages,
    temperature: opts.temperature ?? 0.3,
    max_completion_tokens: (opts.maxTokens ?? 1200) + 256,
    reasoning_effort: "low",
    include_reasoning: false,
    stream,
    ...(opts.json ? { response_format: { type: "json_object" } } : {}),
  });
}

async function post(opts: CompleteOpts, stream: boolean): Promise<Response> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY is not set");
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: body(opts, stream),
    signal: opts.signal
      ? AbortSignal.any([opts.signal, AbortSignal.timeout(45_000)])
      : AbortSignal.timeout(45_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Groq ${res.status}: ${detail.slice(0, 300)}`);
  }
  return res;
}

/** Single completion, returns the full text. */
export async function complete(opts: CompleteOpts): Promise<string> {
  const res = await post(opts, false);
  const data = (await res.json()) as {
    choices?: { message?: { content?: string }; finish_reason?: string }[];
  };
  const choice = data.choices?.[0];
  if (!choice?.message?.content?.trim() || choice.finish_reason === "length")
    throw new Error("The provider did not return a complete answer.");
  return choice.message.content;
}

/** Completion parsed as JSON. Throws if the model returns invalid JSON. */
export async function completeJSON<T>(
  opts: Omit<CompleteOpts, "json">,
): Promise<T> {
  const text = await complete({ ...opts, json: true });
  return JSON.parse(text) as T;
}

/** Streams content deltas as they arrive. */
export async function* stream(opts: CompleteOpts): AsyncGenerator<string> {
  const res = await post(opts, true);
  if (!res.body)
    throw new Error("The provider did not return a complete answer.");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let receivedContent = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") {
          if (!receivedContent)
            throw new Error("The provider did not return a complete answer.");
          return;
        }
        try {
          const chunk = JSON.parse(payload) as {
            choices?: {
              delta?: { content?: string };
              finish_reason?: string;
            }[];
          };
          if (chunk.choices?.[0]?.finish_reason === "length")
            throw new Error("The provider response was cut short.");
          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) {
            receivedContent = true;
            yield delta;
          }
        } catch (err) {
          if (!(err instanceof SyntaxError)) throw err;
        }
      }
    }
    if (!receivedContent)
      throw new Error("The provider did not return a complete answer.");
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
