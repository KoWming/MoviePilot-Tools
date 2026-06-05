<template>
  <div
    class="popup-root layout"
    id="popup-root"
    :class="{ 'has-custom-bg': bgStore.enabled && bgStore.image }"
    style="position: relative;"
  >
    <!-- Custom Background Layer -->
    <div
      v-if="bgStore.enabled && bgStore.image"
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
        <PTCredsManager v-else-if="view==='pt-creds-manager'" />
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
import { reactive, ref, onMounted, onUnmounted, computed, nextTick, watch } from 'vue';
import { loginByPassword } from '../shared/api/auth';
import { mdiLink, mdiAccount, mdiLockOutline, mdiChartLine, mdiWeb, mdiShieldKey, mdiPuzzleOutline, mdiDownload, mdiInformationOutline, mdiCogOutline, mdiKeyOutline } from '@mdi/js';
import { ElMessage } from 'element-plus';
import User from './views/User.vue';
import Sites from './views/Sites.vue';
import SiteManagement from './views/SiteManagement.vue';
import TOTPManager from './views/TOTPManager.vue';
import PTCredsManager from './views/PTCredsManager.vue';
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

// Watch background settings to toggle body classes
watch(
  () => bgStore.enabled && bgStore.image,
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
  // 监听后台导航事件
  try {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg?.type === 'NAVIGATE_TO_ROUTE') {
        const path = (msg.path || '/download') as string;
        if (path === '/download') {
          view.value = 'download-manager';
          // 向下载管理器传递 URL 和标题
          if (msg.url) {
            chrome.storage.local.set({ 'mp.pt_download_info': { url: msg.url, title: msg.title } });
          }
        }
      }
    });
    // 消费可能已写入的 pending_route
    const pending = await chrome.storage.local.get(['mp.pending_route']);
    if (pending && pending['mp.pending_route']) {
      const route = pending['mp.pending_route'] as any;
      if (route?.path === '/download') {
        view.value = 'download-manager';
        // 向下载管理器传递 URL 和标题
        if (route.url) {
          chrome.storage.local.set({ 'mp.pt_download_info': { url: route.url, title: route.title } });
        }
      }
      chrome.storage.local.remove(['mp.pending_route']);
    }
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
    case 'pt-creds-manager': return 'PT 账号管理';
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
.popup-root.has-custom-bg .totp-root,
.popup-root.has-custom-bg .download-root,
.popup-root.has-custom-bg .plugin-root,
.popup-root.has-custom-bg .about-root,
.popup-root.has-custom-bg .pin-lock-page,
.popup-root.has-custom-bg .stats-panel {
  background: transparent !important;
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
.popup-root.has-custom-bg .totp-card,
.popup-root.has-custom-bg .site-card,
.popup-root.has-custom-bg .ov-card,
.popup-root.has-custom-bg .download-card,
.popup-root.has-custom-bg .comprehensive-card,
.popup-root.has-custom-bg .refresh-status,
.popup-root.has-custom-bg .site-management .toolbar {
  background: rgba(255, 255, 255, 0.45) !important;
  backdrop-filter: blur(12px) saturate(110%);
  -webkit-backdrop-filter: blur(12px) saturate(110%);
  border: 1px solid rgba(255, 255, 255, 0.25) !important;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05) !important;
}

/* Make PT manager toolbar transparent under custom background */
.popup-root.has-custom-bg .pt-manager-root .toolbar {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
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
.popup-root.has-custom-bg .el-button:not(.el-button--primary):not(.el-button--danger):not(.el-button--success):not(.el-button--warning):not(.el-button--info) {
  background: rgba(255, 255, 255, 0.4) !important;
  backdrop-filter: blur(6px) !important;
  -webkit-backdrop-filter: blur(6px) !important;
  border: 1px solid rgba(255, 255, 255, 0.25) !important;
  color: #334155 !important;
  transition: all 0.2s ease;
}
.popup-root.has-custom-bg .el-button:not(.el-button--primary):not(.el-button--danger):not(.el-button--success):not(.el-button--warning):not(.el-button--info):hover {
  background: rgba(255, 255, 255, 0.55) !important;
}

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
  background-color: rgba(255, 255, 255, 0.25) !important;
  border-color: rgba(255, 255, 255, 0.2) !important;
  backdrop-filter: blur(4px) !important;
  -webkit-backdrop-filter: blur(4px) !important;
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
/* Overview icon wraps */
.popup-root.has-custom-bg .ov-card .icon-wrap {
  backdrop-filter: blur(4px) !important;
  -webkit-backdrop-filter: blur(4px) !important;
  border: 1px solid rgba(255, 255, 255, 0.15) !important;
}
.popup-root.has-custom-bg .ov-card .icon-wrap.green {
  background: rgba(34, 197, 94, 0.45) !important;
}
.popup-root.has-custom-bg .ov-card .icon-wrap.blue {
  background: rgba(59, 130, 246, 0.45) !important;
}
.popup-root.has-custom-bg .ov-card .icon-wrap.orange {
  background: rgba(245, 158, 11, 0.45) !important;
}
.popup-root.has-custom-bg .ov-card .icon-wrap.red {
  background: rgba(239, 68, 68, 0.45) !important;
}

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
.popup-root.has-custom-bg .pt-card .time-wrap {
  color: #475569 !important;
}
.popup-root.has-custom-bg .pt-card .password-value {
  color: #0f172a !important;
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


