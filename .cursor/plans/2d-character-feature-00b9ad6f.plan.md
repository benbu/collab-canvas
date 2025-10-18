<!-- 00b9ad6f-63ad-43f1-b5a0-d2737b2d3663 5ea70976-e6d8-470f-998b-c71a9143c40b -->
# 2D Character Feature Implementation

## Overview

Add a fun interactive element: a physics-based 2D character that users can place on shapes and control with keyboard input. The character has realistic physics, can walk/run on shapes, jump, and dies when falling off the bottom.

## Implementation Steps

### 1. Add Character Tool to Toolbar

**File**: `src/components/Toolbar/Toolbar.tsx`

- Add `'character'` to the `Tool` type (line 4)
- Add character button to toolbar array (line 110)
- Use an icon like `User` from lucide-react
- Add keyboard shortcut hint (e.g., "Character (P)")

### 2. Create Character Types

**New file**: `src/hooks/useCharacterState.ts`

- Define `Character` type with:
  - `userId: string`
  - `x: number, y: number` (position)
  - `vx: number, vy: number` (velocity)
  - `onGround: boolean`
  - `color: string`
  - `name?: string`
  - `state: 'alive' | 'dead' | 'dying'`
  - `deathTimer?: number`

### 3. Create Physics Hook

**New file**: `src/hooks/useCharacterPhysics.ts`

- Constants:
  - `GRAVITY = 800` (pixels/s²)
  - `JUMP_FORCE = -400` (pixels/s)
  - `RUN_SPEED = 200` (pixels/s)
  - `ACCELERATION = 1200` (pixels/s²)
  - `AIR_CONTROL = 0.3` (movement control while airborne)
  - `FRICTION = 800` (pixels/s²)
- Implement collision detection with all shapes (rect, circle, text)
- Check if character is on ground (standing on any shape top surface)
- Apply gravity when not on ground
- Handle horizontal movement with acceleration/deceleration
- Handle jump mechanics (only when on ground)
- Detect death (y > canvas bottom + buffer, e.g., 500px below lowest visible point)
- Death state: set to 'dying', wait ~1 second, then remove

### 4. Create Character Sync Hook

**New file**: `src/hooks/useCharacterSync.ts`

- Follow pattern from `useCursorSync.ts`
- Subscribe to `rooms/{roomId}/characters` collection
- Write character state at ~30 FPS (every 33ms)
- Only sync character if state is 'alive' or 'dying'
- Delete character doc when dead or on unmount
- Return map of all characters by userId

### 5. Create Character Renderer

**New file**: `src/components/Canvas/CharacterRenderer.tsx`

- Render using Konva primitives:
  - Body: `<Rect>` 20x30px
  - Head: `<Circle>` radius 10px, positioned above body
  - Legs: Two `<Rect>` 6x15px each, positioned at bottom of body
  - Optional: animate leg positions based on vx for walking effect
- Use character's color for all parts
- Add slight opacity if character is 'dying' (e.g., 0.5)
- Group all parts in Konva `<Group>` for easy positioning

### 6. Handle Keyboard Input

**New file**: `src/hooks/useCharacterControl.ts`

- Track pressed keys: `ArrowLeft`, `ArrowRight`, `ArrowUp`, `Space`
- Return current input state: `{ left: boolean, right: boolean, jump: boolean }`
- Only track when character tool is active and user has a living character
- Clean up listeners on unmount

### 7. Integrate into Canvas Component

**File**: `src/components/Canvas/Canvas.tsx`

- Add character state management
- On tool='character' click: place character slightly above click point if no character exists
- Run physics loop using `requestAnimationFrame` for smooth 60 FPS
- Pass keyboard input to physics hook
- Render all characters from sync hook using `CharacterRenderer`
- Add characters layer between shapes and cursors
- Handle character death: allow new placement after death

### 8. Update Stage Events

**File**: `src/hooks/useStageEvents.ts`

- Add character tool case in `handleMouseDown`
- Place character at `canvasPoint.y - 50` (slightly above click)
- Check if user already has living character before creating new one

## Technical Details

### Collision Detection Algorithm

For each shape, check if character bottom intersects with shape:

- **Rect**: Check if character (x, y+height) overlaps rect top edge within threshold
- **Circle**: Use circle equation to check distance from center
- **Text**: Treat as simple rect based on text bounds
- Character is "on ground" if any collision detected within 5px threshold

### Physics Update Loop

```typescript
const delta = (timestamp - lastTimestamp) / 1000 // seconds
character.vy += GRAVITY * delta // apply gravity
// apply horizontal acceleration based on input
// check collisions and adjust position/velocity
// update character state
```

### Death Handling

- When `character.y > bottomThreshold`: set state to 'dying'
- Show character briefly (1 second) then delete from Firestore
- Clear local character state to allow new placement

## Files to Modify

- `src/components/Toolbar/Toolbar.tsx` - Add tool button
- `src/components/Canvas/Canvas.tsx` - Integrate character system
- `src/hooks/useStageEvents.ts` - Handle character placement

## New Files to Create

- `src/hooks/useCharacterState.ts` - Types and state management
- `src/hooks/useCharacterPhysics.ts` - Physics engine
- `src/hooks/useCharacterSync.ts` - Firestore sync
- `src/hooks/useCharacterControl.ts` - Keyboard input
- `src/components/Canvas/CharacterRenderer.tsx` - Visual rendering

### To-dos

- [ ] Add 'character' tool type and button to Toolbar component
- [ ] Create character types and state management hook
- [ ] Implement physics engine with gravity, collision detection, and movement
- [ ] Create Firestore sync hook for multi-user character state
- [ ] Implement keyboard input hook for character control
- [ ] Create character renderer component with body, legs, and head
- [ ] Integrate character system into Canvas component with physics loop
- [ ] Update stage events to handle character placement on click