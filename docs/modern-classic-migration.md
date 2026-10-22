# DocuLaw modern + Classic migration

Status: locally implemented and validated; independent review pending. No push, merge, deployment or live-provider acceptance is authorized.

Baseline: original product commit `3cf3b67f8e3248498ce5ffdd09501a2abf2aef40`. Original README-only changes describe the product but are excluded from the baseline. Tracked dependency damage and the nested older checkout are excluded. Original checkouts are read-only. Source reference tree has no Git metadata at its given path; file fingerprints will accompany the port.

## System map

```
/ (modern Vite document) ------> /api/doculaw/* (Express streaming adapter)
  |                                  |-- parse PDF/DOCX/TXT/MD or paste
  |                                  |-- analyze / simplify / Q&A / compare
  |                                  |-- Groq only with server key; labelled rules otherwise
  |                                  `-- explicit saved uploads -> existing document store
  |
  `-- /classic (original CRA document) -> /api/documents, /api/chat, /api/search
         `-- original /home, /documents/:id, /upload and other deep links
```

Ruling: retain CRA for Classic and use a small Vite bundle for the current workspace — avoids rewriting Classic or mixing incompatible Tailwind generations. Cost: two frontend builds.

Ruling: preserve original access paths and storage keys. Full document navigation isolates global styles and disposes modern streams; Classic stays functional at /classic and its old deep links. Modern's explicit library uploads write to the existing store; opening a sample or pasted text is not described as a saved upload.

Ruling: original provider clients throw on startup without keys. Make initialization lazy so parsing, grounded rules, storage and UI can work without credentials. Provider actions must still report unavailable rather than fake a success.

## Acceptance checklist

- [x] Baseline builds/tests inspected and results recorded
- [x] Default modern + Classic switching and old deep links
- [x] PDF/DOCX/TXT/MD, pasted text, malformed/empty/oversized input
- [x] Analysis, reading levels, selection, comparison, cited Q&A
- [x] Saved documents shared with Classic, storage survives restart
- [x] Missing-provider and failed-request paths visibly honest
- [x] Backend/frontend typechecks and builds
- [x] Desktop/mobile previews and screenshots
- [x] Reviewable local commit, maintained report, no publish

No storage migration or backfill. Backend must run on a Node host with writable persistent storage; existing static Vercel hosting requires a configured API backend and remains unverified. The backend's pre-existing lack of authentication is not changed by this migration; use only owned fixtures locally.

## Delivered behavior and compatibility decisions

- `modern/` contains the actual current workspace components, shared UI atoms, restrained reference tokens, and a small standalone header/library. No reference-project shell, filesystem settings, sound assets, credential files, or project navigation is imported. `docs/reference-sources.sha256` fingerprints every researched/ported source file; the supplied reference tree has no Git metadata, so no reference SHA is asserted. The product baseline SHA above is verified.
- Express adapts the six modern Web Request/Response handlers, including streaming, to the existing server. JSON bodies are bounded at 6 MB; multipart modern uploads at 5 MB. The original Classic upload envelope and 10 MB transport limit remain, and text uploads retain their original raw text. PDF/DOCX extraction now reads the document instead of storing binary bytes as UTF-8. Legacy `.doc` is explicitly unsupported.
- Both upload entrypoints share `services/uploads.ts`: the original filesystem store and optional OpenAI/Pinecone indexing. Existing records need no migration. Modern samples/paste are session-only. Modern saved-document links preserve the original document ID.
- Classic layout, original route paths, onboarding/browser profile keys and UI controls remain. Migration compatibility wiring replaces original fixture/timer success in upload, list/view, chat, search and dashboard with existing APIs. A mismatched `/document/:id` link is corrected to its existing `/documents/:id` route. Missing provider errors are visible, and synthetic dashboard savings are shown as unavailable rather than invented measurements.
- Provider initialization is lazy. Groq is shared by both interfaces with GPT-OSS 20B/120B defaults, low reasoning, hidden reasoning and 256 tokens of completion headroom; existing per-operation budgets remain. The UI says configured rather than claiming a successful provider connection. Payload/stream fixtures cover JSON, model IDs, budget fields, hidden reasoning, empty/truncated replies, and Classic use of the same adapter. These do not establish live provider acceptance. Current provider settings were checked against [Groq reasoning docs](https://console.groq.com/docs/reasoning) and [deprecation policy](https://console.groq.com/docs/deprecations).
- Ruling: use Zod 3.25's compatible validation API rather than importing reference Zod 4 into the original OpenAI 4 SDK dependency graph. Cost if wrong: schema-specific compatibility regression; full schema/HTTP checks pass.
- Ruling: original tracked dependencies are excluded from source commits. This isolated clone used sparse checkout before installing fresh dependencies; its local tracked `frontend/node_modules` entries are marked assume-unchanged to exclude baseline dependency churn. No original dependency directory was copied or modified. Cost: a local reviewer must inspect source/build results rather than interpreting dependency-file working status.

## Validation evidence

- `npm test --prefix backend`: **129 tests passed** (118 ported pure parsing/analysis/retrieval tests, 6 real HTTP/stream/storage tests, 5 provider boundary tests).
- The storage test stops and restarts the backend with the same temporary owned-fixture directory and confirms Classic retrieval and modern reopening preserve the same ID/content.
- `CI=true npm run build`: backend TypeScript + Classic CRA + modern TypeScript/Vite + combined `site/` packaging passed. Classic's stale Browserslist dataset prints an informational notice; the final CI build compiles successfully.
- `npm run typecheck`: modern TypeScript, original frontend TypeScript, backend TypeScript passed.
- `CI=true npm test --prefix frontend -- --watch=false --passWithNoTests`: no original tests exist (exit 0); this is not claimed as UI coverage.
- `scripts/browser-smoke.cjs`: real local sample analysis/question, file upload, shared library/reopen, Classic switch/library/view, real Classic upload, localStorage preservation and desktop/mobile checks. Review screenshots are delivered separately with the parent report.
- RED evidence: missing modern HTTP capability/no-key boot path failed before implementation. Provider payload tests failed on retired model IDs, absent reasoning-safe fields and silent empty replies before correction; the empty-stream regression failed before its guard was added. Browser harness locator mistakes (New button name, Chat button role, `/classic/` slash redirect) were corrected and rerun; they are not product defects.

## Review and remaining limits

Parent coordinator owns independent review. No push, PR, merge or deploy occurred. Only owned text fixtures and the included synthetic sample leases were used. Live Groq output/latency/account access, OpenAI embeddings, Pinecone indexing/search, hosted routes/persistence and provider permissions remain unverified. Existing filesystem persistence and authentication limitations remain; this branch is a local migration, not production-readiness certification.

The static Vercel package still needs an independently hosted backend, build-time public API origins and hosted acceptance. The combined Express build is the fully exercised local path. Rollback: return the default to the existing Classic document or revert this feature commit; data remains in the original format.

Recommendation: independently review both interfaces locally, then run bounded provider/hosted acceptance with owned fixtures before deciding whether to publish the branch.
