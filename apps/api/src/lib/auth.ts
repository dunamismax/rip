import { SessionResponseSchema } from '@rip/contracts'
import { prisma } from '@rip/db'
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { loadEnv } from '../env'
import { AppError } from './errors'

const env = loadEnv()

export const auth = betterAuth({
  secret: env.betterAuthSecret,
  baseURL: env.betterAuthUrl,
  trustedOrigins: [env.appUrl, env.apiUrl],
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
  },
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

export async function getSessionResponse(request: Request) {
  const session = await getSessionFromRequest(request)

  return SessionResponseSchema.parse({
    user: session?.user
      ? {
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
          image: session.user.image ?? null,
        }
      : null,
    session: session?.session
      ? {
          id: session.session.id,
          userId: session.session.userId,
          expiresAt: session.session.expiresAt.toISOString(),
          createdAt: session.session.createdAt.toISOString(),
          updatedAt: session.session.updatedAt.toISOString(),
        }
      : null,
  })
}
