import { useCallback } from 'react'
import type { Shape } from './useCanvasState'
import { autoLayout } from '../utils/autoLayout'

interface ShapeOperationsParams {
  selectedIds: string[]
  stateById: Record<string, Shape>
  stateAllIds: string[]
  selfId: string
  updateShape: (id: string, patch: Partial<Shape>) => void
  moveShapeToFront: (ids: string[]) => void
  moveShapeToBack: (ids: string[]) => void
  moveShapeForward: (ids: string[]) => void
  moveShapeBackward: (ids: string[]) => void
  writers: {
    update?: (shape: Shape) => void
    updateImmediate?: (shape: Shape) => void
  }
}

export function useShapeOperations({
  selectedIds,
  stateById,
  stateAllIds,
  selfId,
  updateShape,
  moveShapeToFront,
  moveShapeToBack,
  moveShapeForward,
  moveShapeBackward,
  writers,
}: ShapeOperationsParams) {
  const handleAutoLayout = useCallback(() => {
    // Only work with 2+ selected shapes
    if (selectedIds.length < 2) return
    
    // Get selected shapes, excluding those locked by others
    const selectedShapes = selectedIds
      .map(id => stateById[id])
      .filter(shape => {
        if (!shape) return false
        const lockedByOther = !!(shape.selectedBy?.userId && shape.selectedBy.userId !== selfId)
        return !lockedByOther
      })
    
    if (selectedShapes.length < 2) return
    
    // Calculate new positions
    const layoutResults = autoLayout(selectedShapes)
    
    // Apply new positions
    layoutResults.forEach(result => {
      const shape = stateById[result.id]
      if (!shape) return
      
      updateShape(result.id, { x: result.x, y: result.y })
      writers.update && writers.update({ 
        ...shape, 
        x: result.x, 
        y: result.y, 
        selectedBy: stateById[result.id]?.selectedBy 
      } as any)
    })
  }, [selectedIds, stateById, selfId, updateShape, writers])

  const handleBringToFront = useCallback(() => {
    if (selectedIds.length === 0) return
    
    // Filter out shapes locked by others
    const validIds = selectedIds.filter(id => {
      const shape = stateById[id]
      if (!shape) return false
      const lockedByOther = !!(shape.selectedBy?.userId && shape.selectedBy.userId !== selfId)
      return !lockedByOther
    })
    
    if (validIds.length === 0) return
    
    // Update local state
    moveShapeToFront(validIds)
    
    // Calculate new zIndex values for syncing
    const allShapes = stateAllIds.map(id => stateById[id]).filter(Boolean)
    const maxZ = Math.max(...allShapes.map(s => s.zIndex ?? 0), 0)
    const selectedShapes = validIds.map(id => stateById[id]).filter(Boolean)
    selectedShapes.sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
    
    // Sync to Firestore with new zIndex values
    selectedShapes.forEach((shape, index) => {
      if (writers.updateImmediate) {
        writers.updateImmediate({ ...shape, zIndex: maxZ + 1 + index, selectedBy: shape.selectedBy } as any)
      }
    })
  }, [selectedIds, stateById, stateAllIds, selfId, moveShapeToFront, writers])

  const handleBringForward = useCallback(() => {
    if (selectedIds.length === 0) return
    
    // Filter out shapes locked by others
    const validIds = selectedIds.filter(id => {
      const shape = stateById[id]
      if (!shape) return false
      const lockedByOther = !!(shape.selectedBy?.userId && shape.selectedBy.userId !== selfId)
      return !lockedByOther
    })
    
    if (validIds.length === 0) return
    
    // Update local state
    moveShapeForward(validIds)
    
    // Calculate new zIndex values for syncing
    const allShapes = stateAllIds.map(id => stateById[id]).filter(Boolean)
    const zIndexValues = Array.from(new Set(allShapes.map(s => s.zIndex ?? 0))).sort((a, b) => a - b)
    
    // Sync to Firestore with new zIndex values
    validIds.forEach(id => {
      const shape = stateById[id]
      if (!shape) return
      
      const currentZ = shape.zIndex ?? 0
      const currentIndex = zIndexValues.indexOf(currentZ)
      let newZ = currentZ
      
      if (currentIndex < zIndexValues.length - 1) {
        const nextZ = zIndexValues[currentIndex + 1]
        newZ = nextZ + 0.5
      } else {
        newZ = currentZ + 1
      }
      
      if (writers.updateImmediate) {
        writers.updateImmediate({ ...shape, zIndex: newZ, selectedBy: shape.selectedBy } as any)
      }
    })
  }, [selectedIds, stateById, stateAllIds, selfId, moveShapeForward, writers])

  const handleSendBackward = useCallback(() => {
    if (selectedIds.length === 0) return
    
    // Filter out shapes locked by others
    const validIds = selectedIds.filter(id => {
      const shape = stateById[id]
      if (!shape) return false
      const lockedByOther = !!(shape.selectedBy?.userId && shape.selectedBy.userId !== selfId)
      return !lockedByOther
    })
    
    if (validIds.length === 0) return
    
    // Update local state
    moveShapeBackward(validIds)
    
    // Calculate new zIndex values for syncing
    const allShapes = stateAllIds.map(id => stateById[id]).filter(Boolean)
    const zIndexValues = Array.from(new Set(allShapes.map(s => s.zIndex ?? 0))).sort((a, b) => a - b)
    
    // Sync to Firestore with new zIndex values
    validIds.forEach(id => {
      const shape = stateById[id]
      if (!shape) return
      
      const currentZ = shape.zIndex ?? 0
      const currentIndex = zIndexValues.indexOf(currentZ)
      let newZ = currentZ
      
      if (currentIndex > 0) {
        const prevZ = zIndexValues[currentIndex - 1]
        newZ = prevZ - 0.5
      } else {
        newZ = currentZ - 1
      }
      
      if (writers.updateImmediate) {
        writers.updateImmediate({ ...shape, zIndex: newZ, selectedBy: shape.selectedBy } as any)
      }
    })
  }, [selectedIds, stateById, stateAllIds, selfId, moveShapeBackward, writers])

  const handleSendToBack = useCallback(() => {
    if (selectedIds.length === 0) return
    
    // Filter out shapes locked by others
    const validIds = selectedIds.filter(id => {
      const shape = stateById[id]
      if (!shape) return false
      const lockedByOther = !!(shape.selectedBy?.userId && shape.selectedBy.userId !== selfId)
      return !lockedByOther
    })
    
    if (validIds.length === 0) return
    
    // Update local state
    moveShapeToBack(validIds)
    
    // Calculate new zIndex values for syncing
    const allShapes = stateAllIds.map(id => stateById[id]).filter(Boolean)
    const minZ = Math.min(...allShapes.map(s => s.zIndex ?? 0), 0)
    const selectedShapes = validIds.map(id => stateById[id]).filter(Boolean)
    selectedShapes.sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
    
    // Sync to Firestore with new zIndex values
    selectedShapes.forEach((shape, index) => {
      if (writers.updateImmediate) {
        writers.updateImmediate({ ...shape, zIndex: minZ - selectedShapes.length + index, selectedBy: shape.selectedBy } as any)
      }
    })
  }, [selectedIds, stateById, stateAllIds, selfId, moveShapeToBack, writers])

  return {
    handleAutoLayout,
    handleBringToFront,
    handleBringForward,
    handleSendBackward,
    handleSendToBack,
  }
}

