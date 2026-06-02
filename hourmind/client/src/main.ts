// client/src/main.ts
// Vue 应用入口 —— 挂载 Pinia 状态管理、Vue Router、量子玻璃全局样式
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './style.css'

const app = createApp(App)
app.use(createPinia())  // 状态管理
app.use(router)         // 路由
app.mount('#app')
