<template>
  <header class="topbar">
    <div class="left">
      <svg viewBox="0 0 24 24" class="title-icon"><path :d="icon"/></svg>
      <span class="title">{{ title }}</span>
    </div>
    <div class="right">
      <el-button v-if="showWebBtn" size="small" type="primary" @click="$emit('openWeb')">打开Web端</el-button>
    </div>
  </header>
</template>

<script setup lang="ts">
// ============================================================
// 顶部栏组件
// 当前视图标题、图标、"打开 Web 端"按钮
// ============================================================

defineProps<{ title: string; icon: string; showWebBtn?: boolean }>();
defineEmits(['openWeb']);
</script>

<style scoped>
.topbar {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  background: #ffffff;
  position: sticky;
  top: 0;
  z-index: 10;
}

.left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.title {
  font-weight: 600;
  font-size: 13px;
  color: #34495e;
}

.right {
  display: flex;
  gap: 6px;
}

.title-icon {
  width: 16px;
  height: 16px;
  fill: currentColor;
  color: var(--topbar-icon-color, #34495e);
  opacity: 0.9;
}
</style>


