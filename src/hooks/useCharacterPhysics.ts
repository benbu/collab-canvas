import type { Character, CharacterInput } from './useCharacterState'
import type { Shape } from './useCanvasState'

// Physics constants
const GRAVITY = 800 // pixels/s²
const JUMP_FORCE = -400 // pixels/s (negative is up)
const RUN_SPEED = 200 // pixels/s
const ACCELERATION = 1200 // pixels/s²
const AIR_CONTROL = 0.3 // movement control while airborne
const FRICTION = 800 // pixels/s²
const GROUND_THRESHOLD = 5 // pixels

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
): CollisionResult {
  const charBottom = char.y + CHARACTER_HEIGHT
  const charLeft = char.x
  const charRight = char.x + CHARACTER_WIDTH

  const rectWidth = shape.width ?? 0
  
  // For rotated rects, use simple AABB collision (good enough for MVP)
  const rectLeft = shape.x
  const rectRight = shape.x + rectWidth
  const rectTop = shape.y

  // Check horizontal overlap
  const horizontalOverlap = charRight > rectLeft && charLeft < rectRight

  if (!horizontalOverlap) {
    return { onGround: false }
  }

  // Check if character is standing on top of rect
  const distanceToTop = Math.abs(charBottom - rectTop)
  if (distanceToTop <= GROUND_THRESHOLD && char.vy >= 0) {
    return { onGround: true, groundY: rectTop - CHARACTER_HEIGHT }
  }

  return { onGround: false }
}

function checkCollisionWithCircle(
  char: Character,
  shape: Shape,
): CollisionResult {
  const charBottom = char.y + CHARACTER_HEIGHT
  const charCenterX = char.x + CHARACTER_WIDTH / 2

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

    const distanceToTop = Math.abs(charBottom - topY)
    if (distanceToTop <= GROUND_THRESHOLD && char.vy >= 0) {
      return { onGround: true, groundY: topY - CHARACTER_HEIGHT }
    }
  }

  return { onGround: false }
}

function checkCollisionWithText(
  char: Character,
  shape: Shape,
): CollisionResult {
  // Approximate text as a simple rect
  const charBottom = char.y + CHARACTER_HEIGHT
  const charLeft = char.x
  const charRight = char.x + CHARACTER_WIDTH

  const fontSize = shape.fontSize ?? 18
  const approxCharWidth = Math.max(5, Math.round(fontSize * 0.6))
  const textWidth = Math.max(10, (shape.text?.length ?? 1) * approxCharWidth)
  const textHeight = fontSize

  const textLeft = shape.x
  const textRight = shape.x + textWidth
  const textTop = shape.y - textHeight

  // Check horizontal overlap
  const horizontalOverlap = charRight > textLeft && charLeft < textRight

  if (!horizontalOverlap) {
    return { onGround: false }
  }

  // Check if character is standing on top of text
  const distanceToTop = Math.abs(charBottom - textTop)
  if (distanceToTop <= GROUND_THRESHOLD && char.vy >= 0) {
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
  const char = { ...character }

  // Handle dying state
  if (char.state === 'dying') {
    const timer = (char.deathTimer ?? 0) + deltaTime
    if (timer >= 1.0) {
      // After 1 second, mark as dead
      return { ...char, state: 'dead', deathTimer: timer }
    }
    return { ...char, deathTimer: timer }
  }

  if (char.state === 'dead') {
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

  // Update position
  char.x += char.vx * deltaTime
  char.y += char.vy * deltaTime

  // Check collisions with all shapes
  let collision: CollisionResult = { onGround: false }
  for (const shape of shapes) {
    let result: CollisionResult = { onGround: false }

    if (shape.type === 'rect') {
      result = checkCollisionWithRect(char, shape)
    } else if (shape.type === 'circle') {
      result = checkCollisionWithCircle(char, shape)
    } else if (shape.type === 'text') {
      result = checkCollisionWithText(char, shape)
    }

    if (result.onGround && result.groundY !== undefined) {
      // Use the highest ground surface
      if (!collision.onGround || (result.groundY < (collision.groundY ?? Infinity))) {
        collision = result
      }
    }
  }

  // Apply collision result
  if (collision.onGround && collision.groundY !== undefined) {
    char.y = collision.groundY
    char.vy = 0
    char.onGround = true
  } else {
    char.onGround = false
  }

  // Check if character fell off the bottom
  if (char.y > deathThreshold) {
    char.state = 'dying'
    char.deathTimer = 0
  }

  return char
}

