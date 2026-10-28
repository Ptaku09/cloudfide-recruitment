import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { todoFixture } from '../../../test/todoFixture'
import { TodoList } from './TodoList'

vi.mock('../../../design-system', () => import('../../../design-system/mocks'))
vi.mock('./TodoEmptyState', () => ({
  TodoEmptyState: () => <p>Empty task list</p>,
}))
vi.mock('./TodoItem', () => ({
  TodoItem: ({
    todo,
    onToggle,
    onEdit,
    onDelete,
  }: {
    todo: { id: number }
    onToggle: () => void
    onEdit: () => void
    onDelete: () => void
  }) => (
    <li>
      <span>Task</span>
      <button onClick={onToggle}>toggle {todo.id}</button>
      <button onClick={onEdit}>edit {todo.id}</button>
      <button onClick={onDelete}>delete {todo.id}</button>
    </li>
  ),
}))

it('shows loading feedback before showing an empty list', () => {
  const props = {
    todos: [],
    hasTodos: false,
    failed: false,
    busy: false,
    onCreate: vi.fn(),
    onToggle: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
  }
  const { rerender } = render(<TodoList {...props} loading />)
  expect(screen.getByRole('status')).toHaveTextContent('Loading your tasks…')
  expect(screen.queryByText('Empty task list')).not.toBeInTheDocument()
  rerender(<TodoList {...props} loading={false} />)
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(screen.getByText('Empty task list')).toBeVisible()
})

const listProps = {
  hasTodos: false,
  loading: false,
  failed: false,
  busy: false,
  onCreate: vi.fn(),
  onToggle: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
}

it('shows an unavailable message when loading failed and nothing is cached', () => {
  render(<TodoList {...listProps} todos={[]} failed />)
  expect(
    screen.getByRole('heading', {
      name: 'The task list is temporarily unavailable',
    }),
  ).toBeVisible()
  expect(screen.queryByText('Empty task list')).not.toBeInTheDocument()
})

it('keeps showing cached tasks when a refetch failed', () => {
  render(<TodoList {...listProps} hasTodos todos={[todoFixture]} failed />)
  expect(screen.getByText('Task')).toBeVisible()
  expect(screen.queryByText(/temporarily unavailable/)).not.toBeInTheDocument()
})

it('renders one item per task', () => {
  render(
    <TodoList
      {...listProps}
      hasTodos
      todos={[todoFixture, { ...todoFixture, id: 8 }]}
    />,
  )
  expect(screen.getAllByText('Task')).toHaveLength(2)
})

it('calls item callbacks with the task they belong to', async () => {
  const user = userEvent.setup()
  const onToggle = vi.fn()
  const onEdit = vi.fn()
  const onDelete = vi.fn()
  const other = { ...todoFixture, id: 8 }
  render(
    <TodoList
      {...listProps}
      hasTodos
      todos={[todoFixture, other]}
      onToggle={onToggle}
      onEdit={onEdit}
      onDelete={onDelete}
    />,
  )
  await user.click(screen.getByRole('button', { name: 'toggle 8' }))
  await user.click(screen.getByRole('button', { name: 'edit 7' }))
  await user.click(screen.getByRole('button', { name: 'delete 8' }))
  expect(onToggle).toHaveBeenCalledWith(other)
  expect(onEdit).toHaveBeenCalledWith(todoFixture)
  expect(onDelete).toHaveBeenCalledWith(other)
})
