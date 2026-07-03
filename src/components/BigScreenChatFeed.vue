<script setup lang="ts">
type Verdict = 'yes' | 'no' | 'both' | 'irrelevant'
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

const props = withDefaults(
	defineProps<{
		questions: Question[]
		user?: AuthUser | null
		canHost?: boolean
		activeQuestionId?: string
	}>(),
	{
		user: null,
		canHost: false,
		activeQuestionId: '',
	},
)

const emit = defineEmits<{
	(event: 'toggle-host-panel', question: Question): void
	(event: 'set-question-card-ref', questionId: string, element: unknown): void
}>()

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

function getQuestionRenderKey(question: Question) {
	return question.clientKey ?? question.id
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
</script>

<template>
	<TransitionGroup name="chat-message" tag="div" class="big-screen-chat-feed">
		<article
			v-for="question in questions"
			:key="getQuestionRenderKey(question)"
			:ref="element => emit('set-question-card-ref', question.id, element)"
			:class="[
				'chat-message',
				{
					mine: question.author.id === user?.id,
					selected: activeQuestionId === question.id,
					pending: question.clientStatus === 'sending',
					important: question.important,
				},
			]"
			role="button"
			tabindex="0"
			@click="emit('toggle-host-panel', question)"
			@keyup.enter="emit('toggle-host-panel', question)"
		>
			<div class="chat-avatar">
				<img v-if="question.author.avatarDataUrl" :src="question.author.avatarDataUrl" alt="" />
				<span v-else>{{ question.author.displayName.slice(0, 1) }}</span>
			</div>
			<el-space direction="vertical" :size="5" alignment="normal"> 
				<header 
				:class="question.author.id === user?.id ? ['text-12px', 'flex', 'items-end', 'justify-end', 'gap-5px'] :
				['text-12px', 'flex', 'items-end', 'justify-start', 'gap-5px']"
				>
					<strong>{{ question.author.displayName }}</strong>
					<time text-10px color="#666">{{ formatTime(question.createdAt) }}</time>
				</header>
			<div class="chat-bubble">
				
				<p>{{ question.text }}</p>
				
				<div v-if="getQuestionSignalTags(question).length" class="chat-signal-tags">
					<span
						v-for="tag in getQuestionSignalTags(question)"
						:key="tag.key"
						:class="`tone-${tag.tone}`"
					>
						{{ tag.label }}
					</span>
				</div>
				<div
					class="chat-verdict"
					:class="question.verdict ? stampTones[question.verdict] : 'waiting'"
				>
					{{ question.verdict ? stampLabels[question.verdict] : '待定' }}
				</div>		
			</div>
			<footer 
			:class="question.author.id === user?.id ? ['text-12px', 'color-#F8D74A ', 'text-right'] :
				['text-12px','color-#F8D74A' ]"
			>
				<span>主持人：{{ question.verdict ? verdictLabels[question.verdict] : '待回应' }}</span>
			</footer>
			</el-space>
		
		</article>
	</TransitionGroup>
</template>

<style scoped lang="scss">
.big-screen-chat-feed {
	display: flex;
	min-height: 100%;
	flex-direction: column;
	justify-content: flex-end;
	gap: 12px;
	padding: 4px 0 18px;
}

.chat-message {
	display: flex;
	// align-items: flex-end;
	gap: 10px;
	width: min(78%, 560px);
	cursor: pointer;
}

.chat-message.mine {
	align-self: flex-end;
	flex-direction: row-reverse;
}

.chat-message:not(.mine) {
	align-self: flex-start;
}

.chat-message.pending {
	opacity: 0.68;
}

.chat-avatar {
	display: grid;
	width: 34px;
	height: 34px;
	flex: 0 0 auto;
	place-items: center;
	overflow: hidden;
	color: #fff;
	background: #554800;
	border: 2px solid #ffd400;
	border-radius: 50%;
	font-size: 15px;
	font-weight: 950;
}

.chat-avatar img {
	width: 100%;
	height: 100%;
	object-fit: cover;
}

.chat-bubble {
	position: relative;
	min-width: 0;
	max-width: 100%;
	padding: 10px;
	color: #f1f1ec;
	background:
		linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.03)),
		#121414;
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 10px 10px 10px 2px;
	font-family: 'Microsoft YaHei', Arial, sans-serif;
}

.mine .chat-bubble {
	background:
		linear-gradient(135deg, rgba(255, 212, 0, 0.18), rgba(255, 255, 255, 0.04)),
		#18150a;
	border-color: rgba(255, 212, 0, 0.36);
	border-radius: 10px 10px 2px 10px;
}

.selected .chat-bubble {
	border-color: rgba(255, 212, 0, 0.72);
	box-shadow: 0 0 20px rgba(255, 212, 0, 0.16);
}

.chat-bubble header {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: 10px;
}

.mine .chat-bubble header {
	flex-direction: row-reverse;
}

.chat-bubble strong {
	color: #f3f0df;
	font-size: 13px;
	font-weight: 950;
}

.chat-bubble time {
	color: #7f7f78;
	font-size: 11px;
}

.chat-bubble p {
	margin: 6px 0 8px;
	color: #f1f1ec;
	font-size: 14px;
	font-weight: 800;
	line-height: 1.55;
	word-break: break-word;
}

.chat-bubble footer {
	color: #35efdf;
	font-size: 12px;
	font-weight: 900;
}

.chat-signal-tags {
	display: flex;
	flex-wrap: wrap;
	gap: 5px;
	margin-top: 7px;
	padding-right: 56px;
}

.mine .chat-signal-tags {
	padding-right: 0;
	// padding-left: 56px;
}

.chat-signal-tags span {
	padding: 2px 7px;
	color: #111;
	background: #ffd400;
	border: 1px solid rgba(255, 255, 255, 0.1);
	clip-path: polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%);
	font-size: 11px;
	font-weight: 950;
}

.chat-signal-tags .tone-cyan {
	background: #34efe1;
}

.chat-signal-tags .tone-green {
	background: #47f28a;
}

.chat-signal-tags .tone-red {
	color: #fff;
	background: #ff3e36;
}

.chat-verdict {
	position: absolute;
	right: -30px;
	top: 0;
	// right: 8px;
	// top: -9px;
	min-width: 52px;
	height: 24px;
	padding: 0 6px;
	color: #a7a7a0;
	border: 2px solid currentColor;
	font-size: 12px;
	font-weight: 950;
	line-height: 20px;
	text-align: center;
	transform: rotate(-4deg);
}

.mine .chat-verdict {
	right: -23px;
	bottom: 5px;
	top: unset;
	// left: 8px;
}

.chat-verdict.danger {
	color: #ff3e36;
}

.chat-verdict.warn {
	color: #ffd400;
}

.chat-operate {
	position: absolute;
	right: 8px;
	bottom: -12px;
	min-width: 62px;
	height: 24px;
	color: #111;
	background: #ffd400;
	border: 0;
	border-radius: 3px;
	font-size: 11px;
	font-weight: 950;
}

.mine .chat-operate {
	right: auto;
	left: 8px;
}

.chat-message-enter-active {
	transition: opacity 0.16s ease;
}

.chat-message-enter-from {
	opacity: 0;
}
</style>
