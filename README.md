<!-- markdownlint-disable MD013 MD028 MD033 -->

# MoviePilot Tools 2.0 - 浏览器扩展

<div align="center">
  <img src="public/icons/icon.png" width="100" height="100" alt="MoviePilot Tools Logo">
  <h3>为自建 MoviePilot 用户打造的现代化浏览器扩展工具箱</h3>

  [![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue.svg?style=flat-square)](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
  [![WXT](https://img.shields.io/badge/WXT-0.19-8b5cf6.svg?style=flat-square)](https://wxt.dev/)
  [![Vue 3](https://img.shields.io/badge/Vue-3.x-42b883.svg?style=flat-square)](https://vuejs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6.svg?style=flat-square)](https://www.typescriptlang.org/)
  [![Version](https://img.shields.io/badge/version-2.1.0-1677ff.svg?style=flat-square)](#-当前版本)
  [![License](https://img.shields.io/badge/license-GPL--3.0-green.svg?style=flat-square)](LICENSE)
</div>

---

## 📖 项目简介

**MoviePilot Tools 2.0** 是使用 WXT、Vue 3 和 TypeScript 重构的 Chrome
Manifest V3 浏览器扩展。它连接用户自己的 MoviePilot 实例，在浏览器中统一提供站点与
Cookie/UA 管理、站点数据统计、下载任务控制、TOTP 两步验证、加密凭据、插件页嵌入、
智能助手、用户信息、验证码识别和加密备份等能力。

2.0 不只是旧版界面的迁移。项目重新整理了扩展入口、业务服务、本地存储、敏感数据加密、
备份恢复、OCR 资产和页面通信边界，并继续保留旧版常用的站点管理、下载推送、自动填充、
移动端文件导入和自定义主题体验。

> [!NOTE]
> 本扩展是 MoviePilot 的辅助工具，不是独立的 MoviePilot 服务端。登录、站点、下载、插件、
> 用户信息和部分 OCR 能力需要可访问的 MoviePilot 实例。

> [!IMPORTANT]
> 扩展会处理 MoviePilot 登录信息、PT 站点 Cookie、账号密码和 TOTP Secret 等敏感数据。
> 请妥善保管恢复密钥和导出的备份文件，并建议在共享设备上启用 PIN 安全锁。

---

## ✨ 核心功能

### 1. 站点管理与 Cookie/UA 同步

- **统一站点视图**：合并 MoviePilot 已适配站点、服务器已配置站点和浏览器有效登录会话。
- **七项状态筛选**：支持浏览器、服务器、CK 差异、UA 差异、未登录、未添加和未拥有，多项筛选按 OR 组合。
- **差异检测**：规范化比较浏览器 Cookie、MoviePilot Cookie 和 User-Agent，未登录站点不会误报 CK/UA 差异。
- **站点操作**：支持新增、编辑、删除、测试、启用、禁用、批量打开和清理浏览器 Cookie。
- **双向覆盖**：可将浏览器 Cookie/UA 更新到 MoviePilot，也可将服务器 Cookie 覆盖到浏览器。
- **主备域名**：支持同一站点关联多个域名，在主域名和备用域名间切换。
- **自动任务**：可按间隔同步 Cookie/UA、自动打开站点，并按设置延时关闭标签页。

### 2. 站点数据统计

- **数据总览**：展示总上传、总下载、总做种数和总做种体积。
- **站点明细**：支持搜索、排序和顺序刷新，避免同时访问大量 PT 站点。
- **隐私模式**：一键隐藏敏感数据，适合截图或公开展示。
- **多格式导出**：支持将数据导出为 JSON、CSV 和 PNG 图片。

### 3. 下载管理

- **多下载器管理**：查看 MoviePilot 已连接下载器及对应任务。
- **实时任务状态**：每 5 秒刷新任务进度、体积、速度和剩余时间。
- **任务控制**：支持暂停、继续和删除下载任务。
- **多种添加方式**：支持磁力链接、种子链接、站点资源和媒体识别结果。
- **保存路径选择**：复用 MoviePilot 保存目录配置选择目标路径。
- **PT 站点浮动入口**：在支持的种子详情页提供一键下载按钮，将任务传递到扩展下载页面。

### 4. TOTP 两步验证

- **RFC 6238**：本地生成 6 位 TOTP 验证码，并显示 30 秒倒计时。
- **站点管理**：支持 PT 站点和自定义分组，以及搜索、排序、编辑、移动和删除。
- **自动填充**：登录页只向扩展后台请求当期验证码，网页脚本无法读取 TOTP Secret。
- **扫码添加**：支持读取活动页面中的 `otpauth` 链接、二维码，以及导入本地二维码图片。
- **导入导出**：支持 2.0 加密 JSON，并兼容旧项目正式导出的 TOTP 加密备份。
- **远端备份**：支持 MoviePilot 和 WebDAV 手动或自动备份。

### 5. 凭据管理

- **加密保存**：登录账号和密码存放于统一加密私有仓，不额外维护明文持久化副本。
- **自动保存与更新**：登录时可提示新增或更新凭据。
- **自动匹配与填充**：根据站点域名匹配凭据，并支持逐条关闭自动保存或自动填充。
- **内置分组**：提供 PT站点、内网和自定义分组；内网 IP、`localhost`、`.local` 和本地主机名可自动归类。
- **自定义分组**：支持创建、重命名、排序和删除自定义分组。
- **站点屏蔽**：可按站点关闭登录填充、验证码填充或凭据保存提示。
- **Bitwarden 导入**：可导入 Bitwarden JSON 中的登录凭据和 TOTP，提供新增、更新、保留、重复及跳过预览。
- **安全合并**：相同数据仅在 Bitwarden 修改日期严格更新时覆盖；TOTP 密钥不会显示在导入预览明细中。
- **本地导入导出**：支持恢复密钥加密的 2.0 JSON，并兼容旧版正式凭据备份。

### 6. 验证码识别

- **三级识别链**：依次支持本地 ONNX、MoviePilot OCR 服务和 AI 视觉接口。
- **完全本地推理**：离线模型通过 ONNX Runtime Web 在 Offscreen Document 中执行，不阻塞弹窗页面。
- **页面像素识别**：直接读取页面当前图片、Canvas、SVG 或背景图像素，不会再次请求验证码 URL，避免刷新服务端验证码会话。
- **复杂页面适配**：支持登录页、Ajax 弹窗以及简繁体验证码关键词检测。
- **透明图片处理**：透明验证码会先铺设白底并放大，再交给识别引擎。
- **资源管理**：OCR 模型、词表和 WASM 通过外置离线包导入 IndexedDB，不直接塞入主扩展包。
- **纠错词表**：支持自定义纠错规则及词表导入导出。

### 7. 插件管理与网页嵌入

- **原生插件页面**：在扩展中嵌入 MoviePilot 原生插件管理页。
- **登录态同步**：向 iframe 注入当前 Token 和用户资料，并在页面关闭时只清理由扩展注入的状态。
- **主题同步**：支持浅色、深色和自定义背景外观同步。
- **完整插件能力**：安装、卸载、重置、设置及数据页面仍由 MoviePilot 原生前端提供。

### 8. 智能助手

- **流式对话**：支持实时响应、中止当前请求和错误恢复。
- **会话管理**：支持创建、恢复、保存、切换和删除会话。
- **富内容**：支持 Markdown、图片、附件、选择卡片和录音附件。
- **快捷操作**：支持斜杠命令和快捷命令。
- **安全存储**：AI Token 存入加密私有仓。

### 9. 用户信息与账号管理

- **用户资料**：查看管理员、激活状态，并编辑用户名和邮箱。
- **多账号库**：保存多个 MoviePilot 账号并快捷切换当前账号。
- **综合信息**：查看订阅、站点、Cookie、MoviePilot 后端、前端和扩展版本。
- **会话恢复**：Token 失效时支持使用当前账号静默重新登录并重试一次请求。

### 10. 设置、主题与安全

- **主题模式**：支持跟随系统、浅色和深色主题。
- **自定义背景**：支持本地图片、URL、MoviePilot 壁纸和每日壁纸，并可调节模糊度与透明度。
- **PIN 安全锁**：支持 6 位 PIN，可设置会话内验证或每次验证。
- **网页功能开关**：集中控制 PT 浮动下载、凭据保存填充、TOTP 和验证码识别。
- **本地数据管理**：支持查看并清理缓存、外置资产和全部扩展数据。
- **备份设置**：统一配置恢复密钥、MoviePilot 备份和 WebDAV 备份。

---

## 🔒 数据安全与加密备份

### 统一加密私有仓

敏感数据统一存放在 `local:mpt2.private` 加密信封中，包括：

- MoviePilot Base URL、账号重新登录资料、Token 和用户档案；
- 凭据、TOTP Secret、WebDAV 密码和 AI Token；
- 恢复根密钥及安全配置。

本地私有仓使用 Web Crypto API 实现 AES-256-GCM、HKDF-SHA256 和随机 DEK 包装。设备根密钥只保护当前设备；新信封解密失败会直接报错，不会回退为明文读取。

### 恢复密钥

跨设备备份使用独立恢复密钥：

```text
MPT2-RK1.<keyId>.<rootKey>
```

凭据和 TOTP 本地 JSON 使用 HKDF 进行用途隔离，并通过 AES-256-GCM 加密。AAD 会绑定格式、版本、数据类型、Key ID 和导出时间。

> [!WARNING]
> 恢复密钥无法从加密备份中反向找回。生成后请将密钥或 `.mpkey` 文件保存到可信位置，不要与公开分享的备份文件放在一起。

### MoviePilot 与 WebDAV 快照

远端快照采用以下结构：

```text
<snapshot-id>/
├── manifest.json
└── backup.mpt2
```

- `manifest.json` 保存非敏感元数据、Key ID、文件大小和 SHA-256。
- `backup.mpt2` 保存加密后的逻辑数据和选中资产。
- 支持替换恢复和合并恢复。
- 恢复前校验大小、SHA-256 和加密完整性，提交失败时回滚原有数据与资产。
- MoviePilot 大文件使用 256 KB 分片传输。
- Token、当前会话、设备根密钥、运行时解锁态和缓存不会进入备份。

---

## 🎨 UI/UX 与移动端适配

- **响应式布局**：桌面端使用侧边导航，窄屏设备自动切换为底部导航。
- **深色主题**：应用壳、业务页面和 Element Plus 弹窗均适配深色模式。
- **自定义背景**：支持毛玻璃、透明表面和背景参数调节。
- **移动端文件选择器**：PC 使用隐藏文件输入框；移动端通过普通网页和 Shadow DOM 选择文件，再以分片方式回传到扩展。
- **插件页保活**：MoviePilot 插件 iframe 首次加载后，在扩展内切换页面仍可保持运行状态。

---

## 📂 项目目录结构

```text
MoviePilot-Tools-2.0/
├── components/                  # 应用壳与共享 Vue 组件
├── content/                     # 网页注入、凭据/TOTP/OCR 与 iframe 桥接
├── core/                        # 存储、加密、HTTP、消息、主题等基础设施
├── entrypoints/                 # WXT Background、Content、Popup、Offscreen 入口
│   ├── background.ts            # Runtime 消息、定时任务、OCR 与文件任务编排
│   ├── content.ts               # Content Script 顶层与子框架分发
│   ├── popup/                   # Vue 应用挂载入口
│   └── offscreen/               # ONNX Runtime 推理入口
├── services/                    # 认证、站点、下载、凭据、TOTP、OCR 与备份服务
├── styles/                      # 全局样式、主题变量和 Element Plus 修正
├── utils/                       # 无状态工具函数
├── views/                       # 各功能页面
├── public/                      # 扩展运行时静态文件与图标
├── pack-assets/                 # OCR、站点图标等发布资源源文件
├── scripts/                     # CRX、OCR、图标打包与质量检查脚本
├── tests/                       # Vitest 单元与集成测试
├── doc/                         # 架构、功能、专项设计与验收记录
├── package.json                 # 项目依赖与脚本
├── tsconfig.json                # TypeScript 严格模式配置
├── vitest.config.ts             # Vitest 配置
└── wxt.config.ts                # WXT、Manifest 与 Vite 构建配置
```

生成目录 `.wxt/`、`.output/` 和 `release/` 均可重新构建。

---

## 🔧 开发与编译构建

### 1. 开发环境

建议使用当前 Node.js LTS 与 npm。

```bash
npm install
```

### 2. 启动开发模式

```bash
npm run dev
```

WXT 会生成开发扩展并监听源码变化。

### 3. Chrome 生产构建

```bash
npm run build
```

构建产物位于：

```text
.output/chrome-mv3/
```

在 Chrome 或 Chromium 浏览器中打开扩展管理页面，启用“开发者模式”，选择“加载已解压的扩展程序”，然后加载上述目录。

### 4. 测试与质量检查

```bash
npm run test
npm run lint
npm run lint:comments
npm run lint:deps
```

开发时持续运行测试：

```bash
npm run test:watch
```

### 5. 发布包

```bash
npm run zip
npm run pack:crx
```

直接构建并生成 CRX：

```bash
npm run build:crx
```

CRX 签名私钥默认位于：

```text
keys/extension.pem
```

> [!IMPORTANT]
> 更新 CRX 时必须复用相同私钥，否则 Chrome 会生成不同的扩展 ID。请勿提交、公开或丢失私钥。

GitHub Actions 持续发布（推送到 `main` 且 `package.json` 版本变化时自动触发，或手动运行）：

- 构建 Chrome MV3 产物，生成 `.zip` 与 `.crx`，同时打包外置资源（OCR 离线包、站点图标 HD 包）并一并上传至 GitHub Release。
- 配置 `CRX_PRIVATE_KEY_2_0` 后可稳定复用扩展签名；未配置时会自动生成新私钥。
- Edge Add-ons 发布改为手动触发：运行独立工作流「发布至 Edge Add-ons」并可选指定 Release 标签（需配置 `EDGE_CLIENT_ID`、`EDGE_API_KEY`、`EDGE_PRODUCT_ID`）。

### 6. 外置资源打包

```bash
npm run pack:ocr
npm run pack:icons
```

- `pack:ocr`：生成可由设置页导入的 OCR 离线资源包。
- `pack:icons`：生成站点图标资源包。

以上产物会随 GitHub Release 一并发布，可直接从 Release 附件下载，无需自行打包。

### 支持的浏览器

| 浏览器 | 产物 | 状态 |
| --- | --- | --- |
| Chrome | `.output/chrome-mv3/` | 完整支持（默认验收目标） |
| Edge / Chromium 系（Brave、Opera、Vivaldi 等） | 可直接加载 Chrome 产物 | 预计可用 |
| Firefox | `npm run build:firefox` | 保留构建入口，未完整验证 |

已知差异：

- 本地 OCR 依赖 Chrome 特有的 `offscreen` API，Firefox 上离线推理不可用，只能使用 MoviePilot OCR 或 AI 视觉服务。
- Firefox 对 `cookies` 权限限制更严格，站点 Cookie/UA 同步和登录态判断需要更多用户授权。
- Firefox 产物的 Manifest 版本与 CSP 字段可能与 Chrome 存在差异，使用前请实测验证。

---

## 🔑 扩展权限说明

| 权限 | 用途 |
| --- | --- |
| `storage` | 保存公共设置、加密信封、会话和任务状态 |
| `cookies` | 读取、比较、覆盖和清理站点 Cookie |
| `alarms` | Cookie/UA 更新、自动打开站点和自动备份任务 |
| `scripting` | 执行受控页面脚本和扩展桥接 |
| `activeTab` | 获取当前站点、二维码、凭据和下载上下文 |
| `downloads` | 导出备份、图片和数据文件 |
| `notifications` | 后台任务结果通知 |
| `offscreen` | 在独立文档中执行本地 ONNX OCR |
| `<all_urls>` | 连接用户自建 MoviePilot、PT 站点、WebDAV 和配置的服务地址 |

扩展页面 CSP 仅允许本扩展脚本及 WebAssembly 执行，不开放远程脚本和 `blob:` 脚本来源。

---

## 📦 资源与体积策略

为控制主扩展包体积，以下资源不直接内置到发布包：

- OCR ONNX 模型；
- OCR 字符集和自定义词表；
- ONNX Runtime WASM；
- 站点高清图标包。

构建只复制 ONNX Runtime 必需的 JavaScript 胶水文件。用户可在设置页导入离线 OCR 包和站点图标包，二进制内容保存到 IndexedDB。

---

## ⚠️ 使用说明

1. 首次使用需要填写自己的 MoviePilot 地址、用户名、密码和可选 OTP。
2. Cookie/UA 同步和站点登录状态判断依赖浏览器 Cookie 权限。
3. 本地 OCR 需要先在设置页导入与模型匹配的离线资源包。
4. MoviePilot 远端备份依赖服务端安装并启用 `moviepilot-tools` 插件；大文件分片能力需要对应插件版本支持。
5. WebDAV 服务器必须允许扩展配置的地址执行目录、上传、下载和删除请求。
6. Bitwarden 导入支持登录项中的凭据及 `login.totp`；无效 HOTP、无效 Base32 或无效 `otpauth` 配置会被跳过。
7. 内网站点自动分类依据主机名和私有地址范围判断，用户仍可在凭据编辑页手动调整分组。
8. 验证码 OCR 只读取当前页面显示的图片像素，不会二次请求验证码图片地址。

---

## 🔒 隐私政策

- [隐私政策](docs/PRIVACY_POLICY.md)：MoviePilot Tools 的数据收集、存储、第三方服务与联系说明。

---

## 📄 许可证

本项目采用 **GPL-3.0 License** 许可证。详情请参阅 [LICENSE](LICENSE) 文件。

---

## 🚀 当前版本

### `v2.1.0`

- **MoviePilot V3 全面适配**：
  - 重构 API 响应解析器，全面兼容 MoviePilot V3 的 `{ success: true, data: ... }` / `{ items: ... }` 标准包装，兼顾 V2 扁平结构。
  - 用户信息（`fetchCurrentUser`）、站点列表（`fetchSites`）及适配站点字典（`fetchSupportingSites`）自动安全解包。
  - 站点数据统计视图强化空值容错和去重映射，防止异步异常。
- **Cookie (CK) 检测与同步链路重构**：
  - **双路并行抓取**：按 URL 与 Domain（Host 维度）并行读取并去重合并，彻底解决二级域名与特定路径 Cookie 漏读问题。
  - **智能差异比对 (Diff)**：扩充统计与偏好噪声过滤清单（忽略百度统计、Clarity、主题语言偏好等），仅针对核心鉴权凭据进行比对，消除虚假变动误报。
  - **服务端同步安全加固**：优先复用前端捕获的有效 Cookie 并做空值兜底保护；统一多环境 `globalThis.navigator.userAgent` 兼容性。
- **扩展更新多级弹性保障链**：
  - **MP Token 自动注入**：检查更新时自动从 MoviePilot 获取 `GITHUB_TOKEN` 鉴权，将 API 请求限流额度从 60 次/小时提升至 5000 次/小时。
  - **403 智能冷却与防击穿**：捕获 GitHub API 限流状态，记录冷却周期，冷却期间自动跳过无效请求，避免网络消耗与控制台报错。
  - **静态 CDN 全球免限流兜底**：当遇到 GitHub 403 限流或网络异常时，自动无缝降级至 jsDelivr CDN 镜像源读取版本，免翻墙且秒级响应。
  - **更新包全链路镜像加速**：一键下载新版本更新包时，集成国内开源镜像加速服务，彻底解决 Release 资产国内下载缓慢与断连问题。
- **关于页面版本交互与感知增强**：
  - 版本标签新增更新徽章提示与动画效果，悬停即时展示最新版本信息。
  - 接入一键下载安装包与一键访问发布页功能，支持深色模式全量适配。
- **工程与测试体系完善**：
  - 新增扩展更新检测、Cookie Diff 比对、用户服务 V2/V3 解包等完整单元测试，全量 242 项测试稳定通过。

### `v2.0.0`

- 使用 WXT、Vue 3、Element Plus 和 TypeScript 重构为 Chrome Manifest V3 扩展。
- 完成站点管理、站点数据、下载管理、TOTP、凭据管理、插件管理、智能助手、用户信息和设置模块。
- 建立 Public、Private、Device、Assets、Cache 五类存储边界及 IndexedDB 资产仓。
- 敏感数据统一使用 Web Crypto 加密信封保存。
- 完成恢复密钥、本地加密 JSON、MoviePilot 与 WebDAV 快照备份。
- 完成本地 ONNX、MoviePilot OCR 和 AI 视觉三级验证码识别链。
- 凭据管理支持 Bitwarden 登录凭据与 TOTP 导入，以及 PT站点、内网、自定义和用户自定义分组。

---

## 🙏 致谢

- [MoviePilot](https://movie-pilot.org/)：提供完整的影视媒体自动化管理平台。
- MoviePilot 社区及各 PT 站点适配贡献者。
- Vue、WXT、Element Plus、ONNX Runtime Web 等开源项目。

> [!NOTE]
> 本项目包含 AI 辅助开发内容。欢迎通过 Issue 或 Pull Request 反馈功能问题、兼容性问题和改进建议。
