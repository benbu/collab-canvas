import { useCallback, useMemo, useState } from 'react'
import aiTools, { type AiTool } from '../ai/tools'
import type { Shape } from './useCanvasState'

export type AiAssistStatus = 'idle' | 'loading' | 'success' | 'error' | 'needs_confirmation'

export type AiAssistResult = {
  executed: number
  planned: number
  messages?: string[]
}

export type UseAiAssistOptions = {
  roomId: string
  writers: {
    add: (shape: Shape) => Promise<void>
    update: (shape: Shape) => Promise<void>
    remove: (id: string) => Promise<void>
  }
  getState: () => { byId: Record<string, Shape> }
  generateId: () => string
  defaultFill?: string
}

export function useAiAssist(options: UseAiAssistOptions) {
  const { writers, getState, generateId, defaultFill } = options
  const [status, setStatus] = useState<AiAssistStatus>('idle')
  const [lastResult, setLastResult] = useState<AiAssistResult | null>(null)
  const [pendingToolCalls, setPendingToolCalls] = useState<any[] | null>(null)

  const tools: AiTool[] = useMemo(() => aiTools, [])

  const postPrompt = useCallback(async (prompt: string, context?: Record<string, unknown>) => {
    setStatus('loading')
    setLastResult(null)
    try {
      // enforce prompt size limits (client-side)
      const MAX_PROMPT_CHARS = 4000
      const trimmedPrompt = String(prompt ?? '').slice(0, MAX_PROMPT_CHARS)
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: trimmedPrompt, tools, model: 'gpt-4o-mini', temperature: 0.2, context: { defaultFill, ...(context || {}) } }),
      })
      if (!res.ok) throw new Error(`AI request failed: ${res.status}`)
      const data = await res.json()
      const rawToolCalls: any[] = Array.isArray(data?.tool_calls) ? data.tool_calls : []
      const toolCalls = normalizeToolCalls(rawToolCalls)
      try { console.log('[AI Assist][normalized]', toolCalls) } catch {}
      const planned = toolCalls.length
      const deleteCount = toolCalls.filter((c) => c?.name === 'delete_shape').length
      if (planned > 100) {
        setStatus('error')
        setLastResult({ executed: 0, planned, messages: ['Operation cap exceeded (100).'] })
        return { ok: false }
      }
      if (planned > 50 || deleteCount > 0) {
        setPendingToolCalls(toolCalls)
        setStatus('needs_confirmation')
        setLastResult({ executed: 0, planned, messages: deleteCount > 0 ? ['Destructive operation detected'] : undefined })
        return { ok: true, needsConfirmation: true, planned, deleteCount }
      }
      const resExec = await executeToolCalls(toolCalls)
      setStatus(resExec.ok ? 'success' : 'error')
      return resExec
    } catch (e: any) {
      setStatus('error')
      setLastResult({ executed: 0, planned: 0, messages: [e?.message || 'Unexpected error'] })
      return { ok: false, error: e?.message }
    }
  }, [tools, defaultFill, writers, getState, generateId])

  const confirmAndExecute = useCallback(async () => {
    if (!pendingToolCalls) return { ok: false }
    const result = await executeToolCalls(pendingToolCalls)
    setPendingToolCalls(null)
    setStatus(result.ok ? 'success' : 'error')
    return result
  }, [pendingToolCalls])

  const executeToolCalls = useCallback(async (toolCalls: any[]) => {
    let executed = 0
    try {
      for (const call of toolCalls) {
        const name = call?.name
        const args = (call?.arguments ?? call?.function?.arguments) || {}
        logStep(name, args)
        switch (name) {
          case 'create_rectangle': {
            const id = generateId()
            const x = clampNumber(numberOr(args.x, 0), -50000, 50000)
            const y = clampNumber(numberOr(args.y, 0), -50000, 50000)
            const width = clampNumber(positiveNumberOr(args.width, 120), 1, 10000)
            const height = clampNumber(positiveNumberOr(args.height, 80), 1, 10000)
            const fill = validateColorOrDefault(args.fill, defaultFill ?? '#4F46E5')
            await writers.add({ id, type: 'rect', x, y, width, height, fill })
            executed++
            break
          }
          case 'create_circle': {
            const id = generateId()
            const x = clampNumber(numberOr(args.x, 0), -50000, 50000)
            const y = clampNumber(numberOr(args.y, 0), -50000, 50000)
            const radius = clampNumber(positiveNumberOr(args.radius, 40), 1, 2000)
            const fill = validateColorOrDefault(args.fill, defaultFill ?? '#4F46E5')
            await writers.add({ id, type: 'circle', x, y, radius, fill })
            executed++
            break
          }
          case 'create_text': {
            const id = generateId()
            const x = clampNumber(numberOr(args.x, 0), -50000, 50000)
            const y = clampNumber(numberOr(args.y, 0), -50000, 50000)
            const text = clampStringLength(sanitizeText(stringOr(args.text, 'Text')), 500)
            const fontSize = clampNumber(positiveNumberOr(args.fontSize, 18), 8, 200)
            const fill = validateColorOrDefault(args.fill, '#111')
            await writers.add({ id, type: 'text', x, y, text, fontSize, fill })
            executed++
            break
          }
          case 'update_shape': {
            const id = stringOr(args.id, '')
            if (!id) throw new Error('update_shape missing id')
            const next: Shape = { ...(getState().byId[id] as Shape) }
            if (!next) throw new Error('update_shape invalid id')
            if (isNumber(args.x)) next.x = clampNumber(args.x, -50000, 50000)
            if (isNumber(args.y)) next.y = clampNumber(args.y, -50000, 50000)
            if (isNumber(args.width)) next.width = clampNumber(args.width, 1, 10000)
            if (isNumber(args.height)) next.height = clampNumber(args.height, 1, 10000)
            if (isNumber(args.radius)) next.radius = clampNumber(args.radius, 1, 2000)
            if (isString(args.fill)) next.fill = validateColorOrDefault(args.fill, next.fill ?? (defaultFill ?? '#4F46E5'))
            if (isString(args.text)) next.text = clampStringLength(sanitizeText(args.text), 500)
            if (isNumber(args.fontSize)) next.fontSize = clampNumber(positiveNumberOr(args.fontSize, next.fontSize ?? 18), 8, 200)
            if (isNumber(args.rotation)) next.rotation = clampNumber(args.rotation, -360, 360)
            await writers.update(next)
            executed++
            break
          }
          case 'delete_shape': {
            const id = stringOr(args.id, '')
            if (!id) throw new Error('delete_shape missing id')
            await writers.remove(id)
            executed++
            break
          }
          case 'duplicate_shape': {
            const id = stringOr(args.id, '')
            if (!id) throw new Error('duplicate_shape missing id')
            const base = getState().byId[id]
            if (!base) throw new Error('duplicate_shape invalid id')
            const dx = numberOr(args.dx, 20)
            const dy = numberOr(args.dy, 20)
            const newId = generateId()
            await writers.add({ ...base, id: newId, x: base.x + dx, y: base.y + dy })
            executed++
            break
          }
          default: {
            // ignore unknown tool
            break
          }
        }
      }
      const res: AiAssistResult = { executed, planned: toolCalls.length }
      setLastResult(res)
      try { console.log('[AI Assist][summary]', { planned: res.planned, executed: res.executed }) } catch {}
      return { ok: true, ...res }
    } catch (e: any) {
      const res: AiAssistResult = { executed, planned: toolCalls.length, messages: [e?.message || 'Execution error'] }
      setLastResult(res)
      try { console.warn('[AI Assist][summary][error]', { planned: res.planned, executed: res.executed, error: e?.message }) } catch {}
      return { ok: false, ...res }
    }
  }, [writers, getState, generateId, defaultFill])

  const cancelPending = useCallback(() => {
    setPendingToolCalls(null)
    setStatus('idle')
  }, [])

  return { status, lastResult, postPrompt, confirmAndExecute, cancelPending }
}

function isNumber(v: any): v is number { return typeof v === 'number' && !Number.isNaN(v) }
function isString(v: any): v is string { return typeof v === 'string' }
function numberOr(v: any, d: number): number { return isNumber(v) ? v : d }
function positiveNumberOr(v: any, d: number): number { const n = numberOr(v, d); return n > 0 ? n : d }
function stringOr(v: any, d: string): string { return isString(v) ? v : d }

function isHexColor(s: any): boolean {
  if (!isString(s)) return false
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s.trim())
}

function validateColorOrDefault(input: any, fallback: string): string {
  return isHexColor(input) ? String(input) : fallback
}

function logStep(name: string, args: Record<string, unknown>) {
  try {
    // eslint-disable-next-line no-console
    console.log('[AI Assist]', name, args)
  } catch {}
}

function clampNumber(n: number, min: number, max: number): number {
  if (!isNumber(n)) return min
  if (n < min) return min
  if (n > max) return max
  return n
}

function clampStringLength(s: string, max: number): string {
  return String(s).slice(0, max)
}

function sanitizeText(s: string): string {
  // basic sanitization: strip control characters
  return String(s).replace(/[\u0000-\u001F\u007F]/g, '')
}

function normalizeToolCalls(calls: any[]): Array<{ name: string; arguments: any }> {
  const out: Array<{ name: string; arguments: any }> = []
  for (const c of calls) {
    const name = c?.name || c?.function?.name
    let args: any = c?.arguments ?? c?.function?.arguments ?? {}
    if (typeof args === 'string') {
      try { args = JSON.parse(args) } catch { args = {} }
    }
    if (name) out.push({ name, arguments: args })
  }
  return out
}


