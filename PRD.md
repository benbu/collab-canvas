# **Collab Canvas – MVP Product Requirements Document (PRD)**

## **1. Overview**

**Project:** Collab Canvas
**Owner:** Gauntlet AI (Developer: [Your Name])
**Timeline:** MVP due in 24 hours
**Goal:** Build a minimal yet robust real-time collaborative design tool where multiple users can draw, move, and interact with shapes on a shared canvas — synchronously and persistently.

The MVP’s focus is on **bulletproof multiplayer sync**, **state persistence**, and **smooth performance** rather than feature depth.

---

## **2. MVP Objectives**

### **Must-Have Capabilities**

* Real-time synchronization of shapes and cursors across 2+ users.
* Smooth canvas interactions (pan/zoom, draw, move).
* Basic shape creation (rectangle, circle, or text).
* Presence awareness (who is online).
* Cursor labels showing user names.
* Persistent state after disconnects.
* Authentication (user accounts/names).
* Public deployment accessible to external testers.

### **MVP Success Criteria**

| Metric                        | Target                              |
| ----------------------------- | ----------------------------------- |
| Sync latency (object updates) | < 100 ms                            |
| Cursor latency                | < 50 ms                             |
| FPS                           | 60 during pan/zoom and manipulation |
| User concurrency              | ≥ 5 users                           |
| Object capacity               | ≥ 500 simple objects                |

---

## **3. User Stories**

### **Canvas Interaction**

1. **Pan & Zoom**
   *As a user*, I can pan and zoom the canvas smoothly so I can navigate a large workspace.
2. **Shape Creation**
   *As a user*, I can create basic shapes (rectangle/circle/text) to visualize ideas.
3. **Shape Manipulation**
   *As a user*, I can move and resize shapes so I can adjust the layout.
4. **Selection**
   *As a user*, I can select single or multiple objects (shift-click or drag) to manipulate groups efficiently.
5. **Delete & Duplicate**
   *As a user*, I can delete or duplicate selected shapes for faster design iteration.

### **Collaboration**

1. **Real-Time Updates**
   *As a user*, I can see all changes from other users in real time so that everyone’s view stays in sync.
2. **Multiplayer Cursors**
   *As a user*, I can see other users’ cursors labeled with their names for awareness.
3. **Presence Awareness**
   *As a user*, I can see who is online and editing the canvas for coordination.
4. **Conflict Resolution**
   *As a user*, I want object edits to resolve consistently when two people edit at once, even if it’s “last write wins.”

### **Persistence**

1. **Session Continuity**
   *As a user*, I can refresh or reconnect without losing my work.
2. **State Recovery**
   *As a returning user*, I can see the previous state of the shared canvas.

### **Authentication**

1. *As a user*, I can sign in or identify myself so my edits and cursor are labeled.

---

## **4. Technical Architecture**

### **Frontend**

* **Framework:** React + Konva.js
* **Rationale:** React provides a rich component-based structure with a strong ecosystem, and Konva.js simplifies 2D canvas rendering and event handling.
* **Rendering Strategy:** Use Konva layers for objects and cursors; throttle high-frequency updates; batch state updates for smooth 60 FPS.

### **Backend**

* **Platform:** Firebase (Firestore + Auth)
* **Rationale:** Simplifies authentication, real-time sync, and persistence with minimal setup and high reliability for small teams.
* **Features Used:**

  * Firestore: Realtime database for shape, cursor, and presence data.
  * Firebase Auth: Handles user sessions and naming.
  * Hosting: Optionally for static site or backend functions.

### **Deployment**

* **Frontend:** Vercel

  * Quick deployments, automatic builds from GitHub.
* **Backend:** Firebase

  * Realtime sync, authentication, and storage.

---

## **5. Feature Exclusions (Not in MVP)**

These will **not** be implemented in the MVP but may appear in later phases:

| Category                     | Deferred Feature                               |
| ---------------------------- | ---------------------------------------------- |
| **AI Integration**           | Any natural language manipulation (AI agent)   |
| **Advanced Shapes**          | Lines, polygons, paths, gradients              |
| **Transformations**          | Rotation or complex group transforms           |
| **Layer Management**         | Layer hierarchy UI, z-index editing            |
| **Undo/Redo**                | State history system                           |
| **Export**                   | Image/PDF export                               |
| **Performance Optimization** | Server-side diff compression or vector caching |
| **Offline Mode**             | Local cache and sync queueing                  |

---

## **6. Future Expansion (Post-MVP)**

Once the MVP foundation is stable, expand toward:

1. **AI Canvas Agent**

   * Natural language commands invoking canvas APIs.
   * Multi-step complex creation (forms, layouts).
2. **Advanced Collaboration**

   * Commenting, version history.
3. **Performance Scaling**

   * Transition from Firestore to a custom WebSocket server for high concurrency.
4. **Design Features**

   * Grouping, snapping, smart alignment.
5. **AI + UX Integration**

   * Intelligent layout suggestions, “co-designer” experiences.
