import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Canvas from '../Canvas'
import { AuthProvider } from '../../../contexts/AuthContext'

describe('Interactions', () => {
  it('delete removes created rect', () => {
    render(
      <AuthProvider>
        <Canvas />
      </AuthProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: /rect/i }))
    fireEvent.mouseDown(screen.getByTestId('stage'), { clientX: 120, clientY: 120 })
    expect(screen.getAllByTestId('rect').length).toBeGreaterThan(0)

    // select tool and select rect by shift-click (toggle)
    fireEvent.click(screen.getByRole('button', { name: /select/i }))
    const rect = screen.getAllByTestId('rect')[0]
    fireEvent.mouseDown(rect, { shiftKey: false })

    fireEvent.keyDown(window, { key: 'Delete' })
    // no rect nodes should remain
    expect(screen.queryAllByTestId('rect').length).toBe(0)
  })

  it('duplicate via Cmd/Ctrl+D adds another shape', () => {
    render(
      <AuthProvider>
        <Canvas />
      </AuthProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: /rect/i }))
    fireEvent.mouseDown(screen.getByTestId('stage'), { clientX: 120, clientY: 120 })
    fireEvent.click(screen.getByRole('button', { name: /select/i }))
    const rect = screen.getAllByTestId('rect')[0]
    fireEvent.mouseDown(rect)
    const before = screen.getAllByTestId('rect').length
    fireEvent.keyDown(window, { key: 'd', metaKey: true })
    const after = screen.getAllByTestId('rect').length
    expect(after).toBeGreaterThan(before)
  })
})


