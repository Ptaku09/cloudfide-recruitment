import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { todoFixture } from '../../../test/todoFixture'
import { todoKeys } from '../api/queryKeys'
import { todosApi } from '../api/todos'
import type { Todo } from '../types'
import { useCreateTodoMutation } from './useCreateTodoMutation'
import { useDeleteTodoMutation } from './useDeleteTodoMutation'
import { useTodoFilters } from './useTodoFilters'
import { useTodosBusy } from './useTodosBusy'
import { useTodosQuery } from './useTodosQuery'
import { useUpdateTodoMutation } from './useUpdateTodoMutation'

vi.mock('../api/todos', () => ({
  todosApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}))

beforeEach(() => vi.clearAllMocks())

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return { client, wrapper }
}

const other: Todo = { ...todoFixture, id: 8, title: 'Other' }

it('loads tasks and passes the abort signal', async () => {
  const { wrapper } = setup()
  vi.mocked(todosApi.list).mockResolvedValue([todoFixture])
  const { result } = renderHook(() => useTodosQuery(), { wrapper })
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(result.current.data).toEqual([todoFixture])
  expect(todosApi.list).toHaveBeenCalledWith(expect.any(AbortSignal))
})

it('exposes query errors', async () => {
  const { wrapper } = setup()
  vi.mocked(todosApi.list).mockRejectedValue(new Error('boom'))
  const { result } = renderHook(() => useTodosQuery(), { wrapper })
  await waitFor(() => expect(result.current.isError).toBe(true))
  expect(result.current.error?.message).toBe('boom')
})

it('puts a created task first in the cache without duplicating its id', async () => {
  const { client, wrapper } = setup()
  client.setQueryData<Todo[]>(todoKeys.list, [other, todoFixture])
  const saved = { ...todoFixture, title: 'Renamed' }
  vi.mocked(todosApi.create).mockResolvedValue(saved)
  const { result } = renderHook(() => useCreateTodoMutation(), { wrapper })
  await act(() => result.current.mutateAsync(todoFixture))
  expect(todosApi.create).toHaveBeenCalledWith(todoFixture)
  expect(client.getQueryData(todoKeys.list)).toEqual([saved, other])
})

it('creates the cache list when none exists yet', async () => {
  const { client, wrapper } = setup()
  vi.mocked(todosApi.create).mockResolvedValue(todoFixture)
  const { result } = renderHook(() => useCreateTodoMutation(), { wrapper })
  await act(() => result.current.mutateAsync(todoFixture))
  expect(client.getQueryData(todoKeys.list)).toEqual([todoFixture])
})

it('leaves the cache untouched when creation fails', async () => {
  const { client, wrapper } = setup()
  client.setQueryData<Todo[]>(todoKeys.list, [other])
  vi.mocked(todosApi.create).mockRejectedValue(new Error('nope'))
  const { result } = renderHook(() => useCreateTodoMutation(), { wrapper })
  await act(() =>
    expect(result.current.mutateAsync(todoFixture)).rejects.toThrow('nope'),
  )
  expect(client.getQueryData(todoKeys.list)).toEqual([other])
})

it('replaces only the updated task in the cache', async () => {
  const { client, wrapper } = setup()
  client.setQueryData<Todo[]>(todoKeys.list, [other, todoFixture])
  const saved = { ...todoFixture, completed: true }
  vi.mocked(todosApi.update).mockResolvedValue(saved)
  const { result } = renderHook(() => useUpdateTodoMutation(), { wrapper })
  await act(() =>
    result.current.mutateAsync({ id: 7, input: { completed: true } }),
  )
  expect(todosApi.update).toHaveBeenCalledWith(7, { completed: true })
  expect(client.getQueryData(todoKeys.list)).toEqual([other, saved])
})

it('does not create a cache entry when updating with no cached list', async () => {
  const { client, wrapper } = setup()
  vi.mocked(todosApi.update).mockResolvedValue(todoFixture)
  const { result } = renderHook(() => useUpdateTodoMutation(), { wrapper })
  await act(() => result.current.mutateAsync({ id: 7, input: {} }))
  expect(client.getQueryData(todoKeys.list)).toBeUndefined()
})

it('removes the deleted task from the cache', async () => {
  const { client, wrapper } = setup()
  client.setQueryData<Todo[]>(todoKeys.list, [other, todoFixture])
  vi.mocked(todosApi.remove).mockResolvedValue(undefined)
  const { result } = renderHook(() => useDeleteTodoMutation(), { wrapper })
  await act(() => result.current.mutateAsync(7))
  expect(todosApi.remove).toHaveBeenCalledWith(7)
  expect(client.getQueryData(todoKeys.list)).toEqual([other])
})

it('keeps the cache when deletion fails', async () => {
  const { client, wrapper } = setup()
  client.setQueryData<Todo[]>(todoKeys.list, [todoFixture])
  vi.mocked(todosApi.remove).mockRejectedValue(new Error('nope'))
  const { result } = renderHook(() => useDeleteTodoMutation(), { wrapper })
  await act(() => expect(result.current.mutateAsync(7)).rejects.toThrow('nope'))
  expect(client.getQueryData(todoKeys.list)).toEqual([todoFixture])
})

it('reports busy only while a todo mutation is in flight', async () => {
  const { wrapper } = setup()
  let resolve!: (todo: Todo) => void
  vi.mocked(todosApi.create).mockReturnValue(new Promise((r) => (resolve = r)))
  const { result } = renderHook(
    () => ({ busy: useTodosBusy(), create: useCreateTodoMutation() }),
    { wrapper },
  )
  expect(result.current.busy).toBe(false)
  act(() => result.current.create.mutate(todoFixture))
  await waitFor(() => expect(result.current.busy).toBe(true))
  await act(async () => resolve(todoFixture))
  await waitFor(() => expect(result.current.busy).toBe(false))
})

it('filters and sorts tasks through state setters', () => {
  const done = { ...other, completed: true }
  const { result } = renderHook(() => useTodoFilters([todoFixture, done]))
  expect(result.current.filter).toBe('all')
  expect(result.current.sort).toBe('newest')
  expect(result.current.visible.map((t) => t.id)).toEqual([8, 7])
  act(() => result.current.setFilter('completed'))
  expect(result.current.visible).toEqual([done])
  act(() => {
    result.current.setFilter('all')
    result.current.setSearch('prepare')
  })
  expect(result.current.search).toBe('prepare')
  expect(result.current.visible).toEqual([todoFixture])
  act(() => result.current.setSort('priority'))
  expect(result.current.sort).toBe('priority')
})
