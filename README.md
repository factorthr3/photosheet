# PhotoSheet

A web-based contact sheet and image library that acts as the golden source for a company's photos.
Teams upload images to one place, organise them into boards, resize/convert on demand and share or
download them.

- **Stack**: Next.js 16 (App Router) · TypeScript · Tailwind + shadcn/ui · Prisma 7 + PostgreSQL ·
  S3-compatible storage · sharp · pg-boss · Better Auth · Resend
- **Hosting**: Railway (web + worker + Postgres + Bucket)

## Local development

### Prerequisites

- Node.js 22.19+ or 24.11+ (`.node-version` pins 22 for Railway)
- PostgreSQL 15+ and an S3-compatible store. On macOS with Homebrew:

  ```bash
  brew install postgresql@17 minio
  brew services start postgresql@17
  brew services start minio   # S3 API on :9000, console on a random port, creds minioadmin/minioadmin
  createdb photosheet
  ```

### Setup

```bash
npm install
cp .env.example .env          # then fill in AUTH_SECRET (openssl rand -base64 32) and DATABASE_URL
npm run db:deploy             # apply migrations
npm run storage:init          # create the bucket (and CORS where supported)
npm run db:seed               # optional: demo org + one user per role (see scripts/seed.ts)
npm run dev                   # http://localhost:3000
npm run worker                # in a second terminal: thumbnails, EXIF, exports
```

### Useful scripts

| Script                 | What it does                    |
| ---------------------- | ------------------------------- |
| `npm run dev`          | Next.js dev server              |
| `npm test`             | Unit tests (Vitest)             |
| `npm run test:e2e`     | End-to-end tests (Playwright)   |
| `npm run lint`         | ESLint                          |
| `npm run typecheck`    | TypeScript                      |
| `npm run format`       | Prettier                        |
| `npm run db:migrate`   | Create/apply a migration in dev |
| `npm run db:deploy`    | Apply pending migrations        |
| `npm run db:studio`    | Prisma Studio                   |
| `npm run worker`       | Background job worker           |
| `npm run storage:init` | Create bucket / set CORS        |

### End-to-end tests

```bash
npx playwright install chromium   # once
npm run test:e2e
```

The suite needs the same Postgres and MinIO as local dev, but never touches your data: it builds
the app and runs web + worker on port 3100 against its own database (`photosheet_e2e`) and bucket
(`photosheet-e2e`), and writes emails to `.e2e-outbox/`. It walks the whole journey: sign up,
create an org, invite an editor, upload JPEGs and a HEIC, build and reorder a board, resize,
download a ZIP, share with an expiring password-protected link, view it as a guest, check that
another org can't see anything, and revoke the link. Any browser console error fails a test. CI
runs it on every pull request.

### Health check

`GET /api/health` returns `{"status":"ok","db":"ok"}` when the app can reach Postgres.

## Environment variables

See [`.env.example`](.env.example) for the full list with comments.

## Deployment (Railway)

PhotoSheet runs as one Railway project, `photosheet`, all in the EU West (Amsterdam) region:

| Resource           | What it runs                                          | Key settings                                                                                                               |
| ------------------ | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `web`              | Next.js app (`next start`)                            | Build `npm run build` · pre-deploy `npm run db:deploy && npm run storage:init` · healthcheck `/api/health` · 15 s draining |
| `worker`           | Background jobs (`node --import tsx worker/index.ts`) | Build `npx prisma generate` · restart on failure · 40 s draining for graceful shutdown                                     |
| `Postgres`         | Railway Postgres template                             | Reached over the private network (`postgres.railway.internal`)                                                             |
| `photosheet-media` | Railway Bucket (S3-compatible, private)               | Region `ams`; accessed only through presigned URLs                                                                         |

Both services deploy automatically on every push to `main` (GitHub source `factorthr3/photosheet`,
trigger branch `main`). Start commands call Node directly rather than `npm run …`: npm doesn't pass
SIGTERM on, so a replaced deployment would be killed mid-request or mid-job instead of draining.
Migrations run in `web`'s pre-deploy step, so a failing migration stops the deploy before traffic
moves. The same step sets the bucket's CORS rule for `APP_URL`, which browser uploads need.

The project's configuration is also recorded as code in [`.railway/railway.ts`](.railway/railway.ts)
(Railway Infrastructure as Code). Preview drift with `railway config plan`; apply deliberate
changes with `railway config apply`. Secrets are not in that file — it marks them `preserve()`.

### Variables

Set on **both** `web` and `worker` (Railway reference syntax):

| Variable                                    | Value                                                                                            |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`                              | `${{Postgres.DATABASE_URL}}`                                                                     |
| `S3_ENDPOINT` / `S3_REGION` / `S3_BUCKET`   | `${{photosheet-media.ENDPOINT}}` / `.REGION` / `.BUCKET`                                         |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | `${{photosheet-media.ACCESS_KEY_ID}}` / `.SECRET_ACCESS_KEY`                                     |
| `S3_FORCE_PATH_STYLE`                       | `false` (Railway Buckets use virtual-hosted URLs)                                                |
| `AUTH_SECRET`                               | Random, ≥32 chars, identical on both services                                                    |
| `APP_URL`                                   | `web`: `https://${{RAILWAY_PUBLIC_DOMAIN}}` · `worker`: `https://${{web.RAILWAY_PUBLIC_DOMAIN}}` |
| `MAX_UPLOAD_MB`                             | `50`                                                                                             |
| `RESEND_API_KEY`, `EMAIL_FROM`              | Required for email (magic links, invites, resets, shares)                                        |

Railway shared variables can't resolve references to other services, so set the references on each
service directly.

### Email

Until `RESEND_API_KEY` and a verified `EMAIL_FROM` domain are set, email/password sign-up and
everything else works, but magic-link sign-in, invitations, password resets and "email this link"
fail with an error. Admins can still copy an invitation link from the Members page.

### Custom domain

Add it to the `web` service (Settings → Networking, or `railway domain`), create the DNS record
Railway shows, then redeploy `web` so `APP_URL` picks up the new domain.

### Cost

Usage-billed. At light use expect roughly $8–12/month (web ≈ $3–4, worker ≈ $3–4, Postgres ≈ $2,
bucket $0.015/GB-month; photo downloads come straight from the bucket and are free). Set a usage
limit under Workspace → Usage to cap spend.
