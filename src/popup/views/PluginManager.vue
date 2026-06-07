<template>
  <div class="wrap">
    <div class="iframe-box">
      <iframe ref="iframeRef" :src="iframeUrl" class="iframe" @load="onIframeLoad" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { STORAGE_KEYS } from '../../shared/constants';
import { loadCredentials } from '../../shared/secureStorage';
import { themeState } from '../../shared/stores/themeStore';

const iframeRef = ref<HTMLIFrameElement | null>(null);
const iframeUrl = ref('');

async function getBaseURL(): Promise<string> {
  const data = await chrome.storage.local.get([STORAGE_KEYS.BASE_URL]);
  if (data[STORAGE_KEYS.BASE_URL]) return data[STORAGE_KEYS.BASE_URL] as string;
  try {
    const sd = await chrome.storage.sync.get([STORAGE_KEYS.BASE_URL]);
    const u = sd[STORAGE_KEYS.BASE_URL] as string | undefined;
    if (u) { await chrome.storage.local.set({ [STORAGE_KEYS.BASE_URL]: u }); return u; }
  } catch {}
  return '';
}

async function load() {
  const base = await getBaseURL();
  (window as any).__mp_base_url = base;
  iframeUrl.value = `${base}/#/plugins?tab=installed&theme=${themeState.effective}`;
}

function sendThemeToIframe(theme: 'light' | 'dark') {
  if (!iframeRef.value?.contentWindow) return;
  try {
    iframeRef.value.contentWindow.postMessage(
      { type: 'MP_THEME_CHANGE', theme },
      '*'
    );
  } catch {}
}

// 监听主题状态变化，同步给 iframe
watch(
  () => themeState.effective,
  (newTheme) => {
    sendThemeToIframe(newTheme);
  }
);

function onIframeLoad() {
  sendThemeToIframe(themeState.effective);
}

// 响应 iframe 的请求
async function onMessage(event: MessageEvent) {
  if (event.data?.type === 'MP_IFRAME_NEED_AUTH') {
    sendThemeToIframe(themeState.effective);
    try {
      const creds = await loadCredentials();
      if (!creds?.username || !creds?.password) return;
      iframeRef.value?.contentWindow?.postMessage(
        { type: 'MP_IFRAME_AUTH', username: creds.username, password: creds.password },
        event.origin
      );
    } catch { /* 静默忽略 */ }
  } else if (event.data?.type === 'MP_IFRAME_NEED_THEME') {
    sendThemeToIframe(themeState.effective);
  }
}

onMounted(() => {
  load();
  window.addEventListener('message', onMessage);
});

onUnmounted(() => {
  window.removeEventListener('message', onMessage);
});
</script>

<style scoped>
.wrap {
  padding: 0;
  margin: 0;
  height: 100%;
}
.iframe-box {
  height: 100%;
  width: 100%;
  border: 0;
  border-radius: 0;
  overflow: hidden;
}
.iframe {
  width: 100%;
  height: 100%;
  border: 0;
  display: block;
}
</style>


