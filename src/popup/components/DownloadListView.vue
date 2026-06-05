<template>
  <div class="download-list">
    <!-- 加载状态（仅首次加载显示骨架屏） -->
    <div v-if="isFirstLoad && downloads.length === 0" class="loading">
      <el-skeleton :rows="3" animated />
    </div>
    
    <!-- 下载任务列表 -->
    <div v-else-if="downloads.length > 0" class="download-items">
      <DownloadItem
        v-for="download in downloads"
        :key="download.hash"
        :download="download"
        :downloader-name="downloaderName"
        @refresh="refresh"
        @state-changed="onStateChanged"
      />
    </div>
    
    <!-- 空状态 -->
    <div v-else class="empty">
      <el-empty description="暂无下载任务" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { downloadApi, type DownloadingInfo } from '../../shared/api/download';
import DownloadItem from './DownloadItem.vue';
import { ElMessage } from 'element-plus';

const props = defineProps<{
  downloaderName: string;
}>();

const downloads = ref<DownloadingInfo[]>([]);
// 追踪扩展内点击暂停的 hash，仅用于操作后的即时 UI 状态
const pausedHashes = ref(new Set<string>());
// 仅首次加载展示骨架屏
const isFirstLoad = ref(true);
// 刷新状态（不影响骨架屏展示）
const isRefreshing = ref(false);
let refreshTimer: number | null = null;

// 加载下载任务（可选：是否为首次加载）
async function loadDownloads(first = false) {
  if (first) isFirstLoad.value = true; else isRefreshing.value = true;
  try {
    const data = await downloadApi.getDownloading(props.downloaderName);
    downloads.value = await applyDirectTorrentStates(data ?? []);
  } catch (error) {
    console.error('加载下载任务失败:', error);
    ElMessage.error('加载下载任务失败');
  } finally {
    if (first) isFirstLoad.value = false; else isRefreshing.value = false;
  }
}

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

// 暴露给父组件的刷新方法
function refresh() {
  return loadDownloads(false);
}

function onStateChanged(payload: { hash: string; state: string }) {
  if (payload.state === 'paused') {
    pausedHashes.value.add(payload.hash);
  } else {
    pausedHashes.value.delete(payload.hash);
  }
}

defineExpose({ refresh });

// 自动刷新
function startAutoRefresh() {
  stopAutoRefresh();
  refreshTimer = setInterval(() => loadDownloads(false), 5000);
}

function stopAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

// 监听下载器变化
watch(
  () => props.downloaderName,
  () => {
    pausedHashes.value.clear();
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

.loading {
  flex: 1;
  padding: 16px;
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

