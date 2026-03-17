import * as z from 'zod'

const NonEmptyString = z.string().min(1)

export const SessionUserSchema = z.object({
  id: NonEmptyString,
  name: NonEmptyString,
  email: z.string().email(),
  image: z.string().nullable(),
})

export const SessionSchema = z.object({
  id: NonEmptyString,
  userId: NonEmptyString,
  expiresAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const SessionResponseSchema = z.object({
  user: SessionUserSchema.nullable(),
  session: SessionSchema.nullable(),
})

export type SessionUser = z.infer<typeof SessionUserSchema>
export type SessionData = z.infer<typeof SessionSchema>
export type SessionResponse = z.infer<typeof SessionResponseSchema>
