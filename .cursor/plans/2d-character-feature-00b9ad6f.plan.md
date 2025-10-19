<!-- 00b9ad6f-63ad-43f1-b5a0-d2737b2d3663 08d3b6ec-a47d-47bf-a008-b1a449009219 -->
# Character Camera Improvements

## Overview

Improve the character feature with better camera controls: arrow keys only pan when pan tool is selected, auto-pan when character approaches screen edges, and ensure physics only runs locally.

## Changes Required

### 1. Fix Arrow Key Panning

**File**: `src/hooks/useKeyboardShortcuts.ts` (lines 124-170)

Current issue: Arrow keys always pan, conflicting with character controls.

Solution:

- Add `activeTool` parameter to `KeyboardShortcutsParams` interface
- Add `hasLocalCharacter` parameter to know if user has a living character
- Modify arrow key handler to only pan when:
  - `activeTool === 'pan'` OR
  - `(activeTool !== 'character' && !hasLocalCharacter)`
- This allows arrow key panning except when character tool is active or user has a character

### 2. Add Auto-Panning for Character

**File**: `src/components/Canvas/Canvas.tsx`

Add new effect to auto-pan camera when character approaches screen edges:

- Monitor `localCharacter` position in relation to viewport
- Calculate character position in screen coordinates
- If character is within 100px of any screen edge:
  - Pan camera smoothly toward character
  - Use smooth interpolation for natural camera movement
- Implementation:
  ```typescript
  useEffect(() => {
    if (!localCharacter || localCharacter.state !== 'alive') return
    
    const checkAndPan = () => {
      const charScreenX = localCharacter.x * scale + position.x
      const charScreenY = localCharacter.y * scale + position.y
      const margin = 100
      
      let needsPan = false
      let deltaX = 0
      let deltaY = 0
      
      if (charScreenX < margin) {
        deltaX = (margin - charScreenX) * 0.1
        needsPan = true
      } else if (charScreenX > width - margin) {
        deltaX = (width - margin - charScreenX) * 0.1
        needsPan = true
      }
      
      if (charScreenY < margin) {
        deltaY = (margin - charScreenY) * 0.1
        needsPan = true
      } else if (charScreenY > height - margin) {
        deltaY = (height - margin - charScreenY) * 0.1
        needsPan = true
      }
      
      if (needsPan) {
        setPosition(prev => ({
          x: prev.x + deltaX,
          y: prev.y + deltaY
        }))
      }
    }
    
    const intervalId = setInterval(checkAndPan, 16) // ~60fps
    return () => clearInterval(intervalId)
  }, [localCharacter, position, scale, width, height])
  ```


### 3. Verify Physics Only Runs Locally

**File**: `src/components/Canvas/Canvas.tsx` (lines 236-284)

Current implementation: Physics loop only runs for `localCharacter`, which is correct.

Verification needed:

- Remote characters come from `characterSync.characters` (line 736)
- These are rendered but NOT passed through physics loop
- ✅ Already correct - no changes needed

Remote characters are purely visual representations synced from Firestore, each user calculates their own character's physics.

### 4. Update Canvas Integration

**File**: `src/components/Canvas/Canvas.tsx`

Pass necessary props to keyboard shortcuts:

- Add `activeTool: tool` to `useKeyboardShortcuts` call
- Add `hasLocalCharacter: localCharacter !== null && localCharacter.state === 'alive'`

## Implementation Summary

### Files to Modify

1. `src/hooks/useKeyboardShortcuts.ts` - Conditional arrow key panning
2. `src/components/Canvas/Canvas.tsx` - Auto-panning effect + pass tool to keyboard shortcuts

### Expected Behavior After Changes

1. ✅ Arrow keys only pan when pan tool is selected (unless no character exists)
2. ✅ Camera automatically follows character when near edges
3. ✅ Remote characters display correctly (already working)
4. ✅ Physics only calculated for local character (already correct)

### To-dos

- [ ] Make arrow key panning conditional on pan tool being selected
- [ ] Add auto-panning when character approaches screen edges
- [ ] Verify physics only runs for local character