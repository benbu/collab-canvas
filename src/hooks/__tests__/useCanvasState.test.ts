import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCanvasState } from '../useCanvasState'

describe('useCanvasState reducers', () => {
  it('adds, updates, and removes shapes', () => {
    const { result } = renderHook(() => useCanvasState())

    act(() => {
      result.current.addShape({ type: 'rect', x: 0, y: 0, width: 10, height: 10, fill: '#000' })
    })
    const id = result.current.state.allIds[0]
    expect(result.current.state.byId[id]).toBeTruthy()

    act(() => {
      result.current.updateShape(id, { x: 5 })
    })
    expect(result.current.state.byId[id].x).toBe(5)

    act(() => {
      result.current.removeShape(id)
    })
    expect(result.current.state.byId[id]).toBeUndefined()
    expect(result.current.state.allIds).toHaveLength(0)
  })
})


