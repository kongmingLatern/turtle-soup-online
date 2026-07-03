<script setup lang="ts">
import BigScreenView from '@/components/BigScreenView.vue'
import { useTurtleSoupRoom } from '@/composables/useTurtleSoupRoom'

const {
	answeredQuestions,
	authSubmitting,
	canHost,
	copyShareUrl,
	createRoom,
	creatingSoup,
	deleteSoup,
	deletingSoupId,
	isDark,
	joinRoom,
	leaveRoomByUser,
	liveLeaderboard,
	logout,
	memberStats,
	mvpCandidates,
	mvpResult,
	mvpSubmitting,
	openMemberImportant,
	openRoomSetup,
	pendingQuestions,
	questionText,
	removeQuestion,
	revealAnswer,
	room,
	roomCodeInput,
	saveRoom,
	saveSoupFromBigScreen,
	selectedSoupId,
	selectedMvpUserId,
	sendingQuestion,
	setVerdict,
	settlement,
	soupHistory,
	soups,
	submitAuthFromBigScreen,
	submitMvpSelection,
	submitQuestionFromBigScreen,
	surfaceViewMode,
	switchRoomSoup,
	toggleImportant,
	updateQuestionScoring,
	updateRoomField,
	user,
} = useTurtleSoupRoom({ bodyClass: 'big-screen-route' })
</script>

<template>
	<BigScreenView
		v-model:question-text="questionText"
		:room="room"
		:user="user"
		:can-host="canHost"
		:member-stats="memberStats"
		:live-leaderboard="liveLeaderboard"
		:sending-question="sendingQuestion"
		:is-dark="isDark"
		:surface-view-mode="surfaceViewMode"
		:pending-questions="pendingQuestions"
		:answered-questions="answeredQuestions"
		:soup-history-count="soupHistory.length"
		:room-code-input="roomCodeInput"
		:soups="soups"
		:selected-soup-id="selectedSoupId"
		:settlement="settlement"
		:mvp-result="mvpResult"
		:mvp-candidates="mvpCandidates"
		:selected-mvp-user-id="selectedMvpUserId"
		:mvp-submitting="mvpSubmitting"
		:auth-submitting="authSubmitting"
		:creating-soup="creatingSoup"
		:deleting-soup-id="deletingSoupId"
		@copy-share-url="copyShareUrl"
		@logout="logout"
		@toggle-theme="isDark = !isDark"
		@open-room-setup="openRoomSetup"
		@reveal-answer="revealAnswer"
		@submit-question="submitQuestionFromBigScreen"
		@set-verdict="setVerdict"
		@toggle-important="toggleImportant"
		@update-question-scoring="updateQuestionScoring"
		@remove-question="removeQuestion"
		@update-room-field="updateRoomField"
		@save-room="saveRoom"
		@update-surface-view-mode="value => (surfaceViewMode = value)"
		@join-room="joinRoom"
		@leave-room="leaveRoomByUser"
		@open-member-important="openMemberImportant"
		@submit-auth="submitAuthFromBigScreen"
		@select-soup-id="value => (selectedSoupId = value)"
		@select-mvp-user="value => (selectedMvpUserId = value)"
		@submit-mvp-selection="submitMvpSelection"
		@save-soup="saveSoupFromBigScreen"
		@delete-soup="deleteSoup"
		@create-room="createRoom"
		@switch-room-soup="switchRoomSoup"
	/>
</template>

<style lang="scss">
@use '@/bigScreen.scss';
</style>
