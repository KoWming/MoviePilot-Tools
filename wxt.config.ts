import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'wxt'

/**
 * 打包素材在 pack-assets/（ocr、site_favicon），不在 public/，构建不会拷贝。
 * ORT 运行时不进入 public，构建后从 npm 包复制胶水脚本到产物 ocr/。
 */
const ORT_DIST = path.resolve('node_modules/onnxruntime-web/dist')
const OUTPUT_ROOT = path.resolve('.output')

/**
 * 构建只内置 ORT 胶水脚本（控制扩展体积）：
 * - ort.min.js（UMD，offscreen HTML 经典脚本加载）
 * - ort-*.mjs（wasm 加载器）
 * - 可选 worker.js
 * 不内置 .wasm：由用户导入离线 zip 写入 IndexedDB。
 */
function isOrtGlueFile(name: string): boolean {
  if (name === 'ort.min.js') return true
  if (!name.startsWith('ort-')) return false
  if (name.endsWith('.map')) return false
  if (name.endsWith('.wasm')) return false
  return name.endsWith('.mjs') || name.endsWith('.worker.js')
}

/**
 * 将 onnxruntime-web 胶水脚本复制到扩展产物 ocr/（不含 wasm / 模型）。
 */
function copyOrtRuntimeTo(destRoot: string): void {
  if (!fs.existsSync(ORT_DIST)) {
    console.warn('[wxt] onnxruntime-web/dist 不存在，跳过 OCR 运行时复制')
    return
  }
  const destDir = path.join(destRoot, 'ocr')
  fs.mkdirSync(destDir, { recursive: true })

  const files = fs.readdirSync(ORT_DIST).filter(isOrtGlueFile)
  let n = 0
  let bytes = 0
  for (const file of files) {
    const src = path.join(ORT_DIST, file)
    fs.copyFileSync(src, path.join(destDir, file))
    n++
    bytes += fs.statSync(src).size
  }
  if (!files.includes('ort.min.js')) {
    console.warn('[wxt] 未找到 ort.min.js，离线 OCR 可能无法启动')
  }
  console.log(
    `[wxt] copied ${n} ORT glue files (${(bytes / 1024).toFixed(0)} KB, no wasm) → ${path.relative(process.cwd(), destDir)}`,
  )
}

/** 扫描 .output 下各浏览器产物目录并注入 ocr/ */
function copyOrtRuntimeToAllOutputs(): void {
  if (!fs.existsSync(OUTPUT_ROOT)) return
  for (const name of fs.readdirSync(OUTPUT_ROOT)) {
    // 跳过缓存/元数据目录
    if (name.startsWith('.') || name === 'chrome-mv3-dev-temp') continue
    const dir = path.join(OUTPUT_ROOT, name)
    try {
      if (!fs.statSync(dir).isDirectory()) continue
      // 产物目录通常含 manifest.json
      if (!fs.existsSync(path.join(dir, 'manifest.json'))) continue
      copyOrtRuntimeTo(dir)
    } catch {
      /* 无法读取的非标准产物目录不参与 ORT 复制。 */
    }
  }
}

export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  srcDir: '.',
  zip: {
    // 发布包文件名：MoviePilot-tools-<version>-chrome.zip
    name: 'MoviePilot-tools',
    artifactTemplate: '{{name}}-{{version}}-{{browser}}.zip',
  },
  hooks: {
    'build:done': () => {
      // 构建结束后将 ORT 胶水脚本复制到各浏览器产物的 ocr/。
      copyOrtRuntimeToAllOutputs()
    },
  },
  manifest: {
    name: 'MoviePilot Tools',
    description: 'MoviePilot 浏览器扩展工具（站点管理 / 下载 / 两步验证 / 插件等）',

    icons: {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
      48: 'icons/icon-48.png',
      128: 'icons/icon-128.png',
    },
    action: {
      default_icon: 'icons/icon.png',
    },
    permissions: [
      'storage',
      'cookies',
      'alarms',
      'scripting',
      'activeTab',
      'downloads',
      'notifications',
      'offscreen',
    ],
    host_permissions: ['<all_urls>'],
    web_accessible_resources: [
      {
        // offscreen + 构建注入的 ocr 运行时 + 图标
        resources: [
          '/offscreen.html',
          '/offscreen/index.html',
          '/ocr/*',
          '/icons/icon.png',
          '/icons/icon-16.png',
          '/icons/icon-32.png',
          '/icons/icon-48.png',
          '/icons/icon-128.png',
        ],
        matches: ['<all_urls>'],
      },
    ],
    // 扩展脚本仅允许 `self` 和 `wasm-unsafe-eval`，不开放 `blob:`。
    content_security_policy: {
      extension_pages:
        "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'; frame-src 'self' http: https: data:;",

    },
  },
  vite: () => ({
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '2.1.1'),
    },
    resolve: {
      // ORT WASM 由构建后复制到 ocr/，offscreen 用全局 ort.min.js + wasmPaths
      conditions: [
        'onnxruntime-web-use-extern-wasm',
        'import',
        'module',
        'browser',
        'default',
      ],
    },
    build: {
      // 扩展页的 modulepreload 与后续 ESM 请求可能被 Chrome 判定为跨 world 资源不匹配。
      // 关闭预加载不影响静态 import，仅改为由模块图按需加载共享 chunk。
      modulePreload: false,
      // popup + offscreen + ORT wasm 体积较大，属预期
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        onwarn(warning, warn) {
          // 抑制 @vueuse/core 的 "/* #__PURE__ */" 注释位置警告（无害，源自第三方包）
          if (warning.message?.includes('contains an annotation that Rollup cannot interpret')) {
            return
          }
          warn(warning)
        },
      },
    },
  }),
})

