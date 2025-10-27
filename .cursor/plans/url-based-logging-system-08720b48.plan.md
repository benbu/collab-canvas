<!-- 08720b48-2c09-47b0-a8f5-708b178c04c4 8cf82d23-e0e4-44e4-9f6b-39c9d845e72c -->
# URL-based Logging System

## Overview

Implement a logging system that checks a `logLevel` URL parameter before outputting to console. Supported levels: `debug`, `info`, `warn`, `error` (in ascending priority). By default, all logging is disabled.

## Implementation Steps

### 1. Create Logger Utility

Create `src/utils/logger.ts` with:

- Parse `logLevel` from URL search params (one-time on module load)
- Define level hierarchy: `error > warn > info > debug`
- Export methods: `logger.debug()`, `logger.info()`, `logger.warn()`, `logger.error()`, `logger.log()`
- Each method checks if current level allows the log before calling console
- `logger.log()` should map to `debug` level for backwards compatibility

**Example behavior:**

- No parameter: nothing logs
- `?logLevel=error`: only errors log
- `?logLevel=warn`: warns and errors log
- `?logLevel=info`: info, warns, and errors log
- `?logLevel=debug`: everything logs

### 2. Replace Console Calls

Replace all console calls in these files (26 total occurrences):

- `src/components/Canvas/Canvas.tsx` (2 console.log)
- `src/hooks/useCharacterSync.ts` (5 console.log)
- `src/utils/performance.ts` (2 console.log)
- `src/hooks/usePresenceSync.ts` (4 console.log)
- `src/components/Canvas/DevTools.tsx` (1 console.log)
- `src/hooks/useAiAssist.ts` (3 console.log, 1 console.error)
- `api/ai.ts` (2 console.log, 3 console.error)
- `src/contexts/AuthContext.tsx` (1 console.error)
- `src/components/Toolbar/Toolbar.tsx` (2 console.error)

Map existing calls:

- `console.log()` → `logger.debug()`
- `console.info()` → `logger.info()`
- `console.warn()` → `logger.warn()`
- `console.error()` → `logger.error()`

### 3. Testing

Verify the implementation:

- Without URL param: nothing logs
- With `?logLevel=debug`: all logs appear
- With `?logLevel=error`: only errors appear
- Performance should be minimal (single URL parse on load)

## Key Files

- **New:** `src/utils/logger.ts` - centralized logging utility
- **Modified:** 9 files across components, hooks, and API

### To-dos

- [ ] Create src/utils/logger.ts with URL parameter parsing and level checking
- [ ] Replace console calls in Canvas.tsx, DevTools.tsx, and Toolbar.tsx
- [ ] Replace console calls in useCharacterSync.ts, usePresenceSync.ts, and useAiAssist.ts
- [ ] Replace console calls in performance.ts
- [ ] Replace console calls in api/ai.ts and AuthContext.tsx