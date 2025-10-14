# Progress

## What works
- Pan/zoom canvas with grid
- Shape creation (rect/circle/text), selection, move, duplicate/delete
- Realtime Firestore sync (create/update/delete)
- Cursors and presence with labels
- Persistence via snapshots + hydration
- Auth (anonymous) + display name
- Tests (unit/integration) passing; prod build succeeds

## What’s left
- Optional perf/UX improvements (code split, FPS validation in prod)
- Harden Firestore rules post-MVP

## Current status
- Complete through PR #12; deployed artifacts configured

## Known issues
- None blocking; touch interactions are basic (by design for MVP)
