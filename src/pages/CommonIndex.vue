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
	InfoFilled,
	Moon,
	Picture,
	Plus,
	Refresh,
	Right,
	Search,
	Setting,
	Share,
	Sunny,
	User,
	VideoPause,
	VideoPlay,
} from '@element-plus/icons-vue'
import RichTextEditor from '@/components/CommonRichTextEditor.vue'
import { useTurtleSoupRoom } from '@/composables/useTurtleSoupRoom'
import type { QuestionQuality, TruthGuess } from '@/composables/useTurtleSoupRoom'

const {
	activeAmbiencePreset,
	activeBackgroundImage,
	activeBackgroundLabel,
	activeInsightQuestions,
	activeInsightTitle,
	activeMusicDataUrl,
	activePanel,
	addQuestion,
	addThoughtNode,
	AMBIENCE_PRESETS,
	ambienceDraft,
	ambiencePreviewStyle,
	ambienceVolume,
	answeredQuestions,
	answerHidden,
	applyMobileVerdict,
	audioRef,
	authForm,
	authFormRef,
	authMode,
	authRules,
	authSubmitting,
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
	clearBackgroundImage,
	clearCanvas,
	clearMusic,
	closeCustomSoupDialog,
	confirmedQuestions,
	copyShareUrl,
	createCustomSoup,
	createRoom,
	creatingSoup,
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
	draw,
	editingSoupId,
	editingThoughtLinkId,
	editingThoughtTextId,
	editThoughtLink,
	editThoughtText,
	formatTime,
	getHistoryMvpQuestions,
	getHistoryMvpUser,
	handleSettlementClosed,
	handleThoughtCanvasDoubleClick,
	hasCustomAmbience,
	highlightQuestionText,
	hostImportantHints,
	importantQuestions,
	insightDrawerOpen,
	isDark,
	isMobile,
	joinRoom,
	leaveRoomByUser,
	liveLeaderboard,
	logout,
	maximizeThoughtBoard,
	memberDialogOpen,
	memberStats,
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
	mySoupRating,
	openCreateSoupDialog,
	openEditSoupDialog,
	openInsightDrawer,
	openMemberImportant,
	openRoomSetup,
	openSoupHistoryDetail,
	openThoughtBoard,
	openToolDock,
	pendingQuestions,
	presenceEvents,
	qualityLabels,
	questionFilterOptions,
	questionInputRef,
	questionResultHint,
	questionSearchText,
	questionSignalTags,
	questionText,
	questionViewMode,
	queueRoomSave,
	rateCurrentSoup,
	removeMobileQuestion,
	removeQuestion,
	removeThoughtLink,
	removeThoughtNode,
	removeThoughtText,
	resetAmbience,
	revealAnswer,
	revealQuestion,
	room,
	roomBackdropStyle,
	roomCodeInput,
	roomMusicDataUrl,
	roomMusicName,
	roomSetupMode,
	roomSetupOpen,
	ruledOutQuestions,
	sanitizeRichText,
	saveRoom,
	selectedMember,
	selectedMvpUserId,
	selectedQuestionId,
	selectedSoupHistoryItem,
	selectedSoupId,
	selectedThoughtColor,
	selectedThoughtFontSize,
	selectedThoughtLinkId,
	selectedThoughtStyleTarget,
	selectedThoughtTextId,
	selectThoughtLink,
	selectThoughtNode,
	selectThoughtText,
	sendingQuestion,
	settlement,
	settlementDialogOpen,
	setVerdict,
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
	stopThoughtDrag,
	stopThoughtLinkDrag,
	stopThoughtTextDrag,
	submitAuth,
	submitMvpSelection,
	surfaceViewMode,
	switchRoomSoup,
	syncThoughtBoard,
	THOUGHT_BOARD_HEIGHT,
	thoughtBoardDrawerSize,
	thoughtBoardOpen,
	thoughtBoardWidth,
	thoughtDraftText,
	thoughtLinkPreview,
	thoughtLinkViews,
	thoughtNodeClass,
	thoughtNodeLabel,
	thoughtNodes,
	thoughtNodeStats,
	thoughtTexts,
	timelineRef,
	toggleImportant,
	toggleMobileImportant,
	toggleMusicPlayback,
	toggleQuestionSelection,
	toolDockOpen,
	transferHost,
	truthGuessLabels,
	updateMobileQuestionScoring,
	updateQuestionScoring,
	updateSelectedThoughtFontSize,
	updateThoughtLinkLabel,
	updateThoughtNodeText,
	updateThoughtText,
	useHostBackground,
	user,
	useRoomMusic,
	verdictLabels,
	verdictTypes,
	visibleQuestions,
} = useTurtleSoupRoom({ bodyClass: 'app-route' })
void [audioRef, authFormRef, canvasRef, canvasWrapRef, questionInputRef, timelineRef]

</script>

<template>
	<el-config-provider>
<main :class="['app-shell', { 'has-room-backdrop': room, dark: isDark }]" :style="roomBackdropStyle">
			<div class="room-backdrop" />
			<audio ref="audioRef" :src="activeMusicDataUrl" loop @play="musicPlaying = true" @pause="musicPlaying = false"
				@ended="musicPlaying = false" />
			<header class="app-header">
				<div class="brand-block">
					<p class="eyebrow">{{ room ? `房间 ${room.code} · 海龟谜题` : 'Turtle Soup Online' }}</p>
					<h1>海龟汤推理馆</h1>
				</div>
				<div class="header-actions">
					<div v-if="room" class="header-members">
						<button v-for="member in memberStats.slice(0, 6)" :key="member.userId"
							:class="['strip-member', { offline: !member.online }]" type="button" @click="openMemberImportant(member)">
							<el-avatar :size="30" :src="member.avatarDataUrl">{{
								member.displayName.slice(0, 1)
							}}</el-avatar><span>{{ member.displayName }}</span>
						</button>
					</div>
					<span v-if="room" class="online-count">{{memberStats.filter(member => member.online).length}} 人在线</span>
					<el-button :icon="Share" :disabled="!room" @click="copyShareUrl">邀请</el-button>
					<el-button :icon="isDark ? Sunny : Moon" circle @click="isDark = !isDark" />
					<el-button v-if="user" text type="danger" @click="logout()">退出登录</el-button>
				</div>
			</header>

			<section v-if="!room || !user" class="user-strip surface-card">
				<div v-if="user" class="current-user">
					<el-upload :show-file-list="false" :before-upload="beforeAvatarUpload" accept="image/*">
						<el-avatar :size="46" :src="user.avatarDataUrl">{{
							user.displayName.slice(0, 1)
						}}</el-avatar>
					</el-upload>
					<div class="user-copy">
						<strong>{{ user.displayName }}</strong><span>@{{ user.username }} · {{ user.rankTitle }} ·
							{{ user.points }} 分</span>
					</div>
				</div>
				<el-form v-else ref="authFormRef" :model="authForm" :rules="authRules" class="auth-inline" inline
					@submit.prevent>
					<el-segmented v-model="authMode" :options="[
						{ label: '登录', value: 'login' },
						{ label: '注册', value: 'register' },
					]" />
					<el-form-item v-if="authMode === 'register'" prop="displayName"><el-input v-model="authForm.displayName"
							placeholder="昵称" maxlength="24" /></el-form-item>
					<el-form-item prop="username"><el-input v-model="authForm.username" placeholder="用户名"
							maxlength="24" /></el-form-item>
					<el-form-item prop="password"><el-input v-model="authForm.password" type="password" placeholder="密码"
							maxlength="40" show-password @keyup.enter="submitAuth" /></el-form-item>
					<el-button type="primary" :icon="Check" :loading="authSubmitting"
						@click="submitAuth">{{ authMode === 'register' ? '注册' : '登录' }}</el-button>
				</el-form>
				<div class="room-metrics">
					<div>
						<b>{{ room?.questions.length ?? 0 }}</b><span>提问</span>
					</div>
					<div>
						<b>{{ pendingQuestions }}</b><span>待判定</span>
					</div>
					<div>
						<b>{{ answeredQuestions }}</b><span>已回答</span>
					</div>
					<div>
						<b>{{memberStats.filter(member => member.online).length}}</b><span>在线</span>
					</div>
				</div>
			</section>

			<section class="desk-grid">
				<aside class="story-column">
					<section class="surface-card story-card">
							<div class="section-head surface-section-head">
						
								<div style="margin-bottom: 10px;">
									<el-space style="width: 100%;justify-content: space-between;" >
									<p class="eyebrow">汤面</p>
										<div class="surface-head-actions">
									<el-segmented v-if="canHost && room" v-model="surfaceViewMode" class="surface-mode-switch" :options="[
										{ label: '预览', value: 'preview' },
										{ label: '编辑', value: 'edit' },
									]" />
									<el-tag :type="canHost ? 'success' : 'info'" effect="dark">{{
										canHost ? '主持人' : '玩家'
									}}</el-tag>
																	</div>
									</el-space>
									<el-input v-if="canHost && room && surfaceViewMode === 'edit'" v-model="room.title" class="title-input"
										@change="saveRoom" />
									<h2 v-else>
										{{ room?.title ?? '请选择汤面并创建或加入房间' }}
									</h2>
								</div>
							</div>
							<RichTextEditor v-if="canHost && room && surfaceViewMode === 'edit'" v-model="room.surface" :min-rows="8"
								placeholder="写下可公开给玩家的汤面" @blur="saveRoom" />
							<div v-else class="surface-text rich-display" v-html="sanitizeRichText(
								room?.surface ??
								'还没有进入房间。登录后可创建房间，或用房间号加入。',
							)
								" />
					</section>

	<section v-if="hostImportantHints.length" class="surface-card host-hint-card">
						<div class="host-hint-row">
							<strong>主持人提示</strong>
							<ol class="host-hint-list">
								<li v-for="hint in hostImportantHints" :key="hint.id">
									{{ hint.text }}
								</li>
							</ol>
						</div>
					</section>

					<section class="surface-card clue-card">
						<div class="section-head compact">
							<div class="title-with-icon">
								<Flag /><strong>关键线索</strong>
							</div>
							<span class="subtle">{{ importantQuestions.length }}/{{ sortedQuestions.length }} 已提示</span>
						</div>
						<el-empty v-if="!importantQuestions.length" description="主持人还没有标记重要内容" />
						<div v-else class="clue-list clue-card-grid">
							<article v-for="question in importantQuestions" :key="question.id" class="clue-item">
								<div class="clue-card-top">
									<el-avatar :size="24" :src="question.author.avatarDataUrl"
										class="clue-avatar">{{ question.author.displayName.slice(0, 1) }}</el-avatar>
									<div class="clue-card-author">
										<strong>{{ question.author.displayName }}</strong><time>{{ formatTime(question.createdAt) }}</time>
									</div>
								</div>
								<p class="clue-card-text">{{ question.text }}</p>
								<div class="public-score-tags compact">
									<el-tag v-for="tag in questionSignalTags(question)" :key="tag.key" :type="tag.type"
										:effect="tag.effect" round>{{ tag.label }}</el-tag>
								</div>
								<el-tag v-if="question.verdict" class="clue-verdict-tag" :class="question.verdict" effect="plain"
									round>{{ verdictLabels[question.verdict] }}</el-tag>
							</article>
						</div>
					</section>
				
				</aside>

				<section class="surface-card qa-column">
					<div class="section-head">
						<div class="title-with-icon">
							<EditPen /><strong>实时问答</strong>
						</div>
						<div class="qa-head-actions">
							<span class="subtle">{{ questionResultHint }}</span>
							<el-button :icon="Flag" size="small" plain :disabled="!room" @click="openThoughtBoard">思路板</el-button>
						</div>
					</div>
					<div class="qa-filter-bar">
						<el-tabs v-model="questionViewMode" class="qa-filter-tabs" @tab-change="selectedQuestionId = ''">
							<el-tab-pane v-for="option in questionFilterOptions" :key="option.value" :name="option.value"
								:disabled="option.disabled">
								<template #label>
									<span class="qa-tab-label"><span>{{ option.label }}</span><b>{{ option.count }}</b></span>
								</template>
							</el-tab-pane>
						</el-tabs>
						<el-input v-model="questionSearchText" class="qa-search" clearable :prefix-icon="Search"
							placeholder="搜索问题、玩家、判定或线索标签" @clear="selectedQuestionId = ''" @input="selectedQuestionId = ''" />
					</div>
					<div class="qa-insight-board">
						<section class="confirmed">
							<button class="insight-card-head" type="button" @click="openInsightDrawer('confirmed')">
								<div>
									<strong>已确认</strong><small>主持人回答“是”</small>
								</div>
								<span>{{ confirmedQuestions.length }}</span>
							</button>
						</section>
						<section class="ruled-out">
							<button class="insight-card-head" type="button" @click="openInsightDrawer('ruledOut')">
								<div>
									<strong>已排除</strong><small>主持人回答“不是”</small>
								</div>
								<span>{{ ruledOutQuestions.length }}</span>
							</button>
						</section>
					</div>
					<div class="ask-row desktop-ask-row">
						<el-input ref="questionInputRef" v-model="questionText" size="large" placeholder="输入问题，例如：这个人认识厨师吗？"
							:disabled="!user || !room" @keyup.enter="addQuestion" /><el-button type="primary" size="large"
							:icon="Right" :loading="sendingQuestion" :disabled="!user || !room" @click="addQuestion">发送</el-button>
					</div>
					<div ref="timelineRef" class="timeline">
						<el-empty v-if="!visibleQuestions.length" :description="sortedQuestions.length
							? '没有匹配的问答，换个筛选或关键词试试。'
							: '还没有问题，开汤吧。'
							" />
							<article v-for="question in chatQuestions" :key="question.id" :data-question-id="question.id" :class="[
								'question-item',
								{
									mine: question.author.id === user?.id,
									selected: selectedQuestionId === question.id,
									pending: question.clientStatus === 'sending',
									failed: question.clientStatus === 'failed',
								},
							]" @click="toggleQuestionSelection(question.id)">
								<el-avatar :size="36" :src="question.author.avatarDataUrl" class="question-avatar">{{
									question.author.displayName.slice(0, 1)
								}}</el-avatar>
								<div class="question-bubble-wrap">
									<div class="question-meta">
										<span>{{ question.author.displayName }}</span>
										<el-tag v-if="question.author.id === room?.host.id" class="host-author-tag" effect="dark" round>
											主持人</el-tag>
										<time>{{ formatTime(question.createdAt) }}</time>
										<el-tag v-if="question.clientStatus === 'sending'" type="info" effect="plain" round>发送中</el-tag>
										<el-tag v-else-if="question.clientStatus === 'failed'" type="danger" effect="plain" round>发送失败</el-tag>
									</div>
									<div class="question-bubble">
										<p v-html="highlightQuestionText(question.text)" />
										<div v-if="
											question.quality !== 'none' ||
											question.truthGuess !== 'none' ||
											question.firstCoreClue ||
											question.firstMainLogic ||
											question.firstFullSolve
										" class="public-score-tags">
											<el-tag v-if="question.quality !== 'none'" type="success" effect="plain"
												round>{{ qualityLabels[question.quality] }}</el-tag><el-tag v-if="question.truthGuess !== 'none'"
												type="warning" effect="plain" round>{{ truthGuessLabels[question.truthGuess] }}</el-tag><el-tag
												v-if="question.firstCoreClue" type="success" effect="dark" round>首次核心线索</el-tag><el-tag
												v-if="question.firstMainLogic" type="warning" effect="dark" round>首次主要逻辑</el-tag><el-tag
												v-if="question.firstFullSolve" type="danger" effect="dark" round>首位完整破解</el-tag>
										</div>
									</div>
									<div class="verdict-zone">
										<span :class="['host-response', question.verdict || 'waiting']">
											汤主回应：{{ question.verdict ? verdictLabels[question.verdict] : '待回应' }}
										</span>
										<span v-if="question.important" class="important-chip">关键</span>
											<!-- <button v-if="canHost && !question.clientStatus" class="host-operate-button" type="button"
												@click.stop="openHostAction(question)">{{
													!isMobile && selectedQuestionId === question.id ? '收起操作' : '主持操作'
												}}</button> -->
										</div>
										<div v-if="!isMobile && canHost && !question.clientStatus && selectedQuestionId === question.id" class="host-action-panel" @click.stop>
										<div class="host-action-heading">
											<strong>主持人操作</strong>
											<small>判定回答、标记线索，并记录本轮积分依据</small>
										</div>
										<div class="action-group">
											<span class="action-title">判定</span><button class="judge yes" type="button"
												@click="setVerdict(question.id, 'yes')">
												是</button><button class="judge no" type="button" @click="setVerdict(question.id, 'no')">
												不是</button><button class="judge both" type="button" @click="setVerdict(question.id, 'both')">
												是也不是</button><button class="judge mute" type="button"
												@click="setVerdict(question.id, 'irrelevant')">
												不重要
											</button>
										</div>
										<div class="action-group">
											<span class="action-title">标记</span><button :class="['judge', 'flag', { active: question.important }]"
												type="button" @click="toggleImportant(question)">
												{{ question.important ? '已标重要' : '标为重要' }}</button><button class="judge delete" type="button"
												@click="removeQuestion(question.id)">
												删除
											</button>
										</div>
										<div class="score-grid">
											<label>问题价值<el-select :model-value="question.quality" size="small" @change="
												(value: QuestionQuality) =>
													updateQuestionScoring(question, { quality: value })
											"><el-option v-for="(label, value) in qualityLabels" :key="value" :label="label"
														:value="value" /></el-select></label><label>猜中程度<el-select :model-value="question.truthGuess"
													size="small" @change="
														(value: TruthGuess) =>
															updateQuestionScoring(question, { truthGuess: value })
													"><el-option v-for="(label, value) in truthGuessLabels" :key="value" :label="label"
														:value="value" /></el-select></label>
										</div>
										<div class="achievement-row">
											<el-checkbox :model-value="question.firstCoreClue" @change="
												(value: boolean) =>
													updateQuestionScoring(question, {
														firstCoreClue: value,
													})
											">首次核心线索</el-checkbox><el-checkbox :model-value="question.firstMainLogic" @change="
												(value: boolean) =>
													updateQuestionScoring(question, {
														firstMainLogic: value,
													})
											">首次主要逻辑</el-checkbox><el-checkbox :model-value="question.firstFullSolve" @change="
												(value: boolean) =>
													updateQuestionScoring(question, {
														firstFullSolve: value,
													})
											">首位完整破解</el-checkbox>
										</div>
									</div>
								</div>
						</article>
					</div>
				</section>

				<aside class="control-column">
					<section class="surface-card rank-card">
						<div class="section-head compact">
							<div class="title-with-icon">
								<Flag /><strong>实时积分排行</strong>
							</div>
						</div>
						<el-empty v-if="!liveLeaderboard.length" description="暂无排行" :image-size="56" />
						<div v-else class="mini-rank-list">
							<div v-for="entry in liveLeaderboard.slice(0, 6)" :key="entry.user.id" class="mini-rank-row">
								<strong>#{{ entry.rank }}</strong><el-avatar :size="30" :src="entry.user.avatarDataUrl">{{
									entry.user.displayName.slice(0, 1)
								}}</el-avatar><span>{{ entry.user.displayName }}</span><b>{{ entry.total }}</b>
							</div>
						</div>
					</section>
					<section class="surface-card config-card">
							<div class="section-head compact">
								<div class="title-with-icon">
									<House /><strong >房间配置</strong>
								</div>
								<div class="config-head-actions">
									<el-button v-if="!room" size="small" type="primary" :icon="Plus" :disabled="!user"
										@click="openRoomSetup('create')">开房</el-button>
									<el-button v-else-if="canHost" size="small" type="primary" plain :icon="Refresh"
										@click="openRoomSetup('switch')">切换汤面</el-button>
									<el-button v-else size="small" type="danger" plain @click="leaveRoomByUser">退出房间</el-button>
									<!-- <el-tag v-if="room" round type="success" effect="plain">进行中</el-tag> -->
								</div>
							</div>
							<div v-if="room" class="room-config-summary">
								<div><span>房间号</span><strong>{{ room.code }}</strong></div>
								<div><span>主持人</span><strong>{{ room.host.displayName }}</strong></div>
								<div><span>人数</span><strong>{{memberStats.filter(member => member.online).length}} / {{ memberStats.length || 0 }} 人</strong></div>
								<div><span>提问</span><strong>{{ pendingQuestions }} 待判定</strong></div>
							</div>
							<div class="config-stack">
								<label>加入房间</label>
								<div class="room-row">
									<el-input v-model="roomCodeInput" placeholder="输入房间号" @keyup.enter="joinRoom()" /><el-button
										:icon="Right" @click="joinRoom()" />
								</div>
							<el-button text :icon="CopyDocument" :disabled="!room" @click="copyShareUrl">复制邀请链接</el-button>
						</div>
					</section>
					<section class="surface-card members-card">
						<div class="section-head compact">
							<div class="title-with-icon">
								<User /><strong>房间用户({{ memberStats.length || 0 }})</strong>
							</div>
						</div>
						<el-empty v-if="!memberStats.length" description="暂无用户" :image-size="58" />
							<div v-else class="member-list">
								<div v-for="member in memberStats" :key="member.userId"
									:class="['member-row', { offline: !member.online }]" role="button" tabindex="0"
									@click="openMemberImportant(member)" @keyup.enter="openMemberImportant(member)">
									<el-avatar :size="34" :src="member.avatarDataUrl">{{
										member.displayName.slice(0, 1)
									}}</el-avatar>
									<div class="member-main">
										<strong class="member-name">{{ member.displayName }}</strong>
										<span class="member-badges"><em v-if="room?.host.id === member.userId">主持人</em><i
													:class="member.online ? 'online' : 'offline'">{{
													member.online ? '在线' : '离线'
												}}</i></span>
									</div>
									<span class="member-counts"><b>{{ member.questionCount }}</b>问 <b
											class="important-number">{{ member.importantCount }}</b>重要</span>
									<el-button v-if="canTransferHostTo(member)" class="member-transfer-button" size="small" type="primary" plain
										@click.stop="transferHost(member)">设为主持人</el-button>
								</div>
							</div>
						<div v-if="presenceEvents.length" class="presence-feed">
							<div v-for="event in presenceEvents" :key="event.at + '-' + event.user.userId"
								:class="['presence-line', event.type]">
								<span />
								<p>{{ event.message }}</p>
							</div>
						</div>
					</section>
					<section v-if="soupHistory.length" class="surface-card soup-history-card">
						<div class="section-head compact">
							<div class="title-with-icon">
								<Flag /><strong>本房间汤面记录</strong>
							</div>
							<el-tag round>{{ soupHistory.length }}</el-tag>
						</div>
						<div class="soup-history-list">
							<article v-for="item in soupHistory" :key="item.id" class="soup-history-item" role="button" tabindex="0"
								@click="openSoupHistoryDetail(item)" @keyup.enter="openSoupHistoryDetail(item)">
								<div class="soup-history-head">
									<strong>{{ item.title }}</strong>
									<div class="soup-history-host">
										<span style="display: flex; align-items: center">主持人：
											<el-avatar :size="22" style="margin-right: 3px" :src="item.host?.avatarDataUrl || room?.host.avatarDataUrl
												">{{
													(
														item.host?.displayName ??
														room?.host.displayName ??
														'?'
													).slice(0, 1)
												}}</el-avatar>{{
													item.host?.displayName ??
													room?.host.displayName ??
													'未知'
												}}</span>

										<time>{{ formatTime(item.startedAt) }}</time>
									</div>
								</div>
								<p class="rich-display" v-html="sanitizeRichText(item.surface)" />
								<div v-if="getHistoryMvpUser(item)" class="soup-history-mvp">
									<span>MVP</span>
									<el-avatar :size="22" :src="getHistoryMvpUser(item)?.avatarDataUrl">{{
										getHistoryMvpUser(item)?.displayName.slice(0, 1)
									}}</el-avatar>
									<strong>{{ getHistoryMvpUser(item)?.displayName }}</strong>
								</div>
								<div class="soup-history-rating">
									<el-rate :model-value="item.ratingAverage || 0" disabled allow-half />
									<small>{{
										item.ratingCount
											? `${item.ratingAverage} 分 / ${item.ratingCount} 人`
											: item.revealedAt
												? '暂无评分'
												: '进行中'
									}}</small>
								</div>
							</article>
						</div>
					</section>
				</aside>
			</section>

			<div class="floating-tools">
				<el-tooltip v-if="canHost" content="主持人控制台" placement="left">
					<button :class="[
						'float-tool',
						{ active: toolDockOpen && activePanel === 'host' },
					]" type="button" @click="openToolDock('host')">
						<Setting />
					</button>
				</el-tooltip>
				<el-tooltip v-if="canHost" content="汤底" placement="left">
					<button :class="[
						'float-tool',
						{ active: toolDockOpen && activePanel === 'answer' },
					]" type="button" @click="openToolDock('answer')">
						<Hide />
					</button>
				</el-tooltip>
				<el-tooltip v-if="room && !canHost" content="玩家设置" placement="left">
					<button :class="[
						'float-tool',
						{ active: toolDockOpen && activePanel === 'player' },
					]" type="button" @click="openToolDock('player')">
						<Setting />
					</button>
				</el-tooltip>
				<el-tooltip content="画板" placement="left">
					<button :class="[
						'float-tool',
						{ active: toolDockOpen && activePanel === 'canvas' },
					]" type="button" @click="openToolDock('canvas')">
						<Brush />
					</button>
				</el-tooltip>
			</div>

			<section v-if="toolDockOpen" class="tool-popover surface-card">
				<div class="tool-popover-head">
					<div class="tool-tabs">
						<button v-if="canHost" :class="{ active: activePanel === 'host' }" type="button"
							@click="openToolDock('host')">
							<Setting /> 控制台
						</button>
						<button v-if="canHost" :class="{ active: activePanel === 'answer' }" type="button"
							@click="openToolDock('answer')">
							<Hide /> 汤底
						</button>
						<button v-if="room && !canHost" :class="{ active: activePanel === 'player' }" type="button"
							@click="openToolDock('player')">
							<Setting /> 设置
						</button>
						<button :class="{ active: activePanel === 'canvas' }" type="button" @click="openToolDock('canvas')">
							<Brush /> 画板
						</button>
					</div>
					<el-button text @click="toolDockOpen = false">收起</el-button>
				</div>

				<div v-if="canHost" v-show="activePanel === 'host'" class="tool-panel host-console-panel">
					<div :class="['ambience-preview', { custom: activeBackgroundImage }]" :style="ambiencePreviewStyle">
						<span>{{ activeBackgroundLabel }} ·
							{{ activeAmbiencePreset.tone }}</span>
						<strong>{{
							roomMusicDataUrl ? roomMusicName : '未设置房间音乐'
						}}</strong>
					</div>
					<div class="ambience-presets">
						<button v-for="preset in AMBIENCE_PRESETS" :key="preset.id" :class="[
							'preset-chip',
							{
								active:
									!activeBackgroundImage &&
									ambienceDraft.backgroundPreset === preset.id,
							},
						]" type="button" @click="chooseAmbiencePreset(preset.id)">
							<span :style="{ background: preset.background }" />
							<strong>{{ preset.label }}</strong>
							<small>{{ preset.tone }}</small>
						</button>
					</div>
					<div class="host-console-grid">
						<el-upload :show-file-list="false" :before-upload="beforeBackgroundUpload" accept="image/*">
							<el-button plain :icon="Picture">更换背景</el-button>
						</el-upload>
						<el-upload :show-file-list="false" :before-upload="beforeMusicUpload" accept="audio/*">
							<el-button plain :icon="Headset">上传房间音乐</el-button>
						</el-upload>
						<el-button :icon="musicPlaying ? VideoPause : VideoPlay" :disabled="!roomMusicDataUrl"
							@click="toggleMusicPlayback" plain>{{ musicPlaying ? '暂停音乐' : '播放音乐' }}</el-button>
						<div>
							<el-button :icon="Refresh" plain @click="resetAmbience">重置氛围</el-button>
						</div>
					</div>
					<div class="host-console-local">
						<div class="background-choice">
							<span>使用房间背景</span>
							<el-switch v-model="useHostBackground" inline-prompt active-text="使用" inactive-text="默认" />
						</div>
						<div class="background-choice">
							<span>播放房间音乐</span>
							<el-switch v-model="useRoomMusic" :disabled="!roomMusicDataUrl" inline-prompt active-text="开启"
								inactive-text="关闭" />
						</div>
					</div>
					<div class="volume-control">
						<span>音乐音量</span>
						<el-slider v-model="ambienceVolume" :min="0" :max="100" :disabled="!roomMusicDataUrl" />
					</div>
					<div v-if="hasCustomAmbience" class="ambience-mini-actions">
						<el-button text :disabled="!activeBackgroundImage" @click="clearBackgroundImage">移除背景</el-button>
						<el-button text type="danger" :disabled="!roomMusicDataUrl" @click="clearMusic">移除房间音乐</el-button>
					</div>
				</div>

				<div v-if="room && !canHost" v-show="activePanel === 'player'" class="tool-panel host-console-panel">
					<div :class="['ambience-preview', { custom: activeBackgroundImage }]" :style="ambiencePreviewStyle">
						<span>{{ activeBackgroundLabel }} ·
							{{ activeAmbiencePreset.tone }}</span>
						<strong>{{
							roomMusicDataUrl ? roomMusicName : '主持人尚未上传房间音乐'
						}}</strong>
					</div>
					<div class="host-console-local">
						<div class="background-choice">
							<span>使用房间背景</span>
							<el-switch v-model="useHostBackground" inline-prompt active-text="使用" inactive-text="默认" />
						</div>
						<div class="background-choice">
							<span>播放房间音乐</span>
							<el-switch v-model="useRoomMusic" :disabled="!roomMusicDataUrl" inline-prompt active-text="开启"
								inactive-text="关闭" />
						</div>
					</div>
					<div class="host-console-grid">
						<el-button :icon="musicPlaying ? VideoPause : VideoPlay" :disabled="!roomMusicDataUrl"
							@click="toggleMusicPlayback" plain>{{ musicPlaying ? '暂停音乐' : '播放音乐' }}</el-button>
					</div>
					<div class="volume-control">
						<span>音乐音量</span>
						<el-slider v-model="ambienceVolume" :min="0" :max="100" :disabled="!roomMusicDataUrl" />
					</div>
				</div>

				<div v-if="canHost" v-show="activePanel === 'answer'" class="tool-panel">
					<div class="answer-tools">
						<el-switch v-model="answerHidden" active-text="隐藏" inactive-text="显示" inline-prompt />
					</div>
					<el-button v-if="canHost && room" type="warning" class="wide-button reveal-button" :disabled="room.revealed"
						@click="revealAnswer">
						{{ room.revealed ? '已揭秘' : '揭秘汤底并结算积分' }}
					</el-button>
					<RichTextEditor v-if="canHost && room" v-model="room.answer" :min-rows="9" placeholder="只有主持人需要知道的汤底"
						@input="queueRoomSave" />
					<div v-else-if="answerHidden" class="hidden-answer">
						<CircleClose />
						<span>汤底已隐藏</span>
					</div>
					<p v-else class="answer-text rich-display" v-html="sanitizeRichText(room?.answer ?? '暂无汤底')" />
				</div>

				<div v-show="activePanel === 'canvas'" class="tool-panel">
					<div class="brush-toolbar">
						<el-color-picker v-model="brushColor" :disabled="!canHost" />
						<el-slider v-model="brushSize" :min="2" :max="22" :disabled="!canHost" />
						<el-tooltip content="清空画板">
							<el-button :icon="Delete" circle :disabled="!canHost" @click="clearCanvas()" />
						</el-tooltip>
					</div>
					<div ref="canvasWrapRef" class="canvas-wrap">
						<canvas ref="canvasRef" :class="{ readonly: !canHost }" @pointerdown="startDrawing" @pointermove="draw"
							@pointerup="stopDrawing" @pointercancel="stopDrawing" @pointerleave="stopDrawing" />
					</div>
				</div>
				</section>

				<el-dialog v-model="roomSetupOpen" :title="roomSetupMode === 'switch' ? '切换汤面' : '创建房间'"
					width="min(520px, 92vw)">
					<div class="room-setup-panel">
						<label>选择汤面</label><el-select v-model="selectedSoupId" filterable placeholder="选择自己的汤面"
							:disabled="!user || !soups.length"><el-option v-for="soup in soups" :key="soup.id" :label="soup.title"
								:value="soup.id"><span>{{ soup.title }}</span><small>我的汤面 ·
									{{ difficultyLabels[soup.difficulty] }}</small></el-option></el-select>
						<el-empty v-if="user && !soups.length" description="还没有自己的汤面" :image-size="64" />
						<p v-else-if="!user" class="switch-warning">请先登录后再创建房间</p>
						<p v-else-if="roomSetupMode === 'switch'" class="switch-warning">
							切换当前房间会清空本局问答、重要线索、画板和结算记录；重新开房会生成新的房间号。
						</p>
						<div class="config-actions">
							<el-button :icon="Plus" :disabled="!user" @click="openCreateSoupDialog">自建汤面</el-button>
							<el-button type="info" @click="soupManagerOpen = true">管理汤面</el-button>
						</div>
					</div>
					<template #footer>
						<el-button @click="roomSetupOpen = false">取消</el-button>
						<template v-if="roomSetupMode === 'switch'">
							<el-button :disabled="!user || !selectedSoupId || !canHost" @click="switchRoomSoup">
								切换当前房间
							</el-button>
							<el-button type="primary" :icon="Plus" :disabled="!user || !selectedSoupId"
								@click="createRoom({ replaceCurrent: true })">换汤重新开房</el-button>
						</template>
						<el-button v-else type="primary" :icon="Plus" :disabled="!user || !selectedSoupId"
							@click="createRoom({ replaceCurrent: true })">创建房间</el-button>
					</template>
				</el-dialog>
				<el-dialog v-model="customSoupOpen" :title="editingSoupId ? '编辑汤面' : '自建汤面'" width="min(720px, 92vw)"><el-form
						ref="customSoupFormRef" :model="customSoup" :rules="customSoupRules" label-position="top"><el-form-item
							label="标题" prop="title"><el-input v-model="customSoup.title" /></el-form-item><el-form-item label="汤面"
						prop="surface">
						<RichTextEditor v-model="customSoup.surface" :min-rows="5" placeholder="写下可公开给玩家的汤面" @blur="
							customSoupFormRef?.validateField('surface')
							" />
					</el-form-item><el-form-item label="汤底" prop="answer">
						<RichTextEditor v-model="customSoup.answer" :min-rows="6" placeholder="写下最终真相、关键线索和解释"
							@blur="customSoupFormRef?.validateField('answer')" />
					</el-form-item>
					<div class="dialog-grid">
						<el-form-item label="分类" prop="category"><el-input
								v-model="customSoup.category" /></el-form-item><el-form-item label="难度" prop="difficulty"><el-select
								v-model="customSoup.difficulty"><el-option label="入门" value="easy" /><el-option label="标准"
									value="medium" /><el-option label="困难" value="hard" /></el-select></el-form-item>
					</div>
					</el-form><template #footer><el-button @click="closeCustomSoupDialog">取消</el-button><el-button type="primary"
							:loading="creatingSoup"
							@click="createCustomSoup">{{ editingSoupId ? '保存修改' : '保存汤面' }}</el-button></template></el-dialog>
				<el-dialog v-if="isMobile" v-model="mobileHostActionOpen" title="主持人操作" width="min(420px, 92vw)"
					class="mobile-host-action-dialog">
					<div v-if="mobileHostActionQuestion" class="mobile-host-action">
						<section class="mobile-host-question">
							<div class="question-meta">
								<span>{{ mobileHostActionQuestion.author.displayName }}</span>
								<time>{{ formatTime(mobileHostActionQuestion.createdAt) }}</time>
							</div>
							<p>{{ mobileHostActionQuestion.text }}</p>
							<span :class="['host-response', mobileHostActionQuestion.verdict || 'waiting']">
								汤主回应：{{ mobileHostActionQuestion.verdict ? verdictLabels[mobileHostActionQuestion.verdict] : '待回应' }}
							</span>
						</section>
						<section class="mobile-host-section">
							<strong>判定</strong>
							<div class="mobile-host-judge-grid">
								<button class="judge yes" type="button" @click="applyMobileVerdict('yes')">是</button>
								<button class="judge no" type="button" @click="applyMobileVerdict('no')">否</button>
								<button class="judge both" type="button" @click="applyMobileVerdict('both')">是与不是</button>
								<button class="judge mute" type="button" @click="applyMobileVerdict('irrelevant')">不重要</button>
							</div>
						</section>
						<section class="mobile-host-section">
							<strong>标记</strong>
							<div class="mobile-host-judge-grid">
								<button :class="['judge', 'flag', { active: mobileHostActionQuestion.important }]" type="button"
									@click="toggleMobileImportant">
									{{ mobileHostActionQuestion.important ? '已标重要' : '标为重要' }}
								</button>
								<button class="judge delete" type="button" @click="removeMobileQuestion">删除问题</button>
							</div>
						</section>
						<section class="mobile-host-section">
							<strong>积分依据</strong>
							<div class="mobile-host-score-grid">
								<label>问题价值<el-select :model-value="mobileHostActionQuestion.quality" size="large" @change="
									(value: QuestionQuality) =>
										updateMobileQuestionScoring({ quality: value })
								"><el-option v-for="(label, value) in qualityLabels" :key="value" :label="label"
											:value="value" /></el-select></label>
								<label>猜中程度<el-select :model-value="mobileHostActionQuestion.truthGuess" size="large" @change="
									(value: TruthGuess) =>
										updateMobileQuestionScoring({ truthGuess: value })
								"><el-option v-for="(label, value) in truthGuessLabels" :key="value" :label="label"
											:value="value" /></el-select></label>
							</div>
							<div class="mobile-host-checks">
								<el-checkbox :model-value="mobileHostActionQuestion.firstCoreClue" @change="
									(value: boolean) =>
										updateMobileQuestionScoring({
											firstCoreClue: value,
										})
								">首次核心线索</el-checkbox>
								<el-checkbox :model-value="mobileHostActionQuestion.firstMainLogic" @change="
									(value: boolean) =>
										updateMobileQuestionScoring({
											firstMainLogic: value,
										})
								">首次主要逻辑</el-checkbox>
								<el-checkbox :model-value="mobileHostActionQuestion.firstFullSolve" @change="
									(value: boolean) =>
										updateMobileQuestionScoring({
											firstFullSolve: value,
										})
								">首位完整破解</el-checkbox>
							</div>
						</section>
					</div>
					<template #footer>
						<el-button @click="mobileHostActionOpen = false">关闭</el-button>
					</template>
				</el-dialog>
					<Teleport to="body">
						<div v-if="isMobile" class="qa-mobile-dock">
							<div v-if="mobileRecentMyQuestions.length"
								:class="['mobile-my-questions', { collapsed: !mobileAskExpanded }]">
								<button class="mobile-ask-toggle" type="button" @click="mobileAskExpanded = !mobileAskExpanded">
									<span>我的提问</span>
									<b>{{ mobileAskExpanded ? '收起' : '展开' }}</b>
								</button>
								<div v-show="mobileAskExpanded" class="mobile-my-question-list">
									<button v-for="question in mobileRecentMyQuestions" :key="question.id" type="button"
										class="mobile-my-question" @click="revealQuestion(question.id)">
										<span class="mobile-my-question-text">{{ question.text }}</span>
										<span class="mobile-my-question-state">{{
											question.verdict ? verdictLabels[question.verdict] : '待判定'
										}}</span>
									</button>
								</div>
							</div>
							<div class="ask-row mobile-sticky-ask">
								<el-input ref="questionInputRef" v-model="questionText" size="large" placeholder="输入问题，例如：这个人认识厨师吗？"
									:disabled="!user || !room" @keyup.enter="addQuestion" /><el-button type="primary" size="large"
									:icon="Right" :loading="sendingQuestion" :disabled="!user || !room" @click="addQuestion">发送</el-button>
							</div>
						</div>
					</Teleport>
			<el-drawer v-model="soupManagerOpen" :direction="soupDrawerDirection" :size="isMobile ? '78%' : '420px'"
				class="soup-manager-drawer" title="我的题库">
				<div class="soup-manager">
					<el-empty v-if="!soups.length" description="还没有自己的汤面" :image-size="72" />
					<button v-for="soup in soups" v-else :key="soup.id" :class="[
						'soup-manage-item',
						{ active: selectedSoupId === soup.id },
					]" type="button" @click="selectedSoupId = soup.id">
						<span class="soup-manage-copy"><strong>{{ soup.title }}</strong><small>{{ soup.category || '自建' }} ·
								{{ difficultyLabels[soup.difficulty] }}</small><em class="rich-display"
								v-html="sanitizeRichText(soup.surface)" /></span>
						<span class="soup-manage-actions">
							<el-button round plain :icon="EditPen" @click.stop="openEditSoupDialog(soup)">编辑</el-button><el-button
								round type="danger" plain :icon="Delete" :loading="deletingSoupId === soup.id"
								@click.stop="deleteSoup(soup)">删除</el-button>
						</span>
					</button>
				</div>
			</el-drawer>
			<el-drawer v-model="insightDrawerOpen" :direction="soupDrawerDirection" :size="isMobile ? '72%' : '460px'"
				class="insight-drawer" :title="activeInsightTitle">
				<div class="insight-drawer-list">
					<el-empty v-if="!activeInsightQuestions.length" :description="activeInsightTitle + '暂无内容'" :image-size="72" />
					<button v-for="question in activeInsightQuestions" v-else :key="question.id" class="insight-drawer-item"
						type="button" @click="revealQuestion(question.id)">
						<span class="insight-drawer-meta">
							<el-avatar :size="24" :src="question.author.avatarDataUrl">{{
								question.author.displayName.slice(0, 1)
							}}</el-avatar>
							<strong>{{ question.author.displayName }}</strong>
							<time>{{ formatTime(question.createdAt) }}</time>
						</span>
						<span class="insight-drawer-text">{{ question.text }}</span>
						<el-tag v-if="question.verdict" :type="verdictTypes[question.verdict]" effect="dark"
							round>{{ verdictLabels[question.verdict] }}</el-tag>
					</button>
				</div>
			</el-drawer>
			<el-drawer v-model="thoughtBoardOpen" direction="btt" :size="thoughtBoardDrawerSize" class="thought-board-drawer"
				title="个人思路板">
				<div class="thought-board-shell">
					<div v-if="!isMobile" class="thought-resize-handle" @pointerdown="startThoughtBoardResize"
						@dblclick="maximizeThoughtBoard">
						<span />
						<button type="button" @click.stop="maximizeThoughtBoard">全屏</button>
					</div>
					<div class="thought-toolbar">
						<div class="thought-counts">
							<span>重要 {{ thoughtNodeStats.important }}</span>
							<span>是 {{ thoughtNodeStats.yes }}</span>
							<span>不是 {{ thoughtNodeStats.no }}</span>
							<span>推理 {{ thoughtNodeStats.custom }}</span>
							<span>文字 {{ thoughtTexts.length }}</span>
						</div>
						<div class="thought-actions">
							<el-input v-model="thoughtDraftText" size="small" placeholder="添加自己的推理节点" @keyup.enter="addThoughtNode" />
							<el-button size="small" :icon="Plus" @click="addThoughtNode">添加</el-button>
							<el-button size="small" :icon="Refresh" @click="syncThoughtBoard">同步线索</el-button>
						</div>
					</div>
					<div v-if="selectedThoughtStyleTarget" class="thought-style-tools">
						<span>{{
							selectedThoughtStyleTarget.type === 'text' ? '文字样式' : '连线文字'
						}}</span>
						<label>
							颜色
							<input v-model="selectedThoughtColor" class="thought-style-color" type="color" />
						</label>
						<label>
							字号
							<input class="thought-style-size" type="number" min="12" max="42" :value="selectedThoughtFontSize"
								@input="updateSelectedThoughtFontSize" />
						</label>
					</div>
					<p :class="['thought-link-tip', { idle: !draggingThoughtLink }]">
						{{
							draggingThoughtLink
								? '拖到其他节点四向小点附近松开，连线会自动吸附'
								: '拖动矩形整理思路；双击空白处添加文字；双击线条编辑关系名'
						}}
					</p>
					<div class="thought-canvas-wrap">
						<div class="thought-canvas" :style="{
							minWidth: thoughtBoardWidth + 'px',
							height: THOUGHT_BOARD_HEIGHT + 'px',
						}" @dblclick="handleThoughtCanvasDoubleClick">
							<svg class="thought-links" :width="thoughtBoardWidth" :height="THOUGHT_BOARD_HEIGHT"
								:viewBox="`0 0 ${thoughtBoardWidth} ${THOUGHT_BOARD_HEIGHT}`" aria-hidden="true">
								<g v-for="{ link, geometry } in thoughtLinkViews" :key="link.id">
									<path :class="{ selected: selectedThoughtLinkId === link.id }" :d="geometry.path"
										@click.stop="selectThoughtLink(link.id)" @dblclick.stop="editThoughtLink(link.id)" />
								</g>
								<path v-if="thoughtLinkPreview" class="preview" :d="thoughtLinkPreview.path" />
							</svg>
							<div v-for="{ link, geometry } in thoughtLinkViews" :key="link.id" :class="[
								'thought-link-label',
								{
									selected: selectedThoughtLinkId === link.id,
									editing: editingThoughtLinkId === link.id,
								},
							]" :style="{
								transform: `translate(${geometry.midX - 68}px, ${geometry.midY - 17}px)`,
								color: link.color ?? DEFAULT_THOUGHT_TEXT_COLOR,
								fontSize: `${link.fontSize ?? DEFAULT_THOUGHT_TEXT_SIZE}px`,
							}" @click.stop="selectThoughtLink(link.id)" @dblclick.stop="editThoughtLink(link.id)">
								<input v-if="editingThoughtLinkId === link.id" :data-thought-link-input="link.id" :value="link.label"
									placeholder="关系" @input="
										updateThoughtLinkLabel(
											link.id,
											($event.target as HTMLInputElement).value,
										)
										" @blur="editingThoughtLinkId = ''" @keyup.enter="editingThoughtLinkId = ''" />
								<span v-else>{{ link.label || '双击命名' }}</span>
								<button type="button" aria-label="删除连线" @click.stop="removeThoughtLink(link.id)">
									×
								</button>
							</div>
							<div v-for="item in thoughtTexts" :key="item.id" :class="[
								'thought-text',
								{
									selected: selectedThoughtTextId === item.id,
									editing: editingThoughtTextId === item.id,
								},
							]" :style="{
								transform: `translate(${item.x}px, ${item.y}px)`,
								color: item.color,
								fontSize: `${item.fontSize}px`,
							}" @pointerdown="startThoughtTextDrag($event, item)" @pointermove="moveThoughtTextDrag"
								@pointerup="stopThoughtTextDrag" @pointercancel="stopThoughtTextDrag"
								@click.stop="selectThoughtText(item.id)" @dblclick.stop.prevent="editThoughtText(item.id)">
								<textarea v-if="editingThoughtTextId === item.id" :data-thought-text-input="item.id" :value="item.text"
									rows="2" @input="
										updateThoughtText(
											item.id,
											($event.target as HTMLTextAreaElement).value,
										)
										" @blur="editingThoughtTextId = ''" @pointerdown.stop @dblclick.stop />
								<span v-else>{{ item.text }}</span>
								<button v-if="selectedThoughtTextId === item.id" type="button" aria-label="删除文字"
									@click.stop="removeThoughtText(item.id)">
									×
								</button>
							</div>
							<article v-for="node in thoughtNodes" :key="node.id" :class="thoughtNodeClass(node)" :style="{
								transform: `translate(${node.x}px, ${node.y}px)`,
								width: node.width + 'px',
								minHeight: node.height + 'px',
							}" @pointerdown="startThoughtDrag($event, node)" @pointermove="moveThoughtDrag" @pointerup="stopThoughtDrag"
								@pointercancel="stopThoughtDrag" @click.stop="selectThoughtNode(node)">
								<button type="button" class="thought-connector top" aria-label="从上侧连接"
									@pointerdown.stop="startThoughtLinkDrag($event, node, 'top')" @pointermove.stop="moveThoughtLinkDrag"
									@pointerup.stop="stopThoughtLinkDrag" @pointercancel.stop="stopThoughtLinkDrag" />
								<button type="button" class="thought-connector left" aria-label="从左侧连接"
									@pointerdown.stop="startThoughtLinkDrag($event, node, 'left')" @pointermove.stop="moveThoughtLinkDrag"
									@pointerup.stop="stopThoughtLinkDrag" @pointercancel.stop="stopThoughtLinkDrag" />
								<button type="button" class="thought-connector right" aria-label="从右侧连接"
									@pointerdown.stop="startThoughtLinkDrag($event, node, 'right')"
									@pointermove.stop="moveThoughtLinkDrag" @pointerup.stop="stopThoughtLinkDrag"
									@pointercancel.stop="stopThoughtLinkDrag" />
								<button type="button" class="thought-connector bottom" aria-label="从下侧连接"
									@pointerdown.stop="startThoughtLinkDrag($event, node, 'bottom')"
									@pointermove.stop="moveThoughtLinkDrag" @pointerup.stop="stopThoughtLinkDrag"
									@pointercancel.stop="stopThoughtLinkDrag" />
								<header>
									<span>{{ thoughtNodeLabel(node.kind) }}</span>
									<button type="button" aria-label="删除节点" @click.stop="removeThoughtNode(node.id)">
										×
									</button>
								</header>
								<textarea :value="node.text" rows="4" @input="
									updateThoughtNodeText(
										node.id,
										($event.target as HTMLTextAreaElement).value,
									)
									" @pointerdown.stop />
								<footer v-if="node.sourceQuestionId">
									<button type="button" @click.stop="revealQuestion(node.sourceQuestionId)">
										查看原问答
									</button>
								</footer>
							</article>
						</div>
					</div>
					<div class="thought-reference-fab-wrap">
							<el-popover class="popover" width="min(340px, calc(100vw - 28px))" :placement="isMobile ? 'left' : 'top-end'"
								trigger="click" popper-class="thought-reference-popper">
							<template #reference>
								<button class="thought-reference-fab" type="button" aria-label="打开汤面汤底">
									<InfoFilled />
								</button>
							</template>
							<div class="thought-reference-pop">
								<div class="thought-reference-block">
									<strong>汤面</strong>
									<p v-html="sanitizeRichText(room?.surface || '')" />
								</div>
								<div class="thought-reference-block">
									<strong>问答</strong>
									<div class="timeline">
										<el-empty v-if="!visibleQuestions.length" :description="sortedQuestions.length
											? '没有匹配的问答，换个筛选或关键词试试。'
											: '还没有问题，开汤吧。'
											" />
											<article v-for="question in chatQuestions" :key="question.id" :data-question-id="question.id"
											:class="[
													'question-item',
													{
														mine: question.author.id === user?.id,
														selected: selectedQuestionId === question.id,
														pending: question.clientStatus === 'sending',
														failed: question.clientStatus === 'failed',
													},
												]" @click="toggleQuestionSelection(question.id)">
												<el-avatar :size="36" :src="question.author.avatarDataUrl" class="question-avatar">{{
													question.author.displayName.slice(0, 1)
												}}</el-avatar>
												<div class="question-bubble-wrap">
													<div class="question-meta">
														<span>{{ question.author.displayName }}</span>
														<el-tag v-if="question.author.id === room?.host.id" class="host-author-tag" effect="dark" round>
															主持人</el-tag>
														<time>{{ formatTime(question.createdAt) }}</time>
														<el-tag v-if="question.clientStatus === 'sending'" type="info" effect="plain" round>发送中</el-tag>
														<el-tag v-else-if="question.clientStatus === 'failed'" type="danger" effect="plain" round>发送失败</el-tag>
													</div>
													<div class="question-bubble">
														<p v-html="highlightQuestionText(question.text)" />
														<div v-if="
															question.quality !== 'none' ||
															question.truthGuess !== 'none' ||
															question.firstCoreClue ||
															question.firstMainLogic ||
															question.firstFullSolve
														" class="public-score-tags">
															<el-tag v-if="question.quality !== 'none'" type="success" effect="plain"
																round>{{ qualityLabels[question.quality] }}</el-tag><el-tag
																v-if="question.truthGuess !== 'none'" type="warning" effect="plain"
																round>{{ truthGuessLabels[question.truthGuess] }}</el-tag><el-tag
																v-if="question.firstCoreClue" type="success" effect="dark" round>首次核心线索</el-tag><el-tag
																v-if="question.firstMainLogic" type="warning" effect="dark" round>首次主要逻辑</el-tag><el-tag
																v-if="question.firstFullSolve" type="danger" effect="dark" round>首位完整破解</el-tag>
														</div>
													</div>
													<div class="verdict-zone">
														<span :class="['host-response', question.verdict || 'waiting']">
															汤主回应：{{ question.verdict ? verdictLabels[question.verdict] : '待回应' }}
														</span>
														<span v-if="question.important" class="important-chip">关键</span>
															<!-- <button v-if="canHost && !question.clientStatus" class="host-operate-button" type="button"
																@click.stop="openHostAction(question)">{{
																	!isMobile && selectedQuestionId === question.id ? '收起操作' : '主持操作'
																}}</button> -->
														</div>
														<div v-if="!isMobile && canHost && !question.clientStatus && selectedQuestionId === question.id" class="host-action-panel" @click.stop>
														<div class="host-action-heading">
															<strong>主持人操作</strong>
															<small>判定回答、标记线索，并记录本轮积分依据</small>
														</div>
														<div class="action-group">
															<span class="action-title">判定</span><button class="judge yes" type="button"
																@click="setVerdict(question.id, 'yes')">
																是</button><button class="judge no" type="button" @click="setVerdict(question.id, 'no')">
																不是</button><button class="judge both" type="button"
																@click="setVerdict(question.id, 'both')">
																是也不是</button><button class="judge mute" type="button"
																@click="setVerdict(question.id, 'irrelevant')">
																不重要
															</button>
														</div>
														<div class="action-group">
															<span class="action-title">标记</span><button
																:class="['judge', 'flag', { active: question.important }]" type="button"
																@click="toggleImportant(question)">
																{{ question.important ? '已标重要' : '标为重要' }}</button><button class="judge delete"
																type="button" @click="removeQuestion(question.id)">
																删除
															</button>
														</div>
														<div class="score-grid">
															<label>问题价值<el-select :model-value="question.quality" size="small" @change="
																(value: QuestionQuality) =>
																	updateQuestionScoring(question, { quality: value })
															"><el-option v-for="(label, value) in qualityLabels" :key="value" :label="label"
																		:value="value" /></el-select></label><label>猜中程度<el-select
																	:model-value="question.truthGuess" size="small" @change="
																		(value: TruthGuess) =>
																			updateQuestionScoring(question, { truthGuess: value })
																	"><el-option v-for="(label, value) in truthGuessLabels" :key="value" :label="label"
																		:value="value" /></el-select></label>
														</div>
														<div class="achievement-row">
															<el-checkbox :model-value="question.firstCoreClue" @change="
																(value: boolean) =>
																	updateQuestionScoring(question, {
																		firstCoreClue: value,
																	})
															">首次核心线索</el-checkbox><el-checkbox :model-value="question.firstMainLogic" @change="
																(value: boolean) =>
																	updateQuestionScoring(question, {
																		firstMainLogic: value,
																	})
															">首次主要逻辑</el-checkbox><el-checkbox :model-value="question.firstFullSolve" @change="
																(value: boolean) =>
																	updateQuestionScoring(question, {
																		firstFullSolve: value,
																	})
															">首位完整破解</el-checkbox>
														</div>
													</div>
												</div>
										</article>
									</div>
								</div>
							</div>
						</el-popover>
					</div>
				</div>
			</el-drawer>
			<el-dialog v-model="memberDialogOpen" :title="(selectedMember?.displayName ?? '') + ' 的重要内容'"
				width="min(680px, 92vw)"><el-empty v-if="!selectedMember?.importantQuestions.length" description="这个用户暂无重要内容" />
				<div v-else class="member-clues clue-card-grid">
					<article v-for="question in selectedMember.importantQuestions" :key="question.id" class="clue-item">
						<div class="clue-card-top">
							<el-avatar :size="24" :src="selectedMember.avatarDataUrl"
								class="clue-avatar">{{ selectedMember.displayName.slice(0, 1) }}</el-avatar>
							<div class="clue-card-author">
								<strong>{{ selectedMember.displayName }}</strong><time>{{ formatTime(question.createdAt) }}</time>
							</div>
						</div>
						<p class="clue-card-text">{{ question.text }}</p>
						<div class="public-score-tags compact">
							<el-tag v-for="tag in questionSignalTags(question)" :key="tag.key" :type="tag.type" :effect="tag.effect"
								round>{{ tag.label }}</el-tag>
						</div>
						<el-tag v-if="question.verdict" class="clue-verdict-tag" :class="question.verdict"
							:type="verdictTypes[question.verdict]" effect="plain" round>{{ verdictLabels[question.verdict] }}</el-tag>
					</article>
				</div>
			</el-dialog>
			<el-dialog v-model="soupHistoryDetailOpen" :title="selectedSoupHistoryItem?.title ?? '汤面记录'"
				width="min(760px, 94vw)">
				<div v-if="selectedSoupHistoryItem" class="soup-history-detail">
					<section class="history-detail-section">
						<span>汤底</span>
						<div class="rich-display" v-html="sanitizeRichText(selectedSoupHistoryItem.answer)" />
					</section>
					<section class="history-detail-grid">
						<div class="history-detail-section">
							<span>评分</span>
							<div class="history-rating-line">
								<el-rate :model-value="selectedSoupHistoryItem.ratingAverage || 0" disabled allow-half />
								<strong>{{
									selectedSoupHistoryItem.ratingCount
										? `${selectedSoupHistoryItem.ratingAverage} 分`
										: '暂无评分'
								}}</strong>
								<small>{{
									selectedSoupHistoryItem.ratingCount
										? `${selectedSoupHistoryItem.ratingCount} 人评分`
										: '等待玩家评分'
								}}</small>
							</div>
						</div>
						<div class="history-detail-section">
							<span>MVP</span>
							<div v-if="getHistoryMvpUser(selectedSoupHistoryItem)" class="history-mvp-line">
								<el-avatar :size="38" :src="getHistoryMvpUser(selectedSoupHistoryItem)?.avatarDataUrl
									">{{
										getHistoryMvpUser(
											selectedSoupHistoryItem,
										)?.displayName.slice(0, 1)
									}}</el-avatar>
								<div>
									<strong>{{
										getHistoryMvpUser(selectedSoupHistoryItem)?.displayName
									}}</strong>
									<small>{{ getHistoryMvpUser(selectedSoupHistoryItem)?.rankTitle }}
										·
										{{ getHistoryMvpUser(selectedSoupHistoryItem)?.points }}
										分</small>
								</div>
							</div>
							<p v-else>暂未评定 MVP</p>
						</div>
					</section>
					<section v-if="getHistoryMvpQuestions(selectedSoupHistoryItem).length" class="history-detail-section">
						<span>MVP 重要线索</span>
						<div class="mvp-clue-list">
							<article v-for="question in getHistoryMvpQuestions(
								selectedSoupHistoryItem,
							)" :key="question.id" class="mvp-clue-card">
								<div class="question-meta">
									<span>{{ question.author.displayName }}</span>
									<time>{{ formatTime(question.createdAt) }}</time>
								</div>
								<p>{{ question.text }}</p>
								<div class="public-score-tags compact">
									<el-tag v-for="tag in questionSignalTags(question)" :key="tag.key" :type="tag.type"
										:effect="tag.effect" round>{{ tag.label }}</el-tag>
								</div>
								<el-tag v-if="question.verdict" class="clue-verdict-tag" :class="question.verdict"
									:type="verdictTypes[question.verdict]" effect="plain"
									round>{{ verdictLabels[question.verdict] }}</el-tag>
							</article>
						</div>
					</section>
				</div>
			</el-dialog>
			<el-dialog v-model="settlementDialogOpen" title="本局积分排行榜" width="min(820px, 94vw)"
				@closed="handleSettlementClosed">
				<div v-if="settlement" class="settlement-board">
					<div class="answer-reveal">
						<span>汤底</span>
						<p class="rich-display" v-html="sanitizeRichText(settlement.answer)" />
					</div>
					<div class="rating-panel">
						<div>
							<strong>本局汤面评分</strong>
							<span v-if="currentSoupRating?.ratingCount">{{ currentSoupRating.ratingAverage }} 分 ·
								{{ currentSoupRating.ratingCount }} 人评分</span><span v-else>等待玩家评分</span>
						</div>
						<el-rate v-if="canRateCurrentSoup" :model-value="mySoupRating"
							@change="(value: number) => rateCurrentSoup(value)" />
						<p v-else>
							{{ canHost ? '主持人不能参与评分' : '玩家可在揭秘后评分' }}
						</p>
					</div>
					<div class="rank-list">
						<div v-for="entry in settlement.entries" :key="entry.user.id" class="rank-row">
							<strong class="rank-number">#{{ entry.rank }}</strong><el-avatar :size="42"
								:src="entry.user.avatarDataUrl">{{
									entry.user.displayName.slice(0, 1)
								}}</el-avatar>
							<div class="rank-user">
								<b>{{ entry.user.displayName }}</b><span>{{ entry.user.rankTitle }} · 累计
									{{ entry.user.points }} 分</span>
							</div>
							<strong class="rank-score">+{{ entry.total }}</strong>
							<div class="rank-breakdown">
								<el-tag v-for="(points, label) in entry.breakdown" :key="label" effect="plain" round>{{ label }}
									+{{ points }}</el-tag>
							</div>
						</div>
					</div>
				</div>
			</el-dialog>
			<el-dialog v-model="mvpSelectDialogOpen" title="评定本轮 MVP" width="min(760px, 94vw)" :close-on-click-modal="false"
				:close-on-press-escape="false" :show-close="false">
				<div class="mvp-select-board">
					<p class="mvp-copy">
						选择一位本轮 MVP。主持人不可被选择，提交后会立即向房间内玩家公布。
					</p>
					<el-radio-group v-model="selectedMvpUserId" class="mvp-candidate-grid">
						<label v-for="candidate in mvpCandidates" :key="candidate.id" class="mvp-candidate-card"
							:class="{ active: selectedMvpUserId === candidate.id }">
							<el-radio :label="candidate.id">
								<el-avatar :size="38" :src="candidate.avatarDataUrl">{{
									candidate.displayName.slice(0, 1)
								}}</el-avatar>
								<span>
									<strong>{{ candidate.displayName }}</strong>
									<small>{{ candidate.rankTitle }} ·
										{{ candidate.points }} 分</small>
								</span>
							</el-radio>
						</label>
					</el-radio-group>
					<section class="mvp-clues-panel">
						<div class="section-head compact">
							<div class="title-with-icon">
								<Flag /><strong>本轮重要线索</strong>
							</div>
							<el-tag round>{{ mvpImportantQuestions.length }}</el-tag>
						</div>
						<el-empty v-if="!mvpImportantQuestions.length" description="本轮暂无重要线索" :image-size="54" />
						<div v-else class="mvp-clue-list">
							<article v-for="question in mvpImportantQuestions" :key="question.id" class="mvp-clue-card">
								<div class="question-meta">
									<span>{{ question.author.displayName }}</span>
									<time>{{ formatTime(question.createdAt) }}</time>
								</div>
								<p>{{ question.text }}</p>
								<div class="public-score-tags compact">
									<el-tag v-for="tag in questionSignalTags(question)" :key="tag.key" :type="tag.type"
										:effect="tag.effect" round>{{ tag.label }}</el-tag>
								</div>
								<el-tag v-if="question.verdict" class="clue-verdict-tag" :class="question.verdict"
									:type="verdictTypes[question.verdict]" effect="plain"
									round>{{ verdictLabels[question.verdict] }}</el-tag>
							</article>
						</div>
					</section>
				</div>
				<template #footer>
					<el-button type="primary" :loading="mvpSubmitting" :disabled="!selectedMvpUserId"
						@click="submitMvpSelection">公布 MVP</el-button>
				</template>
			</el-dialog>
			<el-dialog v-model="mvpResultDialogOpen" title="本轮 MVP" width="min(780px, 94vw)">
				<div v-if="mvpResult" class="mvp-result-board">
					<section class="mvp-hero">
						<el-avatar :size="64" :src="mvpResult.user.avatarDataUrl">{{
							mvpResult.user.displayName.slice(0, 1)
						}}</el-avatar>
						<div>
							<span>本轮 MVP</span>
							<strong>{{ mvpResult.user.displayName }}</strong>
							<p>
								{{ mvpResult.user.rankTitle }} · 累计
								{{ mvpResult.user.points }} 分
							</p>
						</div>
					</section>
					<section class="mvp-clues-panel">
						<div class="section-head compact">
							<div class="title-with-icon">
								<Flag /><strong>本轮重要线索</strong>
							</div>
							<el-tag round>{{ mvpResult.importantQuestions.length }}</el-tag>
						</div>
						<el-empty v-if="!mvpResult.importantQuestions.length" description="本轮暂无重要线索" :image-size="54" />
						<div v-else class="mvp-clue-list">
							<article v-for="question in mvpResult.importantQuestions" :key="question.id" class="mvp-clue-card">
								<div class="question-meta">
									<span>{{ question.author.displayName }}</span>
									<time>{{ formatTime(question.createdAt) }}</time>
								</div>
								<p>{{ question.text }}</p>
								<div class="public-score-tags compact">
									<el-tag v-for="tag in questionSignalTags(question)" :key="tag.key" :type="tag.type"
										:effect="tag.effect" round>{{ tag.label }}</el-tag>
								</div>
								<el-tag v-if="question.verdict" class="clue-verdict-tag" :class="question.verdict"
									:type="verdictTypes[question.verdict]" effect="plain"
									round>{{ verdictLabels[question.verdict] }}</el-tag>
							</article>
						</div>
					</section>
				</div>
			</el-dialog>
		</main>
	</el-config-provider>
</template>

<style lang="scss" scoped>
@use '@/style.scss';

:global(body.app-route) {
	min-width: 320px;
	min-height: 100vh;
	margin: 0;
	overflow-x: hidden;
	background: #f3f6fb;
}

:global(html.dark body.app-route) {
	color-scheme: dark;
	background: #050505;
}

:global(body.app-route #app) {
	min-height: 100vh;
}
</style>
