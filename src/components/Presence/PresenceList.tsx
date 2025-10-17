import { useMemo } from 'react'
import type { PresenceUser } from '../../hooks/usePresence'

export default function PresenceList(props: { selfId: string; presence: Record<string, PresenceUser> }) {
  const { selfId, presence } = props
  const { items, overflow } = useMemo(() => {
    const now = Date.now()
    const hideCutoffMs = 60000
    const idleCutoffMs = 30000
    const items: Array<{ id: string; name: string; color: string; lastSeen: number; idle: boolean; isSelf: boolean }> = []
    for (const id in presence) {
      const p = presence[id]
      if (!p) continue
      const lastSeen = p.lastSeenMs ?? 0
      if (lastSeen === 0) continue
      if (now - lastSeen > hideCutoffMs) continue
      const baseName = p.name && p.name.trim().length > 0 ? p.name : id.slice(0, 4)
      const isSelf = id === selfId
      const name = isSelf ? `${baseName} (you)` : baseName
      const idle = now - lastSeen > idleCutoffMs
      items.push({ id, name, color: p.color ?? '#888', lastSeen, idle, isSelf })
    }
    items.sort((a, b) => a.name.localeCompare(b.name))
    const visible = items.slice(0, 10)
    const overflow = items.length > 10 ? items.length - 10 : 0
    return { items: visible, overflow }
  }, [presence, selfId])

  if (items.length === 0) return null
  return (
    <div className="presenceList" aria-label="active-users">
      {items.map((it, idx) => (
        <span key={`${it.id}-${idx}`} className="presencePill">
          <span aria-hidden style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 9999, background: it.color, marginRight: 6 }} />
          {it.idle && <span aria-label="idle" title="idle" style={{ marginRight: 4 }}>z</span>}
          {it.name}
        </span>
      ))}
      {overflow > 0 && <span className="presenceMore">+{overflow} more</span>}
    </div>
  )
}


