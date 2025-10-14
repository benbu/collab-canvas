import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PresenceList from '../PresenceList'

describe('PresenceList', () => {
  it('renders names and +N more when overflow', () => {
    const now = Date.now()
    const mk = (i: number) => ({ id: `u${i}`, x: 0, y: 0, color: '#000', name: `User ${i}`, updatedAt: now })
    const cursors: any = {}
    for (let i = 0; i < 12; i++) cursors[`u${i}`] = mk(i)
    render(<PresenceList selfId="u0" cursors={cursors} />)
    // 10 visible
    const pills = screen.getAllByText(/User \d+/)
    expect(pills.length).toBe(10)
    // +2 more
    expect(screen.getByText('+2 more')).toBeTruthy()
  })

  it('hides stale entries older than 15s', () => {
    const old = Date.now() - 16000
    const cursors: any = {
      a: { id: 'a', x: 0, y: 0, color: '#000', name: 'Old', updatedAt: old },
      b: { id: 'b', x: 0, y: 0, color: '#000', name: 'New', updatedAt: Date.now() },
    }
    render(<PresenceList selfId="a" cursors={cursors} />)
    expect(screen.queryByText('Old')).toBeNull()
    expect(screen.getByText('New')).toBeTruthy()
  })
})


