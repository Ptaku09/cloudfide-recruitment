import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { useNotice } from '../../hooks/useNotice'
import { todoFixture } from '../../test/todoFixture'
import { useTodoFilters } from './hooks/useTodoFilters'
import { useTodosBusy } from './hooks/useTodosBusy'
import { useTodosQuery } from './hooks/useTodosQuery'
import { useUpdateTodoMutation } from './hooks/useUpdateTodoMutation'
import { TodosPage } from './TodosPage'
import type { Todo } from './types'

vi.mock('../../design-system', () => import('../../design-system/mocks'))
vi.mock('../../hooks/useNotice', () => ({ useNotice: vi.fn() }))
vi.mock('./hooks/useTodoFilters', () => ({ useTodoFilters: vi.fn() }))
vi.mock('./hooks/useTodosBusy', () => ({ useTodosBusy: vi.fn() }))
vi.mock('./hooks/useTodosQuery', () => ({ useTodosQuery: vi.fn() }))
vi.mock('./hooks/useUpdateTodoMutation', () => ({
  useUpdateTodoMutation: vi.fn(),
}))
vi.mock('./components/TodosHeader', () => ({
  TodosHeader: (props: { disabled: boolean; onCreate: () => void }) => (
    <button disabled={props.disabled} onClick={props.onCreate}>
      New task
    </button>
  ),
}))
vi.mock('./components/TodoFilters', () => ({ TodoFilters: () => null }))
vi.mock('./components/TodoList', () => ({
  TodoList: (props: {
    todos: Todo[]
    hasTodos: boolean
    loading: boolean
    onToggle: (todo: Todo) => void
    onEdit: (todo: Todo) => void
    onDelete: (todo: Todo) => void
  }) => (
    <div>
      <p>
        list:{props.todos.length} has:{String(props.hasTodos)} loading:
        {String(props.loading)}
      </p>
      <button onClick={() => props.onToggle(props.todos[0])}>toggle</button>
      <button onClick={() => props.onEdit(props.todos[0])}>edit</button>
      <button onClick={() => props.onDelete(props.todos[0])}>delete</button>
    </div>
  ),
}))
vi.mock('./components/TodoEditor', () => ({
  TodoEditor: (props: {
    todo: Todo | 'new'
    onClose: () => void
    onSaved: (notice: string) => void
  }) => (
    <div role="dialog" aria-label="editor">
      <p>{props.todo === 'new' ? 'creating' : `editing ${props.todo.title}`}</p>
      <button onClick={props.onClose}>close editor</button>
      <button onClick={() => props.onSaved('Saved!')}>save editor</button>
    </div>
  ),
}))
vi.mock('./components/DeleteTodoDialog', () => ({
  DeleteTodoDialog: (props: {
    todo: Todo
    onClose: () => void
    onDeleted: () => void
  }) => (
    <div role="dialog" aria-label="delete">
      <p>deleting {props.todo.title}</p>
      <button onClick={props.onClose}>close delete</button>
      <button onClick={props.onDeleted}>confirm delete</button>
    </div>
  ),
}))
vi.mock('../../components/SuccessNotice', () => ({
  SuccessNotice: ({ message }: { message: string }) => <p>notice:{message}</p>,
}))

const notify = vi.fn()
const mutateAsync = vi.fn()

function setup({
  busy = false,
  isPending = false,
  todos = [todoFixture],
  mutationError = null as Error | null,
} = {}) {
  vi.mocked(useTodosQuery).mockReturnValue({
    data: todos,
    isPending,
    isFetching: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useTodosQuery>)
  vi.mocked(useUpdateTodoMutation).mockReturnValue({
    error: mutationError,
    reset: vi.fn(),
    mutateAsync,
  } as unknown as ReturnType<typeof useUpdateTodoMutation>)
  vi.mocked(useTodosBusy).mockReturnValue(busy)
  vi.mocked(useNotice).mockReturnValue({ message: 'hello', notify })
  vi.mocked(useTodoFilters).mockImplementation((all) => ({
    filter: 'all',
    search: '',
    sort: 'newest',
    visible: all,
    setFilter: vi.fn(),
    setSearch: vi.fn(),
    setSort: vi.fn(),
  }))
  render(<TodosPage />)
}

beforeEach(() => vi.clearAllMocks())

it('passes list state down and shows the current notice', () => {
  setup()
  expect(screen.getByText('list:1 has:true loading:false')).toBeVisible()
  expect(screen.getByText('notice:hello')).toBeVisible()
  expect(screen.queryByTestId('alert')).not.toBeInTheDocument()
})

it('disables creation while loading', () => {
  setup({ isPending: true, todos: [] })
  expect(screen.getByRole('button', { name: 'New task' })).toBeDisabled()
})

it.each([
  [false, 'Another task complete. Well done!'],
  [true, 'Task marked as active.'],
])('toggles a task (completed=%s) and notifies', async (completed, message) => {
  const user = userEvent.setup()
  mutateAsync.mockResolvedValue({ ...todoFixture, completed: !completed })
  setup({ todos: [{ ...todoFixture, completed }] })
  await user.click(screen.getByRole('button', { name: 'toggle' }))
  expect(mutateAsync).toHaveBeenCalledWith({
    id: todoFixture.id,
    input: { completed: !completed },
  })
  await waitFor(() => expect(notify).toHaveBeenCalledWith(message))
})

it('does not toggle while busy', async () => {
  const user = userEvent.setup()
  setup({ busy: true })
  await user.click(screen.getByRole('button', { name: 'toggle' }))
  expect(mutateAsync).not.toHaveBeenCalled()
})

it('swallows a failed toggle without notifying', async () => {
  const user = userEvent.setup()
  mutateAsync.mockRejectedValue(new Error('fail'))
  setup()
  await user.click(screen.getByRole('button', { name: 'toggle' }))
  await waitFor(() => expect(mutateAsync).toHaveBeenCalled())
  expect(notify).not.toHaveBeenCalled()
})

it('shows a mutation error in the alert', () => {
  setup({ mutationError: new Error('Toggle failed') })
  expect(screen.getByTestId('alert')).toHaveTextContent('Toggle failed')
})

it('opens the editor for a new task, then closes it without a notice', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByRole('button', { name: 'New task' }))
  expect(screen.getByText('creating')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'close editor' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(notify).not.toHaveBeenCalled()
})

it('opens the editor for an existing task and notifies when saved', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByRole('button', { name: 'edit' }))
  expect(screen.getByText(`editing ${todoFixture.title}`)).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'save editor' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(notify).toHaveBeenCalledWith('Saved!')
})

it('confirms deletion, closes the dialog and notifies', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByRole('button', { name: 'delete' }))
  expect(screen.getByText(`deleting ${todoFixture.title}`)).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'confirm delete' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(notify).toHaveBeenCalledWith('Task deleted.')
})

it('cancels deletion without notifying', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByRole('button', { name: 'delete' }))
  await user.click(screen.getByRole('button', { name: 'close delete' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(notify).not.toHaveBeenCalled()
})
