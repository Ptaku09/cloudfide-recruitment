import { render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { useTodoStatsQuery } from '../hooks/useTodoStatsQuery'
import type { TodoStats as Stats } from '../types'
import { TodoStats } from './TodoStats'

vi.mock('../../../design-system', () => import('../../../design-system/mocks'))
vi.mock('../hooks/useTodoStatsQuery', () => ({ useTodoStatsQuery: vi.fn() }))

beforeEach(() => vi.clearAllMocks())

const stats: Stats = {
  total: 5,
  completed: 2,
  active: 3,
  overdue: 1,
  byPriority: { low: 1, medium: 2, high: 2 },
}

function mockStats(data: Stats | undefined) {
  vi.mocked(useTodoStatsQuery).mockReturnValue({
    data,
  } as unknown as ReturnType<typeof useTodoStatsQuery>)
}

it('shows total, active, completed and overdue counts', () => {
  mockStats(stats)
  render(<TodoStats />)
  const region = screen.getByRole('region', { name: 'Task statistics' })
  expect(region).toHaveTextContent('5 total')
  expect(region).toHaveTextContent('3 active')
  expect(region).toHaveTextContent('2 completed')
  expect(region).toHaveTextContent('1 overdue')
})

it('hides the overdue badge when nothing is overdue', () => {
  mockStats({ ...stats, overdue: 0 })
  render(<TodoStats />)
  expect(screen.getByText('5 total')).toBeVisible()
  expect(screen.queryByText(/overdue/)).not.toBeInTheDocument()
})

it.each([
  ['loading or failed', undefined],
  ['empty', { ...stats, total: 0, active: 0, completed: 0, overdue: 0 }],
])('renders nothing when stats are %s', (_label, data) => {
  mockStats(data)
  const { container } = render(<TodoStats />)
  expect(container).toBeEmptyDOMElement()
})
