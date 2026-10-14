import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { parse, compileScript } from '@vue/compiler-sfc'
import { ref, reactive, computed } from 'vue'
import * as jobBrowse from '../src/lib/jobBrowse.mjs'
import { formatCities } from '../src/lib/jobRequirements.mjs'

const source = await readFile(new URL('../src/views/HomeView.vue', import.meta.url), 'utf8')
const { descriptor, errors } = parse(source)
assert.deepEqual(errors, [])
// Vue compiles the actual component's complete script setup. Only module imports
// and the module export are adapted to inject browser/router/API dependencies.
// No business functions are copied, removed or replaced for these tests.
const compiled = compileScript(descriptor, { id: 'home-lifecycle-test' }).content

function deferred() {
  let resolve, reject
  const promise = new Promise((accept, fail) => { resolve = accept; reject = fail })
  return { promise, resolve, reject }
}

async function settle() {
  for (let index = 0; index < 12; index += 1) await Promise.resolve()
}

let fixtureId = 0
function setup({ snapshot = null, holdNextTick = false } = {}) {
  const id = `home-lifecycle:${fixtureId++}`
  const user = { id, studentId: id, role: 'NORMAL' }
  const calls = {
    requests: [], routeWrites: [], snapshots: [], favoritesUsers: [],
    windowScrolls: [], listScrolls: [], identityRequests: [], ticks: [], unsubscribe: 0,
  }
  const hooks = { mounted: [], unmounted: [], leave: [], watchers: [] }
  const route = { path: '/home', query: {} }
  let token = 'token-a', blockedTick = holdNextTick
  const values = new Map()
  const storage = {
    getItem(key) { return values.get(key) ?? null },
    setItem(key, value) { values.set(key, String(value)) },
  }
  if (snapshot) jobBrowse.saveBrowseSnapshot(snapshot.state, snapshot.scrollY, id, storage)
  const listeners = new Map()
  const browserWindow = {
    scrollY: 120,
    addEventListener(name, handler) { listeners.set(name, handler) },
    removeEventListener(name, handler) { if (listeners.get(name) === handler) listeners.delete(name) },
    scrollTo(options) { calls.windowScrolls.push(options) },
  }
  const modules = {
    vue: {
      ref, reactive, computed,
      watch(source, callback) { hooks.watchers.push({ source, callback }); return () => {} },
      onMounted(callback) { hooks.mounted.push(callback) },
      onUnmounted(callback) { hooks.unmounted.push(callback) },
      nextTick() {
        if (!blockedTick) return Promise.resolve()
        const tick = deferred()
        calls.ticks.push(tick)
        return tick.promise
      },
    },
    'vue-router': {
      useRoute: () => route,
      useRouter: () => ({
        replace(target) { calls.routeWrites.push(target); return Promise.resolve() },
      }),
      onBeforeRouteLeave(callback) { hooks.leave.push(callback) },
    },
    '@/components/UserNavbar.vue': { default: {} },
    '@/components/AppToast.vue': { default: {} },
    '@/components/JobCategoryIcon.vue': { default: {} },
    '@/components/PageJump.vue': { default: {} },
    '@/composables/useToast': { useToast: () => ({ success() {}, error() {} }) },
    '@/lib/api': {
      readToken: () => token,
      readJson(path) {
        const request = { path, ...deferred() }
        calls.requests.push(request)
        return request.promise
      },
    },
    '@/lib/auth': {
      readUser() {
        const request = deferred()
        calls.identityRequests.push(request)
        return request.promise
      },
    },
    '@/lib/jobRequirements.mjs': { formatCities },
    '@/lib/favorites': {
      readFavorites: () => [],
      setFavoritesUser(value) { calls.favoritesUsers.push(value) },
      subscribeFavorites() { return () => { calls.unsubscribe += 1 } },
      toggleFavorite: () => true,
    },
    '@/lib/jobBrowse.mjs': {
      ...jobBrowse,
      readBrowseSnapshot(owner) { return jobBrowse.readBrowseSnapshot(owner, storage) },
      saveBrowseSnapshot(state, scrollY, owner) {
        calls.snapshots.push({ state: jobBrowse.normalizeBrowseState(state), scrollY, owner })
        jobBrowse.saveBrowseSnapshot(state, scrollY, owner, storage)
      },
    },
  }
  const injected = compiled.replace(/import\s+([\s\S]*?)\s+from\s+(['"])([^'"]+)\2\s*;?/g, (_, binding, quote, specifier) => {
    assert.ok(Object.hasOwn(modules, specifier), `Missing dependency stub: ${specifier}`)
    const name = binding.trim()
    return name.startsWith('{')
      ? `const ${name.replace(/\bas\b/g, ':')} = __modules[${JSON.stringify(specifier)}];\n`
      : `const ${name} = __modules[${JSON.stringify(specifier)}].default;\n`
  }).replace('export default', 'return')
  const component = new Function('__modules', 'window', injected)(modules, browserWindow)
  const state = component.setup({}, { expose() {} })
  state.listStartRef.value = { scrollIntoView(options) { calls.listScrolls.push(options) } }
  return {
    state, calls, route, user, listeners,
    mount() { hooks.mounted.forEach(callback => callback()) },
    unmount() { hooks.unmounted.forEach(callback => callback()) },
    setToken(value) { token = value },
    holdTicks(value) { blockedTick = value },
  }
}

const listPage = (total = 1) => ({
  list: [{ id: 'job-a', positionName: '岗位 A', companyName: '单位 A', workCity: '上海' }],
  total,
})

test('late identity response after Home unmount cannot request jobs, adopt an account or replace the new route', async () => {
  const app = setup()
  app.mount()
  assert.equal(app.calls.identityRequests.length, 1)
  app.unmount()
  app.route.path = '/profile'
  app.route.query = { view: 'resume' }
  app.calls.identityRequests[0].resolve(app.user)
  await settle()
  assert.equal(app.calls.requests.length, 0)
  assert.equal(app.calls.routeWrites.length, 0)
  assert.equal(app.calls.snapshots.length, 0)
  assert.deepEqual(app.calls.favoritesUsers, [null])
  assert.equal(app.state.ready.value, false)
  assert.equal(app.calls.unsubscribe, 1)
  assert.equal(app.listeners.has('focus'), false)
  assert.deepEqual(app.route, { path: '/profile', query: { view: 'resume' } })
})

test('identity response requested with token A cannot attach its favorites after switching to token B', async () => {
  const app = setup()
  app.mount()
  app.setToken('token-b')
  app.calls.identityRequests[0].resolve(app.user)
  await settle()
  assert.deepEqual(app.calls.favoritesUsers, [null])
  assert.equal(app.calls.requests.length, 0)
  assert.equal(app.calls.routeWrites.length, 0)
  assert.equal(app.calls.snapshots.length, 0)
  assert.equal(app.state.ready.value, false)
  assert.equal(app.state.favoritesReady.value, false)
  assert.equal(app.state.loading.value, false)
  assert.match(app.state.loadError.value, /登录身份已变化/)
  app.unmount()
})

test('late list response after unmount leaves the new route, job state and scrolling untouched', async () => {
  const app = setup()
  app.mount()
  app.calls.identityRequests[0].resolve(app.user)
  await settle()
  assert.equal(app.calls.requests.length, 1)
  assert.match(app.calls.requests[0].path, /^\/job\/list\?/)
  const writes = app.calls.routeWrites.length, snapshots = app.calls.snapshots.length
  app.unmount()
  app.route.path = '/job/new-job'
  app.calls.requests[0].resolve(listPage())
  await settle()
  assert.equal(app.calls.requests.length, 1, 'unmounted Home must not start recommendation requests')
  assert.equal(app.calls.routeWrites.length, writes)
  assert.equal(app.calls.snapshots.length, snapshots)
  assert.deepEqual(app.state.jobs.value, [])
  assert.equal(app.state.total.value, 0)
  assert.equal(app.calls.windowScrolls.length, 0)
  assert.equal(app.calls.listScrolls.length, 0)
  assert.equal(app.route.path, '/job/new-job')
})

test('a nextTick completed after unmount cannot restore the old list scroll position', async () => {
  const app = setup({
    snapshot: { state: jobBrowse.normalizeBrowseState(), scrollY: 640 },
    holdNextTick: true,
  })
  app.mount()
  app.calls.identityRequests[0].resolve(app.user)
  await settle()
  app.calls.requests[0].resolve(listPage())
  await settle()
  assert.equal(app.calls.ticks.length, 1)
  assert.equal(app.state.jobs.value.length, 1)
  const writes = app.calls.routeWrites.length, snapshots = app.calls.snapshots.length
  app.unmount()
  app.route.path = '/profile'
  app.calls.ticks[0].resolve()
  await settle()
  assert.equal(app.calls.windowScrolls.length, 0)
  assert.equal(app.calls.listScrolls.length, 0)
  assert.equal(app.calls.routeWrites.length, writes)
  assert.equal(app.calls.snapshots.length, snapshots)
  assert.equal(app.calls.requests.length, 1)
})

test('a page-jump nextTick completed after unmount cannot scroll the new page to the old list', async () => {
  const app = setup()
  app.mount()
  app.calls.identityRequests[0].resolve(app.user)
  await settle()
  app.calls.requests[0].resolve(listPage(30))
  await settle()
  const recommendations = app.calls.requests.find(request => request.path.includes('recommended=true'))
  recommendations.resolve({ list: [], total: 0 })
  await settle()
  app.holdTicks(true)
  app.state.goPage(2)
  assert.equal(app.state.filters.page, 2)
  const pageRequest = app.calls.requests.at(-1)
  assert.equal(new URLSearchParams(pageRequest.path.split('?')[1]).get('page'), '2')
  pageRequest.resolve(listPage(30))
  await settle()
  assert.equal(app.calls.ticks.length, 1)
  app.unmount()
  app.route.path = '/profile'
  app.calls.ticks[0].resolve()
  await settle()
  assert.equal(app.calls.windowScrolls.length, 0)
  assert.equal(app.calls.listScrolls.length, 0)
})

test('a list 401 that clears the token ends loading and allows a new identity initialization', async () => {
  const app = setup()
  app.mount()
  app.calls.identityRequests[0].resolve(app.user)
  await settle()
  assert.equal(app.state.loading.value, true)
  app.setToken('')
  const unauthorized = Object.assign(new Error('登录已过期'), { code: 401 })
  app.calls.requests[0].reject(unauthorized)
  await settle()
  assert.equal(app.state.loading.value, false)
  assert.equal(app.state.ready.value, false)
  assert.equal(app.state.favoritesReady.value, false)
  assert.deepEqual(app.state.favoriteIds.value, [])
  assert.match(app.state.loadError.value, /登录身份已变化|登录已过期/)
  app.setToken('token-b')
  app.state.retryJobs()
  assert.equal(app.calls.identityRequests.length, 2, 'retry must reauthenticate instead of reusing the expired identity')
  const userB = { ...app.user, id: `${app.user.id}:b` }
  app.calls.identityRequests[1].resolve(userB)
  await settle()
  const retryRequest = app.calls.requests.at(-1)
  retryRequest.resolve(listPage())
  await settle()
  assert.equal(app.state.ready.value, true)
  assert.equal(app.state.favoritesReady.value, true)
  assert.equal(app.state.loading.value, false)
  assert.equal(app.state.loadError.value, '')
  assert.deepEqual(app.calls.favoritesUsers.filter(Boolean), [app.user, userB])
  app.unmount()
})
