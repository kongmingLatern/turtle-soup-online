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
		class="common-rich-text-editor"
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
.common-rich-text-editor.rich-editor.common-rich-text-editor {
	width: 100%;
	max-width: 100%;
	min-width: 0;
	overflow: hidden;
	border: 1px solid var(--line);
	border-radius: 12px;
	background: color-mix(in srgb, var(--surface-strong) 86%, transparent);
	transition:
		border-color 0.18s ease,
		box-shadow 0.18s ease;
}

.common-rich-text-editor.rich-editor.common-rich-text-editor:focus-within {
	border-color: color-mix(in srgb, var(--accent) 72%, var(--line));
	box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 16%, transparent);
}

.common-rich-text-editor.rich-editor.common-rich-text-editor.disabled {
	opacity: 0.7;
}

.common-rich-text-editor :deep(.rich-editor-toolbar) {
	width: 100%;
	max-width: 100%;
	min-width: 0;
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 8px;
	padding: 8px;
	border-bottom: 1px solid var(--line);
	background: color-mix(in srgb, var(--surface-strong) 72%, transparent);
	overflow: hidden;
}

.common-rich-text-editor :deep(.rich-block-select) {
	width: 108px;
	flex: 0 0 108px;
}

.common-rich-text-editor :deep(.rich-tool-group) {
	display: flex;
	align-items: center;
	gap: 4px;
	padding: 3px;
	border: 1px solid color-mix(in srgb, var(--line) 76%, transparent);
	border-radius: 10px;
	background: color-mix(in srgb, var(--surface-strong) 64%, transparent);
}

.common-rich-text-editor :deep(.rich-tool-button) {
	width: 31px;
	height: 31px;
	display: grid;
	place-items: center;
	border: 0;
	border-radius: 8px;
	color: var(--muted);
	background: transparent;
	cursor: pointer;
	transition:
		background 0.18s ease,
		color 0.18s ease,
		transform 0.18s ease;
}

.common-rich-text-editor :deep(.rich-tool-button:hover),
.common-rich-text-editor :deep(.rich-tool-button.active) {
	color: var(--accent);
	background: color-mix(in srgb, var(--accent) 14%, transparent);
}

.common-rich-text-editor :deep(.rich-tool-button:active) {
	transform: translateY(1px);
}

.common-rich-text-editor :deep(.rich-tool-button:disabled) {
	cursor: not-allowed;
	opacity: 0.45;
}

.common-rich-text-editor :deep(.rich-tool-button svg) {
	width: 16px;
	height: 16px;
}

.common-rich-text-editor :deep(.rich-tool-button.text) {
	font-size: 14px;
	font-weight: 800;
}

.common-rich-text-editor :deep(.rich-tool-button.italic) {
	font-style: italic;
}

.common-rich-text-editor :deep(.rich-tool-button.underline) {
	text-decoration: underline;
}

.common-rich-text-editor :deep(.rich-color-group) {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 6px;
	padding: 0 4px;
}

.common-rich-text-editor :deep(.rich-color-group.highlight) {
	padding-left: 8px;
	border-left: 1px solid var(--line);
}

.common-rich-text-editor :deep(.rich-color-swatch) {
	width: 24px;
	height: 24px;
	flex: 0 0 auto;
	border: 2px solid color-mix(in srgb, var(--surface-strong) 80%, transparent);
	border-radius: 999px;
	box-shadow: 0 0 0 1px var(--line);
	cursor: pointer;
	transition:
		transform 0.18s ease,
		box-shadow 0.18s ease;
}

.common-rich-text-editor :deep(.rich-color-swatch:hover),
.common-rich-text-editor :deep(.rich-color-swatch.active) {
	transform: translateY(-1px);
	box-shadow:
		0 0 0 2px color-mix(in srgb, var(--accent) 64%, transparent),
		0 8px 16px rgba(0, 0, 0, 0.12);
}

.common-rich-text-editor :deep(.rich-color-swatch:disabled) {
	cursor: not-allowed;
	opacity: 0.55;
}

.common-rich-text-editor :deep(.rich-color-picker) {
	width: 26px;
	height: 26px;
	flex: 0 0 auto;
}

.common-rich-text-editor :deep(.rich-color-picker .el-color-picker__trigger) {
	width: 26px;
	height: 26px;
	padding: 2px;
	border-radius: 999px;
}

.common-rich-text-editor :deep(.rich-color-picker .el-color-picker__color),
.common-rich-text-editor :deep(.rich-color-picker .el-color-picker__color-inner) {
	border-radius: 999px;
}

.common-rich-text-editor :deep(.rich-editor-content) {
	width: 100%;
	max-width: 100%;
	min-width: 0;
	padding: 14px;
	color: var(--text);
	font-size: 15px;
	line-height: 1.75;
	outline: none;
	overflow: auto;
	overflow-wrap: anywhere;
}

.common-rich-text-editor :deep(.rich-editor-content:empty::before) {
	color: var(--muted);
	content: attr(data-placeholder);
	pointer-events: none;
}

.common-rich-text-editor :deep(.rich-editor-content :where(p, div)) {
	margin: 0 0 8px;
}

.common-rich-text-editor :deep(.rich-editor-content :where(p:last-child, div:last-child)) {
	margin-bottom: 0;
}

.common-rich-text-editor :deep(.rich-editor-content :where(h3, h4)) {
	margin: 0 0 8px;
	line-height: 1.35;
}

.common-rich-text-editor :deep(.rich-editor-content h3) {
	font-size: 18px;
}

.common-rich-text-editor :deep(.rich-editor-content h4) {
	color: var(--accent);
	font-size: 16px;
}

.common-rich-text-editor :deep(.rich-editor-content :where(ul, ol)) {
	margin: 0 0 8px;
	padding-left: 1.4em;
}

.common-rich-text-editor :deep(.rich-editor-content blockquote) {
	margin: 0 0 8px;
	padding: 8px 10px;
	border-left: 3px solid var(--accent);
	border-radius: 8px;
	background: color-mix(in srgb, var(--accent) 10%, transparent);
}
</style>
