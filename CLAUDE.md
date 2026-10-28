# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Todo app monorepo: `backend/` (Express 5 + Prisma 7 + PostgreSQL) and `frontend/` (React 19 + Vite + styled-components + TanStack Query). Two independent npm packages — run commands from the respective directory. Node >=22.12. Both are ESM (`"type": "module"`).

## Commands

Setup: `cp .env.example .env` at repo root (compose and backend both read the root `.env`).

Full stack: `docker compose up --build -d --wait` → app http://localhost:8080, API docs http://localhost:8000/docs.
DB only (for local backend dev): `docker compose up -d --wait postgres`.

Backend (`cd backend`):
- `npm run dev` — tsx watch, port 8000
- `npm test` / `npm run test:watch` / `npm run test:coverage`
- Single test: `npx vitest run tests/router.test.ts -t "lists tasks"`
- `npm run typecheck`, `npm run build`
- `npm run db:generate` (also runs on postinstall/prebuild), `db:validate`, `db:studio`

Frontend (`cd frontend`):
- `npm run dev` (port 5173, proxies `/api` → 127.0.0.1:8000), `npm run storybook` (6006)
- `npm test` / `npm run test:watch` / `npm run test:coverage`
- Single test: `npx vitest run src/features/todos/components/TodoItem.test.tsx`
- `npm run typecheck`, `npm run format` / `format:check` (Prettier — frontend only)

## Backend architecture

- `main.ts` → `core/lifespan.ts` (connect, `initialize`, listen, graceful shutdown) → `factory.ts` `createApp(database)` wires routers, Swagger UI, 404 and error handler. Errors are JSON `{ detail }`; validation failures return **422** with zod issues.
- Feature slice `src/features/todos/`: `validators.ts` (zod schemas — source of truth; `types.ts` derives types via `z.infer`), `router.ts` (depends on the `TodoStore` interface, not Prisma), `repository.ts` (Prisma implementation), `mappers.ts` (DB row → API shape; `due_date` as `YYYY-MM-DD`, timestamps ISO).
- Prisma client is generated to `src/generated/prisma` (gitignored) using the `@prisma/adapter-pg` driver adapter. Must run `db:generate` before typecheck/tests on a fresh checkout.
- **No Prisma migrations**: the table is created by raw SQL in `core/database.ts` `initialize()` (`CREATE TABLE IF NOT EXISTS`, compatible with a legacy SQLAlchemy schema). Schema changes must update both `prisma/schema.prisma` and that SQL.
- `openapi.json` is hand-maintained and served at `/openapi.json` and `/docs` — update it when the API changes.
- DB URL: `DATABASE_URL` or built from `POSTGRES_*`/`DB_PORT` in `core/config.ts`; `prisma.config.ts` skips the datasource when env is missing so generate/build work without a DB.
- Imports use `.js` extensions in `src/` (NodeNext ESM); tests import `.ts` directly.

## Backend tests

No real database. Router tests mount the router with a mocked `TodoStore` via Supertest; repository tests build a real Prisma client and `vi.spyOn` its delegate methods. Shared fixtures in `tests/fixture.ts`. Coverage requires 100% per-file for `validators.ts` and `mappers.ts`.

## Frontend architecture

- `main.tsx` → `App.tsx` wrapped in `app/AppProviders.tsx` (QueryClient + styled-components ThemeProvider + GlobalStyles). `AppProviders` accepts a `client` prop for tests.
- `src/design-system/`: reusable presentational components, each in its own folder with `X.tsx`, `X.styles.ts`, `X.types.ts`, optional `X.variants.ts`, `X.stories.tsx`, `index.ts`; everything re-exported from `design-system/index.ts`. Excluded from coverage; covered by Storybook instead. Theme tokens in `theme/theme.ts`.
- `src/features/todos/`: `api/todos.ts` (endpoint calls; explicitly picks writable fields so read-only Todo fields are never sent), `api/queryKeys.ts`, `hooks/` (one TanStack Query hook per query/mutation; mutations update the `todoKeys.list` cache via `setQueryData` instead of refetching), `components/`, `TodosPage.tsx` (composition root).
- `lib/http.ts` `request()` prefixes `/api`, maps 422 and network errors to user-facing messages, returns `undefined` for 204.
- In Docker, nginx (`frontend/nginx.conf`) serves the build and proxies `/api/` to `backend:8000`.
- Tests: Vitest + jsdom + Testing Library, colocated `*.test.tsx`; fixtures in `src/test/todoFixture.ts`.
- Style: Prettier config in `.prettierrc.json` (no semicolons, single quotes); backend uses semicolons and is not Prettier-formatted.
