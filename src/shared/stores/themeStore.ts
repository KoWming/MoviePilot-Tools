import { reactive } from 'vue';

export type ThemeMode = 'auto' | 'light' | 'dark';

const STORAGE_KEY = 'mp.theme';

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

function loadSavedTheme(): ThemeMode {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data && ['auto', 'light', 'dark'].includes(data)) {
      return data as ThemeMode;
    }
  } catch {}
  return 'auto';
}

export const themeState = reactive({
  mode: loadSavedTheme() as ThemeMode,
  effective: 'light' as 'light' | 'dark'
});

// 计算实际主题
function computeEffective(): void {
  if (themeState.mode === 'auto') {
    themeState.effective = getSystemTheme();
  } else {
    themeState.effective = themeState.mode;
  }
  applyTheme(themeState.effective);
}

// 应用主题到 DOM
function applyTheme(theme: 'light' | 'dark'): void {
  const root = document.documentElement;
  root.classList.remove('theme-light', 'theme-dark');
  root.classList.add(`theme-${theme}`);
  root.setAttribute('data-theme', theme);
}

// 监听系统主题变化（仅 auto 模式）
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

// 初始化
computeEffective();
watchSystemTheme();

export function setTheme(mode: ThemeMode): void {
  themeState.mode = mode;
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {}
  computeEffective();
}
