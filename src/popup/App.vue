<template>
  <div
    class="popup-root layout"
    id="popup-root"
    :class="{ 'has-custom-bg': bgStore.enabled && bgStore.image && themeState.effective !== 'dark' }"
    :data-theme="themeState.effective"
    style="position: relative;"
  >
    <!-- Custom Background Layer -->
    <div
      v-if="bgStore.enabled && bgStore.image && themeState.effective !== 'dark'"
      class="custom-bg-layer"
      :style="{
        backgroundImage: `url(${bgStore.image})`,
        opacity: bgStore.opacity,
        filter: bgStore.blurEnabled ? `blur(${bgStore.blur}px)` : 'none',
        transform: bgStore.blurEnabled ? 'scale(1.08)' : 'none'
      }"
    ></div>
    <Sidebar v-if="view!=='login' && !pinLocked" :current="view as any" @openWeb="onOpenWeb" @navigate="onNavigate" />
    <div class="content" :style="{ '--topbar-icon-color': topbarColor }">
      <TopBar v-if="view!=='login' && !pinLocked" :title="currentTitle" :icon="currentIcon" :showWebBtn="true" @openWeb="onOpenWeb" />
    <div v-if="pinLocked" class="pin-lock-page">
      <div class="card pin-lock-card">
        <div class="brand pin-brand">
          <img src="/icons/icon.png" alt="logo" />
          <div class="title">PIN 安全验证</div>
          <div class="pin-subtitle">请输入 6 位 PIN 以打开 MoviePilot Tools</div>
      </div>
      <el-form class="form" @submit.prevent="unlockWithPin">
        <el-form-item>
          <div class="pin-code-inputs" :ref="(el: any) => setPinGroupRef('unlock', el)">
            <input
              v-for="(_, idx) in 6" :key="idx"
              type="password" inputmode="numeric" maxlength="1"
              class="pin-code-box"
              :value="pinInput[idx] || ''"
              @input="(e: Event) => onUnlockDigitInput(idx, e)"
              @keydown="(e: KeyboardEvent) => onUnlockDigitKeydown(idx, e)"
              @paste="(e: ClipboardEvent) => onUnlockPaste(e)"
              @focus="($event.target as HTMLInputElement).select()"
              @keyup.enter="unlockWithPin"
            />
          </div>
        </el-form-item>
        <el-button type="primary" :loading="pinVerifying" class="pin-unlock-btn" @click="unlockWithPin">解锁</el-button>
        <el-alert v-if="pinError" :title="pinError" type="error" show-icon :closable="false" class="error" />
      </el-form>
      </div>
    </div>
    <div v-else-if="view==='login'" class="card">
      <div class="brand">
        <img src="/icons/icon.png" alt="logo" />
        <div class="title">MoviePilot Tools</div>
      </div>
      <el-form label-position="top" :model="form" :rules="rules" ref="formRef" class="form">
        <el-form-item label="服务器地址" prop="baseURL" required>
          <el-input v-model="form.baseURL" placeholder="http://192.168.1.1:3000" class="input-lg">
            <template #prefix>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" class="icon-prefix"><path :d="mdiLink" /></svg>
            </template>
          </el-input>
        </el-form-item>
        <div class="form-row-two">
          <el-form-item label="用户名" prop="username" required class="flex-half">
            <el-input v-model="form.username" placeholder="请输入用户名" class="input-lg">
              <template #prefix>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" class="icon-prefix"><path :d="mdiAccount" /></svg>
              </template>
            </el-input>
          </el-form-item>
          <el-form-item label="密码" prop="password" required class="flex-half">
            <el-input v-model="form.password" type="password" placeholder="请输入密码" show-password class="input-lg">
              <template #prefix>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" class="icon-prefix"><path :d="mdiLockOutline" /></svg>
              </template>
            </el-input>
          </el-form-item>
        </div>
        <el-form-item label="两步验证码 (选填)" prop="otp_password">
          <el-input v-model="form.otp_password" placeholder="请输入 6 位两步验证码" class="input-lg">
            <template #prefix>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" class="icon-prefix"><path :d="mdiShieldKey" /></svg>
            </template>
          </el-input>
        </el-form-item>
        <div class="btn-row">
          <el-button type="primary" :loading="loading" class="btn" @click="onLogin">登录</el-button>
          <el-button class="btn" @click="onTest">测试</el-button>
        </div>
        <el-alert v-if="errorMsg" :title="errorMsg" type="error" show-icon :closable="false" class="error" />
      </el-form>
    </div>
    <div v-if="view==='login' && !pinLocked" class="meta">
      <span>版本 {{ extVersion || '-' }}</span>
      <span class="dot">·</span>
      <span> <a href="https://movie-pilot.org/" target="_blank" class="moviepilot-link">MoviePilot</a></span>
    </div>
    <div class="content-inner" v-else-if="!pinLocked">
      <KeepAlive>
        <User v-if="view==='dashboard'" />
        <Sites v-else-if="view==='sites'" />
        <SiteManagement v-else-if="view==='site-management'" />
        <TOTPManager v-else-if="view==='totp-manager'" />
        <CredsManager v-else-if="view==='pt-creds-manager'" />
        <PluginManager v-else-if="view==='plugin-manager'" />
        <DownloadManager v-else-if="view==='download-manager'" />
        <Settings v-else-if="view==='settings'" @navigate="onNavigate" />
        <About v-else-if="view==='about'" />
      </KeepAlive>
    </div>
    </div>
  </div>
  
</template>

<script setup lang="ts">
// ============================================================
// MoviePilot Tools - 主应用组件
// 路由/视图切换、登录表单、PIN 锁屏、自定义背景、主题支持
// ============================================================

import { reactive, ref, onMounted, onUnmounted, computed, nextTick, watch } from 'vue';
import { loginByPassword, getBaseUrl, getToken } from '../shared/api/auth';
import { createMpApiClient } from '../shared/api/client';
import { downloadAndCompressImage, saveCustomBgImage } from '../shared/customBg';
import { mdiLink, mdiAccount, mdiLockOutline, mdiChartLine, mdiWeb, mdiShieldKey, mdiPuzzleOutline, mdiDownload, mdiInformationOutline, mdiCogOutline, mdiKeyOutline } from '@mdi/js';
import { ElMessage } from 'element-plus';
import User from './views/User.vue';
import Sites from './views/Sites.vue';
import SiteManagement from './views/SiteManagement.vue';
import TOTPManager from './views/TOTPManager.vue';
import CredsManager from './views/CredsManager.vue';
import PluginManager from './views/PluginManager.vue';
import DownloadManager from './views/DownloadManager.vue';
import Settings from './views/Settings.vue';
import Sidebar from './components/Sidebar.vue';
import TopBar from './components/TopBar.vue';
import { saveCredentials } from '../shared/secureStorage';
import { useStorage } from '../shared/utils/useStorage';
import { STORAGE_KEYS } from '../shared/constants';
import { getPinSecurityConfig, getPinVerifyFrequency, isPinUnlockedForSession, markPinUnlockedForSession, verifyPin } from '../shared/pinSecurity';
import About from './views/About.vue';
import { bgStore, loadBgStore } from '../shared/stores/bgStore';
import { themeState } from '../shared/stores/themeStore';

// Watch background settings to toggle body classes
watch(
  () => bgStore.enabled && bgStore.image && themeState.effective !== 'dark',
  (hasBg) => {
    const targets = [document.documentElement, document.body];
    targets.forEach((t) => {
      if (hasBg) {
        t.classList.add('has-custom-bg-body');
      } else {
        t.classList.remove('has-custom-bg-body');
      }
    });
  },
  { immediate: true }
);

const formRef = ref();
const view = ref<'login'|'dashboard'|'sites'|'site-management'|'totp-manager'|'pt-creds-manager'|'plugin-manager'|'download-manager'|'settings'|'about'>('login');
const form = reactive({ baseURL: '', username: '', password: '', otp_password: '' });
const loading = ref(false);
const errorMsg = ref('');
const pinLocked = ref(false);
const pinInput = ref('');
const pinError = ref('');
const pinVerifying = ref(false);
const rules = {
  baseURL: [{ required: true, message: '请输入服务器地址', trigger: 'blur' }],
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
};

// 使用存储组合式函数
const { baseURL, token, loadFromStorage, saveToStorage } = useStorage();

const ROOT_MODE_CLASSES = ['mobile-root', 'pc-root', 'wide-mobile'];

function isMobileDevice(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(navigator.userAgent);
}

function applyRootModeClasses() {
  const mobile = isMobileDevice();
  const wideMobile = mobile && window.innerWidth >= 420;
  const targets = [document.documentElement, document.body];
  targets.forEach((target) => {
    target.classList.remove(...ROOT_MODE_CLASSES);
    target.classList.add(mobile ? 'mobile-root' : 'pc-root');
    if (wideMobile) target.classList.add('wide-mobile');
  });
}

onMounted(() => {
  applyRootModeClasses();
  window.addEventListener('resize', applyRootModeClasses);
});

onUnmounted(() => {
  window.removeEventListener('resize', applyRootModeClasses);
  [document.documentElement, document.body].forEach((target) => {
    target.classList.remove(...ROOT_MODE_CLASSES);
  });
});

onMounted(async () => {
  await loadBgStore();
  await loadFromStorage();
  form.baseURL = baseURL.value;
  if (token.value) {
    view.value = 'site-management';
    pinLocked.value = await shouldLockWithPin();
  }
  // 每日壁纸自动获取：每次打开 popup 时检查，无需先打开设置页
  try {
    const wpData = await chrome.storage.local.get(['dailyWallpaperEnabled', 'lastDailyWallpaperDate']);
    if (wpData.dailyWallpaperEnabled) {
      const today = new Date().toISOString().slice(0, 10);
      const lastDate = wpData.lastDailyWallpaperDate || '';
      if (lastDate !== today) {
        const baseUrl = await getBaseUrl();
        const tkn = await getToken();
        if (baseUrl && tkn) {
          const client = createMpApiClient({ baseURL: baseUrl, getToken });
          const resp = await client.get('/api/v1/login/wallpaper');
          const data = resp.data;
          let wallpaperUrl = '';
          if (data?.message && typeof data.message === 'string') {
            wallpaperUrl = data.message;
          } else if (data?.data && typeof data.data === 'string') {
            wallpaperUrl = data.data;
          } else if (typeof data === 'string') {
            wallpaperUrl = data;
          }
          if (wallpaperUrl) {
            const base64 = await downloadAndCompressImage(wallpaperUrl);
            await saveCustomBgImage(base64);
            await chrome.storage.local.set({ [STORAGE_KEYS.CUSTOM_BG_CONFIG]: { ...bgStore, url: wallpaperUrl } });
            bgStore.url = wallpaperUrl;
            bgStore.image = base64;
            await chrome.storage.local.set({ lastDailyWallpaperDate: today });
          }
        }
      }
    }
  } catch (e) {
    console.warn('每日壁纸自动获取失败:', e);
  }
  // 监听后台导航事件（通过 storage 传递，稳定可靠）
  try {
    const handlePendingRoute = async () => {
      const pending = await chrome.storage.local.get(['mp.pending_route']);
      if (pending && pending['mp.pending_route']) {
        const route = pending['mp.pending_route'] as any;
        if (route?.path === '/download') {
          view.value = 'download-manager';
          const queryUrl = route.query?.url || route.url;
          const queryTitle = route.query?.title || route.title;
          if (queryUrl) {
            chrome.storage.local.set({ 'mp.pt_download_info': { url: queryUrl, title: queryTitle } });
          }
        }
        chrome.storage.local.remove(['mp.pending_route']);
      }
    };
    await handlePendingRoute();
    // popup 已打开时，监听 storage 变化以响应悬浮图标触发
    chrome.storage.onChanged.addListener((changes) => {
      if (changes['mp.pending_route']?.newValue) {
        handlePendingRoute();
      }
    });
  } catch {}
});

async function shouldLockWithPin(): Promise<boolean> {
  const config = await getPinSecurityConfig();
  const enabled = Boolean(config.enabled && config.salt && config.hash);
  if (!enabled) return false;
  if (getPinVerifyFrequency(config) === 'session') {
    return !(await isPinUnlockedForSession());
  }
  return true;
}

async function unlockWithPin() {
  pinError.value = '';
  pinVerifying.value = true;
  try {
    const ok = await verifyPin(pinInput.value.trim());
    if (!ok) {
      pinError.value = 'PIN 验证失败';
      pinInput.value = '';
      return;
    }
    const config = await getPinSecurityConfig();
    if (getPinVerifyFrequency(config) === 'session') {
      await markPinUnlockedForSession();
    }
    pinLocked.value = false;
    pinInput.value = '';
    ElMessage.success('已解锁');
  } finally {
    pinVerifying.value = false;
  }
}

// ========== PIN 6 位独立输入框（解锁页） ==========
const pinGroupRefs: Record<string, HTMLElement> = {};
function setPinGroupRef(name: string, el: any) { if (el) pinGroupRefs[name] = el; }
function getPinInputs(name: string): HTMLInputElement[] {
  const c = pinGroupRefs[name];
  return c ? Array.from(c.querySelectorAll('input')) : [];
}

function focusUnlockPinInput() {
  nextTick(() => {
    requestAnimationFrame(() => {
      const firstInput = getPinInputs('unlock')[0];
      firstInput?.focus();
      firstInput?.select();
    });
  });
}

watch(pinLocked, (locked) => {
  if (locked) focusUnlockPinInput();
});

function onUnlockDigitInput(idx: number, e: Event) {
  const input = e.target as HTMLInputElement;
  const digit = input.value.replace(/\D/g, '').slice(-1);
  input.value = digit;
  const chars = pinInput.value.split('');
  chars[idx] = digit;
  pinInput.value = chars.join('');
  if (digit && idx < 5) {
    const inputs = getPinInputs('unlock');
    nextTick(() => { inputs[idx + 1]?.focus(); inputs[idx + 1]?.select(); });
  }
  if (pinInput.value.length === 6) {
    nextTick(() => unlockWithPin());
  }
}

function onUnlockDigitKeydown(idx: number, e: KeyboardEvent) {
  const inputs = getPinInputs('unlock');
  if (e.key === 'Backspace' && !pinInput.value[idx] && idx > 0) {
    const chars = pinInput.value.split('');
    chars[idx - 1] = '';
    pinInput.value = chars.join('');
    nextTick(() => { inputs[idx - 1]?.focus(); });
  } else if (e.key === 'ArrowLeft' && idx > 0) {
    inputs[idx - 1]?.focus();
  } else if (e.key === 'ArrowRight' && idx < 5) {
    inputs[idx + 1]?.focus();
  }
}

function onUnlockPaste(e: ClipboardEvent) {
  e.preventDefault();
  const pasted = (e.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, 6);
  if (!pasted) return;
  pinInput.value = pasted.padEnd(6, '');
  const inputs = getPinInputs('unlock');
  const fi = Math.min(pasted.length, 5);
  nextTick(() => { inputs[fi]?.focus(); inputs[fi]?.select(); });
  if (pasted.length === 6) unlockWithPin();
}

async function onLogin() {
  errorMsg.value = '';
  await formRef.value?.validate?.();
  loading.value = true;
  try {
    const res = await loginByPassword({
      baseURL: form.baseURL,
      username: form.username,
      password: form.password,
      otp_password: form.otp_password || undefined
    });
    const bearer = `${res.token_type ?? 'Bearer'} ${res.access_token}`;
    await saveToStorage(form.baseURL, bearer);
    // 保存加密凭据用于静默续期
    await saveCredentials({
      baseURL: form.baseURL,
      username: form.username,
      password: form.password,
      otp_password: form.otp_password || undefined
    });
    ElMessage.success(`欢迎，${res.user_name || '用户'}！`);
    // 登录成功后跳转站点管理
    view.value = 'site-management';
  } catch (e) {
    errorMsg.value = (e as Error).message || '登录失败';
  } finally {
    loading.value = false;
  }
}

function onTest() {
  chrome.runtime.sendMessage({ type: 'MP_FETCH_EXAMPLE' }, (resp) => {
    if (resp?.ok) {
      ElMessage.success('连接正常');
    } else {
      ElMessage.error(resp?.error || '连接失败');
    }
  });
}

function onNavigate(v: 'dashboard'|'sites'|'site-management'|'totp-manager'|'pt-creds-manager'|'plugin-manager'|'download-manager'|'settings'|'about') {
  view.value = v;
}

async function onOpenWeb() {
  const data = await chrome.storage.local.get([STORAGE_KEYS.BASE_URL]);
  let base = data[STORAGE_KEYS.BASE_URL] as string | undefined;
  if (!base) {
    try {
      const sd = await chrome.storage.sync.get([STORAGE_KEYS.BASE_URL]);
      base = sd[STORAGE_KEYS.BASE_URL] as string | undefined;
      if (base) await chrome.storage.local.set({ [STORAGE_KEYS.BASE_URL]: base });
    } catch {}
  }
  if (base) chrome.tabs.create({ url: base });
}

const currentTitle = computed(() => {
  switch (view.value) {
    case 'sites': return '站点数据';
    case 'site-management': return '站点管理';
    case 'dashboard': return '用户信息';
    case 'totp-manager': return '两步验证';
    case 'pt-creds-manager': return '凭据管理';
    case 'plugin-manager': return '插件管理';
    case 'download-manager': return '下载管理';
    case 'settings': return '设置';
    case 'about': return '关于';
    default: return '用户信息';
  }
});
const currentIcon = computed(() => {
  switch (view.value) {
    case 'sites': return mdiChartLine;
    case 'site-management': return mdiWeb;
    case 'dashboard': return mdiAccount;
    case 'totp-manager': return mdiShieldKey;
    case 'pt-creds-manager': return mdiKeyOutline;
    case 'plugin-manager': return mdiPuzzleOutline;
    case 'download-manager': return mdiDownload;
    case 'settings': return mdiCogOutline;
    case 'about': return mdiInformationOutline;
    default: return mdiAccount;
  }
});
// 顶部图标颜色映射
const topbarColor = computed(() => {
  switch (view.value) {
    case 'sites': return '#3b82f6';
    case 'site-management': return '#3b82f6';
    case 'dashboard': return '#1677ff';
    case 'totp-manager': return '#1677ff';
    case 'pt-creds-manager': return '#16a34a';
    case 'plugin-manager': return '#1677ff';
    case 'download-manager': return '#52c41a';
    case 'settings': return '#2563eb';
    case 'about': return '#64748b';
    default: return '#1677ff';
  }
});

// 扩展版本号
const extVersion = ref('');
onMounted(() => {
  try {
    const v = chrome.runtime.getManifest?.().version;
    if (v) extVersion.value = v;
  } catch {}
});

</script>

<style>
/* Glassmorphism custom background styling overrides */
.popup-root.has-custom-bg {
  background: transparent !important;
}

.popup-root.has-custom-bg::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(246, 249, 255, 0.15); /* Subtle overlay tint */
  z-index: 0;
  pointer-events: none;
}

.custom-bg-layer {
  position: absolute !important;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 0 !important;
  background-size: cover;
  background-position: center;
  pointer-events: none;
  transition: opacity 0.3s ease, filter 0.3s ease, transform 0.3s ease;
}

.popup-root.has-custom-bg > :not(.custom-bg-layer) {
  position: relative;
  z-index: 1;
}

html.has-custom-bg-body, body.has-custom-bg-body, .has-custom-bg-body #app {
  background: transparent !important;
}

/* Make container/page roots transparent to show background */
.popup-root.has-custom-bg .settings-root,
.popup-root.has-custom-bg .user-root,
.popup-root.has-custom-bg .sites-root,
.popup-root.has-custom-bg .pt-manager-root,
.popup-root.has-custom-bg .totp-manager,
.popup-root.has-custom-bg .download-root,
.popup-root.has-custom-bg .plugin-root,
.popup-root.has-custom-bg .about-root,
.popup-root.has-custom-bg .pin-lock-page,
.popup-root.has-custom-bg .stats-panel {
  background: transparent !important;
}
.popup-root.has-custom-bg .stats-panel .stat-item {
  background: rgba(255, 255, 255, 0.35) !important;
  backdrop-filter: blur(8px) !important;
  -webkit-backdrop-filter: blur(8px) !important;
  border: 1px solid rgba(255, 255, 255, 0.2) !important;
}

/* Make containers semi-transparent and glassmorphic */
.popup-root.has-custom-bg .sidebar,
.mobile-root.has-custom-bg-body .popup-root .sidebar {
  background: rgba(255, 255, 255, 0.18) !important;
  backdrop-filter: blur(16px) saturate(120%);
  -webkit-backdrop-filter: blur(16px) saturate(120%);
  border-right: 1px solid rgba(255, 255, 255, 0.15) !important;
}

/* Sidebar items glassmorphism overrides for Option B */
.popup-root.has-custom-bg .sidebar .item {
  background: transparent !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  border: none !important;
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.popup-root.has-custom-bg .sidebar .item:hover {
  background: transparent !important;
}
.popup-root.has-custom-bg .sidebar .item.active {
  background: transparent !important;
  border: none !important;
  color: #1677ff !important;
}
.popup-root.has-custom-bg .sidebar .item.active svg {
  color: #1677ff !important;
}

.popup-root.has-custom-bg .topbar {
  background: rgba(255, 255, 255, 0.25) !important;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.15) !important;
}

.popup-root.has-custom-bg .content-inner {
  background: transparent !important;
}

/* Glassmorphism overrides for cards across all views */
.popup-root.has-custom-bg .el-card,
.popup-root.has-custom-bg .settings-card,
.popup-root.has-custom-bg .card,
.popup-root.has-custom-bg .pt-card,
.popup-root.has-custom-bg .bl-card,
.popup-root.has-custom-bg .pt-loading-card,
.popup-root.has-custom-bg .totp-card,
.popup-root.has-custom-bg .totp-loading-card,
.popup-root.has-custom-bg .site-card,
.popup-root.has-custom-bg .site-loading-card,
.popup-root.has-custom-bg .sites-loading-card,
.popup-root.has-custom-bg .ov-card,
.popup-root.has-custom-bg .download-card,
.popup-root.has-custom-bg .download-loading-state,
.popup-root.has-custom-bg .download-checking-state,
.popup-root.has-custom-bg .comprehensive-card,
.popup-root.has-custom-bg .user-loading-card,
.popup-root.has-custom-bg .user-loading-info-card,
.popup-root.has-custom-bg .site-management .toolbar {
  background: rgba(255, 255, 255, 0.45) !important;
  backdrop-filter: blur(12px) saturate(110%);
  -webkit-backdrop-filter: blur(12px) saturate(110%);
  border: 1px solid rgba(255, 255, 255, 0.25) !important;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05) !important;
}

.popup-root.has-custom-bg .iframe-box.is-plugins-list {
  background: rgba(255, 255, 255, 0.25) !important;
  backdrop-filter: blur(12px) saturate(110%) !important;
  -webkit-backdrop-filter: blur(12px) saturate(110%) !important;
  border: none !important;
}

[data-theme="dark"] .popup-root.has-custom-bg .iframe-box.is-plugins-list {
  background: rgba(15, 23, 42, 0.35) !important;
}

.popup-root.has-custom-bg .iframe {
  background: transparent !important;
}

.popup-root.has-custom-bg .site-loading-shimmer {
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.24) 25%, rgba(255, 255, 255, 0.56) 37%, rgba(255, 255, 255, 0.24) 63%) !important;
  background-size: 400% 100% !important;
  backdrop-filter: blur(4px) !important;
  -webkit-backdrop-filter: blur(4px) !important;
}

.popup-root.has-custom-bg .sites-loading-shimmer {
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.24) 25%, rgba(255, 255, 255, 0.56) 37%, rgba(255, 255, 255, 0.24) 63%) !important;
  background-size: 400% 100% !important;
  backdrop-filter: blur(4px) !important;
  -webkit-backdrop-filter: blur(4px) !important;
}

.popup-root.has-custom-bg .pt-loading-shimmer,
.popup-root.has-custom-bg .totp-loading-shimmer,
.popup-root.has-custom-bg .user-loading-shimmer {
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.24) 25%, rgba(255, 255, 255, 0.56) 37%, rgba(255, 255, 255, 0.24) 63%) !important;
  background-size: 400% 100% !important;
  backdrop-filter: blur(4px) !important;
  -webkit-backdrop-filter: blur(4px) !important;
}

/* Make PT manager and TOTP manager toolbars transparent under custom background */
.popup-root.has-custom-bg .pt-manager-root .toolbar,
.popup-root.has-custom-bg .totp-manager .toolbar {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  padding-bottom: 4px !important;
}

/* Make TOTP manager tabs transparent and cohesive under custom background */
.popup-root.has-custom-bg .totp-tabs {
  background: rgba(255, 255, 255, 0.2) !important;
  backdrop-filter: blur(10px) saturate(110%) !important;
  -webkit-backdrop-filter: blur(10px) saturate(110%) !important;
  border: 1px solid rgba(255, 255, 255, 0.25) !important;
  border-radius: 8px !important;
  margin: 5px 8px 0 8px !important;
  padding: 2px 6px !important;
  overflow: hidden !important;
}
.popup-root.has-custom-bg .totp-tab-item {
  color: rgba(15, 23, 42, 0.6) !important;
}
.popup-root.has-custom-bg .totp-tab-item:hover {
  color: #0f172a !important;
}
.popup-root.has-custom-bg .totp-tab-item.active {
  color: #1677ff !important;
}

/* Make PT manager tabs transparent and cohesive under custom background */
.popup-root.has-custom-bg .pt-tabs {
  background: rgba(255, 255, 255, 0.2) !important;
  backdrop-filter: blur(10px) saturate(110%) !important;
  -webkit-backdrop-filter: blur(10px) saturate(110%) !important;
  border: 1px solid rgba(255, 255, 255, 0.25) !important;
  border-radius: 8px !important;
  margin: 0px 8px 0 8px !important;
  padding: 2px 6px !important;
  overflow: hidden !important;
}
.popup-root.has-custom-bg .pt-tab-item {
  color: rgba(15, 23, 42, 0.6) !important;
}
.popup-root.has-custom-bg .pt-tab-item:hover {
  color: #0f172a !important;
}
.popup-root.has-custom-bg .pt-tab-item.active {
  color: #16a34a !important;
}

/* Semi-transparent background colors for stat-items to retain their original themes */
.popup-root.has-custom-bg .stat-item {
  backdrop-filter: blur(10px) saturate(110%);
  -webkit-backdrop-filter: blur(10px) saturate(110%);
  border: 1px solid rgba(255, 255, 255, 0.2) !important;
}
.popup-root.has-custom-bg .stat-config {
  background: linear-gradient(135deg, rgba(227, 242, 253, 0.55) 0%, rgba(243, 229, 245, 0.55) 100%) !important;
}
.popup-root.has-custom-bg .stat-supporting {
  background: linear-gradient(135deg, rgba(224, 247, 250, 0.55) 0%, rgba(232, 245, 233, 0.55) 100%) !important;
}
.popup-root.has-custom-bg .stat-enabled {
  background: linear-gradient(135deg, rgba(232, 245, 232, 0.55) 0%, rgba(241, 248, 233, 0.55) 100%) !important;
}
.popup-root.has-custom-bg .stat-filtered {
  background: linear-gradient(135deg, rgba(255, 243, 224, 0.55) 0%, rgba(252, 228, 236, 0.55) 100%) !important;
}
.popup-root.has-custom-bg .stat-pending {
  background: linear-gradient(135deg, rgba(243, 229, 245, 0.55) 0%, rgba(232, 234, 246, 0.55) 100%) !important;
}

/* Glassmorphism overrides for form inputs and select wrappers */
.popup-root.has-custom-bg .el-input__wrapper,
.popup-root.has-custom-bg .el-select__wrapper,
.popup-root.has-custom-bg .el-textarea__inner {
  background-color: rgba(255, 255, 255, 0.4) !important;
  backdrop-filter: blur(6px) !important;
  -webkit-backdrop-filter: blur(6px) !important;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.25) inset !important;
  border: none !important;
}
.popup-root.has-custom-bg .el-input__wrapper.is-focus,
.popup-root.has-custom-bg .el-select__wrapper.is-focus {
  box-shadow: 0 0 0 1px #3b82f6 inset !important;
}

/* Glassmorphism overrides for buttons - keeping their distinct semantic colors */
/* Default / Info Button (gray/white) */


/* Primary Button (blue) */
.popup-root.has-custom-bg .el-button--primary {
  background: rgba(37, 99, 235, 0.7) !important;
  backdrop-filter: blur(6px) !important;
  -webkit-backdrop-filter: blur(6px) !important;
  border: 1px solid rgba(255, 255, 255, 0.15) !important;
  color: #ffffff !important;
  transition: all 0.2s ease;
}
.popup-root.has-custom-bg .el-button--primary:hover {
  background: rgba(37, 99, 235, 0.85) !important;
}

/* Danger Button (red) */
.popup-root.has-custom-bg .el-button--danger {
  background: rgba(239, 68, 68, 0.7) !important;
  backdrop-filter: blur(6px) !important;
  -webkit-backdrop-filter: blur(6px) !important;
  border: 1px solid rgba(255, 255, 255, 0.15) !important;
  color: #ffffff !important;
  transition: all 0.2s ease;
}
.popup-root.has-custom-bg .el-button--danger:hover {
  background: rgba(239, 68, 68, 0.85) !important;
}

/* Success Button (green) */
.popup-root.has-custom-bg .el-button--success {
  background: rgba(34, 197, 94, 0.7) !important;
  backdrop-filter: blur(6px) !important;
  -webkit-backdrop-filter: blur(6px) !important;
  border: 1px solid rgba(255, 255, 255, 0.15) !important;
  color: #ffffff !important;
  transition: all 0.2s ease;
}
.popup-root.has-custom-bg .el-button--success:hover {
  background: rgba(34, 197, 94, 0.85) !important;
}

/* Warning Button (yellow/orange) */
.popup-root.has-custom-bg .el-button--warning {
  background: rgba(245, 158, 11, 0.7) !important;
  backdrop-filter: blur(6px) !important;
  -webkit-backdrop-filter: blur(6px) !important;
  border: 1px solid rgba(255, 255, 255, 0.15) !important;
  color: #ffffff !important;
  transition: all 0.2s ease;
}
.popup-root.has-custom-bg .el-button--warning:hover {
  background: rgba(245, 158, 11, 0.85) !important;
}

/* Info Button (gray) */
.popup-root.has-custom-bg .el-button--info {
  background: rgba(107, 114, 128, 0.6) !important;
  backdrop-filter: blur(6px) !important;
  -webkit-backdrop-filter: blur(6px) !important;
  border: 1px solid rgba(255, 255, 255, 0.15) !important;
  color: #ffffff !important;
  transition: all 0.2s ease;
}
.popup-root.has-custom-bg .el-button--info:hover {
  background: rgba(107, 114, 128, 0.75) !important;
}

/* Glassmorphism overrides for switches */
.popup-root.has-custom-bg .el-switch__core {
  background-color: rgba(0, 0, 0, 0.15) !important;
  border-color: rgba(0, 0, 0, 0.1) !important;
}
.popup-root.has-custom-bg .el-switch.is-checked .el-switch__core {
  background-color: var(--el-switch-on-color, var(--el-color-primary)) !important;
  border-color: var(--el-switch-on-color, var(--el-color-primary)) !important;
}

/* Glassmorphism overrides for icons / section-icons */
.popup-root.has-custom-bg .section-icon {
  backdrop-filter: blur(4px) !important;
  -webkit-backdrop-filter: blur(4px) !important;
}
.popup-root.has-custom-bg .section-icon:not(.cookie-icon):not(.open-icon):not(.embed-icon):not(.webdav-icon):not(.pt-creds-icon) {
  background: rgba(239, 246, 255, 0.4) !important;
  border-color: rgba(191, 219, 254, 0.4) !important;
}
.popup-root.has-custom-bg .cookie-icon {
  background: rgba(236, 253, 245, 0.4) !important;
  border-color: rgba(187, 247, 208, 0.4) !important;
}
.popup-root.has-custom-bg .open-icon {
  background: rgba(255, 247, 237, 0.4) !important;
  border-color: rgba(254, 215, 170, 0.4) !important;
}
.popup-root.has-custom-bg .embed-icon {
  background: rgba(245, 243, 255, 0.4) !important;
  border-color: rgba(221, 214, 254, 0.4) !important;
}
.popup-root.has-custom-bg .webdav-icon {
  background: rgba(238, 242, 255, 0.4) !important;
  border-color: rgba(199, 210, 254, 0.4) !important;
}
.popup-root.has-custom-bg .pt-creds-icon {
  background: rgba(240, 253, 244, 0.4) !important;
  border-color: rgba(187, 247, 208, 0.4) !important;
}

/* Glassmorphism overrides for Dialogs */
.popup-root.has-custom-bg .el-dialog {
  background: rgba(255, 255, 255, 0.6) !important;
  backdrop-filter: blur(20px) !important;
  -webkit-backdrop-filter: blur(20px) !important;
  border: 1px solid rgba(255, 255, 255, 0.3) !important;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15) !important;
}

/* 毛玻璃效果：黑名单屏蔽规则卡片 */
.popup-root.has-custom-bg .bl-switch-item {
  background: rgba(255, 255, 255, 0.35) !important;
  backdrop-filter: blur(8px) !important;
  -webkit-backdrop-filter: blur(8px) !important;
  border: 1px solid rgba(255, 255, 255, 0.25) !important;
}

/* Glassmorphism overrides for PIN inputs */
.popup-root.has-custom-bg .pin-code-box {
  background: rgba(255, 255, 255, 0.12) !important;
  border-color: rgba(255, 255, 255, 0.25) !important;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.06) !important;
}
.popup-root.has-custom-bg .pin-code-box:focus {
  border-color: #3b82f6 !important;
  background: rgba(255, 255, 255, 0.22) !important;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15) !important;
}
.popup-root.has-custom-bg .pin-code-box:valid {
  border-color: rgba(255, 255, 255, 0.3) !important;
  background: rgba(255, 255, 255, 0.18) !important;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.06) !important;
}

.popup-root.has-custom-bg .frequency-option {
  background: rgba(255, 255, 255, 0.4) !important;
  border-color: rgba(255, 255, 255, 0.2) !important;
}
.popup-root.has-custom-bg .frequency-option.is-checked {
  background: rgba(22, 119, 255, 0.12) !important;
  border-color: rgba(22, 119, 255, 0.3) !important;
}

/* Glassmorphism overrides for Sites.vue specific components */

/* User Level Badge */
.popup-root.has-custom-bg .user-level {
  background: rgba(59, 130, 246, 0.12) !important;
  border-color: rgba(59, 130, 246, 0.25) !important;
  color: #2563eb !important;
  backdrop-filter: blur(4px) !important;
  -webkit-backdrop-filter: blur(4px) !important;
}

/* Data Transfer Section background and icons */
.popup-root.has-custom-bg .data-transfer {
  background: rgba(255, 255, 255, 0.2) !important;
  border: 1px solid rgba(255, 255, 255, 0.15) !important;
  backdrop-filter: blur(4px) !important;
  -webkit-backdrop-filter: blur(4px) !important;
}
.popup-root.has-custom-bg .transfer-column.upload .transfer-icon {
  background-color: rgba(34, 197, 94, 0.2) !important;
}
.popup-root.has-custom-bg .transfer-column.download .transfer-icon {
  background-color: rgba(239, 68, 68, 0.2) !important;
}
.popup-root.has-custom-bg .transfer-divider {
  background: rgba(255, 255, 255, 0.15) !important;
}
.popup-root.has-custom-bg .site-card .card-header {
  border-bottom-color: rgba(255, 255, 255, 0.15) !important;
}

/* Status Labels */
.popup-root.has-custom-bg .status-label.active,
.popup-root.has-custom-bg .status-label.connection-normal {
  color: #22c55e !important;
  background: rgba(34, 197, 94, 0.15) !important;
  border-color: rgba(34, 197, 94, 0.25) !important;
}
.popup-root.has-custom-bg .status-label.inactive,
.popup-root.has-custom-bg .status-label.connection-unknown {
  color: #9ca3af !important;
  background: rgba(255, 255, 255, 0.25) !important;
  border-color: rgba(255, 255, 255, 0.15) !important;
}
.popup-root.has-custom-bg .status-label.connection-slow {
  color: #f59e0b !important;
  background: rgba(245, 158, 11, 0.15) !important;
  border-color: rgba(245, 158, 11, 0.25) !important;
}
.popup-root.has-custom-bg .status-label.connection-failed {
  color: #ef4444 !important;
  background: rgba(239, 68, 68, 0.15) !important;
  border-color: rgba(239, 68, 68, 0.25) !important;
}

/* Native action buttons glassmorphism in Sites.vue */
.popup-root.has-custom-bg .action-btn.primary {
  background: rgba(59, 130, 246, 0.7) !important;
  backdrop-filter: blur(6px) !important;
  -webkit-backdrop-filter: blur(6px) !important;
  border: 1px solid rgba(255, 255, 255, 0.15) !important;
  box-shadow: none !important;
  color: #ffffff !important;
}
.popup-root.has-custom-bg .action-btn.primary:hover {
  background: rgba(59, 130, 246, 0.85) !important;
}

.popup-root.has-custom-bg .action-btn.secondary {
  background: rgba(255, 255, 255, 0.4) !important;
  backdrop-filter: blur(6px) !important;
  -webkit-backdrop-filter: blur(6px) !important;
  border: 1px solid rgba(255, 255, 255, 0.25) !important;
  color: #334155 !important;
}
.popup-root.has-custom-bg .action-btn.secondary:hover {
  background: rgba(255, 255, 255, 0.55) !important;
}

/* Legibility overrides for PT Card text under custom background */
.popup-root.has-custom-bg .pt-card .password-label,
.popup-root.has-custom-bg .bl-card .bl-tags,
.popup-root.has-custom-bg .pt-card .time-wrap,
.popup-root.has-custom-bg .bl-card .time-wrap {
  color: #475569 !important;
}
.popup-root.has-custom-bg .pt-card .password-value {
  color: #0f172a !important;
}

/* 毛玻璃效果：黑名单屏蔽规则标签 */
.popup-root.has-custom-bg .bl-card .bl-tag.el-tag--warning {
  background: rgba(245, 158, 11, 0.08) !important;
  backdrop-filter: blur(6px) !important;
  -webkit-backdrop-filter: blur(6px) !important;
  border-color: rgba(245, 158, 11, 0.12) !important;
  color: #b45309 !important;
}
.popup-root.has-custom-bg .bl-card .bl-tag.el-tag--danger {
  background: rgba(239, 68, 68, 0.08) !important;
  backdrop-filter: blur(6px) !important;
  -webkit-backdrop-filter: blur(6px) !important;
  border-color: rgba(239, 68, 68, 0.12) !important;
  color: #dc2626 !important;
}
.popup-root.has-custom-bg .pt-card .dots {
  color: #475569 !important;
  letter-spacing: 1px !important;
}
.popup-root.has-custom-bg .pt-card .site-username {
  color: #334155 !important;
}
.popup-root.has-custom-bg .pt-card .card-password-row {
  border-top-color: rgba(0, 0, 0, 0.08) !important;
}
.popup-root.has-custom-bg .totp-card .card-code-row,
.popup-root.has-custom-bg .totp-loading-card .totp-loading-code-row {
  border-top-color: rgba(0, 0, 0, 0.08) !important;
}
.popup-root.has-custom-bg .pt-manager-root .card-actions {
  background: rgba(255, 255, 255, 0.25) !important;
  backdrop-filter: blur(4px) !important;
  -webkit-backdrop-filter: blur(4px) !important;
  border: 1px solid rgba(255, 255, 255, 0.2) !important;
}
.popup-root.has-custom-bg .content .content-inner .pt-manager-root .pt-cards .pt-card .card-main .card-actions .action-btn {
  color: #334155 !important;
  background: transparent !important;
  border: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  box-shadow: none !important;
}
.popup-root.has-custom-bg .content .content-inner .pt-manager-root .pt-cards .pt-card .card-main .card-actions .action-btn:hover {
  background: rgba(22, 163, 74, 0.15) !important;
  color: #16a34a !important;
}

/* TOTP Manager card-actions glassmorphism under custom background */
.popup-root.has-custom-bg .content .content-inner .totp-manager .totp-card .card-actions {
  background: rgba(255, 255, 255, 0.25) !important;
  backdrop-filter: blur(4px) !important;
  -webkit-backdrop-filter: blur(4px) !important;
  border: 1px solid rgba(255, 255, 255, 0.2) !important;
}
.popup-root.has-custom-bg .content .content-inner .totp-manager .totp-card .card-main .card-actions .action-btn {
  color: #334155 !important;
  background: transparent !important;
  border: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  box-shadow: none !important;
}
.popup-root.has-custom-bg .content .content-inner .totp-manager .totp-card .card-main .card-actions .action-btn:hover {
  background: rgba(59, 130, 246, 0.15) !important;
  color: #3b82f6 !important;
}

/* User Card glassmorphism overrides */
.popup-root.has-custom-bg .user-card {
  background: rgba(255, 255, 255, 0.45) !important;
  backdrop-filter: blur(12px) saturate(110%);
  -webkit-backdrop-filter: blur(12px) saturate(110%);
  border: 1px solid rgba(255, 255, 255, 0.25) !important;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05) !important;
}
.popup-root.has-custom-bg .user-card .divider {
  background: rgba(0, 0, 0, 0.08) !important;
}
.popup-root.has-custom-bg .user-card .email {
  color: #475569 !important;
}
.popup-root.has-custom-bg .user-card .stat-row {
  background: rgba(255, 255, 255, 0.4) !important;
  backdrop-filter: blur(8px) !important;
  -webkit-backdrop-filter: blur(8px) !important;
  border: 1px solid rgba(255, 255, 255, 0.2) !important;
}
.popup-root.has-custom-bg .user-card .stat-row .label {
  color: #475569 !important;
}
.popup-root.has-custom-bg .user-card .stat-row.movie .bubble {
  background: rgba(250, 173, 20, 0.2) !important;
}
.popup-root.has-custom-bg .user-card .stat-row.tv .bubble {
  background: rgba(77, 184, 255, 0.2) !important;
}
.popup-root.has-custom-bg .user-card .logout-btn {
  background: rgba(255, 77, 79, 0.15) !important;
  border-color: rgba(255, 77, 79, 0.25) !important;
  color: #ff4d4f !important;
  backdrop-filter: blur(4px) !important;
  -webkit-backdrop-filter: blur(4px) !important;
  box-shadow: none !important;
}
.popup-root.has-custom-bg .user-card .logout-btn:hover {
  background: rgba(255, 77, 79, 0.25) !important;
}

/* User Info Page cookie stat box override */
.popup-root.has-custom-bg .stat-cookie {
  background: linear-gradient(135deg, rgba(255, 243, 224, 0.55) 0%, rgba(248, 249, 250, 0.55) 100%) !important;
}

/* Glassmorphism overrides for checkboxes */
.popup-root.has-custom-bg .el-checkbox__inner {
  background-color: rgba(255, 255, 255, 0.3) !important;
  border-color: rgba(255, 255, 255, 0.25) !important;
  backdrop-filter: blur(4px) !important;
  -webkit-backdrop-filter: blur(4px) !important;
}
.popup-root.has-custom-bg .el-checkbox.is-checked .el-checkbox__inner {
  background-color: rgba(37, 99, 235, 0.75) !important;
  border-color: rgba(37, 99, 235, 0.85) !important;
}
.popup-root.has-custom-bg .el-checkbox__label {
  color: #334155 !important;
}
.popup-root.has-custom-bg .el-checkbox.is-checked .el-checkbox__label {
  color: #2563eb !important;
}

/* Legibility overrides for About page under custom background */
.popup-root.has-custom-bg .about-root .section-kicker {
  color: #475569 !important;
}
.popup-root.has-custom-bg .about-root .subtitle,
.popup-root.has-custom-bg .about-root .nav-desc,
.popup-root.has-custom-bg .about-root .fc-desc,
.popup-root.has-custom-bg .about-root .footer-text {
  color: #334155 !important;
}

html, body, #app { margin: 0; padding: 0; box-sizing: border-box; }
*, *::before, *::after { box-sizing: border-box; }
html.pc-root, body.pc-root, .pc-root #app { width: 400px; height: 500px; overflow: hidden; }
html.mobile-root, body.mobile-root, .mobile-root #app { width: 100%; height: 100vh; overflow: hidden; }

/* 约束所有元素最大宽度 */
.popup-root * {
  max-width: 100% !important;
  box-sizing: border-box !important;
}
/* 精简滚动条样式（Chromium） */
*::-webkit-scrollbar { width: 4px; height: 4px; }
*::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.2); border-radius: 6px; }
*::-webkit-scrollbar-track { background: transparent; }

.mobile-root .popup-root {
  width: 100% !important;
  min-width: 0 !important;
  max-width: none !important;
  height: 100vh !important;
  min-height: 100vh;
  flex-direction: column;
}

.mobile-root .popup-root .content {
  order: 1;
  min-height: 0;
  width: 100%;
}

.mobile-root .popup-root .content-inner {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.mobile-root .popup-root .sidebar {
  order: 2;
  width: 100% !important;
  min-width: 0 !important;
  height: 56px;
  flex: 0 0 56px !important;
  flex-direction: row !important;
  justify-content: center;
  padding: 0 8px !important;
  border-right: 0 !important;
  border-top: 1px solid rgba(15, 23, 42, 0.06) !important;
  box-shadow: 0 -4px 16px rgba(15, 23, 42, 0.04) !important;
  background: #ffffff !important;
  gap: 0 !important;
}

.mobile-root .popup-root .sidebar .logo {
  display: none;
}

.mobile-root .popup-root .sidebar .menu {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: row !important;
  justify-content: space-around !important;
  align-items: center;
  gap: 0 !important;
  overflow: hidden !important;
}

.mobile-root .popup-root .sidebar .item {
  flex: 1;
  max-width: 40px;
  height: 40px !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  padding: 0 !important;
  margin: 0 !important;
  border-radius: 12px !important;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  -webkit-tap-highlight-color: transparent !important;
}

.mobile-root .popup-root .sidebar .item:focus,
.mobile-root .popup-root .sidebar .item:focus-visible {
  outline: none !important;
  box-shadow: none !important;
}

.mobile-root .popup-root .sidebar .item:active {
  background: rgba(22, 119, 255, 0.12) !important;
  border-radius: 12px !important;
}

.mobile-root .popup-root .sidebar .item svg {
  color: #64748b;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.mobile-root .popup-root .sidebar .item.active {
  background: rgba(22, 119, 255, 0.08) !important;
  color: #1677ff !important;
}

.mobile-root .popup-root .sidebar .item.active svg {
  color: #1677ff !important;
  transform: scale(1.15);
}

.mobile-root .popup-root .sidebar .item::before {
  left: 50% !important;
  top: auto !important;
  bottom: 0px !important;
  width: 16px !important;
  height: 3px !important;
  border-radius: 2px 2px 0 0 !important;
  transform: translateX(-50%) scaleX(0) !important;
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease !important;
}

.mobile-root .popup-root .sidebar .item.active::before {
  transform: translateX(-50%) scaleX(1) !important;
  opacity: 1 !important;
}

.mobile-root .popup-root .topbar {
  height: 48px;
  padding: 0 12px;
  gap: 8px;
}

.mobile-root .popup-root .topbar .left {
  min-width: 0;
}

.mobile-root .popup-root .topbar .title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-root .popup-root .topbar .right {
  flex: 0 0 auto;
}

.mobile-root .popup-root .topbar .right .el-button {
  max-width: 118px;
  padding-left: 10px;
  padding-right: 10px;
}

.mobile-root .el-dialog {
  width: calc(100vw - 24px) !important;
  max-width: calc(100vw - 24px) !important;
  margin: 12px auto !important;
}

.mobile-root .el-dialog__body {
  max-height: calc(100vh - 150px);
  overflow: auto;
  -webkit-overflow-scrolling: touch;
}

.mobile-root .el-message-box {
  width: calc(100vw - 28px) !important;
  max-width: calc(100vw - 28px) !important;
}

@media screen and (max-width: 349px) {
  .mobile-root .popup-root .sidebar .item {
    max-width: 34px !important;
    height: 34px !important;
    border-radius: 8px !important;
  }
}

/* ========== Dark Theme ========== */
[data-theme="dark"] {
  background: #0f172a !important;
  color: #e2e8f0;
}

[data-theme="dark"] .content {
  background: #0f172a !important;
}

[data-theme="dark"] .content-inner {
  background: transparent !important;
}

[data-theme="dark"] .sidebar {
  background: #1e293b !important;
  border-right-color: #334155 !important;
  color: #94a3b8;
}

/* 适配移动端底部菜单栏深色模式 */
.mobile-root [data-theme="dark"] .sidebar {
  background: #1e293b !important;
  border-top: 1px solid #334155 !important;
  border-right: none !important;
  box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.25) !important;
}

.mobile-root [data-theme="dark"] .sidebar .item {
  color: #94a3b8 !important;
}

.mobile-root [data-theme="dark"] .sidebar .item svg {
  color: #94a3b8 !important;
}

.mobile-root [data-theme="dark"] .sidebar .item:active {
  background: rgba(255, 255, 255, 0.08) !important;
}

.mobile-root [data-theme="dark"] .sidebar .item.active {
  background: rgba(59, 130, 246, 0.15) !important;
  color: #60a5fa !important;
}

.mobile-root [data-theme="dark"] .sidebar .item.active svg {
  color: #60a5fa !important;
}

.mobile-root [data-theme="dark"] .sidebar .item::before {
  background: #60a5fa !important;
  box-shadow: 0 0 8px rgba(96, 165, 250, 0.6) !important;
}


[data-theme="dark"] .sidebar .item {
  color: #94a3b8;
}

[data-theme="dark"] .sidebar .item svg {
  color: #94a3b8 !important;
}

[data-theme="dark"] .sidebar .item:hover {
  background: rgba(255, 255, 255, 0.08) !important;
  color: #e2e8f0;
}

[data-theme="dark"] .sidebar .item:hover svg {
  color: #e2e8f0 !important;
}

[data-theme="dark"] .sidebar .item.active {
  background: rgba(59, 130, 246, 0.15) !important;
  color: #60a5fa !important;
  box-shadow: inset 0 0 0 1px rgba(59, 130, 246, 0.25) !important;
}

[data-theme="dark"] .sidebar .item.active svg {
  color: #60a5fa !important;
}

[data-theme="dark"] .topbar {
  background: #1e293b !important;
  border-bottom-color: #334155 !important;
  color: #e2e8f0;
}

[data-theme="dark"] .topbar .title {
  color: #e2e8f0 !important;
}

[data-theme="dark"] .card,
[data-theme="dark"] .el-card,
[data-theme="dark"] .settings-card {
  background: #1e293b !important;
  border-color: #334155 !important;
  color: #e2e8f0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3) !important;
}

[data-theme="dark"] .card .title,
[data-theme="dark"] .card .brand .title {
  color: #f1f5f9 !important;
}

[data-theme="dark"] .section-title {
  color: #e2e8f0 !important;
}

[data-theme="dark"] .section-subtitle,
[data-theme="dark"] .setting-title,
[data-theme="dark"] .setting-desc,
[data-theme="dark"] .setting-desc {
  color: #94a3b8 !important;
}

[data-theme="dark"] .setting-row {
  border-bottom-color: #334155 !important;
}

[data-theme="dark"] .el-input__wrapper {
  background: #0f172a !important;
  border-color: #334155 !important;
  color: #e2e8f0 !important;
  box-shadow: 0 0 0 1px #334155 inset !important;
}

[data-theme="dark"] .el-input__inner {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  color: #e2e8f0 !important;
}


[data-theme="dark"] .el-textarea__inner {
  background: #0f172a !important;
  border-color: #334155 !important;
  color: #e2e8f0 !important;
  box-shadow: 0 0 0 1px #334155 inset !important;
}

[data-theme="dark"] .el-textarea__inner:hover,
[data-theme="dark"] .el-textarea__inner:focus {
  border-color: #475569 !important;
  box-shadow: 0 0 0 1px #475569 inset !important;
}

/* 覆盖浏览器自动填充（Autofill）带来的高亮背景色 */
[data-theme="dark"] input:-webkit-autofill,
[data-theme="dark"] input:-webkit-autofill:hover,
[data-theme="dark"] input:-webkit-autofill:focus,
[data-theme="dark"] textarea:-webkit-autofill,
[data-theme="dark"] textarea:-webkit-autofill:hover,
[data-theme="dark"] textarea:-webkit-autofill:focus {
  -webkit-text-fill-color: #e2e8f0 !important;
  -webkit-box-shadow: 0 0 0px 1000px #0f172a inset !important;
  transition: background-color 5000s ease-in-out 0s !important;
}


[data-theme="dark"] .el-input__inner::placeholder {
  color: #475569 !important;
}

[data-theme="dark"] .el-input__wrapper:hover,
[data-theme="dark"] .el-input__wrapper.is-focus {
  border-color: #475569 !important;
  box-shadow: 0 0 0 1px #475569 inset !important;
}

[data-theme="dark"] .icon-prefix,
[data-theme="dark"] .icon-prefix path {
  color: #94a3b8 !important;
  fill: currentColor !important;
}

/* ========== 全局输入框前后缀插槽 (append/prepend) 深色适配 ========== */
[data-theme="dark"] .el-input-group__append,
[data-theme="dark"] .el-input-group__prepend {
  background-color: #1e293b !important;
  border: none !important;
  box-shadow: 0 1px 0 0 #334155 inset, 0 -1px 0 0 #334155 inset, -1px 0 0 0 #334155 inset !important;
  color: #cbd5e1 !important;
}
[data-theme="dark"] .el-input-group__prepend {
  box-shadow: 0 1px 0 0 #334155 inset, 0 -1px 0 0 #334155 inset, 1px 0 0 0 #334155 inset !important;
}
[data-theme="dark"] .el-input-group__append .el-button,
[data-theme="dark"] .el-input-group__prepend .el-button {
  background-color: transparent !important;
  border: none !important;
  box-shadow: none !important;
  color: inherit !important;
  margin: 0 !important;
}
[data-theme="dark"] .el-input-group__append .el-button:hover,
[data-theme="dark"] .el-input-group__prepend .el-button:hover {
  background-color: rgba(255, 255, 255, 0.05) !important;
  color: #60a5fa !important;
}

/* ========== 全局 el-input-number 数字输入框增减按钮深色适配 ========== */
[data-theme="dark"] .el-input-number__decrease,
[data-theme="dark"] .el-input-number__increase {
  background-color: #1e293b !important;
  border-color: #334155 !important;
  color: #cbd5e1 !important;
}
[data-theme="dark"] .el-input-number__decrease:hover,
[data-theme="dark"] .el-input-number__increase:hover {
  background-color: #334155 !important;
  color: #60a5fa !important;
}
[data-theme="dark"] .el-input-number__decrease {
  border-right: 1px solid #334155 !important;
}
[data-theme="dark"] .el-input-number__increase {
  border-left: 1px solid #334155 !important;
}
[data-theme="dark"] .el-input-number__decrease.is-disabled,
[data-theme="dark"] .el-input-number__increase.is-disabled {
  background-color: #0f172a !important;
  color: #475569 !important;
  border-color: #334155 !important;
}

/* ========== 全局 el-skeleton 骨架屏深色适配 ========== */
[data-theme="dark"] .el-skeleton {
  --el-skeleton-color: #1e293b !important;
  --el-skeleton-to-color: #334155 !important;
}
[data-theme="dark"] .el-skeleton__item {
  background: #1e293b !important;
}

/* ========== 全局 el-loading-mask 加载遮罩深色适配 ========== */
[data-theme="dark"] .el-loading-mask {
  background-color: rgba(15, 23, 42, 0.75) !important;
}
[data-theme="dark"] .el-loading-spinner .path {
  stroke: #60a5fa !important;
}
[data-theme="dark"] .el-loading-spinner .el-loading-text {
  color: #60a5fa !important;
}

/* ========== 使用自定义背景时的加载阶段毛玻璃透光效果 ========== */
.has-custom-bg .el-loading-mask {
  background-color: rgba(255, 255, 255, 0.4) !important;
  backdrop-filter: blur(10px) !important;
  -webkit-backdrop-filter: blur(10px) !important;
}

.has-custom-bg .el-loading-spinner .path {
  stroke: var(--el-color-primary) !important;
}

.has-custom-bg .el-loading-spinner .el-loading-text {
  color: var(--el-color-primary) !important;
}

/* 骨架屏半透明毛玻璃透光 */
.has-custom-bg .el-skeleton {
  --el-skeleton-color: rgba(255, 255, 255, 0.25) !important;
  --el-skeleton-to-color: rgba(255, 255, 255, 0.45) !important;
}

.has-custom-bg .el-skeleton__item {
  background: rgba(255, 255, 255, 0.25) !important;
  backdrop-filter: blur(4px) !important;
  -webkit-backdrop-filter: blur(4px) !important;
}


[data-theme="dark"] .el-select__wrapper {
  background: #0f172a !important;
  box-shadow: 0 0 0 1px #334155 inset !important;
}
[data-theme="dark"] .el-select__wrapper.is-hovering,
[data-theme="dark"] .el-select__wrapper.is-focus {
  box-shadow: 0 0 0 1px #475569 inset !important;
}

[data-theme="dark"] .el-select__selected-item span {
  color: #e2e8f0 !important;
}

[data-theme="dark"] .el-textarea__inner {
  background: #0f172a !important;
  border-color: #334155 !important;
  color: #e2e8f0 !important;
}

[data-theme="dark"] .el-switch__core {
  background: #334155 !important;
  border-color: #334155 !important;
}

[data-theme="dark"] .el-switch.is-checked .el-switch__core {
  background: #3b82f6 !important;
  border-color: #3b82f6 !important;
}

[data-theme="dark"] .el-radio-button__inner {
  background: #1e293b !important;
  border-color: #334155 !important;
  color: #94a3b8 !important;
}

[data-theme="dark"] .el-radio-button__original-radio:checked + .el-radio-button__inner {
  background: #3b82f6 !important;
  border-color: #3b82f6 !important;
  color: #fff !important;
}

[data-theme="dark"] .el-radio {
  color: #e2e8f0 !important;
}

[data-theme="dark"] .el-checkbox__label {
  color: #e2e8f0 !important;
}

[data-theme="dark"] .meta,
[data-theme="dark"] .meta span {
  color: #64748b !important;
}

[data-theme="dark"] .meta a {
  color: #60a5fa !important;
}

[data-theme="dark"] .el-dropdown-menu {
  background: #1e293b !important;
  border-color: #334155 !important;
  --el-dropdown-menuItem-hover-fill: rgba(59, 130, 246, 0.15) !important;
  --el-dropdown-menuItem-hover-color: #60a5fa !important;
}

[data-theme="dark"] .el-dropdown-menu__item {
  color: #e2e8f0 !important;
  background: transparent !important;
}

[data-theme="dark"] .el-dropdown-menu__item:hover {
  background: rgba(59, 130, 246, 0.15) !important;
  color: #60a5fa !important;
}

[data-theme="dark"] .el-dropdown-menu__item.is-disabled {
  color: #475569 !important;
}

[data-theme="dark"] .el-dropdown-menu__item--divided {
  border-color: #334155 !important;
}

[data-theme="dark"] .el-dropdown-menu__item--divided::before {
  background: #334155 !important;
}

[data-theme="dark"] .el-popper.is-light {
  background: #1e293b !important;
  border-color: #334155 !important;
}

[data-theme="dark"] .el-popper.is-light .el-popper__arrow::before {
  background: #1e293b !important;
  border-color: #334155 !important;
}

[data-theme="dark"] .el-dialog {
  background: #1e293b !important;
  border-color: #334155 !important;
}

[data-theme="dark"] .el-dialog__title {
  color: #e2e8f0 !important;
}

[data-theme="dark"] .el-dialog__body {
  color: #e2e8f0 !important;
}

/* 深色主题：黑名单屏蔽规则卡片 */
[data-theme="dark"] .bl-switch-item {
  background: #0f172a !important;
  border-color: #334155 !important;
}
[data-theme="dark"] .bl-switch-label span {
  color: #e2e8f0 !important;
}
[data-theme="dark"] .bl-switch-icon {
  fill: #94a3b8 !important;
}

[data-theme="dark"] .el-alert {
  background: rgba(239, 68, 68, 0.12) !important;
  border-color: rgba(239, 68, 68, 0.25) !important;
}

[data-theme="dark"] .el-alert__title {
  color: #fca5a5 !important;
}

[data-theme="dark"] .version-value {
  color: #94a3b8 !important;
}

[data-theme="dark"] .site-management .site-card {
  background: #1e293b !important;
  border-color: #334155 !important;
}

[data-theme="dark"] .site-management .site-loading-card {
  background: #1e293b !important;
  border-color: #334155 !important;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3) !important;
}

[data-theme="dark"] .site-management .site-loading-shimmer {
  background: linear-gradient(90deg, #334155 25%, #475569 37%, #334155 63%) !important;
  background-size: 400% 100% !important;
}

[data-theme="dark"] .site-management .site-card .site-name {
  color: #f1f5f9 !important;
}

[data-theme="dark"] .site-management .site-card .site-domain {
  color: #60a5fa !important;
}

/* ========== 全局 stat-item 统计卡片深色适配 ========== */
[data-theme="dark"] .stat-item {
  border: 1px solid rgba(255, 255, 255, 0.06) !important;
}

[data-theme="dark"] .stat-item .stat-label {
  color: #94a3b8 !important; /* 统一暗色文字 */
}

/* 已配置站点 (蓝色) */
[data-theme="dark"] .stat-config {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(30, 41, 59, 0.9) 100%) !important;
}
[data-theme="dark"] .stat-config .stat-num,
[data-theme="dark"] .stat-config .stat-number {
  color: #60a5fa !important;
}

/* 已适配站点 (青色) */
[data-theme="dark"] .stat-supporting {
  background: linear-gradient(135deg, rgba(20, 184, 166, 0.15) 0%, rgba(30, 41, 59, 0.9) 100%) !important;
}
[data-theme="dark"] .stat-supporting .stat-num,
[data-theme="dark"] .stat-supporting .stat-number {
  color: #2dd4bf !important;
}

/* Cookie数 (橙色) */
[data-theme="dark"] .stat-cookie {
  background: linear-gradient(135deg, rgba(249, 115, 22, 0.15) 0%, rgba(30, 41, 59, 0.9) 100%) !important;
}
[data-theme="dark"] .stat-cookie .stat-num,
[data-theme="dark"] .stat-cookie .stat-number {
  color: #fb923c !important;
}

/* 待更新 (紫色) */
[data-theme="dark"] .stat-pending {
  background: linear-gradient(135deg, rgba(168, 85, 247, 0.15) 0%, rgba(30, 41, 59, 0.9) 100%) !important;
}
[data-theme="dark"] .stat-pending .stat-num,
[data-theme="dark"] .stat-pending .stat-number {
  color: #c084fc !important;
}

/* 筛选/过滤 (粉色/橙) */
[data-theme="dark"] .stat-filtered {
  background: linear-gradient(135deg, rgba(236, 72, 153, 0.15) 0%, rgba(30, 41, 59, 0.9) 100%) !important;
}
[data-theme="dark"] .stat-filtered .stat-num,
[data-theme="dark"] .stat-filtered .stat-number {
  color: #f472b6 !important;
}


[data-theme="dark"] .site-management .toolbar {
  background: #1e293b !important;
  border-color: #334155 !important;
}

[data-theme="dark"] .site-management .act-btn {
  color: #94a3b8 !important;
}

[data-theme="dark"] .site-management .act-btn:hover {
  background: rgba(255, 255, 255, 0.08) !important;
}

[data-theme="dark"] .site-management .act-update {
  background: rgba(96, 165, 250, 0.12) !important;
  color: #60a5fa !important;
  transition: all 0.2s ease !important;
}

[data-theme="dark"] .site-management .act-update:hover {
  background: rgba(96, 165, 250, 0.24) !important;
  color: #93c5fd !important;
}

[data-theme="dark"] .site-management .act-overwrite {
  background: rgba(248, 113, 113, 0.12) !important;
  color: #f87171 !important;
  transition: all 0.2s ease !important;
}

[data-theme="dark"] .site-management .act-overwrite:hover {
  background: rgba(248, 113, 113, 0.24) !important;
  color: #fca5a5 !important;
}

[data-theme="dark"] .site-management .act-login {
  background: rgba(52, 211, 153, 0.12) !important;
  color: #34d399 !important;
  transition: all 0.2s ease !important;
}

[data-theme="dark"] .site-management .act-login:hover {
  background: rgba(52, 211, 153, 0.24) !important;
  color: #86efac !important;
}

[data-theme="dark"] .site-management .act-add {
  background: rgba(129, 140, 248, 0.12) !important;
  color: #818cf8 !important;
  transition: all 0.2s ease !important;
}

[data-theme="dark"] .site-management .act-add:hover {
  background: rgba(129, 140, 248, 0.24) !important;
  color: #a5b4fc !important;
}

[data-theme="dark"] .site-management .act-more {
  background: #334155 !important;
  border-color: #475569 !important;
  color: #94a3b8 !important;
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1) !important;
}

[data-theme="dark"] .site-management .act-more:hover {
  background: #475569 !important;
  color: #e2e8f0 !important;
}

[data-theme="dark"] .site-management .diff-badge {
  border-color: rgba(255, 255, 255, 0.12) !important;
}

[data-theme="dark"] .site-management .tag-cookie {
  background: rgba(245, 158, 11, 0.12) !important;
}

[data-theme="dark"] .site-management .tag-ua {
  background: rgba(59, 130, 246, 0.12) !important;
}

[data-theme="dark"] .status-badge {
  border-color: rgba(255, 255, 255, 0.12) !important;
}

[data-theme="dark"] .totp-manager .totp-card,
[data-theme="dark"] .totp-manager .totp-loading-card,
[data-theme="dark"] .pt-manager-root .pt-card,
[data-theme="dark"] .pt-manager-root .pt-loading-card {
  background: #1e293b !important;
  border-color: #334155 !important;
  color: #e2e8f0;
}

[data-theme="dark"] .totp-manager .site-name,
[data-theme="dark"] .pt-manager-root .site-name {
  color: #f1f5f9 !important;
}

[data-theme="dark"] .totp-manager .site-domain,
[data-theme="dark"] .pt-manager-root .site-domain {
  color: #60a5fa !important;
}

[data-theme="dark"] .card-actions {
  background: #334155 !important;
  border-color: #475569 !important;
}

[data-theme="dark"] .action-btn {
  color: #94a3b8 !important;
}

[data-theme="dark"] .action-btn:hover {
  background: rgba(255, 255, 255, 0.08) !important;
  color: #e2e8f0 !important;
}

[data-theme="dark"] .code-value {
  color: #60a5fa !important;
}

[data-theme="dark"] .code-wrap {
  background: #0f172a !important;
  border-color: #334155 !important;
}

[data-theme="dark"] .el-card .pin-lock-card,
[data-theme="dark"] .pin-lock-page .card {
  background: #1e293b !important;
  border-color: #334155 !important;
}

[data-theme="dark"] .pin-code-box {
  background: #0f172a !important;
  border-color: #334155 !important;
  color: #e2e8f0 !important;
}

[data-theme="dark"] .pin-unlock-btn {
  background: #3b82f6 !important;
}

[data-theme="dark"] .pin-subtitle {
  color: #94a3b8 !important;
}

[data-theme="dark"] .download-card,
[data-theme="dark"] .download-loading-state,
[data-theme="dark"] .download-checking-state,
[data-theme="dark"] .comprehensive-card,
[data-theme="dark"] .plugin-root {
  background: #1e293b !important;
  border-color: #334155 !important;
  color: #e2e8f0;
}

[data-theme="dark"] .about-root {
  background: transparent !important;
}

[data-theme="dark"] .footer-section {
  border-top-color: #334155 !important;
}

[data-theme="dark"] .footer-text {
  color: #64748b !important;
}

[data-theme="dark"] .link {
  background: rgba(59, 130, 246, 0.15) !important;
  border-color: rgba(59, 130, 246, 0.25) !important;
  color: #60a5fa !important;
}

[data-theme="dark"] .el-loading-mask {
  background: rgba(15, 23, 42, 0.6) !important;
}

/* ========== Element Plus Teleport Components dark theme ========== */
[data-theme="dark"] .el-message-box {
  background: #1e293b !important;
  border-color: #334155 !important;
}
[data-theme="dark"] .el-message-box__title {
  color: #e2e8f0 !important;
}
[data-theme="dark"] .el-message-box__content {
  color: #cbd5e1 !important;
}
[data-theme="dark"] .el-message-box__input input {
  background: #0f172a !important;
  border-color: #334155 !important;
  color: #e2e8f0 !important;
}
[data-theme="dark"] .el-message {
  background: #1e293b !important;
  border-color: #334155 !important;
}
[data-theme="dark"] .el-message__content {
  color: #cbd5e1 !important;
}
[data-theme="dark"] .el-notification {
  background: #1e293b !important;
  border-color: #334155 !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
}
[data-theme="dark"] .el-notification__title {
  color: #e2e8f0 !important;
}
[data-theme="dark"] .el-notification__content {
  color: #cbd5e1 !important;
}

[data-theme="dark"] .el-popper {
  background: #1e293b !important;
  border-color: #334155 !important;
  color: #e2e8f0 !important;
}
[data-theme="dark"] .el-popper__arrow::before {
  background: #1e293b !important;
  border-color: #334155 !important;
}
[data-theme="dark"] .el-form-item__label {
  color: #cbd5e1 !important;
}
[data-theme="dark"] .el-checkbox__inner {
  background-color: #0f172a !important;
  border-color: #334155 !important;
}
[data-theme="dark"] .el-checkbox.is-checked .el-checkbox__inner {
  background-color: #3b82f6 !important;
  border-color: #3b82f6 !important;
}

/* ========== PIN unlock page dark theme ========== */
[data-theme="dark"] .pin-lock-page {
  background:
    radial-gradient(circle at top, rgba(59, 130, 246, 0.08), transparent 34%),
    #0f172a !important;
}
[data-theme="dark"] .pin-code-box {
  background: #0f172a !important;
  border-color: #334155 !important;
  color: #e2e8f0 !important;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2) !important;
}
[data-theme="dark"] .pin-code-box:focus {
  border-color: #3b82f6 !important;
  background: #0f172a !important;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.25) !important;
}
[data-theme="dark"] .pin-code-box:valid {
  border-color: #60a5fa !important;
  background: #1e293b !important;
  box-shadow: none !important;
}



/* ========== Sites.vue dark theme overrides ========== */
[data-theme="dark"] .sites-root .site-card {
  background: #1e293b !important;
  border-color: #334155 !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3) !important;
}

[data-theme="dark"] .sites-root .sites-loading-card {
  background: #1e293b !important;
  border-color: #334155 !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3) !important;
}

[data-theme="dark"] .sites-root .sites-loading-shimmer {
  background: linear-gradient(90deg, #334155 25%, #475569 37%, #334155 63%) !important;
  background-size: 400% 100% !important;
}
[data-theme="dark"] .sites-root .site-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.45) !important;
}
[data-theme="dark"] .sites-root .site-name {
  color: #f1f5f9 !important;
}
[data-theme="dark"] .sites-root .card-header {
  border-bottom-color: #334155 !important;
}
[data-theme="dark"] .sites-root .update-time,
[data-theme="dark"] .sites-root .username,
[data-theme="dark"] .sites-root .metric-label,
[data-theme="dark"] .sites-root .transfer-label,
[data-theme="dark"] .sites-root .empty-text {
  color: #94a3b8 !important;
}
[data-theme="dark"] .sites-root .metric-value {
  color: #cbd5e1 !important;
}
[data-theme="dark"] .sites-root .ov-card {
  background: #1e293b !important;
  border-color: #334155 !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2) !important;
}
[data-theme="dark"] .sites-root .ov-card .text .num {
  color: #e2e8f0 !important;
}
[data-theme="dark"] .sites-root .ov-card .text .label {
  color: #94a3b8 !important;
}
[data-theme="dark"] .sites-root .data-transfer {
  background: #0f172a !important;
}
[data-theme="dark"] .sites-root .transfer-value {
  color: #cbd5e1 !important;
}
[data-theme="dark"] .sites-root .transfer-divider {
  background: #334155 !important;
}
[data-theme="dark"] .sites-root .action-btn.secondary {
  background: #334155 !important;
  border-color: #475569 !important;
  color: #cbd5e1 !important;
}
[data-theme="dark"] .sites-root .action-btn.secondary:hover {
  background: #475569 !important;
  border-color: #64748b !important;
  color: #e2e8f0 !important;
}
[data-theme="dark"] .sites-root .user-level {
  background: rgba(59, 130, 246, 0.15) !important;
  color: #60a5fa !important;
  border-color: rgba(96, 165, 250, 0.25) !important;
}
[data-theme="dark"] .sites-root .status-label.connection-normal,
[data-theme="dark"] .sites-root .status-label.active {
  color: #4ade80 !important;
  background: rgba(34, 197, 94, 0.15) !important;
  border-color: rgba(34, 197, 94, 0.25) !important;
}
[data-theme="dark"] .sites-root .status-label.connection-slow {
  color: #fbbf24 !important;
  background: rgba(245, 158, 11, 0.15) !important;
  border-color: rgba(245, 158, 11, 0.25) !important;
}
[data-theme="dark"] .sites-root .status-label.connection-failed {
  color: #f87171 !important;
  background: rgba(239, 68, 68, 0.15) !important;
  border-color: rgba(239, 68, 68, 0.25) !important;
}
[data-theme="dark"] .sites-root .status-label.inactive,
[data-theme="dark"] .sites-root .status-label.connection-unknown {
  color: #94a3b8 !important;
  background: rgba(255, 255, 255, 0.05) !important;
  border-color: rgba(255, 255, 255, 0.1) !important;
}

/* ========== User.vue dark theme overrides ========== */
[data-theme="dark"] .user-root .version-title,
[data-theme="dark"] .user-root .version-label {
  color: #cbd5e1 !important;
}
[data-theme="dark"] .user-root .version-value {
  color: #cbd5e1 !important;
}
[data-theme="dark"] .user-root .stat-config {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(30, 41, 59, 0.5) 100%) !important;
  border-color: rgba(59, 130, 246, 0.25) !important;
}
[data-theme="dark"] .user-root .stat-config .stat-num {
  color: #60a5fa !important;
}
[data-theme="dark"] .user-root .stat-enabled {
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(30, 41, 59, 0.5) 100%) !important;
  border-color: rgba(34, 197, 94, 0.25) !important;
}
[data-theme="dark"] .user-root .stat-enabled .stat-num {
  color: #4ade80 !important;
}
[data-theme="dark"] .user-root .stat-cookie {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(30, 41, 59, 0.5) 100%) !important;
  border-color: rgba(245, 158, 11, 0.25) !important;
}
[data-theme="dark"] .user-root .stat-cookie .stat-num {
  color: #fbbf24 !important;
}
[data-theme="dark"] .user-root .stat-pending {
  background: linear-gradient(135deg, rgba(168, 85, 247, 0.15) 0%, rgba(30, 41, 59, 0.5) 100%) !important;
  border-color: rgba(168, 85, 247, 0.25) !important;
}
[data-theme="dark"] .user-root .stat-pending .stat-num {
  color: #c084fc !important;
}
[data-theme="dark"] .user-root .stat-label {
  color: #94a3b8 !important;
}
[data-theme="dark"] .user-root .divider {
  background: #334155 !important;
}
[data-theme="dark"] .user-root .comprehensive-card,
[data-theme="dark"] .user-root .user-loading-card,
[data-theme="dark"] .user-root .user-loading-info-card {
  background: #1e293b !important;
  border-color: #334155 !important;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.3) !important;
}
[data-theme="dark"] .user-root .user-loading-divider {
  background: #334155 !important;
}
[data-theme="dark"] .user-root .user-loading-sub-stat,
[data-theme="dark"] .user-root .user-loading-stat {
  background: #0f172a !important;
  border-color: #334155 !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2) !important;
}
[data-theme="dark"] .user-root .user-loading-shimmer {
  background: linear-gradient(90deg, #334155 25%, #475569 37%, #334155 63%) !important;
  background-size: 400% 100% !important;
}

/* UserCard.vue 用户资料卡片深色适配 */
[data-theme="dark"] .user-card {
  background: linear-gradient(180deg, rgba(245, 158, 11, 0.08) 0%, #1e293b 35%) !important;
  border-color: #334155 !important;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.3) !important;
}
[data-theme="dark"] .user-card .name {
  color: #fbbf24 !important;
}
[data-theme="dark"] .user-card .edit svg {
  fill: #94a3b8 !important;
}
[data-theme="dark"] .user-card .edit:hover svg {
  fill: #fbbf24 !important;
}
[data-theme="dark"] .user-card .logout-btn,
[data-theme="dark"] .user-card .logout-btn span {
  color: #f87171 !important;
}
[data-theme="dark"] .user-card .logout-btn {
  background: rgba(239, 68, 68, 0.15) !important;
  border-color: rgba(239, 68, 68, 0.3) !important;
}
[data-theme="dark"] .user-card .logout-btn:hover {
  background: rgba(239, 68, 68, 0.25) !important;
}
[data-theme="dark"] .user-card .logout-btn .power path {
  fill: #f87171 !important;
}
[data-theme="dark"] .user-card .divider {
  background: #334155 !important;
}
[data-theme="dark"] .user-card .email {
  color: #94a3b8 !important;
}
[data-theme="dark"] .user-card .email .mail path {
  fill: #60a5fa !important;
}
[data-theme="dark"] .user-card .stat-row {
  background: #0f172a !important;
  border-color: #334155 !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2) !important;
}
[data-theme="dark"] .user-card .stat-row .num {
  color: #f1f5f9 !important;
}
[data-theme="dark"] .user-card .stat-row .label {
  color: #94a3b8 !important;
}
[data-theme="dark"] .user-card .stat-row.movie .bubble {
  background: rgba(250, 173, 20, 0.15) !important;
}
[data-theme="dark"] .user-card .stat-row.movie svg {
  fill: #fbbf24 !important;
}
[data-theme="dark"] .user-card .stat-row.tv .bubble {
  background: rgba(77, 184, 255, 0.15) !important;
}
[data-theme="dark"] .user-card .stat-row.tv svg {
  fill: #60a5fa !important;
}

[data-theme="dark"] .user-card .badges .el-tag.el-tag--danger,
[data-theme="dark"] .user-card .badges .el-tag.el-tag--danger .el-tag__content {
  color: #f87171 !important;
}
[data-theme="dark"] .user-card .badges .el-tag.el-tag--danger {
  background: rgba(239, 68, 68, 0.15) !important;
  border-color: rgba(239, 68, 68, 0.25) !important;
}
[data-theme="dark"] .user-card .badges .el-tag.el-tag--success,
[data-theme="dark"] .user-card .badges .el-tag.el-tag--success .el-tag__content {
  color: #4ade80 !important;
}
[data-theme="dark"] .user-card .badges .el-tag.el-tag--success {
  background: rgba(34, 197, 94, 0.15) !important;
  border-color: rgba(34, 197, 94, 0.25) !important;
}



/* ========== About.vue 页面深色适配 ========== */
[data-theme="dark"] .about-root {
  background: #0f172a !important;
}
[data-theme="dark"] .about-root .hero {
  border-bottom-color: #334155 !important;
}
[data-theme="dark"] .about-root .logo-wrap {
  background: #1e293b !important;
  border-color: #334155 !important;
}
[data-theme="dark"] .about-root .title {
  color: #f1f5f9 !important;
}
[data-theme="dark"] .about-root .version {
  color: #a5b4fc !important;
  background: rgba(99, 102, 241, 0.15) !important;
  border-color: rgba(99, 102, 241, 0.25) !important;
}
[data-theme="dark"] .about-root .nav-item {
  background: #1e293b !important;
  border-color: #334155 !important;
}
[data-theme="dark"] .about-root .nav-label {
  color: #e2e8f0 !important;
}
[data-theme="dark"] .about-root .fc-item {
  background: #1e293b !important;
  border-color: #334155 !important;
}
[data-theme="dark"] .about-root .fc-label {
  color: #e2e8f0 !important;
}
[data-theme="dark"] .about-root .ni-site { background: rgba(37, 99, 235, 0.15) !important; color: #60a5fa !important; border-color: rgba(37, 99, 235, 0.25) !important; }
[data-theme="dark"] .about-root .ni-data { background: rgba(5, 150, 105, 0.15) !important; color: #4ade80 !important; border-color: rgba(5, 150, 105, 0.25) !important; }
[data-theme="dark"] .about-root .ni-dl { background: rgba(217, 119, 6, 0.15) !important; color: #fbbf24 !important; border-color: rgba(217, 119, 6, 0.25) !important; }
[data-theme="dark"] .about-root .ni-totp { background: rgba(124, 58, 237, 0.15) !important; color: #c084fc !important; border-color: rgba(124, 58, 237, 0.25) !important; }
[data-theme="dark"] .about-root .ni-user { background: rgba(29, 78, 216, 0.15) !important; color: #60a5fa !important; border-color: rgba(29, 78, 216, 0.25) !important; }
[data-theme="dark"] .about-root .ni-plugin { background: rgba(219, 39, 119, 0.15) !important; color: #f472b6 !important; border-color: rgba(219, 39, 119, 0.25) !important; }
[data-theme="dark"] .about-root .ni-settings { background: rgba(67, 56, 202, 0.15) !important; color: #a5b4fc !important; border-color: rgba(67, 56, 202, 0.25) !important; }
[data-theme="dark"] .about-root .ni-about { background: rgba(100, 116, 139, 0.15) !important; color: #94a3b8 !important; border-color: rgba(100, 116, 139, 0.25) !important; }

/* ========== DownloadManager.vue 下载管理深色适配 ========== */
[data-theme="dark"] .download-manager .action-bar {
  border-bottom-color: #334155 !important;
}
[data-theme="dark"] .download-manager .download-loading-title,
[data-theme="dark"] .download-manager .download-checking-title {
  color: #e2e8f0 !important;
}
[data-theme="dark"] .download-manager .download-loading-desc,
[data-theme="dark"] .download-manager .download-checking-desc {
  color: #94a3b8 !important;
}
[data-theme="dark"] .download-manager .download-loading-spinner {
  border-color: rgba(74, 222, 128, 0.18) !important;
  border-top-color: #4ade80 !important;
}
[data-theme="dark"] .download-manager .download-checking-indicator span {
  background: #4ade80 !important;
}
[data-theme="dark"] .download-manager .download-item .title {
  color: #e2e8f0 !important;
}
[data-theme="dark"] .download-manager .download-item .media-poster.placeholder {
  background: #0f172a !important;
  color: #475569 !important;
}
[data-theme="dark"] .download-manager .download-item .torrent-title {
  color: #94a3b8 !important;
}
[data-theme="dark"] .download-manager .download-item .progress-info,
[data-theme="dark"] .download-manager .download-item .speed-info {
  color: #94a3b8 !important;
}

/* ========== SiteManagement.vue 站点管理页深色适配 ========== */
[data-theme="dark"] .site-management .toolbar {
  background: #1e293b !important;
  box-shadow: none !important;
}
[data-theme="dark"] .site-management .filter-section .el-checkbox__label {
  color: #cbd5e1 !important;
}
[data-theme="dark"] .site-management .detail-item {
  border-bottom-color: #334155 !important;
}
[data-theme="dark"] .site-management .detail-item .label {
  color: #94a3b8 !important;
}
[data-theme="dark"] .site-management .detail-item .value {
  color: #f1f5f9 !important;
}
[data-theme="dark"] .site-management .stat-supporting {
  background: linear-gradient(135deg, rgba(0, 131, 143, 0.15) 0%, rgba(30, 41, 59, 0.5) 100%) !important;
  border-color: rgba(0, 131, 143, 0.25) !important;
}
[data-theme="dark"] .site-management .stat-supporting .stat-number { color: #22d3ee !important; }
[data-theme="dark"] .site-management .stat-supporting .stat-label { color: #06b6d4 !important; }

[data-theme="dark"] .site-management .stat-config {
  background: linear-gradient(135deg, rgba(25, 118, 210, 0.15) 0%, rgba(30, 41, 59, 0.5) 100%) !important;
  border-color: rgba(25, 118, 210, 0.25) !important;
}
[data-theme="dark"] .site-management .stat-config .stat-number { color: #60a5fa !important; }
[data-theme="dark"] .site-management .stat-config .stat-label { color: #3b82f6 !important; }

[data-theme="dark"] .site-management .stat-filtered {
  background: linear-gradient(135deg, rgba(245, 124, 0, 0.15) 0%, rgba(30, 41, 59, 0.5) 100%) !important;
  border-color: rgba(245, 124, 0, 0.25) !important;
}
[data-theme="dark"] .site-management .stat-filtered .stat-number { color: #fbbf24 !important; }
[data-theme="dark"] .site-management .stat-filtered .stat-label { color: #f59e0b !important; }

[data-theme="dark"] .site-management .stat-pending {
  background: linear-gradient(135deg, rgba(123, 31, 162, 0.15) 0%, rgba(30, 41, 59, 0.5) 100%) !important;
  border-color: rgba(123, 31, 162, 0.25) !important;
}
[data-theme="dark"] .site-management .stat-pending .stat-number { color: #c084fc !important; }
[data-theme="dark"] .site-management .stat-pending .stat-label { color: #a855f7 !important; }

/* ========== CredsManager 与 TOTPManager 统一深色适配 ========== */
[data-theme="dark"] .pt-manager-root,
[data-theme="dark"] .totp-manager {
  background: #0f172a !important;
}
[data-theme="dark"] .pt-manager-root .toolbar,
[data-theme="dark"] .totp-manager .toolbar {
  background: #1e293b !important;
  border-bottom-color: #334155 !important;
  box-shadow: none !important;
}
[data-theme="dark"] .pt-manager-root .toolbar .search-input :deep(.el-input__wrapper),
[data-theme="dark"] .totp-manager .toolbar .search-input :deep(.el-input__wrapper) {
  background: #0f172a !important;
  border-color: #334155 !important;
}
[data-theme="dark"] .pt-manager-root .toolbar .search-input :deep(.el-input__wrapper.is-focus) {
  border-color: #16a34a !important;
  box-shadow: 0 0 0 1px #16a34a inset !important;
}
[data-theme="dark"] .totp-manager .toolbar .search-input :deep(.el-input__wrapper.is-focus) {
  border-color: #2563eb !important;
  box-shadow: 0 0 0 1px #2563eb inset !important;
}
[data-theme="dark"] .pt-manager-root .toolbar .compact,
[data-theme="dark"] .totp-manager .toolbar .compact {
  background: #1e293b !important;
  border-color: #334155 !important;
  color: #cbd5e1 !important;
}
[data-theme="dark"] .pt-manager-root .toolbar .compact:hover,
[data-theme="dark"] .totp-manager .toolbar .compact:hover {
  background: #334155 !important;
  color: #f1f5f9 !important;
}
[data-theme="dark"] .pt-manager-root .toolbar .add-button {
  background: #16a34a !important;
  border-color: #16a34a !important;
  color: #fff !important;
}
[data-theme="dark"] .pt-manager-root .toolbar .add-button:hover {
  background: #15803d !important;
  border-color: #15803d !important;
}
[data-theme="dark"] .totp-manager .toolbar .add-button {
  background: #2563eb !important;
  border-color: #2563eb !important;
  color: #fff !important;
}
[data-theme="dark"] .totp-manager .toolbar .add-button:hover {
  background: #1d4ed8 !important;
  border-color: #1d4ed8 !important;
}
[data-theme="dark"] .pt-manager-root .pt-tabs,
[data-theme="dark"] .totp-manager .totp-tabs {
  background: #1e293b !important;
  border-bottom-color: #334155 !important;
}
[data-theme="dark"] .pt-manager-root .pt-tab-item,
[data-theme="dark"] .totp-manager .totp-tab-item {
  color: #94a3b8 !important;
}
[data-theme="dark"] .pt-manager-root .pt-tab-item:hover,
[data-theme="dark"] .totp-manager .totp-tab-item:hover {
  color: #e2e8f0 !important;
}
[data-theme="dark"] .pt-manager-root .pt-tab-item.active,
[data-theme="dark"] .totp-manager .totp-tab-item.active {
  color: #16a34a !important;
}
[data-theme="dark"] .pt-card .card-password-row {
  border-top-color: #334155 !important;
}
[data-theme="dark"] .pt-card .password-value {
  color: #e2e8f0 !important;
}
[data-theme="dark"] .pt-card .site-domain.link-style,
[data-theme="dark"] .totp-card .site-domain.link-style {
  color: #60a5fa !important;
}
[data-theme="dark"] .pt-card .site-username:hover,
[data-theme="dark"] .totp-card .site-username:hover {
  color: #60a5fa !important;
}
[data-theme="dark"] .pt-manager-root .empty-text,
[data-theme="dark"] .totp-manager .empty-text {
  color: #94a3b8 !important;
}

/* ========== PT凭据与两步验证卡片深度深色适配 ========== */
[data-theme="dark"] .pt-card,
[data-theme="dark"] .bl-card,
[data-theme="dark"] .pt-loading-card,
[data-theme="dark"] .totp-card,
[data-theme="dark"] .totp-loading-card {
  background: #1e293b !important;
  border-color: #334155 !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
}
[data-theme="dark"] .pt-card:hover,
[data-theme="dark"] .bl-card:hover,
[data-theme="dark"] .totp-card:hover {
  border-color: rgba(96, 165, 250, 0.4) !important;
  box-shadow: 0 4px 16px rgba(96, 165, 250, 0.08) !important;
  transform: translateY(-1px) !important;
}
[data-theme="dark"] .pt-card .site-name,
[data-theme="dark"] .bl-card .site-name,
[data-theme="dark"] .totp-card .site-name {
  color: #f1f5f9 !important;
}
[data-theme="dark"] .pt-card .site-domain,
[data-theme="dark"] .bl-card .site-domain,
[data-theme="dark"] .totp-card .site-domain {
  color: #94a3b8 !important;
}
[data-theme="dark"] .pt-card .site-domain.link-style,
[data-theme="dark"] .bl-card .site-domain.link-style,
[data-theme="dark"] .totp-card .site-domain.link-style {
  color: #60a5fa !important;
}
[data-theme="dark"] .pt-card .site-domain.link-style:hover,
[data-theme="dark"] .bl-card .site-domain.link-style:hover,
[data-theme="dark"] .totp-card .site-domain.link-style:hover {
  color: #93c5fd !important;
}
[data-theme="dark"] .pt-card .site-username {
  color: #cbd5e1 !important;
}
[data-theme="dark"] .pt-card .site-username:hover {
  color: #60a5fa !important;
}
[data-theme="dark"] .pt-card .card-actions,
[data-theme="dark"] .bl-card .card-actions,
[data-theme="dark"] .pt-loading-actions,
[data-theme="dark"] .totp-card .card-actions,
[data-theme="dark"] .totp-loading-actions {
  background: #0f172a !important;
  border: 1px solid #334155 !important;
}
[data-theme="dark"] .pt-card .action-btn,
[data-theme="dark"] .bl-card .action-btn,
[data-theme="dark"] .totp-card .action-btn {
  color: #cbd5e1 !important;
  border-radius: 0 !important;
}
[data-theme="dark"] .pt-card .card-actions .action-btn:first-child,
[data-theme="dark"] .totp-card .card-actions .action-btn:first-child {
  border-radius: 4px 0 0 4px !important;
}
[data-theme="dark"] .pt-card .card-actions .action-btn:last-child,
[data-theme="dark"] .totp-card .card-actions .action-btn:last-child {
  border-radius: 0 4px 4px 0 !important;
}
[data-theme="dark"] .pt-card .action-btn svg,
[data-theme="dark"] .bl-card .action-btn svg,
[data-theme="dark"] .totp-card .action-btn svg {
  fill: currentColor !important;
  color: #cbd5e1 !important;
}
[data-theme="dark"] .pt-card .action-btn:hover,
[data-theme="dark"] .bl-card .action-btn:hover,
[data-theme="dark"] .totp-card .action-btn:hover {
  background: rgba(255, 255, 255, 0.12) !important;
  color: #60a5fa !important;
}
[data-theme="dark"] .pt-card .action-btn:hover svg,
[data-theme="dark"] .bl-card .action-btn:hover svg,
[data-theme="dark"] .totp-card .action-btn:hover svg {
  fill: currentColor !important;
  color: #60a5fa !important;
}
[data-theme="dark"] .pt-card .card-password-row,
[data-theme="dark"] .bl-card .bl-info-row,
[data-theme="dark"] .pt-loading-password-row,
[data-theme="dark"] .totp-card .card-code-row,
[data-theme="dark"] .totp-loading-code-row {
  border-top-color: #334155 !important;
}
[data-theme="dark"] .pt-loading-shimmer,
[data-theme="dark"] .totp-loading-shimmer {
  background: linear-gradient(90deg, #334155 25%, #475569 37%, #334155 63%) !important;
  background-size: 400% 100% !important;
}
[data-theme="dark"] .pt-card .pw-wrap,
[data-theme="dark"] .totp-card .code-wrap {
  background: transparent !important;
  border: none !important;
}
[data-theme="dark"] .pt-card .password-label,
[data-theme="dark"] .totp-card .code-label {
  color: #64748b !important;
}
[data-theme="dark"] .pt-card .password-value {
  color: #e2e8f0 !important;
}
[data-theme="dark"] .totp-card .code-value {
  color: #60a5fa !important;
}
[data-theme="dark"] .totp-card .code-value:hover {
  color: #93c5fd !important;
}
[data-theme="dark"] .pt-card .time-wrap,
[data-theme="dark"] .bl-card .time-wrap {
  color: #64748b !important;
}
[data-theme="dark"] .bl-card .bl-info-row {
  border-top-color: #334155 !important;
}
[data-theme="dark"] .bl-card .bl-tag.el-tag--warning {
  background: rgba(245, 158, 11, 0.15) !important;
  border-color: rgba(245, 158, 11, 0.3) !important;
  color: #fbbf24 !important;
}
[data-theme="dark"] .bl-card .bl-tag.el-tag--danger {
  background: rgba(239, 68, 68, 0.15) !important;
  border-color: rgba(239, 68, 68, 0.3) !important;
  color: #f87171 !important;
}
[data-theme="dark"] .bl-card .bl-tag-icon {
  fill: currentColor !important;
}
[data-theme="dark"] .totp-card .timer-bg {
  stroke: #334155 !important;
}
[data-theme="dark"] .totp-card .timer-progress {
  stroke: #60a5fa !important;
}
[data-theme="dark"] .totp-card .timer-text {
  color: #60a5fa !important;
}
[data-theme="dark"] .webdav-backup-item {
  background: #1e293b !important;
  border-color: #334155 !important;
}
[data-theme="dark"] .webdav-backup-item:hover {
  background: #334155 !important;
  border-color: #475569 !important;
}
[data-theme="dark"] .webdav-backup-item.is-checked {
  background: rgba(59, 130, 246, 0.15) !important;
  border-color: rgba(59, 130, 246, 0.4) !important;
}
[data-theme="dark"] .webdav-backup-item .backup-name {
  color: #e2e8f0 !important;
}
[data-theme="dark"] .webdav-backup-item .backup-meta {
  color: #94a3b8 !important;
}

/* ========== PluginManager.vue 插件管理深色背景 ========== */
[data-theme="dark"] .iframe-box {
  background: #0f172a !important;
}

/* ========== 全局 el-button 深色主题统一适配 ========== */
[data-theme="dark"] .el-button {
  background: #1e293b !important;
  border-color: #334155 !important;
  color: #cbd5e1 !important;
}
[data-theme="dark"] .el-button:hover,
[data-theme="dark"] .el-button:focus {
  background: #334155 !important;
  border-color: #475569 !important;
  color: #e2e8f0 !important;
}
/* 各种状态按钮在深色下的适配 */
[data-theme="dark"] .el-button--primary {
  background: #2563eb !important;
  border-color: #2563eb !important;
  color: #ffffff !important;
}
[data-theme="dark"] .el-button--primary:hover,
[data-theme="dark"] .el-button--primary:focus {
  background: #1d4ed8 !important;
  border-color: #1d4ed8 !important;
}
[data-theme="dark"] .el-button--danger {
  background: #ef4444 !important;
  border-color: #ef4444 !important;
  color: #ffffff !important;
}
[data-theme="dark"] .el-button--danger:hover {
  background: #dc2626 !important;
  border-color: #dc2626 !important;
}
[data-theme="dark"] .el-button--warning {
  background: #f59e0b !important;
  border-color: #f59e0b !important;
  color: #ffffff !important;
}
[data-theme="dark"] .el-button--warning:hover {
  background: #d97706 !important;
  border-color: #d97706 !important;
}
[data-theme="dark"] .el-button--success {
  background: #10b981 !important;
  border-color: #10b981 !important;
  color: #ffffff !important;
}
[data-theme="dark"] .el-button--success:hover {
  background: #059669 !important;
  border-color: #059669 !important;
}

/* ========== 全局进度条轨道适配 ========== */
[data-theme="dark"] .el-progress-bar__outer {
  background-color: #334155 !important;
}

/* ========== 下载管理专属细节优化 ========== */
[data-theme="dark"] .download-manager .downloader-select .el-select__wrapper {
  background: #0f172a !important;
  box-shadow: 0 0 0 1px #334155 inset !important;
}
[data-theme="dark"] .download-manager .downloader-select .el-select__selected-item span {
  color: #e2e8f0 !important;
}
[data-theme="dark"] .download-manager .download-item .episode {
  color: #94a3b8 !important;
}
[data-theme="dark"] .download-manager .download-item .media-poster.placeholder {
  border: 1px solid #334155 !important;
}
[data-theme="dark"] .el-empty__description p {
  color: #64748b !important;
}
[data-theme="dark"] .el-empty__image svg {
  filter: invert(0.9) hue-rotate(180deg) brightness(0.7) contrast(0.9) !important;
  opacity: 0.65 !important;
}


/* ========== 全局 el-select 下拉框修补 ========== */
[data-theme="dark"] .el-select-dropdown {
  background: #1e293b !important;
  border-color: #334155 !important;
}
[data-theme="dark"] .el-select-dropdown__item,
[data-theme="dark"] .el-select-dropdown__item span {
  color: #cbd5e1 !important;
}
[data-theme="dark"] .el-select-dropdown__item.is-hovering,
[data-theme="dark"] .el-select-dropdown__item.is-hovering span {
  background: rgba(255, 255, 255, 0.08) !important;
  color: #60a5fa !important;
}
[data-theme="dark"] .el-select-dropdown__item.is-selected,
[data-theme="dark"] .el-select-dropdown__item.is-selected span {
  color: #60a5fa !important;
  background: rgba(59, 130, 246, 0.15) !important;
  font-weight: bold !important;
}

/* ========== 修复 Sites.vue 卡片操作按钮背景污染 ========== */
[data-theme="dark"] .sites-root .card-actions {
  background: transparent !important;
  border: none !important;
  padding: 0 !important;
  box-shadow: none !important;
}

/* ========== 优化 Sites.vue 同步数据按钮悬浮效果 ========== */
[data-theme="dark"] .sites-root .action-btn.primary {
  background: #2563eb !important;
  color: #ffffff !important;
  box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2) !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
}

[data-theme="dark"] .sites-root .action-btn.primary .btn-icon {
  transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1) !important;
}

[data-theme="dark"] .sites-root .action-btn.primary:hover {
  background: #1d4ed8 !important;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.45) !important;
  transform: translateY(-1px) !important;
}

[data-theme="dark"] .sites-root .action-btn.primary:hover .btn-icon {
  transform: rotate(360deg) !important;
}

/* ========== 全局 el-dropdown 菜单深色适配 ========== */
[data-theme="dark"] .el-dropdown-menu {
  background: #1e293b !important;
  border-color: #334155 !important;
}
[data-theme="dark"] .el-dropdown-menu__item {
  color: #cbd5e1 !important;
}
[data-theme="dark"] .el-dropdown-menu__item:hover,
[data-theme="dark"] .el-dropdown-menu__item:focus,
[data-theme="dark"] .el-dropdown-menu__item:not(.is-disabled):focus {
  background-color: rgba(255, 255, 255, 0.08) !important;
  color: #60a5fa !important;
}
[data-theme="dark"] .el-dropdown-menu__item.is-disabled {
  color: #475569 !important;
  background-color: transparent !important;
}
[data-theme="dark"] .el-dropdown-menu__item--divided {
  border-top-color: #334155 !important;
}
[data-theme="dark"] .el-dropdown-menu__item--divided::before {
  background-color: #334155 !important;
}

/* ========== 全局 PIN 验证频率卡片深色适配 ========== */
[data-theme="dark"] .frequency-block {
  border-top-color: #334155 !important;
}
[data-theme="dark"] .frequency-option {
  background: #1e293b !important;
  border-color: #334155 !important;
}
[data-theme="dark"] .frequency-option:hover {
  background: rgba(255, 255, 255, 0.04) !important;
  border-color: #475569 !important;
}
[data-theme="dark"] .frequency-option.is-checked {
  background: rgba(59, 130, 246, 0.15) !important;
  border-color: rgba(59, 130, 246, 0.45) !important;
}
[data-theme="dark"] .frequency-option .frequency-title {
  color: #e2e8f0 !important;
}
[data-theme="dark"] .frequency-option.is-checked .frequency-title {
  color: #60a5fa !important;
}
[data-theme="dark"] .frequency-option .frequency-desc {
  color: #94a3b8 !important;
}

/* ========== 全局弹窗提示框 (dialog-tip) 深色适配 ========== */
[data-theme="dark"] .dialog-tip {
  background: rgba(245, 158, 11, 0.1) !important;
  border-color: rgba(245, 158, 11, 0.25) !important;
  color: #fb923c !important;
}
</style>

<style scoped>
/* 根容器与布局 */
.popup-root {
  width: 400px;
  max-width: 400px;
  min-width: 400px;
  height: 500px; /* 固定弹窗高度 */
  padding: 0; /* 去掉外层 padding，保证宽度独立 */
  margin: 0;
  border: none;
  box-sizing: border-box;
  background: linear-gradient(180deg, #f6f9ff 0%, #ffffff 100%);
  display: flex;
  overflow: hidden; /* 防止外层滚动 */
  position: relative;
}

.layout { align-items: stretch; justify-content: flex-start; }
.content { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; overflow: hidden; min-height: 0; width: 100%; max-width: 100%; box-sizing: border-box; }
.content > .card { padding: 12px; margin: 12px; }
.content-inner { padding: 0; flex: 1 1 0; overflow-y: scroll; overflow-x: hidden; width: 100%; max-width: 100%; box-sizing: border-box; }
/* 保证标题栏不被压缩 */
.content > :first-child { flex: 0 0 auto; }
.content > .pin-lock-page { flex: 1 1 auto; }

/* 卡片样式 */
.card {
  width: calc(100% - 24px);
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
  padding: 12px;
  border: 1px solid rgba(0,0,0,0.04);
}

.brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}
.brand img {
  width: 56px;
  height: 56px;
}
.brand .title {
  font-size: 18px;
  font-weight: 600;
}

.form :deep(.el-input) {
  --el-input-border-radius: 10px;
}

.input-lg :deep(.el-input__wrapper) {
  height: 40px;
}
.icon-prefix { opacity: .72; }

.submit {
  width: 100%;
  margin-top: 2px;
  border-radius: 10px;
}

.error { margin-top: 6px; }

.pin-lock-page {
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  background:
    radial-gradient(circle at top, rgba(59,130,246,0.14), transparent 34%),
    linear-gradient(180deg, #f6f9ff 0%, #ffffff 100%);
}
.pin-lock-card {
  width: 100%;
  max-width: 352px !important;
  margin: 0;
  padding: 20px 18px 18px;
  border-radius: 20px;
  box-shadow: none;
}
.pin-brand {
  margin-bottom: 16px;
}
.pin-brand img {
  width: 58px;
  height: 58px;
}
.pin-subtitle {
  color: #64748b;
  font-size: 12px;
  line-height: 1.4;
  text-align: center;
}
.pin-lock-card :deep(.el-form-item) {
  margin-bottom: 14px;
}
.pin-lock-card .pin-code-inputs {
  display: flex;
  gap: 6px;
  justify-content: center;
  width: 100%;
  padding: 4px 0;
}
.pin-lock-card .pin-code-box {
  width: 38px;
  height: 38px;
  text-align: center;
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
  border: 2px solid #e2e8f0;
  border-radius: 10px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.8);
  outline: none;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  caret-color: #3b82f6;
}
.pin-lock-card .pin-code-box:focus {
  border-color: #3b82f6;
  background: #ffffff;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15), 0 1px 3px rgba(59, 130, 246, 0.10);
}
.pin-lock-card .pin-code-box:valid {
  border-color: #60a5fa;
  background: linear-gradient(180deg, #ffffff 0%, #eff6ff 100%);
  box-shadow: 0 1px 2px rgba(59, 130, 246, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.9);
}
.pin-unlock-btn {
  width: 100%;
  border-radius: 10px;
  height: 40px;
}

.btn-row {
  display: flex;
  gap: 6px;
  margin-top: 2px;
}
.btn-row .btn {
  flex: 1 1 0;
  border-radius: 10px;
}
.form-row-two {
  display: flex;
  gap: 12px;
}
.form-row-two .flex-half {
  flex: 1 1 0;
  min-width: 0;
}
.meta { display:flex; align-items:center; justify-content:center; gap:6px; font-size: 12px; color:#94a3b8; margin: 6px 12px 0; }
.meta .dot { opacity: .6; }
.moviepilot-link { 
  color: #3b82f6; 
  text-decoration: none; 
  transition: color 0.2s ease;
}
.moviepilot-link:hover { 
  color: #1d4ed8; 
  text-decoration: underline;
}
</style>


