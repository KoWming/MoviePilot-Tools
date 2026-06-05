import { reactive } from 'vue';

// 站点状态管理
export const siteStore = reactive({
  pendingUpdateCount: 0,
  lastUpdateTime: 0
});

// 更新待更新数量
export function updatePendingCount(count: number) {
  siteStore.pendingUpdateCount = count;
  siteStore.lastUpdateTime = Date.now();
}

// 获取待更新数量
export function getPendingCount(): number {
  return siteStore.pendingUpdateCount;
}
