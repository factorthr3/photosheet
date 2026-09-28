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

## Security rules

- Every query touching org data must be scoped by `orgId` **and** checked against the caller's
  membership + role. Never trust an org id from the client without a membership check.
- The bucket is private. Only hand out short-lived presigned URLs.
- Never commit secrets. `.env*` is gitignored except `.env.example`.

## Workflow

- Feature branch per build step → PR into `main`. Keep commits small and descriptive.
- Ask before adding major dependencies not in the brief's stack.
- Keep this file updated as architecture grows.
