# PhotoSheet

A web-based contact sheet and image library that acts as the golden source for a company's photos.
Teams upload images to one place, organise them into boards, resize/convert on demand and share or
download them.

- **Stack**: Next.js 16 (App Router) · TypeScript · Tailwind + shadcn/ui · Prisma 7 + PostgreSQL ·
  S3-compatible storage · sharp · pg-boss · Better Auth · Resend
- **Hosting**: Railway (web + worker + Postgres + Bucket)

## Local development

### Prerequisites

- Node.js 20.9+ (tested on 25)
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
| `npm run lint`         | ESLint                          |
| `npm run typecheck`    | TypeScript                      |
| `npm run format`       | Prettier                        |
| `npm run db:migrate`   | Create/apply a migration in dev |
| `npm run db:deploy`    | Apply pending migrations        |
| `npm run db:studio`    | Prisma Studio                   |
| `npm run worker`       | Background job worker           |
| `npm run storage:init` | Create bucket / set CORS        |

### Health check

`GET /api/health` returns `{"status":"ok","db":"ok"}` when the app can reach Postgres.

## Environment variables

See [`.env.example`](.env.example) for the full list with comments.

## Deployment

Deployment to Railway is documented as the build progresses (see the Deployment section once the
Railway step lands).
