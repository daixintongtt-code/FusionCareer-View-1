const STORAGE_KEY = 'fusion-career-favorites'
const CHANGE_EVENT = 'fusion-career-favorites-change'

function readStoredFavorites() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

function saveFavorites(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: items }))
}

export function readFavorites() {
  return readStoredFavorites()
}

export function isFavorite(jobId) {
  return readStoredFavorites().some(item => String(item.id) === String(jobId))
}

export function toggleFavorite(job) {
  const items = readStoredFavorites()
  const index = items.findIndex(item => String(item.id) === String(job.id))
  if (index >= 0) items.splice(index, 1)
  else items.unshift({ ...job, savedAt: new Date().toISOString() })
  saveFavorites(items)
  return index < 0
}

export function removeFavorite(jobId) {
  saveFavorites(readStoredFavorites().filter(item => String(item.id) !== String(jobId)))
}

export function subscribeFavorites(listener) {
  const handleChange = event => listener(event.detail || readStoredFavorites())
  window.addEventListener(CHANGE_EVENT, handleChange)
  window.addEventListener('storage', handleChange)
  return () => {
    window.removeEventListener(CHANGE_EVENT, handleChange)
    window.removeEventListener('storage', handleChange)
  }
}
