# Tech Context

## Technologies
- React 18, TypeScript
- Vite 7, Vitest + Testing Library
- Konva + react-konva
- Firebase: Auth, Firestore

## Setup
- Package manager: npm
- Scripts: dev, build, preview, test, format
- Env: `.env` with VITE_FIREBASE_*; `.env.example` provided

## Constraints
- No @types/konva (avoid install error)
- React 18 for react-konva compatibility
- Tests mock react-konva; inline deps configured

## Dependencies
- Runtime: react, react-dom, react-router-dom, firebase, konva, react-konva, classnames
- Dev: vitest, @testing-library/*, jsdom, prettier, eslint-config-prettier
