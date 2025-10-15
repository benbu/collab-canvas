## Relevant Files

- `src/contexts/AuthContext.tsx` - Replace anonymous flow; add login/signup/google APIs; load user profile.
- `src/services/firebase.ts` - Export `GoogleAuthProvider`; ensure auth exports for new flows.
- `src/services/usernames.ts` - New: username claim/availability with Firestore transaction.
- `src/pages/Login.tsx` - Username/password login UI + Google popup; link to sign-up; redirects.
- `src/pages/Signup.tsx` - New: username/password sign-up; claim username; redirects.
- `src/pages/UsernameClaim.tsx` (optional) - Claim unique username for first-time Google users.
- `src/App.tsx` - Auth guard for room routes; unauthenticated → `/login`; post-login redirect.
- `README.md` - Add setup notes for enabling providers and authorized domains.

## Tasks

- [ ] 1.0 Implement username data model and uniqueness
  - [x] 1.1 Create `src/services/usernames.ts` with `isUsernameAvailable(username)`
  - [ ] 1.2 Implement `claimUsername({ uid, username })` using Firestore transaction
  - [x] 1.2 Implement `claimUsername({ uid, username })` using Firestore transaction
  - [x] 1.3 Define `userProfiles/{uid}` and `usernames/{lcUsername}` schema
  - [x] 1.4 Normalize input to lowercase for key; preserve display casing if desired

- [ ] 2.0 Update AuthContext for username/password and Google auth (remove anonymous)
  - [x] 2.1 Remove `signInAnonymously` and associated logic
  - [x] 2.2 Add `loginWithPassword(username, password)` using derived email `${username}@users.local`
  - [x] 2.3 Add `signup(username, password)`; create user, then `claimUsername`
  - [x] 2.4 Add `loginWithGoogle()` via popup; if no username, surface claim flow flag/state
  - [x] 2.5 On auth state change, load `userProfiles/{uid}` and set `displayName`
  - [x] 2.6 Expose `logout()`; clear any cached display name if necessary

- [ ] 3.0 Build Login page (username/password + Google popup + redirects)
  - [ ] 3.1 Replace current display name input with `username`, `password` fields
  - [x] 3.1 Replace current display name input with `username`, `password` fields
  - [x] 3.2 Wire `Login` button to `loginWithPassword`
  - [x] 3.3 Add `Continue with Google` button to `loginWithGoogle`
  - [x] 3.4 On success, redirect to `localStorage.lastRoomId || '/room/default'`
  - [x] 3.5 Show popup/alert on errors
  - [x] 3.6 Link to `/signup`

- [ ] 4.0 Build Signup page (create account, claim username, redirects)
  - [x] 4.1 Create `src/pages/Signup.tsx` with `username`, `password`
  - [x] 4.2 On submit: call `signup()` then `claimUsername()`
  - [x] 4.3 If username conflict, show popup and keep user on page
  - [x] 4.4 On success, redirect as per login
  - [x] 4.5 Link to `/login`

- [ ] 5.0 Add optional UsernameClaim flow for first-time Google users
  - [x] 5.1 Add `UsernameClaim.tsx` or inline modal controlled by context flag
  - [x] 5.2 Use `isUsernameAvailable` and `claimUsername`; handle conflicts
  - [x] 5.3 On success, proceed to redirect

- [ ] 6.0 Add routing/guards and post-login redirect to last room or default
  - [x] 6.1 Update `src/App.tsx` to guard room routes; unauthenticated → `/login`
  - [x] 6.2 Track last room in `localStorage.lastRoomId` when entering a room
  - [x] 6.3 Ensure `/login` and `/signup` are publicly accessible routes

- [ ] 7.0 Configure Firebase/Vercel providers and authorized domains, update README
  - [x] 7.1 Enable Email/Password and Google providers in Firebase Console
  - [x] 7.2 Add Vercel production and preview domains to Authorized domains
  - [x] 7.3 Verify `VITE_FIREBASE_*` envs in Vercel; document in `README.md`
