import type { ZodType } from 'zod'
import { loadEnv } from '../env'
import { AppError } from './errors'

export function getClientIp(request: Request) {
  const env = loadEnv()
  const peerHost =
    request.headers.get('x-real-ip')?.trim() ||
    request.headers.get('cf-connecting-ip')?.trim() ||
    '127.0.0.1'
  const forwardedFor = request.headers.get('x-forwarded-for')

  if (forwardedFor && env.trustedProxyHosts.includes(peerHost)) {
    const forwardedHost = forwardedFor.split(',')[0]?.trim()

    if (forwardedHost) {
      return forwardedHost
    }
  }

  return peerHost
}

export async function readJsonBody(request: Request) {
  const env = loadEnv()
  const body = await request.text()
  const size = new TextEncoder().encode(body).byteLength

  if (size > env.requestBodyLimitBytes) {
    throw new AppError(413, 'Request body too large.')
  }

  try {
    return JSON.parse(body || '{}')
  } catch (error) {
    throw new AppError(400, 'Invalid JSON body.', error)
  }
}

export async function readValidatedJson<T>(
  request: Request,
  schema: ZodType<T>,
  invalidMessage: string
) {
  const payload = await readJsonBody(request)
  const result = await schema.safeParseAsync(payload)

  if (!result.success) {
    throw new AppError(400, invalidMessage, result.error)
  }

  return result.data
}
