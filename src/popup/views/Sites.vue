<template>
  <div class="sites-root" ref="sitesRootRef">
    <div class="overview">
      <div class="ov-card">
        <span class="icon-wrap green">
          <svg viewBox="0 0 24 24"><path :d="mdiUpload"/></svg>
        </span>
        <div class="text">
          <div class="num">{{ formatSize(totalUploaded) }}</div>
          <div class="label">总上传</div>
        </div>
      </div>
      <div class="ov-card">
        <span class="icon-wrap blue">
          <svg viewBox="0 0 24 24"><path :d="mdiDownload"/></svg>
        </span>
        <div class="text">
          <div class="num">{{ formatSize(totalDownloaded) }}</div>
          <div class="label">总下载</div>
        </div>
      </div>
      <div class="ov-card">
        <span class="icon-wrap orange">
          <svg viewBox="0 0 24 24"><path :d="mdiSeed"/></svg>
        </span>
        <div class="text">
          <div class="num">{{ totalSeedCount }}</div>
          <div class="label">总做种数</div>
        </div>
      </div>
      <div class="ov-card">
        <span class="icon-wrap red">
          <svg viewBox="0 0 24 24"><path :d="mdiDatabaseOutline"/></svg>
        </span>
        <div class="text">
          <div class="num">{{ formatSize(totalSeedingSize) }}</div>
          <div class="label">总做种体积</div>
        </div>
      </div>
    </div>

    <div class="toolbar">
      <div class="toolbar-row inputs">
        <el-input v-model="keyword" placeholder="搜索站点..." size="small" clearable class="full">
          <template #prefix>
            <svg viewBox="0 0 24 24" width="16" height="16" class="icon-prefix"><path :d="mdiMagnify" /></svg>
          </template>
        </el-input>
        <el-select v-model="sortKey" size="small" class="full">
          <el-option label="上传量排序" value="uploaded" />
          <el-option label="下载量排序" value="downloaded" />
          <el-option label="做种量排序" value="seeding" />
          <el-option label="耗时排序" value="seconds" />
        </el-select>
      </div>
      <div class="toolbar-row actions">
        <el-button class="compact" size="small" @click="refreshAll"><svg viewBox="0 0 24 24" width="14" height="14" class="icon-btn"><path :d="mdiRefresh"/></svg> 刷新</el-button>
        <el-dropdown @command="handleExportCommand" trigger="click">
          <el-button class="compact" size="small">
            <svg viewBox="0 0 24 24" width="14" height="14" class="icon-btn"><path :d="mdiExportVariant"/></svg> 导出
            <svg viewBox="0 0 24 24" width="12" height="12" class="ml-1" style="transform: rotate(90deg);"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" fill="currentColor"/></svg>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="image">导出为图片</el-dropdown-item>
              <el-dropdown-item command="json">导出为JSON</el-dropdown-item>
              <el-dropdown-item command="csv">导出为CSV</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button class="compact" size="small" type="primary" @click="onSyncClick"><svg viewBox="0 0 24 24" width="14" height="14" class="icon-btn"><path :d="mdiSync"/></svg> 同步</el-button>
        <el-button size="small" :type="privacyMode ? 'success' : 'default'" @click="togglePrivacyMode">
          <svg viewBox="0 0 24 24" width="14" height="14" class="icon-btn"><path :d="mdiShieldOutline"/></svg> 
          {{ privacyMode ? '关闭隐私' : '启用隐私' }}
        </el-button>
      </div>
    </div>

    <!-- 站点列表 -->
    <div class="grid">
      <div v-if="loading" class="site-cards">
        <div v-for="item in 3" :key="item" class="sites-loading-card">
          <div class="card-header">
            <div class="sites-loading-line sites-loading-time sites-loading-shimmer"></div>
          </div>

          <div class="status-indicators">
            <div class="sites-loading-status-icon sites-loading-shimmer"></div>
            <div class="sites-loading-label sites-loading-shimmer"></div>
            <div class="sites-loading-label short sites-loading-shimmer"></div>
          </div>

          <div class="site-info">
            <div class="sites-loading-logo sites-loading-shimmer"></div>
            <div class="site-details">
              <div class="sites-loading-line sites-loading-name sites-loading-shimmer"></div>
              <div class="user-info">
                <div class="sites-loading-pill sites-loading-shimmer"></div>
                <div class="sites-loading-line sites-loading-user sites-loading-shimmer"></div>
              </div>
            </div>
          </div>

          <div class="metrics-grid">
            <div v-for="metric in 4" :key="metric" class="metric-item">
              <div class="sites-loading-line sites-loading-metric-label sites-loading-shimmer"></div>
              <div class="sites-loading-line sites-loading-metric-value sites-loading-shimmer"></div>
            </div>
          </div>

          <div class="data-transfer">
            <div class="transfer-column upload">
              <div class="sites-loading-transfer-icon sites-loading-shimmer"></div>
              <div class="transfer-data">
                <div class="sites-loading-line sites-loading-transfer-line sites-loading-shimmer"></div>
                <div class="sites-loading-line sites-loading-transfer-line short sites-loading-shimmer"></div>
              </div>
            </div>
            <div class="transfer-divider"></div>
            <div class="transfer-column download">
              <div class="sites-loading-transfer-icon sites-loading-shimmer"></div>
              <div class="transfer-data">
                <div class="sites-loading-line sites-loading-transfer-line sites-loading-shimmer"></div>
                <div class="sites-loading-line sites-loading-transfer-line short sites-loading-shimmer"></div>
              </div>
            </div>
          </div>

          <div class="card-actions">
            <div class="sites-loading-button sites-loading-shimmer"></div>
            <div class="sites-loading-button secondary sites-loading-shimmer"></div>
          </div>
        </div>
      </div>

      <div v-else-if="filteredAndSorted.length === 0" class="empty-state">
        <svg viewBox="0 0 24 24" width="48" height="48" class="empty-icon"><path :d="mdiDatabaseOutline"/></svg>
        <p class="empty-text">暂无站点数据</p>
      </div>
      
      <div v-else class="site-cards">
        <div v-for="s in filteredAndSorted" :key="s.domain" class="site-card">
        <!-- 顶部状态栏 -->
        <div class="card-header">
          <div class="update-time">加入时间: {{ formatJoinDate(userJoinAt[s.domain]) }}</div>
        </div>
        
        <!-- 右上角状态指示器 -->
        <div class="status-indicators">
          <!-- 代理状态 -->
          <div v-if="getSiteProxy(s)" class="status-indicator proxy" title="启用代理">
            <svg viewBox="0 0 24 24" width="20" height="20" class="status-icon">
              <path :d="mdiNetworkOutline"/>
            </svg>
          </div>
          
          <!-- 浏览器模拟状态 -->
          <div v-if="getSiteRender(s)" class="status-indicator render" title="启用浏览器模拟">
            <svg viewBox="0 0 24 24" width="20" height="20" class="status-icon">
              <path :d="mdiAppleSafari"/>
            </svg>
          </div>
          
          <!-- 限制访问频率状态 -->
          <div v-if="getSiteLimitInterval(s)" class="status-indicator limit" title="限制站点访问频率">
            <svg viewBox="0 0 24 24" width="20" height="20" class="status-icon">
              <path :d="mdiSpeedometer"/>
            </svg>
          </div>
          
          <!-- 启用/停用状态 -->
          <div class="status-label" :class="getActiveStatusClass(s)" :title="getActiveStatusTitle(s)">
            {{ getActiveStatusText(s) }}
          </div>
          
          <!-- 连接状态 -->
          <div class="status-label" :class="getConnectionStatusClass(s)" :title="getConnectionStatusTitle(s)">
            {{ getConnectionStatusText(s) }}
          </div>
        </div>
        
        <!-- 站点信息区域 -->
        <div class="site-info">
          <div class="site-logo" :class="{ 'privacy-blur': privacyMode }">
            <img 
              v-if="typeof siteIcons[s.domain] === 'string' && siteIcons[s.domain].startsWith('data:')" 
              :src="siteIcons[s.domain]" 
              :alt="nameOf(s.domain)"
              class="site-icon"
              @error="handleIconError(s.domain)"
            />
            <img 
              v-else-if="typeof siteIcons[s.domain] === 'string' && (siteIcons[s.domain].startsWith('http') || siteIcons[s.domain].startsWith('chrome-extension://'))" 
              :src="siteIcons[s.domain]" 
              :alt="nameOf(s.domain)"
              class="site-icon"
              @error="handleIconError(s.domain)"
            />
            <div v-else class="logo-placeholder">{{ nameOf(s.domain).charAt(0) }}</div>
          </div>
          <div class="site-details">
            <div class="site-name" :class="{ 'privacy-blur': privacyMode }">{{ nameOf(s.domain) }}</div>
            <div class="user-info">
              <div class="user-level" v-if="userLevel[s.domain]" :class="{ 'privacy-blur': privacyMode }">{{ userLevel[s.domain] }}</div>
              <div class="username" v-if="username[s.domain]" :class="{ 'privacy-blur': privacyMode }">{{ username[s.domain] }}</div>
            </div>
          </div>
        </div>
        
        <!-- 关键指标区域 -->
        <div class="metrics-grid">
          <div class="metric-item seeding-size">
            <div class="metric-label">做种体积</div>
            <div class="metric-value">{{ formatSize(userSeedingSize[s.domain]) }}</div>
          </div>
          <div class="metric-item seeding-count">
            <div class="metric-label">做种数</div>
            <div class="metric-value">{{ userSeedingCount[s.domain] || 0 }}</div>
          </div>
          <div class="metric-item bonus">
            <div class="metric-label">魔力值</div>
            <div class="metric-value">{{ formatBonus(userBonus[s.domain]) }}</div>
          </div>
          <div class="metric-item ratio">
            <div class="metric-label">分享率</div>
            <div class="metric-value">{{ userRatio[s.domain] ? userRatio[s.domain].toFixed(2) : '0.00' }}</div>
          </div>
        </div>
        
        <!-- 数据传输区域 -->
        <div class="data-transfer">
          <div class="transfer-column upload">
            <div class="transfer-icon">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M12 4L12 20M8 8L12 4L16 8" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
              </svg>
            </div>
            <div class="transfer-data">
              <div class="transfer-item">
                <span class="transfer-label">今日:</span>
                <span class="transfer-value">{{ formatSize(userUploadedToday[s.domain]) }}</span>
              </div>
              <div class="transfer-item">
                <span class="transfer-label">总计:</span>
                <span class="transfer-value">{{ formatSize(userUploaded[s.domain]) }}</span>
              </div>
            </div>
          </div>
          <div class="transfer-divider"></div>
          <div class="transfer-column download">
            <div class="transfer-icon">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M12 20L12 4M8 16L12 20L16 16" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
              </svg>
            </div>
            <div class="transfer-data">
              <div class="transfer-item">
                <span class="transfer-label">今日:</span>
                <span class="transfer-value">{{ formatSize(userDownloadedToday[s.domain]) }}</span>
              </div>
              <div class="transfer-item">
                <span class="transfer-label">总计:</span>
                <span class="transfer-value">{{ formatSize(userDownloaded[s.domain]) }}</span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 操作按钮区域 -->
        <div class="card-actions">
          <button class="action-btn primary" @click="onSyncClick">
            <svg viewBox="0 0 24 24" width="16" height="16" class="btn-icon">
              <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
            </svg>
            同步数据
          </button>
          <button class="action-btn secondary" @click="openSite(s)" :title="`访问 ${nameOf(s.domain)}`">
            <svg viewBox="0 0 24 24" width="16" height="16" class="btn-icon">
              <path d="M10.59 13.41c.41.39.41 1.03 0 1.42-.39.39-1.03.39-1.42 0a5.003 5.003 0 0 1 0-7.07l3.54-3.54a5.003 5.003 0 0 1 7.07 0 5.003 5.003 0 0 1 0 7.07l-1.49 1.49c.01-.82-.12-1.64-.4-2.42l.47-.48a2.982 2.982 0 0 0 0-4.24 2.982 2.982 0 0 0-4.24 0l-3.53 3.53a2.982 2.982 0 0 0 0 4.24zm2.82-4.24c.39-.39 1.03-.39 1.42 0a5.003 5.003 0 0 1 0 7.07l-3.54 3.54a5.003 5.003 0 0 1-7.07 0 5.003 5.003 0 0 1 0-7.07l1.49-1.49c-.01.82.12 1.64.4 2.42l-.47.48a2.982 2.982 0 0 0 0 4.24 2.982 2.982 0 0 0 4.24 0l3.53-3.53a2.982 2.982 0 0 0 0-4.24z"/>
            </svg>
            访问站点
          </button>
        </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// ============================================================
// 站点数据仪表板视图
// 展示所有 PT 站点列表及状态（Cookie 状态、连接状态等）
// ============================================================
import { onMounted, ref, computed, watch } from 'vue';
import { mdiUpload, mdiDownload, mdiSeed, mdiDatabaseOutline, mdiMagnify, mdiRefresh, mdiExportVariant, mdiSync, mdiShieldOutline, mdiNetworkOutline, mdiAppleSafari, mdiSpeedometer } from '@mdi/js';
import { createMpApiClient } from '../../shared/api/client';
import { ElMessage } from 'element-plus';
import { ImageExporter } from '../../shared/utils/exportImage';
import { getSiteIcon } from '../../shared/data/siteIcons';
import { STORAGE_KEYS } from '../../shared/constants';

type SiteStat = {
  domain: string;
  seconds?: number;
  succ_rate?: number;
  lst_state?: number; // 0 ok, 1 failed
}

const items = ref<SiteStat[]>([]);
const sites = ref<any[]>([]);
const siteStats = ref<any[]>([]);
const sortedItems = ref<SiteStat[]>([]); // 预排序的站点列表

// 预计算的统计数据
const precomputedStats = ref({
  totalUploaded: 0,
  totalDownloaded: 0,
  totalSeedCount: 0,
  totalSeedingSize: 0
});

const mapping = ref<Record<string,string>>({});
const userUploaded = ref<Record<string, number>>({});
const userDownloaded = ref<Record<string, number>>({});
const userSeedingCount = ref<Record<string, number>>({});
const userSeedingSize = ref<Record<string, number>>({});
const userBonus = ref<Record<string, number>>({});
const userRatio = ref<Record<string, number>>({});
const userUploadedToday = ref<Record<string, number>>({});
const userDownloadedToday = ref<Record<string, number>>({});
const userJoinAt = ref<Record<string, string>>({});
const userLevel = ref<Record<string, string>>({});
const username = ref<Record<string, string>>({});
const siteIcons = ref<Record<string, string>>({});
const loading = ref(false);
const keyword = ref('');
const sortKey = ref<'uploaded'|'downloaded'|'seeding'|'seconds'>('uploaded');
const privacyMode = ref(false);
const sitesRootRef = ref<HTMLElement>();

async function getToken(): Promise<string | undefined> {
  const data = await chrome.storage.local.get([STORAGE_KEYS.TOKEN]);
  if (data[STORAGE_KEYS.TOKEN]) return data[STORAGE_KEYS.TOKEN] as string;
  try {
    const sd = await chrome.storage.sync.get([STORAGE_KEYS.TOKEN]);
    const t = sd[STORAGE_KEYS.TOKEN] as string | undefined;
    if (t) { await chrome.storage.local.set({ [STORAGE_KEYS.TOKEN]: t }); return t; }
  } catch {}
  return undefined;
}
async function getBaseUrl(): Promise<string> {
  const data = await chrome.storage.local.get([STORAGE_KEYS.BASE_URL]);
  if (data[STORAGE_KEYS.BASE_URL]) return data[STORAGE_KEYS.BASE_URL] as string;
  try {
    const sd = await chrome.storage.sync.get([STORAGE_KEYS.BASE_URL]);
    const u = sd[STORAGE_KEYS.BASE_URL] as string | undefined;
    if (u) { await chrome.storage.local.set({ [STORAGE_KEYS.BASE_URL]: u }); return u; }
  } catch {}
  return '';
}

// 启用状态
function getSiteActive(s: SiteStat): boolean {
  const site = sites.value.find(site => site.domain === s.domain);
  return site?.is_active !== false; // 默认为启用
}

// 代理状态
function getSiteProxy(s: SiteStat): boolean {
  const site = sites.value.find(site => site.domain === s.domain);
  return site?.proxy === 1;
}

// 浏览器模拟
function getSiteRender(s: SiteStat): boolean {
  const site = sites.value.find(site => site.domain === s.domain);
  return site?.render === 1;
}

// 访问频率限制
function getSiteLimitInterval(s: SiteStat): boolean {
  const site = sites.value.find(site => site.domain === s.domain);
  return site?.limit_interval && site.limit_interval > 0;
}

// 启用状态样式
function getActiveStatusClass(s: SiteStat): string {
  return getSiteActive(s) ? 'active' : 'inactive';
}

// 启用状态标题
function getActiveStatusTitle(s: SiteStat): string {
  return getSiteActive(s) ? '站点已启用' : '站点已停用';
}

// 启用状态文案
function getActiveStatusText(s: SiteStat): string {
  return getSiteActive(s) ? '启用' : '停用';
}

// 连接状态样式
function getConnectionStatusClass(s: SiteStat): string {
  const stats = siteStats.value.find(stat => stat.domain === s.domain);
  if (!stats) return 'connection-unknown';
  if (stats.lst_state === 1) return 'connection-failed';
  if (stats.seconds == null) return 'connection-unknown';
  if (stats.seconds >= 5) return 'connection-slow';
  return 'connection-normal';
}

// 连接状态标题
function getConnectionStatusTitle(s: SiteStat): string {
  const stats = siteStats.value.find(stat => stat.domain === s.domain);
  if (!stats) return '连接状态未知';
  if (stats.lst_state === 1) return '连接失败';
  if (stats.seconds == null) return '连接状态未知';
  if (stats.seconds >= 5) return '连接缓慢';
  return '连接正常';
}

// 连接状态文案
function getConnectionStatusText(s: SiteStat): string {
  const stats = siteStats.value.find(stat => stat.domain === s.domain);
  if (!stats) return '未知';
  if (stats.lst_state === 1) return '失败';
  if (stats.seconds == null) return '未知';
  if (stats.seconds >= 5) return '缓慢';
  return '正常';
}

function getNumber(obj: any, keys: string[], def = 0): number {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === 'number') return v;
    if (typeof v === 'string' && v !== '' && !isNaN(Number(v))) return Number(v);
  }
  return def;
}

function formatSize(bytes?: number): string {
  const n = bytes || 0;
  const KB = 1024, MB = KB*1024, GB = MB*1024, TB = GB*1024;
  if (n >= TB) return (n/TB).toFixed(2) + ' TB';
  if (n >= GB) return (n/GB).toFixed(2) + ' GB';
  if (n >= MB) return (n/MB).toFixed(2) + ' MB';
  if (n >= KB) return (n/KB).toFixed(2) + ' KB';
  return n.toFixed(0) + ' B';
}

function formatBonus(bonus?: number): string {
  const n = bonus || 0;
  if (n >= 1000000) return (n/1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n/1000).toFixed(1) + 'k';
  return n.toFixed(0);
}

function formatJoinDate(joinAt?: string): string {
  if (!joinAt) return '未知';
  try {
    const date = new Date(joinAt);
    if (isNaN(date.getTime())) return joinAt; // 无法解析时返回原始字符串
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  } catch {
    return joinAt; // 解析失败返回原始字符串
  }
}

// 使用预计算统计
const totalUploaded = computed(() => precomputedStats.value.totalUploaded);
const totalDownloaded = computed(() => precomputedStats.value.totalDownloaded);
const totalSeedCount = computed(() => precomputedStats.value.totalSeedCount);
const totalSeedingSize = computed(() => precomputedStats.value.totalSeedingSize);

const filteredAndSorted = computed(() => {
  // 加载中返回空
  if (loading.value) {
    return [];
  }
  
  const kw = keyword.value.trim().toLowerCase();
  
  // 优先使用预排序
  const sourceData = sortedItems.value.length > 0 ? sortedItems.value : items.value;
  
  // 关键词筛选
  const list = kw ? sourceData.filter(s => (nameOf(s.domain).toLowerCase().includes(kw) || s.domain.toLowerCase().includes(kw))) : sourceData;
  
  return list;
});

function nameOf(domain: string): string {
  return mapping.value[domain] || domain;
}

// 排序
function sortItems(items: SiteStat[], sortKey: string): SiteStat[] {
  const sorted = [...items];
  
  if (sortKey === 'seconds') {
    return sorted.sort((a, b) => (a.seconds || 0) - (b.seconds || 0));
  }
  if (sortKey === 'downloaded') {
    return sorted.sort((a, b) => (userDownloaded.value[b.domain] || 0) - (userDownloaded.value[a.domain] || 0));
  }
  if (sortKey === 'seeding') {
    return sorted.sort((a, b) => (userSeedingCount.value[b.domain] || 0) - (userSeedingCount.value[a.domain] || 0));
  }
  // 默认按上传量
  return sorted.sort((a, b) => (userUploaded.value[b.domain] || 0) - (userUploaded.value[a.domain] || 0));
}

async function openSite(s: SiteStat) {
  try {
    const siteUrl = `https://${s.domain}`;
    await chrome.tabs.create({
      url: siteUrl,
      active: true
    });
  } catch (error) {
    console.error('Failed to open site:', error);
    try {
      const siteUrl = `https://${s.domain}`;
      window.open(siteUrl, '_blank');
    } catch (fallbackError) {
      console.error('Fallback also failed:', fallbackError);
    }
  }
}

async function togglePrivacyMode() {
  privacyMode.value = !privacyMode.value;
  await savePrivacyModeState();
}

// 保存隐私模式状态
async function savePrivacyModeState() {
  try {
    await chrome.storage.local.set({
      'sites_privacy_mode': privacyMode.value
    });
  } catch (error) {
    console.error('保存隐私模式状态失败:', error);
  }
}

// 加载隐私模式状态
async function loadPrivacyModeState() {
  try {
    const result = await chrome.storage.local.get(['sites_privacy_mode']);
    privacyMode.value = (result as any)['sites_privacy_mode'] === true;
  } catch (error) {
    console.error('加载隐私模式状态失败:', error);
    privacyMode.value = false;
  }
}

// 同步按钮
function onSyncClick() {
  ElMessage.info('同步功能暂未适配...');
}

// 导出命令
function handleExportCommand(command: string) {
  if (command === 'json') {
    exportSitesAsJSON();
  } else if (command === 'csv') {
    exportSitesAsCSV();
  } else if (command === 'image') {
    exportSitesAsImage();
  }
}

// 导出JSON
async function exportSitesAsJSON() {
  try {
    if (loading.value) {
      console.warn('Data not ready for export');
      return;
    }

    // 组装导出数据
    const exportData = {
      exportInfo: {
        version: '1.0.0',
        exportTime: new Date().toISOString(),
        totalSites: items.value.length,
        description: 'MoviePilot站点数据导出'
      },
      sites: items.value.map(site => {
        const siteConfig = sites.value.find(s => s.domain === site.domain);
        return {
          // 基本信息
          id: siteConfig?.id,
          name: nameOf(site.domain),
          domain: site.domain,
          url: siteConfig?.url || `https://${site.domain}`,
          
          // 配置信息
          rss: siteConfig?.rss || '',
          downloader: siteConfig?.downloader || '',
          cookie: siteConfig?.cookie || '',
          apikey: siteConfig?.apikey || '',
          token: siteConfig?.token || '',
          ua: siteConfig?.ua || '',
          proxy: siteConfig?.proxy || 0,
          render: siteConfig?.render || 0,
          charset: siteConfig?.charset || '',
          limit_interval: siteConfig?.limit_interval || 0,
          limit_count: siteConfig?.limit_count || 0,
          limit_seconds: siteConfig?.limit_seconds || 0,
          is_active: siteConfig?.is_active !== false,
          pri: siteConfig?.pri || 0,
          
          // 统计
          statistics: {
            seconds: site.seconds,
            succ_rate: site.succ_rate,
            lst_state: site.lst_state
          },
          
          // 用户
          userData: {
            username: username.value[site.domain] || '',
            userLevel: userLevel.value[site.domain] || '',
            joinAt: userJoinAt.value[site.domain] || '',
            uploaded: userUploaded.value[site.domain] || 0,
            downloaded: userDownloaded.value[site.domain] || 0,
            uploadedToday: userUploadedToday.value[site.domain] || 0,
            downloadedToday: userDownloadedToday.value[site.domain] || 0,
            seedingCount: userSeedingCount.value[site.domain] || 0,
            seedingSize: userSeedingSize.value[site.domain] || 0,
            bonus: userBonus.value[site.domain] || 0,
            ratio: userRatio.value[site.domain] || 0
          }
        };
      })
    };

    // 生成文件
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
      type: 'application/json' 
    });

    // 触发下载
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `moviepilot_sites_export_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Export sites as JSON failed:', error);
  }
}

// 导出CSV
async function exportSitesAsCSV() {
  try {
    if (loading.value) {
      console.warn('Data not ready for export');
      return;
    }

    // 表头
    const headers = [
      '站点名称', '域名', 'URL', '用户名', '用户等级', '加入时间',
      '总上传量', '总下载量', '今日上传', '今日下载', '做种数', '做种体积',
      '魔力值', '分享率', '连接状态', '平均耗时', '成功率', '是否启用'
    ];

    // 数据
    const csvRows = [headers.join(',')];
    
    items.value.forEach(site => {
      const siteConfig = sites.value.find(s => s.domain === site.domain);
      const stats = siteStats.value.find(stat => stat.domain === site.domain);
      
      const row = [
        `"${nameOf(site.domain)}"`,
        `"${site.domain}"`,
        `"${siteConfig?.url || `https://${site.domain}`}"`,
        `"${username.value[site.domain] || ''}"`,
        `"${userLevel.value[site.domain] || ''}"`,
        `"${userJoinAt.value[site.domain] || ''}"`,
        `"${formatSize(userUploaded.value[site.domain])}"`,
        `"${formatSize(userDownloaded.value[site.domain])}"`,
        `"${formatSize(userUploadedToday.value[site.domain])}"`,
        `"${formatSize(userDownloadedToday.value[site.domain])}"`,
        userSeedingCount.value[site.domain] || 0,
        `"${formatSize(userSeedingSize.value[site.domain])}"`,
        `"${formatBonus(userBonus.value[site.domain])}"`,
        userRatio.value[site.domain] ? userRatio.value[site.domain].toFixed(2) : '0.00',
        `"${getConnectionStatusText(site)}"`,
        stats?.seconds ? stats.seconds.toFixed(2) : '',
        stats?.succ_rate ? (stats.succ_rate * 100).toFixed(1) + '%' : '',
        siteConfig?.is_active !== false ? '是' : '否'
      ];
      
      csvRows.push(row.join(','));
    });

    // 内容
    const csvContent = csvRows.join('\n');
    
    // BOM 以支持中文
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8' });

    // 触发下载
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `moviepilot_sites_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Export sites as CSV failed:', error);
  }
}

function handleIconError(domain: string) {
  // 图标加载失败：移除缓存，回退占位
  console.warn(`Icon failed to load for ${domain}, falling back to placeholder`);
  delete siteIcons.value[domain];
}

async function fetchStats() {
  try {
    const client = createMpApiClient({ baseURL: await getBaseUrl(), getToken });
    const resp = await client.get('/api/v1/site/statistic');
    const list = Array.isArray(resp.data) ? resp.data : [];
    siteStats.value = list;
  } catch (error) {
    console.error('Failed to fetch site statistics:', error);
    siteStats.value = [];
  }
}

async function fetchSites() {
  try {
    const client = createMpApiClient({ baseURL: await getBaseUrl(), getToken });
    const resp = await client.get('/api/v1/site/');
    const sitesList = Array.isArray(resp.data) ? resp.data : [];
    // 根据名称去重，保留首个
    const uniqueSites = sitesList.reduce((acc: any[], current: any) => {
      // 按显示名称比较
      const currentSiteName = nameOf(current.domain);
      const existingIndex = acc.findIndex(site => nameOf(site.domain) === currentSiteName);
      
      if (existingIndex === -1) {
        acc.push(current);
      } else {
        // 已存在则保留更完整项
        const existing = acc[existingIndex];
        if (current.name && !existing.name) {
          acc[existingIndex] = current;
        }
      }
      return acc;
    }, []);
    
    // 列表赋值
    items.value = uniqueSites;
    // 存储以供图标获取
    sites.value = uniqueSites;
    
    // 检查重复名称
    const nameCounts = uniqueSites.reduce((acc: Record<string, number>, site) => {
      const name = nameOf(site.domain);
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {});
    
    const nameDuplicates = Object.entries(nameCounts).filter(([name, count]) => count > 1);
    if (nameDuplicates.length > 0) {
      console.warn('Found duplicate site names after deduplication:', nameDuplicates);
    }
  } catch (error: any) {
    console.error('Failed to fetch sites:', error?.message || error);
  }
}

async function fetchUserData() {
  const client = createMpApiClient({ baseURL: await getBaseUrl(), getToken });
  try {
    const resp = await client.get('/api/v1/site/userdata/latest');
    const arr = Array.isArray(resp.data) ? resp.data : [];
    const up: Record<string, number> = {}; 
    const down: Record<string, number> = {}; 
    const seedingCount: Record<string, number> = {}; 
    const seedingSize: Record<string, number> = {};
    const bonus: Record<string, number> = {};
    const ratio: Record<string, number> = {};
    const upToday: Record<string, number> = {};
    const downToday: Record<string, number> = {};
    const joinAt: Record<string, string> = {};
    const level: Record<string, string> = {};
    const userName: Record<string, string> = {};
    
    for (const it of arr) {
      const d = it?.domain || it?.site || it?.name;
      if (!d) continue;
      
      // API 字段名
      up[d] = getNumber(it, ['upload']);
      down[d] = getNumber(it, ['download']);
      seedingCount[d] = getNumber(it, ['seeding']);
      seedingSize[d] = getNumber(it, ['seeding_size']);
      bonus[d] = getNumber(it, ['bonus']);
      ratio[d] = getNumber(it, ['ratio']);
      joinAt[d] = it?.join_at || '';
      level[d] = it?.user_level || '';
      userName[d] = it?.username || '';
      
      // 今日数据临时使用总计（应从历史计算）
      upToday[d] = up[d];
      downToday[d] = down[d];
    }
    
    userUploaded.value = up; 
    userDownloaded.value = down; 
    userSeedingCount.value = seedingCount; 
    userSeedingSize.value = seedingSize;
    userBonus.value = bonus;
    userRatio.value = ratio;
    userUploadedToday.value = upToday;
    userDownloadedToday.value = downToday;
    userJoinAt.value = joinAt;
    userLevel.value = level;
    username.value = userName;
    
    // 预计算汇总
    precomputedStats.value = {
      totalUploaded: Object.values(up).reduce((a, b) => a + (b || 0), 0),
      totalDownloaded: Object.values(down).reduce((a, b) => a + (b || 0), 0),
      totalSeedCount: Object.values(seedingCount).reduce((a, b) => a + (b || 0), 0),
      totalSeedingSize: Object.values(seedingSize).reduce((a, b) => a + (b || 0), 0)
    };
    
    // 数据就绪后排序
    sortedItems.value = sortItems(items.value, sortKey.value);
  } catch (error) {
    console.error('Failed to fetch user data:', error);
    // 失败也设置基础排序数据
    sortedItems.value = sortItems(items.value, sortKey.value);
  }
}

async function fetchMapping() {
  const client = createMpApiClient({ baseURL: await getBaseUrl(), getToken });
  try {
    const resp = await client.get('/api/v1/site/mapping');
    mapping.value = resp.data?.data || {};
  } catch { mapping.value = {}; }
}

// 站点图标（优先本地 Base64）
function getLocalSiteIcon(domain: string): string | null {
  try {
    const icon = getSiteIcon(domain);
    if (icon) {
      console.log(`Found local icon for ${domain}`);
      return icon;
    }
    console.log(`No local icon found for ${domain}`);
    return null;
  } catch (error) {
    console.debug(`Local icon check failed for ${domain}:`, error);
    return null;
  }
}

async function fetchSiteIcon(domain: string, siteId: number) {
  // 跳过无效域名
  if (!domain || domain === 'fsm.name' || !domain.includes('.')) {
    console.warn(`Skipping invalid domain: ${domain}`);
    return;
  }

  // 优先本地图标
  const localIcon = getLocalSiteIcon(domain);
  if (localIcon) {
    siteIcons.value[domain] = localIcon;
    return;
  }

  // 本地图标不存在则通过 API 获取
  console.log(`Local icon not found for ${domain}, fetching from API...`);
  const client = createMpApiClient({ baseURL: await getBaseUrl(), getToken });
  try {
    // 使用站点 ID 获取图标
    const iconResp = await client.get(`/api/v1/site/icon/${siteId}`);
    
    // 兼容多种响应格式
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
      siteIcons.value[domain] = iconData;
    } else {
      console.warn(`No valid string icon found for ${domain}, response format:`, iconResp.data);
    }
  } catch (error: any) {
    console.error(`Failed to fetch icon for ${domain}:`, error?.message || error);
  }
}

async function fetchAllSiteIcons() {
  if (!sites.value || sites.value.length === 0) {
    console.warn('No sites available to fetch icons');
    return;
  }
  
  const validSites = sites.value.filter(s => s.domain && s.domain.includes('.') && s.id);
  
  // 分批获取，避免并发过高
  const batchSize = 10;
  const batches = [];
  
  for (let i = 0; i < validSites.length; i += batchSize) {
    const batch = validSites.slice(i, i + batchSize);
    batches.push(batch);
  }
  
  // 逐批处理
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const promises = batch.map(site => fetchSiteIcon(site.domain, site.id));
    
    // 并行处理当前批次
    await Promise.all(promises);
    
    // 短暂延迟便于 UI 更新
    if (i < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}

async function refreshAll() {
  loading.value = true;
  
  try {
    // 并行获取基础数据
    await Promise.all([
      fetchMapping(),
      fetchSites()
    ]);
    
    // 并行获取详细数据与图标
    await Promise.all([
      fetchStats(),
      fetchUserData(),
      fetchAllSiteIcons()
    ]);
    
  } catch (error) {
    console.error('Failed to refresh data:', error);
  } finally {
    loading.value = false;
  }
}

// 导出为图片
async function exportSitesAsImage() {
  try {
    if (loading.value) {
      ElMessage.warning('数据尚未加载完成，请稍后再试');
      return;
    }

    if (!sitesRootRef.value) {
      ElMessage.error('无法获取页面内容');
      return;
    }

    // 显示加载状态
    const loadingMessage = ElMessage({
      message: '正在生成图片，请稍候...',
      type: 'info',
      duration: 0, // 不自动关闭
      showClose: false
    });

    const filename = ImageExporter.getDefaultFilename('sites');
    
    await ImageExporter.exportElement(sitesRootRef.value, {
      filename,
      quality: 0.9,
      privacyMode: privacyMode.value,
      blurSensitiveData: true
    });

    // 关闭加载消息
    loadingMessage.close();
    ElMessage.success('图片导出成功！');
  } catch (error) {
    console.error('Export sites as image failed:', error);
    ElMessage.error('图片导出失败，请重试');
  }
}

// 监听排序键变化，重新排序
watch(sortKey, (newSortKey) => {
  if (items.value.length > 0) {
    sortedItems.value = sortItems(items.value, newSortKey);
  }
});

onMounted(async () => {
  await loadPrivacyModeState();
  refreshAll();
});
</script>

<style scoped>
.sites-root { width: 100%; max-width: 100%; min-width: 0; padding: 8px; box-sizing: border-box; overflow-x: hidden; }
.overview { width: 100%; min-width: 0; display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap:6px; margin-bottom:6px; }
.ov-card { min-width: 0; box-sizing: border-box; display:flex; align-items:center; gap:8px; border:1px solid rgba(0,0,0,.06); background:#fff; border-radius:10px; padding:10px; box-shadow:0 2px 8px rgba(0,0,0,.04); }
.icon-wrap { width:32px; height:32px; border-radius:8px; display:inline-flex; align-items:center; justify-content:center; }
.icon-wrap svg { width:18px; height:18px; fill: currentColor; color:#fff; }
.icon-wrap.green { background:#22c55e; }
.icon-wrap.blue { background:#3b82f6; }
.icon-wrap.orange { background:#f59e0b; }
.icon-wrap.red { background:#ef4444; }
.ov-card .text .num { font-size:14px; font-weight:700; line-height:14px; }
.ov-card .text .label { font-size:12px; color:#8c8c8c; }
.toolbar { width: 100%; max-width: 100%; min-width: 0; overflow: hidden; display:flex; flex-direction: column; gap:6px; margin-bottom:6px; }
.toolbar-row.inputs { min-width: 0; display:grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap:6px; }
.toolbar-row.inputs .full { width: 100%; min-width: 0; }
.toolbar-row.actions { min-width: 0; display:grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap:2px; }
.toolbar-row.actions .compact :deep(.el-button__text){ white-space: nowrap; }
.toolbar-row.actions .compact { 
  min-width: 0;
  padding: 0 6px; 
}

.toolbar-row.actions .compact svg {
  fill: currentColor;
  color: inherit;
}

.toolbar-row.actions .compact :deep(.el-button) {
  color: inherit;
}

.toolbar-row.actions .compact :deep(.el-button svg) {
  fill: currentColor;
  color: inherit;
}

.toolbar-row.actions .compact .ml-1 {
  fill: currentColor;
  color: inherit;
}
.icon-prefix { opacity: .7; }
.icon-btn { 
  margin-right: 4px; 
  vertical-align: -2px; 
  fill: currentColor;
  color: inherit;
}
.debug-info { 
  text-align: center; 
  color: #666; 
  margin: 4px 0; 
  font-size: 12px; 
}
/* 站点卡片网格 */
.grid { 
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  overflow: hidden;
  display: grid; 
  grid-template-columns: minmax(0, 1fr); 
  gap: 12px; 
}

.site-cards {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

/* 站点卡片主体 */
.site-card {
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 16px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  transition: all 0.3s ease;
  position: relative;
}

.site-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  transform: translateY(-2px);
  z-index: 10;
}

.sites-loading-card {
  width: auto;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 16px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  position: relative;
  pointer-events: none;
  overflow: hidden;
}

.sites-loading-card .card-header {
  padding-right: 100px;
  min-width: 0;
}

.sites-loading-card .status-indicators {
  right: 8px;
  max-width: 94px;
  overflow: hidden;
}

.sites-loading-card .site-info,
.sites-loading-card .site-details,
.sites-loading-card .user-info,
.sites-loading-card .metrics-grid,
.sites-loading-card .metric-item,
.sites-loading-card .data-transfer,
.sites-loading-card .transfer-column,
.sites-loading-card .transfer-data,
.sites-loading-card .card-actions {
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
}

.sites-loading-shimmer {
  background: linear-gradient(90deg, #edf2f7 25%, #f8fafc 37%, #edf2f7 63%);
  background-size: 400% 100%;
  animation: sites-loading-shimmer 1.25s ease-in-out infinite;
}

.sites-loading-line {
  max-width: 100%;
  min-width: 0;
  height: 10px;
  border-radius: 999px;
}

.sites-loading-time {
  width: 42%;
}

.sites-loading-status-icon {
  width: 20px;
  min-width: 20px;
  height: 20px;
  border-radius: 4px;
}

.sites-loading-label {
  width: 36px;
  max-width: 36px;
  height: 18px;
  border-radius: 4px;
}

.sites-loading-label.short {
  width: 30px;
  max-width: 30px;
}

.sites-loading-logo {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  flex-shrink: 0;
}

.sites-loading-name {
  width: 52%;
  height: 16px;
  margin-bottom: 8px;
}

.sites-loading-pill {
  width: 46px;
  max-width: 46px;
  height: 18px;
  border-radius: 4px;
}

.sites-loading-user {
  width: 58px;
  max-width: calc(100% - 54px);
}

.sites-loading-metric-label {
  width: 44px;
  margin: 0 auto 6px;
}

.sites-loading-metric-value {
  width: 42px;
  height: 12px;
  margin: 0 auto;
}

.sites-loading-transfer-icon {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  flex-shrink: 0;
}

.sites-loading-transfer-line {
  width: 76%;
  max-width: 100%;
  margin-bottom: 7px;
}

.sites-loading-transfer-line.short {
  width: 68%;
  margin-bottom: 0;
}

.sites-loading-button {
  flex: 1;
  min-width: 0;
  height: 28px;
  border-radius: 6px;
}

.sites-loading-button.secondary {
  opacity: 0.78;
}

@media (max-width: 480px) {
  .sites-root {
    padding-left: 6px;
    padding-right: 6px;
  }

  .sites-loading-card {
    padding: 12px;
  }

  .sites-loading-card .card-header {
    padding-right: 88px;
  }

  .sites-loading-card .status-indicators {
    max-width: 82px;
  }

  .sites-loading-status-icon {
    width: 18px;
    min-width: 18px;
    height: 18px;
  }

  .sites-loading-label {
    width: 30px;
    max-width: 30px;
  }

  .sites-loading-label.short {
    width: 24px;
    max-width: 24px;
  }

  .sites-loading-logo {
    width: 36px;
    height: 36px;
  }

  .sites-loading-pill {
    width: 38px;
    max-width: 38px;
  }

  .sites-loading-user {
    width: 44px;
  }

  .sites-loading-metric-label {
    width: 34px;
  }

  .sites-loading-metric-value {
    width: 34px;
  }

  .data-transfer {
    padding: 10px 8px;
  }

  .transfer-divider {
    margin: 0 8px;
  }
}

@keyframes sites-loading-shimmer {
  0% { background-position: 100% 0; }
  100% { background-position: 0 0; }
}

/* 顶部状态栏 */
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid #f0f0f0;
  padding-right: 130px; /* 为状态指示器留出空间 */
}

.update-time {
  font-size: 12px;
  color: #666;
}


/* 站点信息区域 */
.site-info {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.site-logo {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  font-size: 18px;
}

.logo-placeholder {
  font-weight: bold;
}

.site-icon {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 8px;
}

.site-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: flex-start;
}

.site-name {
  font-size: 18px;
  font-weight: bold;
  color: #1f2937;
  margin-bottom: 6px;
}

.user-info {
  display: flex;
  flex-direction: row;
  gap: 8px;
  margin-bottom: 8px;
  align-items: center;
}

.user-level {
  font-size: 11px;
  font-weight: 600;
  color: #3b82f6;
  background: #eff6ff;
  padding: 2px 6px;
  border-radius: 4px;
  display: inline-block;
  width: fit-content;
  border: 1px solid #dbeafe;
}

.username {
  font-size: 11px;
  color: #6b7280;
  font-weight: 400;
}

.site-badges {
  display: flex;
  gap: 8px;
}

.badge {
  background: #22c55e;
  color: white;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
}

/* 关键指标网格 */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 16px;
}

.metric-item {
  text-align: center;
}

.metric-label {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 3px;
}

.metric-value {
  font-size: 13px;
  font-weight: bold;
  color: #1f2937;
}

.metric-value.highlight {
  color: #3b82f6;
}

/* 指标颜色主题 */
.metric-item.seeding-size .metric-label {
  color: #059669;
}

.metric-item.seeding-size .metric-value {
  color: #047857;
  font-weight: 700;
}

.metric-item.seeding-count .metric-label {
  color: #2563eb;
}

.metric-item.seeding-count .metric-value {
  color: #1d4ed8;
  font-weight: 700;
}

.metric-item.bonus .metric-label {
  color: #d97706;
}

.metric-item.bonus .metric-value {
  color: #b45309;
  font-weight: 700;
}

.metric-item.ratio .metric-label {
  color: #7c3aed;
}

.metric-item.ratio .metric-value {
  color: #6d28d9;
  font-weight: 700;
}

/* 数据传输区域 */
.data-transfer {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
  padding: 12px;
  background: #f8fafc;
  border-radius: 8px;
  min-width: 0; /* 防止flex子元素溢出 */
}

.transfer-column {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0; /* 防止flex子元素溢出 */
}

.transfer-column.upload .transfer-icon {
  color: #22c55e;
  background-color: #dcfce7;
}

.transfer-column.download .transfer-icon {
  color: #ef4444;
  background-color: #fee2e2;
}

.transfer-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0; /* 防止图标被压缩 */
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.transfer-icon svg {
  width: 16px;
  height: 16px;
}

.transfer-data {
  flex: 1;
  min-width: 0; /* 防止flex子元素溢出 */
}

.transfer-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
  gap: 8px; /* 添加间距防止文字重叠 */
}

.transfer-item:last-child {
  margin-bottom: 0;
}

.transfer-label {
  font-size: 10px;
  color: #6b7280;
  flex-shrink: 0; /* 防止标签被压缩 */
  white-space: nowrap; /* 防止标签换行 */
}

.transfer-value {
  font-size: 10px;
  font-weight: bold;
  color: #1f2937;
  text-align: right;
  white-space: nowrap; /* 防止数值换行 */
  overflow: hidden; /* 隐藏溢出内容 */
  text-overflow: ellipsis; /* 显示省略号 */
  max-width: 70%; /* 增加数值最大宽度 */
}

.transfer-divider {
  width: 1px;
  height: 32px;
  background: #e5e7eb;
  margin: 0 12px;
  flex-shrink: 0; /* 防止分隔符被压缩 */
}

/* 操作按钮区域 */
.card-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  flex: 1;
  padding: 6px 12px;
  border-radius: 6px;
  border: none;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 28px;
}

.action-btn.primary {
  background: #3b82f6;
  color: white;
  box-shadow: 0 1px 3px rgba(59, 130, 246, 0.3);
}

.action-btn.primary:hover {
  background: #2563eb;
  box-shadow: 0 2px 6px rgba(59, 130, 246, 0.4);
  transform: translateY(-1px);
}

.action-btn.secondary {
  background: white;
  color: #6b7280;
  border: 1px solid #e5e7eb;
}

.action-btn.secondary:hover {
  background: #f9fafb;
  border-color: #d1d5db;
  color: #374151;
}

.btn-icon {
  width: 16px;
  height: 16px;
  fill: currentColor;
}

/* 状态指示器样式 */
.status-indicators {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  gap: 3px;
  z-index: 10;
  align-items: center;
  flex-wrap: nowrap;
  max-width: 110px;
  justify-content: flex-end;
}

.status-indicator {
  width: 20px;
  height: 20px;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.status-label {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  display: inline-block;
  width: fit-content;
  transition: all 0.2s ease;
  white-space: nowrap;
  flex-shrink: 0;
  border: 1px solid;
}

.status-icon {
  width: 12px;
  height: 12px;
  fill: currentColor;
}

/* 启用/停用状态 */
.status-label.active {
  color: #22c55e;
  background: #dcfce7;
  border-color: #bbf7d0;
}

.status-label.inactive {
  color: #9ca3af;
  background: #f3f4f6;
  border-color: #e5e7eb;
}

/* 代理状态 */
.status-indicator.proxy {
  color: #3b82f6;
  background: transparent;
  border: none;
  padding: 0;
  width: 20px;
  height: 20px;
}

.status-indicator.proxy:hover {
  color: #2563eb;
  transform: scale(1.1);
}

/* 浏览器模拟状态 */
.status-indicator.render {
  color: #f59e0b;
  background: transparent;
  border: none;
  padding: 0;
  width: 20px;
  height: 20px;
}

.status-indicator.render:hover {
  color: #d97706;
  transform: scale(1.1);
}

/* 限制访问频率状态 */
.status-indicator.limit {
  color: #8b5cf6;
  background: transparent;
  border: none;
  padding: 0;
  width: 20px;
  height: 20px;
}

.status-indicator.limit:hover {
  color: #7c3aed;
  transform: scale(1.1);
}

/* 连接状态 */
.status-label.connection-normal {
  color: #22c55e;
  background: #dcfce7;
  border-color: #bbf7d0;
}

.status-label.connection-slow {
  color: #f59e0b;
  background: #fef3c7;
  border-color: #fde68a;
}

.status-label.connection-failed {
  color: #ef4444;
  background: #fee2e2;
  border-color: #fecaca;
}

.status-label.connection-unknown {
  color: #9ca3af;
  background: #f3f4f6;
  border-color: #e5e7eb;
}

/* 悬停效果 */
.status-indicator:hover {
  transform: scale(1.05);
}

.status-label:hover {
  transform: scale(1.05);
  opacity: 0.9;
}

/* 隐私模式模糊效果 */
.privacy-blur {
  filter: blur(4px);
  transition: filter 0.3s ease;
  user-select: none; /* 防止文本选择 */
  -webkit-user-select: none; /* Safari 兼容 */
  -moz-user-select: none; /* Firefox 兼容 */
  -ms-user-select: none; /* IE/Edge 兼容 */
}

/* 空状态样式 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 16px;
  text-align: center;
}

.empty-icon {
  color: #9ca3af;
  margin-bottom: 16px;
  fill: currentColor;
}

.empty-text {
  color: #6b7280;
  margin: 0 0 16px 0;
  font-size: 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>

