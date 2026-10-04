# Qub

Qub is one productivity platform — **Drive, Docs, Sheets and Forms** — built on a single storage, permission and
activity foundation. Qub Drive is the core: every document, spreadsheet and form *is* a Drive file
(`documents.file_id → drive_files.id`), so moving, trashing, sharing, searching and "Recent" work identically for all of them.

## Monorepo

```
apps/api              Fastify API (TypeScript, Drizzle, PostgreSQL, WebSockets)
apps/web              Vite + React app (TanStack Router/Query, Tiptap, Tailwind)
packages/shared       Zod schemas + DTO types shared by API and web, formula engine, form-logic evaluator
packages/editor-schema  Tiptap schema used by both the editor and the server (Yjs ⇄ JSON conversion)
e2e                   Playwright end-to-end tests
```

pnpm workspaces; Node ≥ 22.

## Stack

| | |
|---|---|
| API | **Fastify 5 only** — routes, hooks, validation (`fastify-type-provider-zod`), `@fastify/websocket`, `@fastify/multipart`, `@fastify/helmet`, `@fastify/cors`, `@fastify/rate-limit`, `@fastify/cookie`, `@fastify/jwt`, `@fastify/static` |
| Data | PostgreSQL + Drizzle ORM (migrations in `apps/api/src/db/migrations`), `pg_trgm` + full-text search |
| Auth | Argon2id passwords, 15-min JWT access tokens (memory only), rotating httpOnly refresh-token cookie with reuse detection, server-side sessions |
| Realtime | Yjs over `@fastify/websocket` for Docs; server-authoritative op protocol for Sheets; presence for Forms; per-user notification channel |
| Storage | `StorageProvider` abstraction — `LocalStorageProvider`, `S3StorageProvider` (AWS S3, Cloudflare R2, MinIO, …) |
| Web | React 19, TanStack Router (file-based routes in `apps/web/src/routes`, generated `routeTree.gen.ts`, per-route code splitting, guards), TanStack Query, React Hook Form + Zod, Tailwind v4, Radix primitives (shadcn-style), Tiptap 3, recharts |

## Getting started

```bash
pnpm install
cp .env.example .env            # set DATABASE_URL, TEST_DATABASE_URL, JWT secrets
createdb qubators && createdb qubators_test
pnpm db:migrate
pnpm db:seed                    # development data only (refuses in staging/production)
pnpm dev                        # API :4100, web :5180 (Vite proxies /api and WebSockets)
```

Seeded accounts: `alice@qub.dev`, `bob@qub.dev`, `carol@qub.dev` — password `Password123`.

### Scripts

| Command | |
|---|---|
| `pnpm dev` | API (tsx watch) + web (Vite) |
| `pnpm typecheck` | Every package |
| `pnpm test` | Shared unit tests, API integration tests (real PostgreSQL, wipes `TEST_DATABASE_URL`), web component tests |
| `pnpm test:e2e` | Playwright: register → login → folder → document → move → share → collaborate → spreadsheet formula → form → publish → submit → responses |
| `pnpm db:generate` / `pnpm db:migrate` | Drizzle migrations |
| `pnpm build` | API bundle (`apps/api/dist`, with migrations) and web build (`apps/web/dist`) |
| `pnpm job:purge-trash` | Run the trash-retention job once (for cron in multi-instance deployments) |
| `pnpm admin:grant <email> [--revoke]` | Make an existing account a super admin (how the first admin is created) |

## Architecture

### API (`apps/api/src`)

```
config/        Zod-validated environment (fails fast on startup)
db/            schema/*.schema.ts, migrations, migrate.ts, seed/
plugins/       errors (one response envelope), security, auth (JWT/session/media cookie), request logging
modules/       auth, users, drive, files, folders, permissions, sharing, docs, sheets, forms,
               notifications, activity, search — each with services + repositories + routes
services/      container (composition root), storage providers, mailer
websocket/     doc rooms (Yjs), sheet rooms, form rooms, notification hub
jobs/          trash retention
```

Key rules:

- **One permission system.** `PermissionService` resolves access for any file/folder: ownership, direct grants, and
  grants inherited from every ancestor folder (recursive CTEs). Docs/Sheets/Forms authorise through their Drive file.
  No access → 404 (existence isn't revealed); insufficient role → 403. Trashed items are visible to their owner only.
- **One file service.** Docs/Sheets/Forms create their Drive file through `FileService.createNative` inside the same
  transaction as the resource and its activity log. Copy/permanent-delete call per-type handlers
  (`NativeResourceRegistry`) so generic Drive operations cover every file type.
- **Transactions** for every multi-table write; stored bytes are deleted only after commit.
- **Responses**: `{ success: true, data }` or `{ success: false, error: { code, message, details? } }` with 400/401/403/404/409/413/415/422/429/500.
  Database errors are mapped without leaking SQL or constraint names.
- **Logging**: one structured line per request (request id, user, route, resource id, status, duration). Authorization
  headers, cookies, passwords and tokens are redacted; query strings (WebSocket/share tokens) are never logged.

### Drive

Nested folders with a per-user root ("My Drive"); moves reject cycles; Google-style trash (`is_trashed`,
`trashed_at`, `trashed_by_parent`) that restores to the original folder (or My Drive if it is gone); configurable
retention job; recursive folder copy (large trees copy in the background and notify when done); uploads streamed to
storage with magic-byte MIME sniffing (the browser's filename/MIME are never trusted), size limits, SHA-256 checksums,
filename sanitisation and duplicate naming; file versions (upload, list, download, restore-as-new-version);
per-user stars; Shared with me / Recent (from activity logs) / Starred / Trash; server-side search (trigram on names,
full-text on document content, filters for type/owner/dates/folder); activity history; range requests for media.

Sharing: people (Owner/Editor/Commenter/Viewer + can-share/download/copy flags), invitations to not-yet-registered
emails (become real permissions on sign-up), general access (Private/Restricted/Anyone with the link), random 256-bit
link tokens with optional password and expiry, link redemption into a real permission for signed-in users.

Drive UI:
- **Listing filters**: Type, People (owned by me / not by me / one person you share with, from `GET /api/drive/people`)
  and Modified (today → last year), applied in SQL to every listing and kept in the URL.
- **Suggested row** on My Drive (`GET /api/drive/suggested`): files ranked by the latest thing that happened to them in
  30 days (you opened/edited/created them, others edited or commented, or they were shared with you), with content previews.
- **File viewer** (`?preview=<id>` on any listing, `/drive/file/:id` on its own): images with zoom and pan, PDFs, video,
  audio and text; print, download, share, open in new tab, details; ←/→ through the listing's files.
- **Thumbnails**: grid cards and the details panel show real content. Images and PDFs (first page, rendered with pdf.js
  and resized with sharp) get a 480px WebP made on first view and cached in storage beside the original
  (`thumbnails/<storage key>`, removed with it); `GET /api/drive/files/:id/thumbnail?v=<checksum>` is cached immutably.
  Videos show their first second's frame and text files their first lines, read with `…/content?purpose=thumbnail`,
  which (like thumbnails) isn't recorded as an open. SVG isn't rendered server-side; undecodable files keep their icon.
- **Details panel**: opens when you click a file and closes when you click a folder, empty space or select several
  (on small screens only once it's open); preview, who has access, editable description, star/download, activity and versions (older
  versions can be deleted; bytes shared with a restored version are kept).
- **Activity panel** (`GET /api/drive/activity`): everything that happened across items you can reach, by category
  (edits, sharing, comments, trash, views), person and text; views/downloads are shown only to the owner and the actor.
- **Transfers**: one panel for uploads and downloads (with progress), folder upload (picker or drag-and-drop, folder tree
  created first via `POST /api/drive/folders/tree`), cancel, retry, minimize and auto-close.
- **Storage page** (`/drive/storage`, `GET /api/drive/storage`) and sidebar meter: usage by category, quota and where
  it comes from, trash, older versions and largest files to clean up.
- **Settings**: density, start page, Suggested on/off (per browser); keyboard shortcuts (`?` lists them).
- **Spam and blocking** (`spam_items`, `user_blocks`): anything shared directly with you can be reported as spam
  (`POST /api/drive/{files|folders}/:id/spam`) — it's hidden from Shared with me, Recent, Starred, search, Suggested, the
  Docs/Sheets/Forms home pages and the activity feed (a spam folder hides everything inside it). The Spam page offers
  Not spam, Remove forever and Delete all spam; removing deletes only your grant, never the owner's file, and the
  retention job removes items left in Spam for 30 days. Reporting can also block the owner (`/api/users/blocked`):
  everything they've shared with you moves to Spam, and they can no longer share with you or notify you.
  "Remove" (`DELETE …/access`) takes any item shared with you out of your Drive without reporting it.

### Docs

Tiptap with the full formatting set (headings, lists, tables, images, links, colours, highlights, alignment, code,
quotes). Collaboration is **real Yjs** over `@fastify/websocket`: the server holds one `Y.Doc` per open document,
enforces roles on every update (viewers can't write; commenters may only write the comment-anchor map — updates are
trial-applied and rejected if they touch the body), validates presence identity, persists debounced snapshots
(Yjs state + canonical Tiptap JSON + plain text for search) and acknowledges saves so the UI shows
Saving… / Saved / Offline / Connection lost. IndexedDB keeps offline edits, which merge on reconnect. Versions
(automatic + named) restore into the live document for everyone. Comments are anchored with Yjs relative positions,
with replies, resolve/reopen, edit/delete, @mentions (validated against people with access) and suggestions.
Documents paginate into Letter-size pages.

### Sheets

Sparse cell storage (`spreadsheet_cells` only for non-empty cells) with typed value columns. The **formula engine**
(`packages/shared/src/formula`) has a tokenizer, Pratt parser, evaluator with a pluggable function registry (SUM,
AVERAGE, MIN, MAX, COUNT, IF, SUMIF, COUNTIF, ROUND, CONCAT, …), cross-sheet and named-range references, cycle
detection and a dependency graph with topological recalculation. The server keeps the authoritative workbook per
open spreadsheet, applies operations in order (last writer wins per cell), persists every change in one transaction,
bumps a revision and broadcasts recalculated cells. Insert/delete rows/columns rewrite references (`#REF!` for
deleted cells); sort moves formulas with relative-reference translation. The client loads only viewport chunks,
applies edits optimistically, queues them offline (localStorage) and resends on reconnect. UI: virtualized grid with
frozen panes, formula bar, keyboard navigation, range selection, copy/paste (formulas shift references),
formatting, resize, sheet tabs, filters (evaluated server-side), versions, cell comments, collaborator presence.

### Forms

Builder with 13 field types, validation rules, options, drag-and-drop ordering, duplication, sections and
**server-stored branching rules** (forward jumps only). On submit the server recomputes the path from the stored
rules, enforces required fields only on sections actually reached and discards answers to unreached questions.
Answers are stored one row per question in typed columns; respondent uploads are validated per question.
Analytics are SQL aggregations over stored answers (distributions, percentages, averages/median, daily trend,
response rate from counted views). CSV export (formula-injection safe). Publishing, sign-in requirement,
one-response limit, confirmation message, themes, live builder presence and response notifications.
- Forms engine: [question types](docs/forms/question-types.md), [logic & variables](docs/forms/logic-engine.md),
  [builder operations, undo & autosave](docs/forms/builder-operations.md), [Forms v2](docs/forms/formsv2.md)

### Web routes (`apps/web/src/routes`)

Folder-based: `_authenticated/` is a pathless layout that requires a session; `drive/route.tsx` is the Drive shell.
Each app has a home page (`/docs`, `/sheets`, `/forms`) — "Start a new …" (blank + featured templates) and every file
of that type the user can open, sorted by their last open, with thumbnails of the real content (`GET /api/drive/library`)
— and a template gallery (`/docs/templates`, …). Drive's "New → Qub Docs/Sheets/Forms" opens the home page in a new
tab, carrying the current folder (`?folder=<id>`). `/docs/new`, `/sheets/new` and `/forms/new` (`?folder=`,
`?template=`) create the file and replace themselves with the editor; other open tabs refresh their Drive listings.

Templates live in `packages/shared/src/templates` and are used on both sides: the server builds files from them inside
the normal create transaction (Docs content is validated against the editor schema; Sheets formulas are evaluated by
the same `Workbook` engine, so stored values are real), and the client renders gallery thumbnails from the same
definitions. `src/routeTree.gen.ts` is generated by the Vite plugin on `dev`/`build`; commit it (typecheck needs it).

### Admin console (`/admin`, super admins only)

`users.platform_role` is `USER` or `SUPER_ADMIN`; `/api/admin/*` checks it from the database on every request, so a
demotion takes effect immediately. The first super admin is created with `pnpm admin:grant <email>` (the dev seed makes
alice@qub.dev one). There is no self-service elevation.

- **Home** — people, storage, public sharing and alert counts; items per app; 14-day activity per app; recent audit events.
- **Users** — search/filter/sort, CSV export, create accounts (the person gets a set-password link), role, status,
  storage per person (organization default, a custom size, unlimited, or increase/decrease by a step — adjustments
  apply to the quota in effect under a row lock, and the person is notified), send reset links, sign out everywhere, bulk suspend/activate, and delete with a required choice:
  transfer everything to another person or delete the data. You can't change your own role/status, and the last active
  super admin can't be demoted, suspended or deleted.
- **Content** — every Doc, Sheet, Form and upload with owner, sharing, stored bytes and app details (word count,
  cells, responses); turn off a public link or transfer ownership. Admins see metadata, never contents.
- **Drive & sharing policies** (`org_settings`, validated by `orgPoliciesSchema`, all enforced server-side): public links
  on/off (also disables existing links), maximum link role (caps existing links), invitations to people without an
  account, allowed email domains, viewer download/copy, max upload size, blocked extensions, default storage quota
  (quotas are enforced while uploads stream), trash retention (drives the purge job), sign-in required for all forms.
- **Storage** — usage by category, top users with quota changes, largest files.
- **Security** — active sessions (revoke one or everyone else's), failed sign-ins, stolen-token detections, maximum
  session age.
- **Audit & activity** — the audit log (sign-in, sharing and admin events with severity, filters and CSV export) and
  org-wide activity across Docs, Sheets, Forms and Drive.
- **Email delivery** — the provider for all Qub email: server default (`.env`), any SMTP server (presets for Gmail /
  Google Workspace, Microsoft 365, Zoho, Amazon SES, Brevo), Resend, SendGrid, Mailgun (US/EU) or Postmark; sender name,
  address and reply-to; test sends (of a draft or the saved settings). Passwords and API keys are AES-256-GCM encrypted
  with `SETTINGS_ENCRYPTION_KEY` (derived from `JWT_SECRET` if unset) and never returned to the browser.
- **Organization** — name (used in account emails) and read-only server facts.

## Security notes

Argon2id; refresh tokens stored as HMACs and rotated with theft detection; logout and password changes revoke
sessions immediately (sessions are checked on every request); CSRF: the refresh cookie is `SameSite=Strict`,
path-scoped and origin-checked, and all other endpoints use bearer tokens; media (`<img>`, `<video>`, downloads) use a
short-lived session-bound `SameSite=Lax` cookie accepted only on read-only content routes; helmet CSP; files served
with `nosniff`, sandbox CSP and attachment disposition unless the type is known-safe; storage keys are server-generated
and path-traversal checked; rate limits (stricter on auth, share links and public form submission); every ID from a
client is re-authorised; audit log for auth and sharing events.

## Deployment

Environments are configuration only (`NODE_ENV=development|staging|production`). In staging/production the API
requires SMTP mail and sets secure cookies. `pnpm build` produces `apps/api/dist` (run `node dist/migrate.js` then
`node dist/server.js`) and `apps/web/dist` (serve from a CDN, or set `SERVE_WEB_DIST` to serve it from the API).
`GET /api/health` (liveness) and `GET /api/ready` (database + storage) are provided.

## Remaining engineering work

These are deliberately not claimed as done:

- **Horizontal scaling of realtime.** Collaboration rooms live in the API process. Multiple instances need sticky
  routing per document/spreadsheet or a shared bus (e.g. Redis pub/sub + Yjs update relay). Run the trash job via
  `pnpm job:purge-trash` from cron and set `TRASH_PURGE_INTERVAL_MINUTES=0` when scaling out.
- **Docs pagination** breaks between blocks; a single paragraph or table taller than a page overflows instead of splitting.
- **Suggestions** are anchored replacement proposals (accept applies the edit); a full tracked-changes mode is not implemented.
- **Sheets**: no merged cells, borders, charts or conditional formatting; row/column insert/delete/sort are not
  locally undoable; formulas show `…` until the server's result arrives (no client-side pre-evaluation).
- **Storage**: Azure Blob is not implemented (implement `StorageProvider`); uploads stream through the API
  (no direct-to-S3 presigned or resumable uploads); no thumbnails for Office files (would need LibreOffice) and
  PDF pages are rendered on the API's main thread, one at a time (move to a worker at scale); no malware scanning.
- **Drive**: no "Computers" section (needs a desktop sync client); spam is only what people report (no automatic
  spam detection); items opened through a public link can't be reported; no zip download of folders; downloads over 300 MB go straight to the browser (no in-app progress).
- Email verification is available but only enforced when `REQUIRE_EMAIL_VERIFICATION=true`.
- **Admin**: no two-step verification, data-loss-prevention scanning or shared (team) drives — the console doesn't show
  controls for features that don't exist. Link-redeemed grants aren't removed when public links are turned off.
- Test coverage: API integration tests are broad (123); web component tests (9) and E2E (one full-flow spec) cover the core paths only.
