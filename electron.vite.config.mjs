import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        // Polyfill Node built‑ins in preload
        stream: 'stream-browserify',
        events: 'events/',
        util: 'util/',
        buffer: 'buffer/'
      }
    },
    optimizeDeps: {
      include: ['stream-browserify', 'events', 'util', 'buffer']
    },
    define: {
      'process.env': {}
    }
  },
  renderer: {
    publicDir: 'src/public',
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        // Polyfill Node built‑ins in renderer
        stream: 'stream-browserify',
        events: 'events/',
        util: 'util/',
        buffer: 'buffer/'
      }
    },
    optimizeDeps: {
      include: ['stream-browserify', 'events', 'util', 'buffer']
    },
    define: {
      'process.env': {}
    },
    plugins: [vue()]
  }
})
