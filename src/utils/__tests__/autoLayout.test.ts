import { describe, it, expect } from 'vitest'
import { autoLayout } from '../autoLayout'
import type { Shape } from '../../hooks/useCanvasState'

describe('autoLayout', () => {
  it('returns empty array for empty input', () => {
    const result = autoLayout([])
    expect(result).toEqual([])
  })

  it('returns same position for single shape', () => {
    const shapes: Shape[] = [
      { id: '1', type: 'rect', x: 100, y: 100, width: 50, height: 50, fill: '#fff' }
    ]
    const result = autoLayout(shapes)
    expect(result).toEqual([{ id: '1', x: 100, y: 100 }])
  })

  it('arranges multiple rectangles in a grid', () => {
    const shapes: Shape[] = [
      { id: '1', type: 'rect', x: 0, y: 0, width: 100, height: 100, fill: '#fff' },
      { id: '2', type: 'rect', x: 0, y: 0, width: 100, height: 100, fill: '#fff' },
      { id: '3', type: 'rect', x: 0, y: 0, width: 100, height: 100, fill: '#fff' },
      { id: '4', type: 'rect', x: 0, y: 0, width: 100, height: 100, fill: '#fff' }
    ]
    const result = autoLayout(shapes)
    
    // Should have 4 results
    expect(result).toHaveLength(4)
    
    // All should have unique IDs matching input
    expect(result.map(r => r.id).sort()).toEqual(['1', '2', '3', '4'])
    
    // Positions should be different (arranged in grid)
    const positions = result.map(r => `${r.x},${r.y}`)
    const uniquePositions = new Set(positions)
    expect(uniquePositions.size).toBeGreaterThan(1) // At least some should have different positions
  })

  it('handles circles correctly', () => {
    const shapes: Shape[] = [
      { id: '1', type: 'circle', x: 0, y: 0, radius: 50, fill: '#fff' },
      { id: '2', type: 'circle', x: 0, y: 0, radius: 30, fill: '#fff' }
    ]
    const result = autoLayout(shapes)
    
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('1')
    expect(result[1].id).toBe('2')
  })

  it('handles text shapes correctly', () => {
    const shapes: Shape[] = [
      { id: '1', type: 'text', x: 0, y: 0, text: 'Hello', fontSize: 18, fill: '#000' },
      { id: '2', type: 'text', x: 0, y: 0, text: 'World', fontSize: 24, fill: '#000' }
    ]
    const result = autoLayout(shapes)
    
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('1')
    expect(result[1].id).toBe('2')
  })

  it('centers grid around original selection center', () => {
    // Create shapes at a specific location
    const shapes: Shape[] = [
      { id: '1', type: 'rect', x: 100, y: 100, width: 50, height: 50, fill: '#fff' },
      { id: '2', type: 'rect', x: 200, y: 200, width: 50, height: 50, fill: '#fff' }
    ]
    
    // Calculate original center
    const originalCenterX = (100 + 150 + 200 + 250) / 4 // (min + max) / 2 for each
    const originalCenterY = (100 + 150 + 200 + 250) / 4
    
    const result = autoLayout(shapes)
    
    // New layout should be centered around original center
    const newMinX = Math.min(...result.map(r => r.x))
    const newMaxX = Math.max(...result.map(r => r.x)) + 50 // add width
    const newMinY = Math.min(...result.map(r => r.y))
    const newMaxY = Math.max(...result.map(r => r.y)) + 50 // add height
    
    const newCenterX = (newMinX + newMaxX) / 2
    const newCenterY = (newMinY + newMaxY) / 2
    
    // Centers should be approximately the same (within 1 pixel due to rounding)
    expect(Math.abs(newCenterX - originalCenterX)).toBeLessThan(1)
    expect(Math.abs(newCenterY - originalCenterY)).toBeLessThan(1)
  })

  it('uses adaptive spacing based on shape sizes', () => {
    const smallShapes: Shape[] = [
      { id: '1', type: 'rect', x: 0, y: 0, width: 10, height: 10, fill: '#fff' },
      { id: '2', type: 'rect', x: 0, y: 0, width: 10, height: 10, fill: '#fff' }
    ]
    const smallResult = autoLayout(smallShapes)
    const smallSpacing = Math.abs(smallResult[1].x - smallResult[0].x) - 10
    
    const largeShapes: Shape[] = [
      { id: '1', type: 'rect', x: 0, y: 0, width: 100, height: 100, fill: '#fff' },
      { id: '2', type: 'rect', x: 0, y: 0, width: 100, height: 100, fill: '#fff' }
    ]
    const largeResult = autoLayout(largeShapes)
    const largeSpacing = Math.abs(largeResult[1].x - largeResult[0].x) - 100
    
    // Larger shapes should have proportionally larger spacing
    expect(largeSpacing).toBeGreaterThan(smallSpacing)
  })
})

