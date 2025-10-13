import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Canvas from '../Canvas'

describe('Shape creation', () => {
  it('creates a rectangle on click when rect tool is active', () => {
    render(<Canvas />)
    // click rect tool
    fireEvent.click(screen.getByRole('button', { name: /rect/i }))
    // click stage area
    fireEvent.mouseDown(screen.getByTestId('stage'))
    expect(screen.getAllByTestId('rect').length).toBeGreaterThan(0)
  })

  it('creates text with input value when text tool is active', () => {
    render(<Canvas />)
    fireEvent.click(screen.getByRole('button', { name: /text/i }))
    const input = screen.getByLabelText('text') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Hello' } })
    fireEvent.mouseDown(screen.getByTestId('stage'))
    expect(screen.getAllByTestId('text').length).toBeGreaterThan(0)
  })
})


