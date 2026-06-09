// ============================================================
// MoviePilot Tools - Popup 应用入口
// 初始化 Vue 3 应用，挂载 Element Plus UI 组件库
// ============================================================

import { createApp } from 'vue';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import App from './App.vue';

const app = createApp(App);
app.use(ElementPlus);
app.mount('#app');