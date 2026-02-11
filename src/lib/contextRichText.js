const toTrimmedString = (value) => (typeof value === 'string' ? value.trim() : '')

const escapeHtml = (value) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

const normalizeMarkdownText = (value) => toTrimmedString(toTrimmedString(value).replace(/\r\n?/g, '\n'))

const sanitizeUrl = (value) => {
  const candidate = toTrimmedString(value)
  if (!/^(https?:|mailto:|tel:)/i.test(candidate)) return ''
  return candidate.replaceAll('"', '%22')
}

const renderInlineMarkdown = (value) => {
  const codeTokens = []
  const tokenized = value.replace(/`([^`]+)`/g, (_match, code) => {
    const token = `@@CODE_${codeTokens.length}@@`
    codeTokens.push(`<code>${escapeHtml(code)}</code>`)
    return token
  })

  let rendered = escapeHtml(tokenized)

  rendered = rendered.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, label, href) => {
    const safeHref = sanitizeUrl(href)
    if (!safeHref) return label
    return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${label}</a>`
  })

  rendered = rendered.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
  rendered = rendered.replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
  rendered = rendered.replace(/~~([^~\n]+)~~/g, '<s>$1</s>')

  codeTokens.forEach((tokenHtml, index) => {
    rendered = rendered.replaceAll(`@@CODE_${index}@@`, tokenHtml)
  })

  return rendered
}

const isBlank = (line) => line.trim().length === 0
const isHr = (line) => /^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)
const isHeading = (line) => /^\s{0,3}#{1,4}\s+/.test(line)
const isUnorderedListItem = (line) => /^\s{0,3}[-*+]\s+/.test(line)
const isOrderedListItem = (line) => /^\s{0,3}\d+\.\s+/.test(line)
const isQuoteLine = (line) => /^\s{0,3}>\s?/.test(line)

const markdownToHtml = (value) => {
  const source = normalizeMarkdownText(value)
  if (source.length === 0) return ''

  const lines = source.split('\n')
  const html = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]
    if (isBlank(line)) {
      index += 1
      continue
    }

    if (isHr(line)) {
      html.push('<hr>')
      index += 1
      continue
    }

    const headingMatch = line.match(/^\s{0,3}(#{1,4})\s+(.+)$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      html.push(`<h${level}>${renderInlineMarkdown(headingMatch[2].trim())}</h${level}>`)
      index += 1
      continue
    }

    if (isUnorderedListItem(line)) {
      const items = []
      while (index < lines.length && isUnorderedListItem(lines[index])) {
        const itemText = lines[index].replace(/^\s{0,3}[-*+]\s+/, '')
        items.push(`<li>${renderInlineMarkdown(itemText.trim())}</li>`)
        index += 1
      }
      html.push(`<ul>${items.join('')}</ul>`)
      continue
    }

    if (isOrderedListItem(line)) {
      const items = []
      while (index < lines.length && isOrderedListItem(lines[index])) {
        const itemText = lines[index].replace(/^\s{0,3}\d+\.\s+/, '')
        items.push(`<li>${renderInlineMarkdown(itemText.trim())}</li>`)
        index += 1
      }
      html.push(`<ol>${items.join('')}</ol>`)
      continue
    }

    if (isQuoteLine(line)) {
      const quoteLines = []
      while (index < lines.length && isQuoteLine(lines[index])) {
        quoteLines.push(lines[index].replace(/^\s{0,3}>\s?/, ''))
        index += 1
      }
      const quoteHtml = quoteLines.map((quoteLine) => renderInlineMarkdown(quoteLine)).join('<br>')
      html.push(`<blockquote><p>${quoteHtml}</p></blockquote>`)
      continue
    }

    const paragraphLines = []
    while (index < lines.length && !isBlank(lines[index])) {
      const paragraphLine = lines[index]
      if (
        paragraphLines.length > 0 &&
        (isHr(paragraphLine) ||
          isHeading(paragraphLine) ||
          isUnorderedListItem(paragraphLine) ||
          isOrderedListItem(paragraphLine) ||
          isQuoteLine(paragraphLine))
      ) {
        break
      }
      paragraphLines.push(paragraphLine)
      index += 1
    }

    const paragraphHtml = paragraphLines
      .map((paragraphLine) => renderInlineMarkdown(paragraphLine.trim()))
      .join('<br>')
    html.push(`<p>${paragraphHtml}</p>`)
  }

  return html.join('\n')
}

const extractContextMarkdown = (value) => {
  if (!value || typeof value !== 'object') return ''
  return normalizeMarkdownText(value.markdown)
}

export const extractContextContent = (value) => {
  if (value && typeof value === 'object') {
    return {
      title: toTrimmedString(value.title),
      body: extractContextMarkdown(value)
    }
  }

  return {
    title: '',
    body: ''
  }
}

export const hasRenderableContext = (value) => {
  const { title, body } = extractContextContent(value)
  return title.length > 0 || body.length > 0
}

export const renderContextRichText = (value) => markdownToHtml(value)
