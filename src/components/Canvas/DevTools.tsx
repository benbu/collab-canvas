import { useState, useEffect } from 'react'
import type { Shape } from '../../hooks/useCanvasState'
import { generateSeedRectangles, measureFpsFor } from '../../utils/devSeed'
import { perfMonitor } from '../../utils/performance'

interface DevToolsProps {
  onAddShape: (shape: Omit<Shape, 'id'> & { id?: string }) => void
}

export default function DevTools({ onAddShape }: DevToolsProps) {
  const [perfEnabled, setPerfEnabled] = useState(perfMonitor.isEnabled())
  const [showOverlay, setShowOverlay] = useState(false)
  const [fps, setFps] = useState(0)
  const [stats, setStats] = useState<Record<string, any>>({})

  // Update stats every 500ms when enabled
  useEffect(() => {
    if (!perfEnabled) return

    const interval = setInterval(() => {
      const summary = perfMonitor.getPerformanceSummary()
      setFps(summary.fps)
      setStats(summary.stats)
    }, 500)

    return () => clearInterval(interval)
  }, [perfEnabled])

  const togglePerfMonitoring = () => {
    const newState = !perfEnabled
    perfMonitor.setEnabled(newState)
    setPerfEnabled(newState)
    if (newState) {
      setShowOverlay(true)
    } else {
      setShowOverlay(false)
    }
  }

  const handleExport = () => {
    const json = perfMonitor.exportAsJSON()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `perf-report-${Date.now()}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleClear = () => {
    perfMonitor.clear()
    setStats({})
    setFps(0)
  }

  // Show in dev mode, or if perf monitoring is enabled via URL param
  if (!import.meta.env.DEV && !perfMonitor.isEnabled()) return null

  return (
    <>
      <div style={{ position: 'fixed', bottom: 12, left: 12, display: 'flex', gap: 8, zIndex: 10 }}>
        {import.meta.env.DEV && (
          <>
            <button
              onClick={() => {
                const seeds = generateSeedRectangles(500)
                seeds.forEach((s) => onAddShape(s as any))
              }}
            >
              Seed 500
            </button>
            <button
              onClick={() => {
                measureFpsFor(1000, () => {
                  // FPS measurement result is not logged to console
                  // It can be viewed in the performance monitor overlay
                })
              }}
            >
              Measure FPS
            </button>
          </>
        )}
        <button
          onClick={togglePerfMonitoring}
          style={{
            backgroundColor: perfEnabled ? '#4caf50' : '#666',
            color: 'white',
            fontWeight: 'bold',
          }}
        >
          {perfEnabled ? '⏸️ Perf' : '▶️ Perf'}
        </button>
        {perfEnabled && (
          <>
            <button onClick={() => setShowOverlay(!showOverlay)}>
              {showOverlay ? '👁️ Hide' : '👁️ Show'}
            </button>
            <button onClick={handleExport}>💾 Export</button>
            <button onClick={handleClear}>🗑️ Clear</button>
          </>
        )}
      </div>

      {perfEnabled && showOverlay && (
        <div
          style={{
            position: 'fixed',
            top: 12,
            right: 12,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            color: '#fff',
            padding: '16px',
            borderRadius: '8px',
            fontFamily: 'monospace',
            fontSize: '12px',
            maxWidth: '400px',
            maxHeight: '80vh',
            overflow: 'auto',
            zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '14px' }}>Performance Monitor</h3>
            <button
              onClick={() => setShowOverlay(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '16px',
              }}
            >
              ✕
            </button>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: fps >= 55 ? '#4caf50' : fps >= 30 ? '#ff9800' : '#f44336' }}>
              {fps} FPS
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Section title="🔥 Firestore Operations">
              <Stat label="Writes" stats={stats['firestore-write']} />
              <Stat label="Reads" stats={stats['firestore-read']} />
              <Stat label="Throttled" stats={stats['firestore-throttled']} />
            </Section>

            <Section title="🎮 Character">
              <Stat label="Sync" stats={stats['character-sync']} />
              <Stat label="Physics" stats={stats['character-physics']} />
            </Section>

            <Section title="✏️ Shape Operations">
              <Stat label="Edit" stats={stats['shape-edit']} />
              <Stat label="Render" stats={stats['shape-render']} />
            </Section>

            <Section title="🎨 Rendering">
              <Stat label="Cycle" stats={stats['render-cycle']} />
              <Stat label="Auto-pan" stats={stats['auto-pan']} />
            </Section>

            <Section title="🖱️ Events">
              <Stat label="Handlers" stats={stats['event-handler']} />
            </Section>
          </div>

          <div style={{ marginTop: '16px', fontSize: '10px', color: '#999' }}>
            Tip: Use Export to save detailed report
          </div>
        </div>
      )}
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ borderBottom: '1px solid #444', paddingBottom: '8px' }}>
      <div style={{ fontWeight: 'bold', marginBottom: '6px', color: '#aaa' }}>{title}</div>
      {children}
    </div>
  )
}

function Stat({ label, stats }: { label: string; stats?: any }) {
  if (!stats) {
    return (
      <div style={{ paddingLeft: '8px', color: '#666' }}>
        {label}: —
      </div>
    )
  }

  return (
    <div style={{ paddingLeft: '8px', marginBottom: '4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>{label}:</span>
        <span style={{ fontWeight: 'bold' }}>{stats.count}x</span>
      </div>
      <div style={{ fontSize: '10px', color: '#999', paddingLeft: '4px' }}>
        avg: {stats.avgDuration.toFixed(2)}ms | 
        max: {stats.maxDuration.toFixed(2)}ms |
        last: {stats.lastDuration.toFixed(2)}ms
      </div>
    </div>
  )
}

