import test from 'node:test'
import assert from 'node:assert/strict'

async function helpers() {
  try {
    return await import('../src/lib/questionnaireTemplates.mjs')
  } catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND') {
      assert.fail('Shared questionnaire template helper has not been implemented')
    }
    throw error
  }
}

const questions = () => [
  { id: '9007199254740993', jobPostId: 'previous-job', answer: 'private', fileId: 'private-file',
    title: '意向方向', questionType: 'RADIO', options: ['编辑', '运营'], required: true,
    placeholder: '请选择', sortOrder: 9 },
  { id: 'old-question', title: '个人简历', questionType: 'FILE_UPLOAD', options: [], required: false,
    placeholder: '', sortOrder: 20 },
]
const detail = () => ({ id: '9007199254740995', name: '运营问卷', questions: questions() })

test('saving a template copies only question definitions and resequences their order', async () => {
  const { buildTemplatePayload } = await helpers()
  const input = questions()
  const payload = buildTemplatePayload('  运营问卷  ', input)
  assert.equal(payload.name, '运营问卷')
  assert.deepEqual(payload.questions, [
    { sortOrder: 1, title: '意向方向', questionType: 'RADIO', options: ['编辑', '运营'], required: true, placeholder: '请选择' },
    { sortOrder: 2, title: '个人简历', questionType: 'FILE_UPLOAD', options: [], required: false, placeholder: '' },
  ])
  assert.equal(input[0].sortOrder, 9)
  assert.equal(input[0].id, '9007199254740993')
})

test('editing applied question options cannot mutate the saved template or editor source', async () => {
  const { cloneTemplateQuestions } = await helpers()
  const input = questions()
  const snapshot = cloneTemplateQuestions(input)
  const applied = cloneTemplateQuestions(snapshot)
  applied[0].options[0] = '改写后的选项'
  applied[0].title = '新题目'
  assert.deepEqual(snapshot[0].options, ['编辑', '运营'])
  assert.deepEqual(input[0].options, ['编辑', '运营'])
  assert.equal(snapshot[0].title, '意向方向')
})

test('template names reject blank or overlong values and count Unicode characters', async () => {
  const { buildTemplatePayload } = await helpers()
  for (const name of ['', '  ', '题'.repeat(81), null, 123]) {
    assert.throws(() => buildTemplatePayload(name, questions()), /名称/)
  }
  assert.equal(buildTemplatePayload('😀'.repeat(80), questions()).name, '😀'.repeat(80))
})

test('all five current question types retain text and normalize optional settings', async () => {
  const { cloneTemplateQuestions } = await helpers()
  const rows = ['TEXT', 'TEXTAREA', 'RADIO', 'CHECKBOX', 'FILE_UPLOAD'].map(questionType => ({
    title: ' 一段\n文字 ', questionType,
    options: ['RADIO', 'CHECKBOX'].includes(questionType) ? [' 选项一 ', '选项二'] : [],
  }))
  const copied = cloneTemplateQuestions(rows)
  assert.equal(copied.length, 5)
  assert.equal(copied[0].title, ' 一段\n文字 ')
  assert.equal(copied[2].options[0], ' 选项一 ')
  assert.equal(copied[0].required, false)
  assert.equal(copied[0].placeholder, '')
})

test('invalid questions fail before a template can be submitted', async () => {
  const { buildTemplatePayload } = await helpers()
  const invalid = [
    [], null, [null], [{ title: ' ', questionType: 'TEXT' }],
    [{ title: '问题', questionType: 'UNKNOWN' }],
    [{ title: '问题', questionType: 'RADIO', options: [] }],
    [{ title: '问题', questionType: 'CHECKBOX', options: ['有效', ' '] }],
    [{ title: '问题', questionType: 'RADIO', options: [42] }],
    [{ title: '问题', questionType: 'TEXT', required: 'false' }],
    [{ title: '问题', questionType: 'TEXT', placeholder: {} }],
  ]
  for (const input of invalid) assert.throws(() => buildTemplatePayload('运营', input))
})

test('question types must be strings rather than values that coerce to enum keys', async () => {
  const { cloneTemplateQuestions } = await helpers()
  for (const questionType of [['TEXT'], new String('TEXT'), { toString: () => 'TEXT' }]) {
    assert.throws(() => cloneTemplateQuestions([{ title: '题目', questionType }]), /题型/)
  }
})

test('missing array entries cannot be serialized into null questions or options', async () => {
  const { buildTemplatePayload } = await helpers()
  assert.throws(() => buildTemplatePayload('运营', Array(1)))
  assert.throws(() => buildTemplatePayload('运营', [
    { title: '方向', questionType: 'RADIO', options: Array(1) },
  ]))
})

test('template detail preserves exact Java Long IDs and rejects rounded numeric IDs', async () => {
  const { normalizeTemplateDetail } = await helpers()
  const value = normalizeTemplateDetail(detail())
  assert.equal(value.id, '9007199254740995')
  assert.equal(value.questions[0].id, undefined)
  assert.throws(() => normalizeTemplateDetail({ ...detail(), id: 9007199254740995 }), /标识/)
  for (const id of [null, undefined, '', '  ', false, {}, 0]) {
    assert.throws(() => normalizeTemplateDetail({ ...detail(), id }), /标识/)
  }
  assert.equal(normalizeTemplateDetail({ ...detail(), id: 25 }).id, '25')
})

test('malformed or empty template details are rejected instead of replacing a questionnaire', async () => {
  const { normalizeTemplateDetail } = await helpers()
  for (const value of [null, {}, { ...detail(), questions: [] }, { ...detail(), name: '' }]) {
    assert.throws(() => normalizeTemplateDetail(value))
  }
})

test('template lists require the agreed array and usable summary fields', async () => {
  const { normalizeTemplateList } = await helpers()
  const row = { id: '9007199254740993', name: '运营问卷', questionCount: 2, createdAt: '2026-10-15T13:00:00', extra: 'discard' }
  assert.deepEqual(normalizeTemplateList([row]), [{
    id: row.id, name: row.name, questionCount: 2, createdAt: row.createdAt,
  }])
  assert.deepEqual(normalizeTemplateList([]), [])
  for (const value of [{ list: [row] }, null, [null], [{ ...row, questionCount: -1 }],
    [{ ...row, questionCount: '2' }], [{ ...row, id: 9007199254740993 }]]) {
    assert.throws(() => normalizeTemplateList(value))
  }
})

test('new jobs and explicitly empty OFFLINE drafts may apply templates', async () => {
  const { canApplyTemplateToJob } = await helpers()
  assert.equal(canApplyTemplateToJob(null, {}), true)
  assert.equal(canApplyTemplateToJob('', {}), true)
  assert.equal(canApplyTemplateToJob('job-1', { status: 'OFFLINE', applicationCount: 0 }), true)
  assert.equal(canApplyTemplateToJob('job-1', { status: 'OFFLINE', applicationCount: '0' }), true)
})

test('unknown or existing submissions cannot be treated as zero when applying templates', async () => {
  const { canApplyTemplateToJob } = await helpers()
  for (const applicationCount of [undefined, null, '', ' ', false, true, 1, -1, '1', NaN]) {
    assert.equal(canApplyTemplateToJob('job-1', { status: 'OFFLINE', applicationCount }), false)
  }
  assert.equal(canApplyTemplateToJob('job-1', { status: 'PUBLISHED', applicationCount: 0 }), false)
  assert.equal(canApplyTemplateToJob('job-1', { applicationCount: 0 }), false)
})

test('shared template requests use the server and encode the selected ID', async () => {
  const { createTemplateApi, TEMPLATE_ENDPOINT } = await helpers()
  const calls = []
  const api = createTemplateApi(async (path, options) => {
    calls.push({ path, options })
    return path === TEMPLATE_ENDPOINT ? [] : { ...detail(), id: 'template/one?scope=all' }
  })
  assert.deepEqual(await api.list(), [])
  await api.get('template/one?scope=all')
  assert.equal(calls[0].path, '/admin/questionnaire/templates')
  assert.equal(calls[1].path, '/admin/questionnaire/templates/template%2Fone%3Fscope%3Dall')
})

test('creating a template sends a validated snapshot and requires a usable server result', async () => {
  const { createTemplateApi, TEMPLATE_ENDPOINT } = await helpers()
  const calls = []
  const api = createTemplateApi(async (path, options) => {
    calls.push({ path, options })
    return detail()
  })
  const saved = await api.create('  运营问卷  ', questions())
  assert.equal(saved.id, '9007199254740995')
  assert.equal(calls[0].path, TEMPLATE_ENDPOINT)
  assert.equal(calls[0].options.method, 'POST')
  const body = JSON.parse(calls[0].options.body)
  assert.equal(body.name, '运营问卷')
  assert.equal(body.questions[0].id, undefined)
  assert.equal(body.questions[0].sortOrder, 1)
  await assert.rejects(() => createTemplateApi(async () => ({})).create('运营', questions()))
})

test('validation and server failures never produce a false save success', async () => {
  const { createTemplateApi } = await helpers()
  let requests = 0
  const conflict = new Error('模板名称已存在')
  const api = createTemplateApi(async () => { requests += 1; throw conflict })
  await assert.rejects(() => api.create('', questions()), /名称/)
  assert.equal(requests, 0)
  await assert.rejects(() => api.create('运营', questions()), error => error === conflict)
  await assert.rejects(() => api.list(), error => error === conflict)
  await assert.rejects(() => api.get('25'), error => error === conflict)
})
