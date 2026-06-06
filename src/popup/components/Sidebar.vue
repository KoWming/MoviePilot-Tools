<template>
  <aside class="sidebar">
    <div class="logo" @click="$emit('openWeb')">
      <img src="/icons/icon.png" alt="logo" />
    </div>
    <div class="menu">
      <button :class="['item', current==='site-management' && 'active']" @click="$emit('navigate','site-management')" title="站点管理">
        <svg viewBox="0 0 24 24"><path :d="mdiWeb"/></svg>
      </button>
      <button :class="['item', current==='sites' && 'active']" @click="$emit('navigate','sites')" title="站点数据">
        <svg viewBox="0 0 24 24"><path :d="mdiChartLine"/></svg>
      </button>
      <button :class="['item', current==='download-manager' && 'active']" @click="$emit('navigate','download-manager')" title="下载管理">
        <svg viewBox="0 0 24 24"><path :d="mdiDownload"/></svg>
      </button>
      <button :class="['item', current==='totp-manager' && 'active']" @click="$emit('navigate','totp-manager')" title="两步验证">
        <svg viewBox="0 0 24 24"><path :d="mdiShieldKey"/></svg>
      </button>
      <button :class="['item', current==='pt-creds-manager' && 'active']" @click="$emit('navigate','pt-creds-manager')" title="凭据管理">
        <svg viewBox="0 0 24 24"><path :d="mdiKeyOutline"/></svg>
      </button>
      <button :class="['item', current==='plugin-manager' && 'active']" @click="$emit('navigate','plugin-manager')" title="插件管理">
        <svg viewBox="0 0 24 24"><path :d="mdiPuzzleOutline"/></svg>
      </button>
      <button :class="['item', current==='dashboard' && 'active']" @click="$emit('navigate','dashboard')" title="用户信息">
        <svg viewBox="0 0 24 24"><path :d="mdiAccountCircle"/></svg>
      </button>
      <button :class="['item', current==='settings' && 'active']" @click="$emit('navigate','settings')" title="设置">
        <svg viewBox="0 0 24 24"><path :d="mdiCogOutline"/></svg>
      </button>
      <button :class="['item', current==='about' && 'active']" @click="$emit('navigate','about')" title="关于">
        <svg viewBox="0 0 24 24"><path :d="mdiInformationOutline"/></svg>
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { mdiAccountCircle, mdiChartLine, mdiWeb, mdiShieldKey, mdiPuzzleOutline, mdiDownload, mdiInformationOutline, mdiCogOutline, mdiKeyOutline } from '@mdi/js';
defineProps<{ current: 'dashboard'|'sites'|'site-management'|'totp-manager'|'pt-creds-manager'|'plugin-manager'|'download-manager'|'settings'|'about' }>();
defineEmits(['navigate','openWeb']);
</script>

<style scoped>
.sidebar { width: 48px; min-width: 48px; flex: 0 0 48px; background: #fff; border-right: 1px solid rgba(0,0,0,.06); display:flex; flex-direction:column; align-items:center; padding:8px 6px; gap:8px; }
.logo img { width: 28px; height: 28px; cursor: pointer; }
.menu { display:flex; flex-direction:column; gap:8px; }
.item { position: relative; width: 34px; height: 34px; border-radius: 8px; border: none; background: transparent; display:flex; align-items:center; justify-content:center; cursor:pointer; transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
.item svg { width: 18px; height: 18px; fill: currentColor; color:#606266; transition: color 0.2s ease; }
.item.active { color:#1677ff; }
.item.active svg { color:#1677ff; }
.item:hover { transform: scale(1.1); background: transparent; }
.item::before {
  content: "";
  position: absolute;
  left: -6px;
  width: 3px;
  height: 18px;
  background: #1677ff;
  border-radius: 0 2px 2px 0;
  top: 50%;
  transform: translateY(-50%) scaleY(0);
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease;
  opacity: 0;
  box-shadow: 0 0 8px rgba(22, 119, 255, 0.6);
}
.item.active::before {
  transform: translateY(-50%) scaleY(1);
  opacity: 1;
}
</style>


