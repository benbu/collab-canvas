<!-- ac63f0f9-52dd-42a2-a43e-3b81ffa301af 5ea70cd3-34bd-419c-a2f5-4315b6fbc31c -->
# Dynamic Cursor Implementation Plan

## Overview

Add context-aware cursor changes throughout the canvas to provide visual feedback based on the active tool and hover target.

## Implementation Steps

### 1. CSS Cursor Classes (`Canvas.css`)

Add new CSS classes for all cursor states:

- `.cursor-hand` - grab/move cursor for select mode on shapes
- `.cursor-pan` - grab cursor for pan mode
- `.cursor-text` - text/I-beam cursor for text mode
- `.cursor-crosshair` - crosshair for rect/circle modes
- `.cursor-nwse-resize` - diagonal resize (↖↘)
- `.cursor-nesw-resize` - diagonal resize (↗↙)
- `.cursor-grab` - rotate handle cursor

### 2. Hover State Management (`Canvas.tsx`)

Track what the user is hovering over:

- Add state: `hoveredShapeId` to track shape hovers
- Add state: `hoveredHandle` to track handle hovers ('resize-nw', 'resize-se', 'rotate', etc.)
- Pass hover handlers to ShapeRenderer and ShapeEditor

### 3. Stage Container Cursor (`Canvas.tsx`)

Apply dynamic cursor class to the Stage container based on:

- **Select mode + hovering shape**: hand cursor
- **Select mode + not hovering**: default
- **Pan mode + hovering grid**: hand cursor  
- **Pan mode + hovering shape**: pointer (to indicate not draggable in pan mode)
- **Text mode**: text cursor
- **Rectangle mode**: crosshair
- **Circle mode**: crosshair
- **Character mode**: crosshair

### 4. Shape Hover Detection (`ShapeRenderer.tsx`)

Add to each shape (Rect, Circle, Text):

- `onMouseEnter`: Call parent handler with shape ID
- `onMouseLeave`: Call parent handler to clear hover
- Ensure hover detection only active when tool === 'select'

### 5. Editor Handle Cursors (`ShapeEditor.tsx`)

Add cursor styles to editor handles:

- **NW corner**: `nwse-resize`
- **NE corner**: `nesw-resize`  
- **SW corner**: `nesw-resize`
- **SE corner**: `nwse-resize`
- **Rotate handle**: `grab` or custom rotate icon

Apply via `cursor` prop on Konva shapes or via CSS class on container.

## Files to Modify

1. `src/components/Canvas/Canvas.css` - Add cursor CSS classes
2. `src/components/Canvas/Canvas.tsx` - Manage hover state, apply cursor to Stage
3. `src/components/Canvas/ShapeRenderer.tsx` - Add shape hover handlers
4. `src/components/Canvas/ShapeEditor.tsx` - Add cursor styles to handles

## Technical Considerations

- Use CSS cursor classes instead of inline styles for better performance
- Konva shapes support `onMouseEnter`/`onMouseLeave` events
- Stage container div can have CSS classes applied dynamically
- Ensure cursor changes don't interfere with drag operations
- Handle cursor state cleanup when tool changes

### To-dos

- [ ] Add CSS cursor classes to Canvas.css
- [ ] Add hover state management in Canvas.tsx
- [ ] Apply dynamic cursor classes to Stage container in Canvas.tsx
- [ ] Add hover handlers to shapes in ShapeRenderer.tsx
- [ ] Add cursor styles to editor handles in ShapeEditor.tsx