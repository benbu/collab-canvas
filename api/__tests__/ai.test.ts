import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
// Import the API handler
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - path is relative to test file
import handler from '../ai'
import aiTools from '../../src/ai/tools'

const ORIGINAL_FETCH = global.fetch
const ORIGINAL_ENV = { ...process.env }

describe('api/ai handler', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    process.env = { ...ORIGINAL_ENV }
  })

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH as any
    process.env = { ...ORIGINAL_ENV }
  })

  it('returns 405 for non-POST', async () => {
    const req = new Request('http://localhost/api/ai', { method: 'GET' })
    const res = await handler(req)
    expect(res.status).toBe(405)
  })

  it('returns 400 for invalid prompt', async () => {
    process.env.VERCEL_AI_GATEWAY_URL = 'https://gateway.example.com'
    const req = new Request('http://localhost/api/ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: '' }),
    })
    const res = await handler(req)
    expect(res.status).toBe(400)
  })

  it('returns 500 when gateway URL missing', async () => {
    delete process.env.VERCEL_AI_GATEWAY_URL
    const req = new Request('http://localhost/api/ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'create a rectangle' }),
    })
    const res = await handler(req)
    expect(res.status).toBe(500)
  })

  it('injects default tools when none provided and returns normalized tool_calls', async () => {
    process.env.VERCEL_AI_GATEWAY_URL = 'https://gateway.example.com'

    let capturedBody: any = null
    global.fetch = vi.fn(async (_url: string, options?: any) => {
      capturedBody = options?.body ? JSON.parse(options.body) : null
      const mock = { choices: [ { message: { tool_calls: [ { name: 'create_rectangle', arguments: { x: 10, y: 20 } } ] } } ] }
      return new Response(JSON.stringify(mock), { status: 200, headers: { 'content-type': 'application/json' } })
    }) as any

    const req = new Request('http://localhost/api/ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'add a rectangle' }),
    })

    const res = await handler(req)
    expect(res.status).toBe(200)
    const data = await res.json() as any
    expect(Array.isArray(data.tool_calls)).toBe(true)
    expect(data.tool_calls[0]?.name).toBe('create_rectangle')

    // Validate default tools were injected
    expect(Array.isArray(capturedBody?.tools)).toBe(true)
    const toolNames = (capturedBody?.tools || []).map((t: any) => t?.function?.name)
    const expected = aiTools.map((t) => t.function.name)
    expect(expected.every((n) => toolNames.includes(n))).toBe(true)
  })
})


