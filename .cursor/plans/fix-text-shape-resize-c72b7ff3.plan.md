<!-- c72b7ff3-7fbd-449d-9ddd-f2b49a07ce92 5f84cb7d-728b-42cd-8503-bde0ad5e2053 -->
# Fix Text Shape Resize with Rotation

## Problem

Text shape corner handles fail when the shape is rotated because the resize logic incorrectly transforms local (rotated) coordinates to world coordinates by manually adding offsets, which doesn't account for the rotation transformation.

## Solution

Use the Stage's pointer position (world coordinates) directly, similar to how the rotation handle works. Then calculate the new bounds in world space relative to the shape's anchor point.

## Implementation

### Update `src/components/Canvas/ShapeEditor.tsx`

**Lines 49-72: Replace the `onCornerDrag` function**

Current approach (broken for rotated shapes):

```typescript
onDragMove={(e) => onCornerDrag('nw', e.target.x() + half + x, e.target.y() + half + y)}
```

This adds local coordinates to bounding box position, which fails with rotation.

New approach:

1. Get the Stage pointer position (world coordinates)
2. Calculate new bounds based on which corner is being dragged
3. Update shape properties from the new bounds

Key changes:

- Store the initial shape center and dimensions at drag start
- Use `groupRef.current.getStage()?.getPointerPosition()` to get world coordinates
- Calculate new dimensions relative to the opposite corner (as anchor point)
- For text shapes, update `fontSize` proportionally to height change while keeping the shape centered

**Lines 87-90: Update corner handle `onDragMove` handlers**

Remove the manual coordinate calculation, pass only the corner identifier:

```typescript
onDragMove={(e) => onCornerDrag('nw')}
```

The function will get coordinates from the stage directly.

## Testing

- Create text shapes and resize them → should work smoothly
- Rotate text shapes 45°, 90°, etc. → resize should maintain proper proportions
- Compare with rectangle resize behavior → should work identically

### To-dos

- [ ] Rewrite onCornerDrag to use stage pointer position instead of local handle coordinates
- [ ] Update all four corner handle onDragMove callbacks to pass only corner identifier