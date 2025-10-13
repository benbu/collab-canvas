import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Canvas from '../Canvas'

// augment jsdom Window typing for test
Object.defineProperty(window, 'innerWidth', { writable: true, value: window.innerWidth })

describe('Canvas', () => {
  it('mounts and renders Stage', () => {
    render(<Canvas />)
    expect(screen.getByTestId('stage')).toBeTruthy()
  })

  it('updates size on window resize', async () => {
    render(<Canvas />)
    const stage = screen.getByTestId('stage') as HTMLDivElement
    const initialWidth = Number(stage.getAttribute('data-width')) || window.innerWidth
    window.innerWidth = initialWidth + 100
    window.dispatchEvent(new Event('resize'))
    // allow effect to run
    await Promise.resolve()
    const updatedWidth = Number(stage.getAttribute('data-width')) || initialWidth
    expect(updatedWidth).toBeGreaterThan(initialWidth)
  })
})


