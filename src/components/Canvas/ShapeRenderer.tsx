import { Fragment, memo } from 'react'
import { Rect, Circle, Text } from 'react-konva'
import type { Shape } from '../../hooks/useCanvasState'
import ShapeEditor from './ShapeEditor'

type DragEndEvent = { target: { x?: () => number; y?: () => number } }
type ShapeMouseEvent = { evt?: MouseEvent }

interface ShapeRendererProps {
  shape: Shape
  isSelected: boolean
  selectedIds: string[]
  selfId: string
  colorFromId: string
  scale: number
  position: { x: number; y: number }
  tool: string
  lockedByOther: boolean
  onUpdateShape: (id: string, patch: Partial<Shape>) => void
  onSetSelectedIds: (ids: string[] | ((prev: string[]) => string[])) => void
  onClearSelection: () => void
  onSetIsDraggingShape: (dragging: boolean) => void
  onBeginEdit: (id: string) => void
  onEndEdit: (id: string) => void
  onWriterUpdate: (shape: Shape) => void
  onWriterUpdateImmediate: (shape: Shape) => void
  onDragStart?: () => void
  onDragMove?: (newX: number, newY: number) => void
  onDragEnd?: (newX: number, newY: number) => void
  lastMouseRef: React.MutableRefObject<{ x: number; y: number } | null>
  stateById: Record<string, Shape>
}

const ShapeRenderer = memo(function ShapeRenderer({
  shape: s,
  isSelected,
  selectedIds,
  selfId,
  colorFromId,
  scale,
  position,
  tool,
  lockedByOther,
  onUpdateShape,
  onSetSelectedIds,
  onClearSelection,
  onSetIsDraggingShape,
  onBeginEdit,
  onEndEdit,
  onWriterUpdate,
  onWriterUpdateImmediate,
  onDragStart,
  onDragMove,
  onDragEnd,
  lastMouseRef,
  stateById,
}: ShapeRendererProps) {
  const id = s.id

  const common = {
    x: s.x,
    y: s.y,
    draggable: !lockedByOther,
    onDragStart: () => {
      if (lockedByOther) return
      onSetIsDraggingShape(true)
      onBeginEdit(id)
      // If not already selected, select the target so drag begins immediately
      if (!isSelected) onSetSelectedIds([id])
      onDragStart?.()
    },
    onDragMove: (evt: DragEndEvent) => {
      // Get new position from event
      const newX = evt.target.x?.() ?? s.x
      const newY = evt.target.y?.() ?? s.y
      onDragMove?.(newX, newY)
      // Always broadcast dragged shape position during drag for realtime sync
      onUpdateShape(id, { x: newX, y: newY })
      onWriterUpdate({ ...s, x: newX, y: newY, selectedBy: stateById[id]?.selectedBy })
    },
    onDragEnd: (evt: DragEndEvent) => {
      const newX = evt.target.x?.() ?? s.x
      const newY = evt.target.y?.() ?? s.y
      const updated = { ...s, x: newX, y: newY }
      onUpdateShape(id, { x: newX, y: newY })
      onWriterUpdateImmediate({ ...updated, selectedBy: stateById[id]?.selectedBy })
      onSetIsDraggingShape(false)
      onEndEdit(id)
      onDragEnd?.(newX, newY)
    },
    onMouseDown: (evt: ShapeMouseEvent) => {
      if (tool !== 'select') return
      const isShift = !!evt?.evt?.shiftKey
      if (evt?.evt && typeof (evt.evt as any).clientX === 'number' && typeof (evt.evt as any).clientY === 'number') {
        lastMouseRef.current = { x: (evt.evt as any).clientX, y: (evt.evt as any).clientY }
      }
      if (lockedByOther) {
        // Clicking a locked shape should clear selection unless user is attempting shift add/remove
        if (!isShift) onClearSelection()
        return
      }
      // Prevent Stage mousedown from starting drag-select
      ;(evt as any)?.evt && (((evt as any).evt as any).cancelBubble = true)
      if (isShift) {
        onSetSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]))
      } else {
        // If already selected, keep current multi-selection for group drag
        if (!selectedIds.includes(id)) onSetSelectedIds([id])
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
            onDragMove?.(nextX, nextY)
            onUpdateShape(id, { x: nextX, y: nextY })
            onWriterUpdate({ ...s, x: nextX, y: nextY, selectedBy: stateById[id]?.selectedBy })
          }}
          onDragEnd={(evt: DragEndEvent) => {
            const cX = evt.target.x?.() ?? cx
            const cY = evt.target.y?.() ?? cy
            const nextX = cX - w / 2
            const nextY = cY - h / 2
            onUpdateShape(id, { x: nextX, y: nextY })
            onWriterUpdateImmediate({ ...s, x: nextX, y: nextY, selectedBy: stateById[id]?.selectedBy })
            onSetIsDraggingShape(false)
            onEndEdit(id)
            onDragEnd?.(nextX, nextY)
          }}
        />
        <ShapeEditor
          shape={s as any}
          isSelected={isSelected}
          selectionColor={colorFromId}
          scale={scale}
          position={position}
          onChange={(next) => {
            onUpdateShape(id, next as any)
            const latest = { ...s, ...next, selectedBy: stateById[id]?.selectedBy }
            onWriterUpdate(latest as any)
          }}
          onCommit={() => {
            const latest = stateById[id]
            if (latest) {
              onWriterUpdateImmediate({ ...latest, selectedBy: stateById[id]?.selectedBy } as any)
            }
          }}
          onBeginEdit={() => onBeginEdit(id)}
          onEndEdit={() => onEndEdit(id)}
        />
        {s.selectedBy?.userId && s.selectedBy.userId !== selfId && (
          <ShapeEditor
            shape={s as any}
            isSelected
            selectionColor={s.selectedBy.color}
            interactive={false}
            scale={scale}
            position={position}
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
          scale={scale}
          position={position}
          onChange={(next) => {
            onUpdateShape(id, next as any)
            const latest = { ...s, ...next, selectedBy: stateById[id]?.selectedBy }
            onWriterUpdate(latest as any)
          }}
          onCommit={() => {
            const latest = stateById[id]
            if (latest) {
              onWriterUpdateImmediate({ ...latest, selectedBy: stateById[id]?.selectedBy } as any)
            }
          }}
          onBeginEdit={() => onBeginEdit(id)}
          onEndEdit={() => onEndEdit(id)}
        />
        {s.selectedBy?.userId && s.selectedBy.userId !== selfId && (
          <ShapeEditor
            shape={s as any}
            isSelected
            selectionColor={s.selectedBy.color}
            interactive={false}
            scale={scale}
            position={position}
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
          onDragMove?.(nextX, nextY)
          onUpdateShape(id, { x: nextX, y: nextY })
          onWriterUpdate({ ...s, x: nextX, y: nextY, selectedBy: stateById[id]?.selectedBy })
        }}
        onDragEnd={(evt: DragEndEvent) => {
          const cX = evt.target.x?.() ?? tcx
          const cY = evt.target.y?.() ?? tcy
          const nextX = cX - tw / 2
          const nextY = cY + th / 2
          onUpdateShape(id, { x: nextX, y: nextY })
          onWriterUpdateImmediate({ ...s, x: nextX, y: nextY, selectedBy: stateById[id]?.selectedBy })
          onSetIsDraggingShape(false)
          onEndEdit(id)
          onDragEnd?.(nextX, nextY)
        }}
      />
      <ShapeEditor
        shape={s as any}
        isSelected={isSelected}
        selectionColor={colorFromId}
        scale={scale}
        position={position}
        onChange={(next) => {
          onUpdateShape(id, next as any)
          const latest = { ...s, ...next, selectedBy: stateById[id]?.selectedBy }
          onWriterUpdate(latest as any)
        }}
        onCommit={() => {
          const latest = stateById[id]
          if (latest) {
            onWriterUpdateImmediate({ ...latest, selectedBy: stateById[id]?.selectedBy } as any)
          }
        }}
        onBeginEdit={() => onBeginEdit(id)}
        onEndEdit={() => onEndEdit(id)}
      />
      {s.selectedBy?.userId && s.selectedBy.userId !== selfId && (
        <ShapeEditor
          shape={s as any}
          isSelected
          selectionColor={s.selectedBy.color}
          interactive={false}
          scale={scale}
          position={position}
          onChange={() => {}}
        />
      )}
    </Fragment>
  )
}, (prevProps, nextProps) => {
  // Only re-render if critical props change
  // This significantly reduces re-renders during pan/zoom
  return (
    prevProps.shape.id === nextProps.shape.id &&
    prevProps.shape.x === nextProps.shape.x &&
    prevProps.shape.y === nextProps.shape.y &&
    prevProps.shape.width === nextProps.shape.width &&
    prevProps.shape.height === nextProps.shape.height &&
    prevProps.shape.radius === nextProps.shape.radius &&
    prevProps.shape.fill === nextProps.shape.fill &&
    prevProps.shape.text === nextProps.shape.text &&
    prevProps.shape.fontSize === nextProps.shape.fontSize &&
    prevProps.shape.rotation === nextProps.shape.rotation &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.lockedByOther === nextProps.lockedByOther &&
    prevProps.scale === nextProps.scale &&
    prevProps.position.x === nextProps.position.x &&
    prevProps.position.y === nextProps.position.y &&
    prevProps.tool === nextProps.tool
  )
})

export default ShapeRenderer

