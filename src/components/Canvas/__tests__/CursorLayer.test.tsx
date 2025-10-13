import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import CursorLayer from '../CursorLayer'

describe('CursorLayer', () => {
  it('renders remote cursor markers', () => {
    render(
      <svg>
        <CursorLayer cursors={[{ id: 'u1', x: 10, y: 20, color: '#f00', updatedAt: Date.now() }]} />
      </svg>,
    )
    // our react-konva mock renders Line/Text divs
    // ensure something rendered (smoke)
    expect(screen.getAllByTestId('layer').length).toBeGreaterThan(0)
  })
})


