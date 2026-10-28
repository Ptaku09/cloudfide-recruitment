import { afterEach, expect, it, vi } from 'vitest'
import { request } from './http'

afterEach(() => vi.restoreAllMocks())

function mockFetch(body: BodyInit | null, status = 200) {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(body, { status }))
}

it('prefixes /api, sends JSON headers and parses the response', async () => {
  const fetch = mockFetch(JSON.stringify([{ id: 1 }]))
  await expect(
    request('/todos', { method: 'POST', headers: { 'X-Test': '1' } }),
  ).resolves.toEqual([{ id: 1 }])
  expect(fetch).toHaveBeenCalledWith('/api/todos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Test': '1' },
  })
})

it('returns undefined for 204 responses', async () => {
  mockFetch(null, 204)
  await expect(
    request('/todos/1', { method: 'DELETE' }),
  ).resolves.toBeUndefined()
})

it('maps 422 to a user-facing validation message', async () => {
  mockFetch(JSON.stringify({ detail: [{ msg: 'raw' }] }), 422)
  await expect(request('/todos')).rejects.toThrow(/Check the task details/)
})

it('uses the string detail of other errors', async () => {
  mockFetch(JSON.stringify({ detail: 'Task not found' }), 404)
  await expect(request('/todos/9')).rejects.toThrow('Task not found')
})

it.each([
  ['a non-string detail', JSON.stringify({ detail: { a: 1 } })],
  ['a missing detail', JSON.stringify({})],
  ['a non-JSON body', 'oops'],
])('falls back to a generic message for %s', async (_, body) => {
  mockFetch(body, 500)
  await expect(request('/todos')).rejects.toThrow(
    'The operation failed. Please try again.',
  )
})

it('reports network failures as a connection error', async () => {
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('failed'))
  await expect(request('/todos')).rejects.toThrow(
    'Cannot connect to the server. Please try again.',
  )
})

it('rethrows the original error when the request was aborted', async () => {
  const controller = new AbortController()
  controller.abort()
  const abortError = new DOMException('Aborted', 'AbortError')
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(abortError)
  await expect(request('/todos', { signal: controller.signal })).rejects.toBe(
    abortError,
  )
})
