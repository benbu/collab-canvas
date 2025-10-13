graph TD

  %% FRONTEND LAYER
  subgraph Frontend [React + Konva Frontend]
    A[App.jsx] --> B[Canvas.jsx]
    A --> C[Toolbar.jsx]
    A --> D[PresenceIndicator.jsx]
    A --> E[Login.jsx]

    B --> F[useCanvasState.js]
    B --> G[useCanvasInteractions.js]
    B --> H[useCursorSync.js]
    B --> I[usePersistence.js]
    C --> F
    D --> J[usePresence.js]
    E --> K[AuthContext.jsx]
  end

  %% BACKEND LAYER
  subgraph Backend [Firebase Backend]
    L[Firestore Database] --> |Shapes, Cursors, Presence, Snapshots| M[Firebase SDK]
    N[Firebase Auth] --> M
    O[Firebase Hosting] --> M
  end

  %% COMMUNICATION
  M <--> |Real-time Listeners & Writes| F
  M <--> |Shape & Cursor Updates| H
  M <--> |Presence Heartbeat| J
  M <--> |Auth State Changes| K
  M <--> |Snapshot Persistence| I

  %% DEPLOYMENT
  subgraph Deployment [Deployment Layer]
    P[Vercel Frontend Hosting]
    Q[Firebase Hosting + Firestore Backend]
  end

  Frontend --> |Deployed via CI/CD| P
  Backend --> |Realtime API & Auth| Q

  %% UTILITIES
  subgraph Utilities [Helpers & Shared Logic]
    R[throttle.js]
    S[id.js]
  end

  G --> R
  F --> S

  %% FLOWS
  User((User)) --> |Opens Web App| A
  A --> |Requests Auth| N
  A --> |Syncs Canvas + Cursors| L
  L --> |Broadcasts Updates| A
  A --> |Renders Updates| B

  %% LEGEND
  classDef frontend fill:#1e90ff,stroke:#004080,stroke-width:2px,color:#fff;
  classDef backend fill:#ff7f50,stroke:#802000,stroke-width:2px,color:#fff;
  classDef deploy fill:#228b22,stroke:#003300,stroke-width:2px,color:#fff;
  classDef utils fill:#daa520,stroke:#7f6000,stroke-width:2px,color:#fff;

  class Frontend frontend;
  class Backend backend;
  class Deployment deploy;
  class Utilities utils;