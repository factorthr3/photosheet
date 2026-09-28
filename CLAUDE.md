@AGENTS.md

# PhotoSheet — project guide

Web-based contact sheet + image library that is the golden source for an organisation's photos.
See README.md for setup and deployment.

## Commands

| Task                  | Command                                                 |
| --------------------- | ------------------------------------------------------- |
| Dev server            | `npm run dev` (http://localhost:3000)                   |
| Unit tests            | `npm test` (Vitest)                                     |
| Lint / types / format | `npm run lint` · `npm run typecheck` · `npm run format` |
| Create a migration    | `npm run db:migrate -- --name <change>`                 |
| Apply migrations      | `npm run db:deploy`                                     |
| Regenerate Prisma     | `npx prisma generate` (also runs on `postinstall`)      |

After changing `schema.prisma` restart `npm run dev` — the dev Prisma client is cached on
`globalThis` and survives hot reloads.

Before opening a PR: `npm run lint && npm run typecheck && npm test && npm run build`.

## Stack & conventions

- **Next.js 16 App Router** + TypeScript. Next 16 differs from older versions: read
  `node_modules/next/dist/docs/` before using an unfamiliar API. Notable: `middleware.ts` is now
  `proxy.ts`; `params`, `searchParams`, `cookies()`, `headers()` are async-only.
- **UI**: Tailwind v4 + shadcn/ui (Radix, "nova" preset). Components live in `src/components/ui`
  (generated; edit sparingly). `cn` comes from the `cn` package.
- **DB**: Prisma 7 with the `pg` driver adapter. Client is generated to `src/generated/prisma`
  (gitignored) — import from `@/generated/prisma/client`. Use the shared client in `src/lib/db.ts`.
  Datasource URL lives in `prisma.config.ts`, not `schema.prisma`.
- **Env**: read config through `env()` in `src/lib/env.ts` (zod-validated). Add every new variable
  there and to `.env.example`.
- **Validation**: zod v4 for all request bodies and query strings.
- **Formatting**: Prettier (100 cols) with the Tailwind class-sorting plugin.
- **Tests**: colocate unit tests as `*.test.ts` next to the code. DB integration tests are
  `*.int.test.ts` and use `TEST_DATABASE_URL` (falls back to `DATABASE_URL`); fixtures in
  `src/test/factories.ts`. Test files run serially.

## Architecture

### Auth & organisations

- **Better Auth** (`src/lib/auth/index.ts`, client in `src/lib/auth/client.ts`, handler at
  `/api/auth/[...all]`). Email+password, magic link, password reset, organisation plugin.
- Brief → schema naming: Organisation = `Organization`, Membership = `Member`, Invite =
  `Invitation` (Better Auth's model names). Roles are stored on `Member.role`.
- **Roles & permissions**: `src/lib/permissions.ts` is the single source of truth
  (`can(role, capability)`). Better Auth's own access control (`src/lib/auth/roles.ts`) only
  governs its org endpoints (invites/member changes).
- Org-scoped UI lives under `/o/[slug]/...`. `src/proxy.ts` does an optimistic cookie check;
  real checks happen in the page/route.

### Request guards (use these, don't hand-roll)

- Server components / server actions: `requireOrg(slug, capability?)` from `src/lib/org.ts`
  (redirects to /login or 404s).
- Route handlers: wrap with `route()` and call `requireOrgApi(req, slug, capability?)` from
  `src/lib/api.ts` (401/403/404 JSON + same-origin CSRF check on mutating methods).
- Server actions return `ActionResult` (`src/lib/action-result.ts`); use `actionError(err)` in
  catch blocks.
- Non-members always get 404, never 403, so org existence isn't leaked.

### Storage, uploads & the worker

- `src/lib/storage.ts` wraps the S3 SDK (any S3-compatible store). Keys are built with `keys.*`
  under `orgs/{orgId}/…`. Never expose raw keys or public URLs — use `presignGet` (downloads,
  5 min) or `presignThumb` (thumbnails; hour-bucketed signing so the browser cache works).
- Upload flow: browser hashes files (SHA-256) → `POST /api/o/[slug]/uploads/check` (duplicate
  warning) → `POST /uploads` reserves `Image` rows (status `UPLOADING`) and returns presigned
  POST policies (key, type and max size pinned) → browser POSTs straight to the bucket →
  `POST /uploads/[id]/complete` checks **magic bytes** (`src/lib/image/magic.ts`), sets
  `PROCESSING` and enqueues `process-image`.
- `worker/` is a separate process (pg-boss, `src/lib/queue.ts`). `process-image` hashes, reads
  EXIF, and writes 320px/1280px WebP thumbnails, then marks the image `READY` (or `FAILED` after
  retries; `UnprocessableImageError` fails immediately).
- HEIC/HEIF: sharp's prebuilt libvips can't decode HEVC, so `src/lib/image/decode.ts` decodes
  with `heic-decode` (libheif WASM) to raw pixels first. Always open originals via `openImage()`.
- Originals are never modified.

### Library (contact sheet)

- Filters/sort are defined once in `src/lib/images/filters.ts` (client-safe) and turned into
  Prisma queries by `src/lib/images/query.ts` (`buildWhere`, keyset `cursorWhere`). Reuse these
  for anything that acts on "the images matching these filters" (select-all, bulk edit, exports).
- Pagination is keyset-based with opaque cursors bound to the sort; `query.int.test.ts` proves
  every sort pages through all rows exactly once (incl. ties and null `takenAt`).
- `listImages()` (`src/lib/images/list.ts`) backs both the server-rendered first page and
  `GET /api/o/[slug]/images`.
- UI: `LibraryView` composes toolbar → `ContactSheet` → `SelectionBar` → `Lightbox`. Filter state
  and the open image (`?image=`) live in the URL via `history.replaceState/pushState` (no server
  round-trip). Per-browser view prefs (tile size, sheet background) are in localStorage.
- Licence warnings: `licenceState()` in `src/lib/images/licence.ts` (expired / expiring within
  30 days / restricted = anything but "unlimited"). Tiles show badges; the lightbox shows a banner.
- Metadata: validation in `src/lib/images/metadata.ts` (empty string → null, expiry is a
  YYYY-MM-DD date stored at midnight UTC), writes in `metadata.server.ts`. Tags are always
  normalised with `normalizeTags()` (lower-case, trimmed, deduped, max 50). Bulk edits only touch
  ticked fields and add/remove tags per image in one SQL statement.

### Resize, renditions & presets

- Render params live in `src/lib/image/render-params.ts` (client-safe): `canonicalParams()`
  normalises input, `paramsHash()` keys the cache, `outputSize()` predicts dimensions (contain
  never enlarges; cover/fill hit the exact size). `renderImage()` (`render.ts`) does the sharp work
  and strips EXIF/GPS unless `stripMetadata` is false.
- `Rendition` rows are unique per (image, paramsHash). `getOrCreateRendition()`
  (`src/lib/renditions.ts`) upserts and enqueues the `render` job; clients poll
  `GET /api/o/[slug]/renditions/[id]`. The worker's `renderAndStore()` is reusable (exports).
- `ResizePreset` rows are per org, seeded from `DEFAULT_PRESETS` on first use; admins manage them
  in Settings.

### Exports (ZIP, PDF)

- `Export` rows track background downloads (`kind` zip|pdf, status, progress, 7-day expiry).
  Params are snapshotted at creation (`src/lib/exports.ts`); the worker's `export` job builds them.
- ZIPs stream: each file is streamed from storage into archiver (store mode), whose output feeds an
  S3 multipart upload (`uploadStream`). One entry at a time (`await archive 'entry'`), so memory is
  flat. Resized variants reuse the rendition cache (`upsertRendition` + `renderAndStore`).
- Worker-imported modules must not import `server-only` (it throws outside RSC). Keep shared
  server logic in plain modules (e.g. `renditions-core.ts`, `exports.ts`).

### Boards

- `Board` + `BoardImage` (composite PK, dense 0-based `position`). Service in `src/lib/boards.ts`:
  add/remove/reorder run in a transaction that locks the board row (`SELECT … FOR UPDATE`) and
  renumber positions with one `UPDATE … FROM unnest(...)`. `moveIds()` (`src/lib/move-ids.ts`) is
  the pure ordering rule shared by server and client (optimistic reorder).
- Board feeds support the library sorts plus `manual` (keyset on position). Manual reorder (drag
  and drop, or Alt+←/→) is only enabled in manual sort with no filters.
- `ImageBrowser` (`src/components/library/image-browser.tsx`) is the shared grid+lightbox+selection
  shell used by the library and boards; pages add actions via `selectionActions` /
  `lightboxActions` render props.

### Sharing

- **Public links** (`ShareLink`): 192-bit random `token` is the only credential. Optional expiry
  (stored exclusive: start of the day after the chosen last day), password (Better Auth scrypt
  hash), allow-downloads, and allowed sizes (original and/or preset ids).
- Public routes live under `/s/[token]` (page) and `/api/s/[token]/*`. Every one goes through
  `requirePublicShare()` (`src/lib/public-share.ts`): active link, unlock cookie (HMAC of link id +
  password hash — changing the password logs recipients out), same-origin on POST, per-IP rate
  limit (`src/lib/rate-limit.ts`, Postgres fixed window). Share pages are `noindex`.
- Recipient ZIPs are `Export` rows with `shareLinkId` (never visible via org routes).
- **Internal sharing**: `Board.visibility` ORG|PRIVATE + `BoardMember`. Every board read goes
  through `boardAccessWhere()` / `getBoard(viewer, id)` in `src/lib/boards.ts` — private boards
  404 for non-members; admins see all.

### Email & audit

- `sendEmail()` (`src/lib/email.ts`) uses Resend when `RESEND_API_KEY` is set; otherwise writes
  JSON to `.mail-outbox/` (dev/tests). Templates in `src/lib/email-templates.ts` — escape all
  interpolated values.
- `recordAudit()` (`src/lib/audit.ts`) appends to `audit_event`. Add new action names to the
  `AuditAction` union.

## Security rules

- Every query touching org data must be scoped by `orgId` **and** checked against the caller's
  membership + role. Never trust an org id from the client without a membership check.
- The bucket is private. Only hand out short-lived presigned URLs.
- Never commit secrets. `.env*` is gitignored except `.env.example`.

## Workflow

- Feature branch per build step → PR into `main`. Keep commits small and descriptive.
- Ask before adding major dependencies not in the brief's stack.
- Keep this file updated as architecture grows.
