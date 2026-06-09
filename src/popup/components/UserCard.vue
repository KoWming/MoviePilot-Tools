<template>
  <div class="user-card">
    <div class="top">
      <div class="left">
        <div class="avatar-box">
          <div class="crown" v-if="user.is_superuser">
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path :d="mdiCrown" />
            </svg>
          </div>
          <el-avatar :size="64" :src="user.avatar || ''" shape="square" class="avatar-squared">{{ initials }}</el-avatar>
        </div>
        <div class="meta">
          <div class="name-line">
            <div class="name">{{ user.name }}</div>
            <el-button link @click.stop="onEdit" class="edit" title="编辑">
              <svg viewBox="0 0 24 24" width="16" height="16"><path :d="mdiPencil"/></svg>
            </el-button>
            <div class="spacer"></div>
            <button class="logout-btn" title="注销" @click.stop="onLogout">
              <svg viewBox="0 0 24 24" width="16" height="16" class="power"><path :d="mdiPowerStandby"/></svg>
              <span>注销</span>
            </button>
          </div>
          <div class="badges">
            <el-tag size="small" type="danger" effect="plain" v-if="user.is_superuser">管理员</el-tag>
            <el-tag size="small" type="success" effect="plain" v-if="user.is_active !== false">激活</el-tag>
          </div>
        </div>
      </div>
    </div>
    <div class="divider"></div>
    <div class="email">
      <svg viewBox="0 0 24 24" width="16" height="16" class="mail"><path :d="mdiEmailOutline"/></svg>
      <span>{{ user.email || '未填写邮箱' }}</span>
    </div>
    <div class="stats">
      <div class="stat-row movie">
        <span class="bubble"><svg viewBox="0 0 24 24" width="16" height="16"><path :d="mdiMovieOutline"/></svg></span>
        <div class="stat-text">
          <div class="num">{{ movieCount }}</div>
          <div class="label">电影订阅</div>
        </div>
      </div>
      <div class="stat-row tv">
        <span class="bubble"><svg viewBox="0 0 24 24" width="16" height="16"><path :d="mdiTelevisionClassic"/></svg></span>
        <div class="stat-text">
          <div class="num">{{ tvCount }}</div>
          <div class="label">剧集订阅</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// ============================================================
// 用户信息卡片组件
// 显示用户头像、用户名、角色标签
// ============================================================
import { computed } from 'vue';
import { mdiEmailOutline, mdiMovieOutline, mdiTelevisionClassic, mdiPencil, mdiCrown, mdiPowerStandby } from '@mdi/js';

// ==================== Props / Emits ====================
const props = defineProps<{ user: any; movieCount?: number; tvCount?: number }>();
const emits = defineEmits(['edit', 'logout']);

// ==================== 计算属性 ====================
// 头像占位首字母
const initials = computed(() => props.user?.name?.[0]?.toUpperCase() || 'U');
// 电影订阅数
const movieCount = computed(() => props.movieCount ?? 0);
// 剧集订阅数
const tvCount = computed(() => props.tvCount ?? 0);

// ==================== 事件处理 ====================
function onEdit() { emits('edit', props.user); }
function onLogout() { emits('logout'); }
</script>

<style scoped>
.user-card {
  border-radius: 14px;
  background: linear-gradient(180deg, #fff7e6 0%, #ffffff 35%);
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.06);
  padding: 12px;
}

.top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1 1 auto;
}

/* 头像容器（含皇冠装饰） */
.avatar-box {
  position: relative;
  display: inline-block;
  width: 64px;
  height: 64px;
}

.avatar-squared :deep(.el-avatar__img),
.avatar-squared :deep(.el-avatar__text) {
  border-radius: 12px;
}

.avatar-squared {
  border: 3px solid #f7b501;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 0 0 1px rgba(247, 181, 1, 0.25) inset;
}

/* 超级管理员皇冠图标 */
.crown {
  position: absolute;
  top: -6px;
  left: -6px;
  transform: rotate(-45deg);
  animation: wiggle 2.4s ease-in-out infinite;
  z-index: 5;
  pointer-events: none;
}

.crown svg {
  fill: #f7b501;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.28));
}

.meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1 1 auto;
}

.name-line {
  display: flex;
  align-items: center;
  gap: 6px;
}

.spacer {
  flex: 1 1 auto;
}

.name {
  font-size: 18px;
  font-weight: 700;
  color: #f59e0b;
}

.badges :deep(.el-tag) {
  margin-right: 6px;
}

.edit {
  opacity: 0.6;
}

.edit svg {
  fill: #a8a8a8;
}

.edit:hover svg {
  fill: #f59e0b;
}

/* 注销按钮 */
.logout-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border: 1px solid #ffa39e;
  border-radius: 8px;
  background: #fff1f0;
  color: #ff4d4f;
  cursor: pointer;
  font-size: 12px;
}

.logout-btn:hover {
  background: #ffe2e1;
}

.logout-btn .power path {
  fill: #ff4d4f;
}

.divider {
  height: 1px;
  background: rgba(0, 0, 0, 0.06);
  margin: 8px 4px;
}

.email {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #6b7280;
  padding: 2px 4px 8px;
}

.email .mail {
  opacity: 0.9;
}

.email .mail path {
  fill: #8ea6ff;
}

/* 订阅统计 */
.stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.stat-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.stat-row .bubble {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.stat-row .num {
  font-size: 18px;
  font-weight: 700;
  line-height: 18px;
}

.stat-row .label {
  font-size: 12px;
  color: #8c8c8c;
}

.stat-row .stat-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* 电影订阅配色 */
.stat-row.movie .bubble {
  background: #fff2cf;
  color: #d48806;
}

.stat-row.movie svg {
  fill: #faad14;
}

/* 剧集订阅配色 */
.stat-row.tv .bubble {
  background: #d9f3ff;
  color: #1394cf;
}

.stat-row.tv svg {
  fill: #4db8ff;
}

@keyframes wiggle {
  0%, 100% { transform: rotate(-42deg) translateY(0); }
  50% { transform: rotate(-48deg) translateY(-1px); }
}
</style>
