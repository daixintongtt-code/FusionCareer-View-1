import { deleteToken, readJson, readToken, saveToken } from '@/lib/api'

let readUserCache = null
let readUserToken = ''

function createDevUser(readRole) {
  const readIsAdmin = readRole === 'ADMIN'
  return {
    id: readIsAdmin ? 1 : 2,
    username: readIsAdmin ? '演示管理员' : '演示学生',
    studentId: readIsAdmin ? 'admin-demo' : 'student-demo',
    role: readIsAdmin ? 'ADMIN' : 'NORMAL',
  }
}

export function consumeToken() {
  const updateUrl = new URL(window.location.href)
  let readValue = updateUrl.searchParams.get('token')
  if (readValue) updateUrl.searchParams.delete('token')

  const readIndex = updateUrl.hash.indexOf('?')
  if (!readValue && readIndex !== -1) {
    const readParams = new URLSearchParams(updateUrl.hash.slice(readIndex + 1))
    readValue = readParams.get('token')
    if (readValue) {
      readParams.delete('token')
      const readPath = updateUrl.hash.slice(0, readIndex)
      const readQuery = readParams.toString()
      updateUrl.hash = readPath + (readQuery ? `?${readQuery}` : '')
    }
  }
  if (!readValue) return false

  saveToken(readValue)
  const readQuery = updateUrl.searchParams.toString()
  window.history.replaceState({}, '', updateUrl.pathname
    + (readQuery ? `?${readQuery}` : '') + updateUrl.hash)
  return true
}

export async function readUser(readRefresh = false) {
  const readValue = readToken()
  if (!readValue) { readUserCache=null; readUserToken=''; return null }
  if (import.meta.env.DEV && readValue.startsWith('local-demo-')) {
    const readRole = readValue.slice('local-demo-'.length) === 'ADMIN' ? 'ADMIN' : 'NORMAL'
    readUserCache = createDevUser(readRole)
    readUserToken = readValue
    return readUserCache
  }
  if (!readRefresh && readUserCache && readUserToken===readValue) return readUserCache
  const user = await readJson('/user/me')
  if (readToken()!==readValue) throw new Error('登录身份已变化，请重新加载')
  readUserCache = user
  readUserToken = readValue
  return readUserCache
}

export function loginUser(readRole) {
  if (import.meta.env.DEV) {
    const readDevRole = readRole === 'ADMIN' ? 'ADMIN' : 'NORMAL'
    saveToken(`local-demo-${readDevRole}`)
    readUserCache = createDevUser(readDevRole)
    readUserToken = readToken()
    window.location.hash = readDevRole === 'ADMIN' ? '#/admin' : '#/home'
    return
  }
  const readTarget = readRole === 'ADMIN' ? 'admin' : 'user'
  window.location.assign(`/fudan/login?target=${readTarget}`)
}

export async function logoutUser() {
  let readUrl = ''
  try {
    const readResult = await readJson('/fudan/logout', { method: 'POST' })
    readUrl = readResult?.redirectUrl || ''
  } finally {
    readUserCache = null
    readUserToken = ''
    deleteToken()
  }
  if (readUrl) window.location.assign(readUrl)
  else window.location.hash = '#/login'
}
