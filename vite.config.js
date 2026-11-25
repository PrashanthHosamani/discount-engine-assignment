import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

function localApiPlugin() {
  return {
    name: 'local-api-parse-rule',
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), '')
      if (env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY) {
        process.env.GEMINI_API_KEY = env.GEMINI_API_KEY
      }

      server.middlewares.use('/api/parse-rule', (req, res) => {
        const chunks = []
        req.on('data', (c) => chunks.push(c))
        req.on('end', async () => {
          try {
            const raw = Buffer.concat(chunks).toString('utf8')
            req.body = raw ? JSON.parse(raw) : {}
          } catch {
            req.body = {}
          }
          res.status = (code) => {
            res.statusCode = code
            return res
          }
          res.json = (payload) => {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(payload))
          }
          const { default: parseRuleHandler } = await server.ssrLoadModule('/api/parse-rule.js')
          await parseRuleHandler(req, res)
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), localApiPlugin()],
})
