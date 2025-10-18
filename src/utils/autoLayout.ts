import type { Shape } from '../hooks/useCanvasState'

interface BoundingBox {
  width: number
  height: number
}

/**
 * Calculate the bounding box dimensions for a shape
 */
function getShapeBounds(shape: Shape): BoundingBox {
  if (shape.type === 'rect') {
    return {
      width: shape.width ?? 0,
      height: shape.height ?? 0,
    }
  }
  
  if (shape.type === 'circle') {
    const diameter = (shape.radius ?? 0) * 2
    return {
      width: diameter,
      height: diameter,
    }
  }
  
  // text
  const fontSize = shape.fontSize ?? 18
  const textLength = shape.text?.length ?? 1
  const approxCharWidth = Math.max(5, Math.round(fontSize * 0.6))
  return {
    width: Math.max(10, textLength * approxCharWidth),
    height: fontSize,
  }
}

/**
 * Calculate the center point of a collection of shapes
 */
function calculateSelectionCenter(shapes: Shape[]): { x: number; y: number } {
  if (shapes.length === 0) return { x: 0, y: 0 }
  
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  
  shapes.forEach(shape => {
    const bounds = getShapeBounds(shape)
    const shapeMinX = shape.x
    const shapeMinY = shape.y
    const shapeMaxX = shape.x + bounds.width
    const shapeMaxY = shape.y + bounds.height
    
    minX = Math.min(minX, shapeMinX)
    minY = Math.min(minY, shapeMinY)
    maxX = Math.max(maxX, shapeMaxX)
    maxY = Math.max(maxY, shapeMaxY)
  })
  
  return {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
  }
}

export interface LayoutResult {
  id: string
  x: number
  y: number
}

/**
 * Arrange shapes in a grid layout with adaptive spacing
 * @param shapes - Array of shapes to layout
 * @returns Array of position updates for each shape
 */
export function autoLayout(shapes: Shape[]): LayoutResult[] {
  if (shapes.length === 0) return []
  if (shapes.length === 1) return [{ id: shapes[0].id, x: shapes[0].x, y: shapes[0].y }]
  
  // Calculate original center
  const originalCenter = calculateSelectionCenter(shapes)
  
  // Get bounding boxes and calculate average width
  const shapesWithBounds = shapes.map(shape => ({
    shape,
    bounds: getShapeBounds(shape),
  }))
  
  const totalWidth = shapesWithBounds.reduce((sum, item) => sum + item.bounds.width, 0)
  const averageWidth = totalWidth / shapes.length
  
  // Calculate spacing as 30% of average width
  const spacing = averageWidth * 0.3
  
  // Determine grid columns (aim for roughly square grid)
  const columns = Math.max(1, Math.ceil(Math.sqrt(shapes.length)))
  
  // Arrange shapes in grid
  const positions: LayoutResult[] = []
  let currentX = 0
  let currentY = 0
  let rowHeight = 0
  let column = 0
  
  shapesWithBounds.forEach(({ shape, bounds }) => {
    positions.push({
      id: shape.id,
      x: currentX,
      y: currentY,
    })
    
    // Track max height in current row
    rowHeight = Math.max(rowHeight, bounds.height)
    
    // Move to next position
    currentX += bounds.width + spacing
    column++
    
    // Move to next row if needed
    if (column >= columns) {
      currentX = 0
      currentY += rowHeight + spacing
      rowHeight = 0
      column = 0
    }
  })
  
  // Calculate grid center
  let gridMinX = Infinity
  let gridMinY = Infinity
  let gridMaxX = -Infinity
  let gridMaxY = -Infinity
  
  positions.forEach((pos, idx) => {
    const bounds = shapesWithBounds[idx].bounds
    gridMinX = Math.min(gridMinX, pos.x)
    gridMinY = Math.min(gridMinY, pos.y)
    gridMaxX = Math.max(gridMaxX, pos.x + bounds.width)
    gridMaxY = Math.max(gridMaxY, pos.y + bounds.height)
  })
  
  const gridCenter = {
    x: (gridMinX + gridMaxX) / 2,
    y: (gridMinY + gridMaxY) / 2,
  }
  
  // Offset all positions to center grid around original center
  const offsetX = originalCenter.x - gridCenter.x
  const offsetY = originalCenter.y - gridCenter.y
  
  return positions.map(pos => ({
    id: pos.id,
    x: pos.x + offsetX,
    y: pos.y + offsetY,
  }))
}

