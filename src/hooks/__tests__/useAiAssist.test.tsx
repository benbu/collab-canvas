import { useEffect } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, waitFor } from '@testing-library/react'
import { useAiAssist } from '../useAiAssist'
import type { Shape } from '../useCanvasState'

const ORIGINAL_FETCH = global.fetch

function TestComponent(props: {
  prompt: string
  toolCalls: any[]
  onDone: (payload: any) => void
  mode?: 'auto'
  state?: { byId: Record<string, Shape> }
  defaultFill?: string
}) {
  const writers = {
    add: vi.fn(async () => {}),
    update: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
  }
  const generateId = (() => {
    let n = 0
    return () => `gen-${++n}`
  })()
  const hook = useAiAssist({
    roomId: 'room',
    writers,
    getState: () => props.state || { byId: {} },
    generateId,
    defaultFill: props.defaultFill || '#4F46E5',
  })

  useEffect(() => {
    if (props.mode === 'auto') {
      void (async () => {
        const res = await hook.postPrompt(props.prompt)
        setTimeout(() => {
          props.onDone(res)
        }, 0)
      })()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // expose writers to window for assertions
  ;(window as any).__writers = writers
  return <div data-testid="status">{hook.status}</div>
}

describe('useAiAssist', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })
  afterEach(() => {
    cleanup()
    global.fetch = ORIGINAL_FETCH as any
  })

  it('returns success and execution counts for single create', async () => {
    global.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({ tool_calls: [ { name: 'create_rectangle', arguments: { x: 10, y: 20, width: 200, height: 100, fill: '#ff0000' } } ] }),
        { status: 200, headers: { 'content-type': 'application/json' } } as any,
      )
    }) as any

    const onDone = vi.fn()
    render(
      <TestComponent prompt="add" toolCalls={[]} onDone={onDone} mode="auto" />
    )
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    const payload = onDone.mock.calls[0][0]
    expect(payload.ok).toBe(true)
    expect(payload.executed).toBe(1)
    expect(payload.planned).toBe(1)
  })

  it('triggers needs_confirmation when >50 planned steps', async () => {
    const many = Array.from({ length: 51 }).map(() => ({ name: 'create_circle', arguments: { x: 0, y: 0, radius: 10 } }))
    global.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({ tool_calls: many }), { status: 200, headers: { 'content-type': 'application/json' } })
    }) as any

    const onDone = vi.fn()
    render(<TestComponent prompt="many" toolCalls={[]} onDone={onDone} mode="auto" />)
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    const payload = onDone.mock.calls[0][0]
    expect(payload.needsConfirmation).toBe(true)
    expect(payload.planned).toBe(51)
  })

  it('errors when >100 planned steps', async () => {
    const many = Array.from({ length: 101 }).map(() => ({ name: 'create_circle', arguments: { x: 0, y: 0, radius: 10 } }))
    global.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({ tool_calls: many }), { status: 200, headers: { 'content-type': 'application/json' } })
    }) as any

    const onDone = vi.fn()
    render(<TestComponent prompt="too-many" toolCalls={[]} onDone={onDone} mode="auto" />)
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    const payload = onDone.mock.calls[0][0]
    expect(payload.ok).toBe(false)
  })

  it('flags destructive operations for confirmation', async () => {
    global.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({ tool_calls: [ { name: 'delete_shape', arguments: { id: 'a' } } ] }), { status: 200, headers: { 'content-type': 'application/json' } })
    }) as any
    const onDone = vi.fn()
    render(<TestComponent prompt="delete" toolCalls={[]} onDone={onDone} mode="auto" />)
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    const payload = onDone.mock.calls[0][0]
    expect(payload.needsConfirmation).toBe(true)
  })

  it('coerces invalid color and negative radius to safe defaults', async () => {
    global.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({ tool_calls: [ { name: 'create_circle', arguments: { x: 0, y: 0, radius: -5, fill: 'nope' } } ] }), { status: 200, headers: { 'content-type': 'application/json' } })
    }) as any
    const onDone = vi.fn()
    render(<TestComponent prompt="validate" toolCalls={[]} onDone={onDone} mode="auto" defaultFill="#123456" />)
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    const payload = onDone.mock.calls[0][0]
    expect(payload.ok).toBe(true)
    expect(payload.executed).toBe(1)
  })
})


