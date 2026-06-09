<template>
  <div class="totp-manager">
    <!-- Header/Toolbar -->
    <div class="toolbar">
      <div class="toolbar-row">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索站点..."
          size="small"
          clearable
          class="search-input"
        >
          <template #prefix>
            <svg viewBox="0 0 24 24" width="14" height="14" class="icon-prefix">
              <path :d="mdiMagnify" />
            </svg>
          </template>
        </el-input>

        <el-dropdown @command="handleSortCommand" trigger="click">
          <el-button class="compact sort-button" size="small" title="排序">
            <svg viewBox="0 0 24 24" width="16" height="16" class="icon-btn-only">
              <path :d="mdiSortVariant"/>
            </svg>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="name" :disabled="sortBy === 'name'">按名称排序</el-dropdown-item>
              <el-dropdown-item command="createdAt" :disabled="sortBy === 'createdAt'">按创建时间排序</el-dropdown-item>
              <el-dropdown-item command="updatedAt" :disabled="sortBy === 'updatedAt'">按更新时间排序</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>

        <el-button class="compact add-button" size="small" type="primary" @click="showAddDialog = true" title="添加站点">
          <svg viewBox="0 0 24 24" width="16" height="16" class="icon-btn-only">
            <path :d="mdiPlus"/>
          </svg>
        </el-button>

        <el-dropdown @command="handleMoreCommand" trigger="click">
          <el-button class="compact more-button" size="small" title="更多操作">
            <svg viewBox="0 0 24 24" width="16" height="16" class="icon-btn-only">
              <path :d="mdiDotsVertical"/>
            </svg>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="refresh">
                <div class="dropdown-item-content">
                  <svg viewBox="0 0 24 24" width="14" height="14" class="mr-1"><path :d="mdiRefresh"/></svg>刷新验证码
                </div>
              </el-dropdown-item>
              <el-dropdown-item command="webdav-export" divided>
                <div class="dropdown-item-content">
                  <svg viewBox="0 0 24 24" width="14" height="14" class="mr-1" fill="currentColor"><path :d="mdiCloudUpload"/></svg>备份至 WebDav
                </div>
              </el-dropdown-item>
              <el-dropdown-item command="webdav-import">
                <div class="dropdown-item-content">
                  <svg viewBox="0 0 24 24" width="14" height="14" class="mr-1" fill="currentColor"><path :d="mdiCloudDownload"/></svg>从 WebDav 还原
                </div>
              </el-dropdown-item>
              <el-dropdown-item command="json-export" divided>
                <div class="dropdown-item-content">
                  <svg viewBox="0 0 24 24" width="14" height="14" class="mr-1"><path :d="mdiExportVariant"/></svg>导出本地 JSON
                </div>
              </el-dropdown-item>
              <el-dropdown-item command="json-import">
                <div class="dropdown-item-content">
                  <svg viewBox="0 0 24 24" width="14" height="14" class="mr-1"><path :d="mdiImport"/></svg>导入本地 JSON
                </div>
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <!-- Tab Horizontal Layout -->
    <div class="totp-tabs">
      <div 
        class="totp-tab-item" 
        :class="{ active: currentTab === 'pt' }" 
        @click="currentTab = 'pt'"
      >
        PT站点
      </div>
      <div 
        class="totp-tab-item" 
        :class="{ active: currentTab === 'custom' }" 
        @click="currentTab = 'custom'"
      >
        自定义
      </div>
    </div>

    <!-- 站点列表 -->
    <div class="totp-grid">
      <div v-if="loading && sites.length === 0" class="totp-loading-cards">
        <div v-for="item in 3" :key="item" class="totp-loading-card">
          <div class="totp-loading-main">
            <div class="totp-loading-avatar totp-loading-shimmer"></div>
            <div class="totp-loading-info">
              <div class="totp-loading-line name totp-loading-shimmer"></div>
              <div class="totp-loading-line domain totp-loading-shimmer"></div>
            </div>
            <div class="totp-loading-actions">
              <div class="totp-loading-action totp-loading-shimmer"></div>
              <div class="totp-loading-action totp-loading-shimmer"></div>
              <div class="totp-loading-action totp-loading-shimmer"></div>
            </div>
          </div>
          <div class="totp-loading-code-row">
            <div class="totp-loading-code totp-loading-shimmer"></div>
            <div class="totp-loading-timer totp-loading-shimmer"></div>
          </div>
        </div>
      </div>

      <div v-else-if="filteredSites.length === 0" class="empty-state">
        <svg viewBox="0 0 24 24" width="48" height="48" class="empty-icon">
          <path :d="mdiShieldKey"/>
        </svg>
        <p class="empty-text">暂无两步验证站点</p>
        <el-button type="primary" @click="showAddDialog = true">添加第一个站点</el-button>
      </div>
      
      <div v-else class="totp-cards">
        <div v-for="site in filteredSites" :key="site.id" class="totp-card">
          <!-- Card Main (Header & Details & Actions) -->
          <div class="card-main">
            <div class="site-avatar" :style="{ background: getTotpSiteIcon(site) ? 'transparent' : getAvatarBg(getDomain(site.url) || site.name) }">
              <img v-if="getTotpSiteIcon(site)" :src="getTotpSiteIcon(site) || undefined" class="site-icon-img" />
              <span v-else>{{ getAvatarChar(site.name || getDomain(site.url)) }}</span>
            </div>
            <div class="site-details">
              <div class="site-name" :title="site.name">
                {{ site.name }}
              </div>
              <div class="site-domain link-style" :title="site.url" @click="openSite(site)" v-if="site.url">
                {{ getDomain(site.url) }}
              </div>
              <div class="site-domain" v-else>
                无链接地址
              </div>
            </div>
            
            <div class="card-actions">
              <el-button 
                size="small" 
                text 
                class="action-btn"
                @click="copyCode(getCodeForSite(site.id))"
                title="复制验证码"
              >
                <svg viewBox="0 0 24 24" width="15" height="15">
                  <path :d="mdiContentCopy"/>
                </svg>
              </el-button>
              <el-button 
                size="small" 
                text 
                class="action-btn"
                @click="openSite(site)"
                title="打开站点"
                v-if="site.url"
              >
                <svg viewBox="0 0 24 24" width="15" height="15">
                  <path :d="mdiOpenInNew"/>
                </svg>
              </el-button>
              
              <el-dropdown @command="(cmd: any) => handleCardCommand(cmd, site)" trigger="click">
                <el-button size="small" text class="action-btn">
                  <svg viewBox="0 0 24 24" width="15" height="15">
                    <path :d="mdiDotsVertical"/>
                  </svg>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="edit">
                      <div class="dropdown-item-content">
                        <svg viewBox="0 0 24 24" width="14" height="14" class="mr-1"><path :d="mdiPencil"/></svg>编辑站点
                      </div>
                    </el-dropdown-item>
                    <el-dropdown-item command="toggle-category">
                      <div class="dropdown-item-content">
                        <svg viewBox="0 0 24 24" width="14" height="14" class="mr-1"><path :d="mdiSwapHorizontal"/></svg>
                        {{ getSiteCategory(site) === 'pt' ? '移动到自定义' : '移动到PT站点' }}
                      </div>
                    </el-dropdown-item>
                    <el-dropdown-item command="delete" class="delete-menu-item">
                      <div class="dropdown-item-content text-danger">
                        <svg viewBox="0 0 24 24" width="14" height="14" class="mr-1"><path :d="mdiDelete"/></svg>删除站点
                      </div>
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>

          <!-- Code Section & Timer Row -->
          <div class="card-code-row">
            <div class="code-wrap">
              <span class="code-label">验证码:</span>
              <span class="code-value font-mono" :class="getCodeClass(site.id)" @click="copyCode(getCodeForSite(site.id))" title="点击复制验证码">
                {{ getCodeForSite(site.id) }}
              </span>
            </div>
            <div class="timer-wrap">
              <div class="circular-timer">
                <svg class="timer-svg" viewBox="0 0 36 36">
                  <path class="timer-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  <path 
                    class="timer-progress" 
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    :stroke-dasharray="`${getProgressForSite(site.id)}, 100`"
                    stroke-dashoffset="0"
                  />
                </svg>
                <div class="timer-text">{{ getRemainingTimeForSite(site.id) }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 添加/编辑站点对话框 -->
    <el-dialog 
      v-model="showAddDialog" 
      :title="editingSite ? '编辑站点' : '添加站点'"
      width="95%"
      :close-on-click-modal="false"
    >
      <el-form :model="siteForm" :rules="siteRules" ref="siteFormRef" label-width="80px">
        <el-form-item label="站点名称" prop="name">
          <el-input v-model="siteForm.name" placeholder="请输入站点名称" />
        </el-form-item>
        <el-form-item label="站点地址" prop="url">
          <el-input v-model="siteForm.url" placeholder="请输入站点地址（可选）" />
        </el-form-item>
        <el-form-item label="选择分组" prop="category">
          <el-radio-group v-model="siteForm.category">
            <el-radio value="pt">PT站点</el-radio>
            <el-radio value="custom">自定义</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="密钥" prop="secret">
          <el-input 
            v-model="siteForm.secret" 
            placeholder="请输入或扫描二维码获取密钥"
            show-password
          >
            <template #append>
              <el-button @click="scanQRCodeFromActiveTab">
                <svg viewBox="0 0 24 24" width="16" height="16" class="icon-btn" style="margin-right:4px;">
                  <path :d="mdiQrcodeScan"/>
                </svg>
                获取
              </el-button>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item label="二维码">
          <div class="qr-upload">
            <el-upload
              :auto-upload="false"
              :show-file-list="false"
              accept="image/*"
              @change="handleQRUpload"
            >
              <el-button type="primary" plain>上传二维码</el-button>
            </el-upload>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="cancelEdit">取消</el-button>
        <el-button type="primary" @click="saveSite" :loading="saving">保存</el-button>
      </template>
    </el-dialog>

    <!-- 导入对话框 -->
    <el-dialog v-model="showImportDialog" title="导入配置" width="95%">
      <el-upload
        :auto-upload="false"
        :show-file-list="false"
        accept=".json"
        @change="handleImportFile"
        drag
      >
        <div class="upload-content">
          <svg viewBox="0 0 24 24" width="48" height="48" class="upload-icon">
            <path :d="mdiFileUpload"/>
          </svg>
          <div class="upload-text">拖拽文件到此处或点击上传</div>
          <div class="upload-hint">支持JSON格式的配置文件</div>
        </div>
      </el-upload>
      <template #footer>
        <el-button @click="showImportDialog = false">取消</el-button>
      </template>
    </el-dialog>

    <!-- WebDav 备份选择导入 -->
    <el-dialog v-model="showWebDavImportDialog" title="从 WebDav 还原" width="95%" :close-on-click-modal="false">
      <div v-loading="webdavImportLoading" class="webdav-import-body">
        <div v-if="webdavBackups.length === 0" class="webdav-empty">
          未找到可用的 TOTP 备份文件
        </div>
        <el-radio-group v-else v-model="selectedWebDavBackupUrl" class="webdav-backup-list">
          <el-radio
            v-for="backup in webdavBackups"
            :key="backup.url"
            :value="backup.url"
            class="webdav-backup-item"
          >
            <div class="backup-info">
              <div class="backup-name">{{ backup.name }}</div>
              <div class="backup-meta">{{ formatBackupTime(backup.lastModified) }} · {{ formatBackupSize(backup.size) }}</div>
            </div>
          </el-radio>
        </el-radio-group>
      </div>
      <template #footer>
        <el-button
          type="danger"
          :disabled="!selectedWebDavBackupUrl || webdavBackups.length === 0"
          :loading="webdavDeleting"
          @click="deleteSelectedWebDavBackup"
        >删除</el-button>
        <el-button @click="loadWebDavBackupList" :loading="webdavImportLoading">刷新</el-button>
        <el-button
          type="primary"
          :disabled="!selectedWebDavBackupUrl || webdavBackups.length === 0"
          :loading="webdavImporting"
          @click="importSelectedWebDavBackup"
        >还原</el-button>
      </template>
    </el-dialog>

  </div>
</template>

<script setup lang="ts">
// ============================================================
// TOTP 两步验证管理器视图
// 站点 CRUD、二维码扫描识别、验证码生成显示
// ============================================================
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { 
  mdiMagnify, mdiRefresh, mdiPlus, mdiExportVariant, mdiImport,
  mdiContentCopy, mdiOpenInNew, mdiPencil, mdiDelete, mdiShieldKey,
  mdiQrcodeScan, mdiFileUpload, mdiSortVariant, mdiDotsVertical,
  mdiCloudUpload, mdiCloudDownload, mdiSwapHorizontal
} from '@mdi/js';
import type { TOTPSite, TOTPCode, TOTPExportData } from '../../shared/types/totp';
import { TOTPStorageService } from '../../shared/services/totpStorage';
import { getSiteIcon, SITE_ICONS } from '../../shared/data/siteIcons';
import { decryptWebDavPassword, decryptWebDavUsername, decryptWebDavUrl } from '../../shared/secureStorage';
import { decryptTotpBackup, encryptTotpBackup, isTotpBackupEnvelope, loadPtBackupKey, savePtBackupKey } from '../../shared/ptBackupCrypto';
import { createMpApiClient } from '../../shared/api/client';
import { getBaseUrl, getToken } from '../../shared/api/auth';
import { 
  validateSecret, generateTOTP, generateAllCodes, calculateRemainingTime, calculateProgress, parseQRCode
} from '../../shared/utils/totp';
import jsQR from 'jsqr';

// ==================== 响应式状态 ====================
const sites = ref<TOTPSite[]>([]);
const codes = ref<TOTPCode[]>([]);
const mpSiteIcons = ref<Record<string, string>>({});
const loading = ref(false);
const saving = ref(false);
const searchKeyword = ref('');
const sortBy = ref('name');
const remainingTime = ref(30);
const progress = ref(0);
const refreshTimer = ref<number | null>(null);
const currentTab = ref<'pt' | 'custom'>('pt');

// 对话框状态
const showAddDialog = ref(false);
const showImportDialog = ref(false);
const showWebDavImportDialog = ref(false);
const editingSite = ref<TOTPSite | null>(null);

type WebDavBackupFile = { name: string; url: string; lastModified?: number; size?: number; };
const webdavBackups = ref<WebDavBackupFile[]>([]);
const selectedWebDavBackupUrl = ref('');
const webdavImportLoading = ref(false);
const webdavImporting = ref(false);
const webdavDeleting = ref(false);

// ==================== 表单数据 ====================
// 表单数据
const siteForm = ref({
  name: '',
  url: '',
  secret: '',
  category: 'pt'
});

const siteFormRef = ref();
const qrPreview = ref('');

// 表单验证规则
const siteRules = {
  name: [
    { required: true, message: '请输入站点名称', trigger: 'blur' }
  ],
  secret: [
    { required: true, message: '请输入密钥', trigger: 'blur' },
    { validator: (rule: any, value: string, callback: Function) => {
      if (value && !validateSecret(value)) {
        callback(new Error('密钥格式不正确'));
      } else {
        callback();
      }
    }, trigger: 'blur' }
  ]
};

// 将可能的 URL 编码名称解码为可读中文
function decodeName(input?: string): string {
  if (!input) return '';
  try {
    // 先处理 + 为空格 的变体
    const replaced = input.replace(/\+/g, '%20');
    return decodeURIComponent(replaced);
  } catch (e) {
    return input;
  }
}

// ==================== 计算属性 ====================
const filteredSites = computed(() => {
  let filtered = sites.value.filter((site: TOTPSite) => getSiteCategory(site) === currentTab.value);
  
  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase();
    filtered = filtered.filter((site: TOTPSite) => 
      site.name.toLowerCase().includes(keyword) ||
      (site.url && site.url.toLowerCase().includes(keyword))
    );
  }
  
  return filtered.sort((a: TOTPSite, b: TOTPSite) => {
    switch (sortBy.value) {
      case 'createdAt':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'updatedAt':
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      default:
        return a.name.localeCompare(b.name);
    }
  });
});

// ==================== 数据加载 ====================
const loadSites = async () => {
  try {
    loading.value = true;
    sites.value = await TOTPStorageService.getAllSites();
    await refreshCodes();
  } catch (error) {
    console.error('加载站点失败:', error);
    ElMessage.error('加载站点失败');
  } finally {
    loading.value = false;
  }
};

const refreshCodes = async () => {
  if (sites.value.length === 0) return;
  
  try {
    codes.value = await generateAllCodes(sites.value);
    // 兜底：若生成结果为空，立即进行一次同步计算，避免初始空窗
    if (!codes.value || codes.value.length === 0) {
      const fallback = (sites.value || []).map((s: any) => {
        try {
          const c = (generateTOTP as any)((s?.secret || '').trim());
          return { siteId: s.id, code: c || '------', remainingTime: calculateRemainingTime(), progress: calculateProgress() } as TOTPCode;
        } catch {
          return { siteId: s.id, code: '------', remainingTime: calculateRemainingTime(), progress: calculateProgress() } as TOTPCode;
        }
      });
      codes.value = fallback;
    }
    updateTimeInfo();
  } catch (error) {
    console.error('刷新验证码失败:', error);
  }
};

const updateTimeInfo = () => {
  remainingTime.value = calculateRemainingTime();
  progress.value = calculateProgress();
};

// ==================== 验证码定时器 ====================
const startRefreshTimer = () => {
  if (refreshTimer.value) {
    clearInterval(refreshTimer.value);
  }
  
  refreshTimer.value = setInterval(() => {
    // 如果站点数据已加载但验证码为空，先尝试生成验证码
    if (sites.value.length > 0 && codes.value.length === 0) {
      refreshCodes();
    }
    
    updateTimeInfo();
    // 更新每个站点的进度
    codes.value = codes.value.map(code => {
      const remaining = calculateRemainingTime();
      const progress = calculateProgress();
      return {
        ...code,
        remainingTime: remaining,
        progress: progress
      };
    });
    
    if (remainingTime.value === 30) {
      refreshCodes();
    }
  }, 1000);
};

const getCodeForSite = (siteId: string): string => {
  const code = codes.value.find((c: TOTPCode) => c.siteId === siteId);
  
  // 加载中
  if (loading.value) return '------';
  
  // 生成批量代码前的兜底：按需即时计算，避免首个站点长期显示占位
  if (!code && sites.value.length > 0 && codes.value.length === 0) {
    const site = sites.value.find((s: any) => s.id === siteId);
    try {
      const secret = site?.secret?.trim?.();
      if (secret) {
        try { return (generateTOTP as any)(secret) || '------'; } catch { return '------'; }
      }
    } catch {}
    return '------';
  }
  
  // 异常码
  if (code?.code === '000000' && sites.value.length > 0) return 'ERROR';
  
  return code?.code || '------';
};

const getCodeClass = (siteId: string): string => {
  const code = getCodeForSite(siteId);
  
  if (code === '------') {
    return 'loading';
  } else if (code === 'ERROR') {
    return 'error';
  }
  
  return 'normal';
};

const getRemainingTimeForSite = (siteId: string): number => {
  const code = codes.value.find((c: TOTPCode) => c.siteId === siteId);
  return code?.remainingTime || 30;
};

const getProgressForSite = (siteId: string): number => {
  const code = codes.value.find((c: TOTPCode) => c.siteId === siteId);
  if (!code) return 0;
  
  // 计算圆形进度，需要转换为周长
  const circumference = 2 * Math.PI * 15.9155; // 半径15.9155
  const progress = (code.progress / 100) * circumference;
  return progress;
};

// ==================== 站点操作 ====================
const copyCode = async (code: string) => {
  try {
    await navigator.clipboard.writeText(code);
    ElMessage.success('验证码已复制到剪贴板');
  } catch (error) {
    console.error('复制失败:', error);
    ElMessage.error('复制失败');
  }
};

const openSite = (site: TOTPSite) => {
  if (site.url) {
    chrome.tabs.create({ url: site.url });
  }
};

const editSite = (site: TOTPSite) => {
  editingSite.value = site;
  siteForm.value = {
    name: site.name,
    url: site.url || '',
    secret: site.secret,
    category: getSiteCategory(site)
  };
  showAddDialog.value = true;
};

const deleteSite = async (site: TOTPSite) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除站点 "${site.name}" 吗？`,
      '确认删除',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );
    
    await TOTPStorageService.deleteSite(site.id);
    await loadSites();
    ElMessage.success('删除成功');
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除失败:', error);
      ElMessage.error('删除失败');
    }
  }
};



// ==================== 二维码扫描 ====================
const handleQRUpload = (file: any) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    qrPreview.value = e.target?.result as string;
    scanQRCode(e.target?.result as string);
  };
  reader.readAsDataURL(file.raw);
};

// 从当前活动标签页识别二维码（适配 NexusPHP 安全设定 页面）
const scanQRCodeFromActiveTab = async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      ElMessage.error('未找到活动标签页');
      return;
    }
    // 预先填入当前站点地址（使用站点 origin）
    try {
      if (tab.url) {
        const origin = new URL(tab.url).origin;
        siteForm.value.url = origin;
      }
    } catch (e) { /* ignore invalid url */ }

    const [execResult] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: () => {
        // 1) 优先查找 otpauth 链接
        const link = Array.from(document.querySelectorAll('a[href^="otpauth://"]'))[0] as HTMLAnchorElement | undefined;
        if (link?.href) {
          return { type: 'otpauth', data: link.href };
        }

        // 2) 其次尝试图片中包含二维码
        const imgs = Array.from(document.images) as HTMLImageElement[];
        const candidates = imgs.filter(img => {
          const src = (img.currentSrc || img.src || '').toLowerCase();
          const hint = ((img.alt || '') + ' ' + (img.title || '')).toLowerCase();
          const sizeOk = (img.naturalWidth || img.width) >= 80 && (img.naturalHeight || img.height) >= 80;
          return sizeOk && (src.includes('qr') || src.includes('qrcode') || src.includes('otp') || hint.includes('qr') || hint.includes('otp'));
        });
        const targetImg = candidates[0] || imgs.find(i => (i.naturalWidth || i.width) > 100 && (i.naturalHeight || i.height) > 100);
        if (targetImg) {
          try {
            const canvas = document.createElement('canvas');
            const w = targetImg.naturalWidth || targetImg.width;
            const h = targetImg.naturalHeight || targetImg.height;
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(targetImg, 0, 0, w, h);
              const dataUrl = canvas.toDataURL('image/png');
              return { type: 'image', data: dataUrl };
            }
          } catch (e) { 
            // 可能因跨域安全导致 canvas 被污染，退回返回图片URL
            const url = (targetImg.currentSrc || targetImg.src || '').trim();
            if (url) return { type: 'image-url', data: url };
          }
          // 即使未抛错也兜底返回图片URL
          const url = (targetImg.currentSrc || targetImg.src || '').trim();
          if (url) return { type: 'image-url', data: url };
        }

        // 3) 再尝试页面上的 canvas（有些站点二维码直接绘制在canvas）
        const canvases = Array.from(document.querySelectorAll('canvas')) as HTMLCanvasElement[];
        for (const c of canvases) {
          try {
            if (c.width >= 80 && c.height >= 80) {
              const dataUrl = c.toDataURL('image/png');
              if (dataUrl && dataUrl.startsWith('data:image')) {
                return { type: 'image', data: dataUrl };
              }
            }
          } catch (e) { /* ignore */ }

        }

        // 4) 尝试 CSS 背景图中的二维码
        const nodes = Array.from(document.querySelectorAll('*')) as HTMLElement[];
        for (const el of nodes) {
          const cs = getComputedStyle(el);
          const bg = cs.backgroundImage || '';
          const m = bg.match(/url\(("|')?(.*?)("|')?\)/);
          if (m && m[2]) {
            const url = m[2];
            const lower = url.toLowerCase();
            if (lower.includes('qr') || lower.includes('qrcode')) {
              return { type: 'image-url', data: url };
            }
          }
        }

        return null;
      }
    });

    const result: any = execResult?.result;
    if (!result) {
      ElMessage.warning('未在当前页面检测到二维码或 otpauth 链接');
      return;
    }

    if (result.type === 'otpauth') {
      const parsed = parseQRCode(result.data);
      if (parsed?.secret) {
        siteForm.value.secret = parsed.secret;
        if (parsed.account) {
          siteForm.value.name = decodeName(parsed.account).replace(/^\/+/, '').trim();
        } else if (parsed.issuer) {
          siteForm.value.name = decodeName(parsed.issuer).replace(/^\/+/, '').trim();
        }
        if (!showAddDialog.value) showAddDialog.value = true;
        ElMessage.success('已识别 otpauth 链接并自动填入密钥');
      } else {
        ElMessage.error('识别到 otpauth，但解析失败');
      }
      return;
    }

    if (result.type === 'image') {
      // 复用本页已有的二维码图片解析逻辑
      qrPreview.value = result.data as string;
      scanQRCode(result.data as string);
      if (!showAddDialog.value) showAddDialog.value = true;
      return;
    }

    if (result.type === 'image-url') {
      try {
        const resp = await fetch(result.data, { mode: 'cors' });
        const blob = await resp.blob();
        const reader = new FileReader();
        const dataUrl: string = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        qrPreview.value = dataUrl;
        scanQRCode(dataUrl);
        if (!showAddDialog.value) showAddDialog.value = true;
        return;
      } catch (e) {
        console.error('跨域获取二维码失败:', e);
      }
    }

    ElMessage.warning('未能识别二维码');
  } catch (error) {
    console.error('识别二维码失败:', error);
    ElMessage.error('识别二维码失败');
  }
};

const scanQRCode = (imageSrc: string) => {
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert'
    });
    
    if (code) {
      const result = parseQRCode(code.data);
      if (result && result.secret) {
        siteForm.value.secret = result.secret;
        if (result.account) {
          siteForm.value.name = decodeName(result.account).replace(/^\/+/, '').trim();
        } else if (result.issuer) {
          siteForm.value.name = decodeName(result.issuer).replace(/^\/+/, '').trim();
        }
        ElMessage.success('二维码解析成功');
      } else {
        ElMessage.error('二维码内容不符合要求');
      }
    } else {
      ElMessage.error('未检测到有效二维码');
    }
  };
  img.src = imageSrc;
};

const saveSite = async () => {
  if (!siteFormRef.value) return;
  
  try {
    await siteFormRef.value.validate();
    saving.value = true;
    
    if (editingSite.value) {
      await TOTPStorageService.updateSite(editingSite.value.id, {
        name: siteForm.value.name,
        url: siteForm.value.url,
        secret: siteForm.value.secret,
        category: siteForm.value.category as any
      });
      ElMessage.success('更新成功');
    } else {
      await TOTPStorageService.addSite({
        name: siteForm.value.name,
        url: siteForm.value.url,
        secret: siteForm.value.secret,
        category: siteForm.value.category as any
      });
      ElMessage.success('添加成功');
    }
    
    await loadSites();
    // 仅新增站点后触发自动备份
    if (!editingSite.value) {
      await tryAutoBackupOnChange();
    }
    cancelEdit();
  } catch (error) {
    console.error('保存失败:', error);
    ElMessage.error('保存失败');
  } finally {
    saving.value = false;
  }
};

const cancelEdit = () => {
  showAddDialog.value = false;
  editingSite.value = null;
  siteForm.value = { name: '', url: '', secret: '', category: 'pt' };
  qrPreview.value = '';
  if (siteFormRef.value) {
    siteFormRef.value.resetFields();
  }
};

// ==================== 导入导出 ====================
const requestTotpBackupKey = async (title: string, message: string, allowPrompt = true): Promise<string> => {
  const savedKey = await loadPtBackupKey();
  if (savedKey) return savedKey;
  if (!allowPrompt) return '';

  try {
    const result = await ElMessageBox.prompt(message, title, {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputType: 'password',
      inputPlaceholder: '备份密钥',
      inputValidator: value => Boolean(value?.trim()) || '请输入备份密钥'
    });
    const key = result.value?.trim() || '';
    if (key) {
      await savePtBackupKey(key);
      ElMessage.success('备份密钥已加密保存');
    }
    return key;
  } catch {
    return '';
  }
};

const resolveTotpImportData = async (data: unknown): Promise<TOTPExportData> => {
  if (isTotpBackupEnvelope(data)) {
    const backupKey = await requestTotpBackupKey(
      'WebDav 备份密钥',
      '请输入用于解密两步验证备份的备份密钥。本次输入会同步加密保存到设置中的备份密钥，后续无需再次输入。'
    );
    if (!backupKey) throw new Error('已取消输入备份密钥');
    return decryptTotpBackup<TOTPExportData>(data, backupKey);
  }
  return data as TOTPExportData;
};

const exportToWebDav = async (data: any, allowKeyPrompt = true) => {
  try {
    // 获取WebDav配置
    const webdavConfig = await chrome.storage.sync.get(['webdav_url', 'webdav_username', 'webdav_password', 'webdav_path']);
    const password = await decryptWebDavPassword(webdavConfig.webdav_password);
    const username = await decryptWebDavUsername(webdavConfig.webdav_username);
    const url = await decryptWebDavUrl(webdavConfig.webdav_url);
    
    if (!url || !username || !password) {
      ElMessage.warning('请先完整配置 WebDav（服务器地址、用户名、密码）');
      return;
    }
    
    const pad = (n: number) => n.toString().padStart(2, '0');
    const now = new Date();
    const stamp = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const fileName = `totp-backup-${stamp}.json`;
    const backupKey = await requestTotpBackupKey(
      'WebDav 备份密钥',
      '请输入用于加密两步验证配置的备份密钥。本次输入会同步加密保存到设置中的备份密钥，后续无需再次输入。',
      allowKeyPrompt
    );
    if (!backupKey) {
      if (allowKeyPrompt) ElMessage.warning('已取消 WebDav 备份');
      return;
    }
    const encryptedData = await encryptTotpBackup(data, backupKey);
    const jsonData = JSON.stringify(encryptedData, null, 2);
    
    const base = url.replace(/\/$/, '');
    const path = (((webdavConfig as any).webdav_path as string) || '').trim();
    const normPath = path ? '/' + path.replace(/^\/+/, '') : '/MP-Totp';
    const targetBase = `${base}${normPath}`.replace(/\/$/, '');
    const targetUrl = `${targetBase}/${encodeURIComponent(fileName)}`;
    const auth = `Basic ${btoa(`${username}:${password}`)}`;

    // 第一次尝试直接PUT
    let response = await fetch(targetUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': auth
      },
      body: jsonData
    });

    // 若父目录不存在，409 Conflict 或 404 Not Found，尝试创建目录后重试
    if (response.status === 409 || response.status === 404) {
      try {
        await fetch(targetBase + '/', {
          method: 'MKCOL',
          headers: { 'Authorization': auth }
        });
      } catch (e) { /* ignore */ }

      response = await fetch(targetUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Authorization': auth
        },
        body: jsonData
      });
    }

    if (response.ok) {
      // 处理保留份数：若设置了保留份数且>0，则清理多余旧备份
      try {
        const cfg = await chrome.storage.sync.get(['webdav_retain_count']);
        const retain = Number(cfg.webdav_retain_count) || 0;
        if (retain > 0) {
          const { listUrl } = await buildWebDavContext(webdavConfig);
          const files = await listWebDavFiles(listUrl, auth);
          const backups = files
            .filter(f => /\.json$/i.test(f.name) && /totp/i.test(f.name))
            .sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
          if (backups.length > retain) {
            const toDelete = backups.slice(retain);
            for (const f of toDelete) {
              try { await fetch(f.url, { method: 'DELETE', headers: { 'Authorization': auth } }); } catch {}
            }
          }
        }
      } catch {}
      ElMessage.success('导出到WebDav成功');
    } else {
      const text = await response.text().catch(() => '');
      throw new Error(`WebDav上传失败: ${response.status} ${text?.slice(0,200)}`);
    }
  } catch (error) {
    console.error('WebDav导出失败:', error);
    ElMessage.error(`WebDav导出失败: ${(error as Error).message}`);
  }
};

// 排序命令处理
const handleSortCommand = (command: string) => {
  sortBy.value = command;
};

// 更多操作命令处理
const handleMoreCommand = async (command: string) => {
  if (command === 'refresh') {
    await refreshCodes();
    ElMessage.success('已刷新验证码');
  } else if (command === 'webdav-export') {
    try {
      const data = await TOTPStorageService.exportConfig();
      await exportToWebDav(data);
    } catch (error) {
      console.error('备份失败:', error);
    }
  } else if (command === 'webdav-import') {
    await openWebDavImportDialog();
  } else if (command === 'json-export') {
    try {
      const data = await TOTPStorageService.exportConfig();
      const backupKey = await requestTotpBackupKey(
        '本地备份密钥',
        '请输入用于加密两步验证配置的备份密钥。本次输入会同步加密保存到设置中的备份密钥，后续无需再次输入。'
      );
      if (!backupKey) {
        ElMessage.warning('已取消导出');
        return;
      }
      const encryptedData = await encryptTotpBackup(data, backupKey);
      const blob = new Blob([JSON.stringify(encryptedData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `totp-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      ElMessage.success('导出成功');
    } catch (error) {
      console.error('导出失败:', error);
      ElMessage.error('导出失败');
    }
  } else if (command === 'json-import') {
    showImportDialog.value = true;
  }
};

const handleImportFile = async (file: any) => {
  try {
    const text = await file.raw.text();
    const data = await resolveTotpImportData(JSON.parse(text));
    await TOTPStorageService.importConfig(data);
    await loadSites();
    showImportDialog.value = false;
    ElMessage.success('导入成功');
  } catch (error) {
    console.error('导入失败:', error);
    ElMessage.error('导入失败');
  }
};

// ==================== WebDav 操作 ====================
// 构建基础路径与认证头
const buildWebDavContext = async (cfg: any) => {
  const url = await decryptWebDavUrl(cfg.webdav_url);
  const base = (url as string).replace(/\/$/, '');
  const path = (cfg.webdav_path || '').toString().trim();
  const normPath = path ? '/' + path.replace(/^\/+/, '') : '/MP-Totp';
  const listUrl = `${base}${normPath}/`;
  const username = await decryptWebDavUsername(cfg.webdav_username);
  const password = await decryptWebDavPassword(cfg.webdav_password);
  const auth = `Basic ${btoa(`${username}:${password}`)}`;
  return { base, normPath, listUrl, auth };
};

// WebDav: 列举目录下文件（PROPFIND Depth:1）并返回文件信息
const listWebDavFiles = async (listUrl: string, auth: string) => {
  const body = `<?xml version="1.0" encoding="utf-8"?>\n` +
    `<d:propfind xmlns:d="DAV:">` +
    `<d:prop><d:displayname/><d:getlastmodified/><d:getcontentlength/><d:resourcetype/></d:prop>` +
    `</d:propfind>`;
  const resp = await fetch(listUrl, {
    method: 'PROPFIND',
    headers: {
      'Depth': '1',
      'Authorization': auth,
      'Content-Type': 'text/xml; charset=utf-8'
    },
    body
  });
  if (!resp.ok) throw new Error(`PROPFIND failed: ${resp.status}`);
  const text = await resp.text();
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const responses = Array.from(doc.getElementsByTagNameNS('*', 'response'));
  const files: WebDavBackupFile[] = [];
  for (const r of responses) {
    const hrefEl = r.getElementsByTagNameNS('*', 'href')[0];
    if (!hrefEl) continue;
    const href = hrefEl.textContent || '';
    const propstat = r.getElementsByTagNameNS('*', 'propstat')[0];
    const prop = propstat?.getElementsByTagNameNS('*', 'prop')[0];
    const resType = prop?.getElementsByTagNameNS('*', 'resourcetype')[0];
    const isCollection = !!(resType && resType.getElementsByTagNameNS('*', 'collection')[0]);
    const display = prop?.getElementsByTagNameNS('*', 'displayname')[0]?.textContent || '';
    const lastModText = prop?.getElementsByTagNameNS('*', 'getlastmodified')[0]?.textContent || '';
    const sizeText = prop?.getElementsByTagNameNS('*', 'getcontentlength')[0]?.textContent || '';
    const lastModified = Date.parse(lastModText || '');
    const size = Number(sizeText);
    // 跳过目录本身与子目录，仅保留文件
    if (href.replace(/\/?$/, '/') === listUrl.replace(/\/?$/, '/')) continue;
    if (isCollection) continue;
    const url = href.startsWith('http') ? href : (new URL(href, listUrl)).toString();
    const name = display || decodeURIComponent(url.split('/').filter(Boolean).pop() || '');
    files.push({ name, url, lastModified: isNaN(lastModified) ? undefined : lastModified, size: Number.isFinite(size) ? size : undefined });
  }
  return files;
};

const getSortedBackupFiles = (files: WebDavBackupFile[]): WebDavBackupFile[] => {
  return files
    .filter(f => /\.json$/i.test(f.name) && /totp/i.test(f.name))
    .sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
};

const formatBackupTime = (timestamp?: number): string => {
  if (!timestamp) return '修改时间未知';
  return `修改时间：${new Date(timestamp).toLocaleString()}`;
};

const formatBackupSize = (size?: number): string => {
  if (typeof size !== 'number') return '大小未知';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
};

const loadWebDavBackupList = async () => {
  webdavImportLoading.value = true;
  try {
    const cfg = await chrome.storage.sync.get(['webdav_url','webdav_path','webdav_username','webdav_password']);
    const password = await decryptWebDavPassword(cfg.webdav_password);
    const username = await decryptWebDavUsername(cfg.webdav_username);
    const url = await decryptWebDavUrl(cfg.webdav_url);
    if (!url || !username || !password) {
      ElMessage.warning('请先完整配置 WebDav（服务器地址、用户名、密码）');
      showWebDavImportDialog.value = false;
      return;
    }

    const { listUrl, auth } = await buildWebDavContext(cfg);
    const files = await listWebDavFiles(listUrl, auth);
    webdavBackups.value = getSortedBackupFiles(files);
    selectedWebDavBackupUrl.value = webdavBackups.value[0]?.url || '';

    if (webdavBackups.value.length === 0) {
      ElMessage.warning('未找到可用的 TOTP 备份文件');
    }
  } catch (error) {
    console.error('加载 WebDav 备份列表失败:', error);
    ElMessage.error('加载 WebDav 备份列表失败');
  } finally {
    webdavImportLoading.value = false;
  }
};

const openWebDavImportDialog = async () => {
  showWebDavImportDialog.value = true;
  webdavBackups.value = [];
  selectedWebDavBackupUrl.value = '';
  await loadWebDavBackupList();
};

const importSelectedWebDavBackup = async () => {
  const target = webdavBackups.value.find(file => file.url === selectedWebDavBackupUrl.value);
  if (!target) {
    ElMessage.warning('请选择要导入的备份文件');
    return;
  }

  webdavImporting.value = true;
  try {
    const cfg = await chrome.storage.sync.get(['webdav_url','webdav_path','webdav_username','webdav_password']);
    const password = await decryptWebDavPassword(cfg.webdav_password);
    const username = await decryptWebDavUsername(cfg.webdav_username);
    if (!username || !password) {
      ElMessage.warning('请先完整配置 WebDav（用户名、密码）');
      return;
    }

    const auth = `Basic ${btoa(`${username}:${password}`)}`;
    const resp = await fetch(target.url, { headers: { 'Authorization': auth } });
    if (!resp.ok) throw new Error(`下载失败: ${resp.status}`);
    const text = await resp.text();
    const data = await resolveTotpImportData(JSON.parse(text));
    await TOTPStorageService.importConfig(data);
    await loadSites();
    showWebDavImportDialog.value = false;
    ElMessage.success(`已从 WebDav 导入：${target.name}`);
  } catch (error) {
    console.error('WebDav 导入失败:', error);
    ElMessage.error(`从 WebDav 导入失败: ${(error as Error).message}`);
  } finally {
    webdavImporting.value = false;
  }
};

const deleteSelectedWebDavBackup = async () => {
  const target = webdavBackups.value.find(file => file.url === selectedWebDavBackupUrl.value);
  if (!target) {
    ElMessage.warning('请选择要删除的备份文件');
    return;
  }

  try {
    await ElMessageBox.confirm(
      `确定要删除备份文件“${target.name}”吗？此操作不可恢复。`,
      '确认删除备份',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );
  } catch {
    return;
  }

  webdavDeleting.value = true;
  try {
    const cfg = await chrome.storage.sync.get(['webdav_username','webdav_password']);
    const password = await decryptWebDavPassword(cfg.webdav_password);
    const username = await decryptWebDavUsername(cfg.webdav_username);
    if (!username || !password) {
      ElMessage.warning('请先完整配置 WebDav（用户名、密码）');
      return;
    }

    const auth = `Basic ${btoa(`${username}:${password}`)}`;
    const resp = await fetch(target.url, { method: 'DELETE', headers: { 'Authorization': auth } });
    if (!resp.ok) throw new Error(`删除失败: ${resp.status}`);

    ElMessage.success(`已删除备份：${target.name}`);
    await loadWebDavBackupList();
  } catch (error) {
    console.error('WebDav 备份删除失败:', error);
    ElMessage.error(`删除失败: ${(error as Error).message}`);
  } finally {
    webdavDeleting.value = false;
  }
};

// ==================== 工具函数 ====================
// 若开启“配置变化备份”，且配置完整，则导出到 WebDav
const tryAutoBackupOnChange = async () => {
  try {
    const cfg = await chrome.storage.sync.get(['webdav_url','webdav_username','webdav_password','webdav_path','webdav_auto_on_change']);
    if (!cfg.webdav_auto_on_change) return;
    const url = await decryptWebDavUrl(cfg.webdav_url);
    if (!url) return;
    const data = await TOTPStorageService.exportConfig();
    await exportToWebDav(data, false);
  } catch (e) {
    console.error('配置变化自动备份失败:', e);
  }
};

// ==================== MP 图标获取 ====================
// 异步拉取 MoviePilot 后端的所有站点图标作为 TOTP 匹配缓存
async function fetchMpSiteIcons() {
  try {
    const client = createMpApiClient({ baseURL: await getBaseUrl(), getToken });
    const resp = await client.get('/api/v1/site/');
    const mpSites = Array.isArray(resp.data?.data) ? resp.data.data : (Array.isArray(resp.data) ? resp.data : []);
    
    // 分批加载以降低服务器并发压力
    const batchSize = 8;
    for (let i = 0; i < mpSites.length; i += batchSize) {
      const batch = mpSites.slice(i, i + batchSize);
      await Promise.all(batch.map(async (s: any) => {
        const siteUrl = s.url || '';
        const siteId = s.id;
        if (!siteUrl || !siteId) return;

        const domain = getDomain(siteUrl);
        if (!domain) return;

        // 本地图标命中则无需再次向后端请求
        const localIcon = getLocalSiteIcon(domain);
        if (localIcon) {
          mpSiteIcons.value[domain] = localIcon;
          return;
        }

        try {
          const iconResp = await client.get(`/api/v1/site/icon/${siteId}`);
          let iconData = null;
          if (iconResp.data?.success && typeof iconResp.data?.data?.icon === 'string') {
            iconData = iconResp.data.data.icon;
          } else if (typeof iconResp.data?.icon === 'string') {
            iconData = iconResp.data.icon;
          } else if (typeof iconResp.data?.data === 'string') {
            iconData = iconResp.data.data;
          } else if (typeof iconResp.data === 'string' && iconResp.data.startsWith('data:')) {
            iconData = iconResp.data;
          }

          if (typeof iconData === 'string') {
            mpSiteIcons.value[domain] = iconData;
          }
        } catch (err) {
          console.debug(`Failed to fetch custom icon for ${domain} via MoviePilot API in TOTP:`, err);
        }
      }));
    }
  } catch (error) {
    console.debug('Failed to load MoviePilot configured sites in TOTPManager:', error);
  }
}

// ==================== 生命周期 ====================
onMounted(async () => {
  // 先加载站点数据，确保验证码生成完成后再启动定时器
  await loadSites();
  // 立即计算一次，避免首个站点首屏占位
  await refreshCodes();
  startRefreshTimer();
  fetchMpSiteIcons();
  
  // 监听自动备份闹钟触发
  try {
    chrome.alarms.onAlarm.addListener(async (alarm) => {
      if (alarm?.name !== 'mp_totp_webdav_backup') return;
      try {
        const data = await TOTPStorageService.exportConfig();
        await exportToWebDav(data, false);
      } catch (e) {
        console.error('自动备份失败:', e);
      }
    });
  } catch (e) { /* ignore in non-extension environment */ }
});

onUnmounted(() => {
  if (refreshTimer.value) {
    clearInterval(refreshTimer.value);
  }
});

// 监听搜索关键词变化
watch(searchKeyword, () => {
  // 搜索逻辑已在计算属性中处理
});

const handleCardCommand = async (command: string, site: TOTPSite) => {
  if (command === 'edit') {
    editSite(site);
  } else if (command === 'delete') {
    deleteSite(site);
  } else if (command === 'toggle-category') {
    const currentCat = getSiteCategory(site);
    const nextCat = currentCat === 'pt' ? 'custom' : 'pt';
    try {
      await TOTPStorageService.updateSite(site.id, {
        category: nextCat
      });
      await loadSites();
      ElMessage.success(`已移动到${nextCat === 'pt' ? 'PT站点' : '自定义'}`);
    } catch (error) {
      ElMessage.error('移动失败');
    }
  }
};

function getSiteCategory(site: TOTPSite): 'pt' | 'custom' {
  if (site.category) return site.category;
  return site.url ? 'pt' : 'custom';
}

function getDomain(urlStr?: string): string {
  if (!urlStr) return '';
  try {
    const cleanUrl = urlStr.includes('://') ? urlStr : `https://${urlStr}`;
    const host = new URL(cleanUrl).hostname;
    return host.replace(/^www\./i, '');
  } catch {
    return (urlStr || '').replace(/^www\./i, '');
  }
}

function getAvatarChar(name: string): string {
  if (!name) return '?';
  return name.charAt(0).toUpperCase();
}

function getAvatarBg(domain: string): string {
  if (!domain) return '#1677ff';
  const clean = domain.replace(/^www\./i, '');
  const gradients = [
    'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
    'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
    'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
    'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
    'linear-gradient(135deg, #f43f5e 0%, #be123c 100%)',
    'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)'
  ];
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = clean.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % gradients.length;
  return gradients[index];
}

// 站点图标（优先本地 Base64，支持子域名自动回滚至主域名匹配）
function getLocalSiteIcon(domain: string): string | null {
  try {
    let icon = getSiteIcon(domain);
    if (icon) return icon;

    // 自动剥离多级子域名尝试主域名匹配 (如 xp.m-team.io -> m-team.io)
    const parts = domain.split('.');
    if (parts.length > 2) {
      const mainDomain = parts.slice(-2).join('.');
      icon = getSiteIcon(mainDomain);
      if (icon) return icon;
    }
    return null;
  } catch {
    return null;
  }
}

function getIconByName(name: string): string | null {
  if (!name) return null;
  const cleanName = name.toLowerCase().trim();
  const cleanNameNormalized = cleanName.replace(/[-_.\s]/g, '');

  // 1. 中文别名/常用缩写映射
  const aliasMapping: Record<string, string> = {
    '龙pt': 'longpt',
    '龙': 'longpt',
    '馒头': 'm-team',
    '猫站': 'pterclub',
    '天空': 'hdsky',
    '彩虹岛': 'chdbits',
    '我堡': 'ourbits',
    '皇后': 'open',
    '红叶': 'redleaves',
    '杜比': 'hddolby',
    '家园': 'hdhome',
    '蝴蝶': 'hudie',
    '春天': 'springsunday',
    '柠檬': 'lemonhd',
    '大盘': 'hdchina',
    '海胆': 'haidan',
    '备胎': 'beitai',
    '魂': 'soulvoice',
    '影客': 'keepfrds',
    '不可说': 'hdchina',
    '学校': 'discfan',
    '教育网': 'tjupt',
    '北邮': 'byr',
    '六维': '6v',
    '52': '52pt',
    '他留': 'totheglory',
    '听歌': 'open',
    '高清晰': 'hdchina'
  };

  for (const [alias, prefix] of Object.entries(aliasMapping)) {
    if (cleanName.includes(alias)) {
      const icon = SITE_ICONS[prefix];
      if (icon) return icon;
    }
  }

  // 2. 遍历 SITE_ICONS 的 Key 进行去符号匹配
  const keys = Object.keys(SITE_ICONS).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    const cleanKey = key.replace(/[-_.\s]/g, '');
    if (cleanKey.length >= 3 && cleanNameNormalized.includes(cleanKey)) {
      const icon = SITE_ICONS[key];
      if (icon) return icon;
    }
  }

  return null;
}

function getTotpSiteIcon(site: TOTPSite): string | null {
  if (site.url) {
    const domain = getDomain(site.url);
    if (domain) {
      // 1. 优先从 MoviePilot 后端拉取的自定义图标缓存中匹配
      if (mpSiteIcons.value[domain]) {
        return mpSiteIcons.value[domain];
      }
      // 2. 本地 Base64 预设图标匹配
      const icon = getLocalSiteIcon(domain);
      if (icon) return icon;
    }
  }
  
  // 3. 本地图标未命中，通过站点别名/Key进行模糊匹配
  const nameIcon = getIconByName(site.name);
  if (nameIcon) return nameIcon;

  // 4. 模糊匹配 MoviePilot 动态图标缓存
  // 例如 site.name 为 "LongPT" 且没有 URL，可以正向模糊匹配 "longpt.org" 的缓存
  const cleanName = site.name.toLowerCase().trim().replace(/[-_.\s]/g, '');
  if (cleanName.length >= 3) {
    for (const [domain, iconData] of Object.entries(mpSiteIcons.value)) {
      const cleanDomain = domain.split('.')[0].replace(/[-_.\s]/g, '');
      if (cleanName.includes(cleanDomain) || cleanDomain.includes(cleanName)) {
        return iconData;
      }
    }
  }

  return null;
}
</script>

<style scoped>
.totp-manager {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f8fafc;
}

.totp-tabs {
  display: flex;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  padding: 0 8px;
  flex-shrink: 0;
}

.totp-tab-item {
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 500;
  color: #64748b;
  cursor: pointer;
  position: relative;
  transition: color 0.15s ease;
  user-select: none;
}

.totp-tab-item:hover {
  color: #0f172a;
}

.totp-tab-item.active {
  color: #1677ff;
  font-weight: 600;
}

.totp-tab-item.active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 16px;
  right: 16px;
  height: 2px;
  background: #1677ff;
  border-radius: 2px 2px 0 0;
}

/* Toolbar Styling */
.toolbar {
  padding: 10px 8px;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
}

.toolbar-row {
  display: flex;
  gap: 8px;
  align-items: center;
  width: 100%;
}

.search-input {
  flex: 1;
}

.search-input :deep(.el-input__wrapper) {
  border-radius: 8px;
  box-shadow: 0 0 0 1px #e2e8f0 inset;
  background: #f8fafc;
  transition: all 0.2s ease;
}

.search-input :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px #1677ff inset !important;
  background: #ffffff;
}

.compact {
  width: 32px;
  height: 32px;
  padding: 0;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  color: #475569;
  transition: all 0.2s ease;
}

.add-button {
  background: #1677ff;
  border-color: #1677ff;
  color: #ffffff;
}

.add-button:hover {
  background: #0050b3;
  border-color: #0050b3;
  color: #ffffff;
}

.more-button:hover, .sort-button:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
  color: #0f172a;
}

.icon-prefix {
  color: #64748b;
}

.icon-btn-only {
  width: 16px;
  height: 16px;
  fill: currentColor;
}

.dropdown-item-content {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.mr-1 {
  width: 14px;
  height: 14px;
  fill: currentColor;
}

.webdav-import-body {
  min-height: 160px;
}

.webdav-empty {
  padding: 36px 12px;
  text-align: center;
  color: #94a3b8;
  font-size: 13px;
}

.webdav-backup-list {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.webdav-backup-item {
  width: 100%;
  height: auto;
  margin-right: 0;
  padding: 10px 12px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 10px;
  background: #fff;
  transition: border-color .18s ease, background .18s ease;
}

.webdav-backup-item:hover {
  border-color: rgba(59, 130, 246, 0.32);
  background: #f8fbff;
}

.webdav-backup-item.is-checked {
  border-color: rgba(59, 130, 246, 0.56);
  background: #eff6ff;
}

.webdav-backup-item :deep(.el-radio__label) {
  flex: 1;
  min-width: 0;
}

.backup-info {
  min-width: 0;
}

.backup-name {
  font-size: 13px;
  font-weight: 700;
  color: #334155;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.backup-meta {
  margin-top: 3px;
  font-size: 11px;
  color: #64748b;
}


.icon-btn {
  margin-right: 4px;
  vertical-align: -2px;
  fill: currentColor;
  color: inherit;
}

/* 修复append按钮内文字对齐问题 */
:deep(.el-input-group__append) {
  width: auto !important;
  flex: none !important;
  padding: 0 !important;
}

:deep(.el-input-group__append .el-button) {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  height: 100% !important;
  line-height: 1 !important;
  padding: 0 6px !important;
  text-align: center !important;
  width: auto !important;
  min-width: auto !important;
  margin: 0 !important;
}

:deep(.el-input-group__append .el-button .el-button__text) {
  display: inline-block !important;
  text-align: center !important;
  width: auto !important;
  line-height: 1 !important;
  margin: 0 !important;
  padding: 0 !important;
  transform: none !important;
}


/* .refresh-status has been removed */

.totp-grid {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
  min-height: 200px;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #999;
}

.empty-icon {
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-text {
  margin-bottom: 16px;
  font-size: 16px;
}

.totp-cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.totp-loading-cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.totp-loading-card {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  border-radius: 12px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
  padding: 12px;
  display: flex;
  flex-direction: column;
  pointer-events: none;
}

.totp-loading-main {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.totp-loading-avatar {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  flex-shrink: 0;
}

.totp-loading-info {
  flex: 1;
  min-width: 0;
}

.totp-loading-line {
  height: 9px;
  border-radius: 999px;
}

.totp-loading-line.name {
  width: 58%;
  height: 12px;
  margin-bottom: 7px;
}

.totp-loading-line.domain {
  width: 76%;
}

.totp-loading-actions {
  display: flex;
  overflow: hidden;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.totp-loading-action {
  width: 31px;
  height: 28px;
}

.totp-loading-code-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #e2e8f0;
}

.totp-loading-code {
  width: 112px;
  max-width: 60%;
  height: 18px;
  border-radius: 999px;
}

.totp-loading-timer {
  width: 28px;
  height: 28px;
  border-radius: 50%;
}

.totp-loading-shimmer {
  background: linear-gradient(90deg, #edf2f7 25%, #f8fafc 37%, #edf2f7 63%);
  background-size: 400% 100%;
  animation: totp-loading-shimmer 1.25s ease-in-out infinite;
}

@keyframes totp-loading-shimmer {
  0% { background-position: 100% 0; }
  100% { background-position: 0 0; }
}

.totp-card {
  border-radius: 12px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
  padding: 12px;
  display: flex;
  flex-direction: column;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.totp-card:hover {
  border-color: rgba(22, 119, 255, 0.3);
  box-shadow: 0 4px 12px rgba(22, 119, 255, 0.06), 0 1px 3px rgba(0, 0, 0, 0.02);
  transform: translateY(-1px);
}

.card-main {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.site-avatar {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-weight: 700;
  font-size: 16px;
  flex-shrink: 0;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

.site-icon-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: inherit;
}

.site-details {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}

.site-name {
  font-size: 13px;
  font-weight: 600;
  color: #0f172a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
  text-align: left;
}

.site-domain {
  font-size: 11px;
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
  text-align: left;
}

.site-domain.link-style {
  color: #1677ff;
  cursor: pointer;
}

.site-domain.link-style:hover {
  text-decoration: underline;
  color: #0050b3;
}

.card-actions {
  display: flex;
  gap: 0;
  border-radius: 6px;
  overflow: hidden;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.action-btn {
  padding: 6px 8px !important;
  height: 28px !important;
  border: none !important;
  background: transparent !important;
  color: #475569 !important;
  border-radius: 0 !important;
  margin: 0 !important;
  transition: all 0.15s ease;
}

.action-btn:hover {
  background: #f1f5f9 !important;
  color: #16a34a !important;
}

.text-danger {
  color: #ef4444;
}

.delete-menu-item:hover {
  background-color: #fef2f2 !important;
  color: #ef4444 !important;
}

.card-code-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #e2e8f0;
  font-size: 11px;
}

.code-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
}

.code-label {
  color: #94a3b8;
}

.code-value {
  font-size: 16px;
  font-weight: 700;
  color: #1677ff;
  font-family: 'Courier New', monospace;
  cursor: pointer;
  transition: color 0.15s ease;
}

.code-value:hover {
  color: #0050b3;
}

.code-value.loading {
  color: #94a3b8;
  opacity: 0.7;
  animation: pulse 1.5s ease-in-out infinite;
}

.code-value.error {
  color: #ef4444;
  opacity: 0.8;
}

@keyframes pulse {
  0%, 100% {
    opacity: 0.7;
  }
  50% {
    opacity: 1;
  }
}

.circular-timer {
  position: relative;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
}

.timer-svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.timer-bg {
  fill: none;
  stroke: #e0e0e0;
  stroke-width: 3;
}

.timer-progress {
  fill: none;
  stroke: #1677ff;
  stroke-width: 3;
  stroke-linecap: round;
  transition: stroke-dasharray 0.3s ease;
}

.timer-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 8px;
  font-weight: bold;
  color: #1677ff;
}

.card-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 4px;
  padding: 0;
}

.site-meta {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: #999;
}

.meta-item {
  white-space: nowrap;
}

.qr-upload {
  text-align: left;
  display: flex;
  align-items: center;
  gap: 8px;
}

.upload-content {
  padding: 20px;
  text-align: center;
}

.upload-icon {
  margin-bottom: 12px;
  opacity: 0.5;
}

.upload-text {
  font-size: 16px;
  margin-bottom: 8px;
}

.upload-hint {
  font-size: 12px;
  color: #999;
}

/* WebDav 对话框两列布局与辅助类 */
.webdav-form .grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 12px;
}
.webdav-dialog :deep(.el-dialog__body) {
  padding: 20px 24px;
}

.webdav-dialog :deep(.el-dialog__header) {
  padding: 20px 24px 0;
}

.webdav-dialog :deep(.el-dialog__footer) {
  padding: 0 24px 20px;
}

/* WebDav 对话框 用户名/密码 同行布局 */
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
.row-two .half :deep(.el-input) {
  width: 100%;
}
.webdav-form .span-2 {
  grid-column: 1 / span 2;
}
.webdav-form .hint {
  margin-top: 4px;
  font-size: 12px;
  color: #999;
}
.webdav-form .no-label :deep(.el-form-item__label) {
  display: none;
}

/* 统一保留份数的 el-input-number 与输入框高度 */
.webdav-dialog :deep(.el-form-item .el-input__wrapper),
.webdav-dialog :deep(.el-form-item .el-input-number .el-input__wrapper) {
  height: 32px !important;
  min-height: 32px !important;
}
.webdav-dialog :deep(.el-input-number) {
  width: 100%;
}
.webdav-dialog :deep(.el-input-number .el-input__wrapper) {
  height: 32px !important;
  min-height: 32px !important;
}
.webdav-dialog :deep(.el-input-number__decrease),
.webdav-dialog :deep(.el-input-number__increase) {
  height: 32px !important;
}
</style>
