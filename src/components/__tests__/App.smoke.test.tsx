import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../../../src/App'

describe('App smoke test', () => {
  it('renders the placeholder canvas route', () => {
    render(<App />)
    const el = screen.getByText(/Placeholder canvas route/i)
    expect(el).toBeTruthy()
  })
})


