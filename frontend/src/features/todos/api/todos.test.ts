import { beforeEach, expect, it, vi } from 'vitest'
import { request } from '../../../lib/http'
import { todoFixture } from '../../../test/todoFixture'
import { todosApi } from './todos'

vi.mock('../../../lib/http', () => ({ request: vi.fn() }))
beforeEach(() => vi.clearAllMocks())

it('passes the abort signal when fetching tasks', async () => {
  const signal = new AbortController().signal
  vi.mocked(request).mockResolvedValue([todoFixture])
  await expect(todosApi.list(signal)).resolves.toEqual([todoFixture])
  expect(request).toHaveBeenCalledWith('/todos', { signal })
})

it('fetches statistics with the abort signal', async () => {
  const signal = new AbortController().signal
  const stats = {
    total: 1,
    completed: 0,
    active: 1,
    overdue: 0,
    byPriority: { low: 0, medium: 1, high: 0 },
  }
  vi.mocked(request).mockResolvedValue(stats)
  await expect(todosApi.stats(signal)).resolves.toEqual(stats)
  expect(request).toHaveBeenCalledWith('/todos/stats', { signal })
})

it('sends only writable task fields on creation', async () => {
  vi.mocked(request).mockResolvedValue(todoFixture)
  await expect(todosApi.create(todoFixture)).resolves.toEqual(todoFixture)
  expect(request).toHaveBeenCalledWith('/todos', {
    method: 'POST',
    body: JSON.stringify({
      title: todoFixture.title,
      description: '',
      priority: 'medium',
      due_date: null,
      completed: false,
    }),
  })
})

it('sends only writable fields when updating a task', async () => {
  vi.mocked(request).mockResolvedValue(todoFixture)
  await todosApi.update(7, { ...todoFixture, completed: true })
  expect(request).toHaveBeenCalledWith('/todos/7', {
    method: 'PATCH',
    body: JSON.stringify({
      title: todoFixture.title,
      description: '',
      priority: 'medium',
      due_date: null,
      completed: true,
    }),
  })
})

it('omits unspecified fields from a partial update body', async () => {
  vi.mocked(request).mockResolvedValue(todoFixture)
  await todosApi.update(7, { completed: true })
  const init = vi.mocked(request).mock.calls[0][1] as { body: string }
  expect(JSON.parse(init.body)).toEqual({ completed: true })
})

it('deletes a task by id', async () => {
  vi.mocked(request).mockResolvedValue(undefined)
  await todosApi.remove(7)
  expect(request).toHaveBeenCalledWith('/todos/7', { method: 'DELETE' })
})
