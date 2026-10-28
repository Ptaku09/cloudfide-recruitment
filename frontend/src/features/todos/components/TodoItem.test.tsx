import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { todoFixture } from '../../../test/todoFixture'
import { TodoItem } from './TodoItem'

vi.mock('../../../design-system', () => import('../../../design-system/mocks'))

it('shows an active task and forwards edit requests', async () => {
  const user = userEvent.setup()
  const onEdit = vi.fn()
  const onToggle = vi.fn()
  const onDelete = vi.fn()
  render(
    <TodoItem
      todo={todoFixture}
      busy={false}
      onEdit={onEdit}
      onToggle={onToggle}
      onDelete={onDelete}
    />,
  )
  expect(screen.getByRole('heading', { name: todoFixture.title })).toBeVisible()
  expect(screen.getByText('To do')).toBeVisible()
  expect(screen.getByText('Medium')).toBeVisible()
  expect(screen.getByRole('checkbox')).not.toBeChecked()
  await user.click(
    screen.getByRole('button', { name: `Edit: ${todoFixture.title}` }),
  )
  expect(onEdit).toHaveBeenCalledTimes(1)
  expect(onToggle).not.toHaveBeenCalled()
  expect(onDelete).not.toHaveBeenCalled()
})

function renderItem(overrides: Partial<typeof todoFixture> = {}, busy = false) {
  const handlers = { onToggle: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn() }
  const todo = { ...todoFixture, ...overrides }
  render(<TodoItem todo={todo} busy={busy} {...handlers} />)
  return { todo, ...handlers }
}

it('forwards toggle and delete requests', async () => {
  const user = userEvent.setup()
  const { onToggle, onDelete, onEdit } = renderItem()
  await user.click(
    screen.getByRole('checkbox', { name: `Complete: ${todoFixture.title}` }),
  )
  await user.click(
    screen.getByRole('button', { name: `Delete: ${todoFixture.title}` }),
  )
  expect(onToggle).toHaveBeenCalledTimes(1)
  expect(onDelete).toHaveBeenCalledTimes(1)
  expect(onEdit).not.toHaveBeenCalled()
})

it('shows a completed task with its description and priority', () => {
  renderItem({ completed: true, description: 'Details', priority: 'high' })
  expect(screen.getByText('Completed')).toBeVisible()
  expect(screen.getByText('Details')).toBeVisible()
  expect(screen.getByText('High')).toBeVisible()
  expect(
    screen.getByRole('checkbox', {
      name: `Mark as active: ${todoFixture.title}`,
    }),
  ).toBeChecked()
})

it('omits the description and due date when absent', () => {
  renderItem()
  expect(screen.queryByText(/overdue/)).not.toBeInTheDocument()
  expect(screen.queryByText(/20\d\d/)).not.toBeInTheDocument()
})

it('flags an unfinished task with a past due date as overdue', () => {
  renderItem({ due_date: '2000-01-05' })
  expect(screen.getByText(/5 Jan 2000/)).toHaveTextContent('· overdue')
})

it('does not flag a completed task as overdue', () => {
  renderItem({ due_date: '2000-01-05', completed: true })
  expect(screen.getByText(/5 Jan 2000/)).not.toHaveTextContent('overdue')
})

it('disables every action while busy', () => {
  renderItem({}, true)
  expect(screen.getByRole('checkbox')).toBeDisabled()
  expect(
    screen.getByRole('button', { name: `Edit: ${todoFixture.title}` }),
  ).toBeDisabled()
  expect(
    screen.getByRole('button', { name: `Delete: ${todoFixture.title}` }),
  ).toBeDisabled()
})
