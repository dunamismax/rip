import type { QueryClient } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { HomePage } from '@/features/home-page'

type RouterContext = {
  queryClient: QueryClient
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
})

const routeTree = rootRoute.addChildren([indexRoute])

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: {
      queryClient,
    },
    defaultPreload: 'intent',
    scrollRestoration: true,
  })
}

function RootLayout() {
  const showDevtools = import.meta.env.DEV

  return (
    <>
      <Outlet />
      {showDevtools ? <TanStackRouterDevtools position="bottom-left" /> : null}
      {showDevtools ? (
        <ReactQueryDevtools buttonPosition="bottom-right" />
      ) : null}
    </>
  )
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
