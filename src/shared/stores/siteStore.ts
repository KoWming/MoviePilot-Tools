// ============================================================
// 站点状态响应式 Store
// 管理站点待更新计数和最后更新时间
// ============================================================

import { reactive } from 'vue';

// 站点状态 Store（Vue 3 响应式对象）
export const siteStore = reactive({
  pendingUpdateCount: 0,  // 待更新站点数量
  lastUpdateTime: 0       // 最后更新时间戳
});

// 更新待更新站点计数
export function updatePendingCount(count: number) {
  siteStore.pendingUpdateCount = count;
  siteStore.lastUpdateTime = Date.now();
}

// 获取待更新站点数量
export function getPendingCount(): number {
  return siteStore.pendingUpdateCount;
}
