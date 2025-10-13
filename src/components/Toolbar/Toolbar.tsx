export type Tool = 'select' | 'rect' | 'circle' | 'text'

export default function Toolbar(props: {
  activeTool: Tool
  onToolChange: (t: Tool) => void
  color: string
  onColorChange: (c: string) => void
  text: string
  onTextChange: (t: string) => void
}) {
  const { activeTool, onToolChange, color, onColorChange, text, onTextChange } = props
  return (
    <div style={{ position: 'fixed', top: 12, left: 12, background: '#fff', padding: 8, borderRadius: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', display: 'flex', gap: 8 }}>
      {(['select', 'rect', 'circle', 'text'] as Tool[]).map((t) => (
        <button
          key={t}
          onClick={() => onToolChange(t)}
          style={{
            padding: '6px 10px',
            borderRadius: 4,
            border: '1px solid #ddd',
            background: activeTool === t ? '#eef' : '#fafafa',
          }}
        >
          {t}
        </button>
      ))}
      <input aria-label="color" type="color" value={color} onChange={(e) => onColorChange(e.target.value)} />
      <input aria-label="text" type="text" placeholder="Text" value={text} onChange={(e) => onTextChange(e.target.value)} />
    </div>
  )
}


