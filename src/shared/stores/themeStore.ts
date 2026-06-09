// ============================================================
// 主题管理响应式 Store
// 支持 自动/亮色/暗色 三种模式，监听系统主题变化
// ============================================================

import { reactive } from 'vue';

// 主题模式类型
export type ThemeMode = 'auto' | 'light' | 'dark';

// 存储键名
const STORAGE_KEY = 'mp.theme';

// ===== 主题检测与初始化 =====

// 获取系统主题偏好
function getSystemTheme(): 'light' | 'dark' {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

// 从 localStorage 加载已保存的主题设置
function loadSavedTheme(): ThemeMode {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data && ['auto', 'light', 'dark'].includes(data)) {
      return data as ThemeMode;
    }
  } catch {}
  return 'auto';
}

// 主题状态（Vue 3 响应式对象）
export const themeState = reactive({
  mode: loadSavedTheme() as ThemeMode,           // 用户设置的主题模式
  effective: 'light' as 'light' | 'dark'         // 实际生效的主题
});

// ===== 主题计算与应用 =====

// 计算实际生效的主题（auto 模式下根据系统偏好决定）
function computeEffective(): void {
  if (themeState.mode === 'auto') {
    themeState.effective = getSystemTheme();
  } else {
    themeState.effective = themeState.mode;
  }
  applyTheme(themeState.effective);
}

// 将主题应用到 DOM（data-theme 属性 + CSS 类名）
function applyTheme(theme: 'light' | 'dark'): void {
  const root = document.documentElement;
  root.classList.remove('theme-light', 'theme-dark');
  root.classList.add(`theme-${theme}`);
  root.setAttribute('data-theme', theme);
}

// ===== 系统主题监听 =====

let mediaQuery: MediaQueryList | null = null;

function watchSystemTheme(): void {
  if (mediaQuery) {
    mediaQuery.removeEventListener('change', onSystemThemeChange);
  }
  mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', onSystemThemeChange);
}

function onSystemThemeChange(): void {
  if (themeState.mode === 'auto') {
    computeEffective();
  }
}

// 初始化：计算一次主题并开始监听
computeEffective();
watchSystemTheme();

// ===== 公开 API =====

// 切换主题模式
export function setTheme(mode: ThemeMode): void {
  themeState.mode = mode;
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {}
  computeEffective();
}
