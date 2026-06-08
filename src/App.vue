<script setup lang="ts">
import {
	Brush,
	Check,
	CircleClose,
	CopyDocument,
	Delete,
	EditPen,
	Flag,
	Hide,
	House,
	Moon,
	Plus,
	Refresh,
	Right,
	Share,
	Sunny,
	User,
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import {
	computed,
	nextTick,
	onBeforeUnmount,
	onMounted,
	reactive,
	ref,
	watch,
} from 'vue'
import { io, Socket } from 'socket.io-client'

type Role = 'host' | 'player'
type Verdict = 'yes' | 'no' | 'both' | 'irrelevant'
type Difficulty = 'easy' | 'medium' | 'hard'
type QuestionQuality = 'none' | 'helpful' | 'key' | 'breakthrough'
type TruthGuess = 'none' | 'clue' | 'motive' | 'full'

interface AuthUser {
	id: string
	username: string
	displayName: string
	avatarDataUrl: string
	points: number
	rankTitle: string
}

interface Soup {
	id: string
	title: string
	surface: string
	answer: string
	category: string
	difficulty: Difficulty
	isBuiltin: boolean
}

interface Question {
	id: string
	text: string
	verdict?: Verdict | null
	important: boolean
	quality: QuestionQuality
	truthGuess: TruthGuess
	firstCoreClue: boolean
	firstMainLogic: boolean
	firstFullSolve: boolean
	author: AuthUser
	createdAt: string
	answeredAt?: string | null
}

interface RoomState {
	id: string
	code: string
	title: string
	surface: string
	answer: string
	canvasDataUrl: string
	solved: boolean
	revealed: boolean
	settlement?: Settlement
	host: AuthUser
	questions: Question[]
	updatedAt: string
}

interface AuthResponse {
	token: string
	user: AuthUser
}

interface RoomMember {
	userId: string
	username: string
	displayName: string
	avatarDataUrl?: string
	points?: number
	rankTitle?: string
}

interface MemberStats extends RoomMember {
	online: boolean
	questionCount: number
	importantCount: number
	importantQuestions: Question[]
}

interface PresenceEvent {
	type: 'join' | 'leave'
	user: RoomMember
	message: string
	at: string
}

interface SettlementEntry {
	rank: number
	user: AuthUser
	total: number
	breakdown: Record<string, number>
}

interface Settlement {
	roomCode: string
	revealedAt: string
	answer: string
	entries: SettlementEntry[]
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3001'
const STORAGE_TOKEN = 'turtle-soup:token'
const STORAGE_THEME = 'turtle-soup:theme'

const verdictLabels: Record<Verdict, string> = {
	yes: '是',
	no: '不是',
	both: '是也不是',
	irrelevant: '不重要',
}

const verdictTypes: Record<Verdict, 'success' | 'danger' | 'warning' | 'info'> =
	{
		yes: 'success',
		no: 'danger',
		both: 'warning',
		irrelevant: 'info',
	}

const difficultyLabels: Record<Difficulty, string> = {
	easy: '入门',
	medium: '标准',
	hard: '困难',
}

const qualityLabels: Record<QuestionQuality, string> = {
	none: '无关问题',
	helpful: '有帮助 +2',
	key: '关键问题 +5',
	breakthrough: '核心突破 +10',
}

const truthGuessLabels: Record<TruthGuess, string> = {
	none: '未猜中',
	clue: '关键线索 +10',
	motive: '主要动机 +15',
	full: '完整汤底 +30',
}

const isDark = ref(loadTheme())
const token = ref(localStorage.getItem(STORAGE_TOKEN) || '')
const user = ref<AuthUser | null>(null)
const authMode = ref<'login' | 'register'>('login')
const authForm = reactive({
	username: '',
	password: '',
	displayName: '',
})
const selectedRole = ref<Role>('player')
const soups = ref<Soup[]>([])
const selectedSoupId = ref('')
const roomCodeInput = ref(getInitialRoomCode())
const room = ref<RoomState | null>(null)
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
const savingRoom = ref(false)
const socketStatus = ref('未连接')
const roomMembers = ref<RoomMember[]>([])
const presenceEvents = ref<PresenceEvent[]>([])
const memberDialogOpen = ref(false)
const selectedMember = ref<MemberStats | null>(null)
const settlementDialogOpen = ref(false)
const settlement = ref<Settlement | null>(null)
const customSoupOpen = ref(false)
const customSoup = reactive({
	title: '',
	surface: '',
	answer: '',
	category: '自建',
	difficulty: 'medium' as Difficulty,
})
let socket: Socket | null = null
let canvasSaveTimer: number | undefined
let canvasPreviewTimer: number | undefined
let roomSaveTimer: number | undefined
const presenceNotifyAt = new Map<string, number>()

const canHost = computed(() =>
	Boolean(user.value && room.value?.host.id === user.value.id),
)
const pendingQuestions = computed(
	() => room.value?.questions.filter(question => !question.verdict).length ?? 0,
)
const answeredQuestions = computed(
	() => room.value?.questions.filter(question => question.verdict).length ?? 0,
)
const sortedQuestions = computed(() => room.value?.questions ?? [])
const importantQuestions = computed(() =>
	sortedQuestions.value.filter(question => question.important),
)
const memberStats = computed<MemberStats[]>(() => {
	const byId = new Map<string, MemberStats>()
	const onlineIds = new Set(roomMembers.value.map(member => member.userId))
	const upsertMember = (member: RoomMember | AuthUser, online = false) => {
		const memberId = 'userId' in member ? member.userId : member.id
		const existing = byId.get(memberId)
		byId.set(memberId, {
			...existing,
			userId: memberId,
			username: member.username,
			displayName: member.displayName,
			avatarDataUrl: member.avatarDataUrl || existing?.avatarDataUrl,
			points: member.points ?? existing?.points,
			rankTitle: member.rankTitle ?? existing?.rankTitle,
			online: online || existing?.online || false,
			questionCount: existing?.questionCount ?? 0,
			importantCount: existing?.importantCount ?? 0,
			importantQuestions: existing?.importantQuestions ?? [],
		})
	}
	roomMembers.value.forEach(member => upsertMember(member, true))
	if (room.value) upsertMember(room.value.host, onlineIds.has(room.value.host.id))
	sortedQuestions.value.forEach(question => {
		upsertMember(question.author, onlineIds.has(question.author.id))
		const existing =
			byId.get(question.author.id) ??
			({
				userId: question.author.id,
				username: question.author.username,
				displayName: question.author.displayName,
				avatarDataUrl: question.author.avatarDataUrl,
				points: question.author.points,
				rankTitle: question.author.rankTitle,
				online: onlineIds.has(question.author.id),
				questionCount: 0,
				importantCount: 0,
				importantQuestions: [],
			} satisfies MemberStats)
		existing.avatarDataUrl ||= question.author.avatarDataUrl
		existing.points = question.author.points ?? existing.points
		existing.rankTitle = question.author.rankTitle ?? existing.rankTitle
		existing.questionCount += 1
		if (question.important) {
			existing.importantCount += 1
			existing.importantQuestions.push(question)
		}
		byId.set(question.author.id, existing)
	})
	return [...byId.values()].sort((a, b) => Number(b.online) - Number(a.online) || b.questionCount - a.questionCount)
})
const selectedSoup = computed(() =>
	soups.value.find(soup => soup.id === selectedSoupId.value),
)
const liveLeaderboard = computed(() => {
	if (settlement.value?.entries.length) return settlement.value.entries
	return memberStats.value
		.map(member => ({
			rank: 0,
			user: {
				id: member.userId,
				username: member.username,
				displayName: member.displayName,
				avatarDataUrl: member.avatarDataUrl ?? '',
				points: member.points ?? 0,
				rankTitle: member.rankTitle ?? '路人甲',
			},
			total: member.points ?? 0,
			breakdown: {},
		}))
		.sort((a, b) => b.total - a.total)
		.map((entry, index, list) => ({
			...entry,
			rank:
				index > 0 && entry.total === list[index - 1].total
					? list[index - 1].rank
					: index + 1,
		}))
})
const onlineHint = computed(() =>
	room.value
		? `后端实时房间 ${room.value.code}，Socket 状态：${socketStatus.value}`
		: '登录后可创建房间或输入房间号加入。',
)

watch(
	isDark,
	value => {
		document.documentElement.classList.toggle('dark', value)
		localStorage.setItem(STORAGE_THEME, value ? 'dark' : 'light')
	},
	{ immediate: true },
)

onMounted(async () => {
	window.addEventListener('resize', resizeCanvas)
	window.addEventListener('beforeunload', handleBeforeUnload)
	await Promise.all([loadSoups(), restoreSession()])
	if (roomCodeInput.value) {
		await joinRoom(roomCodeInput.value, false)
	}
})

onBeforeUnmount(() => {
	window.clearTimeout(canvasSaveTimer)
	window.clearTimeout(canvasPreviewTimer)
	window.clearTimeout(roomSaveTimer)
	window.removeEventListener('resize', resizeCanvas)
	window.removeEventListener('beforeunload', handleBeforeUnload)
	leaveCurrentRoom()
	socket?.disconnect()
})

function loadTheme() {
	const cached = localStorage.getItem(STORAGE_THEME)
	if (cached) return cached === 'dark'
	return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

function getInitialRoomCode() {
	const url = new URL(window.location.href)
	return url.searchParams.get('room') || ''
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
	const headers = new Headers(options.headers)
	headers.set('Content-Type', 'application/json')
	if (token.value) headers.set('Authorization', `Bearer ${token.value}`)
	const response = await fetch(`${API_BASE}${path}`, { ...options, headers })
	if (!response.ok) {
		const error = await response.json().catch(() => ({ message: '请求失败' }))
		throw new Error(
			Array.isArray(error.message) ? error.message.join('；') : error.message,
		)
	}
	return response.json() as Promise<T>
}

async function restoreSession() {
	if (!token.value) return
	try {
		user.value = await request<AuthUser>('/auth/me')
	} catch {
		logout(false)
	}
}

async function submitAuth() {
	const payload =
		authMode.value === 'register'
			? {
					username: authForm.username,
					password: authForm.password,
					displayName: authForm.displayName || authForm.username,
				}
			: { username: authForm.username, password: authForm.password }
	const data = await request<AuthResponse>(`/auth/${authMode.value}`, {
		method: 'POST',
		body: JSON.stringify(payload),
	})
	token.value = data.token
	user.value = data.user
	localStorage.setItem(STORAGE_TOKEN, data.token)
	if (room.value) {
		joinSocketRoom(room.value.code)
	}
	ElMessage.success(authMode.value === 'register' ? '注册成功' : '登录成功')
}

function logout(showMessage = true) {
	leaveCurrentRoom()
	token.value = ''
	user.value = null
	localStorage.removeItem(STORAGE_TOKEN)
	socket?.disconnect()
	socket = null
	if (showMessage) ElMessage.success('已退出登录')
}

async function loadSoups() {
	soups.value = await request<Soup[]>('/soups')
	selectedSoupId.value = soups.value[0]?.id ?? ''
}

async function createCustomSoup() {
	const soup = await request<Soup>('/soups', {
		method: 'POST',
		body: JSON.stringify(customSoup),
	})
	soups.value.unshift(soup)
	selectedSoupId.value = soup.id
	customSoupOpen.value = false
	Object.assign(customSoup, {
		title: '',
		surface: '',
		answer: '',
		category: '自建',
		difficulty: 'medium',
	})
	ElMessage.success('自建汤面已保存')
}

async function createRoom() {
	if (!user.value) return ElMessage.warning('请先登录')
	const data = await request<RoomState>('/rooms', {
		method: 'POST',
		body: JSON.stringify({ soupId: selectedSoupId.value || undefined }),
	})
	applyRoom(data)
	selectedRole.value = 'host'
	ElMessage.success(`房间 ${data.code} 已创建`)
}

async function joinRoom(code = roomCodeInput.value, showMessage = true) {
	const normalized = code.trim().toUpperCase()
	if (!normalized) return
	if (room.value?.code && room.value.code !== normalized) {
		leaveCurrentRoom()
		presenceEvents.value = []
	}
	const data = await request<RoomState>(`/rooms/${normalized}`)
	applyRoom(data)
	selectedRole.value = canHost.value ? 'host' : 'player'
	if (showMessage) ElMessage.success(`已进入房间 ${data.code}`)
}

function applyRoom(data: RoomState) {
	room.value = data
	roomCodeInput.value = data.code
	updateShareUrl()
	connectSocket(data.code)
	nextTick(() => {
		resizeCanvas()
		restoreCanvas()
	})
}

function connectSocket(code: string) {
	if (!socket) {
		socket = io(API_BASE, { transports: ['websocket', 'polling'] })
		socket.on('connect', () => {
			socketStatus.value = '已连接'
			joinSocketRoom(code)
		})
		socket.on('disconnect', () => {
			socketStatus.value = '已断开'
			roomMembers.value = []
		})
		socket.on('room-updated', (nextRoom: RoomState) => {
			if (nextRoom.code !== room.value?.code) return
			room.value = nextRoom
			if (nextRoom.settlement) settlement.value = nextRoom.settlement
			nextTick(() => restoreCanvas())
		})
		socket.on('room-revealed', (nextSettlement: Settlement) => {
			settlement.value = nextSettlement
			settlementDialogOpen.value = true
			if (room.value) {
				room.value.revealed = true
				room.value.solved = true
				room.value.settlement = nextSettlement
			}
		})
		socket.on('room-members', (members: RoomMember[]) => {
			roomMembers.value = members
		})
		socket.on('room-presence', (event: PresenceEvent) => {
			const notifyKey = `${event.type}:${event.user.userId}`
			const now = Date.now()
			if ((presenceNotifyAt.get(notifyKey) ?? 0) + 2000 > now) return
			presenceNotifyAt.set(notifyKey, now)
			presenceEvents.value = [event, ...presenceEvents.value].slice(0, 5)
			const notify = event.type === 'join' ? ElMessage.success : ElMessage.info
			notify(event.message)
		})
		socket.on(
			'canvas-updated',
			(payload: { roomCode: string; canvasDataUrl: string }) => {
				if (payload.roomCode !== room.value?.code || canHost.value) return
				if (room.value) room.value.canvasDataUrl = payload.canvasDataUrl
				restoreCanvas(payload.canvasDataUrl)
			},
		)
	}
	joinSocketRoom(code)
}

function joinSocketRoom(code: string) {
	socket?.emit('join-room', {
		roomCode: code,
		user: user.value
			? {
					id: user.value.id,
					username: user.value.username,
					displayName: user.value.displayName,
					avatarDataUrl: user.value.avatarDataUrl,
					points: user.value.points,
					rankTitle: user.value.rankTitle,
				}
			: undefined,
	})
}

function leaveCurrentRoom() {
	socket?.emit('leave-room')
	roomMembers.value = []
}

function handleBeforeUnload() {
	leaveCurrentRoom()
	socket?.disconnect()
}

function updateShareUrl() {
	if (!room.value) return
	const url = new URL(window.location.href)
	url.searchParams.set('room', room.value.code)
	window.history.replaceState({}, '', url)
	shareUrl.value = url.toString()
}

async function copyShareUrl() {
	await navigator.clipboard.writeText(shareUrl.value)
	ElMessage.success('房间链接已复制')
}

function queueRoomSave() {
	if (!canHost.value || !room.value) return
	window.clearTimeout(roomSaveTimer)
	roomSaveTimer = window.setTimeout(saveRoom, 350)
}

async function saveRoom() {
	if (!canHost.value || !room.value) return
	savingRoom.value = true
	try {
		const data = await request<RoomState>(`/rooms/${room.value.code}`, {
			method: 'PATCH',
			body: JSON.stringify({
				title: room.value.title,
				surface: room.value.surface,
				answer: room.value.answer,
				canvasDataUrl: room.value.canvasDataUrl,
				solved: room.value.solved,
			}),
		})
		room.value = data
	} finally {
		savingRoom.value = false
	}
}

async function addQuestion() {
	const text = questionText.value.trim()
	if (!text || !room.value) return
	const data = await request<RoomState>(`/rooms/${room.value.code}/questions`, {
		method: 'POST',
		body: JSON.stringify({ text }),
	})
	questionText.value = ''
	room.value = data
}

async function setVerdict(questionId: string, verdict: Verdict) {
	if (!canHost.value || !room.value) return
	room.value = await request<RoomState>(
		`/rooms/${room.value.code}/questions/${questionId}`,
		{
			method: 'PATCH',
			body: JSON.stringify({ verdict }),
		},
	)
}

async function updateQuestionScoring(
	question: Question,
	patch: Partial<
		Pick<
			Question,
			| 'quality'
			| 'truthGuess'
			| 'firstCoreClue'
			| 'firstMainLogic'
			| 'firstFullSolve'
		>
	>,
) {
	if (!canHost.value || !room.value) return
	room.value = await request<RoomState>(
		`/rooms/${room.value.code}/questions/${question.id}`,
		{
			method: 'PATCH',
			body: JSON.stringify(patch),
		},
	)
}

async function toggleImportant(question: Question) {
	if (!canHost.value || !room.value) return
	room.value = await request<RoomState>(
		`/rooms/${room.value.code}/questions/${question.id}`,
		{
			method: 'PATCH',
			body: JSON.stringify({ important: !question.important }),
		},
	)
}

function openMemberImportant(member: MemberStats) {
	selectedMember.value = member
	memberDialogOpen.value = true
}

async function revealAnswer() {
	if (!canHost.value || !room.value) return
	settlement.value = await request<Settlement>(
		`/rooms/${room.value.code}/reveal`,
		{
			method: 'POST',
		},
	)
	settlementDialogOpen.value = true
	await joinRoom(room.value.code, false)
}

async function uploadAvatar(file: File) {
	const dataUrl = await fileToDataUrl(file)
	user.value = await request<AuthUser>('/auth/me', {
		method: 'PATCH',
		body: JSON.stringify({ avatarDataUrl: dataUrl }),
	})
	if (room.value) {
		joinSocketRoom(room.value.code)
		await joinRoom(room.value.code, false)
	}
	ElMessage.success('头像已更新')
}

function beforeAvatarUpload(file: File) {
	if (!file.type.startsWith('image/')) {
		ElMessage.warning('请选择图片文件')
		return false
	}
	if (file.size > 800 * 1024) {
		ElMessage.warning('图片请控制在 800KB 以内')
		return false
	}
	void uploadAvatar(file)
	return false
}

function fileToDataUrl(file: File) {
	return new Promise<string>((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = () => resolve(String(reader.result))
		reader.onerror = () => reject(reader.error)
		reader.readAsDataURL(file)
	})
}

async function removeQuestion(questionId: string) {
	if (!canHost.value || !room.value) return
	room.value = await request<RoomState>(
		`/rooms/${room.value.code}/questions/${questionId}`,
		{
			method: 'DELETE',
		},
	)
}

async function resetRoom() {
	if (!room.value) return
	clearCanvas(false)
	await saveRoom()
	ElMessage.success('画板已清空；问题可逐条删除')
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
	queueCanvasPreview()
}

function stopDrawing(event?: PointerEvent) {
	if (!isDrawing.value) return
	isDrawing.value = false
	lastPoint.value = null
	if (event) canvasRef.value?.releasePointerCapture(event.pointerId)
	saveCanvas(true)
}

function queueCanvasPreview() {
	window.clearTimeout(canvasPreviewTimer)
	canvasPreviewTimer = window.setTimeout(() => emitCanvasPreview(), 60)
}

function emitCanvasPreview() {
	const canvas = canvasRef.value
	if (!canvas || !room.value) return
	room.value.canvasDataUrl = canvas.toDataURL('image/png')
	socket?.emit('canvas-preview', {
		roomCode: room.value.code,
		canvasDataUrl: room.value.canvasDataUrl,
	})
}

function saveCanvas(immediate = false) {
	emitCanvasPreview()
	if (immediate) {
		window.clearTimeout(roomSaveTimer)
		void saveRoom()
	} else {
		queueRoomSave()
	}
}

function clearCanvas(showMessage = true) {
	const canvas = canvasRef.value
	const context = canvas?.getContext('2d')
	if (!canvas || !context || !room.value) return
	context.clearRect(0, 0, canvas.width, canvas.height)
	room.value.canvasDataUrl = ''
	socket?.emit('canvas-preview', {
		roomCode: room.value.code,
		canvasDataUrl: '',
	})
	void saveRoom()
	if (showMessage) ElMessage.success('画板已清空')
}

function resizeCanvas() {
	const canvas = canvasRef.value
	const wrap = canvasWrapRef.value
	if (!canvas || !wrap) return
	const previous = room.value?.canvasDataUrl || canvas.toDataURL('image/png')
	const ratio = window.devicePixelRatio || 1
	const rect = wrap.getBoundingClientRect()
	canvas.width = Math.max(320, Math.floor(rect.width * ratio))
	canvas.height = Math.max(240, Math.floor(rect.height * ratio))
	restoreCanvas(previous)
}

function restoreCanvas(dataUrl = room.value?.canvasDataUrl) {
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

function formatTime(time: string) {
	return new Intl.DateTimeFormat('zh-CN', {
		hour: '2-digit',
		minute: '2-digit',
	}).format(new Date(time))
}
</script>

<template>
	<el-config-provider>
		<main class="app-shell">
			<header class="app-header">
				<div class="brand-block">
					<p class="eyebrow">Turtle Soup Online</p>
					<h1>海龟汤在线联机</h1>
				</div>
				<div class="header-actions">
					<el-button :icon="Share" :disabled="!room" @click="copyShareUrl">邀请</el-button>
					<el-button :icon="isDark ? Sunny : Moon" circle @click="isDark = !isDark" />
				</div>
			</header>

			<section class="user-strip surface-card">
				<div v-if="user" class="current-user">
					<el-upload :show-file-list="false" :before-upload="beforeAvatarUpload" accept="image/*">
						<el-avatar :size="46" :src="user.avatarDataUrl">{{ user.displayName.slice(0, 1) }}</el-avatar>
					</el-upload>
					<div class="user-copy"><strong>{{ user.displayName }}</strong><span>@{{ user.username }} · {{ user.rankTitle }} · {{ user.points }} 分</span></div>
					<el-button text type="danger" @click="logout()">退出</el-button>
				</div>
				<el-form v-else class="auth-inline" inline @submit.prevent>
					<el-segmented v-model="authMode" :options="[{ label: '登录', value: 'login' }, { label: '注册', value: 'register' }]" />
					<el-input v-model="authForm.username" placeholder="用户名" maxlength="24" />
					<el-input v-if="authMode === 'register'" v-model="authForm.displayName" placeholder="昵称" maxlength="24" />
					<el-input v-model="authForm.password" type="password" placeholder="密码" maxlength="40" show-password />
					<el-button type="primary" :icon="Check" @click="submitAuth">{{ authMode === 'register' ? '注册' : '登录' }}</el-button>
				</el-form>
				<div class="room-metrics"><div><b>{{ room?.questions.length ?? 0 }}</b><span>提问</span></div><div><b>{{ pendingQuestions }}</b><span>待判定</span></div><div><b>{{ answeredQuestions }}</b><span>已回答</span></div><div><b>{{ memberStats.filter(member => member.online).length }}</b><span>在线</span></div></div>
				<div class="member-strip">
					<button v-for="member in memberStats.slice(0, 8)" :key="member.userId" :class="['strip-member', { offline: !member.online }]" type="button" @click="openMemberImportant(member)"><el-avatar :size="30" :src="member.avatarDataUrl">{{ member.displayName.slice(0, 1) }}</el-avatar><span>{{ member.displayName }}</span></button>
				</div>
			</section>

			<section class="desk-grid">
				<aside class="story-column">
					<section class="surface-card story-card">
						<div class="section-head"><div><p class="eyebrow">汤面</p><el-input v-if="canHost && room" v-model="room.title" class="title-input" @input="queueRoomSave" /><h2 v-else>{{ room?.title ?? '请选择汤面并创建或加入房间' }}</h2></div><el-tag :type="canHost ? 'success' : 'info'" effect="dark">{{ canHost ? '主持人' : '玩家' }}</el-tag></div>
						<el-input v-if="canHost && room" v-model="room.surface" type="textarea" :autosize="{ minRows: 7, maxRows: 12 }" placeholder="写下可公开给玩家的汤面" @input="queueRoomSave" />
						<p v-else class="surface-text">{{ room?.surface ?? '还没有进入房间。登录后可创建房间，或用房间号加入。' }}</p>
					</section>
					<section class="surface-card clue-card"><div class="section-head compact"><div class="title-with-icon"><Flag /><strong>重要线索</strong></div><el-tag round effect="dark" type="warning">{{ importantQuestions.length }}</el-tag></div><el-empty v-if="!importantQuestions.length" description="主持人还没有标记重要内容" /><div v-else class="clue-list"><article v-for="question in importantQuestions" :key="question.id" class="clue-item"><div class="question-meta"><span>{{ question.author.displayName }}</span><time>{{ formatTime(question.createdAt) }}</time></div><p>{{ question.text }}</p><el-tag v-if="question.verdict" :type="verdictTypes[question.verdict]" effect="plain" round>{{ verdictLabels[question.verdict] }}</el-tag></article></div></section>
				</aside>

				<section class="surface-card qa-column">
					<div class="section-head"><div class="title-with-icon"><EditPen /><strong>实时问答</strong></div><span class="subtle">{{ onlineHint }}</span></div>
					<div class="ask-row"><el-input v-model="questionText" size="large" placeholder="输入问题，例如：这个人认识厨师吗？" :disabled="!user || !room" @keyup.enter="addQuestion" /><el-button type="primary" size="large" :icon="Right" :disabled="!user || !room" @click="addQuestion">发送</el-button></div>
					<div class="timeline"><el-empty v-if="!sortedQuestions.length" description="还没有问题，开汤吧。" /><article v-for="question in sortedQuestions" :key="question.id" class="question-item"><div class="question-main"><div class="question-meta"><span>{{ question.author.displayName }}</span><time>{{ formatTime(question.createdAt) }}</time></div><p>{{ question.text }}</p></div><div class="verdict-zone"><div class="tag-line"><el-tag v-if="question.important" type="warning" effect="dark" round>重要</el-tag><el-tag v-if="question.verdict" :type="verdictTypes[question.verdict]" effect="dark" round>{{ verdictLabels[question.verdict] }}</el-tag><span v-if="!question.verdict" class="waiting">等待主持人</span></div><div v-if="canHost" class="verdict-buttons"><el-tooltip :content="question.important ? '取消重要' : '标记重要'"><el-button size="small" :type="question.important ? 'warning' : 'default'" :icon="Flag" circle @click="toggleImportant(question)" /></el-tooltip><el-button size="small" type="success" @click="setVerdict(question.id, 'yes')">是</el-button><el-button size="small" type="danger" @click="setVerdict(question.id, 'no')">不是</el-button><el-button size="small" type="warning" @click="setVerdict(question.id, 'both')">是也不是</el-button><el-button size="small" type="info" @click="setVerdict(question.id, 'irrelevant')">不重要</el-button><el-button size="small" :icon="Delete" circle @click="removeQuestion(question.id)" /></div><div v-if="canHost" class="score-controls"><el-select :model-value="question.quality" size="small" @change="(value: QuestionQuality) => updateQuestionScoring(question, { quality: value })"><el-option v-for="(label, value) in qualityLabels" :key="value" :label="label" :value="value" /></el-select><el-select :model-value="question.truthGuess" size="small" @change="(value: TruthGuess) => updateQuestionScoring(question, { truthGuess: value })"><el-option v-for="(label, value) in truthGuessLabels" :key="value" :label="label" :value="value" /></el-select><el-checkbox :model-value="question.firstCoreClue" @change="(value: boolean) => updateQuestionScoring(question, { firstCoreClue: value })">首核</el-checkbox><el-checkbox :model-value="question.firstMainLogic" @change="(value: boolean) => updateQuestionScoring(question, { firstMainLogic: value })">首逻辑</el-checkbox><el-checkbox :model-value="question.firstFullSolve" @change="(value: boolean) => updateQuestionScoring(question, { firstFullSolve: value })">首破</el-checkbox></div></div></article></div>
				</section>

				<aside class="control-column">
					<section class="surface-card config-card"><div class="section-head compact"><div class="title-with-icon"><House /><strong>房间配置</strong></div></div><div class="config-stack"><label>选择汤面</label><el-select v-model="selectedSoupId" filterable placeholder="选择汤面"><el-option v-for="soup in soups" :key="soup.id" :label="soup.title" :value="soup.id"><span>{{ soup.title }}</span><small>{{ soup.isBuiltin ? '内置' : '自建' }} · {{ difficultyLabels[soup.difficulty] }}</small></el-option></el-select><p v-if="selectedSoup" class="soup-preview">{{ selectedSoup.surface }}</p><div class="config-actions"><el-button :icon="Plus" :disabled="!user" @click="customSoupOpen = true">自建汤面</el-button><el-button type="primary" :icon="Plus" :disabled="!user" @click="createRoom">创建房间</el-button></div><label>加入房间</label><div class="room-row"><el-input v-model="roomCodeInput" placeholder="输入房间号" @keyup.enter="joinRoom()" /><el-button :icon="Right" @click="joinRoom()" /></div><el-button text :icon="CopyDocument" :disabled="!room" @click="copyShareUrl">复制邀请链接</el-button></div></section>
					<section class="surface-card members-card"><div class="section-head compact"><div class="title-with-icon"><User /><strong>房间用户({{ memberStats.length || 0 }})</strong></div></div><el-empty v-if="!memberStats.length" description="暂无用户" :image-size="58" /><div v-else class="member-list"><button v-for="member in memberStats" :key="member.userId" :class="['member-row', { offline: !member.online }]" type="button" @click="openMemberImportant(member)"><el-avatar :size="34" :src="member.avatarDataUrl">{{ member.displayName.slice(0, 1) }}</el-avatar><span class="member-name">{{ member.displayName }}<span class="member-badges"><em v-if="room?.host.id === member.userId">主持人</em><i :class="member.online ? 'online' : 'offline'">{{ member.online ? '在线' : '离线' }}</i></span></span><span class="member-counts"><b>{{ member.questionCount }}</b>问 <b class="important-number">{{ member.importantCount }}</b>重要</span></button></div><div v-if="presenceEvents.length" class="presence-feed"><div v-for="event in presenceEvents" :key="event.at + '-' + event.user.userId" :class="['presence-line', event.type]"><span /><p>{{ event.message }}</p></div></div></section>
					<section class="surface-card rank-card"><div class="section-head compact"><div class="title-with-icon"><Flag /><strong>实时积分排行</strong></div></div><el-empty v-if="!liveLeaderboard.length" description="暂无排行" :image-size="56" /><div v-else class="mini-rank-list"><div v-for="entry in liveLeaderboard.slice(0, 6)" :key="entry.user.id" class="mini-rank-row"><strong>#{{ entry.rank }}</strong><el-avatar :size="30" :src="entry.user.avatarDataUrl">{{ entry.user.displayName.slice(0, 1) }}</el-avatar><span>{{ entry.user.displayName }}</span><b>{{ entry.total }}</b></div></div></section>
					<section class="surface-card tools-card"><el-tabs v-model="activePanel" stretch><el-tab-pane name="answer"><template #label><span class="tab-label"><Hide />汤底</span></template><div class="answer-tools"><el-switch v-model="answerHidden" active-text="隐藏" inactive-text="显示" inline-prompt /><el-button v-if="canHost" text type="danger" :icon="Refresh" :loading="savingRoom" @click="resetRoom">清空画板</el-button></div><el-button v-if="canHost && room" type="warning" class="wide-button reveal-button" :disabled="room.revealed" @click="revealAnswer">{{ room.revealed ? '已揭秘' : '揭秘汤底并结算积分' }}</el-button><el-input v-if="canHost && room" v-model="room.answer" type="textarea" :autosize="{ minRows: 8, maxRows: 14 }" placeholder="只有主持人需要知道的汤底" @input="queueRoomSave" /><div v-else-if="answerHidden" class="hidden-answer"><CircleClose /><span>汤底已隐藏</span></div><p v-else class="answer-text">{{ room?.answer ?? '暂无汤底' }}</p></el-tab-pane><el-tab-pane name="canvas"><template #label><span class="tab-label"><Brush />画板</span></template><div class="brush-toolbar"><el-color-picker v-model="brushColor" :disabled="!canHost" /><el-slider v-model="brushSize" :min="2" :max="22" :disabled="!canHost" /><el-tooltip content="清空画板"><el-button :icon="Delete" circle :disabled="!canHost" @click="clearCanvas()" /></el-tooltip></div><div ref="canvasWrapRef" class="canvas-wrap"><canvas ref="canvasRef" :class="{ readonly: !canHost }" @pointerdown="startDrawing" @pointermove="draw" @pointerup="stopDrawing" @pointercancel="stopDrawing" @pointerleave="stopDrawing" /></div></el-tab-pane></el-tabs></section>
				</aside>
			</section>

			<el-dialog v-model="customSoupOpen" title="自建汤面" width="min(720px, 92vw)"><el-form label-position="top"><el-form-item label="标题"><el-input v-model="customSoup.title" /></el-form-item><el-form-item label="汤面"><el-input v-model="customSoup.surface" type="textarea" :autosize="{ minRows: 4 }" /></el-form-item><el-form-item label="汤底"><el-input v-model="customSoup.answer" type="textarea" :autosize="{ minRows: 5 }" /></el-form-item><div class="dialog-grid"><el-form-item label="分类"><el-input v-model="customSoup.category" /></el-form-item><el-form-item label="难度"><el-select v-model="customSoup.difficulty"><el-option label="入门" value="easy" /><el-option label="标准" value="medium" /><el-option label="困难" value="hard" /></el-select></el-form-item></div></el-form><template #footer><el-button @click="customSoupOpen = false">取消</el-button><el-button type="primary" @click="createCustomSoup">保存汤面</el-button></template></el-dialog>
			<el-dialog v-model="memberDialogOpen" :title="(selectedMember?.displayName ?? '') + ' 的重要内容'" width="min(680px, 92vw)"><el-empty v-if="!selectedMember?.importantQuestions.length" description="这个用户暂无重要内容" /><div v-else class="member-clues"><div v-for="question in selectedMember.importantQuestions" :key="question.id" class="clue-item"><div class="question-meta"><span>{{ selectedMember.displayName }}</span><time>{{ formatTime(question.createdAt) }}</time></div><p>{{ question.text }}</p><el-tag v-if="question.verdict" :type="verdictTypes[question.verdict]" effect="plain" round>{{ verdictLabels[question.verdict] }}</el-tag></div></div></el-dialog>
			<el-dialog v-model="settlementDialogOpen" title="本局积分排行榜" width="min(820px, 94vw)"><div v-if="settlement" class="settlement-board"><div class="answer-reveal"><span>汤底</span><p>{{ settlement.answer }}</p></div><div class="rank-list"><div v-for="entry in settlement.entries" :key="entry.user.id" class="rank-row"><strong class="rank-number">#{{ entry.rank }}</strong><el-avatar :size="42" :src="entry.user.avatarDataUrl">{{ entry.user.displayName.slice(0, 1) }}</el-avatar><div class="rank-user"><b>{{ entry.user.displayName }}</b><span>{{ entry.user.rankTitle }} · 累计 {{ entry.user.points }} 分</span></div><strong class="rank-score">+{{ entry.total }}</strong><div class="rank-breakdown"><el-tag v-for="(points, label) in entry.breakdown" :key="label" effect="plain" round>{{ label }} +{{ points }}</el-tag></div></div></div></div></el-dialog>
		</main>
	</el-config-provider>
</template>
