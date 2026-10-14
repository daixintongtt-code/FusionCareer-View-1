const STORAGE_PREFIX = 'fusion-career-favorites:user:'
const TOKEN_KEY = 'fusion-career-token'
const CHANGE_EVENT = 'fusion-career-favorites-change'
let currentUserKey = null
let currentToken = ''

function identifier(value) {
  if (typeof value === 'string') return value.trim()
  // Long backend IDs must stay strings; an unsafe number is already imprecise.
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? String(value)
    : ''
}

function activeStorageKey() {
  if (!currentUserKey || !currentToken) return null
  try {
    return localStorage.getItem(TOKEN_KEY) === currentToken ? currentUserKey : null
  } catch {
    return null
  }
}

function notifyChange() {
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT))
}

// No backend favorites endpoint is defined yet. Scope local favorites to the
// authenticated account and token; never claim an old shared list as this user.
export function setFavoritesUser(user) {
  const userId = identifier(user?.id)
  const studentId = identifier(user?.studentId)
  const owner = userId ? `id:${userId}` : studentId ? `student:${studentId}` : ''
  currentUserKey = owner ? `${STORAGE_PREFIX}${encodeURIComponent(owner)}` : null
  try {
    currentToken = currentUserKey ? localStorage.getItem(TOKEN_KEY) || '' : ''
  } catch {
    currentToken = ''
  }
  notifyChange()
}

function normalizeItems(items) {
  if (!Array.isArray(items)) return []
  const seen = new Set()
  return items.filter(item => {
    const id = identifier(item?.id)
    if (!id || seen.has(id)) return false
    seen.add(id)
    return true
  }).map(item => ({ ...item, id: identifier(item.id) }))
}

function readStoredFavorites(throwOnFailure = false) {
  const key = activeStorageKey()
  if (!key) return []
  let value
  try {
    value = localStorage.getItem(key)
  } catch {
    if (throwOnFailure) throw new Error('无法读取收藏，请检查浏览器存储设置后重试')
    return []
  }
  try {
    return normalizeItems(JSON.parse(value || '[]'))
  } catch {
    return []
  }
}

function saveFavorites(items) {
  let token
  try {
    token = localStorage.getItem(TOKEN_KEY)
  } catch {
    throw new Error('无法保存收藏，请检查浏览器存储设置后重试')
  }
  if (!currentUserKey || !currentToken || token !== currentToken) {
    throw new Error('请登录后收藏岗位')
  }
  try {
    localStorage.setItem(currentUserKey, JSON.stringify(items))
  } catch {
    throw new Error('无法保存收藏，请检查浏览器存储空间或设置后重试')
  }
  notifyChange()
}

export function readFavorites() {
  return readStoredFavorites()
}

export function isFavorite(jobId) {
  const id = identifier(jobId)
  return !!id && readStoredFavorites().some(item => item.id === id)
}

export function toggleFavorite(job) {
  const id = identifier(job?.id)
  if (!id) throw new Error('岗位编号无效，无法收藏')
  const items = readStoredFavorites(true)
  const index = items.findIndex(item => item.id === id)
  if (index >= 0) items.splice(index, 1)
  else items.unshift({ ...job, id, savedAt: new Date().toISOString() })
  saveFavorites(items)
  return index < 0
}

export function removeFavorite(jobId) {
  const id = identifier(jobId)
  if (!id) throw new Error('岗位编号无效，无法取消收藏')
  saveFavorites(readStoredFavorites(true).filter(item => item.id !== id))
}

export function subscribeFavorites(listener) {
  const handleChange = () => listener(readStoredFavorites())
  const handleStorage = event => {
    if (event.key === null || event.key === currentUserKey || event.key === TOKEN_KEY) handleChange()
  }
  window.addEventListener(CHANGE_EVENT, handleChange)
  window.addEventListener('storage', handleStorage)
  return () => {
    window.removeEventListener(CHANGE_EVENT, handleChange)
    window.removeEventListener('storage', handleStorage)
  }
}
