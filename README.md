# MoviePilot Tools - 浏览器扩展

<div align="center">
  <img src="public/icons/icon.png" width="100" height="100" alt="MoviePilot Tools Logo">
  <h3>专为自建 MoviePilot 用户打造的现代化全功能浏览器扩展助手</h3>

  [![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue.svg?style=flat-square)](#)
  [![Vue 3](https://img.shields.io/badge/Vue-3.x-emerald.svg?style=flat-square)](#)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg?style=flat-square)](#)
  [![ONNX Runtime Web](https://img.shields.io/badge/ONNX_Runtime-WebAssembly-orange.svg?style=flat-square)](#)
  [![License](https://img.shields.io/badge/license-GPL--3.0-green.svg?style=flat-square)](LICENSE)
  [![Extension Size](https://img.shields.io/badge/ZIP_Size-31.2_MB-blueviolet.svg?style=flat-square)](#)
</div>

---

## 📖 项目简介

**MoviePilot Tools** 是一个基于 Chrome Extension Manifest V3 标准构建的浏览器扩展，专为 MoviePilot 用户设计。它提供了一套完整的站点管理、数据查看、下载推送、两步验证管理（TOTP）以及完全本地化的验证码识别功能，全面提升用户管理自建影视媒体系统的体验。

> [!NOTE]
> 本项目由 AI 辅助开发完成。由于 AI 辅助开发的特性，项目细节、类型定义或代码结构中可能仍存在一些不足之处。非常欢迎各位技术大佬提交 Pull Request (PR) 或反馈 Issue，共同优化和改进本项目！

---

## ✨ 核心功能

### 1. 离线验证码自动识别 (Offline OCR)
- **绝对隐私安全**：内置基于 WebAssembly 和 ONNX Runtime Web 的神经网络识别引擎。**验证码图片无需上传到任何第三方云端接口**，完全在浏览器本地沙盒内完成识别，极速且零隐私泄露风险。
- **极佳兼容性**：在 Offscreen 独立后台运行识别，不阻塞主界面。支持自动识别并一键填充目标 PT 站点的登录验证码。

### 2. 站点管理与差异检测
- **Cookie & UA 同步**：自动检测浏览器当前已登录站点的 Cookie 及 User-Agent，并与 MoviePilot 服务器上的配置进行比对。
- **一键差相同步**：一键将浏览器中最新的 Cookie 更新同步至自建服务器，彻底解决因 Cookie 过期导致站点检索失效的痛点。
- **状态管理**：支持批量启用、禁用及直接在侧边栏中快捷跳转到 PT 站点。

### 3. 站点数据图表统计
- **全局概览**：实时拉取并展示总上传量、总下载量、分享率、时魔以及当前活跃做种数。
- **精美卡片列表**：支持按分享率、上传、下载、做种数等多维度排序及筛选。
- **数据图片导出**：支持一键将站点统计数据卡片渲染并导出为高质量的 PNG 图片，方便分享。

### 4. 强大的下载管理
- **一键推送**：在任意网页检测到磁力链接、种子文件（`.torrent`）或站点下载链接时，可一键将其推送到自建服务器关联的下载器中。
- **下载任务监控**：实时同步展示下载器（如 Transmission, QBittorrent 等）中的下载任务列表、速度、进度及健康度，并支持删除任务。
- **路径快捷选择**：支持一键从 MoviePilot 配置的保存目录列表中选择目标路径。

### 5. 安全的 TOTP 两步验证器
- **多站点管理**：支持添加、生成和管理多个 PT 站点的 6 位两步验证码（TOTP），自带环形倒计时进度条。
- **扫码快速添加**：支持直接通过浏览器摄像头扫描网页二维码，或导入本地图片快速解析添加密钥。
- **WebDav 自动备份**：配置私有 WebDav 存储，可将 TOTP 密钥加密备份至云端。**支持自动保留份数限制**，超出后自动清理旧备份，避免网盘文件冗余。

### 6. PIN 码安全锁与数据加密
- **PIN 码验证**：可设置 6 位安全 PIN 码。支持在“每次打开”、“每次浏览器会话”时进行解锁校验，防止物理设备被他人借用时泄漏敏感信息。
- **AES 本地加密**：所有敏感数据（如 API Token、TOTP 密钥、WebDav 密码）均在浏览器本地使用 AES 强加密存储。

> [!IMPORTANT]
> **强烈建议启用扩展 PIN 码锁**：由于本扩展会读取并同步敏感的自建服务器 API 密钥、PT 站点 Cookie 以及两步验证 (TOTP) 私钥，为了你站点的账号和隐私安全，如果你的开发或使用设备有被他人接触的可能性，请务必在“设置”中启用 PIN 码安全锁。

---

## 🎨 现代感 UI/UX 设计

- **极简滑动指示器**：PC 侧边栏采用扁平化的滑动淡入蓝色条设计，去除了多余的边框和背景块，轻量优雅。
- **毛玻璃微渐变适配**：支持用户上传自定义背景图片，并提供高模糊毛玻璃边框和半透明卡片叠加层，提供极致视觉美感。
- **移动端自适应**：自动检测设备类型，在手机等窄屏设备上自动折叠侧边栏并转化为美观的底部横向菜单栏。

---

## 📂 项目目录结构

```text
MoviePilot-Tools/
├── .github/                         # GitHub Actions 自动化工作流
│   └── workflows/
│       └── release.yml              # 自动编译发布工作流配置文件
├── public/                          # 静态文件目录 (构建时会直接复制到 dist/)
│   ├── icons/                       # 插件图标
│   ├── ocr/                         # 本地离线 OCR 核心资源文件
│   │   ├── charsets.json            # 验证码字符集映射
│   │   ├── common.onnx              # 离线 OCR 轻量级神经网络模型
│   │   ├── ort-wasm-simd-threaded.mjs # Wasm 运行加载胶水脚本
│   │   └── ort-wasm-simd-threaded.wasm# Wasm 执行引擎
│   └── manifest.json                # 扩展清单文件
├── src/                             # 扩展源代码
│   ├── background/                  # 后台运行脚本 (Service Worker)
│   │   └── index.ts                 # Service Worker 核心业务逻辑
│   ├── content/                     # 网页内容注入脚本 (Content Scripts)
│   │   ├── captcha-auto-fill.ts     # 验证码自动获取识别并填充
│   │   ├── mp-bridge.ts            # 与自建服务网页的桥接交互
│   │   └── pt-float.ts             # 目标 PT 站内一键下载浮动按钮
│   ├── offscreen/                   # 独立后台文档 (Offscreen Document)
│   │   ├── ocr-worker.html
│   │   └── ocr-worker.ts            # 用于运行 Wasm 离线 OCR 的 Worker 脚本
│   ├── popup/                       # 扩展弹窗与侧边栏主应用 (Vue 3 / Element Plus)
│   │   ├── components/              # 页面模块子组件 (侧边栏, 顶部栏, 下载列表)
│   │   ├── views/                   # 核心视图面 (用户信息, 站点数据, 备份, 设置等)
│   │   ├── App.vue                  # 弹窗根组件
│   │   ├── index.html               # 弹窗 HTML 容器
│   │   └── main.ts                  # 前端渲染挂载入口
│   └── shared/                      # 多端共享及业务逻辑服务层
│       ├── api/                     # 接口请求封装（鉴权、下载、插件等）
│       ├── data/                    # 静态站点 Favicon 图标数据
│       ├── stores/                  # 状态管理存储库
│       └── utils/                   # 工具集（AES加密安全存储、图片渲染导出等）
├── scripts/                         # 构建及辅助脚本
│   ├── generate-icons.js            # 自定义尺寸图标生成脚本
│   └── package-extension.js         # 打包同步构建脚本 (CRX / ZIP 打包打包)
├── docs/                            # 项目文档
│   └── PRIVACY_POLICY.md            # 中英双语隐私政策（应用商店提审必备）
├── version.json                     # 全局单点版本控制与历史更新日志
├── package.json                     # 项目配置与 NPM 依赖说明
├── tsconfig.json                    # TypeScript 配置项
└── vite.config.ts                   # Vite 现代化编译打包配置文件
```

---

## 🔧 开发与编译构建

### 1. 开发环境要求
- Node.js >= 18.0.0
- npm >= 9.0.0
- 支持 WebAssembly SIMD 的现代浏览器（如 Chrome >= 91, Edge >= 91）

### 2. 依赖安装
```bash
npm install
```

### 3. 本地编译构建
```bash
# 执行类型检查与构建，并自动生成 release 打包文件
npm run build
```

---

## 📦 版本控制与自动化构建

项目采用**单文件全局版本控制模式**以简化版本升级：

1. **版本单点控制**：
   在根目录的 [version.json](version.json) 中修改版本号（例如 `"version": "0.4.1"`) 并添加对应的更新说明 `"history"`。
2. **自动同步注入**：
   运行 `npm run build` 构建脚本时，系统会自动将 `version.json` 中的最新版本号写入并覆盖以下文件：
   - `package.json` 中的 `"version"`
   - `public/manifest.json` 中的 `"version"`
   - 编译后输出的 `dist/manifest.json` 中的 `"version"`
3. **自动生成 GitHub Release**：
   项目配置了 GitHub Actions 工作流 [.github/workflows/release.yml](.github/workflows/release.yml)。当你向 GitHub 推送版本标签（如 `v0.4.1`）时，Actions 将在 `windows-latest` 云端环境下完成构建，并**自动提取 `version.json` 中写好的更新日志**，创建一个正式的 GitHub Release 并附带打包好的 `.zip` 和已签名的 `.crx` 发布文件。

> ℹ️ **私钥证书保护提示**：为了确保在 Action 自动构建时打包生成的 `.crx` 拥有相同的 Extension ID。请将你本地生成的签名私钥内容存入 GitHub 仓库的 **Secrets** 中，命名为 `CRX_PRIVATE_KEY`。

---

## 🔒 隐私政策

为了符合各应用商店（如 Microsoft Edge 商店、Chrome Web Store）政策，项目的完整隐私政策文件已归档于：
*   [docs/PRIVACY_POLICY.md](docs/PRIVACY_POLICY.md) (中英文双语)

---

## 🚀 更新说明

### 当前最新版本：`v1.3.3`

#### v1.3.3 (2026-06-18)
- **【UI优化】** 优化站点数据页面按钮布局样式。
- **【UI优化】** 优化并修复插件管理页面内嵌页面的毛玻璃样式及加载遮罩闪烁问题。
- **【Bug修复】** 修复下载页面列表存在N个下载时被挤压无法正常显示的问题。

<details>
<summary>历史版本更新日志</summary>

#### v1.3.2 (2026-06-14)
- **【凭据管理】** 新增“黑名单”功能，添加到名单的站点不使用验证码识别或自动填充功能。
- **【UI优化】** 优化部分页面UI样式适配深色主题。
- **【Bug修复】** 修复自动获取自定义背景需在设置页面才能获取的问题。

#### v1.3.0 (2026-06-09)
- **【UI优化】** 优化部分页面UI样式、适配深色主题和自定义背景下的显示，重构页面加载阶段样式。
- **【站点管理】** 优化站点管理页面过滤逻辑，新增「未登录」、「未添加」过滤条件，支持同时过滤多个状态。
- **【WEB嵌入功能】** 优化种子详情页的悬浮图标样式。

#### v1.2.0 (2026-06-07)
- **【深色主题】** 新增主题设置（自动/浅色/深色），完整适配深色模式。
- **【自定义背景】** 新增「从 MoviePilot 获取壁纸」功能，支持从壁纸列表选择背景图片。
- **【自定义背景】** 新增「自动获取」开关，每天首次打开插件自动获取当日电影海报作为背景。
- **【关于页面】** 新增 MoviePilot-Tools GitHub 项目链接。
- **【上下文菜单】** 修复扩展更新/重载时重复创建菜单项导致的错误。
- **【自定义背景】** 统计卡片、页面加载阶段、操作按钮适配毛玻璃透光效果。
- **【清理】** 移除未使用的代码。
- **【Bug修复】** 修复点击种子页面悬浮图标弹出下载页面失败的问题，改用 storage 传递路由。

#### v1.1.0 (2026-06-06)
- **【站点管理】** 页面 UI 重构：卡片布局优化，状态徽章带圆点指示器，差异标签样式统一。
- **【站点管理】** 操作按钮（覆盖/更新/登录）移至左下角，更多菜单移至右下角。
- **【站点管理】** 新增「禁用一键更新」功能，被禁用的站点不参与一键更新。
- **【站点管理】** 新增「删除浏览器Cookie」功能，可快速清除站点浏览器Cookie。
- **【站点管理】** 顶部新增「已适配」统计卡片，显示 MP 支持的站点总数。
- **【站点管理】** 分割线改为虚线样式，按钮颜色减淡，移除重复的状态文字。
- **【凭据管理】** 修复站点图标显示问题，从服务器 API 获取缺失的图标。
- **【验证码识别】** 优化误触发问题，排除 favicon/图标/聊天输入框。
- **【验证码识别】** 容器搜索范围缩小，避免匹配到页面其他区域的输入框。
- **【两步验证】** 改进填充逻辑，非有效验证码值（如浏览器填充的密码）会被覆盖。
- **【两步验证/凭据管理】** 新增分组功能，支持对密钥和凭据进行分类管理。
- **【Bug修复】** 修复删除站点 API 路径错误（缺少 `/api/v1/` 前缀）。

#### v1.0.0 (2026-06-05)
- 首个正式版发布。

</details>

---

## 📄 许可证

本项目采用 **GPL-3.0 License** 许可证。详情请参阅 [LICENSE](LICENSE) 文件。