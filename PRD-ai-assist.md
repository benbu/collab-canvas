## AI-Assisted Canvas — Project Requirements Document (PRD)

### Summary
Enable users to describe canvas actions in natural language (e.g., "add a blue rectangle at 100,100") and have the system translate those requests into concrete shape operations via AI function-calling. The AI is invoked through Vercel AI Gateway (which proxies to OpenAI). The application parses the AI’s tool calls and executes the corresponding in-app functions so that results behave exactly like manual actions and sync in real time through Firestore.

### Goals
- **Natural language to actions**: Users enter a prompt; AI returns explicit tool calls with parameters.
- **First-class operations**: Executed actions use the existing creation/update/remove pipelines so they are synced via Firestore and visible to all collaborators.
- **Composable instructions**: Support multi-step prompts (e.g., create multiple shapes, then align or color them).
- **Safe and predictable**: Guard against ambiguous or destructive instructions with validation and confirmation for risky actions.

### Non-Goals
- General-purpose conversational AI UI or chat history persistence (initial scope is action execution from one-shot prompts).
- Complex design assistant (layout intelligence, smart guides). Future work.

---

## Functional Requirements

- **Prompt Input UI**
  - A compact input in the canvas UI (e.g., bottom command bar or floating palette) to submit a natural language prompt.
  - Keyboard shortcut to focus (e.g., `/` or `Cmd+K`).
  - Show a short activity indicator while the request is processed.

- **Supported Intents (v1)**
  - **Create shapes**: rectangle, circle, text.
  - **Edit attributes**: position (x, y), size (width/height or radius), fill color, rotation, text content, font size.
  - **Duplicate / Delete**: operate on selection or by ID/name when specified.
  - **Selection by reference**: if the user mentions "the last rectangle" or "the blue circle" attempt a best-effort resolution using current state.

- **Function-Calling Contract**
  - The model is provided with a schema of available functions and required/optional parameters.
  - The model’s response must return one or more tool calls with name + JSON arguments.
  - The client parses tool calls and executes them in order.

- **Execution Semantics**
  - All actions call the same code paths as manual actions (e.g., writers.add / writers.update / writers.remove) so Firestore updates propagate in real time.
  - Multi-step tool calls execute sequentially, halting on validation failure and surfacing an error.
  - On completion, the prompt UI shows a brief success summary.

- **Fallback & Clarification**
  - If the model returns ambiguous or invalid parameters, ask the user for clarification inline (minimal UX) or apply safe defaults and inform the user.
  - Never execute destructive operations (e.g., delete all shapes) without confirmation.

---

## Technical Requirements & Dependencies

- **Vercel AI Gateway**
  - Used as the public API endpoint from the client.
  - Configured to call OpenAI with the specified model and function-calling enabled.
  - Provide rate limits, observability, and key protection.

- **OpenAI Models**
  - Recommended: `gpt-4o` or `gpt-4o-mini` with tool/function calling.
  - Temperature low (e.g., 0.1–0.3) for deterministic tool selection.

- **Serverless Endpoint (Vercel Functions)**
  - Add `api/ai.ts` (or `api/ai/index.ts`) to handle POST requests.
  - Validates input, injects tool definitions, forwards to Vercel AI Gateway, returns streamed or non-streamed response.

- **Client Integration**
  - New hook `useAiAssist` to post prompts, handle responses, parse tool calls, and dispatch to existing shape functions.
  - Reuse existing writers from `useFirestoreSync` to ensure LWW and sync semantics.

- **Environment Variables**
  - `VERCEL_AI_GATEWAY_URL` (or use Vercel’s managed Gateway domain).
  - Gateway configured with provider keys (OpenAI) via Vercel dashboard.

---

## Data Flow (Prompt → Execution)

1) User submits prompt in the canvas UI.
2) Client POSTs to `/api/ai` with:
   - user prompt
   - tool/function schema (available actions)
   - optional canvas context (selected IDs, viewport, default color)
3) Vercel AI Gateway forwards to OpenAI with function calling enabled.
4) Model returns a list of `tool_calls` specifying function names + args.
5) Client parses tool calls and validates parameters against current state.
6) Client executes corresponding in-app functions:
   - create → `writers.add`
   - update → `writers.update`
   - delete → `writers.remove`
   - duplicate → combination of `writers.add` with derived properties
7) Firestore propagates changes; all clients update via existing listeners.
8) UI shows success or error, with minimal summaries.

---

## Available Functions (Initial Schema)

- `create_rectangle`:
  - args: `{ x: number, y: number, width?: number, height?: number, fill?: string, rotation?: number }`
- `create_circle`:
  - args: `{ x: number, y: number, radius?: number, fill?: string, rotation?: number }`
- `create_text`:
  - args: `{ x: number, y: number, text: string, fontSize?: number, fill?: string, rotation?: number }`
- `update_shape`:
  - args: `{ id: string, x?: number, y?: number, width?: number, height?: number, radius?: number, fill?: string, text?: string, fontSize?: number, rotation?: number }`
- `delete_shape`:
  - args: `{ id: string }`
- `duplicate_shape`:
  - args: `{ id: string, dx?: number, dy?: number }` (offset optional)

Notes:
- IDs are returned to the model only when available in context; otherwise the model should prefer create operations.
- Where the prompt references selection ("these"), the client can translate it to concrete IDs before/after AI call as needed.

---

## API Contracts (Examples)

### Request to `/api/ai` (client → Vercel Function)
```json
{
  "prompt": "Create a blue rectangle at 100,100 sized 200x150, then a circle at 400,300 radius 80",
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "create_rectangle",
        "description": "Create a rectangle on the canvas",
        "parameters": {
          "type": "object",
          "properties": {
            "x": {"type": "number"},
            "y": {"type": "number"},
            "width": {"type": "number"},
            "height": {"type": "number"},
            "fill": {"type": "string"},
            "rotation": {"type": "number"}
          },
          "required": ["x", "y"]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "create_circle",
        "description": "Create a circle on the canvas",
        "parameters": {
          "type": "object",
          "properties": {
            "x": {"type": "number"},
            "y": {"type": "number"},
            "radius": {"type": "number"},
            "fill": {"type": "string"},
            "rotation": {"type": "number"}
          },
          "required": ["x", "y"]
        }
      }
    }
  ],
  "model": "gpt-4o-mini",
  "temperature": 0.2,
  "context": {
    "selectedIds": [],
    "defaultFill": "#4F46E5"
  }
}
```

### Example Model Response (tool calls)
```json
{
  "tool_calls": [
    {
      "name": "create_rectangle",
      "arguments": {
        "x": 100,
        "y": 100,
        "width": 200,
        "height": 150,
        "fill": "#0000FF"
      }
    },
    {
      "name": "create_circle",
      "arguments": {
        "x": 400,
        "y": 300,
        "radius": 80
      }
    }
  ]
}
```

### Client Execution Pseudocode
```typescript
for (const call of tool_calls) {
  switch (call.name) {
    case 'create_rectangle': {
      const id = generateId()
      writers.add({ id, type: 'rect', x, y, width, height, fill, rotation })
      break
    }
    case 'create_circle': {
      const id = generateId()
      writers.add({ id, type: 'circle', x, y, radius, fill, rotation })
      break
    }
    case 'create_text': {
      const id = generateId()
      writers.add({ id, type: 'text', x, y, text, fontSize, fill, rotation })
      break
    }
    case 'update_shape': {
      writers.update({ id, ...partialProps })
      break
    }
    case 'delete_shape': {
      writers.remove(id)
      break
    }
    case 'duplicate_shape': {
      const base = state.byId[id]
      if (!base) throw new Error('Invalid id')
      const newId = generateId()
      writers.add({ ...base, id: newId, x: base.x + (dx ?? 20), y: base.y + (dy ?? 20) })
      break
    }
  }
}
```

---

## Error Handling & Fallback Behavior

- **Validation**: Ensure numeric ranges (e.g., radius > 0), required fields, and safe color parsing.
- **Ambiguity**: When multiple targets match (e.g., "the blue one"), prefer applying to selection; otherwise prompt for clarification.
- **Destructive operations**: Confirm before bulk deletion or mass updates.
- **Model errors / rate limits**: Surface user-friendly errors and allow retry.
- **Partial failure**: If a multi-step plan fails mid-way, stop and display which step failed; completed steps remain.
- **Timeouts**: Show a timeout message and keep the user’s prompt to retry.

---

## Example User Flows

- "Add a large blue rectangle at 120, 80 and a circle at 500, 300"
  - Tool calls: `create_rectangle`, `create_circle` → writers.add → Firestore sync → all clients see updates.

- "Make the selected items red and rotate 15 degrees"
  - Client injects selected IDs into context; model returns `update_shape` for each or a single call with array (client can fan out).

- "Duplicate the last rectangle 3 times offset by 40 pixels"
  - Tool calls: three `duplicate_shape` with `dx=40` and incremental `dy=0` or `dy=40` per instruction.

---

## Acceptance Criteria

- Prompts can create/edit/delete/duplicate shapes via AI tool calls.
- Executed actions use existing writers and sync to all users in near real time.
- Robust validation prevents invalid writes; errors are clearly surfaced.
- Rate-limited and resilient API integration via Vercel AI Gateway.
- Clear UX for in-progress, success, error states.

---

## Implementation Outline (Phased)

1) Serverless endpoint `api/ai.ts` with Gateway integration (POST only).
2) Define tool schemas matching our shape model; unit-test JSON schema and sample prompts.
3) Client hook `useAiAssist` + UI input; wire to writers and canvas state.
4) Validation + confirmation for destructive operations; telemetry.
5) QA: multi-user sessions verifying Firestore sync from AI actions.

---

## Decisions

- **Response style**: Keep responses terse/short.
- **Execution strategy**: No server-side batch tool calls; always fan out on the client.
- **Confirmation threshold**: Require confirmation when a prompt plans more than 50 steps.
- **Default model**: `gpt-4o-mini` (temperature ~0.2).
- **Prompt shortcuts**: Support both `/` and `Cmd+K` to focus the prompt input.
- **Confirmation UI**: Use a modal summary for >50 planned steps or destructive operations.
- **Streaming**: Keep non-streaming for v1; evaluate streaming later.
- **Maximum operations**: Enforce a hard cap of 100 operations per prompt.


