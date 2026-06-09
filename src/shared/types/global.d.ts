// ============================================================
// 全局 TypeScript 类型声明
// Vue SFC / CSS 模块声明 + 扩展窗口对象类型
// ============================================================

// Vue 单文件组件类型声明
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

// CSS 模块类型声明
declare module '*.css' {
  const content: string
  export default content
}

// ===== 扩展 Window 全局对象 =====

declare interface Window {
  __mp_base_url?: string  // MP 服务器基础地址（由 content script 注入）
}

// ===== Content Script 与 iframe 通讯消息类型 =====

declare interface MpOpenPluginMessage {
  type: 'mp-open-plugin'
  id: string
  name?: string
  action?: 'config' | 'page' | 'auto'
}
