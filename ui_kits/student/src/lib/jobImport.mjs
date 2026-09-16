export const JOB_IMPORT_ENDPOINT = '/admin/job-post/import'
export const JOB_IMPORT_TEMPLATE_PATH = 'templates/job-import-template.xlsx'
export const JOB_IMPORT_MAX_BYTES = 10 * 1024 * 1024

const ALLOWED_EXTENSIONS = ['xlsx', 'xls']

export function validateJobImportFile(file) {
  if (!file) return '请选择需要导入的 Excel 文件'
  const fileName = String(file.name || '')
  const extension = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : ''
  if (!ALLOWED_EXTENSIONS.includes(extension)) return '仅支持 .xlsx 或 .xls 格式的 Excel 文件'
  if (Number(file.size || 0) > JOB_IMPORT_MAX_BYTES) return '文件不能超过 10 MB'
  return ''
}

function readCount(...values) {
  for (const value of values) {
    if (value == null || value === '') continue
    const count = Number(value)
    if (Number.isFinite(count) && count >= 0) return count
  }
  return null
}

function normalizeIssue(issue, fallback) {
  if (typeof issue === 'string') return issue
  if (!issue || typeof issue !== 'object') return String(issue || '')
  const prefix = issue.rowNumber ?? issue.row ?? issue.line
  const message = issue.message ?? issue.reason ?? issue.error ?? fallback
  return prefix == null ? String(message) : `第 ${prefix} 行：${message}`
}

/**
 * 兼容后端在联调阶段常见的计数字段命名，最终以 successCount / failedCount / errors 输出。
 */
export function normalizeJobImportResult(result) {
  const source = result && typeof result === 'object' ? result : {}
  const successCount = readCount(
    typeof result === 'number' ? result : null,
    source.successCount,
    source.importedCount,
    source.createdCount,
    source.count,
  )
  const failedCount = readCount(source.failedCount, source.failureCount, source.errorCount)
  const rawErrors = source.errors ?? source.failures ?? source.errorMessages ?? source.failedRows ?? []
  const rawWarnings = source.warnings ?? source.warningMessages ?? source.reviewWarnings ?? []
  const errors = (Array.isArray(rawErrors) ? rawErrors : [rawErrors])
    .map(error => normalizeIssue(error, '数据格式不正确'))
    .filter(Boolean)
  const warnings = (Array.isArray(rawWarnings) ? rawWarnings : [rawWarnings])
    .map(warning => normalizeIssue(warning, '请复核该行数据'))
    .filter(Boolean)

  return {
    successCount,
    failedCount: failedCount ?? (errors.length ? errors.length : 0),
    errors,
    warnings,
  }
}
