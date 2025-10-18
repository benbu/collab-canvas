<!-- 3df0deac-4d80-4006-8a4f-eaa8fa727602 c8fc5212-3615-449d-a674-4b61667e13b9 -->
# Realtime Text Panel Updates

## Changes Required

### 1. Update FloatingTextPanel.tsx

**File:** `src/components/Canvas/FloatingTextPanel.tsx`

- Remove `onSave` from the Props type (line 11)
- Remove the save button and its container (lines 82-84)

### 2. Update Canvas.tsx

**File:** `src/components/Canvas/Canvas.tsx`

In the FloatingTextPanel usage (lines 494-513):

- Replace `onChangeText={setTextInput}` with a new handler that:
- Updates `textInput` state
- Applies the text change immediately to all selected text shapes
- Syncs changes to Firestore via `writers.update`

- Replace `onChangeFont={setFontFamily}` with a new handler that:
- Updates `fontFamily` state
- Applies the font change immediately to all selected text shapes
- Syncs changes to Firestore via `writers.update`

- Remove the `onSave` prop entirely

The logic from the current `onSave` callback (lines 504-510) will be moved into the new `onChangeText` and `onChangeFont` handlers.

## Behavior

- When text shapes are selected: Changes apply immediately to those shapes
- When no text shapes are selected: Changes update default values for the next text shape to be created (current behavior preserved)