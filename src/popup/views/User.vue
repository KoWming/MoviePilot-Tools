<template>
  <div class="user-root">
    <div class="header"></div>

    <template v-if="loading">
      <div class="user-loading-card">
        <div class="user-loading-profile">
          <div class="user-loading-avatar user-loading-shimmer"></div>
          <div class="user-loading-meta">
            <div class="user-loading-line name user-loading-shimmer"></div>
            <div class="user-loading-badges">
              <div class="user-loading-badge user-loading-shimmer"></div>
              <div class="user-loading-badge user-loading-shimmer"></div>
            </div>
          </div>
          <div class="user-loading-button user-loading-shimmer"></div>
        </div>
        <div class="user-loading-divider"></div>
        <div class="user-loading-email user-loading-shimmer"></div>
        <div class="user-loading-sub-stats">
          <div class="user-loading-sub-stat">
            <div class="user-loading-icon user-loading-shimmer"></div>
            <div class="user-loading-sub-text">
              <div class="user-loading-line count user-loading-shimmer"></div>
              <div class="user-loading-line label user-loading-shimmer"></div>
            </div>
          </div>
          <div class="user-loading-sub-stat">
            <div class="user-loading-icon user-loading-shimmer"></div>
            <div class="user-loading-sub-text">
              <div class="user-loading-line count user-loading-shimmer"></div>
              <div class="user-loading-line label user-loading-shimmer"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="user-loading-info-card">
        <div class="user-loading-stats-grid">
          <div v-for="item in 4" :key="item" class="user-loading-stat">
            <div class="user-loading-line stat-num user-loading-shimmer"></div>
            <div class="user-loading-line stat-label user-loading-shimmer"></div>
          </div>
        </div>
        <div class="user-loading-divider"></div>
        <div class="user-loading-version-title user-loading-shimmer"></div>
        <div class="user-loading-version-list">
          <div v-for="item in 4" :key="item" class="user-loading-version-item">
            <div class="user-loading-line version-label user-loading-shimmer"></div>
            <div class="user-loading-line version-value user-loading-shimmer"></div>
          </div>
        </div>
      </div>
    </template>
    
    <template v-else>
      <!-- 用户卡片 -->
      <UserCard 
        :user="mappedUser" 
        :movie-count="movieCount" 
        :tv-count="tvCount" 
        @edit="onEditProfile" 
        @logout="logout" 
      />

      <!-- 综合信息卡片 -->
      <div class="comprehensive-info">
        <el-card class="comprehensive-card" shadow="hover">
          
          <!-- 统计信息 -->
          <div class="stats-section">
            <div class="stats-grid">
              <div class="stat-item stat-supporting">
                <div class="stat-num">{{ precomputedStats.supportingSites ?? '-' }}</div>
                <div class="stat-label">已适配站点</div>
              </div>
              <div class="stat-item stat-config">
                <div class="stat-num">{{ precomputedStats.configSites ?? '-' }}</div>
                <div class="stat-label">已配置站点</div>
              </div>
              <div class="stat-item stat-cookie">
                <div class="stat-num">{{ precomputedStats.cookieCount ?? '-' }}</div>
                <div class="stat-label">Cookie数</div>
              </div>
              <div class="stat-item stat-pending">
                <div class="stat-num">{{ precomputedStats.pending ?? '-' }}</div>
                <div class="stat-label">待更新</div>
              </div>
            </div>
          </div>

          <!-- 分隔线 -->
          <div class="divider"></div>

          <!-- 版本信息 -->
          <div class="version-section">
            <div class="version-title">MoviePilot 版本信息</div>
            <div class="version-list">
              <div class="version-item">
                <span class="version-label">软件版本：</span>
                <span class="version-value">{{ precomputedStats.systemVersion || '-' }}</span>
              </div>
              <div class="version-item">
                <span class="version-label">前端版本：</span>
                <span class="version-value">{{ precomputedStats.frontendVersion || '-' }}</span>
              </div>
              <div class="version-item">
                <span class="version-label">认证资源版本：</span>
                <span class="version-value">{{ precomputedStats.authVersion || '-' }}</span>
              </div>
              <div class="version-item">
                <span class="version-label">站点资源版本：</span>
                <span class="version-value">{{ precomputedStats.indexerVersion || '-' }}</span>
              </div>
            </div>
          </div>
        </el-card>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
// ============================================================
// 用户仪表板视图
// 统计概览：下载/上传/分享率、快捷入口
// ============================================================
import { onMounted, reactive, computed, ref } from 'vue';
import { createMpApiClient } from '../../shared/api/client';
import UserCard from '../components/UserCard.vue';
import { getPendingCount } from '../../shared/stores/siteStore';
import { ElMessage } from 'element-plus';
import { clearCredentials } from '../../shared/secureStorage';
import { STORAGE_KEYS } from '../../shared/constants';

const user = reactive<{ user_name?: string; name?: string; avatar?: string; super_user?: boolean; email?: string }>({});
const movieCount = ref(0);
const tvCount = ref(0);
const loading = ref(true);

// 预计算的统计数据 - 参考站点数据页面的优化方法
const precomputedStats = ref({
  configSites: 0,
  supportingSites: 0,
  cookieCount: 0,
  pending: 0,
  systemVersion: '',
  frontendVersion: '',
  authVersion: '',
  indexerVersion: ''
});

async function getToken(): Promise<string | undefined> {
  const data = await chrome.storage.local.get([STORAGE_KEYS.TOKEN]);
  if (data[STORAGE_KEYS.TOKEN]) return data[STORAGE_KEYS.TOKEN] as string;
  // 兼容旧版本：sync 回退并迁移
  try {
    const syncData = await chrome.storage.sync.get([STORAGE_KEYS.TOKEN]);
    const t = syncData[STORAGE_KEYS.TOKEN] as string | undefined;
    if (t) { await chrome.storage.local.set({ [STORAGE_KEYS.TOKEN]: t }); return t; }
  } catch {}
  return undefined;
}
async function getBaseUrl(): Promise<string> {
  const data = await chrome.storage.local.get([STORAGE_KEYS.BASE_URL]);
  if (data[STORAGE_KEYS.BASE_URL]) return data[STORAGE_KEYS.BASE_URL] as string;
  // 兼容旧版本：sync 回退并迁移
  try {
    const syncData = await chrome.storage.sync.get([STORAGE_KEYS.BASE_URL]);
    const u = syncData[STORAGE_KEYS.BASE_URL] as string | undefined;
    if (u) { await chrome.storage.local.set({ [STORAGE_KEYS.BASE_URL]: u }); return u; }
  } catch {}
  return '';
}

const mappedUser = computed(() => ({
  name: (user as any).name || (user as any).user_name || '用户',
  avatar: (user as any).avatar,
  is_superuser: (user as any).is_superuser ?? (user as any).super_user,
  is_active: true,
  email: (user as any).email
}));

// 获取当前用户信息
async function fetchCurrentUser() {
  try {
    const baseURL = await getBaseUrl();
    const client = createMpApiClient({ baseURL, getToken });
    const u = await client.get('/api/v1/user/current');
    Object.assign(user, u.data || {});
  } catch (error) {
    console.error('Failed to fetch current user:', error);
  }
}

// 获取用户订阅数据
async function fetchUserSubscriptions() {
  try {
    const baseURL = await getBaseUrl();
    const client = createMpApiClient({ baseURL, getToken });
    const uname = user.name || user.user_name;
    if (uname) {
      const subs = await client.get(`/api/v1/subscribe/user/${encodeURIComponent(uname)}`);
      const list = Array.isArray(subs.data) ? subs.data : [];
      movieCount.value = list.filter((it: any) => it.type === '电影').length;
      tvCount.value = list.filter((it: any) => it.type === '电视剧').length;
    }
  } catch (error) {
    console.error('Failed to fetch user subscriptions:', error);
    movieCount.value = 0;
    tvCount.value = 0;
  }
}

// 获取站点统计数据
async function fetchSiteStats() {
  try {
    const baseURL = await getBaseUrl();
    const client = createMpApiClient({ baseURL, getToken });
    const sites = await client.get('/api/v1/site/');
    const sitesList = Array.isArray(sites.data) ? sites.data : [];
    
    // 预计算统计数据
    const enabledSites = sitesList.filter((site: any) => site.is_active !== false).length;
    // 获取已适配站点数
    let supportingSites = 0;
    try {
      const supportingResp = await client.get('/api/v1/site/supporting');
      const supportingData = supportingResp.data;
      if (supportingData && typeof supportingData === 'object') {
        supportingSites = Object.keys(supportingData).length;
      }
    } catch (e) {
      console.warn('获取已适配站点数失败:', e);
    }
    // 已配置站点：统计 MP 服务端真实站点（与站点管理页一致，按 id 判定）
    const configSites = sitesList.filter((site: any) => site.id && site.id > 0).length;
    const cookieCount = sitesList.filter((site: any) => site.cookie && site.cookie.trim() !== '').length;
    const pending = getPendingCount();
    
    // 更新预计算统计数据
    precomputedStats.value = {
      ...precomputedStats.value,
      supportingSites,
      configSites,
      cookieCount,
      pending
    };
  } catch (error) {
    console.error('Failed to fetch site stats:', error);
  }
}

// 获取系统版本信息
async function fetchSystemEnv() {
  try {
    const baseURL = await getBaseUrl();
    const client = createMpApiClient({ baseURL, getToken });
    const envResponse = await client.get('/api/v1/system/env');
    
    // 处理不同的响应数据结构
    let envData = null;
    if (envResponse.data && envResponse.data.data) {
      envData = envResponse.data.data;
    } else if (envResponse.data) {
      envData = envResponse.data;
    }
    
    if (envData) {
      precomputedStats.value = {
        ...precomputedStats.value,
        systemVersion: envData.VERSION || '',
        frontendVersion: envData.FRONTEND_VERSION || '',
        authVersion: envData.AUTH_VERSION || '',
        indexerVersion: envData.INDEXER_VERSION || ''
      };
    }
  } catch (error) {
    console.error('Failed to fetch system env:', error);
  }
}

// 优化的数据加载方法 - 参考站点数据页面的并行加载策略
async function refreshAll() {
  loading.value = true;
  
  try {
    // 并行获取所有数据
    await Promise.all([
      fetchCurrentUser(),
      fetchSiteStats(),
      fetchSystemEnv()
    ]);
    
    // 用户信息获取后再获取订阅数据
    await fetchUserSubscriptions();
    
  } catch (error) {
    console.error('Failed to refresh dashboard data:', error);
    ElMessage.error('数据加载失败');
  } finally {
    loading.value = false;
  }
}

async function logout() {
  try {
    await clearCredentials();
  } catch {}
  await chrome.storage.local.remove([STORAGE_KEYS.TOKEN]);
  // 可选：同时清除 base_url，避免误用
  // await chrome.storage.sync.remove([STORAGE_KEYS.BASE_URL]);
  // 通知当前弹窗返回登录页
  chrome.runtime.sendMessage({ type: 'MP_LOGOUT' });
  window.location.reload();
}

function onEditProfile() {
  ElMessage.info('该功能暂未开发...');
}

onMounted(refreshAll);
</script>

<style scoped>
.user-root { width: 100%; padding: 8px; box-sizing: border-box; }
.header { display: flex; justify-content: flex-end; margin-bottom: 6px; }
.profile { margin-bottom: 8px; }
/* 让用户卡片整体向上微移，并增加与下方卡片的间距 */
:deep(.user-card) { margin-top: -6px; margin-bottom: 8px; }

.user-loading-card,
.user-loading-info-card {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  border-radius: 14px;
  background: #ffffff;
  border: 1px solid rgba(0,0,0,0.06);
  box-shadow: 0 6px 18px rgba(0,0,0,0.06);
  padding: 12px;
  pointer-events: none;
}

.user-loading-card {
  margin-top: -6px;
  margin-bottom: 8px;
}

.user-loading-info-card {
  margin-top: 6px;
}

.user-loading-profile {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.user-loading-avatar {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  flex-shrink: 0;
}

.user-loading-meta {
  flex: 1;
  min-width: 0;
}

.user-loading-line {
  height: 10px;
  border-radius: 999px;
}

.user-loading-line.name {
  width: 58%;
  height: 18px;
  margin-bottom: 10px;
}

.user-loading-badges {
  display: flex;
  gap: 6px;
}

.user-loading-badge {
  width: 46px;
  height: 22px;
  border-radius: 6px;
}

.user-loading-button {
  width: 54px;
  height: 28px;
  border-radius: 8px;
  flex-shrink: 0;
}

.user-loading-divider {
  height: 1px;
  background: rgba(0,0,0,0.06);
  margin: 8px 4px;
}

.user-loading-email {
  width: 62%;
  height: 12px;
  border-radius: 999px;
  margin: 4px 4px 10px;
}

.user-loading-sub-stats,
.user-loading-stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  min-width: 0;
}

.user-loading-sub-stat {
  min-width: 0;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  background: #fff;
  border: 1px solid rgba(0,0,0,0.05);
  box-shadow: 0 2px 8px rgba(0,0,0,.04);
}

.user-loading-icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  flex-shrink: 0;
}

.user-loading-sub-text {
  flex: 1;
}

.user-loading-line.count {
  width: 36px;
  height: 16px;
  margin-bottom: 6px;
}

.user-loading-line.label {
  width: 52px;
  height: 9px;
}

.user-loading-stats-grid {
  gap: 6px;
}

.user-loading-stat {
  min-height: 42px;
  border-radius: 6px;
  background: #ffffff;
  border: 1px solid rgba(0,0,0,0.05);
  box-shadow: 0 1px 3px rgba(0,0,0,0.02);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 6px 4px;
}

.user-loading-line.stat-num {
  width: 34px;
  height: 16px;
  margin-bottom: 5px;
}

.user-loading-line.stat-label {
  width: 58px;
  height: 9px;
}

.user-loading-version-title {
  width: 126px;
  height: 12px;
  border-radius: 999px;
  margin: 8px auto;
}

.user-loading-version-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.user-loading-version-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

.user-loading-line.version-label {
  width: 92px;
  max-width: 50%;
  height: 10px;
}

.user-loading-line.version-value {
  width: 86px;
  max-width: 45%;
  height: 10px;
}

.user-loading-shimmer {
  background: linear-gradient(90deg, #edf2f7 25%, #f8fafc 37%, #edf2f7 63%);
  background-size: 400% 100%;
  animation: user-loading-shimmer 1.25s ease-in-out infinite;
}

@keyframes user-loading-shimmer {
  0% { background-position: 100% 0; }
  100% { background-position: 0 0; }
}

/* 综合信息卡片样式 */
.comprehensive-info {
  margin-top: 6px;
}

.comprehensive-card {
  border-radius: 14px;
  background: linear-gradient(180deg, #f8f9fa 0%, #ffffff 35%);
  border: 1px solid rgba(0,0,0,0.06);
  box-shadow: 0 6px 18px rgba(0,0,0,0.06);
}

.comprehensive-card :deep(.el-card__body) {
  padding: 10px;
}

.card-title {
  font-size: 14px;
  font-weight: 600;
  color: #495057;
  margin-bottom: 8px;
  text-align: center;
}

/* 统计信息区域 */
.stats-section {
  margin-bottom: 8px;
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.stat-item {
  text-align: center;
  padding: 6px 4px;
  border-radius: 6px;
  background: #ffffff;
  border: 1px solid rgba(0,0,0,0.05);
  box-shadow: 0 1px 3px rgba(0,0,0,0.02);
}

.stat-num {
  font-size: 14px;
  font-weight: 700;
  line-height: 16px;
  margin-bottom: 1px;
}

.stat-label {
  font-size: 9px;
  color: #6c757d;
}

/* 已配置站点 - 蓝色主题 */
.stat-config .stat-num { color: #1976d2; }
.stat-config { background: linear-gradient(135deg, #e3f2fd 0%, #f8f9fa 100%); }

/* 已适配站点 - 青色主题 */
.stat-supporting .stat-num { color: #00838f; }
.stat-supporting { background: linear-gradient(135deg, #e0f7fa 0%, #e8f5e9 100%); }

/* Cookie数 - 橙色主题 */
.stat-cookie .stat-num { color: #f57c00; }
.stat-cookie { background: linear-gradient(135deg, #fff3e0 0%, #f8f9fa 100%); }

/* 待更新 - 紫色主题 */
.stat-pending .stat-num { color: #7b1fa2; }
.stat-pending { background: linear-gradient(135deg, #f3e5f5 0%, #f8f9fa 100%); }

/* 分隔线 */
.divider {
  height: 1px;
  background: rgba(0,0,0,0.08);
  margin: 8px 0;
}

/* 版本信息区域 */
.version-section {
  margin-top: 8px;
}

.version-title {
  font-size: 12px;
  font-weight: 600;
  color: #495057;
  margin-bottom: 8px;
  text-align: center;
}

.version-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.version-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 2px 0;
  font-size: 11px;
}

.version-label {
  color: #6c757d;
  font-weight: 500;
}

.version-value {
  color: #495057;
  font-weight: 600;
  font-family: 'Courier New', monospace;
}
</style>


