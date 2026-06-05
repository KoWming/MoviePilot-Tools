<template>
  <div class="site-management">
    <!-- 统计面板 -->
    <div class="stats-panel">
      <div class="stat-item stat-config">
        <div class="stat-number">{{ sites.length }}</div>
        <div class="stat-label">已配置</div>
      </div>
      <div class="stat-item stat-enabled">
        <div class="stat-number">{{ enabledSitesCount }}</div>
        <div class="stat-label">已启用</div>
      </div>
      <div class="stat-item stat-filtered">
        <div class="stat-number">{{ filteredSites.length }}</div>
        <div class="stat-label">过滤后</div>
      </div>
      <div class="stat-item stat-pending">
        <div class="stat-number">{{ pendingUpdateCount }}</div>
        <div class="stat-label">待更新</div>
      </div>
    </div>

    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="filter-section">
        <el-checkbox v-model="filters.browser" @change="updateFilter">浏览器</el-checkbox>
        <el-checkbox v-model="filters.server" @change="updateFilter">服务器</el-checkbox>
        <el-checkbox v-model="filters.cookieDiff" @change="updateFilter">Cookie 差异</el-checkbox>
        <el-checkbox v-model="filters.uaDiff" @change="updateFilter">UA 差异</el-checkbox>
        <el-checkbox v-model="filters.notAdded" @change="updateFilter">未添加</el-checkbox>
      </div>
      
      <div class="action-section">
        <el-button @click="showAddDialog = true" class="action-btn" title="添加站点">
          <svg viewBox="0 0 24 24" width="16" height="16" class="icon-btn"><path :d="mdiPlus"/></svg>
          添加站点
        </el-button>
        <el-button @click="openAllSites" class="action-btn" title="一键打开所有站点">
          <svg viewBox="0 0 24 24" width="16" height="16" class="icon-btn"><path :d="mdiOpenInNew"/></svg>
          打开
        </el-button>
        <el-button @click="refreshSites" class="action-btn" title="刷新站点数据">
          <svg viewBox="0 0 24 24" width="16" height="16" class="icon-btn"><path :d="mdiRefresh"/></svg>
          刷新
        </el-button>
        <el-button type="danger" @click="overwriteAllCookies" class="action-btn" title="一键将服务器Cookie覆盖到浏览器">
          <svg viewBox="0 0 24 24" width="16" height="16" class="icon-btn"><path :d="mdiCookie"/></svg>
          覆盖
        </el-button>
        <el-button type="primary" @click="updateAllSites" class="action-btn" title="一键更新Cookie和UserAgent到服务器">
          <svg viewBox="0 0 24 24" width="16" height="16" class="icon-btn"><path :d="mdiUpload"/></svg>
          更新
        </el-button>
      </div>
    </div>

    <!-- 站点列表 -->
    <div class="site-list" v-loading="loading">
      <div v-if="filteredSites.length === 0" class="empty-state">
        <svg viewBox="0 0 24 24" width="48" height="48" class="empty-icon"><path :d="mdiWeb"/></svg>
        <p class="empty-text">暂无站点数据</p>
      </div>
      
      <div v-else class="site-cards">
        <div
          v-for="site in filteredSites"
          :key="site.id"
          class="site-card"
          :class="{ 
            'site-inactive': !site.is_active,
            'site-disabled': (site as any).isDisabled
          }"
        >
          <div class="site-header">
            <div class="site-info">
              <div class="site-name-row">
                <div class="site-name">{{ site.name || site.domain || site.url }}</div>
                <div class="site-tags">
                  <el-tag v-if="(site as any).isDisabled" type="danger" size="small" class="diff-tag">
                    已禁用
                  </el-tag>
                  <template v-else>
                    <el-tag v-if="isApiSite(site)" type="success" size="small" class="diff-tag">
                      无需Cookie
                    </el-tag>
                    <template v-else>
                      <el-tag v-if="site.cookieDiff" type="warning" size="small" class="diff-tag">
                        Cookie差异
                      </el-tag>
                      <el-tag v-if="site.uaDiff" type="info" size="small" class="diff-tag">
                        UA差异
                      </el-tag>
                    </template>
                  </template>
                </div>
              </div>
              <div class="site-url">{{ site.url }}</div>
            </div>
            <div class="site-status">
              <el-tag :type="getStatusType(site)" size="small">
                {{ getStatusText(site) }}
              </el-tag>
            </div>
          </div>
          
          <div class="site-actions">
            <!-- 覆盖按钮：只在有服务器Cookie且与浏览器不同时显示，且站点未被禁用，且不是API站点 -->
            <el-button 
              v-if="site.cookie && site.cookieDiff && !(site as any).isDisabled && !isApiSite(site)" 
              size="small" 
              type="danger" 
              title="将服务器Cookie覆盖到浏览器"
              @click="overwriteCookie(site)"
            >
              覆盖
            </el-button>
            <!-- 更新按钮：只在有差异且有浏览器Cookie时显示，且站点未被禁用，且不是API站点 -->
            <el-button 
              v-if="(site.cookieDiff || site.uaDiff) && !(site as any).isDisabled && !isApiSite(site) && hasBrowserCookie(site)" 
              size="small" 
              type="primary" 
              title="更新Cookie和UserAgent到服务器"
              @click="updateSite(site)"
            >
              更新
            </el-button>
            <!-- 登录按钮：只在没有浏览器Cookie且有差异时显示，且站点未被禁用，且不是API站点 -->
            <el-button 
              v-if="(site.cookieDiff || site.uaDiff) && !(site as any).isDisabled && !isApiSite(site) && !hasBrowserCookie(site)" 
              size="small" 
              type="success" 
              title="前往站点登录"
              @click="openSiteLogin(site)"
            >
              登录
            </el-button>
            <!-- 菜单按钮：始终显示 -->
            <el-dropdown @command="handleMenuCommand" trigger="click">
              <el-button size="small" circle>
                <svg viewBox="0 0 24 24" width="16" height="16"><path :d="mdiDotsVertical"/></svg>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item :command="{action: 'test', site}">
                    <svg viewBox="0 0 24 24" width="14" height="14" class="menu-icon"><path :d="mdiWifi"/></svg>
                    测试
                  </el-dropdown-item>
                  <el-dropdown-item :command="{action: 'edit', site}">
                    <svg viewBox="0 0 24 24" width="14" height="14" class="menu-icon"><path :d="mdiPencil"/></svg>
                    编辑
                  </el-dropdown-item>
                  <el-dropdown-item :command="{action: 'toggleDisable', site}">
                    <svg viewBox="0 0 24 24" width="14" height="14" class="menu-icon"><path :d="mdiUpload"/></svg>
                    {{ (site as any).isDisabled ? '开启' : '禁用' }}
                  </el-dropdown-item>
                  <el-dropdown-item :command="{action: 'delete', site}" divided>
                    <svg viewBox="0 0 24 24" width="14" height="14" class="menu-icon"><path :d="mdiDelete"/></svg>
                    删除
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
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
      :modal="true"
      :append-to-body="true"
      :destroy-on-close="true"
      :fullscreen="true"
      class="site-dialog"
    >
      <div class="dialog-content">
        <el-form
          ref="siteFormRef"
          :model="siteForm"
          :rules="siteFormRules"
          label-width="0"
          class="site-form"
        >
          <!-- 主要布局：顶部设置项，底部站点信息 -->
          <div class="main-layout">
            <!-- 顶部：状态、优先级、超时、下载器 -->
            <div class="top-section">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">
                    <svg viewBox="0 0 24 24" width="16" height="16" class="label-icon" data-icon="mdiToggleSwitch" :title="'站点启用/停用'"><path :d="mdiToggleSwitch"/></svg>
                    状态
                  </label>
                  <el-select 
                    v-model="siteForm.is_active" 
                    placeholder="选择状态"
                    class="form-select"
                  >
                    <el-option label="启用" :value="true" />
                    <el-option label="停用" :value="false" />
                  </el-select>
                </div>

                <div class="form-group">
                  <label class="form-label">
                    <svg viewBox="0 0 24 24" width="16" height="16" class="label-icon" data-icon="mdiPriorityHigh" :title="'优先级越小越优先'"><path :d="mdiPriorityHigh"/></svg>
                    优先级
                  </label>
                  <el-select 
                    v-model="siteForm.pri" 
                    placeholder="选择优先级"
                    class="form-select"
                  >
                    <el-option
                      v-for="item in priorityOptions"
                      :key="item.value"
                      :label="item.label"
                      :value="item.value"
                    />
                  </el-select>
                </div>

                <div class="form-group">
                  <label class="form-label">
                    <svg viewBox="0 0 24 24" width="16" height="16" class="label-icon" data-icon="mdiTimer" :title="'站点请求超时时间,为0时不限制'"><path :d="mdiTimer"/></svg>
                    超时时间
                  </label>
                  <el-input 
                    v-model="siteForm.timeout" 
                    placeholder="秒"
                    class="form-input"
                  />
                </div>

                <div class="form-group">
                  <label class="form-label">
                    <svg viewBox="0 0 24 24" width="16" height="16" class="label-icon" data-icon="mdiDownload" :title="'此站点使用的下载器'"><path :d="mdiDownload"/></svg>
                    下载器
                  </label>
                  <el-select 
                    v-model="siteForm.downloader" 
                    placeholder="默认"
                    class="form-select"
                  >
                    <el-option label="默认" value="" />
                    <el-option
                      v-for="item in downloaderOptions"
                      :key="item.name"
                      :label="item.name"
                      :value="item.name"
                    />
                  </el-select>
                </div>
              </div>
            </div>

            <!-- 底部：站点地址和RSS -->
            <div class="bottom-section">
              <div class="form-group">
                <label class="form-label">
                  <svg viewBox="0 0 24 24" width="16" height="16" class="label-icon" data-icon="mdiWeb"><path :d="mdiWeb"/></svg>
                  站点地址
                </label>
                <el-input 
                  v-model="siteForm.url" 
                  placeholder="格式: http://www.example.com/"
                  class="form-input"
                />
              </div>
              
              <div class="form-group">
                <label class="form-label">
                  <svg viewBox="0 0 24 24" width="16" height="16" class="label-icon" data-icon="mdiRss"><path :d="mdiRss"/></svg>
                  RSS地址
                </label>
                <el-input 
                  v-model="siteForm.rss" 
                  placeholder="RSS订阅地址"
                  class="form-input"
                />
                <div class="form-hint">订阅模式为`站点RSS`时使用的订阅链接,如未自动获取需手动补充</div>
              </div>
            </div>
          </div>

          <!-- 认证方式选项卡 -->
          <div class="auth-section">
            <el-tabs v-model="siteType" class="auth-tabs">
              <el-tab-pane name="cookie">
                 <template #label>
                   <span class="tab-label">
                     <svg viewBox="0 0 24 24" width="16" height="16" class="tab-icon" data-icon="mdiCookie"><path :d="mdiCookie"/></svg>
                     COOKIE
                   </span>
                 </template>
                <div class="auth-content">
                  <div class="form-group">
                     <label class="form-label">
                       <svg viewBox="0 0 24 24" width="16" height="16" class="label-icon" data-icon="mdiCookie"><path :d="mdiCookie"/></svg>
                       站点Cookie
                     </label>
          <el-input
            v-model="siteForm.cookie"
            type="textarea"
            :rows="3"
                      placeholder="站点请求头中的Cookie信息"
                      class="form-textarea"
                    />
                  </div>
                  <div class="form-group">
                     <label class="form-label">
                       <svg viewBox="0 0 24 24" width="16" height="16" class="label-icon" data-icon="mdiAccount"><path :d="mdiAccount"/></svg>
                       站点User-Agent
                     </label>
                    <el-input 
                      v-model="siteForm.ua" 
                      placeholder="获取Cookie的浏览器对应的User-Agent"
                      class="form-input"
                    />
                  </div>
                </div>
              </el-tab-pane>
              
              <el-tab-pane name="api">
                 <template #label>
                   <span class="tab-label">
                     <svg viewBox="0 0 24 24" width="16" height="16" class="tab-icon" data-icon="mdiApi"><path :d="mdiApi"/></svg>
                     API
                   </span>
                 </template>
                <div class="auth-content">
                  <div class="form-group">
                     <label class="form-label">
                       <svg viewBox="0 0 24 24" width="16" height="16" class="label-icon" data-icon="mdiKey"><path :d="mdiKey"/></svg>
                       请求头 (Authorization)
                     </label>
                    <el-input 
                      v-model="siteForm.token" 
                      placeholder="站点请求头中的Authorization信息,特殊站点需要"
                      class="form-input"
                    />
                  </div>
                  <div class="form-group">
                     <label class="form-label">
                       <svg viewBox="0 0 24 24" width="16" height="16" class="label-icon" data-icon="mdiApi"><path :d="mdiApi"/></svg>
                       令牌 (API Key)
                     </label>
                    <el-input 
                      v-model="siteForm.apikey" 
                      placeholder="站点的访问API Key,特殊站点需要"
                      class="form-input"
                    />
                  </div>
                </div>
              </el-tab-pane>
            </el-tabs>
          </div>

          <!-- 底部开关选项 -->
          <div class="bottom-options">
            <div class="option-item">
              <el-switch v-model="isLimit" />
              <span class="option-label">限制站点访问频率</span>
            </div>
            <div class="option-item">
              <el-switch v-model="siteForm.proxy" />
              <span class="option-label">使用代理访问</span>
            </div>
            <div class="option-item">
              <el-switch v-model="siteForm.render" />
              <span class="option-label">浏览器仿真</span>
            </div>
          </div>

          <!-- 限流设置（条件显示） -->
          <div v-if="isLimit" class="limit-settings">
            <div class="limit-title">限流设置</div>
            <div class="limit-fields">
              <div class="form-group">
                <label class="form-label">限流间隔</label>
                <el-input-number v-model="siteForm.limit_interval" :min="0" class="form-input-number" />
              </div>
              <div class="form-group">
                <label class="form-label">限流次数</label>
                <el-input-number v-model="siteForm.limit_count" :min="0" class="form-input-number" />
              </div>
              <div class="form-group">
                <label class="form-label">限流秒数</label>
                <el-input-number v-model="siteForm.limit_seconds" :min="0" class="form-input-number" />
              </div>
            </div>
          </div>
        </el-form>
      </div>
      
      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="saveSite">
          {{ editingSite ? '更新' : '添加' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { 
  mdiPlus, mdiRefresh, mdiWeb, mdiWifi, 
  mdiPencil, mdiDelete, mdiOpenInNew, mdiUpload,
  mdiRss, mdiPriorityHigh, mdiToggleSwitch, mdiTimer,
  mdiDownload, mdiCookie, mdiApi, mdiKey,
  mdiDotsVertical, mdiAccount
} from '@mdi/js';
import { createMpApiClient } from '../../shared/api/client';
import { getBaseUrl, getToken } from '../../shared/api/auth';
import { updatePendingCount } from '../../shared/stores/siteStore';
import type { Site } from '../../shared/types/site';
import { downloadApi, type DownloaderConf } from '../../shared/api/download';

// 响应式数据
const loading = ref(false);
const submitting = ref(false);
const sites = ref<Site[]>([]);
const showAddDialog = ref(false);
const editingSite = ref<Site | null>(null);
const downloaderOptions = ref<DownloaderConf[]>([]);



// 筛选条件类型定义
type FilterKeys = 'browser' | 'server' | 'cookieDiff' | 'uaDiff' | 'notAdded';

// 筛选条件
const filters = reactive<Record<FilterKeys, boolean>>({
  browser: false,
  server: false,
  cookieDiff: true,
  uaDiff: true,
  notAdded: false
});

// 浏览器Cookie状态缓存
const browserCookieStatus = ref<{ [domain: string]: boolean }>({});

// 差异检测结果缓存
const diffCache = ref<{ 
  [domain: string]: { 
    cookieDiff: boolean; 
    uaDiff: boolean; 
    timestamp: number;
    browserCookies: string;
  } 
}>({});



// 计算站点状态 - 使用预计算的状态对象
function calculateSiteStatus(site: any) {
  // 如果站点已经有预计算的状态，直接使用
  if (site.status) {
    return site.status;
  }
  
  // 兜底逻辑：如果没有预计算状态，使用原有逻辑
  const domain = new URL(site.url).hostname;
  const hasBrowserCookie = !!browserCookieStatus.value[domain];
  const hasServerConfig = !!(site.cookie || site.apikey || site.token);
  
  return {
    browser: hasBrowserCookie,
    server: hasServerConfig,
    cookieDiff: !!site.cookieDiff,
    uaDiff: !!site.uaDiff,
    notAdded: hasBrowserCookie && !hasServerConfig
  };
}

// 表单数据
const siteForm = reactive({
  url: '',
  rss: '',
  cookie: '',
  ua: '',
  apikey: '',
  token: '',
  pri: 0,
  is_active: true,
  timeout: '',
  downloader: '',
  limit_interval: 0,
  limit_count: 0,
  limit_seconds: 0,
  proxy: false,
  render: false
});

// 站点类型（Cookie/API）
const siteType = ref('cookie');

// 是否启用限流
const isLimit = ref(false);

// 优先级选项 (0-99)
const priorityOptions = ref(
  Array.from({ length: 100 }, (_, i) => i).map(item => ({
    label: item,
    value: item
  }))
);

// 表单验证规则
const siteFormRules = {
  url: [
    { required: true, message: '请输入站点URL', trigger: 'blur' },
    { pattern: /^https?:\/\/.+/, message: '请输入有效的URL地址', trigger: 'blur' }
  ],
  pri: [{ required: true, message: '请选择优先级', trigger: 'change' }]
};

const siteFormRef = ref();

// 计算属性 - 优化后的筛选逻辑
const filteredSites = computed(() => {
  // 如果正在加载，返回空数组避免数值逐步增加
  if (loading.value) {
    return [];
  }
  
  // 获取激活的筛选条件
  const activeFilters = Object.entries(filters)
    .filter(([_, active]) => active)
    .map(([key, _]) => key);
  
  // 如果没有激活的筛选条件，返回所有站点
  if (activeFilters.length === 0) {
    return sites.value;
  }
  
  // 使用优化的筛选逻辑
  return sites.value.filter(site => {
    const status = calculateSiteStatus(site);
    // 使用some()方法检查是否匹配任一选中条件
    return activeFilters.some(filter => status[filter as FilterKeys]);
  });
});

// 已启用站点数量 - 优化计算
const enabledSitesCount = computed(() => {
  // 如果正在加载，返回上次的值避免布局变化
  if (loading.value) {
    return sites.value.filter(site => site.is_active).length;
  }
  return sites.value.filter(site => site.is_active).length;
});

// 待更新站点数量 - 计算有差异的站点数量
const pendingUpdateCount = computed(() => {
  // 如果正在加载，返回上次的值避免布局变化
  if (loading.value) {
    const count = sites.value.filter(site => site.cookieDiff || site.uaDiff).length;
    return count;
  }
  
  const count = sites.value.filter(site => site.cookieDiff || site.uaDiff).length;
  // 同步到共享状态
  updatePendingCount(count);
  return count;
});

// 筛选条件存储键
const FILTERS_STORAGE_KEY = 'site_filters';

// 保存筛选条件到存储
async function saveFiltersToStorage() {
  try {
    const activeFilters = Object.entries(filters)
      .filter(([_, active]) => active)
      .map(([key, _]) => key);
    
    await chrome.storage.sync.set({ [FILTERS_STORAGE_KEY]: activeFilters });
  } catch (error) {
    console.error('保存筛选条件失败:', error);
  }
}

// 从存储加载筛选条件
async function loadFiltersFromStorage() {
  try {
    const result = await chrome.storage.sync.get([FILTERS_STORAGE_KEY]);
    if (result[FILTERS_STORAGE_KEY]) {
      const savedFilters = result[FILTERS_STORAGE_KEY] as string[];
      
      // 重置所有筛选条件
      Object.keys(filters).forEach(key => {
        filters[key as FilterKeys] = false;
      });
      
      // 恢复保存的筛选条件
      savedFilters.forEach((filterKey: string) => {
        if (filterKey in filters) {
          filters[filterKey as FilterKeys] = true;
        }
      });
    } else {
      // 默认勾选 Cookie差异 和 UA差异
      filters.cookieDiff = true;
      filters.uaDiff = true;
    }
  } catch (error) {
    console.error('加载筛选条件失败:', error);
  }
}

// 筛选更新函数
function updateFilter() {
  // 筛选条件改变时，计算属性会自动更新
  // 同时保存到存储
  saveFiltersToStorage();
}

// 打开所有站点
async function openAllSites() {
  try {
    if (filteredSites.value.length === 0) {
      ElMessage.warning('没有可打开的站点');
      return;
    }

    ElMessage.info(`正在打开 ${filteredSites.value.length} 个站点...`);
    
    // 批量打开站点，限制同时打开的标签页数量
    const maxConcurrent = 5; // 最多同时打开5个标签页
    const sites = filteredSites.value;
    
    for (let i = 0; i < sites.length; i += maxConcurrent) {
      const batch = sites.slice(i, i + maxConcurrent);
      const promises = batch.map(site => {
        const siteUrl = site.url || `https://${site.domain}`;
        return chrome.tabs.create({
          url: siteUrl,
          active: false // 不激活新标签页，避免干扰用户
        });
      });
      
      await Promise.all(promises);
      
      // 批次间稍作延迟，避免浏览器限制
      if (i + maxConcurrent < sites.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    ElMessage.success(`已打开 ${sites.length} 个站点`);
  } catch (error) {
    console.error('打开站点失败:', error);
    ElMessage.error('打开站点失败');
  }
}

// 更新所有有差异的站点
async function updateAllSites() {
  try {
    // 只获取有差异且未被禁用且不是API站点的站点
    const sitesWithDiff = filteredSites.value.filter(site => 
      (site.cookieDiff || site.uaDiff) && !(site as any).isDisabled && !isApiSite(site)
    );
    
    if (sitesWithDiff.length === 0) {
      ElMessage.warning('没有需要更新的站点');
      return;
    }

    const result = await ElMessageBox.confirm(
      `确定要更新 ${sitesWithDiff.length} 个有差异的站点信息吗？`,
      '确认更新',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );

    if (result === 'confirm') {
      ElMessage.info(`正在更新 ${sitesWithDiff.length} 个站点信息...`);
      
      let successCount = 0;
      let failCount = 0;
      
      // 批量更新有差异的站点
      for (const site of sitesWithDiff) {
        try {
          await updateSite(site, true);
          successCount++;
        } catch (error) {
          console.error(`更新站点 ${site.name} 失败:`, error);
          failCount++;
        }
      }
      
      // 显示更新结果
      if (failCount === 0) {
        ElMessage.success(`成功更新 ${successCount} 个站点`);
      } else {
        ElMessage.warning(`更新完成：成功 ${successCount} 个，失败 ${failCount} 个`);
      }
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('批量更新站点失败:', error);
      ElMessage.error('批量更新站点失败');
    }
  }
}

// 一键将服务器Cookie覆盖到浏览器
async function overwriteAllCookies() {
  try {
    const sitesToOverwrite = filteredSites.value.filter(site =>
      site.cookie && site.cookieDiff && !(site as any).isDisabled && !isApiSite(site)
    );

    if (sitesToOverwrite.length === 0) {
      ElMessage.warning('没有需要覆盖的站点');
      return;
    }

    const result = await ElMessageBox.confirm(
      `确定要将 ${sitesToOverwrite.length} 个站点的服务器 Cookie 覆盖到浏览器吗？`,
      '确认一键覆盖',
      {
        confirmButtonText: '确定覆盖',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );

    if (result === 'confirm') {
      ElMessage.info(`正在覆盖 ${sitesToOverwrite.length} 个站点的 Cookie...`);

      let successCount = 0;
      let failCount = 0;

      for (const site of sitesToOverwrite) {
        try {
          await overwriteCookie(site, false);
          successCount++;
        } catch (error) {
          console.error(`覆盖站点 ${site.name || site.domain || site.url} Cookie 失败:`, error);
          failCount++;
        }
      }

      if (failCount === 0) {
        ElMessage.success(`成功覆盖 ${successCount} 个站点 Cookie`);
      } else {
        ElMessage.warning(`覆盖完成：成功 ${successCount} 个，失败 ${failCount} 个`);
      }
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('一键覆盖Cookie失败:', error);
      ElMessage.error('一键覆盖Cookie失败');
    }
  }
}

// 获取站点状态类型
function getStatusType(site: Site) {
  if (!site.is_active) return 'info';
  if (isApiSite(site)) return 'success';
  if (site.cookieDiff && hasBrowserCookie(site)) return 'warning';
  if (site.cookieDiff && !hasBrowserCookie(site) && site.cookie) return 'info';
  if (site.uaDiff) return 'warning';
  if (site.cookie || site.apikey || site.token) return 'success';
  return 'danger';
}

// 获取站点状态文本
function getStatusText(site: Site) {
  if (!site.is_active) return '停用';
  if (isApiSite(site)) return '正常';
  if (site.cookieDiff && hasBrowserCookie(site)) return 'Cookie待更新';
  if (site.cookieDiff && !hasBrowserCookie(site) && site.cookie) return '浏览器未登陆';
  if (site.uaDiff) return 'UA待更新';
  if (site.cookie || site.apikey || site.token) return '正常';
  return '需要配置';
}

// 检查Cookie差异
async function hasCookieDiff(site: Site) {
  try {
    // 获取浏览器中该域名的Cookie
    const browserCookies = await getBrowserCookies(site.url);
    
    // 服务器端Cookie
    const serverCookies = site.cookie || '';
    
    // 如果服务器端和浏览器都没有Cookie，则无差异
    if (!serverCookies && !browserCookies) {
      return false;
    }
    
    // 如果只有一边有Cookie，则有差异
    if (!serverCookies || !browserCookies) {
      return true;
    }
    
    // 简单比较Cookie字符串
    return serverCookies !== browserCookies;
  } catch (error) {
    console.error('检查Cookie差异失败:', error);
    return false;
  }
}

// 检查UA差异 - 简化版本
function hasUADiff(site: Site) {
  // 获取浏览器当前User-Agent
  const browserUA = navigator.userAgent;
  
  // 服务器端UA
  const serverUA = site.ua || '';
  
  // 如果服务器端和浏览器都没有UA，则无差异
  if (!serverUA && !browserUA) {
    return false;
  }
  
  // 简单比较UA字符串
  return serverUA !== browserUA;
}

// 覆盖Cookie到浏览器
async function overwriteCookie(site: Site, showMessage = true) {
  try {
    if (!site.cookie) {
      if (showMessage) ElMessage.warning('服务器端没有配置Cookie，无法覆盖');
      return;
    }

    if (showMessage) ElMessage.info('正在覆盖Cookie到浏览器...');
    
    // 1. 解析服务器Cookie
    const serverCookies = parseCookies(site.cookie);
    
    // 2. 设置到浏览器
    await setBrowserCookies(site.url, serverCookies);
    
    // 3. 更新该站点的差异状态
    site.cookieDiff = false;
    const domain = new URL(site.url).hostname;
    browserCookieStatus.value[domain] = true;
    if (diffCache.value[domain]) {
      diffCache.value[domain].cookieDiff = false;
      diffCache.value[domain].browserCookies = site.cookie;
    }
    
    if (showMessage) ElMessage.success('Cookie覆盖成功');
  } catch (error: any) {
    console.error('覆盖Cookie失败:', error);
    if (showMessage) ElMessage.error(`覆盖Cookie失败: ${error.message || '未知错误'}`);
    throw error;
  }
}

// 更新站点Cookie和UA到服务器
async function updateSite(site: Site, silent = false) {
  try {
    if (!silent) ElMessage.info('正在更新站点信息到服务器...');
    
    // 1. 获取浏览器当前Cookie和UA
    const browserCookies = await getBrowserCookies(site.url);
    const browserUA = navigator.userAgent;
    
    // 2. 准备更新数据
    const updateData = {
      ...site,
      cookie: browserCookies,
      ua: browserUA
    };
    
    // 3. 调用API更新站点
    const client = createMpApiClient({
      baseURL: await getBaseUrl(),
      getToken: getToken
    });
    await client.put('/api/v1/site/', updateData);
    
    // 4. 更新本地站点数据
    Object.assign(site, updateData);
    
    // 5. 重新检测差异
    site.cookieDiff = await hasCookieDiff(site);
    site.uaDiff = hasUADiff(site);
    
    if (!silent) ElMessage.success('站点信息更新成功');
  } catch (error: any) {
    console.error('更新站点失败:', error);
    if (!silent) ElMessage.error(`更新站点失败: ${error.message || '未知错误'}`);
    throw error;
  }
}

// 解析Cookie字符串
function parseCookies(cookieString: string) {
  const cookies: { [key: string]: string } = {};
  if (!cookieString) return cookies;
  
  cookieString.split(';').forEach(cookie => {
    const trimmed = cookie.trim();
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex > 0) {
      const name = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim();
      if (name) cookies[name] = value;
    }
  });
  
  return cookies;
}

// 批量获取浏览器Cookie - 大幅减少API调用次数
async function getBatchBrowserCookies(domains: string[]): Promise<{ [domain: string]: string }> {
  try {
    // 一次性获取所有Cookie
    const allCookies = await chrome.cookies.getAll({});
    
    // 按域名分组
    const cookiesMap: { [domain: string]: string } = {};
    
    domains.forEach(domain => {
      const domainCookies = allCookies.filter(cookie => {
        // 匹配主域名
        if (cookie.domain === domain || cookie.domain === `.${domain}`) {
          return true;
        }
        
        // 匹配子域名
        if (domain.startsWith('www.') && cookie.domain === domain.substring(4)) {
          return true;
        }
        
        if (!domain.startsWith('www.') && cookie.domain === `www.${domain}`) {
          return true;
        }
        
        return false;
      });
      
      cookiesMap[domain] = domainCookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
    });
    
    return cookiesMap;
  } catch (error) {
    console.error('批量获取浏览器Cookie失败:', error);
    return {};
  }
}

// 获取浏览器Cookie - 优化API调用
async function getBrowserCookies(url: string) {
  try {
    const domain = new URL(url).hostname;
    
    // 检查是否已经缓存了该域名的Cookie状态
    if (browserCookieStatus.value[domain] !== undefined) {
      // 如果已经知道有Cookie，直接返回缓存的Cookie字符串
      const cached = diffCache.value[domain];
      if (cached && cached.browserCookies) {
        return cached.browserCookies;
      }
    }
    
    const cookies = await chrome.cookies.getAll({ domain });
    const cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
    
    // 缓存结果
    browserCookieStatus.value[domain] = !!cookieString;
    
    return cookieString;
  } catch (error) {
    console.error('获取浏览器Cookie失败:', error);
    return '';
  }
}

// 设置浏览器Cookie
async function setBrowserCookies(url: string, cookies: { [key: string]: string }) {
  try {
    const domain = new URL(url).hostname;

    const existingCookies = await chrome.cookies.getAll({ domain });
    for (const cookie of existingCookies) {
      const cookieDomain = cookie.domain.replace(/^\./, '');
      const removeUrl = `${cookie.secure ? 'https' : 'http'}://${cookieDomain}${cookie.path || '/'}`;
      await chrome.cookies.remove({
        url: removeUrl,
        name: cookie.name
      });
    }
    
    for (const [name, value] of Object.entries(cookies)) {
      await chrome.cookies.set({
        url: url,
        name: name,
        value: value,
        domain: domain
      });
    }
  } catch (error) {
    console.error('设置浏览器Cookie失败:', error);
    throw error;
  }
}


// 判断是否为API站点（配置了apikey或token）
function isApiSite(site: Site): boolean {
  return !!(site.apikey || site.token);
}

// 检查浏览器是否有该站点的Cookie
function hasBrowserCookie(site: Site): boolean {
  const domain = new URL(site.url).hostname;
  return !!browserCookieStatus.value[domain];
}

// 打开站点登录页面
async function openSiteLogin(site: Site) {
  try {
    const siteUrl = site.url || `https://${site.domain}`;
    await chrome.tabs.create({
      url: siteUrl,
      active: true // 激活新标签页，让用户直接看到登录页面
    });
    ElMessage.info(`已打开 ${site.name || site.domain} 登录页面`);
  } catch (error) {
    console.error('打开站点失败:', error);
    ElMessage.error('打开站点失败');
  }
}

// 切换站点禁用状态
async function toggleSiteDisable(site: Site) {
  (site as any).isDisabled = !(site as any).isDisabled;
  const status = (site as any).isDisabled ? '禁用' : '开启';
  
  // 保存禁用状态到本地存储
  await saveSiteDisableState(site);
  
  ElMessage.success(`站点已${status}更新.`);
}

// 保存站点禁用状态到本地存储
async function saveSiteDisableState(site: Site) {
  try {
    const domain = new URL(site.url).hostname;
    const storageKey = `site_disable_${domain}`;
    const disableState = (site as any).isDisabled || false;
    
    await chrome.storage.local.set({
      [storageKey]: disableState
    });
  } catch (error) {
    console.error('保存站点禁用状态失败:', error);
  }
}

// 从本地存储加载站点禁用状态
async function loadSiteDisableState(site: Site): Promise<boolean> {
  try {
    const domain = new URL(site.url).hostname;
    const storageKey = `site_disable_${domain}`;
    
    const result = await chrome.storage.local.get([storageKey]);
    return (result as any)[storageKey] === true;
  } catch (error) {
    console.error('加载站点禁用状态失败:', error);
    return false;
  }
}

// 处理菜单命令
function handleMenuCommand(command: {action: string, site: Site}) {
  const { action, site } = command;
  switch (action) {
    case 'test':
      testConnection(site);
      break;
    case 'edit':
      editSite(site);
      break;
    case 'toggleDisable':
      toggleSiteDisable(site);
      break;
    case 'delete':
      deleteSite(site);
      break;
  }
}

// 获取站点列表 - 重构为预计算状态
async function fetchSites() {
  try {
    loading.value = true;
    
    const baseURL = await getBaseUrl();
    const client = createMpApiClient({ baseURL, getToken });
    const response = await client.get('/api/v1/site/');
    
    // 插件API客户端返回完整响应，需要访问response.data
    const responseData = response.data;
    
    // 检查响应数据结构
    let sitesData: Site[] = [];
    if (Array.isArray(responseData)) {
      sitesData = responseData;
    } else if (responseData && Array.isArray(responseData.data)) {
      sitesData = responseData.data;
    } else if (responseData && Array.isArray(responseData.sites)) {
      sitesData = responseData.sites;
    } else {
      console.error('意外的响应结构:', responseData);
      sitesData = [];
    }
    
    // 批量获取所有域名的Cookie，减少API调用次数
    const allDomains = sitesData.map(site => new URL(site.url).hostname);
    const browserCookiesMap = await getBatchBrowserCookies(allDomains);
    
    // 预计算所有站点状态
    const sitesWithStatus = await Promise.all(sitesData.map(async site => {
      const domain = new URL(site.url).hostname;
      const browserCookies = browserCookiesMap[domain] || '';
      const serverCookies = site.cookie || '';
      const browserUA = navigator.userAgent;
      const serverUA = site.ua || '';
      
      // 预计算状态
      const cookieDiff = serverCookies !== browserCookies;
      const uaDiff = serverUA !== browserUA;
      
      // 加载禁用状态
      const isDisabled = await loadSiteDisableState(site);
      
      return {
        ...site,
        cookieDiff,
        uaDiff,
        browserCookies,
        isDisabled,
        // 预计算站点状态
        status: {
          browser: !!browserCookies,
          server: !!(site.cookie || site.apikey || site.token),
          cookieDiff,
          uaDiff,
          notAdded: !!browserCookies && !(site.cookie || site.apikey || site.token)
        }
      };
    }));
    
    // 设置站点数据
    sites.value = sitesWithStatus;
    
    // 更新浏览器Cookie状态缓存
    Object.keys(browserCookiesMap).forEach(domain => {
      browserCookieStatus.value[domain] = !!browserCookiesMap[domain];
    });
    
    // 关闭loading
    loading.value = false;
    
  } catch (error: any) {
    console.error('获取站点列表失败:', error);
    ElMessage.error(`获取站点列表失败: ${error.message || '未知错误'}`);
    loading.value = false;
  }
}

// 刷新站点列表
async function refreshSites() {
  // 清除缓存，强制重新检测
  diffCache.value = {};
  browserCookieStatus.value = {};
  
  await fetchSites();
  ElMessage.success('刷新成功');
}

// 测试连接
async function testConnection(site: Site) {
  try {
    ElMessage.info('正在测试连接...');
    
    const client = createMpApiClient({ baseURL: await getBaseUrl(), getToken });
    const response = await client.get(`/api/v1/site/test/${site.id}`);
    
    const responseData = response.data;
    if (responseData?.success) {
      ElMessage.success(`站点 ${site.name || site.domain} 连接测试成功`);
    } else {
      ElMessage.error(`站点 ${site.name || site.domain} 连接测试失败: ${responseData?.message || '未知错误'}`);
    }
  } catch (error: any) {
    console.error('连接测试失败:', error);
    const errorMessage = error.response?.data?.message || error.message || '连接测试失败';
    ElMessage.error(`站点 ${site.name || site.domain} 连接测试失败: ${errorMessage}`);
  }
}

// 编辑站点
function editSite(site: Site) {
  editingSite.value = site;
  Object.assign(siteForm, {
    url: site.url,
    rss: site.rss || '',
    cookie: site.cookie || '',
    ua: site.ua || '',
    apikey: site.apikey || '',
    token: site.token || '',
    pri: site.pri,
    is_active: site.is_active,
    timeout: site.timeout ? site.timeout.toString() : '',
    downloader: site.downloader || '',
    limit_interval: site.limit_interval || 0,
    limit_count: site.limit_count || 0,
    limit_seconds: site.limit_seconds || 0,
    proxy: Number(site.proxy) === 1,
    render: Number(site.render) === 1
  });
  
  // 设置站点类型
  if (site.apikey || site.token) {
    siteType.value = 'api';
  } else {
    siteType.value = 'cookie';
  }
  
  // 设置限流状态
  isLimit.value = !!(site.limit_interval || site.limit_count || site.limit_seconds);
  
  showAddDialog.value = true;
}

// 删除站点
async function deleteSite(site: Site) {
  try {
    await ElMessageBox.confirm(
      `确定要删除站点 "${site.url}" 吗？`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );
    
    const client = createMpApiClient({ baseURL: await getBaseUrl(), getToken });
    const response = await client.delete(`site/${site.id}`);
    
    const responseData = response.data;
    if (responseData?.success) {
      ElMessage.success('删除成功');
      await fetchSites();
    } else {
      ElMessage.error(responseData?.message || '删除失败');
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除站点失败:', error);
      ElMessage.error('删除站点失败');
    }
  }
}

// 保存站点
async function saveSite() {
  try {
    await siteFormRef.value?.validate();
    submitting.value = true;
    
    // 处理限流设置
    const formData = { ...siteForm };
    if (isLimit.value) {
      formData.limit_interval = formData.limit_interval || 0;
      formData.limit_count = formData.limit_count || 0;
      formData.limit_seconds = formData.limit_seconds || 0;
    } else {
      formData.limit_interval = 0;
      formData.limit_count = 0;
      formData.limit_seconds = 0;
    }
    
    const client = createMpApiClient({ baseURL: await getBaseUrl(), getToken });
    
    // 处理数据类型转换
    const apiData = {
      ...formData,
      proxy: formData.proxy ? 1 : 0,
      render: formData.render ? 1 : 0,
      timeout: formData.timeout ? parseInt(formData.timeout) || 15 : 15
    };
    
    if (editingSite.value) {
      // 更新站点
      const response = await client.put('/api/v1/site/', {
        ...apiData,
        id: editingSite.value.id
      });
      
      const responseData = response.data;
      if (responseData?.success) {
        ElMessage.success('更新成功');
      } else {
        ElMessage.error(responseData?.message || '更新失败');
        return;
      }
    } else {
      // 添加站点
      const response = await client.post('/api/v1/site/', apiData);
      
      const responseData = response.data;
      if (responseData?.success) {
        ElMessage.success('添加成功');
      } else {
        ElMessage.error(responseData?.message || '添加失败');
        return;
      }
    }
    
    showAddDialog.value = false;
    editingSite.value = null;
    resetForm();
    await fetchSites();
  } catch (error: any) {
    console.error('保存站点失败:', error);
    let errorMessage = '保存站点失败';
    
    if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    ElMessage.error(errorMessage);
  } finally {
    submitting.value = false;
  }
}

// 重置表单
function resetForm() {
  Object.assign(siteForm, {
    url: '',
    rss: '',
    cookie: '',
    ua: '',
    apikey: '',
    token: '',
    pri: 0,
    is_active: true,
    timeout: '',
    downloader: '',
    limit_interval: 0,
    limit_count: 0,
    limit_seconds: 0,
    proxy: false,
    render: false
  });
  siteType.value = 'cookie';
  isLimit.value = false;
  siteFormRef.value?.clearValidate();
}

// 组件挂载时获取数据
onMounted(async () => {
  await loadFiltersFromStorage(); // 加载保存的筛选条件
  // 加载下载器列表
  try {
    downloaderOptions.value = await downloadApi.getDownloadClients();
  } catch (e) {
    console.warn('获取下载器列表失败:', e);
    downloaderOptions.value = [];
  }
  await fetchSites(); // 直接加载站点数据
});
</script>

<style scoped>
.site-management {
  padding: 8px;
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  position: relative;
}

/* 统计面板样式 */
.stats-panel {
  display: flex;
  gap: 6px;
  margin-bottom: 6px;
  padding: 8px;
  background: transparent;
  border-radius: 10px;
  width: 100%;
  box-sizing: border-box;
  overflow: hidden;
}

.stat-item {
  flex: 1;
  text-align: center;
  padding: 8px 6px;
  border-radius: 8px;
  box-sizing: border-box;
  min-width: 0;
  overflow: hidden;
}

.stat-number {
  font-size: 20px;
  font-weight: 700;
  line-height: 24px;
  margin-bottom: 2px;
}

.stat-label {
  font-size: 11px;
  font-weight: 500;
}

/* 已配置站点 - 蓝色主题 */
.stat-config {
  background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%);
  border-color: #bbdefb;
}
.stat-config .stat-number { color: #1976d2; }
.stat-config .stat-label { color: #1565c0; }

/* 已启用站点 - 绿色主题 */
.stat-enabled {
  background: linear-gradient(135deg, #e8f5e8 0%, #f1f8e9 100%);
  border-color: #c8e6c9;
}
.stat-enabled .stat-number { color: #388e3c; }
.stat-enabled .stat-label { color: #2e7d32; }

/* 过滤后 - 橙色主题 */
.stat-filtered {
  background: linear-gradient(135deg, #fff3e0 0%, #fce4ec 100%);
  border-color: #ffcc80;
}
.stat-filtered .stat-number { color: #f57c00; }
.stat-filtered .stat-label { color: #ef6c00; }

/* 待更新 - 紫色主题 */
.stat-pending {
  background: linear-gradient(135deg, #f3e5f5 0%, #e8eaf6 100%);
  border-color: #ce93d8;
}
.stat-pending .stat-number { color: #7b1fa2; }
.stat-pending .stat-label { color: #6a1b9a; }

/* 工具栏样式 */
.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 6px;
  padding: 8px 12px;
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  width: 100%;
  box-sizing: border-box;
  overflow: hidden;
}

/* 防止Element Plus loading指令影响布局 */
:deep(.el-loading-mask) {
  border: none !important;
  margin: 0 !important;
  padding: 0 !important;
  box-sizing: border-box !important;
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  width: 100% !important;
  height: 100% !important;
}

:deep(.el-loading-spinner) {
  margin: 0 !important;
  padding: 0 !important;
}

/* 强制固定所有子元素的宽度 */
.site-management * {
  max-width: 100% !important;
  box-sizing: border-box !important;
}


.filter-section {
  display: flex;
  gap: 4px;
  align-items: center;
  flex-wrap: wrap;
  flex: 1;
  justify-content: flex-start;
  row-gap: 2px;
  min-width: 0;
}

.filter-section .el-checkbox {
  margin-right: 0;
}

.filter-section .el-checkbox__label {
  font-size: 12px;
  color: #374151;
}

.action-section {
  display: flex;
  gap: 0px;
  align-items: center;
  flex-shrink: 0;
  flex-wrap: nowrap;
  justify-content: flex-end;
}

.action-btn {
  white-space: nowrap;
  font-size: 11px;
  padding: 6px 6px;
  height: auto;
  min-width: auto;
  width: auto;
  flex: none;
  margin-left: 3px;
}

.action-btn:first-child {
  margin-left: 0;
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

.site-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.site-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 16px;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.site-card:hover {
  border-color: #3b82f6;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
}

.site-card.site-inactive {
  opacity: 0.7;
  border-color: #9ca3af;
  background-color: #f9fafb;
  color: #6b7280;
}

.site-card.site-inactive .site-name {
  color: #6b7280;
}

.site-card.site-inactive .site-url {
  color: #9ca3af;
}

.site-card.site-disabled {
  opacity: 0.6;
  border-color: #fca5a5;
  background-color: #fef2f2;
  position: relative;
}

.site-card.site-disabled::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 2px,
    rgba(239, 68, 68, 0.1) 2px,
    rgba(239, 68, 68, 0.1) 4px
  );
  pointer-events: none;
  border-radius: 12px;
}

.site-card.site-disabled .site-name {
  color: #dc2626;
}

.site-card.site-disabled .site-url {
  color: #f87171;
}

.site-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0;
}

.site-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.site-tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.diff-tag {
  font-size: 10px;
  padding: 2px 6px;
  height: auto;
  line-height: 1.2;
}

.site-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
}

.menu-icon {
  margin-right: 4px;
  fill: currentColor;
}

.site-name {
  font-size: 14px;
  font-weight: 500;
  color: #1f2937;
  word-break: break-all;
  line-height: 1.4;
  margin-bottom: 4px;
}

.site-url {
  font-size: 12px;
  color: #6b7280;
  word-break: break-all;
  line-height: 1.3;
  font-family: 'Courier New', monospace;
}

.site-status {
  flex-shrink: 0;
}

.site-details {
  margin-bottom: 12px;
}

.detail-item {
  display: flex;
  margin-bottom: 4px;
  font-size: 14px;
}

.detail-item .label {
  color: #6b7280;
  width: 60px;
  flex-shrink: 0;
}

.detail-item .value {
  color: #1f2937;
  flex: 1;
  word-break: break-all;
}

.site-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.icon-btn {
  fill: currentColor;
  margin-right: 4px;
}

.icon-prefix {
  opacity: 0.6;
}

/* 对话框样式 */
:deep(.site-dialog) {
  max-height: 95vh;
}

:deep(.site-dialog .el-dialog) {
  max-height: 95vh;
  display: flex;
  flex-direction: column;
  margin: 0;
  height: 95vh;
}

:deep(.site-dialog .el-dialog__header) {
  flex-shrink: 0;
  padding: 20px 20px 10px 20px;
}

:deep(.site-dialog .el-dialog__body) {
  flex: 1;
  overflow: hidden;
  padding: 10px 20px;
  display: flex;
  flex-direction: column;
}

:deep(.site-dialog .el-dialog__footer) {
  flex-shrink: 0;
  padding: 10px 20px 20px 20px;
}

.dialog-content {
  flex: 1;
  overflow-y: auto;
  padding-right: 8px;
  min-height: 0;
}

.site-form {
  max-width: 100%;
}

.site-form .el-form-item {
  margin-bottom: 12px;
}

.site-form .el-input,
.site-form .el-textarea,
.site-form .el-input-number {
  width: 100%;
}



/* 主要布局 */
.main-layout {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 24px;
}

.top-section {
  width: 100%;
}

.bottom-section {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-row {
  display: grid !important;
  grid-template-columns: 1fr 1fr 1fr 1fr !important;
  gap: 16px;
  align-items: start;
}

.right-section .form-group {
  margin-bottom: 12px;
}

.form-row .form-group {
  margin-bottom: 0;
}

/* 表单组样式 */
.form-group {
  margin-bottom: 12px;
}

.bottom-section .form-group {
  margin-bottom: 8px;
}

.form-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 6px;
}

.label-icon {
  fill: #6b7280;
}

/* 图标颜色适配 */
.form-label .label-icon[data-icon="mdiToggleSwitch"] {
  fill: #10b981;
}

.form-label .label-icon[data-icon="mdiPriorityHigh"] {
  fill: #f59e0b;
}

.form-label .label-icon[data-icon="mdiTimer"] {
  fill: #8b5cf6;
}

.form-label .label-icon[data-icon="mdiDownload"] {
  fill: #06b6d4;
}

.form-label .label-icon[data-icon="mdiWeb"] {
  fill: #3b82f6;
}

.form-label .label-icon[data-icon="mdiRss"] {
  fill: #f97316;
}

.form-label .label-icon[data-icon="mdiCookie"] {
  fill: #84cc16;
}

.form-label .label-icon[data-icon="mdiAccount"] {
  fill: #6366f1;
}

.form-label .label-icon[data-icon="mdiKey"] {
  fill: #ef4444;
}

.form-label .label-icon[data-icon="mdiApi"] {
  fill: #ec4899;
}


.form-input {
  width: 100%;
}

.form-input-number {
  width: 100%;
}

.form-select {
  width: 100%;
}

/* 表单行中的字段样式优化 */
.form-row .form-select,
.form-row .form-input {
  width: 100%;
}

/* 状态开关特殊样式 */
.status-group {
  margin-bottom: 8px;
}

.status-content {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 4px;
}

.status-content .form-label {
  margin-bottom: 0;
}

/* 下载器选择框特殊样式 */
.downloader-group .downloader-select {
  max-width: 150px;
}

.downloader-group {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.form-textarea {
  width: 100%;
}

.form-hint {
  font-size: 12px;
  color: #6b7280;
  margin-top: 4px;
  line-height: 1.4;
}

/* 开关颜色适配 */
:deep(.el-switch.is-checked .el-switch__core) {
  background-color: #10b981;
  border-color: #10b981;
}

:deep(.el-switch.is-checked .el-switch__action) {
  background-color: #ffffff;
}

/* 修复开关按钮光标跟随问题 */
.bottom-options :deep(.el-switch) {
  outline: none !important;
  user-select: none !important;
  -webkit-user-select: none !important;
  -moz-user-select: none !important;
  -ms-user-select: none !important;
  cursor: pointer !important;
}

.bottom-options :deep(.el-switch:focus) {
  outline: none !important;
  box-shadow: none !important;
}

.bottom-options :deep(.el-switch:focus-visible) {
  outline: none !important;
  box-shadow: none !important;
}

.bottom-options :deep(.el-switch__core) {
  outline: none !important;
  user-select: none !important;
  -webkit-user-select: none !important;
  -moz-user-select: none !important;
  -ms-user-select: none !important;
  cursor: pointer !important;
}

.bottom-options :deep(.el-switch__core:focus) {
  outline: none !important;
  box-shadow: none !important;
}

.bottom-options :deep(.el-switch__core:focus-visible) {
  outline: none !important;
  box-shadow: none !important;
}

.bottom-options :deep(.el-switch__action) {
  outline: none !important;
  user-select: none !important;
  -webkit-user-select: none !important;
  -moz-user-select: none !important;
  -ms-user-select: none !important;
  cursor: pointer !important;
}

.bottom-options :deep(.el-switch__action:focus) {
  outline: none !important;
  box-shadow: none !important;
}

.bottom-options :deep(.el-switch__action:focus-visible) {
  outline: none !important;
  box-shadow: none !important;
}

/* 防止开关按钮获得焦点 */
.bottom-options :deep(.el-switch input) {
  position: absolute !important;
  left: -9999px !important;
  opacity: 0 !important;
  pointer-events: none !important;
}

/* 防止开关按钮区域文字光标跟随 */
.bottom-options {
  user-select: none !important;
  -webkit-user-select: none !important;
  -moz-user-select: none !important;
  -ms-user-select: none !important;
}

.bottom-options * {
  user-select: none !important;
  -webkit-user-select: none !important;
  -moz-user-select: none !important;
  -ms-user-select: none !important;
}

/* 允许输入框正常选择文字 */
.dialog-content input,
.dialog-content textarea {
  user-select: text !important;
  -webkit-user-select: text !important;
  -moz-user-select: text !important;
  -ms-user-select: text !important;
}

/* 选项标签样式 */
.option-label {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  margin-left: 8px;
}

/* 认证选项卡样式 */
.auth-section {
  margin-bottom: 16px;
}

.auth-tabs :deep(.el-tabs__header) {
  margin-bottom: 16px;
}

.auth-tabs :deep(.el-tabs__nav-wrap) {
  padding: 4px;
}

.auth-tabs :deep(.el-tabs__nav) {
  display: flex;
  gap: 4px;
}

.auth-tabs :deep(.el-tabs__item) {
  padding: 8px 16px;
  font-weight: 500;
  color: #6b7280;
  background: transparent;
  border: none;
  transition: all 0.2s;
}

.auth-tabs :deep(.el-tabs__item.is-active) {
  color: #6366f1;
  font-weight: 600;
}

.tab-label {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tab-icon {
  fill: currentColor;
}

/* 选项卡图标颜色适配 */
.tab-icon[data-icon="mdiCookie"] {
  fill: #84cc16;
}

.tab-icon[data-icon="mdiApi"] {
  fill: #ec4899;
}

.auth-content {
  padding: 16px;
}

/* 底部选项样式 */
.bottom-options {
  display: flex;
  flex-direction: row;
  gap: 24px;
  margin-bottom: 16px;
  padding: 12px;
  flex-wrap: wrap;
}

.option-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.option-label {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.option-hint {
  font-size: 12px;
  color: #6b7280;
  margin-left: 28px;
  margin-top: -8px;
}

/* 限流设置样式 */
.limit-settings {
  padding: 12px;
  margin-bottom: 12px;
}

.limit-title {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 12px;
}

.limit-fields {
  display: flex;
  gap: 16px;
}

.limit-fields .form-group {
  flex: 1;
  margin-bottom: 0;
}

/* 对话框内容样式优化 */
.dialog-content {
  flex: 1;
  overflow-y: auto;
  padding-right: 8px;
  min-height: 0;
}

/* 响应式设计 */
@media (max-width: 480px) {
  .toolbar {
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
  }
  
  .filter-section {
    justify-content: center;
    gap: 6px;
  }
  
  .action-section {
    justify-content: center;
    gap: 0px;
    flex-wrap: nowrap;
  }
  
  .action-btn {
    flex: none;
    min-width: auto;
  }
  
  .site-actions {
    flex-wrap: wrap;
  }
  
  :deep(.site-dialog) {
    width: 95% !important;
    margin: 0 auto;
  }
  
  :deep(.site-dialog .el-dialog) {
    height: 100vh;
    max-height: 100vh;
  }
  
  .dialog-content {
    flex: 1;
    min-height: 0;
  }
  
  .form-section {
    padding: 8px;
    margin-bottom: 12px;
  }
  
  .section-title {
    font-size: 13px;
    margin-bottom: 8px;
  }
  
  .site-form .el-form-item {
    margin-bottom: 8px;
  }
  
  /* 主要布局响应式 */
  .main-layout {
    flex-direction: column;
    gap: 16px;
  }
  
  .bottom-section {
    gap: 8px;
  }
  
  .form-group {
    margin-bottom: 8px;
  }
  
  .auth-section {
    margin-bottom: 12px;
  }
  
  .bottom-options {
    padding: 8px;
    gap: 16px;
    margin-bottom: 12px;
  }
  
  .limit-settings {
    padding: 8px;
    margin-bottom: 8px;
  }
  
  .limit-fields {
    flex-direction: row;
    gap: 8px;
  }
  
  .form-row .form-group {
    margin-bottom: 12px;
  }
  
  .status-content {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}

/* 中等屏幕优化 */
@media (max-width: 768px) and (min-width: 481px) {
  .form-row {
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
}

/* 超小屏幕优化 */
@media (max-width: 480px) {
  .form-row {
    grid-template-columns: 1fr;
    gap: 8px;
  }
}
</style>
