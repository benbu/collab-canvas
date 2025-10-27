import { useEffect } from 'react'
import type { Shape } from './useCanvasState'
import type { Tool } from '../components/Toolbar/Toolbar'
import { generateId } from '../utils/id'

interface KeyboardShortcutsParams {
  selectedIds: string[]
  stateById: Record<string, Shape>
  addShape: (shape: Omit<Shape, 'id'> & { id?: string }) => void
  removeShape: (id: string) => void
  setSelectedIds: (ids: string[]) => void
  writers: {
    add?: (shape: Shape) => void
    remove?: (id: string) => void
    cancelPending?: (id: string) => void
  }
  onAutoLayout: () => void
  onBringToFront: () => void
  onBringForward: () => void
  onSendBackward: () => void
  onSendToBack: () => void
  promptInputRef: React.RefObject<HTMLInputElement>
  stageRef: React.RefObject<any>
  position: { x: number; y: number }
  setPosition: (pos: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void
  activeTool: Tool
  hasLocalCharacter: boolean
}

export function useKeyboardShortcuts({
  selectedIds,
  stateById,
  addShape,
  removeShape,
  setSelectedIds,
  writers,
  onAutoLayout,
  onBringToFront,
  onBringForward,
  onSendBackward,
  onSendToBack,
  promptInputRef,
  stageRef,
  position: _position,
  setPosition,
  activeTool,
  hasLocalCharacter,
}: KeyboardShortcutsParams) {
  // AI prompt focus shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const isTyping = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || (target as any).isContentEditable)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        promptInputRef.current?.focus()
        return
      }
      if (!isTyping && e.key === '/') {
        e.preventDefault()
        promptInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [promptInputRef])

  // Shape manipulation shortcuts (delete, duplicate, layout, z-index)
  useEffect(() => {
    const keyHandler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const isTyping = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || (target as any).isContentEditable)
      if (isTyping) return
      
      if (selectedIds.length === 0) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        selectedIds.forEach((id) => {
          removeShape(id)
          writers.cancelPending && writers.cancelPending(id)
          writers.remove && writers.remove(id)
        })
        setSelectedIds([])
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        const newIds: string[] = []
        selectedIds.forEach((id) => {
          const s = stateById[id]
          if (!s) return
          const newId = generateId()
          newIds.push(newId)
          const duplicate: any = {
            ...s,
            id: newId,
            x: s.x + 16,
            y: s.y + 16,
            selectedBy: undefined,
          }
          addShape(duplicate)
          writers.add && writers.add({ ...duplicate })
        })
        setSelectedIds(newIds)
      }
      if (e.key.toLowerCase() === 'l') {
        e.preventDefault()
        onAutoLayout()
      }
      // zIndex keyboard shortcuts
      if ((e.ctrlKey || e.metaKey) && e.key === ']') {
        e.preventDefault()
        if (e.shiftKey) {
          // Bring Forward: Ctrl/Cmd + Shift + ]
          onBringForward()
        } else {
          // Bring to Front: Ctrl/Cmd + ]
          onBringToFront()
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '[') {
        e.preventDefault()
        if (e.shiftKey) {
          // Send Backward: Ctrl/Cmd + Shift + [
          onSendBackward()
        } else {
          // Send to Back: Ctrl/Cmd + [
          onSendToBack()
        }
      }
    }
    window.addEventListener('keydown', keyHandler)
    return () => window.removeEventListener('keydown', keyHandler)
  }, [selectedIds, stateById, addShape, removeShape, setSelectedIds, onAutoLayout, onBringToFront, onBringForward, onSendBackward, onSendToBack, writers])

  // Arrow key panning
  useEffect(() => {
    const arrowKeyHandler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const isTyping = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || (target as any).isContentEditable)
      if (isTyping) return

      const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']
      if (!arrowKeys.includes(e.key)) return

      // Only pan with arrow keys when:
      // - Pan tool is selected, OR
      // - Character tool is not selected AND user doesn't have a character
      const shouldPan = activeTool === 'pan' || (activeTool !== 'character' && !hasLocalCharacter)
      if (!shouldPan) return

      e.preventDefault()

      const basePanDistance = 50
      const panDistance = e.shiftKey ? basePanDistance * 3 : basePanDistance
      const stage = stageRef.current
      
      setPosition((prev) => {
        let newPos = { ...prev }
        
        switch (e.key) {
          case 'ArrowUp':
            newPos.y = prev.y + panDistance
            break
          case 'ArrowDown':
            newPos.y = prev.y - panDistance
            break
          case 'ArrowLeft':
            newPos.x = prev.x + panDistance
            break
          case 'ArrowRight':
            newPos.x = prev.x - panDistance
            break
        }

        // Update stage position immediately for smooth feedback
        if (stage) {
          stage.position(newPos)
          stage.batchDraw()
        }

        return newPos
      })
    }

    window.addEventListener('keydown', arrowKeyHandler)
    return () => window.removeEventListener('keydown', arrowKeyHandler)
  }, [stageRef, setPosition, activeTool, hasLocalCharacter])
}

