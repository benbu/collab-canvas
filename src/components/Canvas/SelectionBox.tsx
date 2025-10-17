import { Rect } from 'react-konva'

export default function SelectionBox(props: { x: number; y: number; w: number; h: number; color?: string }) {
  const { x, y, w, h, color } = props
  return (
    <Rect
      data-testid="selection-box"
      x={x}
      y={y}
      width={w}
      height={h}
      stroke={color ?? '#1976d2'}
      dash={[4, 4]}
      listening={false}
    />
  )
}


