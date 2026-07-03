import 'element-plus/theme-chalk/dark/css-vars.css'
import 'element-plus/dist/index.css'
import 'virtual:uno.css'

import App from './App.vue'
import { createApp } from 'vue'
import { router } from './router'

const app = createApp(App)
app.use(router)
app.mount('#app')
