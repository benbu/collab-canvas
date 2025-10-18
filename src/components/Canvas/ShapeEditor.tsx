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

type StartState = {
  bounds: Bounds
  centerX: number
  centerY: number
  rotation: number
  oppositeCornerWorld: { x: number; y: number }
}

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
  const startRef = useRef<StartState | null>(null)
  const groupRef = useRef<any>(null)
  const lastAngleRef = useRef<number | null>(null)
  const rotateKnobRef = useRef<any>(null)
  const ghostKnobRef = useRef<any>(null)
  
  // Corner handle refs (interactive and ghost)
  const nwHandleRef = useRef<any>(null)
  const nwGhostRef = useRef<any>(null)
  const neHandleRef = useRef<any>(null)
  const neGhostRef = useRef<any>(null)
  const swHandleRef = useRef<any>(null)
  const swGhostRef = useRef<any>(null)
  const seHandleRef = useRef<any>(null)
  const seGhostRef = useRef<any>(null)

  if (!isSelected) return null

  const { x, y, w, h } = bounds
  const handleSize = 8
  const half = handleSize / 2

  const commit = () => { if (onCommit) onCommit() }

  const onCornerDrag = (corner: 'nw' | 'ne' | 'sw' | 'se') => {
    const grp = groupRef.current
    const stage = grp?.getStage()
    const pointer = stage?.getPointerPosition()
    if (!pointer || !grp) return

    // Lazily capture start state
    if (!startRef.current) {
      const centerX = x + w / 2
      const centerY = y + h / 2
      const rot = shape.rotation ?? 0
      const rad = (rot * Math.PI) / 180
      
      // Calculate opposite corner position in local space (relative to center)
      let oppLocalX = 0, oppLocalY = 0
      if (corner === 'nw') { oppLocalX = w/2; oppLocalY = h/2 }
      else if (corner === 'ne') { oppLocalX = -w/2; oppLocalY = h/2 }
      else if (corner === 'sw') { oppLocalX = w/2; oppLocalY = -h/2 }
      else if (corner === 'se') { oppLocalX = -w/2; oppLocalY = -h/2 }
      
      // Transform opposite corner to world space
      const oppWorldX = centerX + oppLocalX * Math.cos(rad) - oppLocalY * Math.sin(rad)
      const oppWorldY = centerY + oppLocalX * Math.sin(rad) + oppLocalY * Math.cos(rad)
      
      startRef.current = {
        bounds: { ...bounds },
        centerX,
        centerY,
        rotation: rot,
        oppositeCornerWorld: { x: oppWorldX, y: oppWorldY }
      }
    }

    const start = startRef.current
    const opp = start.oppositeCornerWorld
    const rot = start.rotation
    const rad = (rot * Math.PI) / 180
    
    // Vector from opposite corner to pointer in world space
    const dx = pointer.x - opp.x
    const dy = pointer.y - opp.y
    
    // Rotate back to shape's local space to get dimensions
    const localDx = dx * Math.cos(-rad) - dy * Math.sin(-rad)
    const localDy = dx * Math.sin(-rad) + dy * Math.cos(-rad)
    
    const localW = Math.max(1, Math.abs(localDx))
    const localH = Math.max(1, Math.abs(localDy))
    
    // New center is midpoint between opposite corner and pointer
    const newCenterX = (opp.x + pointer.x) / 2
    const newCenterY = (opp.y + pointer.y) / 2

    // Update shape based on type
    if (shape.type === 'rect') {
      // Calculate new top-left from new center (in world space, without rotation offset)
      const newX = newCenterX - localW / 2
      const newY = newCenterY - localH / 2
      onChange({ x: newX, y: newY, width: localW, height: localH })
    } else if (shape.type === 'circle') {
      const r = Math.max(1, Math.round(Math.min(localW, localH) / 2))
      onChange({ radius: r, x: newCenterX, y: newCenterY })
    } else {
      // text: adjust fontSize proportionally to height
      const fontScale = localH / start.bounds.h
      const baseFontSize = start.bounds.h // text bounds height equals fontSize
      const nextFont = Math.max(8, Math.round(baseFontSize * fontScale))
      
      // For text, (x, y) represents top-left with y being baseline
      // y should be centerY + localH/2 (bottom of text box)
      const newX = newCenterX - localW / 2
      const newY = newCenterY + localH / 2
      onChange({ x: newX, y: newY, fontSize: nextFont })
    }
  }

  const onCornerStart = (corner: 'nw' | 'ne' | 'sw' | 'se') => {
    if (onBeginEdit) onBeginEdit()
    try {
      // Hide interactive handle, show ghost handle
      const handleRef = corner === 'nw' ? nwHandleRef : corner === 'ne' ? neHandleRef : corner === 'sw' ? swHandleRef : seHandleRef
      const ghostRef = corner === 'nw' ? nwGhostRef : corner === 'ne' ? neGhostRef : corner === 'sw' ? swGhostRef : seGhostRef
      handleRef.current?.visible(false)
      ghostRef.current?.visible(true)
      groupRef.current?.getLayer()?.batchDraw()
    } catch {}
  }
  
  const onCornerEnd = (corner: 'nw' | 'ne' | 'sw' | 'se') => {
    startRef.current = null
    try {
      // Snap interactive handle back to position
      const handleRef = corner === 'nw' ? nwHandleRef : corner === 'ne' ? neHandleRef : corner === 'sw' ? swHandleRef : seHandleRef
      const ghostRef = corner === 'nw' ? nwGhostRef : corner === 'ne' ? neGhostRef : corner === 'sw' ? swGhostRef : seGhostRef
      const pos = corner === 'nw' ? { x: -half, y: -half } : corner === 'ne' ? { x: w - half, y: -half } : corner === 'sw' ? { x: -half, y: h - half } : { x: w - half, y: h - half }
      handleRef.current?.position(pos)
      handleRef.current?.visible(true)
      ghostRef.current?.visible(false)
      groupRef.current?.getLayer()?.batchDraw()
    } catch {}
    commit()
    if (onEndEdit) onEndEdit()
  }

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
      {/* NW corner */}
      <Rect ref={nwGhostRef} x={-half} y={-half} width={handleSize} height={handleSize} fill={selColor} listening={false} visible={false} />
      <Rect ref={nwHandleRef} x={-half} y={-half} width={handleSize} height={handleSize} fill={selColor} draggable={interactive} dragBoundFunc={() => ({ x: -half, y: -half })} onDragStart={() => onCornerStart('nw')} onDragMove={() => onCornerDrag('nw')} onDragEnd={() => onCornerEnd('nw')} />
      
      {/* NE corner */}
      <Rect ref={neGhostRef} x={w - half} y={-half} width={handleSize} height={handleSize} fill={selColor} listening={false} visible={false} />
      <Rect ref={neHandleRef} x={w - half} y={-half} width={handleSize} height={handleSize} fill={selColor} draggable={interactive} dragBoundFunc={() => ({ x: w - half, y: -half })} onDragStart={() => onCornerStart('ne')} onDragMove={() => onCornerDrag('ne')} onDragEnd={() => onCornerEnd('ne')} />
      
      {/* SW corner */}
      <Rect ref={swGhostRef} x={-half} y={h - half} width={handleSize} height={handleSize} fill={selColor} listening={false} visible={false} />
      <Rect ref={swHandleRef} x={-half} y={h - half} width={handleSize} height={handleSize} fill={selColor} draggable={interactive} dragBoundFunc={() => ({ x: -half, y: h - half })} onDragStart={() => onCornerStart('sw')} onDragMove={() => onCornerDrag('sw')} onDragEnd={() => onCornerEnd('sw')} />
      
      {/* SE corner */}
      <Rect ref={seGhostRef} x={w - half} y={h - half} width={handleSize} height={handleSize} fill={selColor} listening={false} visible={false} />
      <Rect ref={seHandleRef} x={w - half} y={h - half} width={handleSize} height={handleSize} fill={selColor} draggable={interactive} dragBoundFunc={() => ({ x: w - half, y: h - half })} onDragStart={() => onCornerStart('se')} onDragMove={() => onCornerDrag('se')} onDragEnd={() => onCornerEnd('se')} />

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
              commit()
              if (onEndEdit) onEndEdit()
            }}
          />
        </Group>
      )}
      </Group>
    </Group>
  )
}


