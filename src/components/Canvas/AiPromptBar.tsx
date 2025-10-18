import { useState, useRef } from 'react'

interface AiPromptBarProps {
  selectedIds: string[]
  aiStatus: 'idle' | 'loading' | 'error' | 'success' | 'needs_confirmation'
  aiLastResult: {
    messages?: string[]
    executed?: number
    planned?: number
  } | null | undefined
  onPostPrompt: (prompt: string, context: { selectedIds: string[] }) => Promise<{ ok: boolean } | void>
  onConfirmAndExecute: () => any
  onCancelPending: () => void
}

export default function AiPromptBar({
  selectedIds,
  aiStatus,
  aiLastResult,
  onPostPrompt,
  onConfirmAndExecute,
  onCancelPending,
}: AiPromptBarProps) {
  const [prompt, setPrompt] = useState('')
  const promptInputRef = useRef<HTMLInputElement | null>(null)

  const handleSubmit = async () => {
    const val = prompt.trim()
    if (!val) return
    const res = await onPostPrompt(val, { selectedIds })
    if (res?.ok) setPrompt('')
  }

  return (
    <>
      {/* AI Prompt Bar */}
      <div className="aiPromptBar">
        <input
          className="aiInput"
          type="text"
          placeholder="AI Commands e.g. 'Create a circle'"
          ref={promptInputRef}
          value={prompt}
          onChange={(e) => setPrompt(e.currentTarget.value)}
          onKeyDown={async (e) => {
            if (e.key === 'Enter') {
              await handleSubmit()
            }
          }}
        />
        <button
          className="aiGoButton"
          onClick={handleSubmit}
        >Go</button>
        <div className="aiPromptStatus" aria-live="polite">
          {aiStatus === 'loading' && <span>Processing…</span>}
          {aiStatus === 'error' && <span style={{ color: '#b91c1c' }}>{aiLastResult?.messages?.[0] ?? 'Error'}</span>}
          {aiStatus === 'success' && (
            <span style={{ color: '#065f46' }}>Done ({aiLastResult?.executed}/{aiLastResult?.planned})</span>
          )}
        </div>
      </div>

      {/* AI Confirmation Modal */}
      {aiStatus === 'needs_confirmation' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20 }}>
          <div style={{ background: '#fff', padding: 16, borderRadius: 8, minWidth: 340 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Confirm AI Plan</div>
            <div style={{ marginBottom: 12 }}>This prompt plans more than 50 steps. Proceed?</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={onCancelPending}>Cancel</button>
              <button onClick={onConfirmAndExecute}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// Export promptInputRef getter for external keyboard shortcut access
export function useAiPromptBarRef() {
  return useRef<HTMLInputElement | null>(null)
}

