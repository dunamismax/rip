import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

declare global {
  var __ripPrisma: PrismaClient | undefined
}

export function getPrisma() {
  const connectionString =
    process.env.DATABASE_URL ??
    'postgresql://postgres:postgres@127.0.0.1:5432/rip'

  const prisma =
    globalThis.__ripPrisma ??
    new PrismaClient({
      adapter: new PrismaPg({
        connectionString,
      }),
      log:
        process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    })

  if (process.env.NODE_ENV !== 'production') {
    globalThis.__ripPrisma = prisma
  }

  return prisma
}

export const prisma = getPrisma()
