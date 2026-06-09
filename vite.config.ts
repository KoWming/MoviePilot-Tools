// ============================================================
// Vite 构建配置 - MoviePilot Tools Chrome 扩展
// 多入口构建：popup / background / content scripts / offscreen
// ============================================================

import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  // Vue 3 SFC 编译插件
  plugins: [vue()],
  resolve: {
    // ONNX Runtime Web 条件导出（WASM 模式）
    conditions: ['onnxruntime-web-use-extern-wasm', 'import', 'module', 'browser', 'default']
  },
  // 使用相对路径，确保在 Chrome 扩展中正确加载资源
  base: './',
  build: {
    rollupOptions: {
      // ===== 多入口配置 =====
      input: {
        popup: resolve(__dirname, 'src/popup/index.html'),
        background: resolve(__dirname, 'src/background/index.ts'),
        'mp-bridge': resolve(__dirname, 'src/content/mp-bridge.ts'),
        'pt-float': resolve(__dirname, 'src/content/pt-float.ts'),
        'captcha-auto-fill': resolve(__dirname, 'src/content/captcha-auto-fill.ts'),
        'ocr-worker': resolve(__dirname, 'src/offscreen/ocr-worker.html')
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
        // ===== 代码分割策略：按第三方库分包 =====
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('element-plus') || id.includes('@element-plus')) return 'vendor-element-plus';
            if (id.includes('@vue') || id.includes('vue')) return 'vendor-vue';
            if (id.includes('@mdi')) return 'vendor-icons';
            if (id.includes('html2canvas') || id.includes('dom-to-image')) return 'vendor-export-image';
            if (id.includes('jsqr')) return 'vendor-qr';
            if (id.includes('axios')) return 'vendor-axios';
            return 'vendor';
          }
          // 站点图标数据单独打包（体积大、不常变）
          if (id.includes('src/shared/data/siteIcons')) return 'site-icons';
        }
      }
    },
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 2500
  }
});
