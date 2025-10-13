import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Stage, Layer, Line } from 'react-konva'
import { throttle } from '../../utils/throttle'
import './Canvas.css'

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
      >
        <Layer listening={false}>{gridLines}</Layer>
        <Layer>{/* shapes would go here */}</Layer>
      </Stage>
    </div>
  )
}


