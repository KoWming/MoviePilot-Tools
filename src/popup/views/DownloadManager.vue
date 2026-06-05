<template>
  <div class="download-manager">
    <!-- 操作栏 -->
    <div v-if="downloaders.length > 0" class="action-bar">
      <el-select 
        v-model="activeDownloader" 
        placeholder="选择下载器"
        size="small"
        @change="onDownloaderChange"
        class="downloader-select"
      >
        <el-option
          v-for="downloader in downloaders"
          :key="downloader.name"
          :label="downloader.name"
          :value="downloader.name"
        />
      </el-select>
      
      <div class="action-buttons">
        <el-button 
          :loading="refreshing" 
          @click="loadDownloads"
          size="small"
          type="default"
          :icon="Refresh"
        >
          刷新
        </el-button>
        <el-dropdown @command="onAddDownloadCommand" trigger="click">
          <el-button 
            size="small"
            type="primary"
            :icon="Plus"
          >
            添加下载
            <el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="torrent">
                <el-icon><Document /></el-icon>
                种子链接
              </el-dropdown-item>
              <el-dropdown-item command="magnet">
                <el-icon><Link /></el-icon>
                磁力链接
              </el-dropdown-item>
              <el-dropdown-item command="site">
                <el-icon><Download /></el-icon>
                站点下载
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>
    
    <!-- 下载列表视图 -->
    <div v-if="downloaders.length > 0 && activeDownloader" class="download-content">
      <DownloadListView ref="listRef" :downloader-name="activeDownloader" />
    </div>
    
    <!-- 无下载器提示 -->
    <div v-else class="no-downloader">
      <el-empty description="未配置下载器">
        <el-button type="primary" @click="onOpenWeb">前往配置</el-button>
      </el-empty>
    </div>
  </div>
  <AddDownloadDialog
    v-model="showAddDownload"
    :downloaders="downloaders"
    :default-downloader="activeDownloader"
    :type="downloadType"
    :prefill-text="prefillText"
    @submitted="loadDownloads"
  />
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Refresh, Plus, ArrowDown, Document, Link, Download } from '@element-plus/icons-vue';
import { downloadApi, type DownloaderConf } from '../../shared/api/download';
import DownloadListView from '../components/DownloadListView.vue';
import { ElMessage } from 'element-plus';
import AddDownloadDialog, { type DownloadType } from '../components/AddDownloadDialog.vue';

const downloaders = ref<DownloaderConf[]>([]);
const activeDownloader = ref<string>('');
const refreshing = ref(false);
const listRef = ref<InstanceType<typeof DownloadListView> | null>(null);
const showAddDownload = ref(false);
const downloadType = ref<DownloadType>('torrent');
const prefillText = ref('');

// 加载下载器配置
async function loadDownloaders() {
  try {
    downloaders.value = await downloadApi.getDownloadClients();
    if (downloaders.value.length > 0 && !activeDownloader.value) {
      activeDownloader.value = downloaders.value[0].name;
    }
  } catch (error) {
    console.error('加载下载器失败:', error);
    ElMessage.error('加载下载器配置失败');
  }
}

// 下载器切换
function onDownloaderChange(name: string) {
  activeDownloader.value = name;
  // 切换后立即刷新当前下载器数据
  loadDownloads();
}

// 刷新下载任务
async function loadDownloads() {
  try {
    refreshing.value = true;
    await listRef.value?.refresh?.();
  } finally {
    refreshing.value = false;
  }
}

// 添加下载菜单命令处理
function onAddDownloadCommand(command: string) {
  downloadType.value = command as DownloadType;
  showAddDownload.value = true;
}

// 打开MP网页
async function onOpenWeb() {
  const data = await chrome.storage.local.get(['mp.base_url']);
  const base = data['mp.base_url'] as string | undefined;
  if (base) {
    chrome.tabs.create({ url: base });
  }
}

onMounted(async () => {
  await loadDownloaders();
  // 1) 消费 storage 中的 pending_route
  try {
    const pending = await chrome.storage.local.get(['mp.pending_route']);
    const route = pending && (pending['mp.pending_route'] as any);
    if (route?.path === '/download' && route?.query?.url) {
      downloadType.value = 'site';
      prefillText.value = route.query.url as string;
      showAddDownload.value = true;
      chrome.storage.local.remove(['mp.pending_route']);
    }
  } catch {}
  
  // 2) 消费 storage 中的 PT 下载信息
  try {
    const ptInfo = await chrome.storage.local.get(['mp.pt_download_info']);
    const ptInfoData = ptInfo && (ptInfo['mp.pt_download_info'] as any);
    if (ptInfoData) {
      const { url, title } = ptInfoData;
      downloadType.value = 'site';
      prefillText.value = url;
      // 将标题信息存储到临时变量中，供AddDownloadDialog使用
      chrome.storage.local.set({ 'mp.pt_download_title': title });
      showAddDownload.value = true;
      chrome.storage.local.remove(['mp.pt_download_info']);
    }
  } catch {}
  
  // 3) 监听实时消息
  try {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg?.type === 'NAVIGATE_TO_ROUTE' && msg.path === '/download') {
        const url = msg?.query?.url as string | undefined;
        if (url) {
          downloadType.value = 'site';
          prefillText.value = url;
          showAddDownload.value = true;
        }
      }
    });
  } catch {}
});
</script>

<style scoped>
.download-manager {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.action-bar {
  display: flex;
  align-items: center;
  padding: 8px;
  border-bottom: 1px solid #e0e0e0;
  gap: 6px;
  --dm-control-height: 28px;
}

.downloader-select {
  flex: 1;
  min-width: 120px;
}

:deep(.downloader-select .el-select__wrapper) {
  height: var(--dm-control-height) !important;
  min-height: var(--dm-control-height) !important;
  max-height: var(--dm-control-height) !important;
  box-sizing: border-box !important;
  padding: 0 11px !important;
}

:deep(.downloader-select .el-select__selection) {
  height: calc(var(--dm-control-height) - 2px) !important;
  display: flex !important;
  align-items: center !important;
}

:deep(.downloader-select .el-select__caret) {
  line-height: var(--dm-control-height) !important;
}

.action-buttons {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.action-buttons .el-button.el-button--small {
  margin: 0 !important;
  height: var(--dm-control-height) !important;
  min-height: var(--dm-control-height) !important;
  max-height: var(--dm-control-height) !important;
  padding: 0 12px !important;
  box-sizing: border-box !important;
  line-height: 1 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}

.download-content {
  flex: 1;
  overflow: hidden;
}

.no-downloader {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
