/**
 * Performance monitoring utilities for profiling app performance
 * Focuses on Firestore sync, character operations, and rendering
 */

export type PerformanceCategory = 
  | 'firestore-write'
  | 'firestore-read'
  | 'firestore-throttled'
  | 'character-sync'
  | 'character-physics'
  | 'shape-edit'
  | 'shape-render'
  | 'render-cycle'
  | 'event-handler'
  | 'auto-pan'

interface TimingEntry {
  category: PerformanceCategory
  operation: string
  duration: number
  timestamp: number
}

interface PerformanceStats {
  count: number
  totalDuration: number
  avgDuration: number
  minDuration: number
  maxDuration: number
  lastDuration: number
}

class PerformanceMonitor {
  private enabled = false
  private timings: TimingEntry[] = []
  private markers = new Map<string, number>()
  
  // FPS tracking
  private fpsFrames: number[] = []
  private lastFpsTime = 0
  private currentFps = 0
  
  // Operation counters
  private operationCounts = new Map<string, number>()

  constructor() {
    // Check URL parameter and localStorage
    const urlParams = new URLSearchParams(window.location.search)
    const urlEnabled = urlParams.get('perf') === 'true'
    const storedEnabled = localStorage.getItem('perf-monitoring-enabled') === 'true'
    
    this.enabled = urlEnabled || storedEnabled
    
    if (this.enabled) {
      console.log('[PerformanceMonitor] Enabled via', urlEnabled ? 'URL param' : 'localStorage')
    }
  }

  isEnabled(): boolean {
    return this.enabled
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    localStorage.setItem('perf-monitoring-enabled', enabled.toString())
    
    if (!enabled) {
      this.clear()
    }
  }

  markStart(label: string): void {
    if (!this.enabled) return
    this.markers.set(label, performance.now())
  }

  markEnd(label: string, category: PerformanceCategory, operation?: string): number | null {
    if (!this.enabled) return null
    
    const startTime = this.markers.get(label)
    if (startTime === undefined) {
      console.warn(`[PerformanceMonitor] No start marker for "${label}"`)
      return null
    }
    
    const duration = performance.now() - startTime
    this.markers.delete(label)
    
    this.logTiming(category, operation || label, duration)
    return duration
  }

  logTiming(category: PerformanceCategory, operation: string, duration: number): void {
    if (!this.enabled) return
    
    this.timings.push({
      category,
      operation,
      duration,
      timestamp: Date.now(),
    })
    
    // Increment operation counter
    const key = `${category}:${operation}`
    this.operationCounts.set(key, (this.operationCounts.get(key) || 0) + 1)
    
    // Keep last 1000 entries to prevent memory bloat
    if (this.timings.length > 1000) {
      this.timings = this.timings.slice(-1000)
    }
  }

  incrementCounter(category: PerformanceCategory, operation: string): void {
    if (!this.enabled) return
    
    const key = `${category}:${operation}`
    this.operationCounts.set(key, (this.operationCounts.get(key) || 0) + 1)
  }

  // FPS tracking
  recordFrame(): void {
    if (!this.enabled) return
    
    const now = performance.now()
    
    if (this.lastFpsTime === 0) {
      this.lastFpsTime = now
      return
    }
    
    const delta = now - this.lastFpsTime
    this.lastFpsTime = now
    
    this.fpsFrames.push(delta)
    
    // Calculate FPS every fpsUpdateInterval ms
    if (this.fpsFrames.length >= 10) {
      const avgDelta = this.fpsFrames.reduce((a, b) => a + b, 0) / this.fpsFrames.length
      this.currentFps = 1000 / avgDelta
      this.fpsFrames = []
    }
  }

  getFPS(): number {
    return Math.round(this.currentFps)
  }

  getStatsByCategory(category: PerformanceCategory): PerformanceStats | null {
    const entries = this.timings.filter(t => t.category === category)
    
    if (entries.length === 0) return null
    
    const durations = entries.map(e => e.duration)
    const totalDuration = durations.reduce((a, b) => a + b, 0)
    
    return {
      count: entries.length,
      totalDuration,
      avgDuration: totalDuration / entries.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      lastDuration: entries[entries.length - 1]?.duration || 0,
    }
  }

  getOperationCount(category: PerformanceCategory, operation: string): number {
    const key = `${category}:${operation}`
    return this.operationCounts.get(key) || 0
  }

  getAllStats(): Map<PerformanceCategory, PerformanceStats> {
    const statsMap = new Map<PerformanceCategory, PerformanceStats>()
    
    const categories: PerformanceCategory[] = [
      'firestore-write',
      'firestore-read',
      'firestore-throttled',
      'character-sync',
      'character-physics',
      'shape-edit',
      'shape-render',
      'render-cycle',
      'event-handler',
      'auto-pan',
    ]
    
    categories.forEach(category => {
      const stats = this.getStatsByCategory(category)
      if (stats) {
        statsMap.set(category, stats)
      }
    })
    
    return statsMap
  }

  getPerformanceSummary() {
    const summary = {
      enabled: this.enabled,
      fps: this.getFPS(),
      stats: {} as Record<string, PerformanceStats>,
      recentTimings: this.timings.slice(-50), // Last 50 entries
      operationCounts: Object.fromEntries(this.operationCounts),
    }
    
    this.getAllStats().forEach((stats, category) => {
      summary.stats[category] = stats
    })
    
    return summary
  }

  exportAsJSON(): string {
    return JSON.stringify(this.getPerformanceSummary(), null, 2)
  }

  clear(): void {
    this.timings = []
    this.markers.clear()
    this.fpsFrames = []
    this.lastFpsTime = 0
    this.currentFps = 0
    this.operationCounts.clear()
    console.log('[PerformanceMonitor] Cleared all data')
  }
}

// Singleton instance
export const perfMonitor = new PerformanceMonitor()

// Convenience functions
export const markStart = (label: string) => perfMonitor.markStart(label)
export const markEnd = (label: string, category: PerformanceCategory, operation?: string) => 
  perfMonitor.markEnd(label, category, operation)
export const logTiming = (category: PerformanceCategory, operation: string, duration: number) =>
  perfMonitor.logTiming(category, operation, duration)
export const recordFrame = () => perfMonitor.recordFrame()
export const getFPS = () => perfMonitor.getFPS()
export const incrementCounter = (category: PerformanceCategory, operation: string) =>
  perfMonitor.incrementCounter(category, operation)

