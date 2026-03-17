import { PrismaClient } from '@prisma/client'

declare global {
  var __ripPrisma: PrismaClient | undefined
}

export function getPrisma() {
  const prisma =
    globalThis.__ripPrisma ??
    new PrismaClient({
      log:
        process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    })

  if (process.env.NODE_ENV !== 'production') {
    globalThis.__ripPrisma = prisma
  }

  return prisma
}

export const prisma = getPrisma()
