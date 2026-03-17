import { serve } from '@hono/node-server'
import { createApp } from './app'
import { loadEnv } from './env'

const env = loadEnv()
const app = createApp()

serve(
  {
    fetch: app.fetch,
    port: env.port,
  },
  (info) => {
    console.log(`rip api listening on http://127.0.0.1:${info.port}`)
  }
)
