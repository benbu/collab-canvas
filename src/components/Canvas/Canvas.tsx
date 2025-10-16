import { useCallback, useEffect, useMemo, useRef, useState, Fragment } from 'react'
import { useParams } from 'react-router-dom'
import { Stage, Layer, Line, Rect, Circle, Text } from 'react-konva'
import type Konva from 'konva'
import { throttle } from '../../utils/throttle'
import './Canvas.css'
import Toolbar from '../Toolbar/Toolbar'
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
import { useAuth } from '../../contexts/AuthContext'
import { usePersistence } from '../../hooks/usePersistence'
import { generateSeedRectangles, measureFpsFor } from '../../utils/devSeed'
import UsernameClaim from '../../pages/UsernameClaim'

 
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
  const groupDragRef = useRef<{
    active: boolean
    draggedId: string | null
    start: { x: number; y: number } | null
    origins: Record<string, { x: number; y: number }>
  }>({ active: false, draggedId: null, start: null, origins: {} })
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
          const patch: any = { ...s, x: s.x + 16, y: s.y + 16, id: undefined }
          addShape(patch)
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
      <PresenceList selfId={selfId} cursors={(cursorSync as any).allCursors} />
      <Toolbar
        activeTool={tool}
        onToolChange={(t) => {
          setTool(t)
          clearSelection()
        }}
        color={color}
        onColorChange={setColor}
        text={textInput}
        onTextChange={setTextInput}
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
      <div style={{ position: 'fixed', bottom: 12, right: 12, display: 'flex', gap: 8, zIndex: 10, alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Type a prompt (/) or Cmd+K"
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
          style={{ padding: '8px 10px', minWidth: 320 }}
        />
        <button
          onClick={async () => {
            const val = prompt.trim()
            if (!val) return
            const res = await ai.postPrompt(val, { selectedIds })
            if (res?.ok) setPrompt('')
          }}
        >Go</button>
        <div aria-live="polite" style={{ minWidth: 120 }}>
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
            const shape = { id, type: 'text' as const, x: canvasPoint.x, y: canvasPoint.y, text: textInput, fontSize: 18, fill: color }
            addShape(shape)
            writers.add && writers.add({ ...shape })
          }
        }}
        onMouseMove={() => {
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
          if (rect.w < dragThreshold && rect.h < dragThreshold) return
          const hits = state.allIds.filter((id) => {
            const s = state.byId[id]
            return s.x >= rect.x && s.x <= rect.x + rect.w && s.y >= rect.y && s.y <= rect.y + rect.h
          })
          setSelectedIds(hits)
        }}
      >
        <Layer listening={false}>{gridLines}</Layer>
        <Layer>
          {selectionRect?.active && (
            <SelectionBox x={selectionRect.x} y={selectionRect.y} w={selectionRect.w} h={selectionRect.h} />
          )}
          {state.allIds.map((id) => {
            const s = state.byId[id]
            const isSelected = selectedIds.includes(id)
            const common = {
              x: s.x,
              y: s.y,
              draggable: isSelected,
              onDragStart: () => {
                setIsDraggingShape(true)
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
                    if (so) writers.update && writers.update({ ...so, ...next })
                  })
                }
                // Always broadcast dragged shape position during drag for realtime sync
                updateShape(id, { x: newX, y: newY })
                writers.update && writers.update({ ...s, x: newX, y: newY })
              },
              onDragEnd: (evt: DragEndEvent) => {
                const newX = evt.target.x?.() ?? s.x
                const newY = evt.target.y?.() ?? s.y
                const updated = { ...s, x: newX, y: newY }
                updateShape(id, { x: newX, y: newY })
                writers.update && writers.update(updated)
                setIsDraggingShape(false)
                // Clear group drag state
                groupDragRef.current.active = false
                groupDragRef.current.draggedId = null
                groupDragRef.current.start = null
                groupDragRef.current.origins = {}
              },
              onMouseDown: (evt: ShapeMouseEvent) => {
                if (tool !== 'select') return
                // A) prevent Stage mousedown from starting drag-select
                ;(evt as any)?.evt && (((evt as any).evt as any).cancelBubble = true)
                const isShift = !!evt?.evt?.shiftKey
                if (isShift) {
                  setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]))
                } else {
                  // If already selected, keep current multi-selection for group drag
                  if (!selectedIds.includes(id)) setSelectedIds([id])
                }
              },
            } as any

            if (s.type === 'rect') {
              return (
                <Fragment key={id}>
                  <Rect {...common} width={s.width ?? 0} height={s.height ?? 0} fill={s.fill} />
                  {isSelected && (
                    <Rect data-testid="rect-outline" x={s.x - 2} y={s.y - 2} width={(s.width ?? 0) + 4} height={(s.height ?? 0) + 4} stroke="#1976d2" listening={false} />
                  )}
                </Fragment>
              )
            }
            if (s.type === 'circle') {
              return (
                <Fragment key={id}>
                  <Circle {...common} radius={s.radius ?? 0} fill={s.fill} />
                  {isSelected && (
                    <Circle data-testid="circle-outline" x={s.x} y={s.y} radius={(s.radius ?? 0) + 4} stroke="#1976d2" listening={false} />
                  )}
                </Fragment>
              )
            }
            return (
              <Fragment key={id}>
                <Text {...common} text={s.text ?? ''} fontSize={s.fontSize ?? 18} fill={s.fill} />
                {isSelected && (
                  <Rect data-testid="text-outline" x={s.x - 2} y={s.y - 16} width={(s.text?.length ?? 1) * 9} height={s.fontSize ?? 18} stroke="#1976d2" listening={false} />
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


