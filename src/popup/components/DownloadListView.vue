<template>
  <div class="download-list">
    <!-- 加载状态（仅首次加载显示中性提示，避免误导为必然存在下载任务） -->
    <div v-if="isFirstLoad && downloads.length === 0" class="download-checking-state">
      <div class="download-checking-indicator">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <div class="download-checking-title">正在检查下载任务</div>
      <div class="download-checking-desc">加载完成后将显示下载任务或空状态</div>
    </div>
    
    <!-- 下载任务列表 -->
    <div v-else-if="downloads.length > 0" class="download-items">
      <DownloadItem
        v-for="download in downloads"
        :key="download.hash"
        :download="download"
        :downloader-name="downloaderName"
        @refresh="refresh"

      />
    </div>
    
    <!-- 空状态 -->
    <div v-else class="empty">
      <el-empty description="暂无下载任务" />
    </div>
  </div>
</template>

<script setup lang="ts">
// ============================================================
// 下载列表视图组件
// 批量操作、状态过滤、下载任务列表展示
// ============================================================
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { downloadApi, type DownloadingInfo } from '../../shared/api/download';
import DownloadItem from './DownloadItem.vue';
import { ElMessage } from 'element-plus';

// ==================== Props ====================
const props = defineProps<{
  downloaderName: string;
}>();

// ==================== 响应式状态 ====================
const downloads = ref<DownloadingInfo[]>([]);
// 仅首次加载展示检查中提示
const isFirstLoad = ref(true);
let refreshTimer: number | null = null;

// ==================== 数据加载 ====================
// 加载下载任务（first=true 时展示首次加载提示）
async function loadDownloads(first = false) {
  if (first) isFirstLoad.value = true;
  try {
    const data = await downloadApi.getDownloading(props.downloaderName);
    downloads.value = await applyDirectTorrentStates(data ?? []);
  } catch (error) {
    console.error('加载下载任务失败:', error);
    ElMessage.error('加载下载任务失败');
  } finally {
    if (first) isFirstLoad.value = false;
  }
}

// 通过扩展后台直接查询下载器状态，修正 MP 接口返回的过期状态
async function applyDirectTorrentStates(items: DownloadingInfo[]): Promise<DownloadingInfo[]> {
  const hashes = items.map(item => item.hash).filter(Boolean);
  if (!props.downloaderName || hashes.length === 0 || !chrome?.runtime?.sendMessage) {
    return items;
  }

  try {
    const resp = await chrome.runtime.sendMessage({
      type: 'MP_DIRECT_TORRENT_STATES',
      downloader: props.downloaderName,
      hashes
    });
    const states = resp?.success ? (resp.states || {}) as Record<string, DownloadingInfo['state']> : {};
    if (Object.keys(states).length === 0) return items;

    return items.map(item => {
      const directState = states[item.hash.toLowerCase()];
      if (!directState || directState === item.state) return item;
      return { ...item, state: directState };
    });
  } catch (error) {
    console.warn('直接查询下载器状态失败，使用 MP 返回状态:', error);
    return items;
  }
}

// ==================== 刷新控制 ====================
// 暴露给父组件的刷新方法
function refresh() {
  return loadDownloads(false);
}

// 自动刷新（每 5 秒）
function startAutoRefresh() {
  stopAutoRefresh();
  refreshTimer = setInterval(() => loadDownloads(false), 5000);
}

// 停止自动刷新
function stopAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

// ==================== 生命周期 ====================
// 监听下载器切换，重新加载
watch(
  () => props.downloaderName,
  () => {
    loadDownloads(true);
    startAutoRefresh();
  }
);

onMounted(() => {
  loadDownloads(true);
  startAutoRefresh();
});

onUnmounted(() => {
  stopAutoRefresh();
});
</script>

<style scoped>
.download-list {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.download-checking-state {
  flex: 1;
  margin: 8px;
  border-radius: 10px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 32px 16px;
  pointer-events: none;
}

.download-checking-indicator {
  display: flex;
  align-items: center;
  gap: 5px;
  height: 24px;
  margin-bottom: 10px;
}

.download-checking-indicator span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #52c41a;
  animation: download-checking-pulse 1.05s ease-in-out infinite;
}

.download-checking-indicator span:nth-child(2) {
  animation-delay: 0.15s;
}

.download-checking-indicator span:nth-child(3) {
  animation-delay: 0.3s;
}

.download-checking-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 4px;
}

.download-checking-desc {
  font-size: 12px;
  color: #6b7280;
}

@keyframes download-checking-pulse {
  0%, 80%, 100% {
    opacity: 0.35;
    transform: scale(0.85);
  }
  40% {
    opacity: 1;
    transform: scale(1);
  }
}

.download-items {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  padding: 8px;
}

.empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
</style>

