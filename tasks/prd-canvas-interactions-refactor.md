# PRD: Canvas Interaction Refactor + Pan Tool

## Problem
Some interaction logic lives in `src/components/Canvas/Canvas.tsx` while other parts live in `src/hooks/useCanvasInteractions.ts`. This split causes subtle conflicts between selection, shape drag, and stage panning (grid moves when trying to drag a shape). The UX needs a clear separation of responsibilities and a dedicated pan mode.

## Objectives
- Centralize all canvas interaction logic in `useCanvasInteractions`.
- Introduce a dedicated Pan tool and keyboard affordance(s), eliminating accidental panning while selecting or dragging shapes.
- Ensure predictable, testable behavior for selection, multiselect, drag-select, shape drag, panning, and zooming.

## Non-Goals
- Resize/rotate handles, snapping, or alignment guides.
- Large visual redesign of toolbar.
- Changing Firestore sync behavior.

## Scope
- Move all event/interaction logic from `Canvas.tsx` into `useCanvasInteractions`.
- Add a Pan tool in the toolbar and include it in the `Tool` union type.
- Make `Stage` draggable only when pan mode is active (or when spacebar-hold is active, if included).
- Ensure shape drag never triggers stage pan; stage panning is disabled during any active shape drag.
- Preserve pinch-zoom behavior on touch devices and wheel-zoom on desktop (unchanged).

## UX/Behavior Details
- Tools: `pan`, `select`, `rect`, `circle`, `text`.
- Pan:
  - When active, `Stage` is draggable.
  - Drag anywhere (empty or over shapes) pans the stage; shape drag should not be initiated.
  - Optional: spacebar-hold temporarily activates pan (on keydown, deactivate on keyup).
- Select:
  - Clicking empty space clears selection.
  - Dragging from empty space draws a drag-selection box; shapes within are selected on mouseup.
  - Clicking a shape selects it; Shift+click toggles selection membership.
  - Dragging selected shape(s) moves them; stage must not pan.
- Shape creation:
  - In `rect/circle/text`, clicking creates the shape at the canvas point; no panning or selection rectangle.
- Zoom:
  - Wheel to zoom around pointer; pinch to zoom on touch. Unchanged.

## Technical Design
- Hook API (proposed):
  - `useCanvasInteractions(options)` returns:
    - `selectionRect`, `selectedIds`, setters and helpers (`selectOne`, `toggleSelect`, `clearSelection`, `setSelectedIds`).
    - `stageDraggable: boolean` (derived from tool and interaction state).
    - Stage handlers: `onStageMouseDown`, `onStageMouseMove`, `onStageMouseUp`, `onStageDragMove`.
    - Shape handlers: `onShapeMouseDown(id)`, `onShapeDragEnd(id, {x,y})`.
    - Optional keyboard helpers: `onKeyDown` for delete/duplicate and temporary pan via spacebar.
  - The hook owns flags for: `isPanning`, `isDraggingShape`, drag-select origin, thresholds, and tool-aware branching.
- `Canvas.tsx`:
  - Becomes a thin orchestrator: passes `tool`, reads `stageDraggable` from hook, wires handlers onto `Stage` and shapes, and calls canvas state writers.
- `Toolbar`:
  - Add a Pan button; update type `Tool` to include `'pan'` and keep active-state CSS consistent.

## Data & Types
- `Tool = 'pan' | 'select' | 'rect' | 'circle' | 'text'`.
- `InteractionState` (internal to hook):
  - `isPanning: boolean`, `isDraggingShape: boolean`.
  - `selectionRect: {x,y,w,h,active,originX,originY} | null`.
  - `lastPointer: {x,y} | null`.

## Accessibility
- Keyboard: Delete/Backspace to delete; Ctrl/Cmd+D to duplicate (existing). Optional: hold Space to pan.
- Focus states remain unchanged.

## Acceptance Criteria
- Attempting to drag a selected shape while in Select does not pan the stage.
- Pan tool enables stage drag anywhere; shape drag does not occur.
- Drag-select box appears only when dragging from empty space in Select; on mouseup, shapes inside are selected.
- Clicking empty stage clears selection; Shift+click toggles selection without clearing.
- Creating shapes in `rect/circle/text` does not pan the stage and works at the correct canvas coordinates.
- Pinch zoom and wheel zoom work as before.

## Testing Plan
- Unit tests for `useCanvasInteractions` state transitions:
  - Pan vs Select: `stageDraggable` derivation.
  - Shape drag sets `isDraggingShape` and prevents stage pan.
  - Drag-select path sets and clears `selectionRect` appropriately.
- Integration tests on `Canvas`:
  - In Select, dragging a selected shape updates its position, not the stage.
  - In Pan, dragging changes stage position, not shape(s).
  - Drag-select selects expected shapes; click-empty clears.
  - Optional: spacebar-hold toggles pan on/off.

## Risks & Mitigations
- Konva propagation nuances: Ensure event ordering and `draggable` toggling are correct; stop propagation only where necessary to avoid breaking selection.
- Regression in existing shortcuts: Keep keyboard handling within the hook and cover with tests.

## Rollout & Migration
- Single PR guarded by tests. No feature flag.
- Remove interaction logic from `Canvas.tsx` once hook usage is wired.

## Definition of Done
- All acceptance criteria pass manually.
- All new and existing tests pass in CI.
- Toolbar shows a Pan tool with active highlight.
- No unintended panning while moving shapes in Select mode.

## Relevant Files
- `src/hooks/useCanvasInteractions.ts`
- `src/components/Canvas/Canvas.tsx`
- `src/components/Toolbar/Toolbar.tsx`
- `src/components/Canvas/__tests__/Interactions.test.tsx`
- `src/components/Canvas/__tests__/Canvas.test.tsx`
