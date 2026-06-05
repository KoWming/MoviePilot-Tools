declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '*.css' {
  const content: string
  export default content
}

declare interface Window {
  __mp_base_url?: string
}

// content-script 与 iframe 通讯消息类型
declare interface MpOpenPluginMessage {
  type: 'mp-open-plugin'
  id: string
  name?: string
  action?: 'config' | 'page' | 'auto'
}
