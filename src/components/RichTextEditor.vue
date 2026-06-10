<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Brush, CloseBold, RefreshLeft, RefreshRight } from '@element-plus/icons-vue'
import { sanitizeRichText } from '../utils/richText'

type InlineCommand = 'bold' | 'italic' | 'underline'
type EditorCommand =
	| InlineCommand
	| 'insertOrderedList'
	| 'insertUnorderedList'
	| 'backColor'
	| 'foreColor'
	| 'removeFormat'
	| 'undo'
	| 'redo'

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

const editorRef = ref<HTMLElement | null>(null)
const color = ref('#ef4444')
const highlightColor = ref('#fef3c7')
const activeMarks = ref<Record<string, boolean>>({})
const activeBlock = ref('P')
const syncingFromModel = ref(false)

const textColors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#111827']
const highlightColors = ['#fef3c7', '#dcfce7', '#dbeafe', '#ede9fe', '#fee2e2']
const blockOptions = [
	{ label: '正文', value: 'P' },
	{ label: '小标题', value: 'H3' },
	{ label: '重点', value: 'H4' },
	{ label: '引用', value: 'BLOCKQUOTE' },
]

const editorStyle = computed(() => ({
	minHeight: `${Math.max(props.minRows, 3) * 30 + 36}px`,
}))

watch(
	() => props.modelValue,
	value => {
		const editor = editorRef.value
		const nextValue = sanitizeRichText(value)
		if (!editor || editor.innerHTML === nextValue) return
		syncingFromModel.value = true
		editor.innerHTML = nextValue
		nextTick(() => {
			syncingFromModel.value = false
			refreshToolbarState()
		})
	},
	{ immediate: true },
)

onMounted(() => {
	if (editorRef.value) editorRef.value.innerHTML = sanitizeRichText(props.modelValue)
	document.addEventListener('selectionchange', refreshToolbarState)
	refreshToolbarState()
})

onBeforeUnmount(() => {
	document.removeEventListener('selectionchange', refreshToolbarState)
})

function focusEditor() {
	editorRef.value?.focus()
}

function emitValue() {
	if (syncingFromModel.value) return
	const editor = editorRef.value
	if (!editor) return
	const nextValue = sanitizeRichText(editor.innerHTML)
	if (editor.innerHTML !== nextValue) editor.innerHTML = nextValue
	emit('update:modelValue', nextValue)
	emit('input', nextValue)
	refreshToolbarState()
}

function runCommand(command: EditorCommand, value?: string) {
	if (props.disabled) return
	focusEditor()
	document.execCommand(command, false, value)
	nextTick(emitValue)
}

function setBlock(block: string) {
	if (props.disabled) return
	focusEditor()
	document.execCommand('formatBlock', false, block.toLowerCase())
	nextTick(emitValue)
}

function applyColor(nextColor: string) {
	if (!nextColor) return
	color.value = nextColor
	runCommand('foreColor', nextColor)
}

function applyHighlight(nextColor: string) {
	if (!nextColor) return
	highlightColor.value = nextColor
	runCommand('backColor', nextColor)
}

function handleCustomColor(nextColor: string | null) {
	applyColor(nextColor || color.value)
}

function handleCustomHighlight(nextColor: string | null) {
	applyHighlight(nextColor || highlightColor.value)
}

function handlePaste(event: ClipboardEvent) {
	event.preventDefault()
	const text = event.clipboardData?.getData('text/plain') ?? ''
	const html = text
		.split(/\n{2,}/)
		.map(paragraph => paragraph.trim())
		.filter(Boolean)
		.map(paragraph => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
		.join('')
	document.execCommand('insertHTML', false, html || escapeHtml(text))
	nextTick(emitValue)
}

function refreshToolbarState() {
	const editor = editorRef.value
	const selection = document.getSelection()
	if (!editor || !selection?.anchorNode || !editor.contains(selection.anchorNode)) return
	activeMarks.value = {
		bold: document.queryCommandState('bold'),
		italic: document.queryCommandState('italic'),
		underline: document.queryCommandState('underline'),
		insertOrderedList: document.queryCommandState('insertOrderedList'),
		insertUnorderedList: document.queryCommandState('insertUnorderedList'),
	}
	activeBlock.value = getCurrentBlock(selection.anchorNode)
}

function getCurrentBlock(node: Node) {
	let current: Node | null = node.nodeType === Node.ELEMENT_NODE ? node : node.parentNode
	while (current && current !== editorRef.value) {
		if (current instanceof HTMLElement) {
			const tag = current.tagName.toUpperCase()
			if (['P', 'H3', 'H4', 'BLOCKQUOTE', 'LI'].includes(tag)) return tag
		}
		current = current.parentNode
	}
	return 'P'
}

function escapeHtml(value: string) {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
}
</script>

<template>
	<div class="rich-editor pro" :class="{ disabled }">
		<div class="rich-editor-toolbar">
			<el-select
				:model-value="activeBlock"
				class="rich-block-select"
				:disabled="disabled"
				size="small"
				@change="setBlock"
			>
				<el-option
					v-for="option in blockOptions"
					:key="option.value"
					:label="option.label"
					:value="option.value"
				/>
			</el-select>

			<div class="rich-tool-group">
				<el-tooltip content="撤销" placement="top">
					<button
						type="button"
						class="rich-tool-button icon"
						:disabled="disabled"
						@click="runCommand('undo')"
					>
						<RefreshLeft />
					</button>
				</el-tooltip>
				<el-tooltip content="重做" placement="top">
					<button
						type="button"
						class="rich-tool-button icon"
						:disabled="disabled"
						@click="runCommand('redo')"
					>
						<RefreshRight />
					</button>
				</el-tooltip>
			</div>

			<div class="rich-tool-group">
				<button
					type="button"
					class="rich-tool-button text"
					:class="{ active: activeMarks.bold }"
					:disabled="disabled"
					@click="runCommand('bold')"
				>
					B
				</button>
				<button
					type="button"
					class="rich-tool-button text italic"
					:class="{ active: activeMarks.italic }"
					:disabled="disabled"
					@click="runCommand('italic')"
				>
					I
				</button>
				<button
					type="button"
					class="rich-tool-button text underline"
					:class="{ active: activeMarks.underline }"
					:disabled="disabled"
					@click="runCommand('underline')"
				>
					U
				</button>
			</div>

			<div class="rich-tool-group">
				<button
					type="button"
					class="rich-tool-button text"
					:class="{ active: activeMarks.insertUnorderedList }"
					:disabled="disabled"
					@click="runCommand('insertUnorderedList')"
				>
					•
				</button>
				<button
					type="button"
					class="rich-tool-button text"
					:class="{ active: activeMarks.insertOrderedList }"
					:disabled="disabled"
					@click="runCommand('insertOrderedList')"
				>
					1.
				</button>
			</div>

			<div class="rich-color-group" aria-label="文字颜色">
				<el-tooltip
					v-for="item in textColors"
					:key="item"
					content="文字颜色"
					placement="top"
				>
					<button
						type="button"
						class="rich-color-swatch"
						:class="{ active: color === item }"
						:style="{ backgroundColor: item }"
						:disabled="disabled"
						@click="applyColor(item)"
					/>
				</el-tooltip>
				<el-tooltip content="自定义文字颜色" placement="top">
					<el-color-picker
						v-model="color"
						class="rich-color-picker"
						:predefine="textColors"
						show-alpha
						size="small"
						:disabled="disabled"
						@change="handleCustomColor"
					/>
				</el-tooltip>
			</div>

			<div class="rich-color-group highlight" aria-label="高亮颜色">
				<el-tooltip
					v-for="item in highlightColors"
					:key="item"
					content="高亮"
					placement="top"
				>
					<button
						type="button"
						class="rich-color-swatch"
						:class="{ active: highlightColor === item }"
						:style="{ backgroundColor: item }"
						:disabled="disabled"
						@click="applyHighlight(item)"
					/>
				</el-tooltip>
				<el-tooltip content="自定义高亮颜色" placement="top">
					<el-color-picker
						v-model="highlightColor"
						class="rich-color-picker"
						:predefine="highlightColors"
						show-alpha
						size="small"
						:disabled="disabled"
						@change="handleCustomHighlight"
					/>
				</el-tooltip>
			</div>

			<div class="rich-tool-group">
				<el-tooltip content="应用当前文字颜色" placement="top">
					<button
						type="button"
						class="rich-tool-button icon"
						:disabled="disabled"
						@click="applyColor(color)"
					>
						<Brush />
					</button>
				</el-tooltip>
				<el-tooltip content="清除格式" placement="top">
					<button
						type="button"
						class="rich-tool-button icon"
						:disabled="disabled"
						@click="runCommand('removeFormat')"
					>
						<CloseBold />
					</button>
				</el-tooltip>
			</div>
		</div>

		<div
			ref="editorRef"
			class="rich-editor-content"
			:class="{ empty: !modelValue }"
			:contenteditable="!disabled"
			:data-placeholder="placeholder"
			:style="editorStyle"
			@input="emitValue"
			@focus="refreshToolbarState"
			@keyup="refreshToolbarState"
			@mouseup="refreshToolbarState"
			@blur="
				emitValue();
				emit('blur')
			"
			@paste="handlePaste"
		/>
	</div>
</template>
