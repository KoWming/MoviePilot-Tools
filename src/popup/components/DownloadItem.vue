<template>
  <el-card class="download-item" shadow="hover">
    <div class="item-header">
      <div class="media-info">
        <img 
          v-if="download.media?.image" 
          :src="download.media.image" 
          class="media-poster"
          @error="onImageError"
        />
        <div v-else class="media-poster placeholder">
          <el-icon><VideoPlay /></el-icon>
        </div>
        <div class="media-details">
          <div class="title">
            <span>{{ download.media?.title || download.name }}</span>
            <el-tag v-if="seasonLabel" class="season-tag" size="small" type="info">{{ seasonLabel }}</el-tag>
          </div>
          <div class="torrent-title">{{ download.title }}</div>
        </div>
      </div>
      <div class="status-badge">
        <el-tag :type="getStatusType()" size="small">
          {{ getStatusText() }}
        </el-tag>
      </div>
    </div>
    
    <div class="item-content">
      <!-- 进度条 -->
      <div v-if="download.progress > 0" class="progress-section">
        <div class="progress-info">
          <span class="progress-text">{{ formatProgress(download.progress) }}%</span>
          <span class="left-time" v-if="download.left_time">⏱ {{ download.left_time }}</span>
          
          <span class="size-text">{{ formatFileSize(download.size) }}</span>
        </div>
        <el-progress 
          :percentage="download.progress" 
          :stroke-width="6"
          :color="getProgressColor()"
          :show-text="false"
        />
        <!-- 进度条下方左对齐的上传/下载/剩余时间 -->
        <div class="speed-info">
          <div class="speed-item">↑ {{ download.upspeed }}/s</div>
          <div class="speed-item">↓ {{ download.dlspeed }}/s</div>
        </div>
      </div>
      
      <!-- 底部操作按钮 -->
      <div class="actions-bottom">
        <el-button
          :type="isDownloading ? 'warning' : 'success'"
          :icon="isDownloading ? VideoPause : VideoPlay"
          size="small"
          circle
          @click="toggleDownload"
          :loading="actionLoading"
        />
        <el-button
          type="danger"
          :icon="Delete"
          size="small"
          circle
          @click="deleteDownload"
          :loading="actionLoading"
        />
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
// ============================================================
// 下载项组件
// 单个下载任务：进度条、状态图标、操作（暂停/恢复/删除）
// ============================================================
import { ref, computed, watch } from 'vue';
import { 
  VideoPlay, 
  VideoPause, 
  Delete
} from '@element-plus/icons-vue';
import { downloadApi, type DownloadingInfo } from '../../shared/api/download';
import { ElMessage, ElMessageBox } from 'element-plus';

// ==================== Props / Emits ====================
const props = defineProps<{
  download: DownloadingInfo;
  downloaderName: string;
}>();

const emit = defineEmits<{
  refresh: [];
  'state-changed': [payload: { hash: string; state: string }];
}>();

// ==================== 响应式状态 ====================
const actionLoading = ref(false);
// 乐观本地状态，避免暂停/开始后等待刷新导致的 UI 不同步
const localState = ref<string | null>(null);
const currentState = computed(() => localState.value ?? props.download.state);

// 当 props 状态更新且与乐观状态一致时，清除乐观状态
watch(() => props.download.state, (newVal) => {
  if (localState.value && localState.value === newVal) {
    localState.value = null;
  }
});
// ==================== 计算属性 ====================
// 季标签（优先使用结构化数据，其次从文本抽取）
const seasonLabel = computed(() => {
  if (props.download.media?.season) {
    return props.download.media.season.toString();
  }
  const text = props.download.season_episode || '';
  const match = text.match(/S\d{1,2}/i);
  return match ? match[0].toUpperCase() : '';
});
// 是否正在下载
const isDownloading = computed(() => currentState.value === 'downloading');

// ==================== 工具函数 ====================
// 格式化文件大小
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 格式化进度百分比
function formatProgress(progress: number): string {
  if (progress >= 100) return '100';
  if (progress <= 0) return '0';
  
  // 如果进度小于1%，显示2位小数
  if (progress < 1) {
    return progress.toFixed(2);
  }
  
  // 如果进度小于10%，显示1位小数
  if (progress < 10) {
    return progress.toFixed(1);
  }
  
  // 其他情况显示整数
  return Math.round(progress).toString();
}

// ==================== 状态映射 ====================
// 进度条颜色
const PROGRESS_COLORS: Record<string, string> = {
  downloading: '#67C23A',
  paused: '#E6A23C',
  error: '#F56C6C',
  completed: '#909399',
};
function getProgressColor() {
  return PROGRESS_COLORS[currentState.value] || '#67C23A';
}

// 状态标签类型
const STATUS_TYPES: Record<string, string> = {
  downloading: 'success',
  paused: 'warning',
  error: 'danger',
  completed: 'info',
};
function getStatusType() {
  return STATUS_TYPES[currentState.value] || 'info';
}

// 状态文本
const STATUS_TEXTS: Record<string, string> = {
  downloading: '下载中',
  paused: '已暂停',
  error: '错误',
  completed: '已完成',
};
function getStatusText() {
  return STATUS_TEXTS[currentState.value] || '未知';
}

// ==================== 下载操作 ====================
// 切换下载状态（暂停/继续）
async function toggleDownload() {
  actionLoading.value = true;
  const wasDownloading = currentState.value === 'downloading';
  try {
    const result = wasDownloading
      ? await downloadApi.stopDownload(props.download.hash, props.downloaderName)
      : await downloadApi.startDownload(props.download.hash, props.downloaderName);
    
    if (result.success) {
      // 乐观更新本地状态
      localState.value = wasDownloading ? 'paused' : 'downloading';
      emit('state-changed', { hash: props.download.hash, state: localState.value });
      ElMessage.success(wasDownloading ? '已暂停' : '已开始');
      emit('refresh');
    } else {
      ElMessage.error('操作失败');
    }
  } catch (error) {
    console.error('切换下载状态失败:', error);
    ElMessage.error('操作失败');
  } finally {
    actionLoading.value = false;
  }
}

// 删除下载任务
async function deleteDownload() {
  try {
    await ElMessageBox.confirm(
      '确定要删除这个下载任务吗？',
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );
    
    actionLoading.value = true;
    const result = await downloadApi.deleteDownload(props.download.hash, props.downloaderName);
    
    if (result.success) {
      ElMessage.success('删除成功');
      emit('refresh');
    } else {
      ElMessage.error('删除失败');
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除下载任务失败:', error);
      ElMessage.error('删除失败');
    }
  } finally {
    actionLoading.value = false;
  }
}

// 图片加载失败时隐藏
function onImageError(event: Event) {
  (event.target as HTMLImageElement).style.display = 'none';
}
</script>

<style scoped>
.download-item {
  margin-bottom: 6px;
}

.item-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
  position: relative;
}

.media-info {
  display: flex;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.media-poster {
  width: 48px;
  height: 72px;
  border-radius: 4px;
  object-fit: cover;
  flex-shrink: 0;
}

.media-poster.placeholder {
  background: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
}

.media-details {
  flex: 1;
  min-width: 0;
}

.title {
  font-weight: 600;
  font-size: 14px;
  color: #333;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  /* 预留右上角状态标签的宽度，避免被遮挡 */
  padding-right: 88px;
}

.season-tag {
  margin-left: 6px;
  background: transparent;
  border: none;
  color: #909399;
  padding: 0;
  line-height: 1;
}

.torrent-title {
  font-size: 12px;
  color: #999;
  overflow: hidden;
  display: -webkit-box;
  line-clamp: 3;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  word-break: break-word;
}

.status-badge {
  margin-left: auto;
  position: absolute;
  top: 0;
  right: 0;
}

.item-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.progress-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #666;
}


.speed-info {
  display: flex;
  justify-content: flex-start;
  gap: 16px;
  font-size: 12px;
  color: #666;
  /* 只占自身内容宽度，不撑满，避免影响下方按钮布局 */
  align-self: flex-start;
  width: fit-content;
  max-width: 100%;
}

.speed-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.actions-bottom {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  /* 上移按钮，缩小与进度区的垂直间距 */
  margin-top: -12px;
}

.actions-bottom :deep(.el-button) {
  width: 28px;
  height: 28px;
  padding: 0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.actions-bottom :deep(.el-icon) {
  font-size: 16px;
}
</style>
