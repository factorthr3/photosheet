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
- **Tests**: colocate unit tests as `*.test.ts` next to the code.

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
