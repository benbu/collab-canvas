import { useCallback, useEffect, useMemo, useRef, useState, Fragment } from 'react'
import { useParams } from 'react-router-dom'
import { Stage, Layer, Line, Rect, Circle, Text } from 'react-konva'
import type Konva from 'konva'
import { throttle } from '../../utils/throttle'
import './Canvas.css'
import Toolbar from '../Toolbar/Toolbar'
import type { Tool } from '../Toolbar/Toolbar'
import { useCanvasState } from '../../hooks/useCanvasState'
import { useCanvasInteractions } from '../../hooks/useCanvasInteractions'
import SelectionBox from './SelectionBox'
import { useFirestoreSync } from '../../hooks/useFirestoreSync'
import { generateId } from '../../utils/id'

 
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
  const { width, height } = useViewportSize()
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const stageRef = useRef<Konva.Stage | null>(null)
  const { state, addShape, updateShape, removeShape } = useCanvasState()
  const [tool, setTool] = useState<Tool>('select')
  const [color, setColor] = useState<string>('#1976d2')
  const [textInput, setTextInput] = useState<string>('Text')
  const { selectedIds, setSelectedIds, selectionRect, beginDragSelect, updateDragSelect, endDragSelect, clearSelection } = useCanvasInteractions()
  const writers = useFirestoreSync(
    roomId,
    (s) => {
      // upsert: if exists update else add
      if (state.byId[s.id]) {
        // shallow equality check to avoid loops is omitted for brevity
      } else {
        addShape(s)
      }
    },
    (id) => {
      // only remove if present
      if (state.byId[id]) removeShape(id)
    },
  )

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
        selectedIds.forEach((id) => removeShape(id))
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
    const cols = Math.ceil(width / GRID_SIZE) + 2
    const rows = Math.ceil(height / GRID_SIZE) + 2
    for (let i = -1; i < cols; i++) {
      const x = i * GRID_SIZE
      lines.push(
        <Line key={`v-${i}`} points={[x, 0, x, height]} stroke="#eee" strokeWidth={1} listening={false} />,
      )
    }
    for (let j = -1; j < rows; j++) {
      const y = j * GRID_SIZE
      lines.push(
        <Line key={`h-${j}`} points={[0, y, width, y]} stroke="#eee" strokeWidth={1} listening={false} />,
      )
    }
    return lines
  }, [width, height])

  const toCanvasPoint = useCallback(
    (client: { x: number; y: number }) => ({ x: (client.x - position.x) / scale, y: (client.y - position.y) / scale }),
    [position.x, position.y, scale],
  )

  return (
    <div className="canvasRoot">
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
      <Stage
        ref={stageRef}
        width={width}
        height={height}
        draggable={tool === 'select'}
        x={position.x}
        y={position.y}
        scaleX={scale}
        scaleY={scale}
        onDragMove={handleDragMove as any}
        onMouseDown={() => {
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
              onDragEnd: (evt: DragEndEvent) => {
                const newX = evt.target.x?.() ?? s.x
                const newY = evt.target.y?.() ?? s.y
                const updated = { ...s, x: newX, y: newY }
                updateShape(id, { x: newX, y: newY })
                writers.update && writers.update(updated)
              },
              onMouseDown: (evt: ShapeMouseEvent) => {
                if (tool !== 'select') return
                if (!evt?.evt?.shiftKey) setSelectedIds([id])
                else setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]))
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
      </Stage>
    </div>
  )
}


