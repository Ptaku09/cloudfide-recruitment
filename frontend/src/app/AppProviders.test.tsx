import { QueryClient, useQueryClient } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { useTheme } from 'styled-components'
import { queryClient } from '../lib/queryClient'
import { AppProviders } from './AppProviders'

vi.mock('../design-system', () => import('../design-system/mocks'))

function Probe() {
  const client = useQueryClient()
  const theme = useTheme()
  return (
    <p>
      {client === queryClient ? 'default' : 'custom'}:{typeof theme}
    </p>
  )
}

it('provides the shared query client and theme by default', () => {
  render(
    <AppProviders>
      <Probe />
    </AppProviders>,
  )
  expect(screen.getByText('default:object')).toBeVisible()
})

it('uses a client passed through props', () => {
  render(
    <AppProviders client={new QueryClient()}>
      <Probe />
    </AppProviders>,
  )
  expect(screen.getByText('custom:object')).toBeVisible()
})
