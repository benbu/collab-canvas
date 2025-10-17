import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PresenceList from '../PresenceList'

describe('PresenceList', () => {
  it('renders names, self marked (you), and +N more when overflow', () => {
    const now = Date.now()
    const presence: any = {}
    for (let i = 0; i < 12; i++) {
      presence[`u${i}`] = { id: `u${i}`, name: `User ${i}`, color: '#000', lastSeenMs: now, loggedIn: true }
    }
    render(<PresenceList selfId="u0" presence={presence} />)
    const pills = screen.getAllByText(/User \d+/)
    expect(pills.length).toBe(10)
    // self has (you)
    expect(screen.getByText('User 0 (you)')).toBeTruthy()
    expect(screen.getByText('+2 more')).toBeTruthy()
  })

  it('shows idle icon for entries older than 30s and hides >60s', () => {
    const now = Date.now()
    const presence: any = {
      a: { id: 'a', name: 'Idle', color: '#000', lastSeenMs: now - 31000, loggedIn: true },
      b: { id: 'b', name: 'Fresh', color: '#000', lastSeenMs: now, loggedIn: true },
      c: { id: 'c', name: 'Stale', color: '#000', lastSeenMs: now - 61000, loggedIn: true },
    }
    render(<PresenceList selfId="x" presence={presence} />)
    expect(screen.getByText('Fresh')).toBeTruthy()
    expect(screen.getByText('Idle')).toBeTruthy()
    // idle icon rendered near Idle: we check for title
    expect(screen.getAllByTitle('idle').length).toBeGreaterThan(0)
    // stale hidden
    expect(screen.queryByText('Stale')).toBeNull()
  })
})


