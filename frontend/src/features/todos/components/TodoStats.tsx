import { Badge } from '../../../design-system'
import { useTodoStatsQuery } from '../hooks/useTodoStatsQuery'

export function TodoStats() {
  const { data: stats } = useTodoStatsQuery()
  // Statistics are supplementary: stay hidden while loading or on error.
  if (!stats || stats.total === 0) return null
  return (
    <section aria-label="Task statistics" className="todo-stats">
      <Badge>{stats.total} total</Badge>
      <Badge variant="info">{stats.active} active</Badge>
      <Badge variant="success">{stats.completed} completed</Badge>
      {stats.overdue > 0 && (
        <Badge variant="warning">{stats.overdue} overdue</Badge>
      )}
    </section>
  )
}
