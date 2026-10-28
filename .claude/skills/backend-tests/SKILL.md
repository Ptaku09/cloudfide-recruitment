---
name: backend-tests
description: Conventions and patterns for Taskly backend unit tests (Vitest + Supertest, Prisma mocked, no database). Use when writing or updating tests under backend/tests.
---

# Backend tests

## Rules

- Location: `backend/tests/<module>.test.ts`, one file per source module. Shared fixtures: `backend/tests/fixture.ts` (`record` = Prisma row, `todo` = API shape). Extend the fixture rather than duplicating literals.
- Imports from source use the **`.ts` extension**: `import { createTodosRouter } from '../src/features/todos/router.ts';`
- Style: semicolons, single quotes, top-level `it(...)` / `it.each(...)` (no `describe`), a local `setup()` function returning what the test needs.
- **No PostgreSQL is available.** Never call real DB IO.
- Coverage thresholds: `validators.ts` and `mappers.ts` must stay at 100% per file.

## Patterns

**Router** (`createTodosRouter(store)`) — mount it on a bare Express app with a mocked `TodoStore`, drive it with Supertest:

```ts
function setup() {
  const repository = { list: vi.fn(), create: vi.fn(), get: vi.fn(), update: vi.fn(), delete: vi.fn() };
  const app = express();
  app.use(express.json());
  app.use('/api/todos', createTodosRouter(repository));
  return { app, repository };
}
```
Assert status codes, response bodies (`{ detail }` errors, 422 for validation, 404 for missing), and the exact arguments passed to the repository. Assert the repository is **not** called for invalid input. When `TodoStore` gains a method, add it to the mock.

**Repository** — build the real Prisma client (no connection is made until a query runs) and spy on the delegate:

```ts
const database = createDatabase('postgresql://test:test@localhost:5432/test');
const findMany = vi.spyOn(database.todo, 'findMany').mockResolvedValue([record]);
```
Add `afterEach(() => vi.restoreAllMocks())`. Use `vi.useFakeTimers()` + `vi.setSystemTime(...)` when the code reads the current date/time.

**Pure modules** (validators, mappers, new helpers) — call them directly; cover every branch and boundary (e.g. 120/121-char titles, invalid dates like `2026-02-30`, `null` vs missing fields).

**App wiring** (`createApp(database)`) — pass a stub object shaped like the parts of `Database` that are used (`{ todo: { findFirst: vi.fn() } }` cast with `as unknown as Database`) and test with Supertest: 404 JSON, invalid JSON → 422, `/openapi.json`, health.

**Config** (`resolveDatabaseUrl`) — use `vi.stubEnv(...)` and `vi.unstubAllEnvs()`; never read the real `.env` values in assertions.
