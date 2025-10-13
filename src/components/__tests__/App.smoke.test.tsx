import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../../../src/App'

describe('App smoke test', () => {
  it('renders the canvas stage', () => {
    render(<App />)
    expect(screen.getByTestId('stage')).toBeTruthy()
  })
})


