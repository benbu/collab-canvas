<!-- c5d97321-dc12-4cd6-8af3-4f3807bce6af 1c1b07c8-e7f6-4b6e-9145-a58acec38c11 -->
# Arrow Key Panning

## Overview

Add arrow key support to pan the canvas grid in all tool modes (unless typing in input fields), moving 50 pixels per press (150 pixels with Shift held).

## Implementation

### Update Canvas Component

**File:** `src/components/Canvas/Canvas.tsx`

Add a new keyboard event handler after the existing keyboard handlers (around line 180-366).

1. **Add arrow key handler useEffect** (after line 366):

- Listen for `keydown` events on window
- Check if user is typing in input/textarea/contentEditable (same pattern as existing handlers)
- Detect arrow keys: `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`
- Calculate pan distance: 50px normal, 150px with Shift (3x multiplier)
- Update `position` state based on arrow direction
- Call `setPosition()` to update the canvas position
- Also update the stage ref position directly for immediate feedback

2. **Pan direction mapping**:

- ArrowUp: increase y position by pan distance
- ArrowDown: decrease y position by pan distance  
- ArrowLeft: increase x position by pan distance
- ArrowRight: decrease x position by pan distance

(Note: The coordinate system is inverted - positive movement moves content down/right, which pans viewport up/left)

3. **Event handling**:

- Prevent default behavior for arrow keys to avoid page scrolling
- Clean up event listener on unmount

## Key Code Locations

- Existing keyboard handlers: lines 164-180, 333-366
- Position state: line 57
- Stage ref: line 58