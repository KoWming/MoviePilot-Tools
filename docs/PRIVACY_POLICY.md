# Privacy Policy for MoviePilot Tools / MoviePilot Tools 隐私政策

Last updated: June 05, 2026 / 更新日期：2026年6月5日

---

## English Version

We respect your privacy and are committed to protecting it. This Privacy Policy describes how the **MoviePilot Tools** browser extension handles your information.

### 1. No Data Collection by the Developer
MoviePilot Tools is a client-side utility designed to communicate directly with your own self-hosted MoviePilot server. 
- **We do not collect, store, or transmit any of your personal data, credentials, login information, or browsing history to any third-party servers or to the developers.**
- All operations (such as syncing cookies, generating TOTP codes, and recognizing login captchas) are processed locally on your device or between the extension and your designated self-hosted server.

### 2. Information Accessed and Stored Locally
To provide its core features, the extension accesses and saves the following data strictly within your local browser storage:
- **Server Address & API Token**: Stored locally (using encryption where sensitive) to authenticate requests sent to your self-hosted MoviePilot server.
- **PT Site Cookies**: Accessed locally to sync them directly to your self-hosted server to keep searches working. They are never sent to any other destination.
- **TOTP Secret Keys**: Stored encrypted locally to generate two-step authentication codes in the popup.
- **WebDav Settings**: Stored locally to allow encrypted configuration backups to your own private WebDav storage.

### 3. Third-Party Web Services
The extension does not interact with any third-party web services, track trackers, or insert ads. It operates completely inside your browser sandbox and communicates only with URLs configured explicitly by you.

### 4. Consent and Changes
By using MoviePilot Tools, you consent to this Privacy Policy. If we update this policy, we will revise the date at the top of this document.

### 5. Contact
If you have any questions regarding this policy or the extension's data practices, you can review the open-source code or contact the project maintainers on GitHub.

---

## 中文版 (Chinese Version)

我们非常重视您的隐私，并承诺保护您的个人信息。本隐私政策适用于您使用 **MoviePilot Tools** 浏览器扩展。

### 1. 开发者不收集任何数据
MoviePilot Tools 是一款完全运行在客户端的配套辅助工具。
- **我们（开发者）不会收集、存储、上传或向任何第三方（或开发者服务器）传输您的任何个人数据、账号凭据、站点 Cookie、两步验证密钥或浏览历史记录。**
- 所有的核心操作（如生成 TOTP 验证码、Cookie/UA 同步、离线验证码识别等）均在您本机的浏览器沙盒内完成，或仅在您本机的扩展与您自行部署的 MoviePilot 服务器之间直接通信。

### 2. 本地读取与存储的信息
为实现核心功能，扩展仅在您本机的浏览器本地安全存储或访问以下信息：
- **服务器地址与 API Token**：安全存储在浏览器本地中，以向您指定的 MoviePilot 服务端进行身份鉴权。
- **PT 站点 Cookie 与 User-Agent**：从您已登录的站点中安全读取，并直接同步到您的自建 MoviePilot 服务器，以确保服务端检索任务保持登录状态。此数据绝不会发送到除您自建服务器之外的任何地方。
- **两步验证 (TOTP) 密钥**：以强加密形式保存在浏览器本地，仅用于在弹窗内动态生成两步验证数字码。
- **WebDav 备份配置**：安全存储在本地，仅用于将加密后的凭据数据备份到您自己拥有的私有 WebDav 存储空间。

### 3. 第三方服务与广告
扩展不包含任何第三方追踪器、分析软件或广告，也不会在网页中插入广告。扩展仅与您在设置中主动配置的服务器地址进行 API 交互。

### 4. 政策修改与同意
使用本扩展即表示您同意本隐私政策。如果我们对政策进行更新，将在此页面公布并修改顶部的更新时间。

### 5. 联系我们
如果您对本隐私政策或扩展的数据处理方式有任何疑问，可以通过查看开源代码或在 GitHub 仓库中提交 Issue 联系维护者。
