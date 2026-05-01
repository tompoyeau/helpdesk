import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => ({
  base: '/helpdesk/',
  plugins: [
    tailwindcss(),
    vue(),
    // DevTools uniquement en développement local
    ...(mode === 'development' ? [vueDevTools()] : []),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('apexcharts') || id.includes('vue3-apexcharts')) return 'vendor-charts'
          if (id.includes('firebase'))                                      return 'vendor-firebase'
          if (id.includes('node_modules/vue') || id.includes('pinia') || id.includes('vue-router')) return 'vendor-vue'
        },
      },
    },
  },
}))
