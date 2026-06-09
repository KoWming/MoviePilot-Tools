<template>
  <aside class="sidebar">
    <div class="logo" @click="$emit('openWeb')">
      <img src="/icons/icon.png" alt="logo" />
    </div>
    <div class="menu">
      <button
        v-for="item in menuItems"
        :key="item.id"
        :class="['item', current === item.id && 'active']"
        @click="$emit('navigate', item.id)"
        :title="item.label"
      >
        <svg viewBox="0 0 24 24"><path :d="item.icon"/></svg>
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
// ============================================================
// 侧边栏导航组件
// 显示用户头像、导航菜单项、主题切换
// ============================================================
import {
  mdiAccountCircle, mdiChartLine, mdiWeb, mdiShieldKey,
  mdiPuzzleOutline, mdiDownload, mdiInformationOutline,
  mdiCogOutline, mdiKeyOutline
} from '@mdi/js';

// ==================== 菜单配置 ====================
type PageId = 'dashboard' | 'sites' | 'site-management' | 'totp-manager' | 'pt-creds-manager' | 'plugin-manager' | 'download-manager' | 'settings' | 'about';

const menuItems: { id: PageId; icon: string; label: string }[] = [
  { id: 'site-management', icon: mdiWeb, label: '站点管理' },
  { id: 'sites', icon: mdiChartLine, label: '站点数据' },
  { id: 'download-manager', icon: mdiDownload, label: '下载管理' },
  { id: 'totp-manager', icon: mdiShieldKey, label: '两步验证' },
  { id: 'pt-creds-manager', icon: mdiKeyOutline, label: '凭据管理' },
  { id: 'plugin-manager', icon: mdiPuzzleOutline, label: '插件管理' },
  { id: 'dashboard', icon: mdiAccountCircle, label: '用户信息' },
  { id: 'settings', icon: mdiCogOutline, label: '设置' },
  { id: 'about', icon: mdiInformationOutline, label: '关于' },
];

// ==================== Props / Emits ====================
defineProps<{ current: PageId }>();
defineEmits(['navigate', 'openWeb']);
</script>

<style scoped>
.sidebar {
  width: 48px;
  min-width: 48px;
  flex: 0 0 48px;
  background: #fff;
  border-right: 1px solid rgba(0, 0, 0, 0.06);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 6px;
  gap: 8px;
}

.logo img {
  width: 28px;
  height: 28px;
  cursor: pointer;
}

.menu {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.item {
  position: relative;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  border: none;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.item svg {
  width: 18px;
  height: 18px;
  fill: currentColor;
  color: #606266;
  transition: color 0.2s ease;
}

.item.active {
  color: #1677ff;
}

.item.active svg {
  color: #1677ff;
}

.item:hover {
  transform: scale(1.1);
  background: transparent;
}

/* 活跃菜单项左侧指示条 */
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


