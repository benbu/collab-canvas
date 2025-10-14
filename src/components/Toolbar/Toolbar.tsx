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
    <div className="toolbarRoot">
      {(['select', 'rect', 'circle', 'text'] as Tool[]).map((t) => (
        <button
          key={t}
          onClick={() => onToolChange(t)}
          className={activeTool === t ? 'toolBtn active' : 'toolBtn'}
          title={
            t === 'select'
              ? 'Select (V)'
              : t === 'rect'
              ? 'Rectangle (R)'
              : t === 'circle'
              ? 'Circle (C)'
              : 'Text (T)'
          }
        >
          {t}
        </button>
      ))}
      <input aria-label="color" type="color" value={color} onChange={(e) => onColorChange(e.target.value)} />
      <input aria-label="text" type="text" placeholder="Text" value={text} onChange={(e) => onTextChange(e.target.value)} />
    </div>
  )
}


