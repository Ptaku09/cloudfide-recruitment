import { it, expect } from 'vitest';
import { computeStats } from '../src/features/todos/stats.ts';
import { todo } from './fixture.ts';

const make = (over: Partial<typeof todo>) => ({ ...todo, ...over });

it('returns zeros for no tasks', () => {
  expect(computeStats([], '2026-10-16')).toEqual({ total: 0, completed: 0, active: 0, overdue: 0, byPriority: { low: 0, medium: 0, high: 0 } });
});
it('counts completed, active and priorities', () => {
  const stats = computeStats([make({ completed: true, priority: 'low' }), make({ priority: 'medium' }), make({ priority: 'high' })], '2026-10-01');
  expect(stats).toMatchObject({ total: 3, completed: 1, active: 2, overdue: 0, byPriority: { low: 1, medium: 1, high: 1 } });
});
it('counts only active tasks with a past due date as overdue', () => {
  const stats = computeStats([
    make({ due_date: '2026-10-15' }), // overdue
    make({ due_date: '2026-10-16' }), // due today: not overdue
    make({ due_date: '2026-10-17' }),
    make({ due_date: null }),
    make({ due_date: '2026-10-01', completed: true }),
  ], '2026-10-16');
  expect(stats.overdue).toBe(1);
});
