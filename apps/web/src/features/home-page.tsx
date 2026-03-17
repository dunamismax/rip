import { useQuery, useQueryClient } from '@tanstack/react-query'
import { LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { api } from '@/lib/api'
import { authClient } from '@/lib/auth-client'
import { AuthPanel } from './auth/auth-panel'
import { DashboardPage } from './dashboard/dashboard-page'

export function HomePage() {
  const queryClient = useQueryClient()
  const sessionQuery = useQuery({
    queryKey: ['session'],
    queryFn: api.getSession,
  })

  if (sessionQuery.isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center gap-3 p-8 text-muted-foreground">
            <LoaderCircle className="size-5 animate-spin" />
            Loading rip...
          </CardContent>
        </Card>
      </main>
    )
  }

  if (sessionQuery.error) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-xl">
          <CardContent className="space-y-4 p-8">
            <h1 className="text-2xl font-semibold text-foreground">
              The control deck could not load.
            </h1>
            <p className="text-sm leading-6 text-muted-foreground">
              {sessionQuery.error instanceof Error
                ? sessionQuery.error.message
                : 'Unexpected session error.'}
            </p>
            <Button onClick={() => void sessionQuery.refetch()} type="button">
              Try again
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  if (!sessionQuery.data?.user) {
    return (
      <AuthPanel
        onAuthenticated={async () => {
          await queryClient.invalidateQueries({
            queryKey: ['session'],
          })
        }}
      />
    )
  }

  const user = sessionQuery.data.user

  return (
    <DashboardPage
      onSignOut={async () => {
        await authClient.signOut()
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: ['session'],
          }),
          queryClient.removeQueries({
            queryKey: ['downloads'],
          }),
        ])
      }}
      user={user}
    />
  )
}
