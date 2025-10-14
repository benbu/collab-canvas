# System Patterns

## Architecture
- React + Vite front-end
- Konva via react-konva for canvas rendering
- Firebase (Auth + Firestore) for auth, realtime sync, presence, persistence

## Key decisions
- React 18 for compatibility with react-konva
- Type-only imports where needed to avoid runtime export errors
- Mock react-konva in tests; inline deps in Vitest config
- Last-write-wins for shape sync; debounced writes during drag/transform
- Snapshot + hydration before live subscription

## Component relationships
- Canvas orchestrates Stage/Layers, tools, selection, and sync hooks
- Toolbar controls active tool/color/text
- CursorLayer and PresenceIndicator render realtime awareness

## Error handling
- Minimal; surface via console/logs in MVP; CI enforces build/tests
