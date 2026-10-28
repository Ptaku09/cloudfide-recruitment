---
name: frontend-tests
description: Conventions and patterns for Taskly frontend unit tests (Vitest + jsdom + Testing Library + user-event). Use when writing or updating *.test.ts(x) files under frontend/src.
---

# Frontend tests

## Rules

- Location: colocated next to the source, `<Name>.test.tsx` for components/pages, `<name>.test.ts` for hooks/utils/api. Shared fixtures in `frontend/src/test/` (`todoFixture`); add new fixtures there.
- Style (Prettier): no semicolons, single quotes, trailing commas, top-level `it(...)` (no `describe`). Run `npx prettier --write <file>` after editing.
- Global setup (`src/test/setup.ts`) already loads `@testing-library/jest-dom` and runs `cleanup`.
- Query by role, label, or visible text (`screen.getByRole('button', { name: 'Try again' })`); interact with `const user = userEvent.setup()`; wait with `findBy*` / `waitFor`.
- No network: mock at the module boundary, never hit `fetch` for real.

## Patterns

**Components and pages** — isolate the unit, mirroring `TodosPage.test.tsx` and `TodoItem.test.tsx`:

```tsx
vi.mock('../../../design-system', () => import('../../../design-system/mocks'))
vi.mock('../hooks/useTodosQuery', () => ({ useTodosQuery: vi.fn() }))

vi.mocked(useTodosQuery).mockReturnValue({
  data: [todoFixture], isPending: false, isError: false, error: null,
} as unknown as ReturnType<typeof useTodosQuery>)
```
Mock child components that are not under test with tiny stand-ins (`() => <p>Task list</p>`). Assert what the user sees and which callbacks fire with which arguments. Cover loading, empty, error, and success states the component renders.

**API modules** (`features/todos/api/todos.ts`) — `vi.mock('../../../lib/http', () => ({ request: vi.fn() }))`, then assert the exact path and init passed to `request`.

**`lib/http.ts`** — `vi.spyOn(globalThis, 'fetch')` returning `new Response(JSON.stringify(body), { status })`; cover 2xx, 204, 422, other errors with/without `detail`, network failure, and aborted signal.

**TanStack Query hooks** — render with a fresh client per test:

```tsx
const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
const { result } = renderHook(() => useTodosQuery(), { wrapper })
```
Mock `todosApi` (`vi.mock('../api/todos')`) and assert both the returned state and cache effects (`client.getQueryData(todoKeys.list)`, invalidations via `vi.spyOn(client, 'invalidateQueries')`).

**Plain hooks** — `renderHook` + `act`, with `vi.useFakeTimers()` for timeouts.
