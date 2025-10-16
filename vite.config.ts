import { defineConfig, type Plugin, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'dev-ai-proxy',
      apply: 'serve',
      configResolved(config) {
        // Load .env and promote gateway URL into process.env for the Node-side handler
        const env = loadEnv(config.mode, process.cwd(), '')
        const val = env.VERCEL_AI_GATEWAY_URL || env.VITE_VERCEL_AI_GATEWAY_URL
        if (val && !process.env.VERCEL_AI_GATEWAY_URL) {
          process.env.VERCEL_AI_GATEWAY_URL = val
        }
        // Also load optional auth tokens and provider key for dev convenience
        if (env.VERCEL_AI_GATEWAY_TOKEN && !process.env.VERCEL_AI_GATEWAY_TOKEN) {
          process.env.VERCEL_AI_GATEWAY_TOKEN = env.VERCEL_AI_GATEWAY_TOKEN
        }
        if (env.VERCEL_AI_GATEWAY_AUTH && !process.env.VERCEL_AI_GATEWAY_AUTH) {
          process.env.VERCEL_AI_GATEWAY_AUTH = env.VERCEL_AI_GATEWAY_AUTH
        }
        if (env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY) {
          process.env.OPENAI_API_KEY = env.OPENAI_API_KEY
        }
      },
      configureServer(server) {
        server.middlewares.use('/api/ai', async (req: IncomingMessage, res: ServerResponse) => {
          try {
            const mod = await import('./api/ai.ts')
            const handler = mod.default as (r: Request) => Promise<Response>

            const chunks: Buffer[] = []
            await new Promise<void>((resolve) => {
              req.on('data', (c: Buffer) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
              req.on('end', () => resolve())
            })

            const url = `http://localhost${req.url || '/api/ai'}`
            const reqInit: RequestInit = {
              method: req.method,
              headers: new Headers((req.headers as Record<string, string | string[] | undefined>) as any),
              body: chunks.length ? Buffer.concat(chunks) : undefined,
            }
            const webReq = new Request(url, reqInit)
            const webRes = await handler(webReq)

            res.statusCode = webRes.status
            webRes.headers.forEach((value, key) => res.setHeader(key, value))
            const body = await webRes.arrayBuffer()
            res.end(Buffer.from(body))
          } catch (e: any) {
            res.statusCode = 500
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ error: 'Dev middleware error', message: e?.message || String(e) }))
          }
        })
      },
    } as Plugin,
  ],
})
