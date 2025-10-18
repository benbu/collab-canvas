import { useEffect, useRef, useState } from 'react'

type Props = {
  initialText: string
  initialFontFamily: string
  onSave: (result: { text: string; fontFamily: string }) => void
  onCancel: () => void
}

const FONT_OPTIONS = [
  'Arial',
  'Helvetica',
  'Times New Roman',
  'Times',
  'Georgia',
  'Courier New',
  'Courier',
  'Segoe UI',
  'Tahoma',
  'Verdana',
  'system-ui',
  'monospace',
]

export default function TextToolModal({ initialText, initialFontFamily, onSave, onCancel }: Props) {
  const [text, setText] = useState(initialText)
  const [fontFamily, setFontFamily] = useState(initialFontFamily)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div role="dialog" aria-modal="true" aria-label="Text settings" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 30 }}>
      <div style={{ background: '#fff', padding: 16, borderRadius: 8, minWidth: 360, boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>Text settings</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, color: '#374151' }}>Text</span>
            <input ref={inputRef} type="text" value={text} onChange={(e) => setText(e.currentTarget.value)} aria-label="Text" style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px' }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, color: '#374151' }}>Font family</span>
            <select value={fontFamily} onChange={(e) => setFontFamily(e.currentTarget.value)} aria-label="Font family" style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px' }}>
              {FONT_OPTIONS.map((f) => (
                <option key={f} value={f} style={{ fontFamily: f }}>
                  {f}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onCancel}>Cancel</button>
          <button onClick={() => onSave({ text, fontFamily })}>Save</button>
        </div>
      </div>
    </div>
  )
}


