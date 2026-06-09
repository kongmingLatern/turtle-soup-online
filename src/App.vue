<script setup lang="ts">
import {
	Brush,
	Check,
	CircleClose,
	CopyDocument,
	Delete,
	EditPen,
	Flag,
	Headset,
	Hide,
	House,
	Moon,
	Picture,
	Plus,
	Refresh,
	Right,
	Setting,
	Share,
	Sunny,
	User,
	VideoPause,
	VideoPlay,
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
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
type AmbiencePresetId = 'light' | 'mist' | 'archive' | 'noir'

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

interface RoomAmbience {
	backgroundImageDataUrl: string
	backgroundPreset: AmbiencePresetId
	musicDataUrl: string
	musicName: string
	musicVolume: number
}

interface AmbiencePreset {
	id: AmbiencePresetId
	label: string
	tone: string
	background: string
}

interface RoomState {
	id: string
	code: string
	title: string
	surface: string
	answer: string
	canvasDataUrl: string
	ambience?: Partial<RoomAmbience> | null
	backgroundImageDataUrl?: string
	musicDataUrl?: string
	musicName?: string
	musicVolume?: number
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
	type: 'join' | 'leave' | 'system'
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

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'
const STORAGE_TOKEN = 'turtle-soup:token'
const STORAGE_THEME = 'turtle-soup:theme'
const STORAGE_AMBIENCE_PREFIX = 'turtle-soup:ambience:'
const STORAGE_USE_HOST_BACKGROUND_PREFIX = 'turtle-soup:host-background:'
const MAX_BACKGROUND_BYTES = 5 * 1024 * 1024
const MAX_MUSIC_BYTES = 12 * 1024 * 1024
const DEFAULT_AMBIENCE: RoomAmbience = {
	backgroundImageDataUrl: '',
	backgroundPreset: 'light',
	musicDataUrl: '',
	musicName: '',
	musicVolume: 56,
}
const AMBIENCE_PRESETS: AmbiencePreset[] = [
	{
		id: 'light',
		label: '旧卷',
		tone: '青灰茶墨',
		background:
			'radial-gradient(circle at 16% 10%, rgba(92, 119, 94, 0.28), transparent 28rem), radial-gradient(circle at 88% 14%, rgba(146, 96, 35, 0.2), transparent 26rem), radial-gradient(circle at 42% 92%, rgba(57, 77, 70, 0.18), transparent 30rem), linear-gradient(135deg, #ded3bb, #cfd8c8 46%, #e8dfca)',
	},
	{
		id: 'mist',
		label: '雾夜',
		tone: '冷雾微光',
		background:
			'radial-gradient(circle at 18% 18%, rgba(20, 184, 166, 0.34), transparent 28rem), radial-gradient(circle at 82% 0%, rgba(99, 102, 241, 0.24), transparent 30rem), linear-gradient(135deg, #071312, #172033 52%, #0a0d13)',
	},
	{
		id: 'archive',
		label: '档案室',
		tone: '暖灯纸页',
		background:
			'radial-gradient(circle at 16% 12%, rgba(245, 158, 11, 0.26), transparent 24rem), radial-gradient(circle at 88% 16%, rgba(20, 184, 166, 0.18), transparent 26rem), linear-gradient(135deg, #16120d, #2d261c 46%, #0c1116)',
	},
	{
		id: 'noir',
		label: '暗潮',
		tone: '深海压迫',
		background:
			'radial-gradient(circle at 50% -10%, rgba(45, 212, 191, 0.2), transparent 26rem), radial-gradient(circle at 85% 72%, rgba(15, 23, 42, 0.82), transparent 30rem), linear-gradient(145deg, #030712, #0f172a 48%, #071b1c)',
	},
]

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
const authFormRef = ref<FormInstance>()
const customSoupFormRef = ref<FormInstance>()
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
const selectedQuestionId = ref('')
const shareUrl = ref(window.location.href)
const answerHidden = ref(true)
const activePanel = ref<'host' | 'player' | 'answer' | 'canvas'>('answer')
const toolDockOpen = ref(false)
const audioRef = ref<HTMLAudioElement | null>(null)
const ambienceDraft = reactive<RoomAmbience>({ ...DEFAULT_AMBIENCE })
const ambienceVolume = ref(DEFAULT_AMBIENCE.musicVolume)
const useHostBackground = ref(true)
const useRoomMusic = ref(false)
const musicPlaying = ref(false)
const brushColor = ref('#14b8a6')
const brushSize = ref(6)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const canvasWrapRef = ref<HTMLElement | null>(null)
const isDrawing = ref(false)
const lastPoint = ref<{ x: number; y: number } | null>(null)
const authSubmitting = ref(false)
const creatingSoup = ref(false)
const sendingQuestion = ref(false)
const deletingSoupId = ref('')
const savingRoom = ref(false)
const socketStatus = ref('未连接')
const roomMembers = ref<RoomMember[]>([])
const presenceEvents = ref<PresenceEvent[]>([])
const memberDialogOpen = ref(false)
const selectedMember = ref<MemberStats | null>(null)
const settlementDialogOpen = ref(false)
const settlement = ref<Settlement | null>(null)
const customSoupOpen = ref(false)
const soupManagerOpen = ref(false)
const editingSoupId = ref('')
const isMobile = ref(false)
const ambienceServerUnsupported = ref(false)
const ambiencePersistWarned = ref(false)
const customSoup = reactive({
	title: '',
	surface: '',
	answer: '',
	category: '自建',
	difficulty: 'medium' as Difficulty,
})
const authRules = computed<FormRules<typeof authForm>>(() => ({
	displayName:
		authMode.value === 'register'
			? [
					{ required: true, message: '请输入昵称', trigger: 'blur' },
					{
						min: 1,
						max: 24,
						message: '昵称长度为 1-24 个字符',
						trigger: 'blur',
					},
				]
			: [],
	username: [
		{ required: true, message: '请输入用户名', trigger: 'blur' },
		{ min: 3, max: 24, message: '用户名长度为 3-24 个字符', trigger: 'blur' },
		{
			pattern: /^[a-zA-Z0-9_\u4e00-\u9fa5]+$/,
			message: '用户名只能包含中文、字母、数字或下划线',
			trigger: 'blur',
		},
	],
	password: [
		{ required: true, message: '请输入密码', trigger: 'blur' },
		{ min: 4, max: 40, message: '密码长度为 4-40 个字符', trigger: 'blur' },
	],
}))
const customSoupRules: FormRules<typeof customSoup> = {
	title: [
		{ required: true, message: '请输入标题', trigger: 'blur' },
		{ min: 2, max: 60, message: '标题长度为 2-60 个字符', trigger: 'blur' },
	],
	surface: [
		{ required: true, message: '请输入汤面', trigger: 'blur' },
		{ min: 8, max: 2000, message: '汤面长度为 8-2000 个字符', trigger: 'blur' },
	],
	answer: [
		{ required: true, message: '请输入汤底', trigger: 'blur' },
		{ min: 8, max: 4000, message: '汤底长度为 8-4000 个字符', trigger: 'blur' },
	],
	category: [
		{ required: true, message: '请输入分类', trigger: 'blur' },
		{ min: 1, max: 20, message: '分类长度为 1-20 个字符', trigger: 'blur' },
	],
	difficulty: [{ required: true, message: '请选择难度', trigger: 'change' }],
}
let socket: Socket | null = null
let canvasSaveTimer: number | undefined
let canvasPreviewTimer: number | undefined
let roomSaveTimer: number | undefined
let syncingAmbience = false
let ambienceDirty = false
const presenceNotifyAt = new Map<string, number>()
const roomAmbienceCache = new Map<string, RoomAmbience>()

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
	if (room.value)
		upsertMember(room.value.host, onlineIds.has(room.value.host.id))
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
	return [...byId.values()].sort(
		(a, b) =>
			Number(b.online) - Number(a.online) || b.questionCount - a.questionCount,
	)
})
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
const activeBackgroundImage = computed(
	() => ambienceDraft.backgroundImageDataUrl,
)
const activeAmbiencePreset = computed(
	() =>
		AMBIENCE_PRESETS.find(
			preset => preset.id === ambienceDraft.backgroundPreset,
		) ?? AMBIENCE_PRESETS[0],
)
const activeBackdropCss = computed(() =>
	useHostBackground.value
		? activeBackgroundImage.value
			? cssUrl(activeBackgroundImage.value)
			: activeAmbiencePreset.value.background
		: '',
)
const hostBackdropCss = computed(() =>
	activeBackgroundImage.value
		? cssUrl(activeBackgroundImage.value)
		: activeAmbiencePreset.value.background,
)
const activeBackgroundLabel = computed(() =>
	activeBackgroundImage.value ? '自定义背景' : activeAmbiencePreset.value.label,
)
const roomMusicDataUrl = computed(() => ambienceDraft.musicDataUrl)
const roomMusicName = computed(() => ambienceDraft.musicName || '房间音乐')
const activeMusicDataUrl = computed(() =>
	useRoomMusic.value ? roomMusicDataUrl.value : '',
)
const hasCustomAmbience = computed(() =>
	Boolean(activeBackgroundImage.value || roomMusicDataUrl.value),
)
const roomBackdropStyle = computed(() =>
	activeBackdropCss.value
		? { '--room-backdrop-image': activeBackdropCss.value }
		: {},
)
const ambiencePreviewStyle = computed(() =>
	hostBackdropCss.value
		? { '--room-backdrop-image': hostBackdropCss.value }
		: {},
)
// const selectedSoupSummary = computed(() =>
// 	soups.value.find(soup => soup.id === selectedSoupId.value),
// )
const soupDrawerDirection = computed(() => (isMobile.value ? 'btt' : 'rtl'))

watch(
	isDark,
	value => {
		document.documentElement.classList.toggle('dark', value)
		localStorage.setItem(STORAGE_THEME, value ? 'dark' : 'light')
	},
	{ immediate: true },
)

watch(canHost, value => {
	selectedRole.value = value ? 'host' : 'player'
	if (!value && activePanel.value !== 'canvas') {
		toolDockOpen.value = false
		activePanel.value = 'canvas'
		answerHidden.value = true
	}
})

watch(ambienceVolume, value => {
	const nextVolume = clampVolume(value)
	if (audioRef.value) audioRef.value.volume = nextVolume / 100
	if (ambienceDraft.musicVolume === nextVolume) return
	ambienceDraft.musicVolume = nextVolume
	if (!room.value) return
	room.value.ambience = { ...ambienceDraft }
	rememberRoomAmbience(room.value.code, ambienceDraft)
	if (canHost.value && !syncingAmbience) {
		ambienceDirty = true
		queueRoomSave()
	}
})

watch(activeMusicDataUrl, () => {
	musicPlaying.value = false
	nextTick(() => {
		if (!audioRef.value) return
		audioRef.value.load()
		audioRef.value.volume = ambienceVolume.value / 100
	})
})

watch(useRoomMusic, value => {
	if (!value) audioRef.value?.pause()
})

watch(useHostBackground, value => {
	if (!room.value) return
	localStorage.setItem(
		STORAGE_USE_HOST_BACKGROUND_PREFIX + room.value.code,
		value ? '1' : '0',
	)
})

watch(authMode, () => {
	authFormRef.value?.clearValidate()
})

onMounted(async () => {
	updateViewportState()
	window.addEventListener('resize', resizeCanvas)
	window.addEventListener('resize', updateViewportState)
	window.addEventListener('beforeunload', handleBeforeUnload)
	await restoreSession()
	if (user.value) await loadSoups()
	if (roomCodeInput.value) {
		await joinRoom(roomCodeInput.value, false)
	}
})

onBeforeUnmount(() => {
	window.clearTimeout(canvasSaveTimer)
	window.clearTimeout(canvasPreviewTimer)
	window.clearTimeout(roomSaveTimer)
	window.removeEventListener('resize', resizeCanvas)
	window.removeEventListener('resize', updateViewportState)
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

function updateViewportState() {
	isMobile.value = window.matchMedia('(max-width: 760px)').matches
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
	if (!authFormRef.value) return
	const valid = await authFormRef.value.validate().catch(() => false)
	if (!valid) return
	const payload =
		authMode.value === 'register'
			? {
					username: authForm.username,
					password: authForm.password,
					displayName: authForm.displayName || authForm.username,
				}
			: { username: authForm.username, password: authForm.password }
	authSubmitting.value = true
	try {
		const data = await request<AuthResponse>(`/auth/${authMode.value}`, {
			method: 'POST',
			body: JSON.stringify(payload),
		})
		token.value = data.token
		user.value = data.user
		localStorage.setItem(STORAGE_TOKEN, data.token)
		await loadSoups()
		if (room.value) {
			joinSocketRoom(room.value.code)
		}
		ElMessage.success(authMode.value === 'register' ? '注册成功' : '登录成功')
	} catch (error) {
		ElMessage.error(error instanceof Error ? error.message : '操作失败')
	} finally {
		authSubmitting.value = false
	}
}

function logout(showMessage = true) {
	leaveCurrentRoom()
	token.value = ''
	user.value = null
	soups.value = []
	selectedSoupId.value = ''
	localStorage.removeItem(STORAGE_TOKEN)
	socket?.disconnect()
	socket = null
	if (showMessage) ElMessage.success('已退出登录')
}

async function loadSoups() {
	if (!user.value) {
		soups.value = []
		selectedSoupId.value = ''
		return
	}
	soups.value = await request<Soup[]>('/soups')
	selectedSoupId.value = soups.value[0]?.id ?? ''
}

async function createCustomSoup() {
	if (!customSoupFormRef.value) return
	const valid = await customSoupFormRef.value.validate().catch(() => false)
	if (!valid) return
	creatingSoup.value = true
	const isEditing = Boolean(editingSoupId.value)
	try {
		const soup = await request<Soup>(
			isEditing ? `/soups/${editingSoupId.value}` : '/soups',
			{
				method: isEditing ? 'PATCH' : 'POST',
				body: JSON.stringify(customSoup),
			},
		)
		const index = soups.value.findIndex(item => item.id === soup.id)
		if (index >= 0) {
			soups.value.splice(index, 1, soup)
		} else {
			soups.value.unshift(soup)
		}
		selectedSoupId.value = soup.id
		resetCustomSoupForm()
		closeCustomSoupDialog()
		ElMessage.success(isEditing ? '汤面已更新' : '自建汤面已保存')
	} catch (error) {
		ElMessage.error(error instanceof Error ? error.message : '保存失败')
	} finally {
		creatingSoup.value = false
	}
}

function openCreateSoupDialog() {
	editingSoupId.value = ''
	resetCustomSoupForm()
	customSoupOpen.value = true
}

function openEditSoupDialog(soup: Soup) {
	editingSoupId.value = soup.id
	Object.assign(customSoup, {
		title: soup.title,
		surface: soup.surface,
		answer: soup.answer,
		category: soup.category || '自建',
		difficulty: soup.difficulty,
	})
	customSoupOpen.value = true
	nextTick(() => customSoupFormRef.value?.clearValidate())
}

function resetCustomSoupForm() {
	Object.assign(customSoup, {
		title: '',
		surface: '',
		answer: '',
		category: '自建',
		difficulty: 'medium',
	})
}

function closeCustomSoupDialog() {
	customSoupOpen.value = false
	editingSoupId.value = ''
	customSoupFormRef.value?.clearValidate()
}

async function deleteSoup(soup: Soup) {
	const confirmed = window.confirm(
		`确定删除「${soup.title}」吗？已创建的房间不会受影响，但它会从你的个人题库中移除。`,
	)
	if (!confirmed) return
	deletingSoupId.value = soup.id
	try {
		await request<{ deleted: boolean }>(`/soups/${soup.id}`, {
			method: 'DELETE',
		})
		soups.value = soups.value.filter(item => item.id !== soup.id)
		if (selectedSoupId.value === soup.id) {
			selectedSoupId.value = soups.value[0]?.id ?? ''
		}
		ElMessage.success('汤面已删除')
	} catch (error) {
		ElMessage.error(error instanceof Error ? error.message : '删除失败')
	} finally {
		deletingSoupId.value = ''
	}
}

async function createRoom() {
	if (!user.value) return ElMessage.warning('请先登录')
	if (!selectedSoupId.value)
		return ElMessage.warning('请先创建并选择自己的汤面')
	const data = await request<RoomState>('/rooms', {
		method: 'POST',
		body: JSON.stringify({ soupId: selectedSoupId.value || undefined }),
	})
	applyRoom(data)
	selectedRole.value = 'host'
	ElMessage.success(`房间 ${data.code} 已创建`)
}

async function switchRoomSoup() {
	if (!room.value) return createRoom()
	if (!canHost.value) return ElMessage.warning('只有主持人可以切换题目')
	if (!selectedSoupId.value) return ElMessage.warning('请先选择汤面')
	const confirmed = window.confirm(
		'切换海龟汤会清空当前房间的问答、重要线索、画板和结算记录，确定切换吗？',
	)
	if (!confirmed) return
	const data = await request<RoomState>(
		`/rooms/${room.value.code}/switch-soup`,
		{
			method: 'POST',
			body: JSON.stringify({ soupId: selectedSoupId.value }),
		},
	)
	applyRoom(data)
	resetRoundState(data)
	ElMessage.success('已切换海龟汤，本局记录已清空')
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
	useHostBackground.value =
		localStorage.getItem(STORAGE_USE_HOST_BACKGROUND_PREFIX + data.code) !== '0'
	syncAmbienceFromRoom(data)
	syncSelectedSoupFromRoom(data)
	updateShareUrl()
	connectSocket(data.code)
	nextTick(() => {
		resizeCanvas()
		restoreCanvas()
	})
}

function syncSelectedSoupFromRoom(data: RoomState) {
	const matched = soups.value.find(
		soup => soup.title === data.title && soup.surface === data.surface,
	)
	if (matched) selectedSoupId.value = matched.id
}

function resetRoundState(nextRoom?: RoomState) {
	if (nextRoom) room.value = nextRoom
	settlement.value = null
	settlementDialogOpen.value = false
	selectedQuestionId.value = ''
	answerHidden.value = true
	nextTick(() => restoreCanvas(''))
}

function normalizeAmbience(roomData: RoomState): RoomAmbience {
	const cached =
		roomAmbienceCache.get(roomData.code) ?? loadCachedAmbience(roomData.code)
	const source = {
		...(cached ?? {}),
		...(roomData.ambience ?? {}),
		backgroundImageDataUrl:
			roomData.backgroundImageDataUrl ??
			roomData.ambience?.backgroundImageDataUrl ??
			cached?.backgroundImageDataUrl,
		backgroundPreset:
			roomData.ambience?.backgroundPreset ?? cached?.backgroundPreset,
		musicDataUrl:
			roomData.musicDataUrl ??
			roomData.ambience?.musicDataUrl ??
			cached?.musicDataUrl,
		musicName:
			roomData.musicName ?? roomData.ambience?.musicName ?? cached?.musicName,
		musicVolume:
			roomData.musicVolume ??
			roomData.ambience?.musicVolume ??
			cached?.musicVolume,
	}
	return {
		backgroundImageDataUrl:
			source.backgroundImageDataUrl ?? DEFAULT_AMBIENCE.backgroundImageDataUrl,
		backgroundPreset: isAmbiencePresetId(source.backgroundPreset)
			? source.backgroundPreset
			: DEFAULT_AMBIENCE.backgroundPreset,
		musicDataUrl: source.musicDataUrl ?? DEFAULT_AMBIENCE.musicDataUrl,
		musicName: source.musicName ?? DEFAULT_AMBIENCE.musicName,
		musicVolume: clampVolume(
			source.musicVolume ?? DEFAULT_AMBIENCE.musicVolume,
		),
	}
}

function isAmbiencePresetId(value: unknown): value is AmbiencePresetId {
	return AMBIENCE_PRESETS.some(preset => preset.id === value)
}

function syncAmbienceFromRoom(roomData: RoomState) {
	syncingAmbience = true
	const nextAmbience = normalizeAmbience(roomData)
	Object.assign(ambienceDraft, nextAmbience)
	ambienceVolume.value = nextAmbience.musicVolume
	rememberRoomAmbience(roomData.code, nextAmbience)
	ambienceDirty = false
	nextTick(() => {
		if (audioRef.value) audioRef.value.volume = nextAmbience.musicVolume / 100
		syncingAmbience = false
	})
}

function rememberRoomAmbience(code: string, ambience: RoomAmbience) {
	roomAmbienceCache.set(code, { ...ambience })
	try {
		localStorage.setItem(
			STORAGE_AMBIENCE_PREFIX + code,
			JSON.stringify({ ...ambience, cachedAt: Date.now() }),
		)
	} catch {
		// Large uploaded audio can exceed browser storage quota; live preview still works.
	}
}

function loadCachedAmbience(code: string): RoomAmbience | undefined {
	const cached = localStorage.getItem(STORAGE_AMBIENCE_PREFIX + code)
	if (!cached) return undefined
	try {
		const parsed = JSON.parse(cached) as Partial<RoomAmbience>
		return {
			backgroundImageDataUrl:
				parsed.backgroundImageDataUrl ??
				DEFAULT_AMBIENCE.backgroundImageDataUrl,
			backgroundPreset: isAmbiencePresetId(parsed.backgroundPreset)
				? parsed.backgroundPreset
				: DEFAULT_AMBIENCE.backgroundPreset,
			musicDataUrl: parsed.musicDataUrl ?? DEFAULT_AMBIENCE.musicDataUrl,
			musicName: parsed.musicName ?? DEFAULT_AMBIENCE.musicName,
			musicVolume: clampVolume(
				parsed.musicVolume ?? DEFAULT_AMBIENCE.musicVolume,
			),
		}
	} catch {
		localStorage.removeItem(STORAGE_AMBIENCE_PREFIX + code)
		return undefined
	}
}

function clampVolume(value: number) {
	return Math.min(100, Math.max(0, Math.round(Number(value) || 0)))
}

function cssUrl(value: string) {
	return `url("${value.replace(/["\\]/g, '\\$&')}")`
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
			selectedRole.value = canHost.value ? 'host' : 'player'
			syncAmbienceFromRoom(nextRoom)
			syncSelectedSoupFromRoom(nextRoom)
			if (nextRoom.settlement) settlement.value = nextRoom.settlement
			nextTick(() => restoreCanvas())
		})
		socket.on(
			'room-reset',
			(event: { roomCode: string; message: string; at: string }) => {
				if (event.roomCode !== room.value?.code) return
				resetRoundState()
				const systemEvent: PresenceEvent = {
					type: 'system',
					user: {
						userId: 'system',
						username: 'system',
						displayName: '系统',
					},
					message: event.message,
					at: event.at,
				}
				presenceEvents.value = [systemEvent, ...presenceEvents.value].slice(
					0,
					5,
				)
				ElMessage.success(event.message)
			},
		)
		socket.on(
			'room-host-transferred',
			(event: { roomCode: string; message: string; at: string }) => {
				if (event.roomCode !== room.value?.code) return
				const systemEvent: PresenceEvent = {
					type: 'system',
					user: {
						userId: 'system',
						username: 'system',
						displayName: '系统',
					},
					message: event.message,
					at: event.at,
				}
				presenceEvents.value = [systemEvent, ...presenceEvents.value].slice(
					0,
					5,
				)
				ElMessage.success(event.message)
			},
		)
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
	if (
		navigator.clipboard &&
		typeof navigator.clipboard.writeText === 'function'
	) {
		await navigator.clipboard.writeText(shareUrl.value)
	} else {
		// fallback for older browsers or undefined clipboard
		const input = document.createElement('input')
		input.value = shareUrl.value
		document.body.appendChild(input)
		input.select()
		try {
			document.execCommand('copy')
		} finally {
			document.body.removeChild(input)
		}
	}
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
	const nextAmbience = { ...ambienceDraft, musicVolume: ambienceVolume.value }
	const basePayload = {
		title: room.value.title,
		surface: room.value.surface,
		answer: room.value.answer,
		canvasDataUrl: room.value.canvasDataUrl,
		solved: room.value.solved,
	}
	const ambiencePayload = {
		...basePayload,
		ambience: nextAmbience,
		backgroundImageDataUrl: nextAmbience.backgroundImageDataUrl,
		musicDataUrl: nextAmbience.musicDataUrl,
		musicName: nextAmbience.musicName,
		musicVolume: nextAmbience.musicVolume,
	}
	try {
		const data = await request<RoomState>(`/rooms/${room.value.code}`, {
			method: 'PATCH',
			body: JSON.stringify(
				ambienceDirty && !ambienceServerUnsupported.value
					? ambiencePayload
					: basePayload,
			),
		})
		rememberRoomAmbience(data.code, nextAmbience)
		room.value = data
		syncAmbienceFromRoom(data)
	} catch (error) {
		if (ambienceServerUnsupported.value || !room.value) throw error
		rememberRoomAmbience(room.value.code, nextAmbience)
		const data = await request<RoomState>(`/rooms/${room.value.code}`, {
			method: 'PATCH',
			body: JSON.stringify(basePayload),
		})
		ambienceServerUnsupported.value = true
		room.value = data
		syncAmbienceFromRoom(data)
		if (!ambiencePersistWarned.value) {
			ambiencePersistWarned.value = true
			ElMessage.warning('当前后端暂未保存沉浸设置，已保留本机预览')
		}
	} finally {
		savingRoom.value = false
	}
}

async function addQuestion() {
	const text = questionText.value.trim()
	if (!room.value) return ElMessage.warning('请先进入房间')
	if (!user.value) return ElMessage.warning('请先登录')
	if (!text) return ElMessage.warning('请输入问题')
	if (text.length > 500) return ElMessage.warning('问题不能超过 500 个字符')
	if (sendingQuestion.value) return
	sendingQuestion.value = true
	try {
		const data = await request<RoomState>(
			`/rooms/${room.value.code}/questions`,
			{
				method: 'POST',
				body: JSON.stringify({ text }),
			},
		)
		questionText.value = ''
		room.value = data
	} catch (error) {
		ElMessage.error(error instanceof Error ? error.message : '发送失败')
	} finally {
		sendingQuestion.value = false
	}
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

function canTransferHostTo(member: MemberStats) {
	return Boolean(
		canHost.value &&
		user.value &&
		room.value &&
		member.online &&
		member.userId !== user.value.id,
	)
}

async function transferHost(member: MemberStats) {
	if (!room.value || !canTransferHostTo(member)) return
	const confirmed = window.confirm(
		`确定将主持人权限交给 ${member.displayName} 吗？交接后你会变为普通用户。`,
	)
	if (!confirmed) return
	const data = await request<RoomState>(
		`/rooms/${room.value.code}/transfer-host`,
		{
			method: 'POST',
			body: JSON.stringify({ userId: member.userId }),
		},
	)
	room.value = data
	selectedRole.value = canHost.value ? 'host' : 'player'
	if (activePanel.value !== 'canvas') {
		toolDockOpen.value = false
		activePanel.value = 'canvas'
	}
	ElMessage.success(`已将主持人交给 ${member.displayName}`)
}

function openToolDock(panel: 'host' | 'player' | 'answer' | 'canvas') {
	if ((panel === 'host' || panel === 'answer') && !canHost.value)
		return ElMessage.warning('只有主持人可以使用这个面板')
	if (panel === 'player' && canHost.value)
		return ElMessage.warning('主持人请使用控制台')
	activePanel.value = panel
	toolDockOpen.value = true
	if (panel === 'canvas') {
		nextTick(() => {
			resizeCanvas()
			restoreCanvas()
		})
	}
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

function beforeBackgroundUpload(file: File) {
	if (!canHost.value) {
		ElMessage.warning('只有主持人可以更改房间背景')
		return false
	}
	if (!file.type.startsWith('image/')) {
		ElMessage.warning('请选择图片文件')
		return false
	}
	if (file.size > MAX_BACKGROUND_BYTES) {
		ElMessage.warning('背景图片请控制在 5MB 以内')
		return false
	}
	void applyBackgroundFile(file)
	return false
}

async function applyBackgroundFile(file: File) {
	const dataUrl = await fileToDataUrl(file)
	applyAmbiencePatch({ backgroundImageDataUrl: dataUrl })
	ElMessage.success('房间背景已更新')
}

function beforeMusicUpload(file: File) {
	if (!canHost.value) {
		ElMessage.warning('只有主持人可以更改背景音乐')
		return false
	}
	if (!file.type.startsWith('audio/')) {
		ElMessage.warning('请选择音频文件')
		return false
	}
	if (file.size > MAX_MUSIC_BYTES) {
		ElMessage.warning('背景音乐请控制在 12MB 以内')
		return false
	}
	void applyMusicFile(file)
	return false
}

async function applyMusicFile(file: File) {
	const dataUrl = await fileToDataUrl(file)
	applyAmbiencePatch({
		musicDataUrl: dataUrl,
		musicName: file.name.replace(/\.[^.]+$/, '') || '背景音乐',
	})
	ElMessage.success('房间背景音乐已载入')
}

function applyAmbiencePatch(patch: Partial<RoomAmbience>) {
	if (!canHost.value || !room.value) return
	const nextAmbience = {
		...ambienceDraft,
		...patch,
		musicVolume: clampVolume(patch.musicVolume ?? ambienceVolume.value),
	}
	Object.assign(ambienceDraft, nextAmbience)
	ambienceVolume.value = nextAmbience.musicVolume
	room.value.ambience = { ...nextAmbience }
	rememberRoomAmbience(room.value.code, nextAmbience)
	ambienceDirty = true
	queueRoomSave()
}

function chooseAmbiencePreset(presetId: AmbiencePresetId) {
	if (!canHost.value) return
	applyAmbiencePatch({
		backgroundPreset: presetId,
		backgroundImageDataUrl: '',
	})
	ElMessage.success('房间氛围已切换')
}

async function toggleMusicPlayback() {
	if (!roomMusicDataUrl.value || !audioRef.value) {
		return ElMessage.warning('等待主持人上传房间音乐')
	}
	if (!useRoomMusic.value) {
		useRoomMusic.value = true
	}
	if (musicPlaying.value) {
		audioRef.value.pause()
		return
	}
	try {
		audioRef.value.volume = ambienceVolume.value / 100
		await audioRef.value.play()
	} catch {
		ElMessage.warning('浏览器需要你点击页面后才能播放音乐')
	}
}

function clearBackgroundImage() {
	if (!canHost.value) return
	applyAmbiencePatch({ backgroundImageDataUrl: '' })
	ElMessage.success('已恢复为预设背景')
}

function clearMusic() {
	if (!canHost.value) return
	audioRef.value?.pause()
	useRoomMusic.value = false
	applyAmbiencePatch({ musicDataUrl: '', musicName: '' })
	ElMessage.success('房间背景音乐已移除')
}

function resetAmbience() {
	if (!canHost.value) return
	audioRef.value?.pause()
	useRoomMusic.value = false
	Object.assign(ambienceDraft, DEFAULT_AMBIENCE)
	ambienceVolume.value = DEFAULT_AMBIENCE.musicVolume
	if (room.value) {
		room.value.ambience = { ...DEFAULT_AMBIENCE }
		rememberRoomAmbience(room.value.code, DEFAULT_AMBIENCE)
		ambienceDirty = true
		queueRoomSave()
	}
	ElMessage.success('沉浸设置已重置')
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
		<main
			:class="['app-shell', { 'has-room-backdrop': room }]"
			:style="roomBackdropStyle"
		>
			<div class="room-backdrop" />
			<audio
				ref="audioRef"
				:src="activeMusicDataUrl"
				loop
				@play="musicPlaying = true"
				@pause="musicPlaying = false"
				@ended="musicPlaying = false"
			/>
			<header class="app-header">
				<div class="brand-block">
					<p class="eyebrow">Turtle Soup Online</p>
					<h1>海龟汤在线联机</h1>
				</div>
				<div class="header-actions">
					<el-button :icon="Share" :disabled="!room" @click="copyShareUrl"
						>邀请</el-button
					>
					<el-button
						:icon="isDark ? Sunny : Moon"
						circle
						@click="isDark = !isDark"
					/>
				</div>
			</header>

			<section class="user-strip surface-card">
				<div v-if="user" class="current-user">
					<el-upload
						:show-file-list="false"
						:before-upload="beforeAvatarUpload"
						accept="image/*"
					>
						<el-avatar :size="46" :src="user.avatarDataUrl">{{
							user.displayName.slice(0, 1)
						}}</el-avatar>
					</el-upload>
					<div class="user-copy">
						<strong>{{ user.displayName }}</strong
						><span
							>@{{ user.username }} · {{ user.rankTitle }} ·
							{{ user.points }} 分</span
						>
					</div>
					<el-button text type="danger" @click="logout()">退出</el-button>
				</div>
				<el-form
					v-else
					ref="authFormRef"
					:model="authForm"
					:rules="authRules"
					class="auth-inline"
					inline
					@submit.prevent
				>
					<el-segmented
						v-model="authMode"
						:options="[
							{ label: '登录', value: 'login' },
							{ label: '注册', value: 'register' },
						]"
					/>
					<el-form-item v-if="authMode === 'register'" prop="displayName"
						><el-input
							v-model="authForm.displayName"
							placeholder="昵称"
							maxlength="24"
					/></el-form-item>
					<el-form-item prop="username"
						><el-input
							v-model="authForm.username"
							placeholder="用户名"
							maxlength="24"
					/></el-form-item>
					<el-form-item prop="password"
						><el-input
							v-model="authForm.password"
							type="password"
							placeholder="密码"
							maxlength="40"
							show-password
							@keyup.enter="submitAuth"
					/></el-form-item>
					<el-button
						type="primary"
						:icon="Check"
						:loading="authSubmitting"
						@click="submitAuth"
						>{{ authMode === 'register' ? '注册' : '登录' }}</el-button
					>
				</el-form>
				<div class="room-metrics">
					<div>
						<b>{{ room?.questions.length ?? 0 }}</b
						><span>提问</span>
					</div>
					<div>
						<b>{{ pendingQuestions }}</b
						><span>待判定</span>
					</div>
					<div>
						<b>{{ answeredQuestions }}</b
						><span>已回答</span>
					</div>
					<div>
						<b>{{ memberStats.filter(member => member.online).length }}</b
						><span>在线</span>
					</div>
				</div>
				<div class="member-strip">
					<button
						v-for="member in memberStats.slice(0, 8)"
						:key="member.userId"
						:class="['strip-member', { offline: !member.online }]"
						type="button"
						@click="openMemberImportant(member)"
					>
						<el-avatar :size="30" :src="member.avatarDataUrl">{{
							member.displayName.slice(0, 1)
						}}</el-avatar
						><span>{{ member.displayName }}</span>
					</button>
				</div>
			</section>

			<section class="desk-grid">
				<aside class="story-column">
					<section class="surface-card story-card">
						<div class="section-head">
							<div>
								<p class="eyebrow">汤面</p>
								<el-input
									v-if="canHost && room"
									v-model="room.title"
									class="title-input"
									@input="queueRoomSave"
								/>
								<h2 v-else>
									{{ room?.title ?? '请选择汤面并创建或加入房间' }}
								</h2>
							</div>
							<el-tag :type="canHost ? 'success' : 'info'" effect="dark">{{
								canHost ? '主持人' : '玩家'
							}}</el-tag>
						</div>
						<el-input
							v-if="canHost && room"
							v-model="room.surface"
							type="textarea"
							:autosize="{ minRows: 7, maxRows: 12 }"
							placeholder="写下可公开给玩家的汤面"
							@input="queueRoomSave"
						/>
						<p v-else class="surface-text">
							{{
								room?.surface ??
								'还没有进入房间。登录后可创建房间，或用房间号加入。'
							}}
						</p>
					</section>
					<section class="surface-card clue-card">
						<div class="section-head compact">
							<div class="title-with-icon">
								<Flag /><strong>重要线索</strong>
							</div>
							<el-tag round effect="dark" type="warning">{{
								importantQuestions.length
							}}</el-tag>
						</div>
						<el-empty
							v-if="!importantQuestions.length"
							description="主持人还没有标记重要内容"
						/>
						<div v-else class="clue-list">
							<article
								v-for="question in importantQuestions"
								:key="question.id"
								class="clue-item"
							>
								<div class="question-meta">
									<span>{{ question.author.displayName }}</span
									><time>{{ formatTime(question.createdAt) }}</time>
								</div>
								<p>{{ question.text }}</p>
								<el-tag
									v-if="question.verdict"
									:type="verdictTypes[question.verdict]"
									effect="plain"
									round
									>{{ verdictLabels[question.verdict] }}</el-tag
								>
							</article>
						</div>
					</section>
				</aside>

				<section class="surface-card qa-column">
					<div class="section-head">
						<div class="title-with-icon">
							<EditPen /><strong>实时问答</strong>
						</div>
						<span class="subtle">{{ onlineHint }}</span>
					</div>
					<div class="ask-row">
						<el-input
							v-model="questionText"
							size="large"
							placeholder="输入问题，例如：这个人认识厨师吗？"
							:disabled="!user || !room"
							@keyup.enter="addQuestion"
						/><el-button
							type="primary"
							size="large"
							:icon="Right"
							:loading="sendingQuestion"
							:disabled="!user || !room"
							@click="addQuestion"
							>发送</el-button
						>
					</div>
					<div class="timeline">
						<el-empty
							v-if="!sortedQuestions.length"
							description="还没有问题，开汤吧。"
						/>
						<article
							v-for="question in sortedQuestions"
							:key="question.id"
							:class="[
								'question-item',
								{ selected: selectedQuestionId === question.id },
							]"
							@click="
								selectedQuestionId =
									selectedQuestionId === question.id ? '' : question.id
							"
						>
							<div class="question-main">
								<div class="question-meta">
									<span>{{ question.author.displayName }}</span
									><time>{{ formatTime(question.createdAt) }}</time>
								</div>
								<p>{{ question.text }}</p>
							</div>
							<div class="verdict-zone">
								<div class="tag-line">
									<el-tag
										v-if="question.important"
										type="warning"
										effect="dark"
										round
										>重要</el-tag
									><el-tag
										v-if="question.verdict"
										:type="verdictTypes[question.verdict]"
										effect="dark"
										round
										>{{ verdictLabels[question.verdict] }}</el-tag
									><span v-if="!question.verdict" class="waiting"
										>等待主持人</span
									>
								</div>
								<el-button v-if="canHost" size="small" text>{{
									selectedQuestionId === question.id ? '收起操作' : '主持操作'
								}}</el-button>
							</div>
							<div
								v-if="canHost && selectedQuestionId === question.id"
								class="host-action-panel"
								@click.stop
							>
								<div class="action-group">
									<span>判定</span
									><button
										class="judge yes"
										type="button"
										@click="setVerdict(question.id, 'yes')"
									>
										是</button
									><button
										class="judge no"
										type="button"
										@click="setVerdict(question.id, 'no')"
									>
										不是</button
									><button
										class="judge both"
										type="button"
										@click="setVerdict(question.id, 'both')"
									>
										是也不是</button
									><button
										class="judge mute"
										type="button"
										@click="setVerdict(question.id, 'irrelevant')"
									>
										不重要
									</button>
								</div>
								<div class="action-group">
									<span>标记</span
									><button
										:class="['judge', 'flag', { active: question.important }]"
										type="button"
										@click="toggleImportant(question)"
									>
										{{ question.important ? '已标重要' : '标为重要' }}</button
									><button
										class="judge delete"
										type="button"
										@click="removeQuestion(question.id)"
									>
										删除
									</button>
								</div>
								<div class="score-grid">
									<label
										>问题价值<el-select
											:model-value="question.quality"
											size="small"
											@change="
												(value: QuestionQuality) =>
													updateQuestionScoring(question, { quality: value })
											"
											><el-option
												v-for="(label, value) in qualityLabels"
												:key="value"
												:label="label"
												:value="value" /></el-select></label
									><label
										>猜中程度<el-select
											:model-value="question.truthGuess"
											size="small"
											@change="
												(value: TruthGuess) =>
													updateQuestionScoring(question, { truthGuess: value })
											"
											><el-option
												v-for="(label, value) in truthGuessLabels"
												:key="value"
												:label="label"
												:value="value" /></el-select
									></label>
								</div>
								<div class="achievement-row">
									<el-checkbox
										:model-value="question.firstCoreClue"
										@change="
											(value: boolean) =>
												updateQuestionScoring(question, {
													firstCoreClue: value,
												})
										"
										>首次核心线索</el-checkbox
									><el-checkbox
										:model-value="question.firstMainLogic"
										@change="
											(value: boolean) =>
												updateQuestionScoring(question, {
													firstMainLogic: value,
												})
										"
										>首次主要逻辑</el-checkbox
									><el-checkbox
										:model-value="question.firstFullSolve"
										@change="
											(value: boolean) =>
												updateQuestionScoring(question, {
													firstFullSolve: value,
												})
										"
										>首位完整破解</el-checkbox
									>
								</div>
							</div>
						</article>
					</div>
				</section>

				<aside class="control-column">
					<section class="surface-card config-card">
						<div class="section-head compact">
							<div class="title-with-icon">
								<House /><strong>房间配置</strong>
							</div>
						</div>
						<div class="config-stack">
							<label>选择汤面</label
							><el-select
								v-model="selectedSoupId"
								filterable
								placeholder="选择自己的汤面"
								:disabled="!user || !soups.length"
								><el-option
									v-for="soup in soups"
									:key="soup.id"
									:label="soup.title"
									:value="soup.id"
									><span>{{ soup.title }}</span
									><small
										>我的汤面 · {{ difficultyLabels[soup.difficulty] }}</small
									></el-option
								></el-select
							>
							<el-empty
								v-if="user && !soups.length"
								description="还没有自己的汤面"
								:image-size="54"
							/>
							<!-- <div v-if="selectedSoupSummary" class="soup-current">
								<div>
									<strong>{{ selectedSoupSummary.title }}</strong
									><span
										>{{ selectedSoupSummary.category || '自建' }} ·
										{{ difficultyLabels[selectedSoupSummary.difficulty] }}</span
									>
								</div>
								<p>{{ selectedSoupSummary.surface }}</p>
								<el-button text type="primary" @click="soupManagerOpen = true"
									>管理汤面</el-button
								>
							</div> -->
							<p v-if="room && canHost" class="switch-warning">
								切换后会清空当前房间的问答、重要线索、画板和结算记录。
							</p>
							<div class="config-actions">
								<el-button
									:icon="Plus"
									:disabled="!user"
									@click="openCreateSoupDialog"
									>自建汤面</el-button
								><el-button
									type="primary"
									:icon="Plus"
									:disabled="!user || Boolean(room && !canHost)"
									@click="room ? switchRoomSoup() : createRoom()"
									>{{ room ? '切换当前题目' : '创建房间' }}</el-button
								>
								<el-button type="info" @click="soupManagerOpen = true"
									>管理汤面</el-button
								>
							</div>
							<label>加入房间</label>
							<div class="room-row">
								<el-input
									v-model="roomCodeInput"
									placeholder="输入房间号"
									@keyup.enter="joinRoom()"
								/><el-button :icon="Right" @click="joinRoom()" />
							</div>
							<el-button
								text
								:icon="CopyDocument"
								:disabled="!room"
								@click="copyShareUrl"
								>复制邀请链接</el-button
							>
						</div>
					</section>
					<section class="surface-card members-card">
						<div class="section-head compact">
							<div class="title-with-icon">
								<User /><strong>房间用户({{ memberStats.length || 0 }})</strong>
							</div>
						</div>
						<el-empty
							v-if="!memberStats.length"
							description="暂无用户"
							:image-size="58"
						/>
						<div v-else class="member-list">
							<div
								v-for="member in memberStats"
								:key="member.userId"
								:class="['member-row', { offline: !member.online }]"
								role="button"
								tabindex="0"
								@click="openMemberImportant(member)"
								@keyup.enter="openMemberImportant(member)"
							>
								<el-avatar :size="34" :src="member.avatarDataUrl">{{
									member.displayName.slice(0, 1)
								}}</el-avatar
								><span class="member-name"
									>{{ member.displayName
									}}<span class="member-badges"
										><em v-if="room?.host.id === member.userId">主持人</em
										><i :class="member.online ? 'online' : 'offline'">{{
											member.online ? '在线' : '离线'
										}}</i></span
									></span
								><span class="member-counts"
									><b>{{ member.questionCount }}</b
									>问 <b class="important-number">{{ member.importantCount }}</b
									>重要</span
								><el-button
									v-if="canTransferHostTo(member)"
									size="small"
									type="primary"
									plain
									@click.stop="transferHost(member)"
									>设为主持人</el-button
								>
							</div>
						</div>
						<div v-if="presenceEvents.length" class="presence-feed">
							<div
								v-for="event in presenceEvents"
								:key="event.at + '-' + event.user.userId"
								:class="['presence-line', event.type]"
							>
								<span />
								<p>{{ event.message }}</p>
							</div>
						</div>
					</section>
					<section class="surface-card rank-card">
						<div class="section-head compact">
							<div class="title-with-icon">
								<Flag /><strong>实时积分排行</strong>
							</div>
						</div>
						<el-empty
							v-if="!liveLeaderboard.length"
							description="暂无排行"
							:image-size="56"
						/>
						<div v-else class="mini-rank-list">
							<div
								v-for="entry in liveLeaderboard.slice(0, 6)"
								:key="entry.user.id"
								class="mini-rank-row"
							>
								<strong>#{{ entry.rank }}</strong
								><el-avatar :size="30" :src="entry.user.avatarDataUrl">{{
									entry.user.displayName.slice(0, 1)
								}}</el-avatar
								><span>{{ entry.user.displayName }}</span
								><b>{{ entry.total }}</b>
							</div>
						</div>
					</section>
				</aside>
			</section>

			<div class="floating-tools">
				<el-tooltip v-if="canHost" content="主持人控制台" placement="left">
					<button
						:class="[
							'float-tool',
							{ active: toolDockOpen && activePanel === 'host' },
						]"
						type="button"
						@click="openToolDock('host')"
					>
						<Setting />
					</button>
				</el-tooltip>
				<el-tooltip v-if="canHost" content="汤底" placement="left">
					<button
						:class="[
							'float-tool',
							{ active: toolDockOpen && activePanel === 'answer' },
						]"
						type="button"
						@click="openToolDock('answer')"
					>
						<Hide />
					</button>
				</el-tooltip>
				<el-tooltip v-if="room && !canHost" content="玩家设置" placement="left">
					<button
						:class="[
							'float-tool',
							{ active: toolDockOpen && activePanel === 'player' },
						]"
						type="button"
						@click="openToolDock('player')"
					>
						<Setting />
					</button>
				</el-tooltip>
				<el-tooltip content="画板" placement="left">
					<button
						:class="[
							'float-tool',
							{ active: toolDockOpen && activePanel === 'canvas' },
						]"
						type="button"
						@click="openToolDock('canvas')"
					>
						<Brush />
					</button>
				</el-tooltip>
			</div>

			<section v-if="toolDockOpen" class="tool-popover surface-card">
				<div class="tool-popover-head">
					<div class="tool-tabs">
						<button
							v-if="canHost"
							:class="{ active: activePanel === 'host' }"
							type="button"
							@click="openToolDock('host')"
						>
							<Setting /> 控制台
						</button>
						<button
							v-if="canHost"
							:class="{ active: activePanel === 'answer' }"
							type="button"
							@click="openToolDock('answer')"
						>
							<Hide /> 汤底
						</button>
						<button
							v-if="room && !canHost"
							:class="{ active: activePanel === 'player' }"
							type="button"
							@click="openToolDock('player')"
						>
							<Setting /> 设置
						</button>
						<button
							:class="{ active: activePanel === 'canvas' }"
							type="button"
							@click="openToolDock('canvas')"
						>
							<Brush /> 画板
						</button>
					</div>
					<el-button text @click="toolDockOpen = false">收起</el-button>
				</div>

				<div
					v-if="canHost"
					v-show="activePanel === 'host'"
					class="tool-panel host-console-panel"
				>
					<div
						:class="['ambience-preview', { custom: activeBackgroundImage }]"
						:style="ambiencePreviewStyle"
					>
						<span
							>{{ activeBackgroundLabel }} ·
							{{ activeAmbiencePreset.tone }}</span
						>
						<strong>{{
							roomMusicDataUrl ? roomMusicName : '未设置房间音乐'
						}}</strong>
					</div>
					<div class="ambience-presets">
						<button
							v-for="preset in AMBIENCE_PRESETS"
							:key="preset.id"
							:class="[
								'preset-chip',
								{
									active:
										!activeBackgroundImage &&
										ambienceDraft.backgroundPreset === preset.id,
								},
							]"
							type="button"
							@click="chooseAmbiencePreset(preset.id)"
						>
							<span :style="{ background: preset.background }" />
							<strong>{{ preset.label }}</strong>
							<small>{{ preset.tone }}</small>
						</button>
					</div>
					<div class="host-console-grid">
						<el-upload
							:show-file-list="false"
							:before-upload="beforeBackgroundUpload"
							accept="image/*"
						>
							<el-button plain :icon="Picture">更换背景</el-button>
						</el-upload>
						<el-upload
							:show-file-list="false"
							:before-upload="beforeMusicUpload"
							accept="audio/*"
						>
							<el-button plain :icon="Headset">上传房间音乐</el-button>
						</el-upload>
						<el-button
							:icon="musicPlaying ? VideoPause : VideoPlay"
							:disabled="!roomMusicDataUrl"
							@click="toggleMusicPlayback"
							plain
							>{{ musicPlaying ? '暂停音乐' : '播放音乐' }}</el-button
						>
						<div>
							<el-button :icon="Refresh" plain @click="resetAmbience"
								>重置氛围</el-button
							>
						</div>
					</div>
					<div class="host-console-local">
						<div class="background-choice">
							<span>使用房间背景</span>
							<el-switch
								v-model="useHostBackground"
								inline-prompt
								active-text="使用"
								inactive-text="默认"
							/>
						</div>
						<div class="background-choice">
							<span>播放房间音乐</span>
							<el-switch
								v-model="useRoomMusic"
								:disabled="!roomMusicDataUrl"
								inline-prompt
								active-text="开启"
								inactive-text="关闭"
							/>
						</div>
					</div>
					<div class="volume-control">
						<span>音乐音量</span>
						<el-slider
							v-model="ambienceVolume"
							:min="0"
							:max="100"
							:disabled="!roomMusicDataUrl"
						/>
					</div>
					<div v-if="hasCustomAmbience" class="ambience-mini-actions">
						<el-button
							text
							:disabled="!activeBackgroundImage"
							@click="clearBackgroundImage"
							>移除背景</el-button
						>
						<el-button
							text
							type="danger"
							:disabled="!roomMusicDataUrl"
							@click="clearMusic"
							>移除房间音乐</el-button
						>
					</div>
				</div>

				<div
					v-if="room && !canHost"
					v-show="activePanel === 'player'"
					class="tool-panel host-console-panel"
				>
					<div
						:class="['ambience-preview', { custom: activeBackgroundImage }]"
						:style="ambiencePreviewStyle"
					>
						<span
							>{{ activeBackgroundLabel }} ·
							{{ activeAmbiencePreset.tone }}</span
						>
						<strong>{{
							roomMusicDataUrl ? roomMusicName : '主持人尚未上传房间音乐'
						}}</strong>
					</div>
					<div class="host-console-local">
						<div class="background-choice">
							<span>使用房间背景</span>
							<el-switch
								v-model="useHostBackground"
								inline-prompt
								active-text="使用"
								inactive-text="默认"
							/>
						</div>
						<div class="background-choice">
							<span>播放房间音乐</span>
							<el-switch
								v-model="useRoomMusic"
								:disabled="!roomMusicDataUrl"
								inline-prompt
								active-text="开启"
								inactive-text="关闭"
							/>
						</div>
					</div>
					<div class="host-console-grid">
						<el-button
							:icon="musicPlaying ? VideoPause : VideoPlay"
							:disabled="!roomMusicDataUrl"
							@click="toggleMusicPlayback"
							plain
							>{{ musicPlaying ? '暂停音乐' : '播放音乐' }}</el-button
						>
					</div>
					<div class="volume-control">
						<span>音乐音量</span>
						<el-slider
							v-model="ambienceVolume"
							:min="0"
							:max="100"
							:disabled="!roomMusicDataUrl"
						/>
					</div>
				</div>

				<div
					v-if="canHost"
					v-show="activePanel === 'answer'"
					class="tool-panel"
				>
					<div class="answer-tools">
						<el-switch
							v-model="answerHidden"
							active-text="隐藏"
							inactive-text="显示"
							inline-prompt
						/>
					</div>
					<el-button
						v-if="canHost && room"
						type="warning"
						class="wide-button reveal-button"
						:disabled="room.revealed"
						@click="revealAnswer"
					>
						{{ room.revealed ? '已揭秘' : '揭秘汤底并结算积分' }}
					</el-button>
					<el-input
						v-if="canHost && room"
						v-model="room.answer"
						type="textarea"
						:autosize="{ minRows: 8, maxRows: 14 }"
						placeholder="只有主持人需要知道的汤底"
						@input="queueRoomSave"
					/>
					<div v-else-if="answerHidden" class="hidden-answer">
						<CircleClose />
						<span>汤底已隐藏</span>
					</div>
					<p v-else class="answer-text">{{ room?.answer ?? '暂无汤底' }}</p>
				</div>

				<div v-show="activePanel === 'canvas'" class="tool-panel">
					<div class="brush-toolbar">
						<el-color-picker v-model="brushColor" :disabled="!canHost" />
						<el-slider
							v-model="brushSize"
							:min="2"
							:max="22"
							:disabled="!canHost"
						/>
						<el-tooltip content="清空画板">
							<el-button
								:icon="Delete"
								circle
								:disabled="!canHost"
								@click="clearCanvas()"
							/>
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
				</div>
			</section>

			<el-dialog
				v-model="customSoupOpen"
				:title="editingSoupId ? '编辑汤面' : '自建汤面'"
				width="min(720px, 92vw)"
				><el-form
					ref="customSoupFormRef"
					:model="customSoup"
					:rules="customSoupRules"
					label-position="top"
					><el-form-item label="标题" prop="title"
						><el-input v-model="customSoup.title" /></el-form-item
					><el-form-item label="汤面" prop="surface"
						><el-input
							v-model="customSoup.surface"
							type="textarea"
							:autosize="{ minRows: 4 }" /></el-form-item
					><el-form-item label="汤底" prop="answer"
						><el-input
							v-model="customSoup.answer"
							type="textarea"
							:autosize="{ minRows: 5 }"
					/></el-form-item>
					<div class="dialog-grid">
						<el-form-item label="分类" prop="category"
							><el-input v-model="customSoup.category" /></el-form-item
						><el-form-item label="难度" prop="difficulty"
							><el-select v-model="customSoup.difficulty"
								><el-option label="入门" value="easy" /><el-option
									label="标准"
									value="medium" /><el-option
									label="困难"
									value="hard" /></el-select
						></el-form-item></div></el-form
				><template #footer
					><el-button @click="closeCustomSoupDialog">取消</el-button
					><el-button
						type="primary"
						:loading="creatingSoup"
						@click="createCustomSoup"
						>{{ editingSoupId ? '保存修改' : '保存汤面' }}</el-button
					></template
				></el-dialog
			>
			<el-drawer
				v-model="soupManagerOpen"
				:direction="soupDrawerDirection"
				:size="isMobile ? '78%' : '420px'"
				class="soup-manager-drawer"
				title="我的题库"
			>
				<div class="soup-manager">
					<el-empty
						v-if="!soups.length"
						description="还没有自己的汤面"
						:image-size="72"
					/>
					<button
						v-for="soup in soups"
						v-else
						:key="soup.id"
						:class="[
							'soup-manage-item',
							{ active: selectedSoupId === soup.id },
						]"
						type="button"
						@click="selectedSoupId = soup.id"
					>
						<span class="soup-manage-copy"
							><strong>{{ soup.title }}</strong
							><small
								>{{ soup.category || '自建' }} ·
								{{ difficultyLabels[soup.difficulty] }}</small
							><em>{{ soup.surface }}</em></span
						>
						<span class="soup-manage-actions">
							<el-button
								round
								plain
								:icon="EditPen"
								@click.stop="openEditSoupDialog(soup)"
								>编辑</el-button
							><el-button
								round
								type="danger"
								plain
								:icon="Delete"
								:loading="deletingSoupId === soup.id"
								@click.stop="deleteSoup(soup)"
								>删除</el-button
							>
						</span>
					</button>
				</div>
			</el-drawer>
			<el-dialog
				v-model="memberDialogOpen"
				:title="(selectedMember?.displayName ?? '') + ' 的重要内容'"
				width="min(680px, 92vw)"
				><el-empty
					v-if="!selectedMember?.importantQuestions.length"
					description="这个用户暂无重要内容"
				/>
				<div v-else class="member-clues">
					<div
						v-for="question in selectedMember.importantQuestions"
						:key="question.id"
						class="clue-item"
					>
						<div class="question-meta">
							<span>{{ selectedMember.displayName }}</span
							><time>{{ formatTime(question.createdAt) }}</time>
						</div>
						<p>{{ question.text }}</p>
						<el-tag
							v-if="question.verdict"
							:type="verdictTypes[question.verdict]"
							effect="plain"
							round
							>{{ verdictLabels[question.verdict] }}</el-tag
						>
					</div>
				</div></el-dialog
			>
			<el-dialog
				v-model="settlementDialogOpen"
				title="本局积分排行榜"
				width="min(820px, 94vw)"
				><div v-if="settlement" class="settlement-board">
					<div class="answer-reveal">
						<span>汤底</span>
						<p>{{ settlement.answer }}</p>
					</div>
					<div class="rank-list">
						<div
							v-for="entry in settlement.entries"
							:key="entry.user.id"
							class="rank-row"
						>
							<strong class="rank-number">#{{ entry.rank }}</strong
							><el-avatar :size="42" :src="entry.user.avatarDataUrl">{{
								entry.user.displayName.slice(0, 1)
							}}</el-avatar>
							<div class="rank-user">
								<b>{{ entry.user.displayName }}</b
								><span
									>{{ entry.user.rankTitle }} · 累计
									{{ entry.user.points }} 分</span
								>
							</div>
							<strong class="rank-score">+{{ entry.total }}</strong>
							<div class="rank-breakdown">
								<el-tag
									v-for="(points, label) in entry.breakdown"
									:key="label"
									effect="plain"
									round
									>{{ label }} +{{ points }}</el-tag
								>
							</div>
						</div>
					</div>
				</div></el-dialog
			>
		</main>
	</el-config-provider>
</template>
