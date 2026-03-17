import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { getQueryClient } from '@/lib/query-client'
import { createAppRouter } from '@/router'
import '@/styles.css'

const queryClient = getQueryClient()
const router = createAppRouter(queryClient)

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Missing root element.')
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>
)
