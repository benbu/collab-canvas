import type { Shape } from '../hooks/useCanvasState'

export function generateSeedRectangles(count: number): Shape[] {
  const shapes: Shape[] = []
  for (let i = 0; i < count; i++) {
    shapes.push({
      id: `seed-${i}`,
      type: 'rect',
      x: (i % 25) * 80 + 40,
      y: Math.floor(i / 25) * 60 + 40,
      width: 60,
      height: 40,
      fill: `hsl(${(i * 17) % 360},70%,60%)`,
    })
  }
  return shapes
}

export function measureFpsFor(durationMs: number, onResult: (fps: number) => void) {
  const samples: number[] = []
  let last = performance.now()
  let elapsed = 0
  function tick() {
    const now = performance.now()
    const dt = now - last
    last = now
    samples.push(dt)
    elapsed += dt
    if (elapsed < durationMs) requestAnimationFrame(tick)
    else {
      const avgDt = samples.reduce((a, b) => a + b, 0) / samples.length
      const fps = 1000 / avgDt
      onResult(fps)
    }
  }
  requestAnimationFrame(tick)
}


