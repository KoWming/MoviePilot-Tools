<template>
  <el-dialog
    v-model="visibleInner"
    width="95%"
    :title="dialogTitle"
    :close-on-click-modal="false"
    append-to-body
    class="add-download-dialog"
  >
    <div class="form">
      <el-form label-position="top">
        <el-form-item :label="inputLabel" required>
          <el-input
            v-model="inputValue"
            :type="inputType"
            :rows="inputRows"
            :placeholder="inputPlaceholder"
          />
        </el-form-item>

        <div class="row-two">
          <el-form-item label="下载器" class="half">
            <el-select v-model="downloader" size="small" placeholder="请选择下载器" style="width: 100%">
              <el-option
                v-for="item in downloaders"
                :key="item.name"
                :label="item.name"
                :value="item.name"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="下载任务标签" class="half">
            <el-input
              v-model="downloadLabel"
              size="small"
              placeholder="请输入标签，多个标签用逗号分隔"
              style="width: 100%"
            />
          </el-form-item>
        </div>

        <el-form-item label="下载目录">
          <el-select v-model="savePath" size="small" placeholder="请选择下载目录" style="width: 100%">
            <el-option
              v-for="dir in directories"
              :key="dir.name"
              :label="`${dir.name} (${dir.download_path})`"
              :value="dir.download_path"
            />
          </el-select>
        </el-form-item>

        <el-form-item v-if="props.type === 'site'">
          <el-checkbox v-model="skipMediaRecognition" size="small">
            直连下载器（无需媒体识别）
          </el-checkbox>
        </el-form-item>
      </el-form>
    </div>

    <template #footer>
      <el-button @click="onCancel">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="onSubmit">{{ submitButtonText }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
// ============================================================
// 添加下载对话框组件
// Torrent URL 输入、下载器选择、保存路径配置
// ============================================================
import { ref, watch, computed, onMounted } from 'vue';
import type { DownloaderConf, DirectoryInfo, SiteInfo } from '../../shared/api/download';
import { downloadApi } from '../../shared/api/download';
import { ElMessage, ElMessageBox } from 'element-plus';

// ==================== 类型定义 ====================
export type DownloadType = 'torrent' | 'magnet' | 'site';

// ==================== Props / Emits ====================
const props = defineProps<{
  modelValue: boolean;
  downloaders: DownloaderConf[];
  defaultDownloader?: string;
  type: DownloadType;
  prefillText?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'submitted'): void;
}>();

// ==================== 弹窗可见性控制 ====================
const visibleInner = ref(false);
watch(
  () => props.modelValue,
  v => (visibleInner.value = v)
);
watch(visibleInner, v => emit('update:modelValue', v));

// 预填充文本监听（弹窗打开时填入）
const inputValue = ref('');
watch(
  () => props.prefillText,
  (v) => {
    if (visibleInner.value && typeof v === 'string' && v) {
      inputValue.value = v;
    }
  }
);
// ==================== 响应式状态 ====================
const downloader = ref('');
const savePath = ref('');
const downloadLabel = ref('MOVIEPILOT'); // 默认使用系统标签
const skipMediaRecognition = ref(false); // 跳过媒体识别选项
const submitting = ref(false);
const directories = ref<DirectoryInfo[]>([]);
const sites = ref<SiteInfo[]>([]);

watch(
  () => props.defaultDownloader,
  v => {
    if (v && !downloader.value) downloader.value = v;
  },
  { immediate: true }
);

// ==================== 计算属性 ====================
const downloaders = computed(() => props.downloaders || []);

// 对话框标题
const dialogTitle = computed(() => {
  switch (props.type) {
    case 'torrent':
      return '添加种子链接';
    case 'magnet':
      return '添加磁力链接';
    case 'site':
      return 'PT站种子下载';
    default:
      return '添加下载';
  }
});

// 输入框标签
const inputLabel = computed(() => {
  switch (props.type) {
    case 'torrent':
      return '下载链接';
    case 'magnet':
      return '磁力链接';
    case 'site':
      return 'PT站种子详情页链接';
    default:
      return '链接';
  }
});

// 输入框类型（站点为单行文本，其他为多行文本域）
const inputType = computed(() => props.type === 'site' ? 'text' : 'textarea');
const inputRows = computed(() => props.type === 'site' ? undefined : 4);

// 输入框占位符
const inputPlaceholder = computed(() => {
  switch (props.type) {
    case 'torrent':
      return '请输入种子链接，每行一个\n支持 http/https 链接';
    case 'magnet':
      return '请输入磁力链接，每行一个\n格式：magnet:?xt=urn:btih:...';
    case 'site':
      return '请输入PT站种子详情页链接，如 details.php?id=xxxxx';
    default:
      return '请输入链接';
  }
});

// 提交按钮文字
const submitButtonText = computed(() => {
  switch (props.type) {
    case 'site':
      return '确定下载';
    default:
      return '确定添加';
  }
});

// ==================== 标题/链接提取工具 ====================
// 验证错误信息
const getValidationError = () => {
  switch (props.type) {
    case 'torrent':
      return '请填写至少一个种子链接';
    case 'magnet':
      return '请填写至少一个磁力链接';
    case 'site':
      return '请填写PT站种子详情页链接';
    default:
      return '请填写链接';
  }
};

// 从 URL 提取可识别的标题（提高后端识别成功率）
function extractTitleFromUrl(url: string): string {
  try {
    if (url.startsWith('magnet:?')) {
      const qs = new URLSearchParams(url.substring(8));
      const dn = qs.get('dn');
      if (dn) {
        return decodeURIComponent(dn).replace(/[._]+/g, ' ').trim();
      }
      return 'magnet';
    }
    const u = new URL(url);
    const path = decodeURIComponent(u.pathname || '/');
    const base = path.split('/').filter(Boolean).pop() || u.hostname;
    const name = base.replace(/\.(torrent|txt|html?)$/i, '').replace(/[._]+/g, ' ').trim();
    return name || u.hostname;
  } catch {
    return url;
  }
}

// 为 PT 站种子生成标题
function generateTorrentTitle(url: string, siteName: string, id?: string): string {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    
    // 尝试从URL参数中提取更多信息
    const params = new URLSearchParams(urlObj.search);
    const titleParam = params.get('title') || params.get('name');
    
    if (titleParam) {
      return decodeURIComponent(titleParam).replace(/[._]+/g, ' ').trim();
    }
    
    // 如果没有找到标题参数，使用站点名称和ID
    if (id) {
      return `${siteName} 种子 ${id}`;
    }
    
    // 最后尝试从URL路径提取
    const extracted = extractTitleFromUrl(url);
    if (extracted && extracted !== 'details.php' && extracted !== 'details') {
      return extracted;
    }
    
    return `${siteName} 种子`;
  } catch {
    return id ? `${siteName} 种子 ${id}` : `${siteName} 种子`;
  }
}

// 从浏览器存储获取页面提取的标题
async function getPageTitle(): Promise<string> {
  try {
    const data = await chrome.storage.local.get(['mp.pt_download_title']);
    const title = data['mp.pt_download_title'] as string | undefined;
    if (title) {
      // 使用后立即清除，避免影响下次使用
      chrome.storage.local.remove(['mp.pt_download_title']);
      return title;
    }
    return '';
  } catch {
    return '';
  }
}

// ==================== 站点匹配 ====================
// 根据 URL 匹配已配置的站点
const findSiteByUrl = (url: string): SiteInfo | null => {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    
    // 查找匹配的站点配置
    return sites.value.find(site => {
      try {
        const siteUrl = new URL(site.url);
        return siteUrl.hostname === hostname || 
               site.domain === hostname || 
               site.url.includes(hostname) ||
               hostname.includes(site.domain);
      } catch {
        return site.domain === hostname || site.url.includes(hostname);
      }
    }) || null;
  } catch {
    return null;
  }
};

// ==================== 下载提交 ====================
// 直连下载上下文类型
type DirectDownloadContext = {
  enclosure?: string;
  pageUrl: string;
  siteDomain: string;
  siteCookie?: string;
  siteUa: string;
  downloader: string;
  savePath?: string;
  title: string;
  label: string;
};

// 重置弹窗表单状态
function resetDialog() {
  inputValue.value = '';
  downloadLabel.value = 'MOVIEPILOT';
  skipMediaRecognition.value = false;
}

// 构建站点种子下载参数（匹配到种子时使用）
function buildSiteTorrentIn(site: SiteInfo, torrent: any) {
  return {
    ...torrent,
    site: site.id,
    site_name: site.name,
    site_cookie: site.cookie,
    site_ua: site.ua || '',
    site_proxy: site.proxy === 1,
    site_order: site.pri,
    site_downloader: site.downloader || downloader.value,
  };
}

// 构建站点种子下载参数（未匹配种子时，使用完整字段）
function buildSiteTorrentInFull(site: SiteInfo, title: string, url: string) {
  return {
    site: site.id,
    site_name: site.name,
    site_cookie: site.cookie,
    site_ua: site.ua || '',
    site_proxy: site.proxy === 1,
    site_order: site.pri,
    site_downloader: site.downloader || downloader.value,
    title,
    description: `从 ${site.name} 获取的种子`,
    enclosure: url,
    page_url: url,
    size: 0,
    seeders: 0,
    peers: 0,
    grabs: 0,
    pubdate: '',
    date_elapsed: '',
    freedate: '',
    uploadvolumefactor: 0,
    downloadvolumefactor: 0,
    hit_and_run: false,
    labels: [],
    pri_order: 0,
    volume_factor: '',
    freedate_diff: ''
  };
}

// 提交种子下载请求（失败时尝试直连下载）
async function submitTorrent(
  fn: () => Promise<{ success: boolean; message?: string; data?: any }>,
  label: string,
  directCtx?: DirectDownloadContext
): Promise<boolean> {
  const res = await fn();
  if (!res?.success) {
    const errMsg = res?.message || '未知错误';
    ElMessage.error(`${label} 失败: ${errMsg}`);
    if (directCtx) await tryDirectDownload(directCtx);
    return false;
  }
  return true;
}

// 处理已匹配种子的下载
async function handleMatchedTorrent(
  site: SiteInfo,
  torrent: any,
  buildCtx: (title: string, enclosure?: string) => DirectDownloadContext
): Promise<boolean> {
  if (skipMediaRecognition.value) {
    tryDirectDownload(buildCtx(torrent.title, torrent.enclosure), true);
    return false;
  }

  const torrentIn = buildSiteTorrentIn(site, torrent);
  const ctx = buildCtx(torrent.title, torrent.enclosure);

  try {
    const mediaContext = await downloadApi.recognizeMedia(torrent.title, torrent.description);
    if (mediaContext.media_info) {
      // 识别成功：使用带媒体信息的下载接口
      return await submitTorrent(() => downloadApi.addDownloadWithMedia({
        torrent_in: torrentIn,
        media_in: mediaContext.media_info,
        downloader: downloader.value,
        save_path: savePath.value || undefined,
        label: downloadLabel.value || undefined
      }), '添加下载（含媒体信息）', ctx);
    }
  } catch (error) {
    console.error('媒体识别失败:', error);
  }

  // 识别失败或无媒体信息：使用普通下载接口（后端会再次尝试识别）
  return await submitTorrent(() => downloadApi.addDownload({
    torrent_in: torrentIn,
    downloader: downloader.value,
    save_path: savePath.value || undefined,
    label: downloadLabel.value || undefined
  }), '添加下载', ctx);
}

// 处理未匹配种子的下载（资源列表中无匹配项时）
async function handleUnmatchedTorrent(
  site: SiteInfo,
  url: string,
  id: string | null,
  buildCtx: (title: string, enclosure?: string) => DirectDownloadContext
): Promise<boolean> {
  // 生成标题：优先从浏览器存储获取，其次从 URL 提取，最后用站点名生成
  let title = await getPageTitle();
  if (!title || title === '未知种子') {
    title = extractTitleFromUrl(url);
  }
  if (!title || title === '未知种子' || title === 'details') {
    title = generateTorrentTitle(url, site.name, id || undefined);
  }

  if (skipMediaRecognition.value) {
    tryDirectDownload(buildCtx(title), true);
    return false;
  }

  return await submitTorrent(() => downloadApi.addDownload({
    torrent_in: buildSiteTorrentInFull(site, title, url),
    downloader: downloader.value,
    save_path: savePath.value || undefined,
    label: downloadLabel.value || undefined
  }), '添加下载', buildCtx(title));
}

// 处理站点类型下载
async function handleSiteDownload(): Promise<boolean> {
  const url = inputValue.value.trim();
  const matchedSite = findSiteByUrl(url);

  if (!matchedSite) {
    ElMessage.error('未找到匹配的站点配置，请确保该站点已在MP中配置');
    return false;
  }

  const buildCtx = (title: string, enclosure?: string): DirectDownloadContext => ({
    enclosure,
    pageUrl: url,
    siteDomain: new URL(matchedSite.url).hostname,
    siteCookie: matchedSite.cookie,
    siteUa: matchedSite.ua || navigator.userAgent,
    downloader: downloader.value,
    savePath: savePath.value || undefined,
    title,
    label: downloadLabel.value || 'MOVIEPILOT'
  });

  try {
    const resources = await downloadApi.getSiteResources(matchedSite.id);
    const id = new URLSearchParams(new URL(url).search).get('id');

    // 通过 ID 或 URL 匹配种子
    let matchedTorrent = id
      ? resources.find(t => t.page_url?.includes(`id=${id}`) || t.enclosure?.includes(`id=${id}`))
      : null;
    if (!matchedTorrent) {
      matchedTorrent = resources.find(t => t.page_url === url || t.enclosure === url);
    }

    if (matchedTorrent) {
      return await handleMatchedTorrent(matchedSite, matchedTorrent, buildCtx);
    } else {
      return await handleUnmatchedTorrent(matchedSite, url, id, buildCtx);
    }
  } catch (error) {
    console.error('获取站点资源失败:', error);
    ElMessage.error('获取站点资源失败，请稍后重试');
    return false;
  }
}

// 处理种子/磁力链接批量下载
async function handleBulkDownload(): Promise<boolean> {
  const lines = inputValue.value
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);

  let allOk = true;
  for (const url of lines) {
    const title = extractTitleFromUrl(url);
    const ok = await submitTorrent(() => downloadApi.addDownload({
      torrent_in: {
        title,
        description: '',
        enclosure: url,
        page_url: props.type === 'torrent' ? url : ''
      },
      downloader: downloader.value,
      save_path: savePath.value || undefined,
      label: downloadLabel.value || undefined
    }), `添加下载: ${title}`);
    if (!ok) allOk = false;
  }
  return allOk;
}

// 提交下载（入口函数）
async function onSubmit() {
  if (!inputValue.value.trim()) {
    ElMessage.error(getValidationError());
    return;
  }
  if (!downloader.value) {
    ElMessage.error('请选择下载器');
    return;
  }

  submitting.value = true;
  try {
    let ok = true;
    if (props.type === 'site') {
      ok = await handleSiteDownload();
    } else {
      ok = await handleBulkDownload();
      if (!ok) {
        ElMessage.warning('部分下载任务提交失败，请检查标题是否可识别');
        return;
      }
    }
    if (!ok) return;

    ElMessage.success('已提交下载任务');
    emit('submitted');
    visibleInner.value = false;
    resetDialog();
  } catch (e) {
    console.error(e);
    ElMessage.error('提交失败');
  } finally {
    submitting.value = false;
  }
}

// ==================== 直连下载 ====================
function onCancel() {
  visibleInner.value = false;
}

async function tryDirectDownload(ctx: {
  enclosure?: string;
  pageUrl: string;
  siteDomain: string;
  siteCookie?: string;
  siteUa: string;
  downloader: string;
  savePath?: string;
  title: string;
  label: string;
}, skipConfirm = false) {
  try {
    if (!skipConfirm) {
      const result = await ElMessageBox.confirm(
        '媒体识别失败，是否改为直连下载器？\n\n将跳过 MP 媒体识别，直接推送种子到下载器。',
        '直连下载',
        { confirmButtonText: '直连推送', cancelButtonText: '取消', type: 'warning' }
      );
      if (result !== 'confirm') return;
    }

    ElMessage.info('正在直连推送种子到下载器...');
    const resp = await new Promise<{ success: boolean; error?: string; message?: string }>(resolve => {
      chrome.runtime.sendMessage(
        {
          type: 'MP_DIRECT_DOWNLOAD',
          enclosure: ctx.enclosure,
          pageUrl: ctx.pageUrl,
          siteDomain: ctx.siteDomain,
          siteCookie: ctx.siteCookie,
          siteUa: ctx.siteUa,
          downloader: ctx.downloader,
          savePath: ctx.savePath,
          title: ctx.title,
          label: ctx.label
        },
        resolve
      );
    });
    if (resp?.success) {
      ElMessage.success(resp.message || '种子已推送到下载器');
      emit('submitted');
      visibleInner.value = false;
      resetDialog();
    } else {
      ElMessage.error(resp?.error || '直连下载失败');
    }
  } catch (e: any) {
    if (e !== 'cancel') console.error('直连下载失败:', e);
  }
}

// ==================== 数据加载 ====================
// 加载目录列表和站点配置
async function loadData() {
  try {
    // 并行加载目录列表和站点配置
    const [directoriesData, sitesData] = await Promise.all([
      downloadApi.getDirectories(),
      downloadApi.getSites()
    ]);
    
    directories.value = directoriesData;
    sites.value = sitesData;
  } catch (error) {
    console.error('加载数据失败:', error);
    ElMessage.error('加载配置数据失败');
  }
}

// ==================== 生命周期 ====================
onMounted(() => {
  loadData();
});
</script>

<style scoped>
.add-download-dialog :deep(.el-dialog) {
  margin: 0 auto;
  max-width: 90vw;
}

.add-download-dialog :deep(.el-dialog__body) {
  padding: 20px 24px;
}

.add-download-dialog :deep(.el-dialog__header) {
  padding: 20px 24px 0;
}

.add-download-dialog :deep(.el-dialog__footer) {
  padding: 0 24px 20px;
}

.form {
  padding-top: 4px;
}

.form :deep(.el-form-item__label) {
  font-weight: 500;
  margin-bottom: 6px;
  color: #606266;
}

.row-two {
  display: flex;
  gap: 12px;
}

.row-two .half {
  flex: 1;
  min-width: 0;
}

.row-two .half :deep(.el-form-item__content) {
  width: 100%;
}

.row-two .half :deep(.el-select),
.row-two .half :deep(.el-input) {
  width: 100%;
}

/* 统一所有小控件高度为28px */
.form :deep(.el-select--small .el-select__wrapper),
.form :deep(.el-input--small .el-input__wrapper) {
  height: 28px !important;
  min-height: 28px !important;
  max-height: 28px !important;
  box-sizing: border-box !important;
}

/* 让placeholder中的换行符生效 */
.form :deep(.el-textarea__inner::placeholder) {
  white-space: pre-line;
}
</style>
