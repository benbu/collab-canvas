import { useMemo, useRef } from 'react'
import { Group, Rect, Circle as KCircle, Line } from 'react-konva'
import type { Shape } from '../../hooks/useCanvasState'

type Props = {
  shape: Shape
  isSelected: boolean
  onChange: (next: Partial<Shape>) => void
  onCommit?: () => void
  onBeginEdit?: () => void
  onEndEdit?: () => void
  selectionColor?: string
  interactive?: boolean
}

type Bounds = { x: number; y: number; w: number; h: number }

function getBounds(shape: Shape): Bounds {
  if (shape.type === 'rect') {
    return { x: shape.x, y: shape.y, w: shape.width ?? 0, h: shape.height ?? 0 }
  }
  if (shape.type === 'circle') {
    const r = shape.radius ?? 0
    return { x: shape.x - r, y: shape.y - r, w: r * 2, h: r * 2 }
  }
  const fs = shape.fontSize ?? 18
  const approxCharWidth = Math.max(5, Math.round(fs * 0.6))
  const w = Math.max(10, (shape.text?.length ?? 1) * approxCharWidth)
  const h = fs
  return { x: shape.x, y: shape.y - h, w, h }
}

export default function ShapeEditor({ shape, isSelected, onChange, onCommit, onBeginEdit, onEndEdit, selectionColor, interactive = true }: Props) {
  const bounds = useMemo(() => getBounds(shape), [shape])
  const startRef = useRef<{ bounds: Bounds } | null>(null)
  const groupRef = useRef<any>(null)
  const lastAngleRef = useRef<number | null>(null)
  const rotateKnobRef = useRef<any>(null)
  const ghostKnobRef = useRef<any>(null)

  if (!isSelected) return null

  const { x, y, w, h } = bounds
  const handleSize = 8
  const half = handleSize / 2

  const commit = () => { if (onCommit) onCommit() }

  const onCornerDrag = (corner: 'nw' | 'ne' | 'sw' | 'se', px: number, py: number) => {
    // lazily capture start
    if (!startRef.current) startRef.current = { bounds: { ...bounds } }
    const s = startRef.current.bounds
    let nx = s.x, ny = s.y, nw = s.w, nh = s.h
    if (corner === 'nw') { nx = Math.min(px, s.x + s.w - 1); ny = Math.min(py, s.y + s.h - 1); nw = s.x + s.w - nx; nh = s.y + s.h - ny }
    if (corner === 'ne') { ny = Math.min(py, s.y + s.h - 1); nw = Math.max(1, px - s.x); nh = s.y + s.h - ny }
    if (corner === 'sw') { nx = Math.min(px, s.x + s.w - 1); nw = s.x + s.w - nx; nh = Math.max(1, py - s.y) }
    if (corner === 'se') { nw = Math.max(1, px - s.x); nh = Math.max(1, py - s.y) }

    if (shape.type === 'rect') {
      onChange({ x: nx, y: ny, width: nw, height: nh })
    } else if (shape.type === 'circle') {
      const r = Math.max(1, Math.round(Math.min(nw, nh) / 2))
      onChange({ radius: r, x: nx + r, y: ny + r })
    } else {
      // text: keep top-left anchored; adjust fontSize by height change; width is visual only
      const nextFont = Math.max(8, Math.round(nh))
      onChange({ x: nx, y: ny + nextFont, fontSize: nextFont })
    }
  }

  const onCornerStart = () => { if (onBeginEdit) onBeginEdit() }
  const onCornerEnd = () => { startRef.current = null; commit(); if (onEndEdit) onEndEdit() }

  const centerX = x + w / 2
  const centerY = y + h / 2
  const rotation = shape.rotation ?? 0
  const selColor = selectionColor ?? '#1976d2'

  return (
    <Group ref={groupRef} listening={true} x={centerX} y={centerY} rotation={rotation}>
      {/* local space origin at center */}
      <Group x={-w / 2} y={-h / 2}>
      {/* selection ring (axis-aligned) */}
      <Rect x={-2} y={-2} width={w + 4} height={h + 4} stroke={selColor} dash={[4, 4]} listening={false} />

      {/* corner handles */}
      <Rect x={-half} y={-half} width={handleSize} height={handleSize} fill={selColor} draggable={interactive} onDragStart={onCornerStart} onDragMove={(e) => onCornerDrag('nw', e.target.x() + half + x, e.target.y() + half + y)} onDragEnd={onCornerEnd} />
      <Rect x={w - half} y={-half} width={handleSize} height={handleSize} fill={selColor} draggable={interactive} onDragStart={onCornerStart} onDragMove={(e) => onCornerDrag('ne', e.target.x() + half + x, e.target.y() + half + y)} onDragEnd={onCornerEnd} />
      <Rect x={-half} y={h - half} width={handleSize} height={handleSize} fill={selColor} draggable={interactive} onDragStart={onCornerStart} onDragMove={(e) => onCornerDrag('sw', e.target.x() + half + x, e.target.y() + half + y)} onDragEnd={onCornerEnd} />
      <Rect x={w - half} y={h - half} width={handleSize} height={handleSize} fill={selColor} draggable={interactive} onDragStart={onCornerStart} onDragMove={(e) => onCornerDrag('se', e.target.x() + half + x, e.target.y() + half + y)} onDragEnd={onCornerEnd} />

      {/* rotation handle (rect/text only) */}
      {shape.type !== 'circle' && (
        <Group>
          <Line points={[w / 2, 0, w / 2, -h / 2 - 24 + 6]} stroke={selColor} listening={false} />
          {/* Ghost handle that stays with the shape while rotating (non-interactive) */}
          <KCircle
            ref={ghostKnobRef}
            x={w / 2}
            y={-h / 2 - 24}
            radius={6}
            fill={selColor}
            listening={false}
            visible={false}
          />
          <KCircle
            ref={rotateKnobRef}
            x={w / 2}
            y={-h / 2 - 24}
            radius={6}
            fill={selColor}
            draggable={interactive}
            dragBoundFunc={() => ({ x: w / 2, y: -h / 2 - 24 })}
            onDragMove={() => {
              const grp = groupRef.current
              const stage = grp?.getStage()
              const p = stage?.getPointerPosition()
              if (!p || !grp) return
              // compute angle from pointer to shape center in world coordinates
              const centerAbs = grp.getAbsolutePosition()
              let angRaw = (Math.atan2(p.y - centerAbs.y, p.x - centerAbs.x) * 180) / Math.PI
              angRaw += 90 // correct 90° CCW offset so angle aligns with expected orientation
              // unwrap angle to prevent jumps across -180/180 boundary
              const prev = lastAngleRef.current ?? (shape.rotation ?? 0)
              let delta = angRaw - prev
              if (delta > 180) delta -= 360
              if (delta < -180) delta += 360
              const next = prev + delta
              if (Math.abs(next - prev) < 0.5) return
              lastAngleRef.current = next
              onChange({ rotation: Math.round(next) })
            }}
            onDragStart={() => {
              if (onBeginEdit) onBeginEdit()
              lastAngleRef.current = shape.rotation ?? 0
              try {
                rotateKnobRef.current?.visible(false)
                ghostKnobRef.current?.visible(true)
                groupRef.current?.getLayer()?.batchDraw()
              } catch {}
            }}
            onDragEnd={() => {
              lastAngleRef.current = null
              try {
                // snap interactive knob back to the ghost knob location
                rotateKnobRef.current?.position({ x: w / 2, y: -h / 2 - 24 })
                rotateKnobRef.current?.visible(true)
                ghostKnobRef.current?.visible(false)
                groupRef.current?.getLayer()?.batchDraw()
              } catch {}
              onCornerEnd()
            }}
          />
        </Group>
      )}
      </Group>
    </Group>
  )
}


