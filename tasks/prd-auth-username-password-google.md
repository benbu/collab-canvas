# PRD: Auth Revamp — Username/Password + Google Sign‑In (No Anonymous)

## Introduction / Overview
Add proper authentication with:
- Distinct, unique username (not email UI)
- Username + password login and sign‑up flows
- Google sign‑in via popup (one‑tap acceptable later)
- Remove anonymous sign‑in
- Keep `Login.tsx`; add `Signup` route
- Post‑login redirect to last room or `/room/default`

Display name equals the username. Errors show via simple popup/alert.

## Goals
1. Users can sign up with a unique username and password.
2. Users can log in with username/password.
3. Users can log in with Google popup; if new, claim a unique username.
4. Anonymous auth is removed.
5. After auth, redirect to the last room or `/room/default`.

## User Stories
- As a user, I can create an account with a unique username and password.
- As a user, I can log in using my username/password.
- As a user, I can log in with Google popup and claim a unique username if needed.
- As a user, after login, I’m sent back to my last room (or default if none).

## Functional Requirements
1. Username uniqueness
   1. Maintain unique, case‑insensitive `username` across users.
   2. Enforce uniqueness using Firestore documents and a transaction/commit.
2. Sign‑Up page (`/signup`)
   1. Fields: `username`, `password`, `Create Account` button.
   2. Check availability (on blur or submit). On conflict, show error popup.
   3. On success: create Firebase Auth user (email derived from `username`), write profile, sign in.
3. Login page (`/login`)
   1. Fields: `username`, `password`, `Login` button.
   2. Google sign‑in button (popup). No domain restrictions. One‑tap can be future.
   3. Link to `Sign up` route.
4. Google sign‑in (popup)
   1. On first login, if user has no username, prompt to claim a unique username (modal or dedicated view).
   2. Persist claimed username atomically.
5. Remove anonymous auth
   1. No automatic anonymous sign‑in. Unauthenticated users see the login page.
6. Redirects
   1. After successful login/sign‑up, redirect to `localStorage.lastRoomId` if present; else `/room/default`.
7. Error handling
   1. Show a simple popup/alert with error messages.
8. Vercel/Firebase setup
   1. Enable Email/Password and Google providers in Firebase console.
   2. Add Vercel production and preview domains to Firebase Auth Authorized domains.
   3. Ensure existing `VITE_FIREBASE_*` env variables in Vercel are set.

## Non‑Goals
- Email verification.
- Forgot/reset password.
- Additional security (CAPTCHA, lockouts, rate limits).
- Test coverage requirements.
- Implementing Google one‑tap (can be a follow‑up).

## Design Considerations
- `src/pages/Login.tsx`: username/password inputs; Login and Continue with Google buttons; link to Sign Up.
- `src/pages/Signup.tsx`: username/password inputs; Create Account; link to Login.
- Optional `src/pages/UsernameClaim.tsx` or inline modal for first‑time Google users.

## Technical Considerations
### Username data model
- Firestore collections:
  - `userProfiles/{uid}`: `{ username: string, createdAt, updatedAt }`.
  - `usernames/{username}`: `{ uid: string, createdAt }` (document ID is lowercase username).
- Uniqueness transaction:
  - Verify `usernames/{lcUsername}` does not exist.
  - Create `usernames/{lcUsername}` and update `userProfiles/{uid}.username`.

### Firebase Auth strategy
- Firebase Auth requires an email for email/password.
- Derive an internal email as `${username}@users.local` when creating the Auth user.
- Store canonical username in Firestore; set Firebase user `displayName` to username when possible.

### Context & routing
- `src/contexts/AuthContext.tsx`:
  - Remove anonymous flow.
  - Expose: `loginWithPassword(username, password)`, `signup(username, password)`, `loginWithGoogle()`, `logout()`, `loadUserProfile()`.
  - On auth state change: fetch `userProfiles/{uid}`; set `displayName=username` in context.
- `src/App.tsx`:
  - Guard room routes; unauthenticated → `/login`.
  - After auth: redirect to last room or default; track `localStorage.lastRoomId` on room navigation.

## Success Metrics
- Sign‑up succeeds with unique username.
- Login via username/password and Google works.
- No anonymous sessions.
- Redirect behavior matches spec.

## Open Questions
- For Google first‑login, OK to auto‑generate a unique username when collision occurs (e.g., base + numeric suffix), or always prompt? (Default: prompt.)
- Username normalization: enforce lowercase storage while preserving user‑entered casing for display? (Default: store lowercase; display as entered.)
