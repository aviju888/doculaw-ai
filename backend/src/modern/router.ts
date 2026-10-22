import {
  Router,
  Request as ExpressRequest,
  Response as ExpressResponse,
} from "express";
import multer from "multer";
import { saveUploadedDocument } from "../services/uploads";
import { POST as parse } from "./routes/parse/route";
import { POST as analyze } from "./routes/analyze/route";
import { POST as simplify } from "./routes/simplify/route";
import { POST as chat } from "./routes/chat/route";
import { POST as selection } from "./routes/selection/route";
import { POST as compare } from "./routes/compare/route";
import { hasLLM } from "./lib/llm";
import { getDocument } from "../services/storage";
import { MAX_BYTES, ParseError } from "./lib/doculaw/parse";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
});
router.get("/status", (_req, res) =>
  res.json({ mode: hasLLM() ? "live" : "rules", persistedUploads: true }),
);

function adapt(
  handler: (request: Request) => Promise<Response>,
  persist = false,
) {
  return async (req: ExpressRequest, res: ExpressResponse) => {
    const abort = new AbortController();
    const close = () => {
      if (!res.writableEnded) abort.abort();
    };
    res.on("close", close);
    try {
      let request: Request;
      if (req.file) {
        const form = new FormData();
        form.append(
          "file",
          new Blob([new Uint8Array(req.file.buffer)]),
          req.file.originalname,
        );
        request = new Request("http://doculaw.local" + req.originalUrl, {
          method: "POST",
          body: form,
          signal: abort.signal,
        });
      } else {
        request = new Request("http://doculaw.local" + req.originalUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(req.body ?? {}),
          signal: abort.signal,
        });
      }
      let response: Response;
      if (persist && typeof req.body?.documentId === "string") {
        const doc = getDocument(req.body.documentId);
        if (!doc) {
          res.status(404).json({ error: "Document not found." });
          return;
        }
        response = await parse(
          new Request("http://doculaw.local/parse", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              text: doc.originalContent,
              name: doc.title,
            }),
          }),
        );
        if (response.ok) {
          const data = (await response.json()) as any;
          data.doc.documentId = doc.id;
          response = Response.json(data);
        }
      } else {
        response = await handler(request);
        if (persist && req.file && response.ok) {
          const data = (await response.json()) as any;
          const document = saveUploadedDocument(data.text, req.file);
          data.doc.documentId = document.id;
          response = Response.json(data);
        }
      }
      res.status(response.status);
      response.headers.forEach((value, key) => res.setHeader(key, value));
      if (response.headers.get("content-type")?.includes("text/event-stream"))
        res.flushHeaders();
      if (!response.body) {
        res.end();
        return;
      }
      const reader = response.body.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done || abort.signal.aborted) break;
          res.write(Buffer.from(value));
        }
      } finally {
        if (abort.signal.aborted) await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
      res.end();
    } catch (error) {
      if (!res.headersSent) {
        res
          .status(error instanceof ParseError ? error.status : 500)
          .json({
            error:
              error instanceof ParseError
                ? error.message
                : "Unable to process that document. Please try again.",
          });
      } else res.end();
    } finally {
      res.off("close", close);
    }
  };
}
router.post(
  "/parse",
  (req, res, next) =>
    upload.single("file")(req, res, (error) => {
      if (error) {
        res
          .status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400)
          .json({
            error:
              error.code === "LIMIT_FILE_SIZE"
                ? "That file is over 5 MB. Try a smaller file."
                : "Attach one document in a file field.",
          });
        return;
      }
      next();
    }),
  adapt(parse, true),
);
for (const [name, handler] of Object.entries({
  analyze,
  simplify,
  chat,
  selection,
  compare,
}))
  router.post("/" + name, adapt(handler));
export default router;
