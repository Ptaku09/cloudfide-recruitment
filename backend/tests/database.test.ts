import { it, expect, vi } from 'vitest';
import { createDatabase, initialize } from '../src/core/database.ts';
import type { Database } from '../src/features/todos/types.ts';

it('creates a Prisma client without opening a connection', () => {
  const database = createDatabase('postgresql://test:test@localhost:5432/test');
  expect(database.todo.findMany).toEqual(expect.any(Function));
});

it('initializes the todos table idempotently with the legacy-compatible schema', async () => {
  const $executeRaw = vi.fn().mockResolvedValue(0);
  await initialize({ $executeRaw } as unknown as Database);
  expect($executeRaw).toHaveBeenCalledTimes(1);
  const sql = ($executeRaw.mock.calls[0][0] as string[]).join('');
  expect(sql).toContain('CREATE TABLE IF NOT EXISTS todos');
  expect(sql).toContain("priority IN ('low', 'medium', 'high')");
  expect(sql).toContain('title VARCHAR(120) NOT NULL');
});

it('propagates initialization errors', async () => {
  const $executeRaw = vi.fn().mockRejectedValue(new Error('connection refused'));
  await expect(initialize({ $executeRaw } as unknown as Database)).rejects.toThrow('connection refused');
});
