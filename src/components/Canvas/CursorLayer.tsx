import { Layer, Line, Text } from 'react-konva'
import type { RemoteCursor } from '../../hooks/useCursorSync'

export default function CursorLayer(props: { cursors: RemoteCursor[] }) {
  const { cursors } = props
  return (
    <Layer listening={false}>
      {cursors.map((c) => (
        <>
          <Line
            key={`${c.id}-ptr`}
            points={[c.x, c.y, c.x - 8, c.y + 16, c.x + 8, c.y + 16]}
            closed
            fill={c.color}
            stroke={c.color}
          />
          <Text key={`${c.id}-label`} x={c.x + 10} y={c.y + 10} text={c.name ?? c.id.slice(0, 4)} fontSize={12} fill={c.color} />
        </>
      ))}
    </Layer>
  )
}


