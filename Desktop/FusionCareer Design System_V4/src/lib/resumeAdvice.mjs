import { readJson, uploadForm } from './api.js'

export const RESUME_ADVICE_ENDPOINT = jobPostId => `/job/${encodeURIComponent(jobPostId)}/resume/advice`
export const RESUME_ADVICE_ACCEPT = '.pdf,.docx,.jpg,.jpeg,.png'
export const RESUME_ADVICE_MAX_BYTES = 20 * 1024 * 1024

const ALLOWED_EXTENSIONS = new Set(['pdf', 'docx', 'jpg', 'jpeg', 'png'])

export function normalizeResumeFiles(readValue) {
  const readList = Array.isArray(readValue) ? readValue : readValue?.list || readValue?.files || []
  return readList.map(readFile => ({
    ...readFile,
    id:String(readFile.id ?? readFile.fileId ?? ''),
    name:readFile.originalName || readFile.fileName || readFile.name || '未命名简历',
    fileSize:Number(readFile.fileSize || readFile.size || 0),
    mimeType:readFile.mimeType || readFile.contentType || '',
  })).filter(readFile => readFile.id)
}

export function validateResumeAdviceFile(readFile) {
  if (!readFile) return '请选择一份简历文件'
  const readExtension = String(readFile.name || '').split('.').pop().toLowerCase()
  if (!ALLOWED_EXTENSIONS.has(readExtension)) return '仅支持 PDF、DOCX、JPG、JPEG、PNG 格式'
  if (Number(readFile.size || 0) > RESUME_ADVICE_MAX_BYTES) return '文件大小不能超过 20 MB'
  return ''
}

export function normalizeResumeAdvice(readValue) {
  if (typeof readValue === 'string') return { markdown:readValue }
  const readMarkdown = readValue?.markdown
    || readValue?.content
    || readValue?.advice
    || readValue?.result
    || readValue?.report
    || readValue?.text
    || ''
  if (typeof readMarkdown !== 'string' || !readMarkdown.trim()) {
    throw new Error('简历修改服务未返回可展示的建议')
  }
  return {
    ...readValue,
    markdown:readMarkdown,
    matchLevel:readValue?.matchLevel || readValue?.matchConclusion || '',
  }
}

export async function loadResumeAdviceFiles() {
  return normalizeResumeFiles(await readJson('/user/resume/file/list'))
}

export async function requestResumeAdvice(jobPostId, readSelection) {
  if (!jobPostId) throw new Error('缺少岗位信息，无法生成修改建议')
  if (readSelection?.type === 'stored' && readSelection.id) {
    return normalizeResumeAdvice(await readJson(RESUME_ADVICE_ENDPOINT(jobPostId), {
      method:'POST',
      body:JSON.stringify({ resumeFileId:readSelection.id }),
    }))
  }
  if (readSelection?.type === 'upload' && readSelection.file) {
    const readError = validateResumeAdviceFile(readSelection.file)
    if (readError) throw new Error(readError)
    const uploadBody = new FormData()
    uploadBody.append('file', readSelection.file)
    return normalizeResumeAdvice(await uploadForm(RESUME_ADVICE_ENDPOINT(jobPostId), uploadBody))
  }
  throw new Error('请先选择或上传一份简历')
}

function splitTableRow(readLine) {
  return readLine.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(readCell => readCell.trim())
}

function isTableDivider(readLine) {
  const readCells = splitTableRow(readLine)
  return readCells.length > 0 && readCells.every(readCell => /^:?-{3,}:?$/.test(readCell))
}

function isBlockStart(readLines, readIndex) {
  const readLine = readLines[readIndex] || ''
  if (!readLine.trim()) return true
  if (/^#{1,6}\s+/.test(readLine) || /^>\s?/.test(readLine)) return true
  if (/^\s*[-*+]\s+/.test(readLine) || /^\s*\d+[.)]\s+/.test(readLine)) return true
  return readLine.includes('|') && isTableDivider(readLines[readIndex + 1] || '')
}

export function parseInlineMarkdown(readText) {
  const readTokens = []
  const readPattern = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g
  let readCursor = 0
  let readMatch
  while ((readMatch = readPattern.exec(String(readText || '')))) {
    if (readMatch.index > readCursor) readTokens.push({ type:'text', text:readText.slice(readCursor, readMatch.index) })
    const readValue = readMatch[0]
    if (readValue.startsWith('**')) readTokens.push({ type:'strong', text:readValue.slice(2, -2) })
    else if (readValue.startsWith('`')) readTokens.push({ type:'code', text:readValue.slice(1, -1) })
    else readTokens.push({ type:'em', text:readValue.slice(1, -1) })
    readCursor = readMatch.index + readValue.length
  }
  if (readCursor < String(readText || '').length) readTokens.push({ type:'text', text:readText.slice(readCursor) })
  return readTokens.length ? readTokens : [{ type:'text', text:String(readText || '') }]
}

export function parseMarkdownBlocks(readMarkdown) {
  const readLines = String(readMarkdown || '').replace(/\r\n?/g, '\n').split('\n')
  const readBlocks = []
  let readIndex = 0

  while (readIndex < readLines.length) {
    const readLine = readLines[readIndex]
    if (!readLine.trim()) { readIndex += 1; continue }

    const readHeading = readLine.match(/^(#{1,6})\s+(.+)$/)
    if (readHeading) {
      readBlocks.push({ type:'heading', level:readHeading[1].length, content:parseInlineMarkdown(readHeading[2]) })
      readIndex += 1
      continue
    }

    if (readLine.includes('|') && isTableDivider(readLines[readIndex + 1] || '')) {
      const readHeaders = splitTableRow(readLine).map(parseInlineMarkdown)
      readIndex += 2
      const readRows = []
      while (readIndex < readLines.length && readLines[readIndex].includes('|') && readLines[readIndex].trim()) {
        readRows.push(splitTableRow(readLines[readIndex]).map(parseInlineMarkdown))
        readIndex += 1
      }
      readBlocks.push({ type:'table', headers:readHeaders, rows:readRows })
      continue
    }

    if (/^>\s?/.test(readLine)) {
      const readQuote = []
      while (readIndex < readLines.length && /^>\s?/.test(readLines[readIndex])) {
        readQuote.push(readLines[readIndex].replace(/^>\s?/, '').trim())
        readIndex += 1
      }
      readBlocks.push({ type:'quote', content:parseInlineMarkdown(readQuote.join(' ')) })
      continue
    }

    const readListMatch = readLine.match(/^\s*([-*+]|\d+[.)])\s+(.+)$/)
    if (readListMatch) {
      const readOrdered = /^\d/.test(readListMatch[1])
      const readItems = []
      const readPattern = readOrdered ? /^\s*\d+[.)]\s+(.+)$/ : /^\s*[-*+]\s+(.+)$/
      while (readIndex < readLines.length) {
        const readItem = readLines[readIndex].match(readPattern)
        if (!readItem) break
        readItems.push(parseInlineMarkdown(readItem[1]))
        readIndex += 1
      }
      readBlocks.push({ type:'list', ordered:readOrdered, items:readItems })
      continue
    }

    const readParagraph = [readLine.trim()]
    readIndex += 1
    while (readIndex < readLines.length && !isBlockStart(readLines, readIndex)) {
      readParagraph.push(readLines[readIndex].trim())
      readIndex += 1
    }
    readBlocks.push({ type:'paragraph', content:parseInlineMarkdown(readParagraph.join(' ')) })
  }

  return readBlocks
}
