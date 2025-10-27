<!-- f146ed3a-efa3-4b06-9a71-05919c676995 d7411acc-92fb-4853-87ee-421fcb870b61 -->
# Migrate from Firestore to Firebase Realtime Database

## Scope and Assumptions

- Cutover with no historical migration (new RTDB data only).
- Replace Firestore usage across sync hooks/services with RTDB.
- Keep Auth as-is. Remove Firestore rules usage; add RTDB rules.

## Presence & Cursor Cleanup Semantics (RTDB)

- Use RTDB `onDisconnect` to server‑side remove ephemeral presence paths when a client disconnects (tab close, network loss, crash). This provides stronger cleanup guarantees than app‑driven TTL.
- Implementation details:
  - Write own presence at `rooms/{roomId}/presence/{selfId}` with `{ updatedAt: serverTimestamp(), ... }` and call `onDisconnect(ref).remove()`.
  - Same for cursors and characters under `rooms/{roomId}/cursors/{selfId}` and `rooms/{roomId}/characters/{selfId}`.
  - Optionally subscribe to `/.info/connected` and re‑register `onDisconnect` on reconnection.
  - UI also filters out stale entries by `updatedAt` to avoid flicker during brief reconnects.

Minimal example (concise):

```ts
// presence write + cleanup
import { getDatabase, ref, set, onDisconnect, serverTimestamp } from 'firebase/database'
const rtdb = getDatabase(app)
const presenceRef = ref(rtdb, `rooms/${roomId}/presence/${selfId}`)
await set(presenceRef, { ...payload, updatedAt: serverTimestamp() })
onDisconnect(presenceRef).remove()
```

## High‑Level Changes

- Initialize and export RTDB in `src/services/firebase.ts` (add `databaseURL` env).
- Replace Firestore APIs in these files with RTDB equivalents:
  - `src/hooks/useFirestoreSync.ts` → RTDB shapes sync (read via `onChild*` or `onValue`, write via `update/set/remove`).
  - `src/hooks/usePersistence.ts` → snapshot under `rooms/{roomId}/meta/snapshot`.
  - `src/hooks/usePresence.ts`, `src/hooks/usePresenceSync.ts`, `src/hooks/useCursorSync.ts`, `src/hooks/useCharacterSync.ts` → RTDB + `onDisconnect` cleanup.
  - `src/services/usernames.ts` → RTDB `runTransaction` for unique claim; profiles under `userProfiles/{uid}`.
  - `src/contexts/AuthContext.tsx` → RTDB `get(ref)` for profile hydrate.
- Add `database.rules.json` and update `firebase.json` to deploy RTDB rules.
- Update `.env.example` and README for `VITE_FIREBASE_DATABASE_URL`.
- Update tests and any Firestore‑specific mocks to RTDB.

## Data Model (RTDB)

- `rooms/{roomId}/shapes/{shapeId}`: `{ type, x, y, width, height, radius, fill, text, fontSize, fontFamily, rotation, zIndex, selectedBy }`
- `rooms/{roomId}/meta/snapshot`: `{ shapesById, allIds, updatedAt }`
- `rooms/{roomId}/presence/{userId}`: `{ cursor, character, color, name, updatedAt }`
- `rooms/{roomId}/cursors/{userId}`: `{ x, y, color, name, updatedAt }`
- `rooms/{roomId}/characters/{userId}`: `{ x, y, vx, vy, onGround, color, name, state, deathTimer }`
- `usernames/{username}`: `{ uid, claimedAt }` with transaction to ensure uniqueness
- `userProfiles/{uid}`: `{ name, color, createdAt }`

## Essential Snippets

- Initialization in `src/services/firebase.ts`:
```ts
import { getDatabase, type Database } from 'firebase/database'
const config = { /* existing */ databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL }
let rtdb: Database | null = null
if (isFirebaseEnabled) { rtdb = getDatabase(app) }
export { rtdb }
```

- Collection‑like read with `onValue`:
```ts
import { ref, onValue } from 'firebase/database'
const shapesRef = ref(rtdb!, `rooms/${roomId}/shapes`)
onValue(shapesRef, (snap) => { const val = snap.val() ?? {}; /* map to Shape[] */ })
```

- Incremental read (alternative):
```ts
import { ref, onChildAdded, onChildChanged, onChildRemoved } from 'firebase/database'
const listRef = ref(rtdb!, `rooms/${roomId}/shapes`)
onChildAdded(listRef, (s) => upsert(fromSnap(s)))
onChildChanged(listRef, (s) => upsert(fromSnap(s)))
onChildRemoved(listRef, (s) => remove(s.key!))
```

- Transaction for username claim:
```ts
import { runTransaction, ref, serverTimestamp } from 'firebase/database'
await runTransaction(ref(rtdb!, `usernames/${lc}`), (current) => current ? current : { uid, claimedAt: serverTimestamp() })
```


## Security Rules (MVP)

- `database.rules.json` (auth‑required, room‑scoped; permissive like Firestore MVP):
```json
{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null"
  }
}
```


(We can harden later with per‑room ownership if needed.)

## Files Likely Affected

- `src/services/firebase.ts`
- `src/hooks/useFirestoreSync.ts` (rename to `useRealtimeSync.ts` or adapt)
- `src/hooks/usePersistence.ts`
- `src/hooks/usePresence.ts`
- `src/hooks/usePresenceSync.ts`
- `src/hooks/useCursorSync.ts`
- `src/hooks/useCharacterSync.ts`
- `src/services/usernames.ts`
- `src/contexts/AuthContext.tsx`
- `firebase.json`, new `database.rules.json`, `.env.example`, `README.md`
- Tests under `src/**/__tests__`

### To-dos

- [ ] Add RTDB init/export in src/services/firebase.ts and env var databaseURL
- [ ] Add database.rules.json and update firebase.json to deploy rules
- [ ] Replace useFirestoreSync.ts with RTDB list listeners and writers
- [ ] Write/read meta snapshot via RTDB in usePersistence.ts
- [ ] Use RTDB with onDisconnect in presence/cursor/character hooks
- [ ] Use RTDB runTransaction for username claim and profile reads/writes
- [ ] Swap Firestore profile get to RTDB get(ref) in AuthContext.tsx
- [ ] Fix tests/mocks; update README and .env.example for DATABASE_URL and rules