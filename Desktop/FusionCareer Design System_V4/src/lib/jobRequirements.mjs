export const EDU_OPTIONS = [
  ['UNDERGRADUATE', '本科生'],
  ['ACADEMIC_MASTER', '学术硕士研究生'],
  ['PROFESSIONAL_MASTER', '专业硕士研究生'],
  ['DOCTORAL', '博士研究生'],
]

const EDU_LABELS = {
  ...Object.fromEntries(EDU_OPTIONS),
  BACHELOR: '本科生',
  DOCTORATE: '博士研究生',
}

export function readValues(readValue, readFallback = '') {
  if (Array.isArray(readValue)) {
    return [...new Set(readValue.map(readItem => String(readItem).trim()).filter(Boolean))]
  }
  if (typeof readValue === 'string' && readValue.trim().startsWith('[')) {
    try { return readValues(JSON.parse(readValue)) } catch { /* use delimited text */ }
  }
  const readText = String(readValue || readFallback || '').trim()
  return readText ? [...new Set(readText.split(/[,，、;；]/).map(readItem => readItem.trim()).filter(Boolean))] : []
}

export function normalizeJobRequirements(readJob = {}) {
  const reqEduLevels = readValues(readJob.reqEduLevels, readJob.reqEduLevel)
  const workCities = readValues(readJob.workCities, readJob.workCity)
  return {
    ...readJob,
    reqEduLevels,
    reqEduLevel: reqEduLevels[0] || '',
    workCities,
    workCity: workCities[0] || '',
  }
}

export function formatEducation(readJob = {}) {
  return readValues(readJob.reqEduLevels, readJob.reqEduLevel)
    .map(readLevel => EDU_LABELS[readLevel] || readLevel).join('、')
}

export function formatCities(readJob = {}) {
  return readValues(readJob.workCities, readJob.workCity).join('、')
}
