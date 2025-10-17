# Collab Canvas

A lightweight collaborative canvas for sketching basic shapes with real‑time cursors and presence. Built with React + TypeScript, Konva/react‑konva for rendering, and Firebase (Auth + Firestore) for authentication, realtime sync, and persistence. Deployed on Vercel.

## Features
- **Real‑time collaboration**: Multi‑user shape creation, movement, and transforms
- **Presence & cursors**: Live participant list and colored cursors
- **Persistent rooms**: Canvas state stored in Firestore per `roomId`
- **Fast interactions**: Smooth pan/zoom, selection box, drag/resize/rotate
- **Minimal UI**: Discoverable toolbar with essential shape tools

## Tech Stack
- **Frontend**: React 18, TypeScript, Vite
- **Canvas**: Konva + react‑konva
- **Backend**: Firebase Auth + Firestore
- **Testing**: Vitest + Testing Library
- **Deploy**: Vercel (static hosting) + Firebase (rules)

## Getting Started
1. **Prerequisites**
   - Node 18+
   - Firebase project (for Auth + Firestore)
2. **Install**
   ```bash
   npm install
   ```
3. **Configure environment**
   - Copy `.env.example` to `.env` and fill your Firebase config:
     ```
     VITE_FIREBASE_API_KEY=
     VITE_FIREBASE_AUTH_DOMAIN=
     VITE_FIREBASE_PROJECT_ID=
     VITE_FIREBASE_STORAGE_BUCKET=
     VITE_FIREBASE_MESSAGING_SENDER_ID=
     VITE_FIREBASE_APP_ID=
     ```
     `.env` is git‑ignored.
4. **Run dev server**
   ```bash
   npm run dev
   ```
5. **Run tests**
   ```bash
   npm test -- --run
   ```

## Architecture Overview
See `architecture.md` for the high‑level diagram of how the React app, canvas hooks, and Firebase integrations connect.

Key modules:
- `src/components/Canvas/Canvas.tsx`: Orchestrates `Stage`/layers, tools, selection, and sync hooks
- `src/components/Canvas/CursorLayer.tsx`: Renders live cursors
- `src/components/Canvas/SelectionBox.tsx`: Draws selection rectangle
- `src/components/Canvas/ShapeEditor.tsx`: Handles shape transform/edit affordances
- `src/components/Toolbar/Toolbar.tsx`: Tool and style controls
- `src/components/Presence/PresenceList.tsx`: Participant list
- `src/hooks/useCanvasState.ts`: Local canvas state and reducers
- `src/hooks/useCanvasInteractions.ts`: Drag/transform/pan/zoom logic
- `src/hooks/useFirestoreSync.ts`: Shape synchronization with Firestore
- `src/hooks/useCursorSync.ts`: Cursor broadcast/subscribe
- `src/hooks/usePresence.ts`: Presence heartbeat and subscription
- `src/services/firebase.ts`: Firebase initialization
- `src/contexts/AuthContext.tsx`: Auth state and provider

## Design Decisions
- **React 18 + react‑konva compatibility**: Chosen for stability with Konva integrations
- **Render pipeline**: Konva via `react‑konva` for performant 2D vector rendering
- **Data consistency model**: Last‑write‑wins for shape updates; simple and predictable
- **Interaction writes**: Debounced writes during drag/transform to reduce Firestore churn
- **Load flow**: Snapshot + hydration before attaching live subscriptions for fast initial paint
- **Testing strategy**: Mock `react‑konva` in tests; inline deps configured in Vitest to avoid canvas runtime issues
- **Type hygiene**: Prefer type‑only imports to avoid runtime export pitfalls
- **Error handling**: MVP‑level (console/log‑first); CI enforces build and tests

## Project Structure (selected)
```
src/
  components/
    Canvas/
      Canvas.tsx
      CursorLayer.tsx
      SelectionBox.tsx
      ShapeEditor.tsx
    Presence/
      PresenceList.tsx
    Toolbar/
      Toolbar.tsx
  contexts/
    AuthContext.tsx
  hooks/
    useCanvasState.ts
    useCanvasInteractions.ts
    useCursorSync.ts
    useFirestoreSync.ts
    usePresence.ts
  services/
    firebase.ts
  pages/
    Login.tsx
    Signup.tsx
    UsernameClaim.tsx
```

## Deployment
### Environment variables
- Set the `VITE_FIREBASE_*` variables (see Getting Started). `.env.example` lists required keys.

### Vercel
- Configure `VITE_FIREBASE_*` env vars in your Vercel project
- Build command: `npm run build`; Output directory: `dist`
- See `vercel.json` for framework/output settings

### Firebase
- Enable Auth providers (Email/Password, Google) in Firebase Console
- Add your Vercel domains under Auth > Settings > Authorized domains (e.g., `your-app.vercel.app`, `*.vercel.app`)
- Firestore rules (MVP, included in `firestore.rules`):
  ```
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      match /rooms/{roomId}/{document=**} {
        allow read, write: if request.auth != null;
      }
    }
  }
  ```
- Deploy rules (requires Firebase CLI + project configured):
  ```bash
  firebase deploy --only firestore:rules
  ```

## Testing
- Test runner: Vitest + Testing Library
- Command: `npm test -- --run`
- `react‑konva` is mocked in tests to avoid canvas environment issues
- JSDOM used for DOM APIs; see `vitest.config.ts` and tests under `src/components/**/__tests__`

## Roadmap & Limitations
- MVP error handling (surface issues via console/logs)
- Last‑write‑wins may drop intermediate edits in extreme contention
- No offline or conflict‑free replicated data type (CRDT) yet
- Additional tools (images/freehand/text styles) out of initial scope

---

### AI Assist (Optional)
- Serverless function in `/api/ai` can proxy to a Vercel AI Gateway
- Default model and guardrails configurable; see `api/` and `PRD-ai-assist.md`
