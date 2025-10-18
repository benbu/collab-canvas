import { useCallback, useEffect, useMemo, useRef, useState, Fragment } from 'react'
import { useParams } from 'react-router-dom'
import { Stage, Layer, Line, Rect, Circle, Text } from 'react-konva'
import type Konva from 'konva'
import { throttle } from '../../utils/throttle'
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
import { generateSeedRectangles, measureFpsFor } from '../../utils/devSeed'
import UsernameClaim from '../../pages/UsernameClaim'
import ShapeEditor from './ShapeEditor'
import FloatingTextPanel from './FloatingTextPanel'

 
type DragEndEvent = { target: { x?: () => number; y?: () => number } }
type ShapeMouseEvent = { evt?: MouseEvent }

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
  const { state, addShape, updateShape, removeShape } = useCanvasState()
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
      // ignore remote upserts while locally editing this shape to avoid visual jumps
      if (editingIdsRef.current.has(s.id)) {
        // still merge remote selectedBy while editing, so remote ownership is visible
        if (s.selectedBy !== undefined) updateShape(s.id, { selectedBy: s.selectedBy } as any)
        return
      }
      // upsert: if exists update else add
      if (state.byId[s.id]) {
        const { id: _omit, ...patch } = s as any
        updateShape(s.id, patch)
      } else {
        addShape(s)
      }
    },
    [state.byId, updateShape, addShape],
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
  const [prompt, setPrompt] = useState('')
  const promptInputRef = useRef<HTMLInputElement | null>(null)
  const prevSelectedRef = useRef<string[]>([])
  const stateRef = useRef(state)
  const selfIdRef = useRef(selfId)
  const writersRef = useRef(writers)
  const [showClearModal, setShowClearModal] = useState(false)
  const prevToolRef = useRef<Tool>(tool)

  useEffect(() => { stateRef.current = state }, [state])
  useEffect(() => { selfIdRef.current = selfId }, [selfId])
  useEffect(() => { writersRef.current = writers }, [writers])

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
  }, [])

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

  useEffect(() => {
    const keyHandler = (e: KeyboardEvent) => {
      if (selectedIds.length === 0) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        selectedIds.forEach((id) => {
          removeShape(id)
          writers.remove && writers.remove(id)
        })
        setSelectedIds([])
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        selectedIds.forEach((id) => {
          const s = state.byId[id]
          if (!s) return
          const newId = generateId()
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
      }
    }
    window.addEventListener('keydown', keyHandler)
    return () => window.removeEventListener('keydown', keyHandler)
  }, [selectedIds, state.byId, addShape, removeShape, setSelectedIds])

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

  const toCanvasPoint = useCallback(
    (client: { x: number; y: number }) => ({ x: (client.x - position.x) / scale, y: (client.y - position.y) / scale }),
    [position.x, position.y, scale],
  )

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
        onChangeText={setTextInput}
        onChangeFont={setFontFamily}
        onRequestPositionChange={(p) => setPanelPos(p)}
        onSave={() => {
          selectedIds.forEach((id) => {
            const s = state.byId[id]
            if (s?.type === 'text') {
              updateShape(id, { text: textInput, fontFamily } as any)
              writers.update && writers.update({ ...s, text: textInput, fontFamily, selectedBy: state.byId[id]?.selectedBy } as any)
            }
          })
        }}
        onClose={() => setPanelHidden(true)}
      />
      {import.meta.env.DEV && (
        <div style={{ position: 'fixed', bottom: 12, left: 12, display: 'flex', gap: 8, zIndex: 10 }}>
          <button
            onClick={() => {
              const seeds = generateSeedRectangles(500)
              seeds.forEach((s) => addShape(s as any))
            }}
          >
            Seed 500
          </button>
          <button
            onClick={() => {
              measureFpsFor(1000, (fps) => {
                // eslint-disable-next-line no-console
                console.log('FPS ~', Math.round(fps))
              })
            }}
          >
            Measure FPS
          </button>
        </div>
      )}
      {/* AI Prompt Bar */}
      <div className="aiPromptBar">
        <input
          className="aiInput"
          type="text"
          placeholder="AI Commands e.g. 'Create a circle'"
          ref={promptInputRef}
          value={prompt}
          onChange={(e) => setPrompt(e.currentTarget.value)}
          onKeyDown={async (e) => {
            if (e.key === 'Enter') {
              const val = prompt.trim()
              if (!val) return
              const res = await ai.postPrompt(val, { selectedIds })
              if (res?.ok) setPrompt('')
            }
          }}
        />
        <button
          className="aiGoButton"
          onClick={async () => {
            const val = prompt.trim()
            if (!val) return
            const res = await ai.postPrompt(val, { selectedIds })
            if (res?.ok) setPrompt('')
          }}
        >Go</button>
        <div className="aiPromptStatus" aria-live="polite">
          {ai.status === 'loading' && <span>Processing…</span>}
          {ai.status === 'error' && <span style={{ color: '#b91c1c' }}>{ai.lastResult?.messages?.[0] ?? 'Error'}</span>}
          {ai.status === 'success' && (
            <span style={{ color: '#065f46' }}>Done ({ai.lastResult?.executed}/{ai.lastResult?.planned})</span>
          )}
        </div>
      </div>
      {ai.status === 'needs_confirmation' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20 }}>
          <div style={{ background: '#fff', padding: 16, borderRadius: 8, minWidth: 340 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Confirm AI Plan</div>
            <div style={{ marginBottom: 12 }}>This prompt plans more than 50 steps. Proceed?</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => ai.cancelPending()}>Cancel</button>
              <button onClick={() => { void ai.confirmAndExecute() }}>Confirm</button>
            </div>
          </div>
        </div>
      )}
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
        onTouchStart={(e: any) => {
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
        }}
        onTouchMove={(e: any) => {
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
        }}
        onMouseDown={(e: any) => {
          const ev = (e?.evt as MouseEvent | undefined)
          if (ev && typeof ev.clientX === 'number' && typeof ev.clientY === 'number') {
            lastMouseRef.current = { x: ev.clientX, y: ev.clientY }
          }
          // B) only start drag-select when clicking empty stage
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
            const shape = { id, type: 'rect' as const, x: canvasPoint.x, y: canvasPoint.y, width: 200, height: 120, fill: color }
            addShape(shape)
            writers.add && writers.add({ ...shape })
          } else if (tool === 'circle') {
            const id = generateId()
            const shape = { id, type: 'circle' as const, x: canvasPoint.x, y: canvasPoint.y, radius: 60, fill: color }
            addShape(shape)
            writers.add && writers.add({ ...shape })
          } else if (tool === 'text') {
            const id = generateId()
            const shape = { id, type: 'text' as const, x: canvasPoint.x, y: canvasPoint.y, text: textInput, fontSize: 18, fill: color, fontFamily }
            addShape(shape)
            writers.add && writers.add({ ...shape })
          }
        }}
        onMouseMove={(e: any) => {
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
        }}
        onMouseUp={() => {
          if (!selectionRect?.active) return
          endDragSelect()
          const rect = selectionRect
          // C) small drag threshold: ignore micro-drags
          const dragThreshold = 3
          if (rect.w < dragThreshold && rect.h < dragThreshold) {
            clearSelection()
            return
          }
          const hits = state.allIds.filter((id) => {
            const s = state.byId[id]
            if (!s) return false
            const lockedByOther = !!(s.selectedBy?.userId && s.selectedBy.userId !== selfId)
            if (lockedByOther) return false
            return s.x >= rect.x && s.x <= rect.x + rect.w && s.y >= rect.y && s.y <= rect.y + rect.h
          })
          setSelectedIds(hits)
        }}
      >
        <Layer listening={false}>{gridLines}</Layer>
        <Layer>
          {selectionRect?.active && (
            <SelectionBox x={selectionRect.x} y={selectionRect.y} w={selectionRect.w} h={selectionRect.h} color={colorFromId} />
          )}
          {state.allIds.map((id) => {
            const s = state.byId[id]
            const isSelected = selectedIds.includes(id)
            const lockedByOther = !!(s.selectedBy?.userId && s.selectedBy.userId !== selfId)
            const common = {
              x: s.x,
              y: s.y,
              draggable: !lockedByOther,
              onDragStart: () => {
                if (lockedByOther) return
                setIsDraggingShape(true)
                beginEdit(id)
                // If not already selected, select the target so drag begins immediately
                if (!isSelected) setSelectedIds([id])
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
              },
              onDragMove: (evt: DragEndEvent) => {
                // If group dragging, move all selected shapes by the same delta as the dragged one
                const newX = evt.target.x?.() ?? s.x
                const newY = evt.target.y?.() ?? s.y
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
                // Always broadcast dragged shape position during drag for realtime sync
                updateShape(id, { x: newX, y: newY })
                writers.update && writers.update({ ...s, x: newX, y: newY, selectedBy: state.byId[id]?.selectedBy } as any)
              },
              onDragEnd: (evt: DragEndEvent) => {
                const newX = evt.target.x?.() ?? s.x
                const newY = evt.target.y?.() ?? s.y
                const updated = { ...s, x: newX, y: newY }
                updateShape(id, { x: newX, y: newY })
                if ((writers as any).updateImmediate) {
                  ;(writers as any).updateImmediate({ ...updated, selectedBy: state.byId[id]?.selectedBy } as any)
                } else {
                  writers.update && writers.update({ ...updated, selectedBy: state.byId[id]?.selectedBy } as any)
                }
                setIsDraggingShape(false)
                endEdit(id)
                // Clear group drag state
                groupDragRef.current.active = false
                groupDragRef.current.draggedId = null
                groupDragRef.current.start = null
                groupDragRef.current.origins = {}
              },
              onMouseDown: (evt: ShapeMouseEvent) => {
                if (tool !== 'select') return
                const isShift = !!evt?.evt?.shiftKey
                if (evt?.evt && typeof (evt.evt as any).clientX === 'number' && typeof (evt.evt as any).clientY === 'number') {
                  lastMouseRef.current = { x: (evt.evt as any).clientX, y: (evt.evt as any).clientY }
                }
                if (lockedByOther) {
                  // Clicking a locked shape should clear selection unless user is attempting shift add/remove
                  if (!isShift) clearSelection()
                  return
                }
                // A) prevent Stage mousedown from starting drag-select
                ;(evt as any)?.evt && (((evt as any).evt as any).cancelBubble = true)
                if (isShift) {
                  setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]))
                } else {
                  // If already selected, keep current multi-selection for group drag
                  if (!selectedIds.includes(id)) setSelectedIds([id])
                }
              },
            } as any

            if (s.type === 'rect') {
              const w = s.width ?? 0
              const h = s.height ?? 0
              const cx = s.x + w / 2
              const cy = s.y + h / 2
              return (
                <Fragment key={id}>
                  <Rect
                    {...common}
                    x={cx}
                    y={cy}
                    offsetX={w / 2}
                    offsetY={h / 2}
                    width={w}
                    height={h}
                    fill={s.fill}
                    rotation={s.rotation ?? 0}
                    onDragMove={(evt: DragEndEvent) => {
                      const cX = evt.target.x?.() ?? cx
                      const cY = evt.target.y?.() ?? cy
                      const nextX = cX - w / 2
                      const nextY = cY - h / 2
                      updateShape(id, { x: nextX, y: nextY })
                      writers.update && writers.update({ ...s, x: nextX, y: nextY, selectedBy: state.byId[id]?.selectedBy } as any)
                    }}
                    onDragEnd={(evt: DragEndEvent) => {
                      const cX = evt.target.x?.() ?? cx
                      const cY = evt.target.y?.() ?? cy
                      const nextX = cX - w / 2
                      const nextY = cY - h / 2
                      updateShape(id, { x: nextX, y: nextY })
                      if ((writers as any).updateImmediate) {
                        ;(writers as any).updateImmediate({ ...s, x: nextX, y: nextY, selectedBy: state.byId[id]?.selectedBy } as any)
                      } else {
                        writers.update && writers.update({ ...s, x: nextX, y: nextY, selectedBy: state.byId[id]?.selectedBy } as any)
                      }
                      setIsDraggingShape(false)
                      endEdit(id)
                      groupDragRef.current.active = false
                      groupDragRef.current.draggedId = null
                      groupDragRef.current.start = null
                      groupDragRef.current.origins = {}
                    }}
                  />
                <ShapeEditor
                  shape={s as any}
                  isSelected={isSelected}
                  selectionColor={colorFromId}
                  onChange={(next) => {
                  updateShape(id, next as any)
                  const latest = { ...s, ...next, selectedBy: state.byId[id]?.selectedBy }
                  writers.update && writers.update(latest as any)
                  }}
                  onCommit={() => {
                    const latest = state.byId[id]
                    if (latest) {
                      if ((writers as any).updateImmediate) {
                        ;(writers as any).updateImmediate({ ...latest, selectedBy: state.byId[id]?.selectedBy } as any)
                      } else {
                        writers.update && writers.update({ ...latest, selectedBy: state.byId[id]?.selectedBy } as any)
                      }
                    }
                  }}
                    onBeginEdit={() => beginEdit(id)}
                    onEndEdit={() => endEdit(id)}
                />
                {s.selectedBy?.userId && s.selectedBy.userId !== selfId && (
                  <ShapeEditor
                    shape={s as any}
                    isSelected
                    selectionColor={s.selectedBy.color}
                    interactive={false}
                    onChange={() => {}}
                  />
                )}
                  
                </Fragment>
              )
            }
            if (s.type === 'circle') {
              return (
                <Fragment key={id}>
                  <Circle {...common} radius={s.radius ?? 0} fill={s.fill} />
                <ShapeEditor
                  shape={s as any}
                  isSelected={isSelected}
                  selectionColor={colorFromId}
                  onChange={(next) => {
                  updateShape(id, next as any)
                  const latest = { ...s, ...next, selectedBy: state.byId[id]?.selectedBy }
                  writers.update && writers.update(latest as any)
                  }}
                  onCommit={() => {
                    const latest = state.byId[id]
                    if (latest) {
                      if ((writers as any).updateImmediate) {
                        ;(writers as any).updateImmediate({ ...latest, selectedBy: state.byId[id]?.selectedBy } as any)
                      } else {
                        writers.update && writers.update({ ...latest, selectedBy: state.byId[id]?.selectedBy } as any)
                      }
                    }
                  }}
                    onBeginEdit={() => beginEdit(id)}
                    onEndEdit={() => endEdit(id)}
                />
                {s.selectedBy?.userId && s.selectedBy.userId !== selfId && (
                  <ShapeEditor
                    shape={s as any}
                    isSelected
                    selectionColor={s.selectedBy.color}
                    interactive={false}
                    onChange={() => {}}
                  />
                )}
                  
                </Fragment>
              )
            }
            // text
            const fs = s.fontSize ?? 18
            const approxCharWidth = Math.max(5, Math.round(fs * 0.6))
            const tw = Math.max(10, (s.text?.length ?? 1) * approxCharWidth)
            const th = fs
            const tcx = s.x + tw / 2
            const tcy = (s.y - th) + th / 2
            return (
              <Fragment key={id}>
              <Text
                {...common}
                x={tcx}
                y={tcy}
                offsetX={tw / 2}
                offsetY={th / 2}
                text={s.text ?? ''}
                fontSize={fs}
                fontFamily={(s as any).fontFamily}
                fill={s.fill}
                rotation={s.rotation ?? 0}
                onDragMove={(evt: DragEndEvent) => {
                  const cX = evt.target.x?.() ?? tcx
                  const cY = evt.target.y?.() ?? tcy
                  const nextX = cX - tw / 2
                  const nextY = cY + th / 2
                  updateShape(id, { x: nextX, y: nextY })
                  writers.update && writers.update({ ...s, x: nextX, y: nextY, selectedBy: state.byId[id]?.selectedBy } as any)
                }}
                onDragEnd={(evt: DragEndEvent) => {
                  const cX = evt.target.x?.() ?? tcx
                  const cY = evt.target.y?.() ?? tcy
                  const nextX = cX - tw / 2
                  const nextY = cY + th / 2
                  updateShape(id, { x: nextX, y: nextY })
                  if ((writers as any).updateImmediate) {
                    ;(writers as any).updateImmediate({ ...s, x: nextX, y: nextY, selectedBy: state.byId[id]?.selectedBy } as any)
                  } else {
                    writers.update && writers.update({ ...s, x: nextX, y: nextY, selectedBy: state.byId[id]?.selectedBy } as any)
                  }
                  setIsDraggingShape(false)
                  endEdit(id)
                  groupDragRef.current.active = false
                  groupDragRef.current.draggedId = null
                  groupDragRef.current.start = null
                  groupDragRef.current.origins = {}
                }}
              />
              <ShapeEditor
                shape={s as any}
                isSelected={isSelected}
                selectionColor={colorFromId}
                onChange={(next) => {
                  updateShape(id, next as any)
                  const latest = { ...s, ...next, selectedBy: state.byId[id]?.selectedBy }
                  writers.update && writers.update(latest as any)
                }}
                onCommit={() => {
                  const latest = state.byId[id]
                  if (latest) {
                    if ((writers as any).updateImmediate) {
                      ;(writers as any).updateImmediate({ ...latest, selectedBy: state.byId[id]?.selectedBy } as any)
                    } else {
                      writers.update && writers.update({ ...latest, selectedBy: state.byId[id]?.selectedBy } as any)
                    }
                  }
                }}
                onBeginEdit={() => beginEdit(id)}
                onEndEdit={() => endEdit(id)}
              />
              {s.selectedBy?.userId && s.selectedBy.userId !== selfId && (
                <ShapeEditor
                  shape={s as any}
                  isSelected
                  selectionColor={s.selectedBy.color}
                  interactive={false}
                  onChange={() => {}}
                />
              )}
                
              </Fragment>
            )
          })}
        </Layer>
        <CursorLayer cursors={cursorSync.cursors} />
      </Stage>
    </div>
  )
}


