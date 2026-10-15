import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import { ref, computed, reactive, watch, nextTick, effectScope } from 'vue'
import * as adminUsers from '../src/lib/adminUser.mjs'
import * as jobImport from '../src/lib/jobImport.mjs'
import * as jobRequirements from '../src/lib/jobRequirements.mjs'
import * as templates from '../src/lib/questionnaireTemplates.mjs'
import * as browse from '../src/lib/jobBrowse.mjs'
import * as filters from '../src/lib/adminJobFilters.mjs'
import { normalizeAdminJobFilters, buildAdminJobListParams } from '../src/lib/adminJobFilters.mjs'

test('empty admin filters request the first page without restricting job status', () => {
  assert.deepEqual(Object.fromEntries(buildAdminJobListParams({})), { page: '1', size: '20' })
})

test('admin filters combine the same region and category fields used by students', () => {
  assert.deepEqual(Object.fromEntries(buildAdminJobListParams({
    keyword: ' 编辑 ', province: '广东', city: '深圳', category: 'MEDIA', recruit: 'DAILY_INTERNSHIP', status: 'OFFLINE',
  }, 3)), {
    page: '3', size: '20', keyword: '编辑', workProvince: '广东', workCity: '深圳', jobCategory: 'MEDIA', recruitType: 'DAILY_INTERNSHIP', status: 'OFFLINE',
  })
})

test('recommended status preserves its existing published plus recommended query', () => {
  const recommended = buildAdminJobListParams({ status: 'RECOMMENDED', category: 'ENTERPRISE' })
  assert.equal(recommended.get('status'), 'PUBLISHED')
  assert.equal(recommended.get('recommended'), 'true')
  assert.equal(recommended.get('jobCategory'), 'ENTERPRISE')
  assert.equal(buildAdminJobListParams({ status: 'OFFLINE' }).has('recommended'), false)
})

test('invalid enums and a city from another province never reach the request', () => {
  assert.deepEqual(normalizeAdminJobFilters({ province: '广东', city: '杭州', category: 'unknown', recruit: 'unknown', status: 'unknown' }), {
    keyword: '', province: '广东', city: '', category: '', recruit: '', status: '',
  })
  assert.equal(buildAdminJobListParams({ province: 'unknown', city: '深圳' }).has('workCity'), false)
  for (const page of [0, -1, 1.5, NaN, true, '2']) assert.equal(buildAdminJobListParams({}, page).get('page'), '1')
})

test('query construction does not mutate filters and bounds keyword length', () => {
  const input = Object.freeze({ keyword: 'x'.repeat(250), province: '上海', city: '上海' })
  const result = buildAdminJobListParams(input)
  assert.equal(result.get('keyword').length, 200)
  assert.equal(input.keyword.length, 250)
})

const source = await readFile(new URL('../src/views/AdminView.vue', import.meta.url), 'utf8')
const descriptor = parse(source).descriptor
const compiled = compileScript(descriptor, { id: 'admin-filter-test' }).content
function setup() {
  const requests = [], errors = [], unmountHooks = []
  const modules = {
    vue: { ref, computed, reactive, watch, nextTick, onMounted() {}, onBeforeUnmount(fn) { unmountHooks.push(fn) } },
    '@/composables/useToast': { useToast: () => ({ error: message => errors.push(message), success() {}, warning() {} }) },
    '@/lib/auth': { logoutUser() {}, readUser: async () => null },
    '@/lib/api': { downloadFile() {}, uploadForm() {}, readJson(path, options) {
      return new Promise((resolve, reject) => requests.push({ path, options, resolve, reject }))
    } },
    '@/lib/adminUser.mjs': adminUsers,
    '@/lib/jobImport.mjs': jobImport,
    '@/lib/jobRequirements.mjs': jobRequirements,
    '@/lib/questionnaireTemplates.mjs': templates,
    '@/lib/jobBrowse.mjs': browse,
    '@/lib/adminJobFilters.mjs': filters,
  }
  const injected = compiled.replace(/import\s+([\s\S]*?)\s+from\s+(['"])([^'"]+)\2\s*;?/g, (_, binding, quote, specifier) => {
    if (specifier.endsWith('.vue')) return `const ${binding.trim()} = {};\n`
    assert.ok(Object.hasOwn(modules, specifier), `Unexpected dependency ${specifier}`)
    return `const ${binding.trim().replace(/\bas\b/g, ':')} = __modules[${JSON.stringify(specifier)}];\n`
  }).replaceAll('import.meta.env.BASE_URL', JSON.stringify('/')).replace('export default', 'return')
  const component = new Function('__modules', injected)(modules)
  const scope = effectScope()
  const state = scope.run(() => component.setup({}, { expose() {} }))
  return { state, requests, errors, unmount() { unmountHooks.forEach(fn => fn()); scope.stop() } }
}
const params = request => new URL(request.path, 'http://local').searchParams
const page = (id, totalPages = 3) => ({ list: [{ id, positionName: id, status: 'PUBLISHED' }], total: 41, totalPages })

test('admin template compiles with its script bindings', () => {
  assert.deepEqual(compileTemplate({ source: descriptor.template.content, filename: 'AdminView.vue', id: 'admin-filter-test' }).errors, [])
})

test('search applies combined filters and pagination preserves the submitted keyword', async () => {
  const app = setup(), s = app.state
  assert.ok(s.jobFilters, 'region and category filter state must exist')
  Object.assign(s.jobFilters, { province: '广东', city: '深圳', category: 'MEDIA', recruit: 'DAILY_INTERNSHIP' })
  s.sk.value = '编辑'; s.sf.value = 'RECOMMENDED'; s.jobPage.value = 3; s.selected.value = ['old']
  s.searchAdminJobs()
  assert.equal(params(app.requests[0]).get('page'), '1')
  assert.equal(params(app.requests[0]).get('workCity'), '深圳')
  assert.equal(params(app.requests[0]).get('jobCategory'), 'MEDIA')
  assert.equal(params(app.requests[0]).get('recommended'), 'true')
  assert.deepEqual(s.selected.value, [])
  app.requests[0].resolve(page('first')); await nextTick(); await new Promise(resolve => setImmediate(resolve))
  s.sk.value = '尚未搜索的文字'
  s.changeJobPage(2)
  assert.equal(params(app.requests[1]).get('page'), '2')
  assert.equal(params(app.requests[1]).get('keyword'), '编辑')
  assert.equal(params(app.requests[1]).get('workCity'), '深圳')
  app.requests[1].resolve(page('second')); await new Promise(resolve => setImmediate(resolve))
  assert.equal(s.jobTotal.value, 41)
  app.unmount()
})

test('province changes discard the previous city and reset clears every condition', async () => {
  const app = setup(), s = app.state
  assert.ok(s.jobFilters)
  Object.assign(s.jobFilters, { province: '广东', city: '深圳', category: 'MEDIA', recruit: 'DAILY_INTERNSHIP' })
  s.jobFilters.province = '浙江'; s.changeAdminProvince()
  assert.equal(s.jobFilters.city, '')
  assert.equal(params(app.requests[0]).get('workProvince'), '浙江')
  assert.equal(params(app.requests[0]).has('workCity'), false)
  app.requests[0].resolve(page('province')); await new Promise(resolve => setImmediate(resolve))
  s.sk.value = '编辑'; s.sf.value = 'OFFLINE'; s.selected.value = ['province']
  s.resetAdminJobFilters()
  assert.deepEqual(Object.fromEntries(params(app.requests[1])), { page: '1', size: '20' })
  assert.equal(s.sk.value, ''); assert.equal(s.sf.value, ''); assert.equal(s.jobFilters.category, '')
  assert.deepEqual(s.selected.value, [])
  app.requests[1].resolve(page('reset')); await new Promise(resolve => setImmediate(resolve))
  app.unmount()
})

test('late responses cannot replace current results or expose stale errors', async () => {
  const app = setup(), s = app.state
  assert.ok(s.jobsLoading)
  const old = s.loadJobs()
  s.sk.value = '新查询'; s.searchAdminJobs()
  app.requests[1].resolve(page('new')); await new Promise(resolve => setImmediate(resolve))
  app.requests[0].resolve(page('old', 1)); await old
  assert.equal(s.jobs.value[0].id, 'new')
  const staleFailure = s.loadJobs()
  s.searchAdminJobs(); app.requests[3].resolve(page('latest')); await new Promise(resolve => setImmediate(resolve))
  app.requests[2].reject(new Error('old error')); await staleFailure
  assert.equal(s.jobs.value[0].id, 'latest'); assert.equal(s.jobsLoading.value, false)
  assert.deepEqual(app.errors, [])
  app.unmount()
})

test('an out-of-range page retries the real last page with the same filters', async () => {
  const app = setup(), s = app.state
  assert.ok(s.jobFilters)
  s.jobFilters.category = 'MEDIA'; s.searchAdminJobs()
  app.requests[0].resolve(page('initial')); await new Promise(resolve => setImmediate(resolve))
  s.jobPage.value = 5; const pending = s.loadJobs()
  app.requests[1].resolve(page('out-of-range', 2)); await new Promise(resolve => setImmediate(resolve))
  assert.equal(params(app.requests[2]).get('page'), '2')
  assert.equal(params(app.requests[2]).get('jobCategory'), 'MEDIA')
  app.requests[2].resolve(page('last', 2)); await pending
  assert.equal(s.jobPage.value, 2); assert.equal(s.jobs.value[0].id, 'last')
  app.unmount()
})

test('loading clears stale rows and selection; failures remain retryable', async () => {
  const app = setup(), s = app.state
  assert.ok(s.jobsError)
  s.jobs.value = [{ id: 'old' }]; s.selected.value = ['old']
  const pending = s.loadJobs()
  assert.equal(s.jobsLoading.value, true); assert.deepEqual(s.jobs.value, []); assert.deepEqual(s.selected.value, [])
  app.requests[0].reject(new Error('服务暂不可用')); await pending
  assert.equal(s.jobsError.value, '服务暂不可用'); assert.equal(s.jobsLoading.value, false)
  const retry = s.loadJobs(); app.requests[1].resolve(page('retry')); await retry
  assert.equal(s.jobsError.value, ''); assert.equal(s.jobs.value[0].id, 'retry')
  app.unmount()
})

test('unmount invalidates a pending list response', async () => {
  const app = setup(), s = app.state
  const pending = s.loadJobs()
  app.unmount(); app.requests[0].resolve(page('late')); await pending
  assert.deepEqual(s.jobs.value, [])
})

test('publishing a filtered draft refreshes results and totals for the active conditions', async () => {
  const app = setup(), s = app.state
  s.sf.value = 'OFFLINE'; s.searchAdminJobs()
  app.requests[0].resolve({ list: [{ id: 'draft', status: 'OFFLINE' }], total: 1, totalPages: 1 })
  await new Promise(resolve => setImmediate(resolve))
  const publishing = s.publish(s.jobs.value[0])
  assert.equal(app.requests[1].options.method, 'PUT')
  app.requests[1].resolve(null); await new Promise(resolve => setImmediate(resolve))
  assert.equal(app.requests.length, 3)
  assert.equal(params(app.requests[2]).get('status'), 'OFFLINE')
  app.requests[2].resolve({ list: [], total: 0, totalPages: 1 }); await publishing
  assert.equal(s.jobs.value.length, 0); assert.equal(s.jobTotal.value, 0)
  app.unmount()
})

test('dropdown changes preserve the applied keyword until an explicit search', async () => {
  const app = setup(), s = app.state
  s.sk.value = '已搜索'; s.searchAdminJobs()
  app.requests[0].resolve(page('initial')); await new Promise(resolve => setImmediate(resolve))
  s.sk.value = '未搜索'; s.jobFilters.province = '上海'; s.changeAdminProvince()
  assert.equal(params(app.requests[1]).get('keyword'), '已搜索')
  assert.equal(params(app.requests[1]).get('workProvince'), '上海')
  app.requests[1].resolve(page('province')); await new Promise(resolve => setImmediate(resolve))
  s.jobFilters.category = 'MEDIA'; s.changeAdminJobFilters()
  assert.equal(params(app.requests[2]).get('keyword'), '已搜索')
  app.requests[2].resolve(page('category')); await new Promise(resolve => setImmediate(resolve))
  s.searchAdminJobs()
  assert.equal(params(app.requests[3]).get('keyword'), '未搜索')
  app.requests[3].resolve(page('searched')); await new Promise(resolve => setImmediate(resolve))
  app.unmount()
})

test('partially failed batch updates wait for all writes and refresh active filter totals', async () => {
  const app = setup(), s = app.state
  s.sf.value = 'OFFLINE'; s.searchAdminJobs()
  app.requests[0].resolve({ list: [{ id: 'a', status: 'OFFLINE' }, { id: 'b', status: 'OFFLINE' }], total: 2, totalPages: 1 })
  await new Promise(resolve => setImmediate(resolve))
  s.selected.value = ['a', 'b']
  const pending = s.bulkPublish()
  app.requests[2].reject(new Error('second write failed'))
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(app.requests.length, 3, 'do not refresh before the remaining write completes')
  app.requests[1].resolve(null); await new Promise(resolve => setImmediate(resolve))
  assert.equal(app.requests.length, 4)
  assert.equal(params(app.requests[3]).get('status'), 'OFFLINE')
  app.requests[3].resolve({ list: [{ id: 'b', status: 'OFFLINE' }], total: 1, totalPages: 1 })
  await pending
  assert.equal(s.jobTotal.value, 1); assert.deepEqual(s.selected.value, [])
  assert.match(app.errors[0], /1 条成功.*1 条失败/)
  app.unmount()
})
