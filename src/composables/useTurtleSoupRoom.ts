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
import { ElMessage } from 'element-plus/es/components/message/index.mjs'
import { io, Socket } from 'socket.io-client'
import { richTextToPlainText, sanitizeRichText } from '@/utils/richText'

type Role = 'host' | 'player'
type Verdict = 'yes' | 'no' | 'both' | 'irrelevant'
type QuestionFilter =
	| 'all'
	| 'mine'
	| 'important'
	| 'yes'
	| 'no'
	| 'both'
	| 'irrelevant'
type InsightMode = 'confirmed' | 'ruledOut'
type ThoughtNodeKind = 'important' | 'yes' | 'no' | 'custom'
type ThoughtPortSide = 'top' | 'right' | 'bottom' | 'left'
type Difficulty = 'easy' | 'medium' | 'hard'
export type QuestionQuality = 'none' | 'helpful' | 'key' | 'breakthrough'
export type TruthGuess = 'none' | 'clue' | 'motive' | 'full'
type AmbiencePresetId = 'light' | 'mist' | 'archive' | 'noir'
type AuthMode = 'login' | 'register'
type SurfaceViewMode = 'preview' | 'edit'
type ToolPanel = 'host' | 'player' | 'answer' | 'canvas'

interface AuthUser {
	id: string
	username: string
	displayName: string
	avatarDataUrl?: string
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

interface SoupPayload {
	title: string
	surface: string
	answer: string
	category: string
	difficulty: Difficulty
}

interface Question {
	id: string
	clientKey?: string
	clientSortAt?: string
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
	clientStatus?: 'sending' | 'failed'
}

interface ThoughtNode {
	id: string
	sourceQuestionId?: string
	kind: ThoughtNodeKind
	text: string
	x: number
	y: number
	width: number
	height: number
}

interface ThoughtLink {
	id: string
	from: string
	to: string
	fromSide?: ThoughtPortSide
	toSide?: ThoughtPortSide
	label: string
	color?: string
	fontSize?: number
}

interface ThoughtText {
	id: string
	text: string
	x: number
	y: number
	color: string
	fontSize: number
}

interface ThoughtBoardData {
	nodes: ThoughtNode[]
	links: ThoughtLink[]
	texts: ThoughtText[]
}

interface ThoughtDragState {
	id: string
	startX: number
	startY: number
	originX: number
	originY: number
}

interface ThoughtResizeState {
	startY: number
	startHeight: number
}

interface ThoughtLinkDragState {
	from: string
	fromSide: ThoughtPortSide
	startX: number
	startY: number
	x: number
	y: number
	snapNodeId?: string
	snapSide?: ThoughtPortSide
}

interface ThoughtTextDragState {
	id: string
	startX: number
	startY: number
	originX: number
	originY: number
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
	mvp?: MvpResult | null
	soupHistory?: SoupHistoryItem[] | null
	ratingMap?: Record<string, number> | null
	host: AuthUser
	questions: Question[]
	updatedAt: string
}

interface SoupHistoryItem {
	id: string
	title: string
	surface: string
	answer: string
	host?: {
		id: string
		username: string
		displayName: string
		avatarDataUrl?: string
	}
	mvp?: MvpResult | AuthUser | null
	startedAt: string
	revealedAt?: string
	ratingAverage?: number
	ratingCount?: number
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

interface MvpQuestion {
	id: string
	text: string
	verdict?: Verdict | null
	important: boolean
	quality: QuestionQuality
	truthGuess: TruthGuess
	firstCoreClue: boolean
	firstMainLogic: boolean
	firstFullSolve: boolean
	author: {
		id: string
		username: string
		displayName: string
		avatarDataUrl?: string
	}
	createdAt: string
}

interface MvpResult {
	selectedAt: string
	user: AuthUser
	importantQuestions: MvpQuestion[]
}

interface QuestionMutationResponse {
	question: Question
}

interface QuestionRemoveResponse {
	questionId: string
}

type QuestionPatchResponse = Question | QuestionMutationResponse | RoomState
type QuestionDeleteResponse = QuestionRemoveResponse | RoomState

const API_BASE =
	import.meta.env.VITE_API_BASE_URL || 'http://124.222.187.70:3001'
const STORAGE_TOKEN = 'turtle-soup:token'
const STORAGE_AVATAR_CACHE = 'turtle-soup:avatar-cache'
const STORAGE_THEME = 'turtle-soup:theme'
const STORAGE_AMBIENCE_PREFIX = 'turtle-soup:ambience:'
const STORAGE_USE_HOST_BACKGROUND_PREFIX = 'turtle-soup:host-background:'
const STORAGE_THOUGHT_BOARD_PREFIX = 'turtle-soup:thought-board:'
const MAX_BACKGROUND_BYTES = 5 * 1024 * 1024
const MAX_MUSIC_BYTES = 12 * 1024 * 1024
const THOUGHT_BOARD_WIDTH = 1360
const THOUGHT_BOARD_HEIGHT = 1120
const THOUGHT_NODE_WIDTH = 220
const THOUGHT_NODE_HEIGHT = 116
const DEFAULT_THOUGHT_TEXT_COLOR = '#0f766e'
const DEFAULT_THOUGHT_TEXT_SIZE = 18
const DEFAULT_AMBIENCE: RoomAmbience = {
	backgroundImageDataUrl: '',
	backgroundPreset: 'light',
	musicDataUrl: '',
	musicName: '',
	musicVolume: 56,
}
const AMBIENCE_PRESETS: AmbiencePreset[] = [
	// {
	// 	id: 'light',
	// 	label: '旧卷',
	// 	tone: '青灰茶墨',
	// 	background:
	// 		'radial-gradient(circle at 16% 10%, rgba(92, 119, 94, 0.28), transparent 28rem), radial-gradient(circle at 88% 14%, rgba(146, 96, 35, 0.2), transparent 26rem), radial-gradient(circle at 42% 92%, rgba(57, 77, 70, 0.18), transparent 30rem), linear-gradient(135deg, #ded3bb, #cfd8c8 46%, #e8dfca)',
	// },
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

type QuestionSignal = Pick<
	Question,
	| 'important'
	| 'quality'
	| 'truthGuess'
	| 'firstCoreClue'
	| 'firstMainLogic'
	| 'firstFullSolve'
>

function hasImportantSignal(question: QuestionSignal) {
	return Boolean(
		question.important ||
		question.quality !== 'none' ||
		question.truthGuess !== 'none' ||
		question.firstCoreClue ||
		question.firstMainLogic ||
		question.firstFullSolve,
	)
}

function questionSignalTags(question: QuestionSignal) {
	const tags: Array<{
		key: string
		label: string
		type: 'success' | 'warning' | 'danger' | 'info'
		effect: 'plain' | 'dark'
	}> = []
	if (question.important) {
		tags.push({
			key: 'important',
			label: '重要',
			type: 'warning',
			effect: 'dark',
		})
	}
	if (question.quality !== 'none') {
		tags.push({
			key: 'quality',
			label: qualityLabels[question.quality],
			type: 'success',
			effect: 'plain',
		})
	}
	if (question.truthGuess !== 'none') {
		tags.push({
			key: 'truth',
			label: truthGuessLabels[question.truthGuess],
			type: 'warning',
			effect: 'plain',
		})
	}
	if (question.firstCoreClue) {
		tags.push({
			key: 'firstCoreClue',
			label: '首次核心线索',
			type: 'success',
			effect: 'dark',
		})
	}
	if (question.firstMainLogic) {
		tags.push({
			key: 'firstMainLogic',
			label: '首次主要逻辑',
			type: 'warning',
			effect: 'dark',
		})
	}
	if (question.firstFullSolve) {
		tags.push({
			key: 'firstFullSolve',
			label: '首位完整破解',
			type: 'danger',
			effect: 'dark',
		})
	}
	return tags
}

function escapeHtml(value: string) {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;')
}

function normalizeSearchText(value: string) {
	return value.normalize('NFKC').trim().toLowerCase()
}

function splitSearchTerms(value: string) {
	return normalizeSearchText(value).split(/\s+/).filter(Boolean)
}

const verdictSearchAliases: Record<Verdict, string[]> = {
	yes: ['是', '对', '可以', '肯定', '汤主回应是'],
	no: ['不是', '否', '不对', '不可以', '汤主回应不是'],
	both: ['是也不是', '部分是', '部分不是', '两者都有', '汤主回应是也不是'],
	irrelevant: ['不重要', '无关', '无需回答', '汤主回应不重要'],
}

function getQuestionSearchText(question: Question) {
	const verdictLabel = question.verdict
		? verdictLabels[question.verdict]
		: '待判定'
	return [
		question.text,
		question.author.displayName,
		question.author.username,
		verdictLabel,
		`汤主回应 ${question.verdict ? verdictLabel : '待回应'}`,
		question.verdict ? '已回应 已判定' : '待回应 待判定',
		question.important ? '重要' : '',
		question.important ? '关键' : '',
		...(question.verdict ? verdictSearchAliases[question.verdict] : []),
		...questionSignalTags(question).map(tag => tag.label),
	]
		.join(' ')
		.normalize('NFKC')
		.toLowerCase()
}

function highlightQuestionTextBase(text: string, searchText: string) {
	const escapedText = escapeHtml(text)
	const keywords = searchText
		.trim()
		.split(/\s+/)
		.filter(Boolean)
		.sort((a, b) => b.length - a.length)
	if (!keywords.length) return escapedText
	return keywords.reduce((result, keyword) => {
		const escapedKeyword = escapeHtml(keyword).replace(
			/[.*+?^${}()|[\]\\]/g,
			'\\$&',
		)
		return result.replace(
			new RegExp(escapedKeyword, 'gi'),
			match => `<mark>${match}</mark>`,
		)
	}, escapedText)
}

function getHistoryMvpUser(item: SoupHistoryItem) {
	if (!item.mvp) return null
	return 'user' in item.mvp ? item.mvp.user : item.mvp
}

function getHistoryMvpQuestions(item: SoupHistoryItem) {
	if (!item.mvp || !('importantQuestions' in item.mvp)) return []
	return item.mvp.importantQuestions
}

export function useTurtleSoupRoom(options: { bodyClass?: string } = {}) {
	const bodyClass = options.bodyClass
	if (bodyClass) document.body.classList.add(bodyClass)
	const isDark = ref(loadTheme())
	const token = ref(localStorage.getItem(STORAGE_TOKEN) || '')
	const user = ref<AuthUser | null>(null)
	const authMode = ref<AuthMode>('login')
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
	const questionInputRef = ref()
	const timelineRef = ref<HTMLElement | null>(null)
	const questionViewMode = ref<QuestionFilter>('all')
	const questionSearchText = ref('')
	const selectedQuestionId = ref('')
	const mobileHostActionOpen = ref(false)
	const mobileHostActionQuestion = ref<Question | null>(null)
	const insightDrawerOpen = ref(false)
	const activeInsightMode = ref<InsightMode>('confirmed')
	const thoughtBoardOpen = ref(false)
	// const thoughtReferenceOpen = ref(false)
	const thoughtNodes = ref<ThoughtNode[]>([])
	const thoughtLinks = ref<ThoughtLink[]>([])
	const thoughtTexts = ref<ThoughtText[]>([])
	const thoughtDraftText = ref('')
	const selectedThoughtNodeId = ref('')
	const selectedThoughtLinkId = ref('')
	const editingThoughtLinkId = ref('')
	const selectedThoughtTextId = ref('')
	const editingThoughtTextId = ref('')
	const draggingThoughtNode = ref<ThoughtDragState | null>(null)
	const draggingThoughtLink = ref<ThoughtLinkDragState | null>(null)
	const draggingThoughtText = ref<ThoughtTextDragState | null>(null)
	const resizingThoughtBoard = ref<ThoughtResizeState | null>(null)
	const thoughtBoardHeight = ref(100)
	const shareUrl = ref(window.location.href)
	const answerHidden = ref(true)
	const surfaceViewMode = ref<SurfaceViewMode>('edit')
	const activePanel = ref<ToolPanel>('answer')
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
	const mvpSelectDialogOpen = ref(false)
	const mvpResultDialogOpen = ref(false)
	const selectedMvpUserId = ref('')
	const mvpSubmitting = ref(false)
	const mvpResult = ref<MvpResult | null>(null)
	const soupHistoryDetailOpen = ref(false)
	const selectedSoupHistoryItem = ref<SoupHistoryItem | null>(null)
	const roomSetupOpen = ref(false)
	const roomSetupMode = ref<'create' | 'switch'>('create')
	const customSoupOpen = ref(false)
	const soupManagerOpen = ref(false)
	const editingSoupId = ref('')
	const isMobile = ref(false)
	const mobileAskExpanded = ref(true)
	const ambienceServerUnsupported = ref(false)
	const ambiencePersistWarned = ref(false)
	const customSoup = reactive({
		title: '',
		surface: '',
		answer: '',
		category: '自建',
		difficulty: 'medium' as Difficulty,
	})

	function highlightQuestionText(text: string) {
		return highlightQuestionTextBase(text, questionSearchText.value)
	}

	function richTextLengthValidator(label: string, min: number, max: number) {
		return (
			_rule: unknown,
			value: string,
			callback: (error?: Error) => void,
		) => {
			const length = richTextToPlainText(value).trim().length
			if (!length) {
				callback(new Error(`请输入${label}`))
				return
			}
			if (length < min || length > max) {
				callback(new Error(`${label}长度为 ${min}-${max} 个字符`))
				return
			}
			callback()
		}
	}

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
			{ validator: richTextLengthValidator('汤面', 8, 2000), trigger: 'blur' },
		],
		answer: [
			{ validator: richTextLengthValidator('汤底', 8, 4000), trigger: 'blur' },
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
	let mobileMediaQuery: MediaQueryList | null = null
	let syncingAmbience = false
	let ambienceDirty = false
	const presenceNotifyAt = new Map<string, number>()
	const roomAmbienceCache = new Map<string, RoomAmbience>()
	const questionSortTimes = new Map<string, number>()
	const avatarCache = loadAvatarCache()
	const removedQuestionIds = new Set<string>()

	const canHost = computed(() =>
		Boolean(user.value && room.value?.host.id === user.value.id),
	)
	const pendingQuestions = computed(
		() =>
			room.value?.questions.filter(question => !question.verdict).length ?? 0,
	)
	const answeredQuestions = computed(
		() =>
			room.value?.questions.filter(question => question.verdict).length ?? 0,
	)
	const sortedQuestions = computed(() =>
		[...(room.value?.questions ?? [])].sort(
			(a, b) => getQuestionSortTime(b) - getQuestionSortTime(a),
		),
	)
	const myQuestions = computed(() =>
		user.value
			? sortedQuestions.value.filter(
					question => question.author.id === user.value?.id,
				)
			: [],
	)
	const importantQuestions = computed(() =>
		sortedQuestions.value.filter(question => hasClueSignal(question)),
	)
	const hostImportantHints = computed(() =>
		sortedQuestions.value.filter(question => isHostImportantHint(question)),
	)
	const confirmedQuestions = computed(() =>
		sortedQuestions.value.filter(question => question.verdict === 'yes'),
	)
	const ruledOutQuestions = computed(() =>
		sortedQuestions.value.filter(question => question.verdict === 'no'),
	)
	const questionFilterOptions = computed<
		Array<{
			value: QuestionFilter
			label: string
			count: number
			disabled?: boolean
		}>
	>(() => [
		{ value: 'all', label: '全部', count: sortedQuestions.value.length },
		{
			value: 'important',
			label: '重要',
			count: importantQuestions.value.length,
		},
		{
			value: 'mine',
			label: '我的',
			count: myQuestions.value.length,
			disabled: !user.value,
		},
		{
			value: 'yes',
			label: verdictLabels.yes,
			count: sortedQuestions.value.filter(
				question => question.verdict === 'yes',
			).length,
		},
		{
			value: 'no',
			label: verdictLabels.no,
			count: sortedQuestions.value.filter(question => question.verdict === 'no')
				.length,
		},
		{
			value: 'both',
			label: verdictLabels.both,
			count: sortedQuestions.value.filter(
				question => question.verdict === 'both',
			).length,
		},
		{
			value: 'irrelevant',
			label: verdictLabels.irrelevant,
			count: sortedQuestions.value.filter(
				question => question.verdict === 'irrelevant',
			).length,
		},
	])
	const filteredQuestionBase = computed(() => {
		switch (questionViewMode.value) {
			case 'mine':
				return myQuestions.value
			case 'important':
				return importantQuestions.value
			case 'yes':
			case 'no':
			case 'both':
			case 'irrelevant':
				return sortedQuestions.value.filter(
					question => question.verdict === questionViewMode.value,
				)
			default:
				return sortedQuestions.value
		}
	})
	const normalizedQuestionSearch = computed(() =>
		normalizeSearchText(questionSearchText.value),
	)
	const questionSearchTerms = computed(() =>
		splitSearchTerms(questionSearchText.value),
	)
	const visibleQuestions = computed(() => {
		if (!questionSearchTerms.value.length) return filteredQuestionBase.value
		return filteredQuestionBase.value.filter(question =>
			questionSearchTerms.value.every(term =>
				getQuestionSearchText(question).includes(term),
			),
		)
	})
	const chatQuestions = computed(() => [...visibleQuestions.value].reverse())
	const questionResultHint = computed(() => {
		if (!room.value) return '进入房间后会在这里同步全部问答。'
		const total = sortedQuestions.value.length
		if (!total) return '还没有问题，开汤吧。'
		const shown = visibleQuestions.value.length
		const filterLabel =
			questionFilterOptions.value.find(
				option => option.value === questionViewMode.value,
			)?.label ?? '全部'
		const searchSuffix = normalizedQuestionSearch.value
			? `，搜索「${questionSearchText.value.trim()}」`
			: ''
		return `${filterLabel}${searchSuffix}：${shown} / ${total} 条`
	})
	const activeInsightTitle = computed(() =>
		activeInsightMode.value === 'confirmed' ? '已确认' : '已排除',
	)
	const activeInsightQuestions = computed(() =>
		activeInsightMode.value === 'confirmed'
			? confirmedQuestions.value
			: ruledOutQuestions.value,
	)
	const mobileRecentMyQuestions = computed(() => myQuestions.value.slice(0, 3))
	const thoughtSourceQuestions = computed(() =>
		sortedQuestions.value.filter(
			question =>
				(question.important && !isHostImportantHint(question)) ||
				question.verdict === 'yes' ||
				question.verdict === 'no',
		),
	)
	const thoughtNodeStats = computed(() => ({
		important: thoughtNodes.value.filter(node => node.kind === 'important')
			.length,
		yes: thoughtNodes.value.filter(node => node.kind === 'yes').length,
		no: thoughtNodes.value.filter(node => node.kind === 'no').length,
		custom: thoughtNodes.value.filter(node => node.kind === 'custom').length,
	}))
	const thoughtBoardWidth = computed(() => getThoughtBoardWidth())
	const thoughtBoardDrawerSize = computed(() =>
		isMobile.value ? '88%' : `${thoughtBoardHeight.value}%`,
	)
	const thoughtLinkViews = computed(() =>
		thoughtLinks.value
			.map(link => ({ link, geometry: thoughtLinkGeometry(link) }))
			.filter(
				(
					item,
				): item is {
					link: ThoughtLink
					geometry: NonNullable<ReturnType<typeof thoughtLinkGeometry>>
				} => Boolean(item.geometry),
			),
	)
	const selectedThoughtStyleTarget = computed(() => {
		if (selectedThoughtTextId.value) {
			const text = thoughtTexts.value.find(
				item => item.id === selectedThoughtTextId.value,
			)
			return text ? { type: 'text' as const, item: text } : null
		}
		if (selectedThoughtLinkId.value) {
			const link = thoughtLinks.value.find(
				item => item.id === selectedThoughtLinkId.value,
			)
			return link ? { type: 'link' as const, item: link } : null
		}
		return null
	})
	const selectedThoughtColor = computed({
		get: () =>
			selectedThoughtStyleTarget.value?.item.color ??
			DEFAULT_THOUGHT_TEXT_COLOR,
		set: value => updateSelectedThoughtStyle({ color: value }),
	})
	const selectedThoughtFontSize = computed({
		get: () =>
			selectedThoughtStyleTarget.value?.item.fontSize ??
			DEFAULT_THOUGHT_TEXT_SIZE,
		set: value => updateSelectedThoughtStyle({ fontSize: value }),
	})
	const thoughtLinkPreview = computed(() => {
		if (!draggingThoughtLink.value) return null
		const start = getThoughtPortPoint(
			draggingThoughtLink.value.from,
			draggingThoughtLink.value.fromSide,
		)
		if (!start) return null
		const end =
			draggingThoughtLink.value.snapNodeId && draggingThoughtLink.value.snapSide
				? getThoughtPortPoint(
						draggingThoughtLink.value.snapNodeId,
						draggingThoughtLink.value.snapSide,
					)
				: { x: draggingThoughtLink.value.x, y: draggingThoughtLink.value.y }
		if (!end) return null
		return {
			x1: start.x,
			y1: start.y,
			x2: end.x,
			y2: end.y,
			path: getThoughtCurvePath(
				start,
				end,
				draggingThoughtLink.value.fromSide,
				draggingThoughtLink.value.snapSide ??
					draggingThoughtLink.value.fromSide,
			),
		}
	})
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
			if (hasClueSignal(question)) {
				existing.importantCount += 1
				existing.importantQuestions.push(question)
			}
			byId.set(question.author.id, existing)
		})
		return [...byId.values()].sort(
			(a, b) =>
				Number(b.online) - Number(a.online) ||
				b.questionCount - a.questionCount,
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
	const mvpCandidates = computed(() => {
		const hostId = room.value?.host.id
		return (settlement.value?.entries ?? [])
			.filter(entry => entry.user.id !== hostId)
			.map(entry => entry.user)
	})
	const mvpImportantQuestions = computed<Question[]>(() =>
		[...(room.value?.questions ?? [])]
			.filter(
				question =>
					hasClueSignal(question) &&
					(!selectedMvpUserId.value ||
						question.author.id === selectedMvpUserId.value),
			)
			.sort(
				(a, b) =>
					new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
			),
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
		activeBackgroundImage.value
			? '自定义背景'
			: activeAmbiencePreset.value.label,
	)
	const roomMusicDataUrl = computed(() => ambienceDraft.musicDataUrl)
	const roomMusicName = computed(() => ambienceDraft.musicName || '房间音乐')
	const activeMusicDataUrl = computed(() =>
		useRoomMusic.value ? roomMusicDataUrl.value : '',
	)
	const hasCustomAmbience = computed(() =>
		Boolean(activeBackgroundImage.value || roomMusicDataUrl.value),
	)
	const soupHistory = computed(() =>
		[...(room.value?.soupHistory ?? [])].reverse(),
	)
	const currentSoupRating = computed(() => room.value?.soupHistory?.at(-1))
	const mySoupRating = computed(() =>
		user.value && room.value?.ratingMap
			? room.value.ratingMap[user.value.id]
			: 0,
	)
	const canRateCurrentSoup = computed(() =>
		Boolean(room.value?.revealed && user.value && !canHost.value),
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
	const soupDrawerDirection = computed(() => (isMobile.value ? 'btt' : 'rtl'))

	watch(
		isDark,
		value => {
			document.documentElement.classList.toggle('dark', value)
			localStorage.setItem(STORAGE_THEME, value ? 'dark' : 'light')
		},
		{ immediate: true },
	)

	watch(
		() =>
			chatQuestions.value
				.map(question => `${question.id}:${question.verdict ?? ''}`)
				.join('|'),
		() => {
			nextTick(() => {
				const timeline = timelineRef.value
				if (timeline) timeline.scrollTop = timeline.scrollHeight
			})
		},
		{ flush: 'post' },
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

	watch([() => room.value?.code, () => user.value?.id], () =>
		loadThoughtBoard(),
	)

	watch(thoughtSourceQuestions, () => syncThoughtSources(false), {
		flush: 'post',
	})

	watch(authMode, () => {
		authFormRef.value?.clearValidate()
	})

	onMounted(async () => {
		mobileMediaQuery = window.matchMedia('(max-width: 760px)')
		updateViewportState()
		window.addEventListener('resize', resizeCanvas)
		window.addEventListener('resize', updateViewportState)
		mobileMediaQuery.addEventListener('change', updateViewportState)
		window.addEventListener('pointermove', resizeThoughtBoard)
		window.addEventListener('pointerup', stopThoughtBoardResize)
		window.addEventListener('beforeunload', handleBeforeUnload)
		await restoreSession()
		if (user.value) await loadSoups()
		if (roomCodeInput.value) {
			await joinRoom(roomCodeInput.value, false)
		}
	})

	onBeforeUnmount(() => {
		if (bodyClass) document.body.classList.remove(bodyClass)
		window.clearTimeout(canvasSaveTimer)
		window.clearTimeout(canvasPreviewTimer)
		window.clearTimeout(roomSaveTimer)
		window.removeEventListener('resize', resizeCanvas)
		window.removeEventListener('resize', updateViewportState)
		mobileMediaQuery?.removeEventListener('change', updateViewportState)
		window.removeEventListener('pointermove', resizeThoughtBoard)
		window.removeEventListener('pointerup', stopThoughtBoardResize)
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
		isMobile.value =
			mobileMediaQuery?.matches ??
			window.matchMedia('(max-width: 760px)').matches
	}

	async function request<T>(
		path: string,
		options: RequestInit = {},
	): Promise<T> {
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

	function isRecord(value: unknown): value is Record<string, unknown> {
		return typeof value === 'object' && value !== null
	}

	function isRoomState(value: unknown): value is RoomState {
		return (
			isRecord(value) &&
			typeof value.code === 'string' &&
			Array.isArray(value.questions)
		)
	}

	function isQuestionMutationResponse(
		value: unknown,
	): value is QuestionMutationResponse {
		return isRecord(value) && isRecord(value.question)
	}

	function loadAvatarCache() {
		try {
			const cache = JSON.parse(
				localStorage.getItem(STORAGE_AVATAR_CACHE) || '{}',
			)
			if (!isRecord(cache)) return new Map<string, string>()
			return new Map(
				Object.entries(cache).filter(
					(entry): entry is [string, string] => typeof entry[1] === 'string',
				),
			)
		} catch {
			return new Map<string, string>()
		}
	}

	function persistAvatarCache() {
		try {
			localStorage.setItem(
				STORAGE_AVATAR_CACHE,
				JSON.stringify(Object.fromEntries(avatarCache)),
			)
		} catch {
			// Ignore storage quota/private-mode failures; avatars can fall back to initials.
		}
	}

	function rememberAvatar(userId?: string, avatarDataUrl?: string) {
		if (!userId || !avatarDataUrl) return
		avatarCache.set(userId, avatarDataUrl)
		persistAvatarCache()
	}

	function hydrateUserAvatar<T extends { id: string; avatarDataUrl?: string }>(
		userData: T,
	): T {
		rememberAvatar(userData.id, userData.avatarDataUrl)
		const avatarDataUrl =
			userData.avatarDataUrl || avatarCache.get(userData.id) || ''
		if (avatarDataUrl === userData.avatarDataUrl) return userData
		return { ...userData, avatarDataUrl }
	}

	function hydrateRoomMember(member: RoomMember): RoomMember {
		const avatarDataUrl =
			member.avatarDataUrl || avatarCache.get(member.userId) || ''
		if (avatarDataUrl === member.avatarDataUrl) return member
		return { ...member, avatarDataUrl }
	}

	function hydrateQuestion(question: Question): Question {
		return {
			...question,
			author: hydrateUserAvatar(question.author),
		}
	}

	function hydrateMvpResult(result?: MvpResult | null): MvpResult | null {
		if (!result) return null
		return {
			...result,
			user: hydrateUserAvatar(result.user),
			importantQuestions: result.importantQuestions.map(question => ({
				...question,
				author: hydrateUserAvatar(question.author),
			})),
		}
	}

	function hydrateSettlement(
		nextSettlement?: Settlement | null,
	): Settlement | null {
		if (!nextSettlement) return null
		return {
			...nextSettlement,
			entries: nextSettlement.entries.map(entry => ({
				...entry,
				user: hydrateUserAvatar(entry.user),
			})),
		}
	}

	function hydrateSoupHistoryItem(item: SoupHistoryItem): SoupHistoryItem {
		return {
			...item,
			host: item.host ? hydrateUserAvatar(item.host) : item.host,
			mvp:
				item.mvp && 'importantQuestions' in item.mvp
					? hydrateMvpResult(item.mvp)
					: item.mvp
						? hydrateUserAvatar(item.mvp)
						: item.mvp,
		}
	}

	function hydrateRoom(data: RoomState): RoomState {
		return {
			...data,
			host: hydrateUserAvatar(data.host),
			settlement: hydrateSettlement(data.settlement) ?? undefined,
			mvp: hydrateMvpResult(data.mvp),
			soupHistory:
				data.soupHistory?.map(hydrateSoupHistoryItem) ?? data.soupHistory,
			questions: data.questions
				.map(hydrateQuestion)
				.filter(question => !removedQuestionIds.has(question.id)),
		}
	}

	function mergeRoomWithLocalQuestions(data: RoomState): RoomState {
		const nextRoom = hydrateRoom(data)
		if (!room.value || room.value.code !== nextRoom.code) return nextRoom
		const localById = new Map(
			room.value.questions.map(question => [question.id, question]),
		)
		const byId = new Map(
			nextRoom.questions.map(question => {
				const localQuestion = localById.get(question.id)
				if (localQuestion?.clientKey)
					question.clientKey = localQuestion.clientKey
				if (localQuestion?.clientSortAt) {
					question.clientSortAt = localQuestion.clientSortAt
				}
				return [question.id, question]
			}),
		)
		room.value.questions.forEach(question => {
			if (removedQuestionIds.has(question.id) || byId.has(question.id)) return
			byId.set(question.id, question)
		})
		return {
			...nextRoom,
			questions: [...byId.values()],
		}
	}

	function applyQuestionPatchResponse(response: QuestionPatchResponse) {
		if (isRoomState(response)) {
			room.value = mergeRoomWithLocalQuestions(response)
			return
		}
		if (isQuestionMutationResponse(response)) {
			upsertQuestion(response.question)
			return
		}
		upsertQuestion(response)
	}

	function removeQuestionLocally(questionId: string) {
		if (!room.value) return
		removedQuestionIds.add(questionId)
		room.value.questions = room.value.questions.filter(
			question => question.id !== questionId,
		)
		questionSortTimes.delete(questionId)
		if (selectedQuestionId.value === questionId) selectedQuestionId.value = ''
	}

	function createPendingQuestion(text: string): Question {
		const now = new Date().toISOString()
		const id =
			typeof crypto?.randomUUID === 'function'
				? `pending:${crypto.randomUUID()}`
				: `pending:${Date.now()}-${Math.random().toString(36).slice(2)}`
		return {
			id,
			clientKey: id,
			clientSortAt: now,
			text,
			verdict: null,
			important: false,
			quality: 'none',
			truthGuess: 'none',
			firstCoreClue: false,
			firstMainLogic: false,
			firstFullSolve: false,
			author: hydrateUserAvatar(user.value!),
			createdAt: now,
			answeredAt: null,
			clientStatus: 'sending',
		}
	}

	function removePendingQuestionFor(question: Question) {
		if (!room.value || question.clientStatus) return null
		const pendingIndex = room.value.questions.findIndex(
			item =>
				item.clientStatus === 'sending' &&
				item.text === question.text &&
				item.author.id === question.author.id,
		)
		if (pendingIndex < 0) return null
		const [pending] = room.value.questions.splice(pendingIndex, 1)
		return pending
	}

	function replacePendingQuestion(tempId: string, question: Question) {
		if (!room.value) return
		const nextQuestion = hydrateQuestion(question)
		const pendingIndex = room.value.questions.findIndex(
			item =>
				item.id === tempId ||
				(item.clientStatus === 'sending' &&
					item.text === nextQuestion.text &&
					item.author.id === nextQuestion.author.id),
		)
		if (pendingIndex >= 0) {
			const [pending] = room.value.questions.splice(pendingIndex, 1)
			const pendingSortTime = questionSortTimes.get(pending.id)
			nextQuestion.clientKey = pending.clientKey ?? pending.id
			nextQuestion.clientSortAt = pending.clientSortAt ?? pending.createdAt
			if (typeof pendingSortTime === 'number') {
				questionSortTimes.set(nextQuestion.id, pendingSortTime)
			}
			questionSortTimes.delete(pending.id)
		}
		questionSortTimes.delete(tempId)
		const nextExistingIndex = room.value.questions.findIndex(
			item => item.id === nextQuestion.id,
		)
		if (nextExistingIndex >= 0) {
			const existingQuestion = room.value.questions[nextExistingIndex]
			nextQuestion.clientKey =
				nextQuestion.clientKey ?? existingQuestion.clientKey
			nextQuestion.clientSortAt =
				nextQuestion.clientSortAt ?? existingQuestion.clientSortAt
			room.value.questions.splice(nextExistingIndex, 1, nextQuestion)
			getQuestionSortTime(nextQuestion)
			return
		}
		upsertQuestion(nextQuestion)
	}

	function markPendingQuestionFailed(tempId: string) {
		if (!room.value) return
		const target = room.value.questions.find(question => question.id === tempId)
		if (target) target.clientStatus = 'failed'
	}

	function applyQuestionDeleteResponse(response: QuestionDeleteResponse) {
		if (isRoomState(response)) {
			room.value = mergeRoomWithLocalQuestions(response)
			return
		}
		removeQuestionLocally(response.questionId)
	}

	async function restoreSession() {
		if (!token.value) return
		try {
			user.value = hydrateUserAvatar(await request<AuthUser>('/auth/me'))
		} catch {
			logout(false)
		}
	}

	function validateAuthPayload(payload: {
		mode: AuthMode
		username: string
		password: string
		displayName?: string
	}) {
		if (payload.username.length < 3 || payload.username.length > 24) {
			ElMessage.warning('用户名长度为 3-24 个字符')
			return false
		}
		if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(payload.username)) {
			ElMessage.warning('用户名只能包含中文、字母、数字或下划线')
			return false
		}
		if (payload.password.length < 4 || payload.password.length > 40) {
			ElMessage.warning('密码长度为 4-40 个字符')
			return false
		}
		if (
			payload.mode === 'register' &&
			(payload.displayName?.length ?? 0) > 24
		) {
			ElMessage.warning('昵称长度为 1-24 个字符')
			return false
		}
		return true
	}

	async function submitAuthPayload(payload: {
		mode: AuthMode
		username: string
		password: string
		displayName?: string
	}) {
		const normalizedPayload = {
			...payload,
			username: payload.username.trim(),
			displayName: payload.displayName?.trim() ?? '',
		}
		if (!validateAuthPayload(normalizedPayload)) return
		const requestPayload =
			normalizedPayload.mode === 'register'
				? {
						username: normalizedPayload.username,
						password: normalizedPayload.password,
						displayName:
							normalizedPayload.displayName || normalizedPayload.username,
					}
				: {
						username: normalizedPayload.username,
						password: normalizedPayload.password,
					}
		authSubmitting.value = true
		try {
			const data = await request<AuthResponse>(
				`/auth/${normalizedPayload.mode}`,
				{
					method: 'POST',
					body: JSON.stringify(requestPayload),
				},
			)
			token.value = data.token
			user.value = hydrateUserAvatar(data.user)
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

	async function submitAuth() {
		if (authFormRef.value) {
			const valid = await authFormRef.value.validate().catch(() => false)
			if (!valid) return
		}
		await submitAuthPayload({
			mode: authMode.value,
			username: authForm.username,
			password: authForm.password,
			displayName: authForm.displayName,
		})
	}

	async function submitAuthFromBigScreen(payload: {
		mode: AuthMode
		username: string
		password: string
		displayName: string
	}) {
		authMode.value = payload.mode
		authForm.username = payload.username
		authForm.password = payload.password
		authForm.displayName = payload.displayName
		await submitAuthPayload(payload)
	}

	function logout(showMessage = true) {
		leaveRoomByUser(false)
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
		await persistSoupPayload(
			{
				...customSoup,
				surface: sanitizeRichText(customSoup.surface),
				answer: sanitizeRichText(customSoup.answer),
			},
			editingSoupId.value,
		)
	}

	function normalizeSoupPayload(payload: SoupPayload) {
		const nextPayload = {
			title: payload.title.trim(),
			surface: sanitizeRichText(payload.surface),
			answer: sanitizeRichText(payload.answer),
			category: payload.category.trim() || '自建',
			difficulty: payload.difficulty,
		}
		const surfaceLength = richTextToPlainText(nextPayload.surface).trim().length
		const answerLength = richTextToPlainText(nextPayload.answer).trim().length
		if (nextPayload.title.length < 2 || nextPayload.title.length > 60) {
			ElMessage.warning('标题长度为 2-60 个字符')
			return null
		}
		if (surfaceLength < 8 || surfaceLength > 2000) {
			ElMessage.warning('汤面长度为 8-2000 个字符')
			return null
		}
		if (answerLength < 8 || answerLength > 4000) {
			ElMessage.warning('汤底长度为 8-4000 个字符')
			return null
		}
		if (nextPayload.category.length < 1 || nextPayload.category.length > 20) {
			ElMessage.warning('分类长度为 1-20 个字符')
			return null
		}
		if (!['easy', 'medium', 'hard'].includes(nextPayload.difficulty)) {
			ElMessage.warning('请选择难度')
			return null
		}
		return nextPayload
	}

	async function persistSoupPayload(payload: SoupPayload, soupId = '') {
		const normalizedPayload = normalizeSoupPayload(payload)
		if (!normalizedPayload) return false
		creatingSoup.value = true
		const isEditing = Boolean(soupId)
		try {
			const soup = await request<Soup>(
				isEditing ? `/soups/${soupId}` : '/soups',
				{
					method: isEditing ? 'PATCH' : 'POST',
					body: JSON.stringify(normalizedPayload),
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
			return true
		} catch (error) {
			ElMessage.error(error instanceof Error ? error.message : '保存失败')
			return false
		} finally {
			creatingSoup.value = false
		}
	}

	async function saveSoupFromBigScreen(payload: SoupPayload, soupId?: string) {
		editingSoupId.value = soupId || ''
		Object.assign(customSoup, {
			...customSoup,
			...payload,
		})
		await persistSoupPayload(payload, editingSoupId.value)
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

	async function createRoom(options: { replaceCurrent?: boolean } = {}) {
		if (!user.value) return ElMessage.warning('请先登录')
		if (!selectedSoupId.value)
			return ElMessage.warning('请先创建并选择自己的汤面')
		const previousRoomCode = room.value?.code
		const data = await request<RoomState>('/rooms', {
			method: 'POST',
			body: JSON.stringify({ soupId: selectedSoupId.value || undefined }),
		})
		if (
			options.replaceCurrent &&
			previousRoomCode &&
			previousRoomCode !== data.code
		) {
			leaveCurrentRoom()
			presenceEvents.value = []
		}
		applyRoom(data)
		selectedRole.value = 'host'
		roomSetupOpen.value = false
		ElMessage.success(`房间 ${data.code} 已创建`)
	}

	function openRoomSetup(mode: 'create' | 'switch' = 'create') {
		roomSetupMode.value = mode
		roomSetupOpen.value = true
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
		roomSetupOpen.value = false
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
		const nextRoom = hydrateRoom(data)
		room.value = nextRoom
		mvpResult.value = hydrateMvpResult(nextRoom.mvp)
		roomCodeInput.value = nextRoom.code
		useHostBackground.value =
			localStorage.getItem(
				STORAGE_USE_HOST_BACKGROUND_PREFIX + nextRoom.code,
			) !== '0'
		syncAmbienceFromRoom(nextRoom)
		syncSelectedSoupFromRoom(nextRoom)
		updateShareUrl()
		connectSocket(nextRoom.code)
		nextTick(() => {
			resizeCanvas()
			restoreCanvas()
		})
	}

	function syncSelectedSoupFromRoom(data: RoomState) {
		const matched = soups.value.find(
			soup =>
				soup.title === data.title &&
				sanitizeRichText(soup.surface) === sanitizeRichText(data.surface),
		)
		if (matched) selectedSoupId.value = matched.id
	}

	function resetRoundState(nextRoom?: RoomState) {
		const previousRoomCode = room.value?.code
		if (nextRoom) room.value = hydrateRoom(nextRoom)
		if (room.value) room.value.questions = []
		questionSortTimes.clear()
		removedQuestionIds.clear()
		questionText.value = ''
		settlement.value = null
		settlementDialogOpen.value = false
		mvpSelectDialogOpen.value = false
		mvpResultDialogOpen.value = false
		selectedMvpUserId.value = ''
		mvpResult.value = null
		selectedQuestionId.value = ''
		answerHidden.value = true
		clearThoughtBoardStorage(previousRoomCode)
		nextTick(() => restoreCanvas(''))
	}

	function toggleQuestionSelection(questionId: string) {
		if (isMobile.value) return
		selectedQuestionId.value =
			selectedQuestionId.value === questionId ? '' : questionId
	}

	function openHostAction(question: Question) {
		if (isMobile.value || window.matchMedia('(max-width: 760px)').matches) {
			mobileHostActionQuestion.value = question
			mobileHostActionOpen.value = true
			return
		}
		selectedQuestionId.value =
			selectedQuestionId.value === question.id ? '' : question.id
	}

	async function applyMobileVerdict(verdict: Verdict) {
		const question = mobileHostActionQuestion.value
		if (!question) return
		await setVerdict(question.id, verdict)
		mobileHostActionOpen.value = false
	}

	async function toggleMobileImportant() {
		const question = mobileHostActionQuestion.value
		if (!question) return
		await toggleImportant(question)
	}

	async function removeMobileQuestion() {
		const question = mobileHostActionQuestion.value
		if (!question) return
		await removeQuestion(question.id)
		mobileHostActionOpen.value = false
	}

	async function updateMobileQuestionScoring(patch: Partial<QuestionSignal>) {
		const question = mobileHostActionQuestion.value
		if (!question) return
		await updateQuestionScoring(question, patch)
	}

	function leaveRoomByUser(showMessage = true) {
		if (!room.value) return
		leaveCurrentRoom()
		room.value = null
		roomCodeInput.value = ''
		roomMembers.value = []
		presenceEvents.value = []
		questionText.value = ''
		selectedQuestionId.value = ''
		settlement.value = null
		mvpResult.value = null
		answerHidden.value = true
		const url = new URL(window.location.href)
		url.searchParams.delete('room')
		window.history.replaceState({}, '', url)
		shareUrl.value = url.toString()
		if (showMessage) ElMessage.success('已退出房间')
	}

	function revealQuestion(questionId: string) {
		questionViewMode.value = 'all'
		questionSearchText.value = ''
		insightDrawerOpen.value = false
		thoughtBoardOpen.value = false
		selectedQuestionId.value = questionId
		nextTick(() => {
			const target = [
				...document.querySelectorAll<HTMLElement>('.question-item'),
			].find(element => element.dataset.questionId === questionId)
			target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
		})
	}

	function openInsightDrawer(mode: InsightMode) {
		activeInsightMode.value = mode
		insightDrawerOpen.value = true
	}

	function getThoughtBoardKey() {
		if (!room.value) return ''
		return getThoughtBoardKeyForRoom(room.value.code)
	}

	function getThoughtBoardKeyForRoom(roomCode: string) {
		return `${STORAGE_THOUGHT_BOARD_PREFIX}${roomCode}:${user.value?.id ?? 'guest'}`
	}

	function clampThoughtNode(node: ThoughtNode): ThoughtNode {
		const boardWidth = getThoughtBoardWidth()
		return {
			...node,
			x: Math.max(0, Math.min(boardWidth - node.width, node.x)),
			y: Math.max(0, Math.min(THOUGHT_BOARD_HEIGHT - node.height, node.y)),
			width: Math.max(170, Math.min(320, node.width)),
			height: Math.max(96, Math.min(220, node.height)),
		}
	}

	function getThoughtBoardWidth() {
		const viewportWidth =
			typeof window === 'undefined'
				? THOUGHT_BOARD_WIDTH
				: Math.max(360, window.innerWidth - (isMobile.value ? 20 : 64))
		return Math.max(THOUGHT_BOARD_WIDTH, viewportWidth)
	}

	function getThoughtNodeKind(question: Question): ThoughtNodeKind {
		if (question.important) return 'important'
		if (question.verdict === 'yes') return 'yes'
		return 'no'
	}

	function createThoughtNodeFromQuestion(
		question: Question,
		index: number,
	): ThoughtNode {
		const kind = getThoughtNodeKind(question)
		const column = kind === 'important' ? 0 : kind === 'yes' ? 1 : 2
		const row = Math.floor(index / 3)
		const jitterX = (index % 2) * 72
		const jitterY = (index % 3) * 44
		return {
			id: `question:${question.id}`,
			sourceQuestionId: question.id,
			kind,
			text: question.text,
			x: 56 + column * 380 + jitterX,
			y: 70 + row * 250 + jitterY,
			width: THOUGHT_NODE_WIDTH,
			height: THOUGHT_NODE_HEIGHT,
		}
	}

	function sanitizeThoughtNodes(value: unknown): ThoughtNode[] {
		if (!Array.isArray(value)) return []
		return value
			.filter(item => isRecord(item) && typeof item.id === 'string')
			.map(item =>
				clampThoughtNode({
					id: String(item.id),
					sourceQuestionId:
						typeof item.sourceQuestionId === 'string'
							? item.sourceQuestionId
							: undefined,
					kind: ['important', 'yes', 'no', 'custom'].includes(String(item.kind))
						? (String(item.kind) as ThoughtNodeKind)
						: 'custom',
					text: typeof item.text === 'string' ? item.text : '',
					x: Number(item.x) || 0,
					y: Number(item.y) || 0,
					width: Number(item.width) || THOUGHT_NODE_WIDTH,
					height: Number(item.height) || THOUGHT_NODE_HEIGHT,
				}),
			)
	}

	function sanitizeThoughtLinks(value: unknown): ThoughtLink[] {
		if (!Array.isArray(value)) return []
		const isThoughtPortSide = (side: unknown): side is ThoughtPortSide =>
			side === 'top' || side === 'right' || side === 'bottom' || side === 'left'
		return value
			.filter(
				item =>
					isRecord(item) &&
					typeof item.id === 'string' &&
					typeof item.from === 'string' &&
					typeof item.to === 'string',
			)
			.map(item => ({
				id: String(item.id),
				from: String(item.from),
				to: String(item.to),
				fromSide: isThoughtPortSide(item.fromSide) ? item.fromSide : 'right',
				toSide: isThoughtPortSide(item.toSide) ? item.toSide : 'left',
				label: typeof item.label === 'string' ? item.label : '',
				color:
					typeof item.color === 'string'
						? item.color
						: DEFAULT_THOUGHT_TEXT_COLOR,
				fontSize: Number(item.fontSize) || DEFAULT_THOUGHT_TEXT_SIZE,
			}))
	}

	function sanitizeThoughtTexts(value: unknown): ThoughtText[] {
		if (!Array.isArray(value)) return []
		return value
			.filter(item => isRecord(item) && typeof item.id === 'string')
			.map(item => ({
				id: String(item.id),
				text: typeof item.text === 'string' ? item.text : '文字',
				x: Math.max(
					0,
					Math.min(getThoughtBoardWidth() - 80, Number(item.x) || 0),
				),
				y: Math.max(
					0,
					Math.min(THOUGHT_BOARD_HEIGHT - 40, Number(item.y) || 0),
				),
				color:
					typeof item.color === 'string'
						? item.color
						: DEFAULT_THOUGHT_TEXT_COLOR,
				fontSize: Number(item.fontSize) || DEFAULT_THOUGHT_TEXT_SIZE,
			}))
	}

	function sanitizeThoughtBoardData(value: unknown): ThoughtBoardData {
		if (Array.isArray(value)) {
			return { nodes: sanitizeThoughtNodes(value), links: [], texts: [] }
		}
		if (!isRecord(value)) return { nodes: [], links: [], texts: [] }
		return {
			nodes: sanitizeThoughtNodes(value.nodes),
			links: sanitizeThoughtLinks(value.links),
			texts: sanitizeThoughtTexts(value.texts),
		}
	}

	function loadThoughtBoard() {
		const key = getThoughtBoardKey()
		if (!key) {
			thoughtNodes.value = []
			thoughtLinks.value = []
			thoughtTexts.value = []
			return
		}
		try {
			const data = sanitizeThoughtBoardData(
				JSON.parse(localStorage.getItem(key) || '[]'),
			)
			thoughtNodes.value = data.nodes
			thoughtLinks.value = data.links
			thoughtTexts.value = data.texts
		} catch {
			thoughtNodes.value = []
			thoughtLinks.value = []
			thoughtTexts.value = []
		}
		syncThoughtSources(false)
	}

	function saveThoughtBoard() {
		const key = getThoughtBoardKey()
		if (!key) return
		localStorage.setItem(
			key,
			JSON.stringify({
				nodes: thoughtNodes.value,
				links: thoughtLinks.value,
				texts: thoughtTexts.value,
			}),
		)
	}

	function syncThoughtSources(forceReset: boolean) {
		if (!room.value) {
			thoughtNodes.value = []
			thoughtLinks.value = []
			thoughtTexts.value = []
			return
		}
		if (forceReset) {
			thoughtNodes.value = []
			thoughtLinks.value = []
			thoughtTexts.value = []
		}
		const existing = new Map(
			thoughtNodes.value
				.filter(node => node.sourceQuestionId)
				.map(node => [node.sourceQuestionId, node]),
		)
		let changed = false
		thoughtSourceQuestions.value.forEach((question, index) => {
			const node = existing.get(question.id)
			if (node) {
				const nextKind = getThoughtNodeKind(question)
				if (node.kind !== nextKind) {
					node.kind = nextKind
					changed = true
				}
				return
			}
			thoughtNodes.value.push(createThoughtNodeFromQuestion(question, index))
			changed = true
		})
		if (changed || forceReset) saveThoughtBoard()
	}

	function openThoughtBoard() {
		if (!room.value) {
			ElMessage.warning('请先进入房间')
			return
		}
		syncThoughtSources(false)
		thoughtBoardOpen.value = true
	}

	function updateThoughtNodeText(nodeId: string, text: string) {
		const node = thoughtNodes.value.find(item => item.id === nodeId)
		if (!node) return
		node.text = text
		saveThoughtBoard()
	}

	function addThoughtNode() {
		if (!room.value) return ElMessage.warning('请先进入房间')
		const text = thoughtDraftText.value.trim() || '新的推理节点'
		const offset = thoughtNodes.value.filter(
			node => node.kind === 'custom',
		).length
		const boardWidth = getThoughtBoardWidth()
		thoughtNodes.value.push({
			id: `custom:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`,
			kind: 'custom',
			text,
			x: Math.min(
				boardWidth - THOUGHT_NODE_WIDTH - 40,
				880 + (offset % 2) * 54,
			),
			y: 36 + (offset % 5) * 128,
			width: THOUGHT_NODE_WIDTH,
			height: THOUGHT_NODE_HEIGHT,
		})
		thoughtDraftText.value = ''
		saveThoughtBoard()
	}

	function removeThoughtNode(nodeId: string) {
		thoughtNodes.value = thoughtNodes.value.filter(node => node.id !== nodeId)
		thoughtLinks.value = thoughtLinks.value.filter(
			link => link.from !== nodeId && link.to !== nodeId,
		)
		if (selectedThoughtNodeId.value === nodeId) selectedThoughtNodeId.value = ''
		if (draggingThoughtLink.value?.from === nodeId)
			draggingThoughtLink.value = null
		saveThoughtBoard()
	}

	function syncThoughtBoard() {
		syncThoughtSources(false)
		ElMessage.success('已同步最新线索')
	}

	function startThoughtBoardResize(event: PointerEvent) {
		if (isMobile.value) return
		resizingThoughtBoard.value = {
			startY: event.clientY,
			startHeight: thoughtBoardHeight.value,
		}
		;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
	}

	function resizeThoughtBoard(event: PointerEvent) {
		if (!resizingThoughtBoard.value || isMobile.value) return
		const viewportHeight = Math.max(window.innerHeight, 1)
		const deltaPercent =
			((resizingThoughtBoard.value.startY - event.clientY) / viewportHeight) *
			100
		thoughtBoardHeight.value = Math.max(
			66,
			Math.min(100, resizingThoughtBoard.value.startHeight + deltaPercent),
		)
	}

	function stopThoughtBoardResize() {
		resizingThoughtBoard.value = null
	}

	function maximizeThoughtBoard() {
		thoughtBoardHeight.value = 100
	}

	function clearThoughtBoardStorage(roomCode = room.value?.code) {
		const key = roomCode ? getThoughtBoardKeyForRoom(roomCode) : ''
		if (key) localStorage.removeItem(key)
		thoughtNodes.value = []
		thoughtLinks.value = []
		thoughtTexts.value = []
		selectedThoughtNodeId.value = ''
		selectedThoughtLinkId.value = ''
		editingThoughtLinkId.value = ''
		selectedThoughtTextId.value = ''
		editingThoughtTextId.value = ''
		draggingThoughtLink.value = null
	}

	function selectThoughtNode(node: ThoughtNode) {
		selectedThoughtNodeId.value = node.id
		selectedThoughtLinkId.value = ''
		selectedThoughtTextId.value = ''
	}

	function selectThoughtLink(linkId: string) {
		selectedThoughtLinkId.value = linkId
		selectedThoughtNodeId.value = ''
		selectedThoughtTextId.value = ''
	}

	function selectThoughtText(textId: string) {
		selectedThoughtTextId.value = textId
		selectedThoughtNodeId.value = ''
		selectedThoughtLinkId.value = ''
	}

	function editThoughtLink(linkId: string) {
		selectThoughtLink(linkId)
		editingThoughtLinkId.value = linkId
		nextTick(() => {
			document
				.querySelector<HTMLInputElement>(
					`[data-thought-link-input="${linkId}"]`,
				)
				?.focus()
		})
	}

	function editThoughtText(textId: string) {
		selectThoughtText(textId)
		draggingThoughtText.value = null
		editingThoughtTextId.value = textId
		nextTick(() => {
			document
				.querySelector<HTMLTextAreaElement>(
					`[data-thought-text-input="${textId}"]`,
				)
				?.focus()
		})
	}

	function updateSelectedThoughtStyle(patch: {
		color?: string
		fontSize?: number
	}) {
		const target = selectedThoughtStyleTarget.value
		if (!target) return
		if (typeof patch.color === 'string') target.item.color = patch.color
		if (typeof patch.fontSize === 'number') {
			target.item.fontSize = Math.max(12, Math.min(42, patch.fontSize))
		}
		saveThoughtBoard()
	}

	function updateSelectedThoughtFontSize(event: Event) {
		const value = Number((event.target as HTMLInputElement).value)
		if (!Number.isNaN(value)) selectedThoughtFontSize.value = value
	}

	function updateThoughtText(textId: string, text: string) {
		const item = thoughtTexts.value.find(value => value.id === textId)
		if (!item) return
		item.text = text
		saveThoughtBoard()
	}

	function removeThoughtText(textId: string) {
		thoughtTexts.value = thoughtTexts.value.filter(item => item.id !== textId)
		if (selectedThoughtTextId.value === textId) selectedThoughtTextId.value = ''
		if (editingThoughtTextId.value === textId) editingThoughtTextId.value = ''
		saveThoughtBoard()
	}

	function addThoughtTextAt(x: number, y: number) {
		const id = `text:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`
		thoughtTexts.value.push({
			id,
			text: '双击编辑文字',
			x: Math.max(0, Math.min(getThoughtBoardWidth() - 160, x)),
			y: Math.max(0, Math.min(THOUGHT_BOARD_HEIGHT - 60, y)),
			color: DEFAULT_THOUGHT_TEXT_COLOR,
			fontSize: DEFAULT_THOUGHT_TEXT_SIZE,
		})
		selectedThoughtTextId.value = id
		editingThoughtTextId.value = id
		selectedThoughtNodeId.value = ''
		selectedThoughtLinkId.value = ''
		saveThoughtBoard()
	}

	function handleThoughtCanvasDoubleClick(event: MouseEvent) {
		const target = event.target as HTMLElement
		if (target.closest('.thought-node, .thought-text, .thought-link-label'))
			return
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
		addThoughtTextAt(event.clientX - rect.left, event.clientY - rect.top)
	}

	function startThoughtTextDrag(event: PointerEvent, item: ThoughtText) {
		const target = event.target as HTMLElement
		if (target.closest('textarea, input, button')) return
		if (event.detail > 1) {
			event.preventDefault()
			editThoughtText(item.id)
			return
		}
		selectThoughtText(item.id)
		draggingThoughtText.value = {
			id: item.id,
			startX: event.clientX,
			startY: event.clientY,
			originX: item.x,
			originY: item.y,
		}
		;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
	}

	function moveThoughtTextDrag(event: PointerEvent) {
		if (!draggingThoughtText.value) return
		const item = thoughtTexts.value.find(
			text => text.id === draggingThoughtText.value?.id,
		)
		if (!item) return
		item.x = Math.max(
			0,
			Math.min(
				getThoughtBoardWidth() - 80,
				draggingThoughtText.value.originX +
					event.clientX -
					draggingThoughtText.value.startX,
			),
		)
		item.y = Math.max(
			0,
			Math.min(
				THOUGHT_BOARD_HEIGHT - 40,
				draggingThoughtText.value.originY +
					event.clientY -
					draggingThoughtText.value.startY,
			),
		)
	}

	function stopThoughtTextDrag() {
		if (!draggingThoughtText.value) return
		draggingThoughtText.value = null
		saveThoughtBoard()
	}

	function addThoughtLink(
		from: string,
		to: string,
		fromSide: ThoughtPortSide,
		toSide: ThoughtPortSide,
	) {
		const exists = thoughtLinks.value.some(
			link =>
				(link.from === from && link.to === to) ||
				(link.from === to && link.to === from),
		)
		if (exists) {
			ElMessage.warning('这两个节点已经连接过了')
			return
		}
		thoughtLinks.value.push({
			id: `link:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`,
			from,
			to,
			fromSide,
			toSide,
			label: '',
			color: DEFAULT_THOUGHT_TEXT_COLOR,
			fontSize: DEFAULT_THOUGHT_TEXT_SIZE,
		})
		saveThoughtBoard()
	}

	function updateThoughtLinkLabel(linkId: string, label: string) {
		const link = thoughtLinks.value.find(item => item.id === linkId)
		if (!link) return
		link.label = label
		saveThoughtBoard()
	}

	function removeThoughtLink(linkId: string) {
		thoughtLinks.value = thoughtLinks.value.filter(link => link.id !== linkId)
		if (selectedThoughtLinkId.value === linkId) selectedThoughtLinkId.value = ''
		if (editingThoughtLinkId.value === linkId) editingThoughtLinkId.value = ''
		saveThoughtBoard()
	}

	function getThoughtPortPoint(
		nodeId: string,
		side: ThoughtPortSide = 'right',
	) {
		const node = thoughtNodes.value.find(item => item.id === nodeId)
		if (!node) return null
		const points: Record<ThoughtPortSide, { x: number; y: number }> = {
			top: { x: node.x + node.width / 2, y: node.y },
			right: { x: node.x + node.width, y: node.y + node.height / 2 },
			bottom: { x: node.x + node.width / 2, y: node.y + node.height },
			left: { x: node.x, y: node.y + node.height / 2 },
		}
		return points[side]
	}

	function getThoughtCurvePath(
		from: { x: number; y: number },
		to: { x: number; y: number },
		fromSide: ThoughtPortSide,
		toSide: ThoughtPortSide,
	) {
		const distance = Math.hypot(to.x - from.x, to.y - from.y)
		const offset = Math.max(80, Math.min(190, distance * 0.36))
		const direction = (side: ThoughtPortSide) =>
			({
				top: { x: 0, y: -1 },
				right: { x: 1, y: 0 },
				bottom: { x: 0, y: 1 },
				left: { x: -1, y: 0 },
			})[side]
		const fromDirection = direction(fromSide)
		const toDirection = direction(toSide)
		const c1 = {
			x: from.x + fromDirection.x * offset,
			y: from.y + fromDirection.y * offset,
		}
		const c2 = {
			x: to.x + toDirection.x * offset,
			y: to.y + toDirection.y * offset,
		}
		return `M ${from.x} ${from.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${to.x} ${to.y}`
	}

	function thoughtLinkGeometry(link: ThoughtLink) {
		const fromSide = link.fromSide ?? 'right'
		const toSide = link.toSide ?? 'left'
		const from = getThoughtPortPoint(link.from, link.fromSide ?? 'right')
		const to = getThoughtPortPoint(link.to, link.toSide ?? 'left')
		if (!from || !to) return null
		const dx = to.x - from.x
		const dy = to.y - from.y
		return {
			x1: from.x,
			y1: from.y,
			x2: to.x,
			y2: to.y,
			midX: from.x + dx / 2,
			midY: from.y + dy / 2,
			length: Math.sqrt(dx * dx + dy * dy),
			angle: (Math.atan2(dy, dx) * 180) / Math.PI,
			path: getThoughtCurvePath(from, to, fromSide, toSide),
		}
	}

	function getThoughtCanvasPoint(event: PointerEvent) {
		const canvas = (event.currentTarget as HTMLElement).closest(
			'.thought-canvas',
		)
		const rect = canvas?.getBoundingClientRect()
		if (!rect) return { x: 0, y: 0 }
		return {
			x: event.clientX - rect.left,
			y: event.clientY - rect.top,
		}
	}

	function findThoughtPortSnap(
		x: number,
		y: number,
		sourceNodeId: string,
	): Pick<ThoughtLinkDragState, 'snapNodeId' | 'snapSide'> {
		let best:
			| { nodeId: string; side: ThoughtPortSide; distance: number }
			| undefined
		thoughtNodes.value.forEach(node => {
			if (node.id === sourceNodeId) return
			;(['top', 'right', 'bottom', 'left'] as ThoughtPortSide[]).forEach(
				side => {
					const point = getThoughtPortPoint(node.id, side)
					if (!point) return
					const distance = Math.hypot(point.x - x, point.y - y)
					if (distance <= 54 && (!best || distance < best.distance)) {
						best = { nodeId: node.id, side, distance }
					}
				},
			)
		})
		return best ? { snapNodeId: best.nodeId, snapSide: best.side } : {}
	}

	function startThoughtLinkDrag(
		event: PointerEvent,
		node: ThoughtNode,
		side: ThoughtPortSide,
	) {
		selectedThoughtNodeId.value = node.id
		const point = getThoughtPortPoint(node.id, side)
		if (!point) return
		draggingThoughtLink.value = {
			from: node.id,
			fromSide: side,
			startX: point.x,
			startY: point.y,
			x: point.x,
			y: point.y,
		}
		;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
	}

	function moveThoughtLinkDrag(event: PointerEvent) {
		if (!draggingThoughtLink.value) return
		const point = getThoughtCanvasPoint(event)
		const snap = findThoughtPortSnap(
			point.x,
			point.y,
			draggingThoughtLink.value.from,
		)
		draggingThoughtLink.value = {
			...draggingThoughtLink.value,
			x: point.x,
			y: point.y,
			...snap,
		}
	}

	function stopThoughtLinkDrag() {
		const drag = draggingThoughtLink.value
		if (!drag) return
		if (drag.snapNodeId && drag.snapSide) {
			addThoughtLink(drag.from, drag.snapNodeId, drag.fromSide, drag.snapSide)
		}
		draggingThoughtLink.value = null
	}

	function startThoughtDrag(event: PointerEvent, node: ThoughtNode) {
		const target = event.target as HTMLElement
		if (target.closest('textarea, button')) return
		selectedThoughtNodeId.value = node.id
		draggingThoughtNode.value = {
			id: node.id,
			startX: event.clientX,
			startY: event.clientY,
			originX: node.x,
			originY: node.y,
		}
		;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
	}

	function moveThoughtDrag(event: PointerEvent) {
		if (!draggingThoughtNode.value) return
		const node = thoughtNodes.value.find(
			item => item.id === draggingThoughtNode.value?.id,
		)
		if (!node) return
		const next = clampThoughtNode({
			...node,
			x:
				draggingThoughtNode.value.originX +
				event.clientX -
				draggingThoughtNode.value.startX,
			y:
				draggingThoughtNode.value.originY +
				event.clientY -
				draggingThoughtNode.value.startY,
		})
		node.x = next.x
		node.y = next.y
	}

	function stopThoughtDrag() {
		if (!draggingThoughtNode.value) return
		draggingThoughtNode.value = null
		saveThoughtBoard()
	}

	function thoughtNodeClass(node: ThoughtNode) {
		return [
			'thought-node',
			node.kind,
			{
				selected: selectedThoughtNodeId.value === node.id,
				'link-source': draggingThoughtLink.value?.from === node.id,
				'link-target': draggingThoughtLink.value?.snapNodeId === node.id,
			},
		]
	}

	function thoughtNodeLabel(kind: ThoughtNodeKind) {
		return {
			important: '重要',
			yes: '是',
			no: '不是',
			custom: '推理',
		}[kind]
	}

	function isHostImportantHint(question: Question) {
		return Boolean(
			question.important &&
			room.value?.host.id &&
			question.author.id === room.value.host.id,
		)
	}

	function hasClueSignal(question: Question) {
		return hasImportantSignal(question) && !isHostImportantHint(question)
	}

	function getQuestionSortTime(question: Question) {
		const cached = questionSortTimes.get(question.id)
		if (typeof cached === 'number') return cached
		const parsed = new Date(question.createdAt).getTime()
		const sortTime = Number.isFinite(parsed) ? parsed : Date.now()
		questionSortTimes.set(question.id, sortTime)
		return sortTime
	}

	function upsertQuestion(question: Question) {
		if (!room.value) return
		const nextQuestion = hydrateQuestion(question)
		const pendingQuestion = removePendingQuestionFor(nextQuestion)
		if (pendingQuestion) {
			const pendingSortTime = questionSortTimes.get(pendingQuestion.id)
			nextQuestion.clientKey = pendingQuestion.clientKey ?? pendingQuestion.id
			nextQuestion.clientSortAt =
				pendingQuestion.clientSortAt ?? pendingQuestion.createdAt
			if (typeof pendingSortTime === 'number') {
				questionSortTimes.set(nextQuestion.id, pendingSortTime)
			}
			questionSortTimes.delete(pendingQuestion.id)
		}
		getQuestionSortTime(nextQuestion)
		const index = room.value.questions.findIndex(
			item => item.id === nextQuestion.id,
		)
		if (index >= 0) {
			const existingQuestion = room.value.questions[index]
			nextQuestion.clientKey =
				nextQuestion.clientKey ?? existingQuestion.clientKey
			nextQuestion.clientSortAt =
				nextQuestion.clientSortAt ?? existingQuestion.clientSortAt
			room.value.questions.splice(index, 1, nextQuestion)
		} else {
			room.value.questions.unshift(nextQuestion)
		}
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
				source.backgroundImageDataUrl ??
				DEFAULT_AMBIENCE.backgroundImageDataUrl,
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
				const hydratedRoom = mergeRoomWithLocalQuestions(nextRoom)
				room.value = hydratedRoom
				selectedRole.value = canHost.value ? 'host' : 'player'
				syncAmbienceFromRoom(hydratedRoom)
				syncSelectedSoupFromRoom(hydratedRoom)
				if (hydratedRoom.settlement)
					settlement.value = hydrateSettlement(hydratedRoom.settlement)
				if (hydratedRoom.mvp)
					mvpResult.value = hydrateMvpResult(hydratedRoom.mvp)
				nextTick(() => restoreCanvas())
			})
			socket.on(
				'room-reset',
				(event: {
					roomCode: string
					room?: RoomState
					message: string
					at: string
				}) => {
					if (event.roomCode !== room.value?.code) return
					resetRoundState(event.room)
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
				const hydratedSettlement = hydrateSettlement(nextSettlement)
				settlement.value = hydratedSettlement
				settlementDialogOpen.value = true
				if (room.value) {
					room.value.revealed = true
					room.value.solved = true
					room.value.settlement = hydratedSettlement ?? undefined
				}
			})
			socket.on('room-mvp-selected', (nextMvp: MvpResult) => {
				const hydratedMvp = hydrateMvpResult(nextMvp)
				mvpResult.value = hydratedMvp
				if (room.value) room.value.mvp = hydratedMvp
				mvpSelectDialogOpen.value = false
				mvpResultDialogOpen.value = true
			})
			socket.on(
				'question-added',
				(event: { roomCode: string; question: Question }) => {
					if (event.roomCode !== room.value?.code) return
					upsertQuestion(event.question)
				},
			)
			socket.on(
				'question-updated',
				(event: { roomCode: string; question: Question }) => {
					if (event.roomCode !== room.value?.code) return
					upsertQuestion(event.question)
				},
			)
			socket.on(
				'question-removed',
				(event: { roomCode: string; questionId: string }) => {
					if (event.roomCode !== room.value?.code) return
					removeQuestionLocally(event.questionId)
				},
			)
			socket.on('room-members', (members: RoomMember[]) => {
				roomMembers.value = members.map(hydrateRoomMember)
			})
			socket.on('room-presence', (event: PresenceEvent) => {
				const notifyKey = `${event.type}:${event.user.userId}`
				const now = Date.now()
				if ((presenceNotifyAt.get(notifyKey) ?? 0) + 2000 > now) return
				presenceNotifyAt.set(notifyKey, now)
				presenceEvents.value = [
					{ ...event, user: hydrateRoomMember(event.user) },
					...presenceEvents.value,
				].slice(0, 5)
				const notify =
					event.type === 'join' ? ElMessage.success : ElMessage.info
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
		const safeSurface = sanitizeRichText(room.value.surface)
		const safeAnswer = sanitizeRichText(room.value.answer)
		if (room.value.surface !== safeSurface) room.value.surface = safeSurface
		if (room.value.answer !== safeAnswer) room.value.answer = safeAnswer
		const nextAmbience = { ...ambienceDraft, musicVolume: ambienceVolume.value }
		const basePayload = {
			title: room.value.title,
			surface: safeSurface,
			answer: safeAnswer,
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
			const nextRoom = hydrateRoom(data)
			rememberRoomAmbience(nextRoom.code, nextAmbience)
			room.value = nextRoom
			syncAmbienceFromRoom(nextRoom)
		} catch (error) {
			if (ambienceServerUnsupported.value || !room.value) throw error
			rememberRoomAmbience(room.value.code, nextAmbience)
			const data = await request<RoomState>(`/rooms/${room.value.code}`, {
				method: 'PATCH',
				body: JSON.stringify(basePayload),
			})
			ambienceServerUnsupported.value = true
			const nextRoom = hydrateRoom(data)
			room.value = nextRoom
			syncAmbienceFromRoom(nextRoom)
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
		const pendingQuestion = createPendingQuestion(text)
		upsertQuestion(pendingQuestion)
		questionText.value = ''
		if (isMobile.value) mobileAskExpanded.value = true
		await nextTick()
		questionInputRef.value?.focus?.()
		try {
			const response = await request<Question | QuestionMutationResponse>(
				`/rooms/${room.value.code}/questions`,
				{
					method: 'POST',
					body: JSON.stringify({ text }),
				},
			)
			if (isQuestionMutationResponse(response)) {
				replacePendingQuestion(pendingQuestion.id, response.question)
				return
			}
			const question = response
			replacePendingQuestion(pendingQuestion.id, question)
		} catch (error) {
			markPendingQuestionFailed(pendingQuestion.id)
			ElMessage.error(error instanceof Error ? error.message : '发送失败')
		} finally {
			sendingQuestion.value = false
		}
	}

	async function submitQuestionFromBigScreen(value?: string) {
		if (typeof value === 'string') questionText.value = value
		await addQuestion()
	}

	function updateRoomField(
		field: 'title' | 'surface' | 'answer',
		value: string,
	) {
		if (!room.value) return
		room.value[field] = value
	}

	async function setVerdict(questionId: string, verdict: Verdict) {
		if (!canHost.value || !room.value) return
		const response = await request<QuestionPatchResponse>(
			`/rooms/${room.value.code}/questions/${questionId}`,
			{
				method: 'PATCH',
				body: JSON.stringify({ verdict }),
			},
		)
		applyQuestionPatchResponse(response)
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
		const response = await request<QuestionPatchResponse>(
			`/rooms/${room.value.code}/questions/${question.id}`,
			{
				method: 'PATCH',
				body: JSON.stringify(patch),
			},
		)
		applyQuestionPatchResponse(response)
	}

	async function toggleImportant(question: Question) {
		if (!canHost.value || !room.value) return
		const response = await request<QuestionPatchResponse>(
			`/rooms/${room.value.code}/questions/${question.id}`,
			{
				method: 'PATCH',
				body: JSON.stringify({ important: !question.important }),
			},
		)
		applyQuestionPatchResponse(response)
	}

	function openMemberImportant(member: MemberStats) {
		selectedMember.value = member
		memberDialogOpen.value = true
	}

	function openSoupHistoryDetail(item: SoupHistoryItem) {
		selectedSoupHistoryItem.value = item
		soupHistoryDetailOpen.value = true
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
		room.value = hydrateRoom(data)
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
		settlement.value = hydrateSettlement(
			await request<Settlement>(`/rooms/${room.value.code}/reveal`, {
				method: 'POST',
			}),
		)
		settlementDialogOpen.value = true
		await joinRoom(room.value.code, false)
	}

	function handleSettlementClosed() {
		if (!canHost.value || !room.value?.revealed || room.value.mvp) return
		if (!settlement.value?.entries.length) return
		if (!mvpCandidates.value.length) {
			ElMessage.info('本轮暂无可评定 MVP 的玩家')
			return
		}
		selectedMvpUserId.value = mvpCandidates.value[0]?.id ?? ''
		mvpSelectDialogOpen.value = true
	}

	async function submitMvpSelection() {
		if (!room.value || !selectedMvpUserId.value) {
			ElMessage.warning('请选择一位 MVP 玩家')
			return
		}
		mvpSubmitting.value = true
		try {
			const data = await request<MvpResult>(`/rooms/${room.value.code}/mvp`, {
				method: 'POST',
				body: JSON.stringify({ userId: selectedMvpUserId.value }),
			})
			const hydratedMvp = hydrateMvpResult(data)
			mvpResult.value = hydratedMvp
			room.value.mvp = hydratedMvp
			mvpSelectDialogOpen.value = false
			mvpResultDialogOpen.value = true
			ElMessage.success('本轮 MVP 已公布')
		} catch (error) {
			ElMessage.error(error instanceof Error ? error.message : '评定 MVP 失败')
		} finally {
			mvpSubmitting.value = false
		}
	}

	async function rateCurrentSoup(rating: number) {
		if (!room.value || !canRateCurrentSoup.value) return
		try {
			const data = await request<RoomState>(
				`/rooms/${room.value.code}/rating`,
				{
					method: 'POST',
					body: JSON.stringify({ rating }),
				},
			)
			room.value = hydrateRoom(data)
			ElMessage.success('评分已提交')
		} catch (error) {
			ElMessage.error(error instanceof Error ? error.message : '评分失败')
		}
	}

	async function uploadAvatar(file: File) {
		const dataUrl = await fileToDataUrl(file)
		const updatedUser = await request<AuthUser>('/auth/me', {
			method: 'PATCH',
			body: JSON.stringify({ avatarDataUrl: dataUrl }),
		})
		rememberAvatar(updatedUser.id, dataUrl)
		user.value = hydrateUserAvatar({ ...updatedUser, avatarDataUrl: dataUrl })
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
		const response = await request<QuestionDeleteResponse>(
			`/rooms/${room.value.code}/questions/${questionId}`,
			{
				method: 'DELETE',
			},
		)
		applyQuestionDeleteResponse(response)
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

	return {
		activeAmbiencePreset,
		activeBackdropCss,
		activeBackgroundImage,
		activeBackgroundLabel,
		activeInsightMode,
		activeInsightQuestions,
		activeInsightTitle,
		activeMusicDataUrl,
		activePanel,
		addQuestion,
		addThoughtLink,
		addThoughtNode,
		addThoughtTextAt,
		AMBIENCE_PRESETS,
		ambienceDirty,
		ambienceDraft,
		ambiencePersistWarned,
		ambiencePreviewStyle,
		ambienceServerUnsupported,
		ambienceVolume,
		answeredQuestions,
		answerHidden,
		applyAmbiencePatch,
		applyBackgroundFile,
		applyMobileVerdict,
		applyMusicFile,
		applyQuestionDeleteResponse,
		applyQuestionPatchResponse,
		applyRoom,
		audioRef,
		authForm,
		authFormRef,
		authMode,
		authRules,
		authSubmitting,
		avatarCache,
		beforeAvatarUpload,
		beforeBackgroundUpload,
		beforeMusicUpload,
		brushColor,
		brushSize,
		canHost,
		canRateCurrentSoup,
		canTransferHostTo,
		canvasRef,
		canvasWrapRef,
		chatQuestions,
		chooseAmbiencePreset,
		clampThoughtNode,
		clampVolume,
		clearBackgroundImage,
		clearCanvas,
		clearMusic,
		clearThoughtBoardStorage,
		closeCustomSoupDialog,
		confirmedQuestions,
		connectSocket,
		copyShareUrl,
		createCustomSoup,
		createPendingQuestion,
		createRoom,
		createThoughtNodeFromQuestion,
		creatingSoup,
		cssUrl,
		currentSoupRating,
		customSoup,
		customSoupFormRef,
		customSoupOpen,
		customSoupRules,
		DEFAULT_THOUGHT_TEXT_COLOR,
		DEFAULT_THOUGHT_TEXT_SIZE,
		deleteSoup,
		deletingSoupId,
		difficultyLabels,
		draggingThoughtLink,
		draggingThoughtNode,
		draggingThoughtText,
		draw,
		editingSoupId,
		editingThoughtLinkId,
		editingThoughtTextId,
		editThoughtLink,
		editThoughtText,
		emitCanvasPreview,
		fileToDataUrl,
		filteredQuestionBase,
		findThoughtPortSnap,
		formatTime,
		getCanvasPoint,
		getHistoryMvpQuestions,
		getHistoryMvpUser,
		getInitialRoomCode,
		getQuestionSortTime,
		getThoughtBoardKey,
		getThoughtBoardKeyForRoom,
		getThoughtBoardWidth,
		getThoughtCanvasPoint,
		getThoughtCurvePath,
		getThoughtNodeKind,
		getThoughtPortPoint,
		handleBeforeUnload,
		handleSettlementClosed,
		handleThoughtCanvasDoubleClick,
		hasClueSignal,
		hasCustomAmbience,
		highlightQuestionText,
		hostBackdropCss,
		hostImportantHints,
		hydrateMvpResult,
		hydrateQuestion,
		hydrateRoom,
		hydrateRoomMember,
		hydrateSettlement,
		hydrateSoupHistoryItem,
		importantQuestions,
		insightDrawerOpen,
		isAmbiencePresetId,
		isDark,
		isDrawing,
		isHostImportantHint,
		isMobile,
		isQuestionMutationResponse,
		isRecord,
		isRoomState,
		joinRoom,
		joinSocketRoom,
		lastPoint,
		leaveCurrentRoom,
		leaveRoomByUser,
		liveLeaderboard,
		loadAvatarCache,
		loadCachedAmbience,
		loadSoups,
		loadTheme,
		loadThoughtBoard,
		logout,
		markPendingQuestionFailed,
		maximizeThoughtBoard,
		memberDialogOpen,
		memberStats,
		mergeRoomWithLocalQuestions,
		mobileAskExpanded,
		mobileHostActionOpen,
		mobileHostActionQuestion,
		mobileRecentMyQuestions,
		moveThoughtDrag,
		moveThoughtLinkDrag,
		moveThoughtTextDrag,
		musicPlaying,
		mvpCandidates,
		mvpImportantQuestions,
		mvpResult,
		mvpResultDialogOpen,
		mvpSelectDialogOpen,
		mvpSubmitting,
		myQuestions,
		mySoupRating,
		normalizeAmbience,
		normalizedQuestionSearch,
		openCreateSoupDialog,
		openEditSoupDialog,
		openHostAction,
		openInsightDrawer,
		openMemberImportant,
		openRoomSetup,
		openSoupHistoryDetail,
		openThoughtBoard,
		openToolDock,
		pendingQuestions,
		persistAvatarCache,
		presenceEvents,
		presenceNotifyAt,
		qualityLabels,
		questionFilterOptions,
		questionInputRef,
		questionResultHint,
		questionSearchTerms,
		questionSearchText,
		questionSignalTags,
		questionSortTimes,
		questionText,
		questionViewMode,
		queueCanvasPreview,
		queueRoomSave,
		rateCurrentSoup,
		rememberAvatar,
		rememberRoomAmbience,
		removedQuestionIds,
		removeMobileQuestion,
		removePendingQuestionFor,
		removeQuestion,
		removeQuestionLocally,
		removeThoughtLink,
		removeThoughtNode,
		removeThoughtText,
		replacePendingQuestion,
		resetAmbience,
		resetCustomSoupForm,
		resetRoundState,
		resizeCanvas,
		resizeThoughtBoard,
		resizingThoughtBoard,
		restoreCanvas,
		restoreSession,
		revealAnswer,
		revealQuestion,
		richTextLengthValidator,
		room,
		roomAmbienceCache,
		roomBackdropStyle,
		roomCodeInput,
		roomMembers,
		roomMusicDataUrl,
		roomMusicName,
		roomSetupMode,
		roomSetupOpen,
		ruledOutQuestions,
		sanitizeRichText,
		sanitizeThoughtBoardData,
		sanitizeThoughtLinks,
		sanitizeThoughtNodes,
		sanitizeThoughtTexts,
		saveCanvas,
		saveRoom,
		saveSoupFromBigScreen,
		saveThoughtBoard,
		savingRoom,
		selectedMember,
		selectedMvpUserId,
		selectedQuestionId,
		selectedRole,
		selectedSoupHistoryItem,
		selectedSoupId,
		selectedThoughtColor,
		selectedThoughtFontSize,
		selectedThoughtLinkId,
		selectedThoughtNodeId,
		selectedThoughtStyleTarget,
		selectedThoughtTextId,
		selectThoughtLink,
		selectThoughtNode,
		selectThoughtText,
		sendingQuestion,
		settlement,
		settlementDialogOpen,
		setVerdict,
		shareUrl,
		socketStatus,
		sortedQuestions,
		soupDrawerDirection,
		soupHistory,
		soupHistoryDetailOpen,
		soupManagerOpen,
		soups,
		startDrawing,
		startThoughtBoardResize,
		startThoughtDrag,
		startThoughtLinkDrag,
		startThoughtTextDrag,
		stopDrawing,
		stopThoughtBoardResize,
		stopThoughtDrag,
		stopThoughtLinkDrag,
		stopThoughtTextDrag,
		submitAuth,
		submitAuthFromBigScreen,
		submitMvpSelection,
		submitQuestionFromBigScreen,
		surfaceViewMode,
		switchRoomSoup,
		syncAmbienceFromRoom,
		syncingAmbience,
		syncSelectedSoupFromRoom,
		syncThoughtBoard,
		syncThoughtSources,
		THOUGHT_BOARD_HEIGHT,
		thoughtBoardDrawerSize,
		thoughtBoardHeight,
		thoughtBoardOpen,
		thoughtBoardWidth,
		thoughtDraftText,
		thoughtLinkGeometry,
		thoughtLinkPreview,
		thoughtLinks,
		thoughtLinkViews,
		thoughtNodeClass,
		thoughtNodeLabel,
		thoughtNodes,
		thoughtNodeStats,
		thoughtSourceQuestions,
		thoughtTexts,
		timelineRef,
		toggleImportant,
		toggleMobileImportant,
		toggleMusicPlayback,
		toggleQuestionSelection,
		token,
		toolDockOpen,
		transferHost,
		truthGuessLabels,
		updateMobileQuestionScoring,
		updateQuestionScoring,
		updateRoomField,
		updateSelectedThoughtFontSize,
		updateSelectedThoughtStyle,
		updateShareUrl,
		updateThoughtLinkLabel,
		updateThoughtNodeText,
		updateThoughtText,
		updateViewportState,
		uploadAvatar,
		upsertQuestion,
		useHostBackground,
		user,
		useRoomMusic,
		verdictLabels,
		verdictTypes,
		visibleQuestions,
	}
}
