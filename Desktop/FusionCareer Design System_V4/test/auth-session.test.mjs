import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const authSource = await readFile(new URL('../src/lib/auth.js', import.meta.url), 'utf8')
const apiSource = await readFile(new URL('../src/lib/api.js', import.meta.url), 'utf8')
let moduleId = 0
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}#${moduleId++}`

async function authHarness(t) {
  const key = `__authTest${moduleId++}`
  const harness = { token: 'token-a', requests: [] }
  globalThis[key] = harness
  t.after(() => delete globalThis[key])
  const dependencies = moduleUrl(`
    const harness = globalThis[${JSON.stringify(key)}];
    export const readToken = () => harness.token;
    export const saveToken = token => { harness.token = token; };
    export const deleteToken = () => { harness.token = ''; };
    export const readJson = () => new Promise((resolve, reject) => harness.requests.push({ resolve, reject }));
  `)
  const executable = authSource.replace("'@/lib/api'", JSON.stringify(dependencies))
    .replaceAll('import.meta.env.DEV', 'false')
  return { harness, auth: await import(moduleUrl(executable)) }
}

test('a late identity response cannot populate the cache for a new token', async t => {
  const { harness, auth } = await authHarness(t)
  const first = auth.readUser(true)
  const rejected = assert.rejects(first, /登录身份已变化/)
  harness.token = 'token-b'
  harness.requests[0].resolve({ id: 'student-a' })
  await rejected
  const second = auth.readUser()
  assert.equal(harness.requests.length, 2)
  harness.requests[1].resolve({ id: 'student-b' })
  assert.equal((await second).id, 'student-b')
  assert.equal((await auth.readUser()).id, 'student-b')
  assert.equal(harness.requests.length, 2)
})

test('identity cache only applies to its original token and is cleared on sign-out', async t => {
  const { harness, auth } = await authHarness(t)
  const first = auth.readUser()
  harness.requests[0].resolve({ id: 'student-a' })
  await first
  harness.token = 'token-b'
  const second = auth.readUser()
  harness.requests[1].resolve({ id: 'student-b' })
  assert.equal((await second).id, 'student-b')
  harness.token = ''
  assert.equal(await auth.readUser(), null)
  harness.token = 'token-b'
  const third = auth.readUser()
  assert.equal(harness.requests.length, 3)
  harness.requests[2].resolve({ id: 'student-b' })
  await third
})

async function apiHarness(t) {
  const key = `__apiTest${moduleId++}`
  const harness = { token: 'token-a', requests: [] }
  globalThis[key] = harness
  t.after(() => delete globalThis[key])
  const executable = `
    const harness = globalThis[${JSON.stringify(key)}];
    const localStorage = {
      getItem: () => harness.token,
      setItem: (_, token) => { harness.token = token; },
      removeItem: () => { harness.token = ''; }
    };
    const fetch = (url, options) => new Promise(resolve => harness.requests.push({ url, options, resolve }));
    ${apiSource.replace('import.meta.env.VITE_API_BASE', 'undefined')}
  `
  return { harness, api: await import(moduleUrl(executable)) }
}

for (const status of [200, 409]) {
  test(`readJson preserves a template-name conflict code from an HTTP ${status} response`, async t => {
    const { harness, api } = await apiHarness(t)
    const pending = api.readJson('/admin/questionnaire/templates', { method: 'POST', body: '{}' })
    const rejected = assert.rejects(pending, error => error.code === 409 && /名称已存在/.test(error.message))
    harness.requests[0].resolve(new Response(JSON.stringify({
      code: 409, message: '模板名称已存在，请更换名称', data: null,
    }), { status }))
    await rejected
    assert.equal(harness.token, 'token-a')
  })
}

for (const status of [200, 400]) {
  test(`readJson preserves raw validation reasons separately from fallback messages for HTTP ${status}`, async t => {
    for (const message of ['模板题目过多', '', '   ', undefined, null]) {
      const { harness, api } = await apiHarness(t)
      const pending = api.readJson('/admin/questionnaire/templates', { method: 'POST', body: '{}' })
      const rejected = assert.rejects(pending, error => error.code === 400
        && error.serverMessage === (typeof message === 'string' ? message : ''))
      harness.requests[0].resolve(new Response(JSON.stringify({ code: 400, message, data: null }), { status }))
      await rejected
      assert.equal(harness.token, 'token-a')
    }
  })
}

for (const method of ['requestApi', 'downloadFile']) {
  test(`${method} preserves a new token when an old request returns 401`, async t => {
    const { harness, api } = await apiHarness(t)
    const pending = api[method]('/test')
    const rejected = assert.rejects(pending, /未登录/)
    assert.equal(harness.requests[0].options.headers.get('Fusion-Token'), 'token-a')
    harness.token = 'token-b'
    harness.requests[0].resolve(new Response(JSON.stringify({ code: 401 }), { status: 401 }))
    await rejected
    assert.equal(harness.token, 'token-b')
  })

  test(`${method} clears an expired token belonging to the current request`, async t => {
    const { harness, api } = await apiHarness(t)
    const pending = api[method]('/test')
    const rejected = assert.rejects(pending, /未登录/)
    harness.requests[0].resolve(new Response(JSON.stringify({ code: 401 }), { status: 401 }))
    await rejected
    assert.equal(harness.token, '')
  })
}
