<script setup lang="ts">
import {
	CircleClose,
	CopyDocument,
	EditPen,
	Flag,
	House,
	Lock,
	Right,
	SwitchButton,
	User,
	VideoPlay,
} from '@element-plus/icons-vue'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus/es/components/message/index.mjs'
import BigScreenChatFeed from '@/components/BigScreenChatFeed.vue'
import RichTextEditor from '@/components/BigScreenRichTextEditor.vue'
import { richTextToPlainText, sanitizeRichText } from '../utils/richText.ts'

type Verdict = 'yes' | 'no' | 'both' | 'irrelevant'
type SurfaceViewMode = 'preview' | 'edit'
type Difficulty = 'easy' | 'medium' | 'hard'
type AuthMode = 'login' | 'register'
type QuestionQuality = 'none' | 'helpful' | 'key' | 'breakthrough'
type TruthGuess = 'none' | 'clue' | 'motive' | 'full'

interface AuthUser {
	id: string
	username: string
	displayName: string
	avatarDataUrl?: string
	points?: number
	rankTitle?: string
}

interface Question {
	id: string
	clientKey?: string
	clientSortAt?: string
	text: string
	verdict?: Verdict | null
	important: boolean
	quality?: QuestionQuality
	truthGuess?: TruthGuess
	firstCoreClue?: boolean
	firstMainLogic?: boolean
	firstFullSolve?: boolean
	author: AuthUser
	createdAt: string
	clientStatus?: 'sending' | 'failed'
}

interface RoomState {
	code: string
	title: string
	surface: string
	answer?: string
	revealed: boolean
	solved?: boolean
	mvp?: MvpResult | null
	host: AuthUser
	questions: Question[]
	updatedAt?: string
}

interface Soup {
	id: string
	title: string
	surface: string
	answer: string
	category: string
	difficulty: Difficulty
	isBuiltin?: boolean
}

interface SoupPayload {
	title: string
	surface: string
	answer: string
	category: string
	difficulty: Difficulty
}

interface MemberStats {
	userId: string
	username: string
	displayName: string
	avatarDataUrl?: string
	points?: number
	rankTitle?: string
	online: boolean
	questionCount: number
	importantCount: number
}

interface LeaderboardEntry {
	rank: number
	user: AuthUser
	total: number
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

interface MvpResult {
	selectedAt: string
	user: AuthUser
	importantQuestions: Question[]
}

const props = withDefaults(
	defineProps<{
		room?: RoomState | null
		user?: AuthUser | null
		canHost?: boolean
		memberStats?: MemberStats[]
		liveLeaderboard?: LeaderboardEntry[]
		questionText?: string
		sendingQuestion?: boolean
		isDark?: boolean
		surfaceViewMode?: SurfaceViewMode
		pendingQuestions?: number
		answeredQuestions?: number
		soupHistoryCount?: number
		roomCodeInput?: string
		soups?: Soup[]
		selectedSoupId?: string
		settlement?: Settlement | null
		mvpResult?: MvpResult | null
		mvpCandidates?: AuthUser[]
		selectedMvpUserId?: string
		mvpSubmitting?: boolean
		authSubmitting?: boolean
		creatingSoup?: boolean
		deletingSoupId?: string
		beforeAvatarUpload?: (file: File) => boolean
	}>(),
	{
		room: null,
		user: null,
		canHost: false,
		memberStats: () => [],
		liveLeaderboard: () => [],
		questionText: '',
		sendingQuestion: false,
		isDark: true,
		surfaceViewMode: 'edit',
		pendingQuestions: 0,
		answeredQuestions: 0,
		soupHistoryCount: 0,
		roomCodeInput: '',
		soups: () => [],
		selectedSoupId: '',
		settlement: null,
		mvpResult: null,
		mvpCandidates: () => [],
		selectedMvpUserId: '',
		mvpSubmitting: false,
		authSubmitting: false,
		creatingSoup: false,
		deletingSoupId: '',
		beforeAvatarUpload: undefined,
	},
)

const emit = defineEmits<{
	(event: 'copy-share-url'): void
	(event: 'logout'): void
	(event: 'toggle-theme'): void
	(event: 'open-room-setup', mode: 'create' | 'switch'): void
	(event: 'reveal-answer'): void
	(event: 'update:questionText', value: string): void
	(event: 'submit-question', value?: string): void
	(event: 'set-verdict', questionId: string, verdict: Verdict): void
	(event: 'toggle-important', question: any): void
	(event: 'update-question-scoring', question: any, patch: Partial<QuestionSignal>): void
	(event: 'remove-question', questionId: string): void
	(event: 'update-room-field', field: 'title' | 'surface' | 'answer', value: string): void
	(event: 'save-room'): void
	(event: 'update-surface-view-mode', value: SurfaceViewMode): void
	(event: 'join-room', code: string): void
	(event: 'leave-room'): void
	(event: 'open-member-important', member: any): void
	(
		event: 'submit-auth',
		payload: {
			mode: AuthMode
			username: string
			password: string
			displayName: string
		},
	): void
	(event: 'select-soup-id', value: string): void
	(event: 'select-mvp-user', value: string): void
	(event: 'submit-mvp-selection'): void
	(event: 'save-soup', payload: SoupPayload, soupId?: string): void
	(event: 'delete-soup', soup: Soup): void
	(event: 'create-room'): void
	(event: 'switch-room-soup'): void
}>()

interface QuestionSignal {
	quality: QuestionQuality
	truthGuess: TruthGuess
	firstCoreClue: boolean
	firstMainLogic: boolean
	firstFullSolve: boolean
}

const DESIGN_WIDTH = 1680
const DESIGN_HEIGHT = 944
const viewport = ref({
	width: window.innerWidth,
	height: window.innerHeight,
})
const draftQuestion = ref(props.questionText)
const joinCode = ref(props.roomCodeInput)
const autoScroll = ref(true)
const qaViewMode = ref<'cards' | 'chat'>('cards')
const previousQuestionKeys = ref<string[]>([])
const questionFeedRef = ref<HTMLElement | null>(null)
const questionInputRef = ref<HTMLInputElement | null>(null)
const activeHostQuestionId = ref('')
const questionCardRefs = new Map<string, HTMLElement>()
const commandPanelTop = ref(66)
const roomConfigOpen = ref(false)
const answerPanelOpen = ref(false)
const clueManagerOpen = ref(false)
const revealSummaryOpen = ref(false)
const autoOpenedRevealKey = ref('')
const revealConfirmOpen = ref(false)
const answerDraft = ref('')
const storyEditorOpen = ref(false)
const storyDraft = reactive({
	title: '',
	surface: '',
})
const authMode = ref<AuthMode>('login')
const authDraft = reactive({
	username: '',
	password: '',
	displayName: '',
})
const soupEditorOpen = ref(false)
const soupManagerOpen = ref(false)
const editingSoupId = ref('')
const soupDraft = reactive<SoupPayload>({
	title: '',
	surface: '',
	answer: '',
	category: '自建',
	difficulty: 'medium',
})

const fallbackSurfaceHtml =
	''

const verdictLabels: Record<Verdict, string> = {
	yes: '是',
	no: '不是',
	both: '是也不是',
	irrelevant: '不重要',
}

const stampLabels: Record<Verdict, string> = {
	yes: '肯定',
	no: '否定',
	both: '部分',
	irrelevant: '无关',
}

const stampTones: Record<Verdict, string> = {
	yes: 'danger',
	no: 'muted',
	both: 'warn',
	irrelevant: 'muted',
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
	clue: '猜中线索 +3',
	motive: '猜中动机 +5',
	full: '接近真相 +8',
}

const fallbackQuestions: Question[] = [
	
]

const fallbackRanks: Array<{
	rank: number
	name: string
	total: number
	avatar?: string
}> = []

const canvasStyle = computed(() => {
	const scale = Math.min(
		viewport.value.width / DESIGN_WIDTH,
		viewport.value.height / DESIGN_HEIGHT,
	)

	return {
		transform: `translate(-50%, -50%) scale(${scale})`,
	}
})

const displayRoomCode = computed(
	() => (props.room?.code ?? props.roomCodeInput) || '------',
)
const currentRound = computed(() => props.soupHistoryCount + (props.room ? 1 : 0))
const totalRounds = computed(() => Math.max(3, currentRound.value))
const onlineCount = computed(
	() => props.memberStats.filter(member => member.online).length,
)
const roomTitle = computed(
	() => props.room?.title || '请选择汤面并创建或加入房间',
)
const storyHtml = computed(() =>
	sanitizeRichText(props.room?.surface || fallbackSurfaceHtml),
)
const canAsk = computed(() => Boolean(props.user && props.room && !props.sendingQuestion))
const canControl = computed(() => Boolean(props.canHost && props.room))
const canViewAnswer = computed(() =>
	Boolean(props.room && (props.canHost || props.room.revealed)),
)
const revealedAnswerHtml = computed(() =>
	sanitizeRichText(props.room?.answer || props.settlement?.answer || ''),
)
const currentMvpResult = computed(() => props.mvpResult ?? props.room?.mvp ?? null)
const selectedSoup = computed(
	() => props.soups.find(soup => soup.id === props.selectedSoupId) ?? null,
)
const setupHint = computed(() => {
	if (!props.user) return '请先登录或注册，再创建自己的汤面。'
	if (!props.soups.length) return '还没有汤面，先新建一个汤面。'
	if (!props.room) return '选择汤面后创建房间，玩家即可加入问答。'
	if (props.canHost) return '房间已创建，可管理汤面、判定问答并结算积分。'
	return '已进入房间，可在底部提交问题。'
})
const authTitle = computed(() =>
	authMode.value === 'login' ? '登录主持台' : '注册账号',
)

const displayQuestions = computed(() => {
	const source = props.room ? props.room.questions : fallbackQuestions
	return [...source].sort(
		(a, b) =>
			getTime(a.clientSortAt ?? a.createdAt) -
			getTime(b.clientSortAt ?? b.createdAt),
	)
})

function getQuestionRenderKey(question: Question) {
	return question.clientKey ?? question.id
}

const clueRows = computed(() => {
	const clues = (props.room?.questions ?? [])
		.filter(isClueQuestion)
		.sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt))
		.map(question => ({
			id: question.id,
			title: question.text,
			author: question.author,
			detail: `${question.author.displayName} · ${formatTime(question.createdAt)}`,
			verdict: question.verdict ?? null,
			active: question.important || question.verdict === 'yes',
			tags: getQuestionSignalTags(question),
		}))

	if (clues.length || props.room) return clues
	return []
})

const rankRows = computed(() => {
	if (props.liveLeaderboard.length) {
		return props.liveLeaderboard.slice(0, 8).map(entry => ({
			rank: entry.rank,
			name: entry.user.displayName,
			total: entry.total,
			avatar: entry.user.avatarDataUrl,
		}))
	}
	return fallbackRanks
})

const activeHostQuestion = computed(() => {
	if (!activeHostQuestionId.value) return null
	return (
		props.room?.questions.find(question => question.id === activeHostQuestionId.value) ??
		displayQuestions.value.find(question => question.id === activeHostQuestionId.value) ??
		null
	)
})

function getQuestionSignalTags(question: Question) {
	const tags: Array<{ key: string; label: string; tone: string }> = []
	if (question.important) tags.push({ key: 'important', label: '关键', tone: 'gold' })
	if (question.quality && question.quality !== 'none') {
		tags.push({
			key: `quality:${question.quality}`,
			label: qualityLabels[question.quality],
			tone: 'green',
		})
	}
	if (question.truthGuess && question.truthGuess !== 'none') {
		tags.push({
			key: `truth:${question.truthGuess}`,
			label: truthGuessLabels[question.truthGuess],
			tone: 'yellow',
		})
	}
	if (question.firstCoreClue) {
		tags.push({ key: 'firstCoreClue', label: '首次核心线索', tone: 'cyan' })
	}
	if (question.firstMainLogic) {
		tags.push({ key: 'firstMainLogic', label: '首次主要逻辑', tone: 'yellow' })
	}
	if (question.firstFullSolve) {
		tags.push({ key: 'firstFullSolve', label: '首位完整破解', tone: 'red' })
	}
	return tags
}

watch(
	() => props.questionText,
	value => {
		if (value !== draftQuestion.value) draftQuestion.value = value
	},
)

watch(
	draftQuestion,
	value => {
		emit('update:questionText', value)
	},
)

watch(
	() => props.roomCodeInput,
	value => {
		if (value !== joinCode.value) joinCode.value = value
	},
)

watch(
	() => props.user,
	value => {
		if (!value) return
		authDraft.password = ''
		authDraft.displayName = ''
	},
)

watch(
	() => [props.room?.code, props.room?.revealed, props.settlement?.revealedAt],
	([code, revealed, revealedAt]) => {
		if (!code || !revealed) {
			revealSummaryOpen.value = false
			autoOpenedRevealKey.value = ''
			return
		}
		if (autoOpenedRevealKey.value) return
		autoOpenedRevealKey.value = `${code}:${revealedAt ?? 'revealed'}`
		revealSummaryOpen.value = true
	},
)

watch(
	() => displayQuestions.value.map(getQuestionRenderKey),
	questionKeys => {
		const previousKeys = previousQuestionKeys.value
		const hasNewQuestion = questionKeys.some(key => !previousKeys.includes(key))
		previousQuestionKeys.value = questionKeys
		if (!autoScroll.value || !hasNewQuestion) return
		scrollQuestionFeedToBottom()
	},
	{ immediate: true },
)

watch(autoScroll, value => {
	if (value) scrollQuestionFeedToBottom()
})

function scrollQuestionFeedToBottom() {
	nextTick(() => {
		requestAnimationFrame(() => {
			const feed = questionFeedRef.value
			if (feed) feed.scrollTop = feed.scrollHeight
		})
	})
}

function syncViewport() {
	viewport.value = {
		width: window.innerWidth,
		height: window.innerHeight,
	}
	updateCommandPanelPosition()
}

function getTime(time: string) {
	const parsed = new Date(time).getTime()
	return Number.isFinite(parsed) ? parsed : 0
}

function formatTime(time: string) {
	const date = new Date(time)
	if (Number.isNaN(date.getTime())) return '--:--:--'
	return date.toLocaleTimeString('zh-CN', {
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false,
	})
}

function isClueQuestion(question: Question) {
	return Boolean(
		question.important ||
			question.verdict === 'yes' ||
			question.firstCoreClue ||
			question.firstMainLogic ||
			question.firstFullSolve,
	)
}

function updateQuestion(value: string) {
	draftQuestion.value = value
}

function handleQuestionInput(event: Event) {
	updateQuestion((event.target as HTMLInputElement).value)
}

function focusQuestionInput() {
	nextTick(() => {
		questionInputRef.value?.focus()
		window.setTimeout(() => questionInputRef.value?.focus(), 120)
	})
}

function submitQuestion(value = draftQuestion.value) {
	if (!canAsk.value) return
	emit('submit-question', value)
	draftQuestion.value = ''
	focusQuestionInput()
}

function quickAsk(value: string) {
	if (!canAsk.value) return
	draftQuestion.value = value
	emit('submit-question', value)
	draftQuestion.value = ''
	focusQuestionInput()
}

function setQuestionVerdict(question: Question, verdict: Verdict) {
	if (!props.canHost || question.clientStatus) return
	emit('set-verdict', question.id, verdict)
}

function toggleQuestionImportant(question: Question) {
	if (!props.canHost || question.clientStatus) return
	emit('toggle-important', question)
}

function toggleHostPanel(question: Question) {
	if (!props.canHost || question.clientStatus) return
	activeHostQuestionId.value =
		activeHostQuestionId.value === question.id ? '' : question.id
	if (activeHostQuestionId.value) updateCommandPanelPosition(question.id)
}

function closeHostPanel() {
	activeHostQuestionId.value = ''
}

function setQuestionCardRef(questionId: string, element: unknown) {
	if (element instanceof HTMLElement) {
		questionCardRefs.set(questionId, element)
		return
	}
	questionCardRefs.delete(questionId)
}

function updateCommandPanelPosition(questionId = activeHostQuestionId.value) {
	if (!questionId) return
	nextTick(() => {
		const feed = questionFeedRef.value
		const card = questionCardRefs.get(questionId)
		if (!feed || !card) return
		const feedRect = feed.getBoundingClientRect()
		const cardRect = card.getBoundingClientRect()
		const panelHeight = 390
		const minTop = 66
		const maxTop = Math.max(minTop, feedRect.bottom - feedRect.top - panelHeight + 44)
		const targetTop =
			cardRect.top - feedRect.top + cardRect.height / 2 - panelHeight / 2 + minTop
		commandPanelTop.value = Math.round(Math.min(Math.max(targetTop, minTop), maxTop))
	})
}

function handleDocumentPointerDown(event: PointerEvent) {
	if (!activeHostQuestionId.value) return
	const target = event.target as HTMLElement | null
	if (!target) return
	if (target.closest('.question-card, .chat-message, .qa-command-panel')) return
	closeHostPanel()
}

function handleQuestionFeedScroll() {
	updateCommandPanelPosition()
}

function updateQuestionScoring(
	question: Question,
	patch: Partial<QuestionSignal>,
) {
	if (!props.canHost || question.clientStatus) return
	emit('update-question-scoring', question, patch)
}

function removeQuestion(question: Question) {
	if (!props.canHost || question.clientStatus) return
	emit('remove-question', question.id)
	if (activeHostQuestionId.value === question.id) activeHostQuestionId.value = ''
}

function updateRoomField(field: 'title' | 'surface' | 'answer', value: string) {
	if (!props.canHost || !props.room) return
	emit('update-room-field', field, value)
}

function openAnswerPanel() {
	if (!canViewAnswer.value) return
	answerDraft.value = props.room?.answer || props.settlement?.answer || ''
	answerPanelOpen.value = true
}

function closeAnswerPanel() {
	answerPanelOpen.value = false
}

function saveAnswerPanel() {
	if (!props.canHost || !props.room) return
	updateRoomField('answer', answerDraft.value)
	emit('save-room')
	closeAnswerPanel()
}

function openClueManager() {
	if (!props.canHost || !props.room) return
	clueManagerOpen.value = true
}

function closeClueManager() {
	clueManagerOpen.value = false
}

function openRevealConfirm() {
	if (!props.canHost || !props.room || props.room.revealed) return
	revealConfirmOpen.value = true
}

function closeRevealConfirm() {
	revealConfirmOpen.value = false
}

function confirmRevealAnswer() {
	if (!props.canHost || !props.room || props.room.revealed) return
	emit('reveal-answer')
	closeRevealConfirm()
}

function openNextRoundConfig() {
	if (!props.canHost || !props.room) return
	roomConfigOpen.value = true
}

function openStoryEditor() {
	if (!props.canHost || !props.room) return
	storyDraft.title = props.room.title
	storyDraft.surface = props.room.surface
	storyEditorOpen.value = true
	emit('update-surface-view-mode', 'edit')
}

function closeStoryEditor() {
	storyEditorOpen.value = false
	emit('update-surface-view-mode', 'preview')
}

function saveStoryEditor() {
	if (!props.canHost || !props.room) return
	updateRoomField('title', storyDraft.title)
	updateRoomField('surface', storyDraft.surface)
	emit('save-room')
	closeStoryEditor()
}

function joinRoom() {
	const code = joinCode.value.trim()
	if (!code) return
	emit('join-room', code)
}

function submitAuthForm() {
	emit('submit-auth', {
		mode: authMode.value,
		username: authDraft.username.trim(),
		password: authDraft.password,
		displayName: authDraft.displayName.trim(),
	})
}

function handleAvatarBeforeUpload(file: File) {
	return props.beforeAvatarUpload?.(file) ?? false
}

function resetSoupDraft() {
	Object.assign(soupDraft, {
		title: '',
		surface: '',
		answer: '',
		category: '自建',
		difficulty: 'medium',
	})
}

function openSoupEditor(soup?: Soup) {
	if (soup) {
		editingSoupId.value = soup.id
		Object.assign(soupDraft, {
			title: soup.title,
			surface: soup.surface,
			answer: soup.answer,
			category: soup.category || '自建',
			difficulty: soup.difficulty,
		})
	} else {
		editingSoupId.value = ''
		resetSoupDraft()
	}
	soupEditorOpen.value = true
}

function closeSoupEditor() {
	soupEditorOpen.value = false
	editingSoupId.value = ''
}

function validateSoupDraft() {
	const titleLength = soupDraft.title.trim().length
	const surfaceLength = richTextToPlainText(soupDraft.surface).trim().length
	const answerLength = richTextToPlainText(soupDraft.answer).trim().length
	const categoryLength = soupDraft.category.trim().length
	if (titleLength < 2 || titleLength > 60) {
		ElMessage.warning('标题长度为 2-60 个字符')
		return false
	}
	if (surfaceLength < 8 || surfaceLength > 2000) {
		ElMessage.warning('汤面长度为 8-2000 个字符')
		return false
	}
	if (answerLength < 8 || answerLength > 4000) {
		ElMessage.warning('汤底长度为 8-4000 个字符')
		return false
	}
	if (categoryLength < 1 || categoryLength > 20) {
		ElMessage.warning('分类长度为 1-20 个字符')
		return false
	}
	return true
}

function submitSoupDraft() {
	if (!validateSoupDraft()) return
	emit('save-soup', { ...soupDraft }, editingSoupId.value || undefined)
	closeSoupEditor()
}

function selectSoup(event: Event) {
	emit('select-soup-id', (event.target as HTMLSelectElement).value)
}

function openRoomConfig() {
	roomConfigOpen.value = true
}

function openLoginPanel() {
	authMode.value = 'login'
	roomConfigOpen.value = true
}

function handleTopAuthAction() {
	if (props.user) {
		emit('logout')
		return
	}
	openLoginPanel()
}

function closeRoomConfig() {
	roomConfigOpen.value = false
}

function createRoomFromConfig() {
	emit('create-room')
	closeRoomConfig()
}

function switchRoomSoupFromConfig() {
	emit('switch-room-soup')
	closeRoomConfig()
}

function leaveRoomFromConfig() {
	emit('leave-room')
	closeRoomConfig()
}

function joinRoomFromConfig() {
	joinRoom()
	closeRoomConfig()
}

onMounted(() => {
	window.addEventListener('resize', syncViewport)
	document.addEventListener('pointerdown', handleDocumentPointerDown)
})

onBeforeUnmount(() => {
	window.removeEventListener('resize', syncViewport)
	document.removeEventListener('pointerdown', handleDocumentPointerDown)
})
</script>

<template>
	<main class="big-screen">
		<div class="screen-canvas" :style="canvasStyle">
			<header class="screen-header">
				<section class="brand-block">
					<img class="brand-badge" src="/zzz-ui/logo-badge.svg" alt="" />
					<div class="brand-copy">
						<h1>海龟汤推理馆</h1>
						<p>推理破局 / 真相只有一个</p>
					</div>
					<span class="brand-arrows">›››</span>
				</section>

				<section class="room-meta">
					<button class="meta-chip room-code" type="button" :disabled="!room" @click="emit('copy-share-url')">
						<span>房间号:</span>
						<strong>{{ displayRoomCode }}</strong>
						<el-icon><CopyDocument /></el-icon>
					</button>
					<div class="meta-chip">
						<span>玩法:</span>
						<strong>经典海龟汤</strong>
					</div>
					<div class="meta-chip">
						<span>局数:</span>
						<strong>第 <b>{{ currentRound }}</b> 局 / 共 {{ totalRounds }} 局</strong>
					</div>
				</section>

				<nav class="top-actions" aria-label="大屏操作">
					<div v-if="user" class="top-user-card">
						<el-upload
							:show-file-list="false"
							:before-upload="handleAvatarBeforeUpload"
							accept="image/*"
						>
							<button class="top-avatar-button" type="button" title="修改头像">
								<img v-if="user.avatarDataUrl" :src="user.avatarDataUrl" alt="" />
								<span v-else>{{ user.displayName.slice(0, 1) }}</span>
							</button>
						</el-upload>
						<div class="top-user-copy">
							<strong>{{ user.displayName }}</strong>
							<span>@{{ user.username }} · {{ user.rankTitle ?? '路人甲' }}<template v-if="typeof user.points === 'number'"> · {{ user.points }} 分</template></span>
						</div>
					</div>
					<!-- <button type="button" :disabled="!room" @click="emit('copy-share-url')">
						<el-icon><Share /></el-icon>
						<span>公告</span>
					</button>
					<button type="button" @click="openHelpPanel">
						<el-icon><QuestionFilled /></el-icon>
						<span>帮助</span>
					</button>
					<button type="button" @click="emit('toggle-theme')">
						<el-icon>
							<Sunny v-if="isDark" />
							<Moon v-else />
						</el-icon>
						<span>{{ isDark ? '亮色' : '暗色' }}</span>
					</button> -->
					<button type="button" @click="handleTopAuthAction">
						<el-icon>
							<SwitchButton v-if="user" />
							<User v-else />
						</el-icon>
						<span>{{ user ? '退出登录' : '登录' }}</span>
					</button>
				</nav>
			</header>

			<section class="screen-grid">
				<aside class="left-column">
					<article class="panel story-panel">
						<div class="panel-title cyan story-title-row">
							<div>
								<h2>汤面</h2>
								<span>STORY</span>
							</div>
							<div v-if="canHost && room" class="mode-switch">
								<button
									:class="{ active: surfaceViewMode === 'preview' }"
									type="button"
									@click="emit('update-surface-view-mode', 'preview')"
								>
									预览
								</button>
								<button
									:class="{ active: storyEditorOpen }"
									type="button"
									@click="openStoryEditor"
								>
									编辑
								</button>
							</div>
						</div>
						<div class="story-body">
							<div class="locked-stamp">
								<el-icon><EditPen /></el-icon>
								<span>{{ room?.revealed ? '汤底已公开' : '汤面已锁定' }}</span>
							</div>
							<h3>{{ roomTitle }}</h3>
							<div class="story-rich" v-html="storyHtml" />
						</div>
					</article>

					<article class="panel clues-panel">
						<div class="panel-title yellow">
							<h2>关键线索</h2>
							<span>CLUES</span>
							<!-- <small>主持人可见</small> -->
						</div>
						<div class="clue-list">
							<div
								v-for="clue in clueRows"
								:key="clue.id"
								class="clue-row"
								:class="{ active: clue.active }"
							>
								<div class="clue-icon">
									<img v-if="clue.author.avatarDataUrl" :src="clue.author.avatarDataUrl" alt="" />
									<span v-else>{{ clue.author.displayName.slice(0, 1) }}</span>
								</div>
								<div>
									<strong>{{ clue.title }}</strong>
									<p>{{ clue.detail }}</p>
									<div v-if="clue.tags.length" class="clue-signal-tags">
										<span
											v-for="tag in clue.tags"
											:key="tag.key"
											:class="`tone-${tag.tone}`"
										>
											{{ tag.label }}
										</span>
									</div>
								</div>
								<div
									class="clue-verdict-stamp"
									:class="clue.verdict ? stampTones[clue.verdict] : 'waiting'"
								>
									{{ clue.verdict ? stampLabels[clue.verdict] : '待定' }}
									<i>{{ clue.verdict === 'yes' ? '✓' : '×' }}</i>
								</div>
							</div>
						</div>
						<button class="caution-button" type="button" :disabled="!room" @click="openClueManager">
							<el-icon><Flag /></el-icon>
							线索管理
						</button>
					</article>
				</aside>

				<section class="center-column panel qa-panel">
					<div class="panel-title yellow live-title">
						<div flex items-end gap="2px">
							<h2>实时问答</h2>
							<span>Q&amp;A</span>
						</div>
						<div class="qa-view-switch" aria-label="问答视图">
							<button
								:class="{ active: qaViewMode === 'cards' }"
								type="button"
								@click="qaViewMode = 'cards'"
							>
								当前
							</button>
							<button
								:class="{ active: qaViewMode === 'chat' }"
								type="button"
								@click="qaViewMode = 'chat'"
							>
								聊天
							</button>
						</div>
						<b>LIVE</b>
					</div>
					<div ref="questionFeedRef" class="question-feed" @scroll="handleQuestionFeedScroll">
						<TransitionGroup
							v-if="qaViewMode === 'cards'"
							name="question-stream"
							tag="div"
							class="question-stream"
						>
							<article
								v-for="question in displayQuestions"
								:key="getQuestionRenderKey(question)"
								:ref="element => setQuestionCardRef(question.id, element)"
								class="question-card"
								role="button"
								tabindex="0"
								:class="{
									important: question.important,
									pending: question.clientStatus === 'sending',
									selected: activeHostQuestionId === question.id,
									scored: getQuestionSignalTags(question).length,
								}"
								@click="toggleHostPanel(question)"
								@keyup.enter="toggleHostPanel(question)"
							>
							<div class="avatar-token">
								<img v-if="question.author.avatarDataUrl" :src="question.author.avatarDataUrl" alt="" />
								<span v-else>{{ question.author.displayName.slice(0, 1) }}</span>
							</div>
							<div class="question-content">
								<header>
									<strong>{{ question.author.displayName }}</strong>
									<time>{{ formatTime(question.createdAt) }}</time>
								</header>
								<p>{{ question.text }}</p>
								<footer>
									主持人：{{ question.verdict ? verdictLabels[question.verdict] : '待回应' }}
								</footer>
								<div v-if="getQuestionSignalTags(question).length" class="question-signal-tags">
									<span
										v-for="tag in getQuestionSignalTags(question)"
										:key="tag.key"
										:class="`tone-${tag.tone}`"
									>
										{{ tag.label }}
									</span>
								</div>
							</div>
							<div
								class="verdict-stamp"
								:class="question.verdict ? stampTones[question.verdict] : 'waiting'"
							>
								{{ question.verdict ? stampLabels[question.verdict] : '待定' }}
								<i>{{ question.verdict === 'yes' ? '✓' : '×' }}</i>
							</div>
							<!-- <button
								v-if="canHost && !question.clientStatus"
								class="host-operate-toggle"
								type="button"
								@click.stop="toggleHostPanel(question)"
							>
								{{ activeHostQuestionId === question.id ? '操作中' : '主持操作' }}
							</button> -->
							</article>
						</TransitionGroup>
						<BigScreenChatFeed
							v-else
							:questions="displayQuestions"
							:user="user"
							:can-host="canHost"
							:active-question-id="activeHostQuestionId"
							@toggle-host-panel="toggleHostPanel"
							@set-question-card-ref="setQuestionCardRef"
						/>
					</div>
					<div
						v-if="activeHostQuestion"
						class="qa-command-panel"
						:style="{ top: `${commandPanelTop}px` }"
					>
						<header>
							<div>
								<strong>主持人操作</strong>
								<span>{{ activeHostQuestion.author.displayName }} · {{ formatTime(activeHostQuestion.createdAt) }}</span>
							</div>
							<button type="button" @click="closeHostPanel">×</button>
						</header>
						<p>{{ activeHostQuestion.text }}</p>
						<div class="command-section">
							<span class="action-title">判定</span>
							<div class="command-buttons">
								<button
									:class="['judge', { active: activeHostQuestion.verdict === 'yes' }]"
									type="button"
									@click="setQuestionVerdict(activeHostQuestion, 'yes')"
								>
									是
								</button>
								<button
									:class="['judge', { active: activeHostQuestion.verdict === 'no' }]"
									type="button"
									@click="setQuestionVerdict(activeHostQuestion, 'no')"
								>
									不是
								</button>
								<button
									:class="['judge', { active: activeHostQuestion.verdict === 'both' }]"
									type="button"
									@click="setQuestionVerdict(activeHostQuestion, 'both')"
								>
									是也不是
								</button>
								<button
									:class="['judge', { active: activeHostQuestion.verdict === 'irrelevant' }]"
									type="button"
									@click="setQuestionVerdict(activeHostQuestion, 'irrelevant')"
								>
									不重要
								</button>
							</div>
						</div>
						<div class="command-section">
							<span class="action-title">标记</span>
							<div class="command-buttons">
								<button
									:class="['judge', 'flag', { active: activeHostQuestion.important }]"
									type="button"
									@click="toggleQuestionImportant(activeHostQuestion)"
								>
									{{ activeHostQuestion.important ? '已标重要' : '标为重要' }}
								</button>
								<button class="judge delete" type="button" @click="removeQuestion(activeHostQuestion)">删除</button>
							</div>
						</div>
						<div class="score-grid">
							<label>
								问题价值
								<select
									:value="activeHostQuestion.quality ?? 'none'"
									@change="updateQuestionScoring(activeHostQuestion, { quality: ($event.target as HTMLSelectElement).value as QuestionQuality })"
								>
									<option v-for="(label, value) in qualityLabels" :key="value" :value="value">
										{{ label }}
									</option>
								</select>
							</label>
							<label>
								猜中程度
								<select
									:value="activeHostQuestion.truthGuess ?? 'none'"
									@change="updateQuestionScoring(activeHostQuestion, { truthGuess: ($event.target as HTMLSelectElement).value as TruthGuess })"
								>
									<option v-for="(label, value) in truthGuessLabels" :key="value" :value="value">
										{{ label }}
									</option>
								</select>
							</label>
						</div>
						<div class="achievement-row">
							<label>
								<input
									type="checkbox"
									:checked="Boolean(activeHostQuestion.firstCoreClue)"
									@change="updateQuestionScoring(activeHostQuestion, { firstCoreClue: ($event.target as HTMLInputElement).checked })"
								/>
								首次核心线索
							</label>
							<label>
								<input
									type="checkbox"
									:checked="Boolean(activeHostQuestion.firstMainLogic)"
									@change="updateQuestionScoring(activeHostQuestion, { firstMainLogic: ($event.target as HTMLInputElement).checked })"
								/>
								首次主要逻辑
							</label>
							<label>
								<input
									type="checkbox"
									:checked="Boolean(activeHostQuestion.firstFullSolve)"
									@change="updateQuestionScoring(activeHostQuestion, { firstFullSolve: ($event.target as HTMLInputElement).checked })"
								/>
								首位完整破解
							</label>
						</div>
					</div>
					<div class="feed-footer">
						<span>问答仅主持人可回复，保持游戏公平</span>
						<label>
							自动滚动
							<input v-model="autoScroll" type="checkbox" />
						</label>
					</div>
				</section>

				<aside class="right-column">
					<article class="panel room-panel">
						<div class="panel-title cyan room-title-row">
							<div class="panel-title-copy">
								<h2>房间配置</h2>
								<span>ROOM</span>
							</div>
							<button class="panel-title-action" type="button" @click="openRoomConfig">
								<el-icon><House /></el-icon>
								{{ !user ? '登录' : room ? '配置' : '开房' }}
							</button>
						</div>
						<div class="room-status-strip">
							<strong>{{ user ? user.displayName : authTitle }}</strong>
							<span>{{ setupHint }}</span>
						</div>
						<div v-if="!room" class="room-create-summary">
							<strong>{{ user ? '等待创建房间' : '请先登录账号' }}</strong>
							<p>{{ setupHint }}</p>
							<dl>
								<div><dt>当前汤面</dt><dd>{{ selectedSoup?.title ?? '暂未选择' }}</dd></div>
								<div><dt>汤面数量</dt><dd>{{ soups.length }} 个</dd></div>
								<div><dt>房间入口</dt><dd>点击右上角{{ user ? '开房' : '登录' }}</dd></div>
							</dl>
						</div>
						<div v-else class="room-info">
							<dl>
								<div><dt>房间名称</dt><dd>{{ roomTitle }}</dd></div>
								<div><dt>房间类型</dt><dd>{{ room ? '公开房间' : '未进入房间' }}</dd></div>
								<div><dt>玩家人数</dt><dd>{{ onlineCount }} / {{ memberStats.length || 0 }}</dd></div>
								<!-- <div><dt>待判定</dt><dd>{{ pendingQuestions }} 条</dd></div> -->
								<div><dt>已回答</dt><dd>{{ answeredQuestions }} 条</dd></div>
								<div><dt>当前局数</dt><dd>第 {{ currentRound }} 局 / 共 {{ totalRounds }} 局</dd></div>
							</dl>
							<!-- <div class="room-map">
								<el-icon><House /></el-icon>
								<span>汤店<br />映射</span>
								<b>ROOM INFO</b>
							</div> -->
						</div>
					</article>

					<article class="panel ranking-panel">
						<div class="panel-title yellow">
							<h2>实时积分排行</h2>
							<span>RANKING</span>
							<small>本局排行</small>
						</div>
						<div class="rank-list">
							<div
								v-for="rank in rankRows"
								:key="`${rank.rank}-${rank.name}`"
								class="rank-row"
								:class="`rank-${String(rank.rank).padStart(2, '0')}`"
							>
								<span>{{ String(rank.rank).padStart(2, '0') }}</span>
								<strong>{{ rank.name }}</strong>
								<em>{{ rank.total }}</em>
							</div>
						</div>
					</article>

					<article class="panel host-panel">
						<div class="panel-title red">
							<h2>主持人控制</h2>
							<span>HOST CONTROL</span>
						</div>
						<div class="host-actions">
							<button type="button" :disabled="!canViewAnswer" @click="openAnswerPanel">
								<el-icon><Lock /></el-icon>
								<span>{{ room?.revealed && !canHost ? '查看汤底' : room?.revealed ? '查看汤底' : '汤底管理' }}</span>
							</button>
							<button type="button" :disabled="!canControl" @click="openClueManager">
								<el-icon><Flag /></el-icon>
								<span>线索管理</span>
							</button>
							<button class="danger" type="button" :disabled="!canControl || room?.revealed" @click="openRevealConfirm">
								<el-icon><CircleClose /></el-icon>
								<span>结束本局</span>
							</button>
							<button type="button" :disabled="!canControl" @click="openNextRoundConfig">
								<el-icon><VideoPlay /></el-icon>
								<span>下一局</span>
							</button>
						</div>
					</article>
				</aside>
			</section>

			<footer class="input-console">
				<section class="quick-ask">
					<strong>快捷提问</strong>
					<div>
						<button type="button" :disabled="!canAsk" @click="quickAsk('是正常世界观吗')">是正常世界观吗</button>
						<button type="button" :disabled="!canAsk" @click="quickAsk('有死人吗')">有人死吗</button>
						<button type="button" :disabled="!canAsk" @click="quickAsk('我是人类吗')">我是人类吗</button>
						<button type="button" :disabled="!canAsk" @click="quickAsk('我死了吗')">我死了吗</button>
					</div>
					<p>点击快捷提问，或在右侧输入你的问题...</p>
				</section>
				<section class="main-input">
					<input
						ref="questionInputRef"
						:value="draftQuestion"
						:disabled="!canAsk"
						maxlength="500"
						placeholder="点击输入你的问题"
						@input="handleQuestionInput"
						@keyup.enter="submitQuestion()"
					/>
					<small>{{ draftQuestion.length }}/500</small>
				</section>
				<button class="send-button" type="button" :disabled="!canAsk" @click="submitQuestion()">
					<el-icon class="send-icon-main"><Right /></el-icon>
					<span>{{ sendingQuestion ? '发送中' : '发送' }}</span>
					<small>
						ENTER
					</small>
				</button>
				<section class="emoji-bar">
					<strong>房间用户</strong>
					<div>
						<button
							v-for="member in memberStats.slice(0, 5)"
							:key="member.userId"
							:class="{ offline: !member.online }"
							type="button"
							@click="emit('open-member-important', member)"
						>
							<el-icon v-if="!member.avatarDataUrl"><User /></el-icon>
							<img v-else :src="member.avatarDataUrl" alt="" />
						</button>
						<button v-if="!memberStats.length" type="button" disabled>?</button>
					</div>
				</section>
			</footer>
			<Transition name="zzz-modal">
			<div v-if="answerPanelOpen" class="big-modal">
				<section class="modal-panel">
					<header>
						<div>
							<strong>
								<el-icon><Lock /></el-icon>
								{{ canHost && !room?.revealed ? '汤底管理' : '查看汤底' }}
							</strong>
							<span>{{ room?.revealed ? 'ANSWER REVEALED' : 'HOST ONLY' }}</span>
						</div>
						<button type="button" @click="closeAnswerPanel">×</button>
					</header>
					<div class="answer-state">
						<strong>{{ room?.revealed ? '汤底已公开' : '汤底锁定中' }}</strong>
						<span>{{ room?.revealed ? '玩家已可看到本局真相' : '只有主持人可编辑和查看汤底' }}</span>
					</div>
					<RichTextEditor
						v-model="answerDraft"
						class="answer-rich-editor"
						:min-rows="10"
						:disabled="!canHost || room?.revealed"
						placeholder="写下最终真相、关键线索和解释"
					/>
					<footer>
						<button type="button" @click="closeAnswerPanel">{{ canHost && !room?.revealed ? '取消' : '关闭' }}</button>
						<button v-if="canHost && !room?.revealed" type="button" @click="saveAnswerPanel">保存汤底</button>
					</footer>
				</section>
			</div>
			</Transition>
			<Transition name="zzz-modal">
			<div v-if="revealSummaryOpen && room?.revealed" class="big-modal">
				<section class="modal-panel reveal-summary-panel">
					<header>
						<div>
							<strong>
								<el-icon><CircleClose /></el-icon>
								本局揭秘
							</strong>
							<span>FINAL RESULT</span>
						</div>
						<button type="button" @click="revealSummaryOpen = false">×</button>
					</header>
					<div class="reveal-summary-body">
						<section class="result-answer-card">
							<div class="result-section-title">
								<strong>汤底</strong>
								<span>{{ room.code }}</span>
							</div>
							<div class="result-answer-rich" v-html="revealedAnswerHtml" />
						</section>
						<section class="result-rank-card">
							<div class="result-section-title">
								<strong>本局积分</strong>
								<span>{{ settlement?.entries.length ?? 0 }} 人</span>
							</div>
							<div v-if="settlement?.entries.length" class="result-rank-list">
								<div v-for="entry in settlement.entries" :key="entry.user.id" class="result-rank-row">
									<b>#{{ entry.rank }}</b>
									<span>{{ entry.user.displayName }}</span>
									<strong>+{{ entry.total }}</strong>
								</div>
							</div>
							<div v-else class="empty-state">等待结算数据</div>
						</section>
						<section class="result-mvp-card">
							<div class="result-section-title">
								<strong>本轮 MVP</strong>
								<span>MVP</span>
							</div>
							<div v-if="currentMvpResult" class="result-mvp-hero">
								<div class="result-mvp-avatar">
									<img v-if="currentMvpResult.user.avatarDataUrl" :src="currentMvpResult.user.avatarDataUrl" alt="" />
									<span v-else>{{ currentMvpResult.user.displayName.slice(0, 1) }}</span>
								</div>
								<div>
									<strong>{{ currentMvpResult.user.displayName }}</strong>
									<p>{{ currentMvpResult.user.rankTitle }} · {{ currentMvpResult.user.points }} 分</p>
								</div>
							</div>
							<div v-else-if="canHost && mvpCandidates.length" class="mvp-select-console">
								<select
									:value="selectedMvpUserId"
									@change="emit('select-mvp-user', ($event.target as HTMLSelectElement).value)"
								>
									<option value="">选择 MVP 玩家</option>
									<option v-for="candidate in mvpCandidates" :key="candidate.id" :value="candidate.id">
										{{ candidate.displayName }} · {{ candidate.rankTitle }}
									</option>
								</select>
								<button type="button" :disabled="!selectedMvpUserId || mvpSubmitting" @click="emit('submit-mvp-selection')">
									{{ mvpSubmitting ? '公布中' : '公布 MVP' }}
								</button>
							</div>
								<div v-else-if="canHost && !mvpCandidates.length" class="mvp-select-console">
									本局没有MVP哦
							</div>
							<div v-else class="empty-state">等待主持人公布 MVP</div>
						</section>
					</div>
					<footer>
						<button type="button" @click="revealSummaryOpen = false">关闭</button>
						<!-- <button type="button" @click="openAnswerPanel">查看汤底</button> -->
					</footer>
				</section>
			</div>
			</Transition>
			<Transition name="zzz-modal">
			<div v-if="clueManagerOpen" class="big-modal">
				<section class="modal-panel clue-manager-panel">
					<header>
						<div>
							<strong>
								<el-icon><Flag /></el-icon>
								线索管理
							</strong>
							<span>CLUE CONTROL</span>
						</div>
						<button type="button" @click="closeClueManager">×</button>
					</header>
					<div v-if="!displayQuestions.length" class="empty-state">暂无问答</div>
					<div v-else class="clue-manager-list">
						<article v-for="question in displayQuestions" :key="question.id">
							<div class="clue-manager-main">
								<strong>{{ question.text }}</strong>
								<span>{{ question.author.displayName }} · {{ formatTime(question.createdAt) }}</span>
								<div v-if="getQuestionSignalTags(question).length" class="question-signal-tags">
									<span
										v-for="tag in getQuestionSignalTags(question)"
										:key="tag.key"
										:class="`tone-${tag.tone}`"
									>
										{{ tag.label }}
									</span>
								</div>
							</div>
							<div class="clue-manager-actions">
								<button
									:class="{ active: question.important }"
									type="button"
									:disabled="Boolean(question.clientStatus)"
									@click="toggleQuestionImportant(question)"
								>
									{{ question.important ? '已标重要' : '标重要' }}
								</button>
								<button
									:class="{ active: question.verdict === 'yes' }"
									type="button"
									:disabled="Boolean(question.clientStatus)"
									@click="setQuestionVerdict(question, 'yes')"
								>
									是
								</button>
								<button
									:class="{ active: question.verdict === 'no' }"
									type="button"
									:disabled="Boolean(question.clientStatus)"
									@click="setQuestionVerdict(question, 'no')"
								>
									不是
								</button>
								<button
									:class="{ active: question.verdict === 'both' }"
									type="button"
									:disabled="Boolean(question.clientStatus)"
									@click="setQuestionVerdict(question, 'both')"
								>
									是也不是
								</button>
								<button
									:class="{ active: question.verdict === 'irrelevant' }"
									type="button"
									:disabled="Boolean(question.clientStatus)"
									@click="setQuestionVerdict(question, 'irrelevant')"
								>
									无关
								</button>
							</div>
						</article>
					</div>
					<footer>
						<button type="button" @click="closeClueManager">关闭</button>
					</footer>
				</section>
			</div>
			</Transition>
			<Transition name="zzz-modal">
			<div v-if="revealConfirmOpen" class="big-modal">
				<section class="modal-panel reveal-confirm-panel">
					<header>
						<div>
							<strong>
								<el-icon><CircleClose /></el-icon>
								结束本局
							</strong>
							<span>FINAL REVEAL</span>
						</div>
						<button type="button" @click="closeRevealConfirm">×</button>
					</header>
					<div class="reveal-warning">
						<strong>确认公开汤底并结算积分？</strong>
						<p>结束后本局会进入揭秘状态，玩家将看到汤底，实时积分会结算。</p>
					</div>
					<footer>
						<button type="button" @click="closeRevealConfirm">取消</button>
						<button type="button" @click="confirmRevealAnswer">确认结束</button>
					</footer>
				</section>
			</div>
			</Transition>
			<Transition name="zzz-modal">
			<div v-if="roomConfigOpen" class="big-modal room-config-modal">
				<section class="modal-panel room-config-panel">
					<header>
						<div>
							<strong>
								<el-icon><House /></el-icon>
								房间配置
							</strong>
							<span>{{ room ? 'ROOM CONTROL' : 'CREATE ROOM' }}</span>
						</div>
						<button type="button" @click="closeRoomConfig">×</button>
					</header>
					<form v-if="!user" class="auth-console room-config-auth" @submit.prevent="submitAuthForm">
						<div class="auth-tabs">
							<button
								:class="{ active: authMode === 'login' }"
								type="button"
								@click="authMode = 'login'"
							>
								登录
							</button>
							<button
								:class="{ active: authMode === 'register' }"
								type="button"
								@click="authMode = 'register'"
							>
								注册
							</button>
						</div>
						<input
							v-if="authMode === 'register'"
							v-model="authDraft.displayName"
							maxlength="24"
							placeholder="昵称"
						/>
						<input v-model="authDraft.username" maxlength="24" placeholder="用户名" />
						<input
							v-model="authDraft.password"
							maxlength="40"
							placeholder="密码"
							type="password"
						/>
						<button type="submit" :disabled="authSubmitting" @click.prevent="submitAuthForm">
							{{ authSubmitting ? '处理中' : authMode === 'register' ? '注册并登录' : '登录' }}
						</button>
					</form>
					<div v-else class="room-config-body">
						<section class="room-config-section">
							<h3>{{ room ? '当前汤面' : '创建房间' }}</h3>
							<div class="soup-select-row">
								<select :value="selectedSoupId" :disabled="!soups.length" @change="selectSoup">
									<option value="">选择汤面</option>
									<option v-for="soup in soups" :key="soup.id" :value="soup.id">
										{{ soup.title }} · {{ difficultyLabels[soup.difficulty] }}
									</option>
								</select>
								<button type="button" @click="openSoupEditor()">新建</button>
								<button type="button" @click="soupManagerOpen = true">管理</button>
							</div>
							<div class="selected-soup-card">
								<strong>{{ selectedSoup?.title ?? '暂无汤面' }}</strong>
								<span>{{ selectedSoup ? `${selectedSoup.category || '自建'} · ${difficultyLabels[selectedSoup.difficulty]}` : '请新建或选择汤面' }}</span>
							</div>
							<div class="room-flow-actions">
								<button
									v-if="!room"
									type="button"
									:disabled="!selectedSoupId"
									@click="createRoomFromConfig"
								>
									创建房间
								</button>
								<button
									v-else-if="canHost"
									type="button"
									:disabled="!selectedSoupId"
									@click="switchRoomSoupFromConfig"
								>
									切换当前汤面
								</button>
								<button v-else type="button" @click="leaveRoomFromConfig">退出房间</button>
							</div>
						</section>
						<section class="room-config-section">
							<h3>加入房间</h3>
							<div class="room-ops modal-room-ops">
								<input v-model="joinCode" placeholder="输入房间号" @keyup.enter="joinRoomFromConfig" />
								<button type="button" @click="joinRoomFromConfig">加入</button>
							</div>
						</section>
					</div>
				</section>
			</div>
			</Transition>
			<Transition name="zzz-modal">
			<div v-if="storyEditorOpen" class="big-modal">
				<form class="modal-panel story-editor-panel" @submit.prevent="saveStoryEditor">
					<header>
						<div>
							<strong>
								<el-icon><EditPen /></el-icon>
								编辑汤面
							</strong>
							<span>STORY EDITOR</span>
						</div>
						<button type="button" @click="closeStoryEditor">×</button>
					</header>
					<div class="modal-scroll-body">
						<label>
							<span>标题</span>
							<input v-model="storyDraft.title" required maxlength="36" placeholder="输入汤面标题" />
						</label>
						<div class="editor-field story-editor-field">
							<span>汤面内容</span>
							<RichTextEditor
								v-model="storyDraft.surface"
								class="story-modal-rich-editor"
								:min-rows="13"
								placeholder="写下公开给玩家的汤面"
							/>
						</div>
					</div>
					<footer>
						<button type="button" @click="closeStoryEditor">取消</button>
						<button type="submit" @click.prevent="saveStoryEditor">保存汤面</button>
					</footer>
				</form>
			</div>
			</Transition>
			<Transition name="zzz-modal">
			<div v-if="soupEditorOpen" class="big-modal editor-modal">
				<form class="modal-panel soup-editor" @submit.prevent="submitSoupDraft">
					<header>
						<strong>
							<el-icon><EditPen /></el-icon>
							{{ editingSoupId ? '编辑汤面' : '新建汤面' }}
						</strong>
						<button type="button" @click="closeSoupEditor">×</button>
					</header>
					<div class="modal-scroll-body">
						<label>
							<span>标题</span>
							<input v-model="soupDraft.title" required minlength="2" maxlength="60" />
						</label>
						<div class="editor-field soup-editor-field">
							<span>汤面</span>
							<RichTextEditor
								v-model="soupDraft.surface"
								class="soup-rich-editor"
								:min-rows="7"
								placeholder="写下公开给玩家的汤面"
							/>
						</div>
						<div class="editor-field soup-editor-field">
							<span>汤底</span>
							<RichTextEditor
								v-model="soupDraft.answer"
								class="soup-rich-editor answer-rich-editor"
								:min-rows="7"
								placeholder="写下主持人可见的汤底和真相"
							/>
						</div>
						<div class="modal-grid">
							<label>
								<span>分类</span>
								<input v-model="soupDraft.category" required maxlength="20" />
							</label>
							<label>
								<span>难度</span>
								<select v-model="soupDraft.difficulty">
									<option value="easy">入门</option>
									<option value="medium">标准</option>
									<option value="hard">困难</option>
								</select>
							</label>
						</div>
					</div>
					<footer>
						<button type="button" @click="closeSoupEditor">取消</button>
						<button type="submit" :disabled="creatingSoup" @click.prevent="submitSoupDraft">
							{{ creatingSoup ? '保存中' : editingSoupId ? '保存修改' : '保存汤面' }}
						</button>
					</footer>
				</form>
			</div>
			</Transition>
			<Transition name="zzz-modal">
			<div v-if="soupManagerOpen" class="big-modal manager-modal">
				<section class="modal-panel soup-manager-panel">
					<header>
						<strong>管理汤面</strong>
						<button type="button" @click="soupManagerOpen = false">×</button>
					</header>
					<div v-if="!soups.length" class="empty-state">还没有自己的汤面</div>
					<div v-else class="soup-manage-list">
						<article
							v-for="soup in soups"
							:key="soup.id"
							:class="{ active: selectedSoupId === soup.id }"
						>
							<button type="button" class="soup-manage-main" @click="emit('select-soup-id', soup.id)">
								<strong>{{ soup.title }}</strong>
								<span>{{ soup.category || '自建' }} · {{ difficultyLabels[soup.difficulty] }}</span>
							</button>
							<div>
								<button type="button" @click="openSoupEditor(soup)">编辑</button>
								<button
									type="button"
									:disabled="deletingSoupId === soup.id"
									@click="emit('delete-soup', soup)"
								>
									删除
								</button>
							</div>
						</article>
					</div>
					<footer>
						<button type="button" @click="openSoupEditor()">新建汤面</button>
					</footer>
				</section>
			</div>
			</Transition>
		</div>
	</main>
</template>

<style scoped lang="scss">

:global(body.big-screen-route) {
	overflow: hidden;
	background:
		linear-gradient(180deg, rgba(0, 0, 0, 0.22), rgba(0, 0, 0, 0.86)),
		url('/zzz-ui/city-bg.svg') center / cover fixed,
		#050607;
}

.big-screen {
	position: fixed;
	inset: 0;
	overflow: hidden;
	color: #f2f2ed;
	background:
		linear-gradient(180deg, rgba(0, 0, 0, 0.2), #030607 88%),
		url('/zzz-ui/city-bg.svg') center / cover no-repeat,
		#050708;
	font-family:
		'Arial Black',
		'Microsoft YaHei',
		Arial,
		sans-serif;
	letter-spacing: 0;
}

.big-screen::before {
	content: '';
	position: absolute;
	inset: 0;
	pointer-events: none;
	background:
		linear-gradient(90deg, rgba(255, 210, 0, 0.08) 0 1px, transparent 1px 11.4%),
		radial-gradient(circle at 85% 20%, rgba(0, 230, 220, 0.18), transparent 26%),
		repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.035) 0 1px, transparent 1px 4px);
	mix-blend-mode: screen;
	opacity: 0.65;
}

.screen-canvas {
	position: absolute;
	left: 50%;
	top: 50%;
	width: 1680px;
	height: 944px;
	transform-origin: center;
}

button,
input,
textarea {
	font: inherit;
}

button {
	color: inherit;
	cursor: pointer;
}

button:disabled,
input:disabled {
	cursor: not-allowed;
	opacity: 0.45;
}

.screen-header,
.screen-grid,
.input-console {
	position: relative;
	z-index: 1;
}

.screen-header {
	display: grid;
	grid-template-columns: 450px 1fr 360px;
	align-items: stretch;
	height: 100px;
	padding: 16px 28px 10px;
	background: linear-gradient(90deg, rgba(0, 0, 0, 0.82), rgba(14, 18, 18, 0.72));
	border-bottom: 2px solid rgba(255, 255, 255, 0.08);
	box-shadow: 0 12px 28px rgba(0, 0, 0, 0.55);
}

.brand-block {
	display: flex;
	align-items: center;
	gap: 18px;
	min-width: 0;
}

.brand-badge {
	width: 76px;
	height: 76px;
	filter: drop-shadow(0 0 12px rgba(255, 210, 0, 0.45));
}

.brand-copy h1 {
	margin: 0;
	font-size: 36px;
	font-style: italic;
	line-height: 0.98;
	text-shadow: 3px 4px 0 #111, 0 0 18px rgba(255, 255, 255, 0.18);
}

.brand-copy p {
	margin: 8px 0 0;
	color: #9a9a94;
	font-size: 13px;
	font-weight: 700;
}

.brand-arrows {
	margin-left: auto;
	color: #ffd400;
	font-size: 34px;
	line-height: 1;
}

.room-meta {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 10px;
	min-width: 0;
}

.meta-chip {
	display: inline-flex;
	align-items: center;
	gap: 12px;
	height: 38px;
	padding: 0 20px;
	color: #f2f2ed;
	background: linear-gradient(180deg, rgba(24, 27, 27, 0.92), rgba(8, 9, 9, 0.95));
	border: 1px solid rgba(255, 255, 255, 0.18);
	box-shadow: inset 4px 0 0 #ffd400, inset 0 0 0 1px rgba(0, 0, 0, 0.85);
	clip-path: polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%);
	font-size: 16px;
}

button.meta-chip {
	border-color: rgba(255, 255, 255, 0.2);
}

.meta-chip span {
	color: #b9b9b1;
	font-size: 14px;
}

.meta-chip b,
.meta-chip strong b {
	color: #ffd400;
}

.room-code {
	min-width: 196px;
}

	.top-actions {
		// display: grid;
		// grid-template-columns: repeat(4, 1fr);
		// align-self: stretch;
		display: flex;
		justify-content: end;
		align-items: center;
		gap: 8px;
		min-width: 0;
		padding: 0 8px;
		background: rgba(5, 6, 7, 0.38);
	}

.top-actions button {
	display: grid;
	place-items: center;
	gap: 4px;
	border: 0;
	border-left: 1px solid rgba(255, 255, 255, 0.08);
	background: linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.01));
	color: #e9e9e4;
	font-size: 13px;
	padding: 10px;
}

	.top-actions .el-icon {
		font-size: 27px;
	}

	.top-user-card {
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
		max-width: 250px;
		padding: 7px 10px;
		border: 1px solid rgba(255, 211, 42, 0.22);
		background:
			linear-gradient(135deg, rgba(255, 211, 42, 0.14), transparent 48%),
			rgba(15, 17, 17, 0.9);
		box-shadow: inset 3px 0 0 rgba(255, 211, 42, 0.82);
		clip-path: polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%);
	}

	.top-user-card .el-upload {
		display: block;
		flex: 0 0 auto;
	}

	.top-actions .top-avatar-button {
		width: 44px;
		height: 44px;
		padding: 0;
		display: grid;
		place-items: center;
		overflow: hidden;
		border: 2px solid rgba(255, 211, 42, 0.72);
		border-radius: 50%;
		background: #111315;
		color: #ffd400;
		font-size: 18px;
		font-weight: 1000;
		cursor: pointer;
		box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.42);
	}

	.top-actions .top-avatar-button:hover {
		border-color: #00d5ff;
		box-shadow:
			0 0 0 2px rgba(0, 213, 255, 0.22),
			0 0 18px rgba(0, 213, 255, 0.28);
	}

	.top-avatar-button img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.top-user-copy {
		min-width: 0;
		display: grid;
		gap: 3px;
		text-align: left;
	}

	.top-user-copy strong,
	.top-user-copy span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.top-user-copy strong {
		color: #f8f1d2;
		font-size: 15px;
		line-height: 1.1;
	}

	.top-user-copy span {
		color: rgba(248, 241, 210, 0.62);
		font-size: 11px;
		font-weight: 800;
	}

.screen-grid {
	display: grid;
	grid-template-columns: 31.6% 34.2% 31.6%;
	gap: 16px;
	height: calc(944px - 204px);
	min-height: 500px;
	padding: 16px 28px 10px;
}

.left-column,
.right-column {
	display: grid;
	gap: 14px;
	min-height: 0;
}

.left-column {
	grid-template-rows: minmax(330px, 52%) 1fr;
}

.right-column {
	grid-template-rows: 30% 35% 1fr;
}

.panel {
	position: relative;
	min-height: 0;
	overflow: hidden;
	background:
		linear-gradient(180deg, rgba(30, 32, 31, 0.92), rgba(8, 9, 9, 0.94)),
		url('/zzz-ui/panel-noise.svg') center / cover;
	border: 1px solid rgba(255, 255, 255, 0.12);
	box-shadow:
		inset 0 0 0 1px rgba(0, 0, 0, 0.9),
		0 14px 26px rgba(0, 0, 0, 0.5);
	clip-path: polygon(12px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 12px) 100%, 0 100%, 0 14px);
}

.panel::after {
	content: '';
	position: absolute;
	inset: 0;
	pointer-events: none;
	background:
		linear-gradient(135deg, transparent 0 46%, rgba(255, 255, 255, 0.04) 46% 46.4%, transparent 46.4%),
		radial-gradient(circle at 12% 18%, rgba(255, 255, 255, 0.08), transparent 28%);
}

.panel-title {
	position: relative;
	z-index: 1;
	display: flex;
	align-items: center;
	gap: 10px;
	// height: 54px;
	padding: 9px 18px 10px 28px;
	background: linear-gradient(90deg, rgba(255, 255, 255, 0.11), rgba(255, 255, 255, 0.02));
	border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.panel-title::before {
	content: '';
	position: absolute;
	left: 10px;
	top: 13px;
	width: 6px;
	height: 30px;
	background: var(--accent);
	box-shadow: 0 0 12px rgba(255, 212, 0, 0.45);
}

.panel-title h2 {
	margin: 0;
	font-size: 29px;
	font-style: italic;
	line-height: 1;
	text-shadow: 3px 3px 0 #111;
}

.panel-title span,
.panel-title small {
	color: var(--accent);
	font-size: 12px;
	font-style: italic;
	font-weight: 900;
}

.panel-title small {
	margin-left: auto;
	color: #aaa69c;
	font-size: 13px;
}

.panel-title-copy {
	display: flex;
	align-items: baseline;
	gap: 10px;
	min-width: 0;
}

.room-title-row {
	align-items: center;
	justify-content: space-between;
}

.panel-title-action {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 5px;
	height: 30px;
	min-width: 70px;
	margin-left: auto;
	color: #081010;
	background: #34efe1;
	border: 0;
	font-size: 13px;
	font-weight: 950;
	clip-path: polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%);
}

.panel-title-action .el-icon {
	font-size: 16px;
}

.cyan {
	--accent: #34efe1;
}

.yellow {
	--accent: #ffd400;
}

.red {
	--accent: #ff3e36;
}

.story-title-row {
	align-items: center;
	justify-content: space-between;
}

.story-title-row > div:first-child {
	display: flex;
	align-items: baseline;
	gap: 10px;
}

.mode-switch {
	display: grid;
	grid-template-columns: repeat(2, 70px);
	gap: 6px;
}

.mode-switch button {
	height: 30px;
	border: 1px solid rgba(255, 255, 255, 0.18);
	background: rgba(0, 0, 0, 0.35);
	color: #d8d8d0;
	font-size: 13px;
	font-weight: 900;
	clip-path: polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%);
}

.mode-switch button.active {
	border-color: #ffd400;
	background: #ffd400;
	color: #111;
}

.story-body,
.clue-list,
.question-feed,
.room-info,
.rank-list,
.host-actions,
.room-ops {
	position: relative;
	z-index: 1;
}

.story-body {
	height: calc(100% - 54px);
	overflow: auto;
	padding: 24px 36px 30px;
	background:
		radial-gradient(circle at 78% 30%, rgba(255, 210, 0, 0.05), transparent 28%),
		linear-gradient(120deg, rgba(0, 0, 0, 0.2), transparent);
	scrollbar-color: rgba(255, 212, 0, 0.62) rgba(255, 255, 255, 0.06);
	scrollbar-width: thin;
}

.story-body h3 {
	margin: 0 104px 14px 0;
	font-size: 32px;
	line-height: 1;
}

.story-rich {
	max-height: none;
	padding-right: 6px;
}

.story-rich :deep(p),
.story-body p {
	margin: 8px 0;
	color: #e2e2dc;
	font-size: 17px;
	font-weight: 700;
	line-height: 1.55;
}

.story-rich :deep(strong),
.story-body strong {
	color: #ffd400;
}

.story-title-input,
.main-input input,
.room-ops input {
	width: 100%;
	color: #f5f5f0;
	background: rgba(0, 0, 0, 0.42);
	border: 1px solid rgba(255, 255, 255, 0.14);
	outline: none;
	box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.68);
}

.story-title-input {
	height: 42px;
	margin-bottom: 12px;
	padding: 0 14px;
	color: #fff;
	font-size: 26px;
	font-weight: 950;
}

.locked-stamp {
	position: absolute;
	right: 26px;
	top: 20px;
	padding: 8px 14px;
	color: #ff3e36;
	border: 2px solid #ff3e36;
	font-size: 19px;
	font-weight: 900;
	transform: rotate(-7deg);
	box-shadow: inset 0 0 12px rgba(255, 62, 54, 0.16);
}

.clues-panel {
	display: flex;
	flex-direction: column;
}

.clue-list {
	display: grid;
	flex: 1;
	gap: 6px;
	min-height: 0;
	overflow: auto;
	padding: 12px 14px 8px;
	scrollbar-color: rgba(255, 212, 0, 0.58) rgba(255, 255, 255, 0.06);
	scrollbar-width: thin;
}

.clue-row {
	display: grid;
	grid-template-columns: 34px minmax(0, 1fr) 58px;
	align-items: start;
	gap: 10px;
	// min-height: 0;
	padding: 7px 10px;
	background: linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02));
	border: 1px solid rgba(255, 255, 255, 0.09);
	border-radius: 3px;
}

.clue-icon {
	display: grid;
	place-items: center;
	width: 32px;
	height: 32px;
	overflow: hidden;
	color: #84847d;
	background: #1c1d1c;
	border: 1px solid rgba(255, 255, 255, 0.18);
	border-radius: 50%;
	font-size: 13px;
	font-weight: 900;
}

.clue-row > div:nth-child(2) {
	min-width: 0;
}

.clue-icon img {
	width: 100%;
	height: 100%;
	object-fit: cover;
}

.clue-row.active .clue-icon {
	color: #ffd400;
	border-color: #ffd400;
}

.clue-row strong {
	display: block;
	max-width: 315px;
	overflow: hidden;
	font-size: 15px;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.clue-row p {
	margin: 4px 0 0;
	color: #aaa69f;
	font-size: 13px;
	font-weight: 700;
}

.clue-signal-tags {
	display: flex;
	flex-wrap: wrap;
	gap: 3px;
	// max-height: 32px;
	margin-top: 5px;
	overflow: hidden;
	padding-right: 4px;
}

.clue-signal-tags span {
	padding: 1px 5px;
	color: #111;
	background: #ffd400;
	border: 1px solid rgba(255, 255, 255, 0.12);
	clip-path: polygon(5px 0, 100% 0, calc(100% - 5px) 100%, 0 100%);
	font-size: 9px;
	font-weight: 950;
	line-height: 1.5;
}

.clue-signal-tags .tone-cyan {
	background: #34efe1;
}

.clue-signal-tags .tone-green {
	background: #47f28a;
}

.clue-signal-tags .tone-red {
	color: #fff;
	background: #ff3e36;
}

.clue-verdict-stamp {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 4px;
	min-width: 58px;
	height: 28px;
	padding: 0 6px;
	color: #d8d8d2;
	border: 1px solid rgba(255, 255, 255, 0.2);
	font-size: 12px;
	font-weight: 950;
	transform: rotate(-4deg);
}

.clue-verdict-stamp.danger {
	color: #ff514a;
	border-color: rgba(255, 62, 54, 0.72);
	box-shadow: inset 0 0 10px rgba(255, 62, 54, 0.12);
}

.clue-verdict-stamp.warn {
	color: #ffd400;
	border-color: rgba(255, 212, 0, 0.72);
	box-shadow: inset 0 0 10px rgba(255, 212, 0, 0.12);
}

.clue-verdict-stamp.muted,
.clue-verdict-stamp.waiting {
	color: #aaa69c;
	border-color: rgba(255, 255, 255, 0.22);
}

.clue-verdict-stamp i {
	font-style: normal;
}

.caution-button {
	position: relative;
	z-index: 1;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 8px;
	height: 46px;
	margin: auto 10px 10px;
	color: #0c0c09;
	background:
		repeating-linear-gradient(-32deg, rgba(0, 0, 0, 0.26) 0 12px, transparent 12px 24px),
		linear-gradient(90deg, #e0bd00, #ffd400);
	border: 0;
	// clip-path: polygon(22px 0, 100% 0, calc(100% - 18px) 100%, 0 100%);
	font-size: 17px;
	font-weight: 950;
}

.qa-panel {
	position: relative;
	display: flex;
	flex-direction: column;
}

.live-title b {
	margin-left: 0;
	padding: 1px 8px;
	color: #111;
	background: #ffd400;
	font-size: 13px;
	font-style: italic;
}

.qa-view-switch {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	margin-left: auto;
	padding: 3px;
	background: rgba(0, 0, 0, 0.44);
	border: 1px solid rgba(255, 212, 0, 0.28);
}

.qa-view-switch button {
	min-width: 48px;
	height: 24px;
	padding: 0 8px;
	color: #d8d8d0;
	background: transparent;
	border: 0;
	font-size: 12px;
	font-weight: 950;
}

.qa-view-switch button.active {
	color: #111;
	background: #ffd400;
}

.question-feed {
	flex: 1;
	overflow: auto;
	padding: 14px 18px 10px;
	scrollbar-color: rgba(255, 212, 0, 0.5) rgba(255, 255, 255, 0.06);
	scrollbar-width: thin;
}

.question-stream {
	min-height: 100%;
}

.question-card {
	position: relative;
	display: grid;
	grid-template-columns: 42px 1fr 112px;
	align-items: center;
	gap: 10px;
	min-height: 94px;
	margin-bottom: 10px;
	padding: 12px 12px 12px 14px;
	background: linear-gradient(100deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.03));
	border: 1px solid rgba(255, 255, 255, 0.07);
	border-radius: 4px;
	cursor: pointer;
	transition:
		border-color 0.18s ease,
		box-shadow 0.18s ease,
		transform 0.18s ease;
}

.question-card.important {
	border-color: rgba(255, 212, 0, 0.38);
	box-shadow: inset 4px 0 0 rgba(255, 212, 0, 0.78);
}

.question-card.selected {
	border-color: rgba(255, 212, 0, 0.72);
	box-shadow:
		inset 4px 0 0 #ffd400,
		0 0 22px rgba(255, 212, 0, 0.16);
}

.question-card.scored {
	animation: signalPulse 0.5s ease;
}

.question-card:has(.host-operate-toggle:hover),
.question-card:has(.host-operate-toggle:focus-visible) {
	border-color: rgba(255, 212, 0, 0.46);
}

.question-card.pending {
	opacity: 0.65;
}

.avatar-token {
	display: grid;
	place-items: center;
	width: 38px;
	height: 38px;
	overflow: hidden;
	color: #fff;
	background: #554800;
	border: 2px solid #ffd400;
	border-radius: 50%;
	font-size: 18px;
	font-weight: 950;
}

.avatar-token img,
.emoji-bar img {
	width: 100%;
	height: 100%;
	object-fit: cover;
}

.question-content header {
	display: flex;
	align-items: baseline;
	gap: 12px;
}

.question-content strong {
	color: #f3f0df;
	font-size: 15px;
}

.question-content time {
	color: #7f7f78;
	font-size: 12px;
}

.question-content p {
	margin: 5px 0 8px;
	color: #f1f1ec;
	font-family: 'Microsoft YaHei', Arial, sans-serif;
	font-size: 16px;
	font-weight: 700;
}

.question-content footer {
	color: #35efdf;
	font-size: 15px;
	font-weight: 900;
}

.question-signal-tags {
	display: flex;
	flex-wrap: wrap;
	gap: 5px;
	margin-top: 7px;
	// padding-right: 72px;
}

.question-signal-tags span {
	padding: 2px 7px;
	color: #111;
	background: #ffd400;
	border: 1px solid rgba(255, 255, 255, 0.1);
	clip-path: polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%);
	font-size: 11px;
	font-weight: 950;
	animation: tagPopIn 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.question-signal-tags .tone-cyan {
	background: #34efe1;
}

.question-signal-tags .tone-green {
	background: #47f28a;
}

.question-signal-tags .tone-yellow,
.question-signal-tags .tone-gold {
	background: #ffd400;
}

.question-signal-tags .tone-red {
	color: #fff;
	background: #ff3e36;
}

.verdict-stamp {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 8px;
	width: 96px;
	height: 44px;
	justify-self: end;
	border: 2px solid currentColor;
	font-size: 21px;
	font-weight: 950;
	transform: rotate(-6deg);
}

.verdict-stamp i {
	font-style: normal;
	opacity: 0.78;
}

.verdict-stamp.danger {
	color: #ff3e36;
}

.verdict-stamp.warn {
	color: #ffd400;
}

.verdict-stamp.muted,
.verdict-stamp.waiting {
	color: #a7a7a0;
}

.host-operate-toggle {
	position: absolute;
	right: 12px;
	bottom: 8px;
	z-index: 2;
	min-width: 74px;
	height: 28px;
	color: #111;
	background: #ffd400;
	border: 0;
	border-radius: 3px;
	font-size: 12px;
	font-weight: 950;
}

.host-operate-toggle:hover,
.host-operate-toggle:focus-visible {
	box-shadow: 0 0 16px rgba(255, 212, 0, 0.34);
}

.question-actions {
	position: absolute;
	right: 12px;
	bottom: 8px;
	display: flex;
	gap: 5px;
	opacity: 0;
	transition: opacity 0.18s ease;
}

.question-card:hover .question-actions {
	opacity: 1;
}

.question-actions button {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	min-width: 30px;
	height: 28px;
	padding: 0 7px;
	color: #eee;
	background: rgba(0, 0, 0, 0.76);
	border: 1px solid rgba(255, 255, 255, 0.18);
	border-radius: 3px;
	font-size: 12px;
	font-weight: 900;
}

.question-actions button.active {
	color: #111;
	background: #ffd400;
	border-color: #ffd400;
}

.qa-command-panel {
	position: absolute;
	z-index: 5;
	right: 14px;
	width: 360px;
	display: grid;
	gap: 10px;
	padding: 14px;
	background:
		linear-gradient(180deg, rgba(32, 34, 32, 0.98), rgba(8, 9, 9, 0.98)),
		url('/zzz-ui/panel-noise.svg') center / cover;
	border: 1px solid rgba(255, 212, 0, 0.45);
	box-shadow: 0 18px 46px rgba(0, 0, 0, 0.62), inset 0 0 0 1px rgba(0, 0, 0, 0.8);
	clip-path: polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px);
	font-family: 'Microsoft YaHei', Arial, sans-serif;
	animation: commandDockIn 0.22s cubic-bezier(0.2, 1, 0.3, 1);
	transition: top 0.18s cubic-bezier(0.2, 1, 0.3, 1);
}

.qa-command-panel::before {
	content: '';
	position: absolute;
	left: 0;
	top: 0;
	width: 6px;
	height: 100%;
	background: linear-gradient(#ffd400, #ff3e36);
}

.qa-command-panel header {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: 12px;
}

.qa-command-panel header > div {
	display: grid;
	gap: 4px;
	min-width: 0;
}

.qa-command-panel header strong {
	color: #fff;
	font-size: 18px;
	font-style: italic;
}

.qa-command-panel header span {
	min-width: 0;
	overflow: hidden;
	color: #8f8f88;
	font-size: 12px;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.qa-command-panel header button {
	width: 34px;
	height: 30px;
	color: #eee;
	background: rgba(255, 255, 255, 0.08);
	border: 1px solid rgba(255, 255, 255, 0.14);
}

.qa-command-panel p {
	margin: 0;
	padding: 10px 12px;
	color: #f2f2ed;
	background: rgba(0, 0, 0, 0.38);
	border: 1px solid rgba(255, 255, 255, 0.08);
	font-size: 14px;
	font-weight: 800;
	line-height: 1.45;
}

.command-section {
	display: grid;
	grid-template-columns: 44px 1fr;
	align-items: center;
	gap: 8px;
}

.command-buttons {
	display: flex;
	flex-wrap: wrap;
	gap: 7px;
}

.action-title {
	width: 42px;
	color: #aaa69c;
	font-size: 12px;
	font-weight: 900;
}

.judge {
	height: 28px;
	padding: 0 10px;
	// color: #e8e8e0;
	color: var(--muted);
	background: rgba(0, 0, 0, 0.76);
	border: 1px solid rgba(255, 255, 255, 0.16);
	border-radius: 3px;
	font-size: 12px;
	font-weight: 900;
}

.judge.active,
.judge.flag.active {
	border-color: rgba(255, 212, 0, 0.62);
	color: #000;
	background: #ffd400;
}

.judge.delete {
	border-color: rgba(255, 62, 54, 0.5);
}

.score-grid {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 8px;
}

.score-grid label,
.achievement-row label {
	display: grid;
	gap: 4px;
	color: #aaa69c;
	font-size: 12px;
	font-weight: 900;
}

.score-grid select {
	width: 100%;
	height: 30px;
	color: #f2f2ed;
	background: rgba(0, 0, 0, 0.5);
	border: 1px solid rgba(255, 255, 255, 0.14);
	outline: none;
}

.achievement-row {
	display: grid;
	grid-template-columns: repeat(3, 1fr);
	gap: 8px;
}

.achievement-row label {
	display: flex;
	align-items: center;
}

.feed-footer {
	display: flex;
	align-items: center;
	justify-content: space-between;
	height: 42px;
	padding: 0 22px;
	color: #8e8e86;
	border-top: 1px solid rgba(255, 255, 255, 0.08);
	font-size: 12px;
	font-weight: 700;
}

.feed-footer label {
	display: inline-flex;
	align-items: center;
	gap: 8px;
	color: #c8c8c0;
}

.room-panel {
	display: flex;
	flex-direction: column;
}

.room-status-strip,
.auth-console,
.soup-console {
	position: relative;
	z-index: 1;
}

.room-status-strip {
	display: grid;
	grid-template-columns: 116px 1fr;
	gap: 10px;
	padding: 10px 16px 0 28px;
	color: #d8d8d0;
	font-size: 13px;
	font-family: 'Microsoft YaHei', Arial, sans-serif;
	font-weight: 700;
}

.room-status-strip strong {
	min-width: 0;
	overflow: hidden;
	color: #fff;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.room-status-strip span {
	min-width: 0;
	overflow: hidden;
	color: #8f8f88;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.auth-console {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 7px;
	padding: 8px 16px 0 28px;
}

.auth-tabs {
	display: grid;
	grid-column: span 2;
	grid-template-columns: repeat(2, 1fr);
	gap: 6px;
}

.auth-tabs button,
.auth-console > button,
.soup-select-row button,
.room-flow-actions button {
	height: 30px;
	color: #111;
	background: #ffd400;
	border: 0;
	font-size: 13px;
	font-weight: 950;
}

.auth-tabs button {
	color: #d8d8d0;
	background: rgba(255, 255, 255, 0.08);
	border: 1px solid rgba(255, 255, 255, 0.14);
}

.auth-tabs button.active {
	color: #111;
	background: #ffd400;
	border-color: #ffd400;
}

.auth-console input,
.soup-select-row select,
.soup-editor input,
.soup-editor textarea,
.soup-editor select {
	min-width: 0;
	color: #f5f5ef;
	background: rgba(0, 0, 0, 0.46);
	border: 1px solid rgba(255, 255, 255, 0.15);
	outline: none;
}

.auth-console input {
	height: 32px;
	padding: 0 10px;
	font-size: 13px;
}

.auth-console input:first-of-type:nth-last-of-type(2),
.auth-console input:first-of-type:nth-last-of-type(2) ~ input {
	grid-column: auto;
}

.auth-console > button {
	grid-column: span 2;
}

.soup-console {
	display: grid;
	gap: 7px;
	padding: 8px 16px 0 28px;
}

.room-create-summary {
	position: relative;
	z-index: 1;
	display: grid;
	gap: 10px;
	padding: 16px 18px 14px 28px;
	font-family: 'Microsoft YaHei', Arial, sans-serif;
}

.room-create-summary strong {
	color: #fff;
	font-size: 18px;
	font-weight: 950;
}

.room-create-summary p {
	margin: 0;
	color: #aaa69c;
	font-size: 13px;
	font-weight: 700;
	line-height: 1.5;
}

.room-create-summary dl {
	display: grid;
	gap: 7px;
	margin: 0;
}

.room-create-summary dl > div {
	display: grid;
	grid-template-columns: 82px 1fr;
	gap: 10px;
	color: #d8d8d0;
	font-size: 13px;
}

.room-create-summary dt {
	color: #8f8f88;
}

.room-create-summary dd {
	min-width: 0;
	margin: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.soup-select-row {
	display: grid;
	grid-template-columns: 1fr 54px 54px;
	gap: 6px;
}

.soup-select-row select {
	height: 32px;
	padding: 0 8px;
	font-size: 13px;
}

.selected-soup-card {
	display: grid;
	grid-template-columns: 1fr auto;
	gap: 8px;
	min-height: 30px;
	align-items: center;
	padding: 0 10px;
	background: rgba(255, 255, 255, 0.06);
	border: 1px solid rgba(255, 255, 255, 0.09);
	font-family: 'Microsoft YaHei', Arial, sans-serif;
}

.selected-soup-card strong,
.selected-soup-card span {
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.selected-soup-card strong {
	color: #fff;
	font-size: 13px;
}

.selected-soup-card span {
	color: #9a9a94;
	font-size: 12px;
}

.room-flow-actions {
	display: grid;
}

.room-config-panel {
	width: 620px;
}


.clue-manager-panel {
	width: 860px;
	max-height: 820px;
}

.reveal-confirm-panel {
	width: 560px;
}

.reveal-summary-panel {
	display: flex;
	width: min(980px, calc(100vw - 80px));
	max-height: min(860px, calc(100vh - 72px));
	flex-direction: column;
}

.reveal-summary-body {
	display: grid;
	min-height: 0;
	grid-template-columns: minmax(0, 1.15fr) minmax(280px, 0.85fr);
	gap: 12px;
	overflow: auto;
	padding: 16px 18px;
}

.result-answer-card,
.result-rank-card,
.result-mvp-card {
	min-width: 0;
	padding: 14px;
	background: rgba(0, 0, 0, 0.34);
	border: 1px solid rgba(255, 255, 255, 0.12);
	font-family: 'Microsoft YaHei', Arial, sans-serif;
}

.result-answer-card {
	grid-row: span 2;
}

.result-section-title {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	margin-bottom: 10px;
	color: #ffd400;
	font-weight: 950;
}

.result-section-title span {
	color: #8f8f88;
	font-size: 12px;
}

.result-answer-rich {
	max-height: 520px;
	overflow: auto;
	color: #f2f2ed;
	font-size: 16px;
	font-weight: 700;
	line-height: 1.7;
}

.result-rank-list {
	display: grid;
	gap: 8px;
}

.result-rank-row {
	display: grid;
	grid-template-columns: 44px minmax(0, 1fr) auto;
	gap: 8px;
	align-items: center;
	color: #f2f2ed;
}

.result-rank-row b {
	color: #ffd400;
}

.result-rank-row span {
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.result-rank-row strong {
	color: #34efe1;
}

.result-mvp-hero {
	display: flex;
	align-items: center;
	gap: 12px;
}

.result-mvp-avatar {
	display: grid;
	width: 52px;
	height: 52px;
	place-items: center;
	overflow: hidden;
	color: #111;
	background: #ffd400;
	border-radius: 50%;
	font-size: 22px;
	font-weight: 950;
}

.result-mvp-avatar img {
	width: 100%;
	height: 100%;
	object-fit: cover;
}

.result-mvp-hero p {
	margin: 4px 0 0;
	color: #aaa69c;
}

.mvp-select-console {
	display: grid;
	gap: 10px;
}

.mvp-select-console select,
.mvp-select-console button {
	height: 34px;
	color: #f5f5ef;
	background: rgba(0, 0, 0, 0.46);
	border: 1px solid rgba(255, 255, 255, 0.15);
}

.mvp-select-console button {
	color: #111;
	background: #ffd400;
	border-color: #ffd400;
	font-weight: 950;
}

.mvp-select-console button:disabled {
	cursor: not-allowed;
	opacity: 0.55;
}

.answer-state,
.reveal-warning {
	display: grid;
	gap: 6px;
	margin: 16px 18px 12px;
	padding: 14px;
	background: rgba(255, 212, 0, 0.08);
	border: 1px solid rgba(255, 212, 0, 0.22);
	font-family: 'Microsoft YaHei', Arial, sans-serif;
}

.answer-state strong,
.reveal-warning strong {
	color: #ffd400;
	font-size: 17px;
	font-weight: 950;
}

.answer-state span,
.reveal-warning p {
	margin: 0;
	color: #c9c9c1;
	font-size: 13px;
	font-weight: 700;
	line-height: 1.5;
}

.answer-rich-editor {
	margin: 0 18px 18px;
	background: rgba(0, 0, 0, 0.34);
	border: 1px solid rgba(255, 255, 255, 0.14);
}

.answer-rich-editor :deep(.rich-editor-toolbar) {
	min-height: 46px;
	background: rgba(0, 0, 0, 0.46);
	border-bottom-color: rgba(255, 255, 255, 0.12);
}

.answer-rich-editor :deep(.rich-editor-content) {
	max-height: 430px;
	overflow: auto;
	color: #f2f2ed;
	background: rgba(3, 4, 4, 0.44);
}

.answer-rich-editor :deep(.rich-editor-content) {
	min-height: 360px !important;
	color: #f2f2ed;
	font-family: 'Microsoft YaHei', Arial, sans-serif;
	font-size: 16px;
	font-weight: 700;
}

.clue-manager-list {
	display: grid;
	gap: 10px;
	max-height: 560px;
	overflow: auto;
	padding: 16px 18px;
	scrollbar-color: rgba(255, 212, 0, 0.58) rgba(255, 255, 255, 0.06);
	scrollbar-width: thin;
}

.clue-manager-list article {
	display: grid;
	grid-template-columns: 1fr auto;
	gap: 14px;
	align-items: center;
	padding: 12px;
	background: rgba(255, 255, 255, 0.055);
	border: 1px solid rgba(255, 255, 255, 0.1);
	font-family: 'Microsoft YaHei', Arial, sans-serif;
}

.clue-manager-main {
	display: grid;
	gap: 5px;
	min-width: 0;
}

.clue-manager-main strong,
.clue-manager-main span {
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.clue-manager-main strong {
	color: #fff;
	font-size: 14px;
	font-weight: 900;
}

.clue-manager-main > span {
	color: #8f8f88;
	font-size: 12px;
}

.clue-manager-actions {
	display: flex;
	flex-wrap: wrap;
	justify-content: flex-end;
	gap: 6px;
}

.clue-manager-actions button {
	height: 30px;
	padding: 0 10px;
	color: #e8e8e0;
	background: rgba(255, 255, 255, 0.08);
	border: 1px solid rgba(255, 255, 255, 0.16);
	font-size: 12px;
	font-weight: 900;
}

.clue-manager-actions button.active {
	color: #111;
	background: #ffd400;
	border-color: #ffd400;
}

.room-config-auth {
	padding: 18px;
}

.room-config-body {
	display: grid;
	gap: 16px;
	padding: 18px;
}

.room-config-section {
	display: grid;
	gap: 10px;
	padding: 14px;
	background: rgba(255, 255, 255, 0.055);
	border: 1px solid rgba(255, 255, 255, 0.1);
	font-family: 'Microsoft YaHei', Arial, sans-serif;
}

.room-config-section h3 {
	margin: 0;
	color: #fff;
	font-size: 17px;
	font-style: italic;
}

.room-info {
	display: grid;
	grid-template-columns: 1fr 150px;
	gap: 16px;
	padding: 10px 16px 8px 28px;
}

.room-info dl {
	margin: 0;
}

.room-info dl > div {
	display: grid;
	grid-template-columns: 82px 1fr;
	gap: 10px;
	margin-bottom: 5px;
	color: #cfcfc7;
	font-size: 13px;
}

.room-info dt {
	color: #8f8f88;
}

.room-info dd {
	min-width: 0;
	margin: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.room-map {
	position: relative;
	display: grid;
	place-items: center;
	min-height: 104px;
	overflow: hidden;
	color: #55dff2;
	background:
		linear-gradient(135deg, rgba(18, 43, 70, 0.7), rgba(2, 5, 8, 0.6)),
		repeating-linear-gradient(90deg, rgba(83, 153, 255, 0.1) 0 1px, transparent 1px 22px);
	border: 1px solid rgba(62, 146, 255, 0.28);
}

.room-map .el-icon {
	position: absolute;
	top: 12px;
	right: 12px;
	font-size: 24px;
	opacity: 0.55;
}

.room-map span {
	color: #7187a2;
	font-size: 15px;
	font-weight: 900;
	text-align: center;
}

.room-map b {
	position: absolute;
	right: -8px;
	bottom: 10px;
	padding: 3px 14px;
	color: #001112;
	background: #0bb4aa;
	font-size: 14px;
	transform: rotate(-7deg);
}

.room-ops {
	display: grid;
	grid-template-columns: 1fr 58px 58px;
	gap: 7px;
	margin-top: auto;
	padding: 0 16px 12px;
}

.modal-room-ops {
	grid-template-columns: 1fr 72px;
	margin-top: 0;
	padding: 0;
}

.big-modal {
	position: absolute;
	inset: 0;
	z-index: 20;
	display: grid;
	place-items: center;
	background: rgba(0, 0, 0, 0.72);
	backdrop-filter: blur(4px);
}

.manager-modal {
	z-index: 20;
}

.editor-modal {
	z-index: 24;
}

.modal-panel {
	position: relative;
	// width: 640px;
	max-height: 820px;
	overflow: hidden;
	color: #f2f2ed;
	background:
		linear-gradient(180deg, rgba(30, 32, 31, 0.98), rgba(8, 9, 9, 0.98)),
		url('/zzz-ui/panel-noise.svg') center / cover;
	border: 1px solid rgba(255, 212, 0, 0.36);
	box-shadow: 0 24px 70px rgba(0, 0, 0, 0.68);
	clip-path: polygon(16px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%, 0 16px);
	transform-origin: 50% 44%;
}

.modal-panel::before {
	content: '';
	position: absolute;
	left: 0;
	top: 0;
	width: 100%;
	height: 3px;
	background: linear-gradient(90deg, transparent, #ffd400 18%, #34efe1 58%, transparent);
	opacity: 0.9;
}

.modal-panel > header,
.modal-panel > footer {
	flex: 0 0 auto;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	padding: 14px 18px;
	background: rgba(255, 255, 255, 0.07);
	border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.modal-panel > footer {
	justify-content: flex-end;
	border-top: 1px solid rgba(255, 255, 255, 0.1);
	border-bottom: 0;
}

.modal-panel > header strong {
	display: inline-flex;
	align-items: center;
	gap: 8px;
	font-size: 24px;
	font-style: italic;
}

.modal-panel > header strong .el-icon {
	color: #ffd400;
	font-size: 22px;
}

.modal-panel > header span {
	color: #ffd400;
	font-size: 12px;
	font-style: italic;
	font-weight: 900;
}

.modal-panel > header button,
.modal-panel > footer button,
.soup-manage-list button {
	min-width: 72px;
	height: 34px;
	color: #eee;
	background: rgba(255, 255, 255, 0.08);
	border: 1px solid rgba(255, 255, 255, 0.15);
	font-size: 13px;
	font-weight: 900;
}

.modal-panel > footer button:last-child {
	color: #111;
	background: #ffd400;
	border-color: #ffd400;
}

.soup-editor {
	display: flex;
	flex-direction: column;
	width: 820px;
	max-height: min(860px, calc(100vh - 72px));
}

.soup-editor label,
.story-editor-panel label,
.editor-field {
	display: grid;
	gap: 7px;
	padding: 12px 18px 0;
	color: #d6d6ce;
	font-family: 'Microsoft YaHei', Arial, sans-serif;
	font-size: 13px;
	font-weight: 800;
}

.soup-editor input,
.soup-editor select,
.story-editor-panel input {
	height: 38px;
	padding: 0 10px;
}

.story-editor-panel {
	display: flex;
	flex-direction: column;
	width: 920px;
	max-height: min(820px, calc(100vh - 72px));
}

.modal-scroll-body {
	flex: 1 1 auto;
	min-height: 0;
	overflow: auto;
	padding-bottom: 14px;
	scrollbar-color: rgba(255, 212, 0, 0.5) rgba(255, 255, 255, 0.06);
	scrollbar-width: thin;
}

.story-editor-panel input {
	width: 100%;
	color: #f5f5f0;
	background: rgba(0, 0, 0, 0.46);
	border: 1px solid rgba(255, 255, 255, 0.15);
	outline: none;
}

.story-editor-field {
	padding-bottom: 14px;
}

.soup-editor-field {
	padding-bottom: 6px;
}

.story-modal-rich-editor,
.soup-rich-editor {
	background: rgba(0, 0, 0, 0.34);
	border: 1px solid rgba(255, 255, 255, 0.14);
}

.story-modal-rich-editor :deep(.rich-editor-toolbar),
.soup-rich-editor :deep(.rich-editor-toolbar) {
	min-height: 46px;
	background: rgba(0, 0, 0, 0.46);
	border-bottom-color: rgba(255, 255, 255, 0.12);
}

.story-modal-rich-editor :deep(.rich-editor-content),
.soup-rich-editor :deep(.rich-editor-content) {
	max-height: 430px;
	overflow: auto;
	color: #f2f2ed;
	background: rgba(3, 4, 4, 0.44);
}

.story-modal-rich-editor :deep(.rich-editor-content),
.soup-rich-editor :deep(.rich-editor-content) {
	min-height: 430px !important;
	color: #f2f2ed;
	font-family: 'Microsoft YaHei', Arial, sans-serif;
	font-size: 16px;
	font-weight: 700;
}

.soup-rich-editor :deep(.rich-editor-content) {
	max-height: 220px;
	min-height: 210px !important;
}

.modal-grid {
	display: grid;
	grid-template-columns: 1fr 180px;
	gap: 10px;
	padding-right: 18px;
}

.modal-grid label {
	padding-right: 0;
}

.soup-manager-panel {
	width: 560px;
}

.zzz-modal-enter-active,
.zzz-modal-leave-active {
	transition: opacity 0.22s ease;
}

.zzz-modal-enter-active .modal-panel {
	animation: modalBootIn 0.3s cubic-bezier(0.2, 1, 0.3, 1);
}

.zzz-modal-leave-active .modal-panel {
	animation: modalBootOut 0.18s ease forwards;
}

.zzz-modal-enter-from,
.zzz-modal-leave-to {
	opacity: 0;
}

.question-stream-enter-active {
	transition:
		opacity 0.2s ease,
		filter 0.2s ease;
}

.question-stream-enter-from {
	opacity: 0;
	filter: blur(2px);
}

@keyframes tagPopIn {
	0% {
		opacity: 0;
		transform: translateY(8px) scale(0.86);
	}
	100% {
		opacity: 1;
		transform: translateY(0) scale(1);
	}
}

@keyframes signalPulse {
	0% {
		box-shadow: inset 4px 0 0 rgba(255, 212, 0, 0.78), 0 0 0 rgba(255, 212, 0, 0);
	}
	45% {
		box-shadow: inset 4px 0 0 #ffd400, 0 0 26px rgba(255, 212, 0, 0.26);
	}
	100% {
		box-shadow: inset 4px 0 0 rgba(255, 212, 0, 0.78), 0 0 0 rgba(255, 212, 0, 0);
	}
}

@keyframes commandDockIn {
	from {
		opacity: 0;
		filter: blur(2px);
		transform: translateX(24px) skewX(-4deg);
	}
	to {
		opacity: 1;
		filter: blur(0);
		transform: translateX(0) skewX(0);
	}
}

@keyframes modalBootIn {
	0% {
		opacity: 0;
		filter: blur(4px);
		transform: translateY(28px) scale(0.97) skewX(-4deg);
	}
	58% {
		opacity: 1;
		filter: blur(0);
		transform: translateY(-4px) scale(1.006) skewX(1deg);
	}
	100% {
		transform: translateY(0) scale(1) skewX(0);
	}
}

@keyframes modalBootOut {
	to {
		opacity: 0;
		filter: blur(3px);
		transform: translateY(18px) scale(0.98) skewX(3deg);
	}
}

.empty-state {
	padding: 48px 24px;
	color: #9a9a94;
	text-align: center;
}

.soup-manage-list {
	display: grid;
	gap: 10px;
	padding: 16px;
}

.soup-manage-list article {
	display: grid;
	grid-template-columns: 1fr auto;
	gap: 12px;
	align-items: center;
	padding: 10px;
	background: rgba(255, 255, 255, 0.06);
	border: 1px solid rgba(255, 255, 255, 0.1);
}

.soup-manage-list article.active {
	border-color: #ffd400;
	box-shadow: inset 4px 0 0 #ffd400;
}

.soup-manage-main {
	display: grid;
	gap: 4px;
	min-width: 0;
	padding: 0;
	text-align: left;
	background: transparent;
	border: 0;
}

.soup-manage-main strong,
.soup-manage-main span {
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.soup-manage-main span {
	color: #aaa69c;
	font-family: 'Microsoft YaHei', Arial, sans-serif;
	font-size: 12px;
}

.soup-manage-list article > div {
	display: flex;
	gap: 6px;
}

.room-ops input {
	height: 34px;
	padding: 0 10px;
	font-size: 13px;
}

.room-ops button {
	height: 34px;
	color: #111;
	background: #ffd400;
	border: 0;
	font-size: 13px;
	font-weight: 950;
}

.rank-list {
	display: grid;
	gap: 2px;
	padding: 10px 22px 0;
}

.rank-row {
	display: grid;
	grid-template-columns: 44px 1fr auto;
	align-items: center;
	min-height: 27px;
	padding: 0 8px;
	background: rgba(255, 255, 255, 0.04);
	color: #d7d7cf;
	font-family: 'Microsoft YaHei', Arial, sans-serif;
	font-size: 15px;
	font-weight: 700;
}

.rank-row span {
	color: #fff;
	font-family: 'Arial Black', Arial, sans-serif;
	font-size: 14px;
}

.rank-row.rank-01 span,
.rank-row.rank-02 span,
.rank-row.rank-03 span {
	display: inline-grid;
	place-items: center;
	width: 30px;
	height: 24px;
	color: #111;
	background: #ffd400;
	clip-path: polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%);
}

.rank-row.rank-02 span {
	background: #d9dde2;
}

.rank-row.rank-03 span {
	background: #c77a4c;
}

.rank-row em {
	color: #e8e8e0;
	font-style: normal;
}

.host-panel {
	border-color: rgba(255, 62, 54, 0.28);
}

.host-actions {
	display: grid;
	grid-template-columns: repeat(4, 1fr);
	gap: 12px;
	height: calc(100% - 54px);
	padding: 18px 16px;
}

.host-actions button {
	display: grid;
	place-items: center;
	gap: 8px;
	color: #e9e9e2;
	background: linear-gradient(180deg, rgba(255, 255, 255, 0.09), rgba(255, 255, 255, 0.03));
	border: 1px solid rgba(255, 255, 255, 0.13);
	box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.75);
	font-size: 14px;
	font-weight: 900;
}

.host-actions button.danger {
	color: #ff514a;
	border-color: #ff3e36;
	box-shadow: inset 0 0 0 1px rgba(255, 62, 54, 0.35), 0 0 14px rgba(255, 62, 54, 0.12);
}

.host-actions .el-icon {
	font-size: 34px;
}

.input-console {
	display: grid;
	grid-template-columns: 450px 1fr 138px 386px;
	gap: 12px;
	// height: 112px;
	padding: 10px 28px 14px;
}

.quick-ask,
.main-input,
.send-button,
.emoji-bar {
	position: relative;
	overflow: hidden;
	background: linear-gradient(180deg, rgba(30, 34, 36, 0.96), rgba(7, 9, 10, 0.96));
	border: 1px solid rgba(255, 255, 255, 0.12);
	box-shadow:
		inset 0 0 0 1px rgba(0, 0, 0, 0.8),
		0 10px 20px rgba(0, 0, 0, 0.45);
	clip-path: polygon(12px 0, 100% 0, calc(100% - 12px) 100%, 0 100%, 0 12px);
}

.quick-ask {
	display: grid;
	grid-template-rows: 24px 30px 1fr;
	padding: 10px 14px 10px;
}

.quick-ask strong,
.emoji-bar strong {
	color: #cfcfc8;
	font-size: 14px;
}

.quick-ask div {
	display: flex;
	gap: 8px;
}

.quick-ask button {
	min-width: 76px;
	height: 26px;
	color: #f3f3ec;
	background: rgba(255, 255, 255, 0.1);
	border: 1px solid rgba(255, 255, 255, 0.16);
	font-size: 13px;
}

.quick-ask p {
	margin: 8px 0 0;
	color: #8f8f87;
	font-family: 'Microsoft YaHei', Arial, sans-serif;
	font-size: 15px;
	font-weight: 700;
}

.main-input {
	display: grid;
	grid-template-columns: 1fr 72px;
	align-items: center;
	padding: 0 18px;
}

.main-input input {
	height: 54px;
	padding: 0 10px;
	color: #f2f2ed;
	background: transparent;
	border: 0;
	box-shadow: none;
	font-family: 'Microsoft YaHei', Arial, sans-serif;
	font-size: 24px;
	font-weight: 700;
}

.main-input small {
	color: #a4a49d;
	font-size: 16px;
	text-align: right;
}

.send-button {
	display: grid;
	grid-template-rows: 24px 30px 16px;
	place-items: center;
	align-content: center;
	gap: 2px;
	color: #111;
	background:
		repeating-linear-gradient(-30deg, rgba(0, 0, 0, 0.14) 0 12px, transparent 12px 24px),
		linear-gradient(180deg, #ffe65d, #ffd400);
	border: 0;
	font-size: 25px;
	font-weight: 950;
}

.send-icon-main {
	font-size: 28px;
	// transform: rotate(-28deg);
}

.send-button small {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	font-size: 12px;
}

.send-icon-inline {
	font-size: 14px;
	transform: none;
}

.emoji-bar {
	display: grid;
	grid-template-rows: 26px 1fr;
	padding: 10px 14px 10px;
}

.emoji-bar div {
	display: grid;
	grid-template-columns: repeat(6, 1fr);
	gap: 8px;
}

.emoji-bar button {
	display: grid;
	place-items: center;
	width: 44px;
	height: 42px;
	overflow: hidden;
	color: #f0f0e8;
	background: rgba(255, 255, 255, 0.08);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 4px;
}

.emoji-bar button.offline {
	opacity: 0.45;
}
</style>
