# AI Assist Implementation Task List

Trackable checklist derived from `PRD-ai-assist.md`. Check off as tasks complete.

## 0) Prerequisites & Planning
- [x] Confirm current shape model and writers API (`add`, `update`, `remove`, `duplicate`).
- [x] Set model and settings (default `gpt-4o-mini`, temp 0.2).
- [x] Ensure `VERCEL_AI_GATEWAY_URL` is configured in Vercel env.
- [x] Define confirmation UX (modal) for >50 planned steps and destructive ops.
- [x] Establish safe defaults (color, fontSize) and numeric bounds (e.g., radius > 0).
- [x] Enforce hard cap of 100 operations per prompt.

## 1) Serverless API (Vercel Function)
- [x] Create `api/ai.ts` POST endpoint.
  - [x] Validate input payload structure (`prompt`, `tools`, optional `context`).
  - [x] Inject/merge tool schema into request if not provided by client.
  - [x] Forward request to Vercel AI Gateway; handle timeouts and errors.
  - [x] Return normalized `tool_calls` structure to client.
- [x] Unit tests: handler validation, happy path, error/timeout.

## 2) Tool/Function Schema
- [x] Define schemas for:
  - [x] `create_rectangle`
  - [x] `create_circle`
  - [x] `create_text`
  - [x] `update_shape`
  - [x] `delete_shape`
  - [x] `duplicate_shape`
- [x] Centralize schema in a shared module (server + client import).
- [ ] Tests: example prompts produce valid tool calls (mock model response).

## 3) Client Hook: `useAiAssist`
- [ ] Implement POST to `/api/ai` with prompt and context.
- [ ] Parse `tool_calls` and validate arguments against schema.
- [ ] Fan out multi-step plans; require confirmation above 50 steps; enforce 100-op hard cap.
- [ ] Map tool calls to app writers:
  - [ ] `create_*` → `writers.add`
  - [ ] `update_shape` → `writers.update`
  - [ ] `delete_shape` → `writers.remove`
  - [ ] `duplicate_shape` → read base + `writers.add`
- [ ] Handle errors: validation failure, partial execution, retry policy.
- [ ] Return status for UI (idle/loading/success/error, step summaries).
 - [ ] Keep requests non-streaming for v1.

## 4) Prompt UI (Canvas)
- [ ] Add compact command bar (input + submit) in canvas.
- [ ] Keyboard shortcut focus (support both `/` and `Cmd+K`).
- [ ] Loading indicator during processing.
- [ ] Terse success summary; link to details (optional).
- [ ] Accessible labeling, focus management, keyboard submit.
- [ ] Error display with retry.
- [ ] Modal confirmation for >50 steps or destructive operations.

## 5) Execution Semantics & Validation
- [ ] Ensure created/updated elements go through existing pipelines so Firestore syncs.
- [ ] Generate deterministic IDs for created shapes.
- [ ] Validate numeric ranges and color parsing; coerce safe defaults.
- [ ] Confirmation flow for destructive bulk ops and >50 steps.
- [ ] Log each executed step (dev console or telemetry hook).

## 6) QA & Testing
- [ ] Multi-user session test: AI-created shapes sync to all clients real time.
- [ ] Network throttle: verify UX and retries on slow/unstable connections.
- [ ] Gateway failures and rate limits: user-friendly errors + recovery.
- [x] Unit tests: `useAiAssist` parsing/validation/fan-out.
- [ ] E2E test(s): prompt → shapes on canvas (mock server/model).

## 7) Deployment & Config
- [x] Vercel function build verification.
- [ ] Configure `VERCEL_AI_GATEWAY_URL` secret in Vercel.
- [ ] README updates: env vars, usage, limits, confirmation threshold.
- [x] Optional: add basic request metrics/logging.

## 8) Monitoring & Limits
- [x] Add step count cap enforcement and confirmation modal.
- [x] Prompt size limits and truncation strategy.
- [x] Basic analytics: prompts count, step counts, error rates (optional).
- [x] Enforce hard cap of 100 operations per prompt.

## 9) Security & Safety
- [x] Sanitize/validate all numeric/text inputs before execution.
- [x] Prevent unbounded mass operations without explicit confirmation.
- [ ] Respect current user permissions and room access rules.

## 10) Nice-to-Haves (Post-v1)
- [ ] Streaming model responses (optional).
- [ ] Alignment/layout actions (align, distribute).
- [ ] Undo/redo integration for AI-initiated operations.

---

### Clarifications
- Do you want `gpt-4o-mini` as the default model, or `gpt-4o`?
- Which keyboard shortcut do you prefer for the prompt: `/` or `Cmd+K` (or both)?
- For confirmation (>50 steps, destructive ops), should we show a modal with a concise preview of the planned steps?
- Is a simple non-streaming request acceptable for v1, with streaming considered later?
- Any maximum creations per prompt (e.g., cap rectangles to 100) beyond the 50-step confirmation guard?


