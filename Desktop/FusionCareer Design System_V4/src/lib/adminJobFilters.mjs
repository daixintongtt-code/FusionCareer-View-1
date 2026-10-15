import { normalizeBrowseState } from './jobBrowse.mjs'

const STATUSES = ['', 'PUBLISHED', 'RECOMMENDED', 'OFFLINE', 'EXPIRED']

export function normalizeAdminJobFilters(input = {}) {
  const { keyword, province, city, category, recruit } = normalizeBrowseState(input)
  return { keyword, province, city, category, recruit, status: STATUSES.includes(input.status) ? input.status : '' }
}

export function buildAdminJobListParams(input, page = 1) {
  const filters = normalizeAdminJobFilters(input)
  const params = new URLSearchParams({ page: String(Number.isSafeInteger(page) && page > 0 ? page : 1), size: '20' })
  const fields = { keyword: 'keyword', province: 'workProvince', city: 'workCity', category: 'jobCategory', recruit: 'recruitType' }
  for (const [key, field] of Object.entries(fields)) if (filters[key]) params.set(field, filters[key])
  if (filters.status === 'RECOMMENDED') {
    params.set('status', 'PUBLISHED')
    params.set('recommended', 'true')
  } else if (filters.status) params.set('status', filters.status)
  return params
}
