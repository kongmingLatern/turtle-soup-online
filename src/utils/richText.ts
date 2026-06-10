const ALLOWED_TAGS = new Set([
	'B',
	'BLOCKQUOTE',
	'BR',
	'DIV',
	'EM',
	'H3',
	'H4',
	'I',
	'LI',
	'MARK',
	'OL',
	'P',
	'SPAN',
	'STRONG',
	'U',
	'UL',
])

function isAllowedColor(value: string) {
	return (
		/^#[0-9a-f]{3,8}$/i.test(value) ||
		/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i.test(
			value,
		)
	)
}

function appendSafeNode(source: Node, target: Node, documentRef: Document) {
	if (source.nodeType === Node.TEXT_NODE) {
		target.appendChild(documentRef.createTextNode(source.textContent ?? ''))
		return
	}
	if (source.nodeType !== Node.ELEMENT_NODE) return

	const element = source as HTMLElement
	const tagName = element.tagName.toUpperCase()
	if (tagName === 'FONT') {
		const next = documentRef.createElement('span')
		const color = element.getAttribute('color')?.trim() || element.style.color.trim()
		const backgroundColor = element.style.backgroundColor.trim()
		if (color && isAllowedColor(color)) next.style.color = color
		if (backgroundColor && isAllowedColor(backgroundColor)) {
			next.style.backgroundColor = backgroundColor
		}
		element.childNodes.forEach(child => appendSafeNode(child, next, documentRef))
		target.appendChild(next)
		return
	}
	if (!ALLOWED_TAGS.has(tagName)) {
		element.childNodes.forEach(child => appendSafeNode(child, target, documentRef))
		return
	}

	const next = documentRef.createElement(tagName.toLowerCase())
	if (tagName === 'SPAN' || tagName === 'MARK') {
		const color = element.style.color.trim()
		const backgroundColor = element.style.backgroundColor.trim()
		if (color && isAllowedColor(color)) next.style.color = color
		if (backgroundColor && isAllowedColor(backgroundColor)) {
			next.style.backgroundColor = backgroundColor
		}
	}
	element.childNodes.forEach(child => appendSafeNode(child, next, documentRef))
	target.appendChild(next)
}

export function sanitizeRichText(value: string) {
	if (!value) return ''
	const parser = new DOMParser()
	const parsed = parser.parseFromString(`<div>${value}</div>`, 'text/html')
	const output = document.implementation.createHTMLDocument('')
	const wrapper = output.createElement('div')
	parsed.body.firstElementChild?.childNodes.forEach(child =>
		appendSafeNode(child, wrapper, output),
	)
	return wrapper.innerHTML
}

export function richTextToPlainText(value: string) {
	if (!value) return ''
	const parser = new DOMParser()
	const parsed = parser.parseFromString(sanitizeRichText(value), 'text/html')
	return parsed.body.textContent?.replace(/\u00a0/g, ' ') ?? ''
}
