# **Collab Canvas – MVP Task List and PR Breakdown (Fully Detailed)**

> This expands each PR with concrete subtasks, file-level ownership, and only the tests that materially add confidence (unit and/or integration). It also includes acceptance criteria per PR so you can close issues crisply.

---

## **Repository Conventions**

* **Package manager:** npm
* **Testing:** Vitest + React Testing Library; Firestore Emulator for integration tests that touch Firebase.
* **Styling:** Minimal CSS (module CSS), classnames helper.
* **Paths:** All features live under `src/` with a clear layering (components, hooks, services, contexts, utils).

**Expanded File Structure (baseline):**

```
collab-canvas/
├─ public/
│  └─ index.html
├─ src/
│  ├─ components/
│  │  ├─ Canvas/
│  │  │  ├─ Canvas.jsx
│  │  │  ├─ Canvas.css
│  │  │  ├─ CursorLayer.jsx
│  │  │  └─ __tests__/Canvas.test.jsx
│  │  ├─ Toolbar/
│  │  │  ├─ Toolbar.jsx
│  │  │  └─ Toolbar.css
│  │  └─ Presence/
│  │     └─ PresenceIndicator.jsx
│  ├─ contexts/
│  │  └─ AuthContext.jsx
│  ├─ hooks/
│  │  ├─ useCanvasState.js
│  │  ├─ useCanvasInteractions.js
│  │  ├─ useCursorSync.js
│  │  ├─ usePresence.js
│  │  ├─ useFirestoreSync.js
│  │  └─ usePersistence.js
│  ├─ pages/
│  │  └─ Login.jsx
│  ├─ services/
│  │  ├─ firebase.js
│  │  └─ firestore.rules (for reference)
│  ├─ utils/
│  │  ├─ throttle.js
│  │  └─ id.js
│  ├─ App.jsx
│  ├─ main.jsx
│  └─ index.css
├─ .env.example
├─ firebase.json (after PR#12)
├─ firestore.indexes.json (after PR#12 if needed)
├─ vercel.json (after PR#12)
├─ package.json
├─ vite.config.js
└─ vitest.config.ts
```

---

## **PR #1: Project Initialization**

**Goal:** Scaffold app; baseline CI-ready project with linting, formatting, tests, and Vercel pipeline.

### Subtasks

1. **Create app**

   * `npm create vite@latest collab-canvas -- --template react`
   * Add `npm` scripts: `dev`, `build`, `preview`, `test`, `lint`, `format`.
2. **Install deps**

   * `npm install react react-dom konva react-konva firebase react-router-dom classnames`
   * `npm install -D vite vitest @testing-library/react @testing-library/user-event jsdom eslint prettier eslint-config-prettier eslint-plugin-react @types/konva` (if TS later, add `typescript`)
3. **Config**

   * Add `.editorconfig`, `.eslintrc.cjs`, `.prettierrc`.
   * Create `.env.example` with `VITE_FIREBASE_API_KEY=...` etc.
4. **Bootstrap app shell**

   * Minimal `App.jsx` with placeholder routes `/login` and `/room/default`.
   * Global CSS reset in `index.css`.
5. **Repo & CI basics**

   * Initialize GitHub repo, push `main`.
   * Add GitHub Action (optional) for `npm install; npm test`.
6. **Vercel baseline**

   * Link repo, default build to `npm run build`.

### Files to create/update

* `package.json`, `vite.config.js`, `vitest.config.ts`, `.eslintrc.cjs`, `.prettierrc`, `.editorconfig`, `.env.example`, `src/App.jsx`, `src/main.jsx`, `src/index.css`.

### Tests (needed?) – **Yes (Unit)**

* `src/components/__tests__/App.smoke.test.jsx`: render `<App />` without crashing.
* Purpose: sanity gate for subsequent PRs.

### Acceptance Criteria

* App starts (`npm run dev`) and renders a placeholder canvas route.
* Unit smoke test passes in CI.

---

## **PR #2: Basic Canvas Setup (Pan/Zoom)**

**Goal:** A performant Konva stage with smooth pan/zoom and resize-to-viewport.

### Subtasks

1. **Canvas component**

   * Create `Canvas.jsx` with Konva `<Stage>` and a base `<Layer>`.
   * Implement viewport sizing (listen to `resize`, set width/height via state).
2. **Pan**

   * Mouse drag initiates panning when not interacting with shapes.
   * Store stage position (x,y) in local state; update via `onDragMove` or manual transform.
3. **Zoom**

   * Mouse wheel to zoom at cursor point (scale by factor 1.05/0.95), clamp scale [0.25, 4].
   * Apply transform origin math: translate to cursor, scale, translate back.
4. **Grid**

   * Lightweight grid rendering (lines every 50px) on its own Konva Layer.
5. **Performance**

   * Throttle wheel/drag handlers using `utils/throttle.js`.

### Files

* `src/components/Canvas/Canvas.jsx`, `src/components/Canvas/Canvas.css`, `src/utils/throttle.js`.

### Tests (needed?) – **Yes**

* **Unit**: Canvas mounts, grid renders, stage size updates on `window.resize`.
* **Integration**: Fire synthetic wheel events; assert scale changes and clamps; simulate pan drag and assert stage position.

### Acceptance Criteria

* Pan and zoom feel smooth (manual check) and do not drop visibly below 60 FPS on a modern laptop.

---

## **PR #3: Shape Creation Tools (Rect/Circle/Text)**

**Goal:** Users can select a tool and click to create shapes with defaults.

### Subtasks

1. **Toolbar**

   * `Toolbar.jsx` with buttons: Rectangle, Circle, Text, Select.
   * Simple color picker and text input (for Text tool content).
2. **State model**

   * `useCanvasState.js` holds local state: `{ byId, allIds }` map of shapes.
   * Shape model: `{ id, type, x, y, width, height, radius, fill, text, fontSize, rotation }`.
   * `addShape`, `updateShape`, `removeShape` reducers.
3. **Creation flow**

   * On canvas click with active tool, compute default geometry:

     * Rect: 200×120; Circle: r=60; Text: fontSize=18, width auto.
   * Generate id via `utils/id.js` (e.g., nanoid or `Date.now().toString(36)`).
4. **Renderers**

   * Conditionally render `Rect`, `Circle`, `Text` Konva nodes based on shape type.

### Files

* `src/components/Toolbar/Toolbar.jsx`, `src/hooks/useCanvasState.js`, `src/utils/id.js`, update `Canvas.jsx` to consume state.

### Tests (needed?) – **Yes**

* **Unit**: `useCanvasState` reducers (add/update/remove) pure logic tests.
* **Integration**: Click canvas with Rect tool -> one Rect exists with defaults; Text tool uses input value.

### Acceptance Criteria

* Shapes are created at click position with sane defaults and are visible.

---

## **PR #4: Shape Manipulation (Move/Resize/Delete/Duplicate/Selection)**

**Goal:** Interactive editing of shapes, including selection and multi-select.

### Subtasks

1. **Selection**

   * `useCanvasInteractions.js`: `selectedIds` set, `selectOne`, `toggleSelect`, `clearSelection`.
   * Drag-selection box: mousedown+drag draws translucent rect; on mouseup select intersecting nodes.
2. **Move**

   * Enable `draggable` per Konva node when selected; update state on `onDragEnd`.
3. **Resize/Rotate**

   * Konva `Transformer` attached to current selection; on transform end, persist new `width/height/rotation` (or `radius`).
   * Maintain min size (e.g., 10×10); clamp rotation to [0..360).
4. **Delete/Duplicate**

   * Keyboard handlers: `Delete` removes selected; `Ctrl/⌘+D` duplicates with offset (+16,+16) and new ids.
5. **Visual cues**

   * Selection outlines; cursor changes during drag/resize.

### Files

* `src/hooks/useCanvasInteractions.js`, update `Canvas.jsx` to wire events, optional `src/components/Canvas/SelectionBox.jsx`.

### Tests (needed?) – **Yes (Integration)**

* Multi-select via drag box selects expected shapes.
* Dragging updates x/y; Transformer resize updates width/height; Delete removes.

### Acceptance Criteria

* All listed interactions behave predictably for single & multi-selection.

---

## **PR #5: Firebase Sync Integration (Shapes)**

**Goal:** Real-time Firestore sync for shapes (create/update/delete) in a room.

### Subtasks

1. **Firebase bootstrap**

   * `services/firebase.js`: initialize app with `import.meta.env.VITE_*` keys; export `auth`, `db`.
2. **Data model & paths**

   * Roomed structure: `/rooms/{roomId}/shapes/{shapeId}` documents.
   * Shape doc: `{ type, x, y, width, height, radius, fill, text, fontSize, rotation, updatedAt, updatedBy }`.
3. **Listeners**

   * `useFirestoreSync.js`: subscribe to collection; on snapshots, reconcile local state (insert/update/remove).
4. **Writers**

   * On local `addShape/updateShape/removeShape`, write to Firestore with merge, set `updatedAt` serverTimestamp.
   * Debounce high-frequency updates (e.g., during drag/transform) to ~20–30ms; fire final commit on end events.
5. **Conflict strategy**

   * Last-write-wins based on `updatedAt`; keep local optimistic UI.
6. **Security rules (dev)**

   * Basic permissive rules for MVP; note: tighten in PR#12.

### Files

* `src/services/firebase.js`, `src/hooks/useFirestoreSync.js`, modify `useCanvasState.js`, update `Canvas.jsx` (roomId param support).

### Tests (needed?) – **Yes (Integration with Emulator)**

* Start Firestore Emulator; two test clients add/update/remove shapes; expect both to converge.
* Drag debouncing: ensure not more than N writes per second during move.

### Acceptance Criteria

* Two browsers see shape changes within ~100ms; state persists in Firestore.

---

## **PR #6: Multiplayer Cursor Sync**

**Goal:** Real-time remote cursors with name labels.

### Subtasks

1. **Schema & paths**

   * `/rooms/{roomId}/cursors/{userId}`: `{ x, y, color, name, updatedAt }`.
2. **Local tracking**

   * `useCursorSync.js`: subscribe to cursors; throttle local writes to 8–12 fps; write on `mousemove`.
3. **Rendering**

   * `CursorLayer.jsx`: draw triangle pointer + name tag; hide your own cursor; fade stale cursors (>2s old).

### Files

* `src/hooks/useCursorSync.js`, `src/components/Canvas/CursorLayer.jsx`, update `Canvas.jsx` to mount layer.

### Tests (needed?) – **Yes (Integration with Emulator)**

* Two clients move mouse; each sees the other’s cursor update at low latency; stale cursors disappear.

### Acceptance Criteria

* Cursor updates feel live (<50ms typical on local network) and labels reflect display names.

---

## **PR #7: Presence Awareness**

**Goal:** Who’s online in the room; remove on disconnect.

### Subtasks

1. **Schema & paths**

   * `/rooms/{roomId}/presence/{userId}`: `{ name, color, lastSeen }` heartbeat.
2. **Heartbeat**

   * `usePresence.js`: `setInterval` (e.g., 5s) to update `lastSeen`; on unload, clear doc.
3. **UI**

   * `PresenceIndicator.jsx`: avatar dots with names; mark inactive if `now - lastSeen > 10s`.

### Files

* `src/hooks/usePresence.js`, `src/components/Presence/PresenceIndicator.jsx`.

### Tests (needed?) – **Yes (Unit)**

* Presence hook updates `lastSeen` timing logic (mock timers).

### Acceptance Criteria

* Active users list updates within 10s and clears on tab close within ~10s.

---

## **PR #8: Firebase Authentication Setup**

**Goal:** Anonymous auth with optional display name; expose via context.

### Subtasks

1. **AuthContext**

   * `AuthContext.jsx`: provides `{ user, displayName, setDisplayName }`.
2. **Login page**

   * `Login.jsx`: if no user, call `signInAnonymously(auth)`; prompt for display name; store in `localStorage`.
3. **Wire-in**

   * Protect `/room/:roomId` route to require `user`; pass `displayName` to cursor/presence writers.

### Files

* `src/contexts/AuthContext.jsx`, `src/pages/Login.jsx`, `src/services/firebase.js`, route handling in `App.jsx`.

### Tests (needed?) – **Yes (Unit)**

* AuthContext initializes and exposes user; display name persists/retrieves from localStorage.

### Acceptance Criteria

* First load takes you to `/login`; after name entry, you land in `/room/default` with labeled cursor.

---

## **PR #9: Canvas State Persistence & Recovery**

**Goal:** Refresh-safe state across sessions.

### Subtasks

1. **Snapshots**

   * On interval (e.g., 5s) and on `beforeunload`, write snapshot doc at `/rooms/{roomId}/meta/snapshot` with `{ shapesById, allIds, updatedAt }`.
2. **Hydration**

   * On room load, fetch snapshot first, then subscribe to shapes collection; reconcile order: snapshot → live deltas.
3. **Mid-edit safety**

   * Ensure final transform end writes before unload (use `visibilitychange` as backup).

### Files

* `src/hooks/usePersistence.js`, touch `useFirestoreSync.js` and `Canvas.jsx` for hydration order.

### Tests (needed?) – **Yes (Integration with Emulator)**

* Create shapes, refresh; expect same canvas after reload. Snapshot newer than collection is respected until live updates arrive.

### Acceptance Criteria

* Refreshing never loses more than the last few hundred ms of edits.

---

## **PR #10: UI & UX Polish**

**Goal:** Quality-of-life: loaders, colors, responsive toolbar, hints.

### Subtasks

1. **Loader**

   * Global loading spinner while snapshot+initial subscription resolve.
2. **Cursor colors**

   * Deterministic color from `userId` hash for consistency.
3. **Toolbar polish**

   * Active tool highlight; keyboard shortcuts displayed as tooltips.
4. **Mobile basics**

   * Touch pan/zoom (pinch) enables; disable multi-select on touch for MVP.

### Files

* `src/components/Toolbar/Toolbar.css`, `src/components/Canvas/Canvas.css`, `src/App.jsx`.

### Tests (needed?) – **No (manual UX review sufficient)**

### Acceptance Criteria

* UX feels coherent; no obvious jank during initial load.

---

## **PR #11: QA & Performance Verification**

**Goal:** Validate MVP performance targets and reliability.

### Subtasks

1. **Shape flood script**

   * Add dev-only command to programmatically insert 500 rects and measure FPS (use `performance.now()` sampling).
2. **Multi-user session**

   * Open 3–5 tabs; rapid create/move; observe sync latency and stability.
3. **Network throttle**

   * Use Chrome DevTools to test 3G/Slow 4G; confirm graceful behavior.

### Files

* Dev script under `src/utils/devSeed.js` (excluded from prod build if desired).

### Tests (needed?) – **No (manual/perf instrumentation)**

### Acceptance Criteria

* Meets stated MVP performance targets in PRD.

---

## **PR #12: Production Deployment**

**Goal:** Stable production deploy on Vercel with Firebase config & rules.

### Subtasks

1. **Env & build**

   * Add Vercel project env vars (`VITE_FIREBASE_*`).
   * `npm run build` produces clean artifact; verify chunk sizes.
2. **Rules (minimal hardening)**

   * Add Firestore rules to restrict writes to room members (for MVP, allow authenticated users):

     ```
     rules_version = '2';
     service cloud.firestore { match /databases/{database}/documents { match /rooms/{roomId}/{doc=**} { allow read, write: if request.auth != null; } } }
     ```
3. **Smoke test**

   * Open two browsers against prod; create/move shapes, verify presence & cursors.
4. **Tag release**

   * Create GitHub release `v0.1.0-mvp`.

### Files

* `firebase.json`, `firestore.rules`, `vercel.json`, `.env` (local), Vercel env.

### Tests (needed?) – **No (post-deploy manual validation)**

---

## **Cross-PR Notes**

* **Rooms**: Route param drives Firestore paths; default to `default` if none.
* **Write minimization**: For drags/transforms, emit compact deltas `{x,y}`; commit final absolute state on end.
* **Error handling**: Toast or inline banner on Firestore errors; retry with backoff for listeners.
* **Accessibility**: Keyboard shortcuts listed; focus trap on login modal.

---

## **Checklist View (for quick copy into GitHub Projects)**

* PR#1 Init ✅

  * [x] Vite app, deps, lint/test, CI, Vercel baseline
* PR#2 Canvas ✅

  * [x] Pan/zoom, grid, throttle, resize-aware
  * [x] Tests: unit + integration
* PR#3 Create ✅

  * [x] Toolbar, state model, creation flow
  * [x] Tests: reducers (unit), creation (integration)
* PR#4 Manipulate ✅

  * [x] Select, drag, transform, delete/duplicate
  * [x] Tests: interaction integration
* PR#5 Sync ✅

  * [x] Firebase init, listeners, writers, debounced deltas, LWW
  * [x] Tests: emulator integration, write throttling
* PR#6 Cursors ✅

  * [x] Cursor schema, throttle writes, render labels
  * [x] Tests: emulator integration
* PR#7 Presence ✅

  * [x] Heartbeat + UI
  * [x] Tests: unit (timers)
* PR#8 Auth ✅

  * [ ] Anonymous auth + display name + context
  * [ ] Tests: unit (context & localStorage)
* PR#9 Persistence ✅

  * [ ] Snapshot + hydration + mid-edit safety
  * [ ] Tests: emulator integration (refresh)
* PR#10 Polish

  * [ ] Loader, colors, tooltips, touch basics (manual)
* PR#11 QA/Perf

  * [ ] Flood 500 shapes, multi-user, network throttle (manual)
* PR#12 Deploy

  * [ ] Env, rules, smoke test, tag release (manual)
