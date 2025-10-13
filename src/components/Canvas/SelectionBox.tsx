import { Rect } from 'react-konva'

export default function SelectionBox(props: { x: number; y: number; w: number; h: number }) {
  const { x, y, w, h } = props
  return (
    <Rect
      data-testid="selection-box"
      x={x}
      y={y}
      width={w}
      height={h}
      stroke="#1976d2"
      dash={[4, 4]}
      listening={false}
    />
  )
}


