# Collab Canvas

A lightweight collaborative canvas for sketching basic shapes with real‑time cursors and presence. Built with React + TypeScript, Konva/react‑konva for rendering, and Firebase (Auth + Firestore) for authentication, realtime sync, and persistence. Deployed on Vercel.

## Features

### Core Collaboration
- **Real‑time collaboration**: Multi‑user shape creation, movement, and transforms
  - Simultaneous multi-user editing with live updates
  - Shape ownership and selection tracking
  - Visual indicators for shapes selected by other users
  - Last-write-wins conflict resolution model
- **Presence & cursors**: Live participant list and colored cursors
  - Color-coded cursors for each active user
  - Real-time participant list with usernames
  - Live cursor positions broadcast to all users
  - Online/offline status tracking
- **Persistent rooms**: Canvas state stored in Firestore per `roomId`
  - Each room has unique URL (shareable links)
  - Automatic state synchronization with Firestore
  - Load existing canvas on room join
  - Local state with remote persistence

### Canvas Interactions
- **Fast interactions**: Smooth pan/zoom, selection box, drag/resize/rotate
  - Pan canvas with spacebar + drag or hand tool
  - Zoom in/out with mouse wheel
  - Rectangle selection box for multi-select
  - Drag shapes individually or as groups
  - Resize and rotate shapes with transform handles
  - Arrow key panning (Shift for faster movement)
- **Shape Tools & Styling**
  - Rectangle and circle creation tools
  - Text tool with customizable font families
  - Color picker with recent colors palette
  - Transform controls for all shapes (position, size, rotation)
  - Visual feedback during shape creation and editing

### Productivity Features
- **Keyboard Shortcuts**
  - `Delete`/`Backspace`: Delete selected shapes
  - `Cmd/Ctrl + D`: Duplicate selected shapes
  - `Cmd/Ctrl + ]`: Bring to front / `Cmd/Ctrl + Shift + ]`: Bring forward
  - `Cmd/Ctrl + [`: Send to back / `Cmd/Ctrl + Shift + [`: Send backward
  - `L`: Auto-layout selected shapes
  - `Cmd/Ctrl + K` or `/`: Focus AI prompt input
  - Arrow keys: Pan canvas (hold Shift for 3x speed)
- **Canvas Controls**
  - Auto-layout algorithm for organizing shapes
  - Export canvas as PNG image
  - Clear all shapes with confirmation
  - Z-index layer management for shape stacking

### AI Assistant
- **Natural language commands**: AI-powered shape creation and manipulation
  - Type commands like "Create a blue circle" or "Arrange shapes in a grid"
  - Context-aware operations on selected shapes
  - Command confirmation workflow for safety
  - Quick access with `Cmd/Ctrl + K` or `/` shortcut

### Authentication & User Management
- **Multiple sign-in options**
  - Email/Password authentication
  - Google OAuth integration
  - Username claiming system for display names
  - Persistent user sessions across visits

## Tech Stack
- **Frontend**: React 18, TypeScript, Vite
- **Canvas**: Konva + react‑konva
- **Backend**: Firebase Auth + Realtime Database
- **Testing**: Vitest + Testing Library
- **Deploy**: Vercel (static hosting) + Firebase (rules)

## Getting Started
1. **Prerequisites**
   - Node 18+
   - Firebase project (for Auth + Realtime Database)
2. **Install**
   ```bash
   npm install
   ```
3. **Configure environment**
   - Create `.env` and fill your Firebase config:
     ```
     VITE_FIREBASE_API_KEY=
     VITE_FIREBASE_AUTH_DOMAIN=
     VITE_FIREBASE_PROJECT_ID=
     VITE_FIREBASE_STORAGE_BUCKET=
     VITE_FIREBASE_MESSAGING_SENDER_ID=
     VITE_FIREBASE_APP_ID=
     VITE_FIREBASE_DATABASE_URL=
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
- `src/hooks/useFirestoreSync.ts`: Shape synchronization with Realtime Database
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
- Realtime Database rules (MVP, included in `database.rules.json`):
  ```json
  {
    "rules": {
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
  ```
- Deploy rules (requires Firebase CLI + project configured):
  ```bash
  firebase deploy --only database
  ```

## Testing
- Test runner: Vitest + Testing Library
- Command: `npm test -- --run`
- `react‑konva` is mocked in tests to avoid canvas environment issues
- JSDOM used for DOM APIs; see `vitest.config.ts` and tests under `src/components/**/__tests__`

## Debugging & Logging
The app includes a centralized logging system controlled by URL parameters:

### Log Levels
Add `?logLevel=<level>` to your URL to enable logging:
- `?logLevel=debug` - Shows all logs (debug, info, warn, error)
- `?logLevel=info` - Shows info, warnings, and errors
- `?logLevel=warn` - Shows warnings and errors only
- `?logLevel=error` - Shows errors only
- (no parameter) - No logging (default)

### Examples
```
http://localhost:5173/?logLevel=debug
http://localhost:5173/room/abc123?logLevel=info
```

### Performance Monitoring
Add `?perf=true` to enable performance monitoring:
- Real-time FPS tracking
- Operation timing for Firestore, rendering, character physics
- Export performance reports as JSON
- Visual overlay with detailed metrics

## Roadmap & Limitations
- Last‑write‑wins may drop intermediate edits in extreme contention
- **Additional shape tools**: Images, freehand drawing, and styles
- **Canvas organization**: Layers
- **Export capabilities**: Save canvas as SVG, or JSON
- **Comments & annotations**: Threaded discussions on specific shapes or regions
- **Version history**: Time-travel through canvas states with undo/redo across sessions

---

### AI Assist
- Serverless function in `/api/ai` can proxy to a Vercel AI Gateway
- Default model and guardrails configurable; see `api/` and `PRD-ai-assist.md`
