import React, { memo } from 'react'
import { Layer, Line, Text, Group } from 'react-konva'
import type { RemoteCursor } from '../../hooks/usePresenceSync'

// Memoized cursor component to prevent unnecessary re-renders
const Cursor = memo(({ cursor }: { cursor: RemoteCursor }) => {
  return (
    <Group>
      <Line
        points={[cursor.x, cursor.y, cursor.x - 8, cursor.y + 16, cursor.x + 8, cursor.y + 16]}
        closed
        fill={cursor.color}
        stroke={cursor.color}
      />
      <Text 
        x={cursor.x + 10} 
        y={cursor.y + 10} 
        text={cursor.name ?? cursor.id.slice(0, 4)} 
        fontSize={12} 
        fill={cursor.color} 
      />
    </Group>
  )
}, (prevProps, nextProps) => {
  // Only re-render if position changed significantly (>2px) or other props changed
  const prev = prevProps.cursor
  const next = nextProps.cursor
  return (
    prev.id === next.id &&
    Math.abs(prev.x - next.x) < 2 &&
    Math.abs(prev.y - next.y) < 2 &&
    prev.color === next.color &&
    prev.name === next.name
  )
})

export default function CursorLayer(props: { cursors: RemoteCursor[] }) {
  const { cursors } = props
  return (
    <Layer listening={false}>
      {cursors.map((c) => (
        <Cursor key={c.id} cursor={c} />
      ))}
    </Layer>
  )
}


