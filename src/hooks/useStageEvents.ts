import { useCallback } from 'react'
import type { Shape } from './useCanvasState'
import { generateId } from '../utils/id'
import type { Character } from './useCharacterState'

interface StageEventsParams {
  tool: string
  stageRef: React.RefObject<any>
  position: { x: number; y: number }
  scale: number
  color: string
  textInput: string
  fontFamily: string
  stateById: Record<string, Shape>
  stateAllIds: string[]
  selfId: string
  selectedIds: string[]
  selectionRect: { x: number; y: number; w: number; h: number; active: boolean } | null
  addShape: (shape: Omit<Shape, 'id'> & { id?: string }) => void
  setSelectedIds: (ids: string[]) => void
  clearSelection: () => void
  beginDragSelect: (x: number, y: number) => void
  updateDragSelect: (x: number, y: number) => void
  endDragSelect: () => void
  lastMouseRef: React.MutableRefObject<{ x: number; y: number } | null>
  setScale: (scale: number) => void
  writers: {
    add?: (shape: Shape) => void
  }
  localCharacter: Character | null
  onPlaceCharacter?: (x: number, y: number) => void
  userName?: string
  userColor: string
}

const MIN_SCALE = 0.25
const MAX_SCALE = 4

export function useStageEvents({
  tool,
  stageRef,
  position,
  scale,
  color,
  textInput,
  fontFamily,
  stateById,
  stateAllIds,
  selfId,
  selectedIds: _selectedIds,
  selectionRect,
  addShape,
  setSelectedIds,
  clearSelection,
  beginDragSelect,
  updateDragSelect,
  endDragSelect,
  lastMouseRef,
  setScale,
  writers,
  localCharacter,
  onPlaceCharacter,
  userName: _userName,
  userColor: _userColor,
}: StageEventsParams) {
  const toCanvasPoint = useCallback(
    (client: { x: number; y: number }) => ({ x: (client.x - position.x) / scale, y: (client.y - position.y) / scale }),
    [position.x, position.y, scale],
  )

  const handleTouchStart = useCallback((e: any) => {
    if (tool !== 'select') return
    const stage = stageRef.current
    if (!stage) return
    const touches = (e?.evt as TouchEvent)?.touches
    if (touches && touches.length === 2) {
      const dist = Math.hypot(
        touches[0].clientX - touches[1].clientX,
        touches[0].clientY - touches[1].clientY,
      )
      ;(stage as any)._pinchDist = dist
      ;(stage as any)._pinchScale = scale
    }
  }, [tool, stageRef, scale])

  const handleTouchMove = useCallback((e: any) => {
    const stage = stageRef.current
    if (!stage) return
    const touches = (e?.evt as TouchEvent)?.touches
    if (touches && touches.length === 2) {
      e.evt.preventDefault()
      const dist = Math.hypot(
        touches[0].clientX - touches[1].clientX,
        touches[0].clientY - touches[1].clientY,
      )
      const start = (stage as any)._pinchDist || dist
      const baseScale = (stage as any)._pinchScale || scale
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, baseScale * (dist / start)))
      setScale(next)
    }
  }, [stageRef, scale, setScale])

  const handleMouseDown = useCallback((e: any) => {
    const ev = (e?.evt as MouseEvent | undefined)
    if (ev && typeof ev.clientX === 'number' && typeof ev.clientY === 'number') {
      lastMouseRef.current = { x: ev.clientX, y: ev.clientY }
    }
    // Only start drag-select when clicking empty stage
    if (e?.target && stageRef.current && e.target !== stageRef.current) return
    const stage = stageRef.current!
    const pointer = stage.getPointerPosition()
    if (!pointer) return
    const canvasPoint = toCanvasPoint(pointer)

    if (tool === 'select') {
      beginDragSelect(canvasPoint.x, canvasPoint.y)
      return
    }

    if (tool === 'rect') {
      const id = generateId()
      const maxZ = Math.max(...stateAllIds.map(id => stateById[id]?.zIndex ?? 0), 0)
      const shape = { id, type: 'rect' as const, x: canvasPoint.x, y: canvasPoint.y, width: 200, height: 120, fill: color, zIndex: maxZ + 1 }
      addShape(shape)
      writers.add && writers.add({ ...shape })
    } else if (tool === 'circle') {
      const id = generateId()
      const maxZ = Math.max(...stateAllIds.map(id => stateById[id]?.zIndex ?? 0), 0)
      const shape = { id, type: 'circle' as const, x: canvasPoint.x, y: canvasPoint.y, radius: 60, fill: color, zIndex: maxZ + 1 }
      addShape(shape)
      writers.add && writers.add({ ...shape })
    } else if (tool === 'text') {
      const id = generateId()
      const maxZ = Math.max(...stateAllIds.map(id => stateById[id]?.zIndex ?? 0), 0)
      const shape = { id, type: 'text' as const, x: canvasPoint.x, y: canvasPoint.y, text: textInput, fontSize: 18, fill: color, fontFamily, zIndex: maxZ + 1 }
      addShape(shape)
      writers.add && writers.add({ ...shape })
    } else if (tool === 'character') {
      // Only place character if user doesn't already have a living character
      if (!localCharacter || localCharacter.state === 'dead') {
        // Place character slightly above the click point
        onPlaceCharacter && onPlaceCharacter(canvasPoint.x, canvasPoint.y - 50)
      }
    }
  }, [tool, stageRef, toCanvasPoint, beginDragSelect, stateAllIds, stateById, color, textInput, fontFamily, addShape, writers, lastMouseRef, localCharacter, onPlaceCharacter])

  const handleMouseMove = useCallback((e: any) => {
    const ev = (e?.evt as MouseEvent | undefined)
    if (ev && typeof ev.clientX === 'number' && typeof ev.clientY === 'number') {
      lastMouseRef.current = { x: ev.clientX, y: ev.clientY }
    }
    if (!selectionRect?.active) return
    const stage = stageRef.current!
    const pointer = stage.getPointerPosition()
    if (!pointer) return
    const p = toCanvasPoint(pointer)
    updateDragSelect(p.x, p.y)
  }, [selectionRect?.active, stageRef, toCanvasPoint, updateDragSelect, lastMouseRef])

  const handleMouseUp = useCallback(() => {
    if (!selectionRect?.active) return
    endDragSelect()
    const rect = selectionRect
    // Small drag threshold: ignore micro-drags
    const dragThreshold = 3
    if (rect.w < dragThreshold && rect.h < dragThreshold) {
      clearSelection()
      return
    }
    const hits = stateAllIds.filter((id) => {
      const s = stateById[id]
      if (!s) return false
      const lockedByOther = !!(s.selectedBy?.userId && s.selectedBy.userId !== selfId)
      if (lockedByOther) return false
      return s.x >= rect.x && s.x <= rect.x + rect.w && s.y >= rect.y && s.y <= rect.y + rect.h
    })
    setSelectedIds(hits)
  }, [selectionRect, endDragSelect, clearSelection, stateAllIds, stateById, selfId, setSelectedIds])

  return {
    handleTouchStart,
    handleTouchMove,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  }
}

