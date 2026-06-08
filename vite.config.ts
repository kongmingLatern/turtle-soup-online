import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import { defineConfig } from 'vite'
import path from 'path'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    AutoImport({
      resolvers: [ElementPlusResolver()],
    }),
    Components({
      resolvers: [ElementPlusResolver()],
    }),
  ],
      server: {
      proxy: {
        '^/api': {
          target: 'http://127.0.0.1:3001/api', // 将要代理的目标地址
          changeOrigin: true, // 是否改变源地址
          rewrite: path => path.replace('/api', ''),
        },
      },
    },
  resolve: {
    
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
    
  }
})
