import { useMemo } from 'react'
import type { RemoteCursor } from '../../hooks/useCursorSync'

export default function PresenceList(props: { selfId: string; cursors: Record<string, RemoteCursor> }) {
  const { selfId, cursors } = props
  const { items, overflow } = useMemo(() => {
    const now = Date.now()
    const cutoffMs = 15000
    const items: Array<{ id: string; name: string; color: string; updatedAt: number }> = []
    for (const id in cursors) {
      const c = cursors[id]
      if (!c) continue
      if (now - c.updatedAt > cutoffMs) continue
      const name = c.name && c.name.trim().length > 0 ? c.name : id.slice(0, 4)
      items.push({ id, name, color: c.color, updatedAt: c.updatedAt })
    }
    // include self only if present and within cutoff; above already covers that
    items.sort((a, b) => (b.updatedAt - a.updatedAt) || a.name.localeCompare(b.name))
    const visible = items.slice(0, 10)
    const overflow = items.length > 10 ? items.length - 10 : 0
    return { items: visible, overflow }
  }, [cursors, selfId])

  if (items.length === 0) return null
  return (
    <div className="presenceList" aria-label="active-users">
      {items.map((it, idx) => (
        <span key={`${it.id}-${idx}`} className="presencePill">
          <span aria-hidden style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 9999, background: it.color, marginRight: 6 }} />
          {it.name}
        </span>
      ))}
      {overflow > 0 && <span className="presenceMore">+{overflow} more</span>}
    </div>
  )
}


