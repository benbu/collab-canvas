import type { Shape } from '../../hooks/useCanvasState'
import { generateSeedRectangles, measureFpsFor } from '../../utils/devSeed'

interface DevToolsProps {
  onAddShape: (shape: Omit<Shape, 'id'> & { id?: string }) => void
}

export default function DevTools({ onAddShape }: DevToolsProps) {
  if (!import.meta.env.DEV) return null

  return (
    <div style={{ position: 'fixed', bottom: 12, left: 12, display: 'flex', gap: 8, zIndex: 10 }}>
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
          measureFpsFor(1000, (fps) => {
            // eslint-disable-next-line no-console
            console.log('FPS ~', Math.round(fps))
          })
        }}
      >
        Measure FPS
      </button>
    </div>
  )
}

