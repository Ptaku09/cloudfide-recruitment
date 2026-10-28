import type { Todo, TodoStats } from './types.js';

export function computeStats(todos: Todo[], today: string): TodoStats {
  const stats: TodoStats = { total: todos.length, completed: 0, active: 0, overdue: 0, byPriority: { low: 0, medium: 0, high: 0 } };
  for (const todo of todos) {
    if (todo.completed) stats.completed += 1;
    else stats.active += 1;
    // Calendar dates in YYYY-MM-DD compare correctly as strings.
    if (!todo.completed && todo.due_date !== null && todo.due_date < today) stats.overdue += 1;
    stats.byPriority[todo.priority] += 1;
  }
  return stats;
}
