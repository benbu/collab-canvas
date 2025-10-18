import { useCallback, useMemo, useReducer } from 'react'
import { generateId } from '../utils/id'

export type ShapeType = 'rect' | 'circle' | 'text'

export type Shape = {
  id: string
  type: ShapeType
  x: number
  y: number
  width?: number
  height?: number
  radius?: number
  fill?: string
  text?: string
  fontSize?: number
  fontFamily?: string
  rotation?: number
  zIndex?: number
  selectedBy?: { userId: string; color: string; name?: string }
}

type State = { byId: Record<string, Shape>; allIds: string[] }

type Action =
  | { type: 'add'; payload: Omit<Shape, 'id'> & { id?: string } }
  | { type: 'update'; payload: { id: string; patch: Partial<Shape> } }
  | { type: 'remove'; payload: { id: string } }
  | { type: 'moveToFront'; payload: { ids: string[] } }
  | { type: 'moveToBack'; payload: { ids: string[] } }
  | { type: 'moveForward'; payload: { ids: string[] } }
  | { type: 'moveBackward'; payload: { ids: string[] } }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'add': {
      const id = action.payload.id ?? generateId()
      const next: Shape = { id, ...action.payload }
      const exists = state.allIds.includes(id)
      return {
        byId: { ...state.byId, [id]: next },
        allIds: exists ? state.allIds : [...state.allIds, id],
      }
    }
    case 'update': {
      const target = state.byId[action.payload.id]
      if (!target) return state
      const updated = { ...target, ...action.payload.patch }
      return { byId: { ...state.byId, [updated.id]: updated }, allIds: state.allIds }
    }
    case 'remove': {
      const { [action.payload.id]: _omit, ...rest } = state.byId
      return { byId: rest, allIds: state.allIds.filter((i) => i !== action.payload.id) }
    }
    case 'moveToFront': {
      const ids = action.payload.ids
      if (ids.length === 0) return state
      
      // Get all shapes and their current zIndex values
      const allShapes = state.allIds.map(id => state.byId[id]).filter(Boolean)
      const maxZIndex = Math.max(...allShapes.map(s => s.zIndex ?? 0), 0)
      
      // Sort selected shapes by their current zIndex to maintain relative order
      const selectedShapes = ids.map(id => state.byId[id]).filter(Boolean)
      selectedShapes.sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
      
      // Update selected shapes to be at the front
      const newById = { ...state.byId }
      selectedShapes.forEach((shape, index) => {
        newById[shape.id] = { ...shape, zIndex: maxZIndex + 1 + index }
      })
      
      return { ...state, byId: newById }
    }
    case 'moveToBack': {
      const ids = action.payload.ids
      if (ids.length === 0) return state
      
      // Get all shapes and their current zIndex values
      const allShapes = state.allIds.map(id => state.byId[id]).filter(Boolean)
      const minZIndex = Math.min(...allShapes.map(s => s.zIndex ?? 0), 0)
      
      // Sort selected shapes by their current zIndex to maintain relative order
      const selectedShapes = ids.map(id => state.byId[id]).filter(Boolean)
      selectedShapes.sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
      
      // Update selected shapes to be at the back
      const newById = { ...state.byId }
      selectedShapes.forEach((shape, index) => {
        newById[shape.id] = { ...shape, zIndex: minZIndex - selectedShapes.length + index }
      })
      
      return { ...state, byId: newById }
    }
    case 'moveForward': {
      const ids = action.payload.ids
      if (ids.length === 0) return state
      
      // Get all unique zIndex values sorted
      const allShapes = state.allIds.map(id => state.byId[id]).filter(Boolean)
      const zIndexValues = Array.from(new Set(allShapes.map(s => s.zIndex ?? 0))).sort((a, b) => a - b)
      
      const newById = { ...state.byId }
      ids.forEach(id => {
        const shape = state.byId[id]
        if (!shape) return
        
        const currentZ = shape.zIndex ?? 0
        const currentIndex = zIndexValues.indexOf(currentZ)
        
        // Move to next zIndex level if not already at top
        if (currentIndex < zIndexValues.length - 1) {
          const nextZ = zIndexValues[currentIndex + 1]
          newById[id] = { ...shape, zIndex: nextZ + 0.5 }
        } else {
          // Already at top, just increment by 1
          newById[id] = { ...shape, zIndex: currentZ + 1 }
        }
      })
      
      return { ...state, byId: newById }
    }
    case 'moveBackward': {
      const ids = action.payload.ids
      if (ids.length === 0) return state
      
      // Get all unique zIndex values sorted
      const allShapes = state.allIds.map(id => state.byId[id]).filter(Boolean)
      const zIndexValues = Array.from(new Set(allShapes.map(s => s.zIndex ?? 0))).sort((a, b) => a - b)
      
      const newById = { ...state.byId }
      ids.forEach(id => {
        const shape = state.byId[id]
        if (!shape) return
        
        const currentZ = shape.zIndex ?? 0
        const currentIndex = zIndexValues.indexOf(currentZ)
        
        // Move to previous zIndex level if not already at bottom
        if (currentIndex > 0) {
          const prevZ = zIndexValues[currentIndex - 1]
          newById[id] = { ...shape, zIndex: prevZ - 0.5 }
        } else {
          // Already at bottom, just decrement by 1
          newById[id] = { ...shape, zIndex: currentZ - 1 }
        }
      })
      
      return { ...state, byId: newById }
    }
    default:
      return state
  }
}

export function useCanvasState() {
  const [state, dispatch] = useReducer(reducer, { byId: {}, allIds: [] })

  const addShape = useCallback((shape: Omit<Shape, 'id'> & { id?: string }) => {
    dispatch({ type: 'add', payload: shape })
  }, [])

  const updateShape = useCallback((id: string, patch: Partial<Shape>) => {
    dispatch({ type: 'update', payload: { id, patch } })
  }, [])

  const removeShape = useCallback((id: string) => {
    dispatch({ type: 'remove', payload: { id } })
  }, [])

  const moveShapeToFront = useCallback((ids: string[]) => {
    dispatch({ type: 'moveToFront', payload: { ids } })
  }, [])

  const moveShapeToBack = useCallback((ids: string[]) => {
    dispatch({ type: 'moveToBack', payload: { ids } })
  }, [])

  const moveShapeForward = useCallback((ids: string[]) => {
    dispatch({ type: 'moveForward', payload: { ids } })
  }, [])

  const moveShapeBackward = useCallback((ids: string[]) => {
    dispatch({ type: 'moveBackward', payload: { ids } })
  }, [])

  return useMemo(
    () => ({
      state,
      addShape,
      updateShape,
      removeShape,
      moveShapeToFront,
      moveShapeToBack,
      moveShapeForward,
      moveShapeBackward,
    }),
    [state, addShape, updateShape, removeShape, moveShapeToFront, moveShapeToBack, moveShapeForward, moveShapeBackward],
  )
}


