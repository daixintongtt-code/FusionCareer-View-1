import test from 'node:test'
import assert from 'node:assert/strict'
import { splitResumeParagraphs, isResumeExperienceField } from '../src/lib/resumeText.mjs'
import { readFile } from 'node:fs/promises'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import { ref, computed } from 'vue'

test('resume reading separates lines into ordered paragraphs', () => {
  assert.deepEqual(splitResumeParagraphs('甲公司｜实习生\n负责选题与采访\n乙公司｜实习生'), [
    '甲公司｜实习生', '负责选题与采访', '乙公司｜实习生',
  ])
})

test('resume reading handles Windows and older carriage-return line endings', () => {
  assert.deepEqual(splitResumeParagraphs('经历一\r\n职责一\r经历二\n职责二'), ['经历一', '职责一', '经历二', '职责二'])
})

test('resume reading skips blank lines and empty values', () => {
  assert.deepEqual(splitResumeParagraphs(' \n\t\r\n经历一\n  \n经历二\n'), ['经历一', '经历二'])
  for (const value of ['', ' \r\n\t ', null, undefined]) assert.deepEqual(splitResumeParagraphs(value), [])
})

test('resume reading preserves internal text, order and repeated lines', () => {
  assert.deepEqual(splitResumeParagraphs('  负责 A  和 B  \n相同内容\n相同内容'), ['负责 A  和 B', '相同内容', '相同内容'])
})

test('resume reading does not guess experience boundaries in unseparated text', () => {
  const original = '2025.07—2025.09 甲公司 实习 负责内容。2026.01—2026.03 乙公司 实习 负责项目。'
  assert.deepEqual(splitResumeParagraphs(original), [original])
})

test('resume reading leaves markup, URLs and literal escape sequences as plain text', () => {
  const original = '<img src=x onerror=alert(1)> https://example.test/a?b=1&c=2 C:\\new\\notes \\n'
  assert.deepEqual(splitResumeParagraphs(original), [original])
})

test('AI experience entries retain internal lines and split at blank lines', () => {
  const value = '甲公司 | 实习生 | 2026.01\r\n负责内容整理\r\n完成活动复盘\r\n \t\r\n乙公司 | 实习生 | 2025.07\r职责二'
  for (const field of ['internship', 'campus', 'education']) {
    assert.equal(isResumeExperienceField(field), true)
    assert.deepEqual(splitResumeParagraphs(value, field), ['甲公司 | 实习生 | 2026.01\n负责内容整理\n完成活动复盘', '乙公司 | 实习生 | 2025.07\n职责二'])
  }
  assert.equal(isResumeExperienceField('skills'), false)
  assert.deepEqual(splitResumeParagraphs('技能一\n技能二', 'skills'), ['技能一', '技能二'])
})

const componentSource = await readFile(new URL('../src/views/ProfileView.vue', import.meta.url), 'utf8')
const { descriptor } = parse(componentSource, { filename: 'ProfileView.vue' })
const compiled = compileScript(descriptor, { id: 'resume-text-tests' })
let harnessNumber = 0

test('profile resume template compiles with its real script bindings', () => {
  const template = compileTemplate({ source: descriptor.template.content, filename: 'ProfileView.vue', id: 'resume-text-tests', compilerOptions: { bindingMetadata: compiled.bindings } })
  assert.deepEqual(template.errors, [])
})

async function setupProfile(t, resume = {}) {
  const key = `__resumeTextTest${harnessNumber++}`
  const harness = {
    resume, requests: [], saveFailure: false, errors: [], successes: [],
    ref, computed, splitResumeParagraphs, isResumeExperienceField, watch() {}, onMounted() {}, onBeforeUnmount() {},
    useRoute: () => ({ query: { tab: 'resume' } }), useRouter: () => ({ push() {} }),
    useToast: () => ({ success(message) { harness.successes.push(message) }, error(message) { harness.errors.push(message) } }),
    readUser: async () => ({ id: 2, role: 'NORMAL', studentId: 'demo' }), readToken: () => 'local-demo-NORMAL',
    readJson: async (path, options) => {
      harness.requests.push({ path, options })
      if (path === '/user/resume/get') {
        if (harness.resumeReadFailure) throw new Error(harness.resumeReadFailure)
        return harness.resume
      }
      if (path === '/user/resume/save' && harness.saveFailure) throw new Error('保存暂时失败')
      if (path === '/user/resume/save' && harness.saveRequest) return harness.saveRequest()
      if (path.endsWith('/parse')) {
        if (harness.parseFailure) throw new Error(harness.parseFailure)
        return harness.parseRequest ? harness.parseRequest() : { parseStatus: 'SUCCESS' }
      }
      if (path === '/user/resume/file/list') return []
      return {}
    },
    uploadForm: async (path, body) => {
      harness.requests.push({ path, options: { method: 'POST', body } })
      return { parseStatus: 'SUCCESS', updatedResumeFields: ['internship', 'campus'] }
    },
    parsePreferenceList: () => [],
  }
  globalThis[key] = harness
  t.after(() => { delete globalThis[key] })
  const namesBySource = new Map()
  for (const item of Object.values(compiled.imports)) {
    const names = namesBySource.get(item.source) || new Set()
    names.add(item.imported)
    namesBySource.set(item.source, names)
  }
  const modules = new Map([...namesBySource].map(([source, names]) => {
    const exports = [...names].filter(name => name !== 'default').map(name => `export const ${name} = harness[${JSON.stringify(name)}] ?? (() => {});`)
    const stub = `const harness = globalThis[${JSON.stringify(key)}]; export default {}; ${exports.join('\n')}`
    return [source, `data:text/javascript;base64,${Buffer.from(stub).toString('base64')}`]
  }))
  const executable = compiled.content.replace(/from\s+(['"])([^'"]+)\1/g, (_, quote, source) => `from ${quote}${modules.get(source)}${quote}`)
  const component = await import(`data:text/javascript;base64,${Buffer.from(executable).toString('base64')}#${key}`)
  return { harness, state: component.default.setup({}, { expose() {} }) }
}

test('profile starts in reading mode and derives separate resume paragraphs', async t => {
  const { state } = await setupProfile(t, { internship: '经历一\n职责一\n\n经历二', campus: '' })
  await state.loadResume()
  assert.equal(state.resumeEditing.value, false)
  assert.equal(state.resumeSections.value.length, 9)
  assert.deepEqual(state.resumeSections.value.find(item => item.key === 'internship').paragraphs, ['经历一\n职责一', '经历二'])
  assert.equal(state.resumeSections.value.find(item => item.key === 'internship').experience, true)
  assert.deepEqual(state.resumeSections.value.find(item => item.key === 'campus').paragraphs, [])
})

test('switching reading and editing preserves unsaved text without saving it', async t => {
  const { state, harness } = await setupProfile(t, { internship: '旧内容' })
  await state.loadResume()
  state.resumeEditing.value = true
  state.resumeForm.value.internship = ' 新经历 \r\n新职责'
  state.resumeEditing.value = false
  assert.deepEqual(state.resumeSections.value.find(item => item.key === 'internship').paragraphs, ['新经历 \n新职责'])
  state.resumeEditing.value = true
  assert.equal(state.resumeForm.value.internship, ' 新经历 \r\n新职责')
  assert.equal(harness.requests.some(request => request.path === '/user/resume/save'), false)
})

test('saving preserves original line endings and every raw resume field', async t => {
  const original = { internship: ' 甲公司 \r\n职责\r\n\r\n乙公司 ', campus: '校园一\r校园二', skills: 'C:\\new\\notes \\n' }
  const { state, harness } = await setupProfile(t, original)
  await state.loadResume()
  const before = { ...state.resumeForm.value }
  void state.resumeSections.value
  await state.saveResume()
  const saved = harness.requests.find(request => request.path === '/user/resume/save')
  assert.equal(saved.options.method, 'PUT')
  assert.deepEqual(JSON.parse(saved.options.body), before)
  for (const [key, value] of Object.entries(original)) assert.equal(state.resumeForm.value[key], value)
})

test('a save failure keeps editing content available for a successful retry', async t => {
  const { state, harness } = await setupProfile(t, { campus: '原内容' })
  await state.loadResume()
  state.resumeEditing.value = true
  state.resumeForm.value.campus = '新经历\n新职责'
  harness.saveFailure = true
  await state.saveResume()
  assert.equal(state.resumeEditing.value, true)
  assert.equal(state.resumeForm.value.campus, '新经历\n新职责')
  assert.deepEqual(harness.errors, ['保存暂时失败'])
  harness.saveFailure = false
  await state.saveResume()
  assert.equal(harness.successes.at(-1), '简历正文已保存')
})

test('successful upload refreshes reading paragraphs from the returned resume', async t => {
  const { state, harness } = await setupProfile(t, { internship: '旧经历' })
  await state.loadResume()
  state.resumeEditing.value = true
  harness.resume = { internship: '新实习一\n职责一\n\n新实习二\n职责二', campus: '新校园经历' }
  const event = { target: { files: [new File(['local test fixture'], 'layout.pdf', { type: 'application/pdf' })], value: 'layout.pdf' } }
  await state.uploadFile(event)
  assert.equal(state.resumeEditing.value, false)
  assert.deepEqual(state.resumeSections.value.find(item => item.key === 'internship').paragraphs, ['新实习一\n职责一', '新实习二\n职责二'])
  assert.equal(state.resumeForm.value.campus, '新校园经历')
  assert.equal(state.uploadingFile.value, false)
  assert.equal(event.target.value, '')
})

test('an existing resume file can reuse AI parsing and refresh complete experience blocks', async t => {
  const { state, harness } = await setupProfile(t, { internship: '旧的未分段内容' })
  await state.loadResume()
  state.resumeEditing.value = true
  harness.resume = { internship: '甲公司 | 岗位 | 时间\n职责一\n\n乙公司 | 岗位 | 时间\n职责二' }
  await state.retryFile({ id: 'file-a' })
  assert.equal(harness.requests.filter(request => request.path === '/user/resume/file/file-a/parse').length, 1)
  assert.equal(harness.requests.find(request => request.path.endsWith('/parse')).options.method, 'POST')
  assert.equal(state.resumeEditing.value, false)
  assert.deepEqual(state.resumeSections.value.find(item => item.key === 'internship').paragraphs, ['甲公司 | 岗位 | 时间\n职责一', '乙公司 | 岗位 | 时间\n职责二'])
  assert.equal(state.parsingFileId.value, null)
})

test('failed AI reparsing preserves the current resume and allows a retry', async t => {
  const { state, harness } = await setupProfile(t, { internship: '原始经历\n原始职责' })
  await state.loadResume()
  state.resumeEditing.value = true
  harness.parseFailure = '解析暂时不可用'
  await state.retryFile({ id: 'file-a' })
  assert.equal(state.resumeForm.value.internship, '原始经历\n原始职责')
  assert.equal(state.resumeEditing.value, true)
  assert.equal(state.failedFileId.value, 'file-a')
  assert.equal(state.resumeBusy.value, false)
  assert.deepEqual(harness.errors, ['解析暂时不可用'])
  harness.parseFailure = ''
  await state.retryFile({ id: 'file-a' })
  assert.equal(state.failedFileId.value, null)
})

test('AI reparsing excludes duplicate parsing, uploads and saves until it finishes', async t => {
  const { state, harness } = await setupProfile(t, { internship: '原内容' })
  await state.loadResume()
  let finish
  harness.parseRequest = () => new Promise(resolve => { finish = resolve })
  const parsing = state.retryFile({ id: 'file-a' })
  assert.equal(state.parsingFileId.value, 'file-a')
  assert.equal(state.resumeBusy.value, true)
  await state.retryFile({ id: 'file-a' })
  await state.saveResume()
  await state.uploadFile({ target: { files: [new File(['fixture'], 'demo.pdf')], value: 'demo.pdf' } })
  assert.equal(harness.requests.filter(request => request.path.endsWith('/parse')).length, 1)
  assert.equal(harness.requests.some(request => ['/user/resume/save', '/user/resume/file/upload'].includes(request.path)), false)
  finish({ parseStatus: 'SUCCESS' })
  await parsing
  assert.equal(state.resumeBusy.value, false)
})

test('a pending save excludes AI reparsing and releases the busy state afterwards', async t => {
  const { state, harness } = await setupProfile(t)
  await state.loadResume()
  let finish
  harness.saveRequest = () => new Promise(resolve => { finish = resolve })
  const saving = state.saveResume()
  assert.equal(state.savingResume.value, true)
  await state.retryFile({ id: 'file-a' })
  assert.equal(harness.requests.some(request => request.path.endsWith('/parse')), false)
  finish({})
  await saving
  assert.equal(state.resumeBusy.value, false)
})

test('completed parsing with a failed refresh locks old text until a GET-only retry succeeds', async t => {
  const { state, harness } = await setupProfile(t, { internship: '原有正文' })
  await state.loadResume()
  state.resumeEditing.value = true
  harness.resumeReadFailure = '读取正文暂时失败'
  await state.retryFile({ id: 'file-a' })
  assert.equal(state.resumeForm.value.internship, '原有正文')
  assert.equal(state.resumeEditing.value, true)
  assert.equal(state.resumeBusy.value, false)
  assert.equal(state.resumeLocked.value, true)
  assert.equal(harness.successes.length, 0)
  assert.equal(harness.errors.at(-1), 'AI 解析已完成，请点击“重新加载正文”获取结果。')
  const requestCount = harness.requests.length
  await state.saveResume()
  await state.retryFile({ id: 'file-a' })
  await state.uploadFile({ target: { files: [new File(['fixture'], 'demo.pdf')], value: 'demo.pdf' } })
  assert.equal(harness.requests.length, requestCount)
  harness.resumeReadFailure = ''
  harness.resume = { internship: 'AI 新经历\n新职责\n\nAI 另一段经历' }
  await state.reloadResume()
  assert.deepEqual(harness.requests.slice(requestCount).map(request => request.path), ['/user/resume/get'])
  assert.equal(state.resumeLocked.value, false)
  assert.equal(state.resumeEditing.value, false)
  await state.saveResume()
  assert.equal(JSON.parse(harness.requests.at(-1).options.body).internship, harness.resume.internship)
})

test('an initial resume read failure cannot save an empty form over existing server text', async t => {
  const { state, harness } = await setupProfile(t)
  await state.saveResume()
  assert.equal(harness.requests.length, 0)
  harness.resumeReadFailure = '读取失败'
  assert.equal(await state.loadResume(), false)
  await state.saveResume()
  assert.equal(state.resumeRefreshRequired.value, true)
  assert.equal(harness.requests.some(request => request.path === '/user/resume/save'), false)
  await state.reloadResume()
  assert.equal(state.resumeLocked.value, true)
  harness.resumeReadFailure = ''
  await state.reloadResume()
  assert.equal(state.resumeLocked.value, false)
})

test('a successful upload with a failed refresh also blocks saving stale text', async t => {
  const { state, harness } = await setupProfile(t, { internship: '旧正文' })
  await state.loadResume()
  harness.resumeReadFailure = '读取失败'
  await state.uploadFile({ target: { files: [new File(['fixture'], 'demo.pdf')], value: 'demo.pdf' } })
  assert.equal(state.resumeForm.value.internship, '旧正文')
  assert.equal(state.resumeLocked.value, true)
  await state.saveResume()
  assert.equal(harness.requests.some(request => request.path === '/user/resume/save'), false)
})
