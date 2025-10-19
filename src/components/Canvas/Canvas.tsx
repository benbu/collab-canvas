import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Stage, Layer, Line } from 'react-konva'
import type Konva from 'konva'
import { throttle } from '../../utils/throttle'
import { recordFrame, markStart, markEnd, incrementCounter } from '../../utils/performance'
import './Canvas.css'
import Toolbar from '../Toolbar/Toolbar'
import ConfirmModal from './ConfirmModal'
import type { Tool } from '../Toolbar/Toolbar'
import { useCanvasState } from '../../hooks/useCanvasState'
import { useAiAssist } from '../../hooks/useAiAssist'
import { useCanvasInteractions } from '../../hooks/useCanvasInteractions'
import SelectionBox from './SelectionBox'
import { useFirestoreSync } from '../../hooks/useFirestoreSync'
import { generateId } from '../../utils/id'
import CursorLayer from './CursorLayer'
import PresenceList from '../Presence/PresenceList'
import { useCursorSync } from '../../hooks/useCursorSync'
import { usePresence } from '../../hooks/usePresence'
import { useAuth } from '../../contexts/AuthContext'
import { usePersistence } from '../../hooks/usePersistence'
import UsernameClaim from '../../pages/UsernameClaim'
import FloatingTextPanel from './FloatingTextPanel'
import ShapeRenderer from './ShapeRenderer'
import AiPromptBar from './AiPromptBar'
import DevTools from './DevTools'
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts'
import { useShapeOperations } from '../../hooks/useShapeOperations'
import { useStageEvents } from '../../hooks/useStageEvents'
import { useCharacterControl } from '../../hooks/useCharacterControl'
import { useCharacterSync } from '../../hooks/useCharacterSync'
import { updateCharacterPhysics } from '../../hooks/useCharacterPhysics'
import CharacterRenderer from './CharacterRenderer'
import type { Character } from '../../hooks/useCharacterState'

const MIN_SCALE = 0.25
const MAX_SCALE = 4
const GRID_SIZE = 50

function useViewportSize() {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight })
  useEffect(() => {
    const handler = () => setSize({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return size
}

export default function Canvas() {
  const params = useParams()
  const roomId = params.roomId ?? 'default'
  const { user, displayName } = useAuth()
  const selfId = user?.uid ?? 'self'
  const { width, height } = useViewportSize()
  useEffect(() => {
    try {
      localStorage.setItem('lastRoomId', roomId)
    } catch {}
  }, [roomId])
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const stageRef = useRef<Konva.Stage | null>(null)
  const { state, addShape, updateShape, removeShape, moveShapeToFront, moveShapeToBack, moveShapeForward, moveShapeBackward } = useCanvasState()
  const [tool, setTool] = useState<Tool>('select')
  const [color, setColor] = useState<string>('#1976d2')
  const [textInput, setTextInput] = useState<string>('Text')
  const [fontFamily, setFontFamily] = useState<string>('Arial')
  const [panelPos, setPanelPos] = useState<{ x: number; y: number }>({ x: 24, y: 24 })
  const lastMouseRef = useRef<{ x: number; y: number } | null>(null)
  const [panelHidden, setPanelHidden] = useState(false)
  const lastSelectionSyncedRef = useRef<string | null>(null)
  const groupDragRef = useRef<{
    active: boolean
    draggedId: string | null
    start: { x: number; y: number } | null
    origins: Record<string, { x: number; y: number }>
  }>({ active: false, draggedId: null, start: null, origins: {} })
  const editingIdsRef = useRef<Set<string>>(new Set())
  const beginEdit = useCallback((id: string) => { editingIdsRef.current.add(id) }, [])
  const endEdit = useCallback((id: string) => { editingIdsRef.current.delete(id) }, [])
  const {
    selectedIds,
    setSelectedIds,
    selectionRect,
    beginDragSelect,
    updateDragSelect,
    endDragSelect,
    clearSelection,
    stageDraggable,
    setIsDraggingShape,
  } = useCanvasInteractions(tool)
  const upsertHandler = useCallback(
    (s: any) => {
      markStart('upsert-handler')
      // ignore remote upserts while locally editing this shape to avoid visual jumps
      if (editingIdsRef.current.has(s.id)) {
        // still merge remote selectedBy while editing, so remote ownership is visible
        if (s.selectedBy !== undefined) updateShape(s.id, { selectedBy: s.selectedBy } as any)
        markEnd('upsert-handler', 'shape-edit', 'blocked-editing')
        return
      }
      
      // protect selected shapes from stale upserts
      const isSelected = selectedIds.includes(s.id)
      if (isSelected) {
        // if another user claims ownership, remove from our selection and apply the upsert
        if (s.selectedBy?.userId && s.selectedBy.userId !== selfId) {
          setSelectedIds(prev => prev.filter(id => id !== s.id))
          // apply the full upsert since we're deselecting
          if (state.byId[s.id]) {
            const { id: _omit, ...patch } = s as any
            updateShape(s.id, patch)
          } else {
            addShape(s)
          }
          markEnd('upsert-handler', 'shape-edit', 'deselect-and-update')
          return
        }
        
        // otherwise, block the upsert but still merge selectedBy changes
        if (s.selectedBy !== undefined) updateShape(s.id, { selectedBy: s.selectedBy } as any)
        markEnd('upsert-handler', 'shape-edit', 'blocked-selected')
        return
      }
      
      // upsert: if exists update else add
      if (state.byId[s.id]) {
        const { id: _omit, ...patch } = s as any
        updateShape(s.id, patch)
        markEnd('upsert-handler', 'shape-edit', 'update')
      } else {
        addShape(s)
        markEnd('upsert-handler', 'shape-edit', 'add')
      }
    },
    [state.byId, updateShape, addShape, selectedIds, selfId, setSelectedIds],
  )
  const removeHandler = useCallback(
    (id: string) => {
      // only remove if present
      if (state.byId[id]) removeShape(id)
    },
    [state.byId, removeShape],
  )
  const writers = useFirestoreSync(roomId, upsertHandler, removeHandler)

  const selectedTextIds = useMemo(() => selectedIds.filter((id) => state.byId[id]?.type === 'text'), [selectedIds, state.byId])
  const firstTextId = useMemo(() => (selectedTextIds.length > 0 ? selectedTextIds[0] : null), [selectedTextIds])
  const panelVisible = useMemo(() => (tool === 'text' || selectedTextIds.length > 0) && !panelHidden, [tool, selectedTextIds.length, panelHidden])

  const colorFromId = useMemo(() => {
    const str = selfId
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i)
      hash |= 0
    }
    const hue = Math.abs(hash) % 360
    return `hsl(${hue}, 70%, 50%)`
  }, [selfId])

  const cursorSync = useCursorSync(
    roomId,
    selfId,
    () => {
      const p = stageRef.current?.getPointerPosition()
      if (!p) return null
      const c = toCanvasPoint(p)
      return { x: c.x, y: c.y }
    },
    displayName ?? undefined,
    colorFromId,
  )
  const { presenceById } = usePresence(roomId, selfId, displayName ?? undefined, colorFromId)
  const { hydrated } = usePersistence(roomId, state, addShape)
  const ai = useAiAssist({
    roomId,
    writers: writers as any,
    getState: () => state,
    generateId,
    defaultFill: color,
  })
  const promptInputRef = useRef<HTMLInputElement | null>(null)
  const prevSelectedRef = useRef<string[]>([])
  const stateRef = useRef(state)
  const selfIdRef = useRef(selfId)
  const writersRef = useRef(writers)
  const [showClearModal, setShowClearModal] = useState(false)
  const prevToolRef = useRef<Tool>(tool)

  // Extract shape operations into dedicated hook
  const {
    handleAutoLayout,
    handleBringToFront,
    handleBringForward,
    handleSendBackward,
    handleSendToBack,
  } = useShapeOperations({
    selectedIds,
    stateById: state.byId,
    stateAllIds: state.allIds,
    selfId,
    updateShape,
    moveShapeToFront,
    moveShapeToBack,
    moveShapeForward,
    moveShapeBackward,
    writers,
  })

  // Character state management
  const [localCharacter, setLocalCharacter] = useState<Character | null>(null)
  const lastPhysicsUpdate = useRef<number>(0)
  const characterEnabled = tool === 'character' && localCharacter !== null && localCharacter.state === 'alive'
  const characterInput = useCharacterControl(characterEnabled)
  const characterSync = useCharacterSync(roomId, selfId, localCharacter)

  // Extract keyboard shortcuts into dedicated hook
  useKeyboardShortcuts({
    selectedIds,
    stateById: state.byId,
    addShape,
    removeShape,
    setSelectedIds,
    writers,
    onAutoLayout: handleAutoLayout,
    onBringToFront: handleBringToFront,
    onBringForward: handleBringForward,
    onSendBackward: handleSendBackward,
    onSendToBack: handleSendToBack,
    promptInputRef,
    stageRef,
    position,
    setPosition,
    activeTool: tool,
    hasLocalCharacter: localCharacter !== null && localCharacter.state === 'alive',
  })

  useEffect(() => { stateRef.current = state }, [state])
  useEffect(() => { selfIdRef.current = selfId }, [selfId])
  useEffect(() => { writersRef.current = writers }, [writers])

  // FPS tracking when no character is active
  useEffect(() => {
    if (localCharacter && localCharacter.state === 'alive') return // Physics loop handles FPS tracking
    
    let frameId: number
    const trackFps = () => {
      recordFrame()
      frameId = requestAnimationFrame(trackFps)
    }
    frameId = requestAnimationFrame(trackFps)
    
    return () => cancelAnimationFrame(frameId)
  }, [localCharacter])

  // Physics loop for character
  useEffect(() => {
    if (!localCharacter || localCharacter.state === 'dead') return

    let animationFrameId: number

    const physicsLoop = (timestamp: number) => {
      recordFrame() // Track FPS
      
      if (lastPhysicsUpdate.current === 0) {
        lastPhysicsUpdate.current = timestamp
      }

      const deltaTime = (timestamp - lastPhysicsUpdate.current) / 1000 // Convert to seconds

      // Check if character is idle (no input and no significant velocity)
      const hasInput = characterInput.left || characterInput.right || characterInput.jump
      const velocityThreshold = 0.5 // pixels/second
      const hasVelocity = Math.abs(localCharacter.vx) > velocityThreshold || Math.abs(localCharacter.vy) > velocityThreshold
      const isIdle = !hasInput && !hasVelocity && localCharacter.onGround

      if (isIdle) {
        // Character is idle, skip physics update but continue loop
        incrementCounter('character-physics', 'skipped-idle')
        animationFrameId = requestAnimationFrame(physicsLoop)
        return
      }

      lastPhysicsUpdate.current = timestamp

      // Calculate death threshold (bottom of visible area + buffer)
      const deathThreshold = (-position.y / scale) + (height / scale) + 500

      // Get all shapes for collision detection
      const shapes = state.allIds.map(id => state.byId[id]).filter(Boolean)

      // Update character physics
      const updatedCharacter = updateCharacterPhysics(
        localCharacter,
        characterInput,
        shapes,
        deltaTime,
        deathThreshold
      )

      setLocalCharacter(updatedCharacter)

      // Clean up dead characters
      if (updatedCharacter.state === 'dead') {
        setLocalCharacter(null)
        lastPhysicsUpdate.current = 0
        return
      }

      animationFrameId = requestAnimationFrame(physicsLoop)
    }

    animationFrameId = requestAnimationFrame(physicsLoop)

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
      }
    }
  }, [localCharacter, characterInput, state.allIds, state.byId, position.y, scale, height])

  // Auto-pan camera when character approaches screen edges
  useEffect(() => {
    if (!localCharacter || localCharacter.state !== 'alive') return

    const checkAndPan = () => {
      markStart('auto-pan')
      const charScreenX = localCharacter.x * scale + position.x
      const charScreenY = localCharacter.y * scale + position.y
      const margin = 100

      let needsPan = false
      let deltaX = 0
      let deltaY = 0

      if (charScreenX < margin) {
        deltaX = (margin - charScreenX) * 0.1
        needsPan = true
      } else if (charScreenX > width - margin) {
        deltaX = (width - margin - charScreenX) * 0.1
        needsPan = true
      }

      if (charScreenY < margin) {
        deltaY = (margin - charScreenY) * 0.1
        needsPan = true
      } else if (charScreenY > height - margin) {
        deltaY = (height - margin - charScreenY) * 0.1
        needsPan = true
      }

      if (needsPan) {
        setPosition(prev => ({
          x: prev.x + deltaX,
          y: prev.y + deltaY
        }))
        
        // Update stage position immediately for smooth feedback
        const stage = stageRef.current
        if (stage) {
          stage.position({ x: position.x + deltaX, y: position.y + deltaY })
          stage.batchDraw()
        }
      }
      markEnd('auto-pan', 'auto-pan', 'check')
    }

    const intervalId = window.setInterval(checkAndPan, 16) // ~60fps
    return () => window.clearInterval(intervalId)
  }, [localCharacter, position, scale, width, height, stageRef])

  useEffect(() => {
    if (firstTextId) {
      setPanelHidden(false)
      const m = lastMouseRef.current
      if (m) setPanelPos({ x: m.x + 12, y: m.y + 12 })
    }
  }, [firstTextId])

  useEffect(() => {
    if (!panelVisible) return
    if (firstTextId) {
      const s = state.byId[firstTextId]
      if (s && s.type === 'text') {
        if (typeof s.text === 'string') setTextInput(s.text)
        const ff = (s as any).fontFamily
        if (typeof ff === 'string' && ff) setFontFamily(ff)
      }
      lastSelectionSyncedRef.current = firstTextId
    } else {
      lastSelectionSyncedRef.current = null
    }
  }, [panelVisible, firstTextId, state.byId])

  useEffect(() => {
    if (!panelVisible) {
      lastSelectionSyncedRef.current = null
    }
  }, [panelVisible])

  // Clear stale locks: if any shape is owned by a user no longer present, relinquish selection
  useEffect(() => {
    const presentIds = new Set(Object.keys(presenceById))
    state.allIds.forEach((id) => {
      const s = state.byId[id]
      if (!s) return
      const owner = s.selectedBy?.userId
      if (owner && !presentIds.has(owner)) {
        updateShape(id, { selectedBy: undefined } as any)
        writers.update && writers.update({ ...s, selectedBy: null } as any)
      }
    })
  }, [presenceById, state.allIds, state.byId, updateShape, writers])

  // Manage selection ownership (single-user) and cleanup
  useEffect(() => {
    const prev = new Set(prevSelectedRef.current)
    const next = new Set(selectedIds)
    const added = Array.from(next).filter((id) => !prev.has(id))
    const removed = Array.from(prev).filter((id) => !next.has(id))

    added.forEach((id) => {
      const s = state.byId[id]
      if (!s) return
      const selectedBy = { userId: selfId, color: colorFromId, name: displayName }
      updateShape(id, { selectedBy } as any)
      writers.update && writers.update({ ...s, selectedBy } as any)
    })

    removed.forEach((id) => {
      const s = state.byId[id]
      if (!s) return
      if (s.selectedBy?.userId !== selfId) return
      updateShape(id, { selectedBy: undefined } as any)
      writers.update && writers.update({ ...s, selectedBy: null } as any)
    })

    prevSelectedRef.current = selectedIds
  }, [selectedIds, state.byId, updateShape, writers, selfId, colorFromId, displayName])

  // If any locally selected shape becomes locked by another user, drop it from local selection
  useEffect(() => {
    if (selectedIds.length === 0) return
    const filtered = selectedIds.filter((id) => {
      const s = state.byId[id]
      return !(s?.selectedBy?.userId && s.selectedBy.userId !== selfId)
    })
    if (filtered.length !== selectedIds.length) setSelectedIds(filtered)
  }, [selectedIds, state.byId, selfId, setSelectedIds])

  useEffect(() => {
    const clearMine = () => {
      const currentState = stateRef.current
      const currentWriters = writersRef.current
      const currentSelf = selfIdRef.current
      prevSelectedRef.current.forEach((id) => {
        const s = currentState.byId[id]
        if (!s) return
        if (s.selectedBy?.userId === currentSelf) {
          // No need to update local state during unload; just clear remotely
          currentWriters.update && currentWriters.update({ ...s, selectedBy: null } as any)
        }
      })
    }
    window.addEventListener('beforeunload', clearMine)
    return () => {
      window.removeEventListener('beforeunload', clearMine)
      clearMine()
    }
  }, [])

  const handleDragMove = useMemo(
    () =>
      throttle(() => {
        const stage = stageRef.current
        if (!stage) return
        const { x, y } = stage.position()
        setPosition({ x, y })
      }, 16),
    [],
  )

  const handleWheel = useMemo(
    () =>
      throttle((e: unknown) => {
        const evt = e as WheelEvent
        evt.preventDefault()
        const stage = stageRef.current
        if (!stage) return

        const oldScale = scale
        const pointer = stage.getPointerPosition()
        if (!pointer) return

        const mousePointTo = {
          x: (pointer.x - position.x) / oldScale,
          y: (pointer.y - position.y) / oldScale,
        }

        const scaleBy = 1.05
        const direction = evt.deltaY > 0 ? -1 : 1
        const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, oldScale * (direction > 0 ? scaleBy : 1 / scaleBy)))
        setScale(newScale)

        const newPos = {
          x: pointer.x - mousePointTo.x * newScale,
          y: pointer.y - mousePointTo.y * newScale,
        }
        setPosition(newPos)
      }, 16),
    [position.x, position.y, scale],
  )

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const wheelListener = (e: Event) => handleWheel(e as unknown as WheelEvent)
    const container = stage.container()
    container.addEventListener('wheel', wheelListener, { passive: false })
    return () => container.removeEventListener('wheel', wheelListener)
  }, [handleWheel])


  // Character placement handler
  const handlePlaceCharacter = useCallback((x: number, y: number) => {
    const newCharacter: Character = {
      userId: selfId,
      x,
      y,
      vx: 0,
      vy: 0,
      onGround: false,
      color: colorFromId,
      name: displayName ?? undefined,
      state: 'alive',
    }
    setLocalCharacter(newCharacter)
    lastPhysicsUpdate.current = 0
  }, [selfId, colorFromId, displayName])

  // Extract stage event handlers into dedicated hook
  const {
    handleTouchStart,
    handleTouchMove,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  } = useStageEvents({
    tool,
    stageRef,
    position,
    scale,
    color,
    textInput,
    fontFamily,
    stateById: state.byId,
    stateAllIds: state.allIds,
    selfId,
    selectedIds,
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
    onPlaceCharacter: handlePlaceCharacter,
    userName: displayName ?? undefined,
    userColor: colorFromId,
  })

  const toCanvasPoint = useCallback(
    (client: { x: number; y: number }) => ({ x: (client.x - position.x) / scale, y: (client.y - position.y) / scale }),
    [position.x, position.y, scale],
  )

  const gridLines = useMemo(() => {
    const lines = [] as JSX.Element[]
    const start = -2500
    const end = 2500
    for (let x = start; x <= end; x += GRID_SIZE) {
      lines.push(
        <Line key={`v-${x}`} points={[x, start, x, end]} stroke="#eee" strokeWidth={1} listening={false} />,
      )
    }
    for (let y = start; y <= end; y += GRID_SIZE) {
      lines.push(
        <Line key={`h-${y}`} points={[start, y, end, y]} stroke="#eee" strokeWidth={1} listening={false} />,
      )
    }
    return lines
  }, [])

  const handleExportImage = useCallback(() => {
    const stage = stageRef.current
    if (!stage) return

    // Generate PNG with high quality
    const dataURL = stage.toDataURL({ pixelRatio: 2 })
    
    // Create download link
    const link = document.createElement('a')
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    link.download = `collab-canvas-${roomId}-${timestamp}.png`
    link.href = dataURL
    
    // Trigger download
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [roomId])

  // Viewport culling: only render shapes visible in current viewport
  const visibleShapeIds = useMemo(() => {
    markStart('viewport-culling')
    const buffer = 200 // Extra buffer to prevent pop-in during pan
    const viewportBounds = {
      left: (-position.x / scale) - buffer,
      right: ((-position.x + width) / scale) + buffer,
      top: (-position.y / scale) - buffer,
      bottom: ((-position.y + height) / scale) + buffer,
    }

    const visible = state.allIds.filter(id => {
      const shape = state.byId[id]
      if (!shape) return false

      // Always render selected shapes (being edited)
      if (selectedIds.includes(id)) return true

      // Calculate shape bounds based on type
      let shapeLeft = shape.x
      let shapeRight = shape.x
      let shapeTop = shape.y
      let shapeBottom = shape.y

      if (shape.type === 'rect') {
        const w = shape.width ?? 0
        const h = shape.height ?? 0
        shapeRight = shape.x + w
        shapeBottom = shape.y + h
      } else if (shape.type === 'circle') {
        const r = shape.radius ?? 0
        shapeLeft = shape.x - r
        shapeRight = shape.x + r
        shapeTop = shape.y - r
        shapeBottom = shape.y + r
      } else if (shape.type === 'text') {
        const fs = shape.fontSize ?? 18
        const textWidth = (shape.text?.length ?? 1) * fs * 0.6
        shapeRight = shape.x + textWidth
        shapeBottom = shape.y + fs
      }

      // Check if shape intersects with viewport
      const visible = (
        shapeRight >= viewportBounds.left &&
        shapeLeft <= viewportBounds.right &&
        shapeBottom >= viewportBounds.top &&
        shapeTop <= viewportBounds.bottom
      )

      return visible
    })

    markEnd('viewport-culling', 'render-cycle', `filtered-${visible.length}-of-${state.allIds.length}`)
    return visible
  }, [state.allIds, state.byId, position.x, position.y, scale, width, height, selectedIds])

  return (
    <div className="canvasRoot">
      {!(hydrated && (writers as any).ready) && (
        <div className="loaderOverlay" aria-busy>
          <div className="spinner" />
        </div>
      )}
      <UsernameClaim />
      <PresenceList selfId={selfId} presence={presenceById} />
      <Toolbar
        activeTool={tool}
        onToolChange={(t) => {
          setTool(t)
          if (t === 'text') {
            setPanelHidden(false)
            const m = lastMouseRef.current
            if (m) setPanelPos({ x: m.x + 12, y: m.y + 12 })
          } else {
            clearSelection()
          }
        }}
        color={color}
        onColorChange={setColor}
        text={textInput}
        onTextChange={setTextInput}
        onRequestClearAll={() => {
          prevToolRef.current = tool
          setShowClearModal(true)
        }}
        onExportImage={handleExportImage}
        onAutoLayout={handleAutoLayout}
        onBringToFront={handleBringToFront}
        onBringForward={handleBringForward}
        onSendBackward={handleSendBackward}
        onSendToBack={handleSendToBack}
      />
      {showClearModal && (
        <ConfirmModal
          title="Delete shapes?"
          message="This will delete shapes not locked by others (unowned or owned by you). Shapes currently selected by other users will be kept. Are you sure?"
          confirmText="Delete"
          cancelText="Cancel"
          onCancel={() => {
            setShowClearModal(false)
            setTool(prevToolRef.current)
          }}
          onConfirm={() => {
            // Guarded deletion: skip shapes owned by other users
            state.allIds.forEach((id) => {
              const s = state.byId[id]
              if (!s) return
              const owner = s.selectedBy?.userId
              if (!owner || owner === selfId) {
                removeShape(id)
                writers.remove && writers.remove(id)
              }
            })
            setSelectedIds([])
            setShowClearModal(false)
            setTool(prevToolRef.current)
          }}
        />
      )}
      <FloatingTextPanel
        visible={panelVisible}
        x={panelPos.x}
        y={panelPos.y}
        text={textInput}
        fontFamily={fontFamily}
        onChangeText={(newText) => {
          setTextInput(newText)
          selectedIds.forEach((id) => {
            const s = state.byId[id]
            if (s?.type === 'text') {
              updateShape(id, { text: newText, fontFamily } as any)
              writers.update && writers.update({ ...s, text: newText, fontFamily, selectedBy: state.byId[id]?.selectedBy } as any)
            }
          })
        }}
        onChangeFont={(newFont) => {
          setFontFamily(newFont)
          selectedIds.forEach((id) => {
            const s = state.byId[id]
            if (s?.type === 'text') {
              updateShape(id, { text: textInput, fontFamily: newFont } as any)
              writers.update && writers.update({ ...s, text: textInput, fontFamily: newFont, selectedBy: state.byId[id]?.selectedBy } as any)
            }
          })
        }}
        onRequestPositionChange={(p) => setPanelPos(p)}
        onClose={() => setPanelHidden(true)}
      />
      <DevTools onAddShape={addShape} />
      <AiPromptBar
        selectedIds={selectedIds}
        aiStatus={ai.status}
        aiLastResult={ai.lastResult ?? undefined}
        onPostPrompt={ai.postPrompt}
        onConfirmAndExecute={() => void ai.confirmAndExecute()}
        onCancelPending={ai.cancelPending}
      />
      <Stage
        ref={stageRef}
        width={width}
        height={height}
        draggable={stageDraggable}
        x={position.x}
        y={position.y}
        scaleX={scale}
        scaleY={scale}
        onDragMove={handleDragMove as any}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <Layer listening={false}>{gridLines}</Layer>
        
        {/* Shapes Layer - Updates when shapes change */}
        <Layer>
          {selectionRect?.active && (
            <SelectionBox x={selectionRect.x} y={selectionRect.y} w={selectionRect.w} h={selectionRect.h} color={colorFromId} />
          )}
          {visibleShapeIds
            .slice()
            .sort((a, b) => {
              const zA = state.byId[a]?.zIndex ?? 0
              const zB = state.byId[b]?.zIndex ?? 0
              return zA - zB
            })
            .map((id) => {
              const s = state.byId[id]
              const isSelected = selectedIds.includes(id)
              const lockedByOther = !!(s.selectedBy?.userId && s.selectedBy.userId !== selfId)
              
              return (
                <ShapeRenderer
                  key={id}
                  shape={s}
                  isSelected={isSelected}
                  selectedIds={selectedIds}
                  selfId={selfId}
                  colorFromId={colorFromId}
                  scale={scale}
                  position={position}
                  tool={tool}
                  lockedByOther={lockedByOther}
                  onUpdateShape={updateShape}
                  onSetSelectedIds={setSelectedIds}
                  onClearSelection={clearSelection}
                  onSetIsDraggingShape={setIsDraggingShape}
                  onBeginEdit={beginEdit}
                  onEndEdit={endEdit}
                  onWriterUpdate={(shape) => writers.update && writers.update(shape)}
                  onWriterUpdateImmediate={(shape) => (writers as any).updateImmediate && (writers as any).updateImmediate(shape)}
                  onDragStart={() => {
                    if (tool === 'select' && isSelected && selectedIds.length > 1) {
                      // Begin group drag: record origins for all selected shapes relative to dragged start
                      groupDragRef.current.active = true
                      groupDragRef.current.draggedId = id
                      groupDragRef.current.start = { x: s.x, y: s.y }
                      const origins: Record<string, { x: number; y: number }> = {}
                      selectedIds.forEach((sid) => {
                        const ss = state.byId[sid]
                        if (ss) origins[sid] = { x: ss.x, y: ss.y }
                      })
                      groupDragRef.current.origins = origins
                    }
                  }}
                  onDragMove={(newX, newY) => {
                    // If group dragging, move all selected shapes by the same delta as the dragged one
                    if (groupDragRef.current.active && groupDragRef.current.draggedId === id && groupDragRef.current.start) {
                      const dx = newX - groupDragRef.current.start.x
                      const dy = newY - groupDragRef.current.start.y
                      const origins = groupDragRef.current.origins
                      selectedIds.forEach((sid) => {
                        const origin = origins[sid]
                        if (!origin) return
                        const next = { x: origin.x + dx, y: origin.y + dy }
                        if (sid === id) return // dragged shape will be finalized on dragEnd
                        updateShape(sid, next)
                        const so = state.byId[sid]
                        const selBy = state.byId[sid]?.selectedBy
                        if (so) writers.update && writers.update({ ...so, ...next, selectedBy: selBy } as any)
                      })
                    }
                  }}
                  onDragEnd={() => {
                    // Clear group drag state
                    groupDragRef.current.active = false
                    groupDragRef.current.draggedId = null
                    groupDragRef.current.start = null
                    groupDragRef.current.origins = {}
                  }}
                  lastMouseRef={lastMouseRef}
                  stateById={state.byId}
                />
              )
            })}
        </Layer>
        
        {/* Characters Layer - Updates at physics rate (60fps) */}
        <Layer>
          {/* Render local character */}
          {localCharacter && localCharacter.state !== 'dead' && (
            <CharacterRenderer character={localCharacter} />
          )}
          
          {/* Render remote characters */}
          {(() => {
            console.log('[Canvas] Rendering remote characters, count:', characterSync.characters.length, characterSync.characters)
            return characterSync.characters.map((char) => {
              console.log('[Canvas] Rendering remote character:', char.userId, char)
              return <CharacterRenderer key={char.userId} character={char} />
            })
          })()}
        </Layer>
        
        {/* Cursors Layer - Updates frequently */}
        <CursorLayer cursors={cursorSync.cursors} />
      </Stage>
    </div>
  )
}


