import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

declare global {
  // eslint-disable-next-line no-var
  var __ripPool: Pool | undefined
}

function createPool() {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is required to initialize the database client.'
    )
  }

  return new Pool({
    connectionString,
    max: 10,
  })
}

export function getPool() {
  const pool = globalThis.__ripPool ?? createPool()

  if (process.env.NODE_ENV !== 'production') {
    globalThis.__ripPool = pool
  }

  return pool
}

export function getDb() {
  return drizzle(getPool(), { schema })
}

export type Database = ReturnType<typeof getDb>
