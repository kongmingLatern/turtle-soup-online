<script setup lang="ts">
import {
  Brush,
  Check,
  CircleClose,
  CopyDocument,
  Delete,
  EditPen,
  Hide,
  House,
  Moon,
  Refresh,
  Right,
  Share,
  Sunny,
  User,
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'

type Role = 'host' | 'player'
type Verdict = 'yes' | 'no' | 'both' | 'irrelevant'

interface UserProfile {
  id: string
  name: string
  role: Role
}

interface Question {
  id: string
  authorId: string
  author: string
  text: string
  verdict?: Verdict
  createdAt: number
  answeredAt?: number
}

interface RoomState {
  id: string
  title: string
  surface: string
  answer: string
  questions: Question[]
  canvasDataUrl: string
  updatedAt: number
}

const STORAGE_PROFILE = 'turtle-soup:profile'
const STORAGE_THEME = 'turtle-soup:theme'
const ROOM_PREFIX = 'turtle-soup:room:'
const CHANNEL_NAME = 'turtle-soup-online'

const verdictLabels: Record<Verdict, string> = {
  yes: '是',
  no: '不是',
  both: '是也不是',
  irrelevant: '不重要',
}

const verdictTypes: Record<Verdict, 'success' | 'danger' | 'warning' | 'info'> = {
  yes: 'success',
  no: 'danger',
  both: 'warning',
  irrelevant: 'info',
}

const sampleSurface =
  '男人走进一家餐厅，点了一碗海龟汤。喝了一口后，他脸色大变，回家后结束了自己的生命。为什么？'
const sampleAnswer =
  '经典汤底：男人曾经在海难中被同伴骗吃了“海龟汤”，实际是遇难者的肉。多年后他喝到真正的海龟汤，发现味道不同，意识到真相。'

const profile = reactive<UserProfile>(loadProfile())
const isDark = ref(loadTheme())
const roomId = ref(getInitialRoomId())
const room = reactive<RoomState>(loadRoom(roomId.value))
const loginName = ref(profile.name)
const selectedRole = ref<Role>(profile.role)
const questionText = ref('')
const shareUrl = ref(window.location.href)
const answerHidden = ref(true)
const activePanel = ref('answer')
const brushColor = ref('#14b8a6')
const brushSize = ref(6)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const canvasWrapRef = ref<HTMLElement | null>(null)
const isDrawing = ref(false)
const lastPoint = ref<{ x: number; y: number } | null>(null)
const channel = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL_NAME) : null
let saveTimer: number | undefined
let canvasSaveTimer: number | undefined
let applyingRemote = false
let savingSnapshot = false

const roomStorageKey = computed(() => `${ROOM_PREFIX}${room.id}`)
const pendingQuestions = computed(() => room.questions.filter((question) => !question.verdict).length)
const answeredQuestions = computed(() => room.questions.filter((question) => question.verdict).length)
const canHost = computed(() => profile.role === 'host')
const sortedQuestions = computed(() =>
  [...room.questions].sort((a, b) => b.createdAt - a.createdAt),
)

const onlineHint = computed(() =>
  channel
    ? '同一浏览器多窗口会实时同步；Vercel 静态部署可直接使用。'
    : '当前浏览器不支持 BroadcastChannel，将使用 localStorage 事件同步。'
)

watch(
  isDark,
  (value) => {
    document.documentElement.classList.toggle('dark', value)
    localStorage.setItem(STORAGE_THEME, value ? 'dark' : 'light')
  },
  { immediate: true },
)

watch(
  () => ({ ...profile }),
  () => {
    localStorage.setItem(STORAGE_PROFILE, JSON.stringify(profile))
  },
  { deep: true },
)

watch(
  room,
  () => {
    if (applyingRemote || savingSnapshot) return
    window.clearTimeout(saveTimer)
    saveTimer = window.setTimeout(() => persistRoom(true), 120)
  },
  { deep: true },
)

onMounted(() => {
  window.addEventListener('storage', handleStorage)
  window.addEventListener('resize', resizeCanvas)
  channel?.addEventListener('message', handleChannelMessage)
  updateShareUrl()
  nextTick(() => {
    resizeCanvas()
    restoreCanvas()
  })
})

onBeforeUnmount(() => {
  window.clearTimeout(saveTimer)
  window.clearTimeout(canvasSaveTimer)
  window.removeEventListener('storage', handleStorage)
  window.removeEventListener('resize', resizeCanvas)
  channel?.removeEventListener('message', handleChannelMessage)
  channel?.close()
})

function loadProfile(): UserProfile {
  const cached = safeParse<UserProfile>(localStorage.getItem(STORAGE_PROFILE))
  return (
    cached ?? {
      id: crypto.randomUUID(),
      name: `玩家${Math.floor(Math.random() * 900 + 100)}`,
      role: 'host',
    }
  )
}

function loadTheme() {
  const cached = localStorage.getItem(STORAGE_THEME)
  if (cached) return cached === 'dark'
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

function getInitialRoomId() {
  const url = new URL(window.location.href)
  return url.searchParams.get('room') || `soup-${Math.random().toString(36).slice(2, 8)}`
}

function createRoom(id: string): RoomState {
  return {
    id,
    title: '午夜海龟汤局',
    surface: sampleSurface,
    answer: sampleAnswer,
    questions: [],
    canvasDataUrl: '',
    updatedAt: Date.now(),
  }
}

function loadRoom(id: string): RoomState {
  return safeParse<RoomState>(localStorage.getItem(`${ROOM_PREFIX}${id}`)) ?? createRoom(id)
}

function safeParse<T>(value: string | null): T | null {
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function updateProfile() {
  profile.name = loginName.value.trim() || profile.name
  profile.role = selectedRole.value
  ElMessage.success('身份已更新')
}

function switchRoom() {
  const normalized = roomId.value.trim() || getInitialRoomId()
  roomId.value = normalized
  applyingRemote = true
  Object.assign(room, loadRoom(normalized))
  applyingRemote = false
  updateShareUrl()
  nextTick(() => {
    resizeCanvas()
    restoreCanvas()
  })
}

function updateShareUrl() {
  const url = new URL(window.location.href)
  url.searchParams.set('room', room.id)
  window.history.replaceState({}, '', url)
  shareUrl.value = url.toString()
}

async function copyShareUrl() {
  await navigator.clipboard.writeText(shareUrl.value)
  ElMessage.success('房间链接已复制')
}

function addQuestion() {
  const text = questionText.value.trim()
  if (!text) return
  room.questions.push({
    id: crypto.randomUUID(),
    authorId: profile.id,
    author: profile.name,
    text,
    createdAt: Date.now(),
  })
  questionText.value = ''
}

function setVerdict(questionId: string, verdict: Verdict) {
  if (!canHost.value) return
  const question = room.questions.find((item) => item.id === questionId)
  if (!question) return
  question.verdict = verdict
  question.answeredAt = Date.now()
}

function removeQuestion(questionId: string) {
  const index = room.questions.findIndex((item) => item.id === questionId)
  if (index >= 0) room.questions.splice(index, 1)
}

function resetRoom() {
  room.questions = []
  room.canvasDataUrl = ''
  clearCanvas(false)
  ElMessage.success('本局记录已清空')
}

function persistRoom(sync = false) {
  savingSnapshot = true
  room.updatedAt = Date.now()
  const snapshot = structuredClone(room)
  localStorage.setItem(roomStorageKey.value, JSON.stringify(snapshot))
  if (sync) {
    channel?.postMessage({ type: 'room:update', room: snapshot })
  }
  nextTick(() => {
    savingSnapshot = false
  })
}

function handleChannelMessage(event: MessageEvent<{ type: string; room: RoomState }>) {
  if (event.data?.type !== 'room:update' || event.data.room.id !== room.id) return
  applyRemoteRoom(event.data.room)
}

function handleStorage(event: StorageEvent) {
  if (event.key !== roomStorageKey.value || !event.newValue) return
  const nextRoom = safeParse<RoomState>(event.newValue)
  if (nextRoom) applyRemoteRoom(nextRoom)
}

function applyRemoteRoom(nextRoom: RoomState) {
  if (nextRoom.updatedAt < room.updatedAt) return
  applyingRemote = true
  Object.assign(room, nextRoom)
  applyingRemote = false
  nextTick(() => restoreCanvas())
}

function getCanvasPoint(event: PointerEvent) {
  const canvas = canvasRef.value
  if (!canvas) return { x: 0, y: 0 }
  const rect = canvas.getBoundingClientRect()
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  }
}

function startDrawing(event: PointerEvent) {
  if (!canHost.value) return
  isDrawing.value = true
  lastPoint.value = getCanvasPoint(event)
  canvasRef.value?.setPointerCapture(event.pointerId)
}

function draw(event: PointerEvent) {
  if (!isDrawing.value || !lastPoint.value || !canHost.value) return
  const canvas = canvasRef.value
  const context = canvas?.getContext('2d')
  if (!canvas || !context) return
  const point = getCanvasPoint(event)
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.strokeStyle = brushColor.value
  context.lineWidth = brushSize.value
  context.beginPath()
  context.moveTo(lastPoint.value.x, lastPoint.value.y)
  context.lineTo(point.x, point.y)
  context.stroke()
  lastPoint.value = point
  queueCanvasSave()
}

function stopDrawing(event?: PointerEvent) {
  if (!isDrawing.value) return
  isDrawing.value = false
  lastPoint.value = null
  if (event) canvasRef.value?.releasePointerCapture(event.pointerId)
  saveCanvas()
}

function queueCanvasSave() {
  window.clearTimeout(canvasSaveTimer)
  canvasSaveTimer = window.setTimeout(saveCanvas, 180)
}

function saveCanvas() {
  const canvas = canvasRef.value
  if (!canvas) return
  room.canvasDataUrl = canvas.toDataURL('image/png')
}

function clearCanvas(showMessage = true) {
  const canvas = canvasRef.value
  const context = canvas?.getContext('2d')
  if (!canvas || !context) return
  context.clearRect(0, 0, canvas.width, canvas.height)
  room.canvasDataUrl = ''
  if (showMessage) ElMessage.success('画板已清空')
}

function resizeCanvas() {
  const canvas = canvasRef.value
  const wrap = canvasWrapRef.value
  if (!canvas || !wrap) return
  const previous = room.canvasDataUrl || canvas.toDataURL('image/png')
  const ratio = window.devicePixelRatio || 1
  const rect = wrap.getBoundingClientRect()
  canvas.width = Math.max(320, Math.floor(rect.width * ratio))
  canvas.height = Math.max(240, Math.floor(rect.height * ratio))
  restoreCanvas(previous)
}

function restoreCanvas(dataUrl = room.canvasDataUrl) {
  const canvas = canvasRef.value
  const context = canvas?.getContext('2d')
  if (!canvas || !context) return
  context.clearRect(0, 0, canvas.width, canvas.height)
  if (!dataUrl) return
  const image = new Image()
  image.onload = () => {
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
  }
  image.src = dataUrl
}

function formatTime(time: number) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(time)
}
</script>

<template>
  <el-config-provider>
    <main class="app-shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">Turtle Soup Online</p>
          <h1>海龟汤在线联机</h1>
        </div>
        <div class="top-actions">
          <el-tooltip content="复制房间链接">
            <el-button :icon="Share" circle @click="copyShareUrl" />
          </el-tooltip>
          <el-tooltip content="切换暗黑模式">
            <el-button :icon="isDark ? Sunny : Moon" circle @click="isDark = !isDark" />
          </el-tooltip>
        </div>
      </header>

      <section class="workspace">
        <aside class="panel side-panel">
          <div class="panel-title">
            <House />
            <span>房间与身份</span>
          </div>

          <el-form label-position="top">
            <el-form-item label="昵称">
              <el-input v-model="loginName" :prefix-icon="User" maxlength="16" />
            </el-form-item>
            <el-form-item label="身份">
              <el-segmented
                v-model="selectedRole"
                :options="[
                  { label: '主持人', value: 'host' },
                  { label: '玩家', value: 'player' },
                ]"
              />
            </el-form-item>
            <el-button type="primary" :icon="Check" class="wide-button" @click="updateProfile">
              进入房间
            </el-button>
          </el-form>

          <div class="room-box">
            <label>房间号</label>
            <div class="room-row">
              <el-input v-model="roomId" @keyup.enter="switchRoom" />
              <el-tooltip content="切换房间">
                <el-button :icon="Right" @click="switchRoom" />
              </el-tooltip>
            </div>
            <el-button text :icon="CopyDocument" @click="copyShareUrl">复制邀请链接</el-button>
          </div>

          <div class="stats-grid">
            <div>
              <strong>{{ room.questions.length }}</strong>
              <span>提问</span>
            </div>
            <div>
              <strong>{{ pendingQuestions }}</strong>
              <span>待判定</span>
            </div>
            <div>
              <strong>{{ answeredQuestions }}</strong>
              <span>已回答</span>
            </div>
          </div>

          <p class="sync-note">{{ onlineHint }}</p>
        </aside>

        <section class="main-panel">
          <article class="panel story-panel">
            <div class="story-heading">
              <div>
                <p class="eyebrow">汤面</p>
                <el-input v-if="canHost" v-model="room.title" class="title-input" />
                <h2 v-else>{{ room.title }}</h2>
              </div>
              <el-tag :type="canHost ? 'success' : 'info'" effect="dark">
                {{ canHost ? '主持人视角' : '玩家视角' }}
              </el-tag>
            </div>
            <el-input
              v-if="canHost"
              v-model="room.surface"
              type="textarea"
              :autosize="{ minRows: 4, maxRows: 7 }"
              placeholder="写下可公开给玩家的汤面"
            />
            <p v-else class="surface-text">{{ room.surface }}</p>
          </article>

          <article class="panel question-panel">
            <div class="panel-title">
              <EditPen />
              <span>实时问答</span>
            </div>
            <div class="ask-row">
              <el-input
                v-model="questionText"
                size="large"
                placeholder="输入问题，例如：这个人认识厨师吗？"
                @keyup.enter="addQuestion"
              />
              <el-button type="primary" size="large" :icon="Right" @click="addQuestion">
                发送
              </el-button>
            </div>

            <div class="timeline">
              <el-empty v-if="!room.questions.length" description="还没有问题，开汤吧。" />
              <div v-for="question in sortedQuestions" :key="question.id" class="question-item">
                <div class="question-main">
                  <div class="question-meta">
                    <span>{{ question.author }}</span>
                    <time>{{ formatTime(question.createdAt) }}</time>
                  </div>
                  <p>{{ question.text }}</p>
                </div>

                <div class="verdict-zone">
                  <el-tag
                    v-if="question.verdict"
                    :type="verdictTypes[question.verdict]"
                    effect="dark"
                    round
                  >
                    {{ verdictLabels[question.verdict] }}
                  </el-tag>
                  <span v-else class="waiting">等待主持人</span>

                  <div v-if="canHost" class="verdict-buttons">
                    <el-button size="small" type="success" @click="setVerdict(question.id, 'yes')">
                      是
                    </el-button>
                    <el-button size="small" type="danger" @click="setVerdict(question.id, 'no')">
                      不是
                    </el-button>
                    <el-button size="small" type="warning" @click="setVerdict(question.id, 'both')">
                      是也不是
                    </el-button>
                    <el-button
                      size="small"
                      type="info"
                      @click="setVerdict(question.id, 'irrelevant')"
                    >
                      不重要
                    </el-button>
                    <el-button size="small" :icon="Delete" circle @click="removeQuestion(question.id)" />
                  </div>
                </div>
              </div>
            </div>
          </article>
        </section>

        <aside class="panel tools-panel">
          <el-tabs v-model="activePanel" stretch>
            <el-tab-pane name="answer">
              <template #label>
                <span class="tab-label"><Hide />汤底</span>
              </template>
              <div class="answer-tools">
                <el-switch
                  v-model="answerHidden"
                  active-text="隐藏"
                  inactive-text="显示"
                  inline-prompt
                />
                <el-button v-if="canHost" text type="danger" :icon="Refresh" @click="resetRoom">
                  重开本局
                </el-button>
              </div>
              <el-input
                v-if="canHost"
                v-model="room.answer"
                type="textarea"
                :autosize="{ minRows: 9, maxRows: 14 }"
                placeholder="只有主持人需要知道的汤底"
              />
              <div v-else-if="answerHidden" class="hidden-answer">
                <CircleClose />
                <span>汤底已隐藏</span>
              </div>
              <p v-else class="answer-text">{{ room.answer }}</p>
            </el-tab-pane>

            <el-tab-pane name="canvas">
              <template #label>
                <span class="tab-label"><Brush />画板</span>
              </template>
              <div class="brush-toolbar">
                <el-color-picker v-model="brushColor" :disabled="!canHost" />
                <el-slider v-model="brushSize" :min="2" :max="22" :disabled="!canHost" />
                <el-tooltip content="清空画板">
                  <el-button :icon="Delete" circle :disabled="!canHost" @click="clearCanvas()" />
                </el-tooltip>
              </div>
              <div ref="canvasWrapRef" class="canvas-wrap">
                <canvas
                  ref="canvasRef"
                  :class="{ readonly: !canHost }"
                  @pointerdown="startDrawing"
                  @pointermove="draw"
                  @pointerup="stopDrawing"
                  @pointercancel="stopDrawing"
                  @pointerleave="stopDrawing"
                />
              </div>
            </el-tab-pane>
          </el-tabs>
        </aside>
      </section>
    </main>
  </el-config-provider>
</template>
