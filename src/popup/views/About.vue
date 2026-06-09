<template>
  <div class="about-root">
    <section class="hero">
      <div class="logo-wrap">
        <img src="/icons/icon.png" alt="logo" class="logo" />
      </div>
      <div class="hero-main">
        <div class="eyebrow">MoviePilot Extension</div>
        <div class="title">MoviePilot Tools</div>
        <div class="subtitle">在弹窗中完成站点管理、下载任务、两步验证、验证码识别等常用操作。</div>
      </div>
      <div class="version">v{{ extVersion || '-' }}</div>
    </section>

    <!-- 导航功能总览 -->
    <section class="section">
      <div class="section-heading">
        <span class="section-kicker">Navigation</span>
        <span class="section-title">功能导航</span>
      </div>
      <div class="nav-list">
        <div class="nav-item" v-for="item in navItems" :key="item.label">
          <div class="nav-icon-wrap" :class="item.colorClass">
            <svg viewBox="0 0 24 24" width="19" height="19"><path :d="item.icon"/></svg>
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
          <div class="fc-label">统计面板</div>
          <div class="fc-desc">已配置、已启用、待更新站点数量一目了然。</div>
        </div>
        <div class="fc-item">
          <div class="fc-label">筛选过滤</div>
          <div class="fc-desc">按浏览器/服务器/Cookie差异/UA差异/未添加多维度筛选。</div>
        </div>
        <div class="fc-item">
          <div class="fc-label">一键操作</div>
          <div class="fc-desc">批量覆盖 Cookie、批量更新 Cookie/UA、一键打开所有站点。</div>
        </div>
        <div class="fc-item">
          <div class="fc-label">快速添加</div>
          <div class="fc-desc">手动添加站点配置，支持域名、Cookie 等字段。</div>
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
          <div class="fc-label">导入导出</div>
          <div class="fc-desc">支持导入/导出本地 JSON 文件，以及 WebDav 远程备份与恢复。</div>
        </div>
        <div class="fc-item">
          <div class="fc-label">WebDav 定时备份</div>
          <div class="fc-desc">支持设置 WebDav 地址自动定时备份，新增站点时自动同步。</div>
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
          <div class="fc-label">内置离线 OCR</div>
          <div class="fc-desc">扩展内置本地 OCR 模型，在浏览器内识别，不依赖远程服务。</div>
        </div>
        <div class="fc-item">
          <div class="fc-label">AI 辅助识别</div>
          <div class="fc-desc">优先调用 MoviePilot 智能助手视觉模型，提高识别准确率。</div>
        </div>
      </div>
    </section>

    <!-- Cookie/UA 同步 -->
    <section class="section">
      <div class="section-heading">
        <span class="section-kicker">Cookie & UA</span>
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
          <div class="fc-label">每日首次自动更新</div>
          <div class="fc-desc">每天首次打开浏览器时自动同步所有站点 Cookie/UA。</div>
        </div>
        <div class="fc-item">
          <div class="fc-label">定时自动更新</div>
          <div class="fc-desc">支持自定义间隔（15 分钟~4 小时）定时自动同步。</div>
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
          <div class="fc-label">插件管理</div>
          <div class="fc-desc">内嵌 MoviePilot 插件管理页面，安装与管理插件。</div>
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
          <div class="fc-label">用户卡片</div>
          <div class="fc-desc">展示用户头像、名称、影视统计与站点配置概览。</div>
        </div>
        <div class="fc-item">
          <div class="fc-label">版本信息</div>
          <div class="fc-desc">查看 MoviePilot 软件版本、前端版本、认证与站点资源版本。</div>
        </div>
      </div>
    </section>

    <section class="footer-section">
      <div class="footer-text">项目主页：</div>
      <div class="footer-links">
        <a href="https://movie-pilot.org/" target="_blank" class="link">MoviePilot</a>
        <a href="https://github.com/KoWming/MoviePilot-Tools" target="_blank" class="link">MoviePilot-Tools</a>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
// ============================================================
// 关于页面视图
// 版本信息、项目链接
// ============================================================
import { ref, onMounted } from 'vue';
import {
  mdiWeb, mdiChartLine, mdiDownload, mdiShieldKey,
  mdiAccount, mdiPuzzleOutline, mdiCogOutline, mdiInformationOutline
} from '@mdi/js';

// ==================== 扩展版本 ====================
const extVersion = ref('');
onMounted(() => {
  try {
    const v = chrome.runtime.getManifest?.().version;
    if (v) extVersion.value = v;
  } catch {}
});

// ==================== 功能导航列表 ====================
const navItems = [
  { icon: mdiWeb,                label: '站点管理', desc: '查看与同步站点 Cookie/UA，批量覆盖与更新',         colorClass: 'ni-site' },
  { icon: mdiChartLine,          label: '站点数据', desc: '上传下载做种统计，导出与隐私模式',                 colorClass: 'ni-data' },
  { icon: mdiDownload,           label: '下载管理', desc: '多下载器任务查看，种子/磁力/站点链接添加下载',      colorClass: 'ni-dl' },
  { icon: mdiShieldKey,          label: '两步验证', desc: 'TOTP 管理、自动填充、WebDav 导入导出与定时备份',    colorClass: 'ni-totp' },
  { icon: mdiAccount,            label: '用户信息', desc: '用户卡片、影视统计、MP 版本信息',                  colorClass: 'ni-user' },
  { icon: mdiPuzzleOutline,      label: '插件管理', desc: '内嵌 MoviePilot 插件页面',                        colorClass: 'ni-plugin' },
  { icon: mdiCogOutline,         label: '安全设置', desc: 'PIN 弹窗保护、自动更新 Cookie、WEB 嵌入功能配置',   colorClass: 'ni-settings' },
  { icon: mdiInformationOutline, label: '关于',     desc: '扩展版本与功能介绍',                              colorClass: 'ni-about' },
];
</script>

<style scoped>
.about-root {
  min-height: 100%;
  padding: 8px 8px 16px;
  background: #ffffff;
  box-sizing: border-box;
  width: 100%;
}

/* Hero 区域 */
.hero {
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding-bottom: 14px;
  border-bottom: 1px solid rgba(15,23,42,.08);
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
  letter-spacing: .06em;
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

.version {
  align-self: start;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  color: #3730a3;
  background: #eef2ff;
  border: 1px solid #c7d2fe;
  white-space: nowrap;
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
  letter-spacing: .04em;
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
  background: rgba(241,245,249,.6);
  border: 1px solid rgba(15,23,42,.06);
  transition: background .15s;
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
.ni-site    { background: #eff6ff; color: #2563eb; border-color: #bfdbfe; }
.ni-data    { background: #ecfdf5; color: #059669; border-color: #bbf7d0; }
.ni-dl      { background: #fef3c7; color: #d97706; border-color: #fde68a; }
.ni-totp    { background: #f3e8ff; color: #7c3aed; border-color: #d8b4fe; }
.ni-user    { background: #dbeafe; color: #1d4ed8; border-color: #93c5fd; }
.ni-plugin  { background: #fce7f3; color: #db2777; border-color: #f9a8d4; }
.ni-settings { background: #e0e7ff; color: #4338ca; border-color: #a5b4fc; }
.ni-about   { background: #f1f5f9; color: #64748b; border-color: #cbd5e1; }

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
  background: rgba(255,255,255,.7);
  border: 1px solid rgba(15,23,42,.07);
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
  border-top: 1px solid rgba(15,23,42,.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
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
</style>
