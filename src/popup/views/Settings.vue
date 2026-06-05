<template>
  <div class="settings-root">
    <el-card class="settings-card" shadow="hover">
      <div class="section-header">
        <div class="section-icon">
          <svg viewBox="0 0 24 24"><path :d="mdiShieldLockOutline" /></svg>
        </div>
        <div class="section-title-wrap">
          <div class="section-title">安全设置</div>
          <div class="section-subtitle">保护扩展弹窗访问</div>
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-main">
          <div class="setting-title">PIN 安全保护</div>
          <div class="setting-desc">启用后，打开 popup 需要输入 PIN 验证。</div>
        </div>
        <el-switch
          v-model="pinEnabled"
          :loading="pinSaving"
          @change="onPinSwitchChange"
        />
      </div>

      <div class="frequency-block" v-if="pinEnabled">
        <div class="setting-title">PIN 验证频率</div>
        <el-radio-group v-model="pinFrequency" class="frequency-options" @change="onFrequencyChange">
          <el-radio value="session" class="frequency-option">
            <div class="frequency-content">
              <div class="frequency-title">浏览器关闭前无需验证</div>
              <div class="frequency-desc">本次浏览器会话内解锁一次即可。</div>
            </div>
          </el-radio>
          <el-radio value="always" class="frequency-option">
            <div class="frequency-content">
              <div class="frequency-title">每次打开都需要验证</div>
              <div class="frequency-desc">每次打开 popup 都要求输入 PIN。</div>
            </div>
          </el-radio>
        </el-radio-group>
      </div>
    </el-card>

    <el-card class="settings-card" shadow="hover">
      <div class="section-header">
        <div class="section-icon cookie-icon">
          <svg viewBox="0 0 24 24"><path :d="mdiCookieRefreshOutline" /></svg>
        </div>
        <div class="section-title-wrap">
          <div class="section-title">自动更新 Cookie 和 UserAgent</div>
          <div class="section-subtitle">同步浏览器登录状态到 MoviePilot</div>
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-main">
          <div class="setting-title">每日首次更新 <span class="recommend-tag">推荐</span></div>
          <div class="setting-desc">启用后每天首次打开浏览器时自动更新。</div>
        </div>
        <el-switch
          v-model="autoUpdateConfig.dailyFirstEnabled"
          :loading="autoUpdateSaving"
          @change="saveAutoUpdateConfig"
        />
      </div>

      <div class="setting-row interval-row">
        <div class="setting-main">
          <div class="setting-title">定时更新</div>
          <div class="setting-desc">可设置定时检查自动更新的时间间隔。</div>
        </div>
        <el-switch
          v-model="autoUpdateConfig.intervalEnabled"
          :loading="autoUpdateSaving"
          @change="saveAutoUpdateConfig"
        />
      </div>

      <div class="interval-select-row" v-if="autoUpdateConfig.intervalEnabled">
        <div class="setting-title">定时检查间隔</div>
        <el-select
          v-model="autoUpdateConfig.intervalMinutes"
          class="interval-select"
          :disabled="autoUpdateSaving"
          @change="saveAutoUpdateConfig"
        >
          <el-option
            v-for="item in intervalPresets"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </div>
    </el-card>

    <el-card class="settings-card" shadow="hover">
      <div class="section-header">
        <div class="section-icon embed-icon">
          <svg viewBox="0 0 24 24"><path :d="mdiWebBox" /></svg>
        </div>
        <div class="section-title-wrap">
          <div class="section-title">WEB 嵌入功能设置</div>
          <div class="section-subtitle">控制注入站点页面的增强功能</div>
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-main">
          <div class="setting-title">种子详情页一键下载</div>
          <div class="setting-desc">启用种子详情页的一键下载功能。</div>
        </div>
        <el-switch
          v-model="webEmbedConfig.torrentDetailDownloadEnabled"
          :loading="webEmbedSaving"
          @change="saveWebEmbedConfigForm"
        />
      </div>

      <div class="setting-row interval-row">
        <div class="setting-main">
          <div class="setting-title">两步验证自动填充</div>
          <div class="setting-desc">在登录页面自动填充两步验证码。</div>
        </div>
        <el-switch
          v-model="webEmbedConfig.totpAutoFillEnabled"
          :loading="webEmbedSaving"
          @change="saveWebEmbedConfigForm"
        />
      </div>

      <div class="setting-row interval-row">
        <div class="setting-main">
          <div class="setting-title">图片验证码自动填充 <span class="recommend-tag">服务端识别</span></div>
          <div class="setting-desc">在登录页面自动识别图片验证码并填充。</div>
        </div>
        <el-switch
          v-model="webEmbedConfig.captchaAutoFillEnabled"
          :loading="webEmbedSaving"
          @change="saveWebEmbedConfigForm"
        />
      </div>

      <div class="setting-row interval-row" v-if="webEmbedConfig.captchaAutoFillEnabled">
        <div class="setting-main">
          <div class="setting-title">内置离线 OCR <span class="recommend-tag">本地识别</span></div>
          <div class="setting-desc">启用后使用扩展内置模型在浏览器本地识别，不调用远程 OCR 或 AI；参考 Mieru-OCR 项目实现。</div>
        </div>
        <el-switch
          v-model="webEmbedConfig.captchaOfflineOcrEnabled"
          :loading="webEmbedSaving"
          @change="saveWebEmbedConfigForm"
        />
      </div>

      <div class="setting-row interval-row" v-if="webEmbedConfig.captchaAutoFillEnabled">
        <div class="setting-main">
          <div class="setting-title">AI 辅助识别 <span class="speed-tag">提高准确率但速度较慢</span></div>
          <div class="setting-desc">启用后优先检测 MoviePilot 智能助手状态，已启用时调用支持视觉的模型识别验证码。</div>
        </div>
        <el-switch
          v-model="webEmbedConfig.captchaAiAssistEnabled"
          :loading="webEmbedSaving"
          @change="saveWebEmbedConfigForm"
        />
      </div>

      <div class="setting-row interval-row" v-if="webEmbedConfig.captchaAutoFillEnabled && webEmbedConfig.captchaAiAssistEnabled">
        <div class="setting-main" style="flex-direction: column; align-items: flex-start; gap: 6px;">
          <div class="setting-title">API Token</div>
          <div class="setting-desc">MoviePilot 的 API_TOKEN（默认 moviepilot），用于 OpenAI 兼容接口认证。</div>
          <div style="margin-top: 4px; max-width: 260px; width: 100%;">
            <el-input
              v-model="apiTokenInput"
              type="password"
              show-password
              :placeholder="apiTokenPlaceholder"
              size="small"
              @change="saveApiToken"
              @focus="onApiTokenFocus"
              @blur="onApiTokenBlur"
            />
          </div>
        </div>
      </div>
    </el-card>

    <el-card class="settings-card" shadow="hover">
      <div class="section-header">
        <div class="section-icon pt-creds-icon">
          <svg viewBox="0 0 24 24"><path :d="mdiKeyOutline" /></svg>
        </div>
        <div class="section-title-wrap">
          <div class="section-title">PT 站点账号管理</div>
          <div class="section-subtitle">管理自动保存与填充的 PT 站点凭据</div>
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-main">
          <div class="setting-title">自动保存</div>
          <div class="setting-desc">启用后，在 PT 站点登录时自动提示保存账号密码。</div>
        </div>
        <el-switch
          v-model="ptCredsConfig.autoSaveEnabled"
          :loading="ptCredsSaving"
          @change="savePtCredsConfigForm"
        />
      </div>

      <div class="setting-row interval-row">
        <div class="setting-main">
          <div class="setting-title">自动填充</div>
          <div class="setting-desc">启用后，打开已保存的 PT 站点登录页时自动填充。</div>
        </div>
        <el-switch
          v-model="ptCredsConfig.autoFillEnabled"
          :loading="ptCredsSaving"
          @change="savePtCredsConfigForm"
        />
      </div>

      <el-form label-position="top" class="webdav-form">
        <el-form-item class="backup-key-item">
          <div class="setting-title">备份密钥</div>
          <div class="setting-desc">用于加密两步验证和 PT 账号凭据的本地 JSON / WebDav 备份，跨设备还原时需使用相同密钥。</div>
          <el-input
            v-model="ptBackupKeyInput"
            class="backup-key-input"
            type="password"
            show-password
            :placeholder="ptBackupKeyPlaceholder"
            :disabled="ptBackupKeySaving"
            @focus="onPtBackupKeyFocus"
            @blur="onPtBackupKeyBlur"
          />
        </el-form-item>
        <div class="settings-actions">
          <el-button @click="generatePtBackupKeyValue" :disabled="ptBackupKeySaving">随机生成</el-button>
          <el-button type="primary" @click="savePtBackupKeyValue" :loading="ptBackupKeySaving">保存密钥</el-button>
        </div>
      </el-form>
    </el-card>

    <el-card class="settings-card" shadow="hover">
      <div class="section-header">
        <div class="section-icon webdav-icon">
          <svg viewBox="0 0 24 24"><path :d="mdiWebBox" /></svg>
        </div>
        <div class="section-title-wrap">
          <div class="section-title">WebDav 备份设置</div>
          <div class="section-subtitle">配置两步验证和 PT 账号凭据备份使用的 WebDav 信息</div>
        </div>
      </div>

      <el-form :model="webdavForm" label-position="top" class="webdav-form">
        <el-form-item label="服务器地址" required>
          <el-input
            v-model="webdavForm.url"
            placeholder="https://dav.example.com/backups"
            :disabled="webdavSaving"
          />
        </el-form-item>

        <div class="row-two">
          <el-form-item label="备份路径" class="half">
            <el-input
              v-model="webdavForm.path"
              placeholder="/MP-Totp"
              :disabled="webdavSaving"
            />
          </el-form-item>
          <el-form-item label="保留份数" class="half">
            <el-input-number
              v-model="webdavForm.retainCount"
              :min="0"
              :step="1"
              controls-position="right"
              :disabled="webdavSaving"
              style="width: 100%;"
            />
          </el-form-item>
        </div>

        <div class="row-two">
          <el-form-item label="用户名" class="half" required>
            <el-input
              v-model="webdavForm.username"
              placeholder="用户名"
              :disabled="webdavSaving"
            />
          </el-form-item>
          <el-form-item label="密码" class="half" required>
            <el-input
              v-model="webdavForm.password"
              type="password"
              show-password
              placeholder="密码"
              :disabled="webdavSaving"
            />
          </el-form-item>
        </div>

        <div class="setting-row interval-row">
          <div class="setting-main">
            <div class="setting-title">定时自动备份</div>
            <div class="setting-desc">开启后定时自动备份两步验证配置到 WebDav。</div>
          </div>
          <el-switch
            v-model="webdavForm.autoEnabled"
            :loading="webdavSaving"
          />
        </div>

        <div class="interval-select-row" v-if="webdavForm.autoEnabled">
          <div class="setting-title">备份频率</div>
          <el-select
            v-model="webdavForm.intervalHours"
            class="interval-select"
            :disabled="webdavSaving"
          >
            <el-option :value="6" label="每 6 小时" />
            <el-option :value="12" label="每 12 小时" />
            <el-option :value="24" label="每天" />
            <el-option :value="48" label="每 2 天" />
          </el-select>
        </div>

        <div class="setting-row interval-row">
          <div class="setting-main">
            <div class="setting-title">新增站点时自动备份</div>
            <div class="setting-desc">新增两步验证站点或 PT 账号凭据后自动备份到 WebDav。</div>
          </div>
          <el-switch
            v-model="webdavForm.autoOnChange"
            :loading="webdavSaving"
          />
        </div>

        <el-alert type="info" :closable="false" class="webdav-tip">
          提示：需在扩展后台运行时才能按时备份。两步验证和 PT 账号管理页面的“导出到 WebDav”“从 WebDav 导入/还原”会使用这里的配置。
        </el-alert>

        <div class="settings-actions">
          <el-button @click="loadWebDavSettings" :disabled="webdavSaving">重置</el-button>
          <el-button type="primary" @click="saveWebDavSettings" :loading="webdavSaving">保存</el-button>
        </div>
      </el-form>
    </el-card>

    <el-card class="settings-card" shadow="hover">
      <div class="section-header">
        <div class="section-icon open-icon">
          <svg viewBox="0 0 24 24"><path :d="mdiOpenInNew" /></svg>
        </div>
        <div class="section-title-wrap">
          <div class="section-title">自动打开站点</div>
          <div class="section-subtitle">按月或定时自动打开所有启用站点</div>
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-main">
          <div class="setting-title">每月首次打开</div>
          <div class="setting-desc">启用后每月首次打开浏览器自动打开所有站点。</div>
        </div>
        <el-switch
          v-model="siteAutoOpenConfig.monthlyFirstEnabled"
          :loading="siteAutoOpenSaving"
          @change="saveSiteAutoOpenConfigForm"
        />
      </div>

      <div class="setting-row interval-row">
        <div class="setting-main">
          <div class="setting-title">定时打开</div>
          <div class="setting-desc">可设置定时打开所有站点的时间间隔。</div>
        </div>
        <el-switch
          v-model="siteAutoOpenConfig.intervalEnabled"
          :loading="siteAutoOpenSaving"
          @change="saveSiteAutoOpenConfigForm"
        />
      </div>

      <div class="interval-select-row" v-if="siteAutoOpenConfig.intervalEnabled">
        <div class="setting-title">定时打开间隔</div>
        <el-select
          v-model="siteAutoOpenConfig.intervalDays"
          class="interval-select"
          :disabled="siteAutoOpenSaving"
          @change="saveSiteAutoOpenConfigForm"
        >
          <el-option
            v-for="item in siteOpenIntervalPresets"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </div>

      <div class="setting-row interval-row">
        <div class="setting-main">
          <div class="setting-title">自动关闭标签页</div>
          <div class="setting-desc">启用后，自动在打开指定时间后关闭自动打开的标签页。</div>
        </div>
        <el-switch
          v-model="siteAutoOpenConfig.autoCloseEnabled"
          :loading="siteAutoOpenSaving"
          @change="saveSiteAutoOpenConfigForm"
        />
      </div>

      <div class="interval-select-row" v-if="siteAutoOpenConfig.autoCloseEnabled">
        <div class="setting-title">自动关闭时间</div>
        <el-select
          v-model="siteAutoOpenConfig.closeDelayMinutes"
          class="interval-select"
          :disabled="siteAutoOpenSaving"
          @change="saveSiteAutoOpenConfigForm"
        >
          <el-option
            v-for="item in siteCloseDelayPresets"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </div>

      <div class="setting-row interval-row" v-if="siteAutoOpenConfig.autoCloseEnabled">
        <div class="setting-main">
          <div class="setting-title">保留未登录的站点</div>
          <div class="setting-desc">启用后，标题包含“登录”、“登陆”等关键词的标签页将被保留。</div>
        </div>
        <el-switch
          v-model="siteAutoOpenConfig.keepLoginTabsEnabled"
          :loading="siteAutoOpenSaving"
          @change="saveSiteAutoOpenConfigForm"
        />
      </div>
    </el-card>

    <el-card class="settings-card" shadow="hover">
      <div class="section-header">
        <div class="section-icon bg-icon">
          <svg viewBox="0 0 24 24"><path :d="mdiImageOutline" /></svg>
        </div>
        <div class="section-title-wrap">
          <div class="section-title">自定义背景</div>
          <div class="section-subtitle">为插件弹窗设置个性化背景图片</div>
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-main">
          <div class="setting-title">使用自定义背景</div>
          <div class="setting-desc">启用后，插件将使用您设置的自定义背景图片。</div>
        </div>
        <el-switch
          v-model="customBgConfig.enabled"
          :loading="customBgSaving"
          @change="saveCustomBgConfig"
        />
      </div>

      <template v-if="customBgConfig.enabled">
        <div class="setting-row interval-row">
          <div class="setting-main">
            <div class="setting-title">自定义图片</div>
            <div class="setting-desc">上传本地图片作为自定义背景。</div>
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <el-upload
              action="#"
              :auto-upload="false"
              :show-file-list="false"
              accept="image/*"
              :on-change="handleLocalBgUpload"
              :disabled="customBgSaving"
            >
              <el-button size="small" type="primary" :loading="customBgSaving">选择图片</el-button>
            </el-upload>
            <el-button
              v-if="bgStore.image"
              size="small"
              type="danger"
              plain
              :loading="customBgSaving"
              @click="clearBgImage"
            >清除</el-button>
          </div>
        </div>

        <div class="setting-row interval-row" style="flex-direction: column; align-items: flex-start; gap: 6px;">
          <div class="setting-title">从 URL 获取</div>
          <div class="setting-desc">输入网络图片 URL，点击测试以下载并作为背景。</div>
          <div style="margin-top: 4px; display: flex; gap: 8px; width: 100%;">
            <el-input
              v-model="customBgConfig.url"
              placeholder="https://example.com/image.jpg"
              size="small"
              :disabled="customBgSaving || testingUrl"
            />
            <el-button
              size="small"
              type="primary"
              :loading="testingUrl"
              @click="testBgUrl"
            >测试</el-button>
          </div>
        </div>

        <div class="setting-row interval-row">
          <div class="setting-main">
            <div class="setting-title">模糊背景</div>
            <div class="setting-desc">启用后，将为背景图片添加高斯模糊效果。</div>
          </div>
          <el-switch
            v-model="customBgConfig.blurEnabled"
            :loading="customBgSaving"
            @change="saveCustomBgConfig"
          />
        </div>

        <div class="interval-select-row" v-if="customBgConfig.blurEnabled">
          <div class="setting-title" style="display: flex; justify-content: space-between;">
            <span>模糊度</span>
            <span>{{ customBgConfig.blur }}px</span>
          </div>
          <el-slider
            v-model="customBgConfig.blur"
            :min="1"
            :max="20"
            :step="1"
            :disabled="customBgSaving"
            @change="saveCustomBgConfig"
          />
        </div>

        <div class="interval-select-row">
          <div class="setting-title" style="display: flex; justify-content: space-between;">
            <span>不透明度</span>
            <span>{{ Math.round(customBgConfig.opacity * 100) }}%</span>
          </div>
          <el-slider
            v-model="customBgConfig.opacity"
            :min="0.1"
            :max="1"
            :step="0.05"
            :disabled="customBgSaving"
            @change="saveCustomBgConfig"
          />
        </div>
      </template>
    </el-card>

    <el-dialog
      v-model="pinDialogVisible"
      :title="pinDialogTitle"
      width="95%"
      append-to-body
      align-center
      :close-on-click-modal="false"
      @closed="resetPinForm"
    >
      <el-form v-if="pinDialogMode === 'enable'" label-position="top" @submit.prevent="savePin">
        <el-form-item label="设置 PIN">
          <div class="pin-code-inputs" :ref="(el: any) => setPinGroupRef('pin', el)">
            <input
              v-for="(_, idx) in 6" :key="idx"
              type="password" inputmode="numeric" maxlength="1"
              class="pin-code-box"
              :value="pinForm.pin[idx] || ''"
              @input="(e: Event) => onPinDigitInput('pin', idx, e)"
              @keydown="(e: KeyboardEvent) => onPinDigitKeydown('pin', idx, e)"
              @paste="(e: ClipboardEvent) => onPinPaste('pin', e)"
              @focus="($event.target as HTMLInputElement).select()"
            />
          </div>
        </el-form-item>
        <el-form-item label="确认 PIN">
          <div class="pin-code-inputs" :ref="(el: any) => setPinGroupRef('confirmPin', el)">
            <input
              v-for="(_, idx) in 6" :key="idx"
              type="password" inputmode="numeric" maxlength="1"
              class="pin-code-box"
              :value="pinForm.confirmPin[idx] || ''"
              @input="(e: Event) => onPinDigitInput('confirmPin', idx, e)"
              @keydown="(e: KeyboardEvent) => onPinDigitKeydown('confirmPin', idx, e)"
              @paste="(e: ClipboardEvent) => onPinPaste('confirmPin', e)"
              @focus="($event.target as HTMLInputElement).select()"
              @keyup.enter="savePin"
            />
          </div>
        </el-form-item>
      </el-form>
      <el-form v-else label-position="top" @submit.prevent="disablePinWithVerification">
        <el-form-item label="当前 PIN">
          <div class="pin-code-inputs" :ref="(el: any) => setPinGroupRef('currentPin', el)">
            <input
              v-for="(_, idx) in 6" :key="idx"
              type="password" inputmode="numeric" maxlength="1"
              class="pin-code-box"
              :value="pinForm.currentPin[idx] || ''"
              @input="(e: Event) => onPinDigitInput('currentPin', idx, e)"
              @keydown="(e: KeyboardEvent) => onPinDigitKeydown('currentPin', idx, e)"
              @paste="(e: ClipboardEvent) => onPinPaste('currentPin', e)"
              @focus="($event.target as HTMLInputElement).select()"
              @keyup.enter="disablePinWithVerification"
            />
          </div>
        </el-form-item>
        <div class="dialog-tip">{{ pinDialogTip }}</div>
      </el-form>
      <template #footer>
        <el-button @click="cancelPinDialog">取消</el-button>
        <el-button
          type="primary"
          :loading="pinSaving"
          @click="handlePinDialogConfirm"
        >{{ pinDialogConfirmText }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { mdiCookieRefreshOutline, mdiOpenInNew, mdiShieldLockOutline, mdiWebBox, mdiKeyOutline, mdiImageOutline } from '@mdi/js';
import { compressAndResizeImage, downloadAndCompressImage, saveCustomBgConfig as saveCustomBgToStorage, saveCustomBgImage as saveCustomBgImageToStorage, clearCustomBgImage } from '../../shared/customBg';
import { bgStore, updateBgStore } from '../../shared/stores/bgStore';
import { COOKIE_UA_INTERVAL_PRESETS, getCookieUaAutoUpdateConfig, saveCookieUaAutoUpdateConfig, type CookieUaAutoUpdateConfig } from '../../shared/cookieUaAutoUpdate';
import { disablePinSecurity, getPinRuleText, getPinSecurityConfig, getPinVerifyFrequency, isPinSecurityEnabled, markPinUnlockedForSession, setPinSecurity, updatePinVerifyFrequency, verifyPin, type PinVerifyFrequency } from '../../shared/pinSecurity';
import { PTCredentialStorageService } from '../../shared/services/ptCredentialStorage';
import { getSiteAutoOpenConfig, saveSiteAutoOpenConfig, SITE_AUTO_CLOSE_DELAY_PRESETS, SITE_AUTO_OPEN_INTERVAL_PRESETS, type SiteAutoOpenConfig } from '../../shared/siteAutoOpen';
import { getWebEmbedFeaturesConfig, saveWebEmbedFeaturesConfig, type WebEmbedFeaturesConfig } from '../../shared/webEmbedFeatures';
import { STORAGE_KEYS } from '../../shared/constants';
import { encryptWebDavPassword, decryptWebDavPassword, encryptApiToken, decryptApiToken, encryptWebDavUsername, decryptWebDavUsername, encryptWebDavUrl, decryptWebDavUrl } from '../../shared/secureStorage';
import { generatePtBackupKey, loadPtBackupKey, savePtBackupKey } from '../../shared/ptBackupCrypto';

const emit = defineEmits(['navigate']);
const pinEnabled = ref(false);
const pinFrequency = ref<PinVerifyFrequency>('always');
const pendingFrequency = ref<PinVerifyFrequency | null>(null);
const pinSaving = ref(false);
const pinDialogVisible = ref(false);
const pinDialogMode = ref<'enable' | 'disable' | 'frequency'>('enable');
const pinForm = reactive({ pin: '', confirmPin: '', currentPin: '' });
const autoUpdateSaving = ref(false);
const intervalPresets = COOKIE_UA_INTERVAL_PRESETS;
const autoUpdateConfig = reactive<CookieUaAutoUpdateConfig>({
  dailyFirstEnabled: false,
  intervalEnabled: false,
  intervalMinutes: 360
});
const webEmbedSaving = ref(false);
const webEmbedConfig = reactive<WebEmbedFeaturesConfig>({
  torrentDetailDownloadEnabled: true,
  totpAutoFillEnabled: false,
  captchaAutoFillEnabled: false,
  captchaOfflineOcrEnabled: false,
  captchaAiAssistEnabled: false
});
const webdavSaving = ref(false);
const webdavForm = reactive({
  url: '',
  path: '',
  username: '',
  password: '',
  autoEnabled: false,
  intervalHours: 24,
  autoOnChange: false,
  retainCount: 0
});
const apiTokenInput = ref('');
const apiTokenPlaceholder = ref('moviepilot');
const apiTokenRaw = ref('');
const siteAutoOpenSaving = ref(false);
const siteOpenIntervalPresets = SITE_AUTO_OPEN_INTERVAL_PRESETS;
const siteCloseDelayPresets = SITE_AUTO_CLOSE_DELAY_PRESETS;
const siteAutoOpenConfig = reactive<SiteAutoOpenConfig>({
  monthlyFirstEnabled: false,
  intervalEnabled: false,
  intervalDays: 7,
  autoCloseEnabled: false,
  keepLoginTabsEnabled: true,
  closeDelayMinutes: 5
});

// PT Credentials State & Methods
const ptCredsConfig = reactive({
  autoSaveEnabled: true,
  autoFillEnabled: true
});
const ptCredsSaving = ref(false);
const ptBackupKeyInput = ref('');
const ptBackupKeyRaw = ref('');
const ptBackupKeyPlaceholder = ref('未设置，建议随机生成');
const ptBackupKeySaving = ref(false);

async function loadPtCredsConfig() {
  const cfg = await PTCredentialStorageService.getPtCredsConfig();
  Object.assign(ptCredsConfig, cfg);
}

async function loadPtBackupKeyValue() {
  const key = await loadPtBackupKey();
  ptBackupKeyRaw.value = key;
  ptBackupKeyPlaceholder.value = key ? desensitize(key) : '未设置，建议随机生成';
  ptBackupKeyInput.value = '';
}

function onPtBackupKeyFocus() {
  if (!ptBackupKeyInput.value) ptBackupKeyInput.value = ptBackupKeyRaw.value;
}

function onPtBackupKeyBlur() {
  if (ptBackupKeyInput.value === ptBackupKeyRaw.value) ptBackupKeyInput.value = '';
}

function generatePtBackupKeyValue() {
  ptBackupKeyInput.value = generatePtBackupKey();
}

async function savePtBackupKeyValue() {
  const key = ptBackupKeyInput.value.trim();
  if (!key) { ElMessage.error('请填写或随机生成 PT 备份密钥'); return; }
  ptBackupKeySaving.value = true;
  try {
    await savePtBackupKey(key);
    ptBackupKeyRaw.value = key;
    ptBackupKeyPlaceholder.value = desensitize(key);
    ptBackupKeyInput.value = '';
    ElMessage.success('PT 备份密钥已保存');
  } catch (error) {
    await loadPtBackupKeyValue();
    ElMessage.error((error as Error).message || '保存 PT 备份密钥失败');
  } finally {
    ptBackupKeySaving.value = false;
  }
}

async function savePtCredsConfigForm() {
  ptCredsSaving.value = true;
  try {
    await PTCredentialStorageService.savePtCredsConfig({ ...ptCredsConfig });
    ElMessage.success('PT 账号保存与填充设置已更新');
  } catch (error) {
    await loadPtCredsConfig();
    ElMessage.error((error as Error).message || '保存配置失败');
  } finally {
    ptCredsSaving.value = false;
  }
}

function openPtCredsManager() {
  emit('navigate', 'pt-creds-manager');
}


const pinDialogTitle = computed(() => {
  if (pinDialogMode.value === 'enable') return '启用 PIN 安全保护';
  if (pinDialogMode.value === 'frequency') return '确认 PIN 验证频率';
  return '关闭 PIN 安全保护';
});

const pinDialogTip = computed(() => {
  if (pinDialogMode.value === 'frequency') {
    return '验证通过后将切换为“每次打开都需要验证”。';
  }
  return '验证通过后将关闭 PIN 安全保护。重新打开后可设置新的 PIN。';
});

const pinDialogConfirmText = computed(() => {
  if (pinDialogMode.value === 'enable') return '保存';
  if (pinDialogMode.value === 'frequency') return '验证并切换';
  return '验证并关闭';
});

onMounted(async () => {
  await loadPinConfig();
  await loadAutoUpdateConfig();
  await loadWebEmbedConfig();
  await loadWebDavSettings();
  await loadSiteAutoOpenConfig();
  await loadApiToken();
  await loadPtCredsConfig();
  await loadPtBackupKeyValue();
  await loadCustomBgConfigForm();
});

async function loadApiToken() {
  const data = await chrome.storage.local.get([STORAGE_KEYS.API_TOKEN]);
  let rawStored = data[STORAGE_KEYS.API_TOKEN];
  // 兼容旧版本：sync 回退
  if (!rawStored) {
    try {
      const sd = await chrome.storage.sync.get([STORAGE_KEYS.API_TOKEN]);
      rawStored = sd[STORAGE_KEYS.API_TOKEN];
    } catch {}
  }
  const raw = await decryptApiToken(rawStored);

  // 如果原本是明文字符串，自动迁移保存为加密形式
  if (typeof rawStored === 'string' && rawStored) {
    try {
      const encrypted = await encryptApiToken(rawStored);
      await chrome.storage.local.set({ [STORAGE_KEYS.API_TOKEN]: encrypted });
    } catch (e) {
      console.error('自动迁移加密 API Token 失败:', e);
    }
  }

  apiTokenRaw.value = raw;
  if (raw) {
    apiTokenPlaceholder.value = desensitize(raw);
  }
  // 默认不填入明文，用户点击输入框后才显示
  apiTokenInput.value = '';
}

function desensitize(value: string): string {
  if (value.length <= 6) return '******';
  return value.substring(0, 3) + '****' + value.substring(value.length - 3);
}

function onApiTokenFocus() {
  if (!apiTokenInput.value) {
    apiTokenInput.value = apiTokenRaw.value;
  }
}

function onApiTokenBlur() {
  // 失焦后如果值没变，清空显示恢复脱敏
  if (apiTokenInput.value === apiTokenRaw.value) {
    apiTokenInput.value = '';
  }
}

async function saveApiToken() {
  const trimmed = apiTokenInput.value.trim();
  if (!trimmed) {
    // 清空恢复默认
    await chrome.storage.local.remove([STORAGE_KEYS.API_TOKEN]);
    apiTokenRaw.value = '';
    apiTokenPlaceholder.value = 'moviepilot';
    apiTokenInput.value = '';
    ElMessage.info('将使用默认 API Token: moviepilot');
    return;
  }
  const encrypted = await encryptApiToken(trimmed);
  await chrome.storage.local.set({ [STORAGE_KEYS.API_TOKEN]: encrypted });
  apiTokenRaw.value = trimmed;
  apiTokenPlaceholder.value = desensitize(trimmed);
  apiTokenInput.value = '';
  ElMessage.success('API Token 已保存');
}

async function loadPinConfig() {
  const config = await getPinSecurityConfig();
  pinEnabled.value = Boolean(config.enabled && config.salt && config.hash);
  pinFrequency.value = getPinVerifyFrequency(config);
}

async function loadAutoUpdateConfig() {
  const config = await getCookieUaAutoUpdateConfig();
  Object.assign(autoUpdateConfig, config);
}

async function saveAutoUpdateConfig() {
  autoUpdateSaving.value = true;
  try {
    await saveCookieUaAutoUpdateConfig({ ...autoUpdateConfig });
    chrome.runtime.sendMessage({ type: 'MP_COOKIE_UA_AUTO_UPDATE_CONFIG_CHANGED' }).catch(() => {});
    ElMessage.success('自动更新设置已保存');
  } catch (error) {
    await loadAutoUpdateConfig();
    ElMessage.error((error as Error).message || '保存失败');
  } finally {
    autoUpdateSaving.value = false;
  }
}

async function loadWebEmbedConfig() {
  const config = await getWebEmbedFeaturesConfig();
  Object.assign(webEmbedConfig, config);
}

async function saveWebEmbedConfigForm() {
  webEmbedSaving.value = true;
  try {
    await saveWebEmbedFeaturesConfig({ ...webEmbedConfig });
    ElMessage.success('WEB 嵌入功能设置已保存');
  } catch (error) {
    await loadWebEmbedConfig();
    ElMessage.error((error as Error).message || '保存失败');
  } finally {
    webEmbedSaving.value = false;
  }
}

async function loadWebDavSettings() {
  const cfg = (await chrome.storage.sync.get([
    'webdav_url',
    'webdav_path',
    'webdav_username',
    'webdav_password',
    'webdav_auto',
    'webdav_interval_hours',
    'webdav_auto_on_change',
    'webdav_retain_count'
  ])) as any;
  webdavForm.url = await decryptWebDavUrl(cfg.webdav_url);
  webdavForm.path = cfg.webdav_path || '';
  webdavForm.username = await decryptWebDavUsername(cfg.webdav_username);
  webdavForm.password = await decryptWebDavPassword(cfg.webdav_password);
  webdavForm.autoEnabled = cfg.webdav_auto !== undefined ? Boolean(cfg.webdav_auto) : false;
  webdavForm.intervalHours = Number(cfg.webdav_interval_hours) || 24;
  webdavForm.autoOnChange = cfg.webdav_auto_on_change !== undefined ? Boolean(cfg.webdav_auto_on_change) : false;
  webdavForm.retainCount = typeof cfg.webdav_retain_count === 'number' ? cfg.webdav_retain_count : 0;
}

async function saveWebDavSettings() {
  const url = webdavForm.url.trim();
  const username = webdavForm.username.trim();
  const password = webdavForm.password.trim();

  if (!url) { ElMessage.error('请填写服务器地址'); return; }
  if (!username) { ElMessage.error('请填写用户名'); return; }
  if (!password) { ElMessage.error('请填写密码'); return; }

  webdavSaving.value = true;
  try {
    const encryptedUrl = await encryptWebDavUrl(url);
    const encryptedUsername = await encryptWebDavUsername(username);
    const encryptedPassword = await encryptWebDavPassword(password);
    await chrome.storage.sync.set({
      webdav_url: encryptedUrl,
      webdav_path: webdavForm.path.trim(),
      webdav_username: encryptedUsername,
      webdav_password: encryptedPassword,
      webdav_auto: webdavForm.autoEnabled,
      webdav_interval_hours: webdavForm.intervalHours,
      webdav_auto_on_change: webdavForm.autoOnChange,
      webdav_retain_count: webdavForm.retainCount
    });

    try { await chrome.alarms.clear('mp_totp_webdav_backup'); } catch {}
    if (webdavForm.autoEnabled) {
      const periodInMinutes = Math.max(1, webdavForm.intervalHours * 60);
      chrome.alarms.create('mp_totp_webdav_backup', { periodInMinutes });
    }

    await chrome.storage.local.remove(['webdav_draft']).catch(() => {});
    ElMessage.success('WebDav 设置已保存');
  } catch (error) {
    await loadWebDavSettings();
    ElMessage.error((error as Error).message || '保存失败');
  } finally {
    webdavSaving.value = false;
  }
}

async function loadSiteAutoOpenConfig() {
  const config = await getSiteAutoOpenConfig();
  Object.assign(siteAutoOpenConfig, config);
}

async function saveSiteAutoOpenConfigForm() {
  siteAutoOpenSaving.value = true;
  try {
    await saveSiteAutoOpenConfig({ ...siteAutoOpenConfig });
    chrome.runtime.sendMessage({ type: 'MP_SITE_AUTO_OPEN_CONFIG_CHANGED' }).catch(() => {});
    ElMessage.success('自动打开设置已保存');
  } catch (error) {
    await loadSiteAutoOpenConfig();
    ElMessage.error((error as Error).message || '保存失败');
  } finally {
    siteAutoOpenSaving.value = false;
  }
}

function openPinDialog(mode: 'enable' | 'disable' | 'frequency') {
  pinDialogMode.value = mode;
  pinDialogVisible.value = true;
}

function normalizePinInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, 6);
}

// ========== PIN 6 位独立输入框 ==========

const pinGroupRefs: Record<string, HTMLElement> = {};

function setPinGroupRef(name: string, el: any) {
  if (el) pinGroupRefs[name] = el;
}

function getPinInputs(name: string): HTMLInputElement[] {
  const container = pinGroupRefs[name];
  if (!container) return [];
  return Array.from(container.querySelectorAll('input'));
}

function setPinFieldValue(field: 'pin' | 'confirmPin' | 'currentPin', value: string) {
  if (field === 'pin') pinForm.pin = value;
  else if (field === 'confirmPin') pinForm.confirmPin = value;
  else pinForm.currentPin = value;
}

function onPinDigitInput(field: 'pin' | 'confirmPin' | 'currentPin', idx: number, e: Event) {
  const input = e.target as HTMLInputElement;
  const digit = input.value.replace(/\D/g, '').slice(-1);
  input.value = digit;

  const currentVal = field === 'pin' ? pinForm.pin : field === 'confirmPin' ? pinForm.confirmPin : pinForm.currentPin;
  const chars = currentVal.split('');
  chars[idx] = digit;
  setPinFieldValue(field, chars.join(''));

  if (digit) {
    if (idx < 5) {
      // 当前字段未满，跳到下一个格子
      const inputs = getPinInputs(field);
      nextTick(() => {
        inputs[idx + 1]?.focus();
        inputs[idx + 1]?.select();
      });
    } else if (field === 'pin') {
      // 设置 PIN 6 位已满，自动跳到确认 PIN 第一格
      nextTick(() => {
        const nextInputs = getPinInputs('confirmPin');
        nextInputs?.[0]?.focus();
        nextInputs?.[0]?.select();
      });
    }
  }
}

function onPinDigitKeydown(field: 'pin' | 'confirmPin' | 'currentPin', idx: number, e: KeyboardEvent) {
  const inputs = getPinInputs(field);
  if (e.key === 'Backspace') {
    const currentVal = field === 'pin' ? pinForm.pin : field === 'confirmPin' ? pinForm.confirmPin : pinForm.currentPin;
    if (!currentVal[idx] && idx > 0) {
      const chars = currentVal.split('');
      chars[idx - 1] = '';
      setPinFieldValue(field, chars.join(''));
      nextTick(() => {
        inputs[idx - 1]?.focus();
      });
    }
  } else if (e.key === 'ArrowLeft' && idx > 0) {
    inputs[idx - 1]?.focus();
  } else if (e.key === 'ArrowRight' && idx < 5) {
    inputs[idx + 1]?.focus();
  }
}

function onPinPaste(field: 'pin' | 'confirmPin' | 'currentPin', e: ClipboardEvent) {
  e.preventDefault();
  const pasted = (e.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, 6);
  if (!pasted) return;
  setPinFieldValue(field, pasted.padEnd(6, ''));
  const inputs = getPinInputs(field);
  const focusIdx = Math.min(pasted.length, 5);
  nextTick(() => {
    inputs[focusIdx]?.focus();
    inputs[focusIdx]?.select();
  });
}

function resetPinForm() {
  pinForm.pin = '';
  pinForm.confirmPin = '';
  pinForm.currentPin = '';
}

function cancelPinDialog() {
  if (pinDialogMode.value === 'enable') {
    pinEnabled.value = false;
  } else if (pinDialogMode.value === 'frequency') {
    pinFrequency.value = 'session';
    pendingFrequency.value = null;
  } else {
    pinEnabled.value = true;
  }
  pinDialogVisible.value = false;
}

async function onPinSwitchChange(value: string | number | boolean) {
  if (value) {
    pinEnabled.value = false;
    openPinDialog('enable');
    return;
  }
  pinEnabled.value = true;
  openPinDialog('disable');
}

async function savePin() {
  const pin = pinForm.pin.trim();
  const confirmPin = pinForm.confirmPin.trim();
  if (pin !== confirmPin) {
    ElMessage.error('两次输入的 PIN 不一致');
    return;
  }
  pinSaving.value = true;
  try {
    await setPinSecurity(pin, pinFrequency.value);
    pinEnabled.value = true;
    pinDialogVisible.value = false;
    ElMessage.success('已启用 PIN 安全保护');
  } catch (error) {
    ElMessage.error((error as Error).message || `PIN 必须是${getPinRuleText()}`);
  } finally {
    pinSaving.value = false;
  }
}

async function onFrequencyChange(value: string | number | boolean | undefined) {
  if (!pinEnabled.value) return;
  const frequency = value === 'session' ? 'session' : 'always';
  if (frequency === 'always') {
    pendingFrequency.value = 'always';
    pinFrequency.value = 'session';
    openPinDialog('frequency');
    return;
  }
  pinSaving.value = true;
  try {
    await updatePinVerifyFrequency(frequency);
    await markPinUnlockedForSession();
    pinFrequency.value = frequency;
    ElMessage.success('PIN 验证频率已更新');
  } catch (error) {
    await loadPinConfig();
    ElMessage.error((error as Error).message || '更新失败');
  } finally {
    pinSaving.value = false;
  }
}

async function applyAlwaysFrequencyWithVerification() {
  pinSaving.value = true;
  try {
    const ok = await verifyPin(pinForm.currentPin.trim());
    if (!ok) {
      ElMessage.error('PIN 验证失败');
      pinForm.currentPin = '';
      return;
    }
    await updatePinVerifyFrequency('always');
    pinFrequency.value = 'always';
    pendingFrequency.value = null;
    pinDialogVisible.value = false;
    ElMessage.success('PIN 验证频率已更新');
  } catch (error) {
    await loadPinConfig();
    ElMessage.error((error as Error).message || '更新失败');
  } finally {
    pinSaving.value = false;
  }
}

function handlePinDialogConfirm() {
  if (pinDialogMode.value === 'enable') {
    savePin();
    return;
  }
  if (pinDialogMode.value === 'frequency') {
    applyAlwaysFrequencyWithVerification();
    return;
  }
  disablePinWithVerification();
}

async function disablePinWithVerification() {
  pinSaving.value = true;
  try {
    const ok = await verifyPin(pinForm.currentPin.trim());
    if (!ok) {
      ElMessage.error('PIN 验证失败');
      pinForm.currentPin = '';
      return;
    }
    await disablePinSecurity();
    pinEnabled.value = false;
    pinDialogVisible.value = false;
    ElMessage.success('已关闭 PIN 安全保护');
  } catch (error) {
    pinEnabled.value = true;
    ElMessage.error((error as Error).message || '关闭失败');
  } finally {
    pinSaving.value = false;
  }
}

// ========== 自定义背景功能 ==========
const customBgSaving = ref(false);
const testingUrl = ref(false);
const customBgConfig = reactive({
  enabled: false,
  blurEnabled: false,
  blur: 5,
  opacity: 0.5,
  url: ''
});

async function loadCustomBgConfigForm() {
  customBgConfig.enabled = bgStore.enabled;
  customBgConfig.blurEnabled = bgStore.blurEnabled;
  customBgConfig.blur = bgStore.blur;
  customBgConfig.opacity = bgStore.opacity;
  customBgConfig.url = bgStore.url;
}

async function saveCustomBgConfig() {
  customBgSaving.value = true;
  try {
    await saveCustomBgToStorage({ ...customBgConfig });
    updateBgStore({ ...customBgConfig });
  } catch (error) {
    ElMessage.error('保存背景配置失败');
  } finally {
    customBgSaving.value = false;
  }
}

async function handleLocalBgUpload(file: any) {
  if (!file.raw) return;
  customBgSaving.value = true;
  try {
    const base64 = await compressAndResizeImage(file.raw);
    await saveCustomBgImageToStorage(base64);
    updateBgStore({}, base64);
    if (!customBgConfig.enabled) {
      customBgConfig.enabled = true;
      await saveCustomBgConfig();
    } else {
      ElMessage.success('背景图片上传成功');
    }
  } catch (error) {
    ElMessage.error(`图片处理失败: ${(error as Error).message}`);
  } finally {
    customBgSaving.value = false;
  }
}

async function testBgUrl() {
  const url = customBgConfig.url.trim();
  if (!url) {
    ElMessage.warning('请输入图片 URL');
    return;
  }
  testingUrl.value = true;
  try {
    const base64 = await downloadAndCompressImage(url);
    await saveCustomBgImageToStorage(base64);
    updateBgStore({}, base64);
    await saveCustomBgConfig();
    ElMessage.success('背景图片获取并更新成功');
  } catch (error) {
    ElMessage.error(`获取背景图片失败: ${(error as Error).message}`);
  } finally {
    testingUrl.value = false;
  }
}

async function clearBgImage() {
  customBgSaving.value = true;
  try {
    await clearCustomBgImage();
    updateBgStore({}, '');
    ElMessage.success('已清除背景图片');
  } catch (error) {
    ElMessage.error('清除背景图片失败');
  } finally {
    customBgSaving.value = false;
  }
}
</script>

<style scoped>
/* PIN 6 位独立输入框样式 */
.pin-code-inputs {
  display: flex;
  gap: 6px;
  justify-content: center;
  width: 100%;
  box-sizing: border-box;
  padding: 4px 0;
}

.pin-code-box {
  width: 38px;
  height: 38px;
  text-align: center;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0;
  color: #0f172a;
  border: 2px solid #e2e8f0;
  border-radius: 10px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.8);
  outline: none;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  caret-color: #3b82f6;
}

.pin-code-box:focus {
  border-color: #3b82f6;
  background: #ffffff;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15), 0 1px 3px rgba(59, 130, 246, 0.10);
}

.pin-code-box:valid {
  border-color: #60a5fa;
  background: linear-gradient(180deg, #ffffff 0%, #eff6ff 100%);
  box-shadow: 0 1px 2px rgba(59, 130, 246, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

.settings-root {
  width: 100%;
  padding: 8px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.settings-card {
  border-radius: 14px;
  background: linear-gradient(180deg, #f8fbff 0%, #ffffff 45%);
  border: 1px solid rgba(59,130,246,0.12);
  box-shadow: 0 6px 18px rgba(59,130,246,0.08);
}

.settings-card :deep(.el-card__body) {
  padding: 12px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(15,23,42,0.08);
}

.section-icon {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #eff6ff;
  color: #2563eb;
  border: 1px solid #bfdbfe;
}

.section-icon svg {
  width: 19px;
  height: 19px;
  fill: currentColor;
}

.cookie-icon {
  background: #ecfdf5;
  color: #059669;
  border-color: #bbf7d0;
}

.open-icon {
  background: #fff7ed;
  color: #ea580c;
  border-color: #fed7aa;
}

.embed-icon {
  background: #f5f3ff;
  color: #7c3aed;
  border-color: #ddd6fe;
}

.webdav-icon {
  background: #eef2ff;
  color: #4f46e5;
  border-color: #c7d2fe;
}

.section-title-wrap {
  min-width: 0;
}

.section-title {
  font-size: 14px;
  font-weight: 700;
  color: #334155;
  line-height: 20px;
}

.section-subtitle {
  font-size: 11px;
  color: #64748b;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 12px;
}

.setting-main {
  min-width: 0;
}

.setting-title {
  font-size: 13px;
  font-weight: 700;
  color: #334155;
}

.setting-desc {
  margin-top: 3px;
  font-size: 11px;
  line-height: 1.45;
  color: #64748b;
}

.recommend-tag {
  margin-left: 4px;
  padding: 1px 5px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 600;
  color: #059669;
  background: #ecfdf5;
  border: 1px solid #bbf7d0;
}

.speed-tag {
  margin-left: 4px;
  padding: 1px 6px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 600;
  color: #b45309;
  background: #fffbeb;
  border: 1px solid #fde68a;
}

.interval-row {
  margin-top: 4px;
}

.interval-select-row {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed rgba(15,23,42,0.08);
}

.interval-select {
  width: 100%;
  margin-top: 8px;
}

.webdav-form {
  padding-top: 12px;
}

.backup-key-input {
  margin-top: 8px;
}

.backup-key-item :deep(.el-form-item__content) {
  display: block;
  line-height: normal;
}

.row-two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.half {
  min-width: 0;
}

.webdav-tip {
  margin-top: 12px;
}

.settings-actions {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  margin-top: 12px;
}

.settings-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

.frequency-block {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed rgba(15,23,42,0.08);
}

.frequency-options {
  width: 100%;
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.frequency-option {
  width: 100%;
  height: auto;
  margin-right: 0;
  padding: 8px 10px;
  border: 1px solid rgba(15,23,42,0.08);
  border-radius: 10px;
  background: #fff;
  transition: border-color .18s ease, background .18s ease;
}

.frequency-option:hover {
  border-color: rgba(37,99,235,0.28);
  background: #f8fbff;
}

.frequency-option.is-checked {
  border-color: rgba(37,99,235,0.5);
  background: #eff6ff;
}

.frequency-option :deep(.el-radio__label) {
  flex: 1;
  min-width: 0;
}

.frequency-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.frequency-title {
  font-size: 12px;
  font-weight: 600;
  color: #334155;
}

.frequency-desc {
  font-size: 11px;
  line-height: 1.35;
  color: #64748b;
}

.dialog-tip {
  font-size: 12px;
  line-height: 1.5;
  color: #92400e;
  background: #fff7ed;
  border: 1px solid #fde68a;
  border-radius: 8px;
  padding: 8px;
}

.pt-creds-icon {
  background: #f0fdf4;
  color: #16a34a;
  border-color: #bbf7d0;
}

.pt-cred-row:hover {
  background-color: #f8fafc !important;
  border-radius: 4px;
}
</style>
