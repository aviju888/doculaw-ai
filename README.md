# DocuLaw AI

Upload a contract to read it clause by clause in plain English, review risky terms, see each side's obligations, and ask questions grounded in the document. The refreshed workspace is the default; the original interface remains available at `/classic`.

## Local development

Requires Node.js 22.12 or newer. Install the three isolated packages, build the two interfaces, then start Express:

```sh
npm run install:all
npm run build
npm start
```

Open http://127.0.0.1:3001. Both interfaces and all APIs share one origin. `PORT` and `HOST` are optional server settings (defaults: 3001 and 127.0.0.1). No provider credentials are required for parsing, rule-based clause reading, comparison, and cited extraction-based answers. Rule-based output is labelled in the UI. A sample lease and pasted text are session-only; uploaded files are saved in the document library shared with Classic.

For a frontend development server use `npm run dev --prefix modern` and run the backend separately. Classic's `npm start --prefix frontend` proxies `/api` to port 3001. The combined production build is the supported local preview for switching between interfaces.

## Configuration and data

Create `backend/.env` from `backend/.env.example` and configure only the services you need. All provider keys remain server-side:

- `GROQ_API_KEY` enables model rewrites and answers. Groq defaults are `openai/gpt-oss-20b` and `openai/gpt-oss-120b`, with low reasoning effort, reasoning excluded from output, and explicit completion budgets. `GROQ_FAST_MODEL` / `GROQ_DEEP_MODEL` may override these for compatible GPT-OSS models. Provider calls remain unverified until tested with your account.
- `OPENAI_API_KEY`, `PINECONE_API_KEY`, `PINECONE_INDEX` enable the original embedding/vector-search integration. Classic reports missing providers as unavailable.
- `DOCULAW_DATA_DIR` optionally selects the existing filesystem document/session store. The default remains `backend/data`; no migration or backfill is required. Use persistent writable storage on a hosted Node server.

Existing `/home`, `/onboarding`, `/dashboard`, `/upload`, `/documents/:id`, `/chat/:sessionId`, and `/search` paths are retained. Classic's browser profile keys remain unchanged. Opening a saved document in the new workspace uses `/?document=<id>`.

## Validation

```sh
npm test
npm run typecheck
CI=true npm run build
```

The backend tests use temporary storage and harmless owned text/PDF/DOCX fixtures. `scripts/browser-smoke.cjs` accepts `DOCULAW_BASE_URL` and `DOCULAW_SCREENSHOT_DIR`; run it with Playwright available in Node's module search path. It verifies real local upload, analysis, Q&A, library reopening, Classic switching and mobile layout. Classic's original test command has no tests; the migration adds HTTP and browser coverage instead of treating that as a green UI suite.

## Hosting

`site/` contains the two frontend builds. The Node backend serves both and the APIs. `vercel.json` packages static frontend routing only; for a static host, point `REACT_APP_API_BASE_URL` and `VITE_API_BASE_URL` at your deployed backend's `/api` URL at build time. Never put secret keys in either frontend variable. Hosted backend persistence, authentication, provider permissions, and live model behavior need separate acceptance. The existing Git integration may create static previews when this branch is pushed; those do not deploy or verify the separate API.

See `docs/modern-classic-migration.md` for source provenance, compatibility decisions and verification limits. The Beautiful UI token license is preserved in `docs/BEAUTIFUL-UI-LICENSE`.

### Existing Vercel project root

The existing Vercel project has Root Directory `frontend`. `frontend` now exposes `install:all` and a combined `build` entry point that delegate to the repository orchestration; the Classic-only compiler is named `build:classic` to prevent recursion. Building from the repository root writes `site/`. Building from `frontend/` additionally writes the same combined static output to `frontend/site/`, matching the existing `vercel.json` output directory relative to that configured root. Both paths require Modern and Classic to build successfully.

The Vercel build needs access to repository files outside `frontend` (the documented default for projects created after August 2020). If that option has been disabled, the bridge stops with an actionable error instead of emitting only Classic. Review the existing project's “Include source files outside of the Root Directory in the Build Step” option before considering any Root Directory change; no remote settings are changed by these scripts.

This fixes source/build-root compatibility only. The static artifact does not contain an Express deployment or persistent document storage; configure the separately hosted API via the public build-time API origin variables before treating it as a functional hosted preview.
