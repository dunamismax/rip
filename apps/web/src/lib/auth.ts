import { accounts, getDb, sessions, users, verifications } from '@rip/db'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { loadEnv } from '#/server/env'
import { AppError } from '#/server/errors'
import { initObservability } from '#/server/observability'

const env = loadEnv()
initObservability()

export const auth = betterAuth({
  secret: env.betterAuthSecret,
  baseURL: env.betterAuthUrl,
  trustedOrigins: [env.appUrl],
  database: drizzleAdapter(getDb(), {
    provider: 'pg',
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification: verifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [tanstackStartCookies()],
})

export async function getSessionFromRequest(request: Request) {
  return auth.api.getSession({
    headers: request.headers,
  })
}

export async function requireSession(request: Request) {
  const session = await getSessionFromRequest(request)

  if (!session?.user) {
    throw new AppError(401, 'Authentication required.')
  }

  return session
}
