<template>
  <div class="about-root">
    <section class="hero">
      <div class="logo-wrap">
        <img :src="logoUrl" alt="logo" class="logo" />
      </div>
      <div class="hero-main">
        <div class="eyebrow">MoviePilot Extension</div>
        <div class="title">MoviePilot Tools</div>
        <div class="subtitle">
          在扩展中统一管理站点、下载、凭据、两步验证、智能助手与加密备份。
        </div>
      </div>
      <div class="version-wrap">
        <div
          class="version"
          :class="{ 'is-checking': isChecking }"
          :title="isChecking ? '正在检查版本更新...' : '当前扩展版本，点击可重新检查更新'"
          role="button"
          tabindex="0"
          @click="checkUpdate(true)"
          @keydown.enter="checkUpdate(true)"
        >
          v{{ extVersion || '-' }}
        </div>
        <button
          v-if="hasUpdate && latestRelease"
          type="button"
          class="update-badge"
          :class="{ 'is-downloading': isDownloading }"
          :disabled="isDownloading"
          :title="`发现新版本 ${latestRelease.tagName}，点击一键下载更新包`"
          @click="handleDownloadUpdate"
        >
          <span class="update-pulse-dot" aria-hidden="true"></span>
          <span class="update-text">{{ isDownloading ? '下载中' : '可用更新' }}</span>
          <span class="update-ver">{{ latestRelease.tagName }}</span>
          <svg viewBox="0 0 24 24" width="12" height="12" class="update-icon" aria-hidden="true">
            <path :d="mdiDownload" />
          </svg>
        </button>
      </div>
    </section>

    <!-- 导航功能总览 -->
    <section class="section">
      <div class="section-heading">
        <span class="section-kicker">Navigation</span>
        <span class="section-title">功能导航</span>
      </div>
      <div class="nav-list">
        <div v-for="item in navItems" :key="item.label" class="nav-item">
          <div class="nav-icon-wrap" :class="item.colorClass">
            <svg viewBox="0 0 24 24" width="19" height="19">
              <path :d="item.icon" />
            </svg>
          </div>
          <div class="nav-text">
            <div class="nav-label">{{ item.label }}</div>
            <div class="nav-desc">{{ item.desc }}</div>
          </div>
        </div>
      </div>
    </section>

    <!-- 站点管理 -->
    <section class="section">
      <div class="section-heading">
        <span class="section-kicker">Sites</span>
        <span class="section-title">站点管理</span>
      </div>
      <div class="feature-compact">
        <div class="fc-item">
          <div class="fc-label">双端站点视图</div>
          <div class="fc-desc">统一展示浏览器会话、MoviePilot 已配置站点与未拥有站点。</div>
        </div>
        <div class="fc-item">
          <div class="fc-label">七项筛选</div>
          <div class="fc-desc">按浏览器、服务器、CK 差异、UA 差异、未登录、未添加和未拥有筛选。</div>
        </div>
        <div class="fc-item">
          <div class="fc-label">同步与批量操作</div>
          <div class="fc-desc">覆盖浏览器 Cookie、更新服务器 Cookie/UA，并支持测试、禁用和批量打开。</div>
        </div>
        <div class="fc-item">
          <div class="fc-label">主备域名</div>
          <div class="fc-desc">为同一站点关联多个域名，并在主域名与备用域名之间安全切换。</div>
        </div>
      </div>
    </section>

    <!-- 站点数据 -->
    <section class="section">
      <div class="section-heading">
        <span class="section-kicker">Statistics</span>
        <span class="section-title">站点数据</span>
      </div>
      <div class="feature-compact">
        <div class="fc-item">
          <div class="fc-label">数据总览</div>
          <div class="fc-desc">展示总上传、总下载、总做种数、总做种体积。</div>
        </div>
        <div class="fc-item">
          <div class="fc-label">排序搜索</div>
          <div class="fc-desc">支持按上传量/下载量/做种量/耗时排序与关键字搜索。</div>
        </div>
        <div class="fc-item">
          <div class="fc-label">数据导出</div>
          <div class="fc-desc">支持导出为图片、JSON、CSV 格式。</div>
        </div>
        <div class="fc-item">
          <div class="fc-label">隐私模式</div>
          <div class="fc-desc">一键隐藏敏感数据，保护隐私安全。</div>
        </div>
      </div>
    </section>

    <!-- 下载管理 -->
    <section class="section">
      <div class="section-heading">
        <span class="section-kicker">Downloads</span>
        <span class="section-title">下载管理</span>
      </div>
      <div class="feature-compact">
        <div class="fc-item">
          <div class="fc-label">多下载器</div>
          <div class="fc-desc">支持切换多个下载器查看任务列表。</div>
        </div>
        <div class="fc-item">
          <div class="fc-label">多种添加方式</div>
          <div class="fc-desc">支持种子链接、磁力链接、站点链接添加下载。</div>
        </div>
        <div class="fc-item">
          <div class="fc-label">PT 浮动按钮</div>
          <div class="fc-desc">在 PT 站点详情页注入一键下载浮动按钮，直达下载管理器。</div>
        </div>
      </div>
    </section>

    <!-- 两步验证 -->
    <section class="section">
      <div class="section-heading">
        <span class="section-kicker">TOTP</span>
        <span class="section-title">两步验证</span>
      </div>
      <div class="feature-compact">
        <div class="fc-item">
          <div class="fc-label">验证码管理</div>
          <div class="fc-desc">管理多个站点的 TOTP 密钥，实时生成 6 位验证码并复制。</div>
        </div>
        <div class="fc-item">
          <div class="fc-label">自动填充</div>
          <div class="fc-desc">在登录页面自动识别 TOTP 输入框并填充验证码。</div>
        </div>
        <div class="fc-item">
          <div class="fc-label">扫码与导入</div>
          <div class="fc-desc">支持活动页面二维码、otpauth 链接和本地二维码图片识别。</div>
        </div>
        <div class="fc-item">
          <div class="fc-label">加密备份</div>
          <div class="fc-desc">支持加密 JSON、MoviePilot 与 WebDAV 备份，跨设备恢复后重新安全封装。</div>
        </div>
      </div>
    </section>

    <!-- 凭据管理 -->
    <section class="section">
      <div class="section-heading">
        <span class="section-kicker">Credentials</span>
        <span class="section-title">凭据管理</span>
      </div>
      <div class="feature-compact">
        <div class="fc-item">
          <div class="fc-label">统一加密私有仓</div>
          <div class="fc-desc">账号密码使用设备密钥信封加密，仅保存一份；PIN 只用于敏感操作授权。</div>
        </div>
        <div class="fc-item">
          <div class="fc-label">自动保存与填充</div>
          <div class="fc-desc">登录时提示保存或更新，访问已关联域名时自动匹配并填充凭据。</div>
        </div>
        <div class="fc-item">
          <div class="fc-label">分组与站点屏蔽</div>
          <div class="fc-desc">支持搜索、分组、编辑、导入导出，并可按站点关闭保存或填充。</div>
        </div>
      </div>
    </section>

    <!-- 验证码识别 -->
    <section class="section">
      <div class="section-heading">
        <span class="section-kicker">Captcha</span>
        <span class="section-title">验证码识别</span>
      </div>
      <div class="feature-compact">
        <div class="fc-item">
          <div class="fc-label">图片验证码</div>
          <div class="fc-desc">自动检测登录页与 Ajax 弹窗中的图片验证码，识别后自动填充。</div>
        </div>
        <div class="fc-item">
          <div class="fc-label">三级识别链</div>
          <div class="fc-desc">依次使用本地 ONNX、MoviePilot OCR 服务和 AI 视觉接口完成识别。</div>
        </div>
        <div class="fc-item">
          <div class="fc-label">离线资源与纠错</div>
          <div class="fc-desc">支持导入 OCR 运行时、模型、词表和纠错规则，推理由 Offscreen 页面执行。</div>
        </div>
      </div>
    </section>

    <!-- Cookie/UA 同步 -->
    <section class="section">
      <div class="section-heading">
        <span class="section-kicker">Cookie &amp; UA</span>
        <span class="section-title">同步与覆盖</span>
      </div>
      <div class="feature-compact">
        <div class="fc-item">
          <div class="fc-label">覆盖到浏览器</div>
          <div class="fc-desc">将服务器端 Cookie 覆盖到浏览器，快速登录站点。</div>
        </div>
        <div class="fc-item">
          <div class="fc-label">同步到服务器</div>
          <div class="fc-desc">将浏览器 Cookie 与 User-Agent 更新回服务器。</div>
        </div>
        <div class="fc-item">
          <div class="fc-label">定时自动更新</div>
          <div class="fc-desc">支持自定义间隔定时将浏览器 Cookie/UA 同步到 MoviePilot。</div>
        </div>
        <div class="fc-item">
          <div class="fc-label">自动打开站点</div>
          <div class="fc-desc">定时后台打开已启用站点，可选自动关闭标签页。</div>
        </div>
      </div>
    </section>

    <!-- 安全与扩展设置 -->
    <section class="section">
      <div class="section-heading">
        <span class="section-kicker">Security</span>
        <span class="section-title">安全与配置</span>
      </div>
      <div class="feature-compact">
        <div class="fc-item">
          <div class="fc-label">PIN 安全保护</div>
          <div class="fc-desc">启用 PIN 锁保护弹窗访问，支持会话内免验证或每次验证。</div>
        </div>
        <div class="fc-item">
          <div class="fc-label">自定义背景</div>
          <div class="fc-desc">支持本地图片、URL、MP 壁纸与每日壁纸，可调模糊与透明度。</div>
        </div>
        <div class="fc-item">
          <div class="fc-label">网页嵌入</div>
          <div class="fc-desc">内嵌 MoviePilot 插件页并同步登录、主题和背景；首次加载后切页保持运行状态。</div>
        </div>
        <div class="fc-item">
          <div class="fc-label">恢复密钥与备份</div>
          <div class="fc-desc">使用随机恢复密钥加密备份，通过敏感资产 .mpkey 文件跨设备恢复。</div>
        </div>
      </div>
    </section>

    <!-- 用户信息 -->
    <section class="section">
      <div class="section-heading">
        <span class="section-kicker">Profile</span>
        <span class="section-title">用户信息</span>
      </div>
      <div class="feature-compact">
        <div class="fc-item">
          <div class="fc-label">用户与账号</div>
          <div class="fc-desc">展示和编辑用户资料，管理账号库并快捷切换当前 MoviePilot 账号。</div>
        </div>
        <div class="fc-item">
          <div class="fc-label">综合信息</div>
          <div class="fc-desc">查看订阅、站点、Cookie 状态及 MoviePilot、前端和扩展版本。</div>
        </div>
      </div>
    </section>

    <section class="footer-section">
      <div class="footer-text">项目主页：</div>
      <div class="footer-links">
        <a href="https://movie-pilot.org/" target="_blank" class="link">MoviePilot</a>
        <a
          href="https://github.com/KoWming/MoviePilot-Tools"
          target="_blank"
          class="link"
        >
          MoviePilot-Tools
        </a>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  mdiWeb,
  mdiChartLine,
  mdiDownload,
  mdiShieldKey,
  mdiKeyOutline,
  mdiAccount,
  mdiPuzzleOutline,
  mdiRobotOutline,
  mdiCogOutline,
  mdiInformationOutline,
} from '@mdi/js'
import { ElMessage } from '../utils/ui'
import {
  fetchLatestExtensionRelease,
  downloadExtensionUpdate,
  isNewerVersion,
  type ExtensionReleaseInfo,
} from '../services/extension-update'

const extVersion = ref('')
const isChecking = ref(false)
const isDownloading = ref(false)
const latestRelease = ref<ExtensionReleaseInfo | null>(null)
const logoUrl = chrome.runtime.getURL('/icons/icon.png')

const hasUpdate = computed(() => {
  if (!latestRelease.value?.version || !extVersion.value) return false
  return isNewerVersion(latestRelease.value.version, extVersion.value)
})

async function checkUpdate(force = false) {
  if (isChecking.value) return
  isChecking.value = true
  try {
    const res = await fetchLatestExtensionRelease(force)
    latestRelease.value = res
    if (force) {
      if (res && isNewerVersion(res.version, extVersion.value)) {
        ElMessage.success(`发现可用更新 ${res.tagName}，点击即可一键下载`)
      } else if (res) {
        ElMessage.info('当前已是最新版本')
      } else {
        ElMessage.warning('未能获取版本信息，请稍后重试')
      }
    }
  } catch {
    if (force) ElMessage.error('检查更新失败，请检查网络连接')
  } finally {
    isChecking.value = false
  }
}

async function handleDownloadUpdate() {
  if (!latestRelease.value || isDownloading.value) return
  isDownloading.value = true
  try {
    const { isMirror } = await downloadExtensionUpdate(latestRelease.value)
    ElMessage.success({
      message: isMirror
        ? `已通过高速镜像开始下载 ${latestRelease.value.assetName || latestRelease.value.tagName}，解压后覆盖更新即可`
        : `已开始下载 ${latestRelease.value.assetName || latestRelease.value.tagName}，解压后覆盖更新即可`,
      duration: 4500,
    })
  } catch (err) {
    ElMessage.warning({
      message: err instanceof Error ? `${err.message}，正在为您打开发布页` : '下载启动异常，正在为您打开发布页',
      duration: 4500,
    })
    if (latestRelease.value.htmlUrl) {
      window.open(latestRelease.value.htmlUrl, '_blank')
    }
  } finally {
    isDownloading.value = false
  }
}

onMounted(() => {
  try {
    const v = chrome.runtime.getManifest?.().version
    if (v) extVersion.value = v
    else extVersion.value = __APP_VERSION__
  } catch {
    extVersion.value = __APP_VERSION__
  }
  void checkUpdate(false)
})

const navItems = [
  {
    icon: mdiWeb,
    label: '站点管理',
    desc: '查看与同步站点 Cookie/UA，批量覆盖与更新',
    colorClass: 'ni-site',
  },
  {
    icon: mdiChartLine,
    label: '站点数据',
    desc: '上传下载做种统计，导出与隐私模式',
    colorClass: 'ni-data',
  },
  {
    icon: mdiDownload,
    label: '下载管理',
    desc: '多下载器任务查看，种子/磁力/站点链接添加下载',
    colorClass: 'ni-dl',
  },
  {
    icon: mdiShieldKey,
    label: '两步验证',
    desc: 'TOTP 管理、自动填充、WebDav 导入导出与定时备份',
    colorClass: 'ni-totp',
  },
  {
    icon: mdiKeyOutline,
    label: '凭据管理',
    desc: '设备信封加密凭据，支持多域名匹配、自动填充与站点屏蔽',
    colorClass: 'ni-creds',
  },
  {
    icon: mdiAccount,
    label: '用户信息',
    desc: '用户资料、账号切换、订阅站点状态与版本信息',
    colorClass: 'ni-user',
  },
  {
    icon: mdiPuzzleOutline,
    label: '插件管理',
    desc: '内嵌 MoviePilot 插件页，同步登录与外观并保持页面状态',
    colorClass: 'ni-plugin',
  },
  {
    icon: mdiRobotOutline,
    label: '智能助手',
    desc: '流式多轮会话、历史、命令、附件、录音与选择卡片',
    colorClass: 'ni-agent',
  },
  {
    icon: mdiCogOutline,
    label: '设置',
    desc: '主题背景、PIN 授权、OCR、自动任务与加密备份恢复',
    colorClass: 'ni-settings',
  },
  {
    icon: mdiInformationOutline,
    label: '关于',
    desc: '扩展版本与功能介绍',
    colorClass: 'ni-about',
  },
]
</script>

<style scoped>
.about-root {
  width: 100%;
  box-sizing: border-box;
  min-height: 100%;
  padding-bottom: 8px;
}

/* Hero 区域 */
.hero {
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding-bottom: 14px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
}

.logo-wrap {
  width: 46px;
  height: 46px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
}

.logo {
  width: 30px;
  height: 30px;
}

.hero-main {
  min-width: 0;
}

.eyebrow {
  font-size: 10px;
  font-weight: 700;
  color: #2563eb;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.title {
  margin-top: 2px;
  font-size: 16px;
  line-height: 22px;
  font-weight: 800;
  color: #0f172a;
}

.subtitle {
  margin-top: 2px;
  font-size: 11px;
  line-height: 16px;
  color: #64748b;
}

.version-wrap {
  align-self: start;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

.version {
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  color: #3730a3;
  background: #eef2ff;
  border: 1px solid #c7d2fe;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
  transition: all 0.2s ease;
}

.version:hover {
  background: #e0e7ff;
  border-color: #a5b4fc;
}

.version.is-checking {
  opacity: 0.75;
  cursor: wait;
}

.update-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  color: #065f46;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  white-space: nowrap;
  cursor: pointer;
  outline: none;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 1px 2px rgba(16, 185, 129, 0.1);
}

.update-badge:hover:not(:disabled) {
  background: #d1fae5;
  border-color: #6ee7b7;
  color: #047857;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);
}

.update-badge:active:not(:disabled) {
  transform: translateY(0);
}

.update-badge.is-downloading {
  opacity: 0.8;
  cursor: wait;
}

.update-pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #10b981;
  box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
  animation: pulse-green 2s infinite;
}

@keyframes pulse-green {
  0% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
  }
  70% {
    transform: scale(1);
    box-shadow: 0 0 0 5px rgba(16, 185, 129, 0);
  }
  100% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
  }
}

.update-text {
  font-size: 10px;
  font-weight: 600;
  opacity: 0.9;
}

.update-ver {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-weight: 800;
}

.update-icon {
  margin-left: 1px;
  fill: currentColor;
}

/* 通用 section */
.section {
  padding-top: 14px;
}

.section-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 10px;
}

.section-kicker {
  font-size: 10px;
  font-weight: 700;
  color: #94a3b8;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.section-title {
  font-size: 13px;
  font-weight: 800;
  color: #334155;
}

/* 功能导航列表 */
.nav-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 12px;
  background: rgba(241, 245, 249, 0.6);
  border: 1px solid rgba(15, 23, 42, 0.06);
  transition: background 0.15s;
}

.nav-icon-wrap {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 32px;
  background: #eff6ff;
  color: #2563eb;
  border: 1px solid #bfdbfe;
}

.nav-icon-wrap svg {
  width: 18px;
  height: 18px;
  fill: currentColor;
  display: block;
}

/* 彩色图标变体 */
.ni-site {
  background: #eff6ff;
  color: #2563eb;
  border-color: #bfdbfe;
}
.ni-data {
  background: #ecfdf5;
  color: #059669;
  border-color: #bbf7d0;
}
.ni-dl {
  background: #fef3c7;
  color: #d97706;
  border-color: #fde68a;
}
.ni-totp {
  background: #f3e8ff;
  color: #7c3aed;
  border-color: #d8b4fe;
}
.ni-creds {
  background: #f0fdf4;
  color: #16a34a;
  border-color: #bbf7d0;
}
.ni-user {
  background: #dbeafe;
  color: #1d4ed8;
  border-color: #93c5fd;
}
.ni-plugin {
  background: #fce7f3;
  color: #db2777;
  border-color: #f9a8d4;
}
.ni-agent {
  background: #ede9fe;
  color: #6d28d9;
  border-color: #c4b5fd;
}
.ni-settings {
  background: #e0e7ff;
  color: #4338ca;
  border-color: #a5b4fc;
}
.ni-about {
  background: #f1f5f9;
  color: #64748b;
  border-color: #cbd5e1;
}

.nav-text {
  min-width: 0;
}

.nav-label {
  font-size: 12px;
  font-weight: 700;
  color: #1e293b;
  line-height: 17px;
}

.nav-desc {
  font-size: 11px;
  line-height: 15px;
  color: #64748b;
  margin-top: 1px;
}

/* 紧凑功能卡片 */
.feature-compact {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.fc-item {
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(15, 23, 42, 0.07);
}

.fc-label {
  font-size: 12px;
  font-weight: 700;
  color: #334155;
  line-height: 17px;
}

.fc-desc {
  margin-top: 2px;
  font-size: 11px;
  line-height: 16px;
  color: #64748b;
}

/* 页脚 */
.footer-section {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid rgba(15, 23, 42, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.footer-text {
  font-size: 12px;
  font-weight: 700;
  color: #64748b;
  flex-shrink: 0;
}

.footer-links {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.link {
  font-size: 10px;
  font-weight: 700;
  color: #2563eb;
  text-decoration: none;
  padding: 3px 8px;
  border-radius: 999px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
}

.link:hover {
  background: #dbeafe;
}

/* 深色主题使用高优先级覆盖页面浅色固定值。 */
:global(html[data-theme='dark']) .about-root {
  background: transparent;
  color: #e2e8f0;
}

:global(html[data-theme='dark']) .hero {
  border-bottom-color: #334155 !important;
}

:global(html[data-theme='dark']) .logo-wrap {
  background: #1e293b !important;
  border-color: #334155 !important;
}

:global(html[data-theme='dark']) .eyebrow {
  color: #60a5fa !important;
}

:global(html[data-theme='dark']) .title {
  color: #f1f5f9 !important;
}

:global(html[data-theme='dark']) .subtitle,
:global(html[data-theme='dark']) .nav-desc,
:global(html[data-theme='dark']) .fc-desc,
:global(html[data-theme='dark']) .footer-text,
:global(html[data-theme='dark']) .section-kicker {
  color: #94a3b8 !important;
}

:global(html[data-theme='dark']) .section-title,
:global(html[data-theme='dark']) .nav-label,
:global(html[data-theme='dark']) .fc-label {
  color: #e2e8f0 !important;
}

:global(html[data-theme='dark']) .version {
  color: #a5b4fc !important;
  background: rgba(99, 102, 241, 0.15) !important;
  border-color: rgba(99, 102, 241, 0.25) !important;
}

:global(html[data-theme='dark']) .version:hover {
  background: rgba(99, 102, 241, 0.25) !important;
  border-color: rgba(99, 102, 241, 0.4) !important;
}

:global(html[data-theme='dark']) .update-badge {
  color: #6ee7b7 !important;
  background: rgba(16, 185, 129, 0.15) !important;
  border-color: rgba(16, 185, 129, 0.3) !important;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

:global(html[data-theme='dark']) .update-badge:hover:not(:disabled) {
  background: rgba(16, 185, 129, 0.25) !important;
  border-color: rgba(16, 185, 129, 0.45) !important;
  color: #a7f3d0 !important;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
}

:global(html[data-theme='dark']) .nav-item {
  background: #1e293b !important;
  border-color: #334155 !important;
}

:global(html[data-theme='dark']) .nav-icon-wrap {
  background: rgba(59, 130, 246, 0.15) !important;
  color: #60a5fa !important;
  border-color: rgba(59, 130, 246, 0.25) !important;
}

:global(html[data-theme='dark']) .nav-icon-wrap svg,
:global(html[data-theme='dark']) .nav-icon-wrap svg path {
  fill: currentColor !important;
  color: inherit !important;
}

:global(html[data-theme='dark']) .fc-item {
  background: #1e293b !important;
  border-color: #334155 !important;
}

:global(html[data-theme='dark']) .footer-section {
  border-top-color: #334155 !important;
}

:global(html[data-theme='dark']) .link {
  color: #93c5fd !important;
  background: rgba(59, 130, 246, 0.15) !important;
  border-color: rgba(59, 130, 246, 0.3) !important;
}

:global(html[data-theme='dark']) .link:hover {
  background: rgba(59, 130, 246, 0.25) !important;
}

:global(html[data-theme='dark']) .ni-site {
  background: rgba(37, 99, 235, 0.15) !important;
  color: #60a5fa !important;
  border-color: rgba(37, 99, 235, 0.25) !important;
}
:global(html[data-theme='dark']) .ni-data {
  background: rgba(5, 150, 105, 0.15) !important;
  color: #4ade80 !important;
  border-color: rgba(5, 150, 105, 0.25) !important;
}
:global(html[data-theme='dark']) .ni-dl {
  background: rgba(217, 119, 6, 0.15) !important;
  color: #fbbf24 !important;
  border-color: rgba(217, 119, 6, 0.25) !important;
}
:global(html[data-theme='dark']) .ni-totp {
  background: rgba(124, 58, 237, 0.15) !important;
  color: #c084fc !important;
  border-color: rgba(124, 58, 237, 0.25) !important;
}
:global(html[data-theme='dark']) .ni-creds {
  background: rgba(22, 163, 74, 0.15) !important;
  color: #4ade80 !important;
  border-color: rgba(22, 163, 74, 0.25) !important;
}
:global(html[data-theme='dark']) .ni-user {
  background: rgba(29, 78, 216, 0.15) !important;
  color: #60a5fa !important;
  border-color: rgba(29, 78, 216, 0.25) !important;
}
:global(html[data-theme='dark']) .ni-plugin {
  background: rgba(219, 39, 119, 0.15) !important;
  color: #f472b6 !important;
  border-color: rgba(219, 39, 119, 0.25) !important;
}
:global(html[data-theme='dark']) .ni-agent {
  background: rgba(109, 40, 217, 0.18) !important;
  color: #c4b5fd !important;
  border-color: rgba(109, 40, 217, 0.28) !important;
}
:global(html[data-theme='dark']) .ni-settings {
  background: rgba(67, 56, 202, 0.15) !important;
  color: #a5b4fc !important;
  border-color: rgba(67, 56, 202, 0.25) !important;
}
:global(html[data-theme='dark']) .ni-about {
  background: rgba(100, 116, 139, 0.15) !important;
  color: #94a3b8 !important;
  border-color: rgba(100, 116, 139, 0.25) !important;
}
</style>
