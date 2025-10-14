# PRD: Presence via Cursor Activity

## Introduction/Overview
Replace the presence heartbeat with presence derived from cursor activity. Display active users (recent cursor movement) in a top-right list that stays above the canvas.

## Goals
- Show a real-time list of active users without additional presence writes.
- Reduce Firestore writes by leveraging existing cursor updates.

## User Stories
- As a collaborator, I see who is currently active in my room so I can coordinate work in real-time.

## Functional Requirements
1. Presence derives from `/rooms/{roomId}/cursors/{userId}` entries already maintained by cursor sync.
2. Display each active user’s name in the top-right overlay.
3. Use a staleness cutoff of 15 seconds.
4. Show the current user in the list (self-visible).
5. Limit to a maximum of 10 visible names; if more, show `+N more` suffix.
6. Fallback to short `userId` when `name` is missing.
7. One entry per `userId` (no duplicates).

## Non-Goals (Out of Scope)
- No additional presence writes/heartbeats.
- No avatars; names only.

## Design Considerations
- UI: simple right-aligned pill list above canvas (`z-index` above Konva container).
- Sorting: most recently active first; ties by display name.

## Technical Considerations
- Source data: reuse `useCursorSync` data; extend/derive a 15s cutoff list including self.
- Files:
  - Create `src/components/Presence/PresenceList.tsx`.
  - Update `src/components/Canvas/Canvas.tsx` to mount `PresenceList` and remove `PresenceIndicator` (keep file & hook in repo, unused).
  - Tests: `src/components/Presence/__tests__/PresenceList.test.tsx`.

## Success Metrics
- Presence list updates within the same latency as cursor rendering.
- No additional Firestore write volume compared to baseline.

## Open Questions
- None (decisions provided by user).
