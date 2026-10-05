<template>
  <div class="sites-root" ref="sitesRootRef">
    <div class="overview">
      <div class="ov-card">
        <span class="icon-wrap green">
          <svg viewBox="0 0 24 24"><path :d="mdiUpload" /></svg>
        </span>
        <div class="text">
          <div class="num">{{ formatSize(totalUploaded) }}</div>
          <div class="label">总上传</div>
        </div>
      </div>
      <div class="ov-card">
        <span class="icon-wrap blue">
          <svg viewBox="0 0 24 24"><path :d="mdiDownload" /></svg>
        </span>
        <div class="text">
          <div class="num">{{ formatSize(totalDownloaded) }}</div>
          <div class="label">总下载</div>
        </div>
      </div>
      <div class="ov-card">
        <span class="icon-wrap orange">
          <svg viewBox="0 0 24 24"><path :d="mdiSeed" /></svg>
        </span>
        <div class="text">
          <div class="num">{{ totalSeedCount }}</div>
          <div class="label">总做种数</div>
        </div>
      </div>
      <div class="ov-card">
        <span class="icon-wrap red">
          <svg viewBox="0 0 24 24"><path :d="mdiDatabaseOutline" /></svg>
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
            <svg viewBox="0 0 24 24" width="16" height="16" class="icon-prefix">
              <path :d="mdiMagnify" />
            </svg>
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
        <div class="action-group">
          <el-button class="compact" size="small" :disabled="loading" @click="refreshAll">
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              class="icon-btn"
              :class="{ 'icon-spin': loading }"
            >
              <path :d="mdiRefresh" />
            </svg>
            刷新
          </el-button>
          <el-dropdown trigger="click" @command="handleExportCommand">
            <el-button class="compact" size="small">
              <svg viewBox="0 0 24 24" width="14" height="14" class="icon-btn"><path :d="mdiExportVariant" /></svg>
              导出
              <svg viewBox="0 0 24 24" width="12" height="12" class="ml-1 chevron">
                <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" fill="currentColor" />
              </svg>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="image">导出为图片</el-dropdown-item>
                <el-dropdown-item command="json">导出为JSON</el-dropdown-item>
                <el-dropdown-item command="csv">导出为CSV</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
        <div class="action-group">
          <el-button
            class="compact"
            size="small"
            type="primary"
            :disabled="syncing"
            @click="onSyncClick()"
          >
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              class="icon-btn"
              :class="{ 'icon-spin': syncing }"
            >
              <path :d="mdiSync" />
            </svg>
            <span v-if="syncing" class="sync-count">
              {{ syncProgress.finished }}/{{ syncProgress.total }}
            </span>
            <span v-else>同步</span>
          </el-button>
          <el-button
            class="compact"
            size="small"
            :type="privacyMode ? 'success' : 'default'"
            @click="togglePrivacyMode"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" class="icon-btn"><path :d="mdiShieldOutline" /></svg>
            {{ privacyMode ? '关闭隐私' : '启用隐私' }}
          </el-button>
        </div>
      </div>
    </div>

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
        <svg viewBox="0 0 24 24" width="48" height="48" class="empty-icon">
          <path :d="mdiDatabaseOutline" />
        </svg>
        <p class="empty-text">{{ error || '暂无站点数据' }}</p>
        <el-button v-if="error" type="primary" size="small" @click="refreshAll">重试</el-button>
      </div>

      <div v-else class="site-cards">
        <div v-for="s in filteredAndSorted" :key="s.domain" class="site-card">
          <div class="card-header">
            <div class="update-time">加入时间: {{ formatJoinDate(userJoinAt[s.domain]) }}</div>
          </div>

          <div class="status-indicators">
            <div v-if="getSiteProxy(s)" class="status-indicator proxy" title="启用代理">
              <svg viewBox="0 0 24 24" width="20" height="20" class="status-icon">
                <path :d="mdiNetworkOutline" />
              </svg>
            </div>
            <div v-if="getSiteRender(s)" class="status-indicator render" title="启用浏览器模拟">
              <svg viewBox="0 0 24 24" width="20" height="20" class="status-icon">
                <path :d="mdiAppleSafari" />
              </svg>
            </div>
            <div v-if="getSiteLimitInterval(s)" class="status-indicator limit" title="限制站点访问频率">
              <svg viewBox="0 0 24 24" width="20" height="20" class="status-icon">
                <path :d="mdiSpeedometer" />
              </svg>
            </div>
            <div class="status-label" :class="getActiveStatusClass(s)" :title="getActiveStatusTitle(s)">
              {{ getActiveStatusText(s) }}
            </div>
            <div
              class="status-label"
              :class="getConnectionStatusClass(s)"
              :title="getConnectionStatusTitle(s)"
            >
              {{ getConnectionStatusText(s) }}
            </div>
          </div>

          <div class="site-info">
            <div class="site-logo" :class="{ 'privacy-blur': privacyMode }">
              <img
                v-if="isIconUrl(siteIcons[s.domain])"
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
                <div
                  v-if="userLevel[s.domain]"
                  class="user-level"
                  :class="{ 'privacy-blur': privacyMode }"
                >
                  {{ userLevel[s.domain] }}
                </div>
                <div
                  v-if="username[s.domain]"
                  class="username"
                  :class="{ 'privacy-blur': privacyMode }"
                >
                  {{ username[s.domain] }}
                </div>
              </div>
            </div>
          </div>

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
              <div class="metric-value">
                {{ userRatio[s.domain] != null ? Number(userRatio[s.domain]).toFixed(2) : '0.00' }}
              </div>
            </div>
          </div>

          <div class="data-transfer">
            <div class="transfer-column upload">
              <div class="transfer-icon">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path
                    d="M12 4L12 20M8 8L12 4L16 8"
                    stroke="currentColor"
                    stroke-width="3"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    fill="none"
                  />
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
                  <path
                    d="M12 20L12 4M8 16L12 20L16 16"
                    stroke="currentColor"
                    stroke-width="3"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    fill="none"
                  />
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

          <div class="card-actions">
            <button
              type="button"
              class="action-btn primary"
              :disabled="syncing"
              @click="onSyncClick(s)"
            >
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                class="btn-icon"
                :class="{ 'icon-spin': syncingDomain === s.domain }"
              >
                <path
                  d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"
                />
              </svg>
              {{ syncingDomain === s.domain ? '同步中' : '同步数据' }}
            </button>
            <button
              type="button"
              class="action-btn secondary"
              :title="`访问 ${nameOf(s.domain)}`"
              @click="openSite(s)"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" class="btn-icon">
                <path
                  d="M10.59 13.41c.41.39.41 1.03 0 1.42-.39.39-1.03.39-1.42 0a5.003 5.003 0 0 1 0-7.07l3.54-3.54a5.003 5.003 0 0 1 7.07 0 5.003 5.003 0 0 1 0 7.07l-1.49 1.49c.01-.82-.12-1.64-.4-2.42l.47-.48a2.982 2.982 0 0 0 0-4.24 2.982 2.982 0 0 0-4.24 0l-3.53 3.53a2.982 2.982 0 0 0 0 4.24zm2.82-4.24c.39-.39 1.03-.39 1.42 0a5.003 5.003 0 0 1 0 7.07l-3.54 3.54a5.003 5.003 0 0 1-7.07 0 5.003 5.003 0 0 1 0-7.07l1.49-1.49c-.01.82.12 1.64.4 2.42l-.47.48a2.982 2.982 0 0 0 0 4.24 2.982 2.982 0 0 0 4.24 0l3.53-3.53a2.982 2.982 0 0 0 0-4.24z"
                />
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
// 站点数据仪表板由概览、工具栏和站点卡片组成。
import { onMounted, ref, computed, watch } from 'vue'
import {
  mdiUpload,
  mdiDownload,
  mdiSeed,
  mdiDatabaseOutline,
  mdiMagnify,
  mdiRefresh,
  mdiExportVariant,
  mdiSync,
  mdiShieldOutline,
  mdiNetworkOutline,
  mdiAppleSafari,
  mdiSpeedometer,
} from '@mdi/js'
import { fetchSites } from '../services/site-manage'
import {
  fetchConnectionStats,
  fetchUserDataLatest,
  refreshSiteUserData,
} from '../services/site-stat'
import { resolveSiteIconsBatch, isIconUrl } from '../services/site-icon'
import type { Site, SiteConnectionStat } from '../core/types'
import { STORAGE_KEYS, storageGet, storageSet } from '../core/storage'
import { formatSize, formatBonus, formatDate } from '../utils/format'
import { ElMessage } from '../utils/ui'
import { exportElementAsImage, getDefaultImageFilename } from '../utils/export-image'

type SiteStat = {
  domain: string
  seconds?: number
  succ_rate?: number
  lst_state?: number
  id?: number
  name?: string
  url?: string
}

const items = ref<SiteStat[]>([])
const sites = ref<Site[]>([])
const siteStats = ref<SiteConnectionStat[]>([])
const sortedItems = ref<SiteStat[]>([])

const precomputedStats = ref({
  totalUploaded: 0,
  totalDownloaded: 0,
  totalSeedCount: 0,
  totalSeedingSize: 0,
})

const mapping = ref<Record<string, string>>({})
const userUploaded = ref<Record<string, number>>({})
const userDownloaded = ref<Record<string, number>>({})
const userSeedingCount = ref<Record<string, number>>({})
const userSeedingSize = ref<Record<string, number>>({})
const userBonus = ref<Record<string, number>>({})
const userRatio = ref<Record<string, number>>({})
const userUploadedToday = ref<Record<string, number>>({})
const userDownloadedToday = ref<Record<string, number>>({})
const userJoinAt = ref<Record<string, string>>({})
const userLevel = ref<Record<string, string>>({})
const username = ref<Record<string, string>>({})
const siteIcons = ref<Record<string, string>>({})
const loading = ref(false)
const syncing = ref(false)
const syncingDomain = ref('')
const syncProgress = ref({ finished: 0, total: 0 })
const error = ref('')
const keyword = ref('')
const sortKey = ref<'uploaded' | 'downloaded' | 'seeding' | 'seconds'>('uploaded')
const privacyMode = ref(false)
const sitesRootRef = ref<HTMLElement>()

function getNumber(obj: Record<string, unknown> | null | undefined, keys: string[], def = 0): number {
  if (!obj) return def
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === 'number' && !Number.isNaN(v)) return v
    if (typeof v === 'string' && v !== '' && !Number.isNaN(Number(v))) return Number(v)
  }
  return def
}

function findSite(domain: string): Site | undefined {
  return sites.value.find((s) => s.domain === domain)
}

function getSiteActive(s: SiteStat): boolean {
  return findSite(s.domain)?.is_active !== false
}

function getSiteProxy(s: SiteStat): boolean {
  const site = findSite(s.domain) as Site & { proxy?: number }
  if (!site) return false
  return !!(site.is_proxy || site.proxy === 1)
}

function getSiteRender(s: SiteStat): boolean {
  const site = findSite(s.domain) as Site & { render?: number }
  if (!site) return false
  return !!(site.is_browser_simulated || site.render === 1)
}

function getSiteLimitInterval(s: SiteStat): boolean {
  const site = findSite(s.domain)
  return !!(site?.limit_interval && site.limit_interval > 0)
}

function getActiveStatusClass(s: SiteStat): string {
  return getSiteActive(s) ? 'active' : 'inactive'
}
function getActiveStatusTitle(s: SiteStat): string {
  return getSiteActive(s) ? '站点已启用' : '站点已停用'
}
function getActiveStatusText(s: SiteStat): string {
  return getSiteActive(s) ? '启用' : '停用'
}

function getConnStat(s: SiteStat): SiteConnectionStat | undefined {
  return siteStats.value.find((stat) => stat.domain === s.domain)
}

function getConnectionStatusClass(s: SiteStat): string {
  const stats = getConnStat(s)
  if (!stats) return 'connection-unknown'
  if (stats.lst_state === 1) return 'connection-failed'
  if (stats.seconds == null) return 'connection-unknown'
  if (stats.seconds >= 5) return 'connection-slow'
  return 'connection-normal'
}
function getConnectionStatusTitle(s: SiteStat): string {
  const stats = getConnStat(s)
  if (!stats) return '连接状态未知'
  if (stats.lst_state === 1) return '连接失败'
  if (stats.seconds == null) return '连接状态未知'
  if (stats.seconds >= 5) return '连接缓慢'
  return '连接正常'
}
function getConnectionStatusText(s: SiteStat): string {
  const stats = getConnStat(s)
  if (!stats) return '未知'
  if (stats.lst_state === 1) return '失败'
  if (stats.seconds == null) return '未知'
  if (stats.seconds >= 5) return '缓慢'
  return '正常'
}

function formatJoinDate(joinAt?: string): string {
  return formatDate(joinAt)
}

const totalUploaded = computed(() => precomputedStats.value.totalUploaded)
const totalDownloaded = computed(() => precomputedStats.value.totalDownloaded)
const totalSeedCount = computed(() => precomputedStats.value.totalSeedCount)
const totalSeedingSize = computed(() => precomputedStats.value.totalSeedingSize)

const filteredAndSorted = computed(() => {
  if (loading.value) return []
  const kw = keyword.value.trim().toLowerCase()
  const source = sortedItems.value.length > 0 ? sortedItems.value : items.value
  if (!kw) return source
  return source.filter(
    (s) => nameOf(s.domain).toLowerCase().includes(kw) || s.domain.toLowerCase().includes(kw),
  )
})

function nameOf(domain: string): string {
  const site = findSite(domain)
  return mapping.value[domain] || site?.name || domain
}

function sortItems(list: SiteStat[], key: string): SiteStat[] {
  const sorted = [...list]
  if (key === 'seconds') {
    return sorted.sort((a, b) => (a.seconds || 0) - (b.seconds || 0))
  }
  if (key === 'downloaded') {
    return sorted.sort(
      (a, b) => (userDownloaded.value[b.domain] || 0) - (userDownloaded.value[a.domain] || 0),
    )
  }
  if (key === 'seeding') {
    return sorted.sort(
      (a, b) => (userSeedingCount.value[b.domain] || 0) - (userSeedingCount.value[a.domain] || 0),
    )
  }
  return sorted.sort(
    (a, b) => (userUploaded.value[b.domain] || 0) - (userUploaded.value[a.domain] || 0),
  )
}

async function openSite(s: SiteStat) {
  const site = findSite(s.domain)
  const siteUrl = site?.url || `https://${s.domain}`
  try {
    await chrome.tabs.create({ url: siteUrl, active: true })
  } catch {
    try {
      window.open(siteUrl, '_blank')
    } catch {
      /* 浏览器标签页与窗口打开方式均失败时不阻断页面操作。 */
    }
  }
}

async function togglePrivacyMode() {
  privacyMode.value = !privacyMode.value
  await storageSet(STORAGE_KEYS.SITE_PRIVACY_MODE, privacyMode.value)
}

async function loadPrivacyModeState() {
  privacyMode.value = (await storageGet<boolean>(STORAGE_KEYS.SITE_PRIVACY_MODE)) === true
}

async function onSyncClick(target?: SiteStat): Promise<void> {
  if (syncing.value) return

  const targetSite = target ? findSite(target.domain) : undefined
  const syncSites = targetSite
    ? [targetSite]
    : sites.value.filter((site) => site.id > 0 && site.is_active !== false)
  if (!syncSites.length) {
    ElMessage.warning(target ? '未找到对应的站点配置' : '没有可同步的已启用站点')
    return
  }

  syncing.value = true
  syncingDomain.value = targetSite?.domain || ''
  syncProgress.value = { finished: 0, total: syncSites.length }
  let succeeded = 0
  const failures: string[] = []

  try {
    // 顺序刷新站点数据，避免同时访问大量 PT 站点。
    for (const site of syncSites) {
      if (!targetSite) syncingDomain.value = site.domain
      const result = await refreshSiteUserData(site.id)
      if (result.success) succeeded += 1
      else failures.push(`${site.name || site.domain}：${result.message}`)
      syncProgress.value = {
        finished: syncProgress.value.finished + 1,
        total: syncSites.length,
      }
    }

    await Promise.all([loadUserData(), loadConnectionStats()])
    sortedItems.value = sortItems(items.value, sortKey.value)

    if (!failures.length) {
      ElMessage.success(targetSite ? `${targetSite.name || targetSite.domain} 同步成功` : `同步完成，共 ${succeeded} 个站点`)
    } else if (succeeded > 0) {
      ElMessage.warning(`同步完成：成功 ${succeeded} 个，失败 ${failures.length} 个`)
    } else {
      ElMessage.error(failures[0] || '站点数据同步失败')
    }
  } finally {
    syncing.value = false
    syncingDomain.value = ''
    syncProgress.value = { finished: 0, total: 0 }
  }
}

function handleExportCommand(command: string) {
  if (command === 'json') void exportSitesAsJSON()
  else if (command === 'csv') void exportSitesAsCSV()
  else if (command === 'image') void exportSitesAsImage()
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

async function exportSitesAsJSON() {
  if (loading.value) {
    ElMessage.warning('数据尚未加载完成，请稍后再试')
    return
  }
  try {
    const exportData = {
      exportInfo: {
        version: '2.0.0',
        exportTime: new Date().toISOString(),
        totalSites: items.value.length,
        description: 'MoviePilot站点数据导出',
      },
      sites: items.value.map((site) => {
        const siteConfig = findSite(site.domain)
        return {
          id: siteConfig?.id,
          name: nameOf(site.domain),
          domain: site.domain,
          url: siteConfig?.url || `https://${site.domain}`,
          rss: siteConfig?.rss || '',
          downloader: siteConfig?.downloader || '',
          is_active: siteConfig?.is_active !== false,
          pri: siteConfig?.pri || 0,
          statistics: {
            seconds: site.seconds,
            succ_rate: site.succ_rate,
            lst_state: site.lst_state,
          },
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
            ratio: userRatio.value[site.domain] || 0,
          },
        }
      }),
    }
    downloadBlob(
      new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' }),
      `moviepilot_sites_export_${new Date().toISOString().split('T')[0]}.json`,
    )
    ElMessage.success('JSON 导出成功')
  } catch (e) {
    console.error(e)
    ElMessage.error('JSON 导出失败')
  }
}

async function exportSitesAsCSV() {
  if (loading.value) {
    ElMessage.warning('数据尚未加载完成，请稍后再试')
    return
  }
  try {
    const headers = [
      '站点名称',
      '域名',
      'URL',
      '用户名',
      '用户等级',
      '加入时间',
      '总上传量',
      '总下载量',
      '今日上传',
      '今日下载',
      '做种数',
      '做种体积',
      '魔力值',
      '分享率',
      '连接状态',
      '平均耗时',
      '成功率',
      '是否启用',
    ]
    const csvRows = [headers.join(',')]
    for (const site of items.value) {
      const siteConfig = findSite(site.domain)
      const stats = getConnStat(site)
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
        userRatio.value[site.domain] != null ? Number(userRatio.value[site.domain]).toFixed(2) : '0.00',
        `"${getConnectionStatusText(site)}"`,
        stats?.seconds != null ? stats.seconds.toFixed(2) : '',
        stats?.succ_rate != null ? (stats.succ_rate * 100).toFixed(1) + '%' : '',
        siteConfig?.is_active !== false ? '是' : '否',
      ]
      csvRows.push(row.join(','))
    }
    const BOM = '\uFEFF'
    downloadBlob(
      new Blob([BOM + csvRows.join('\n')], { type: 'text/csv;charset=utf-8' }),
      `moviepilot_sites_export_${new Date().toISOString().split('T')[0]}.csv`,
    )
    ElMessage.success('CSV 导出成功')
  } catch (e) {
    console.error(e)
    ElMessage.error('CSV 导出失败')
  }
}

async function exportSitesAsImage() {
  if (loading.value) {
    ElMessage.warning('数据尚未加载完成，请稍后再试')
    return
  }
  if (!sitesRootRef.value) {
    ElMessage.error('无法获取页面内容')
    return
  }
  const loadingMessage = ElMessage({
    message: '正在生成图片，请稍候...',
    type: 'info',
    duration: 0,
  })
  try {
    await exportElementAsImage(sitesRootRef.value, {
      filename: getDefaultImageFilename('sites'),
      quality: 0.9,
      privacyMode: privacyMode.value,
      blurSensitiveData: true,
      title: 'MoviePilot 站点数据',
      footerSuffix: '导出自 MoviePilot Tools',
    })
    ElMessage.success('图片导出成功')
  } catch (e) {
    console.error(e)
    ElMessage.error((e as Error)?.message || '图片导出失败，请重试')
  } finally {
    loadingMessage.close()
  }
}

function handleIconError(domain: string) {
  delete siteIcons.value[domain]
}

async function loadSitesList() {
  const rawList = await fetchSites()
  const list = Array.isArray(rawList) ? rawList : []
  mapping.value = Object.fromEntries(
    list.filter((site) => site && site.domain && site.name).map((site) => [site.domain, site.name]),
  )
  // 按显示名去重，保留首个
  const unique = list.reduce((acc: Site[], current: Site) => {
    const currentName = mapping.value[current.domain] || current.name || current.domain
    const existingIndex = acc.findIndex((site) => {
      const n = mapping.value[site.domain] || site.name || site.domain
      return n === currentName
    })
    if (existingIndex === -1) acc.push(current)
    else if (current.name && !acc[existingIndex].name) acc[existingIndex] = current
    return acc
  }, [])

  sites.value = unique
  items.value = unique.map((s) => ({
    domain: s.domain,
    id: s.id,
    name: s.name,
    url: s.url,
    seconds: undefined,
    succ_rate: undefined,
    lst_state: undefined,
  }))
}

async function loadConnectionStats() {
  const list = await fetchConnectionStats()
  siteStats.value = list
  // 合并连接耗时到 items
  const map = new Map(list.map((x) => [x.domain, x]))
  items.value = items.value.map((it) => {
    const st = map.get(it.domain)
    if (!st) return it
    return {
      ...it,
      seconds: st.seconds,
      succ_rate: st.succ_rate,
      lst_state: st.lst_state,
    }
  })
}

async function loadUserData() {
  try {
    const arr = await fetchUserDataLatest()
    const up: Record<string, number> = {}
    const down: Record<string, number> = {}
    const seedingCount: Record<string, number> = {}
    const seedingSize: Record<string, number> = {}
    const bonus: Record<string, number> = {}
    const ratio: Record<string, number> = {}
    const upToday: Record<string, number> = {}
    const downToday: Record<string, number> = {}
    const joinAt: Record<string, string> = {}
    const level: Record<string, string> = {}
    const userName: Record<string, string> = {}

    for (const raw of arr) {
      const it = raw as unknown as Record<string, unknown>
      const d = String(it?.domain || it?.site || it?.name || '')
      if (!d) continue
      up[d] = getNumber(it, ['upload'])
      down[d] = getNumber(it, ['download'])
      seedingCount[d] = getNumber(it, ['seeding'])
      seedingSize[d] = getNumber(it, ['seeding_size'])
      bonus[d] = getNumber(it, ['bonus'])
      ratio[d] = getNumber(it, ['ratio'])
      joinAt[d] = String(it?.join_at || '')
      level[d] = String(it?.user_level || '')
      userName[d] = String(it?.username || '')
      // 后端未提供今日分项时，今日数据暂时显示总计。
      upToday[d] = up[d]
      downToday[d] = down[d]
    }

    userUploaded.value = up
    userDownloaded.value = down
    userSeedingCount.value = seedingCount
    userSeedingSize.value = seedingSize
    userBonus.value = bonus
    userRatio.value = ratio
    userUploadedToday.value = upToday
    userDownloadedToday.value = downToday
    userJoinAt.value = joinAt
    userLevel.value = level
    username.value = userName

    precomputedStats.value = {
      totalUploaded: Object.values(up).reduce((a, b) => a + (b || 0), 0),
      totalDownloaded: Object.values(down).reduce((a, b) => a + (b || 0), 0),
      totalSeedCount: Object.values(seedingCount).reduce((a, b) => a + (b || 0), 0),
      totalSeedingSize: Object.values(seedingSize).reduce((a, b) => a + (b || 0), 0),
    }

    sortedItems.value = sortItems(items.value, sortKey.value)
  } catch (e) {
    console.error('Failed to fetch user data:', e)
    sortedItems.value = sortItems(items.value, sortKey.value)
  }
}



async function loadSiteIcons() {
  // 用户图标包（supporting 辅助）> 站点自带 icon > MP API
  const map = await resolveSiteIconsBatch(
    sites.value.map((s) => ({
      domain: s.domain,
      id: s.id,
      icon: s.icon,
      name: s.name,
      url: s.url,
    })),
  )
  siteIcons.value = map
}

async function refreshAll() {
  loading.value = true
  error.value = ''
  try {
    await loadSitesList()
    await Promise.all([loadConnectionStats(), loadUserData(), loadSiteIcons()])
    sortedItems.value = sortItems(items.value, sortKey.value)
  } catch (e) {
    console.error('Failed to refresh data:', e)
    error.value = String(e)
  } finally {
    loading.value = false
  }
}

watch(sortKey, (key) => {
  if (items.value.length > 0) {
    sortedItems.value = sortItems(items.value, key)
  }
})

onMounted(async () => {
  await loadPrivacyModeState()
  await refreshAll()
})
</script>

<style scoped>
.sites-root {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  /* 外层 .mp-view 已有 10px 边距与全局滚动，此处不再叠加边距/滚动容器 */
  padding: 0;
  box-sizing: border-box;
  /* 勿设 overflow-x:hidden：会连带把 overflow-y 算成 auto，出现页面内第二滚动条 */
  overflow: visible;
}

.overview {
  width: 100%;
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  margin-bottom: 6px;
}

.ov-card {
  min-width: 0;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  background: #fff;
  border-radius: 10px;
  padding: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.icon-wrap {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.icon-wrap svg {
  width: 18px;
  height: 18px;
  fill: currentColor;
  color: #fff;
}
.icon-wrap.green {
  background: #22c55e;
}
.icon-wrap.blue {
  background: #3b82f6;
}
.icon-wrap.orange {
  background: #f59e0b;
}
.icon-wrap.red {
  background: #ef4444;
}
.ov-card .text .num {
  font-size: 14px;
  font-weight: 700;
  line-height: 14px;
  color: #1f2937;
}
.ov-card .text .label {
  font-size: 12px;
  color: #8c8c8c;
}

.toolbar {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 6px;
}
.toolbar-row.inputs {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 6px;
}
.toolbar-row.inputs .full {
  width: 100%;
  min-width: 0;
}
.toolbar-row.actions {
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}
.action-group {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px;
}
.action-group > .el-button,
.action-group > .el-dropdown {
  width: 100%;
}
.action-group > .el-dropdown :deep(.el-button) {
  width: 100%;
}
.action-group :deep(.el-button) {
  margin-left: 0 !important;
}
.toolbar-row.actions .compact {
  min-width: 0;
  padding: 0 6px;
}
.toolbar-row.actions .compact svg {
  fill: currentColor;
  color: inherit;
}
.sync-count {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.icon-prefix {
  opacity: 0.7;
  fill: currentColor;
}
.icon-btn {
  margin-right: 4px;
  vertical-align: -2px;
  fill: currentColor;
  color: inherit;
}

/* 刷新按钮加载态：旋转原图标，避免 EP loading 插入图标改变按钮宽度 */
.icon-spin {
  animation: icon-spin 1s linear infinite;
}

@keyframes icon-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.ml-1 {
  margin-left: 2px;
}
.chevron {
  transform: rotate(90deg);
  fill: currentColor;
}

.grid {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  /* 允许卡片 hover 上浮阴影溢出，避免顶边被裁切 */
  overflow: visible;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
}
.site-cards {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  overflow: visible;
  display: flex;
  flex-direction: column;
  gap: 5px;
  /* 为卡片位移和阴影预留显示空间。 */
  padding: 2px 1px 4px;
  margin: -2px -1px -4px;
}

.site-card {
  background: var(--mp-color-card, #fff);
  border-radius: 12px;
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.04),
    0 1px 3px rgba(15, 23, 42, 0.06);
  padding: 12px;
  border: 1px solid var(--mp-color-border, #e2e8f0);
  transition:
    border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  z-index: 0;
  box-sizing: border-box;
  width: 100%;
}
.site-card:hover {
  z-index: 2;
  border-color: rgba(59, 130, 246, 0.28);
  box-shadow:
    0 2px 6px rgba(15, 23, 42, 0.06),
    0 8px 20px rgba(15, 23, 42, 0.08),
    0 0 0 1px rgba(59, 130, 246, 0.06);
  transform: translateY(-1px);
}

.sites-loading-card {
  width: auto;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  background: var(--mp-color-card, #fff);
  border-radius: 12px;
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.04),
    0 1px 3px rgba(15, 23, 42, 0.06);
  padding: 12px;
  border: 1px solid var(--mp-color-border, #e2e8f0);
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
  height: 14px;
  margin-bottom: 6px;
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
@keyframes sites-loading-shimmer {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: 0 0;
  }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid #f0f0f0;
  padding-right: 130px;
}
.update-time {
  font-size: 11px;
  color: #666;
}

.site-info {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.site-logo {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
  font-weight: bold;
  font-size: 16px;
  background: transparent;
  border: none;
  overflow: hidden;
  flex-shrink: 0;
}
.logo-placeholder {
  font-weight: bold;
  background: transparent;
  border: none;
}
.site-icon {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 8px;
  background: transparent;
  border: none;
}
.site-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: flex-start;
  min-width: 0;
}
.site-name {
  font-size: 16px;
  font-weight: bold;
  color: #1f2937;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
.user-info {
  display: flex;
  flex-direction: row;
  gap: 6px;
  margin-bottom: 0;
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

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  margin-bottom: 10px;
}
.metric-item {
  text-align: center;
  min-width: 0;
}
.metric-label {
  font-size: 11px;
  color: #6b7280;
  margin-bottom: 2px;
}
.metric-value {
  font-size: 12px;
  font-weight: bold;
  color: #1f2937;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
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

.data-transfer {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
  padding: 8px 10px;
  background: #f8fafc;
  border-radius: 8px;
  min-width: 0;
}
.transfer-column {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
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
  flex-shrink: 0;
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
  min-width: 0;
}
.transfer-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
  gap: 8px;
}
.transfer-item:last-child {
  margin-bottom: 0;
}
.transfer-label {
  font-size: 10px;
  color: #6b7280;
  flex-shrink: 0;
  white-space: nowrap;
}
.transfer-value {
  font-size: 10px;
  font-weight: bold;
  color: #1f2937;
  text-align: right;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 70%;
}
.transfer-divider {
  width: 1px;
  height: 28px;
  background: #e5e7eb;
  margin: 0 8px;
  flex-shrink: 0;
}

.card-actions {
  display: flex;
  gap: 8px;
}
.action-btn {
  flex: 1;
  padding: 5px 10px;
  border-radius: 6px;
  border: none;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 26px;
}
.action-btn.primary {
  background: #3b82f6;
  color: white;
  box-shadow: 0 1px 3px rgba(59, 130, 246, 0.3);
}
.action-btn.primary:hover:not(:disabled) {
  background: #2563eb;
  box-shadow: 0 2px 6px rgba(59, 130, 246, 0.4);
  transform: translateY(-1px);
}
.action-btn:disabled {
  cursor: not-allowed;
  opacity: 0.65;
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

.status-indicators {
  position: absolute;
  top: 10px;
  right: 10px;
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
.status-indicator.proxy {
  color: #3b82f6;
  background: transparent;
  border: none;
  padding: 0;
}
.status-indicator.render {
  color: #f59e0b;
  background: transparent;
  border: none;
  padding: 0;
}
.status-indicator.limit {
  color: #8b5cf6;
  background: transparent;
  border: none;
  padding: 0;
}
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

.privacy-blur {
  filter: blur(4px);
  transition: filter 0.3s ease;
  user-select: none;
}

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

@media (max-width: 480px) {
  .sites-loading-card {
    padding: 12px;
  }
  .data-transfer {
    padding: 8px;
  }
  .transfer-divider {
    margin: 0 6px;
  }
  .site-name {
    font-size: 15px;
  }
}

/* 暗色主题： sites-root，!important 覆盖浅色硬编码 */
:global(html[data-theme='dark']) .ov-card {
  background: #1e293b !important;
  border-color: #334155 !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2) !important;
}
:global(html[data-theme='dark']) .ov-card .text .num {
  color: #e2e8f0 !important;
}
:global(html[data-theme='dark']) .ov-card .text .label {
  color: #94a3b8 !important;
}
:global(html[data-theme='dark']) .icon-wrap.green {
  background: #16a34a !important;
}
:global(html[data-theme='dark']) .icon-wrap.blue {
  background: #2563eb !important;
}
:global(html[data-theme='dark']) .icon-wrap.orange {
  background: #d97706 !important;
}
:global(html[data-theme='dark']) .icon-wrap.red {
  background: #dc2626 !important;
}
:global(html[data-theme='dark']) .icon-wrap svg,
:global(html[data-theme='dark']) .icon-wrap svg path {
  fill: #fff !important;
  color: #fff !important;
}

:global(html[data-theme='dark']) .site-card,
:global(html[data-theme='dark']) .sites-loading-card {
  background: #1e293b !important;
  border-color: #334155 !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3) !important;
}
:global(html[data-theme='dark']) .site-card:hover {
  border-color: rgba(96, 165, 250, 0.35) !important;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.45) !important;
}
:global(html[data-theme='dark']) .card-header {
  border-bottom-color: #334155 !important;
}
:global(html[data-theme='dark']) .update-time,
:global(html[data-theme='dark']) .username,
:global(html[data-theme='dark']) .metric-label,
:global(html[data-theme='dark']) .transfer-label,
:global(html[data-theme='dark']) .empty-text {
  color: #94a3b8 !important;
}
:global(html[data-theme='dark']) .site-name {
  color: #f1f5f9 !important;
}
:global(html[data-theme='dark']) .user-level {
  color: #60a5fa !important;
  background: rgba(59, 130, 246, 0.15) !important;
  border-color: rgba(96, 165, 250, 0.25) !important;
}
:global(html[data-theme='dark']) .metric-value {
  color: #cbd5e1 !important;
}
:global(html[data-theme='dark']) .metric-item.seeding-size .metric-label {
  color: #34d399 !important;
}
:global(html[data-theme='dark']) .metric-item.seeding-size .metric-value {
  color: #6ee7b7 !important;
}
:global(html[data-theme='dark']) .metric-item.seeding-count .metric-label {
  color: #60a5fa !important;
}
:global(html[data-theme='dark']) .metric-item.seeding-count .metric-value {
  color: #93c5fd !important;
}
:global(html[data-theme='dark']) .metric-item.bonus .metric-label {
  color: #fbbf24 !important;
}
:global(html[data-theme='dark']) .metric-item.bonus .metric-value {
  color: #fcd34d !important;
}
:global(html[data-theme='dark']) .metric-item.ratio .metric-label {
  color: #c084fc !important;
}
:global(html[data-theme='dark']) .metric-item.ratio .metric-value {
  color: #d8b4fe !important;
}

:global(html[data-theme='dark']) .data-transfer {
  background: #0f172a !important;
}
:global(html[data-theme='dark']) .transfer-value {
  color: #cbd5e1 !important;
}
:global(html[data-theme='dark']) .transfer-divider {
  background: #334155 !important;
}
:global(html[data-theme='dark']) .transfer-column.upload .transfer-icon {
  background: rgba(34, 197, 94, 0.16) !important;
  color: #4ade80 !important;
}
:global(html[data-theme='dark']) .transfer-column.download .transfer-icon {
  background: rgba(239, 68, 68, 0.16) !important;
  color: #f87171 !important;
}
:global(html[data-theme='dark']) .transfer-column.upload .transfer-icon svg path,
:global(html[data-theme='dark']) .transfer-column.download .transfer-icon svg path {
  stroke: currentColor !important;
}

:global(html[data-theme='dark']) .action-btn.primary {
  background: #2563eb !important;
  color: #fff !important;
  border-color: #2563eb !important;
}
:global(html[data-theme='dark']) .action-btn.primary:hover {
  background: #1d4ed8 !important;
}
:global(html[data-theme='dark']) .action-btn.secondary {
  background: #334155 !important;
  border-color: #475569 !important;
  color: #cbd5e1 !important;
}
:global(html[data-theme='dark']) .action-btn.secondary:hover {
  background: #475569 !important;
  border-color: #64748b !important;
  color: #e2e8f0 !important;
}

:global(html[data-theme='dark']) .status-label.active,
:global(html[data-theme='dark']) .status-label.connection-normal {
  color: #4ade80 !important;
  background: rgba(34, 197, 94, 0.15) !important;
  border-color: rgba(34, 197, 94, 0.25) !important;
}
:global(html[data-theme='dark']) .status-label.connection-slow {
  color: #fbbf24 !important;
  background: rgba(245, 158, 11, 0.15) !important;
  border-color: rgba(245, 158, 11, 0.25) !important;
}
:global(html[data-theme='dark']) .status-label.connection-failed {
  color: #f87171 !important;
  background: rgba(239, 68, 68, 0.15) !important;
  border-color: rgba(239, 68, 68, 0.25) !important;
}
:global(html[data-theme='dark']) .status-label.inactive,
:global(html[data-theme='dark']) .status-label.connection-unknown {
  color: #94a3b8 !important;
  background: rgba(255, 255, 255, 0.05) !important;
  border-color: rgba(255, 255, 255, 0.1) !important;
}

:global(html[data-theme='dark']) .sites-loading-shimmer {
  background: linear-gradient(90deg, #334155 25%, #475569 37%, #334155 63%) !important;
  background-size: 400% 100% !important;
}

/* 工具栏控件 */
:global(html[data-theme='dark']) .toolbar :deep(.el-input__wrapper),
:global(html[data-theme='dark']) .toolbar :deep(.el-select__wrapper) {
  background: #0f172a !important;
  box-shadow: 0 0 0 1px #334155 inset !important;
}
:global(html[data-theme='dark']) .toolbar :deep(.el-input__inner),
:global(html[data-theme='dark']) .toolbar :deep(.el-select__selected-item),
:global(html[data-theme='dark']) .toolbar :deep(.el-select__placeholder) {
  color: #e2e8f0 !important;
}
:global(html[data-theme='dark']) .icon-prefix,
:global(html[data-theme='dark']) .icon-btn,
:global(html[data-theme='dark']) .icon-prefix path,
:global(html[data-theme='dark']) .icon-btn path {
  color: #94a3b8 !important;
  fill: currentColor !important;
}
:global(html[data-theme='dark']) .compact {
  --el-button-bg-color: #1e293b;
  --el-button-border-color: #334155;
  --el-button-text-color: #cbd5e1;
  --el-button-hover-bg-color: #334155;
  --el-button-hover-border-color: #475569;
  --el-button-hover-text-color: #e2e8f0;
}
</style>
