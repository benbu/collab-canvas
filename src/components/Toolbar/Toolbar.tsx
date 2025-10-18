import { Hand, MousePointer, Square, Circle as CircleIcon, Type as TypeIcon, Trash2 } from 'lucide-react'
export type Tool = 'pan' | 'select' | 'rect' | 'circle' | 'text'

export default function Toolbar(props: {
  activeTool: Tool
  onToolChange: (t: Tool) => void
  color: string
  onColorChange: (c: string) => void
  text: string
  onTextChange: (t: string) => void
  onRequestClearAll: () => void
}) {
  const { activeTool, onToolChange, color, onColorChange, text, onTextChange, onRequestClearAll } = props
  return (
    <div className="toolbarRoot">
      {(['pan', 'select', 'rect', 'circle', 'text'] as Tool[]).map((t) => {
        const title =
          t === 'pan'
            ? 'Pan (H)'
            : t === 'select'
            ? 'Select (V)'
            : t === 'rect'
            ? 'Rectangle (R)'
            : t === 'circle'
            ? 'Circle (C)'
            : 'Text (T)'
        const aria = title.replace(/ \([A-Z]\)$/i, '')
        return (
          <button
            key={t}
            onClick={() => onToolChange(t)}
            className={activeTool === t ? 'toolBtn active' : 'toolBtn'}
            title={title}
            data-title={title}
            aria-label={aria}
          >
            {t === 'pan' && <Hand size={18} aria-hidden />}
            {t === 'select' && <MousePointer size={18} aria-hidden />}
            {t === 'rect' && <Square size={18} aria-hidden />}
            {t === 'circle' && <CircleIcon size={18} aria-hidden />}
            {t === 'text' && <TypeIcon size={18} aria-hidden />}
            <span className="srOnly">{aria}</span>
          </button>
        )
      })}
      <button
        onClick={onRequestClearAll}
        className="toolBtn"
        title="Clear all shapes"
        data-title="Clear all shapes"
        aria-label="Clear all shapes"
      >
        <Trash2 size={18} aria-hidden />
        <span className="srOnly">Clear all shapes</span>
      </button>
      <input className="colorInput" aria-label="color" type="color" value={color} onChange={(e) => onColorChange(e.target.value)} />
      <input className="srOnly" aria-label="text" type="text" placeholder="Text" value={text} onChange={(e) => onTextChange(e.target.value)} />
    </div>
  )
}


