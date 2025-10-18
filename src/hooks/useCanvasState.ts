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
  selectedBy?: { userId: string; color: string; name?: string }
}

type State = { byId: Record<string, Shape>; allIds: string[] }

type Action =
  | { type: 'add'; payload: Omit<Shape, 'id'> & { id?: string } }
  | { type: 'update'; payload: { id: string; patch: Partial<Shape> } }
  | { type: 'remove'; payload: { id: string } }

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

  return useMemo(
    () => ({ state, addShape, updateShape, removeShape }),
    [state, addShape, updateShape, removeShape],
  )
}


