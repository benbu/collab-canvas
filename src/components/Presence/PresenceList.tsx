import { useMemo } from 'react'
import type { RemoteCursor } from '../../hooks/useCursorSync'

export default function PresenceList(props: { selfId: string; cursors: Record<string, RemoteCursor> }) {
  const { selfId, cursors } = props
  const { names, overflow } = useMemo(() => {
    const now = Date.now()
    const cutoffMs = 15000
    const items: Array<{ id: string; name: string; updatedAt: number }> = []
    for (const id in cursors) {
      const c = cursors[id]
      if (!c) continue
      if (now - c.updatedAt > cutoffMs) continue
      const name = c.name && c.name.trim().length > 0 ? c.name : id.slice(0, 4)
      items.push({ id, name, updatedAt: c.updatedAt })
    }
    // include self only if present and within cutoff; above already covers that
    items.sort((a, b) => (b.updatedAt - a.updatedAt) || a.name.localeCompare(b.name))
    const visible = items.slice(0, 10)
    const overflow = items.length > 10 ? items.length - 10 : 0
    return { names: visible.map((i) => i.name), overflow }
  }, [cursors, selfId])

  if (names.length === 0) return null
  return (
    <div className="presenceList" aria-label="active-users">
      {names.map((n, idx) => (
        <span key={`${n}-${idx}`} className="presencePill">{n}</span>
      ))}
      {overflow > 0 && <span className="presenceMore">+{overflow} more</span>}
    </div>
  )
}


