import type { Character, CharacterInput } from './useCharacterState'
import type { Shape } from './useCanvasState'
import { markStart, markEnd } from '../utils/performance'

// Physics constants
const GRAVITY = 800 // pixels/s²
const JUMP_FORCE = -400 // pixels/s (negative is up)
const RUN_SPEED = 200 // pixels/s
const ACCELERATION = 1200 // pixels/s²
const AIR_CONTROL = 0.3 // movement control while airborne
const FRICTION = 800 // pixels/s²

// Character dimensions
export const CHARACTER_WIDTH = 20
export const CHARACTER_HEIGHT = 30
export const CHARACTER_HEAD_RADIUS = 10

interface CollisionResult {
  onGround: boolean
  groundY?: number
}

function checkCollisionWithRect(
  char: Character,
  shape: Shape,
  deltaTime: number,
): CollisionResult {
  const charBottom = char.y + CHARACTER_HEIGHT
  const newCharBottom = charBottom + char.vy * deltaTime
  
  // Check horizontal overlap (using projected position)
  const charLeft = char.x + char.vx * deltaTime
  const charRight = charLeft + CHARACTER_WIDTH
  const rectLeft = shape.x
  const rectRight = shape.x + (shape.width ?? 0)
  
  if (charRight <= rectLeft || charLeft >= rectRight) {
    return { onGround: false }
  }
  
  // Check if character is/will be colliding with top surface
  const rectTop = shape.y
  const rectBottom = shape.y + (shape.height ?? 0)
  
  // If moving down and would cross through the top surface
  if (char.vy > 0 && charBottom <= rectTop && newCharBottom >= rectTop) {
    return { onGround: true, groundY: rectTop - CHARACTER_HEIGHT }
  }
  
  // If already inside/overlapping (penetration resolution)
  if (charBottom > rectTop && char.y < rectBottom) {
    return { onGround: true, groundY: rectTop - CHARACTER_HEIGHT }
  }
  
  return { onGround: false }
}

function checkCollisionWithCircle(
  char: Character,
  shape: Shape,
  deltaTime: number,
): CollisionResult {
  const charBottom = char.y + CHARACTER_HEIGHT
  const newCharBottom = charBottom + char.vy * deltaTime
  const charCenterX = char.x + CHARACTER_WIDTH / 2 + char.vx * deltaTime

  const circleX = shape.x
  const circleY = shape.y
  const radius = shape.radius ?? 0

  // Check if character is near the top of the circle
  const dx = charCenterX - circleX
  const distFromCenter = Math.sqrt(dx * dx)

  // If character is horizontally within the circle's range
  if (distFromCenter <= radius) {
    // Calculate the top Y position of the circle at this X position
    const angleFromCenter = Math.acos(Math.min(1, distFromCenter / radius))
    const topY = circleY - radius * Math.sin(angleFromCenter)

    // If moving down and would cross through the top surface
    if (char.vy > 0 && charBottom <= topY && newCharBottom >= topY) {
      return { onGround: true, groundY: topY - CHARACTER_HEIGHT }
    }

    // If already inside/overlapping (penetration resolution)
    if (charBottom > topY && char.y < circleY) {
      return { onGround: true, groundY: topY - CHARACTER_HEIGHT }
    }
  }

  return { onGround: false }
}

function checkCollisionWithText(
  char: Character,
  shape: Shape,
  deltaTime: number,
): CollisionResult {
  // Approximate text as a simple rect
  const charBottom = char.y + CHARACTER_HEIGHT
  const newCharBottom = charBottom + char.vy * deltaTime
  const charLeft = char.x + char.vx * deltaTime
  const charRight = charLeft + CHARACTER_WIDTH

  const fontSize = shape.fontSize ?? 18
  const approxCharWidth = Math.max(5, Math.round(fontSize * 0.6))
  const textWidth = Math.max(10, (shape.text?.length ?? 1) * approxCharWidth)
  const textHeight = fontSize

  const textLeft = shape.x
  const textRight = shape.x + textWidth
  const textTop = shape.y - textHeight
  const textBottom = shape.y

  // Check horizontal overlap
  const horizontalOverlap = charRight > textLeft && charLeft < textRight

  if (!horizontalOverlap) {
    return { onGround: false }
  }

  // If moving down and would cross through the top surface
  if (char.vy > 0 && charBottom <= textTop && newCharBottom >= textTop) {
    return { onGround: true, groundY: textTop - CHARACTER_HEIGHT }
  }

  // If already inside/overlapping (penetration resolution)
  if (charBottom > textTop && char.y < textBottom) {
    return { onGround: true, groundY: textTop - CHARACTER_HEIGHT }
  }

  return { onGround: false }
}

export function updateCharacterPhysics(
  character: Character,
  input: CharacterInput,
  shapes: Shape[],
  deltaTime: number,
  deathThreshold: number,
): Character {
  markStart('char-physics')
  const char = { ...character }

  // Handle dying state
  if (char.state === 'dying') {
    const timer = (char.deathTimer ?? 0) + deltaTime
    if (timer >= 1.0) {
      // After 1 second, mark as dead
      markEnd('char-physics', 'character-physics', 'dying')
      return { ...char, state: 'dead', deathTimer: timer }
    }
    markEnd('char-physics', 'character-physics', 'dying')
    return { ...char, deathTimer: timer }
  }

  if (char.state === 'dead') {
    markEnd('char-physics', 'character-physics', 'dead')
    return char
  }

  // Apply gravity
  char.vy += GRAVITY * deltaTime

  // Handle horizontal movement
  const targetVx = input.left ? -RUN_SPEED : input.right ? RUN_SPEED : 0
  const acceleration = char.onGround ? ACCELERATION : ACCELERATION * AIR_CONTROL

  if (targetVx !== 0) {
    // Accelerate towards target velocity
    if (Math.abs(char.vx - targetVx) < acceleration * deltaTime) {
      char.vx = targetVx
    } else {
      char.vx += Math.sign(targetVx - char.vx) * acceleration * deltaTime
    }
  } else if (char.onGround) {
    // Apply friction when no input and on ground
    if (Math.abs(char.vx) < FRICTION * deltaTime) {
      char.vx = 0
    } else {
      char.vx -= Math.sign(char.vx) * FRICTION * deltaTime
    }
  }

  // Handle jumping
  if (input.jump && char.onGround) {
    char.vy = JUMP_FORCE
    char.onGround = false
  }

  // Check collisions with all shapes BEFORE updating position
  markStart('char-physics-collision')
  let collision: CollisionResult = { onGround: false }
  for (const shape of shapes) {
    let result: CollisionResult = { onGround: false }

    if (shape.type === 'rect') {
      result = checkCollisionWithRect(char, shape, deltaTime)
    } else if (shape.type === 'circle') {
      result = checkCollisionWithCircle(char, shape, deltaTime)
    } else if (shape.type === 'text') {
      result = checkCollisionWithText(char, shape, deltaTime)
    }

    if (result.onGround && result.groundY !== undefined) {
      // Use the highest ground surface
      if (!collision.onGround || (result.groundY < (collision.groundY ?? Infinity))) {
        collision = result
      }
    }
  }
  markEnd('char-physics-collision', 'character-physics', `collision-${shapes.length}-shapes`)

  // Apply collision result and update position
  if (collision.onGround && collision.groundY !== undefined) {
    // Stop at surface instead of passing through
    char.y = collision.groundY
    char.vy = 0
    char.onGround = true
  } else {
    // No collision, apply movement
    char.y += char.vy * deltaTime
    char.onGround = false
  }

  // Update horizontal position
  char.x += char.vx * deltaTime

  // Check if character fell off the bottom
  if (char.y > deathThreshold) {
    char.state = 'dying'
    char.deathTimer = 0
  }

  markEnd('char-physics', 'character-physics', 'update')
  return char
}

