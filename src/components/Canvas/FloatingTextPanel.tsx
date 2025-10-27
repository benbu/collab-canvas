import { useCallback, useEffect, useRef, useState } from 'react'
import { Type } from 'lucide-react'

type Props = {
  visible: boolean
  x: number
  y: number
  text: string
  fontFamily: string
  onChangeText: (t: string) => void
  onChangeFont: (f: string) => void
  onRequestPositionChange?: (pos: { x: number; y: number }) => void
  onClose?: () => void
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

export default function FloatingTextPanel({ visible, x, y, text, fontFamily, onChangeText, onChangeFont, onRequestPositionChange, onClose }: Props) {
  const [dragging, setDragging] = useState(false)
  const dragOffsetRef = useRef<{ dx: number; dy: number } | null>(null)
  const posRef = useRef<{ x: number; y: number }>({ x, y })

  useEffect(() => {
    posRef.current = { x, y }
  }, [x, y])

  const onHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    setDragging(true)
    dragOffsetRef.current = { dx: e.clientX - posRef.current.x, dy: e.clientY - posRef.current.y }
    e.preventDefault()
  }, [])

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => {
      const off = dragOffsetRef.current
      if (!off) return
      const next = { x: e.clientX - off.dx, y: e.clientY - off.dy }
      if (onRequestPositionChange) onRequestPositionChange(next)
    }
    const onUp = () => { setDragging(false); dragOffsetRef.current = null }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging, onRequestPositionChange])

  if (!visible) return null

  return (
    <div style={{ position: 'fixed', left: x, top: y, zIndex: 40, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 10px 30px rgba(0,0,0,0.15)', width: 160 }}>
      <div onMouseDown={onHeaderMouseDown} style={{ cursor: 'move', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 0, margin: 0, height: 18, borderBottom: '1px solid #e5e7eb', borderTopLeftRadius: 8, borderTopRightRadius: 8, background: '#4b5563', paddingLeft: 6, paddingRight: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Type size={12} color="#ffffff" aria-hidden />
        </div>
        {onClose && (
          <button onClick={onClose} aria-label="Close" title="Close" style={{ border: 0, background: 'transparent', color: '#d1d5db', cursor: 'pointer', padding: 0, fontSize: 16, lineHeight: 1 }}>×</button>
        )}
      </div>
      <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input type="text" value={text} onChange={(e) => onChangeText(e.currentTarget.value)} aria-label="Text" style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px', color: '#000' }} />
        <select value={fontFamily} onChange={(e) => onChangeFont(e.currentTarget.value)} aria-label="Font family" style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px', color: '#000' }}>
          {FONT_OPTIONS.map((f) => (
            <option key={f} value={f} style={{ fontFamily: f }}>
              {f}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}


