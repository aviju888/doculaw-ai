# DocuLaw modern + Classic migration

Status: locally implemented and validated; draft PR #3 now exists. Its automatic static preview failed at the configured-root install step; the source correction below is locally tested and pending coordinator review/push. No merge or manual deployment was performed by this task; live-provider and hosted backend acceptance remain unverified.

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

At the original local handoff, the parent coordinator owned independent review and no push, PR, merge or deploy had occurred. Later approved publishing and automatic-build evidence are recorded separately below. Only owned text fixtures and the included synthetic sample leases were used. Live Groq output/latency/account access, OpenAI embeddings, Pinecone indexing/search, hosted routes/persistence and provider permissions remain unverified. Existing filesystem persistence and authentication limitations remain; this branch is a local migration, not production-readiness certification.

The static Vercel package still needs an independently hosted backend, build-time public API origins and hosted acceptance. The combined Express build is the fully exercised local path. Rollback: return the default to the existing Classic document or revert this feature commit; data remains in the original format.

Recommendation: independently review both interfaces locally, then run bounded provider/hosted acceptance with owned fixtures before deciding whether to publish the branch.

## Independent review fix wave

The review of `a4d05c37` found two stream lifecycle defects. This focused follow-up rejects provider EOF without `[DONE]` or a successful `finish_reason: stop` event, and rejects application EOF without a complete `done` frame. Truncated content can no longer be represented as a completed answer. Stream readers are canceled/released on completion and failure.

On-demand reading levels now have individual AbortControllers plus a document-generation guard. Reset, load, reanalysis and unmount cancel all level requests; stale callbacks, errors and completion cleanup cannot modify the next document or clear its pending state. Primary-analysis callbacks and buffered rewrites use the same generation check.

Regression evidence: the old implementation failed on the exact nonempty provider EOF string `You may terminate only if`, two incomplete application-stream cases, delayed document A overwriting B's repeated clause ID `1`, stale A errors, and absent level-request unmount cancellation. All now pass. New frontend tests deliberately deliver callbacks after abort to verify the generation guard, not merely a cooperative network mock.

Tiny compatibility corrections: Classic formats the API's byte-valued file size with the existing formatter and displays unavailable optional stats as an em dash. Browser acceptance now waits for the completed assistant answer, then checks **that answer region** for the sample's `$75` late fee and a `§5` citation; the submitted question cannot satisfy those assertions. The labelled answer region adds accessibility without changing layout.

Validation: `npm test` passed **139 tests** (132 backend, 7 modern frontend), `npm run typecheck` passed, `CI=true npm run build` passed, and the stronger owned-fixture browser smoke passed with zero page errors. Modern's test-only dependencies are dev dependencies; production still starts compiled JavaScript. The pre-existing Browserslist maintenance notice remains nonblocking. Independent scoped re-review is pending; hosted/live-provider acceptance remains separate.

## Automatic Vercel build evidence and root compatibility

This is new integration evidence after the reviewed stream/request fixes. The coordinator pushed the approved branch and opened draft PR #3. The existing Git integration automatically built `1b166c1`; deployment `dpl_68fQ3YufiVuZomcQYabbe6iTuUJ6` failed on **2026-10-22 at 19:52 UTC** with `Missing script: install:all`. This automatic attempt is not a manual deployment by this implementation task.

Read-only `vercel project inspect doculaw-ai` confirms the existing project uses Root Directory `frontend`, Node `22.x`, and the Create React App preset. The root `vercel.json` commands were applied, but npm ran inside `frontend`, whose manifest lacked the combined-install script. The original root-only local build therefore did not reproduce the actual deployment entry point.

Source correction: `frontend/scripts/hosted-build.cjs` exposes combined install/build entry points through `frontend/package.json`. It delegates to repository orchestration; the root uses explicit `build:classic` to prevent recursion. Both Modern and Classic remain mandatory. The frontend-root build additionally copies the combined static artifact to `frontend/site`, matching `outputDirectory: site` relative to the configured root. Direct-root builds retain `site/`. No remote project setting was changed.

Local validation: the exact failed `npm run install:all` command now passes from `frontend` using isolated cached dependencies. `CI=true npm run build` passes from both repository root and `frontend`. SHA-256 comparison confirms all **18 files** in `site/` and `frontend/site/` are byte-identical to the direct-root combined artifact, including the Modern default and Classic HTML/bundles; no API/backend directory is packaged. An isolated-parent-source probe intentionally fails with an actionable diagnostic instead of emitting Classic alone.

Access to source outside `frontend` is required. [Vercel documents that this option is enabled by default for projects created after August 2020](https://vercel.com/docs/monorepos/monorepo-faq#can-i-share-source-files-between-projects-are-shared-packages-supported); this project was created in September 2025. The installed read-only CLI does not expose that exact flag, so it is not asserted as verified. If someone disabled it, review enabling that specific inclusion option before considering a Root Directory change. The bridge checks for the required source and stops clearly when it is unavailable.

Status: source correction is locally tested; the next automatic preview build is pending the coordinator's scoped review/push. A successful static preview build will not prove backend acceptance. The separately hosted Node service must expose `/api/doculaw/*`, preserve storage, and pass owned-fixture upload/analysis/Q&A checks before release. Existing hosted backend readiness, modern API availability, API-origin configuration and live providers remain unverified. No remote setting change, manual deploy, push or provider request was performed by this fix task.
