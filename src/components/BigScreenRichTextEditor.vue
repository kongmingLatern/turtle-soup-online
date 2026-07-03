<script setup lang="ts">
import RichTextEditor from './RichTextEditor.vue'

const props = withDefaults(
	defineProps<{
		modelValue: string
		placeholder?: string
		minRows?: number
		disabled?: boolean
	}>(),
	{
		placeholder: '',
		minRows: 5,
		disabled: false,
	},
)

const emit = defineEmits<{
	'update:modelValue': [value: string]
	input: [value: string]
	blur: []
}>()
</script>

<template>
	<RichTextEditor
		class="big-screen-rich-text-editor"
		:model-value="props.modelValue"
		:placeholder="props.placeholder"
		:min-rows="props.minRows"
		:disabled="props.disabled"
		@update:model-value="value => emit('update:modelValue', value)"
		@input="value => emit('input', value)"
		@blur="emit('blur')"
	/>
</template>

<style scoped lang="scss">
.big-screen-rich-text-editor.rich-editor.big-screen-rich-text-editor {
	width: 100%;
	max-width: 100%;
	min-width: 0;
	overflow: hidden;
	border: 1px solid rgba(0, 213, 255, 0.34);
	border-radius: 0;
	color: var(--zz-ink, var(--text));
	background:
		linear-gradient(135deg, rgba(0, 213, 255, 0.08), transparent 38%),
		#111416;
	box-shadow: inset 0 0 0 1px rgba(255, 211, 42, 0.07);
	clip-path: polygon(0 10px, 10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%);
}

.big-screen-rich-text-editor.rich-editor.big-screen-rich-text-editor.disabled {
	opacity: 0.7;
}

.big-screen-rich-text-editor :deep(.rich-editor-toolbar) {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 8px;
	padding: 8px;
	border-bottom: 1px solid rgba(255, 211, 42, 0.24);
	background:
		linear-gradient(90deg, rgba(255, 211, 42, 0.14), transparent),
		#151719;
	overflow: hidden;
}

.big-screen-rich-text-editor :deep(.rich-block-select) {
	width: 108px;
	flex: 0 0 108px;
}

.big-screen-rich-text-editor :deep(.rich-tool-group) {
	display: flex;
	align-items: center;
	gap: 4px;
	padding: 3px;
	border: 1px solid rgba(255, 211, 42, 0.28);
	border-radius: 0;
	background: rgba(255, 211, 42, 0.06);
}

.big-screen-rich-text-editor :deep(.rich-tool-button) {
	width: 31px;
	height: 31px;
	display: grid;
	place-items: center;
	border: 0;
	border-radius: 0;
	color: var(--zz-muted, var(--muted));
	background: transparent;
	cursor: pointer;
	font-weight: 1000;
	transition:
		background 0.18s ease,
		color 0.18s ease,
		transform 0.18s ease;
}

.big-screen-rich-text-editor :deep(.rich-tool-button:hover),
.big-screen-rich-text-editor :deep(.rich-tool-button.active) {
	color: #111315;
	background: var(--zz-yellow, var(--gold));
}

.big-screen-rich-text-editor :deep(.rich-tool-button:active) {
	transform: translateY(1px);
}

.big-screen-rich-text-editor :deep(.rich-tool-button:disabled) {
	cursor: not-allowed;
	opacity: 0.45;
}

.big-screen-rich-text-editor :deep(.rich-tool-button svg) {
	width: 16px;
	height: 16px;
}

.big-screen-rich-text-editor :deep(.rich-tool-button.text) {
	font-size: 14px;
}

.big-screen-rich-text-editor :deep(.rich-tool-button.italic) {
	font-style: italic;
}

.big-screen-rich-text-editor :deep(.rich-tool-button.underline) {
	text-decoration: underline;
}

.big-screen-rich-text-editor :deep(.rich-color-group) {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 6px;
	padding: 0 4px;
}

.big-screen-rich-text-editor :deep(.rich-color-group.highlight) {
	padding-left: 8px;
	border-left: 1px solid rgba(255, 211, 42, 0.24);
}

.big-screen-rich-text-editor :deep(.rich-color-swatch) {
	width: 24px;
	height: 24px;
	flex: 0 0 auto;
	border: 2px solid #111416;
	border-radius: 0;
	box-shadow: 0 0 0 1px rgba(255, 211, 42, 0.32);
	cursor: pointer;
}

.big-screen-rich-text-editor :deep(.rich-color-swatch:hover),
.big-screen-rich-text-editor :deep(.rich-color-swatch.active) {
	box-shadow:
		0 0 0 2px rgba(0, 213, 255, 0.64),
		0 8px 16px rgba(0, 0, 0, 0.24);
}

.big-screen-rich-text-editor :deep(.rich-color-swatch:disabled) {
	cursor: not-allowed;
	opacity: 0.55;
}

.big-screen-rich-text-editor :deep(.rich-color-picker) {
	width: 26px;
	height: 26px;
	flex: 0 0 auto;
}

.big-screen-rich-text-editor :deep(.rich-color-picker .el-color-picker__trigger) {
	width: 26px;
	height: 26px;
	padding: 2px;
	border-radius: 0;
}

.big-screen-rich-text-editor :deep(.rich-color-picker .el-color-picker__color),
.big-screen-rich-text-editor :deep(.rich-color-picker .el-color-picker__color-inner) {
	border-radius: 0;
}

.big-screen-rich-text-editor :deep(.rich-editor-content) {
	width: 100%;
	max-width: 100%;
	min-width: 0;
	padding: 14px;
	color: var(--zz-ink, var(--text));
	background: rgba(5, 6, 7, 0.38);
	font-family: 'Microsoft YaHei', Arial, sans-serif;
	font-size: 15px;
	font-weight: 700;
	line-height: 1.75;
	outline: none;
	overflow: auto;
	overflow-wrap: anywhere;
}

.big-screen-rich-text-editor :deep(.rich-editor-content:empty::before) {
	color: rgba(248, 241, 210, 0.5);
	content: attr(data-placeholder);
	pointer-events: none;
}

.big-screen-rich-text-editor :deep(.rich-editor-content :where(p, div)) {
	margin: 0 0 8px;
}

.big-screen-rich-text-editor :deep(.rich-editor-content :where(p:last-child, div:last-child)) {
	margin-bottom: 0;
}

.big-screen-rich-text-editor :deep(.rich-editor-content :where(h3, h4)) {
	margin: 0 0 8px;
	line-height: 1.35;
}

.big-screen-rich-text-editor :deep(.rich-editor-content h3) {
	font-size: 18px;
}

.big-screen-rich-text-editor :deep(.rich-editor-content h4) {
	color: var(--zz-cyan, var(--accent));
	font-size: 16px;
}

.big-screen-rich-text-editor :deep(.rich-editor-content :where(ul, ol)) {
	margin: 0 0 8px;
	padding-left: 1.4em;
}

.big-screen-rich-text-editor :deep(.rich-editor-content blockquote) {
	margin: 0 0 8px;
	padding: 8px 10px;
	border-left: 3px solid var(--zz-cyan, var(--accent));
	background: rgba(0, 213, 255, 0.1);
}
</style>
