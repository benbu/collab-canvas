import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
// Note: App already includes BrowserRouter; avoid nesting routers in tests
import App from '../../../src/App'

describe('App smoke test', () => {
  it('renders login by default route', () => {
    render(<App />)
    expect(screen.getByText('Login')).toBeTruthy()
  })

  it('renders the canvas stage on /room/default', () => {
    window.history.pushState({}, '', '/room/default')
    render(<App />)
    expect(screen.getByTestId('stage')).toBeTruthy()
  })
})


