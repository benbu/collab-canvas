// Minimal non-streaming API route for AI Gateway forwarding
// Expects POST { prompt: string, tools?: any[], context?: any, model?: string, temperature?: number }

import aiTools from '../src/ai/tools'

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: { 'content-type': 'application/json' } })
  }

  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const prompt = (body?.prompt as string) || ''
    // Security: ignore client-provided tools and always use server-defined tools
    const tools = aiTools
    const context = body?.context ?? {}
    const model = (body?.model as string) || 'gpt-4o-mini'
    const temperature = typeof body?.temperature === 'number' ? (body?.temperature as number) : 0.2

    if (!prompt || typeof prompt !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid prompt' }), { status: 400, headers: { 'content-type': 'application/json' } })
    }

    const gatewayUrl = process.env.VERCEL_AI_GATEWAY_URL
    if (!gatewayUrl) {
      return new Response(JSON.stringify({ error: 'Missing VERCEL_AI_GATEWAY_URL' }), { status: 500, headers: { 'content-type': 'application/json' } })
    }

    // server-side prompt truncation safeguard
    const MAX_PROMPT_CHARS = 4000
    const safePrompt = String(prompt).slice(0, MAX_PROMPT_CHARS)

    const payload = {
      model,
      temperature,
      messages: [
        { role: 'system', content: 'You translate user instructions into tool calls to manipulate a collaborative canvas.' },
        { role: 'user', content: safePrompt },
      ],
      tools,
      tool_choice: 'auto',
      // Optionally pass minimal context to help the model
      metadata: { context },
    }

    const startedAt = Date.now()
    // basic request logging (no PII; timing + status)
    // eslint-disable-next-line no-console
    console.log('[AI API] -> gateway request', { model, temperature })

    // Authorization strategy:
    // 1) If Vercel AI Gateway inbound token is provided, use it
    // 2) Else if OPENAI_API_KEY is present, forward it (useful when gateway isn't configured with provider key)
    const headers: Record<string, string> = { 'content-type': 'application/json' }
    const gatewayToken = process.env.VERCEL_AI_GATEWAY_TOKEN || process.env.VERCEL_AI_GATEWAY_AUTH
    const openaiKey = process.env.OPENAI_API_KEY
    if (gatewayToken) headers['authorization'] = `Bearer ${gatewayToken}`
    else if (openaiKey) headers['authorization'] = `Bearer ${openaiKey}`
    else {
      // eslint-disable-next-line no-console
      console.warn('[AI API] No Authorization configured. Configure provider key on the Gateway or set OPENAI_API_KEY.')
    }

    const resp = await fetch(gatewayUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })

    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      // eslint-disable-next-line no-console
      console.warn('[AI API] <- gateway error', { status: resp.status, durationMs: Date.now() - startedAt })
      return new Response(JSON.stringify({ error: 'Upstream error', status: resp.status, body: text }), { status: 502, headers: { 'content-type': 'application/json' } })
    }

    const data = await resp.json().catch(() => ({})) as Record<string, any>

    // Normalize tool calls (support common formats)
    const toolCalls =
      data?.tool_calls ||
      data?.choices?.[0]?.message?.tool_calls ||
      data?.choices?.[0]?.delta?.tool_calls ||
      []

    // eslint-disable-next-line no-console
    console.log('[AI API] <- gateway success', { toolCalls: Array.isArray(toolCalls) ? toolCalls.length : 0, durationMs: Date.now() - startedAt })
    return new Response(JSON.stringify({ tool_calls: toolCalls }), { status: 200, headers: { 'content-type': 'application/json' } })
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error('[AI API] unexpected error', { message: e?.message || String(e) })
    return new Response(JSON.stringify({ error: 'Unexpected error', message: e?.message || String(e) }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
}


