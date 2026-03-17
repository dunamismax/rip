import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '../../', '')

  return {
    envDir: '../../',
    plugins: [tailwindcss(), react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      host: '127.0.0.1',
      port: 3000,
      proxy: {
        '/api': {
          target: env.API_URL || 'http://127.0.0.1:3001',
          changeOrigin: false,
        },
      },
    },
    preview: {
      host: '127.0.0.1',
      port: 4173,
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            tanstack: [
              '@tanstack/react-form',
              '@tanstack/react-query',
              '@tanstack/react-query-devtools',
              '@tanstack/react-router',
              '@tanstack/react-router-devtools',
            ],
            ui: [
              '@radix-ui/react-progress',
              '@radix-ui/react-select',
              '@radix-ui/react-separator',
              '@radix-ui/react-slot',
              'class-variance-authority',
              'clsx',
              'lucide-react',
              'tailwind-merge',
            ],
            auth: ['better-auth'],
          },
        },
      },
    },
  }
})
