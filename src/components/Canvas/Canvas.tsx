import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Stage, Layer, Line, Rect, Circle, Text } from 'react-konva'
import { throttle } from '../../utils/throttle'
import './Canvas.css'
import Toolbar from '../Toolbar/Toolbar'
import type { Tool } from '../Toolbar/Toolbar'
import { useCanvasState } from '../../hooks/useCanvasState'

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
  const { width, height } = useViewportSize()
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const stageRef = useRef<any>(null)
  const { state, addShape } = useCanvasState()
  const [tool, setTool] = useState<Tool>('select')
  const [color, setColor] = useState<string>('#1976d2')
  const [textInput, setTextInput] = useState<string>('Text')

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
      throttle((e: WheelEvent) => {
        e.preventDefault()
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
        const direction = e.deltaY > 0 ? -1 : 1
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
    const wheelListener = (e: WheelEvent) => handleWheel(e)
    const container = stage.container()
    container.addEventListener('wheel', wheelListener, { passive: false })
    return () => container.removeEventListener('wheel', wheelListener)
  }, [handleWheel])

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

  return (
    <div className="canvasRoot">
      <Toolbar
        activeTool={tool}
        onToolChange={setTool}
        color={color}
        onColorChange={setColor}
        text={textInput}
        onTextChange={setTextInput}
      />
      <Stage
        ref={stageRef}
        width={width}
        height={height}
        draggable
        x={position.x}
        y={position.y}
        scaleX={scale}
        scaleY={scale}
        onDragMove={handleDragMove as any}
        onMouseDown={(e: any) => {
          if (tool === 'select') return
          const stage = stageRef.current
          const pointer = stage.getPointerPosition()
          if (!pointer) return
          const canvasPoint = {
            x: (pointer.x - position.x) / scale,
            y: (pointer.y - position.y) / scale,
          }
          if (tool === 'rect') {
            addShape({ type: 'rect', x: canvasPoint.x, y: canvasPoint.y, width: 200, height: 120, fill: color })
          } else if (tool === 'circle') {
            addShape({ type: 'circle', x: canvasPoint.x, y: canvasPoint.y, radius: 60, fill: color })
          } else if (tool === 'text') {
            addShape({ type: 'text', x: canvasPoint.x, y: canvasPoint.y, text: textInput, fontSize: 18, fill: color })
          }
        }}
      >
        <Layer listening={false}>{gridLines}</Layer>
        <Layer>
          {state.allIds.map((id) => {
            const s = state.byId[id]
            if (s.type === 'rect') {
              return <Rect key={id} x={s.x} y={s.y} width={s.width ?? 0} height={s.height ?? 0} fill={s.fill} />
            }
            if (s.type === 'circle') {
              return <Circle key={id} x={s.x} y={s.y} radius={s.radius ?? 0} fill={s.fill} />
            }
            return <Text key={id} x={s.x} y={s.y} text={s.text ?? ''} fontSize={s.fontSize ?? 18} fill={s.fill} />
          })}
        </Layer>
      </Stage>
    </div>
  )
}


