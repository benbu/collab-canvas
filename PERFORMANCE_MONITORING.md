# Performance Monitoring Guide

## Overview

The performance monitoring system has been integrated into the Collab Canvas app to help identify performance bottlenecks, particularly around:
- **Firestore sync operations** (writes, reads, throttling)
- **2D character physics and sync**
- Shape editing and rendering
- Auto-pan camera
- General FPS tracking

## How to Enable

### In Development Mode
Click the "▶️ Perf" button in the bottom-left DevTools panel to enable performance monitoring.

### In Production
Add `?perf=true` to the URL:
```
https://your-app.vercel.app/room/your-room?perf=true
```

The monitoring state persists in localStorage, so you only need to enable it once per browser.

## Using the Performance Monitor

### Enable and View
1. Click **"▶️ Perf"** to enable monitoring (button turns green: **"⏸️ Perf"**)
2. Click **"👁️ Show"** to display the performance overlay
3. The overlay appears in the top-right corner showing real-time metrics

### Performance Overlay Sections

#### FPS Display
- **Green (≥55 FPS)**: Excellent performance
- **Orange (30-54 FPS)**: Moderate performance
- **Red (<30 FPS)**: Poor performance, optimization needed

#### 🔥 Firestore Operations
- **Writes**: Time spent writing to Firestore
  - Includes add, update, updateImmediate, remove operations
- **Reads**: Time spent processing Firestore snapshots
- **Throttled**: Count of operations that were throttled (prevented due to rate limiting)

#### 🎮 Character
- **Sync**: Time spent syncing character state to/from Firestore
  - Writes are throttled to ~30 FPS
- **Physics**: Time spent calculating physics updates
  - Includes collision detection with shapes

#### ✏️ Shape Operations
- **Edit**: Time spent processing shape edits and upserts
  - Shows how long it takes to process remote shape updates
- **Render**: Time spent rendering individual shapes (when instrumented)

#### 🎨 Rendering
- **Cycle**: Full render cycle timing
- **Auto-pan**: Camera auto-panning for character following

#### 🖱️ Events
- **Handlers**: Mouse/touch event handler timing

### Statistics Display
For each category, you'll see:
- **Count (Nx)**: Number of times the operation occurred
- **avg**: Average duration in milliseconds
- **max**: Maximum (slowest) duration
- **last**: Most recent duration

## Exporting Performance Data

1. Click **"💾 Export"** to download a detailed JSON report
2. The report includes:
   - All timing statistics
   - Recent timing entries (last 50 operations)
   - Operation counts
   - Current FPS

Example filename: `perf-report-1729388400000.json`

## Clearing Data

Click **"🗑️ Clear"** to reset all collected performance data and start fresh.

## What to Look For

### High Firestore Write Times
- **Symptom**: Firestore Writes showing >50ms average
- **Causes**: Network latency, too frequent updates, large payloads
- **Solutions**: 
  - Increase throttle interval
  - Reduce data being synced
  - Batch operations

### High Firestore Throttled Count
- **Symptom**: Many operations being throttled
- **Indicates**: Update frequency exceeds throttle interval (80ms for shapes, 33ms for character)
- **Solutions**:
  - Review update frequency
  - Consider debouncing rapid changes

### Low FPS with High Character Physics Time
- **Symptom**: Physics operations taking >10ms
- **Causes**: Too many shapes for collision detection
- **Solutions**:
  - Implement spatial partitioning
  - Optimize collision detection algorithms
  - Reduce collision check radius

### High Shape Edit Times
- **Symptom**: Shape edit operations taking >5ms
- **Causes**: Complex selection logic, frequent re-renders
- **Solutions**:
  - Optimize selection management
  - Add memoization
  - Reduce effect dependencies

## Testing Scenarios

### Baseline Performance
1. Enable monitoring
2. Clear data
3. Create 10-20 shapes
4. Monitor FPS and operation times

### Stress Test
1. Use "Seed 500" button to create 500 shapes
2. Watch Firestore Write times
3. Create a character and test physics
4. Monitor collision detection times

### Real-time Collaboration
1. Open the same room in multiple tabs/browsers
2. Edit shapes simultaneously
3. Monitor Firestore Read times
4. Check for write conflicts and throttling

### Character Physics
1. Create a character
2. Place several platforms (rectangles)
3. Jump between platforms
4. Monitor Physics and Collision timings

## Browser DevTools Integration

The performance markers use the standard Performance API, so you can:

1. Open Chrome DevTools > Performance tab
2. Record a session
3. Look for User Timing markers like:
   - `fs-update-*` (Firestore writes)
   - `fs-snapshot` (Firestore reads)
   - `char-physics` (Character physics)
   - `char-sync-write` (Character sync)
   - `upsert-handler` (Shape edits)
   - `auto-pan` (Camera panning)

## Troubleshooting

### Monitor Not Showing
- Check that you've clicked both "▶️ Perf" (enable) and "👁️ Show" (display)
- In production, ensure `?perf=true` is in URL

### No FPS Data
- FPS tracking starts when monitoring is enabled
- Give it a few seconds to collect frame data

### Operations Not Being Tracked
- Ensure performance monitoring is enabled before performing operations
- Some operations only occur during specific actions (character physics only runs when character is active)

## Performance Targets

Based on the plan success criteria:

- **Target FPS**: 60 FPS (≥55 is acceptable)
- **Firestore Write**: <20ms average
- **Firestore Read**: <10ms average
- **Character Physics**: <5ms average (with <100 shapes)
- **Shape Edit**: <2ms average
- **Auto-pan**: <1ms average

## Next Steps

After collecting performance data:

1. **Identify Bottlenecks**: Look for operations with high avg/max times or low FPS
2. **Prioritize**: Focus on the most frequent or slowest operations
3. **Optimize**: Implement targeted optimizations based on findings
4. **Measure**: Re-test with monitoring to verify improvements
5. **Iterate**: Repeat until performance targets are met

