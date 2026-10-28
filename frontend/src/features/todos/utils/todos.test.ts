import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatDate, isOverdue, selectTodos, validateTodo } from './todos'
import type { Todo } from '../types'

const base: Todo = {
  id: 1,
  title: 'Sprint plan',
  description: '',
  priority: 'medium',
  completed: false,
  due_date: null,
  created_at: '2026-10-01T12:00:00Z',
  updated_at: '2026-10-01T12:00:00Z',
}

describe('selectTodos', () => {
  it('combines status with a case-insensitive search in the description', () => {
    const matching = { ...base, description: 'Discuss the API' }
    const todos = [
      matching,
      { ...matching, id: 2, completed: true },
      { ...base, id: 3 },
    ]
    expect(selectTodos(todos, 'active', ' api ', 'newest')).toEqual([matching])
  })

  it('sorts by priority without changing the source array', () => {
    const high: Todo = { ...base, id: 2, priority: 'high' }
    const todos = [base, high]
    expect(selectTodos(todos, 'all', '', 'priority')).toEqual([high, base])
    expect(todos).toEqual([base, high])
  })
})

describe('selectTodos ordering and filters', () => {
  it('filters completed tasks only', () => {
    const done = { ...base, id: 2, completed: true }
    expect(selectTodos([base, done], 'completed', '', 'newest')).toEqual([done])
  })

  it('sorts by newest creation date, then by higher id', () => {
    const older = { ...base, id: 2, created_at: '2026-09-01T12:00:00Z' }
    const sameDate = { ...base, id: 3 }
    expect(selectTodos([older, base, sameDate], 'all', '', 'newest')).toEqual([
      sameDate,
      base,
      older,
    ])
  })

  it('sorts by due date with undated tasks last', () => {
    const soon = { ...base, id: 2, due_date: '2026-10-02' }
    const later = { ...base, id: 3, due_date: '2026-11-02' }
    expect(selectTodos([base, later, soon], 'all', '', 'due')).toEqual([
      soon,
      later,
      base,
    ])
  })

  it('breaks priority ties by higher id', () => {
    const other = { ...base, id: 2 }
    expect(selectTodos([base, other], 'all', '', 'priority')).toEqual([
      other,
      base,
    ])
  })
})

describe('validateTodo', () => {
  const valid = { ...base, due_date: null }

  it('accepts a valid task', () => {
    expect(validateTodo(valid)).toEqual({})
  })

  it('rejects blank titles and titles over 120 characters', () => {
    expect(validateTodo({ ...valid, title: '   ' }).title).toBe(
      'Enter a task title.',
    )
    expect(validateTodo({ ...valid, title: 'x'.repeat(120) })).toEqual({})
    expect(validateTodo({ ...valid, title: 'x'.repeat(121) }).title).toBe(
      'The title must be at most 120 characters.',
    )
  })

  it('rejects descriptions over 2000 characters', () => {
    expect(validateTodo({ ...valid, description: 'x'.repeat(2000) })).toEqual(
      {},
    )
    expect(
      validateTodo({ ...valid, description: 'x'.repeat(2001) }).description,
    ).toBe('The description must be at most 2000 characters.')
  })

  it.each(['2026-02-30', '2026-2-3', 'tomorrow', '2026-13-01'])(
    'rejects invalid due date %s',
    (due_date) => {
      expect(validateTodo({ ...valid, due_date }).due_date).toBe(
        'Enter a valid date.',
      )
    },
  )

  it('accepts a valid leap-day due date', () => {
    expect(validateTodo({ ...valid, due_date: '2028-02-29' })).toEqual({})
  })
})

describe('isOverdue', () => {
  afterEach(() => vi.useRealTimers())

  function at(date: Date) {
    vi.useFakeTimers()
    vi.setSystemTime(date)
  }

  it('is overdue only when the due date is before today and not completed', () => {
    at(new Date(2026, 9, 15, 12))
    expect(isOverdue({ ...base, due_date: '2026-10-14' })).toBe(true)
    expect(isOverdue({ ...base, due_date: '2026-10-15' })).toBe(false)
    expect(isOverdue({ ...base, due_date: '2026-10-16' })).toBe(false)
    expect(isOverdue({ ...base, due_date: null })).toBe(false)
    expect(
      isOverdue({ ...base, due_date: '2026-10-14', completed: true }),
    ).toBe(false)
  })

  it('zero-pads single-digit months and days of the local date', () => {
    at(new Date(2026, 0, 5, 12))
    expect(isOverdue({ ...base, due_date: '2026-01-04' })).toBe(true)
    expect(isOverdue({ ...base, due_date: '2026-01-05' })).toBe(false)
  })
})

describe('formatDate', () => {
  it('formats a calendar date in en-GB style', () => {
    expect(formatDate('2026-10-05')).toBe('5 Oct 2026')
  })
})
