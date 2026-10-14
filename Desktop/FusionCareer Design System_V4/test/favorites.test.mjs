import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { parse, compileScript } from '@vue/compiler-sfc'
import { ref, computed } from 'vue'

const source = await readFile(new URL('../src/lib/favorites.js', import.meta.url), 'utf8')
const tokenKey = 'fusion-career-token'
const favoritesKey = owner => `fusion-career-favorites:user:${encodeURIComponent(owner)}`
let moduleNumber = 0

async function setup(t) {
  const previousStorage = globalThis.localStorage
  const previousWindow = globalThis.window
  const values = new Map([[tokenKey, 'token-a']])
  const storage = {
    failedReadKey: undefined,
    failWrites: false,
    writes: 0,
    getItem(key) {
      if (this.failedReadKey === key) throw new Error('Storage disabled')
      return values.get(key) ?? null
    },
    setItem(key, value) {
      if (this.failWrites) throw new Error('Quota exceeded')
      this.writes += 1
      values.set(key, String(value))
    },
  }
  globalThis.localStorage = storage
  globalThis.window = new EventTarget()
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}#${moduleNumber++}`
  const favorites = await import(moduleUrl)
  t.after(() => {
    if (previousStorage === undefined) delete globalThis.localStorage
    else globalThis.localStorage = previousStorage
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
  })
  return { favorites, storage, values, events: globalThis.window }
}

test('favorites remain isolated between authenticated accounts and token changes', async t => {
  const { favorites, values } = await setup(t)
  values.set('fusion-career-favorites', JSON.stringify([{ id: 'legacy-shared' }]))
  favorites.setFavoritesUser({ id: 'student-a' })
  assert.deepEqual(favorites.readFavorites(), [])
  assert.equal(favorites.toggleFavorite({ id: 'job-a', positionName: '岗位 A' }), true)
  assert.equal(favorites.isFavorite('job-a'), true)

  values.set(tokenKey, 'token-b')
  assert.deepEqual(favorites.readFavorites(), [])
  assert.throws(() => favorites.toggleFavorite({ id: 'job-b' }), /请登录/)
  favorites.setFavoritesUser({ id: 'student-b' })
  assert.deepEqual(favorites.readFavorites(), [])
  favorites.toggleFavorite({ id: 'job-b' })
  assert.equal(favorites.isFavorite('job-a'), false)

  values.set(tokenKey, 'token-a-new')
  favorites.setFavoritesUser({ id: 'student-a' })
  assert.deepEqual(favorites.readFavorites().map(item => item.id), ['job-a'])
  values.delete(tokenKey)
  assert.deepEqual(favorites.readFavorites(), [])
  assert.throws(() => favorites.removeFavorite('job-a'), /请登录/)
})

test('student ID fallback scopes storage and unknown users cannot write favorites', async t => {
  const { favorites, values } = await setup(t)
  favorites.setFavoritesUser({ studentId: '2026/001' })
  favorites.toggleFavorite({ id: 42 })
  assert.deepEqual(JSON.parse(values.get(favoritesKey('student:2026/001'))).map(item => item.id), ['42'])
  favorites.setFavoritesUser(null)
  assert.deepEqual(favorites.readFavorites(), [])
  assert.throws(() => favorites.toggleFavorite({ id: '43' }), /请登录/)
})

test('long string IDs stay distinct and unsafe numeric IDs are rejected', async t => {
  const { favorites } = await setup(t)
  favorites.setFavoritesUser({ id: '9223372036854775807' })
  const first = '9223372036854775806'
  const second = '9223372036854775807'
  favorites.toggleFavorite({ id: first })
  favorites.toggleFavorite({ id: second })
  assert.deepEqual(favorites.readFavorites().map(item => item.id), [second, first])
  assert.equal(favorites.toggleFavorite({ id: first }), false)
  assert.deepEqual(favorites.readFavorites().map(item => item.id), [second])
  assert.throws(() => favorites.toggleFavorite({ id: Number(second) }), /岗位编号无效/)
})

test('failed writes preserve the existing list and never emit a success change event', async t => {
  const { favorites, storage, events } = await setup(t)
  favorites.setFavoritesUser({ id: 'student-a' })
  favorites.toggleFavorite({ id: 'saved-job' })
  let changeCount = 0
  const stop = favorites.subscribeFavorites(() => { changeCount += 1 })
  let rawEventCount = 0
  events.addEventListener('fusion-career-favorites-change', () => { rawEventCount += 1 })
  storage.failWrites = true
  assert.throws(() => favorites.toggleFavorite({ id: 'new-job' }), /无法保存收藏/)
  assert.throws(() => favorites.removeFavorite('saved-job'), /无法保存收藏/)
  assert.deepEqual(favorites.readFavorites().map(item => item.id), ['saved-job'])
  assert.equal(changeCount, 0)
  assert.equal(rawEventCount, 0)
  stop()
})

test('failed reads cannot overwrite an unreadable saved list', async t => {
  const { favorites, storage, values } = await setup(t)
  favorites.setFavoritesUser({ id: 'student-a' })
  favorites.toggleFavorite({ id: 'saved-job' })
  const key = favoritesKey('id:student-a')
  const before = values.get(key)
  const writesBefore = storage.writes
  storage.failedReadKey = key
  assert.deepEqual(favorites.readFavorites(), [])
  assert.throws(() => favorites.toggleFavorite({ id: 'new-job' }), /无法读取收藏/)
  assert.equal(values.get(key), before)
  assert.equal(storage.writes, writesBefore)
  storage.failedReadKey = tokenKey
  assert.throws(() => favorites.toggleFavorite({ id: 'new-job' }), /无法保存收藏/)
  assert.equal(storage.writes, writesBefore)
})

test('subscribers see saved state, account changes and relevant cross-tab storage changes', async t => {
  const { favorites, values, events } = await setup(t)
  favorites.setFavoritesUser({ id: 'student-a' })
  const snapshots = []
  const stop = favorites.subscribeFavorites(items => snapshots.push(items.map(item => item.id)))
  favorites.toggleFavorite({ id: 'same-tab' })
  assert.deepEqual(snapshots, [['same-tab']])
  const emitStorage = key => {
    const event = new Event('storage')
    Object.defineProperty(event, 'key', { value: key })
    events.dispatchEvent(event)
  }
  emitStorage(favoritesKey('id:student-b'))
  assert.equal(snapshots.length, 1)
  values.set(favoritesKey('id:student-a'), JSON.stringify([{ id: 'other-tab' }]))
  emitStorage(favoritesKey('id:student-a'))
  assert.deepEqual(snapshots.at(-1), ['other-tab'])
  values.delete(tokenKey)
  emitStorage(tokenKey)
  assert.deepEqual(snapshots.at(-1), [])
  favorites.setFavoritesUser(null)
  assert.deepEqual(snapshots.at(-1), [])
  const countBeforeStop = snapshots.length
  stop()
  emitStorage(null)
  favorites.setFavoritesUser({ id: 'student-a' })
  assert.equal(snapshots.length, countBeforeStop)
})

test('stored duplicates and invalid IDs are removed without precision loss', async t => {
  const { favorites, values } = await setup(t)
  favorites.setFavoritesUser({ id: 'student-a' })
  const key = favoritesKey('id:student-a')
  values.set(key, JSON.stringify([
    { id: '9223372036854775807' },
    { id: 7 }, { id: '7' }, { id: '' }, null,
    { id: Number.MAX_SAFE_INTEGER + 1 },
  ]))
  assert.deepEqual(favorites.readFavorites().map(item => item.id), ['9223372036854775807', '7'])
  values.set(key, '{invalid-json')
  assert.deepEqual(favorites.readFavorites(), [])
})

// Execute the actual compiled component setup with deferred authentication and
// lifecycle stubs, so the tests exercise request ordering rather than source text.
async function setupComponent(t, filename) {
  const componentSource = await readFile(new URL(`../src/views/${filename}`, import.meta.url), 'utf8')
  const { descriptor } = parse(componentSource, { filename })
  const compiled = compileScript(descriptor, { id: filename })
  const harnessKey = `__favoritesComponentTest${moduleNumber++}`
  const harness = {
    token: 'token-a', requests: [], owners: [], mounted: [], beforeUnmount: [], unsubscribed: 0,
    jsonPaths: [], applicationLoads: 0, currentUser: null,
    ref, computed, watch: () => {},
    onMounted(callback) { harness.mounted.push(callback) },
    onBeforeUnmount(callback) { harness.beforeUnmount.push(callback) },
    useRoute: () => ({ params: { id: 'job-a' }, query: {} }),
    useRouter: () => ({ push() {} }),
    useToast: () => ({ success() {}, error() {} }),
    readToken: () => harness.token,
    readUser: refresh => refresh
      ? new Promise((resolve, reject) => {
        harness.requests.push({ resolve(user) { harness.currentUser = user; resolve(user) }, reject })
      })
      : Promise.resolve(harness.currentUser),
    readJson: async path => {
      harness.jsonPaths.push(path)
      if (path === '/user/profile/get') return { realName: '恢复用户' }
      if (path === '/user/resume/get') return { personalIntro: '恢复简历' }
      if (path === '/user/resume/file/list') return [{ id: 'file-a', originalName: '简历.pdf', fileSize: 1024, mimeType: 'application/pdf' }]
      return null
    },
    parsePreferenceList: () => [],
    loadMyApplicationsPage: async () => {
      harness.applicationLoads += 1
      return { list: [], tabCounts: { all: 0 } }
    },
    loadResumeFileList: async () => [],
    setFavoritesUser(user) { harness.owners.push({ user, token: harness.token }) },
    readFavorites: () => [{ id: 'saved-job' }],
    isFavorite: () => false,
    subscribeFavorites: () => () => { harness.unsubscribed += 1 },
  }
  globalThis[harnessKey] = harness
  t.after(() => { delete globalThis[harnessKey] })
  const importsBySource = new Map()
  Object.values(compiled.imports).forEach(item => {
    const names = importsBySource.get(item.source) || new Set()
    names.add(item.imported)
    importsBySource.set(item.source, names)
  })
  const stubUrls = new Map([...importsBySource].map(([sourceName, names]) => {
    const exports = [...names].filter(name => name !== 'default').map(name =>
      `export const ${name} = harness[${JSON.stringify(name)}] ?? (() => {});`)
    const stubSource = `const harness = globalThis[${JSON.stringify(harnessKey)}]; export default {}; ${exports.join('\n')}`
    return [sourceName, `data:text/javascript;base64,${Buffer.from(stubSource).toString('base64')}`]
  }))
  const executable = compiled.content.replace(/from\s+(['"])([^'"]+)\1/g,
    (_, quote, sourceName) => `from ${quote}${stubUrls.get(sourceName)}${quote}`)
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(executable).toString('base64')}#${moduleNumber++}`
  const component = await import(moduleUrl)
  const state = component.default.setup({}, { expose() {} })
  return { harness, state }
}

for (const filename of ['JobDetailView.vue', 'ProfileView.vue']) {
  test(`${filename} ignores authentication results after the account token changes`, async t => {
    const { harness, state } = await setupComponent(t, filename)
    const initialization = state.initializeFavorites()
    harness.token = 'token-b'
    harness.requests[0].resolve({ id: 'student-a' })
    await initialization
    assert.deepEqual(harness.owners.map(item => item.user), [null])
    assert.match(state.favoritesError.value, /登录状态已变化/)
    if (state.favoritesReady) assert.equal(state.favoritesReady.value, false)
  })

  test(`${filename} shows an expired-login error and finishes loading after a 401 clears the token`, async t => {
    const { harness, state } = await setupComponent(t, filename)
    const initialization = state.initializeFavorites()
    harness.token = ''
    harness.requests[0].reject(Object.assign(new Error('登录已过期'), { code: 401 }))
    await initialization
    assert.deepEqual(harness.owners.map(item => item.user), [null])
    assert.match(state.favoritesError.value, /登录状态已变化/)
    if (state.favoritesReady) assert.equal(state.favoritesReady.value, false)
    if (state.favoritesLoading) assert.equal(state.favoritesLoading.value, false)
  })

  test(`${filename} only applies the newest initialization even when older requests finish last`, async t => {
    const { harness, state } = await setupComponent(t, filename)
    const first = state.initializeFavorites()
    const second = state.initializeFavorites()
    harness.requests[1].resolve({ id: 'student-current' })
    await second
    harness.requests[0].resolve({ id: 'student-old' })
    await first
    assert.deepEqual(harness.owners.map(item => item.user?.id || null), [null, null, 'student-current'])
    assert.equal(state.favoritesError.value, '')
    if (state.favoritesReady) assert.equal(state.favoritesReady.value, true)
    if (state.favoritesLoading) assert.equal(state.favoritesLoading.value, false)
  })

  test(`${filename} does not let stale errors replace a successful retry`, async t => {
    const { harness, state } = await setupComponent(t, filename)
    const first = state.initializeFavorites()
    const second = state.initializeFavorites()
    harness.requests[1].resolve({ id: 'student-current' })
    await second
    harness.requests[0].reject(new Error('Old request failed'))
    await first
    assert.equal(state.favoritesError.value, '')
    assert.equal(harness.owners.at(-1).user.id, 'student-current')
    if (state.favoritesReady) assert.equal(state.favoritesReady.value, true)
    if (state.favoritesLoading) assert.equal(state.favoritesLoading.value, false)
  })

  test(`${filename} leaves a newer pending initialization untouched when an old request fails`, async t => {
    const { harness, state } = await setupComponent(t, filename)
    const first = state.initializeFavorites()
    const second = state.initializeFavorites()
    harness.requests[0].reject(new Error('Old request failed'))
    await first
    assert.equal(state.favoritesError.value, '')
    if (state.favoritesReady) assert.equal(state.favoritesReady.value, false)
    if (state.favoritesLoading) assert.equal(state.favoritesLoading.value, true)
    harness.requests[1].resolve({ id: 'student-current' })
    await second
    assert.equal(harness.owners.at(-1).user.id, 'student-current')
  })

  test(`${filename} invalidates pending work and unsubscribes when unmounted`, async t => {
    const { harness, state } = await setupComponent(t, filename)
    const mountedWork = harness.mounted[0]()
    harness.beforeUnmount[0]()
    harness.requests[0].resolve({ id: 'student-a' })
    await mountedWork
    await Promise.resolve()
    assert.deepEqual(harness.owners.map(item => item.user), [null])
    assert.equal(harness.unsubscribed, 1)
    assert.equal(state.favoritesError.value, '')
    const requestCount = harness.requests.length
    await state.initializeFavorites()
    assert.equal(harness.requests.length, requestCount)
  })
}

test('ProfileView.vue retries all account panels after a temporary authentication failure', async t => {
  const { harness, state } = await setupComponent(t, 'ProfileView.vue')
  const mountedWork = harness.mounted[0]()
  harness.requests[0].reject(new Error('接口暂不可用'))
  await mountedWork
  assert.equal(state.accountLoading.value, false)
  assert.equal(state.accountLoadError.value, '接口暂不可用')
  assert.deepEqual(harness.jsonPaths, [])
  assert.equal(harness.applicationLoads, 0)

  const retried = state.loadAccountData()
  harness.requests[1].resolve({ id: 'student-a', studentId: '2026-A' })
  await retried
  assert.equal(state.accountLoading.value, false)
  assert.equal(state.accountLoadError.value, '')
  assert.equal(state.favoritesError.value, '')
  assert.deepEqual(new Set(harness.jsonPaths), new Set([
    '/user/profile/get', '/user/resume/get', '/user/resume/file/list', '/user/resume/file/quota',
  ]))
  assert.equal(harness.applicationLoads, 1)
  assert.equal(state.form.value.realName, '恢复用户')
  assert.equal(state.resumeForm.value.personalIntro, '恢复简历')
  assert.equal(state.resumes.value[0].name, '简历.pdf')
})
