import { useForm } from '@tanstack/react-form'
import { useMutation } from '@tanstack/react-query'
import { Cpu, LockKeyhole, ShieldCheck, Waves } from 'lucide-react'
import { useState } from 'react'
import { z } from 'zod'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { authClient } from '@/lib/auth-client'

const signInSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters long.'),
})

const signUpSchema = signInSchema.extend({
  name: z.string().min(2, 'Tell rip what to call you.'),
})

type AuthMode = 'sign-in' | 'sign-up'

function getFirstError(errors: unknown[]) {
  const [error] = errors
  return typeof error === 'string' ? error : undefined
}

export function AuthPanel({
  onAuthenticated,
}: {
  onAuthenticated: () => Promise<void>
}) {
  const [mode, setMode] = useState<AuthMode>('sign-in')
  const [error, setError] = useState<string | null>(null)

  const authMutation = useMutation({
    mutationFn: async (values: {
      name: string
      email: string
      password: string
    }) => {
      const schema = mode === 'sign-in' ? signInSchema : signUpSchema
      const parsed = schema.safeParse(values)

      if (!parsed.success) {
        throw new Error('Please review the highlighted fields and try again.')
      }

      const result =
        mode === 'sign-in'
          ? await authClient.signIn.email({
              email: parsed.data.email,
              password: parsed.data.password,
              rememberMe: true,
            })
          : await authClient.signUp.email({
              name: values.name,
              email: parsed.data.email,
              password: parsed.data.password,
            })

      if (result.error) {
        throw new Error(result.error.message ?? 'Authentication failed.')
      }

      await onAuthenticated()
    },
    onError: (mutationError) => {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : 'Authentication failed.'
      )
    },
  })

  const form = useForm({
    defaultValues: {
      name: '',
      email: '',
      password: '',
    },
    onSubmit: async ({ value }) => {
      setError(null)
      await authMutation.mutateAsync(value)
    },
  })

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl items-center px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid w-full gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="overflow-hidden border-none bg-transparent shadow-none">
          <CardContent className="grid gap-8 p-0 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="mesh-panel rounded-[2.4rem] border border-border/60 p-8 lg:p-10">
              <div className="space-y-6">
                <Badge>Node + Vite + Hono</Badge>
                <div className="space-y-4">
                  <p className="font-mono text-xs uppercase tracking-[0.34em] text-muted-foreground">
                    Self-hosted control deck
                  </p>
                  <h1 className="max-w-lg text-4xl font-semibold leading-tight text-foreground sm:text-5xl">
                    rip keeps yt-dlp workflows fast, authenticated, and visible.
                  </h1>
                  <p className="max-w-xl text-base leading-7 text-muted-foreground">
                    Inspect media formats, queue downloads, and monitor progress
                    from a React SPA that now runs against a dedicated Hono API,
                    Prisma persistence, and Better Auth sessions.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <FeatureTile
                    icon={Waves}
                    title="Focused frontend"
                    copy="React, TanStack Router, Query, and Form keep the UI quick without the full-stack framework layer."
                  />
                  <FeatureTile
                    icon={Cpu}
                    title="Dedicated backend"
                    copy="Hono, Prisma, PostgreSQL, and Better Auth handle the protected queue, sessions, and downloader workers."
                  />
                  <FeatureTile
                    icon={ShieldCheck}
                    title="Typed contracts"
                    copy="Zod schemas stay shared across the boundary so the browser and API move in lockstep."
                  />
                  <FeatureTile
                    icon={LockKeyhole}
                    title="Self-hosted by default"
                    copy="Keep the app on your own machine or server without carrying Bun, Start, Drizzle, or OpenTelemetry."
                  />
                </div>
              </div>
            </div>

            <Card className="border-border/70">
              <CardHeader className="space-y-4">
                <div className="flex rounded-full border border-border/80 bg-secondary/70 p-1">
                  <button
                    className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition ${
                      mode === 'sign-in'
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground'
                    }`}
                    onClick={() => {
                      setMode('sign-in')
                      setError(null)
                    }}
                    type="button"
                  >
                    Sign in
                  </button>
                  <button
                    className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition ${
                      mode === 'sign-up'
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground'
                    }`}
                    onClick={() => {
                      setMode('sign-up')
                      setError(null)
                    }}
                    type="button"
                  >
                    Create account
                  </button>
                </div>
                <div>
                  <CardTitle>
                    {mode === 'sign-in'
                      ? 'Welcome back.'
                      : 'Create your operator account.'}
                  </CardTitle>
                  <CardDescription>
                    {mode === 'sign-in'
                      ? 'Pick up where you left off and head straight into the queue.'
                      : 'Create a protected workspace for your download history and workers.'}
                  </CardDescription>
                </div>
              </CardHeader>

              <CardContent>
                <form
                  className="space-y-5"
                  onSubmit={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    void form.handleSubmit()
                  }}
                >
                  {mode === 'sign-up' ? (
                    <form.Field
                      name="name"
                      validators={{
                        onBlur: ({ value }) => {
                          if (mode !== 'sign-up') {
                            return undefined
                          }

                          const result =
                            signUpSchema.shape.name.safeParse(value)
                          return result.success
                            ? undefined
                            : result.error.issues[0]?.message
                        },
                      }}
                    >
                      {(field) => (
                        <FieldShell
                          error={getFirstError(field.state.meta.errors)}
                          id={field.name}
                          label="Name"
                        >
                          <Input
                            autoComplete="name"
                            id={field.name}
                            name={field.name}
                            onBlur={field.handleBlur}
                            onChange={(event) =>
                              field.handleChange(event.target.value)
                            }
                            placeholder="Rip Operator"
                            value={field.state.value}
                          />
                        </FieldShell>
                      )}
                    </form.Field>
                  ) : null}

                  <form.Field
                    name="email"
                    validators={{
                      onBlur: ({ value }) => {
                        const result = signInSchema.shape.email.safeParse(value)
                        return result.success
                          ? undefined
                          : result.error.issues[0]?.message
                      },
                    }}
                  >
                    {(field) => (
                      <FieldShell
                        error={getFirstError(field.state.meta.errors)}
                        id={field.name}
                        label="Email"
                      >
                        <Input
                          autoComplete="email"
                          id={field.name}
                          name={field.name}
                          onBlur={field.handleBlur}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          placeholder="you@example.com"
                          type="email"
                          value={field.state.value}
                        />
                      </FieldShell>
                    )}
                  </form.Field>

                  <form.Field
                    name="password"
                    validators={{
                      onBlur: ({ value }) => {
                        const result =
                          signInSchema.shape.password.safeParse(value)
                        return result.success
                          ? undefined
                          : result.error.issues[0]?.message
                      },
                    }}
                  >
                    {(field) => (
                      <FieldShell
                        error={getFirstError(field.state.meta.errors)}
                        id={field.name}
                        label="Password"
                      >
                        <Input
                          autoComplete={
                            mode === 'sign-in'
                              ? 'current-password'
                              : 'new-password'
                          }
                          id={field.name}
                          minLength={8}
                          name={field.name}
                          onBlur={field.handleBlur}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          placeholder="At least 8 characters"
                          type="password"
                          value={field.state.value}
                        />
                      </FieldShell>
                    )}
                  </form.Field>

                  {error ? (
                    <p className="rounded-2xl bg-rose-100/80 px-4 py-3 text-sm text-rose-700">
                      {error}
                    </p>
                  ) : null}

                  <Button
                    className="w-full"
                    disabled={authMutation.isPending}
                    size="lg"
                    type="submit"
                  >
                    {authMutation.isPending
                      ? 'Working...'
                      : mode === 'sign-in'
                        ? 'Sign in to rip'
                        : 'Create account'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

function FeatureTile({
  icon: Icon,
  title,
  copy,
}: {
  icon: typeof Waves
  title: string
  copy: string
}) {
  return (
    <div className="rounded-[1.7rem] border border-border/70 bg-white/70 p-5 backdrop-blur-sm">
      <Icon className="mb-4 size-5 text-primary" />
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy}</p>
    </div>
  )
}

function FieldShell({
  id,
  label,
  error,
  children,
}: {
  id: string
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground" htmlFor={id}>
        {label}
      </label>
      {children}
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
    </div>
  )
}
