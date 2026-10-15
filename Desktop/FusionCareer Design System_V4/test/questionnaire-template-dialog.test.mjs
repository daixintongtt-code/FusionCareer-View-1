import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import * as vue from 'vue'
import { ref, computed, reactive, watch, nextTick, effectScope, proxyRefs, createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'
import * as templates from '../src/lib/questionnaireTemplates.mjs'

const source = await readFile(new URL('../src/components/QuestionnaireTemplates.vue', import.meta.url), 'utf8').catch(() => null)
const descriptor = source ? parse(source).descriptor : null
const script = descriptor ? compileScript(descriptor, { id: 'template-dialog-test' }) : null
const compiled = script?.content
const template = descriptor ? compileTemplate({ source: descriptor.template.content, filename: 'QuestionnaireTemplates.vue', id: 'template-dialog-test', compilerOptions: { bindingMetadata: script.bindings } }) : null
const render = template ? new Function('__vue', template.code.replace(/import\s+\{([^}]+)\}\s+from\s+["']vue["']/g, (_, bindings) => `const {${bindings.replace(/\bas\b/g, ':')}} = __vue`).replace('export function render', 'return function render'))(vue) : null

async function html(app) {
  const context = {}
  const toolbar = await renderToString(createSSRApp({ render: () => render({}, [], app.props, proxyRefs(app.state), {}, {}) }), context)
  return toolbar + (context.teleports?.body || '')
}

function deferred() {
  let resolve, reject
  const promise = new Promise((accept, fail) => { resolve = accept; reject = fail })
  return { promise, resolve, reject }
}

async function settle() {
  for (let index = 0; index < 12; index += 1) await Promise.resolve()
  await nextTick()
}

const question = (title = '可到岗时间') => ({ title, questionType: 'TEXT', options: [], required: true, placeholder: '例如：下周' })
const list = [{ id: 'a', name: '实习申请', questionCount: 1 }, { id: 'b', name: '校招申请', questionCount: 1 }]
const detail = (id = 'a') => ({ id, name: id === 'a' ? '实习申请' : '校招申请', questions: [question(`题目 ${id}`)] })

let fixtureId = 0
function setup(initial = {}) {
  assert.ok(compiled, 'QuestionnaireTemplates component must exist')
  const requests = [], emissions = [], hooks = []
  let returnFocusCount = 0
  const trigger = { isConnected: true, focus() { returnFocusCount += 1 } }
  const browserDocument = { activeElement: trigger }
  const props = reactive({ questions: [], editingId: null, job: {}, ...initial })
  const modules = {
    vue: {
      ref, computed, watch, nextTick,
      getCurrentInstance: () => ({ uid: fixtureId++ }),
      onBeforeUnmount(callback) { hooks.push(callback) },
    },
    '@/lib/api': {
      readJson(path, options) {
        const request = { path, options, ...deferred() }
        requests.push(request)
        return request.promise
      },
    },
    '@/lib/questionnaireTemplates.mjs': templates,
  }
  const injected = compiled.replace(/import\s+([\s\S]*?)\s+from\s+(['"])([^'"]+)\2\s*;?/g, (_, binding, quote, specifier) => {
    assert.ok(Object.hasOwn(modules, specifier), `Missing dependency stub: ${specifier}`)
    return `const ${binding.trim().replace(/\bas\b/g, ':')} = __modules[${JSON.stringify(specifier)}];\n`
  }).replace('export default', 'return')
  const component = new Function('__modules', 'document', injected)(modules, browserDocument)
  const scope = effectScope()
  const state = scope.run(() => component.setup(props, { expose() {}, emit(...args) { emissions.push(args) } }))
  return {
    state, requests, emissions, props, browserDocument, trigger,
    returnFocusCount: () => returnFocusCount,
    unmount() { hooks.forEach(callback => callback()); scope.stop() },
  }
}

async function preview(app, id = 'a') {
  app.state.openChooser()
  app.requests.at(-1).resolve(list)
  await settle()
  app.state.selectTemplate(id)
  app.requests.at(-1).resolve(detail(id))
  await settle()
}

test('component template compiles with its script bindings', () => {
  assert.ok(descriptor, 'QuestionnaireTemplates component must exist')
  const result = compileTemplate({ source: descriptor.template.content, filename: 'QuestionnaireTemplates.vue', id: 'template-dialog-test' })
  assert.deepEqual(result.errors, [])
})

test('an empty questionnaire applies only the selected definition copy', async () => {
  const app = setup()
  await preview(app)
  const selected = app.state.selectedDetail.value
  assert.equal(app.state.selectedDetail.value.questions[0].title, '题目 a')
  app.state.applySelected()
  assert.equal(app.state.mode.value, null)
  assert.equal(app.emissions.length, 1)
  assert.equal(app.emissions[0][0], 'apply')
  assert.deepEqual(app.emissions[0][1], templates.cloneTemplateQuestions(detail().questions))
  assert.notEqual(app.emissions[0][1][0], selected.questions[0])
  assert.notEqual(app.emissions[0][1][0].options, selected.questions[0].options)
  assert.equal(app.requests.length, 2, 'applying must not write a job or questionnaire to the server')
  app.unmount()
})

test('replacement cancellation preserves current questions and confirmation emits once', async () => {
  const current = [question('原题目')]
  const app = setup({ questions: current })
  await preview(app)
  app.state.applySelected()
  assert.equal(app.state.replacementPending.value, true)
  assert.deepEqual(app.emissions, [])
  app.state.cancelReplacement()
  assert.equal(app.state.replacementPending.value, false)
  assert.equal(app.props.questions[0].title, '原题目')
  app.state.applySelected()
  app.state.confirmReplacement()
  app.state.confirmReplacement()
  assert.equal(app.emissions.length, 1)
  assert.equal(app.props.questions[0].title, '原题目', 'parent owns question replacement')
  app.unmount()
})

test('published or uncertain existing jobs cannot open apply, but valid questions remain saveable', () => {
  for (const job of [{ status: 'PUBLISHED', applicationCount: 0 }, { status: 'OFFLINE' }, { status: 'OFFLINE', applicationCount: 1 }]) {
    const app = setup({ editingId: 'job-a', job, questions: [question()] })
    assert.equal(app.state.canApply.value, false)
    assert.ok(app.state.applyDisabledReason.value)
    app.state.openChooser()
    assert.equal(app.state.mode.value, null)
    app.state.openSave()
    assert.equal(app.state.mode.value, 'save')
    app.unmount()
  }
  const draft = setup({ editingId: 'draft', job: { status: 'OFFLINE', applicationCount: 0 } })
  assert.equal(draft.state.canApply.value, true)
  draft.unmount()
})

test('save snapshots definitions and only reports success after server confirmation', async () => {
  const app = setup({ questions: [{ ...question(), id: 777, answer: 'private', jobId: 10 }] })
  app.state.openSave()
  app.state.templateName.value = '  我的申请表  '
  const saving = app.state.saveTemplate()
  assert.equal(app.state.saving.value, true)
  assert.equal(app.state.notice.value, '')
  const request = app.requests[0]
  assert.equal(request.options.method, 'POST')
  const payload = JSON.parse(request.options.body)
  assert.equal(payload.name, '我的申请表')
  assert.equal(Object.hasOwn(payload.questions[0], 'id'), false)
  assert.equal(Object.hasOwn(payload.questions[0], 'answer'), false)
  await app.state.saveTemplate()
  assert.equal(app.requests.length, 1, 'pending save cannot be submitted twice')
  request.resolve({ id: 'saved', ...payload })
  await saving
  assert.equal(app.state.mode.value, null)
  assert.match(app.state.notice.value, /已保存/)
  assert.deepEqual(app.emissions, [])
  app.unmount()
})

test('save errors remain visible and require an explicit retry after checking uncertain result', async () => {
  const app = setup({ questions: [question()] })
  app.state.openSave()
  app.state.templateName.value = '申请表'
  const pending = app.state.saveTemplate()
  app.requests[0].reject(new Error('network error'))
  await pending
  assert.equal(app.state.mode.value, 'save')
  assert.equal(app.state.saving.value, false)
  assert.equal(app.state.notice.value, '')
  assert.match(app.state.saveError.value, /未确认/)
  assert.match(app.state.saveError.value, /核对/)
  assert.equal(app.requests.length, 1)
  app.state.inspectAfterSaveFailure()
  assert.equal(app.state.mode.value, 'choose')
  assert.equal(app.requests.length, 2)
  app.requests[1].resolve([])
  await settle()
  assert.deepEqual(app.state.templateList.value, [])
  app.unmount()
})

test('server validation failures show their message and preserve the editable template', async () => {
  const app = setup({ questions: [question()] })
  app.state.openSave()
  app.state.templateName.value = '申请表'
  const pending = app.state.saveTemplate()
  const message = '模板最多允许 50 道题目，请减少题目后重试。'
  app.requests[0].reject(Object.assign(new Error(message), { code: 400 }))
  await pending
  assert.equal(app.state.saveError.value, message)
  assert.equal(app.state.mode.value, 'save')
  assert.equal(app.state.saving.value, false)
  assert.equal(app.state.templateName.value, '申请表')
  assert.deepEqual(app.state.saveSnapshot.value, templates.cloneTemplateQuestions([question()]))
  assert.equal(app.state.notice.value, '')
  assert.equal(app.requests.length, 1)
  assert.ok((await html(app)).includes(message))
  app.unmount()
})

test('validation failures without a usable message still explain that the template was rejected', async () => {
  for (const message of ['', '   ']) {
    const app = setup({ questions: [question()] })
    app.state.openSave()
    app.state.templateName.value = '申请表'
    const pending = app.state.saveTemplate()
    app.requests[0].reject(Object.assign(new Error(message), { code: 400 }))
    await pending
    assert.equal(app.state.saveError.value, '模板内容不符合要求，请检查后重新保存。')
    assert.doesNotMatch(app.state.saveError.value, /未确认/)
    assert.equal(app.state.mode.value, 'save')
    app.unmount()
  }
})

test('invalid and overlong names cannot create templates and Unicode length is counted correctly', async () => {
  const invalid = setup({ questions: [question('')] })
  assert.ok(invalid.state.saveDisabledReason.value)
  invalid.state.openSave()
  assert.equal(invalid.state.mode.value, null)
  invalid.unmount()
  const app = setup({ questions: [question()] })
  app.state.openSave()
  for (const name of ['   ', '名'.repeat(81)]) {
    app.state.templateName.value = name
    await app.state.saveTemplate()
    assert.equal(app.requests.length, 0)
    assert.ok(app.state.saveError.value)
  }
  app.state.templateName.value = '😀'.repeat(80)
  const pending = app.state.saveTemplate()
  assert.equal(app.requests.length, 1)
  app.requests[0].resolve({ id: 'unicode', ...JSON.parse(app.requests[0].options.body) })
  await pending
  assert.match(app.state.notice.value, /已保存/)
  app.unmount()
})

test('list failures support retry and empty server lists stay empty', async () => {
  const app = setup()
  app.state.openChooser()
  app.requests[0].reject(new Error('服务暂时不可用'))
  await settle()
  assert.match(app.state.listError.value, /加载失败/)
  assert.equal(app.state.listLoading.value, false)
  app.state.loadList()
  app.requests[1].resolve([])
  await settle()
  assert.equal(app.state.listError.value, '')
  assert.deepEqual(app.state.templateList.value, [])
  app.unmount()
})

test('rapid selection ignores earlier detail replies and detail failures can be retried', async () => {
  const app = setup()
  app.state.openChooser()
  app.requests[0].resolve(list)
  await settle()
  app.state.selectTemplate('a')
  const early = app.requests.at(-1)
  app.state.selectTemplate('b')
  const latest = app.requests.at(-1)
  early.resolve(detail('a'))
  await settle()
  assert.equal(app.state.selectedDetail.value, null)
  assert.equal(app.state.detailLoading.value, true)
  latest.reject(new Error('稍后再试'))
  await settle()
  assert.match(app.state.detailError.value, /加载失败/)
  app.state.selectTemplate('b')
  app.requests.at(-1).resolve(detail('b'))
  await settle()
  assert.equal(app.state.selectedDetail.value.id, 'b')
  assert.equal(app.state.detailError.value, '')
  app.unmount()
})

test('closing a picker ignores late list or detail replies and restores trigger focus', async () => {
  const app = setup()
  app.state.openChooser()
  app.state.requestClose()
  app.requests[0].resolve(list)
  await settle()
  assert.equal(app.state.mode.value, null)
  assert.deepEqual(app.state.templateList.value, [])
  assert.equal(app.returnFocusCount(), 1)
  await preview(app)
  app.state.selectTemplate('b')
  const pending = app.requests.at(-1)
  app.state.requestClose()
  pending.resolve(detail('b'))
  await settle()
  assert.equal(app.state.selectedDetail.value, null)
  assert.equal(app.emissions.length, 0)
  app.unmount()
})

test('Escape and backdrop/cancel cannot dismiss an in-flight save or silently submit it again', async () => {
  const app = setup({ questions: [question()] })
  app.state.openSave()
  app.state.templateName.value = '申请表'
  const pending = app.state.saveTemplate()
  let prevented = false, stopped = false
  app.state.onDialogKeydown({ key: 'Escape', preventDefault() { prevented = true }, stopPropagation() { stopped = true } })
  app.state.requestClose()
  assert.equal(prevented, true)
  assert.equal(stopped, true)
  assert.equal(app.state.mode.value, 'save')
  assert.match(app.state.closeHint.value, /保存/)
  assert.equal(app.requests.length, 1)
  app.requests[0].resolve({ id: 'a', name: '申请表', questions: [question()] })
  await pending
  assert.equal(app.state.mode.value, null)
  app.unmount()
})

test('starting a save moves focus to the dialog while disabled form controls await the server', async () => {
  const app = setup({ questions: [question()] })
  let panelFocusCount = 0
  const nameInput = { focus() { app.browserDocument.activeElement = nameInput } }
  const panel = {
    querySelector() { return app.state.saving.value ? null : nameInput },
    focus() { panelFocusCount += 1; app.browserDocument.activeElement = panel },
  }
  app.state.dialogRef.value = panel
  app.state.openSave()
  await settle()
  assert.equal(app.browserDocument.activeElement, nameInput)
  app.state.templateName.value = '申请表'
  const pending = app.state.saveTemplate()
  // Native form controls lose focus when disabled. Keep keyboard events inside
  // the modal by explicitly focusing its tabindex=-1 container on the next tick.
  app.browserDocument.activeElement = { tagName: 'BODY' }
  await settle()
  assert.equal(app.state.saving.value, true)
  assert.equal(app.requests.length, 1)
  assert.equal(panelFocusCount, 1)
  assert.equal(app.browserDocument.activeElement, panel)
  app.requests[0].resolve({ id: 'a', name: '申请表', questions: [question()] })
  await pending
  app.unmount()
})

test('Tab wraps within the dialog and Escape closes a picker', async () => {
  const app = setup()
  const first = { focus() { app.browserDocument.activeElement = first } }
  const last = { focus() { app.browserDocument.activeElement = last } }
  const panel = { querySelector: () => first, querySelectorAll: () => [first, last], contains: element => element === first || element === last }
  app.state.dialogRef.value = panel
  app.state.openChooser()
  await settle()
  assert.equal(app.browserDocument.activeElement, first)
  let prevented = 0
  app.browserDocument.activeElement = last
  app.state.onDialogKeydown({ key: 'Tab', shiftKey: false, preventDefault() { prevented += 1 } })
  assert.equal(app.browserDocument.activeElement, first)
  app.state.onDialogKeydown({ key: 'Tab', shiftKey: true, preventDefault() { prevented += 1 } })
  assert.equal(app.browserDocument.activeElement, last)
  assert.equal(prevented, 2)
  app.state.onDialogKeydown({ key: 'Escape', preventDefault() {}, stopPropagation() {} })
  await settle()
  assert.equal(app.state.mode.value, null)
  assert.equal(app.returnFocusCount(), 1)
  app.requests[0].resolve([])
  app.unmount()
})

test('parent context changes close the dialog and ignore all replies for the previous job', async () => {
  const app = setup()
  app.state.openChooser()
  const pending = app.requests[0]
  app.props.editingId = 'other-job'
  app.props.job = { id: 'other-job', status: 'ONLINE', applicationCount: 5 }
  await settle()
  pending.resolve(list)
  await settle()
  assert.equal(app.state.mode.value, null)
  assert.deepEqual(app.state.templateList.value, [])
  assert.deepEqual(app.emissions, [])
  app.unmount()
})

test('question edits invalidate a preview and pending save replies cannot update a new context', async () => {
  const app = setup({ questions: [question()] })
  await preview(app)
  app.props.questions[0].title = '修改后的题目'
  await settle()
  assert.equal(app.state.mode.value, null)
  app.state.openSave()
  app.state.templateName.value = '原问卷'
  const pending = app.state.saveTemplate()
  const request = app.requests.at(-1)
  app.props.editingId = 'other'
  await settle()
  request.resolve({ id: 'old', name: '原问卷', questions: [question()] })
  await pending
  assert.equal(app.state.mode.value, null)
  assert.doesNotMatch(app.state.notice.value, /已保存/)
  assert.doesNotMatch(app.state.notice.value, /仍在保存/, 'a stale context notice must not continue claiming a finished request is pending')
  assert.deepEqual(app.emissions, [])
  app.unmount()
})

test('unmount invalidates pending requests without success notices, emissions or focus changes', async () => {
  for (const operation of ['list', 'detail', 'save']) {
    const app = setup({ questions: [question()] })
    let pending
    if (operation === 'save') {
      app.state.openSave()
      app.state.templateName.value = '申请表'
      pending = app.state.saveTemplate()
    } else {
      app.state.openChooser()
      if (operation === 'detail') {
        app.requests[0].resolve(list)
        await settle()
        app.state.selectTemplate('a')
      }
    }
    const request = app.requests.at(-1)
    app.unmount()
    request.resolve(operation === 'list' ? list : detail())
    await pending
    await settle()
    assert.equal(app.state.notice.value, '')
    assert.equal(app.state.selectedDetail.value, null)
    assert.deepEqual(app.emissions, [])
    assert.equal(app.returnFocusCount(), 0)
  }
})

test('rendered template preview shows labels, required status, options and escaped input hints', async () => {
  const app = setup()
  app.state.openChooser()
  app.requests[0].resolve([{ id: 'all', name: '全题型', questionCount: 5 }])
  await settle()
  app.state.selectTemplate('all')
  app.requests[1].resolve({ id: 'all', name: '全题型', questions: [
    question('到岗时间'),
    { ...question('经历'), questionType: 'TEXTAREA', required: false },
    { ...question('方向'), questionType: 'RADIO', options: ['研发', '<script>alert(1)</script>'] },
    { ...question('城市'), questionType: 'CHECKBOX', options: ['上海', '北京'] },
    { ...question('附件'), questionType: 'FILE_UPLOAD', placeholder: '' },
  ] })
  await settle()
  const rendered = await html(app)
  for (const label of ['单行文本', '多行文本', '单选', '多选', '文件上传', '必填', '选填', '输入提示：例如：下周', '研发', '上海']) assert.ok(rendered.includes(label), label)
  assert.ok(rendered.includes('&lt;script&gt;alert(1)&lt;/script&gt;'))
  assert.ok(rendered.includes('role="dialog"'))
  assert.ok(rendered.includes('aria-modal="true"'))
  assert.ok(rendered.includes('全题型'))
  app.unmount()
})
