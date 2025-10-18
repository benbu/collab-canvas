import { Hand, MousePointer, Square, Circle as CircleIcon, Type as TypeIcon, Trash2, Download, LayoutGrid, ArrowUpToLine, ArrowDownToLine, ArrowUp, ArrowDown } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'

export type Tool = 'pan' | 'select' | 'rect' | 'circle' | 'text'

const MAX_RECENT_COLORS = 6
const STORAGE_KEY = 'collab-canvas-recent-colors'

export default function Toolbar(props: {
  activeTool: Tool
  onToolChange: (t: Tool) => void
  color: string
  onColorChange: (c: string) => void
  text: string
  onTextChange: (t: string) => void
  onRequestClearAll: () => void
  onExportImage: () => void
  onAutoLayout: () => void
  onBringToFront: () => void
  onBringForward: () => void
  onSendBackward: () => void
  onSendToBack: () => void
}) {
  const { activeTool, onToolChange, color, onColorChange, text, onTextChange, onRequestClearAll, onExportImage, onAutoLayout, onBringToFront, onBringForward, onSendBackward, onSendToBack } = props
  const [recentColors, setRecentColors] = useState<string[]>([])
  const [showRecentColors, setShowRecentColors] = useState(false)
  const colorInputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const colorBeforePickerRef = useRef<string>(color)

  // Load recent colors from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          setRecentColors(parsed)
        }
      }
    } catch (e) {
      console.warn('Failed to load recent colors:', e)
    }
  }, [])

  // Save recent colors to localStorage whenever they change
  useEffect(() => {
    if (recentColors.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(recentColors))
      } catch (e) {
        console.warn('Failed to save recent colors:', e)
      }
    }
  }, [recentColors])

  // Close panel when clicking outside
  useEffect(() => {
    if (!showRecentColors) return

    const handleClickOutside = (e: MouseEvent) => {
      if (
        panelRef.current &&
        colorInputRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        !colorInputRef.current.contains(e.target as Node)
      ) {
        setShowRecentColors(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showRecentColors])

  const addToRecentColors = (newColor: string) => {
    setRecentColors(prev => {
      const filtered = prev.filter(c => c.toLowerCase() !== newColor.toLowerCase())
      const updated = [newColor, ...filtered]
      return updated.slice(0, MAX_RECENT_COLORS)
    })
  }

  const handleColorPickerChange = (newColor: string) => {
    // Just update the color, don't add to recent yet
    onColorChange(newColor)
  }

  const handleColorPickerOpen = () => {
    // Store the color when picker opens
    colorBeforePickerRef.current = color
    if (recentColors.length > 0) {
      setShowRecentColors(true)
    }
  }

  const handleColorPickerClose = () => {
    // Add to recent colors when picker closes (if color changed)
    if (color !== colorBeforePickerRef.current) {
      addToRecentColors(color)
    }
  }

  const handleRecentColorSelect = (c: string) => {
    onColorChange(c)
    addToRecentColors(c)
    setShowRecentColors(false)
  }
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
        onClick={onAutoLayout}
        className="toolBtn"
        title="Auto Layout (L)"
        data-title="Auto Layout (L)"
        aria-label="Auto Layout"
      >
        <LayoutGrid size={18} aria-hidden />
        <span className="srOnly">Auto Layout</span>
      </button>
      <button
        onClick={onBringToFront}
        className="toolBtn"
        title="Bring to Front (Ctrl/Cmd + ])"
        data-title="Bring to Front (Ctrl/Cmd + ])"
        aria-label="Bring to Front"
      >
        <ArrowUpToLine size={18} aria-hidden />
        <span className="srOnly">Bring to Front</span>
      </button>
      <button
        onClick={onBringForward}
        className="toolBtn"
        title="Bring Forward (Ctrl/Cmd + Shift + ])"
        data-title="Bring Forward (Ctrl/Cmd + Shift + ])"
        aria-label="Bring Forward"
      >
        <ArrowUp size={18} aria-hidden />
        <span className="srOnly">Bring Forward</span>
      </button>
      <button
        onClick={onSendBackward}
        className="toolBtn"
        title="Send Backward (Ctrl/Cmd + Shift + [)"
        data-title="Send Backward (Ctrl/Cmd + Shift + [)"
        aria-label="Send Backward"
      >
        <ArrowDown size={18} aria-hidden />
        <span className="srOnly">Send Backward</span>
      </button>
      <button
        onClick={onSendToBack}
        className="toolBtn"
        title="Send to Back (Ctrl/Cmd + [)"
        data-title="Send to Back (Ctrl/Cmd + [)"
        aria-label="Send to Back"
      >
        <ArrowDownToLine size={18} aria-hidden />
        <span className="srOnly">Send to Back</span>
      </button>
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
      <button
        onClick={onExportImage}
        className="toolBtn"
        title="Export as PNG"
        data-title="Export as PNG"
        aria-label="Export as PNG"
      >
        <Download size={18} aria-hidden />
        <span className="srOnly">Export as PNG</span>
      </button>
      
      <div style={{ position: 'relative' }}>
        <input 
          ref={colorInputRef}
          className="colorInput" 
          aria-label="color" 
          type="color" 
          value={color} 
          onChange={(e) => handleColorPickerChange(e.target.value)}
          onClick={handleColorPickerOpen}
          onFocus={handleColorPickerOpen}
          onBlur={handleColorPickerClose}
        />
        
        {/* Recent colors floating panel */}
        {showRecentColors && recentColors.length > 0 && (
          <div ref={panelRef} className="recentColorsPanel">
            <div className="recentColorsPanelHeader">Recent Colors</div>
            <div className="recentColorsGrid">
              {recentColors.map((c, idx) => (
                <button
                  key={`${c}-${idx}`}
                  className="recentColorBtn"
                  style={{ backgroundColor: c }}
                  onClick={() => handleRecentColorSelect(c)}
                  title={`Use color ${c}`}
                  aria-label={`Use recent color ${c}`}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      
      <input className="srOnly" aria-label="text" type="text" placeholder="Text" value={text} onChange={(e) => onTextChange(e.target.value)} />
    </div>
  )
}


