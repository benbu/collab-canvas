import { Group, Rect, Circle } from 'react-konva'
import type { Character } from '../../hooks/useCharacterState'
import { CHARACTER_WIDTH, CHARACTER_HEIGHT, CHARACTER_HEAD_RADIUS } from '../../hooks/useCharacterPhysics'

interface CharacterRendererProps {
  character: Character
}

export default function CharacterRenderer({ character }: CharacterRendererProps) {
  const { x, y, color, state, vx } = character

  // Calculate opacity based on state
  const opacity = state === 'dying' ? 0.5 : 1.0

  // Simple leg animation based on velocity
  const legOffset = Math.abs(vx) > 10 ? Math.sin(Date.now() / 100) * 3 : 0

  // Body dimensions
  const bodyWidth = CHARACTER_WIDTH
  const bodyHeight = CHARACTER_HEIGHT
  const headRadius = CHARACTER_HEAD_RADIUS
  const legWidth = 6
  const legHeight = 15

  // Positions
  const bodyX = x
  const bodyY = y
  const headX = x + bodyWidth / 2
  const headY = y - headRadius
  const leftLegX = x + bodyWidth / 2 - legWidth - 2
  const rightLegX = x + bodyWidth / 2 + 2
  const legY = y + bodyHeight - legHeight

  return (
    <Group opacity={opacity}>
      {/* Body */}
      <Rect
        x={bodyX}
        y={bodyY}
        width={bodyWidth}
        height={bodyHeight}
        fill={color}
        listening={false}
      />

      {/* Head */}
      <Circle
        x={headX}
        y={headY}
        radius={headRadius}
        fill={color}
        listening={false}
      />

      {/* Left Leg */}
      <Rect
        x={leftLegX}
        y={legY + legOffset}
        width={legWidth}
        height={legHeight}
        fill={color}
        listening={false}
      />

      {/* Right Leg */}
      <Rect
        x={rightLegX}
        y={legY - legOffset}
        width={legWidth}
        height={legHeight}
        fill={color}
        listening={false}
      />
    </Group>
  )
}

