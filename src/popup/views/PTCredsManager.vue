<template>
  <div class="pt-manager-root">
    <!-- Header/Toolbar -->
    <div class="toolbar">
      <div class="toolbar-row">
        <el-input
          v-model="ptSearchKeyword"
          placeholder="搜索站点名称或用户名..."
          size="small"
          clearable
          class="search-input"
        >
          <template #prefix>
            <svg viewBox="0 0 24 24" width="14" height="14" class="icon-prefix">
              <path :d="mdiMagnify" />
            </svg>
          </template>
        </el-input>

        <el-button class="compact add-button" size="small" type="primary" @click="showPtAddEditDialog('add')" title="新增账号">
          <svg viewBox="0 0 24 24" width="16" height="16" class="icon-btn-only">
            <path :d="mdiPlus"/>
          </svg>
        </el-button>

        <el-dropdown @command="handleMoreCommand" trigger="click">
          <el-button class="compact more-button" size="small">
            <svg viewBox="0 0 24 24" width="16" height="16" class="icon-btn-only">
              <path :d="mdiDotsVertical"/>
            </svg>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="refresh">
                <div class="dropdown-item-content">
                  <svg viewBox="0 0 24 24" width="14" height="14" class="mr-1"><path :d="mdiRefresh"/></svg>刷新列表
                </div>
              </el-dropdown-item>
              <el-dropdown-item command="webdav-export" divided>
                <div class="dropdown-item-content">
                  <svg viewBox="0 0 24 24" width="14" height="14" class="mr-1" fill="currentColor"><path :d="mdiCloudUpload"/></svg>备份至 WebDav
                </div>
              </el-dropdown-item>
              <el-dropdown-item command="webdav-import">
                <div class="dropdown-item-content">
                  <svg viewBox="0 0 24 24" width="14" height="14" class="mr-1" fill="currentColor"><path :d="mdiCloudDownload"/></svg>从 WebDav 还原
                </div>
              </el-dropdown-item>
              <el-dropdown-item command="json-export" divided>
                <div class="dropdown-item-content">
                  <svg viewBox="0 0 24 24" width="14" height="14" class="mr-1"><path :d="mdiExportVariant"/></svg>导出本地 JSON
                </div>
              </el-dropdown-item>
              <el-dropdown-item command="json-import">
                <div class="dropdown-item-content">
                  <svg viewBox="0 0 24 24" width="14" height="14" class="mr-1"><path :d="mdiImport"/></svg>导入本地 JSON
                </div>
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <input
      type="file"
      ref="ptFileInput"
      style="display: none"
      accept=".json"
      @change="onPtFileSelected"
    />

    <!-- Main List Grid -->
    <div class="pt-grid" v-loading="ptManagerLoading">
      <div v-if="filteredPtCreds.length === 0" class="empty-state">
        <svg viewBox="0 0 24 24" width="48" height="48" class="empty-icon">
          <path :d="mdiKeyOutline"/>
        </svg>
        <p class="empty-text">暂无 PT 站点凭据</p>
        <el-button type="primary" @click="showPtAddEditDialog('add')">添加第一个站点</el-button>
      </div>

      <div v-else class="pt-cards">
        <div v-for="item in filteredPtCreds" :key="item.id" class="pt-card">
          <!-- Card Header & Details -->
          <div class="card-main">
            <div class="site-avatar" :style="{ background: getSiteIcon(item.domain) ? 'transparent' : getAvatarBg(item.domain) }">
              <img v-if="getSiteIcon(item.domain)" :src="getSiteIcon(item.domain) || undefined" class="site-icon-img" />
              <span v-else>{{ getAvatarChar(item.name || siteMapping[item.domain] || item.domain) }}</span>
            </div>
            <div class="site-details">
              <div class="site-name" :title="item.name || siteMapping[item.domain] || item.domain">
                {{ item.name || siteMapping[item.domain] || item.domain }}
              </div>
              <div class="site-domain link-style" :title="item.domain" @click="openSite(item.domain)">
                {{ item.domain }}
              </div>
              <div class="site-username" @click="copyUsername(item.username)" title="点击复制用户名">
                {{ item.username }}
              </div>
            </div>
            
            <div class="card-actions">
              <el-button 
                size="small" 
                text 
                class="action-btn"
                @click="togglePasswordVisibility(item)"
                :title="visiblePasswords[item.id] ? '隐藏密码' : '显示密码'"
              >
                <svg viewBox="0 0 24 24" width="15" height="15">
                  <path :d="visiblePasswords[item.id] ? mdiEyeOff : mdiEye"/>
                </svg>
              </el-button>
              <el-button 
                size="small" 
                text 
                class="action-btn"
                @click="copyPassword(item)"
                title="复制密码"
              >
                <svg viewBox="0 0 24 24" width="15" height="15">
                  <path :d="mdiContentCopy"/>
                </svg>
              </el-button>
              
              <el-dropdown @command="(cmd: any) => handleCardCommand(cmd, item)" trigger="click">
                <el-button size="small" text class="action-btn">
                  <svg viewBox="0 0 24 24" width="15" height="15">
                    <path :d="mdiDotsVertical"/>
                  </svg>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="edit">
                      <div class="dropdown-item-content">
                        <svg viewBox="0 0 24 24" width="14" height="14" class="mr-1"><path :d="mdiPencil"/></svg>编辑凭据
                      </div>
                    </el-dropdown-item>
                    <el-dropdown-item command="delete" class="delete-menu-item">
                      <div class="dropdown-item-content text-danger">
                        <svg viewBox="0 0 24 24" width="14" height="14" class="mr-1"><path :d="mdiDelete"/></svg>删除凭据
                      </div>
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>

          <!-- Password Value & Date Row -->
          <div class="card-password-row">
            <div class="pw-wrap">
              <span class="password-label">密码:</span>
              <span class="password-value font-mono">
                <span v-if="visiblePasswords[item.id]" class="visible-pw">{{ item.password }}</span>
                <span v-else class="dots">••••••••</span>
              </span>
            </div>
            <div class="time-wrap">
              {{ formatDate(item.updatedAt) }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- PT 账号新增/编辑 Dialog -->
    <el-dialog
      v-model="ptAddEditDialogVisible"
      :title="ptAddEditMode === 'add' ? '新增 PT 站点凭据' : '编辑 PT 站点凭据'"
      width="95%"
      :close-on-click-modal="false"
      class="pt-dialog-custom"
      @closed="ptCredFormRef?.resetFields()"
    >
      <el-form :model="ptCredForm" :rules="ptCredRules" ref="ptCredFormRef" label-position="top">
        <el-form-item label="站点域名" prop="domain">
          <el-input v-model="ptCredForm.domain" placeholder="例如: m-team.cc" :disabled="ptAddEditMode === 'edit'" />
        </el-form-item>
        <el-form-item label="站点名称" prop="name">
          <el-input v-model="ptCredForm.name" placeholder="手动输入或自动关联中文名称" />
        </el-form-item>
        <el-form-item label="用户名" prop="username">
          <el-input v-model="ptCredForm.username" placeholder="请输入用户名" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="ptCredForm.password" type="password" show-password placeholder="请输入密码" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="ptAddEditDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="savePtCredForm" :loading="ptFormSaving">确定</el-button>
      </template>
    </el-dialog>

    <!-- PT 账号安全 PIN 验证 Dialog -->
    <el-dialog
      v-model="ptPinDialogVisible"
      title="安全验证"
      width="95%"
      append-to-body
      align-center
      :close-on-click-modal="false"
      @closed="ptPinInput = ''"
      class="pt-dialog-custom"
    >
      <el-form label-position="top" @submit.prevent="verifyPtPin">
        <el-form-item label="请输入 6 位安全 PIN 以继续">
          <el-input
            v-model="ptPinInput"
            type="password"
            inputmode="numeric"
            maxlength="6"
            show-password
            placeholder="请输入 PIN"
            @input="ptPinInput = normalizePinInput(ptPinInput)"
            @keyup.enter="verifyPtPin"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="ptPinDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="verifyPtPin">确认</el-button>
      </template>
    </el-dialog>

    <!-- PT WebDav 备份选择还原 -->
    <el-dialog v-model="showPtWebDavImportDialog" title="从 WebDav 还原" width="95%" :close-on-click-modal="false">
      <div v-loading="ptWebDavImportLoading" class="webdav-import-body">
        <div v-if="ptWebDavBackups.length === 0" class="webdav-empty">
          未找到可用的 PT 备份文件
        </div>
        <el-radio-group v-else v-model="selectedPtWebDavBackupUrl" class="webdav-backup-list">
          <el-radio
            v-for="backup in ptWebDavBackups"
            :key="backup.url"
            :value="backup.url"
            class="webdav-backup-item"
          >
            <div class="backup-info">
              <div class="backup-name">{{ backup.name }}</div>
              <div class="backup-meta">{{ formatBackupTime(backup.lastModified) }} · {{ formatBackupSize(backup.size) }}</div>
            </div>
          </el-radio>
        </el-radio-group>
      </div>
      <template #footer>
        <el-button
          type="danger"
          :disabled="!selectedPtWebDavBackupUrl || ptWebDavBackups.length === 0"
          :loading="ptWebDavDeleting"
          @click="deleteSelectedPtWebDavBackup"
        >删除</el-button>
        <el-button @click="loadPtWebDavBackupList" :loading="ptWebDavImportLoading">刷新</el-button>
        <el-button
          type="primary"
          :disabled="!selectedPtWebDavBackupUrl || ptWebDavBackups.length === 0"
          :loading="ptWebDavImporting"
          @click="importSelectedPtWebDavBackup"
        >还原</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  mdiMagnify, mdiPlus, mdiExportVariant, mdiImport, mdiRefresh,
  mdiKeyOutline, mdiPencil, mdiDelete, mdiEye, mdiEyeOff,
  mdiDotsVertical, mdiContentCopy, mdiCloudUpload, mdiCloudDownload
} from '@mdi/js';
import { PTCredentialStorageService, type PTCredential } from '../../shared/services/ptCredentialStorage';
import { isPinSecurityEnabled, verifyPin } from '../../shared/pinSecurity';
import { decryptWebDavPassword, decryptWebDavUsername, decryptWebDavUrl } from '../../shared/secureStorage';
import { STORAGE_KEYS } from '../../shared/constants';
import { createMpApiClient } from '../../shared/api/client';
import { getSiteIcon } from '../../shared/data/siteIcons';
import { decryptPtBackup, encryptPtBackup, isPtBackupEnvelope, loadPtBackupKey, savePtBackupKey } from '../../shared/ptBackupCrypto';

const ptSearchKeyword = ref('');
const ptManagerLoading = ref(false);
const ptCredsList = ref<PTCredential[]>([]);
const visiblePasswords = reactive<Record<string, boolean>>({});
const siteMapping = ref<Record<string, string>>({});

// WebDav 备份选择还原状态
const showPtWebDavImportDialog = ref(false);
type PtWebDavBackupFile = { name: string; url: string; lastModified?: number; size?: number; };
const ptWebDavBackups = ref<PtWebDavBackupFile[]>([]);
const selectedPtWebDavBackupUrl = ref('');
const ptWebDavImportLoading = ref(false);
const ptWebDavImporting = ref(false);
const ptWebDavDeleting = ref(false);

// Add/Edit Dialog State
const ptAddEditDialogVisible = ref(false);
const ptAddEditMode = ref<'add' | 'edit'>('add');
const ptFormSaving = ref(false);
const ptCredForm = reactive({
  id: '',
  domain: '',
  username: '',
  password: '',
  name: ''
});
const ptCredFormRef = ref();
const ptFileInput = ref<HTMLInputElement | null>(null);

// PIN dialog state for PT
const ptPinDialogVisible = ref(false);
const ptPinInput = ref('');
let ptPinSuccessCallback: (() => void) | null = null;

// Rules
const ptCredRules = {
  domain: [
    { required: true, message: '请输入站点域名', trigger: 'blur' },
    { pattern: /^[a-zA-Z0-9][-a-zA-Z0-9]{0,62}(\.[a-zA-Z0-9][-a-zA-Z0-9]{0,62})+$/, message: '请输入合法的域名格式', trigger: 'blur' }
  ],
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' }
  ]
};

const filteredPtCreds = computed(() => {
  const kw = ptSearchKeyword.value.toLowerCase().trim();
  if (!kw) return ptCredsList.value;
  return ptCredsList.value.filter(item => 
    (item.name || siteMapping.value[item.domain] || '').toLowerCase().includes(kw) ||
    item.username.toLowerCase().includes(kw)
  );
});

onMounted(async () => {
  // 先加载站点映射，确保列表渲染时 siteMapping 已就绪，避免名称从域名闪烁为中文
  await fetchSiteMapping();
  await loadPtCreds();
});

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

async function fetchSiteMapping() {
  try {
    const baseUrl = await getBaseUrl();
    const token = await getToken();
    if (!baseUrl || !token) return;
    const client = createMpApiClient({ baseURL: baseUrl, getToken });
    const resp = await client.get('/api/v1/site/mapping');
    siteMapping.value = resp.data?.data || {};
  } catch (err) {
    console.error('获取站点 mapping 失败:', err);
  }
}

watch(() => ptCredForm.domain, (newVal) => {
  if (ptAddEditMode.value === 'add' && newVal) {
    const cleanDomain = newVal.toLowerCase().trim();
    if (siteMapping.value[cleanDomain]) {
      ptCredForm.name = siteMapping.value[cleanDomain];
    } else {
      const noWww = cleanDomain.replace(/^www\./i, '');
      const matchedKey = Object.keys(siteMapping.value).find(k => k.toLowerCase().replace(/^www\./i, '') === noWww);
      if (matchedKey) {
        ptCredForm.name = siteMapping.value[matchedKey];
      }
    }
  }
});

async function openSite(domain: string) {
  try {
    const siteUrl = domain.startsWith('http') ? domain : `https://${domain}`;
    await chrome.tabs.create({
      url: siteUrl,
      active: true
    });
  } catch (error) {
    console.error('Failed to open site:', error);
    try {
      const siteUrl = domain.startsWith('http') ? domain : `https://${domain}`;
      window.open(siteUrl, '_blank');
    } catch (fallbackError) {
      console.error('Fallback also failed:', fallbackError);
    }
  }
}

async function loadPtCreds() {
  ptManagerLoading.value = true;
  try {
    ptCredsList.value = await PTCredentialStorageService.getCredentials();
  } catch (error) {
    ElMessage.error('加载账号凭据失败');
  } finally {
    ptManagerLoading.value = false;
  }
}

function normalizePinInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, 6);
}

function verifyPtPin() {
  const pin = ptPinInput.value.trim();
  if (!pin) {
    ElMessage.error('请输入 PIN');
    return;
  }
  verifyPin(pin).then(ok => {
    if (!ok) {
      ElMessage.error('PIN 验证失败');
      ptPinInput.value = '';
      return;
    }
    ptPinDialogVisible.value = false;
    ptPinInput.value = '';
    if (ptPinSuccessCallback) {
      ptPinSuccessCallback();
      ptPinSuccessCallback = null;
    }
  });
}

async function runWithPinProtection(callback: () => void) {
  const enabled = await isPinSecurityEnabled();
  if (enabled) {
    ptPinInput.value = '';
    ptPinSuccessCallback = callback;
    ptPinDialogVisible.value = true;
  } else {
    callback();
  }
}

function togglePasswordVisibility(item: PTCredential) {
  if (visiblePasswords[item.id]) {
    visiblePasswords[item.id] = false;
  } else {
    runWithPinProtection(() => {
      visiblePasswords[item.id] = true;
    });
  }
}

function copyPassword(item: PTCredential) {
  runWithPinProtection(() => {
    navigator.clipboard.writeText(item.password).then(() => {
      ElMessage.success('密码已复制到剪贴板');
    }).catch(() => {
      ElMessage.error('复制失败，请重试');
    });
  });
}

function copyUsername(username: string) {
  navigator.clipboard.writeText(username).then(() => {
    ElMessage.success('用户名已复制到剪贴板');
  }).catch(() => {
    ElMessage.error('复制失败');
  });
}

function showPtAddEditDialog(mode: 'add' | 'edit', item?: PTCredential) {
  ptAddEditMode.value = mode;
  if (mode === 'edit' && item) {
    runWithPinProtection(() => {
      ptCredForm.id = item.id;
      ptCredForm.domain = item.domain;
      ptCredForm.username = item.username;
      ptCredForm.password = item.password;
      ptCredForm.name = item.name || '';
      ptAddEditDialogVisible.value = true;
    });
  } else {
    ptCredForm.id = '';
    ptCredForm.domain = '';
    ptCredForm.username = '';
    ptCredForm.password = '';
    ptCredForm.name = '';
    ptAddEditDialogVisible.value = true;
  }
}

async function savePtCredForm() {
  if (!ptCredFormRef.value) return;
  const valid = await ptCredFormRef.value.validate().catch(() => false);
  if (!valid) return;

  ptFormSaving.value = true;
  const wasAdd = ptAddEditMode.value === 'add';
  try {
    await PTCredentialStorageService.addOrUpdateCredential(
      ptCredForm.domain,
      ptCredForm.username,
      ptCredForm.password,
      ptCredForm.name.trim() || undefined
    );
    await loadPtCreds();
    ptAddEditDialogVisible.value = false;
    ElMessage.success(ptAddEditMode.value === 'add' ? '新增成功' : '修改成功');
    if (wasAdd) await tryAutoBackupOnPtChange();
  } catch (error) {
    ElMessage.error(`保存失败: ${(error as Error).message}`);
  } finally {
    ptFormSaving.value = false;
  }
}

async function handleDeletePtCred(item: PTCredential) {
  runWithPinProtection(async () => {
    try {
      await ElMessageBox.confirm(`确定要删除 ${item.domain} 的账号凭据吗？`, '提示', {
        type: 'warning',
        confirmButtonText: '确定',
        cancelButtonText: '取消'
      });
    } catch {
      return;
    }

    try {
      await PTCredentialStorageService.deleteCredential(item.id);
      await loadPtCreds();
      ElMessage.success('删除成功');
    } catch (error) {
      ElMessage.error('删除失败');
    }
  });
}

function handleMoreCommand(command: string) {
  if (command === 'refresh') {
    loadPtCreds();
  } else if (command === 'webdav-export') {
    exportPtCredsToWebDav();
  } else if (command === 'webdav-import') {
    openPtWebDavImportDialog();
  } else if (command === 'json-export') {
    exportPtCredsToJson();
  } else if (command === 'json-import') {
    ptFileInput.value?.click();
  }
}

function handleCardCommand(command: string, item: PTCredential) {
  if (command === 'edit') {
    showPtAddEditDialog('edit', item);
  } else if (command === 'delete') {
    handleDeletePtCred(item);
  }
}

async function exportPtCredsToJson() {
  try {
    const credentials = await PTCredentialStorageService.getCredentials();
    if (credentials.length === 0) {
      ElMessage.warning('暂无 PT 账号凭据数据可备份');
      return;
    }

    const backupKey = await requestPtBackupKey(
      '本地备份密钥',
      '请输入用于加密 PT 账号凭据的备份密钥。本次输入会同步加密保存到设置中的备份密钥，后续无需再次输入。'
    );
    if (!backupKey) {
      ElMessage.warning('已取消导出');
      return;
    }

    const payload = await encryptPtBackup({ credentials, exportedAt: new Date().toISOString() }, backupKey);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pt-credentials-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    ElMessage.success('导出本地 JSON 成功');
  } catch (error) {
    ElMessage.error(`导出失败: ${(error as Error).message}`);
  }
}

async function requestPtBackupKey(title: string, message: string, allowPrompt = true): Promise<string> {
  const savedKey = await loadPtBackupKey();
  if (savedKey) return savedKey;
  if (!allowPrompt) return '';

  try {
    const result = await ElMessageBox.prompt(
      message,
      title,
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputType: 'password',
        inputPlaceholder: '备份密钥',
        inputValidator: value => Boolean(value?.trim()) || '请输入备份密钥'
      }
    );
    const key = result.value?.trim() || '';
    if (key) {
      await savePtBackupKey(key);
      ElMessage.success('PT 备份密钥已加密保存');
    }
    return key;
  } catch {
    return '';
  }
}

async function tryAutoBackupOnPtChange() {
  try {
    const cfg = await chrome.storage.sync.get(['webdav_auto_on_change']);
    if (!cfg.webdav_auto_on_change) return;
    await exportPtCredsToWebDav(false);
  } catch (error) {
    console.error('PT 账号凭据自动备份失败:', error);
  }
}

async function decryptPtBackupPayload(payload: unknown): Promise<{ credentials: PTCredential[] }> {
  if (isPtBackupEnvelope(payload)) {
    const backupKey = await requestPtBackupKey(
      'WebDav 备份密钥',
      '请输入用于解密 PT 账号凭据备份的备份密钥。请确保输入与备份时使用的密钥一致，否则无法成功解密还原数据。'
    );
    if (!backupKey) throw new Error('已取消输入备份密钥');
    return decryptPtBackup<{ credentials: PTCredential[] }>(payload, backupKey);
  }

  try {
    const { decryptObject } = await import('../../shared/secureStorage');
    return decryptObject<{ credentials: PTCredential[] }>(payload as any);
  } catch (error) {
    console.error('旧版 PT 备份解密失败:', error);
    throw new Error('旧版备份只能在创建它的同一扩展环境还原；跨设备请使用新备份密钥重新备份后再还原。');
  }
}

async function exportPtCredsToWebDav(allowKeyPrompt = true) {
  ptManagerLoading.value = true;
  try {
    const webdavConfig = await chrome.storage.sync.get(['webdav_url', 'webdav_username', 'webdav_password', 'webdav_path']);
    const password = await decryptWebDavPassword(webdavConfig.webdav_password);
    const username = await decryptWebDavUsername(webdavConfig.webdav_username);
    const url = await decryptWebDavUrl(webdavConfig.webdav_url);

    if (!url || !username || !password) {
      ElMessage.warning('请先完整配置 WebDav（服务器地址、用户名、密码）');
      return;
    }

    const credentials = await PTCredentialStorageService.getCredentials();
    if (credentials.length === 0) {
      ElMessage.warning('暂无 PT 账号凭据数据可备份');
      return;
    }

    const backupKey = await requestPtBackupKey(
      'WebDav 备份密钥',
      '请输入用于加密 PT 账号凭据的备份密钥。本次输入会同步加密保存到设置中的备份密钥，后续无需再次输入。',
      allowKeyPrompt
    );
    if (!backupKey) {
      if (allowKeyPrompt) ElMessage.warning('已取消 WebDav 备份');
      return;
    }

    const payload = await encryptPtBackup({ credentials, exportedAt: new Date().toISOString() }, backupKey);
    const jsonData = JSON.stringify(payload, null, 2);
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const fileName = `pt-credentials-backup-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.json`;

    const base = url.replace(/\/$/, '');
    const path = (((webdavConfig as any).webdav_path as string) || '').trim();
    const normPath = path ? '/' + path.replace(/^\/+/, '') : '/MP-Totp';
    const targetBase = `${base}${normPath}`.replace(/\/$/, '');
    const targetUrl = `${targetBase}/${encodeURIComponent(fileName)}`;
    const auth = `Basic ${btoa(`${username}:${password}`)}`;

    let response = await fetch(targetUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': auth
      },
      body: jsonData
    });

    if (response.status === 409 || response.status === 404) {
      try {
        await fetch(targetBase + '/', {
          method: 'MKCOL',
          headers: { 'Authorization': auth }
        });
      } catch (e) {}

      response = await fetch(targetUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Authorization': auth
        },
        body: jsonData
      });
    }

    if (response.ok) {
      // 处理保留份数：若设置了保留份数且>0，则清理多余旧备份
      try {
        const cfg = await chrome.storage.sync.get(['webdav_retain_count']);
        const retain = Number(cfg.webdav_retain_count) || 0;
        if (retain > 0) {
          const { listUrl } = await buildPtWebDavContext(webdavConfig);
          const files = await listPtWebDavFiles(listUrl, auth);
          const backups = getSortedPtBackupFiles(files);
          if (backups.length > retain) {
            const toDelete = backups.slice(retain);
            for (const f of toDelete) {
              try { await fetch(f.url, { method: 'DELETE', headers: { 'Authorization': auth } }); } catch {}
            }
          }
        }
      } catch (e) {
        console.warn('清理旧 PT 凭据备份失败:', e);
      }
      ElMessage.success('备份至 WebDav 成功');
    } else {
      const text = await response.text().catch(() => '');
      throw new Error(`WebDav 上传失败: ${response.status} ${text.slice(0, 200)}`);
    }
  } catch (error) {
    console.error('备份至 WebDav 失败:', error);
    ElMessage.error(`备份至 WebDav 失败: ${(error as Error).message}`);
  } finally {
    ptManagerLoading.value = false;
  }
}

// ========== WebDav 备份列表选择还原 ==========

async function buildPtWebDavContext(cfg: Record<string, any>) {
  const url = await decryptWebDavUrl(cfg.webdav_url);
  const base = (url as string).replace(/\/$/, '');
  const path = (cfg.webdav_path || '').toString().trim();
  const normPath = path ? '/' + path.replace(/^\/+/, '') : '/MP-Totp';
  const listUrl = `${base}${normPath}/`;
  const username = await decryptWebDavUsername(cfg.webdav_username);
  const password = await decryptWebDavPassword(cfg.webdav_password);
  const auth = `Basic ${btoa(`${username}:${password}`)}`;
  return { base, normPath, listUrl, auth };
}

async function listPtWebDavFiles(listUrl: string, auth: string): Promise<PtWebDavBackupFile[]> {
  const body = `<?xml version="1.0" encoding="utf-8"?>\n` +
    `<d:propfind xmlns:d="DAV:">` +
    `<d:prop><d:displayname/><d:getlastmodified/><d:getcontentlength/><d:resourcetype/></d:prop>` +
    `</d:propfind>`;
  const resp = await fetch(listUrl, {
    method: 'PROPFIND',
    headers: {
      'Depth': '1',
      'Authorization': auth,
      'Content-Type': 'text/xml; charset=utf-8'
    },
    body
  });
  if (!resp.ok) throw new Error(`PROPFIND failed: ${resp.status}`);
  const text = await resp.text();
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const responses = Array.from(doc.getElementsByTagNameNS('*', 'response'));
  const files: PtWebDavBackupFile[] = [];
  for (const r of responses) {
    const hrefEl = r.getElementsByTagNameNS('*', 'href')[0];
    if (!hrefEl) continue;
    const href = hrefEl.textContent || '';
    const propstat = r.getElementsByTagNameNS('*', 'propstat')[0];
    const prop = propstat?.getElementsByTagNameNS('*', 'prop')[0];
    const resType = prop?.getElementsByTagNameNS('*', 'resourcetype')[0];
    const isCollection = !!(resType && resType.getElementsByTagNameNS('*', 'collection')[0]);
    const display = prop?.getElementsByTagNameNS('*', 'displayname')[0]?.textContent || '';
    const lastModText = prop?.getElementsByTagNameNS('*', 'getlastmodified')[0]?.textContent || '';
    const sizeText = prop?.getElementsByTagNameNS('*', 'getcontentlength')[0]?.textContent || '';
    const lastModified = Date.parse(lastModText || '');
    const size = Number(sizeText);
    if (href.replace(/\/?$/, '/') === listUrl.replace(/\/?$/, '/')) continue;
    if (isCollection) continue;
    const url = href.startsWith('http') ? href : (new URL(href, listUrl)).toString();
    const name = display || decodeURIComponent(url.split('/').filter(Boolean).pop() || '');
    files.push({ name, url, lastModified: isNaN(lastModified) ? undefined : lastModified, size: Number.isFinite(size) ? size : undefined });
  }
  return files;
}

function getSortedPtBackupFiles(files: PtWebDavBackupFile[]): PtWebDavBackupFile[] {
  return files
    .filter(f => /\.json$/i.test(f.name) && /pt-credentials/i.test(f.name))
    .sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
}

function formatBackupTime(timestamp?: number): string {
  if (!timestamp) return '修改时间未知';
  return `修改时间：${new Date(timestamp).toLocaleString()}`;
}

function formatBackupSize(size?: number): string {
  if (typeof size !== 'number') return '大小未知';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

async function openPtWebDavImportDialog() {
  showPtWebDavImportDialog.value = true;
  ptWebDavBackups.value = [];
  selectedPtWebDavBackupUrl.value = '';
  await loadPtWebDavBackupList();
}

async function loadPtWebDavBackupList() {
  ptWebDavImportLoading.value = true;
  try {
    const cfg = (await chrome.storage.sync.get(['webdav_url', 'webdav_path', 'webdav_username', 'webdav_password'])) as any;
    const password = await decryptWebDavPassword(cfg.webdav_password);
    const username = await decryptWebDavUsername(cfg.webdav_username);
    const url = await decryptWebDavUrl(cfg.webdav_url);
    if (!url || !username || !password) {
      ElMessage.warning('请先完整配置 WebDav（服务器地址、用户名、密码）');
      showPtWebDavImportDialog.value = false;
      return;
    }
    const { listUrl, auth } = await buildPtWebDavContext(cfg);
    const files = await listPtWebDavFiles(listUrl, auth);
    ptWebDavBackups.value = getSortedPtBackupFiles(files);
    selectedPtWebDavBackupUrl.value = ptWebDavBackups.value[0]?.url || '';
    if (ptWebDavBackups.value.length === 0) {
      ElMessage.warning('未找到可用的 PT 备份文件');
    }
  } catch (error) {
    console.error('加载 PT WebDav 备份列表失败:', error);
    ElMessage.error('加载 PT WebDav 备份列表失败');
  } finally {
    ptWebDavImportLoading.value = false;
  }
}

async function importSelectedPtWebDavBackup() {
  const target = ptWebDavBackups.value.find(file => file.url === selectedPtWebDavBackupUrl.value);
  if (!target) {
    ElMessage.warning('请选择要还原的备份文件');
    return;
  }

  ptWebDavImporting.value = true;
  try {
    const cfg = await chrome.storage.sync.get(['webdav_url', 'webdav_path', 'webdav_username', 'webdav_password']);
    const password = await decryptWebDavPassword(cfg.webdav_password);
    const username = await decryptWebDavUsername(cfg.webdav_username);
    if (!username || !password) {
      ElMessage.warning('请先完整配置 WebDav（用户名、密码）');
      return;
    }

    const auth = `Basic ${btoa(`${username}:${password}`)}`;
    const resp = await fetch(target.url, { headers: { 'Authorization': auth } });
    if (!resp.ok) throw new Error(`下载失败: ${resp.status}`);

    const text = await resp.text();
    const payload = JSON.parse(text);
    if (!payload.ciphertext || !payload.iv || !payload.salt) {
      throw new Error('备份文件格式不正确，可能已损坏');
    }

    const decryptedStore = await decryptPtBackupPayload(payload);
    const importedList = decryptedStore?.credentials || [];

    // 合并到本地
    const currentList = await PTCredentialStorageService.getCredentials();
    const mergedList = [...currentList];
    for (const imp of importedList) {
      const idx = mergedList.findIndex(c => c.domain.toLowerCase().trim() === imp.domain.toLowerCase().trim());
      if (idx !== -1) {
        mergedList[idx] = {
          ...mergedList[idx],
          username: imp.username,
          password: imp.password,
          name: imp.name || mergedList[idx].name,
          updatedAt: new Date().toISOString()
        };
      } else {
        mergedList.push({
          id: Math.random().toString(36).substring(2) + Date.now().toString(36),
          domain: imp.domain.toLowerCase().trim(),
          username: imp.username,
          password: imp.password,
          name: imp.name,
          createdAt: imp.createdAt || new Date().toISOString(),
          updatedAt: imp.updatedAt || new Date().toISOString()
        });
      }
    }

    await PTCredentialStorageService.saveCredentials(mergedList);
    await loadPtCreds();
    showPtWebDavImportDialog.value = false;
    ElMessage.success(`已从 WebDav 还原：${target.name}（${importedList.length} 个账号）`);
  } catch (error) {
    console.error('从 WebDav 还原失败:', error);
    ElMessage.error(`从 WebDav 还原失败: ${(error as Error).message}`);
  } finally {
    ptWebDavImporting.value = false;
  }
}

async function deleteSelectedPtWebDavBackup() {
  const target = ptWebDavBackups.value.find(file => file.url === selectedPtWebDavBackupUrl.value);
  if (!target) {
    ElMessage.warning('请选择要删除的备份文件');
    return;
  }

  try {
    await ElMessageBox.confirm(
      `确定要删除备份文件"${target.name}"吗？此操作不可恢复。`,
      '确认删除备份',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );
  } catch {
    return;
  }

  ptWebDavDeleting.value = true;
  try {
    const cfg = await chrome.storage.sync.get(['webdav_username', 'webdav_password']);
    const password = await decryptWebDavPassword(cfg.webdav_password);
    const username = await decryptWebDavUsername(cfg.webdav_username);
    if (!username || !password) {
      ElMessage.warning('请先完整配置 WebDav（用户名、密码）');
      return;
    }

    const auth = `Basic ${btoa(`${username}:${password}`)}`;
    const resp = await fetch(target.url, { method: 'DELETE', headers: { 'Authorization': auth } });
    if (!resp.ok) throw new Error(`删除失败: ${resp.status}`);

    ElMessage.success(`已删除备份：${target.name}`);
    await loadPtWebDavBackupList();
  } catch (error) {
    console.error('PT WebDav 备份删除失败:', error);
    ElMessage.error(`删除失败: ${(error as Error).message}`);
  } finally {
    ptWebDavDeleting.value = false;
  }
}

async function onPtFileSelected(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);
    
    let importedList: PTCredential[] = [];
    
    if (data.ciphertext && data.iv && data.salt) {
      const decryptedStore = await decryptPtBackupPayload(data);
      importedList = decryptedStore?.credentials || [];
    } else if (data.credentials && Array.isArray(data.credentials)) {
      importedList = data.credentials;
    } else {
      throw new Error('无效的备份文件：格式不正确');
    }

    const currentList = await PTCredentialStorageService.getCredentials();
    const mergedList = [...currentList];

    for (const imp of importedList) {
      if (!imp.domain || !imp.username || !imp.password) continue;
      const idx = mergedList.findIndex(c => c.domain.toLowerCase().trim() === imp.domain.toLowerCase().trim());
      if (idx !== -1) {
        mergedList[idx] = {
          ...mergedList[idx],
          username: imp.username,
          password: imp.password,
          name: imp.name || mergedList[idx].name,
          updatedAt: new Date().toISOString()
        };
      } else {
        mergedList.push({
          id: Math.random().toString(36).substring(2) + Date.now().toString(36),
          domain: imp.domain.toLowerCase().trim(),
          username: imp.username,
          password: imp.password,
          name: imp.name,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    }

    await PTCredentialStorageService.saveCredentials(mergedList);
    await loadPtCreds();
    ElMessage.success(`成功导入并合并了 ${importedList.length} 个账号凭据`);
  } catch (error) {
    ElMessage.error(`导入本地 JSON 失败: ${(error as Error).message}`);
  } finally {
    target.value = '';
  }
}

function formatDate(isoString: string): string {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    return d.toLocaleString('zh-CN', { hour12: false });
  } catch {
    return isoString;
  }
}

function getAvatarChar(domain: string): string {
  if (!domain) return '?';
  const clean = domain.replace(/^www\./i, '');
  return clean.charAt(0).toUpperCase();
}

function getAvatarBg(domain: string): string {
  if (!domain) return '#16a34a';
  const clean = domain.replace(/^www\./i, '');
  const gradients = [
    'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
    'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
    'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
    'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
    'linear-gradient(135deg, #f43f5e 0%, #be123c 100%)',
    'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)'
  ];
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = clean.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % gradients.length;
  return gradients[index];
}
</script>

<style scoped>
/* WebDav 备份选择还原样式 */
.webdav-import-body {
  min-height: 160px;
}

.webdav-empty {
  padding: 36px 12px;
  text-align: center;
  color: #94a3b8;
  font-size: 13px;
}

.webdav-backup-list {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.webdav-backup-item {
  width: 100%;
  height: auto;
  margin-right: 0;
  padding: 10px 12px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 10px;
  background: #fff;
  transition: border-color .18s ease, background .18s ease;
}

.webdav-backup-item:hover {
  border-color: rgba(22, 163, 74, 0.32);
  background: #f8fbff;
}

.webdav-backup-item.is-checked {
  border-color: rgba(22, 163, 74, 0.56);
  background: #f0fdf4;
}

.webdav-backup-item :deep(.el-radio__label) {
  flex: 1;
  min-width: 0;
}

.backup-info {
  min-width: 0;
}

.backup-name {
  font-size: 13px;
  font-weight: 700;
  color: #334155;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.backup-meta {
  margin-top: 3px;
  font-size: 11px;
  color: #64748b;
}

.pt-manager-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f8fafc;
}

/* Toolbar Styling */
.toolbar {
  padding: 10px 8px;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
}

.toolbar-row {
  display: flex;
  gap: 8px;
  align-items: center;
  width: 100%;
}

.search-input {
  flex: 1;
}

.search-input :deep(.el-input__wrapper) {
  border-radius: 8px;
  box-shadow: 0 0 0 1px #e2e8f0 inset;
  background: #f8fafc;
  transition: all 0.2s ease;
}

.search-input :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px #16a34a inset !important;
  background: #ffffff;
}

.compact {
  width: 32px;
  height: 32px;
  padding: 0;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  color: #475569;
  transition: all 0.2s ease;
}

.add-button {
  background: #16a34a;
  border-color: #16a34a;
  color: #ffffff;
}

.add-button:hover {
  background: #15803d;
  border-color: #15803d;
  color: #ffffff;
}

.more-button:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
  color: #0f172a;
}

.icon-prefix {
  color: #64748b;
}

.icon-btn-only {
  width: 16px;
  height: 16px;
  fill: currentColor;
}

.dropdown-item-content {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.mr-1 {
  width: 14px;
  height: 14px;
  fill: currentColor;
}

.text-danger {
  color: #ef4444;
}

.delete-menu-item:hover {
  background-color: #fef2f2 !important;
  color: #ef4444 !important;
}

/* Grid & Cards Styling */
.pt-grid {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
}

.empty-icon {
  color: #94a3b8;
  margin-bottom: 12px;
  opacity: 0.6;
}

.empty-text {
  font-size: 13px;
  color: #64748b;
  margin-bottom: 16px;
}

.pt-cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pt-card {
  border-radius: 12px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
  padding: 12px;
  display: flex;
  flex-direction: column;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.pt-card:hover {
  border-color: rgba(22, 163, 74, 0.3);
  box-shadow: 0 4px 12px rgba(22, 163, 74, 0.06), 0 1px 3px rgba(0, 0, 0, 0.02);
  transform: translateY(-1px);
}

.card-main {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.site-avatar {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-weight: 700;
  font-size: 16px;
  flex-shrink: 0;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

.site-icon-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: inherit;
}

.site-details {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}

.site-name {
  font-size: 13px;
  font-weight: 600;
  color: #0f172a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
  text-align: left;
}

.site-domain {
  font-size: 11px;
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
  text-align: left;
}

.site-domain.link-style {
  color: #16a34a;
  cursor: pointer;
}

.site-domain.link-style:hover {
  text-decoration: underline;
  color: #15803d;
}

.site-username {
  font-size: 11px;
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
  text-align: left;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.site-username:hover {
  color: #16a34a;
}

.site-username:hover::after {
  content: "复制";
  font-size: 9px;
  background: rgba(22, 163, 74, 0.1);
  color: #16a34a;
  padding: 0px 4px;
  border-radius: 4px;
}

.card-actions {
  display: flex;
  gap: 0;
  border-radius: 6px;
  overflow: hidden;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.action-btn {
  padding: 6px 8px !important;
  height: 28px !important;
  border: none !important;
  background: transparent !important;
  color: #475569 !important;
  border-radius: 0 !important;
  margin: 0 !important;
  transition: all 0.15s ease;
}

.action-btn:hover {
  background: #f1f5f9 !important;
  color: #16a34a !important;
}

.delete-btn:hover {
  background: #fef2f2 !important;
  color: #ef4444 !important;
}

.card-password-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #e2e8f0;
  font-size: 11px;
}

.pw-wrap {
  display: flex;
  align-items: center;
  gap: 4px;
}

.password-label {
  color: #94a3b8;
}

.password-value {
  color: #334155;
  font-weight: 500;
}

.visible-pw {
  font-size: 11px;
}

.dots {
  color: #94a3b8;
  letter-spacing: 2px;
  font-size: 12px;
  vertical-align: middle;
}

.time-wrap {
  color: #94a3b8;
  font-size: 10px;
}

/* Dialog Customize */
.pt-dialog-custom :deep(.el-dialog) {
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

.pt-dialog-custom :deep(.el-dialog__header) {
  padding: 16px 20px 10px;
  margin-right: 0;
  border-bottom: 1px solid #f1f5f9;
}

.pt-dialog-custom :deep(.el-dialog__title) {
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
}

.pt-dialog-custom :deep(.el-dialog__body) {
  padding: 16px 20px 12px;
}

.pt-dialog-custom :deep(.el-form-item) {
  margin-bottom: 12px;
}

.pt-dialog-custom :deep(.el-form-item__label) {
  font-size: 11px;
  font-weight: 600;
  color: #475569;
  padding-bottom: 4px;
}

.pt-dialog-custom :deep(.el-input__wrapper) {
  border-radius: 8px;
  box-shadow: 0 0 0 1px #e2e8f0 inset;
}

.pt-dialog-custom :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px #16a34a inset !important;
}

.pt-dialog-custom :deep(.el-dialog__footer) {
  padding: 10px 20px 16px;
  border-top: 1px solid #f1f5f9;
}

.pt-dialog-custom :deep(.el-button) {
  border-radius: 8px;
  padding: 6px 14px;
  font-size: 12px;
}
</style>
