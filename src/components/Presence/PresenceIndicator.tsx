import { usePresence } from '../../hooks/usePresence'

export default function PresenceIndicator(props: { roomId: string; selfId: string }) {
  const { roomId, selfId } = props
  const { presence } = usePresence(roomId, selfId)
  return (
    <div style={{ position: 'fixed', top: 12, right: 12, display: 'flex', gap: 8 }}>
      {presence.map((p) => (
        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: 8, background: p.color ?? '#999', display: 'inline-block' }} />
          <span style={{ fontSize: 12 }}>{p.name ?? p.id.slice(0, 4)}</span>
        </div>
      ))}
    </div>
  )
}


