# Project Brief

Collab Canvas is a collaborative whiteboard MVP built with React + Konva, providing real-time multi-user shape editing (rect/circle/text), pan/zoom, cursor presence, and Firestore-backed persistence.

## Core Goals
- Enable creating/manipulating basic shapes on a pan/zoom canvas
- Real-time sync of shapes, cursors, and presence per room
- Anonymous auth with user-provided display name
- Refresh-safe state via periodic snapshots and hydration
- CI + production deploy to Vercel with Firebase backend

## Scope
- MVP features mapped across PRs #1–#12 (completed)
- Unit/integration tests via Vitest + Testing Library (react-konva mocked)
- Coherent UX polish (loader, tooltips, deterministic colors, touch basics)

## Non-Goals (MVP)
- Freehand drawing/advanced tools
- Complex permissions/membership
- Rich text and advanced transforms beyond basics
