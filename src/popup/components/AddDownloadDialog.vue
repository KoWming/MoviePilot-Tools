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
import { ref, watch, computed, onMounted } from 'vue';
import type { DownloaderConf, DirectoryInfo, SiteInfo } from '../../shared/api/download';
import { downloadApi } from '../../shared/api/download';
import { ElMessage, ElMessageBox } from 'element-plus';

export type DownloadType = 'torrent' | 'magnet' | 'site';

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

const visibleInner = ref(false);
watch(
  () => props.modelValue,
  v => (visibleInner.value = v)
);
watch(visibleInner, v => emit('update:modelValue', v));

const inputValue = ref('');
watch(
  () => props.prefillText,
  (v) => {
    if (visibleInner.value && typeof v === 'string' && v) {
      inputValue.value = v;
    }
  }
);
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

const downloaders = computed(() => props.downloaders || []);

// 根据类型计算对话框标题
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

// 根据类型计算输入框标签
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

const inputType = computed(() => props.type === 'site' ? 'text' : 'textarea');

const inputRows = computed(() => props.type === 'site' ? undefined : 4);

// 根据类型计算输入框占位符
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

// 根据类型计算提交按钮文字
const submitButtonText = computed(() => {
  switch (props.type) {
    case 'site':
      return '确定下载';
    default:
      return '确定添加';
  }
});

// 根据类型计算验证错误信息
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

// 从 URL 提取更可识别的标题（提高后端识别成功率）
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

// 为PT站种子生成更好的标题
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

// 获取从页面提取的标题
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

// 根据URL匹配站点配置
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
    const submitTorrent = async (
      fn: () => Promise<{ success: boolean; message?: string; data?: any }>,
      label: string,
      directCtx?: {
        enclosure?: string;
        pageUrl: string;
        siteDomain: string;
        siteCookie?: string;
        siteUa: string;
        downloader: string;
        savePath?: string;
        title: string;
        label: string;
      }
    ): Promise<boolean> => {
      const res = await fn();
      if (!res?.success) {
        const errMsg = res?.message || '未知错误';
        ElMessage.error(`${label} 失败: ${errMsg}`);
        if (directCtx) await tryDirectDownload(directCtx);
        return false;
      }
      return true;
    };

    if (props.type === 'site') {
      // 站点下载：单个URL，使用匹配的站点配置信息
      const url = inputValue.value.trim();
      const matchedSite = findSiteByUrl(url);
      
      if (!matchedSite) {
        ElMessage.error('未找到匹配的站点配置，请确保该站点已在MP中配置');
        return;
      }

      const buildCtx = (title: string, enclosure?: string) => ({
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
      
      // 先获取站点资源列表，查找匹配的种子
      try {
        const resources = await downloadApi.getSiteResources(matchedSite.id);
        
        // 从URL中提取可能的种子ID或标题
        const urlObj = new URL(url);
        const urlParams = new URLSearchParams(urlObj.search);
        const id = urlParams.get('id');
        
        // 查找匹配的种子
        let matchedTorrent = null;
        if (id) {
          // 尝试通过ID匹配
          matchedTorrent = resources.find(torrent => 
            torrent.page_url?.includes(`id=${id}`) || 
            torrent.enclosure?.includes(`id=${id}`)
          );
        }
        
        // 如果没找到，尝试通过URL匹配
        if (!matchedTorrent) {
          matchedTorrent = resources.find(torrent => 
            torrent.page_url === url || 
            torrent.enclosure === url
          );
        }
        
        if (matchedTorrent) {
          // 根据用户选择决定下载方式
          if (skipMediaRecognition.value) {
            // 直连下载器，跳过 MP 媒体识别
            tryDirectDownload(buildCtx(matchedTorrent.title, matchedTorrent.enclosure), true);
            submitting.value = false;
            return;
          } else {
            // 先尝试识别媒体信息
            try {
              const mediaContext = await downloadApi.recognizeMedia(matchedTorrent.title, matchedTorrent.description);
              
              if (mediaContext.media_info) {
                // 如果识别成功，使用带媒体信息的下载接口
                const ok = await submitTorrent(() => downloadApi.addDownloadWithMedia({
                  torrent_in: {
                    ...matchedTorrent,
                    site: matchedSite.id,
                    site_name: matchedSite.name,
                    site_cookie: matchedSite.cookie,
                    site_ua: matchedSite.ua || '',
                    site_proxy: matchedSite.proxy === 1,
                    site_order: matchedSite.pri,
                    site_downloader: matchedSite.downloader || downloader.value,
                  },
                  media_in: mediaContext.media_info,
                  downloader: downloader.value,
                  save_path: savePath.value || undefined,
                  label: downloadLabel.value || undefined
                }), '添加下载（含媒体信息）', buildCtx(matchedTorrent.title, matchedTorrent.enclosure));
                if (!ok) { submitting.value = false; return; }
              } else {
                // 如果识别失败，使用普通下载接口（后端会再次尝试识别）
                const ok = await submitTorrent(() => downloadApi.addDownload({
                  torrent_in: {
                    ...matchedTorrent,
                    site: matchedSite.id,
                    site_name: matchedSite.name,
                    site_cookie: matchedSite.cookie,
                    site_ua: matchedSite.ua || '',
                    site_proxy: matchedSite.proxy === 1,
                    site_order: matchedSite.pri,
                    site_downloader: matchedSite.downloader || downloader.value,
                  },
                  downloader: downloader.value,
                  save_path: savePath.value || undefined,
                  label: downloadLabel.value || undefined
                }), '添加下载', buildCtx(matchedTorrent.title, matchedTorrent.enclosure));
                if (!ok) { submitting.value = false; return; }
              }
            } catch (error) {
              console.error('媒体识别失败:', error);
              // 媒体识别失败，使用普通下载接口（后端会再次尝试识别）
              const ok = await submitTorrent(() => downloadApi.addDownload({
                torrent_in: {
                  ...matchedTorrent,
                  site: matchedSite.id,
                  site_name: matchedSite.name,
                  site_cookie: matchedSite.cookie,
                  site_ua: matchedSite.ua || '',
                  site_proxy: matchedSite.proxy === 1,
                  site_order: matchedSite.pri,
                  site_downloader: matchedSite.downloader || downloader.value,
                },
                downloader: downloader.value,
                save_path: savePath.value || undefined,
                label: downloadLabel.value || undefined
              }), '添加下载', buildCtx(matchedTorrent.title, matchedTorrent.enclosure));
              if (!ok) { submitting.value = false; return; }
            }
          }
        } else {
          // 如果没找到匹配的种子，根据用户选择决定处理方式
          if (skipMediaRecognition.value) {
            // 直连下载器，跳过 MP 媒体识别
            let title = await getPageTitle();
            if (!title || title === '未知种子') {
              title = generateTorrentTitle(url, matchedSite.name, id || undefined);
            }
            tryDirectDownload(buildCtx(title), true);
            submitting.value = false;
            return;
          } else {
            // 需要媒体识别时，先尝试后端识别，使用完整的种子信息
            let title = await getPageTitle();
            if (!title || title === '未知种子') {
              title = extractTitleFromUrl(url);
            }
            if (!title || title === '未知种子' || title === 'details') {
              title = generateTorrentTitle(url, matchedSite.name, id || undefined);
            }

            const ok = await submitTorrent(() => downloadApi.addDownload({
              torrent_in: {
                site: matchedSite.id,
                site_name: matchedSite.name,
                site_cookie: matchedSite.cookie,
                site_ua: matchedSite.ua || '',
                site_proxy: matchedSite.proxy === 1,
                site_order: matchedSite.pri,
                site_downloader: matchedSite.downloader || downloader.value,
                title: title,
                description: `从 ${matchedSite.name} 获取的种子`,
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
              },
              downloader: downloader.value,
              save_path: savePath.value || undefined,
              label: downloadLabel.value || undefined
            }), '添加下载', buildCtx(title));
            if (!ok) { submitting.value = false; return; }
          }
        }
      } catch (error) {
        console.error('获取站点资源失败:', error);
        ElMessage.error('获取站点资源失败，请稍后重试');
        return;
      }
    } else {
      // 种子链接和磁力链接：支持多行
      const lines = inputValue.value
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean);

      let allOk = true;
      for (const url of lines) {
        const title = extractTitleFromUrl(url);
        const ok = await submitTorrent(() => downloadApi.addDownload({
          torrent_in: {
            title: title,
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
      if (!allOk) {
        ElMessage.warning('部分下载任务提交失败，请检查标题是否可识别');
        return;
      }
    }
    
    ElMessage.success('已提交下载任务');
    emit('submitted');
    visibleInner.value = false;
    inputValue.value = '';
    downloadLabel.value = 'MOVIEPILOT'; // 重置为默认标签
    skipMediaRecognition.value = false; // 重置跳过媒体识别选项
  } catch (e) {
    console.error(e);
    ElMessage.error('提交失败');
  } finally {
    submitting.value = false;
  }
}

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
      inputValue.value = '';
      downloadLabel.value = 'MOVIEPILOT';
      skipMediaRecognition.value = false;
    } else {
      ElMessage.error(resp?.error || '直连下载失败');
    }
  } catch (e: any) {
    if (e !== 'cancel') console.error('直连下载失败:', e);
  }
}

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
