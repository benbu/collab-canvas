import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../../../src/App'

describe('App smoke test', () => {
  it('renders the login page by default', () => {
    render(<App />)
    expect(screen.getByText('Login')).toBeTruthy()
  })
})


